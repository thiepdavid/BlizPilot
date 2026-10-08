import { formatCurrency } from '../lib/currency';
import { Activity, ArrowRight, CalendarClock, CircleDollarSign, UsersRound } from 'lucide-react';
import type { Appointment, Customer, Invoice, NavKey } from '../types';
import './brief.css';

function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function BriefCard({ customers, appointments, invoices, onNavigate }: { customers: Customer[]; appointments: Appointment[]; invoices: Invoice[]; onNavigate: (page: NavKey) => void }) {
  const today = dayKey(new Date());
  const overdue = invoices.filter(invoice => invoice.dueDate < today && invoice.status !== 'Paid' && invoice.amount > (invoice.paidAmount ?? 0));
  const overdueAmount = overdue.reduce((sum, invoice) => sum + invoice.amount - (invoice.paidAmount ?? 0), 0);
  const nextAppointment = appointments.filter(item => new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const returning = customers.filter(customer => customer.visits > 1).length;
  const firstLine = overdue.length ? `${overdue.length} overdue invoice${overdue.length === 1 ? '' : 's'}` : invoices.length ? `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} still open` : 'No invoices to follow up';
  const firstDetail = overdue.length ? `${formatCurrency(overdueAmount, 0)} past due` : invoices.length ? 'Review outstanding balances' : 'Create one after your next service';
  const scheduleLine = appointments.length ? `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} today` : 'No appointments today';
  const scheduleDetail = nextAppointment ? `Next: ${new Date(nextAppointment.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${nextAppointment.customer}` : 'Your schedule is clear';
  return <section className="brief-card"><div className="brief-heading"><div className="brief-sparkle"><Activity size={17}/></div><span>TODAY AT A GLANCE</span><span className="brief-dot"/></div><h2>{overdue.length || invoices.length || appointments.length ? 'A quick look at today.' : 'You’re all caught up.'}</h2><p>Here’s a summary based on the records in your workspace.</p><div className="brief-actions"><button className="brief-action-row" onClick={() => onNavigate('Billing')}><span className={`brief-action-icon ${overdue.length ? 'red' : invoices.length ? 'amber' : 'green'}`}><CircleDollarSign size={16}/></span><span><strong>{firstLine}</strong><small>{firstDetail}</small></span><ArrowRight size={16}/></button><button className="brief-action-row" onClick={() => onNavigate('Appointments')}><span className="brief-action-icon green"><CalendarClock size={16}/></span><span><strong>{scheduleLine}</strong><small>{scheduleDetail}</small></span><ArrowRight size={16}/></button><button className="brief-action-row" onClick={() => onNavigate('Customers')}><span className="brief-action-icon amber"><UsersRound size={16}/></span><span><strong>{customers.length} customers in your list</strong><small>{returning} have visited more than once</small></span><ArrowRight size={16}/></button></div><button className="brief-button" onClick={() => onNavigate(overdue.length || invoices.length ? 'Billing' : 'Appointments')}>{overdue.length || invoices.length ? 'Review invoices' : 'View your schedule'} <ArrowRight size={16}/></button><div className="brief-footnote"><Activity size={13}/> Summary from your saved business records</div></section>;
}
