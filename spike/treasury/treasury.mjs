// Phase 0 spike: company treasury as an OpenZeppelin smart account on testnet.
// Rule 0 (Default) = admin key. Rule 1 (CallContract(XLM SAC)) = payroll operator key, capped by the
// spending-limit policy. Shows: operator pays within budget, operator over budget is rejected, admin still pays.
// Reuses contracts SDF already deployed on testnet (no Rust needed).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rpc, TransactionBuilder, Operation, Address, nativeToScVal, xdr, Keypair, hash, Networks, BASE_FEE } from '@stellar/stellar-sdk';

const RPC = 'https://soroban-testnet.stellar.org';
const ACCOUNT_WASM = '1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a';
const ED25519_VERIFIER = 'CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4';
const SPENDING_LIMIT_POLICY = 'CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G';
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const XLM = 10_000_000n;
const STATE = new URL('./state.json', import.meta.url);

const server = new rpc.Server(RPC);
const cli = (...a) => { try { return execFileSync('stellar', a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { throw new Error('stellar ' + a.slice(0, 3).join(' ') + ': ' + e.stderr.toString().slice(-700)); } };
const kp = (alias) => Keypair.fromSecret(cli('keys', 'show', alias));
const fee = kp('nv-employer');
const admin = kp('nv-admin');
const operator = kp('nv-operator');
const maya = cli('keys', 'address', 'nv-maya');
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE)) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const log = (...a) => console.log(...a);

const sym = (s) => xdr.ScVal.scvSymbol(s);
const map = (entries) => xdr.ScVal.scvMap(entries.map(([k, v]) => new xdr.ScMapEntry({ key: sym(k), val: v })));
const externalSigner = (pub) => xdr.ScVal.scvVec([sym('External'), new Address(ED25519_VERIFIER).toScVal(), xdr.ScVal.scvBytes(Buffer.from(pub.rawPublicKey()))]);

async function build(op) {
  return new TransactionBuilder(await server.getAccount(fee.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(op).setTimeout(120).build();
}

// Sign the treasury's auth entry as `signerKp` under `ruleId`. The deployed account predates the
// v0.8 auth_digest scheme, so it signs sha256(signature_payload || xdr(rule_ids)) ("legacy").
async function callAsTreasury({ contract, fn, args, ruleId, signerKp, scheme = state.scheme || 'legacy' }) {
  const op = (auth) => Operation.invokeContractFunction({ contract, function: fn, args, ...(auth ? { auth } : {}) });
  const sim1 = await server.simulateTransaction(await build(op()));
  if (rpc.Api.isSimulationError(sim1)) throw new Error('record sim failed: ' + sim1.error.split('\n')[0]);
  if (process.env.DEBUG_AUTH) { const a0 = sim1.result.auth[0]; console.log('auth[0]', typeof a0, a0 && a0.constructor && a0.constructor.name, Object.keys(a0 || {}).slice(0, 8)); }
  const authEntries = sim1.result.auth.map((a) => (typeof a === 'string' ? xdr.SorobanAuthorizationEntry.fromXDR(a, 'base64') : a));
  const entry = authEntries.find((a) => a.credentials().switch().name === 'sorobanCredentialsAddress'
    && Address.fromScAddress(a.credentials().address().address()).toString() === state.treasury);
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger((await server.getLatestLedger()).sequence + 60);
  const payload = hash(xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(new xdr.HashIdPreimageSorobanAuthorization({
    networkId: hash(Buffer.from(Networks.TESTNET)), nonce: creds.nonce(),
    signatureExpirationLedger: creds.signatureExpirationLedger(), invocation: entry.rootInvocation(),
  })).toXDR());
  const ruleIds = xdr.ScVal.scvVec([xdr.ScVal.scvU32(ruleId)]);
  const digest = scheme === 'raw' ? payload : hash(Buffer.concat([payload, ruleIds.toXDR()]));
  creds.signature(map([
    ['context_rule_ids', ruleIds],
    ['signers', xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: externalSigner(signerKp), val: xdr.ScVal.scvBytes(Buffer.from(signerKp.sign(digest))) })])],
  ]));
  const tx = await build(op([entry]));
  const sim2 = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim2)) {
    return { ok: false, error: sim2.error.match(/Error\(Contract, #\d+\)/g)?.pop() ?? sim2.error.split('\n')[0] };
  }
  const ready = rpc.assembleTransaction(tx, sim2).build();
  ready.sign(fee);
  const sent = await server.sendTransaction(ready);
  const res = await server.pollTransaction(sent.hash, { attempts: 30 });
  return { ok: res.status === 'SUCCESS', status: res.status, hash: sent.hash };
}

const pay = (signerKp, ruleId, amount) => callAsTreasury({
  contract: XLM_SAC, fn: 'transfer', ruleId, signerKp,
  args: [new Address(state.treasury).toScVal(), new Address(maya).toScVal(), nativeToScVal(amount, { type: 'i128' })],
});

// 1. Deploy the treasury account with the admin as rule 0.
if (!state.treasury) {
  const signers = JSON.stringify([{ External: [ED25519_VERIFIER, Buffer.from(admin.rawPublicKey()).toString('hex')] }]);
  state.treasury = cli('contract', 'deploy', '--wasm-hash', ACCOUNT_WASM, '--source', 'nv-employer', '--network', 'testnet', '--', '--signers', signers, '--policies', '{}');
  save();
  log('treasury deployed', state.treasury);
}
// 2. Fund it with 100 XLM from the employer's classic account.
if (!state.funded) {
  cli('contract', 'invoke', '--id', XLM_SAC, '--source', 'nv-employer', '--network', 'testnet', '--', 'transfer',
    '--from', 'nv-employer', '--to', state.treasury, '--amount', String(100n * XLM));
  state.funded = true; save();
  log('treasury funded 100 XLM');
}
// 3. Admin adds the payroll rule: operator key, XLM transfers only, 20 XLM per ~1 day (17280 ledgers).
if (state.payrollRule === undefined) {
  const latest = (await server.getLatestLedger()).sequence;
  const params = map([['period_ledgers', xdr.ScVal.scvU32(17280)], ['spending_limit', nativeToScVal(20n * XLM, { type: 'i128' })]]);
  const args = [
    xdr.ScVal.scvVec([sym('CallContract'), new Address(XLM_SAC).toScVal()]),
    xdr.ScVal.scvString('payroll'),
    xdr.ScVal.scvU32(latest + 120960),
    xdr.ScVal.scvVec([externalSigner(operator)]),
    xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: new Address(SPENDING_LIMIT_POLICY).toScVal(), val: params })]),
  ];
  let r;
  for (const scheme of ['legacy', 'raw']) {
    r = await callAsTreasury({ contract: state.treasury, fn: 'add_context_rule', args, ruleId: 0, signerKp: admin, scheme });
    log('add_context_rule', scheme, r);
    if (r.ok) { state.scheme = scheme; break; }
  }
  if (!r.ok) process.exit(1);
  state.payrollRule = 1; save();
}
// 4. The demo: within budget, over budget, admin override.
const results = {
  operatorPays12: await pay(operator, state.payrollRule, 12n * XLM),
  operatorPays12Again_overLimit: await pay(operator, state.payrollRule, 12n * XLM),
  adminPays12: await pay(admin, 0, 12n * XLM),
};
log(JSON.stringify(results, null, 2));
state.lastRun = { at: new Date().toISOString(), results }; save();
