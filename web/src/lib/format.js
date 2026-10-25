// Display helpers. Amounts arrive as decimal strings ("5.50"); we never do money maths on them in the UI.

export function money(amount, asset) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  const text = Number.isFinite(n)
    ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  return asset ? `${text} ${asset}` : text;
}

// Date-only strings ("2026-10-28") are calendar days, so format them in UTC to avoid an off-by-one.
export function day(value) {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(dateOnly && { timeZone: 'UTC' }) });
}

export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function period(value) {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return value || '—';
  return new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const FREQUENCIES = { monthly: 'Monthly', biweekly: 'Every two weeks', weekly: 'Weekly' };
export const frequency = (f) => FREQUENCIES[f] || f || '—';

// Status vocabulary from the design brief. `tone` picks the badge colour in styles.css.
const STATUS = {
  contractor: {
    invited: ['Invited', 'attention'],
    active: ['Vault active', 'positive'],
    paused: ['Paused', 'muted'],
    ended: ['Ended', 'muted'],
  },
  run: {
    draft: ['Draft', 'muted'],
    awaiting_approval: ['Awaiting approval', 'attention'],
    approved: ['Ready', 'info'],
    executing: ['Processing', 'info'],
    partially_confirmed: ['Partly confirmed', 'attention'],
    confirmed: ['Confirmed', 'positive'],
    failed: ['Failed', 'negative'],
    needs_approval: ['Needs approval', 'attention'],
  },
  item: {
    pending: ['Waiting', 'muted'],
    submitted: ['Submitted', 'info'],
    confirmed: ['Confirmed', 'positive'],
    failed: ['Failed', 'negative'],
    needs_approval: ['Needs approval', 'attention'],
  },
};

export function status(kind, value) {
  const [label, tone] = STATUS[kind]?.[value] || [value || 'Unknown', 'muted'];
  return { label, tone };
}

// A finished run whose only unpaid items wait for an administrator is not "failed"; say what it needs.
export function runDisplayStatus(run) {
  const items = run.items || [];
  const waiting = items.some((i) => i.status === 'needs_approval');
  const failed = items.some((i) => i.status === 'failed');
  if (['failed', 'partially_confirmed'].includes(run.status) && waiting && !failed) return 'needs_approval';
  return run.status;
}
