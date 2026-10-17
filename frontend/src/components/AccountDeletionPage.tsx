import { ArrowLeft, Trash2 } from 'lucide-react';
import './legal.css';

const deletionEmail = 'imanchan000@gmail.com';
const emailSubject = 'BlizPilot account deletion request';
const emailBody = 'Please delete my BlizPilot account and associated personal data.\n\nAccount email: \nBusiness name (if applicable): ';
const requestHref = `mailto:${deletionEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

export function AccountDeletionPage() {
  return <main className="legal-page">
    <header className="legal-header"><a className="legal-brand" href="/" aria-label="BlizPilot home"><span className="brand-mark">B</span><span><strong>BlizPilot</strong><small>BUSINESS MANAGER</small></span></a><a className="legal-back" href="/"><ArrowLeft size={15}/> Back to BlizPilot</a></header>
    <article className="legal-document">
      <div className="legal-kicker">BLIZPILOT · ACCOUNT DELETION</div>
      <div className="legal-title-row"><div><h1>Delete your account</h1><p>Request deletion of your BlizPilot account and associated business data.</p></div><span className="legal-title-icon"><Trash2 size={19}/></span></div>
      <p className="legal-review-note"><strong>How to request deletion</strong><span>Email us from the address linked to your BlizPilot account. Include your account email and, if applicable, the business name so we can verify and process the request.</span></p>
      <p><a className="primary-button" href={requestHref}>Email a deletion request</a></p>
      <p>If your email app does not open, send your request to <a href={`mailto:${deletionEmail}`}>{deletionEmail}</a> with the subject “{emailSubject}”. Do not include your password or payment card details.</p>
      <section><h2>What will be deleted</h2><p>After we verify the request, we will delete the account and associated personal data. If you are the sole member of a business workspace, its records are removed with the account. A shared workspace is retained for its other members, and an owner must transfer ownership before the account can be deleted.</p></section>
      <section><h2>Records that may be retained</h2><p>Some information may be retained where required for legal, payment, security, or dispute purposes. Copies in service-provider backups may remain until those providers’ backup retention periods expire. See the <a href="/privacy">BlizPilot privacy policy</a> for details.</p></section>
      <footer className="legal-footer"><span>BlizPilot</span><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/">Sign in</a></nav></footer>
    </article>
  </main>;
}
