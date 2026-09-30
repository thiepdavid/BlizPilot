import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, ChevronDown, Clock3, LayoutDashboard, LogOut, Plus, Search } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { AppointmentList } from './components/AppointmentList';
import { AppointmentPage } from './components/AppointmentPage';
import { InvoicePage } from './components/InvoicePage';
import { PaymentPage } from './components/PaymentPage';
import { ServicePage } from './components/ServicePage';
import { ExpensePage } from './components/ExpensePage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { MarketingPage } from './components/MarketingPage';
import { CustomerList } from './components/CustomerList';
import { BriefCard } from './components/BriefCard';
import { SectionPage } from './components/SectionPage';
import { SalesOverview } from './components/SalesOverview';
import { AuthPage } from './components/AuthPage';
import { ActionMenu } from './components/ActionMenu';
import { appointments as sampleAppointments, customers as sampleCustomers } from './data/mockData';
import type { Appointment, Invoice, NavKey, Payment, Service, Expense, Campaign } from './types';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import './styles.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export default function App() {
  const [active, setActive] = useState<NavKey>('Home');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [bookingCustomerId, setBookingCustomerId] = useState<string | null>(null);
  const [invoiceCustomerId, setInvoiceCustomerId] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileOverrides, setProfileOverrides] = useState<{ businessName: string; fullName: string } | null>(() => { try { return JSON.parse(window.localStorage.getItem('bizpilot-profile') ?? 'null'); } catch { return null; } });
  const [authReady, setAuthReady] = useState(!supabase);
  const [backendDataMode, setBackendDataMode] = useState<'local' | 'supabase' | null>(null);
  const [customers, setCustomers] = useState(sampleCustomers);
  const [appointments, setAppointments] = useState(sampleAppointments);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const apiBase = import.meta.env.VITE_API_URL ?? '';
  const decorateCustomer = (customer: typeof sampleCustomers[number]) => ({ ...customer, initials: customer.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), tone: customer.tone || ['peach', 'blue', 'lilac', 'mint'][customer.name.length % 4] });
  const decorateAppointment = (item: Appointment & { customerName?: string }) => {
    const name = item.customerName ?? item.customer;
    return { ...item, customer: name, initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), tone: ['peach', 'blue', 'lilac', 'mint'][name.length % 4] };
  };

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => undefined).finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/api/health`).then(async response => { setApiOnline(response.ok); const data = await response.json(); setBackendDataMode(data.dataMode ?? 'local'); }).catch(() => { setApiOnline(false); setBackendDataMode(null); });
  }, [apiBase]);

  const authHeaders: Record<string, string> = session ? { Authorization: `Bearer ${session.access_token}` } : {};
  const metadata = session?.user.user_metadata ?? {};
  const accountName = (!supabase && profileOverrides?.fullName) || (typeof metadata.full_name === 'string' && metadata.full_name.trim()) || session?.user.email?.split('@')[0] || 'Rahul Sharma';
  const businessName = (!supabase && profileOverrides?.businessName) || (typeof metadata.business_name === 'string' && metadata.business_name.trim()) || (session ? 'My Business' : 'Studio Saanvi');
  const firstName = accountName.split(/\s+/)[0] || 'there';
  const businessInitial = businessName.charAt(0).toUpperCase() || 'B';
  const accountInitial = accountName.charAt(0).toUpperCase() || 'U';
  useEffect(() => {
    if (supabase && (!session || backendDataMode !== 'supabase')) return;
    fetch(`${apiBase}/api/customers`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: typeof sampleCustomers) => setCustomers(rows.map(decorateCustomer))).catch(() => undefined);
    fetch(`${apiBase}/api/appointments`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Array<Appointment & { customerName?: string }>) => setAppointments(rows.map(decorateAppointment))).catch(() => undefined);
    fetch(`${apiBase}/api/invoices`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Invoice[]) => setInvoices(rows)).catch(() => undefined);
    fetch(`${apiBase}/api/payments`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Payment[]) => setPayments(rows)).catch(() => undefined);
    fetch(`${apiBase}/api/services`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Service[]) => setServices(rows)).catch(() => undefined);
    fetch(`${apiBase}/api/expenses`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Expense[]) => setExpenses(rows)).catch(() => undefined);
    fetch(`${apiBase}/api/campaigns`, { headers: authHeaders }).then(response => response.ok ? response.json() : Promise.reject()).then((rows: Campaign[]) => setCampaigns(rows)).catch(() => undefined);
  }, [session?.access_token, backendDataMode]);

  async function saveBusinessProfile(input: { businessName: string; fullName: string }) {
    if (supabase) {
      const response = await fetch(`${apiBase}/api/business-profile`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save your business profile.');
      const { error } = await supabase.auth.updateUser({ data: { business_name: input.businessName, full_name: input.fullName } });
      if (error) throw new Error(error.message);
    } else {
      window.localStorage.setItem('bizpilot-profile', JSON.stringify(input));
    }
    setProfileOverrides(input);
  }

  async function addCustomer(input: { name: string; email: string; phone: string }) {
    const response = await fetch(`${apiBase}/api/customers`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this customer.');
    setCustomers(current => [decorateCustomer(result), ...current]);
  }

  async function rescheduleAppointment(id: string, startsAt: string, durationMinutes: number) {
    const response = await fetch(`${apiBase}/api/appointments/${encodeURIComponent(id)}/schedule`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt, durationMinutes }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not reschedule this appointment.');
    setAppointments(current => current.map(item => item.id === id ? decorateAppointment(result) : item).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }

  async function updateAppointmentStatus(id: string, status: Appointment['status']) {
    const response = await fetch(`${apiBase}/api/appointments/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not update the appointment.');
    setAppointments(current => current.map(item => item.id === id ? decorateAppointment(result) : item));
  }

  async function updateCustomer(id: string, input: { name: string; email: string; phone: string }) {
    const response = await fetch(`${apiBase}/api/customers/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not update this customer.');
    setCustomers(current => current.map(customer => customer.id === id ? decorateCustomer(result) : customer));
  }

  async function addAppointment(input: { customerId: string; service: string; startsAt: string; durationMinutes: number }) {
    const response = await fetch(`${apiBase}/api/appointments`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this appointment.');
    setAppointments(current => [...current, decorateAppointment(result)].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }

  async function getPublicBookingPage() {
    const response = await fetch(`${apiBase}/api/public-booking/page`, { method: 'POST', headers: authHeaders });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not create your booking page.');
    return String(result.slug);
  }

  async function getPublicBookingHours() {
    const response = await fetch(`${apiBase}/api/public-booking/hours`, { headers: authHeaders });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load opening hours.');
    return result as { timezone: string; hours: Record<string, { closed?: boolean; open?: string; close?: string }> };
  }

  async function savePublicBookingHours(hours: Record<string, { closed: boolean; open: string; close: string }>) {
    const response = await fetch(`${apiBase}/api/public-booking/hours`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ hours }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save opening hours.');
  }

  async function addInvoice(input: { customerId: string; description: string; amount: number; gstRate: number; dueDate: string }) {
    const response = await fetch(`${apiBase}/api/invoices`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this invoice.');
    setInvoices(current => [result as Invoice, ...current]);
  }

  async function addCampaign(input: { name: string; channel: string; message: string }) {
    const response = await fetch(`${apiBase}/api/campaigns`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this draft.');
    setCampaigns(current => [result as Campaign, ...current]);
  }

  async function deleteCampaign(id: string) {
    const response = await fetch(`${apiBase}/api/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? 'Could not delete this draft.'); }
    setCampaigns(current => current.filter(campaign => campaign.id !== id));
  }

  async function updateCampaign(id: string, input: { name: string; channel: string; message: string }) {
    const response = await fetch(`${apiBase}/api/campaigns/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not update this draft.');
    setCampaigns(current => current.map(campaign => campaign.id === id ? result as Campaign : campaign));
  }

  async function addExpense(input: { description: string; category: string; amount: number; spentAt: string }) {
    const response = await fetch(`${apiBase}/api/expenses`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this expense.');
    setExpenses(current => [result as Expense, ...current].sort((a, b) => b.spentAt.localeCompare(a.spentAt)));
  }

  async function addService(input: { name: string; description: string; durationMinutes: number; price: number }) {
    const response = await fetch(`${apiBase}/api/services`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not save this service.');
    setServices(current => [...current, result as Service].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function updateService(id: string, input: { name: string; description: string; durationMinutes: number; price: number }) {
    const response = await fetch(`${apiBase}/api/services/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not update this service.');
    setServices(current => current.map(service => service.id === id ? result as Service : service).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function removeService(id: string) {
    const response = await fetch(`${apiBase}/api/services/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? 'Could not remove this service.'); }
    setServices(current => current.filter(service => service.id !== id));
  }

  async function addPayment(input: { invoiceId: string; amount: number; method: Payment['method'] }) {
    const response = await fetch(`${apiBase}/api/payments`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not record this payment.');
    setPayments(current => [result as Payment, ...current]);
    setInvoices(current => current.map(invoice => invoice.id === input.invoiceId ? {
      ...invoice,
      paidAmount: Math.round(((invoice.paidAmount ?? 0) + input.amount) * 100) / 100,
      status: (invoice.paidAmount ?? 0) + input.amount >= invoice.amount ? 'Paid' : 'Partially paid',
    } : invoice));
  }

  async function createPaymentLink(invoiceId: string) {
    const response = await fetch(`${apiBase}/api/payments/link`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not create this payment link.');
    return result as { url: string; amount: number };
  }

  const today = startOfDay(new Date());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const salesYesterday = payments.filter(payment => startOfDay(new Date(payment.receivedAt)).getTime() === yesterday.getTime()).reduce((sum, payment) => sum + payment.amount, 0);
  const todaysAppointments = appointments.filter(item => startOfDay(new Date(item.startsAt)).getTime() === today.getTime() && item.status !== 'Cancelled' && item.status !== 'No show');
  const customersWithActivity = useMemo(() => customers.map(customer => {
    const completed = appointments.filter(appointment => appointment.customerId === customer.id && appointment.status === 'Completed');
    const latestVisit = completed.reduce<string | null>((latest, appointment) => !latest || appointment.startsAt > latest ? appointment.startsAt : latest, null);
    if (!latestVisit) return customer;
    const visitDate = new Date(latestVisit); const todayDate = startOfDay(new Date()).getTime(); const visitDay = startOfDay(visitDate).getTime();
    const lastVisit = visitDay === todayDate ? 'Today' : visitDay === todayDate - 86_400_000 ? 'Yesterday' : new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(visitDate);
    return { ...customer, visits: Math.max(customer.visits, completed.length), lastVisit };
  }), [customers, appointments]);
  const openInvoices = invoices.filter(invoice => invoice.amount - (invoice.paidAmount ?? 0) > 0);
  const totalOutstanding = openInvoices.reduce((sum, invoice) => sum + invoice.amount - (invoice.paidAmount ?? 0), 0);
  const returningCustomers = customers.length ? Math.round(customersWithActivity.filter(customer => customer.visits > 1).length / customers.length * 100) : 0;
  const thisMonthExpenses = expenses.filter(expense => { const date = new Date(`${expense.spentAt}T00:00:00`); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
  const expenseTotalThisMonth = thisMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paymentsThisMonth = payments.filter(payment => { const date = new Date(payment.receivedAt); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
  const paidThisMonth = paymentsThisMonth.reduce((sum, payment) => sum + payment.amount, 0);
  const cashAfterExpenses = paidThisMonth - expenseTotalThisMonth;
  const metrics = [
    { label: 'Sales yesterday', value: currency.format(salesYesterday), change: 'Recorded payments', direction: 'flat' as const, icon: 'sales' as const },
    { label: 'Appointments today', value: String(todaysAppointments.length), change: 'On your schedule', direction: 'flat' as const, icon: 'appointments' as const },
    { label: 'Payments pending', value: currency.format(totalOutstanding), change: `${openInvoices.length} open invoices`, direction: openInvoices.length ? 'down' as const : 'flat' as const, icon: 'pending' as const },
    { label: 'Returning customers', value: `${returningCustomers}%`, change: `${customers.length} customers total`, direction: 'flat' as const, icon: 'customers' as const },
    { label: 'Expenses this month', value: currency.format(expenseTotalThisMonth), change: `${thisMonthExpenses.length} recorded`, direction: 'flat' as const, icon: 'expenses' as const },
  ];
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
  const currentWeekPayments = useMemo(() => payments.filter(payment => {
    const age = today.getTime() - startOfDay(new Date(payment.receivedAt)).getTime();
    return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
  }), [payments, today.getTime()]);
  const globalSearchResults = useMemo(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...customers.map(item => ({ section: 'Customers' as const, title: item.name, detail: item.email || item.phone || 'Customer', search: `${item.name} ${item.email} ${item.phone ?? ''}` })),
      ...appointments.map(item => ({ section: 'Appointments' as const, title: item.customer, detail: `${item.service} · ${new Date(item.startsAt).toLocaleDateString('en-IN')}`, search: `${item.customer} ${item.service} ${item.status}` })),
      ...invoices.map(item => ({ section: 'Billing' as const, title: item.invoiceNumber, detail: `${item.customerName} · ${currency.format(item.amount)}`, search: `${item.invoiceNumber} ${item.customerName} ${item.description} ${item.status}` })),
      ...payments.map(item => ({ section: 'Payments' as const, title: item.customerName, detail: `${item.invoiceNumber} · ${currency.format(item.amount)}`, search: `${item.customerName} ${item.invoiceNumber} ${item.method}` })),
      ...services.map(item => ({ section: 'Services' as const, title: item.name, detail: `${item.durationMinutes} min · ${currency.format(item.price)}`, search: `${item.name} ${item.description}` })),
      ...expenses.map(item => ({ section: 'Expenses' as const, title: item.description, detail: `${item.category} · ${currency.format(item.amount)}`, search: `${item.description} ${item.category}` })),
    ].filter(item => item.search.toLowerCase().includes(query)).slice(0, 8);
  }, [globalSearchQuery, customers, appointments, invoices, payments, services, expenses]);
  const notifications = useMemo(() => {
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const overdueInvoices = invoices.filter(invoice => invoice.status !== 'Paid' && invoice.dueDate < todayIso);
    const pendingAppointments = appointments.filter(appointment => appointment.status === 'Pending' && new Date(appointment.startsAt).getTime() >= Date.now());
    return [
      ...overdueInvoices.map(invoice => ({ section: 'Payments' as const, title: `Payment overdue · ${invoice.invoiceNumber}`, detail: `${invoice.customerName} · ${currency.format(invoice.amount - invoice.paidAmount)} outstanding` })),
      ...pendingAppointments.map(appointment => ({ section: 'Appointments' as const, title: `Confirm appointment · ${appointment.customer}`, detail: `${appointment.service} · ${new Date(appointment.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` })),
    ].slice(0, 8);
  }, [invoices, appointments, today.getTime()]);

  if (supabase && !authReady) return <main className="auth-screen"><section className="auth-card">Loading your account…</section></main>;
  if (supabase && !session) return <AuthPage client={supabase}/>;
  if ((supabase && backendDataMode !== 'supabase') || (!supabase && backendDataMode === 'supabase')) return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">BP</div><strong>Supabase setup needed</strong></div><h1>Finish connecting BizPilot</h1><p className="auth-intro">The frontend and API must both be configured for the same Supabase project. Check both environment files, restart the dev server, and confirm the database schema was applied.</p><button className="auth-submit" onClick={() => void supabase?.auth.signOut()}>Sign out</button></section></main>;

  return <div className="app-shell"><Sidebar active={active} onNavigate={setActive} businessName={businessName} accountName={accountName} accountEmail={session?.user.email ?? undefined} businessInitial={businessInitial} accountInitial={accountInitial} onSignOut={supabase ? () => { void supabase?.auth.signOut(); } : undefined}/><main className="main-area"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>{active}</strong></div><div className="topbar-actions"><span className={`api-status ${apiOnline ? 'online' : apiOnline === false ? 'offline' : ''}`} title="Local API health"><i/>{apiOnline ? 'API connected' : apiOnline === false ? 'API unavailable' : 'Checking API'}</span><button aria-label="Search records" className="icon-button top-search" aria-expanded={globalSearchOpen} onClick={() => { setGlobalSearchOpen(open => !open); setGlobalSearchQuery(''); }}><Search size={18}/></button><div className="notifications-wrap"><button aria-label="Notifications" className="icon-button notification-button" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(open => !open)}><Bell size={18}/>{notifications.length > 0 && <i/>}</button>{notificationsOpen && <section className="notifications-panel" aria-label="Notifications"><div className="notifications-heading"><strong>Needs your attention</strong><span>{notifications.length}</span></div>{notifications.length ? <div className="notifications-list">{notifications.map((item, index) => <button key={`${item.title}-${index}`} onClick={() => { setActive(item.section); setNotificationsOpen(false); }}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div> : <p className="notifications-empty">You’re all caught up. No overdue payments or pending appointments.</p>}</section>}</div>{supabase && <button aria-label="Sign out" title="Sign out" className="icon-button" onClick={() => void supabase?.auth.signOut()}><LogOut size={17}/></button>}<span className="top-divider"/><ActionMenu label="Open business menu" heading={businessName} description="Current business workspace" triggerClassName="top-business" className="top-business-menu" items={[{ label: 'Business profile', description: 'Edit business and owner details', icon: <Building2 size={16}/>, onSelect: () => setActive('Settings') }, { label: 'Go to dashboard', description: 'View today’s business summary', icon: <LayoutDashboard size={16}/>, onSelect: () => setActive('Home') }]} trigger={<><div className="shop-avatar small">{businessInitial}</div><span>{businessName}</span><ChevronDown size={15}/></>}/></div>{globalSearchOpen && <section className="global-search-panel" aria-label="Search your business records"><div className="global-search-input"><Search size={16}/><input autoFocus value={globalSearchQuery} onChange={event => setGlobalSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setGlobalSearchOpen(false); }} placeholder="Search customers, appointments, invoices…"/><button aria-label="Close search" onClick={() => setGlobalSearchOpen(false)}>×</button></div>{globalSearchQuery.trim() ? globalSearchResults.length ? <div className="global-search-results">{globalSearchResults.map((item, index) => <button key={`${item.section}-${item.title}-${index}`} onClick={() => { setActive(item.section); setGlobalSearchOpen(false); }}><span><strong>{item.title}</strong><small>{item.detail}</small></span><em>{item.section}</em></button>)}</div> : <p className="global-search-empty">No matching records found.</p> : <p className="global-search-empty">Search your customers, appointments, invoices, payments, services, and expenses.</p>}</section>}</header><div className="content-area">
    {active === 'Settings' ? <SettingsPage businessName={businessName} fullName={accountName} onSave={saveBusinessProfile}/> : active === 'Home' ? <><div className="page-heading"><div><div className="eyebrow">{dateLabel} <span>·</span> YOUR WORKSPACE</div><h1>Good morning, {firstName} <span className="wave">✦</span></h1><p>Here’s what’s happening with your business today.</p></div><div className="quick-actions-wrap"><button className="primary-button" aria-haspopup="menu" aria-expanded={quickActionsOpen} onClick={() => setQuickActionsOpen(open => !open)}><Plus size={17}/> Quick action <ChevronDown size={15}/></button>{quickActionsOpen && <div className="quick-actions-menu" role="menu" aria-label="Quick actions">{([{ label: 'Customers', detail: 'Add or find a customer', icon: '♙' }, { label: 'Appointments', detail: 'Book a time slot', icon: '◷' }, { label: 'Billing', detail: 'Create an invoice', icon: '₹' }, { label: 'Payments', detail: 'Record a payment', icon: '↗' }, { label: 'Expenses', detail: 'Log a business expense', icon: '−' }] as const).map(item => <button key={item.label} role="menuitem" onClick={() => { setActive(item.label); setQuickActionsOpen(false); }}><span className="quick-actions-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}</div>}</div></div><div className="metrics-grid">{metrics.map(metric => <MetricCard key={metric.label} metric={metric}/>)}</div><div className="dashboard-grid"><div className="dashboard-main"><AppointmentList appointments={todaysAppointments} onViewAll={() => setActive('Appointments')}/><CustomerList customers={customersWithActivity} onViewAll={() => setActive('Customers')}/></div><BriefCard customers={customersWithActivity} appointments={todaysAppointments} invoices={openInvoices} onNavigate={setActive}/></div><SalesOverview payments={currentWeekPayments}/><section className="financial-snapshot" aria-label="This month’s cash summary"><div className="financial-snapshot-heading"><div><strong>This month’s cash</strong><span>Based on payments and expenses you’ve recorded</span></div><button className="text-button" onClick={() => setActive('Expenses')}>View expenses <span>↗</span></button></div><div className="financial-snapshot-grid"><div><span>Payments received</span><strong>{currency.format(paidThisMonth)}</strong></div><div><span>Expenses recorded</span><strong>{currency.format(expenseTotalThisMonth)}</strong></div><div className={cashAfterExpenses < 0 ? 'negative' : 'positive'}><span>Remaining after expenses</span><strong>{currency.format(cashAfterExpenses)}</strong></div></div></section><footer className="dashboard-footer"><span><Clock3 size={13}/> Based on your saved records</span><span>BizPilot preview <span className="footer-dot">·</span> Your business, running smoothly</span></footer></> : active === 'Services' ? <ServicePage services={services} onCreate={addService} onUpdate={updateService} onRemove={removeService}/> : active === 'Appointments' ? <AppointmentPage customers={customersWithActivity} appointments={appointments} services={services} onCreate={addAppointment} onStatusChange={updateAppointmentStatus} onReschedule={rescheduleAppointment} onGetBookingPage={getPublicBookingPage} onGetBookingHours={getPublicBookingHours} onSaveBookingHours={savePublicBookingHours} prefillCustomerId={bookingCustomerId} onPrefillHandled={() => setBookingCustomerId(null)}/> : active === 'Billing' ? <InvoicePage businessName={businessName} customers={customersWithActivity} invoices={invoices} services={services} onCreate={addInvoice} prefillCustomerId={invoiceCustomerId} onPrefillHandled={() => setInvoiceCustomerId(null)}/> : active === 'Marketing' ? <MarketingPage campaigns={campaigns} onCreate={addCampaign} onUpdate={updateCampaign} onDelete={deleteCampaign}/> : active === 'Reports' ? <ReportsPage payments={payments} expenses={expenses}/> : active === 'Expenses' ? <ExpensePage expenses={expenses} onCreate={addExpense}/> : active === 'Payments' ? <PaymentPage businessName={businessName} invoices={invoices} payments={payments} onCreate={addPayment} onCreatePaymentLink={createPaymentLink} prefillInvoiceId={paymentInvoiceId} onPrefillHandled={() => setPaymentInvoiceId(null)}/> : <SectionPage section={active} customers={customersWithActivity} appointments={appointments} invoices={invoices} payments={payments} onAddCustomer={addCustomer} onUpdateCustomer={updateCustomer} onBookAppointment={customerId => { setBookingCustomerId(customerId); setActive('Appointments'); }} onCreateInvoice={customerId => { setInvoiceCustomerId(customerId); setActive('Billing'); }} onRecordPayment={invoiceId => { setPaymentInvoiceId(invoiceId); setActive('Payments'); }} onNavigate={setActive}/>}
  </div></main></div>;
}
