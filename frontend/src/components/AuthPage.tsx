import { useEffect, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import type { SupabaseClient } from '@supabase/supabase-js';
import './auth.css';

const nativeOAuthRedirect = 'com.thiepdavidthiep.blizpilot://login-callback';

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="oauth-google-mark"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.88c-.58 2.96-2.28 5.48-4.81 7.18l7.73 6C44.31 37.99 46.98 31.93 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;
}

export function AuthPage({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const onOAuthError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) { setError(detail); setBusy(false); }
    };
    window.addEventListener('bizpilot-oauth-error', onOAuthError);
    return () => window.removeEventListener('bizpilot-oauth-error', onOAuthError);
  }, []);
  async function signInWithProvider(provider: 'apple' | 'google') {
    const isNative = Capacitor.isNativePlatform();
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: authError } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: isNative ? nativeOAuthRedirect : `${window.location.origin}/`,
          skipBrowserRedirect: isNative,
        },
      });
      if (authError) throw authError;
      if (isNative) {
        if (!data.url) throw new Error('The sign-in provider did not return an authorization page.');
        await Browser.open({ url: data.url });
        setBusy(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start provider sign-in.');
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: String(form.get('fullName') ?? '').trim(), business_name: String(form.get('businessName') ?? '').trim() } } });
        if (authError) throw authError;
        if (!data.session) setNotice('Account created. Check your email to confirm your account, then sign in.');
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete sign in.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-mark"><Activity size={20} strokeWidth={2.5}/></div><div><strong>BlizPilot</strong><span>BUSINESS MANAGER</span></div></div><h1>{mode === 'signup' ? 'Set up your workspace' : 'Welcome back'}</h1><p className="auth-intro">{mode === 'signup' ? 'Create your account and business workspace.' : 'Sign in to continue to your business.'}</p><form onSubmit={submit}>{mode === 'signup' && <><label>Your name<input name="fullName" required minLength={2} placeholder="Alex Morgan" autoComplete="name"/></label><label>Business name<input name="businessName" required minLength={2} placeholder="Brightside Studio" autoComplete="organization"/></label></>}<label>Email address<input type="email" name="email" required autoComplete="email" placeholder="you@example.com"/></label><label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters"/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>{error && <div className="auth-error" role="alert">{error}</div>}{notice && <div className="auth-notice" role="status">{notice}</div>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={16}/>}</button></form><div className="auth-divider"><span>or continue with</span></div><div className="oauth-buttons"><button type="button" className="oauth-button" onClick={() => void signInWithProvider('apple')} disabled={busy}><svg aria-hidden="true" viewBox="0 0 24 24" className="oauth-apple-mark"><path fill="currentColor" d="M16.37 12.62c.02 2.15 1.89 2.87 1.91 2.88-.02.05-.3 1.03-.98 2.04-.59.87-1.2 1.73-2.16 1.75-.94.02-1.24-.57-2.31-.57s-1.4.55-2.28.59c-.91.03-1.61-.94-2.2-1.81-1.2-1.75-2.11-4.95-.88-7.1.61-1.07 1.7-1.75 2.88-1.77.9-.02 1.75.61 2.31.61.56 0 1.6-.75 2.69-.64.46.02 1.75.19 2.58 1.43-.07.04-1.54.9-1.55 2.59ZM14.6 6.44c.48-.58.8-1.39.71-2.19-.69.03-1.53.46-2.03 1.03-.44.51-.82 1.33-.72 2.11.77.06 1.56-.39 2.04-.95Z"/></svg>Continue with Apple</button><button type="button" className="oauth-button" onClick={() => void signInWithProvider('google')} disabled={busy}><GoogleMark/>Continue with Google</button></div><div className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to BlizPilot?'} <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setNotice(''); }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></div><p className="auth-security">Your business data is protected by Supabase authentication and row-level security.</p></section><footer className="auth-footer"><span>BlizPilot · A calmer way to run your business</span><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer></main>;
}
