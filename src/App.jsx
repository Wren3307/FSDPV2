import { useState } from 'react';
import Classes from './Classes.jsx';
import Instructors from './Instructors.jsx';
import Join from './Join.jsx';

const FACEBOOK = 'https://www.facebook.com/AikidoShinjuKai';

const NAV = [
  { href: '#about', label: 'About' },
  { href: '#classes', label: 'Classes' },
  { href: '#instructors', label: 'Our instructors' },
  { href: '#join', label: 'How to join' },
];

const MILESTONES = [
  { year: '1988', text: 'Philip Lee founds Aikido Shinju-Kai, with a first dojo at SAFRA Tampines.' },
  { year: '2002', text: 'The first dojo in China opens in Shanghai. Malaysia and Indonesia follow in 2005.' },
  { year: '2014', text: 'Philip Lee is conferred the title of Shihan by the Aikido World Headquarters.' },
  { year: '2016', text: 'Shinju-Kai represents aikido at the National Chingay Parade.' },
  { year: '2017', text: 'Philip Lee Shihan is awarded 7th Dan at the Kagami Biraki ceremony in Japan.' },
  { year: '2024', text: 'Our own permanent Headquarters opens at Thomson V One, with 2 training halls.' },
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

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      <nav id="site-nav" className={open ? 'site-nav is-open' : 'site-nav'} aria-label="Main">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
        ))}
      </nav>
      <a className="site-logo" href="#top" aria-label="Aikido Shinju-Kai home">
        <img src="/images/logo.png" alt="" width="84" height="84" />
      </a>
      <div className="site-contact">
        <a href={FACEBOOK} target="_blank" rel="noopener" aria-label="Facebook"><IconFacebook /></a>
        <a href="tel:+6565131588" aria-label="Call (+65) 6513 1588"><IconPhone /></a>
        <a href="mailto:hq@aikidoshinjukai.com.sg" aria-label="Email hq@aikidoshinjukai.com.sg"><IconMail /></a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-photo" role="img" aria-label="The Aikido Shinju-Kai Headquarters dojo, with green tatami leading to the shomen" />
      <Header />
      <div className="hero-copy">
        <h1>Honouring tradition, leading the future of <span>aikido in Singapore.</span></h1>
        <a className="button button-ring" href="#classes">Find a class near you</a>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="about" id="about">
      <div className="about-intro wrap">
        <div>
          <h2>About Shinju-Kai</h2>
          <p className="lead">
            Established in 1988 and led by Founder and Chief Instructor Philip Lee Shihan, Aikido Shinju-Kai
            is officially recognised by the Aikido World Headquarters in Japan.
          </p>
          <p>
            We run a permanent Headquarters dojo and over 60 dojos across Singapore and overseas, with a
            team of 70 instructors, 100 assistants and over 10,000 members. Daily classes are available
            for adults and children, in small groups or privately.
          </p>
        </div>
        <img className="about-logo" src="/images/logo.png" alt="Aikido Shinju-Kai logo" width="605" height="605" loading="lazy" />
      </div>

      <div className="about-art wrap">
        <img src="/images/practice.jpg" alt="Sean Tan Sensei practising a technique with a partner" width="530" height="590" loading="lazy" />
        <div>
          <h2>What is aikido?</h2>
          <p>
            Aikido is a Japanese martial art of self-defence, known as the art of peace. Using smooth, fluid
            and circular movements, it blends with an opponent&rsquo;s force rather than meeting it head on,
            so size and strength matter less.
          </p>
          <p>
            Traditional aikido is non-competitive. You train with a partner in throws, joint locks, pins and
            traditional weapons, and you progress by showing your understanding, not by beating anyone.
          </p>
          <p>
            Our classes suit all ages. As long as you can move, you can do aikido.
          </p>
          <blockquote>
            <p>&ldquo;When an opponent comes forward, move in and greet him; if he wants to pull back, send him on his way.&rdquo;</p>
            <cite>Ueshiba Morihei (O&rsquo; Sensei), founder of aikido</cite>
          </blockquote>
        </div>
      </div>

      <div className="lineage">
        <div className="wrap">
          <h2>Our history</h2>
          <ol className="timeline">
            {MILESTONES.map((m) => (
              <li key={m.year}>
                <span className="timeline-year">{m.year}</span>
                <p>{m.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Footer() {
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
        </div>
      </div>
      <p className="wrap footer-legal">
        © {new Date().getFullYear()} Aikido Shinju-Kai. Recognised by the Aikido World Headquarters, Japan.
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#classes">Skip to classes</a>
      <main>
        <Hero />
        <About />
        <Classes />
        <Instructors />
        <Join />
      </main>
      <Footer />
    </>
  );
}
