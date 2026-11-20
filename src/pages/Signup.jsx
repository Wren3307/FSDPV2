import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../auth.jsx';
import { Field, Notice, fieldProps, focusFirstError } from '../forms.jsx';
import { PageShell } from '../Layout.jsx';
import { useApi } from '../useApi.jsx';

const EMPTY = { name: '', email: '', password: '', phone: '', dojo: '', terms: false, membership: false };

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
    if (ok && data.checkoutUrl) {
      window.location.assign(data.checkoutUrl); // Stripe's payment page for membership
      return;
    }
    if (ok) {
      // A free account. If membership was ticked but payment couldn't start, the account page explains.
      await refresh();
      navigate('/account', { state: { notice: data.notice } });
      return;
    }
    setBusy(false);
    if (data.errors) {
      setErrors(data.errors);
      focusFirstError(data.errors);
    } else {
      setError(data.error ?? 'Your account could not be created. Try again.');
    }
  }

  return (
    <PageShell title="Create your free account" narrow>
      <p className="page-lead">
        Signing up is free. Your account shows your dojo&rsquo;s class times and your grading progress.
        You can become a member now or later: membership is $60 for your first year (it includes
        registration, your membership book and student handbook), then $48 a year, and gives you member
        prices and offers. Training fees are paid separately at your dojo.
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
            I understand I must sign the Deed of Waiver and Indemnity before my first class, and that
            membership, if I buy it, is not transferable or refundable.
          </label>
          {errors.terms && <p className="field-error" id="terms-error">{errors.terms}</p>}
        </div>
        <div className="field-check">
          <label htmlFor="membership">
            <input id="membership" name="membership" type="checkbox" checked={form.membership} onChange={update} />
            Also become a member now: $60, valid until 31 December this year.
          </label>
        </div>
        {error && <Notice>{error}</Notice>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? (form.membership ? 'Opening payment' : 'Creating account') : (form.membership ? 'Create account and pay $60' : 'Create free account')}
        </button>
        {form.membership && <p className="fine-print">You will pay $60 on Stripe&rsquo;s secure page, then come back here.</p>}
      </form>
      <p className="page-aside">Already a member? <Link to="/login">Log in</Link>.</p>
    </PageShell>
  );
}
