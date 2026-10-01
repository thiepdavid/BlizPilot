import cors from 'cors';
import express from 'express';
import { createCustomer, listCustomers, updateCustomer } from './customers.js';
import { createAppointment, listAppointments, updateAppointmentStatus, updateAppointmentSchedule, type AppointmentRecord } from './appointments.js';
import { createInvoice, listInvoices } from './invoices.js';
import { createPayment, listPayments, type PaymentRecord } from './payments.js';
import { archiveService, createService, listServices, updateService } from './services.js';
import { createExpense, listExpenses } from './expenses.js';
import { createCampaign, listCampaigns, updateCampaign, deleteCampaign } from './campaigns.js';
import { businessAuth, supabaseConfigured } from './supabase.js';
import { AuthenticatedRequest } from './supabase.js';
import { createRazorpayPaymentLink, handleRazorpayWebhook } from './razorpay.js';
import { createPublicBookingRequest, ensurePublicBookingPage, getBusinessBookingClosures, getBusinessBookingHours, getPublicBookingBusyTimes, getPublicBookingPage, publicBookingRateLimit, saveBusinessBookingClosures, saveBusinessBookingHours, saveBusinessBookingTimezone } from './publicBooking.js';
import { cloudCreateAppointment, cloudCreateCustomer, cloudUpdateCustomer, cloudGetBusinessProfile, cloudUpdateBusinessProfile, cloudCreateInvoice, cloudCreatePayment, cloudCreateService, cloudUpdateService, cloudArchiveService, cloudCreateExpense, cloudListExpenses, cloudListCampaigns, cloudCreateCampaign, cloudUpdateCampaign, cloudDeleteCampaign, cloudUpdateAppointmentStatus, cloudUpdateAppointmentSchedule, cloudListAppointments, cloudListCustomers, cloudListInvoices, cloudListPayments, cloudListServices } from './cloudStore.js';

export const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'bizpilot-api', dataMode: supabaseConfigured ? 'supabase' : 'local', timestamp: new Date().toISOString() });
});

