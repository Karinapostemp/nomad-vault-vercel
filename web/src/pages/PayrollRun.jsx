import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { endpoints } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { dateTime, period, runDisplayStatus } from '../lib/format.js';
import Amount from '../components/Amount.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge, { Tag } from '../components/StatusBadge.jsx';
import Stepper from '../components/Stepper.jsx';
import TxLink from '../components/TxLink.jsx';
import { Empty, ErrorState, Loading, Notice } from '../components/States.jsx';

const POLL_MS = 1500;
const DEMO_ADMIN = 'Alex';
const REVIEWABLE = ['draft', 'awaiting_approval'];
const FINISHED = ['partially_confirmed', 'confirmed', 'failed'];

export default function PayrollRun() {
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useApi(() => endpoints.run(id), id);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const run = data?.run;

  // Poll while the backend is executing; each row then moves through its own steps.
  useEffect(() => {
    if (run?.status !== 'executing') return undefined;
    let stopped = false;
    let timer;
    const tick = async () => {
      await reload({ quiet: true });
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [run?.status, reload]);

  async function act(name, call, failure) {
    setBusy(name);
    setNotice(null);
    try {
      const res = await call();
      if (res?.run) setData({ run: res.run });
      else await reload({ quiet: true });
    } catch (e) {
      setNotice({ tone: 'error', text: failure(e) });
      await reload({ quiet: true });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="container page"><Loading label="Loading payroll run…" /></div>;
  if (!run) {
    const title = error?.status === 404 ? 'We could not find this payroll run.' : 'We could not load this payroll run.';
    return <div className="container page"><ErrorState title={title} error={error} onRetry={reload} /></div>;
  }

  const items = run.items || [];
  const reviewing = REVIEWABLE.includes(run.status);
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const waitingCount = items.filter((i) => i.status === 'needs_approval').length;

  const approve = () => act('approve', () => endpoints.approveRun(run.id, DEMO_ADMIN),
    (e) => `We could not approve this payroll. No funds moved. ${e.message}`);
  const execute = () => act('execute', () => endpoints.executeRun(run.id),
    (e) => `We could not start this payroll. No funds moved. ${e.message}`);
  const adminApprove = (item) => act(`admin-${item.id}`, () => endpoints.adminApproveItem(run.id, item.id),
    (e) => (e.status === 403
      ? `Administrator approval is not available on this server, so ${item.displayName}’s payment stays on hold. No funds moved.`
      : `We could not pay ${item.displayName}. No funds moved. ${e.message}`));

  return (
    <div className="container page">
      <p className="small"><Link to="/app/payroll">← Payroll history</Link></p>
      <div className="page-head">
        <div>
          <p className="eyebrow">Payroll run</p>
          <h1 className="h2">{period(run.period)}</h1>
        </div>
        <StatusBadge kind="run" value={runDisplayStatus(run)} />
      </div>

      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}
      {error && run && <Notice tone="error">We lost contact with the server while updating. Showing the last known status. {error.message}</Notice>}

      <div className="grid grid--stats">
        <StatCard label="Total payroll" footer={`${items.length} ${items.length === 1 ? 'recipient' : 'recipients'}`}>
          <Amount value={run.total} asset={run.asset} className="figure" />
        </StatCard>
        <StatCard label="Treasury" footer="Before and after this run">
          <p className="figure-pair">
            <Amount value={run.treasuryBefore} />
            <span aria-label="becomes"> → </span>
            <Amount value={run.treasuryAfter} asset={run.asset} />
          </p>
        </StatCard>
        <StatCard label="Spending policy" tone={run.policy?.withinLimit === false ? 'attention' : undefined}>
          {run.policy?.withinLimit === false ? (
            <>
              <Tag tone="attention">Above daily limit</Tag>
              <p className="small">
                The run is larger than the <Amount value={run.policy.remaining} asset={run.asset} /> left in today’s
                operator limit. Payments over the limit will wait for administrator approval.
              </p>
            </>
          ) : (
            <>
              <Tag tone="positive">Within daily limit</Tag>
              <p className="small">
                <Amount value={run.policy?.remaining} asset={run.asset} /> of <Amount value={run.policy?.dailyLimit} asset={run.asset} /> left today.
              </p>
            </>
          )}
        </StatCard>
      </div>

      {run.warnings?.length > 0 && (
        <Notice tone="warning">
          <ul className="plain-list">{run.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="h3">{reviewing ? 'Recipients' : 'Payments'}</h2>
          {run.status === 'executing' && <span className="small muted" aria-live="polite">Updating live</span>}
        </div>
        {items.length === 0 ? (
          <Empty title="No one to pay in this run.">Contractors appear here once they have an active vault.</Empty>
        ) : (
          <ul className="list">
            {items.map((item) => (
              <PaymentRow key={item.id} item={item} asset={run.asset} showSteps={!reviewing}
                busy={busy === `admin-${item.id}`} onAdminApprove={() => adminApprove(item)} />
            ))}
          </ul>
        )}
      </section>

      <div className="action-bar">
        {reviewing && (
          <>
            <p className="small">Approving locks these amounts. Nothing is paid until you execute.</p>
            <button type="button" className="btn btn-primary" onClick={approve} disabled={!!busy || items.length === 0}>
              {busy === 'approve' ? 'Approving…' : 'Approve payroll'}
            </button>
          </>
        )}
        {run.status === 'approved' && (
          <>
            <p className="small">
              Approved by {run.approvedBy || 'an administrator'}{run.approvedAt && ` on ${dateTime(run.approvedAt)}`}. Payments go out
              one by one from the company treasury on Stellar testnet.
            </p>
            <button type="button" className="btn btn-primary" onClick={execute} disabled={!!busy}>
              {busy === 'execute' ? 'Starting…' : 'Execute payroll'}
            </button>
          </>
        )}
        {run.status === 'executing' && <p className="small" aria-live="polite">Sending payments. Each row updates as Stellar confirms it.</p>}
        {FINISHED.includes(run.status) && (
          <>
            <p className="small" aria-live="polite">{finishedText(run.status, failedCount, waitingCount)}</p>
            {failedCount > 0 && (
              <button type="button" className="btn btn-secondary" onClick={execute} disabled={!!busy}>
                {busy === 'execute' ? 'Retrying…' : `Retry ${failedCount} failed ${failedCount === 1 ? 'payment' : 'payments'}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function finishedText(status, failedCount, waitingCount) {
  if (status === 'confirmed') return 'All payments are confirmed on Stellar.';
  const parts = [];
  if (waitingCount > 0) parts.push(`${waitingCount} ${waitingCount === 1 ? 'payment needs' : 'payments need'} administrator approval before ${waitingCount === 1 ? 'it is' : 'they are'} sent.`);
  if (failedCount > 0) parts.push('Some payments did not go through. Retrying only resends the failed ones; confirmed payments are never sent twice.');
  return parts.join(' ') || 'Some payments are still waiting. Check the rows above.';
}

function PaymentRow({ item, asset, showSteps, busy, onAdminApprove }) {
  return (
    <li className="payment-row">
      <div className="payment-main">
        <span>
          <strong>{item.displayName}</strong>
          {item.countryLabel && <span className="small muted block">{item.countryLabel}</span>}
        </span>
        <Amount value={item.amount} asset={asset} />
        {showSteps && <StatusBadge kind="item" value={item.status} />}
      </div>
      {showSteps && <Stepper steps={item.steps} />}
      {item.status === 'confirmed' && item.link && <TxLink href={item.link}>Confirmed on Stellar</TxLink>}
      {item.status === 'failed' && (
        <>
          <p className="small error-text">{item.message || 'This payment did not go through. No funds moved.'}</p>
          {item.link && <TxLink href={item.link}>Check the transaction on Stellar</TxLink>}
        </>
      )}
      {item.status === 'needs_approval' && (
        <div className="needs-approval">
          <p className="small">This payment exceeds the approved daily treasury limit and needs administrator approval.</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={onAdminApprove} disabled={busy}>
            {busy ? 'Approving…' : 'Approve as admin'}
          </button>
        </div>
      )}
    </li>
  );
}
