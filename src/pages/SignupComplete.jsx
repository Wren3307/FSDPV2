import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useAuth } from '../auth.jsx';
import { Notice } from '../forms.jsx';
import { PageShell } from '../Layout.jsx';
import { formatDay } from '../Membership.jsx';

/** Stripe sends members here after paying. The server checks the payment with Stripe before activating. */
export default function SignupComplete() {
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [state, setState] = useState({ status: 'checking', error: '' });
  const started = useRef(false);

  async function confirm() {
    setState({ status: 'checking', error: '' });
    const { ok, status, data } = await api('/payments/confirm', { method: 'POST', body: { sessionId: params.get('session_id') ?? '' } });
    if (ok) {
      setUser(data.user);
      setState({ status: 'done', error: '', until: data.user.member_until });
    } else if (status === 401) {
      setState({ status: 'logged-out', error: '' });
    } else {
      setState({ status: 'failed', error: data.error });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    confirm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PageShell title={state.status === 'done' ? 'Welcome to Shinju-Kai' : 'Finishing your membership'} narrow>
      <div className="panel" aria-live="polite">
        {state.status === 'checking' && <p>Checking your payment with Stripe&hellip;</p>}
        {state.status === 'done' && (
          <>
            <p>
              Your payment is received and you are a member
              {state.until ? ` until ${formatDay(state.until)}` : ''}. Show your account page at the dojo for member prices.
            </p>
            <p>Bring 2 current photos to your first class, and sign the Deed of Waiver and Indemnity with your instructor.</p>
            <Link className="button" to="/account">Go to my account</Link>
          </>
        )}
        {state.status === 'logged-out' && (
          <p>Log in to finish your membership. <Link to="/login">Log in</Link></p>
        )}
        {state.status === 'failed' && (
          <>
            <Notice>{state.error}</Notice>
            <button type="button" className="button" onClick={confirm}>Check payment again</button>
          </>
        )}
      </div>
    </PageShell>
  );
}
