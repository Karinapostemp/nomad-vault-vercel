import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../lib/api.js';

const OPEN = ['draft', 'awaiting_approval', 'approved', 'executing', 'needs_approval', 'partially_confirmed', 'failed'];

// Primary CTA. Reuses an open run for review if one exists, otherwise prepares a new draft run.
export default function ReviewPayrollButton({ runs = [], label = 'Review payroll' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const open = runs.find((r) => OPEN.includes(r.status));

  async function start() {
    if (open) return navigate(`/app/payroll/${open.id}`);
    setBusy(true);
    setError(null);
    try {
      const res = await endpoints.createRun();
      navigate(`/app/payroll/${(res.run || res).id}`);
    } catch (e) {
      if (e.status === 409) {
        const { runs: all = [] } = await endpoints.runs().catch(() => ({}));
        const executing = all.find((r) => r.status === 'executing');
        if (executing) return navigate(`/app/payroll/${executing.id}`);
      }
      setError(e);
      setBusy(false);
    }
  }

  return (
    <div className="cta">
      <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
        {busy ? 'Preparing payroll…' : open ? 'Continue payroll review' : label}
      </button>
      {error && (
        <p className="small error-text" role="alert">
          We could not prepare this payroll. No funds moved. {error.message}
        </p>
      )}
    </div>
  );
}
