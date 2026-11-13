import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../auth.jsx';
import { Field, Notice, fieldProps, focusFirstError } from '../forms.jsx';
import { PageShell } from '../Layout.jsx';
import { useApi } from '../useApi.jsx';

const EMPTY = { name: '', email: '', password: '', phone: '', dojo: '', terms: false };

export default function Signup() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const dojos = useApi('/api/dojos');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/' : '/account'} replace />;

  const dojoNames = (dojos.data ?? [])
    .filter((d) => d.status === 'open' && !d.membersOnly)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const update = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, data } = await api('/auth/signup', { method: 'POST', body: form });
    if (ok) {
      window.location.assign(data.checkoutUrl); // Stripe's payment page
      return;
    }
    setBusy(false);
    if (data.errors) {
      setErrors(data.errors);
      focusFirstError(data.errors);
    } else if (data.account) {
      await refresh();
      navigate('/account');
    } else {
      setError(data.error ?? 'Your account could not be created. Try again.');
    }
  }

  return (
    <PageShell title="Become a member" narrow>
      <p className="page-lead">
        Create your account, then pay the one-time $60 registration fee. It covers your current-year
        membership, membership book and student handbook. Training fees are paid separately at your dojo.
      </p>
      <form className="panel" onSubmit={submit} noValidate>
        <Field name="name" label="Full name" error={errors.name}>
          <input {...fieldProps('name', errors)} type="text" autoComplete="name" maxLength={100} value={form.name} onChange={update} />
        </Field>
        <Field name="email" label="Email" error={errors.email}>
          <input {...fieldProps('email', errors)} type="email" autoComplete="email" maxLength={200} value={form.email} onChange={update} />
        </Field>
        <Field name="password" label="Password" hint="At least 10 characters." error={errors.password}>
          <input {...fieldProps('password', errors, { hint: true })} type="password" autoComplete="new-password" value={form.password} onChange={update} />
        </Field>
        <Field name="phone" label="Phone" error={errors.phone}>
          <input {...fieldProps('phone', errors)} type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={update} />
        </Field>
        <Field name="dojo" label="Principal Dojo" hint="The dojo where you will train regularly." error={errors.dojo}>
          <select {...fieldProps('dojo', errors, { hint: true })} value={form.dojo} onChange={update}>
            <option value="">Choose a dojo</option>
            {dojoNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div className={errors.terms ? 'field-check has-error' : 'field-check'}>
          <label htmlFor="terms">
            <input {...fieldProps('terms', errors)} type="checkbox" checked={form.terms} onChange={update} />
            I understand membership is not transferable or refundable, and that I must sign the Deed of Waiver
            and Indemnity before my first class.
          </label>
          {errors.terms && <p className="field-error" id="terms-error">{errors.terms}</p>}
        </div>
        {error && <Notice>{error}</Notice>}
        <button type="submit" className="button" disabled={busy}>{busy ? 'Opening payment' : 'Continue to payment'}</button>
        <p className="fine-print">You will pay $60 on Stripe&rsquo;s secure page, then come back here.</p>
      </form>
      <p className="page-aside">Already a member? <Link to="/login">Log in</Link>.</p>
    </PageShell>
  );
}
