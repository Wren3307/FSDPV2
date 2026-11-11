import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/hanken-grotesk';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Admin from './Admin.jsx';
import App from './App.jsx';
import './styles.css';

const isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';

createRoot(document.getElementById('root')).render(
  <StrictMode>{isAdmin ? <Admin /> : <App />}</StrictMode>,
);
