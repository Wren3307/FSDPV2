import { useEffect, useState } from 'react';
import { api } from './auth.jsx';

export default function InstructorDashboard() {
  const [state, setState] = useState({ loading: true, error: '', dojo: '', students: [] });
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'READY' | 'DECLINING'

  useEffect(() => {
    async function loadDashboard() {
      // 1. Fetch active members at this instructor's dojo (existing FP-15 endpoint)
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

      // 2. Fetch grading eligibility data (existing FP-10 endpoint)
      const eligRes = await api('/eligibility');
      const eligList = Array.isArray(eligRes.data)
        ? eligRes.data
        : eligRes.data?.students || eligRes.data?.results || [];

      const eligById = new Map(eligList.map((item) => [item.student_id ?? item.id, item]));

      const rawMembers = membersRes.data?.members || [];
      const enriched = rawMembers.map((m) => {
        const elig = eligById.get(m.id) || {};
        const attended = Number(elig.sessions_attended ?? elig.sessionsAttended ?? elig.attended ?? 0);
        const required = Number(elig.sessions_required ?? elig.sessionsRequired ?? elig.required ?? 14);
        const attendancePct = required > 0 ? Math.min(100, Math.round((attended / required) * 100)) : 0;
        const isGradingReady = Boolean(elig.eligible ?? elig.isEligible ?? attended >= required);
        const isDeclining = attendancePct < 50;

        return {
          ...m,
          sessionsAttended: attended,
          sessionsRequired: required,
          attendancePct,
          isGradingReady,
          isDeclining,
        };
      });

      setState({
        loading: false,
        error: '',
        dojo: membersRes.data?.dojo || '',
        students: enriched,
      });
    }

    loadDashboard();
  }, []);

  if (state.loading) return <p style={{ padding: '1rem' }}>Loading progression dashboard&hellip;</p>;
  if (state.error) return <p style={{ padding: '1rem', color: '#C8102E' }}>{state.error}</p>;

  const { dojo, students } = state;
  const totalStudents = students.length;
  const gradingReadyCount = students.filter((s) => s.isGradingReady).length;
  const decliningCount = students.filter((s) => s.isDeclining).length;
  const avgAttendancePct = totalStudents
    ? Math.round(students.reduce((sum, s) => sum + s.attendancePct, 0) / totalStudents)
    : 0;

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
          Real-time student retention alerts (&lt;50% attendance) and grading readiness overview
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
          <span style={labelStyle}>Declining (&lt;50%)</span>
          <strong style={{ fontSize: '1.75rem', color: '#C8102E' }}>{decliningCount}</strong>
        </div>

        <div style={cardStyle('#1A1A1A')}>
          <span style={labelStyle}>Avg Attendance</span>
          <strong style={{ fontSize: '1.75rem', color: '#1A1A1A' }}>{avgAttendancePct}%</strong>
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
          Declining Flag (&lt;50%) ({decliningCount})
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
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>Attendance Progress</th>
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
                    {s.sessionsAttended} / {s.sessionsRequired}
                  </td>
                  <td style={tdStyle}>
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
                            width: `${s.attendancePct}%`,
                            height: '100%',
                            backgroundColor: s.isDeclining ? '#C8102E' : '#1D4ED8',
                          }}
                        />
                      </div>
                      <span>{s.attendancePct}%</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {s.isDeclining ? (
                      <span style={badgeStyle('#C8102E')}>Declining Attendance</span>
                    ) : s.isGradingReady ? (
                      <span style={badgeStyle('#1D4ED8')}>Grading Ready</span>
                    ) : (
                      <span style={badgeStyle('#1A1A1A')}>On Track</span>
                    )}
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