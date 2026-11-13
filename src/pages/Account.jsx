import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ROLE_LABEL, STATUS_LABEL, api, useAuth } from '../auth.jsx';
import { HqTimetable } from '../Classes.jsx';
import { Field, Notice, fieldProps, focusFirstError } from '../forms.jsx';
import { PageShell } from '../Layout.jsx';
import { useApi } from '../useApi.jsx';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABEL = { adult: 'Adults', children: 'Children', mixed: 'Mixed' };

const formatDate = (sqlDate) => (sqlDate
  ? new Date(`${sqlDate.replace(' ', 'T')}Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
  : '');

function PaymentBanner() {
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const [msg, setMsg] = useState(params.get('payment') === 'cancelled'
    ? { tone: 'error', text: 'Your payment was cancelled, so your membership is not active yet.' }
    : null);
  const [busy, setBusy] = useState('');

  async function pay() {
    setBusy('pay');
    const { ok, data } = await api('/payments/checkout', { method: 'POST', body: {} });
    if (ok) window.location.assign(data.checkoutUrl);
    else { setBusy(''); setMsg({ tone: 'error', text: data.error }); }
  }

  async function check() {
    setBusy('check');
    const { ok, data } = await api('/payments/confirm', { method: 'POST', body: {} });
    setBusy('');
    if (ok) setUser(data.user);
    else setMsg({ tone: 'error', text: data.error });
  }

  return (
    <div className="payment-banner">
      <div>
        <h2 className="banner-title">Pay your $60 registration to activate your membership</h2>
        <p>Your class times unlock once Stripe confirms your payment.</p>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
      <div className="banner-actions">
        <button type="button" className="button" onClick={pay} disabled={!!busy}>{busy === 'pay' ? 'Opening payment' : 'Pay $60 now'}</button>
        <button type="button" className="link-button" onClick={check} disabled={!!busy}>
          {busy === 'check' ? 'Checking' : 'Already paid? Check again'}
        </button>
      </div>
    </div>
  );
}

function ProfileForm({ user, dojoNames }) {
  const { setUser } = useAuth();
  const isMember = user.role === 'student';
  const [form, setForm] = useState({ name: user.name, phone: user.phone, dojo: user.dojo });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState('');

  const update = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
    setSaved('');
  };

  async function submit(e) {
    e.preventDefault();
    const { ok, data } = await api('/me', { method: 'PATCH', body: form });
    if (ok) { setUser(data.user); setSaved('Profile saved.'); }
    else if (data.errors) { setErrors(data.errors); focusFirstError(data.errors); }
    else setSaved(data.error);
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2 className="panel-title">Your details</h2>
      <Field name="name" label="Full name" error={errors.name}>
        <input {...fieldProps('name', errors)} type="text" autoComplete="name" maxLength={100} value={form.name} onChange={update} />
      </Field>
      <Field name="phone" label="Phone" optional={!isMember} error={errors.phone}>
        <input {...fieldProps('phone', errors)} type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={update} />
      </Field>
      {isMember && (
        <Field name="dojo" label="Principal Dojo" error={errors.dojo}>
          <select {...fieldProps('dojo', errors)} value={form.dojo} onChange={update}>
            {!dojoNames.includes(form.dojo) && <option value={form.dojo}>{form.dojo || 'Choose a dojo'}</option>}
            {dojoNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      )}
      {saved && <Notice tone={saved === 'Profile saved.' ? 'ok' : 'error'}>{saved}</Notice>}
      <button type="submit" className="button button-small">Save details</button>
    </form>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setDone(false);
    const { ok, data } = await api('/me/password', { method: 'POST', body: form });
    if (ok) { setForm({ currentPassword: '', newPassword: '' }); setErrors({}); setDone(true); }
    else { setErrors(data.errors ?? { currentPassword: data.error }); focusFirstError(data.errors); }
  }

  const update = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2 className="panel-title">Change password</h2>
      <Field name="currentPassword" label="Current password" error={errors.currentPassword}>
        <input {...fieldProps('currentPassword', errors)} type="password" autoComplete="current-password" value={form.currentPassword} onChange={update} />
      </Field>
      <Field name="newPassword" label="New password" hint="At least 10 characters." error={errors.newPassword}>
        <input {...fieldProps('newPassword', errors, { hint: true })} type="password" autoComplete="new-password" value={form.newPassword} onChange={update} />
      </Field>
      {done && <Notice tone="ok">Password changed. Other devices have been logged out.</Notice>}
      <button type="submit" className="button button-small">Change password</button>
    </form>
  );
}

function ProfileTab({ user, dojoNames }) {
  return (
    <div className="account-grid">
      <dl className="facts panel">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Account</dt><dd>{ROLE_LABEL[user.role]}</dd></div>
        <div><dt>Rank</dt><dd>{user.rank}</dd></div>
        {user.role === 'student' && <div><dt>Membership</dt><dd>{STATUS_LABEL[user.status]}</dd></div>}
        {user.role === 'student' && <div><dt>Principal Dojo</dt><dd>{user.dojo}</dd></div>}
        {user.role === 'instructor' && <div><dt>Teaches at</dt><dd>{user.dojo ?? 'Not set'}</dd></div>}
        <div><dt>{user.paid_at ? 'Member since' : 'Account created'}</dt><dd>{formatDate(user.paid_at ?? user.created_at)}</dd></div>
      </dl>
      <div className="stack">
        <ProfileForm user={user} dojoNames={dojoNames} />
        <PasswordForm />
      </div>
    </div>
  );
}

function MyClassesTab({ user, dojos }) {
  const timetable = useApi('/api/timetable');
  const dojo = dojos.find((d) => d.name === user.dojo);

  if (user.status !== 'active') return <p className="empty">Your class times appear here once your registration fee is paid.</p>;
  if (!dojo) return <p className="empty">Choose your Principal Dojo on the Profile tab to see its classes.</p>;
  if (dojo.isHq) return timetable.data ? <HqTimetable data={timetable.data} /> : null;

  const slots = [...dojo.slots].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  return (
    <div className="panel">
      <h2 className="panel-title">{dojo.name}</h2>
      <p>{dojo.mapUrl ? <a href={dojo.mapUrl} target="_blank" rel="noopener">{dojo.address}</a> : dojo.address}</p>
      {dojo.status !== 'open' && <Notice>This dojo is {dojo.status === 'closed' ? 'temporarily closed' : 'under renovation'}. Ask Headquarters where to train for now.</Notice>}
      {slots.length > 0 ? (
        <ul className="slots slots-large">
          {slots.map((s) => (
            <li key={`${s.day}${s.time}${s.type}`}>
              <span className="slot-day">{s.day}</span>
              <span className="slot-time">{s.time}</span>
              <span className={`slot-type slot-${s.type}`}>{SLOT_LABEL[s.type]}</span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No classes are listed for this dojo right now.</p>}
    </div>
  );
}

function MyStudentsTab() {
  const [state, setState] = useState({ data: null, error: '' });

  useEffect(() => {
    api('/instructor/members').then(({ ok, data }) => setState(ok ? { data, error: '' } : { data: null, error: data.error }));
  }, []);

  if (state.error) return <Notice>{state.error}</Notice>;
  if (!state.data) return <p>Loading your students&hellip;</p>;

  const { dojo, members: shown } = state.data;
  if (!dojo) return <p className="empty">You don&rsquo;t have a dojo yet. Ask the admin to set the dojo you teach at.</p>;

  return (
    <>
      <p className="staff-links">
        <Link className="button button-small" to="/attendance">Mark attendance</Link>
        <Link className="button button-quiet button-small" to="/eligibility">Grading eligibility</Link>
      </p>
      <p className="result-count" role="status">
        {shown.length === 1 ? '1 active member' : `${shown.length} active members`} at {dojo}
      </p>
      {shown.length === 0 ? (
        <p className="empty">No active members have chosen this dojo as their Principal Dojo yet.</p>
      ) : (
        <div className="table-scroll" role="region" aria-label="Your students" tabIndex={0}>
          <table className="timetable data-table">
            <thead>
              <tr>{['Name', 'Rank', 'Dojo', 'Phone', 'Email', 'Member since'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.name}</th>
                  <td>{m.rank}</td>
                  <td>{m.dojo}</td>
                  <td>{m.phone && <a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>}</td>
                  <td><a href={`mailto:${m.email}`}>{m.email}</a></td>
                  <td>{formatDate(m.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dojos = useApi('/api/dojos');
  const [tab, setTab] = useState('profile');

  if (user === undefined) return <PageShell narrow><p>Loading your account&hellip;</p></PageShell>;
  if (!user || user.role === 'admin') return <Navigate to="/login" replace />;

  const roleTab = user.role === 'student' ? ['classes', 'My classes'] : ['students', 'My students'];
  const tabs = [['profile', 'Profile'], roleTab];
  const allDojos = dojos.data ?? [];
  const dojoNames = allDojos.filter((d) => d.status === 'open' && !d.membersOnly).map((d) => d.name).sort((a, b) => a.localeCompare(b));

  return (
    <PageShell>
      <div className="account-head">
        <div>
          <h1 className="page-title">Hello, {user.name.split(' ')[0]}</h1>
          <p className="page-lead">
            {ROLE_LABEL[user.role]} account{user.role === 'student' && user.dojo ? `, training at ${user.dojo}` : ''}
          </p>
        </div>
        <button type="button" className="button button-quiet button-small" onClick={async () => { await logout(); navigate('/'); }}>
          Log out
        </button>
      </div>

      {user.status === 'pending_payment' && <PaymentBanner />}

      <div className="tabs" role="group" aria-label="Account sections">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'tab is-on' : 'tab'} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} dojoNames={dojoNames} />}
      {tab === 'classes' && <MyClassesTab user={user} dojos={allDojos} />}
      {tab === 'students' && <MyStudentsTab />}
    </PageShell>
  );
}
