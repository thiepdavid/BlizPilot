import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Store } from 'lucide-react';
import './public-booking.css';

type PublicService = { id: string; name: string; description: string; durationMinutes: number; price: number };
type BookingInfo = { businessName: string; services: PublicService[] };

export function PublicBookingPage({ slug, apiBase }: { slug: string; apiBase: string }) {
  const [page, setPage] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [requested, setRequested] = useState<{ service: string; startsAt: string } | null>(null);
  const [serviceId, setServiceId] = useState('');

  useEffect(() => {
    let current = true;
    fetch(`${apiBase}/api/public-booking/${encodeURIComponent(slug)}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'This booking page could not be opened.');
        return data as BookingInfo;
      })
      .then(data => { if (current) { setPage(data); setServiceId(data.services[0]?.id ?? ''); } })
      .catch(reason => { if (current) setLoadError(reason instanceof Error ? reason.message : 'This booking page could not be opened.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [apiBase, slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get('startsAt') ?? '');
    const service = page?.services.find(item => item.id === serviceId);
    setError(''); setSaving(true);
    try {
      const response = await fetch(`${apiBase}/api/public-booking/${encodeURIComponent(slug)}/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: String(form.get('name') ?? ''), phone: String(form.get('phone') ?? ''), email: String(form.get('email') ?? ''), serviceId, startsAt: new Date(startsAt).toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not send your request.');
      setRequested({ service: result.service ?? service?.name ?? 'Appointment', startsAt: result.startsAt ?? startsAt });
      event.currentTarget.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send your request.'); }
    finally { setSaving(false); }
  }

  const minimumDate = new Date(Date.now() + 60 * 60 * 1000);
  const localInput = `${minimumDate.getFullYear()}-${String(minimumDate.getMonth() + 1).padStart(2, '0')}-${String(minimumDate.getDate()).padStart(2, '0')}T${String(minimumDate.getHours()).padStart(2, '0')}:${String(minimumDate.getMinutes()).padStart(2, '0')}`;
  const chosenService = page?.services.find(item => item.id === serviceId);

  return <main className="public-booking-screen"><section className="public-booking-card">
    <div className="public-booking-brand"><span><Store size={18}/></span><strong>BizPilot</strong></div>
    {loading ? <p className="public-booking-status">Opening booking page…</p> : loadError ? <div className="public-booking-message"><h1>Booking page unavailable</h1><p>{loadError}</p></div> : requested ? <div className="public-booking-success"><CheckCircle2 size={42}/><h1>Request sent</h1><p>Your request for <strong>{requested.service}</strong> has been sent to {page?.businessName}. It is pending confirmation; the business will contact you.</p><div><CalendarDays size={16}/>{new Date(requested.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div><button className="public-booking-submit" onClick={() => setRequested(null)}>Request another appointment</button></div> : <>
      <div className="public-booking-heading"><div className="public-booking-eyebrow">ONLINE APPOINTMENT REQUEST</div><h1>Book with {page?.businessName}</h1><p>Choose a service and a time that works for you.</p></div>
      {!page?.services.length ? <div className="public-booking-message"><h2>No services available yet</h2><p>Please contact the business to arrange an appointment.</p></div> : <form className="public-booking-form" onSubmit={submit}>
        <label>Service<select name="serviceId" value={serviceId} onChange={event => setServiceId(event.target.value)} required>{page.services.map(service => <option key={service.id} value={service.id}>{service.name} · ₹{service.price.toLocaleString('en-IN')} · {service.durationMinutes} min</option>)}</select></label>
        {chosenService?.description && <p className="public-service-description">{chosenService.description}</p>}
        <label>Your name<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Full name"/></label>
        <div className="public-contact-grid"><label>Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Phone number"/></label><label>Email<input name="email" type="email" maxLength={254} autoComplete="email" placeholder="Email address"/></label></div>
        <p className="public-contact-help">Please provide a phone number or email so the business can confirm.</p>
        <label>Date and time<span className="public-date-icon"><CalendarDays size={14}/><Clock3 size={14}/></span><input name="startsAt" type="datetime-local" min={localInput} required/></label>
        <p className="public-contact-help">This sends an appointment request. Your time is confirmed after the business approves it.</p>
        {error && <p className="public-booking-error" role="alert">{error}</p>}
        <button className="public-booking-submit" type="submit" disabled={saving || !serviceId}>{saving ? 'Sending request…' : 'Request appointment'}</button>
      </form>}
    </>}
    <footer className="public-booking-footer">Powered by BizPilot</footer>
  </section></main>;
}
