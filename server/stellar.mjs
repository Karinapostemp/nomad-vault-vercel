// Stellar access for the backend: read-only views, treasury payments signed under a smart-account rule,
// and event reads. Signing keys come from the local `stellar keys` store (demo) or env secrets.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { rpc, TransactionBuilder, Operation, Address, nativeToScVal, scValToNative, xdr, Keypair, Account, hash, BASE_FEE } from '@stellar/stellar-sdk';

export const CONFIG_PATH = new URL('../config/deployments.testnet.json', import.meta.url);
export const cfg = JSON.parse(readFileSync(CONFIG_PATH));
export const saveConfig = () => writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
export const server = new rpc.Server(cfg.rpcUrl);
export const txLink = (h) => `${cfg.explorer}/tx/${h}`;

// Secret from env (NV_<NAME>_SECRET) or the local stellar CLI keystore alias. Never logged.
export function keypair(alias) {
  const env = process.env[`NV_${alias.replace(/^nv-/, '').toUpperCase()}_SECRET`];
  if (env) return Keypair.fromSecret(env);
  return Keypair.fromSecret(execFileSync('stellar', ['keys', 'show', alias], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
}
export const address = (alias) => execFileSync('stellar', ['keys', 'address', alias]).toString().trim();

const viewer = new Account(Keypair.random().publicKey(), '0');
export async function view(contract, fn, args) {
  const tx = new TransactionBuilder(viewer, { fee: BASE_FEE, networkPassphrase: cfg.networkPassphrase })
    .addOperation(Operation.invokeContractFunction({ contract, function: fn, args })).setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${fn}: ${sim.error.split('\n')[0]}`);
  return scValToNative(sim.result.retval);
}

const sym = (s) => xdr.ScVal.scvSymbol(s);
export const scMap = (entries) => xdr.ScVal.scvMap(entries.map(([k, v]) => new xdr.ScMapEntry({ key: sym(k), val: v })));
export const externalSigner = (kp) => xdr.ScVal.scvVec([sym('External'), new Address(cfg.treasury.ed25519Verifier).toScVal(), xdr.ScVal.scvBytes(Buffer.from(kp.rawPublicKey()))]);

async function build(feePayer, op) {
  return new TransactionBuilder(await server.getAccount(feePayer.publicKey()), { fee: BASE_FEE, networkPassphrase: cfg.networkPassphrase })
    .addOperation(op).setTimeout(120).build();
}

// Invoke `fn` on `contract` with the treasury's authorization signed by `signer` under `ruleId`.
// The deployed account predates OpenZeppelin v0.8: it verifies sha256(signature_payload || xdr(rule_ids)).
export async function callAsTreasury({ treasury = cfg.treasury.account, contract, fn, args, ruleId, signer, feePayer }) {
  const op = (auth) => Operation.invokeContractFunction({ contract, function: fn, args, ...(auth ? { auth } : {}) });
  const sim1 = await server.simulateTransaction(await build(feePayer, op()));
  if (rpc.Api.isSimulationError(sim1)) return { ok: false, code: errorCode(sim1.error), error: sim1.error.split('\n')[0] };
  const entry = sim1.result.auth.find((a) => a.credentials().switch().name === 'sorobanCredentialsAddress'
    && Address.fromScAddress(a.credentials().address().address()).toString() === treasury);
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger((await server.getLatestLedger()).sequence + 60);
  const payload = hash(xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(new xdr.HashIdPreimageSorobanAuthorization({
    networkId: hash(Buffer.from(cfg.networkPassphrase)), nonce: creds.nonce(),
    signatureExpirationLedger: creds.signatureExpirationLedger(), invocation: entry.rootInvocation(),
  })).toXDR());
  const ruleIds = xdr.ScVal.scvVec([xdr.ScVal.scvU32(ruleId)]);
  const digest = hash(Buffer.concat([payload, ruleIds.toXDR()]));
  creds.signature(scMap([
    ['context_rule_ids', ruleIds],
    ['signers', xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: externalSigner(signer), val: xdr.ScVal.scvBytes(Buffer.from(signer.sign(digest))) })])],
  ]));
  const tx = await build(feePayer, op([entry]));
  const sim2 = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim2)) return { ok: false, code: errorCode(sim2.error), error: sim2.error.split('\n')[0] };
  const ready = rpc.assembleTransaction(tx, sim2).build();
  ready.sign(feePayer);
  const sent = await server.sendTransaction(ready);
  if (sent.status === 'ERROR') return { ok: false, code: 'submit_error', error: 'The network refused the transaction.' };
  const res = await server.pollTransaction(sent.hash, { attempts: 40, sleepStrategy: () => 1500 });
  return res.status === 'SUCCESS' ? { ok: true, hash: sent.hash } : { ok: false, code: 'tx_failed', hash: sent.hash, error: `Transaction ${res.status}` };
}

// Contract error #3221 is the OpenZeppelin spending-limit policy refusing the spend.
function errorCode(message) {
  const m = message.match(/Error\(Contract, #(\d+)\)/g)?.pop();
  if (m?.includes('#3221')) return 'policy_limit';
  if (m) return `contract_${m.match(/\d+/)[0]}`;
  if (/balance/i.test(message)) return 'insufficient_balance';
  return 'simulation_failed';
}

export const payFromTreasury = ({ to, amountMinor, signer, ruleId, feePayer }) => callAsTreasury({
  contract: cfg.asset.contract, fn: 'transfer', ruleId, signer, feePayer,
  args: [new Address(cfg.treasury.account).toScVal(), new Address(to).toScVal(), nativeToScVal(BigInt(amountMinor), { type: 'i128' })],
});

export const balanceOf = async (addr) => BigInt(await view(cfg.asset.contract, 'balance', [new Address(addr).toScVal()]));

export async function accountExists(addr) {
  try { await server.getAccount(addr); return true; } catch { return false; }
}

// Asset transfers out of the treasury, newest first (optionally only to one recipient).
export async function treasuryTransfers({ to } = {}) {
  const latest = (await server.getLatestLedger()).sequence;
  const startLedger = Math.max(cfg.treasury.deployedFromLedger, latest - 120_000);
  const topic = [sym('transfer').toXDR('base64'), new Address(cfg.treasury.account).toScVal().toXDR('base64'), to ? new Address(to).toScVal().toXDR('base64') : '*', '*'];
  const res = await server.getEvents({ startLedger, filters: [{ type: 'contract', contractIds: [cfg.asset.contract], topics: [topic] }], limit: 100 });
  return res.events.reverse().map((e) => {
    const value = scValToNative(e.value);
    const amount = typeof value === 'object' && value !== null && 'amount' in value ? value.amount : value;
    return { at: e.ledgerClosedAt, to: scValToNative(e.topic[2]), amountMinor: BigInt(amount).toString(), tx: e.txHash, link: txLink(e.txHash) };
  });
}

export async function policyState() {
  const t = new Address(cfg.treasury.account).toScVal();
  const [rule, limit, latest] = await Promise.all([
    view(cfg.treasury.account, 'get_context_rule', [xdr.ScVal.scvU32(cfg.treasury.payrollRuleId)]),
    view(cfg.treasury.spendingLimitPolicy, 'get_spending_limit_data', [xdr.ScVal.scvU32(cfg.treasury.payrollRuleId), t]),
    server.getLatestLedger().then((l) => l.sequence),
  ]);
  // The policy prunes old entries lazily, so count only spends still inside the window.
  const spent = limit.spending_history.filter((s) => s.ledger_sequence > latest - limit.period_ledgers).reduce((a, s) => a + BigInt(s.amount), 0n);
  return { rule: rule.name, validUntil: rule.valid_until ?? null, latest, limitMinor: BigInt(limit.spending_limit), spentMinor: spent, windowLedgers: limit.period_ledgers };
}
