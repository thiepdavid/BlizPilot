import { formatCurrency } from '../lib/currency';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Clock3, Copy, Link2, MessageCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Appointment, Customer, Service } from '../types';
import './appointments.css';

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
function asLocalDateTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
type AppointmentInput = { customerId: string; service: string; startsAt: string; durationMinutes: number };
type BusinessHours = Record<string, { closed: boolean; open: string; close: string }>;
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timezoneOptions = (() => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  return intl.supportedValuesOf?.('timeZone') ?? ['America/Los_Angeles', 'America/New_York', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'Pacific/Auckland', 'UTC'];
})();
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const defaultHours: BusinessHours = Object.fromEntries(weekdayNames.map((_, day) => [String(day), { closed: day === 0, open: '09:00', close: '18:00' }]));
export function AppointmentPage({ businessName, customers, appointments, services, onCreate, onStatusChange, onReschedule, onDelete, onGetBookingPage, onGetBookingHours, onSaveBookingHours, onSaveBookingTimezone, onGetClosedDates, onSaveClosedDates, prefillCustomerId, onPrefillHandled }: {
  businessName: string;
  customers: Customer[];
  appointments: Appointment[];
  services: Service[];
  onCreate: (input: AppointmentInput) => Promise<void>;
  onStatusChange: (id: string, status: Appointment['status']) => Promise<void>;
  onReschedule: (id: string, startsAt: string, durationMinutes: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetBookingPage: (timezone: string) => Promise<string>;
  onGetBookingHours: () => Promise<{ timezone: string; hours: Record<string, { closed?: boolean; open?: string; close?: string }> }>;
  onSaveBookingHours: (hours: BusinessHours) => Promise<void>;
  onSaveBookingTimezone: (timezone: string) => Promise<void>;
  onGetClosedDates: () => Promise<string[]>;
  onSaveClosedDates: (dates: string[]) => Promise<void>;
  prefillCustomerId?: string | null;
  onPrefillHandled: () => void;
}) {
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [statusFilter, setStatusFilter] = useState<Appointment['status'] | 'All statuses'>('All statuses');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [updatingId, setUpdatingId] = useState('');
  const [statusError, setStatusError] = useState('');
  const [rescheduleItem, setRescheduleItem] = useState<Appointment | null>(null);
  const [scheduleError, setScheduleError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('');
  const [bookingPageError, setBookingPageError] = useState('');
  const [bookingPageSaving, setBookingPageSaving] = useState(false);
  const [bookingUrlCopied, setBookingUrlCopied] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hours, setHours] = useState<BusinessHours>(defaultHours);
  const [hoursTimezone, setHoursTimezone] = useState(browserTimezone);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursError, setHoursError] = useState('');
  const [hoursSaved, setHoursSaved] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [closedDateDraft, setClosedDateDraft] = useState('');
  const [closuresSaving, setClosuresSaving] = useState(false);
  const [closuresError, setClosuresError] = useState('');
  const [closuresSaved, setClosuresSaved] = useState(false);
  useEffect(() => { if (prefillCustomerId) { setSelectedCustomerId(prefillCustomerId); setFormOpen(true); onPrefillHandled(); } }, [prefillCustomerId, onPrefillHandled]);
  const sorted = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return appointments.filter(item => {
      const startsAt = new Date(item.startsAt);
      const matchesText = `${item.customer} ${item.service}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'All statuses' || item.status === statusFilter;
      const matchesDate = dateFilter === 'all' || (dateFilter === 'today' ? startsAt >= today && startsAt < tomorrow : dateFilter === 'upcoming' ? startsAt >= tomorrow : startsAt < today);
      return matchesText && matchesStatus && matchesDate;
    }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [appointments, query, dateFilter, statusFilter]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const selectedService = services.find(service => service.id === String(data.get('service') ?? ''));
      await onCreate({ customerId: String(data.get('customerId') ?? ''), service: selectedService?.name ?? String(data.get('service') ?? '').trim(), startsAt: new Date(String(data.get('startsAt'))).toISOString(), durationMinutes: Number(data.get('durationMinutes')) });
      setFormOpen(false); setSelectedServiceId(''); setSelectedCustomerId(''); setDurationMinutes(45);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this appointment.'); }
    finally { setSaving(false); }
  }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!rescheduleItem) return;
    setSaving(true); setScheduleError('');
    try {
      await onReschedule(rescheduleItem.id, new Date(String(data.get('startsAt'))).toISOString(), Number(data.get('durationMinutes')));
      setRescheduleItem(null);
    } catch (reason) { setScheduleError(reason instanceof Error ? reason.message : 'Could not reschedule this appointment.'); }
    finally { setSaving(false); }
  }
  async function removeAppointment() {
    if (!rescheduleItem) return;
    setDeleting(true); setDeleteError('');
    try { await onDelete(rescheduleItem.id); setRescheduleItem(null); setDeleteConfirmOpen(false); }
    catch (reason) { setDeleteError(reason instanceof Error ? reason.message : 'Could not delete this appointment.'); }
    finally { setDeleting(false); }
  }

  async function changeStatus(item: Appointment, status: Appointment['status']) {
    setUpdatingId(item.id); setStatusError('');
    try { await onStatusChange(item.id, status); }
    catch (reason) { setStatusError(reason instanceof Error ? reason.message : 'Could not update the appointment.'); }
    finally { setUpdatingId(''); }
  }

  function whatsappUrl(item: Appointment) {
    const rawPhone = customers.find(customer => customer.id === item.customerId)?.phone?.trim() ?? '';
    const internationalPhone = rawPhone.replace(/\D/g, '');
    // Require an international dialing code rather than guessing the country.
    if (!rawPhone.startsWith('+') || internationalPhone.length < 10 || internationalPhone.length > 15) return '';
    const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(item.startsAt));
    const greeting = item.status === 'Confirmed'
      ? `Your appointment for ${item.service} is confirmed for ${when}.`
      : item.status === 'Pending'
        ? `We received your request for ${item.service} on ${when}. We’ll contact you to confirm.`
        : item.status === 'Cancelled'
          ? `Your appointment for ${item.service} on ${when} has been cancelled. Please contact us if you need to rebook.`
          : item.status === 'Completed'
            ? `Thank you for visiting us for ${item.service}. We hope to see you again soon!`
            : `We missed you for your ${item.service} appointment on ${when}. Contact us if you’d like to book another time.`;
    const message = `Hi ${item.customer}, ${greeting} — ${businessName}`;
    return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
  }

  async function shareBookingPage() {
    setBookingPageSaving(true); setBookingPageError('');
    try {
      const businessTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const slug = await onGetBookingPage(businessTimezone);
      const url = `${window.location.origin}/book/${encodeURIComponent(slug)}`;
      setBookingUrl(url);
      try { await navigator.clipboard.writeText(url); setBookingUrlCopied(true); window.setTimeout(() => setBookingUrlCopied(false), 2200); }
      catch { setBookingUrlCopied(false); }
    } catch (reason) { setBookingPageError(reason instanceof Error ? reason.message : 'Could not create your booking page.'); }
    finally { setBookingPageSaving(false); }
  }

  async function openHours() {
    setHoursOpen(true); setHoursLoading(true); setHoursError(''); setHoursSaved(false);
    try {
      const [result, savedClosedDates] = await Promise.all([onGetBookingHours(), onGetClosedDates()]);
      setHoursTimezone(result.timezone || browserTimezone());
      setHours(Object.fromEntries(weekdayNames.map((_, day) => {
        const saved = result.hours[String(day)];
        return [String(day), { closed: saved?.closed === true, open: saved?.open ?? '09:00', close: saved?.close ?? '18:00' }];
      })));
      setClosedDates(savedClosedDates.sort());
      setClosedDateDraft(''); setClosuresError(''); setClosuresSaved(false);
    } catch (reason) { setHoursError(reason instanceof Error ? reason.message : 'Could not load opening hours.'); }
    finally { setHoursLoading(false); }
  }

  async function submitHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setHoursSaving(true); setHoursError(''); setHoursSaved(false);
    try { await onSaveBookingTimezone(hoursTimezone); await onSaveBookingHours(hours); setHoursSaved(true); }
    catch (reason) { setHoursError(reason instanceof Error ? reason.message : 'Could not save opening hours.'); }
    finally { setHoursSaving(false); }
  }

  function addClosedDate() {
    if (!closedDateDraft || closedDates.includes(closedDateDraft)) return;
    setClosedDates(current => [...current, closedDateDraft].sort());
    setClosedDateDraft(''); setClosuresSaved(false); setClosuresError('');
  }

  async function saveClosures() {
    setClosuresSaving(true); setClosuresError(''); setClosuresSaved(false);
    try { await onSaveClosedDates(closedDates); setClosuresSaved(true); }
    catch (reason) { setClosuresError(reason instanceof Error ? reason.message : 'Could not save closed dates.'); }
    finally { setClosuresSaving(false); }
  }

  return <>
    <div className="page-heading section-heading appointment-page-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> APPOINTMENTS</div><h1>Appointments</h1><p>Keep your day running smoothly.</p></div><div className="appointment-page-actions"><button className="secondary-button" disabled={bookingPageSaving} onClick={() => void shareBookingPage()}><Link2 size={15}/>{bookingPageSaving ? 'Creating…' : 'Share booking page'}</button><button className="primary-button" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17}/>New appointment</button></div></div>
    {bookingUrl && <div className="panel booking-share-panel"><div><strong>Your booking page</strong><span>Customers can request a time; it appears as Pending until you confirm it.</span><a href={bookingUrl} target="_blank" rel="noreferrer">{bookingUrl}</a></div><div className="booking-share-actions"><button className="secondary-button" onClick={() => void openHours()}>{hoursOpen ? 'Refresh hours' : 'Manage hours'}</button><button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(bookingUrl); setBookingUrlCopied(true); window.setTimeout(() => setBookingUrlCopied(false), 2200); } catch { setBookingPageError('Could not copy the link. Select and copy it above.'); } }}>{bookingUrlCopied ? <Check size={14}/> : <Copy size={14}/>} {bookingUrlCopied ? 'Copied' : 'Copy link'}</button></div></div>}
    {hoursOpen && bookingUrl && <form className="panel business-hours-panel" onSubmit={submitHours}><div className="business-hours-heading"><div><strong>Booking hours</strong><span>Choose when customers can request an appointment. Times are shown in this zone.</span></div><button type="button" className="icon-button" aria-label="Close opening hours" onClick={() => setHoursOpen(false)}><X size={17}/></button></div>{hoursLoading ? <p>Loading your hours…</p> : <><label className="business-timezone-field">Business time zone<select value={hoursTimezone} onChange={event => { setHoursTimezone(event.target.value); setHoursSaved(false); }}><option value={hoursTimezone}>{hoursTimezone}</option>{timezoneOptions.filter(zone => zone !== hoursTimezone).map(zone => <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>)}</select></label><div className="business-hours-grid">{weekdayNames.map((day, index) => <label className="business-hours-row" key={day}><strong>{day}</strong><span className="closed-toggle"><input type="checkbox" checked={hours[String(index)].closed} onChange={event => setHours(current => ({ ...current, [String(index)]: { ...current[String(index)], closed: event.target.checked } }))}/> Closed</span><input type="time" aria-label={`${day} opening time`} value={hours[String(index)].open} disabled={hours[String(index)].closed} onChange={event => setHours(current => ({ ...current, [String(index)]: { ...current[String(index)], open: event.target.value } }))}/><span className="hours-to">to</span><input type="time" aria-label={`${day} closing time`} value={hours[String(index)].close} disabled={hours[String(index)].closed} onChange={event => setHours(current => ({ ...current, [String(index)]: { ...current[String(index)], close: event.target.value } }))}/></label>)}</div><section className="closed-dates-editor"><div><strong>One-off closed dates</strong><span>Customers won’t be able to book on these dates.</span></div><div className="closed-date-add"><input type="date" aria-label="Choose a closed date" value={closedDateDraft} onChange={event => setClosedDateDraft(event.target.value)} min={new Date().toISOString().slice(0, 10)}/><button type="button" className="secondary-button" disabled={!closedDateDraft || closedDates.includes(closedDateDraft)} onClick={addClosedDate}>Add date</button></div>{closedDates.length > 0 ? <ul>{closedDates.map(date => <li key={date}><span>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span><button type="button" aria-label={`Remove closed date ${date}`} onClick={() => { setClosedDates(current => current.filter(value => value !== date)); setClosuresSaved(false); }}>Remove</button></li>)}</ul> : <p className="closed-dates-empty">No extra dates are blocked.</p>}{closuresError && <p className="form-error" role="alert">{closuresError}</p>}<div className="business-hours-footer">{closuresSaved && <span className="hours-saved"><Check size={14}/> Closed dates saved</span>}<button type="button" className="primary-button" disabled={closuresSaving} onClick={() => void saveClosures()}>{closuresSaving ? 'Saving…' : 'Save closed dates'}</button></div></section>{hoursError && <p className="form-error" role="alert">{hoursError}</p>}<div className="business-hours-footer">{hoursSaved && <span className="hours-saved"><Check size={14}/> Hours saved</span>}<button type="submit" className="primary-button" disabled={hoursSaving}>{hoursSaving ? 'Saving…' : 'Save hours'}</button></div></>}</form>}
    {bookingPageError && <p className="form-error status-error" role="alert">{bookingPageError}</p>}
    <section className="panel section-table">
      <div className="table-toolbar appointment-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search appointments" aria-label="Search appointments"/></div><div className="appointment-filter-group"><label><span>Date</span><select className="appointment-filter" value={dateFilter} onChange={event => setDateFilter(event.target.value as typeof dateFilter)}><option value="all">All dates</option><option value="today">Today</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label><label><span>Status</span><select className="appointment-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option>All statuses</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option><option>No show</option></select></label></div><span>{sorted.length} appointments</span></div>
      <div className="table-header appointment-table"><span>TIME</span><span>CUSTOMER & SERVICE</span><span>STATUS & ACTIONS</span></div>
      {statusError && <p className="form-error status-error" role="alert">{statusError}</p>}
      {sorted.map(item => <div className="table-row appointment-table" key={item.id}>
        <div className="appointment-date"><strong>{new Date(item.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong><span>{new Date(item.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="table-customer"><div className={`person-avatar ${item.tone}`}>{item.initials}</div><span><strong>{item.customer}</strong><small>{item.service} · {item.durationMinutes} min</small></span></div>
        <div className="appointment-actions"><select className={`status-select status ${item.status.toLowerCase().replace(' ', '-')}`} aria-label={`Status for ${item.customer}`} value={item.status} disabled={updatingId === item.id} onChange={event => void changeStatus(item, event.target.value as Appointment['status'])}><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option><option>No show</option></select>{whatsappUrl(item) ? <a className="whatsapp-button" href={whatsappUrl(item)} target="_blank" rel="noreferrer" aria-label={`Open WhatsApp message to ${item.customer}`} title="Draft a WhatsApp message"><MessageCircle size={13}/></a> : <button type="button" className="whatsapp-button" disabled title="Add a phone number to this customer to use WhatsApp" aria-label={`No phone number for ${item.customer}`}><MessageCircle size={13}/></button>}<button type="button" className="reschedule-button" onClick={() => { setScheduleError(''); setDeleteError(''); setDeleteConfirmOpen(false); setRescheduleItem(item); }} aria-label={`Reschedule ${item.customer}`} title="Reschedule"><Pencil size={13}/></button></div>
      </div>)}
      {sorted.length === 0 && <div className="empty-state">{appointments.length === 0 ? 'No appointments yet. Add one to get started.' : 'No appointments match these filters.'}</div>}
    </section>
    {rescheduleItem && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setRescheduleItem(null); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-title"><div className="modal-heading"><div><h2 id="reschedule-title">Reschedule appointment</h2><p>{rescheduleItem.customer} · {rescheduleItem.service}</p></div><button className="icon-button" aria-label="Close form" onClick={() => setRescheduleItem(null)}><X size={18}/></button></div><form onSubmit={saveSchedule}><label>Date and time<input name="startsAt" type="datetime-local" min={todayInputValue()} defaultValue={asLocalDateTime(rescheduleItem.startsAt)} required/></label><label>Duration in minutes<input name="durationMinutes" type="number" min="5" max="480" step="5" defaultValue={rescheduleItem.durationMinutes} required/></label>{scheduleError && <p className="form-error" role="alert">{scheduleError}</p>}{deleteError && <p className="form-error" role="alert">{deleteError}</p>}{deleteConfirmOpen ? <div className="appointment-delete-confirm" role="alert"><strong>Delete this appointment?</strong><span>This cannot be undone.</span><div><button type="button" className="secondary-button" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Keep appointment</button><button type="button" className="appointment-delete-button" onClick={() => void removeAppointment()} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete appointment'}</button></div></div> : <button type="button" className="appointment-delete-trigger" onClick={() => { setDeleteError(''); setDeleteConfirmOpen(true); }}><Trash2 size={14}/>Delete appointment</button>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRescheduleItem(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || deleting}>{saving ? 'Saving…' : 'Save new time'}</button></div></form></section></div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-form-title"><div className="modal-heading"><div><h2 id="appointment-form-title">Schedule an appointment</h2><p>Choose a customer, service, and time.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}><X size={18}/></button></div><form onSubmit={submit}><label>Customer<select name="customerId" required value={selectedCustomerId} onChange={event => setSelectedCustomerId(event.target.value)} disabled={customers.length === 0}><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>{customers.length === 0 && <p className="form-error">Add a customer before scheduling.</p>}{services.length ? <label>Service<select name="service" required value={selectedServiceId} onChange={event => { const service = services.find(item => item.id === event.target.value); setSelectedServiceId(service?.id ?? ''); if (service) setDurationMinutes(service.durationMinutes); }}><option value="" disabled>Select a service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>)}</select></label> : <label>Service<input name="service" required minLength={2} placeholder="e.g. Haircut & styling"/></label>}<label>Date and time<span className="date-label"><CalendarDays size={14}/><Clock3 size={14}/></span><input name="startsAt" type="datetime-local" min={todayInputValue()} defaultValue={todayInputValue()} required/></label><label>Duration in minutes<input name="durationMinutes" type="number" min="5" max="480" step="5" value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || customers.length === 0}>{saving ? 'Saving…' : 'Save appointment'}</button></div></form></section></div>}
  </>;
}
