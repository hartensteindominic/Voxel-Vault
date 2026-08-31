'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import BankClient from './BankClient';
import GalacticCryptoPractice from './GalacticCryptoPractice';
import GalacticDashboardAccountState from './GalacticDashboardAccountState';
import GalacticDashboardEnhancements from './GalacticDashboardEnhancements';
import GalacticDemoHint from './GalacticDemoHint';
import GalacticHeaderCenter from './GalacticHeaderCenter';
import GalacticIncreaseSandboxRecovery from './GalacticIncreaseSandboxRecovery';
import GalacticSandboxSetup from './GalacticSandboxSetup';

function userLabel(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Galactic member');
}

function returnUrl() {
  if (typeof window === 'undefined') return '/bank';
  return new URL('/bank', window.location.origin).toString();
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
            <span className="gt-auth-kicker">✦ FINANCIAL APP · PRODUCTION GATED</span>
            <h1>Welcome to your<br /><em>financial galaxy.</em></h1>
            <p>Sign in to keep your Galactic Trust preferences and demo activity connected to your account across devices. Real banking remains locked until an approved sponsor-bank program is live.</p>
            <div className="gt-auth-trust-row"><span>🔒 Protected session</span><span>✦ Account sign-in</span><span>◈ Live banking locked</span></div>
          </div>
          <section className="gt-auth-card">
            <div className="gt-auth-card-head"><span>🪐</span><div><h2>Enter Galactic Trust</h2><p>Create an account or sign back in.</p></div></div>
            <button className="gt-auth-google" type="button" onClick={googleSignIn} disabled={busy}><span>G</span>{busy ? 'Opening sign-in…' : 'Continue with Google'}</button>
            <div className="gt-auth-divider"><span>or</span></div>
            <form onSubmit={emailSignIn}>
              <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
              <button className="gt-auth-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a secure sign-in link'}</button>
            </form>
            <button className="gt-auth-demo" type="button" onClick={() => setDemoAccess(true)}>Explore the Stars demo →</button>
            {status && <p className="gt-auth-status" role="status">{status}</p>}
            <small className="gt-auth-legal">Galactic Trust is a financial technology product, not a bank. This is currently a simulated banking experience. No real deposits are held and no real money moves. <a href="/bank/readiness">View regulated launch status.</a></small>
          </section>
        </section>
      </main>
    );
  }

  const activeSignOut = session?.user ? signOut : () => setDemoAccess(false);
  const label = session?.user ? userLabel(session.user) : 'Demo Explorer';
  const accessToken = session?.access_token || '';

  return (
    <>
      <BankClient galacticUser={session?.user || null} demoAccess={demoAccess} onSignOut={activeSignOut} accountLabel={label} accessToken={accessToken} />
      <GalacticDemoHint />
      <GalacticCryptoPractice />
      <GalacticDashboardEnhancements onSignOut={activeSignOut} accountLabel={label} />
      <GalacticDashboardAccountState accessToken={accessToken} demoAccess={demoAccess} />
      <GalacticHeaderCenter accessToken={accessToken} demoAccess={demoAccess} accountLabel={label} onSignOut={activeSignOut} />
      {session?.user && <GalacticSandboxSetup accessToken={accessToken} />}
      {session?.user && <GalacticIncreaseSandboxRecovery />}
    </>
  );
}
