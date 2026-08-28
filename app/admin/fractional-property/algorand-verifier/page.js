'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import styles from '../page.module.css';

export default function AlgorandPropertyPositionVerifierPage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [walletAddress, setWalletAddress] = useState('');
  const [assetId, setAssetId] = useState('');
  const [verifier, setVerifier] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
          if (!next) {
            setVerifier(null);
            setResult(null);
          }
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/fractional-property/algorand-verify', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && body.ok) setVerifier(body.verifier);
      } catch {
        // The verification action itself will surface setup errors when used.
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function verify(event) {
    event.preventDefault();
    if (!token) {
      setError('Authorized owner sign-in is required.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/admin/fractional-property/algorand-verify', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress, assetId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'Algorand verification failed.');
      setResult(body.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algorand verification failed.');
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
            <Link href="/admin/fractional-property">Ownership bridge</Link>
            <Link href="/admin/property-spatial-intake">Spatial intake</Link>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>OWNER PROOF LAYER · ALGORAND</p>
            <h1>Verify the <em>public on-chain position</em> without touching the wallet.</h1>
            <p className={styles.lead}>Enter only a public Algorand address and asset ID. Voxel Vault performs read-only Indexer lookups. It never asks for a seed phrase or private key and cannot sign a transaction.</p>
          </div>
          <div className={styles.truthBox}>
            <strong>Three separate truths</strong>
            <span>Asset holding · READ-ONLY VERIFIABLE</span>
            <span>Wallet control · NOT VERIFIED</span>
            <span>Property/legal mapping · NOT VERIFIED</span>
            <span>Trade authority · NONE</span>
          </div>
        </section>

        <section className={styles.providerCard}>
          <div>
            <p className={styles.eyebrow}>VERIFIER STATUS</p>
            <h2>{verifier?.configured ? 'Indexer connection ready' : 'Indexer connection not configured'}</h2>
            <p>The on-chain verifier can prove only that a public address currently holds the requested Algorand Standard Asset. That is useful evidence, but it is not enough by itself to prove you control the wallet or that the asset legally represents a particular house, LLC or parcel.</p>
          </div>
          <div className={styles.truthBox}>
            <span>Implementation · {verifier?.implementationReady ? 'READY' : 'LOCKED'}</span>
            <span>Indexer · {verifier?.indexerConfigured ? 'CONFIGURED' : 'MISSING'}</span>
            <span>Read-only switch · {verifier?.enabled ? 'ON' : 'OFF'}</span>
            <span>Legal rights verifier · {verifier?.canVerifyLegalPropertyRights ? 'READY' : 'LOCKED'}</span>
          </div>
        </section>

        <section className={styles.claimSection}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>PUBLIC HOLDING CHECK</p><h2>Wallet + asset ID.</h2></div>
            <p>Do not enter a mnemonic, password, seed phrase, private key, wallet backup or recovery phrase. A public address is enough for this read-only check.</p>
          </div>

          <form className={styles.form} onSubmit={verify}>
            <div className={styles.formGrid}>
              <label><span>Public Algorand wallet address *</span><input value={walletAddress} onChange={(event) => { setWalletAddress(event.target.value.toUpperCase()); setResult(null); }} placeholder="58-character public address" autoCapitalize="characters" autoCorrect="off" spellCheck="false" /></label>
              <label><span>Algorand asset ID *</span><input value={assetId} onChange={(event) => { setAssetId(event.target.value.replace(/\D/g, '')); setResult(null); }} placeholder="Numeric asset ID" inputMode="numeric" /></label>
            </div>
            <div className={styles.submitRow}>
              <button className={styles.primaryButton} disabled={busy || authState !== 'authenticated'} type="submit">{busy ? 'Checking chain…' : 'Verify public holding'}</button>
              <span>{authState === 'authenticated' ? 'Owner session verified · read-only request.' : authState === 'loading' ? 'Checking owner session…' : 'Authorized owner sign-in required.'}</span>
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </form>
        </section>

        {result && (
          <section className={styles.resultCard}>
            <div className={styles.resultTop}>
              <div><p className={styles.eyebrow}>ON-CHAIN EVIDENCE</p><h2>{result.evidence?.onChainHoldingVerified ? 'PUBLIC HOLDING VERIFIED' : 'NO POSITIVE HOLDING VERIFIED'}</h2></div>
              <span className={result.evidence?.onChainHoldingVerified ? styles.verifiedPill : styles.pendingPill}>RIGHTS · REFERENCE ONLY</span>
            </div>
            <div className={styles.resultGrid}>
              <div><small>Asset ID</small><strong>{result.assetId}</strong></div>
              <div><small>Asset</small><strong>{result.asset?.name || 'Unnamed asset'}</strong></div>
              <div><small>Unit</small><strong>{result.asset?.unitName || '—'}</strong></div>
              <div><small>Quantity</small><strong>{result.holding?.quantity}</strong></div>
              <div><small>Frozen</small><strong>{result.holding?.frozen ? 'YES' : 'NO'}</strong></div>
              <div><small>Creator</small><strong>{result.asset?.creator || '—'}</strong></div>
            </div>
            <div className={styles.blockers}>
              <strong>Still required before this becomes verified real-property ownership in Voxel Vault:</strong>
              <ul>{(result.blockers || []).map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
            </div>
            <p className={styles.fingerprint}>Public wallet · {result.walletAddress}</p>
          </section>
        )}

        <footer className={styles.footer}>Voxel Vault · read-only chain evidence · public address + asset ID only · no transaction signing · no legal-rights upgrade from blockchain balance alone.</footer>
      </div>
    </main>
  );
}