const aiRequestTimes = new Map<string, number[]>();
app.post('/api/ai/ask', businessAuth, async (request, response, next) => {
  const { message, history } = request.body as { message?: unknown; history?: unknown };
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 1500) {
    response.status(400).json({ error: 'Write a question of up to 1,500 characters.' }); return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { response.status(503).json({ error: 'AI is not configured yet. Add an OpenAI API key to the backend environment.' }); return; }

  const context = (request as AuthenticatedRequest).businessContext;
  const identity = context?.userId ?? request.ip ?? 'anonymous';
  const currentTime = Date.now();
  const recentRequests = (aiRequestTimes.get(identity) ?? []).filter(time => currentTime - time < 60_000);
  if (recentRequests.length >= 10) { response.status(429).json({ error: 'Please wait a minute before asking another question.' }); return; }
  aiRequestTimes.set(identity, [...recentRequests, currentTime]);

  const priorTurns = Array.isArray(history) ? history.slice(-6).flatMap((turn: unknown) => {
    if (!turn || typeof turn !== 'object') return [];
    const entry = turn as { role?: unknown; content?: unknown };
    if ((entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.content !== 'string') return [];
    return [{ role: entry.role, content: entry.content.slice(0, 1500) }];
  }) : [];

  try {
    const [customers, appointments, invoices, payments, expenses, business] = context
      ? await Promise.all([cloudListCustomers(context), cloudListAppointments(context), cloudListInvoices(context), cloudListPayments(context), cloudListExpenses(context), cloudGetBusinessProfile(context)])
      : await Promise.all([listCustomers(), listAppointments(), listInvoices(), listPayments(), listExpenses(), Promise.resolve({ currencyCode: 'INR' })]);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const day = 86_400_000;
    const startCurrent = currentTime - 30 * day;
    const startPrevious = currentTime - 60 * day;
    const isRecent = (value: string, start: number) => { const time = Date.parse(value); return Number.isFinite(time) && time >= start && time <= currentTime; };
    const outstanding = invoices.filter(item => item.status !== 'Paid').reduce((sum, item) => sum + Math.max(0, item.amount - (item.paidAmount ?? 0)), 0);
    const overdue = invoices.filter(item => item.status !== 'Paid' && item.dueDate < todayKey).reduce((sum, item) => sum + Math.max(0, item.amount - (item.paidAmount ?? 0)), 0);
    const paymentTotal = (start: number) => payments.filter(item => isRecent(item.receivedAt, start)).reduce((sum, item) => sum + item.amount, 0);
    const expenseTotal = (start: number) => expenses.filter(item => isRecent(item.spentAt, start)).reduce((sum, item) => sum + item.amount, 0);
    const recentAppointments = appointments.filter(item => isRecent(item.startsAt, startCurrent));
    const completed = appointments.filter(item => item.status === 'Completed');
    const repeatCustomers = new Set(completed.reduce<string[]>((ids, item) => [...ids, item.customerId], []).filter((id, index, ids) => ids.indexOf(id) !== index)).size;
    const snapshot = {
      period: 'Last 30 days compared with the prior 30 days', currencyCode: business.currencyCode ?? 'INR',
      customers: { total: customers.length, withMultipleCompletedVisits: repeatCustomers },
      appointments: { last30Days: recentAppointments.length, completedLast30Days: recentAppointments.filter(item => item.status === 'Completed').length, pendingUpcoming: appointments.filter(item => item.status === 'Pending' && Date.parse(item.startsAt) >= currentTime).length },
      invoices: { totalOutstanding: Math.round(outstanding * 100) / 100, overdue: Math.round(overdue * 100) / 100 },
      payments: { last30Days: Math.round(paymentTotal(startCurrent) * 100) / 100, prior30Days: Math.round(paymentTotal(startPrevious) * 100) / 100 },
      expenses: { last30Days: Math.round(expenseTotal(startCurrent) * 100) / 100, prior30Days: Math.round(expenseTotal(startPrevious) * 100) / 100 },
    };
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
        instructions: 'You are BizPilot, a practical assistant for a small service business anywhere in the world. Answer using the supplied aggregate business snapshot and conversation only. The snapshot intentionally excludes customer names, contact information, private notes, and individual records. Never claim to have seen those details. If the snapshot lacks information, say so plainly. Use the snapshot currencyCode for amounts, concise plain language, and give a clear next step when useful. Do not invent metrics or give tax, legal, medical, or investment advice.',
        input: JSON.stringify({ businessSnapshot: snapshot, recentConversation: priorTurns, question: message.trim() }),
        max_output_tokens: 500,
      }),
    });
    const result = await upstream.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    if (!upstream.ok) {
      console.error('OpenAI response error:', upstream.status, result.error?.message ?? 'unknown error');
      response.status(502).json({ error: 'The AI service could not answer just now. Please try again.' }); return;
    }
    const answer = result.output_text ?? result.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('\n').trim();
    if (!answer) { response.status(502).json({ error: 'The AI service returned an empty reply. Please try again.' }); return; }
    response.json({ answer });
  } catch (error) { next(error); }
});

app.post('/api/public-booking/page', businessAuth, async (request, response, next) => {
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Public booking pages require a signed-in Supabase business.' }); return; }
    response.json({ slug: await ensurePublicBookingPage(context) });
  } catch (error) { next(error); }
});

app.get('/api/public-booking/hours', businessAuth, async (request, response, next) => {
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Business hours require a signed-in Supabase business.' }); return; }
    response.json(await getBusinessBookingHours(context));
  } catch (error) { next(error); }
});

app.patch('/api/public-booking/hours', businessAuth, async (request, response, next) => {
  const hours = request.body?.hours as Record<string, { closed?: unknown; open?: unknown; close?: unknown }> | undefined;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const valid = hours && typeof hours === 'object' && !Array.isArray(hours)
    && Array.from({ length: 7 }, (_, day) => hours[String(day)]).every(value => value && typeof value === 'object'
      && typeof value.closed === 'boolean'
      && (value.closed || (typeof value.open === 'string' && timePattern.test(value.open) && typeof value.close === 'string' && timePattern.test(value.close) && value.close > value.open)));
  if (!valid) { response.status(400).json({ error: 'Set each day to closed or choose valid opening and closing times.' }); return; }
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Business hours require a signed-in Supabase business.' }); return; }
    response.json(await saveBusinessBookingHours(context, hours as Record<string, unknown>));
  } catch (error) { next(error); }
});

app.patch('/api/public-booking/timezone', businessAuth, async (request, response, next) => {
  const timezone = request.body?.timezone;
  if (typeof timezone !== 'string' || timezone.length > 80 || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(timezone)) {
    response.status(400).json({ error: 'Choose a valid time zone.' }); return;
  }
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Business time zones require a signed-in Supabase business.' }); return; }
    response.json({ timezone: await saveBusinessBookingTimezone(context, timezone) });
  } catch (error) { next(error); }
});

