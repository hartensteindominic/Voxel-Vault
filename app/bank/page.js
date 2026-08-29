'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

function money(amount, currency = 'USD') {
  const value = Number(amount || 0);
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Number.isFinite(value) ? value.toFixed(2) : '0.00'} ${code}`;
  }
}

function dateLabel(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Galactic Trust member');
}

function googleReturnUrl() {
  return new URL('/bank?auth=google', window.location.origin).toString();
}

function currencyBalances(cash = []) {
  const totals = new Map();
  for (const row of Array.isArray(cash) ? cash : []) {
    const symbol = String(row?.symbol || '').toUpperCase();
    const amount = Number(row?.amount || 0);
    if (!symbol || !Number.isFinite(amount)) continue;
    totals.set(symbol, (totals.get(symbol) || 0) + amount);
  }
  return [...totals.entries()].map(([symbol, amount]) => ({ symbol, amount }));
}

function StatusPill({ children, tone = 'neutral' }) {
  const tones = {
    good: 'border-emerald-200/20 bg-emerald-200/10 text-emerald-100',
    warn: 'border-amber-200/20 bg-amber-200/[.08] text-amber-100',
    info: 'border-sky-200/20 bg-sky-200/[.08] text-sky-100',
    neutral: 'border-white/10 bg-white/[.05] text-white/65',
  };
  return <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[.08em] ${tones[tone] || tones.neutral}`}>{children}</span>;
}

function Metric({ label, value, note }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[.04] p-4 md:p-5 min-h-[132px] flex flex-col justify-between">
      <div className="text-[10px] font-black tracking-[.16em] text-white/35">{label}</div>
      <div>
        <div className="text-2xl md:text-3xl font-black tracking-[-.045em]">{value}</div>
        <div className="text-[11px] leading-5 text-white/38 mt-1">{note}</div>
      </div>
    </article>
  );
}

