import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/hanken-grotesk';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import { ADMIN_PATH, AuthProvider } from './auth.jsx';
import { PageShell } from './Layout.jsx';
import Account from './pages/Account.jsx';
import AdminPage from './pages/AdminPage.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import SignupComplete from './pages/SignupComplete.jsx';
import './styles.css';

const NotFound = () => (
  <PageShell title="Page not found" narrow>
    <p className="page-lead">This page doesn&rsquo;t exist. Check the link, or go to the <Link to="/">home page</Link>.</p>
  </PageShell>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup/complete" element={<SignupComplete />} />
          <Route path="/account" element={<Account />} />
          {/* The admin page has no links to it; only people given VITE_ADMIN_PATH can reach it. */}
          {ADMIN_PATH && <Route path={ADMIN_PATH} element={<AdminPage />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
