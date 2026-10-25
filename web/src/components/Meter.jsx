// Horizontal usage bar (e.g. daily limit spent). value and max are decimal strings or numbers.
export default function Meter({ value, max, label }) {
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  const pct = m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0;
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={m} aria-valuenow={v}>
      <span className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
