import { useState } from 'react';
import { Tag } from './StatusBadge.jsx';

// Hold / Send / Withdraw panels for the contractor vault. Send and Withdraw are labelled prototypes.
const WITHDRAW_OPTIONS = [
  { id: 'bank', title: 'Bank account', body: 'Paid out to a local bank account through a payout partner.' },
  { id: 'external', title: 'External account', body: 'Move funds to another account you already use.' },
  { id: 'stablecoin', title: 'Keep in stablecoin', body: 'Leave your pay in your vault as a stablecoin balance.' },
  { id: 'convert', title: 'Convert', body: 'Convert to another supported asset.' },
];

export default function VaultActions({ action, onClose }) {
  if (action === 'hold') {
    return (
      <div className="stack">
        <p>Holding is the default. Your pay stays in your vault until you decide what to do with it, and the company cannot take it back.</p>
        <div className="actions"><button type="button" className="btn btn-primary" onClick={onClose}>Got it</button></div>
      </div>
    );
  }
  if (action === 'send') return <SendPanel />;
  return <WithdrawPanel />;
}

function SendPanel() {
  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <p><Tag tone="attention">Prototype</Tag> Sending from your vault is not connected in this demo.</p>
      <div className="field">
        <label className="field-label" htmlFor="send-to">Recipient vault reference</label>
        <input id="send-to" className="input" disabled placeholder="G…" />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="send-amount">Amount</label>
        <input id="send-amount" className="input num" disabled inputMode="decimal" placeholder="0.00" />
      </div>
      <div className="actions"><button type="submit" className="btn btn-primary" disabled>Send</button></div>
    </form>
  );
}

function WithdrawPanel() {
  const [choice, setChoice] = useState(null);
  return (
    <div className="stack">
      <fieldset className="options">
        <legend className="field-label">Where should your money go?</legend>
        {WITHDRAW_OPTIONS.map((o) => (
          <label key={o.id} className={`option${choice === o.id ? ' option--selected' : ''}`}>
            <input type="radio" name="withdraw" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
            <span>
              <strong>{o.title}</strong>
              <span className="small muted block">{o.body}</span>
            </span>
            <Tag tone="info">Coming through partners</Tag>
          </label>
        ))}
      </fieldset>
      <p className="small muted">Withdrawal availability depends on the selected provider and your jurisdiction. Nothing is connected in this demo.</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled>{choice ? 'Coming through partners' : 'Choose an option'}</button>
      </div>
    </div>
  );
}
