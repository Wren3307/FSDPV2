import { useEffect, useState } from 'react';
import { api, useAuth } from './auth.jsx';

// The eligibility engine (server/eligibility.js) returns
//   { studentId, currentRank, nextRank, eligible, reason, checks: [{ rule, required, actual, met }] }
// The sessions check is the one whose rule starts with "Sessions".
const sessionsCheck = (result) => result?.checks?.find((c) => c.rule.startsWith('Sessions')) ?? null;

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', dojo: '', students: [] });
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'READY' | 'DECLINING'

  useEffect(() => {
    async function loadDashboard() {
      // 1. Active members at this instructor's dojo (FP-15 endpoint)
      const membersRes = await api('/instructor/members');
      if (!membersRes.ok) {
        setState({
          loading: false,
          error: membersRes.data?.error || 'Unable to load dashboard metrics',
          dojo: '',
          students: [],
        });
        return;
      }

      // 2. Grading eligibility (FP-10), for this instructor's centre only
      const eligPath = user?.centre_id ? `/eligibility?centreId=${user.centre_id}` : '/eligibility';
      const eligRes = await api(eligPath);
      if (!eligRes.ok) {
        setState({ loading: false, error: eligRes.data?.error || 'Unable to load grading progress', dojo: '', students: [] });
        return;
      }
      const eligById = new Map((eligRes.data ?? []).map((item) => [item.studentId, item]));

      // 3. Attendance rate over the last eight weeks (retention alert)
      const ratesRes = await api('/instructor/attendance-rates');
      if (!ratesRes.ok) {
        setState({ loading: false, error: ratesRes.data?.error || 'Unable to load attendance rates', dojo: '', students: [] });
        return;
      }
      const rateById = new Map((ratesRes.data?.students ?? []).map((r) => [r.studentId, r]));

      const rawMembers = membersRes.data?.members || [];
      const enriched = rawMembers.map((m) => {
        const elig = eligById.get(m.id);
        const check = sessionsCheck(elig);
        const attended = check?.actual ?? 0;
        const required = check?.required ?? null;
        // Progress towards the next grading's session requirement.
        const progressPct = required ? Math.min(100, Math.round((attended / required) * 100)) : 0;
        const rate = rateById.get(m.id);

        return {
          ...m,
          sessionsAttended: attended,
          sessionsRequired: required,
          progressPct,
          // null when no sessions were expected of them in the window
          attendancePct: rate?.rate == null ? null : Math.round(rate.rate * 100),
          attendanceDetail: rate?.expected ? `${rate.attended} of ${rate.expected} sessions` : 'No sessions yet',
          isGradingReady: Boolean(elig?.eligible),
          isDeclining: Boolean(rate?.declining),
          note: required ? '' : (elig?.reason ?? 'No grading progress yet'),
        };
      });

      setState({
        loading: false,
        error: '',
        dojo: membersRes.data?.dojo || '',
        weeks: Math.round((ratesRes.data?.windowDays ?? 56) / 7),
        students: enriched,
      });
    }

    loadDashboard();
  }, [user?.centre_id]);

  if (state.loading) return <p style={{ padding: '1rem' }}>Loading progression dashboard&hellip;</p>;
  if (state.error) return <p style={{ padding: '1rem', color: '#C8102E' }}>{state.error}</p>;

  const { dojo, students, weeks } = state;
  const totalStudents = students.length;
  const gradingReadyCount = students.filter((s) => s.isGradingReady).length;
  const decliningCount = students.filter((s) => s.isDeclining).length;
  const withRate = students.filter((s) => s.attendancePct !== null);
  const avgAttendancePct = withRate.length
    ? Math.round(withRate.reduce((sum, s) => sum + s.attendancePct, 0) / withRate.length)
    : null;

  const filteredStudents = students.filter((s) => {
    if (filter === 'READY') return s.isGradingReady;
    if (filter === 'DECLINING') return s.isDeclining;
    return true;
  });

  return (
    <section style={{ marginTop: '1.5rem' }}>
      {/* Header Banner (Black #1A1A1A + White) */}
      <div
        style={{
          backgroundColor: '#1A1A1A',
          color: '#FFFFFF',
          padding: '1.25rem 1.5rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          Instructor Progression &amp; Attendance Dashboard {dojo ? `— ${dojo}` : ''}
        </h2>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', opacity: 0.85 }}>
          Retention alerts (under 50% attendance over the last {weeks} weeks) and grading readiness
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={cardStyle('#1A1A1A')}>
          <span style={labelStyle}>Active Students</span>
          <strong style={{ fontSize: '1.75rem', color: '#1A1A1A' }}>{totalStudents}</strong>
        </div>

        <div style={cardStyle('#1D4ED8')}>
          <span style={labelStyle}>Grading Ready</span>
          <strong style={{ fontSize: '1.75rem', color: '#1D4ED8' }}>{gradingReadyCount}</strong>
        </div>

        <div style={cardStyle('#C8102E')}>
          <span style={labelStyle}>Declining (&lt;50%, {weeks} wks)</span>
          <strong style={{ fontSize: '1.75rem', color: '#C8102E' }}>{decliningCount}</strong>
        </div>

        <div style={cardStyle('#1A1A1A')}>
          <span style={labelStyle}>Avg attendance ({weeks} wks)</span>
          <strong style={{ fontSize: '1.75rem', color: '#1A1A1A' }}>{avgAttendancePct === null ? '—' : `${avgAttendancePct}%`}</strong>
        </div>
      </div>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('ALL')} style={filterBtnStyle(filter === 'ALL', '#1A1A1A')}>
          All Students ({totalStudents})
        </button>
        <button onClick={() => setFilter('READY')} style={filterBtnStyle(filter === 'READY', '#1D4ED8')}>
          Grading Ready ({gradingReadyCount})
        </button>
        <button
          onClick={() => setFilter('DECLINING')}
          style={filterBtnStyle(filter === 'DECLINING', '#C8102E')}
        >
          Declining Attendance ({decliningCount})
        </button>
      </div>

      {/* Progression Table */}
      {filteredStudents.length === 0 ? (
        <p className="empty">No students match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF' }}>
            <thead>
              <tr style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF', textAlign: 'left' }}>
                <th style={thStyle}>Student Name</th>
                <th style={thStyle}>Current Rank</th>
                <th style={thStyle}>Attendance ({weeks} wks)</th>
                <th style={thStyle}>Progress to next grading</th>
                <th style={thStyle}>Status Flag</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={tdStyle}>
                    <strong>{s.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{s.email}</div>
                  </td>
                  <td style={tdStyle}>{s.rank}</td>
                  <td style={tdStyle}>
                    <strong style={{ color: s.isDeclining ? '#C8102E' : '#1A1A1A' }}>
                      {s.attendancePct === null ? '—' : `${s.attendancePct}%`}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{s.attendanceDetail}</div>
                  </td>
                  <td style={tdStyle}>
                    {!s.sessionsRequired ? (
                      <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>{s.note}</span>
                    ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '90px',
                          height: '8px',
                          backgroundColor: '#E5E7EB',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${s.progressPct}%`,
                            height: '100%',
                            backgroundColor: '#1D4ED8',
                          }}
                        />
                      </div>
                      <span>{s.sessionsAttended} / {s.sessionsRequired}</span>
                    </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {s.isDeclining && <span style={badgeStyle('#C8102E')}>Declining Attendance</span>}
                      {s.isGradingReady && <span style={badgeStyle('#1D4ED8')}>Grading Ready</span>}
                      {!s.isDeclining && !s.isGradingReady && <span style={badgeStyle('#1A1A1A')}>On Track</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cardStyle = (accentColor) => ({
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderTop: `4px solid ${accentColor}`,
  borderRadius: '8px',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
});

const labelStyle = { fontSize: '0.8rem', color: '#4B5563', fontWeight: 600 };
const thStyle = { padding: '0.75rem 1rem', fontSize: '0.85rem' };
const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.9rem' };

const badgeStyle = (bg) => ({
  backgroundColor: bg,
  color: '#FFFFFF',
  padding: '0.25rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  display: 'inline-block',
});

const filterBtnStyle = (active, color) => ({
  backgroundColor: active ? color : '#FFFFFF',
  color: active ? '#FFFFFF' : '#1A1A1A',
  border: `1px solid ${color}`,
  padding: '0.45rem 0.9rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
});