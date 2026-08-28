'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';

const evidenceOptions = [
  ['parcel-record', 'Parcel record identified', 'You have the assessor/parcel record that identifies the real property.'],
  ['ownership-or-control', 'Ownership/control evidence ready', 'You can prove you own the property or are authorized to control its official digital twin.'],
  ['model-capture-rights', '3D capture rights confirmed', 'You have permission to scan, photograph or submit the building model.'],
];

function googleReturnUrl() {
  return new URL('/vault/properties/claim?auth=google', window.location.origin).toString();
}

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Google account');
}

export default function PropertyClaimPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [claims, setClaims] = useState([]);
  const [claimsState, setClaimsState] = useState('idle');
  const clientRef = useRef(null);
  const [form, setForm] = useState({
    countryCode: 'US',
    subdivisionCode: '',
    countyCode: '',
    parcelId: '',
    propertyLabel: '',
    locality: '',
    claimantRole: 'owner',
    ownerAuthorized: false,
    evidenceTypes: [],
  });

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleEvidence(type) {
    setForm((current) => ({
      ...current,
      evidenceTypes: current.evidenceTypes.includes(type)
        ? current.evidenceTypes.filter((item) => item !== type)
        : [...current.evidenceTypes, type],
    }));
  }

  async function refreshClaims(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) return;
    setClaimsState('loading');
    try {
      const response = await fetch('/api/vault/property-claims', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not load property claims.');
      setClaims(Array.isArray(data.claims) ? data.claims : []);
      setClaimsState('ready');
    } catch (error) {
      setClaims([]);
      setClaimsState('error');
      setMessage(error instanceof Error ? error.message : 'Could not load property claims.');
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
        setClaims([]);
        return;
      }
      setAuthState('signed-in');
      await refreshClaims(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/vault/properties/claim');
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
      setMessage(error instanceof Error ? error.message : 'Google account setup is incomplete.');
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
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.');
    }
  }

  async function submitClaim(event) {
    event.preventDefault();
    if (!session?.access_token || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/vault/property-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not submit the property claim.');
      setMessage(data?.nextStep || 'Claim submitted for review.');
      await refreshClaims(session.access_token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit the property claim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050706] px-4 py-6 text-white md:px-8 md:py-10">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/vault/properties" className="font-black text-white no-underline">← EARTH / Property Twins</Link>
          <Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/65 no-underline">My Vault</Link>
        </nav>

        <header className="max-w-4xl pb-10 pt-16 md:pt-24">
          <div className="text-[10px] font-black tracking-[.24em] text-[#9ff5df]/55">CLAIM MY PROPERTY · VERIFICATION GATE</div>
          <h1 className="mt-4 text-5xl font-black leading-[.86] tracking-[-.07em] md:text-7xl">One real parcel.<br /><span className="text-[#9ff5df]">One official twin.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/50">The official Property Passport is keyed from the assessor jurisdiction and parcel identifier—not a street-address string. A claim can enter review, but it cannot verify itself or mint the canonical Passport.</p>
        </header>

        {message ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-white/65">{message}</div> : null}

        {authState === 'loading' ? <Panel title="Checking identity…" copy="Loading your Voxel Vault session." /> : null}
        {authState === 'error' ? <Panel title="Identity unavailable" copy={message || 'Sign-in state could not be loaded.'} danger /> : null}
        {authState === 'signed-out' ? (
          <section className="rounded-[32px] border border-[#9ff5df]/15 bg-[#9ff5df]/[.035] p-8 md:p-10">
            <div className="text-[10px] font-black tracking-[.16em] text-[#9ff5df]/55">CLAIMS ARE USER-BOUND</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em] md:text-5xl">Sign in before claiming a real property.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">Creative house NFTs do not need this workflow. This gate exists only for the single official real-world Property Passport identity.</p>
            <button onClick={signIn} disabled={busy} className="mt-6 rounded-full bg-white px-6 py-3 text-xs font-black text-black disabled:opacity-40">SIGN IN WITH GOOGLE</button>
          </section>
        ) : null}

        {session?.user ? (
          <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            <form onSubmit={submitClaim} className="rounded-[32px] border border-white/10 bg-white/[.025] p-6 md:p-8">
              <div className="text-[10px] font-black tracking-[.16em] text-white/35">SIGNED IN · {userName(session.user)}</div>
              <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Reserve the canonical parcel identity.</h2>
              <p className="mt-3 text-xs leading-5 text-white/40">Do not paste deeds, IDs, bank information or private documents here. This milestone records only identity fields and evidence categories; actual document verification requires the secure review layer.</p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Field label="COUNTRY CODE" value={form.countryCode} onChange={(v) => patch('countryCode', v)} placeholder="US" />
                <Field label="STATE / SUBDIVISION" value={form.subdivisionCode} onChange={(v) => patch('subdivisionCode', v)} placeholder="NY" />
                <Field label="ASSESSOR JURISDICTION / COUNTY" value={form.countyCode} onChange={(v) => patch('countyCode', v)} placeholder="ERIE" />
                <Field label="PARCEL / APN" value={form.parcelId} onChange={(v) => patch('parcelId', v)} placeholder="Assessor parcel identifier" />
                <Field label="PROPERTY LABEL" value={form.propertyLabel} onChange={(v) => patch('propertyLabel', v)} placeholder="My home" />
                <Field label="LOCALITY" value={form.locality} onChange={(v) => patch('locality', v)} placeholder="Buffalo, NY" />
              </div>

              <label className="mt-4 grid gap-2 text-xs text-white/45">
                CLAIMANT ROLE
                <select value={form.claimantRole} onChange={(e) => patch('claimantRole', e.target.value)} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none">
                  <option value="owner">Property owner</option>
                  <option value="authorized-controller">Authorized controller / agent</option>
                </select>
              </label>

              <div className="mt-6 grid gap-2">
                {evidenceOptions.map(([type, title, copy]) => (
                  <label key={type} className="flex gap-3 rounded-2xl border border-white/8 bg-black/15 p-4 text-xs leading-5 text-white/50">
                    <input type="checkbox" checked={form.evidenceTypes.includes(type)} onChange={() => toggleEvidence(type)} className="mt-1" />
                    <span><b className="text-white/80">{title}</b><br />{copy}</span>
                  </label>
                ))}
              </div>

              <label className="mt-4 flex gap-3 rounded-2xl border border-amber-200/12 bg-amber-200/[.03] p-4 text-xs leading-5 text-white/55">
                <input type="checkbox" checked={form.ownerAuthorized} onChange={(e) => patch('ownerAuthorized', e.target.checked)} className="mt-1" />
                <span>I am the owner or I have authorization from the owner/controller to request the official real-world Property Passport. I understand this claim is not a deed transfer and does not create rent rights.</span>
              </label>

              <button type="submit" disabled={busy || !form.ownerAuthorized} className="mt-6 rounded-full bg-[#9ff5df] px-6 py-3 text-xs font-black text-[#07100e] disabled:opacity-35">{busy ? 'SUBMITTING…' : 'SUBMIT FOR VERIFICATION'}</button>
            </form>

            <aside className="grid content-start gap-4">
              <section className="rounded-[30px] border border-white/10 bg-white/[.025] p-6">
                <div className="text-[9px] font-black tracking-[.15em] text-white/35">WHY PARCEL ID?</div>
                <h3 className="mt-2 text-2xl font-black tracking-[-.04em]">Addresses are display text. Parcels are identity.</h3>
                <p className="mt-3 text-xs leading-5 text-white/45">Street names can be abbreviated, renamed or formatted differently. The normalized assessor jurisdiction + parcel/APN is hashed server-side into the canonical Voxel property fingerprint.</p>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-white/[.025] p-6">
                <div className="text-[9px] font-black tracking-[.15em] text-white/35">MY CLAIMS</div>
                {claimsState === 'loading' ? <p className="mt-3 text-sm text-white/45">Loading claims…</p> : null}
                {claimsState === 'ready' && !claims.length ? <p className="mt-3 text-sm leading-6 text-white/45">No official property claims yet.</p> : null}
                <div className="mt-4 grid gap-2">
                  {claims.map((claim) => (
                    <div key={claim.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="text-[9px] font-black tracking-[.13em] text-[#9ff5df]/55">{String(claim.status || '').toUpperCase()}</div>
                      <div className="mt-1 font-black">{claim.propertyLabel || 'Property claim'}</div>
                      <div className="mt-1 text-[11px] text-white/38">{claim.locality || 'Locality not shown'} · fingerprint …{claim.propertyFingerprintSuffix || 'pending'}</div>
                      <div className="mt-2 text-[11px] text-white/45">Passport mint: {claim.canonicalMintAllowed ? 'eligible after registry controls' : 'locked'}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[30px] border border-red-200/12 bg-red-200/[.025] p-6 text-xs leading-5 text-white/48">
                <b className="text-red-100/75">Fail-closed:</b> submitting all three evidence categories still only moves the claim to human review. It does not verify title, mint a Passport, transfer ownership, authorize a property purchase or create rental income rights.
              </section>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return <label className="grid gap-2 text-xs text-white/45">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/20" /></label>;
}

function Panel({ title, copy, danger = false }) {
  return <section className={`rounded-[30px] border p-7 ${danger ? 'border-red-200/15 bg-red-200/[.03]' : 'border-white/10 bg-white/[.025]'}`}><h2 className="text-2xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-white/45">{copy}</p></section>;
}
