// Thin client for the Nomad Vault API (contract: docs/API.md). Every call goes through /api, proxied in dev.

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FALLBACK = {
  0: 'We could not reach Nomad Vault. Check that the server is running, then try again.',
  404: 'We could not find what you asked for.',
  500: 'Something went wrong on our side.',
};

export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, headers: { accept: 'application/json' } };
  if (method !== 'GET') {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(FALLBACK[0], 0);
  }
  const data = await res.json().catch(() => null);
  // A 5xx with no JSON body comes from the dev proxy, not our API: the server is not reachable.
  if (!res.ok && !data && res.status >= 500) throw new ApiError(FALLBACK[0], res.status);
  if (!res.ok) {
    const message = data?.error || FALLBACK[res.status] || (res.status >= 500 ? FALLBACK[500] : 'The request was not accepted.');
    throw new ApiError(message, res.status, data?.code);
  }
  return data;
}

const enc = encodeURIComponent;

export const endpoints = {
  dashboard: () => api('/dashboard'),
  contractors: () => api('/contractors'),
  contractor: (id) => api(`/contractors/${enc(id)}`),
  createContractor: (body) => api('/contractors', { method: 'POST', body }),
  pauseContractor: (id) => api(`/contractors/${enc(id)}/pause`, { method: 'POST' }),
  resumeContractor: (id) => api(`/contractors/${enc(id)}/resume`, { method: 'POST' }),
  newInvitation: (id) => api(`/contractors/${enc(id)}/invitations`, { method: 'POST' }),
  invitation: (token) => api(`/invitations/${enc(token)}`),
  acceptInvitation: (token, vaultAddress) => api(`/invitations/${enc(token)}/accept`, { method: 'POST', body: { vaultAddress } }),
  runs: () => api('/payroll-runs'),
  run: (id) => api(`/payroll-runs/${enc(id)}`),
  createRun: () => api('/payroll-runs', { method: 'POST' }),
  approveRun: (id, approvedBy) => api(`/payroll-runs/${enc(id)}/approve`, { method: 'POST', body: { approvedBy } }),
  executeRun: (id) => api(`/payroll-runs/${enc(id)}/execute`, { method: 'POST' }),
  adminApproveItem: (runId, itemId) => api(`/payroll-runs/${enc(runId)}/items/${enc(itemId)}/admin-approve`, { method: 'POST' }),
  vault: (address) => api(`/vaults/${enc(address)}`),
  fundVault: (address) => api('/demo/fund-vault', { method: 'POST', body: { address } }),
};
