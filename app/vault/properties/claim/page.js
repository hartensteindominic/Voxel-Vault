'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import styles from './claim.module.css';

const evidenceOptions = [
  ['parcel-record', 'I have the parcel record.'],
  ['ownership-or-control', 'I can prove ownership or authorization.'],
  ['model-capture-rights', 'I have permission to use the property photo / 3D capture.'],
];

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Google account');
}

function identityReady(form) {
  const country = String(form.countryCode || '').trim().toUpperCase();
  return country.length === 2
    && (country !== 'US' || Boolean(String(form.subdivisionCode || '').trim()))
    && Boolean(String(form.countyCode || '').trim())
    && Boolean(String(form.parcelId || '').trim());
}

function statusCopy(status) {
  if (!status) return 'Enter the parcel identity. Voxel Vault checks for an existing canonical mint before your claim can proceed.';
  if (status.alreadyMinted) return '✓ Already minted. This parcel already has its one canonical Property Passport, so a second canonical mint is blocked.';
  if (status.canMintNow) return '✓ Verified and mint-ready. This parcel is eligible for its one controlled canonical mint; another claim is not needed.';
  if (status.verified) return '✓ Already verified. This parcel already has a canonical identity, so a second canonical property identity is blocked.';
  if (status.state === 'claimed') return `Claim saved${status.ownClaimStatus ? ` · ${String(status.ownClaimStatus).replaceAll('-', ' ')}` : ''}. One canonical parcel identity is reserved.`;
  if (status.state === 'reserved') return 'This parcel identity is already reserved but not verified. Claims can be reviewed, but only one can become canonical.';
  return 'Available for verification. No canonical Property Passport has been minted for this parcel yet.';
}

