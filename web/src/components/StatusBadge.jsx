import { status } from '../lib/format.js';

// kind: 'contractor' | 'run' | 'item'. Tone classes live in styles.css (.badge--positive etc.).
export default function StatusBadge({ kind, value }) {
  const { label, tone } = status(kind, value);
  return <span className={`badge badge--${tone}`}>{label}</span>;
}

export function Tag({ children, tone = 'muted' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
