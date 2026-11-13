// FP-10 grading eligibility screen for instructors and admins.
// Shows who is ready for their next grading, and for everyone else, which rule they still fall short on.
// All the checking happens on the server (server/eligibility.js); this screen only displays the results.
import { useEffect, useState } from 'react';
import StaffHeader from './StaffHeader.jsx';
import { api } from './staffApi.js';

// One rule's progress, e.g. "Sessions since last grading: 13 · needs 14", with a bar that fills towards the target.
function CheckRow({ check }) {
  // A missing actual (no date of birth on file) shows as an empty bar.
  const percent = check.actual === null ? 0 : Math.min(100, Math.round((check.actual / check.required) * 100));
  return (
    <li className="elg-check">
      <div className="elg-check-text">
        <span>{check.rule}</span>
        <span className={check.met ? 'elg-met' : 'elg-short'}>
          {check.actual ?? 'Unknown'} · needs {check.required} {check.met ? '✓' : '✗'}
        </span>
      </div>
      <div className="elg-bar" aria-hidden="true">
        <div className={check.met ? 'elg-fill met' : 'elg-fill'} style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

function StudentCard({ result }) {
  return (
    <li className="elg-card">
      <div className="elg-card-head">
        <div className="att-grow">
          <span className="att-title">{result.studentName}</span>
          <span className="att-sub">
            {result.centreName} · {result.currentRank ?? 'No rank'}{result.nextRank && ` → ${result.nextRank}`}
          </span>
        </div>
        <span className={result.eligible ? 'elg-badge ready' : 'elg-badge'}>
          {result.eligible ? 'Ready' : 'Not yet'}
        </span>
      </div>
      {result.reason && <p className="att-hint">{result.reason}</p>}
      {result.checks.length > 0 && (
        <ul className="elg-checks">
          {result.checks.map((check) => <CheckRow key={check.rule} check={check} />)}
        </ul>
      )}
    </li>
  );
}

export default function Eligibility() {
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState(null); // null while loading
  const [checkedAt, setCheckedAt] = useState(null);
  const [runs, setRuns] = useState(0); // bumped by the "Run check again" button
  const [error, setError] = useState(null);

  // The centre list and the rules table load once; StaffOnly has already checked this is staff.
  useEffect(() => {
    setError(null);
    Promise.all([api('/api/centres'), api('/api/grading-rules')])
      .then(([centreList, ruleList]) => {
        setCentres(centreList);
        setRules(ruleList);
      })
      .catch((err) => setError(err.message));
  }, []);

  // The engine works eligibility out on every request, so fetching again is "running" it again.
  useEffect(() => {
    setResults(null);
    api(`/api/eligibility${centreId ? `?centreId=${centreId}` : ''}`)
      .then((list) => {
        setResults(list);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      })
      .catch((err) => {
        setResults([]);
        setError(err.message);
      });
  }, [centreId, runs]);

  const ready = results?.filter((r) => r.eligible) ?? [];
  const notReady = results?.filter((r) => !r.eligible) ?? [];

  return (
    <div className="attendance">
      <StaffHeader title="Eligibility" />

      <main className="att-main">
        <div className="elg-controls">
          <label className="att-field">
            <span>Centre</span>
            <select value={centreId} onChange={(e) => setCentreId(e.target.value)}>
              <option value="">All centres</option>
              {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
            </select>
          </label>
          <button type="button" className="button button-quiet" onClick={() => setRuns((n) => n + 1)}>
            Run check again
          </button>
        </div>

        {error && <p className="att-message error" role="alert">{error}</p>}
        {results === null && <p className="att-empty">Checking every student against the grading rules…</p>}

        {results && (
          <p className="elg-summary" role="status">
            <strong>{ready.length} of {results.length}</strong> students are ready for their next grading.
            {checkedAt && <span className="att-sub"> Checked at {checkedAt}.</span>}
          </p>
        )}

        {ready.length > 0 && (
          <section className="elg-section">
            <h2>Ready for grading</h2>
            <ul className="att-list">{ready.map((r) => <StudentCard key={r.studentId} result={r} />)}</ul>
          </section>
        )}

        {notReady.length > 0 && (
          <section className="elg-section">
            <h2>Not ready yet</h2>
            <ul className="att-list">{notReady.map((r) => <StudentCard key={r.studentId} result={r} />)}</ul>
          </section>
        )}

        {rules.length > 0 && (
          <details className="elg-rules">
            <summary>Grading rules the check uses</summary>
            <p className="att-hint">
              A session counts if the student was present or late, from the day they got their current rank.
              Thresholds are placeholders until the club confirms them.
            </p>
            <div className="table-scroll" role="region" aria-label="Grading rules" tabIndex={0}>
              <table className="elg-table">
                <thead>
                  <tr><th scope="col">Grading</th><th scope="col">Sessions</th><th scope="col">Months</th><th scope="col">External count</th><th scope="col">Min age</th></tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.fromRank} → {rule.toRank}</td>
                      <td>{rule.minSessions}</td>
                      <td>{rule.minMonths}</td>
                      <td>{rule.countsExternal ? 'Yes' : 'No'}</td>
                      <td>{rule.minAge ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
