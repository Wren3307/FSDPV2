import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/hanken-grotesk';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Admin from './Admin.jsx';
import App from './App.jsx';
import Attendance from './Attendance.jsx';
import Eligibility from './Eligibility.jsx';
import './styles.css';

// One page per path. /attendance (FP-7) and /eligibility (FP-10) are staff screens; everything else is the public site.
const PAGES = { '/admin': Admin, '/attendance': Attendance, '/eligibility': Eligibility };
const Page = PAGES[window.location.pathname.replace(/\/$/, '')] ?? App;

createRoot(document.getElementById('root')).render(
  <StrictMode><Page /></StrictMode>,
);
