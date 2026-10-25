// Pure payroll logic: money parsing/formatting, run building, status rules. No I/O, so it is unit-tested.

export const DECIMALS = 7;
const UNIT = 10n ** BigInt(DECIMALS);

// "5.5" -> 55000000n. Rejects negatives, junk, and more precision than the asset has. Never uses floats.
export function parseAmount(input) {
  const s = String(input ?? '').trim();
  const m = s.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error('Enter an amount like 4.80');
  const [, whole, frac = ''] = m;
  if (frac.length > DECIMALS) throw new Error(`Use at most ${DECIMALS} decimal places`);
  const minor = BigInt(whole) * UNIT + BigInt(frac.padEnd(DECIMALS, '0'));
  if (minor <= 0n) throw new Error('Amount must be greater than zero');
  return minor;
}

// 55000000n -> "5.50" (two decimals for display, more only when needed).
export function formatAmount(minor) {
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  let frac = (abs % UNIT).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  return `${neg ? '-' : ''}${abs / UNIT}.${frac}`;
}

export const sumMinor = (rows) => rows.reduce((a, r) => a + BigInt(r.amountMinor), 0n);

// Items for a new run: active contractors with a vault. Everyone else becomes a warning, not an item.
export function draftItems(contractors) {
  const items = [];
  const warnings = [];
  for (const c of contractors) {
    if (c.status === 'active' && c.vaultAddress) items.push({ contractorId: c.id, amountMinor: c.amountMinor });
    else if (c.status === 'invited') warnings.push(`${c.displayName} has not activated a vault and is not included.`);
    else if (c.status === 'active') warnings.push(`${c.displayName} has no vault address and is not included.`);
  }
  return { items, warnings };
}

// Overall run status from its items, once execution has started.
export function runStatusFromItems(items) {
  const statuses = items.map((i) => i.status);
  if (statuses.some((s) => s === 'pending' || s === 'submitted')) return 'executing';
  const confirmed = statuses.filter((s) => s === 'confirmed').length;
  if (confirmed === items.length) return 'confirmed';
  // Only admin approvals left: nothing failed, the policy just paused the rest.
  if (!statuses.includes('failed')) return 'needs_approval';
  return confirmed > 0 ? 'partially_confirmed' : 'failed';
}

export const canApprove = (run) => run.status === 'draft' || run.status === 'awaiting_approval';
export const canExecute = (run) => ['approved', 'partially_confirmed', 'failed'].includes(run.status);
// Which items an execute call may (re)send: never confirmed ones, never ones waiting for an admin.
export const sendable = (items) => items.filter((i) => i.status === 'pending' || i.status === 'failed');

export function stepsFor(item) {
  const s = item.status;
  const state = (done, active, error) => (error ? 'error' : done ? 'done' : active ? 'active' : 'todo');
  return [
    { key: 'policy', label: 'Policy checked', state: state(['submitted', 'confirmed'].includes(s), s === 'pending' && item.active, s === 'needs_approval') },
    { key: 'submitted', label: 'Submitted to Stellar', state: state(s === 'confirmed', s === 'submitted', s === 'failed') },
    { key: 'confirmed', label: 'Confirmed', state: state(s === 'confirmed', false, false) },
  ];
}

export const FAILURE_MESSAGES = {
  policy_limit: 'This payment exceeds the approved daily treasury limit and needs administrator approval.',
  insufficient_balance: 'The treasury does not hold enough funds for this payment. No funds moved.',
  simulation_failed: 'We could not prepare this payment. No funds moved. Try again.',
  submit_error: 'The network refused this payment. No funds moved. Try again.',
  tx_failed: 'The payment was submitted but did not complete. Check the transaction before retrying.',
};
