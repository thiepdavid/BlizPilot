import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PublicBookingPage } from './components/PublicBookingPage';
import './styles.css';

const bookingPath = window.location.pathname.match(/^\/book\/([^/]+)\/?$/);
const content = bookingPath
  ? <PublicBookingPage slug={decodeURIComponent(bookingPath[1])} apiBase={import.meta.env.VITE_API_URL ?? ''}/>
  : <App/>;

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{content}</React.StrictMode>);
