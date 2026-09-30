import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarClock, CircleDollarSign, Send, Sparkles, UsersRound } from 'lucide-react';
import type { Appointment, Customer, Invoice, NavKey } from '../types';
import './daily-brief.css';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function DailyBriefPage({ customers, appointments, invoices, onNavigate, onBookAppointment, apiBase, authToken }: {
  customers: Customer[];
  appointments: Appointment[];
  invoices: Invoice[];
  onNavigate: (section: NavKey) => void;
  onBookAppointment: (customerId: string) => void;
  apiBase: string;
  authToken?: string;
}) {
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const { overdueInvoices, upcomingPending, followUps, todayAppointments, overdueTotal } = useMemo(() => {
    const today = new Date();
    const todayStart = dayStart(today);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const activeAppointments = appointments.filter(item => item.status !== 'Cancelled' && item.status !== 'No show');
    const overdue = invoices.filter(invoice => invoice.dueDate < todayKey && invoice.status !== 'Paid' && invoice.amount > (invoice.paidAmount ?? 0)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const pending = appointments.filter(item => item.status === 'Pending' && new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const staleCustomers = customers.flatMap(customer => {
      const latestVisit = appointments.filter(item => item.customerId === customer.id && item.status === 'Completed').sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
      if (!latestVisit) return [];
      const daysSince = Math.floor((todayStart - dayStart(new Date(latestVisit.startsAt))) / 86_400_000);
      const hasUpcomingBooking = activeAppointments.some(item => item.customerId === customer.id && new Date(item.startsAt).getTime() >= Date.now());
      return daysSince >= 30 && !hasUpcomingBooking ? [{ customer, daysSince }] : [];
    }).sort((a, b) => b.daysSince - a.daysSince);
    const todayList = activeAppointments.filter(item => dayStart(new Date(item.startsAt)) === todayStart).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { overdueInvoices: overdue, upcomingPending: pending, followUps: staleCustomers, todayAppointments: todayList, overdueTotal: overdue.reduce((sum, invoice) => sum + invoice.amount - (invoice.paidAmount ?? 0), 0) };
  }, [customers, appointments, invoices]);

  const hasActions = overdueInvoices.length > 0 || upcomingPending.length > 0 || followUps.length > 0;
  async function askBizPilot(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (!text || asking) return;
    setQuestion(''); setAskError(''); setAsking(true);
    const nextChat = [...chat, { role: 'user' as const, content: text }];
    setChat(nextChat);
    try {
      const response = await fetch(`${apiBase}/api/ai/ask`, {
        method: 'POST',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chat.slice(-6) }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not get an answer. Please try again.');
      setChat(current => [...current, { role: 'assistant', content: result.answer ?? 'I could not create an answer just now.' }]);
    } catch (error) {
      setChat(current => current.slice(0, -1));
      setQuestion(text);
      setAskError(error instanceof Error ? error.message : 'Could not get an answer. Please try again.');
    } finally { setAsking(false); }
  }
  return <>
    <section className="daily-brief-intro"><span className="daily-brief-mark"><Sparkles size={18}/></span><div><strong>{hasActions ? 'Here are a few things to review.' : 'You’re all caught up.'}</strong><p>{todayAppointments.length} appointment{todayAppointments.length === 1 ? '' : 's'} on today’s schedule. {hasActions ? 'These suggestions come from the records saved in your workspace.' : 'We’ll highlight overdue invoices, pending bookings, and customers who may be due for a return visit.'}</p></div></section>
    <div className="daily-brief-grid">
      <section className="panel daily-brief-card"><div className="daily-brief-card-heading"><span className="brief-action-icon red"><CircleDollarSign size={16}/></span><div><strong>Overdue invoices</strong><small>{overdueInvoices.length ? `${inr.format(overdueTotal)} outstanding` : 'No unpaid invoices past their due date'}</small></div><button className="daily-brief-link" onClick={() => onNavigate('Billing')}>Billing <ArrowRight size={14}/></button></div>{overdueInvoices.length ? overdueInvoices.slice(0, 5).map(invoice => <button className="daily-brief-row" key={invoice.id} onClick={() => onNavigate('Billing')}><span><strong>{invoice.customerName}</strong><small>{invoice.invoiceNumber} · due {new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</small></span><strong>{inr.format(invoice.amount - (invoice.paidAmount ?? 0))}</strong></button>) : <p className="daily-brief-empty">New unpaid invoices will appear here after their due date.</p>}</section>
      <section className="panel daily-brief-card"><div className="daily-brief-card-heading"><span className="brief-action-icon amber"><CalendarClock size={16}/></span><div><strong>Bookings to confirm</strong><small>{upcomingPending.length ? `${upcomingPending.length} upcoming appointment${upcomingPending.length === 1 ? '' : 's'} marked pending` : 'No upcoming appointments need confirmation'}</small></div><button className="daily-brief-link" onClick={() => onNavigate('Appointments')}>Schedule <ArrowRight size={14}/></button></div>{upcomingPending.length ? upcomingPending.slice(0, 5).map(item => <button className="daily-brief-row" key={item.id} onClick={() => onNavigate('Appointments')}><span><strong>{item.customer}</strong><small>{item.service} · {new Date(item.startsAt).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span><span className="daily-brief-status">Pending</span></button>) : <p className="daily-brief-empty">Pending appointments will appear here.</p>}</section>
      <section className="panel daily-brief-card"><div className="daily-brief-card-heading"><span className="brief-action-icon green"><UsersRound size={16}/></span><div><strong>Customers due for a return visit</strong><small>{followUps.length ? `${followUps.length} customer${followUps.length === 1 ? '' : 's'} with no visit in 30+ days` : 'No follow-ups suggested right now'}</small></div><button className="daily-brief-link" onClick={() => onNavigate('Customers')}>Customers <ArrowRight size={14}/></button></div>{followUps.length ? followUps.slice(0, 5).map(({ customer, daysSince }) => <div className="daily-brief-row" key={customer.id}><span><strong>{customer.name}</strong><small>Last completed visit {daysSince} days ago</small></span><button className="daily-brief-book" onClick={() => onBookAppointment(customer.id)}>Book <ArrowRight size={13}/></button></div>) : <p className="daily-brief-empty">Customers with a completed visit 30 or more days ago and no future booking will appear here.</p>}</section>
    </div>
    <section className="panel bizpilot-chat"><div className="bizpilot-chat-heading"><span className="daily-brief-mark"><Sparkles size={17}/></span><div><h2>Ask BizPilot</h2><p>Ask about sales, bookings, expenses, or what to focus on next.</p></div></div>
      {chat.length > 0 ? <div className="bizpilot-chat-messages" aria-live="polite">{chat.map((item, index) => <div className={`bizpilot-chat-message ${item.role}`} key={`${item.role}-${index}`}><strong>{item.role === 'user' ? 'You' : 'BizPilot'}</strong><p>{item.content}</p></div>)}{asking && <div className="bizpilot-chat-message assistant"><strong>BizPilot</strong><p>Thinking…</p></div>}</div> : <div className="bizpilot-suggestions"><button type="button" onClick={() => void askBizPilot(undefined, 'How did payments compare with expenses over the last 30 days?')}>Compare payments and expenses</button><button type="button" onClick={() => void askBizPilot(undefined, 'What should I focus on today?')}>What should I focus on?</button><button type="button" onClick={() => void askBizPilot(undefined, 'Summarize my current outstanding invoices and pending bookings.')}>Summarize outstanding work</button></div>}
      <form className="bizpilot-chat-form" onSubmit={event => void askBizPilot(event)}><input value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} placeholder="Ask a question about your business…" aria-label="Ask BizPilot a question" disabled={asking}/><button className="primary-button" type="submit" disabled={!question.trim() || asking}><Send size={15}/><span>{asking ? 'Thinking…' : 'Ask'}</span></button></form>
      {askError && <p className="bizpilot-chat-error" role="alert">{askError}</p>}
      <p className="bizpilot-chat-privacy">Your question is sent to OpenAI. BizPilot sends business totals only; avoid entering customer names or personal details.</p>
    </section>
    <p className="daily-brief-note"><Sparkles size={13}/> The Daily Brief above is calculated from your saved records. Ask BizPilot uses AI for follow-up questions.</p>
  </>;
}
