import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import type { BusinessContext } from './supabase.js';
import { verifyStripeSignature } from './stripeConnect.js';

type BillingInterval = 'month' | 'year';
type SubscriptionRow = {
  plan_key: string;
  billing_interval: BillingInterval;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const FREE_INVENTORY_VARIANT_LIMIT = 50;
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

function subscriptionsEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_BIZPILOT_WEBHOOK_SECRET
    && process.env.STRIPE_BIZPILOT_PRO_MONTHLY_PRICE_ID && process.env.STRIPE_BIZPILOT_PRO_YEARLY_PRICE_ID);
}

const stripeApi = 'https://api.stripe.com/v1';
const priceIds: Record<BillingInterval, () => string | undefined> = {
  month: () => process.env.STRIPE_BIZPILOT_PRO_MONTHLY_PRICE_ID,
  year: () => process.env.STRIPE_BIZPILOT_PRO_YEARLY_PRICE_ID,
};

function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('BizPilot subscriptions are not configured yet.');
  return key;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Secure subscription storage is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clientOrigin() {
  const origin = process.env.CLIENT_ORIGIN ?? process.env.CORS_ORIGIN?.split(',')[0];
  if (!origin || (!/^https:\/\//i.test(origin) && !/^http:\/\/localhost(?::\d+)?$/i.test(origin))) {
    throw new Error('Set CLIENT_ORIGIN to the BizPilot website URL in the API environment.');
  }
  return origin.replace(/\/$/, '');
}

async function stripeRequest<T>(path: string, body?: URLSearchParams): Promise<T> {
  const response = await fetch(`${stripeApi}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: body.toString() } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    console.error(`Stripe Billing API error (${response.status}):`, payload.error?.message ?? response.statusText);
    throw new Error('Stripe could not complete the subscription request. Check the BizPilot plan setup.');
  }
  return payload;
}

async function requireBusinessOwner(context: BusinessContext) {
  const { data, error } = await context.client.from('businesses')
    .select('owner_id').eq('id', context.businessId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.owner_id !== context.userId) throw new Error('Only the business owner can manage the BizPilot subscription.');
}

async function subscriptionRow(businessId: string) {
  const { data, error } = await adminClient().from('business_subscriptions')
    .select('plan_key,billing_interval,status,stripe_customer_id,current_period_end,cancel_at_period_end')
    .eq('business_id', businessId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SubscriptionRow | null;
}

async function businessHasPro(context: BusinessContext) {
  const row = await subscriptionRow(context.businessId);
  return Boolean(row && row.plan_key === 'pro' && PRO_STATUSES.has(row.status));
}

export async function assertCanCreateInventoryVariant(context: BusinessContext) {
  if (!subscriptionsEnabled() || await businessHasPro(context)) return;
  const { count, error } = await context.client.from('inventory_items')
    .select('id', { count: 'exact', head: true }).eq('business_id', context.businessId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= FREE_INVENTORY_VARIANT_LIMIT) {
    const limitError = new Error(`The Free plan includes up to ${FREE_INVENTORY_VARIANT_LIMIT} product variants. Upgrade to BizPilot Pro for unlimited variants.`);
    Object.assign(limitError, { code: 'PRO_FEATURE_REQUIRED' });
    throw limitError;
  }
}

async function getPrice(interval: BillingInterval) {
  const id = priceIds[interval]();
  if (!id) return null;
  const price = await stripeRequest<{
    id: string; active: boolean; currency: string; unit_amount: number | null;
    recurring?: { interval: string; interval_count: number };
    product?: string | { name?: string };
  }>(`/prices/${encodeURIComponent(id)}?expand[]=product`);
  if (!price.active || price.recurring?.interval !== interval || price.unit_amount === null || !Number.isSafeInteger(price.unit_amount)) {
    throw new Error(`The BizPilot ${interval === 'month' ? 'monthly' : 'yearly'} Pro price is not active or has the wrong billing interval.`);
  }
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: price.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return {
    key: interval === 'month' ? 'pro_monthly' : 'pro_yearly',
    name: 'Pro', interval, currency: price.currency.toUpperCase(),
    amount: price.unit_amount / (10 ** digits),
    productName: typeof price.product === 'object' ? price.product.name ?? 'BizPilot Pro' : 'BizPilot Pro',
  };
}

export async function getBizPilotSubscription(context: BusinessContext) {
  const [row, owner] = await Promise.all([
    subscriptionRow(context.businessId),
    context.client.from('businesses').select('owner_id').eq('id', context.businessId).maybeSingle(),
  ]);
  if (owner.error) throw new Error(owner.error.message);
  const offers = process.env.STRIPE_SECRET_KEY
    ? (await Promise.all([getPrice('month'), getPrice('year')])).filter((price): price is NonNullable<typeof price> => Boolean(price))
    : [];
  const isPro = Boolean(row && row.plan_key === 'pro' && PRO_STATUSES.has(row.status));
  return {
    plan: isPro ? 'pro' : 'free',
    status: row?.status ?? 'free',
    billingInterval: row?.billing_interval ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    canManage: owner.data?.owner_id === context.userId,
    hasBillingAccount: Boolean(row?.stripe_customer_id),
    configured: subscriptionsEnabled() && offers.length === 2,
    offers,
    features: {
      inventoryVariantLimit: !subscriptionsEnabled() || isPro ? null : FREE_INVENTORY_VARIANT_LIMIT,
      lowStockAlerts: !subscriptionsEnabled() || isPro,
      detailedSalesAndProfitReports: !subscriptionsEnabled() || isPro,
    },
  };
}

export async function createBizPilotCheckout(context: BusinessContext, interval: BillingInterval) {
  await requireBusinessOwner(context);
  const price = priceIds[interval]();
  if (!price) throw new Error(`BizPilot Pro ${interval === 'month' ? 'monthly' : 'yearly'} pricing is not configured yet.`);
  const prior = await subscriptionRow(context.businessId);
  if (prior && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(prior.status)) {
    throw new Error('This business already has a subscription. Use Manage subscription to update it.');
  }
  const origin = clientOrigin();
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/?subscription=success`,
    cancel_url: `${origin}/?subscription=cancelled`,
    client_reference_id: context.businessId,
    'metadata[bizpilot_business_id]': context.businessId,
    'metadata[bizpilot_plan]': 'pro',
    'metadata[bizpilot_interval]': interval,
    'subscription_data[metadata][bizpilot_business_id]': context.businessId,
    'subscription_data[metadata][bizpilot_plan]': 'pro',
    'subscription_data[metadata][bizpilot_interval]': interval,
    allow_promotion_codes: 'true',
  });
  if (prior?.stripe_customer_id) form.set('customer', prior.stripe_customer_id);
  const session = await stripeRequest<{ url?: string }>('/checkout/sessions', form);
  if (!session.url) throw new Error('Stripe did not return a checkout page.');
  return { url: session.url };
}

