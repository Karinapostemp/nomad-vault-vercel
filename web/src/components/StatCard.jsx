// A labelled figure with optional supporting content underneath.
export default function StatCard({ label, children, footer, tone }) {
  return (
    <section className={`card stat${tone ? ` card--${tone}` : ''}`}>
      <h2 className="stat-label">{label}</h2>
      <div className="stat-body">{children}</div>
      {footer && <div className="stat-footer small">{footer}</div>}
    </section>
  );
}
