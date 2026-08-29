'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../../../lib/supabase-browser';
import { saveVoxelToAccount } from '../../../../../../lib/voxelpop-account';
import PurchasedEstateVoxelViewer from '../../PurchasedEstateVoxelViewer';

function errorText(error) {
  return String(error?.message || error || 'Action failed.');
}

function fallbackThumbnail(estate) {
  const name = String(estate?.name || 'Purchased property').replace(/[<>&]/g, '');
  const structure = String(estate?.structure || '#d9d4ca');
  const roof = String(estate?.roof || '#332b38');
  const terrain = String(estate?.terrain || '#53684c');
  const accent = String(estate?.accent || '#c9ff54');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#fff8ed"/><path d="M95 670 450 520 805 670 450 825Z" fill="${terrain}"/><rect x="235" y="325" width="430" height="300" rx="12" fill="${structure}"/><rect x="205" y="285" width="490" height="65" rx="10" fill="${roof}"/><rect x="300" y="405" width="90" height="105" fill="${accent}"/><rect x="510" y="405" width="90" height="105" fill="${accent}"/><rect x="415" y="480" width="70" height="145" fill="${roof}"/><text x="450" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="800" fill="#2b2330">${name}</text><text x="450" y="195" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#766c78">PURCHASED DIGITAL ESTATE → VOXEL</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function PurchasedEstateVoxelPage() {
  const params = useParams();
  const estateId = String(params?.estateId || '');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [owned, setOwned] = useState(null);
  const [status, setStatus] = useState('Checking your secured purchase…');
  const [rendered, setRendered] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  async function loadOwned(accessToken) {
    if (!accessToken || !estateId) return;
    setStatus('Checking that this purchase belongs to your signed-in account…');
    const response = await fetch('/api/digital-estates/mine', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Your purchased property could not be checked.');
    const match = (Array.isArray(data.owned) ? data.owned : []).find((item) => item?.estate?.id === estateId) || null;
    setOwned(match);
    if (!match) {
      setStatus('This signed-in account does not have a secured purchase for this Digital Estate.');
      return;
    }
    setStatus('Purchase verified. Your 3D voxel is included—there is no second creation charge.');
  }

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      const next = data.session || null;
      setSession(next);
      setAuthReady(true);
      if (next?.access_token) await loadOwned(next.access_token);
      else setStatus('Sign in to open the Digital Estate you bought.');
      const auth = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession || null);
        setAuthReady(true);
        setOwned(null);
        setRendered(null);
        setSaved(false);
        if (nextSession?.access_token) await loadOwned(nextSession.access_token);
        else setStatus('Sign in to open the Digital Estate you bought.');
      });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (active) {
        setAuthReady(true);
        setStatus(errorText(error));
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [estateId]);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const redirectTo = new URL(`/vault/estates/mine/${encodeURIComponent(estateId)}/voxel`, window.location.origin).toString();
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
    } catch (error) {
      setStatus(errorText(error));
      setBusy('');
    }
  }

  async function saveToVault() {
    if (!owned?.estate || !rendered || !session?.user) return;
    setBusy('save');
    setStatus('Saving this 3D voxel into your Creator Gallery…');
    try {
      const estate = owned.estate;
      const sessionId = `digital-estate-${estate.id}`;
      const updatedAt = new Date().toISOString();
      const payload = {
        asset: {
          name: `${estate.name} voxel`,
          dataUrl: rendered.thumbnailDataUrl || fallbackThumbnail(estate),
        },
        mesh: {
          status: 'ready',
          progress: 100,
          taskId: `estate-v1:${estate.id}`,
        },
        source: {
          kind: 'digital-estate-purchase',
          referenceId: estate.id,
          href: `/vault/estates/mine/${estate.id}/voxel`,
          purchaseSecured: true,
        },
        updatedAt,
      };
      window.localStorage.setItem(`voxelpop:${sessionId}`, JSON.stringify(payload));
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await saveVoxelToAccount(client, session.user, sessionId, payload);
      window.dispatchEvent(new CustomEvent('voxel-vault:creation-updated', { detail: { sessionId, estateId: estate.id } }));
      setSaved(true);
      setStatus('Saved. This purchased design is now a 3D voxel creation in your Vault.');
    } catch (error) {
      setStatus(`${errorText(error)} The interactive voxel is still available on this screen.`);
    } finally {
      setBusy('');
    }
  }

  if (!authReady) return <main className="page"><section className="shell"><p className="eyebrow">VOXELPOP · PURCHASED PROPERTY</p><h1>Opening your purchase…</h1></section><style jsx>{styles}</style></main>;

  if (!session?.user) return <main className="page"><section className="shell"><Link className="back" href="/vault">← Vault</Link><p className="eyebrow">VOXELPOP · PURCHASED PROPERTY</p><h1>Sign in to make<br/>your voxel.</h1><p className="lead">The builder only opens after Voxel Vault confirms this Digital Estate belongs to your account.</p><button className="primary" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button><p className="status">{status}</p></section><style jsx>{styles}</style></main>;

  if (!owned?.estate) return <main className="page"><section className="shell"><Link className="back" href="/vault/estates/mine">← My bought properties</Link><p className="eyebrow">PURCHASE CHECK</p><h1>Nothing to build yet.</h1><p className="lead">{status}</p><Link className="secondary" href="/vault/estates/mine">Back to my purchases</Link></section><style jsx>{styles}</style></main>;

  const estate = owned.estate;
  return <main className="page">
    <section className="shell">
      <header><Link className="brand" href="/vault"><span>V</span> Voxel Vault</Link><Link className="back" href="/vault/estates/mine">My bought properties</Link></header>
      <div className="steps"><span className="done">✓ BOUGHT</span><span className="done">2 · 3D VOXEL</span><span className={saved ? 'done' : ''}>3 · SAVE</span><span>4 · MINT OPTIONAL</span></div>
      <section className="hero">
        <p className="eyebrow">YOUR PURCHASE → YOUR CREATION</p>
        <h1>Make the one you bought<br/><em>into a 3D voxel.</em></h1>
        <p className="lead">This voxel is built from the purchased Digital Estate design—its architecture, floors, proportions and palette. It is included with the secured purchase, so there is no second creation payment.</p>
      </section>

      <section className="builder">
        <div className="viewer"><PurchasedEstateVoxelViewer estate={estate} onReady={setRendered}/><span className="viewerBadge">INTERACTIVE 3D VOXEL · DRAG + PINCH</span></div>
        <aside>
          <span className="owned">✓ PURCHASE VERIFIED</span>
          <small>{estate.locationLabel}</small>
          <h2>{estate.name}</h2>
          <p>{estate.summary}</p>
          <dl><div><dt>DESIGN</dt><dd>{estate.architecture}</dd></div><div><dt>FLOORS</dt><dd>{estate.floors}</dd></div><div><dt>SIZE REFERENCE</dt><dd>{Number(estate.sqft || 0).toLocaleString()} sq ft</dd></div></dl>
          <button className="primary" onClick={saveToVault} disabled={!rendered || busy === 'save' || saved}>{busy === 'save' ? 'Saving to Vault…' : saved ? 'Saved to my Vault ✓' : rendered ? 'Save this 3D voxel to my Vault' : 'Building voxel…'}</button>
          {saved ? <Link className="secondary" href="/vault#creations">Open my creations →</Link> : null}
        </aside>
      </section>

      <section className="next"><div><b>Want it onchain too?</b><span>Minting stays optional and separate. Your purchase and your saved voxel do not depend on connecting a wallet.</span></div><Link href="/vault/estates/mine">Manage optional mint →</Link></section>
      <p className="truth"><b>Digital design, not physical title.</b> This is a voxel interpretation of the Digital Estate design you purchased. It does not create or transfer a deed, occupancy, rent, fractional ownership, investment rights, or a claim on a physical house.</p>
      <p className="status" role="status">{status}</p>
    </section>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
  :global(body){margin:0;background:#fff9ef;color:#231b28;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:16px 14px calc(100px + env(safe-area-inset-bottom));background:radial-gradient(circle at 7% 18%,#eaffad 0,transparent 24%),radial-gradient(circle at 92% 5%,#ede3ff 0,transparent 28%),#fff9ef}.shell{width:min(1040px,100%);margin:0 auto}header{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:9px;color:#231b28;text-decoration:none;font-size:12px;font-weight:1000}.brand span{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:#7138f5;color:#fff;box-shadow:0 5px 0 #4e20be}.back{color:#746a77;text-decoration:none;font-size:11px;font-weight:900}.steps{display:flex;gap:7px;flex-wrap:wrap;margin:28px 0 0}.steps span{padding:8px 10px;border:1px solid #ded6e4;border-radius:999px;background:#ffffffb8;color:#968d98;font-size:8px;font-weight:950;letter-spacing:.07em}.steps .done{background:#e9ffc0;border-color:#cce98e;color:#3f561c}.hero{padding:42px 0 25px}.eyebrow{margin:0;color:#7041ed;font-size:10px;font-weight:1000;letter-spacing:.14em}.hero h1,.shell>h1{font-size:clamp(45px,7vw,76px);line-height:.9;letter-spacing:-.065em;margin:12px 0 16px}.hero h1 em{font-style:normal;color:#7653d9}.lead{max-width:760px;margin:0;color:#726978;font-size:14px;line-height:1.7}.builder{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(270px,.7fr);gap:14px;align-items:stretch}.viewer{min-height:500px;position:relative;overflow:hidden;border:1px solid #ddd4e2;border-radius:30px;background:#f8f0e3;box-shadow:0 20px 60px #5e3e9010}.viewerBadge{position:absolute;left:14px;bottom:14px;padding:8px 10px;border-radius:999px;background:#231b28e8;color:#fff;font-size:8px;font-weight:950;letter-spacing:.08em}.builder aside{padding:24px;border:1px solid #e0d9e4;border-radius:30px;background:#ffffffd9;display:flex;flex-direction:column;align-items:flex-start}.owned{padding:8px 10px;border-radius:999px;background:#e6ffb1;color:#3e5818;font-size:8px;font-weight:1000;letter-spacing:.08em}.builder aside small{margin-top:22px;color:#8d8390;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.builder aside h2{font-size:31px;letter-spacing:-.05em;margin:7px 0}.builder aside p{margin:0;color:#756c79;font-size:12px;line-height:1.65}.builder dl{width:100%;display:grid;gap:8px;margin:20px 0}.builder dl div{display:flex;justify-content:space-between;gap:12px;padding-top:9px;border-top:1px solid #eee8ef}.builder dt{font-size:8px;color:#9b929d;font-weight:900;letter-spacing:.08em}.builder dd{margin:0;font-size:10px;font-weight:900;color:#574e5c;text-transform:capitalize}.primary,.secondary{width:100%;min-height:50px;border:0;border-radius:16px;display:grid;place-items:center;text-align:center;text-decoration:none;font:inherit;font-size:11px;font-weight:1000}.primary{background:#7138f5;color:#fff;box-shadow:0 6px 0 #4e20be;cursor:pointer}.primary:disabled{opacity:.5;box-shadow:none}.secondary{margin-top:10px;border:1px solid #ddd5e2;background:#fff;color:#5c5162}.next{margin-top:14px;padding:18px;border:1px solid #dce5be;border-radius:22px;background:#f4ffe4;display:flex;justify-content:space-between;align-items:center;gap:14px}.next div{display:grid;gap:3px}.next b{font-size:13px}.next span{color:#6d775e;font-size:10px;line-height:1.5}.next a{flex:0 0 auto;color:#4e3c85;font-size:10px;font-weight:950;text-decoration:none}.truth{margin:18px 4px 0;color:#8a818c;font-size:10px;line-height:1.6}.truth b{color:#5d5361}.status{margin:12px 4px 0;color:#746a77;font-size:11px;line-height:1.5}@media(max-width:760px){.page{padding-left:10px;padding-right:10px}.builder{grid-template-columns:1fr}.viewer{min-height:390px}.hero{padding-top:30px}.hero h1,.shell>h1{font-size:50px}.next{align-items:flex-start;flex-direction:column}.next a{min-height:44px;display:flex;align-items:center}.brand{font-size:11px}}
`;
