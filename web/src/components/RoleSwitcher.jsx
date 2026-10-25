import { useLocation, useNavigate } from 'react-router-dom';
import { endpoints } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

// Demo-mode role switcher. The current role is read from the URL, so there is no hidden state:
// /vault/:contractorId means "Contractor: <name>", everything else means "Company admin".
export default function RoleSwitcher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useApi(endpoints.contractors, pathname);
  const withVault = (data?.contractors || []).filter((c) => c.vaultAddress);
  const current = pathname.match(/^\/vault\/([^/]+)/)?.[1] || 'admin';

  function onChange(e) {
    const value = e.target.value;
    navigate(value === 'admin' ? '/app' : `/vault/${value}`);
  }

  return (
    <label className="role-switcher">
      <span className="role-switcher-label">Viewing as</span>
      <select className="select" value={current} onChange={onChange}>
        <option value="admin">Company admin</option>
        {withVault.map((c) => (
          <option key={c.id} value={c.id}>Contractor: {c.displayName}</option>
        ))}
        {current !== 'admin' && !withVault.some((c) => c.id === current) && (
          <option value={current}>Contractor</option>
        )}
      </select>
    </label>
  );
}
