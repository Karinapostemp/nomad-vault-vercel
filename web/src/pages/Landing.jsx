import { Link } from 'react-router-dom';

const STEPS = [
  { title: 'Fund once', body: 'Deposit supported stablecoins into one company treasury.' },
  { title: 'Approve compensation', body: 'Set recurring amounts per contractor and approve each payroll run.' },
  { title: 'Give people control', body: 'Contractors hold, send or withdraw from a vault they control.' },
];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1 className="h1">Hire anywhere. Pay without borders.</h1>
          <p className="lead">
            Fund one stablecoin treasury, pay your global contractors, and give every person a portable compensation
            account they control.
          </p>
          <div className="actions">
            <Link to="/app" className="btn btn-primary">Explore the demo</Link>
            <a href="#how" className="btn btn-secondary">See how it works</a>
          </div>
        </div>
      </section>
      <section id="how" className="container section">
        <h2 className="h2">One treasury for the company. One vault for every contractor.</h2>
        <ol className="steps-grid">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="step-number num" aria-hidden="true">{i + 1}</span>
              <h3 className="h3">{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="small muted">
          Hackathon prototype on Stellar testnet. Private transfers and passkey sign-in are being integrated; the demo
          labels which parts are live and which are prototypes.
        </p>
      </section>
    </>
  );
}
