import { Link } from 'react-router-dom';
import { endpoints } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { dateTime, period, runDisplayStatus } from '../lib/format.js';
import Amount from '../components/Amount.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ReviewPayrollButton from '../components/ReviewPayrollButton.jsx';
import { Empty, ErrorState, Loading } from '../components/States.jsx';

export default function PayrollHistory() {
  const { data, loading, error, reload } = useApi(endpoints.runs);
  const runs = data?.runs || [];

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1 className="h2">Payroll</h1>
        </div>
        {!loading && !error && <ReviewPayrollButton runs={runs} />}
      </div>

      {loading && <Loading label="Loading payroll runs…" />}
      {error && <ErrorState title="We could not load your payroll history." error={error} onRetry={reload} />}
      {!loading && !error && runs.length === 0 && (
        <Empty title="No payroll runs yet.">Prepare a run to review recipients and amounts before anything is paid.</Empty>
      )}

      {runs.length > 0 && (
        <table className="table">
          <caption className="sr-only">Payroll runs, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Created</th>
              <th scope="col">Recipients</th>
              <th scope="col" className="align-end">Total</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td data-label="Period"><Link to={`/app/payroll/${r.id}`}>{period(r.period)}</Link></td>
                <td data-label="Created">{dateTime(r.createdAt)}</td>
                <td data-label="Recipients" className="num">{r.items?.length ?? '—'}</td>
                <td data-label="Total" className="align-end"><Amount value={r.total} asset={r.asset} /></td>
                <td data-label="Status"><StatusBadge kind="run" value={runDisplayStatus(r)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
