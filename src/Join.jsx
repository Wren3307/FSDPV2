import { useState } from 'react';
import { LoadFailed, useApi } from './useApi.jsx';

const STEPS = [
  { title: 'Try a class', text: 'Book a $29 trial session at Headquarters, or visit any dojo to watch a class and talk to the instructor.' },
  { title: 'Choose your Principal Dojo', text: 'This is the dojo where you will train regularly.' },
  { title: 'Sign up', text: 'Fill in the membership application form, bring 2 current photos, sign the Deed of Waiver and Indemnity, and pay the $60 registration fee.' },
  { title: 'Get your training attire', text: 'Contact us one week before your first class, and we will bring your jacket, pants and belt to the dojo.' },
];

const INTERESTS = [
  ['adult', 'Myself (13 or older)'],
  ['child', 'My child (4 to 12)'],
  ['family', 'My family'],
  ['private', 'A private class'],
  ['other', 'Something else'],
];

const EMPTY = { name: '', email: '', phone: '', interest: '', dojo: '', message: '', consent: false, website: '' };

function FeeTable({ title, rows }) {
  return (
    <table className="fees">
      <caption>{title}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <th scope="row">{r.name}{r.detail && <small>{r.detail}</small>}</th>
            <td>{r.price}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({ name, label, error, optional, children }) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={name}>{label}{optional && <span className="optional"> (optional)</span>}</label>
      {children}
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

function EnquiryForm({ dojoNames }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [sentTo, setSentTo] = useState('');
  const [formError, setFormError] = useState('');

  const update = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const a11y = (name) => ({
    id: name,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  async function submit(e) {
    e.preventDefault();
    setStatus('sending');
    setFormError('');
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setSentTo(form.email);
        setForm(EMPTY);
        setErrors({});
        setStatus('sent');
      } else if (body.errors) {
        setErrors(body.errors);
        setStatus('idle');
        const first = Object.keys(body.errors)[0];
        document.getElementById(first)?.focus();
      } else {
        setFormError(body.error ?? 'Your enquiry was not sent. Try again, or call (+65) 6513 1588.');
        setStatus('idle');
      }
    } catch {
      setFormError('Your enquiry was not sent because the connection failed. Try again, or call (+65) 6513 1588.');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <div className="form-sent" role="status">
        <h3>Enquiry sent</h3>
        <p>We&rsquo;ll reply to {sentTo}. For a faster answer, call <a href="tel:+6565131588">(+65) 6513 1588</a> during office hours.</p>
        <button type="button" className="link-button" onClick={() => setStatus('idle')}>Send another enquiry</button>
      </div>
    );
  }

  return (
    <form className="enquiry" onSubmit={submit} noValidate>
      <h3>Ask about classes</h3>
      <Field name="name" label="Your name" error={errors.name}>
        <input {...a11y('name')} type="text" autoComplete="name" maxLength={100} value={form.name} onChange={update} />
      </Field>
      <Field name="email" label="Email" error={errors.email}>
        <input {...a11y('email')} type="email" autoComplete="email" maxLength={200} value={form.email} onChange={update} />
      </Field>
      <Field name="phone" label="Phone" optional error={errors.phone}>
        <input {...a11y('phone')} type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={update} />
      </Field>
      <Field name="interest" label="Who are the classes for?" error={errors.interest}>
        <select {...a11y('interest')} value={form.interest} onChange={update}>
          <option value="">Choose one</option>
          {INTERESTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field name="dojo" label="Preferred dojo" optional error={errors.dojo}>
        <select {...a11y('dojo')} value={form.dojo} onChange={update}>
          <option value="">Not sure yet</option>
          {dojoNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <Field name="message" label="Your question" optional error={errors.message}>
        <textarea {...a11y('message')} rows={4} maxLength={2000} value={form.message} onChange={update} />
      </Field>

      {/* Hidden from people; bots tend to fill it in. */}
      <div className="trap" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={update} />
      </div>

      <div className={errors.consent ? 'field-check has-error' : 'field-check'}>
        <label htmlFor="consent">
          <input {...a11y('consent')} type="checkbox" checked={form.consent} onChange={update} />
          Aikido Shinju-Kai may use these details to reply to my enquiry.
        </label>
        {errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}
      </div>

      {formError && <p className="notice" role="alert">{formError}</p>}
      <button type="submit" className="button" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending enquiry' : 'Send enquiry'}
      </button>
    </form>
  );
}

export default function Join() {
  const fees = useApi('/api/fees');
  const dojos = useApi('/api/dojos');
  const dojoNames = (dojos.data ?? [])
    .filter((d) => d.status === 'open' && !d.membersOnly)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  return (
    <section className="join" id="join">
      <div className="wrap">
        <h2>How to join</h2>
        <div className="join-grid">
          <div>
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>
              ))}
            </ol>
          </div>
          <EnquiryForm dojoNames={dojoNames} />
        </div>

        <h2 className="fees-title">Fees</h2>
        {fees.failed && <LoadFailed what="The fee list" />}
        {fees.data && (
          <>
            <div className="fee-grid">
              <FeeTable title="Trial and single classes" rows={fees.data.tryIt} />
              <FeeTable title="Registration and membership" rows={fees.data.signUp} />
              <FeeTable title="Adults (13 and above)" rows={fees.data.adults} />
              <FeeTable title="Children (4 to 12)" rows={fees.data.children} />
            </div>
            <div className="fee-notes">
              <div>
                <h3>Discounts</h3>
                <ul>{fees.data.discounts.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
              <div>
                <h3>Good to know</h3>
                <ul>{fees.data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