app.get('/api/public-booking/closed-dates', businessAuth, async (request, response, next) => {
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Booking closures require a signed-in Supabase business.' }); return; }
    response.json({ dates: await getBusinessBookingClosures(context) });
  } catch (error) { next(error); }
});

app.patch('/api/public-booking/closed-dates', businessAuth, async (request, response, next) => {
  const dates = request.body?.dates;
  const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!Array.isArray(dates) || dates.length > 365 || !dates.every(validDate)) {
    response.status(400).json({ error: 'Choose valid dates, up to 365 closed dates.' }); return;
  }
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Booking closures require a signed-in Supabase business.' }); return; }
    response.json({ dates: await saveBusinessBookingClosures(context, [...new Set(dates)]) });
  } catch (error) { next(error); }
});

app.get('/api/public-booking/:slug', async (request, response, next) => {
  try {
    const page = await getPublicBookingPage(request.params.slug);
    if (!page) { response.status(404).json({ error: 'This booking page is not available.' }); return; }
    response.json(page);
  } catch (error) { next(error); }
});

app.get('/api/public-booking/:slug/busy-times', async (request, response, next) => {
  const date = request.query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    response.status(400).json({ error: 'Choose a valid date.' }); return;
  }
  try { response.json({ busyTimes: await getPublicBookingBusyTimes(request.params.slug, date) }); }
  catch (error) {
    if (error instanceof Error && (error.message.includes('not available') || error.message.includes('within the next 90 days'))) {
      response.status(400).json({ error: error.message }); return;
    }
    next(error);
  }
});

app.post('/api/public-booking/:slug/request', publicBookingRateLimit, async (request, response, next) => {
  const { name, phone, email, serviceId, startsAt } = request.body as { name?: unknown; phone?: unknown; email?: unknown; serviceId?: unknown; startsAt?: unknown };
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || (typeof phone !== 'string' && phone !== undefined) || (typeof email !== 'string' && email !== undefined) || (!String(phone ?? '').trim() && !String(email ?? '').trim()) || typeof serviceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(serviceId) || typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt))) {
    response.status(400).json({ error: 'Enter your name, a phone number or email, a service, and a valid date and time.' }); return;
  }
  try {
    const appointment = await createPublicBookingRequest(request.params.slug, { name: name.trim(), phone: typeof phone === 'string' ? phone.trim() : '', email: typeof email === 'string' ? email.trim() : '', serviceId, startsAt: new Date(startsAt).toISOString() });
    response.status(201).json(appointment);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('no longer available') || error.message.includes('Choose a date'))) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof Error && (error.message.includes('Enter your name') || error.message.includes('Enter a valid') || error.message.includes('available service') || error.message.includes('booking page is not available'))) { response.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

app.use('/api/campaigns', businessAuth);
app.get('/api/campaigns', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListCampaigns(cloud) : await listCampaigns()); }
  catch (error) { next(error); }
});
app.post('/api/campaigns', async (request, response, next) => {
  const { name, channel, message } = request.body as { name?: unknown; channel?: unknown; message?: unknown };
  const channels = ['WhatsApp', 'Instagram', 'Email', 'Other'];
  if (typeof name !== 'string' || name.trim().length < 2 || typeof channel !== 'string' || !channels.includes(channel) || typeof message !== 'string' || message.trim().length < 2 || message.length > 5000) {
    response.status(400).json({ error: 'Enter a campaign name, choose a channel, and write a message under 5,000 characters.' }); return;
  }
  try {
    const input = { name: name.trim(), channel, message: message.trim() };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.status(201).json(cloud ? await cloudCreateCampaign(cloud, input) : await createCampaign(input));
  } catch (error) { next(error); }
});

