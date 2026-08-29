'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { buildPropertyDraft, savePropertyDraft } from '../../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../../lib/property-drafts-account';

export default function PropertyPurchaseSuccessPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Verifying your purchase…');
  const [saved, setSaved] = useState(false);
  const clientRef = useRef(null);
  const deliveredRef = useRef('');

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
    if (!session?.access_token) return;
    const sessionId = new URLSearchParams(window.location.search).get('session_id') || '';
    if (!sessionId) return setMessage('Checkout session is missing. Your Stripe payment record is unchanged.');
    if (deliveredRef.current === sessionId) return;
    deliveredRef.current = sessionId;
    let active = true;
    (async () => {
      try {
        setMessage('Payment found. Moving your voxel into the Vault…');
        const response = await fetch(`/api/property-collectible/complete?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || data?.purchase?.paid !== true || !data?.building || !data?.model?.modelUrl) {
          throw new Error(data?.error || 'Purchase could not be verified yet.');
        }
        if (!active) return;
        setResult(data);

        const base = buildPropertyDraft({ building: data.building, openImagery: null, fallbackLabel: data.purchase.address });
        if (!base) throw new Error('The paid collectible is verified, but its Vault card could not be rebuilt.');
        const now = new Date().toISOString();
        const next = {
          ...base,
          label: data.purchase.address || base.label,
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
            purchasedAt: now,
            identityKey: data.purchase.identityKey,
            mappedAtlasId: data.purchase.atlasId,
            generationDraftId: data.purchase.draftId,
            priceCents: data.purchase.priceCents,
            priceTier: data.purchase.priceTier,
            priceLabel: data.purchase.priceLabel,
            stripeSessionId: data.purchase.sessionId,
            digitalCollectibleOnly: true,
          },
          world: { ...(base.world || {}), public: false, purchasedDigitalCollectible: true },
          blockchain: { ...(base.blockchain || {}), minted: false, optionalAfterPurchase: true },
          legal: {
            ...(base.legal || {}),
            titleVerified: false,
            digitalCollectibleOnly: true,
            deedOrTitleRights: false,
            rentRights: false,
            investmentRights: false,
            occupancyRights: false,
            canonicalParcelMintVerified: false,
            note: 'This paid VoxelPop item is a digital collectible. Payment and any later mint do not transfer deed/title, rent, occupancy, investment or appreciation rights in the physical property.',
          },
          updatedAt: now,
        };
        const savedDraft = savePropertyDraft(next);
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await savePropertyDraftToAccount(client, session.user, savedDraft);
        if (!active) return;
        setSaved(true);
        setMessage('Purchased, saved, and synced to your Vault.');
      } catch (error) {
        deliveredRef.current = '';
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
    } catch (error) { setMessage(String(error?.message || error || 'Could not sign in.')); }
  }

  if (!authReady) return <main className="page"><section className="card"><div className="pop">V</div><h1>Finishing your voxel…</h1><p>{message}</p></section><style jsx>{styles}</style></main>;
  if (!session?.user) return <main className="page"><section className="card"><div className="pop">V</div><small>YOUR PURCHASE IS SAFE</small><h1>Sign back in.</h1><p>Use the same Google account from checkout so Voxel Vault can verify the buyer and put the collectible into the correct Vault.</p><button onClick={signIn}>Continue with Google</button><p className="status">{message}</p></section><style jsx>{styles}</style></main>;

  return <main className="page">
    <section className="card">
      <div className="pop">{saved ? '✓' : '…'}</div>
      <small>VOXELPOP · COLLECTED</small>
      <h1>{saved ? 'It’s in your Vault.' : 'Finishing your voxel…'}</h1>
      <p className="status">{message}</p>
      {result?.model?.modelUrl ? <div className="viewer"><MeshyModelViewer modelUrl={result.model.modelUrl}/><span>OWNED DIGITAL VOXEL</span></div> : <div className="loading">Securing payment → rebuilding World identity → saving Vault item</div>}
      {result?.purchase ? <div className="receipt"><div><small>DIGITAL BUILD</small><b>{result.purchase.priceLabel}</b></div><strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(result.purchase.priceCents || 0)/100)}</strong></div> : null}
      {saved ? <div className="actions"><Link className="primary" href="/property">+ Create Another</Link><Link className="world" href="/world">View My World</Link><Link className="mint" href="/vault/properties/claim">Mint to Wallet · optional</Link><Link className="vault" href="/vault/property-drafts">Open My Vault</Link></div> : null}
      <p className="truth">Your purchase is the digital VoxelPop collectible only. The optional mint is a digital provenance step after property verification; it does not create deed/title, rent, occupancy, fractional investment or other physical-property rights.</p>
    </section>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
:global(body){margin:0;background:#fffaf0;color:#25170d;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:24px 14px calc(45px + env(safe-area-inset-bottom));display:grid;place-items:center;background:radial-gradient(circle at 10% 10%,#fff0c9,transparent 28%),radial-gradient(circle at 90% 15%,#eee5ff,transparent 29%),radial-gradient(circle at 50% 95%,#edffc0,transparent 25%),#fffaf0}.card{width:min(610px,100%);text-align:center}.pop{width:70px;height:70px;margin:0 auto 20px;border-radius:23px;display:grid;place-items:center;background:#c9ff54;color:#355500;font-size:32px;font-weight:1000;box-shadow:0 8px 0 #aee43c}.card>small{color:#7138f5;font-size:10px;font-weight:1000;letter-spacing:.15em}.card h1{font-size:clamp(43px,10vw,68px);line-height:.9;letter-spacing:-.06em;margin:14px 0}.card>p{max-width:500px;margin:10px auto;color:#7f746a;font-size:13px;line-height:1.55}.card button,.actions a{border:0;text-decoration:none;min-height:59px;border-radius:20px;display:grid;place-items:center;font:1000 16px inherit;cursor:pointer}.card button,.actions .primary{background:#7138f5;color:#fff;box-shadow:0 8px 0 #4d1bc5}.viewer{position:relative;height:410px;margin:24px 0 16px;overflow:hidden;border-radius:36px;background:#21172c;box-shadow:0 22px 55px rgba(67,42,23,.16)}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.viewer>span{position:absolute;z-index:4;left:16px;top:16px;padding:8px 11px;border-radius:999px;background:#c9ff54;color:#243900;font-size:8px;font-weight:1000;letter-spacing:.09em}.loading{margin:24px 0;padding:28px;border-radius:28px;background:#fff;border:1px solid #e7ddd1;color:#80746b;font-size:12px;font-weight:800}.receipt{margin:0 0 14px;padding:16px 18px;border:1px solid #eadfd0;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:space-between;text-align:left}.receipt div{display:grid;gap:4px}.receipt small{color:#7138f5;font-size:8px;font-weight:1000;letter-spacing:.1em}.receipt b{font-size:17px}.receipt strong{font-size:24px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.actions .world{background:#c9ff54;color:#273e00;box-shadow:0 8px 0 #aee43c}.actions .mint{grid-column:1/-1;background:#20172a;color:#fff}.actions .vault{grid-column:1/-1;background:#fff;color:#675b6d;border:1px solid #e2d9e7}.truth{font-size:8.5px!important;color:#a19891!important;margin-top:18px!important}.status{min-height:18px}@media(max-width:520px){.page{padding:16px 10px calc(35px + env(safe-area-inset-bottom))}.viewer{height:355px;border-radius:30px}.actions{grid-template-columns:1fr}.actions .mint,.actions .vault{grid-column:auto}.card h1{font-size:50px}}
`;
