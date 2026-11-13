import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../auth.jsx';
import { Field, Notice } from '../forms.jsx';
import { PageShell } from '../Layout.jsx';

const ROLES = [
  ['member', 'Member'],
  ['instructor', 'Instructor'],
];

/** The shared login form. `role` is fixed for the admin page; otherwise visitors switch between roles. */
export function LoginForm({ fixedRole, onLoggedIn }) {
  const [role, setRole] = useState(fixedRole ?? 'member');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    const { ok, data } = await api('/auth/login', { method: 'POST', body: { email, password, role } });
    setBusy(false);
    if (ok) onLoggedIn(data.user);
    else {
      setError(data.error ?? 'You could not be logged in. Try again.');
      setPassword('');
    }
  }

  return (
    <form className="panel login-form" onSubmit={submit} noValidate>
      {!fixedRole && (
        <fieldset className="role-switch">
          <legend>Log in as</legend>
          {ROLES.map(([key, label]) => (
            <label key={key} className={role === key ? 'is-on' : undefined}>
              <input type="radio" name="role" value={key} checked={role === key} onChange={() => { setRole(key); setError(''); }} />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      <Field name="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field name="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'Logging in' : `Log in${fixedRole ? '' : ` as ${role === 'member' ? 'a member' : 'an instructor'}`}`}
      </button>
    </form>
  );
}

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  if (user && user.role !== 'admin') return <Navigate to="/account" replace />;

  return (
    <PageShell title="Log in" narrow>
      <p className="page-lead">Members and instructors log in here. Choose which one you are first.</p>
      <LoginForm onLoggedIn={(u) => { setUser(u); navigate('/account'); }} />
      <p className="page-aside">
        Not a member yet? <Link to="/signup">Sign up and pay the $60 registration</Link>.<br />
        Forgot your password? Call Headquarters on <a href="tel:+6565131588">(+65) 6513 1588</a>.
      </p>
    </PageShell>
  );
}