app.delete('/api/campaigns/:id', async (request, response, next) => {
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) await cloudDeleteCampaign(cloud, request.params.id); else await deleteCampaign(request.params.id);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.patch('/api/campaigns/:id', async (request, response, next) => {
  const { name, channel, message } = request.body as { name?: unknown; channel?: unknown; message?: unknown };
  const channels = ['WhatsApp', 'Instagram', 'Email', 'Other'];
  if (typeof name !== 'string' || name.trim().length < 2 || typeof channel !== 'string' || !channels.includes(channel) || typeof message !== 'string' || message.trim().length < 2 || message.length > 5000) {
    response.status(400).json({ error: 'Enter a campaign name, choose a channel, and write a message under 5,000 characters.' }); return;
  }
  try {
    const input = { name: name.trim(), channel, message: message.trim() };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.json(cloud ? await cloudUpdateCampaign(cloud, request.params.id, input) : await updateCampaign(request.params.id, input));
  } catch (error) { next(error); }
});

app.use('/api/business-profile', businessAuth);
app.get('/api/business-profile', async (request, response, next) => {
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    response.json(context ? await cloudGetBusinessProfile(context) : { currencyCode: 'INR' });
  } catch (error) { next(error); }
});
app.patch('/api/business-profile', async (request, response, next) => {
  const { businessName, fullName, currencyCode } = request.body as { businessName?: unknown; fullName?: unknown; currencyCode?: unknown };
  let validCurrency = false;
  if (typeof currencyCode === 'string' && /^[A-Z]{3}$/.test(currencyCode)) {
    try { new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).format(0); validCurrency = true; } catch { /* Invalid ISO 4217 code. */ }
  }
  if (typeof businessName !== 'string' || businessName.trim().length < 2 || typeof fullName !== 'string' || fullName.trim().length < 2 || !validCurrency) {
    response.status(400).json({ error: 'Enter a business name, owner name, and valid three-letter currency code.' }); return;
  }
  try {
    const context = (request as AuthenticatedRequest).businessContext;
    if (!context) { response.status(400).json({ error: 'Business profile updates require a signed-in cloud account.' }); return; }
    response.json(await cloudUpdateBusinessProfile(context, { businessName: businessName.trim(), fullName: fullName.trim(), currencyCode: currencyCode as string }));
  } catch (error) { next(error); }
});

app.use('/api/services', businessAuth);
app.get('/api/services', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListServices(cloud) : await listServices()); }
  catch (error) { next(error); }
});
app.patch('/api/services/:id', async (request, response, next) => {
  const { name, description, durationMinutes, price } = request.body as { name?: unknown; description?: unknown; durationMinutes?: unknown; price?: unknown };
  const duration = Number(durationMinutes); const parsedPrice = Number(price);
  if (typeof name !== 'string' || name.trim().length < 2 || !Number.isInteger(duration) || duration < 5 || duration > 480 || !Number.isFinite(parsedPrice) || parsedPrice < 0 || (description !== undefined && typeof description !== 'string')) {
    response.status(400).json({ error: 'Enter a name, description, duration from 5 minutes to 8 hours, and a valid price.' }); return;
  }
  try {
    const input = { name: name.trim(), description: typeof description === 'string' ? description.trim() : '', durationMinutes: duration, price: Math.round(parsedPrice * 100) / 100 };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.json(cloud ? await cloudUpdateService(cloud, request.params.id, input) : await updateService(request.params.id, input));
  } catch (error) { next(error); }
});
app.delete('/api/services/:id', async (request, response, next) => {
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) await cloudArchiveService(cloud, request.params.id);
    else await archiveService(request.params.id);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/services', async (request, response, next) => {
  const { name, description, durationMinutes, price } = request.body as { name?: unknown; description?: unknown; durationMinutes?: unknown; price?: unknown };
  const duration = Number(durationMinutes); const parsedPrice = Number(price);
  if (typeof name !== 'string' || name.trim().length < 2 || !Number.isInteger(duration) || duration < 5 || duration > 480 || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
    response.status(400).json({ error: 'Enter a service name, duration from 5 minutes to 8 hours, and a valid price.' }); return;
  }
  try {
    const input = { name: name.trim(), description: typeof description === 'string' ? description.trim() : '', durationMinutes: duration, price: Math.round(parsedPrice * 100) / 100 };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.status(201).json(cloud ? await cloudCreateService(cloud, input) : await createService(input));
  } catch (error) { next(error); }
});

app.use('/api/expenses', businessAuth);
app.get('/api/expenses', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListExpenses(cloud) : await listExpenses()); }
  catch (error) { next(error); }
});
app.post('/api/expenses', async (request, response, next) => {
  const { description, category, amount, spentAt } = request.body as { description?: unknown; category?: unknown; amount?: unknown; spentAt?: unknown };
  const parsedAmount = Number(amount);
  if (typeof description !== 'string' || description.trim().length < 2 || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || (category !== undefined && typeof category !== 'string') || typeof spentAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentAt) || Number.isNaN(Date.parse(`${spentAt}T00:00:00Z`))) {
    response.status(400).json({ error: 'Enter a description, positive amount, and valid expense date.' }); return;
  }
  try {
    const input = { description: description.trim(), category: typeof category === 'string' ? category.trim() : '', amount: Math.round(parsedAmount * 100) / 100, spentAt };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.status(201).json(cloud ? await cloudCreateExpense(cloud, input) : await createExpense(input));
  } catch (error) { next(error); }
});

