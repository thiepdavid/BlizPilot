import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import './legal.css';

type LegalKind = 'privacy' | 'terms';

const sections: Record<LegalKind, Array<{ title: string; body: string }>> = {
  privacy: [
    { title: 'Information in your workspace', body: 'BizPilot stores the account details and business records you enter, such as products, customers, appointments, invoices, payments, expenses, and business profile details. If you publish a booking page, the customer details they submit are stored with that business’s booking records.' },
    { title: 'How information is used', body: 'Information is used to provide the dashboard, save and retrieve records, create reports, manage bookings, and support account security. BizPilot does not sell workspace records.' },
    { title: 'Service providers', body: 'BizPilot uses Supabase for sign-in and cloud data, Render and Vercel to run the service, Stripe when a business connects online payments, and Geoapify when a user requests address suggestions. Address text entered into search is sent to Geoapify. When the AI assistant is used, the app sends the question and aggregate business totals to OpenAI; customer names, contact details, and private notes are excluded.' },
    { title: 'Payments and retention', body: 'Stripe hosts online checkout and handles payment details. BizPilot stores payment status and related invoice records, not full card details. Workspace records are retained while the account is active and may be removed through account deletion, subject to shared-workspace and legal record requirements.' },
    { title: 'Your choices and contact', body: 'You can review and update business records in the app and use Settings to request account deletion. For privacy questions, sign in and contact BizPilot through the Help Centre. Before public launch, the service operator should add a direct privacy contact and confirm data-retention and jurisdiction details.' },
  ],
  terms: [
    { title: 'Using BizPilot', body: 'BizPilot provides tools for managing business records, inventory, bookings, invoices, payments, expenses, and reports. You are responsible for keeping your sign-in credentials private and ensuring that information you enter is accurate and that you have permission to use it.' },
    { title: 'Your records and customers', body: 'You remain responsible for your business records and for providing any notices or obtaining any permissions required to store customer information or send booking and payment links. Keep independent copies of important records.' },
    { title: 'Payments and external services', body: 'BizPilot can record payments and may let an eligible business connect its own payment account. Payment processing, verification, fees, refunds, and settlement are handled under the payment provider’s terms. A payment recorded manually in BizPilot does not itself move money.' },
    { title: 'Reports and AI', body: 'Reports and AI responses are operational aids. Review them before relying on them; they are not accounting, tax, legal, or financial advice. Do not enter sensitive customer information into the AI assistant.' },
    { title: 'Availability and changes', body: 'Features and availability may change as the service develops. Do not use BizPilot to break the law, access another business’s data, or disrupt the service. Before public launch, the service operator should complete the company identity, support contact, governing law, service availability, and liability terms with appropriate professional review.' },
  ],
};

export function LegalPage({ page }: { page: LegalKind }) {
  const isPrivacy = page === 'privacy';
  return <main className="legal-page">
    <header className="legal-header"><a className="legal-brand" href="/" aria-label="BizPilot home"><span className="brand-mark">B</span><span><strong>BizPilot</strong><small>BUSINESS MANAGER</small></span></a><a className="legal-back" href="/"><ArrowLeft size={15}/> Back to BizPilot</a></header>
    <article className="legal-document">
      <div className="legal-kicker">BIZPILOT · {isPrivacy ? 'PRIVACY' : 'TERMS'}</div>
      <div className="legal-title-row"><div><h1>{isPrivacy ? 'Privacy policy' : 'Terms of use'}</h1><p>Plain-language information about using BizPilot.</p></div><span className="legal-title-icon">{isPrivacy ? <ShieldCheck size={19}/> : <FileText size={19}/>}</span></div>
      <p className="legal-review-note"><strong>Pre-launch draft</strong><span>This page describes the current product. BizPilot’s operator still needs to add its legal business identity and direct contact details and have these terms reviewed before public launch.</span></p>
      <p className="legal-date">Updated October 9, 2026</p>
      <div className="legal-sections">{sections[page].map((section, index) => <section key={section.title}><span className="legal-section-number">{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></section>)}</div>
      <footer className="legal-footer"><span>BizPilot</span><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/">Sign in</a></nav></footer>
    </article>
  </main>;
}
