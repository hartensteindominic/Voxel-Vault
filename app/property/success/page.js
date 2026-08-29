'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { buildPropertyDraft, savePropertyDraft } from '../../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../../lib/property-drafts-account';
import styles from '../property.module.css';

export default function PropertyPurchaseSuccessPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Verifying your purchase…');
  const [saved, setSaved] = useState(false);
  const clientRef = useRef(null);
  const deliveredRef = useRef(false);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setAuthReady(true);
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in setup is unavailable on this deployment. Your Stripe payment remains recorded.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!session?.access_token || deliveredRef.current) return;
    const sessionId = new URLSearchParams(window.location.search).get('session_id') || '';
    if (!sessionId) {
      setMessage('Checkout session is missing. Open your Vault or return to Property.');
      return;
    }
    deliveredRef.current = true;
    let active = true;
    (async () => {
      try {
        setMessage('Payment received. Putting your voxel in the Vault…');
        const response = await fetch(`/api/property-collectible/complete?session_id=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.paid) throw new Error(data?.error || 'Purchase could not be verified yet.');
        if (!active) return;
        setResult(data);

        const base = buildPropertyDraft({ building: data.building, openImagery: null, fallbackLabel: data.purchase.address });
        if (!base) throw new Error('The paid collectible is verified, but its Vault card could not be rebuilt.');
        const next = {
          ...base,
          fidelity: 'photo-to-3d-to-voxel-collectible',
          state: 'paid-digital-collectible',
          visual: {
            ...(base.visual || {}),
            modelUrl: data.model.modelUrl,
            modelTaskId: data.model.taskId,
            thumbnailUrl: data.model.thumbnailUrl || null,
          },
          commerce: {
            kind: 'property_voxel_collectible',
            status: 'paid',
            identityKey: data.purchase.identityKey,
            priceCents: data.purchase.priceCents,
            priceTier: data.purchase.priceTier,
            stripeSessionId: data.purchase.sessionId,
            digitalCollectibleOnly: true,
          },
          world: { ...(base.world || {}), public: false },
          legal: {
            ...(base.legal || {}),
            deedOrTitleRights: false,
            rentRights: false,
            investmentRights: false,
            occupancyRights: false,
            canonicalParcelMintVerified: false,
          },
        };
        savePropertyDraft(next);
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await savePropertyDraftToAccount(client, session.user, next);
        if (!active) return;
        setSaved(true);
        setMessage('Collected! Your VoxelPop property is in your Vault.');
      } catch (error) {
        if (active) setMessage(String(error?.message || error || 'Purchase delivery failed.'));
      }
    })();
    return () => { active = false; };
  }, [session?.access_token, session?.user]);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setMessage(String(error?.message || error || 'Could not sign in.'));
    }
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP · VOXEL VAULT</div><h1>Collected</h1><section className={styles.donePanel}><p className={styles.bigPrompt}>Checking your account…</p></section></section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · VOXEL VAULT</div>
      <h1>Collected</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in to open it.</p>
        <p className={styles.signinCopy}>Your payment is handled by Stripe. Sign back into the same Voxel Vault account to deliver the collectible to your Vault.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn}>Continue with Google</button>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · VOXEL VAULT</div>
      <h1>Collected</h1>
      {result?.model?.modelUrl ? <div className={styles.heroCard}>
        <MeshyModelViewer modelUrl={result.model.modelUrl}/>
        <span className={styles.badge}>YOUR DIGITAL VOXEL</span>
      </div> : null}
      <section className={styles.donePanel}>
        <div className={styles.doneMark}>{saved ? '✓' : '…'}</div>
        <p className={styles.bigPrompt}>{saved ? 'It’s in your Vault.' : 'Finishing delivery…'}</p>
        {result?.purchase ? <p className={styles.stepCopy}><b>{result.purchase.address}</b><br/>{result.purchase.priceLabel} · ${(Number(result.purchase.priceCents || 0) / 100).toFixed(2)}</p> : null}
        {saved ? <>
          <Link className={styles.primaryLink} href="/vault/property-drafts">Open my Vault</Link>
          <Link className={styles.secondaryLink} href="/world">View My World</Link>
          <Link className={styles.secondaryLink} href="/property">Create Another</Link>
          <Link className={styles.textLink} href="/vault/properties/claim">Verify &amp; mint later</Link>
          <small>Wallet connection is optional until you choose to mint.</small>
        </> : null}
      </section>
      <p className={styles.message} role="status">{message}</p>
      <p className={styles.truth}>You bought a digital VoxelPop collectible, not the real property. No deed/title, rent, occupancy, investment or appreciation rights are created. Canonical minting remains a separate parcel-verification step.</p>
    </section>
  </main>;
}