app.use('/api/customers', businessAuth);
app.get('/api/customers', async (request, response, next) => {
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) { response.json(await cloudListCustomers(cloud)); return; }
    response.json(await listCustomers());
  } catch (error) {
    next(error);
  }
});

app.patch('/api/customers/:id', async (request, response, next) => {
  const { name, email, phone, notes } = request.body as { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown };
  if (typeof name !== 'string' || name.trim().length < 2 || (email !== undefined && typeof email !== 'string') || (phone !== undefined && typeof phone !== 'string') || (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000))) {
    response.status(400).json({ error: 'Enter a customer name and valid contact details.' }); return;
  }
  try {
    const input = { name: name.trim(), email: typeof email === 'string' ? email.trim() : '', phone: typeof phone === 'string' ? phone.trim() : '', notes: typeof notes === 'string' ? notes.trim() : '' };
    const cloud = (request as AuthenticatedRequest).businessContext;
    response.json(cloud ? await cloudUpdateCustomer(cloud, request.params.id, input) : await updateCustomer(request.params.id, input));
  } catch (error) { next(error); }
});

app.post('/api/customers', async (request, response, next) => {
  const { name, email, phone, notes } = request.body as { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown };
  if (typeof name !== 'string' || name.trim().length < 2) {
    response.status(400).json({ error: 'Enter a customer name with at least 2 characters.' });
    return;
  }
  if (email !== undefined && typeof email !== 'string') {
    response.status(400).json({ error: 'Email must be text.' });
    return;
  }
  if (phone !== undefined && typeof phone !== 'string') {
    response.status(400).json({ error: 'Phone must be text.' });
    return;
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) {
    response.status(400).json({ error: 'Notes must be 2,000 characters or fewer.' }); return;
  }
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    const input = { name: name.trim(), email: typeof email === 'string' ? email.trim() : '', phone: typeof phone === 'string' ? phone.trim() : '', notes: typeof notes === 'string' ? notes.trim() : '' };
    if (cloud) { response.status(201).json(await cloudCreateCustomer(cloud, input)); return; }
    const customer = await createCustomer(input);
    response.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

app.use('/api/appointments', businessAuth);
app.get('/api/appointments', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListAppointments(cloud) : await listAppointments()); }
  catch (error) { next(error); }
});

app.patch('/api/appointments/:id/status', async (request, response, next) => {
  const statuses: AppointmentRecord['status'][] = ['Confirmed', 'Pending', 'Completed', 'Cancelled', 'No show'];
  const status = request.body?.status;
  if (typeof status !== 'string' || !statuses.includes(status as AppointmentRecord['status'])) { response.status(400).json({ error: 'Choose a valid appointment status.' }); return; }
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    const updated = cloud ? await cloudUpdateAppointmentStatus(cloud, request.params.id, status) : await updateAppointmentStatus(request.params.id, status as AppointmentRecord['status']);
    response.json(updated);
  } catch (error) { next(error); }
});

app.patch('/api/appointments/:id/schedule', async (request, response, next) => {
  const { startsAt, durationMinutes } = request.body as { startsAt?: unknown; durationMinutes?: unknown };
  const duration = Number(durationMinutes);
  if (typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt)) || !Number.isInteger(duration) || duration < 5 || duration > 480) {
    response.status(400).json({ error: 'Choose a valid date, time, and duration from 5 minutes to 8 hours.' }); return;
  }
  try {
    const normalizedStartsAt = new Date(startsAt).toISOString();
    const cloud = (request as AuthenticatedRequest).businessContext;
    const updated = cloud ? await cloudUpdateAppointmentSchedule(cloud, request.params.id, normalizedStartsAt, duration) : await updateAppointmentSchedule(request.params.id, normalizedStartsAt, duration);
    response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('overlaps another appointment')) { response.status(409).json({ error: error.message }); return; }
    next(error);
  }
});

