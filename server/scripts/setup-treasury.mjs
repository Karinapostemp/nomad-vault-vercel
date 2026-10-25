// One-time setup: deploy a company treasury smart account on testnet, fund it, and add the payroll rule
// (operator key, asset transfers only, daily spending limit). Writes the result into config/deployments.testnet.json.
// Usage: node server/scripts/setup-treasury.mjs [--limit 20] [--fund 150]
import { execFileSync } from 'node:child_process';
import { Address, nativeToScVal, xdr, Keypair } from '@stellar/stellar-sdk';
import { cfg, saveConfig, server, keypair, scMap, externalSigner, callAsTreasury } from '../stellar.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const UNIT = 10_000_000n;
const limit = BigInt(arg('limit', '20')) * UNIT;
const fund = BigInt(arg('fund', '150')) * UNIT;
const cli = (...a) => execFileSync('stellar', a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const T = cfg.treasury;
const admin = keypair('nv-admin');
const operator = keypair('nv-operator');
const feePayer = keypair(T.feePayerAlias || 'nv-employer');

const signers = JSON.stringify([{ External: [T.ed25519Verifier, Buffer.from(admin.rawPublicKey()).toString('hex')] }]);
const treasury = cli('contract', 'deploy', '--wasm-hash', T.accountWasmHash, '--source', T.feePayerAlias || 'nv-employer', '--network', 'testnet', '--', '--signers', signers, '--policies', '{}');
const deployedFromLedger = (await server.getLatestLedger()).sequence - 5;
console.log('treasury', treasury);

cli('contract', 'invoke', '--id', cfg.asset.contract, '--source', T.feePayerAlias || 'nv-employer', '--network', 'testnet', '--', 'transfer',
  '--from', T.feePayerAlias || 'nv-employer', '--to', treasury, '--amount', fund.toString());
console.log('funded', String(fund / UNIT));

const latest = (await server.getLatestLedger()).sequence;
const params = scMap([['period_ledgers', xdr.ScVal.scvU32(17280)], ['spending_limit', nativeToScVal(limit, { type: 'i128' })]]);
const r = await callAsTreasury({
  treasury, contract: treasury, fn: 'add_context_rule', ruleId: 0, signer: admin, feePayer,
  args: [
    xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('CallContract'), new Address(cfg.asset.contract).toScVal()]),
    xdr.ScVal.scvString('payroll'),
    xdr.ScVal.scvU32(latest + 120960),
    xdr.ScVal.scvVec([externalSigner(operator)]),
    xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: new Address(T.spendingLimitPolicy).toScVal(), val: params })]),
  ],
});
if (!r.ok) { console.error('add_context_rule failed', r); process.exit(1); }
console.log('payroll rule added', r.hash);

Object.assign(cfg.treasury, { account: treasury, payrollRuleId: 1, deployedFromLedger, setupTx: r.hash, dailyLimitMinor: limit.toString() });
saveConfig();
console.log('config updated');
