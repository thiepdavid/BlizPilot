import { currencyName, formatCurrency, supportedCurrencies } from '../lib/currency';
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Store } from 'lucide-react';
import './public-booking.css';

type PublicService = { id: string; name: string; description: string; durationMinutes: number; price: number };
type DayHours = { closed?: boolean; open?: string; close?: string };
type BookingInfo = { businessName: string; currencyCode?: string; timezone: string; hours: Record<string, DayHours>; closedDates: string[]; services: PublicService[] };
type CurrencyRate = { rate: number; date: string };
const regionCurrencies: Record<string, string> = {
  AE: 'AED', AR: 'ARS', AU: 'AUD', BD: 'BDT', BH: 'BHD', BR: 'BRL', CA: 'CAD', CH: 'CHF', CL: 'CLP', CN: 'CNY',
  CO: 'COP', CZ: 'CZK', DE: 'EUR', DK: 'DKK', EG: 'EGP', ES: 'EUR', FI: 'EUR', FR: 'EUR', GB: 'GBP', GR: 'EUR',
  HK: 'HKD', HU: 'HUF', ID: 'IDR', IE: 'EUR', IL: 'ILS', IN: 'INR', IT: 'EUR', JP: 'JPY', KE: 'KES', KR: 'KRW',
  KW: 'KWD', LK: 'LKR', MX: 'MXN', MY: 'MYR', NG: 'NGN', NL: 'EUR', NO: 'NOK', NP: 'NPR', NZ: 'NZD', OM: 'OMR',
  PH: 'PHP', PK: 'PKR', PL: 'PLN', PT: 'EUR', QA: 'QAR', RO: 'RON', SA: 'SAR', SE: 'SEK', SG: 'SGD', TH: 'THB',
  TR: 'TRY', TW: 'TWD', UA: 'UAH', US: 'USD', VN: 'VND', ZA: 'ZAR',
};
const savedDisplayCurrencyKey = 'bizpilot-display-currency';

function initialDisplayCurrency(businessCurrency: string) {
  try {
    const saved = window.localStorage.getItem(savedDisplayCurrencyKey);
    if (saved && (supportedCurrencies as readonly string[]).includes(saved)) return saved;
  } catch { /* Continue with the visitor's browser region. */ }
  const region = navigator.language.split('-').pop()?.toUpperCase() ?? '';
  const detected = regionCurrencies[region];
  return detected && (supportedCurrencies as readonly string[]).includes(detected) ? detected : businessCurrency;
}

function currentDateInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateInDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function timeOptions(date: string, hours: Record<string, DayHours>, closedDates: string[], busyTimes: Array<{ startsAt: string; endsAt: string }>, durationMinutes: number, timeZone: string) {
  if (!date) return [];
  if (closedDates.includes(date)) return [];
  const dayNumber = new Date(`${date}T12:00:00Z`).getUTCDay();
  const day = hours[String(dayNumber)];
  if (!day || day.closed || !day.open || !day.close) return [];
  const [openHour, openMinute] = day.open.split(':').map(Number);
  const [closeHour, closeMinute] = day.close.split(':').map(Number);
  const start = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  const options: string[] = [];
  for (let minute = start; minute + durationMinutes <= close; minute += 15) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const slotStart = new Date(zonedDateTimeToIso(date, time, timeZone)).getTime();
    const slotEnd = slotStart + durationMinutes * 60_000;
    const overlaps = busyTimes.some(busy => slotStart < new Date(busy.endsAt).getTime() && slotEnd > new Date(busy.startsAt).getTime());
    if (!overlaps && (date !== currentDateInZone(timeZone) || slotStart > Date.now())) options.push(time);
  }
  return options;
}

function zonedDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const assumedUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(assumedUtc));
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  const representedUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return new Date(assumedUtc - (representedUtc - assumedUtc)).toISOString();
}

