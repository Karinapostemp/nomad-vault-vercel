// Per-payment progress: Policy checked → Submitted to Stellar → Confirmed. States come only from the API.
const MARK = { todo: '', active: '…', done: '✓', error: '!' };
const SPOKEN = { todo: 'not started', active: 'in progress', done: 'done', error: 'stopped' };

export default function Stepper({ steps = [] }) {
  return (
    <ol className="stepper">
      {steps.map((s) => (
        <li key={s.key} className={`step step--${s.state}`}>
          <span className="step-dot" aria-hidden="true">{MARK[s.state]}</span>
          <span className="step-label">{s.label}</span>
          <span className="sr-only">: {SPOKEN[s.state] || s.state}</span>
        </li>
      ))}
    </ol>
  );
}
