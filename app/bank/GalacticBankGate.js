'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import BankClient from './BankClient';

function userLabel(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Galactic member');
}

function returnUrl() {
  if (typeof window === 'undefined') return '/';
  const url = new URL('/', window.location.origin);
  url.searchParams.set('auth', 'galactic');
  return url.toString();
}

export default function GalacticBankGate() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [demoAccess, setDemoAccess] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const clientRef = useRef(null);

  useEffect(() => {
    let active = true;
    let subscription;

    async function start() {
      try {
        const client = await getSupabaseBrowserAsync();
        if (!active) return;
        clientRef.current = client;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data.session || null);
        subscription = client.auth.onAuthStateChange((_event, nextSession) => {
          if (active) setSession(nextSession || null);
        }).data.subscription;
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : 'Account sign-in is temporarily unavailable.');
      } finally {
        if (active) setReady(true);
      }
    }

    start();
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function googleSignIn() {
    setBusy(true);
    setStatus('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: returnUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open Google sign-in.');
      setBusy(false);
    }
  }

  async function emailSignIn(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setStatus('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: returnUrl(), shouldCreateUser: true },
      });
      if (error) throw error;
      setStatus('Check your email for your secure Galactic Trust sign-in link.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not send your sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setStatus('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setDemoAccess(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="gt-auth-page">
        <div className="gt-auth-stars" aria-hidden="true" />
        <section className="gt-auth-card gt-auth-loading">
          <span className="gt-auth-orbit">✦</span>
          <h1>Opening your galaxy…</h1>
          <p>Checking your secure Galactic Trust session.</p>
        </section>
      </main>
    );
  }

  if (!session?.user && !demoAccess) {
    return (
      <main className="gt-auth-page">
        <div className="gt-auth-stars" aria-hidden="true" />
        <section className="gt-auth-shell">
          <div className="gt-auth-brand">
            <span className="gt-auth-planet"><i /></span>
            <div><strong>Galactic Trust</strong><small>Your money. Your galaxy.</small></div>
          </div>
          <div className="gt-auth-copy">
            <span className="gt-auth-kicker">✦ SECURE DIGITAL BANKING DEMO</span>
            <h1>Welcome to your<br /><em>financial galaxy.</em></h1>
            <p>Sign in to keep your Galactic Trust demo preferences and activity connected to your account across devices.</p>
            <div className="gt-auth-trust-row"><span>🔒 Protected session</span><span>✦ Private by design</span><span>◈ Demo money only</span></div>
          </div>
          <section className="gt-auth-card">
            <div className="gt-auth-card-head"><span>🪐</span><div><h2>Enter Galactic Trust</h2><p>Create an account or sign back in.</p></div></div>
            <button className="gt-auth-google" type="button" onClick={googleSignIn} disabled={busy}><span>G</span>{busy ? 'Opening sign-in…' : 'Continue with Google'}</button>
            <div className="gt-auth-divider"><span>or</span></div>
            <form onSubmit={emailSignIn}>
              <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
              <button className="gt-auth-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a secure sign-in link'}</button>
            </form>
            <button className="gt-auth-demo" type="button" onClick={() => setDemoAccess(true)}>Explore the demo first →</button>
            {status && <p className="gt-auth-status" role="status">{status}</p>}
            <small className="gt-auth-legal">Galactic Trust is currently a simulated banking experience. No real deposits are held and no real money moves.</small>
          </section>
        </section>
      </main>
    );
  }

  return <BankClient galacticUser={session?.user || null} demoAccess={demoAccess} onSignOut={session?.user ? signOut : () => setDemoAccess(false)} accountLabel={session?.user ? userLabel(session.user) : 'Demo Explorer'} />;
}
