import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const PublicBookingPage = lazy(() => import('./components/PublicBookingPage').then(module => ({ default: module.PublicBookingPage })));
const LegalPage = lazy(() => import('./components/LegalPage').then(module => ({ default: module.LegalPage })));

const bookingPath = window.location.pathname.match(/^\/book\/([^/]+)\/?$/);
const legalPage = window.location.pathname.replace(/\/$/, '');
const content = bookingPath
  ? <PublicBookingPage slug={decodeURIComponent(bookingPath[1])} apiBase={import.meta.env.VITE_API_URL ?? ''}/>
  : legalPage === '/privacy' || legalPage === '/terms'
    ? <LegalPage page={legalPage === '/privacy' ? 'privacy' : 'terms'}/>
    : <App/>;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<main className="loading-shell" role="status" aria-label="Loading BizPilot"><span className="visually-hidden">Loading BizPilot</span><div className="loading-topbar"/><div className="loading-content"><div className="loading-title"/><div className="loading-metrics">{Array.from({ length: 4 }, (_, index) => <i key={index}/>)}</div><div className="loading-main"><div><i/><i/></div><i/></div></div></main>}>
      {content}
    </Suspense>
  </React.StrictMode>,
);
