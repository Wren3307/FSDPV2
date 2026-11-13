// Header shared by the staff screens: logo, page title, links between screens, and who is logged in.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_PATH, ROLE_LABEL, useAuth } from './auth.jsx';

const PAGES = [
  { href: '/attendance', label: 'Attendance' },
  { href: '/eligibility', label: 'Grading eligibility' },
];

export default function StaffHeader({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const current = useLocation().pathname.replace(/\/$/, '');
  // Admins have no member account page; their home is the hidden admin page.
  const home = user?.role === 'admin' ? ADMIN_PATH : '/account';

  return (
    <header className="att-bar">
      <Link to="/" className="att-home" aria-label="Aikido Shinju-Kai home">
        <img src="/images/logo.png" alt="" width="40" height="40" />
      </Link>
      <h1>{title}</h1>
      <nav className="att-nav" aria-label="Staff pages">
        {PAGES.map((page) => (
          <Link key={page.href} to={page.href} aria-current={page.href === current ? 'page' : undefined}>
            {page.label}
          </Link>
        ))}
        {home && <Link to={home}>{user?.role === 'admin' ? 'Admin' : 'My account'}</Link>}
      </nav>
      <div className="att-user">
        <span>{user?.name} <small>({ROLE_LABEL[user?.role]}{user?.dojo ? `, ${user.dojo}` : ''})</small></span>
        <button type="button" className="att-logout" onClick={async () => { await logout(); navigate('/login'); }}>
          Log out
        </button>
      </div>
    </header>
  );
}
