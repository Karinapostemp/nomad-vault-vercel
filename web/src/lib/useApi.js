import { useCallback, useEffect, useRef, useState } from 'react';

// Loads one API resource. `load` is any function returning a promise; pass `key` to reload when inputs change.
export function useApi(load, key) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadRef.current();
      setState({ loading: false, data, error: null });
      return data;
    } catch (error) {
      setState((s) => ({ loading: false, data: quiet ? s.data : null, error }));
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [key, reload]);

  return { ...state, reload, setData: (data) => setState({ loading: false, data, error: null }) };
}
