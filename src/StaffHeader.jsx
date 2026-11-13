// Header shared by the staff screens: logo, page title, links between screens, and the demo user picker.
import { getCurrentUserId, setCurrentUserId } from './staffApi.js';

// Stand-in for login until FP-1: the seeded staff the demo needs.
const DEMO_USERS = [
  { id: 2, name: 'Kenji Yamamoto', role: 'Instructor, Shinjuku' },
  { id: 3, name: 'Mei Lin', role: 'Instructor, Shibuya' },
  { id: 1, name: 'Aiko Tanaka', role: 'Admin, all centres' },
];

const PAGES = [
  { href: '/attendance', label: 'Attendance' },
  { href: '/eligibility', label: 'Grading eligibility' },
];

// onUserChange(id) runs after the picker changes, so the page can reload its data for that user.
export default function StaffHeader({ title, onUserChange }) {
  const current = window.location.pathname.replace(/\/$/, '');

  return (
    <header className="att-bar">
      <a href="/" className="att-home" aria-label="Aikido Shinju-Kai home">
        <img src="/images/logo.png" alt="" width="40" height="40" />
      </a>
      <h1>{title}</h1>
      <nav className="att-nav" aria-label="Staff pages">
        {PAGES.map((page) => (
          <a key={page.href} href={page.href} aria-current={page.href === current ? 'page' : undefined}>
            {page.label}
          </a>
        ))}
      </nav>
      <label className="att-field att-user">
        <span>Signed in as <small>(demo, until login exists)</small></span>
        <select
          defaultValue={getCurrentUserId()}
          onChange={(e) => {
            setCurrentUserId(Number(e.target.value));
            onUserChange(Number(e.target.value));
          }}
        >
          {DEMO_USERS.map((user) => (
            <option key={user.id} value={user.id}>{user.name}: {user.role}</option>
          ))}
        </select>
      </label>
    </header>
  );
}
