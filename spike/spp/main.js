// Phase 0 spike: drive Stellar Private Payments on testnet with a scripted keypair signer
// (same contract as the Freighter adapter), so the flow runs headless.
import { Buffer } from 'buffer';
import { Keypair, TransactionBuilder, hash } from '@stellar/stellar-sdk';
// SDK built from upstream main (matches the 21 Oct testnet redeploy); npm 0.2.1 is older than the contracts.
import init, { Storage, Client, bootnodeRequired, TX_PROGRESS_EVENT, configureTelemetry } from './vendor-sdk/js/index.js';
import circuitLock from './vendor-sdk/dist/circuits/circuits.json';

const PASSPHRASE = 'Test SDF Network ; September 2015';
const RPC = 'https://soroban-testnet.stellar.org';
const POOL = 'CAALK4NV2DP4H4OWCILGZZJQ27TV53RBDRFENSHEZTRFNSBDY3KG6SUP'; // native XLM pool, no view key

// DEBUG_RPC: log simulateTransaction results (fee, error) to diagnose failed preparations.
const _fetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  const res = await _fetch(url, init);
  try {
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    if (body && body.method === 'simulateTransaction') {
      const j = await res.clone().json();
      const r = j.result || {};
      console.log('SIM', 'minResourceFee', r.minResourceFee, 'err', (r.error || j.error?.message || '').slice(0, 600), 'cost', JSON.stringify(r.cost || {}));
    }
  } catch {}
  return res;
};
new BroadcastChannel('dbg').onmessage = (e) => console.log(...e.data);
const logEl = document.getElementById('log');
const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); logEl.textContent += s + '\n'; };
window.addEventListener(TX_PROGRESS_EVENT, (e) => log('progress', e.detail.flow, e.detail.stage, e.detail.message));

// Freighter-compatible signer: SEP-53 messages, auth-entry preimages, full transactions.
class KeypairSigner {
  constructor(secret) { this.kp = Keypair.fromSecret(secret); }
  async getPublicKey() { return this.kp.publicKey(); }
  async signMessage(message) {
    const payload = Buffer.concat([Buffer.from('Stellar Signed Message:\n'), Buffer.from(message, 'utf8')]);
    // Re-wrap: the SDK's signature is not this module's Buffer, and its toString('base64') is not reliable here.
    const sig = Buffer.from(this.kp.sign(hash(payload))).toString('base64');
    return { signedMessage: sig, signerAddress: this.kp.publicKey() };
  }
  async signAuthEntry(preimageB64) {
    const sig = Buffer.from(this.kp.sign(hash(Buffer.from(preimageB64, 'base64')))).toString('base64');
    return { signedAuthEntry: sig, signerAddress: this.kp.publicKey() };
  }
  async signTransaction(xdr, opts = {}) {
    const tx = TransactionBuilder.fromXDR(xdr, opts.networkPassphrase || PASSPHRASE);
    tx.sign(this.kp);
    return { signedTxXdr: tx.toXDR(), signerAddress: this.kp.publicKey() };
  }
}

let account, pool, client;
const result = (r) => (r && typeof r.toJSON === 'function' ? r.toJSON() : r);

window.spp = {
  async open(secret) {
    await init();
    if (window.SPP_DEBUG) configureTelemetry({ level: 'debug', sink: 'console', revealSensitive: true });
    const contractConfig = await fetch('/deployments.json').then((r) => r.json());
    // Spike only: the local-database key is derived from the testnet secret. Production derives it from a wallet signature.
    const dbKey = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nomad-vault-db:' + secret)));
    const keyProvider = async () => dbKey.slice();
    let storage;
    try { storage = await Storage.open({ keyProvider, createNew: false }); }
    catch { storage = await Storage.open({ keyProvider, createNew: true }); }
    const needsBoot = await bootnodeRequired(RPC, storage, { contractConfig });
    log('bootnodeRequired', needsBoot);
    const circuitsBaseUrl = new URL('/vendor-sdk/dist/circuits/', location.origin).href;
    client = await Client.new({ rpcUrl: RPC, storage, contractConfig, circuitsBaseUrl, circuitLock });
    log('syncing');
    await client.sync();
    const signer = new KeypairSigner(secret);
    account = await client.account({ networkPassphrase: PASSPHRASE, userAddress: signer.kp.publicKey() }, signer);
    await account.derivePrivacyKeys();
    log('account', account.userAddress, 'registered', await account.isRegistered());
    pool = await account.pool({ poolContract: POOL });
    return account.userAddress;
  },
  async register() {
    if (await account.isRegistered()) return 'already';
    return account.registerPublicKeys();
  },
  async sync() { await client.sync(); return 'ok'; },
  async balance() { return (await pool.balance()).toString(); },
  async deposit(stroops) { return result(await pool.deposit(BigInt(stroops))); },
  async transfer(to, stroops) { return result(await pool.transfer(to, BigInt(stroops))); },
  async withdraw(stroops) { return result(await pool.withdraw(BigInt(stroops))); },
  async lookup(addr) { const r = await client.recipientLookup(addr); return { found: !!r.entry, synced: r.registryFullySynced }; },
};
log('ready');
