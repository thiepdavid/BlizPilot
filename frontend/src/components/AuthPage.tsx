import { useState, type FormEvent } from 'react';
import { Activity, ArrowRight, Eye, EyeOff } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './auth.css';

export function AuthPage({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-mark"><Activity size={20} strokeWidth={2.5}/></div><div><strong>bizpilot</strong><span>BUSINESS MANAGER</span></div></div><h1>{mode === 'signup' ? 'Set up your workspace' : 'Welcome back'}</h1><p className="auth-intro">{mode === 'signup' ? 'Create your account and business workspace.' : 'Sign in to continue to your business.'}</p><form onSubmit={submit}>{mode === 'signup' && <><label>Your name<input name="fullName" required minLength={2} placeholder="Rahul Sharma" autoComplete="name"/></label><label>Business name<input name="businessName" required minLength={2} placeholder="Studio Saanvi" autoComplete="organization"/></label></>}<label>Email address<input type="email" name="email" required autoComplete="email" placeholder="you@example.com"/></label><label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters"/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>{error && <div className="auth-error" role="alert">{error}</div>}{notice && <div className="auth-notice" role="status">{notice}</div>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={16}/>}</button></form><div className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to BizPilot?'} <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setNotice(''); }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></div><p className="auth-security">Your business data is protected by Supabase authentication and row-level security.</p></section><footer className="auth-footer">BizPilot · A calmer way to run your business</footer></main>;
}
