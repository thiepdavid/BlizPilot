import { ArrowUpRight } from 'lucide-react';
import type { Payment } from '../types';
import './sales-overview.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function localKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function SalesOverview({ payments }: { payments: Payment[] }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = localKey(date); return { key, label: date.toLocaleDateString([], { weekday: 'short' }), amount: payments.filter(payment => localKey(new Date(payment.receivedAt)) === key).reduce((sum, payment) => sum + payment.amount, 0) }; });
  const total = days.reduce((sum, day) => sum + day.amount, 0);
  const max = Math.max(1, ...days.map(day => day.amount));
  return <section className="panel activity-panel"><div className="panel-heading"><div><h2>Payments this week</h2><p>Based on payments recorded in BizPilot</p></div></div><div className="sales-summary"><strong>{currency.format(total)}</strong><span className="sales-summary-note">{payments.length} payment{payments.length === 1 ? '' : 's'} in the last 7 days</span></div><div className="weekly-bars" role="img" aria-label="Daily payments recorded during the last seven days">{days.map(day => <div className="weekly-bar-column" key={day.key} title={`${day.label}: ${currency.format(day.amount)}`}><span className="weekly-bar-value">{day.amount > 0 ? currency.format(day.amount) : ''}</span><div className="weekly-bar-track"><div className="weekly-bar" style={{ height: `${Math.max(day.amount > 0 ? 8 : 2, day.amount / max * 100)}%` }}/></div><span className="weekly-bar-day">{day.label}</span></div>)}</div><div className="sales-chart-footnote"><ArrowUpRight size={13}/> Recorded payments only · No payment provider connected</div></section>;
}
