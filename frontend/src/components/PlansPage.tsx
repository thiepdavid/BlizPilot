import { BadgeCheck, CreditCard, Sparkles } from 'lucide-react';
import './plans.css';

const starterFeatures = ['Product and stock tracking', 'Sales, invoices, and expenses', 'Customer records and reports', 'One business workspace'];
const growthFeatures = ['Everything in Starter', 'Team access and staff roles', 'Multiple shop locations', 'AI and WhatsApp tools'];

export function PlansPage() {
  return <>
    <div className="page-heading plans-heading"><div><div className="eyebrow">ACCOUNT <span>/</span> PLANS</div><h1>Plans &amp; billing</h1><p>Simple plans for boutiques that want to stay on top of stock and sales.</p></div></div>
    <section className="plans-preview-note" role="status"><CreditCard size={18}/><div><strong>Free preview</strong><span>Subscriptions are not enabled yet. You won’t be charged from this page.</span></div></section>
    <section className="plans-intro"><div><span className="plans-kicker"><Sparkles size={14}/> PRICING IDEAS</span><h2>Start small. Grow when you’re ready.</h2><p>These are initial price ideas to validate with boutique owners. Final local pricing and checkout will be set before paid plans launch.</p></div><span className="plans-trial-chip"><BadgeCheck size={15}/> Suggested trial: 14 days</span></section>
    <div className="plans-grid">
      <article className="panel plan-card"><div className="plan-card-top"><div><span className="plan-label">CORE TOOLS</span><h3>Starter</h3></div><span className="plan-badge">Suggested</span></div><p className="plan-description">The essentials to run one boutique workspace.</p><div className="plan-price-pair"><div><strong>₹499</strong><span>/ month · India price idea</span></div><div><strong>$9</strong><span>/ month · USD reference</span></div></div><ul>{starterFeatures.map(feature => <li key={feature}><BadgeCheck size={15}/>{feature}</li>)}</ul><button className="secondary-button plan-action" type="button" disabled>Checkout coming later</button></article>
      <article className="panel plan-card plan-card-featured"><div className="plan-card-top"><div><span className="plan-label">FOR GROWING SHOPS</span><h3>Growth</h3></div><span className="plan-badge">Planned</span></div><p className="plan-description">More capacity as the shop and team expand.</p><div className="plan-price-pair"><div><strong>₹999</strong><span>/ month · India price idea</span></div><div><strong>$19</strong><span>/ month · USD reference</span></div></div><ul>{growthFeatures.map((feature, index) => <li className={index > 0 ? 'plan-upcoming-feature' : ''} key={feature}><BadgeCheck size={15}/>{feature}{index > 0 && <small>Planned</small>}</li>)}</ul><button className="primary-button plan-action" type="button" disabled>Checkout coming later</button></article>
    </div>
    <p className="plans-footnote">The USD amounts are reference prices, not converted exchange rates. Prices, trial length, and included features are proposals and may change after customer feedback.</p>
  </>;
}
