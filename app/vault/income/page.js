'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { normalizeObservedIncome, summarizeObservedIncome } from '../../../lib/vault/income';
import IncomeCenterCanvas from './IncomeCenterCanvas';

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Google account');
}

function googleReturnUrl() {
  return new URL('/vault/income?auth=google', window.location.origin).toString();
}

function money(amount, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase();
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Number.isFinite(value) ? value.toFixed(4) : '0.0000'} ${code}`;
  }
}

function dateLabel(value) {
  if (!value) return 'Not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not reported';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function IncomeCenterPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [providerState, setProviderState] = useState({ mode: 'idle', snapshot: null, error: '' });
  const clientRef = useRef(null);

  const records = useMemo(() => normalizeObservedIncome(providerState.snapshot?.dividends || [], {
    provider: providerState.snapshot?.provider || 'Dinari',
    environment: providerState.snapshot?.environment || 'sandbox',
    accountScope: 'user-bound',
  }), [providerState.snapshot]);
  const summary = useMemo(() => summarizeObservedIncome(records), [records]);
  const bound = providerState.snapshot?.bound === true;
  const bindingSuffix = String(providerState.snapshot?.binding?.accountSuffix || '');

  async function refreshProvider(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) {
      setProviderState({ mode: 'idle', snapshot: null, error: '' });
      return;
    }

    setProviderState((current) => ({ ...current, mode: 'loading', error: '' }));
    try {
      const response = await fetch('/api/vault/digital-reits', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const snapshot = await response.json().catch(() => ({}));
      if (!response.ok || snapshot?.ok === false) throw new Error(snapshot?.error || 'Could not read your user-bound provider income records.');
      setProviderState({ mode: 'ready', snapshot, error: '' });
    } catch (error) {
      setProviderState({ mode: 'error', snapshot: null, error: error instanceof Error ? error.message : 'Could not read your user-bound provider income records.' });
    }
  }

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function apply(next) {
      if (!active) return;
      setSession(next);
      if (!next?.user) {
        setAuthState('signed-out');
        setProviderState({ mode: 'idle', snapshot: null, error: '' });
        return;
      }
      setAuthState('signed-in');
      await refreshProvider(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/vault/income');
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setAccountMessage(error.message);
      } else {
        await apply(data.session);
      }
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setAuthState('error');
      setAccountMessage(error instanceof Error ? error.message : 'Google account setup is incomplete.');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setAccountMessage('');
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !status?.supabaseConfigured) throw new Error('Google sign-in still needs the Voxel Vault Supabase public configuration.');
      if (status.googleProviderEnabled !== true) throw new Error('Google sign-in is connected to Supabase, but the Google provider is not enabled yet.');
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: googleReturnUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.');
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setAuthState('signed-out');
      setProviderState({ mode: 'idle', snapshot: null, error: '' });
      setAccountMessage('Signed out. Personal provider income records are hidden.');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  const environment = String(providerState.snapshot?.environment || 'sandbox').toUpperCase();
  const provider = String(providerState.snapshot?.provider || 'Dinari');

  return (
    <main className="min-h-screen bg-[#05080a] text-white px-4 py-5 md:px-8 md:py-8">
      <section className="max-w-7xl mx-auto">
        <nav className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/vault" className="flex items-center gap-2 no-underline text-white font-black tracking-[-.03em]">
            <span className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center">V</span>
            Voxel Vault
          </Link>
          <div className="flex gap-2 flex-wrap text-xs">
            <Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">My Vault</Link>
            <Link href="/real-estate/reits" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Digital REIT pilot</Link>
            <Link href="/real-estate" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Real Property</Link>
          </div>
        </nav>

        <header className="pt-16 pb-9 md:pt-24 md:pb-12 max-w-5xl">
          <div className="text-[10px] tracking-[.28em] font-black text-white/40">MY VAULT · INCOME CENTER</div>
          <h1 className="text-5xl md:text-8xl font-black tracking-[-.075em] leading-[.86] mt-4">See what the provider<br /><span className="text-[#9ff5df]">actually reports.</span></h1>
          <p className="text-base md:text-lg text-white/55 leading-7 max-w-3xl mt-7">
            The Income Center turns verified, user-bound Digital REIT dividend-payment records into a spatial history. It does not project yield, convert currencies, call security dividends “rent,” or invent direct-property distributions.
          </p>
        </header>

        {authState === 'loading' ? <StatusBox>Checking your Voxel Vault identity…</StatusBox> : null}
        {authState === 'error' ? <ErrorBox>{accountMessage || 'Google account state could not be loaded.'}</ErrorBox> : null}
        {authState === 'signed-out' ? (
          <section className="rounded-[30px] border border-[#9ff5df]/15 bg-[#9ff5df]/[.035] p-8 md:p-10 mb-6 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[10px] tracking-[.16em] font-black text-[#9ff5df]/55">PERSONAL PROVIDER DATA LOCKED</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">Sign in before income enters the room.</h2>
              <p className="text-white/50 leading-7 mt-4 max-w-2xl">The public sandbox pilot may use a configured provider account. The personal Income Center never inherits that account. It requires your verified Google/Supabase identity and your own server-side provider binding.</p>
            </div>
            <button onClick={signIn} disabled={busy} className="rounded-full bg-white text-black px-6 py-3 text-xs font-black disabled:opacity-40">{busy ? 'CONNECTING…' : 'SIGN IN WITH GOOGLE'}</button>
          </section>
        ) : null}

        {session?.user ? (
          <div className="flex items-center gap-2 flex-wrap mb-5 text-xs">
            <span className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2">SIGNED IN · {userName(session.user)}</span>
            <span className={`rounded-full border px-4 py-2 font-bold ${bound ? 'border-[#9ff5df]/20 bg-[#9ff5df]/10 text-[#cafff2]' : 'border-amber-200/20 bg-amber-200/[.06] text-amber-100'}`}>
              {bound ? `${provider.toUpperCase()} ${environment} · USER BOUND${bindingSuffix ? ` · …${bindingSuffix}` : ''}` : 'NO VERIFIED PROVIDER BINDING'}
            </span>
            <button onClick={() => refreshProvider(session.access_token || '')} disabled={providerState.mode === 'loading'} className="rounded-full border border-white/10 px-4 py-2 text-white/70 disabled:opacity-40">{providerState.mode === 'loading' ? 'REFRESHING…' : 'Refresh income'}</button>
            <button onClick={signOut} disabled={busy} className="rounded-full border border-white/10 px-4 py-2 text-white/45 disabled:opacity-40">Sign out</button>
          </div>
        ) : null}

        {accountMessage && authState !== 'error' ? <StatusBox>{accountMessage}</StatusBox> : null}
        {providerState.error ? <ErrorBox>{providerState.error}</ErrorBox> : null}
        {Array.isArray(providerState.snapshot?.errors) && providerState.snapshot.errors.length ? <ErrorBox>{providerState.snapshot.errors.join(' · ')}</ErrorBox> : null}

        {session?.user && providerState.mode === 'loading' ? <StatusBox>Reading the provider account bound to this identity…</StatusBox> : null}

        {session?.user && providerState.mode === 'ready' && !bound ? (
          <section className="rounded-[30px] border border-dashed border-amber-200/20 bg-amber-200/[.035] p-8 md:p-10 mb-6">
            <div className="text-[10px] tracking-[.16em] font-black text-amber-100/55">FAIL-CLOSED IDENTITY GATE</div>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">No provider account is attributed to you.</h2>
            <p className="text-white/50 leading-7 mt-4 max-w-3xl">{providerState.snapshot?.setupRequired
              ? 'Provider-binding storage has not been applied to the connected Supabase project. The Income Center is deliberately empty until migration 014 exists and a verified account is bound.'
              : 'This Voxel Vault user does not have a verified provider-account binding. The Income Center is deliberately empty instead of displaying the owner/pilot account as yours.'}</p>
            <div className="flex gap-2 flex-wrap mt-6">
              <Link href="/real-estate/reits" className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black no-underline">Open sandbox pilot</Link>
              <Link href="/vault" className="rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/70 no-underline">Back to My Vault</Link>
            </div>
          </section>
        ) : null}

        {session?.user && providerState.mode === 'ready' && bound ? (
          <>
            {environment === 'SANDBOX' ? (
              <div className="rounded-2xl border border-sky-200/15 bg-sky-200/[.04] px-4 py-3 mb-5 text-xs leading-5 text-sky-100/70">
                SANDBOX DATA · These records are from the provider test environment and are not real-money income.
              </div>
            ) : null}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <Stat label="PAYMENT RECORDS" value={summary.count} note="Positive provider records" />
              <Stat label="USD REPORTED" value={money(summary.usdObserved, 'USD')} note="USD records only · no FX conversion" />
              <Stat label="CURRENCIES" value={summary.currencyCount} note="Reported separately" />
              <Stat label="LATEST PAYABLE DATE" value={summary.latestPayableDate ? dateLabel(summary.latestPayableDate) : '—'} note="Provider field" small />
            </section>

            <IncomeCenterCanvas records={records} />

            <section className="mt-6 grid lg:grid-cols-[1fr_.72fr] gap-4">
              <article className="rounded-[30px] border border-white/10 bg-white/[.025] p-6 md:p-8">
                <div className="text-[10px] tracking-[.17em] font-black text-white/35">PROVIDER PAYMENT HISTORY</div>
                <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">Observed, not projected.</h2>
                <p className="text-sm leading-6 text-white/45 mt-4 max-w-2xl">Amounts below come from the bound provider account’s dividend-payment records. Different currencies remain separate; Voxel Vault does not manufacture an exchange rate or estimated yield.</p>

                {records.length ? (
                  <div className="grid gap-2 mt-6">
                    {records.map((record) => (
                      <div key={record.id} className="grid sm:grid-cols-[1fr_auto] gap-3 items-center rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div>
                          <div className="text-[9px] tracking-[.15em] font-black text-[#9ff5df]/55">USER-BOUND PROVIDER PAYMENT</div>
                          <div className="text-xl font-black mt-1">{record.symbol || 'Dividend payment'}</div>
                          <div className="text-[11px] text-white/40 mt-1">{dateLabel(record.payableDate)} · {record.status || 'Provider status not supplied'}</div>
                        </div>
                        <div className="sm:text-right">
                          <div className="text-xl font-black">{money(record.amount, record.currency)}</div>
                          <div className="text-[10px] text-white/35 mt-1">{record.currency} · provider reported</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 p-7 text-center mt-6 text-sm text-white/45">No positive provider dividend-payment records are currently reported for this bound account.</div>
                )}
              </article>

              <aside className="rounded-[30px] border border-amber-200/15 bg-amber-200/[.035] p-6 md:p-8">
                <div className="text-[10px] tracking-[.17em] font-black text-amber-100/55">DIRECT PROPERTY DISTRIBUTIONS · LOCKED</div>
                <h2 className="text-3xl font-black tracking-[-.05em] mt-3">Rent is not a REIT dividend.</h2>
                <p className="text-sm leading-6 text-white/50 mt-4">This chamber will eventually contain approved net distributions from legally connected direct property. It stays empty until Voxel Vault has holder-specific legal rights, property accounting, expense/reserve waterfalls, approved distribution statements and reconciliation.</p>
                <div className="grid gap-2 mt-6 text-xs">
                  {['Tenant/property cash received through normal rails','Property expenses and reserves accounted for','Net distributable income approved','Holder snapshot / entitlement reconciled','Only then: distribution appears here'].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/15 p-3">
                      <span className="w-7 h-7 rounded-full border border-amber-100/20 grid place-items-center font-black text-amber-100/60">{index + 1}</span>
                      <span className="text-white/55">{item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/real-estate" className="inline-flex mt-6 rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/70 no-underline">View Real Property pilot →</Link>
              </aside>
            </section>

            {summary.currencies.length > 1 ? (
              <section className="mt-4 rounded-[28px] border border-white/10 bg-white/[.02] p-6">
                <div className="text-[10px] tracking-[.16em] font-black text-white/35">CURRENCY TOTALS · NO FX CONVERSION</div>
                <div className="flex gap-2 flex-wrap mt-4">
                  {summary.currencies.map((item) => <span key={item.currency} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-bold">{money(item.amount, item.currency)}</span>)}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <footer className="border-t border-white/10 mt-16 pt-7 pb-8 flex justify-between gap-6 flex-wrap text-[11px] leading-5 text-white/35">
          <div><b className="text-white/60">Voxel Vault · Income Center</b><br />Spatial history for verified provider payment records.</div>
          <div className="max-w-xl">No yield projection · no currency conversion · no property-rent claim from securities data · direct-property distributions remain locked until legal and accounting production gates are satisfied.</div>
        </footer>
      </section>
    </main>
  );
}

function Stat({ label, value, note, small = false }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4 md:p-5"><div className="text-[9px] tracking-[.15em] font-black text-white/35">{label}</div><div className={`${small ? 'text-lg md:text-xl' : 'text-2xl md:text-3xl'} font-black tracking-[-.045em] mt-2`}>{value}</div><div className="text-[10px] text-white/35 mt-1">{note}</div></div>;
}

function StatusBox({ children }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 mb-5 text-sm text-white/60">{children}</div>;
}

function ErrorBox({ children }) {
  return <div role="alert" className="rounded-2xl border border-red-300/20 bg-red-300/[.06] px-4 py-3 mb-5 text-sm text-red-100/80">{children}</div>;
}
