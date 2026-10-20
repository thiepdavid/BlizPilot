import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const PublicBookingPage = lazy(() => import('./components/PublicBookingPage').then(module => ({ default: module.PublicBookingPage })));
const LegalPage = lazy(() => import('./components/LegalPage').then(module => ({ default: module.LegalPage })));
const AccountDeletionPage = lazy(() => import('./components/AccountDeletionPage').then(module => ({ default: module.AccountDeletionPage })));

function BrandLoadingScreen() {
  return (
    <main className="brand-loading-screen" role="status" aria-label="Loading BlizPilot">
      <div className="brand-loading-content">
        <span className="brand-loading-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <span className="brand-loading-name">BlizPilot</span>
        <span className="brand-loading-subtitle">BUSINESS MANAGER</span>
        <span className="brand-loading-track" aria-hidden="true" />
      </div>
    </main>
  );
}

const bookingPath = window.location.pathname.match(/^\/book\/([^/]+)\/?$/);
const legalPage = window.location.pathname.replace(/\/$/, '');
const content = bookingPath
  ? <PublicBookingPage slug={decodeURIComponent(bookingPath[1])} apiBase={import.meta.env.VITE_API_URL ?? ''}/>
  : legalPage === '/delete-account'
    ? <AccountDeletionPage/>
  : legalPage === '/privacy' || legalPage === '/terms'
    ? <LegalPage page={legalPage === '/privacy' ? 'privacy' : 'terms'}/>
    : <App/>;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<BrandLoadingScreen />}>
      {content}
    </Suspense>
  </React.StrictMode>,
);
