// Shows a staff screen only to a logged-in instructor or admin; everyone else is asked to log in.
import { Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { PageShell } from './Layout.jsx';

export default function StaffOnly({ children }) {
  const { user } = useAuth();

  if (user === undefined) return <PageShell narrow><p>Loading&hellip;</p></PageShell>;
  if (user && (user.role === 'instructor' || user.role === 'admin')) return children;

  return (
    <PageShell title="Staff only" narrow>
      <p className="page-lead">
        {user
          ? 'This page is for instructors and admins. Your account is a member account.'
          : 'Log in as an instructor to use this page.'}
      </p>
      {!user && <Link className="button" to="/login">Log in</Link>}
    </PageShell>
  );
}
