'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';

const requiredEvidence = ['parcel-record', 'ownership-or-control', 'model-capture-rights'];

function googleReturnUrl() {
  return new URL('/admin/property-claims?auth=google', window.location.origin).toString();
}

export default function PropertyClaimsAdminPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [claims, setClaims] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState({});
  const [evidenceReviewed, setEvidenceReviewed] = useState({});
  const [authoritative, setAuthoritative] = useState({});
  const clientRef = useRef(null);

  async function refresh(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) return;
    setBusy('refresh');
    try {
      const response = await fetch('/api/admin/property-claims', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not load property claims.');
      setClaims(Array.isArray(data.claims) ? data.claims : []);
      setMessage('');
    } catch (error) {
      setClaims([]);
      setMessage(error instanceof Error ? error.message : 'Could not load property claims.');
    } finally {
      setBusy('');
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
      await refresh(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/admin/property-claims');
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
      setMessage(error instanceof Error ? error.message : 'Admin sign-in setup is incomplete.');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    setBusy('signin');
    setMessage('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(error instanceof Error ? error.message : 'Could not start admin sign-in.');
    }
  }

  async function decide(claim, decision) {
    if (!session?.access_token || busy) return;
    const reviewerNote = String(notes[claim.id] ?? claim.reviewerNote ?? '').trim();
    const authoritativeValue = authoritative[claim.id] || {};
    const authoritativeNamespace = String(authoritativeValue.namespace || '').trim();
    const authoritativeParcelId = String(authoritativeValue.parcelId || '').trim();
    const authoritativeSource = String(authoritativeValue.source || '').trim();

    if (reviewerNote.length < 20) {
      setMessage('Add a reviewer note of at least 20 characters describing what was checked.');
      return;
    }
    if (decision === 'verified' && evidenceReviewed[claim.id] !== true) {
      setMessage('Confirm that you independently reviewed the external evidence before verifying this claim.');
      return;
    }
    if (decision === 'verified' && (!authoritativeNamespace || !authoritativeParcelId || authoritativeSource.length < 5)) {
      setMessage('Enter the official jurisdiction namespace/code, authoritative parcel/APN, and the source you checked before verifying.');
      return;
    }

    setBusy(claim.id);
    setMessage('');
    try {
      const response = await fetch('/api/admin/property-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          claimId: claim.id,
          decision,
          reviewerNote,
          evidenceVerified: decision === 'verified' && evidenceReviewed[claim.id] === true,
          authoritativeNamespace: decision === 'verified' ? authoritativeNamespace : '',
          authoritativeParcelId: decision === 'verified' ? authoritativeParcelId : '',
          authoritativeSource: decision === 'verified' ? authoritativeSource : '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Claim decision failed.');
      setMessage(data?.nextStep || `Claim marked ${decision}.`);
      setEvidenceReviewed((current) => ({ ...current, [claim.id]: false }));
      setAuthoritative((current) => ({ ...current, [claim.id]: {} }));
      await refresh(session.access_token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim decision failed.');
    } finally {
      setBusy('');
    }
  }

  function setAuthoritativeField(claimId, field, value) {
    setAuthoritative((current) => ({
      ...current,
      [claimId]: {
        ...(current[claimId] || {}),
        [field]: value,
      },
    }));
  }

  return (
    <main className="min-h-screen bg-[#050706] px-4 py-6 text-white md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/vault/properties" className="font-black text-white no-underline">Voxel Vault · Property Review</Link>
          <div className="flex gap-2 text-xs">
            <Link href="/vault/properties/claim" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">User claim flow</Link>
            <Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">My Vault</Link>
          </div>
        </nav>

        <header className="max-w-5xl pb-10 pt-16 md:pt-24">
          <div className="text-[10px] font-black tracking-[.22em] text-amber-100/50">OWNER TOOL · PROPERTY CLAIM REVIEW</div>
          <h1 className="mt-4 text-5xl font-black leading-[.86] tracking-[-.07em] md:text-7xl">Verify evidence.<br /><span className="text-[#9ff5df]">Never guess ownership.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/50">This console can approve or reject the off-chain canonical claim after evidence is independently checked. Approval also requires one authoritative assessor/title parcel key. It cannot mark the Base registry verified, mint a Property Passport, transfer a deed or create rent rights.</p>
        </header>

        {message ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-white/65">{message}</div> : null}

        {authState === 'loading' ? <StateCard title="Checking admin identity…" copy="Loading your Google/Supabase session." /> : null}
        {authState === 'error' ? <StateCard title="Admin identity unavailable" copy={message || 'Could not load admin identity.'} danger /> : null}
        {authState === 'signed-out' ? (
          <StateCard title="Owner allowlist required" copy="Sign in with the Google account configured in VOXEL_VAULT_ADMIN_EMAILS or VOXEL_VAULT_ADMIN_USER_IDS." action={<button onClick={signIn} disabled={Boolean(busy)} className="mt-5 rounded-full bg-white px-6 py-3 text-xs font-black text-black disabled:opacity-40">SIGN IN WITH GOOGLE</button>} />
        ) : null}

        {session?.user ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[.03] px-4 py-2">ADMIN SESSION · {session.user.email || session.user.id}</span>
              <button onClick={() => refresh(session.access_token || '')} disabled={Boolean(busy)} className="rounded-full border border-white/10 px-4 py-2 text-white/60 disabled:opacity-40">{busy === 'refresh' ? 'REFRESHING…' : 'Refresh queue'}</button>
            </div>

            <section className="mb-5 grid gap-3 md:grid-cols-4">
              <Stat label="TOTAL CLAIMS" value={claims.length} />
              <Stat label="UNDER REVIEW" value={claims.filter((item) => item.status === 'under-review').length} />
              <Stat label="VERIFIED" value={claims.filter((item) => item.status === 'verified').length} />
              <Stat label="PASSPORT MINTS HERE" value="0" />
            </section>

            {!claims.length && busy !== 'refresh' ? <StateCard title="No claims in the queue" copy="User-submitted official property claims will appear here after migrations 015, 016 and 018 are applied." /> : null}

            <div className="grid gap-4">
              {claims.map((claim) => {
                const locked = ['verified', 'rejected', 'withdrawn'].includes(claim.status);
                const evidenceComplete = requiredEvidence.every((type) => claim.evidenceTypes.includes(type));
                const noteValue = notes[claim.id] ?? claim.reviewerNote ?? '';
                const authoritativeValue = authoritative[claim.id] || {};
                const authoritativeComplete = String(authoritativeValue.namespace || '').trim().length > 0
                  && String(authoritativeValue.parcelId || '').trim().length > 0
                  && String(authoritativeValue.source || '').trim().length >= 5;
                const canVerify = claim.status === 'under-review'
                  && evidenceComplete
                  && evidenceReviewed[claim.id] === true
                  && authoritativeComplete
                  && String(noteValue).trim().length >= 20;

                return (
                  <article key={claim.id} className="rounded-[30px] border border-white/10 bg-white/[.025] p-6 md:p-8">
                    <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
                      <div>
                        <div className="flex flex-wrap gap-2 text-[9px] font-black tracking-[.12em]">
                          <span className="rounded-full border border-[#9ff5df]/15 px-3 py-1.5 text-[#bffff0]">{String(claim.status || '').toUpperCase()}</span>
                          <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/40">{String(claim.claimantRole || '').toUpperCase()}</span>
                          <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/40">CANDIDATE …{claim.identity?.fingerprintSuffix}</span>
                          {claim.identity?.verifiedPropertyFingerprintSuffix ? <span className="rounded-full border border-emerald-200/15 px-3 py-1.5 text-emerald-100/60">AUTHORITATIVE …{claim.identity.verifiedPropertyFingerprintSuffix}</span> : null}
                        </div>
                        <h2 className="mt-4 text-3xl font-black tracking-[-.05em]">{claim.propertyLabel || 'Property claim'}</h2>
                        <p className="mt-1 text-sm text-white/40">{claim.locality || 'No locality label'} · claimant …{claim.claimantUserSuffix || 'unknown'}</p>

                        <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
                          <Detail label="COUNTRY" value={claim.identity?.countryCode || '—'} />
                          <Detail label="SUBDIVISION" value={claim.identity?.subdivisionCode || '—'} />
                          <Detail label="CLAIMED ASSESSOR JURISDICTION" value={claim.identity?.countyCode || '—'} />
                          <Detail label="CLAIMED NORMALIZED PARCEL / APN" value={claim.identity?.parcelIdNormalized || '—'} />
                          <Detail label="AUTHORITATIVE NAMESPACE" value={claim.identity?.verifiedPropertyNamespace || 'NOT VERIFIED'} />
                          <Detail label="AUTHORITATIVE SOURCE" value={claim.identity?.verifiedPropertySource || 'NOT VERIFIED'} />
                          <Detail label="REGISTRY VERIFIED" value={claim.identity?.registryVerified ? 'YES' : 'NO'} />
                          <Detail label="PASSPORT TOKEN" value={claim.identity?.passportTokenId || 'NONE'} />
                        </div>

                        <div className="mt-5 grid gap-2">
                          {requiredEvidence.map((type) => (
                            <div key={type} className={`rounded-2xl border p-3 text-xs ${claim.evidenceTypes.includes(type) ? 'border-emerald-200/12 bg-emerald-200/[.03] text-emerald-100/65' : 'border-amber-200/12 bg-amber-200/[.03] text-amber-100/60'}`}>{claim.evidenceTypes.includes(type) ? '✓' : '○'} {type.replaceAll('-', ' ')}</div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/8 bg-black/15 p-5">
                        <div className="text-[9px] font-black tracking-[.14em] text-white/35">REVIEW DECISION</div>
                        <p className="mt-3 text-xs leading-5 text-white/43">The category checkmarks are claimant-supplied metadata, not proof. Independently inspect the real assessor/ownership/authorization evidence outside this screen before approving.</p>
                        <textarea value={noteValue} onChange={(event) => setNotes((current) => ({ ...current, [claim.id]: event.target.value }))} disabled={locked} placeholder="Required reviewer note (20+ characters): what was checked, source/date, and why the decision is justified." className="mt-4 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-white/20 disabled:opacity-50" />

                        {!locked && claim.status === 'under-review' ? (
                          <div className="mt-4 rounded-2xl border border-[#9ff5df]/12 bg-[#9ff5df]/[.025] p-4">
                            <div className="text-[9px] font-black tracking-[.14em] text-[#bffff0]/65">AUTHORITATIVE PARCEL KEY · REQUIRED</div>
                            <p className="mt-2 text-[11px] leading-5 text-white/45">Use a stable official jurisdiction namespace/code such as state + county FIPS, SWIS, or assessor-system ID. Do not use a free-form county name or street address.</p>
                            <input value={authoritativeValue.namespace || ''} onChange={(event) => setAuthoritativeField(claim.id, 'namespace', event.target.value)} placeholder="Official jurisdiction namespace/code" className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20" />
                            <input value={authoritativeValue.parcelId || ''} onChange={(event) => setAuthoritativeField(claim.id, 'parcelId', event.target.value)} placeholder="Authoritative parcel / APN exactly from source" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20" />
                            <input value={authoritativeValue.source || ''} onChange={(event) => setAuthoritativeField(claim.id, 'source', event.target.value)} placeholder="Official source checked + date" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20" />
                          </div>
                        ) : null}

                        {!locked && claim.status === 'under-review' ? (
                          <label className="mt-4 flex cursor-pointer gap-3 rounded-2xl border border-amber-100/12 bg-amber-100/[.025] p-4 text-xs leading-5 text-white/55">
                            <input type="checkbox" checked={evidenceReviewed[claim.id] === true} onChange={(event) => setEvidenceReviewed((current) => ({ ...current, [claim.id]: event.target.checked }))} className="mt-1" />
                            <span>I independently reviewed the external parcel record, ownership/control evidence, 3D capture authorization, and the authoritative jurisdiction + parcel key. I understand this approval verifies only the Voxel Vault off-chain identity and does not change the deed or mint a token.</span>
                          </label>
                        ) : null}

                        {locked ? (
                          <div className="mt-4 rounded-2xl border border-emerald-200/12 bg-emerald-200/[.03] p-4 text-xs leading-5 text-emerald-100/65">This claim is in a terminal review state. Registry anchoring and Passport minting remain separate locked steps.</div>
                        ) : (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={() => decide(claim, 'verified')} disabled={busy === claim.id || !canVerify} className="rounded-full bg-[#9ff5df] px-5 py-2.5 text-xs font-black text-[#07100e] disabled:opacity-30">VERIFY CLAIM</button>
                            <button onClick={() => decide(claim, 'needs-evidence')} disabled={busy === claim.id || String(noteValue).trim().length < 20} className="rounded-full border border-amber-200/20 px-5 py-2.5 text-xs font-black text-amber-100/70 disabled:opacity-30">NEEDS EVIDENCE</button>
                            <button onClick={() => decide(claim, 'rejected')} disabled={busy === claim.id || String(noteValue).trim().length < 20} className="rounded-full border border-red-200/20 px-5 py-2.5 text-xs font-black text-red-100/70 disabled:opacity-30">REJECT</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function StateCard({ title, copy, action = null, danger = false }) {
  return <section className={`rounded-[30px] border p-7 ${danger ? 'border-red-200/15 bg-red-200/[.03]' : 'border-white/10 bg-white/[.025]'}`}><h2 className="text-2xl font-black">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">{copy}</p>{action}</section>;
}

function Stat({ label, value }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4"><div className="text-[9px] font-black tracking-[.14em] text-white/35">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function Detail({ label, value }) {
  return <div className="rounded-2xl border border-white/8 bg-black/15 p-3"><div className="text-[8px] font-black tracking-[.11em] text-white/30">{label}</div><div className="mt-1 break-all font-bold text-white/68">{value}</div></div>;
}
