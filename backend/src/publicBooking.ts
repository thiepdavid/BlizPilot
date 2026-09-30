import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { BusinessContext } from './supabase.js';

function anonymousClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Public booking needs Supabase configured on the API.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function ensurePublicBookingPage(context: BusinessContext) {
  const { data: business, error } = await context.client.from('businesses').select('name').eq('id', context.businessId).single();
  if (error) throw new Error(error.message);
  const namePart = String(business.name ?? 'business').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'business';
  const slug = `${namePart}-${randomUUID().slice(0, 8)}`;
  const { data, error: pageError } = await context.client.rpc('create_public_booking_page', { target_business_id: context.businessId, target_slug: slug });
  if (pageError) throw new Error(pageError.message);
  return String(data);
}

export async function getBusinessBookingHours(context: BusinessContext) {
  const { data, error } = await context.client.rpc('get_business_booking_hours', { target_business_id: context.businessId });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveBusinessBookingHours(context: BusinessContext, hours: Record<string, unknown>) {
  const { data, error } = await context.client.rpc('save_business_booking_hours', { target_business_id: context.businessId, target_hours: hours });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBusinessBookingClosures(context: BusinessContext) {
  const { data, error } = await context.client.rpc('get_business_booking_closures', { target_business_id: context.businessId });
  if (error) throw new Error(error.message);
  return data as string[];
}

export async function saveBusinessBookingClosures(context: BusinessContext, dates: string[]) {
  const { data, error } = await context.client.rpc('save_business_booking_closures', { target_business_id: context.businessId, target_dates: dates });
  if (error) throw new Error(error.message);
  return data as string[];
}

export async function getPublicBookingPage(slug: string) {
  const { data, error } = await anonymousClient().rpc('get_public_booking_page', { target_slug: slug });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data;
}

export async function getPublicBookingBusyTimes(slug: string, date: string) {
  const { data, error } = await anonymousClient().rpc('get_public_booking_busy_times', { target_slug: slug, target_date: date });
  if (error) throw new Error(error.message);
  return data as Array<{ startsAt: string; endsAt: string }>;
}

export async function createPublicBookingRequest(slug: string, input: { name: string; phone: string; email: string; serviceId: string; startsAt: string }) {
  const { data, error } = await anonymousClient().rpc('request_public_booking', {
    target_slug: slug,
    customer_name: input.name,
    customer_phone: input.phone || null,
    customer_email: input.email || null,
    target_service_id: input.serviceId,
    requested_start: input.startsAt,
  });
  if (error) throw new Error(error.message);
  return data;
}

const hourlyRequests = new Map<string, { count: number; resetAt: number }>();
export function publicBookingRateLimit(request: { ip?: string }, response: { status(code: number): { json(body: unknown): unknown } }, next: () => void) {
  const key = request.ip || 'unknown';
  const now = Date.now();
  const current = hourlyRequests.get(key);
  if (!current || current.resetAt <= now) hourlyRequests.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
  else if (current.count >= 12) { response.status(429).json({ error: 'Too many booking requests. Please try again later.' }); return; }
  else current.count += 1;
  if (hourlyRequests.size > 5_000) for (const [ip, value] of hourlyRequests) if (value.resetAt <= now) hourlyRequests.delete(ip);
  next();
}
