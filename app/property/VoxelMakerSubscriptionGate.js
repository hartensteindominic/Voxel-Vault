'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { VOXEL_MAKER_PLANS, formatVoxelMakerPrice } from '../../lib/voxel-maker-plans';
import styles from './PropertyStudio.module.css';

function clean(value) { return String(value || '').trim(); }

function Topbar() {
  return <header className={styles.topbar}>
    <Link className={styles.brand} href="/">
      <span className={styles.brandMark}>V</span>
      <span>VOXEL VAULT</span>
    </Link>
    <nav className={styles.nav} aria-label="Voxel Vault navigation">
      <Link href="/property">Create</Link>
      <Link href="/vault/property-drafts">Inventory</Link>
    </nav>
  </header>;
}

export default function VoxelMakerSubscriptionGate({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busyPlan, setBusyPlan] = useState('');
  const [message, setMessage] = useState('');
  const clientRef = useRef(null);
  const autoCheckoutRef = useRef(false);

  const loadStatus = useCallback(async (accessToken) => {
    if (!accessToken) {
      setSubscription(null);
      return null;
    }
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/voxel-maker/subscription/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not check your Voxel Maker plan.');
      setSubscription(data);
      return data;
    } catch (error) {
      setMessage(clean(error?.message || error || 'Could not check your Voxel Maker plan.'));
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let authSubscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      const nextSession = data.session || null;
      setSession(nextSession);
      setReady(true);
      if (nextSession?.access_token) loadStatus(nextSession.access_token);
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setReady(true);
        if (next?.access_token) loadStatus(next.access_token);
        else setSubscription(null);
      });
      authSubscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setReady(true);
        setMessage('Sign-in is unavailable on this deployment.');
      }
    });
    return () => { active = false; authSubscription?.unsubscribe?.(); };
  }, [loadStatus]);

  async function signInForPlan(planId) {
    setBusyPlan(planId);
    setMessage('Opening secure sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const redirect = new URL('/property', window.location.origin);
      redirect.searchParams.set('choose', planId);
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.toString() } });
      if (error) throw error;
    } catch (error) {
      setBusyPlan('');
      setMessage(clean(error?.message || error || 'Could not sign in.'));
    }
  }

  const checkout = useCallback(async (planId) => {
    if (!session?.access_token) return signInForPlan(planId);
    setBusyPlan(planId);
    setMessage('Opening secure monthly checkout…');
    try {
      const response = await fetch('/api/voxel-maker/subscription/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (data?.active) {
        await loadStatus(session.access_token);
        setBusyPlan('');
        return;
      }
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout is unavailable.');
      window.location.assign(data.url);
    } catch (error) {
      setBusyPlan('');
      setMessage(clean(error?.message || error || 'Checkout is unavailable.'));
    }
  }, [session?.access_token, loadStatus]);

  useEffect(() => {
    if (!ready || !session?.access_token || loadingStatus || subscription?.active || autoCheckoutRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const planId = clean(params.get('choose')).toLowerCase();
    if (!VOXEL_MAKER_PLANS.some((plan) => plan.id === planId)) return;
    autoCheckoutRef.current = true;
    params.delete('choose');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
    checkout(planId);
  }, [ready, session?.access_token, subscription?.active, loadingStatus, checkout]);

  useEffect(() => {
    if (!session?.access_token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') !== 'success') return;
    let cancelled = false;
    let attempts = 0;
    const refresh = async () => {
      attempts += 1;
      const result = await loadStatus(session.access_token);
      if (cancelled || result?.active || attempts >= 4) return;
      window.setTimeout(refresh, 900);
    };
    refresh();
    params.delete('subscription');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
    return () => { cancelled = true; };
  }, [session?.access_token, loadStatus]);

  async function manageBilling() {
    if (!session?.access_token) return;
    setMessage('Opening billing…');
    try {
      const response = await fetch('/api/voxel-maker/subscription/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Billing management is unavailable.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(clean(error?.message || error || 'Billing management is unavailable.'));
    }
  }

  if (!ready) return <main className={styles.pricingPage}><section className={styles.pricingShell}><Topbar/><div className={styles.signInCard}><div className={styles.signInVoxel} aria-hidden="true"/><p className={styles.eyebrow}>VOXEL MAKER</p><h1>Opening the studio…</h1></div></section></main>;

  if (subscription?.active) {
    const used = Number(subscription?.usage?.used || 0);
    const limit = Number(subscription?.usage?.limit || subscription?.plan?.monthlyVoxels || 0);
    return <>
      <div className={styles.planBar}>
        <div className={styles.planIdentity}><span className={styles.planDot}/><strong>{subscription.plan?.name} plan</strong><small>{used}/{limit} creations this month</small></div>
        <div className={styles.planActions}><span>{formatVoxelMakerPrice(subscription.plan?.priceCents || 0)}/mo</span>{subscription.canManageBilling ? <button type="button" onClick={manageBilling}>Manage plan</button> : null}</div>
      </div>
      {children}
    </>;
  }

  return <main className={styles.pricingPage}><section className={styles.pricingShell}>
    <Topbar/>
    <header className={styles.pricingHero}>
      <p className={styles.eyebrow}>PROPERTY STUDIO</p>
      <h1>Photos become <em>collectible places.</em></h1>
      <p>Choose a plan, then use the same simple studio every time: photo, address, voxel preview, 3D build, Inventory.</p>
      <div className={styles.flowRibbon} aria-label="Property creation flow"><span>PHOTO</span><b>→</b><span>ADDRESS</span><b>→</b><span>VOXEL</span><b>→</b><span>3D</span><b>→</b><span>VAULT</span></div>
    </header>

    <div className={styles.planHeading}><p className={styles.eyebrow}>MONTHLY PLANS</p><h2>Pick how much you create.</h2><p>Cancel anytime. Minting is always optional.</p></div>

    <div className={styles.planGrid}>
      {VOXEL_MAKER_PLANS.map((plan) => <article key={plan.id} className={styles.planCard}>
        <div className={styles.planCardTop}><div><p>{plan.name}</p>{plan.badge ? <span className={styles.planBadge}>{plan.badge}</span> : null}</div><strong>{formatVoxelMakerPrice(plan.priceCents)}<small>/mo</small></strong></div>
        <h3>{plan.monthlyVoxels} voxels / month</h3>
        <p className={styles.planBlurb}>{plan.blurb}</p>
        <ul className={styles.planFeatures}>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
        <button type="button" onClick={() => checkout(plan.id)} disabled={Boolean(busyPlan)}>{busyPlan === plan.id ? 'Opening…' : session?.user ? `Choose ${plan.name}` : `Start ${plan.name}`}</button>
      </article>)}
    </div>

    {!session?.user ? <p className={styles.status}>Choosing a plan starts with Google sign-in so your voxels stay attached to your Inventory.</p> : null}
    {loadingStatus ? <p className={styles.status}>Checking your subscription…</p> : message ? <p className={styles.status} role="status">{message}</p> : null}
    <p className={styles.finePrint}>Plans cover the creation allowance shown above. Minting a digital voxel does not create ownership rights in the physical property.</p>
  </section></main>;
}