export async function createBizPilotPortal(context: BusinessContext) {
  await requireBusinessOwner(context);
  const row = await subscriptionRow(context.businessId);
  if (!row?.stripe_customer_id) throw new Error('No BizPilot subscription is linked to this business yet.');
  const session = await stripeRequest<{ url?: string }>('/billing_portal/sessions', new URLSearchParams({
    customer: row.stripe_customer_id,
    return_url: `${clientOrigin()}/?subscription=returned`,
  }));
  if (!session.url) throw new Error('Stripe did not return a subscription management page.');
  return { url: session.url };
}

export async function handleBizPilotSubscriptionWebhook(request: Request, response: Response) {
  const secret = process.env.STRIPE_BIZPILOT_WEBHOOK_SECRET;
  if (!secret) { response.status(503).json({ error: 'BizPilot subscription webhooks are not configured.' }); return; }
  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
  if (!verifyStripeSignature(body, request.header('stripe-signature') ?? '', secret)) {
    response.status(400).json({ error: 'Invalid Stripe webhook signature.' }); return;
  }
  let event: any;
  try { event = JSON.parse(body.toString('utf8')); }
  catch { response.status(400).json({ error: 'Invalid Stripe webhook JSON.' }); return; }
  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    response.json({ received: true }); return;
  }
  const subscription = event.data?.object;
  const businessId = subscription?.metadata?.bizpilot_business_id;
  const customerId = typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id;
  const subscriptionId = subscription?.id;
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  const monthlyPriceId = priceIds.month();
  const yearlyPriceId = priceIds.year();
  const interval: BillingInterval | null = priceId && priceId === monthlyPriceId ? 'month'
    : priceId && priceId === yearlyPriceId ? 'year' : null;
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId) || !customerId || !subscriptionId || !interval
    || !Number.isSafeInteger(event.created) || !Number.isSafeInteger(subscription.current_period_end)) {
    response.status(400).json({ error: 'Subscription event is missing BizPilot plan details.' }); return;
  }
  try {
    const { error } = await adminClient().rpc('sync_bizpilot_subscription', {
      target_event_id: String(event.id),
      target_event_created_at: new Date(event.created * 1000).toISOString(),
      target_business_id: businessId,
      target_customer_id: customerId,
      target_subscription_id: subscriptionId,
      target_price_id: priceId,
      target_interval: interval,
      target_status: String(subscription.status ?? 'incomplete'),
      target_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      target_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    });
    if (error) throw error;
    response.json({ received: true });
  } catch (error) {
    console.error('BizPilot subscription event could not be recorded:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'The subscription event could not yet be recorded.' });
  }
}
