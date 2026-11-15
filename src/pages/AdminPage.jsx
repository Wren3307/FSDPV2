import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_LABEL, STATUS_LABEL, api, useAuth } from '../auth.jsx';
import { Field, Notice, fieldProps, focusFirstError } from '../forms.jsx';
import { useApi } from '../useApi.jsx';
import { LoginForm } from './Login.jsx';

const ROLE_FILTERS = [['all', 'Everyone'], ['student', 'Members'], ['instructor', 'Instructors']];

function randomPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function PersonRow({ person, ranks, onChanged }) {
  const [error, setError] = useState('');

  async function change(body, path = `/admin/users/${person.id}`, method = 'PATCH') {
    setError('');
    const { ok, data } = await api(path, { method, body });
    if (ok) onChanged(data.user);
    else setError(data.error);
  }

  return (
    <tr>
      <th scope="row">
        {person.name}
        <span className="cell-sub">{person.email}</span>
        {error && <span className="cell-error" role="alert">{error}</span>}
      </th>
      <td>{ROLE_LABEL[person.role]}</td>
      <td>{person.dojo}</td>
      <td>
        {/* Only members have ranks. Choosing one records a promotion dated today. */}
        {person.role !== 'student' ? '—' : (
          <select aria-label={`Rank for ${person.name}`} value={person.rank} onChange={(e) => change({ rank: e.target.value })}>
            {!ranks.includes(person.rank) && <option value={person.rank} disabled>{person.rank}</option>}
            {ranks.map((r) => <option key={r}>{r}</option>)}
          </select>
        )}
      </td>
      <td>
        {person.role === 'admin' && STATUS_LABEL[person.status]}
        {person.role !== 'admin' && person.status === 'pending_payment' && (
          <>
            {STATUS_LABEL.pending_payment}
            <button type="button" className="link-button cell-action" onClick={() => change({}, `/admin/users/${person.id}/mark-paid`, 'POST')}>
              Mark as paid at dojo
            </button>
          </>
        )}
        {person.role !== 'admin' && person.status !== 'pending_payment' && (
          <select aria-label={`Status for ${person.name}`} value={person.status} onChange={(e) => change({ status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Switched off</option>
          </select>
        )}
      </td>
    </tr>
  );
}

function PeopleTab() {
  const [state, setState] = useState({ users: null, ranks: [], error: '' });
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { ok, data } = await api('/admin/users');
    setState(ok ? { users: data.users, ranks: data.ranks, error: '' } : { users: null, ranks: [], error: data.error });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.error) return <Notice>{state.error}</Notice>;
  if (!state.users) return <p>Loading accounts&hellip;</p>;

  const q = search.trim().toLowerCase();
  const shown = state.users.filter((u) => (role === 'all' || u.role === role)
    && (!q || `${u.name} ${u.email} ${u.dojo ?? ''}`.toLowerCase().includes(q)));
  const replace = (updated) => setState((s) => ({ ...s, users: s.users.map((u) => (u.id === updated.id ? updated : u)) }));

  return (
    <>
      <div className="admin-tools">
        <fieldset className="chips">
          <legend>Show</legend>
          {ROLE_FILTERS.map(([key, label]) => (
            <label key={key} className={role === key ? 'chip is-on' : 'chip'}>
              <input type="radio" name="role-filter" checked={role === key} onChange={() => setRole(key)} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="field field-inline">
          <label htmlFor="people-search">Search</label>
          <input id="people-search" type="search" placeholder="Name, email or dojo" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <p className="result-count" role="status">{shown.length === 1 ? '1 account' : `${shown.length} accounts`}</p>
      {shown.length === 0 ? <p className="empty">No accounts match. Clear the search to see everyone.</p> : (
        <div className="table-scroll" role="region" aria-label="Accounts" tabIndex={0}>
          <table className="timetable data-table">
            <thead>
              <tr>{['Name', 'Account', 'Dojo', 'Rank', 'Status'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((u) => <PersonRow key={u.id} person={u} ranks={state.ranks} onChanged={replace} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const EMPTY_INSTRUCTOR = { name: '', email: '', phone: '', password: '', dojo: '' };

function AddInstructorTab() {
  const dojos = useApi('/api/dojos');
  const [form, setForm] = useState(EMPTY_INSTRUCTOR);
  const [errors, setErrors] = useState({});
  const [created, setCreated] = useState(null);

  const update = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const { ok, data } = await api('/admin/instructors', { method: 'POST', body: form });
    if (ok) {
      setCreated({ ...data.user, password: form.password });
      setForm(EMPTY_INSTRUCTOR);
      setErrors({});
    } else if (data.errors) {
      setErrors(data.errors);
      focusFirstError(data.errors);
    } else {
      setErrors({ name: data.error });
    }
  }

  const names = (dojos.data ?? []).map((d) => d.name).sort((a, b) => a.localeCompare(b));

  return (
    <div className="account-grid">
      <form className="panel" onSubmit={submit} noValidate>
        <h2 className="panel-title">Add an instructor</h2>
        <Field name="name" label="Full name" error={errors.name}>
          <input {...fieldProps('name', errors)} type="text" maxLength={100} value={form.name} onChange={update} />
        </Field>
        <Field name="email" label="Email" error={errors.email}>
          <input {...fieldProps('email', errors)} type="email" maxLength={200} value={form.email} onChange={update} />
        </Field>
        <Field name="phone" label="Phone" optional error={errors.phone}>
          <input {...fieldProps('phone', errors)} type="tel" maxLength={20} value={form.phone} onChange={update} />
        </Field>
        <Field name="password" label="Temporary password" hint="At least 10 characters. They can change it after logging in." error={errors.password}>
          <div className="input-with-button">
            <input {...fieldProps('password', errors, { hint: true })} type="text" autoComplete="off" value={form.password} onChange={update} />
            <button type="button" className="button button-quiet button-small" onClick={() => { setForm((f) => ({ ...f, password: randomPassword() })); setErrors((x) => ({ ...x, password: undefined })); }}>
              Generate
            </button>
          </div>
        </Field>
        <Field name="dojo" label="Teaches at" hint="Instructors see the members and classes at this dojo." error={errors.dojo}>
          <select {...fieldProps('dojo', errors, { hint: true })} value={form.dojo} onChange={update}>
            <option value="">Choose a dojo</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <button type="submit" className="button button-small">Create instructor account</button>
      </form>

      {created && (
        <div className="panel panel-ok" role="status">
          <h2 className="panel-title">Instructor account created</h2>
          <p>Give {created.name} these details privately. They log in on the Log in page by choosing Instructor.</p>
          <dl className="facts">
            <div><dt>Email</dt><dd>{created.email}</dd></div>
            <div><dt>Temporary password</dt><dd><code>{created.password}</code></dd></div>
            <div><dt>Teaches at</dt><dd>{created.dojo}</dd></div>
          </dl>
          <p className="fine-print">This password is not shown again once you leave this page.</p>
        </div>
      )}
    </div>
  );
}

function EnquiriesTab() {
  const [state, setState] = useState({ rows: null, error: '' });
  useEffect(() => {
    api('/admin/enquiries').then(({ ok, data }) => setState(ok ? { rows: data.enquiries, error: '' } : { rows: null, error: data.error }));
  }, []);

  if (state.error) return <Notice>{state.error}</Notice>;
  if (!state.rows) return <p>Loading enquiries&hellip;</p>;
  if (state.rows.length === 0) return <p className="empty">No enquiries yet. New ones from the website&rsquo;s How to join form appear here.</p>;

  return (
    <div className="table-scroll" role="region" aria-label="Enquiries" tabIndex={0}>
      <table className="timetable data-table">
        <thead>
          <tr>{['Received (UTC)', 'Name', 'Email', 'Phone', 'For', 'Dojo', 'Question'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {state.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.created_at}</td>
              <th scope="row">{r.name}</th>
              <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
              <td>{r.phone}</td>
              <td>{r.interest}</td>
              <td>{r.dojo}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [['people', 'Members and instructors'], ['instructor', 'Add instructor'], ['enquiries', 'Enquiries']];

export default function AdminPage() {
  const { user, setUser, logout } = useAuth();
  const [tab, setTab] = useState('people');

  useEffect(() => {
    // Keep this unlinked page out of search results.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Admin | Aikido Shinju-Kai';
    return () => { meta.remove(); document.title = title; };
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="admin-bar">
        <Link to="/" className="admin-brand">
          <img src="/images/logo.png" alt="" width="44" height="44" />
          Shinju-Kai admin
        </Link>
        {isAdmin && (
          <nav className="admin-links" aria-label="Staff pages">
            <Link to="/attendance">Attendance</Link>
            <Link to="/eligibility">Grading eligibility</Link>
            <button type="button" className="button button-quiet button-small" onClick={logout}>Log out</button>
          </nav>
        )}
      </header>
      <main className="page">
        <div className={isAdmin ? 'wrap' : 'wrap page-narrow'}>
          {user === undefined && <p>Loading&hellip;</p>}
          {user !== undefined && !isAdmin && (
            <>
              <h1 className="page-title">Admin log in</h1>
              {user && <Notice>You are logged in as {user.role === 'instructor' ? 'an instructor' : 'a member'}. Log in with an admin account to continue.</Notice>}
              <LoginForm fixedRole="admin" onLoggedIn={setUser} />
            </>
          )}
          {isAdmin && (
            <>
              <h1 className="page-title">Admin</h1>
              <div className="tabs" role="group" aria-label="Admin sections">
                {TABS.map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'tab is-on' : 'tab'} onClick={() => setTab(key)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'people' && <PeopleTab />}
              {tab === 'instructor' && <AddInstructorTab />}
              {tab === 'enquiries' && <EnquiriesTab />}
            </>
          )}
        </div>
      </main>
    </>
  );
}
