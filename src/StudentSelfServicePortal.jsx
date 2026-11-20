import { useEffect, useState } from 'react';
import { api } from './auth.jsx';
import { formatDay } from './Membership.jsx';

// dojoNames: the dojos a member may choose (open and not members-only), the same list the
// Profile tab uses. The API identifies the Principal Dojo by name, not by centre id.
export default function StudentSelfServicePortal({ user, dojoNames = [], onProfileUpdated }) {
  const [eligibility, setEligibility] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dojo, setDojo] = useState(user?.dojo || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });

  useEffect(() => {
    if (!user?.id) return;
    api(`/students/${user.id}/eligibility`).then(({ ok, data }) => setEligibility(ok ? data : null));
  }, [user?.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ tone: '', text: '' });

    const { ok, data } = await api('/me', { method: 'PATCH', body: { name, phone, dojo } });
    setSaving(false);
    if (ok) {
      setMessage({ tone: 'ok', text: 'Profile updated successfully.' });
      if (onProfileUpdated) onProfileUpdated(data.user);
      return;
    }
    // Validation errors come back as { errors: { field: message } }; other failures as { error }.
    const text = data.errors ? Object.values(data.errors).join(' ') : (data.error || 'Update failed');
    setMessage({ tone: 'error', text });
  };

  // Sessions since the last grading, from the eligibility engine's checks. Null when there is
  // no rule to measure against (no rank yet, or the highest rank).
  const sessions = eligibility?.checks?.find((c) => c.rule.startsWith('Sessions')) ?? null;
  const attended = sessions?.actual ?? 0;
  const required = sessions?.required ?? 0;
  const pct = required ? Math.min(100, Math.round((attended / required) * 100)) : 0;
  const isMember = Boolean(user?.is_member);

  return (
    <section style={{ marginTop: '1.5rem' }}>
      {/* Portal Header */}
      <div
        style={{
          backgroundColor: '#1A1A1A',
          color: '#FFFFFF',
          padding: '1.25rem 1.5rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Student Self-Service Portal (FP-16)</h2>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', opacity: 0.85 }}>
          Manage your membership details, Principal Dojo, and belt progression
        </p>
      </div>

      {/* Membership & Progress Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderLeft: '5px solid #1D4ED8',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>CURRENT RANK</span>
            <h3 style={{ margin: '0.2rem 0', color: '#1A1A1A' }}>
              {user?.rank || 'Ungraded'}
            </h3>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>MEMBERSHIP STATUS</span>
            <div style={{ marginTop: '0.25rem' }}>
              <span
                style={{
                  backgroundColor: isMember ? '#1D4ED8' : '#6B7280',
                  color: '#FFFFFF',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {isMember ? `Member until ${formatDay(user.member_until)}` : 'Free account (not a member)'}
              </span>
            </div>
          </div>
        </div>

        {/* Royal Blue Grading Progress Bar */}
        {!eligibility ? (
          <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#6B7280' }}>Loading your grading progress&hellip;</p>
        ) : !sessions ? (
          <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#6B7280' }}>
            {eligibility.reason ?? 'There is no grading progress to show yet.'}
          </p>
        ) : (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            <strong>Sessions towards {eligibility.nextRank}</strong>
            <span>
              {attended} / {required} sessions ({pct}%)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '12px',
              backgroundColor: '#E5E7EB',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: '#1D4ED8',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
        )}
      </div>

      {/* Edit Profile Form (PATCH /api/me) */}
      <form
        onSubmit={handleSave}
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '1.25rem',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#1A1A1A' }}>Update Personal & Dojo Details</h3>

        <div style={{ display: 'grid', gap: '1rem', maxWidth: '480px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            Full Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            Phone Number
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            Principal Dojo
            <select value={dojo} onChange={(e) => setDojo(e.target.value)} style={inputStyle}>
              {!dojoNames.includes(dojo) && <option value={dojo}>{dojo || '-- Select Principal Dojo --'}</option>}
              {dojoNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              backgroundColor: '#C8102E',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {message.text && (
            <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: message.tone === 'error' ? '#C8102E' : '#1D4ED8', fontWeight: 600 }}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

const inputStyle = {
  padding: '0.55rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '0.9rem',
};