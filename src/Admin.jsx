import { useState } from 'react';

export default function Admin() {
  const [token, setToken] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  async function load(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/enquiries', { headers: { authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) {
        setRows(null);
        setError(body.error);
        return;
      }
      setRows(body.enquiries);
    } catch {
      setError('The server could not be reached. Check your connection and try again.');
    }
  }

  return (
    <main className="admin wrap">
      <h1>Enquiries</h1>
      <form onSubmit={load} className="admin-form">
        <label htmlFor="token">Admin token</label>
        <input id="token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} />
        <button type="submit" className="button">View enquiries</button>
      </form>
      {error && <p className="notice" role="alert">{error}</p>}
      {rows && rows.length === 0 && <p>No enquiries yet. New ones from the website appear here.</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll" role="region" aria-label="Enquiries" tabIndex={0}>
          <table className="timetable admin-table">
            <thead>
              <tr>{['Received (UTC)', 'Name', 'Email', 'Phone', 'For', 'Dojo', 'Question'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at}</td>
                  <td>{r.name}</td>
                  <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td>{r.phone}</td>
                  <td>{r.interest}</td>
                  <td>{r.dojo}</td>
                  <td>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