app.post('/api/appointments', async (request, response, next) => {
  const { customerId, service, startsAt, durationMinutes } = request.body as { customerId?: unknown; service?: unknown; startsAt?: unknown; durationMinutes?: unknown };
  if (typeof customerId !== 'string' || typeof service !== 'string' || service.trim().length < 2 || typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt))) {
    response.status(400).json({ error: 'Choose a customer, enter a service, and select a valid date and time.' });
    return;
  }
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    response.status(400).json({ error: 'Appointment length must be between 5 minutes and 8 hours.' });
    return;
  }
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) { response.status(201).json(await cloudCreateAppointment(cloud, { customerId, service: service.trim(), startsAt: new Date(startsAt).toISOString(), durationMinutes: duration })); return; }
    const appointment = await createAppointment({ customerId, service: service.trim(), startsAt: new Date(startsAt).toISOString(), durationMinutes: duration });
    response.status(201).json(appointment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('overlaps another appointment')) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof Error && error.message === 'Choose a customer from your customer list.') {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.use('/api/invoices', businessAuth);
app.get('/api/invoices', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListInvoices(cloud) : await listInvoices()); }
  catch (error) { next(error); }
});

app.post('/api/invoices', async (request, response, next) => {
  const { customerId, description, amount, taxRate, dueDate } = request.body as { customerId?: unknown; description?: unknown; amount?: unknown; taxRate?: unknown; dueDate?: unknown };
  const parsedAmount = Number(amount);
  const parsedTaxRate = taxRate === undefined ? 0 : Number(taxRate);
  if (typeof customerId !== 'string' || typeof description !== 'string' || description.trim().length < 2 || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100 || typeof dueDate !== 'string' || Number.isNaN(Date.parse(dueDate))) {
    response.status(400).json({ error: 'Enter a customer, invoice description, positive amount, and valid due date.' });
    return;
  }
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) { response.status(201).json(await cloudCreateInvoice(cloud, { customerId, description: description.trim(), amount: Math.round(parsedAmount * 100) / 100, taxRate: parsedTaxRate, dueDate })); return; }
    const invoice = await createInvoice({ customerId, description: description.trim(), amount: Math.round(parsedAmount * 100) / 100, taxRate: parsedTaxRate, dueDate });
    response.status(201).json(invoice);
  } catch (error) {
    if (error instanceof Error && error.message === 'Choose a customer from your customer list.') {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.use('/api/payments', businessAuth);
app.get('/api/payments', async (request, response, next) => {
  try { const cloud = (request as AuthenticatedRequest).businessContext; response.json(cloud ? await cloudListPayments(cloud) : await listPayments()); }
  catch (error) { next(error); }
});

app.post('/api/payments/link', async (request, response, next) => {
  const { invoiceId } = request.body as { invoiceId?: unknown };
  if (typeof invoiceId !== 'string' || !invoiceId) {
    response.status(400).json({ error: 'Choose an invoice to create a payment link.' });
    return;
  }
  const cloud = (request as AuthenticatedRequest).businessContext;
  if (!cloud) {
    response.status(400).json({ error: 'Online payment links require your signed-in Supabase business account.' });
    return;
  }
  try {
    const paymentLink = await createRazorpayPaymentLink(cloud, invoiceId);
    response.status(201).json(paymentLink);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured yet')) {
      response.status(503).json({ error: error.message });
      return;
    }
    if (error instanceof Error && (error.message.includes('invoice') || error.message.includes('balance') || error.message.includes('Razorpay payment links'))) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post('/api/payments', async (request, response, next) => {
  const { invoiceId, amount, method } = request.body as { invoiceId?: unknown; amount?: unknown; method?: unknown };
  const parsedAmount = Number(amount);
  const methods: PaymentRecord['method'][] = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other'];
  if (typeof invoiceId !== 'string' || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || typeof method !== 'string' || !methods.includes(method as PaymentRecord['method'])) {
    response.status(400).json({ error: 'Choose an invoice, enter a positive amount, and select a payment method.' });
    return;
  }
  try {
    const cloud = (request as AuthenticatedRequest).businessContext;
    if (cloud) { response.status(201).json(await cloudCreatePayment(cloud, { invoiceId, amount: Math.round(parsedAmount * 100) / 100, method })); return; }
    const payment = await createPayment({ invoiceId, amount: Math.round(parsedAmount * 100) / 100, method: method as PaymentRecord['method'] });
    response.status(201).json(payment);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Choose an invoice from your billing list.') || error.message.includes('Payment exceeds the remaining invoice balance.'))) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('API error:', error);
  response.status(500).json({ error: 'The server could not complete the request.' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});
