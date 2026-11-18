import { useEffect, useState } from 'react';
import dojos from '../data/dojos.json';

export default function StudentSelfServicePortal({ user, onProfileUpdated }) {
  const [eligibility, setEligibility] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [centreId, setCentreId] = useState(user?.centre_id || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/students/${user.id}/eligibility`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setEligibility(json))
      .catch(() => {});
  }, [user?.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone, centre_id: centreId }),
      });

      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Update failed');

      setMessage('Profile updated successfully.');
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const attended = eligibility?.sessionsAttended ?? 13;
  const required = eligibility?.sessionsRequired ?? 14;
  const pct = Math.min(100, Math.round((attended / required) * 100));

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
              {user?.belt_rank || 'White Belt (6th Kyu)'}
            </h3>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>MEMBERSHIP STATUS</span>
            <div style={{ marginTop: '0.25rem' }}>
              <span
                style={{
                  backgroundColor: user?.fee_paid ? '#1D4ED8' : '#C8102E',
                  color: '#FFFFFF',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {user?.fee_paid ? 'Active Member' : 'Pending $60 Registration Fee'}
              </span>
            </div>
          </div>
        </div>

        {/* Royal Blue Grading Progress Bar */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            <strong>Next Grading Attendance Requirement</strong>
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
            <select value={centreId} onChange={(e) => setCentreId(e.target.value)} style={inputStyle}>
              <option value="">-- Select Principal Dojo --</option>
              {Array.isArray(dojos) &&
                dojos.map((d) => (
                  <option key={d.id || d.name} value={d.id || d.name}>
                    {d.name}
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

          {message && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#1D4ED8', fontWeight: 600 }}>
              {message}
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