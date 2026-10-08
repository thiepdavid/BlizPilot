import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(url && anonKey);

export interface BusinessContext { client: SupabaseClient; businessId: string; userId: string }
export interface AuthenticatedRequest extends Request { businessContext?: BusinessContext }

export async function businessAuth(request: Request, response: Response, next: NextFunction) {
  if (!supabaseConfigured) {
    if (process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'The business API is temporarily unavailable.' });
    return next();
  }
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return response.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const client = createClient(url!, anonKey!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: { user }, error } = await client.auth.getUser(authorization.slice('Bearer '.length));
    if (error || !user) return response.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    const { data: membership, error: membershipError } = await client.from('business_users').select('business_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return response.status(403).json({ error: 'No business workspace is linked to this account. Run the BizPilot database setup SQL, then sign up again.' });
    (request as AuthenticatedRequest).businessContext = { client, userId: user.id, businessId: membership.business_id as string };
    next();
  } catch (error) {
    console.error('Supabase authentication error:', error);
    response.status(503).json({ error: 'Could not verify your account with Supabase.' });
  }
}
