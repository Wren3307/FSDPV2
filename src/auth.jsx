import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Calls the JSON API. Returns { ok, status, data }; never throws. */
export async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'The connection failed. Check your internet and try again.' } };
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined while loading, null when logged out

  const refresh = useCallback(async () => {
    const { data } = await api('/auth/me');
    setUser(data.user ?? null);
    return data.user ?? null;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, refresh, logout }), [user, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const ROLE_LABEL = { member: 'Member', instructor: 'Instructor', admin: 'Admin' };
export const STATUS_LABEL = { active: 'Active', pending_payment: 'Waiting for payment', disabled: 'Switched off' };

export const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || null;
