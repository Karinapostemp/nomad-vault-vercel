// Demo vault key, stored in this browser only. Production replaces this with a passkey smart account.
// The secret never leaves the browser: only the public address is sent to the server.

const storageKey = (contractorId) => `nomad-vault:demo-vault-key:${contractorId}`;

export function readVaultKey(contractorId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(contractorId)) || 'null');
  } catch {
    return null;
  }
}

export async function getOrCreateVaultKey(contractorId) {
  const existing = readVaultKey(contractorId);
  if (existing?.publicKey) return existing;
  const { Keypair } = await import('@stellar/stellar-sdk');
  const kp = Keypair.random();
  const record = { publicKey: kp.publicKey(), secret: kp.secret(), createdAt: new Date().toISOString(), note: 'demo vault key, stored in this browser' };
  localStorage.setItem(storageKey(contractorId), JSON.stringify(record));
  return record;
}
