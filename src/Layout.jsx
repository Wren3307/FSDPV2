import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';

export const FACEBOOK = 'https://www.facebook.com/AikidoShinjuKai';

const NAV = [
  { href: '/#about', label: 'About' },
  { href: '/#classes', label: 'Classes' },
  { href: '/#instructors', label: 'Our instructors' },
  { href: '/#join', label: 'How to join' },
];

const IconFacebook = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8.5V6.6c0-.9.6-1.1 1-1.1h2V2h-2.8C11.1 2 10 4.3 10 6v2.5H7.5V12H10v10h4V12h2.8l.4-3.5z" /></svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M5 3h4l1.5 5-2.2 1.6a12 12 0 0 0 6.1 6.1L16 13.5l5 1.5v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3z" /></svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M3 5.5h18v13H3zM3 6l9 7 9-7" /></svg>
);

/** Members and instructors land on their account; admins are only sent to the hidden page by its own link. */
function AccountLink({ onClick }) {
  const { user } = useAuth();
  const loggedIn = user && user.role !== 'admin';
  return (
    <Link className="nav-account" to={loggedIn ? '/account' : '/login'} onClick={onClick}>
      {loggedIn ? 'My account' : 'Log in'}
    </Link>
  );
}

/** `overlay` sits on top of the home page photo; otherwise the header has its own navy bar. */
export function SiteHeader({ overlay = false }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className={overlay ? 'site-header' : 'site-header is-solid'}>
      <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <nav id="site-nav" className={open ? 'site-nav is-open' : 'site-nav'} aria-label="Main">
        {NAV.map((item) => <a key={item.href} href={item.href} onClick={close}>{item.label}</a>)}
        <AccountLink onClick={close} />
      </nav>
      <Link className="site-logo" to="/" aria-label="Aikido Shinju-Kai home">
        <img src="/images/logo.png" alt="" width="84" height="84" />
      </Link>
      <div className="site-contact">
        <a href={FACEBOOK} target="_blank" rel="noopener" aria-label="Facebook"><IconFacebook /></a>
        <a href="tel:+6565131588" aria-label="Call (+65) 6513 1588"><IconPhone /></a>
        <a href="mailto:hq@aikidoshinjukai.com.sg" aria-label="Email hq@aikidoshinjukai.com.sg"><IconMail /></a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <img src="/images/logo.png" alt="Aikido Shinju-Kai logo" width="120" height="120" loading="lazy" />
        <div>
          <h3>Headquarters dojo</h3>
          <address>Thomson V One<br />9 Sin Ming Road, #B1-02<br />Singapore 575630</address>
          <a href="https://g.co/kgs/nuhTz29" target="_blank" rel="noopener">Open in Maps</a>
        </div>
        <div>
          <h3>Office hours</h3>
          <p>Monday to Friday, 10am to 9.30pm<br />Saturday and Sunday, 8am to 7pm</p>
        </div>
        <div>
          <h3>Contact</h3>
          <p>
            <a href="tel:+6565131588">(+65) 6513 1588</a><br />
            <a href="tel:+6562560111">(+65) 6256 0111</a><br />
            <a href="mailto:hq@aikidoshinjukai.com.sg">hq@aikidoshinjukai.com.sg</a><br />
            <a href={FACEBOOK} target="_blank" rel="noopener">Facebook</a>
          </p>
          <h3 className="footer-subhead">Members</h3>
          <p>
            <Link to="/login">Member and instructor log in</Link><br />
            <Link to="/signup">Become a member</Link>
          </p>
        </div>
      </div>
      <p className="wrap footer-legal">
        © {new Date().getFullYear()} Aikido Shinju-Kai. Recognised by the Aikido World Headquarters, Japan.
      </p>
    </footer>
  );
}

/** Frame for every page except home: solid header, centred content, footer. */
export function PageShell({ title, narrow = false, children }) {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className={narrow ? 'wrap page-narrow' : 'wrap'}>
          {title && <h1 className="page-title">{title}</h1>}
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
