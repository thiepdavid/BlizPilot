import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import type { BusinessContext } from './supabase.js';

type RazorpayLink = { id: string; short_url: string; amount: number; status: string };

export async function createRazorpayPaymentLink(context: BusinessContext, invoiceId: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Online payments are not configured yet. Add the Razorpay test keys in Render.');

  const business = await context.client.from('businesses').select('currency_code').eq('id', context.businessId).single();
  if (business.error) throw new Error(business.error.message);
  if ((business.data.currency_code ?? 'INR') !== 'INR') throw new Error('Razorpay payment links are currently available for INR businesses only.');

  const { data: invoice, error } = await context.client.from('invoices')
    .select('id,business_id,invoice_number,description,total,paid_amount,customers(full_name,email,phone)')
    .eq('id', invoiceId).eq('business_id', context.businessId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error('Choose an invoice in your business workspace.');
  const amount = Math.round((Number(invoice.total) - Number(invoice.paid_amount ?? 0)) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('This invoice has no remaining balance.');

  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  const payload = {
    amount,
    currency: 'INR',
    accept_partial: false,
    reference_id: `BP${randomUUID().replaceAll('-', '').slice(0, 32)}`,
    description: `BizPilot invoice ${invoice.invoice_number}`,
    customer: {
      name: customer?.full_name ?? 'Customer',
      ...(customer?.email ? { email: customer.email } : {}),
      ...(customer?.phone ? { contact: customer.phone } : {}),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: {
      bizpilot_invoice_id: invoice.id,
      bizpilot_business_id: invoice.business_id,
      bizpilot_invoice_number: invoice.invoice_number,
    },
  };
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const result = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await result.json() as RazorpayLink & { error?: { description?: string } };
  if (!result.ok || !data.short_url) {
    console.error('Razorpay link creation failed:', data.error?.description ?? result.statusText);
    throw new Error('Razorpay could not create the payment link. Check your account and test keys in Render.');
  }
  return { url: data.short_url, amount: amount / 100, status: data.status, provider: 'Razorpay' as const };
}

function validSignature(body: Buffer, signature: string, secret: string) {
  const received = Buffer.from(signature, 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function handleRazorpayWebhook(request: Request, response: Response) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!secret || !serviceKey || !supabaseUrl) {
    response.status(503).json({ error: 'Razorpay webhook processing is not configured.' });
    return;
  }
  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
  const signature = request.header('x-razorpay-signature') ?? '';
  if (!validSignature(body, signature, secret)) {
    response.status(400).json({ error: 'Invalid webhook signature.' });
    return;
  }
  let event: any;
  try { event = JSON.parse(body.toString('utf8')); }
  catch { response.status(400).json({ error: 'Invalid webhook JSON.' }); return; }
  if (event.event !== 'payment_link.paid') { response.json({ received: true }); return; }

  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  const invoiceId = link?.notes?.bizpilot_invoice_id;
  const businessId = link?.notes?.bizpilot_business_id;
  const paymentId = payment?.id;
  const minorAmount = Number(payment?.amount);
  if (link?.status !== 'paid' || payment?.status !== 'captured' || !invoiceId || !businessId || !paymentId || !Number.isSafeInteger(minorAmount) || minorAmount <= 0) {
    response.status(400).json({ error: 'Payment event is missing verified invoice details.' });
    return;
  }

  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const method = payment.method === 'upi' ? 'upi' : payment.method === 'card' ? 'card' : 'other';
  const { error } = await client.rpc('record_bizpilot_razorpay_payment', {
    target_invoice_id: invoiceId,
    target_business_id: businessId,
    payment_amount: minorAmount / 100,
    payment_method: method,
    target_razorpay_payment_id: paymentId,
  });
  if (error) {
    console.error('Razorpay payment could not be recorded:', error.message);
    response.status(500).json({ error: 'Payment was verified but could not yet be added to BizPilot.' });
    return;
  }
  response.json({ received: true });
}
