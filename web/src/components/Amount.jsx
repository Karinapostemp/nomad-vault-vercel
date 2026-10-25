import { money } from '../lib/format.js';

// Every amount on screen goes through here so it gets tabular numerals.
export default function Amount({ value, asset, className = '' }) {
  return <span className={`num ${className}`}>{money(value, asset)}</span>;
}
