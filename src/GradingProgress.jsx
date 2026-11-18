// FP-11: a member's own grading progress, shown on their account page (src/pages/Account.jsx).
//   GradingBanner  the "You are now eligible..." notification, above the tabs until it is dismissed
//   GradingTab     the same checks staff see on the eligibility screen (FP-10), for this member only
// Both ask the server again every few seconds. A member who has the page open therefore sees the
// change soon after an instructor saves the attendance that makes them eligible, without reloading.
import { useEffect, useState } from 'react';
import { api } from './auth.jsx';
import { CheckRow } from './Eligibility.jsx';

const REFRESH_MS = 5000;

// Loads `path` from the API now, then again every few seconds.
// Returns [data, reload]: data is null until the first answer arrives, and reload() asks again at once.
function useLive(path) {
  const [data, setData] = useState(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let onPage = true; // stops a late answer from updating a component that has left the page
    async function load() {
      const { ok, data: body } = await api(path);
      if (ok && onPage) setData(body);
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      onPage = false;
      clearInterval(timer);
    };
  }, [path, reloads]);

  return [data, () => setReloads((n) => n + 1)];
}

// The database stores times in UTC, like "2026-11-15 13:42:10". Show them in the reader's own time.
function formatWhen(sqlTime) {
  return new Date(`${sqlTime.replace(' ', 'T')}Z`).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Unread notifications, shown above the tabs. Dismissing marks them as read on the server,
// so they stay gone on the member's other devices too.
export function GradingBanner({ onShowProgress }) {
  const [notifications, reload] = useLive('/me/notifications');
  const unread = (notifications ?? []).filter((notification) => !notification.readAt);
  if (unread.length === 0) return null;

  async function dismiss() {
    await api('/me/notifications/read', { method: 'POST', body: {} });
    reload();
  }

  return (
    <div className="notification-banner" role="status">
      <div>
        {unread.map((notification) => (
          <div key={notification.id}>
            <h2 className="banner-title">{notification.message}</h2>
            <p className="fine-print">Sent {formatWhen(notification.createdAt)}</p>
          </div>
        ))}
      </div>
      <div className="banner-actions">
        <button type="button" className="button button-quiet button-small" onClick={onShowProgress}>
          See my progress
        </button>
        <button type="button" className="link-button" onClick={dismiss}>Dismiss</button>
      </div>
    </div>
  );
}

// One sentence saying where the member stands, in words rather than numbers.
function summaryOf(result) {
  if (result.eligible) {
    return `You meet every requirement for your ${result.nextRank} grading. Speak to your instructor about the next grading date.`;
  }
  // No checks means the engine had no rule to check, and result.reason says why.
  if (result.checks.length === 0) {
    return result.currentRank
      ? result.reason
      : 'You don’t have a rank yet. Your instructor records it after your first grading.';
  }
  return `You don’t meet every requirement for your ${result.nextRank} grading yet. The bars below show how far along you are.`;
}

export function GradingTab({ user }) {
  const [result] = useLive(`/students/${user.id}/eligibility`);

  if (!result) return <p className="empty">Loading your grading progress&hellip;</p>;

  return (
    <div className="panel">
      <div className="grading-head">
        <h2 className="panel-title">
          {result.currentRank ?? 'Ungraded'}{result.nextRank && ` → ${result.nextRank}`}
        </h2>
        <span className={result.eligible ? 'elg-badge ready' : 'elg-badge'}>
          {result.eligible ? 'Eligible' : 'Not yet'}
        </span>
      </div>

      <p>{summaryOf(result)}</p>

      {result.checks.length > 0 && (
        <ul className="elg-checks">
          {result.checks.map((check) => <CheckRow key={check.rule} check={check} />)}
        </ul>
      )}

      <p className="fine-print">
        A session counts when your instructor marks you present or late, starting from the day you
        received your current rank. This page updates by itself.
      </p>
    </div>
  );
}
