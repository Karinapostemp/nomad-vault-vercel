import { useState } from 'react';
import { endpoints } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { day, frequency } from '../lib/format.js';
import Amount from '../components/Amount.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import InvitationLink from '../components/InvitationLink.jsx';
import AddContractor from '../components/AddContractor.jsx';
import { Empty, ErrorState, Loading, Notice } from '../components/States.jsx';

export default function Contractors() {
  const { data, loading, error, reload, setData } = useApi(endpoints.contractors);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const contractors = data?.contractors || [];

  function replace(updated) {
    setData({ contractors: contractors.map((c) => (c.id === updated.id ? updated : c)) });
  }

  async function act(c, action) {
    setBusyId(c.id);
    setNotice(null);
    try {
      if (action === 'invite') {
        const res = await endpoints.newInvitation(c.id);
        setInvitation({ name: c.displayName, ...res.invitation });
      } else {
        const res = await (action === 'pause' ? endpoints.pauseContractor(c.id) : endpoints.resumeContractor(c.id));
        replace(res.contractor);
        setNotice({ tone: 'success', text: `${c.displayName}’s payments are ${action === 'pause' ? 'paused' : 'active again'}.` });
      }
    } catch (e) {
      const what = { pause: 'pause', resume: 'resume', invite: 'create a new invitation for' }[action];
      setNotice({ tone: 'error', text: `We could not ${what} ${c.displayName}. Nothing changed. ${e.message}` });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1 className="h2">Contractors</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add contractor</button>
      </div>

      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

      {loading && <Loading label="Loading contractors…" />}
      {error && <ErrorState title="We could not load your contractors." error={error} onRetry={reload} />}
      {!loading && !error && contractors.length === 0 && (
        <Empty title="No contractors yet." action={<button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}>Add your first contractor</button>}>
          Invite a contractor and they create their own compensation vault. You never need their bank details.
        </Empty>
      )}

      {contractors.length > 0 && (
        <table className="table">
          <caption className="sr-only">Contractors and their compensation terms</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Location</th>
              <th scope="col" className="align-end">Compensation</th>
              <th scope="col">Frequency</th>
              <th scope="col">Vault</th>
              <th scope="col">Next payment</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td data-label="Name">
                  <span className="person">
                    <span className="avatar" aria-hidden="true">{initials(c.displayName)}</span>
                    <span>
                      <strong>{c.displayName}</strong>
                      <span className="small muted block">{c.email}</span>
                    </span>
                  </span>
                </td>
                <td data-label="Location">{c.countryLabel || '—'}</td>
                <td data-label="Compensation" className="align-end"><Amount value={c.amount} asset={c.asset} /></td>
                <td data-label="Frequency">{frequency(c.frequency)}</td>
                <td data-label="Vault">
                  <StatusBadge kind="contractor" value={c.status} />
                  {c.vaultShort && <span className="small muted block num">{c.vaultShort}</span>}
                </td>
                <td data-label="Next payment">{c.status === 'active' ? day(c.nextPaymentDate) : '—'}</td>
                <td className="align-end">
                  <RowAction contractor={c} busy={busyId === c.id} onAct={act} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={adding} title="Add contractor" onClose={() => setAdding(false)}>
        <AddContractor onCreated={() => reload({ quiet: true })} onDone={() => setAdding(false)} />
      </Modal>

      <Modal open={!!invitation} title={`New invitation for ${invitation?.name || ''}`} onClose={() => setInvitation(null)}>
        {invitation && <InvitationLink invitation={invitation} />}
      </Modal>
    </div>
  );
}

function RowAction({ contractor: c, busy, onAct }) {
  if (c.status === 'active') {
    return <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => onAct(c, 'pause')}>{busy ? 'Pausing…' : 'Pause'}</button>;
  }
  if (c.status === 'paused') {
    return <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => onAct(c, 'resume')}>{busy ? 'Resuming…' : 'Resume'}</button>;
  }
  if (c.status === 'invited') {
    return <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => onAct(c, 'invite')}>{busy ? 'Creating…' : 'New invitation link'}</button>;
  }
  return null;
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
