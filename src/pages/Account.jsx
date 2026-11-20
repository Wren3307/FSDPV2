import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, api, useAuth } from '../auth.jsx';
import { MembershipBanner, MembershipPanel, formatDay, useMembership } from '../Membership.jsx';
import { HqTimetable } from '../Classes.jsx';
import { Field, Notice, fieldProps, focusFirstError } from '../forms.jsx';
import { GradingBanner, GradingTab } from '../GradingProgress.jsx';
import { PageShell } from '../Layout.jsx';
import { useApi } from '../useApi.jsx';
import InstructorDashboard from '../InstructorDashboard';
import StudentSelfServicePortal from '../StudentSelfServicePortal';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABEL = { adult: 'Adults', children: 'Children', mixed: 'Mixed' };

const formatDate = (sqlDate) => (sqlDate
  ? new Date(`${sqlDate.replace(' ', 'T')}Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
  : '');

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

function ProfileTab({ user, dojoNames, membership, reloadMembership }) {
  return (
    <div className="account-grid">
      <dl className="facts panel">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Account</dt><dd>{ROLE_LABEL[user.role]}</dd></div>
        <div><dt>Rank</dt><dd>{user.rank}</dd></div>
        {user.role === 'student' && (
          <div><dt>Membership</dt><dd>{user.is_member ? `Member until ${formatDay(user.member_until)}` : 'Not a member'}</dd></div>
        )}
        {user.role === 'student' && <div><dt>Principal Dojo</dt><dd>{user.dojo}</dd></div>}
        {user.role === 'instructor' && <div><dt>Teaches at</dt><dd>{user.dojo ?? 'Not set'}</dd></div>}
        <div><dt>Account created</dt><dd>{formatDate(user.created_at)}</dd></div>
      </dl>
      <div className="stack">
        {user.role === 'student' && <MembershipPanel membership={membership} reload={reloadMembership} />}
        <ProfileForm user={user} dojoNames={dojoNames} />
        <PasswordForm />
      </div>
    </div>
  );
}

function MyClassesTab({ user, dojos }) {
  const timetable = useApi('/api/timetable');
  const dojo = dojos.find((d) => d.name === user.dojo);

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
        {shown.length === 1 ? '1 student' : `${shown.length} students`} at {dojo}
        {' · '}{shown.filter((m) => m.is_member).length} paid members
      </p>
      {shown.length === 0 ? (
        <p className="empty">No students have chosen this dojo as their Principal Dojo yet.</p>
      ) : (
        <div className="table-scroll" role="region" aria-label="Your students" tabIndex={0}>
          <table className="timetable data-table">
            <thead>
              <tr>{['Name', 'Rank', 'Dojo', 'Phone', 'Email', 'Membership'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.name}</th>
                  <td>{m.rank}</td>
                  <td>{m.dojo}</td>
                  <td>{m.phone && <a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>}</td>
                  <td><a href={`mailto:${m.email}`}>{m.email}</a></td>
                  <td>{m.is_member ? `Member until ${formatDay(m.member_until)}` : 'Not a member'}</td>
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
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const dojos = useApi('/api/dojos');
  const [tab, setTab] = useState('profile');
  // FP-2: members' paid membership. Reloads whenever the account's membership end date changes.
  const [membership, reloadMembership] = useMembership(user?.role === 'student', user?.member_until);
  // Set by the sign-up page when membership was ticked but online payment couldn't start.
  const signupNotice = useLocation().state?.notice;

  if (user === undefined) return <PageShell narrow><p>Loading your account&hellip;</p></PageShell>;
  if (!user || user.role === 'admin') return <Navigate to="/login" replace />;

  const roleTab = user.role === 'student' ? ['classes', 'My classes'] : ['students', 'My students'];
  const tabs = [['profile', 'Profile'], roleTab];

  // FP-11 & FP-16: members get Grading progress and Student Self-Service Portal tabs
  if (user.role === 'student') {
    tabs.push(['grading', 'Grading']);
    tabs.push(['portal', 'Student Portal']);
  }

  // FP-15: instructors get Progression & Attendance Dashboard tab
  if (user.role === 'instructor') {
    tabs.push(['dashboard', 'Progression Dashboard']);
  }

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

      {signupNotice && <Notice tone="ok">{signupNotice}</Notice>}
      {user.role === 'student' && <MembershipBanner membership={membership} reload={reloadMembership} />}
      {user.role === 'student' && <GradingBanner onShowProgress={() => setTab('grading')} />}

      <div className="tabs" role="group" aria-label="Account sections">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'tab is-on' : 'tab'} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} dojoNames={dojoNames} membership={membership} reloadMembership={reloadMembership} />}
      {tab === 'classes' && <MyClassesTab user={user} dojos={allDojos} />}
      {tab === 'students' && <MyStudentsTab />}
      {tab === 'grading' && <GradingTab user={user} />}
      {tab === 'dashboard' && <InstructorDashboard />}
      {tab === 'portal' && <StudentSelfServicePortal user={user} dojoNames={dojoNames} onProfileUpdated={(updated) => setUser(updated)} />}
    </PageShell>
  );
}