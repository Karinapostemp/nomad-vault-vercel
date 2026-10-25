import { Link } from 'react-router-dom';
import CopyButton from './CopyButton.jsx';
import { day } from '../lib/format.js';

// Shows a contractor invitation as a full URL with copy and open actions.
export default function InvitationLink({ invitation }) {
  const url = `${window.location.origin}${invitation.url}`;
  return (
    <div className="invite-link">
      <label className="field-label" htmlFor="invite-url">Invitation link</label>
      <div className="invite-link-row">
        <input id="invite-url" className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
        <CopyButton text={url} />
      </div>
      <p className="small muted">
        Send this link to the contractor. {invitation.expiresAt && <>It expires on {day(invitation.expiresAt)}. </>}
        <Link to={invitation.url}>Open the invitation</Link>
      </p>
    </div>
  );
}