export default function GalacticTrustPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [providerState, setProviderState] = useState({ mode: 'idle', snapshot: null, error: '' });
  const clientRef = useRef(null);

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
      if (!response.ok || snapshot?.ok === false) throw new Error(snapshot?.error || 'Could not read your provider-backed financial snapshot.');
      setProviderState({ mode: 'ready', snapshot, error: '' });
    } catch (error) {
      setProviderState({ mode: 'error', snapshot: null, error: error instanceof Error ? error.message : 'Could not read your provider-backed financial snapshot.' });
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
        window.history.replaceState({}, '', '/bank');
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setMessage(error.message);
      } else {
        await apply(data.session);
      }
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setAuthState('error');
      setMessage(error instanceof Error ? error.message : 'Account setup is incomplete.');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !status?.supabaseConfigured) throw new Error('Google sign-in still needs the Voxel Vault Supabase public configuration.');
      if (status.googleProviderEnabled !== true) throw new Error('Google sign-in is connected to Supabase, but the Google provider is not enabled yet.');
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.');
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
      setMessage('Signed out. Private financial data is hidden.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  const snapshot = providerState.snapshot;
  const bound = snapshot?.bound === true;
  const provider = String(snapshot?.provider || 'Dinari');
  const environment = String(snapshot?.environment || 'sandbox').toUpperCase();
  const bindingSuffix = String(snapshot?.binding?.accountSuffix || '');
  const balances = useMemo(() => currencyBalances(snapshot?.cash || []), [snapshot]);
  const usdCash = balances.find((row) => row.symbol === 'USD')?.amount || 0;
  const positions = Array.isArray(snapshot?.portfolio) ? snapshot.portfolio : [];
  const dividends = Array.isArray(snapshot?.dividends) ? snapshot.dividends : [];
  const recentActivity = useMemo(() => [...dividends]
    .sort((a, b) => new Date(b?.payableDate || 0).getTime() - new Date(a?.payableDate || 0).getTime())
    .slice(0, 6), [dividends]);

  function movementLocked() {
    setMessage('Money movement is locked. Galactic Trust will not simulate a successful deposit, transfer, card charge, or withdrawal until a regulated money-movement provider, identity checks, and required compliance controls are actually connected.');
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white px-4 pb-28 pt-4 md:px-7 md:pt-6 selection:bg-emerald-200 selection:text-black">
      <section className="max-w-7xl mx-auto">
        <nav className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="flex items-center gap-3 no-underline text-white">
            <span className="w-10 h-10 rounded-2xl bg-[#b8ffdf] text-[#07110f] grid place-items-center font-black shadow-[0_12px_34px_rgba(114,255,195,.16)]">G</span>
            <span>
              <b className="block tracking-[-.03em]">Galactic Trust</b>
              <span className="block text-[9px] tracking-[.18em] font-black text-white/35 mt-0.5">A VOXEL VAULT FINANCIAL EXPERIENCE</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/vault" className="rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-xs font-bold text-white/60 no-underline">My Vault</Link>
            <Link href="/vault/income" className="rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-xs font-bold text-white/60 no-underline">Income</Link>
            {session?.user ? <button onClick={signOut} disabled={busy} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/45 disabled:opacity-40">Sign out</button> : null}
          </div>
        </nav>

        <header className="grid lg:grid-cols-[1fr_.55fr] gap-8 items-end pt-14 pb-7 md:pt-20 md:pb-9">
          <div>
            <div className="flex gap-2 flex-wrap mb-5">
              <StatusPill tone="good">GALACTIC TRUST BETA</StatusPill>
              <StatusPill tone={bound ? (environment === 'LIVE' ? 'good' : 'info') : 'warn'}>{bound ? `${provider.toUpperCase()} ${environment}` : 'PROVIDER LOCKED'}</StatusPill>
              <StatusPill>READ-ONLY MONEY LAYER</StatusPill>
            </div>
            <h1 className="text-[clamp(3.6rem,10vw,8.6rem)] leading-[.76] font-black tracking-[-.085em] max-w-5xl">Your money,<br/><span className="text-[#b8ffdf]">across the galaxy.</span></h1>
            <p className="text-sm md:text-lg leading-7 text-white/48 max-w-2xl mt-7">A single financial home for provider-reported cash, investment positions and income history inside Voxel Vault. Nothing is labeled spendable or moved unless the connected provider actually says it is.</p>
          </div>
          <div className="lg:text-right">
            <div className="text-[10px] tracking-[.16em] font-black text-white/30">CURRENT IDENTITY</div>
            <div className="text-lg font-black tracking-[-.03em] mt-2">{session?.user ? userName(session.user) : 'Not signed in'}</div>
            <div className="text-xs text-white/35 mt-1">{bound ? `Verified provider binding${bindingSuffix ? ` · …${bindingSuffix}` : ''}` : 'Private provider data remains hidden'}</div>
          </div>
        </header>

        {authState === 'loading' ? <div className="rounded-3xl border border-white/10 bg-white/[.035] p-5 mb-4 text-sm text-white/55">Checking your Voxel Vault identity…</div> : null}
        {authState === 'error' ? <div className="rounded-3xl border border-rose-200/15 bg-rose-200/[.05] p-5 mb-4 text-sm text-rose-100/80">{message || 'Account state could not be loaded.'}</div> : null}

        {authState === 'signed-out' ? (
          <section className="rounded-[34px] border border-[#b8ffdf]/15 bg-[#b8ffdf]/[.045] p-6 md:p-9 mb-5 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[10px] tracking-[.16em] font-black text-[#b8ffdf]/55">PRIVATE FINANCIAL VIEW</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-2">Sign in to open Galactic Trust.</h2>
              <p className="text-sm leading-6 text-white/45 mt-3 max-w-2xl">The page does not borrow a shared pilot account. Your cash, positions and income stay empty until your Voxel Vault identity is verified and a provider account is explicitly bound to it.</p>
            </div>
            <button onClick={signIn} disabled={busy} className="rounded-full bg-[#b8ffdf] text-[#07110f] px-6 py-3 text-xs font-black disabled:opacity-40">{busy ? 'CONNECTING…' : 'SIGN IN WITH GOOGLE'}</button>
          </section>
        ) : null}

        {message && authState !== 'error' ? (
          <div className="rounded-3xl border border-white/10 bg-white/[.04] p-4 md:p-5 mb-4 flex items-start justify-between gap-4 text-sm leading-6 text-white/60">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-white/35 font-black" aria-label="Dismiss message">×</button>
          </div>
        ) : null}

        {providerState.error ? <div className="rounded-3xl border border-rose-200/15 bg-rose-200/[.05] p-5 mb-4 text-sm text-rose-100/80">{providerState.error}</div> : null}
        {Array.isArray(snapshot?.errors) && snapshot.errors.length ? <div className="rounded-3xl border border-amber-200/15 bg-amber-200/[.05] p-5 mb-4 text-sm text-amber-100/75">{snapshot.errors.join(' · ')}</div> : null}

        {session?.user ? (
          <section className="rounded-[38px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(184,255,223,.13),transparent_38%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-5 md:p-8 shadow-[0_35px_100px_rgba(0,0,0,.28)]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10px] tracking-[.17em] font-black text-white/35">PROVIDER-REPORTED USD CASH</div>
                <div className="text-5xl md:text-7xl font-black tracking-[-.07em] mt-2">{bound ? money(usdCash) : '—'}</div>
                <div className="text-xs text-white/38 mt-2">{bound ? `${provider} ${environment}${environment === 'SANDBOX' ? ' · test environment, not real-money cash' : ''}` : 'No verified account binding'}</div>
              </div>
              <button onClick={() => refreshProvider(session.access_token || '')} disabled={providerState.mode === 'loading'} className="rounded-full border border-white/10 bg-white/[.05] px-4 py-2.5 text-xs font-black text-white/65 disabled:opacity-40">{providerState.mode === 'loading' ? 'REFRESHING…' : 'REFRESH'}</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-8">
              {['Add money', 'Send', 'Transfer', 'Withdraw'].map((label) => (
                <button key={label} onClick={movementLocked} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left hover:bg-white/[.06] transition-colors">
                  <span className="block text-lg font-black tracking-[-.03em]">{label}</span>
                  <span className="block text-[10px] text-white/35 mt-1">Provider gate required</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {session?.user && providerState.mode === 'ready' && !bound ? (
          <section className="rounded-[34px] border border-dashed border-amber-200/20 bg-amber-200/[.04] p-6 md:p-9 mt-4">
            <StatusPill tone="warn">FAIL-CLOSED ACCOUNT GATE</StatusPill>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-4">Your identity is ready. Your provider account is not.</h2>
            <p className="text-sm md:text-base leading-7 text-white/48 max-w-3xl mt-4">{snapshot?.setupRequired ? 'The user-to-provider binding storage still needs to be installed. Until it exists, Galactic Trust intentionally shows no balances.' : 'No provider account is verified for this Voxel Vault user. Galactic Trust will not display a global owner or pilot account as if it belongs to you.'}</p>
            <div className="flex gap-2 flex-wrap mt-6">
              <Link href="/real-estate/reits" className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black no-underline">Open provider pilot</Link>
              <Link href="/admin/integrations" className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-bold text-white/65 no-underline">Provider setup</Link>
            </div>
          </section>
        ) : null}

        {session?.user && providerState.mode === 'ready' && bound ? (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <Metric label="CASH CURRENCIES" value={balances.length} note={balances.length ? balances.map((row) => `${row.symbol} ${money(row.amount, row.symbol)}`).join(' · ') : 'No cash balances reported'} />
              <Metric label="INVESTMENT POSITIONS" value={positions.length} note="Quantity only · no invented market value" />
              <Metric label="INCOME RECORDS" value={dividends.length} note="Provider-reported dividend payments" />
              <Metric label="MONEY MOVEMENT" value="Locked" note="No simulated transfers or withdrawals" />
            </section>

            <section className="grid lg:grid-cols-[1.18fr_.82fr] gap-4 mt-4">
              <article className="rounded-[34px] border border-white/10 bg-white/[.035] p-5 md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] tracking-[.17em] font-black text-white/30">RECENT ACTIVITY</div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-[-.055em] mt-2">Money history</h2>
                  </div>
                  <Link href="/vault/income" className="text-xs font-black text-[#b8ffdf] no-underline">FULL INCOME →</Link>
                </div>

                <div className="grid gap-2 mt-6">
                  {recentActivity.length ? recentActivity.map((record) => (
                    <div key={record.id || `${record.symbol}-${record.payableDate}`} className="grid grid-cols-[1fr_auto] gap-4 items-center rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div>
                        <div className="text-sm font-black">{record.symbol || 'Provider payment'}</div>
                        <div className="text-[10px] text-white/35 mt-1">{dateLabel(record.payableDate)} · {record.status || 'Provider status unavailable'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-[#b8ffdf]">+{money(record.amount, record.currency || 'USD')}</div>
                        <div className="text-[9px] text-white/28 mt-1">provider reported</div>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/38">No provider payment records were returned for this account.</div>}
                </div>
              </article>

              <aside className="grid gap-4">
                <article className="rounded-[34px] border border-[#b8ffdf]/15 bg-[#b8ffdf]/[.045] p-6 md:p-7">
                  <div className="text-[10px] tracking-[.17em] font-black text-[#b8ffdf]/55">ACCOUNT SECURITY</div>
                  <h3 className="text-2xl font-black tracking-[-.04em] mt-3">Identity-bound by design.</h3>
                  <div className="grid gap-3 mt-5 text-sm text-white/52">
                    <div className="flex justify-between gap-4"><span>Voxel identity</span><b className="text-white">Verified</b></div>
                    <div className="flex justify-between gap-4"><span>Provider binding</span><b className="text-white">{bound ? 'Verified' : 'Locked'}</b></div>
                    <div className="flex justify-between gap-4"><span>Environment</span><b className="text-white">{environment}</b></div>
                    <div className="flex justify-between gap-4"><span>Money movement</span><b className="text-amber-100">Disabled</b></div>
                  </div>
                </article>

                <article className="rounded-[34px] border border-white/10 bg-white/[.035] p-6 md:p-7">
                  <div className="text-[10px] tracking-[.17em] font-black text-white/30">GALACTIC CARD</div>
                  <div className="rounded-[25px] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(184,255,223,.28),transparent_35%),linear-gradient(135deg,#173f34,#091310)] p-5 mt-4 aspect-[1.58/1] flex flex-col justify-between shadow-[0_24px_70px_rgba(0,0,0,.3)]">
                    <div className="flex justify-between items-start"><b>GALACTIC TRUST</b><span className="text-[9px] tracking-[.18em] text-white/45">DIGITAL CARD</span></div>
                    <div>
                      <div className="text-xl tracking-[.22em] font-black">•••• •••• •••• ••••</div>
                      <div className="text-[10px] text-white/40 mt-2">Preview only · no card issued or spending rail connected</div>
                    </div>
                  </div>
                </article>
              </aside>
            </section>
          </>
        ) : null}

        <section className="rounded-[34px] border border-white/10 bg-black/20 p-6 md:p-8 mt-4">
          <div className="grid lg:grid-cols-[1fr_.8fr] gap-8">
            <div>
              <div className="text-[10px] tracking-[.17em] font-black text-white/30">GALACTIC TRUST STATUS</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">A financial command center, not a fake bank license.</h2>
            </div>
            <p className="text-sm leading-7 text-white/42">Galactic Trust is currently a Voxel Vault financial experience, not a chartered bank. The interface does not promise deposit insurance, custody, card issuance, lending, or money transmission. Financial data comes from explicitly user-bound providers when configured. Deposits, payments, cards and withdrawals stay locked until the appropriate regulated provider and compliance path are genuinely live.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
