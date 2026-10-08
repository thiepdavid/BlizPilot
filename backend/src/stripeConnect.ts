import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import type { BusinessContext } from './supabase.js';

type StripeAccount = { id: string; country?: string; details_submitted?: boolean; charges_enabled?: boolean; payouts_enabled?: boolean };
const api = 'https://api.stripe.com/v1';

function currencyDigits(currency: string) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { throw new Error('The invoice currency is not supported for online payments.'); }
}

function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured yet. Add STRIPE_SECRET_KEY to the API environment.');
  return key;
}

function clientOrigin() {
  const origin = process.env.CLIENT_ORIGIN ?? process.env.CORS_ORIGIN?.split(',')[0];
  if (!origin || (!/^https:\/\//i.test(origin) && !/^http:\/\/localhost(?::\d+)?$/i.test(origin))) {
    throw new Error('Set CLIENT_ORIGIN to the BizPilot website URL in the API environment.');
  }
  return origin.replace(/\/$/, '');
}

async function stripeRequest<T>(path: string, options: { method?: string; body?: URLSearchParams; account?: string } = {}): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.account ? { 'Stripe-Account': options.account } : {}),
    },
    ...(options.body ? { body: options.body.toString() } : {}),
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    console.error(`Stripe API error (${response.status}):`, payload.error?.message ?? response.statusText);
    throw new Error(payload.error?.message ?? 'Stripe could not complete the request. Check the connected account and currency.');
  }
  return payload;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Secure payment account storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the API environment.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function paymentAccount(context: BusinessContext) {
  const { data, error } = await adminClient().from('business_payment_accounts')
    .select('stripe_account_id,country')
    .eq('business_id', context.businessId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { stripe_account_id: string; country: string } | null;
}

export async function getStripeAccountStatus(context: BusinessContext) {
  const row = await paymentAccount(context);
  if (!row) return { configured: Boolean(process.env.STRIPE_SECRET_KEY), connected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, country: '' };
  const account = await stripeRequest<StripeAccount>(`/accounts/${encodeURIComponent(row.stripe_account_id)}`);
  return {
    configured: true,
    connected: true,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    country: account.country ?? row.country,
  };
}

export async function startStripeOnboarding(context: BusinessContext, country: string) {
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Choose your business country in Settings before connecting payments.');
  const origin = clientOrigin();
  let row = await paymentAccount(context);
  if (row && row.country !== country) throw new Error('The connected Stripe account country cannot be changed. Contact support if the business country is incorrect.');
  if (!row) {
    const form = new URLSearchParams({
      type: 'express',
      country,
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true',
      'metadata[bizpilot_business_id]': context.businessId,
    });
    const account = await stripeRequest<StripeAccount>('/accounts', { method: 'POST', body: form });
    const { error } = await adminClient().from('business_payment_accounts').insert({ business_id: context.businessId, stripe_account_id: account.id, country });
    if (error) throw new Error(error.message);
    row = { stripe_account_id: account.id, country };
  }
  const link = await stripeRequest<{ url: string }>('/account_links', {
    method: 'POST',
    body: new URLSearchParams({
      account: row.stripe_account_id,
      refresh_url: `${origin}/?payments=connect-refresh`,
      return_url: `${origin}/?payments=connect-return`,
      type: 'account_onboarding',
    }),
  });
  return { url: link.url };
}

function toMinorUnits(amount: number, currency: string) {
  const fractionDigits = currencyDigits(currency);
  const scaled = amount * (10 ** fractionDigits);
  const value = Math.round(scaled);
  if (Math.abs(scaled - value) > 1e-7) throw new Error(`This invoice amount uses smaller units than ${currency.toUpperCase()} allows. Correct the invoice amount before creating a link.`);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('This invoice balance is outside the supported payment range.');
  return value;
}

export async function createStripePaymentLink(context: BusinessContext, invoiceId: string) {
  const [accountRow, businessResult] = await Promise.all([
    paymentAccount(context),
    context.client.from('businesses').select('currency_code').eq('id', context.businessId).single(),
  ]);
  if (!accountRow) throw new Error('Connect your business Stripe account before creating online payment links. Open Payments and choose Connect Stripe.');
  if (businessResult.error) throw new Error(businessResult.error.message);
  const account = await stripeRequest<StripeAccount>(`/accounts/${encodeURIComponent(accountRow.stripe_account_id)}`);
  if (!account.charges_enabled) throw new Error('Stripe is still reviewing your account. Finish its onboarding or wait for approval before creating payment links.');
  const { data: invoice, error } = await context.client.from('invoices')
    .select('id,business_id,invoice_number,description,total,paid_amount,customers(full_name,email,phone)')
    .eq('id', invoiceId).eq('business_id', context.businessId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error('Choose an invoice in your business workspace.');
  const currency = String(businessResult.data.currency_code ?? 'INR').toLowerCase();
  const amount = toMinorUnits(Math.max(0, Number(invoice.total) - Number(invoice.paid_amount ?? 0)), currency);
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  const origin = clientOrigin();
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/payment-success.html`,
    cancel_url: `${origin}/payment-cancelled.html`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `Invoice ${invoice.invoice_number}`,
    'line_items[0][price_data][product_data][description]': String(invoice.description || 'BizPilot service invoice').slice(0, 500),
    client_reference_id: invoice.id,
    'metadata[bizpilot_invoice_id]': invoice.id,
    'metadata[bizpilot_business_id]': context.businessId,
    'payment_intent_data[metadata][bizpilot_invoice_id]': invoice.id,
    'payment_intent_data[metadata][bizpilot_business_id]': context.businessId,
  });
  if (customer?.email) form.set('customer_email', customer.email);
  const session = await stripeRequest<{ url?: string }>('/checkout/sessions', { method: 'POST', body: form, account: accountRow.stripe_account_id });
  if (!session.url) throw new Error('Stripe did not return a payment page URL.');
  return { url: session.url, amount: amount / (10 ** currencyDigits(currency)), provider: 'Stripe' as const };
}

function verifyStripeSignature(payload: Buffer, signature: string, secret: string) {
  const parts = signature.split(',').map(part => part.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest();
  return signatures.some(value => {
    if (!/^[a-f\d]{64}$/i.test(value)) return false;
    const received = Buffer.from(value, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export async function handleStripeConnectWebhook(request: Request, response: Response) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) { response.status(503).json({ error: 'Stripe webhooks are not configured.' }); return; }
  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
  if (!verifyStripeSignature(body, request.header('stripe-signature') ?? '', secret)) { response.status(400).json({ error: 'Invalid Stripe webhook signature.' }); return; }
  let event: any;
  try { event = JSON.parse(body.toString('utf8')); }
  catch { response.status(400).json({ error: 'Invalid Stripe webhook JSON.' }); return; }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) { response.json({ received: true }); return; }
  const session = event.data?.object;
  if (session?.payment_status !== 'paid') { response.json({ received: true }); return; }
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const businessId = session.metadata?.bizpilot_business_id;
  const invoiceId = session.metadata?.bizpilot_invoice_id;
  const connectedAccountId = event.account;
  const amountTotal = Number(session.amount_total);
  const currency = String(session.currency ?? '').toUpperCase();
  if (!/^acct_[\w]+$/.test(connectedAccountId ?? '') || !paymentIntentId || !businessId || !invoiceId || !Number.isSafeInteger(amountTotal) || amountTotal <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    response.status(400).json({ error: 'Stripe payment event is missing verified invoice details.' }); return;
  }
  try {
    const admin = adminClient();
    const { data: owner, error: ownerError } = await admin.from('business_payment_accounts').select('business_id').eq('business_id', businessId).eq('stripe_account_id', connectedAccountId).maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) { response.status(400).json({ error: 'Stripe account is not connected to this business.' }); return; }
    const intent = await stripeRequest<any>(`/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`, { account: connectedAccountId });
    const methodType = intent.latest_charge?.payment_method_details?.type;
    const bankMethods = ['us_bank_account', 'sepa_debit', 'bacs_debit', 'au_becs_debit', 'customer_balance'];
    const method = methodType === 'upi' ? 'upi' : methodType === 'card' ? 'card' : bankMethods.includes(methodType) ? 'bank_transfer' : 'other';
    const digits = currencyDigits(currency);
    const { error } = await admin.rpc('record_bizpilot_stripe_payment', {
      target_invoice_id: invoiceId,
      target_business_id: businessId,
      payment_amount: amountTotal / (10 ** digits),
      payment_method: method,
      target_stripe_payment_intent_id: paymentIntentId,
      target_currency_code: currency,
    });
    if (error) throw error;
    response.json({ received: true });
  } catch (error) {
    console.error('Stripe payment could not be recorded:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'Payment was verified but could not yet be added to BizPilot.' });
  }
}
