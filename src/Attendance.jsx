// FP-7 attendance screen for instructors, used on a phone at the dojo.
// Flow: pick a date -> tap a class -> tap students to set their status -> Save.
// Ported from the first attempt's client/src/App.jsx.
import { useEffect, useState } from 'react';
import StaffHeader from './StaffHeader.jsx';
import { api } from './staffApi.js';

// Tapping a student moves them to the next status in this list.
const STATUS_CYCLE = ['present', 'late', 'absent', 'excused'];
const STATUS_LABELS = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };

// indexOf is -1 for a student nobody has marked, and (-1 + 1) % 4 is 0, so they start at Present.
function nextStatus(status) {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
}

// Today as YYYY-MM-DD in the browser's time zone (toISOString() alone is UTC).
function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// What the server last saw for each student, so the Save button can count unsaved changes.
function statusesById(rows) {
  return Object.fromEntries(rows.map((row) => [row.studentId, row.status]));
}

export default function Attendance() {
  const [date, setDate] = useState(todayLocal);
  const [classes, setClasses] = useState(null); // null while loading
  const [session, setSession] = useState(null); // { sessionId, className, centreName, centreId } once a class is open
  const [roster, setRoster] = useState([]);
  const [saved, setSaved] = useState({}); // studentId -> status, as last saved
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, tone: 'ok' | 'error' }
  const [reloads, setReloads] = useState(0); // bumped to fetch the class list again

  // Reload the class list when the date changes, or when coming back from a roster
  // (so a class that now has a session shows "Started").
  useEffect(() => {
    setClasses(null);
    api(`/api/instructor/classes?date=${date}`)
      .then(setClasses)
      .catch((err) => {
        setClasses([]);
        setMessage({ text: err.message, tone: 'error' });
      });
  }, [date, reloads]);

  // A roster belongs to one person and one day, so changing either goes back to the class list.
  function backToClasses() {
    setReloads((n) => n + 1);
    setSession(null);
    setSearch('');
    setSearchResults([]);
    setMessage(null);
  }

  async function openClass(item) {
    setMessage(null);
    try {
      // Safe to repeat: the API reuses the session if this class already has one on this date.
      const { sessionId } = await api(`/api/classes/${item.classId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      const rows = await api(`/api/sessions/${sessionId}/roster`);
      setSession({ sessionId, className: item.name, centreName: item.centreName, centreId: item.centreId });
      setRoster(rows);
      setSaved(statusesById(rows));
    } catch (err) {
      setMessage({ text: err.message, tone: 'error' });
    }
  }

  function setStatus(studentId, status) {
    setRoster((rows) => rows.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    setMessage(null); // the roster changed, so an earlier "Saved" is out of date
  }

  function markAllPresent() {
    setRoster((rows) => rows.map((row) => ({ ...row, status: 'present' })));
    setMessage(null);
  }

  async function searchStudents(text) {
    setSearch(text);
    if (text.trim() === '') return setSearchResults([]);
    try {
      const found = await api(`/api/centres/${session.centreId}/students?q=${encodeURIComponent(text)}`);
      // Someone already on the roster can't be added twice.
      setSearchResults(found.filter((student) => !roster.some((row) => row.studentId === student.studentId)));
    } catch (err) {
      setMessage({ text: err.message, tone: 'error' });
    }
  }

  function addWalkIn(student) {
    // A walk-in is standing in front of the instructor, so they start as present.
    setRoster((rows) => [...rows, { ...student, status: 'present' }]);
    setSearch('');
    setSearchResults([]);
    setMessage(null);
  }

  async function saveAttendance() {
    // Students nobody has marked are left out rather than saved as absent.
    const entries = roster.filter((row) => row.status).map(({ studentId, status }) => ({ studentId, status }));
    setSaving(true);
    try {
      await api(`/api/sessions/${session.sessionId}/attendance`, { method: 'PUT', body: JSON.stringify(entries) });
      setSaved(statusesById(roster));
      setMessage({ text: `Saved ${entries.length} students.`, tone: 'ok' });
    } catch (err) {
      setMessage({ text: err.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const unsaved = roster.filter((row) => row.status && row.status !== saved[row.studentId]).length;
  const notMarked = roster.filter((row) => !row.status).length;

  return (
    <div className="attendance">
      <StaffHeader title="Attendance" />

      {!session ? (
        <main className="att-main">
          <label className="att-field">
            <span>Class date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
                backToClasses();
              }}
            />
          </label>

          {message && <p className={`att-message ${message.tone}`} role="alert">{message.text}</p>}

          {classes === null && <p className="att-empty">Loading classes…</p>}
          {classes?.length === 0 && (
            <p className="att-empty">
              No classes on this date. The demo data has Monday and Wednesday classes at ASK Headquarters
              Dojo, and a Saturday class at Cheng San Dojo.
            </p>
          )}
          {classes?.length > 0 && (
            <ul className="att-list">
              {classes.map((item) => (
                <li key={item.classId}>
                  <button type="button" className="att-row" onClick={() => openClass(item)}>
                    <span className="att-grow">
                      <span className="att-title">{item.name}</span>
                      <span className="att-sub">{item.startTime}–{item.endTime} · {item.centreName}</span>
                    </span>
                    {item.sessionId && <span className="att-tag">Started</span>}
                    <span className="att-chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      ) : (
        <main className="att-main att-roster">
          <button type="button" className="att-back" onClick={backToClasses}>‹ All classes</button>

          <div>
            <h2>{session.className}</h2>
            <p className="att-sub">
              {date} · {session.centreName} · {roster.length} students{notMarked > 0 && `, ${notMarked} not marked`}
            </p>
          </div>

          <p className="att-hint">Tap a student to change their status.</p>
          <ul className="att-list">
            {roster.map((row) => (
              <li key={row.studentId}>
                <button
                  type="button"
                  className="att-row"
                  onClick={() => setStatus(row.studentId, nextStatus(row.status))}
                  aria-label={`${row.name}, ${STATUS_LABELS[row.status] ?? 'not marked'}. Tap to change.`}
                >
                  <span className="att-grow">
                    <span className="att-title">{row.name}</span>
                    <span className="att-sub">{row.rank ?? 'No rank yet'}</span>
                  </span>
                  <span className={`att-status ${row.status ?? 'none'}`}>{STATUS_LABELS[row.status] ?? 'Not marked'}</span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="button button-quiet att-wide" onClick={markAllPresent}>
            Mark all present
          </button>

          <section className="att-walkin">
            <label className="att-field">
              <span>Add a walk-in</span>
              <input
                type="search"
                placeholder="Search students at this centre"
                value={search}
                onChange={(e) => searchStudents(e.target.value)}
              />
            </label>
            {searchResults.length > 0 && (
              <ul className="att-list">
                {searchResults.map((student) => (
                  <li key={student.studentId}>
                    <button type="button" className="att-row" onClick={() => addWalkIn(student)}>
                      <span className="att-grow">
                        <span className="att-title">{student.name}</span>
                        <span className="att-sub">{student.rank ?? 'No rank yet'}</span>
                      </span>
                      <span className="att-status add">+ Add</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim() !== '' && searchResults.length === 0 && (
              <p className="att-hint">No other students at this centre match “{search}”.</p>
            )}
          </section>

          {/* Pinned to the bottom so Save is always one tap away, however long the roster is. */}
          <div className="att-save">
            {message && <p className={`att-message ${message.tone}`} role="status">{message.text}</p>}
            <button type="button" className="button att-wide" onClick={saveAttendance} disabled={saving}>
              {saving ? 'Saving…' : unsaved > 0 ? `Save attendance (${unsaved} unsaved)` : 'Save attendance'}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
