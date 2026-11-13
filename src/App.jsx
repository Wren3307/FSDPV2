import Classes from './Classes.jsx';
import Instructors from './Instructors.jsx';
import Join from './Join.jsx';
import { SiteFooter, SiteHeader } from './Layout.jsx';

const MILESTONES = [
  { year: '1988', text: 'Philip Lee founds Aikido Shinju-Kai, with a first dojo at SAFRA Tampines.' },
  { year: '2002', text: 'The first dojo in China opens in Shanghai. Malaysia and Indonesia follow in 2005.' },
  { year: '2014', text: 'Philip Lee is conferred the title of Shihan by the Aikido World Headquarters.' },
  { year: '2016', text: 'Shinju-Kai represents aikido at the National Chingay Parade.' },
  { year: '2017', text: 'Philip Lee Shihan is awarded 7th Dan at the Kagami Biraki ceremony in Japan.' },
  { year: '2024', text: 'Our own permanent Headquarters opens at Thomson V One, with 2 training halls.' },
];

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-photo" role="img" aria-label="The Aikido Shinju-Kai Headquarters dojo, with green tatami leading to the shomen" />
      <SiteHeader overlay />
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
      <SiteFooter />
    </>
  );
}
