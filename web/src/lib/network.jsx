import { createContext, useContext } from 'react';
import { api } from './api.js';
import { useApi } from './useApi.js';

// Network facts (asset code, explorer base URL) loaded once and shared.
const NetworkContext = createContext({});

export function NetworkProvider({ children }) {
  const { data } = useApi(() => api('/network-config'));
  return <NetworkContext.Provider value={data || {}}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
