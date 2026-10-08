import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const PublicBookingPage = lazy(() => import('./components/PublicBookingPage').then(module => ({ default: module.PublicBookingPage })));

const bookingPath = window.location.pathname.match(/^\/book\/([^/]+)\/?$/);
const content = bookingPath
  ? <PublicBookingPage slug={decodeURIComponent(bookingPath[1])} apiBase={import.meta.env.VITE_API_URL ?? ''}/>
  : <App/>;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<main className="page-loading" role="status">Loading BizPilot…</main>}>
      {content}
    </Suspense>
  </React.StrictMode>,
);
