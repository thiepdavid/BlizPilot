import { useMemo, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, CircleHelp, CreditCard, Search, Settings, Shirt, Users } from 'lucide-react';
import type { NavKey } from '../types';
import './help-centre.css';

const topics: { title: string; description: string; section: NavKey; icon: typeof CircleHelp }[] = [
  { title: 'Products and stock', description: 'Add variants, sizes, colors, and adjust quantities.', section: 'Inventory', icon: Shirt },
  { title: 'Customers', description: 'Keep customer details and purchase history together.', section: 'Customers', icon: Users },
  { title: 'Appointments', description: 'Manage bookings and public booking settings.', section: 'Appointments', icon: CalendarDays },
  { title: 'Billing and payments', description: 'Create invoices and record customer payments.', section: 'Billing', icon: CreditCard },
  { title: 'Business profile', description: 'Update your business details, currency, and location.', section: 'Business Profile', icon: Settings },
  { title: 'AI Assistant', description: 'Ask questions about your saved business records.', section: 'AI', icon: Activity },
];

const articles = [
  { question: 'How do I add a clothing product?', answer: 'Open Inventory, choose Add product variant, and enter the product name, size, color, cost, selling price, quantity, and low-stock alert. Add a separate variant for each size and color combination.', section: 'Inventory' as NavKey },
  { question: 'Why is each size and color a separate variant?', answer: 'BizPilot tracks stock separately for each combination, so selling a medium black shirt can reduce that exact variant without changing the quantity for other sizes or colors.', section: 'Inventory' as NavKey },
  { question: 'How do I change a product’s quantity?', answer: 'In Inventory, find the product row and choose Stock. Enter the current number of units and save the change.', section: 'Inventory' as NavKey },
  { question: 'What does the low-stock alert mean?', answer: 'A variant is flagged when its quantity is at or below the alert level saved for that variant. You can set the alert level when adding a product.', section: 'Inventory' as NavKey },
  { question: 'How do I create a bill for a customer?', answer: 'Open Billing and choose Create invoice. Select a customer, add the items or services, review the amounts, then save the invoice.', section: 'Billing' as NavKey },
  { question: 'How do I record money received?', answer: 'Open Payments and record a payment against the relevant invoice. BizPilot updates the paid and outstanding amounts for that invoice.', section: 'Payments' as NavKey },
  { question: 'Can I change my business currency?', answer: 'Open Business Profile and choose a currency. Currency changes are restricted after you have saved prices or financial records, to avoid misrepresenting existing amounts.', section: 'Business Profile' as NavKey },
  { question: 'Why might the AI Assistant not answer?', answer: 'The assistant needs a working API connection and available provider credits. If it is temporarily unavailable, try again later; your other BizPilot sections continue to work.', section: 'AI' as NavKey },
];

export function HelpCentrePage({ onNavigate }: { onNavigate: (section: NavKey) => void }) {
  const [query, setQuery] = useState('');
  const filteredArticles = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? articles.filter(article => `${article.question} ${article.answer}`.toLocaleLowerCase().includes(term)) : articles;
  }, [query]);

  return <>
    <div className="page-heading help-centre-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> SUPPORT</div><h1>Help Centre</h1><p>Find quick answers and get to the right part of BizPilot.</p></div></div>
    <section className="help-centre-hero"><div className="help-centre-hero-icon"><CircleHelp size={22}/></div><div><span>HOW CAN WE HELP?</span><h2>What would you like to know?</h2><p>Search common questions or browse a topic below.</p></div><label className="help-centre-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search help articles…" aria-label="Search help articles"/></label></section>
    <section className="help-centre-section"><div className="help-centre-section-heading"><div><h2>Browse by topic</h2><p>Jump directly to a BizPilot feature.</p></div></div><div className="help-topic-grid">{topics.map(({ title, description, section, icon: Icon }) => <button className="help-topic-card" key={title} onClick={() => onNavigate(section)}><span className="help-topic-icon"><Icon size={18}/></span><span className="help-topic-copy"><strong>{title}</strong><small>{description}</small></span><ArrowRight size={16} className="help-topic-arrow"/></button>)}</div></section>
    <section className="help-centre-section help-articles"><div className="help-centre-section-heading"><div><h2>{query ? 'Search results' : 'Frequently asked questions'}</h2><p>{query ? `${filteredArticles.length} matching answer${filteredArticles.length === 1 ? '' : 's'}` : 'Step-by-step answers for common tasks.'}</p></div></div>{filteredArticles.length ? <div className="help-article-list">{filteredArticles.map(article => <details className="help-article" key={article.question}><summary>{article.question}<span>+</span></summary><div><p>{article.answer}</p><button className="text-button" onClick={() => onNavigate(article.section)}>Open {article.section} <ArrowRight size={14}/></button></div></details>)}</div> : <div className="help-no-results"><Search size={20}/><strong>No matching articles</strong><span>Try another phrase, such as “stock”, “invoice”, or “currency”.</span><button className="secondary-button" onClick={() => setQuery('')}>Clear search</button></div>}</section>
  </>;
}
