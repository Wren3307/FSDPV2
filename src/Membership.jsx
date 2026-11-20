// FP-2 membership on the member's account page. Sign-up is free; membership is bought here
// ($60 the first time, which includes registration, then $48 a year) and runs to 31 December.
//   MembershipBanner  above the tabs, only for people who aren't members right now
//   MembershipPanel   on the Profile tab: status, renew button and payment history
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, useAuth } from './auth.jsx';
import { Notice } from './forms.jsx';

export const formatDay = (isoDate) => (isoDate
  ? new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
  : '');
export const dollars = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** The member's own membership from GET /api/me/membership, and a reload function. */
export function useMembership(enabled, refreshKey) {
  const [membership, setMembership] = useState(null);
  const reload = useCallback(async () => {
    const { ok, data } = await api('/me/membership');
    if (ok) setMembership(data);
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled, refreshKey, reload]);
  return [membership, reload];
}

// Pay online, or check a payment that hasn't shown up yet.
function PayActions({ membership, reload }) {
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const [msg, setMsg] = useState(params.get('payment') === 'cancelled'
    ? { tone: 'error', text: 'Your payment was cancelled, so nothing was charged.' }
    : null);
  const [busy, setBusy] = useState('');
  const { next } = membership;

  async function pay() {
    setBusy('pay');
    const { ok, data } = await api('/payments/checkout', { method: 'POST', body: {} });
    if (ok) { window.location.assign(data.checkoutUrl); return; }
    setBusy('');
    setMsg({ tone: 'error', text: data.error });
  }

  async function check() {
    setBusy('check');
    const { ok, data } = await api('/payments/confirm', { method: 'POST', body: {} });
    setBusy('');
    if (ok) {
      setUser(data.user);
      setMsg({ tone: 'ok', text: `Payment received. You are a member until ${formatDay(data.user.member_until)}.` });
      reload();
    } else {
      setMsg({ tone: 'error', text: data.error });
    }
  }

  return (
    <div className="banner-actions">
      {membership.onlinePayment ? (
        <button type="button" className="button" onClick={pay} disabled={!!busy}>
          {busy === 'pay' ? 'Opening payment' : `Pay ${dollars(next.amountCents)} now`}
        </button>
      ) : (
        <p className="fine-print">Pay {dollars(next.amountCents)} at your dojo and they will record it here.</p>
      )}
      {membership.awaitingPayment && (
        <button type="button" className="link-button" onClick={check} disabled={!!busy}>
          {busy === 'check' ? 'Checking' : 'Already paid? Check again'}
        </button>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

const offerText = (next) => (next.kind === 'joining'
  ? `Membership is ${dollars(next.amountCents)} for your first year. It includes registration, your membership book and student handbook, and gives you member prices and offers.`
  : `Renew for ${dollars(next.amountCents)} to get member prices and offers again.`);

export function MembershipBanner({ membership, reload }) {
  if (!membership || membership.isMember || !membership.next) return null;
  const { next, lastMembershipEnded } = membership;
  return (
    <div className="payment-banner">
      <div>
        <h2 className="banner-title">{lastMembershipEnded ? 'Renew your membership' : 'Become a member'}</h2>
        <p>
          {lastMembershipEnded && `Your membership ended on ${formatDay(lastMembershipEnded)}. `}
          {offerText(next)} It runs until {formatDay(next.endsOn)}.
        </p>
      </div>
      <PayActions membership={membership} reload={reload} />
    </div>
  );
}

const KIND_LABEL = { joining: 'First membership', renewal: 'Renewal' };

export function MembershipPanel({ membership, reload }) {
  if (!membership) return <div className="panel"><p>Loading your membership&hellip;</p></div>;
  const { isMember, memberUntil, next, history } = membership;
  return (
    <div className="panel">
      <h2 className="panel-title">Membership</h2>
      <p>
        {isMember
          ? <>You are a member until <strong>{formatDay(memberUntil)}</strong>. Show this page at your dojo for member prices.</>
          : 'You are not a member right now. Your free account still lets you see class times and your grading progress.'}
      </p>
      {isMember && next?.canBuy && (
        <>
          <p>Renew now for {dollars(next.amountCents)} to stay a member until {formatDay(next.endsOn)}.</p>
          <PayActions membership={membership} reload={reload} />
        </>
      )}
      {history.length > 0 && (
        <ul className="membership-history">
          {history.map((m) => (
            <li key={`${m.startsOn}-${m.recordedAt}`}>
              {KIND_LABEL[m.kind]}: {formatDay(m.startsOn)} to {formatDay(m.endsOn)} · {dollars(m.amountCents)}{' '}
              {m.paidVia === 'dojo' ? 'paid at the dojo' : 'paid online'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
