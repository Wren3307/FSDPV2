import { useEffect, useState } from 'react';

/** Loads JSON from the API. Returns { data, failed }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`${path} returned ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ data, failed: false }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ data: null, failed: true });
      });
    return () => controller.abort();
  }, [path]);

  return state;
}

export const LoadFailed = ({ what }) => (
  <p className="notice" role="alert">
    {what} could not load. Refresh the page, or call <a href="tel:+6565131588">(+65) 6513 1588</a>.
  </p>
);