export function PublicBookingPage({ slug, apiBase }: { slug: string; apiBase: string }) {
  const [page, setPage] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [requested, setRequested] = useState<{ service: string; startsAt: string } | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [busyTimes, setBusyTimes] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [busyError, setBusyError] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('');
  const [currencyRate, setCurrencyRate] = useState<CurrencyRate | null>(null);
  const [currencyRateError, setCurrencyRateError] = useState('');

  useEffect(() => {
    let current = true;
    fetch(`${apiBase}/api/public-booking/${encodeURIComponent(slug)}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'This booking page could not be opened.');
        return data as BookingInfo;
      })
      .then(data => { if (current) { setPage(data); setServiceId(data.services[0]?.id ?? ''); setRequestedDate(currentDateInZone(data.timezone || 'Asia/Kolkata')); setDisplayCurrency(initialDisplayCurrency(data.currencyCode ?? 'INR')); } })
      .catch(reason => { if (current) setLoadError(reason instanceof Error ? reason.message : 'This booking page could not be opened.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [apiBase, slug]);

  useEffect(() => {
    if (!page || !displayCurrency) return;
    const base = page.currencyCode ?? 'INR';
    if (displayCurrency === base) { setCurrencyRate({ rate: 1, date: '' }); setCurrencyRateError(''); return; }
    let current = true;
    setCurrencyRate(null); setCurrencyRateError('');
    fetch(`${apiBase}/api/exchange-rate?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(displayCurrency)}`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load the exchange rate.');
        return result as CurrencyRate;
      })
      .then(result => { if (current) setCurrencyRate(result); })
      .catch(reason => { if (current) setCurrencyRateError(reason instanceof Error ? reason.message : 'Could not load the exchange rate.'); });
    return () => { current = false; };
  }, [apiBase, displayCurrency, page?.currencyCode]);

  function changeDisplayCurrency(value: string) {
    setDisplayCurrency(value);
    try { window.localStorage.setItem(savedDisplayCurrencyKey, value); } catch { /* The current page still updates. */ }
  }

  function priceLabel(amount: number) {
    const base = page?.currencyCode ?? 'INR';
    if (!displayCurrency || displayCurrency === base) return formatCurrency(amount, 2, base);
    if (!currencyRate) return formatCurrency(amount, 2, base);
    return `≈ ${formatCurrency(amount * currencyRate.rate, 2, displayCurrency)} (${formatCurrency(amount, 2, base)})`;
  }

  useEffect(() => {
    if (!page || !requestedDate) return;
    let current = true;
    setBusyLoading(true); setBusyError(''); setRequestedTime('');
    fetch(`${apiBase}/api/public-booking/${encodeURIComponent(slug)}/busy-times?date=${encodeURIComponent(requestedDate)}`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not check appointment availability.');
        return result as { busyTimes: Array<{ startsAt: string; endsAt: string }> };
      })
      .then(result => { if (current) setBusyTimes(result.busyTimes); })
      .catch(reason => { if (current) { setBusyTimes([]); setBusyError(reason instanceof Error ? reason.message : 'Could not check appointment availability.'); } })
      .finally(() => { if (current) setBusyLoading(false); });
    return () => { current = false; };
  }, [apiBase, slug, requestedDate, page?.timezone]);

  const chosenService = page?.services.find(item => item.id === serviceId);
  const slots = page && chosenService && !busyLoading && !busyError ? timeOptions(requestedDate, page.hours, page.closedDates ?? [], busyTimes, chosenService.durationMinutes, page.timezone || 'Asia/Kolkata') : [];
  const dateClosed = Boolean(page && (page.closedDates ?? []).includes(requestedDate));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !chosenService || !requestedDate || !requestedTime) { setError('Choose an available appointment time.'); return; }
    const form = new FormData(event.currentTarget);
    const startsAt = zonedDateTimeToIso(requestedDate, requestedTime, page.timezone || 'Asia/Kolkata');
    setError(''); setSaving(true);
    try {
      const response = await fetch(`${apiBase}/api/public-booking/${encodeURIComponent(slug)}/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: String(form.get('name') ?? ''), phone: String(form.get('phone') ?? ''), email: String(form.get('email') ?? ''), serviceId, startsAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not send your request.');
      setRequested({ service: result.service ?? chosenService.name, startsAt: result.startsAt ?? startsAt });
      event.currentTarget.reset(); setRequestedTime('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send your request.'); }
    finally { setSaving(false); }
  }

  const today = page ? currentDateInZone(page.timezone || 'Asia/Kolkata') : '';
  const lastDate = today ? dateInDays(today, 90) : undefined;

  return <main className="public-booking-screen"><section className="public-booking-card">
    <div className="public-booking-brand"><span><Store size={18}/></span><strong>BizPilot</strong></div>
    {loading ? <p className="public-booking-status">Opening booking page…</p> : loadError ? <div className="public-booking-message"><h1>Booking page unavailable</h1><p>{loadError}</p></div> : requested ? <div className="public-booking-success"><CheckCircle2 size={42}/><h1>Request sent</h1><p>Your request for <strong>{requested.service}</strong> has been sent to {page?.businessName}. It is pending confirmation; the business will contact you.</p><div><CalendarDays size={16}/>{new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short', timeZone: page?.timezone }).format(new Date(requested.startsAt))}</div><button className="public-booking-submit" onClick={() => setRequested(null)}>Request another appointment</button></div> : <>
      <div className="public-booking-heading"><div className="public-booking-eyebrow">ONLINE APPOINTMENT REQUEST</div><h1>Book with {page?.businessName}</h1><p>Choose a service and a time during opening hours.</p></div>
      {!page?.services.length ? <div className="public-booking-message"><h2>No services available yet</h2><p>Please contact the business to arrange an appointment.</p></div> : <form className="public-booking-form" onSubmit={submit}>
        <label>Show prices in<select value={displayCurrency || page.currencyCode || 'INR'} onChange={event => changeDisplayCurrency(event.target.value)}>{supportedCurrencies.map(code => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</select></label>
        {displayCurrency !== (page.currencyCode ?? 'INR') && <p className="public-contact-help" role="status">{currencyRate ? `Approximate price using rates dated ${currencyRate.date}. The business charges in ${page.currencyCode ?? 'INR'}.` : currencyRateError ? `Local conversion is unavailable right now. Prices are shown in ${page.currencyCode ?? 'INR'}.` : 'Loading the latest exchange rate…'}</p>}
        <label>Service<select name="serviceId" value={serviceId} onChange={event => { setServiceId(event.target.value); setRequestedTime(''); }} required>{page.services.map(service => <option key={service.id} value={service.id}>{service.name} · {priceLabel(service.price)} · {service.durationMinutes} min</option>)}</select></label>
        {chosenService?.description && <p className="public-service-description">{chosenService.description}</p>}
        <label>Your name<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Full name"/></label>
        <div className="public-contact-grid"><label>Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Phone number"/></label><label>Email<input name="email" type="email" maxLength={254} autoComplete="email" placeholder="Email address"/></label></div>
        <p className="public-contact-help">Please provide a phone number or email so the business can confirm.</p>
        <div className="public-booking-time-grid"><label>Date<span className="public-date-icon"><CalendarDays size={14}/></span><input name="date" type="date" value={requestedDate} min={today} max={lastDate} onChange={event => { setRequestedDate(event.target.value); setRequestedTime(''); }} required/></label><label>Available time<span className="public-date-icon"><Clock3 size={14}/></span><select name="time" value={requestedTime} onChange={event => setRequestedTime(event.target.value)} required disabled={!slots.length}><option value="">{busyLoading ? 'Checking availability…' : busyError ? 'Availability unavailable' : slots.length ? 'Choose a time' : dateClosed ? 'Closed on this date' : 'No times available'}</option>{slots.map(time => <option key={time} value={time}>{time}</option>)}</select></label></div>
        {busyError && <p className="public-booking-error" role="alert">{busyError} Please choose another date or try again.</p>}
        {dateClosed && <p className="public-closed-date-note">This business is closed on the selected date. Please choose another day.</p>}
        <p className="public-contact-help">Times shown in {page.timezone}. Requests are pending until the business confirms.</p>
        {error && <p className="public-booking-error" role="alert">{error}</p>}
        <button className="public-booking-submit" type="submit" disabled={saving || !serviceId || !requestedTime}>{saving ? 'Sending request…' : 'Request appointment'}</button>
      </form>}
    </>}
    <footer className="public-booking-footer">Powered by BizPilot</footer>
  </section></main>;
}