export default function PropertyClaimPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [claims, setClaims] = useState([]);
  const [canonicalStatus, setCanonicalStatus] = useState(null);
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
    if (['countryCode', 'subdivisionCode', 'countyCode', 'parcelId'].includes(field)) setCanonicalStatus(null);
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
    try {
      const response = await fetch('/api/vault/property-claims', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not load property claims.');
      setClaims(Array.isArray(data.claims) ? data.claims : []);
    } catch (error) {
      setClaims([]);
      setMessage(error instanceof Error ? error.message : 'Could not load property claims.');
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const label = String(params.get('label') || '').trim().slice(0, 120);
    if (label) setForm((current) => ({ ...current, propertyLabel: label }));

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

    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.');
    }
  }

  async function checkCanonicalStatus() {
    if (!session?.access_token || !identityReady(form)) return null;
    const response = await fetch('/api/vault/property-canonical-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not check this parcel.');
    setCanonicalStatus(data);
    return data;
  }

  async function checkParcel() {
    if (!identityReady(form)) return setMessage('Add the country, state/region when required, assessor jurisdiction, and parcel/APN first.');
    if (!session?.access_token) return signIn();
    setBusy(true);
    setMessage('Checking this parcel…');
    try {
      const status = await checkCanonicalStatus();
      setMessage(statusCopy(status));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not check this parcel.'); }
    finally { setBusy(false); }
  }

  async function submitClaim(event) {
    event.preventDefault();
    if (!session?.access_token || busy) return;
    if (!identityReady(form)) return setMessage('Add the parcel identity first.');
    if (!form.ownerAuthorized) return setMessage('Confirm that you own the property or are authorized to request its official property identity.');

    setBusy(true);
    setMessage('Checking for an existing canonical property…');
    try {
      const status = await checkCanonicalStatus();
      if (status?.alreadyMinted) {
        setMessage('Already minted. Duplicate canonical mint blocked. You can view the existing property; ownership shares only unlock when a compliant offering exists.');
        return;
      }
      if (status?.verified) {
        setMessage(status?.canMintNow
          ? 'Your parcel is already verified for its one controlled canonical mint. A duplicate claim is not needed.'
          : 'This parcel already has a verified canonical identity. A second canonical property identity cannot be created.');
        return;
      }

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
      setMessage(data?.nextStep || 'Property submitted for verification.');
      await refreshClaims(session.access_token);
      await checkCanonicalStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit the property claim.');
    } finally {
      setBusy(false);
    }
  }

  const propertyName = form.propertyLabel || 'This property';
  const canSubmit = Boolean(session?.user && identityReady(form) && form.ownerAuthorized && !canonicalStatus?.alreadyMinted && !canonicalStatus?.verified);

  return <main className={styles.page}>
    <section className={styles.shell}>
      <nav className={styles.top}>
        <Link href="/property">← Property</Link>
        <Link href="/vault/property-drafts">Vault</Link>
      </nav>

      <header className={styles.hero}>
        <small>ONE PARCEL · ONE CANONICAL MINT</small>
        <h1>Verify <span>property.</span></h1>
        <p>Voxel Vault checks the real parcel identity before a canonical Property Passport can ever be minted.</p>
      </header>

      {authState === 'loading' ? <p className={styles.message}>Checking your account…</p> : null}
      {authState === 'error' ? <p className={styles.message}>{message || 'Sign-in is unavailable.'}</p> : null}
      {authState === 'signed-out' ? <div className={styles.card}>
        <div className={styles.propertyName}>{propertyName}</div>
        <button className={styles.submit} type="button" onClick={signIn} disabled={busy}>{busy ? 'Opening Google…' : 'Sign in to verify'}</button>
        <p className={styles.message}>Claims are account-bound so duplicate and competing parcel claims can be reviewed safely.</p>
      </div> : null}

      {session?.user ? <form className={styles.card} onSubmit={submitClaim}>
        <div className={styles.propertyName}>{propertyName}<br/><small>Signed in as {userName(session.user)}</small></div>

        <div className={styles.grid}>
          <Field className={styles.field} label="COUNTRY" value={form.countryCode} onChange={(value) => patch('countryCode', value)} placeholder="US" />
          <Field className={styles.field} label="STATE / REGION" value={form.subdivisionCode} onChange={(value) => patch('subdivisionCode', value)} placeholder="NY" />
          <Field className={`${styles.field} ${styles.full}`} label="ASSESSOR JURISDICTION / COUNTY" value={form.countyCode} onChange={(value) => patch('countyCode', value)} placeholder="ERIE" />
          <Field className={`${styles.field} ${styles.full}`} label="PARCEL / APN" value={form.parcelId} onChange={(value) => patch('parcelId', value)} placeholder="Parcel identifier" />
          <Field className={`${styles.field} ${styles.full}`} label="CITY / LOCALITY" value={form.locality} onChange={(value) => patch('locality', value)} placeholder="Buffalo, NY" required={false} />
        </div>

        <div className={styles.role}>
          <button type="button" className={form.claimantRole === 'owner' ? styles.active : ''} onClick={() => patch('claimantRole', 'owner')}>I own it</button>
          <button type="button" className={form.claimantRole === 'authorized-controller' ? styles.active : ''} onClick={() => patch('claimantRole', 'authorized-controller')}>I’m authorized</button>
        </div>

        <div className={styles.checks}>
          {evidenceOptions.map(([type, label]) => <label className={styles.check} key={type}>
            <input type="checkbox" checked={form.evidenceTypes.includes(type)} onChange={() => toggleEvidence(type)}/>
            <span>{label}</span>
          </label>)}
          <label className={`${styles.check} ${styles.authorization}`}>
            <input type="checkbox" checked={form.ownerAuthorized} onChange={(event) => patch('ownerAuthorized', event.target.checked)}/>
            <span>I am the owner or authorized controller requesting this property’s official Voxel Vault identity.</span>
          </label>
        </div>

        <div className={styles.status} data-state={canonicalStatus?.state || 'idle'}>{statusCopy(canonicalStatus)}</div>
        <button className={styles.secondary} type="button" onClick={checkParcel} disabled={busy || !identityReady(form)}>Check parcel first</button>
        <button className={styles.submit} type="submit" disabled={busy || !canSubmit}>{busy ? 'Checking…' : canonicalStatus?.state === 'available' ? 'Submit for verification' : 'Check + verify'}</button>

        {canonicalStatus?.alreadyMinted || canonicalStatus?.verified ? <div className={styles.piece}>
          <b>Own a piece</b>
          <span>This only turns on when a compliant fractional offering for this exact property actually exists. The Property Passport itself is not the economic share.</span>
        </div> : null}

        <p className={styles.message} role="status">{message}</p>
      </form> : null}

      {claims.length ? <section className={styles.claims} aria-label="Your property verification requests">
        {claims.slice(0, 4).map((claim) => <div className={styles.claim} key={claim.id}>
          <b>{claim.propertyLabel || 'Property'} · {String(claim.status || 'pending').replaceAll('-', ' ')}</b>
          <span>{claim.canonicalMintAllowed ? 'Verified registry controls complete; canonical mint remains a separate controlled action.' : 'Canonical mint locked until verification and registry controls are complete.'}</span>
        </div>)}
      </section> : null}

      <p className={styles.truth}>Address text is not the duplicate key. The normalized assessor jurisdiction + parcel/APN becomes the canonical fingerprint. One verified parcel may have one canonical Property Passport. The Passport is not a deed, and fractional economic rights require separate legal agreements and a compliant offering.</p>
    </section>
  </main>;
}

function Field({ className, label, value, onChange, placeholder, required = true }) {
  return <label className={className}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required}/></label>;
}
