'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './page.module.css';

const MAX_BUDGET_USD = 700;
const PROVIDER_MARKETPLACE = 'https://www.lofty.ai/marketplace';
const PROVIDER_TERMS = 'https://www.lofty.ai/terms';

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

export default function FractionalPropertyOwnerPage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [budget, setBudget] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    propertyAddress: '',
    legalEntity: '',
    purchaseAmountUsd: '25',
    quantity: '1',
    providerPositionId: '',
    blockchainAssetId: '',
    transactionId: '',
    providerReceiptRef: '',
    walletAddress: '',
    subdivisionCode: '',
    countyCode: '',
    parcelId: '',
    providerKycCompleted: false,
    purchaseCompleted: false,
    userConfirmedNoSecrets: false,
  });

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data } = await client.auth.getSession();
        if (cancelled) return;
        const accessToken = data?.session?.access_token || '';
        setToken(accessToken);
        setAuthState(accessToken ? 'authenticated' : 'signed-out');
        const authResult = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          setAuthState(next ? 'authenticated' : 'signed-out');
          if (!next) setResult(null);
        });
        subscription = authResult?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('error');
          setError(err instanceof Error ? err.message : 'Owner authentication could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  function applyBudget(value) {
    const numeric = Math.max(1, Math.min(MAX_BUDGET_USD, Number(value) || 1));
    const next = String(numeric);
    setBudget(next);
    setForm((current) => ({ ...current, purchaseAmountUsd: next }));
  }

  async function evaluateClaim(event) {
    event.preventDefault();
    if (!token) {
      setError('Owner sign-in is required.');
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/admin/fractional-property/bridge', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: 'lofty',
          propertyAddress: form.propertyAddress,
          legalEntity: form.legalEntity,
          purchaseAmountUsd: Number(form.purchaseAmountUsd),
          quantity: Number(form.quantity),
          providerPositionId: form.providerPositionId,
          blockchainAssetId: form.blockchainAssetId,
          transactionId: form.transactionId,
          providerReceiptRef: form.providerReceiptRef,
          walletAddress: form.walletAddress,
          providerKycCompleted: form.providerKycCompleted,
          purchaseCompleted: form.purchaseCompleted,
          userConfirmedNoSecrets: form.userConfirmedNoSecrets,
          parcel: form.subdivisionCode || form.countyCode || form.parcelId ? {
            countryCode: 'US',
            subdivisionCode: form.subdivisionCode,
            countyCode: form.countyCode,
            parcelId: form.parcelId,
          } : {},
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'Position claim could not be evaluated.');
      setResult(body.evaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Position claim could not be evaluated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link className={styles.brand} href="/real-estate"><span>V</span>Voxel Vault</Link>
          <div className={styles.navLinks}>
            <Link href="/admin/property-spatial-intake">Spatial intake</Link>
            <Link href="/admin/digital-reits/live">Live securities</Link>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>OWNER REAL PROPERTY BRIDGE · V1</p>
            <h1>Connect <em>real fractional property ownership</em> to the Spatial Vault.</h1>
            <p className={styles.lead}>Voxel Vault prepares the record, but the current purchase stays on the provider-approved interface. After a completed purchase, this console captures safe references so an approved verifier can later bind the position to the exact parcel and 3D twin.</p>
          </div>
          <div className={styles.truthBox}>
            <strong>Current truth</strong>
            <span>Purchase execution · EXTERNAL</span>
            <span>Provider scraping · OFF</span>
            <span>Auto-reinvest · OFF</span>
            <span>Ownership verifier · NOT CONNECTED</span>
          </div>
        </section>

        <section className={styles.flowGrid}>
          <article><b>1</b><div><strong>Choose a real property</strong><span>Use the provider's official interface and review its offering documents, property financials and risks.</span></div></article>
          <article><b>2</b><div><strong>Complete provider KYC + purchase</strong><span>Voxel Vault does not bypass identity checks, place this trade, or hold the provider wallet credentials.</span></div></article>
          <article><b>3</b><div><strong>Bring back proof references</strong><span>Enter transaction/asset/receipt references—not passwords, seed phrases, private keys or private documents.</span></div></article>
          <article><b>4</b><div><strong>Verify + bind the parcel</strong><span>Only an independent approved verifier may promote the Vault label to FRACTIONAL POSITION VERIFIED.</span></div></article>
        </section>

        <section className={styles.providerCard}>
          <div>
            <p className={styles.eyebrow}>REFERENCE PROVIDER · NOT AN ENDORSEMENT</p>
            <h2>Lofty property-specific fractional ownership</h2>
            <p>Current public provider materials describe property-specific LLC ownership, blockchain settlement, daily rental income and a secondary marketplace. Voxel Vault has not verified a public production API/partnership for automated execution, so V1 uses an external handoff only.</p>
          </div>
          <div className={styles.providerActions}>
            <label>
              <span>Planned pilot amount</span>
              <div className={styles.moneyInput}><span>$</span><input type="number" min="1" max={MAX_BUDGET_USD} step="1" value={budget} onChange={(event) => applyBudget(event.target.value)} /></div>
              <small>Hard Voxel Vault pilot cap: {money(MAX_BUDGET_USD)}. No automatic spend.</small>
            </label>
            <a className={styles.primaryButton} href={PROVIDER_MARKETPLACE} target="_blank" rel="noreferrer">Open official provider marketplace ↗</a>
            <a className={styles.secondaryButton} href={PROVIDER_TERMS} target="_blank" rel="noreferrer">Read provider terms ↗</a>
          </div>
        </section>

        <section className={styles.claimSection}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>POST-PURCHASE POSITION CLAIM</p><h2>Prepare a pending ownership record.</h2></div>
            <p>This does not persist a position or make it verified. It checks whether the references are structurally sufficient for the future provider-verification pipeline.</p>
          </div>

          <form className={styles.form} onSubmit={evaluateClaim}>
            <div className={styles.formGrid}>
              <label><span>Property address *</span><input value={form.propertyAddress} onChange={(event) => update('propertyAddress', event.target.value)} placeholder="Exact provider property address" /></label>
              <label><span>Property legal entity / LLC *</span><input value={form.legalEntity} onChange={(event) => update('legalEntity', event.target.value)} placeholder="Exact entity named in provider documents" /></label>
              <label><span>Purchase amount *</span><input type="number" min="1" max={MAX_BUDGET_USD} step="0.01" value={form.purchaseAmountUsd} onChange={(event) => update('purchaseAmountUsd', event.target.value)} /></label>
              <label><span>Owned quantity *</span><input type="number" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
              <label><span>Provider position ID</span><input value={form.providerPositionId} onChange={(event) => update('providerPositionId', event.target.value)} /></label>
              <label><span>Blockchain asset ID</span><input value={form.blockchainAssetId} onChange={(event) => update('blockchainAssetId', event.target.value)} /></label>
              <label><span>Transaction ID</span><input value={form.transactionId} onChange={(event) => update('transactionId', event.target.value)} /></label>
              <label><span>Provider receipt reference</span><input value={form.providerReceiptRef} onChange={(event) => update('providerReceiptRef', event.target.value)} /></label>
              <label><span>Public wallet address (optional)</span><input value={form.walletAddress} onChange={(event) => update('walletAddress', event.target.value)} /></label>
            </div>

            <fieldset className={styles.parcelBox}>
              <legend>Optional exact parcel binding</legend>
              <p>Fill all three together only when you have authoritative parcel identity. An address alone is not a canonical parcel ID.</p>
              <div className={styles.formGrid}>
                <label><span>State</span><input value={form.subdivisionCode} onChange={(event) => update('subdivisionCode', event.target.value)} placeholder="NY" maxLength="32" /></label>
                <label><span>County / assessor jurisdiction</span><input value={form.countyCode} onChange={(event) => update('countyCode', event.target.value)} placeholder="ERIE" maxLength="64" /></label>
                <label><span>Parcel ID</span><input value={form.parcelId} onChange={(event) => update('parcelId', event.target.value)} placeholder="PIN / SBL / APN" /></label>
              </div>
            </fieldset>

            <div className={styles.checks}>
              <label><input type="checkbox" checked={form.providerKycCompleted} onChange={(event) => update('providerKycCompleted', event.target.checked)} /><span>I completed the provider's required identity/KYC flow.</span></label>
              <label><input type="checkbox" checked={form.purchaseCompleted} onChange={(event) => update('purchaseCompleted', event.target.checked)} /><span>I completed this purchase through the provider-approved interface.</span></label>
              <label><input type="checkbox" checked={form.userConfirmedNoSecrets} onChange={(event) => update('userConfirmedNoSecrets', event.target.checked)} /><span>I am not entering a seed phrase, private key, password, secret key, or private document.</span></label>
            </div>

            <div className={styles.submitRow}>
              <button className={styles.primaryButton} disabled={busy || authState !== 'authenticated'} type="submit">{busy ? 'Evaluating…' : 'Evaluate pending position'}</button>
              <span>{authState === 'authenticated' ? 'Owner session verified.' : authState === 'loading' ? 'Checking owner session…' : 'Authorized owner sign-in required.'}</span>
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </form>
        </section>

        {result && (
          <section className={styles.resultCard}>
            <div className={styles.resultTop}>
              <div><p className={styles.eyebrow}>POSITION EVALUATION</p><h2>{result.status === 'verified' ? 'FRACTIONAL POSITION VERIFIED' : 'PENDING PROVIDER VERIFICATION'}</h2></div>
              <span className={result.verifiedPropertyRights ? styles.verifiedPill : styles.pendingPill}>{result.rightsType === 'provider_fractional_security' ? 'FRACTIONAL POSITION VERIFIED' : 'REFERENCE ONLY'}</span>
            </div>
            <div className={styles.resultGrid}>
              <div><small>Provider</small><strong>{result.provider?.displayName}</strong></div>
              <div><small>Property</small><strong>{result.claim?.propertyAddress}</strong></div>
              <div><small>Entity</small><strong>{result.claim?.legalEntity}</strong></div>
              <div><small>Amount</small><strong>{money(result.claim?.purchaseAmountUsd)}</strong></div>
              <div><small>Quantity</small><strong>{result.claim?.quantity}</strong></div>
              <div><small>Parcel bound</small><strong>{result.claim?.parcel?.bound ? 'YES' : 'NO'}</strong></div>
            </div>
            <div className={styles.blockers}>
              <strong>Still required before Voxel Vault can call this owned property:</strong>
              <ul>{(result.blockers || []).map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
            </div>
            <p className={styles.fingerprint}>Pending claim fingerprint · {result.claim?.positionFingerprint}</p>
          </section>
        )}

        <footer className={styles.footer}>Voxel Vault · property-specific ownership bridge · no scraping · no automatic trade · no ownership label without independent verification.</footer>
      </div>
    </main>
  );
}
