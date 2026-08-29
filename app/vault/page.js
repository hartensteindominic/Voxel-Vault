'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { mergePropertyDraftRecords, readPropertyDrafts, replaceLocalPropertyDrafts } from '../../lib/property-drafts';
import { loadAccountPropertyDrafts } from '../../lib/property-drafts-account';
import { mergeVoxelRecords, readLocalVoxelRecords, summarizeVoxel, syncLocalVoxelsToAccount } from '../../lib/voxelpop-account';

const DEMO_PURCHASE_KEY = 'voxel-vault:property-slice-purchases';

function money(cents) {
  if (!Number(cents)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
}

function readDemoProperty() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(DEMO_PURCHASE_KEY) || 'null');
    const purchase = raw?.lastPurchase;
    if (!purchase?.selectedName) return null;
    return {
      id: `demo-slice:${String(purchase.selectedName).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      type: 'voxel-vault-demo-property-slice',
      label: purchase.selectedName,
      demoOnly: true,
      demoPurchase: purchase,
    };
  } catch {
    return null;
  }
}

function propertyStatus(property) {
  if (property.demoOnly) return 'DEMO';
  if (property?.blockchain?.minted) return 'MINTED';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return '3D READY';
  if (property?.commerce?.status === 'paid') return 'PURCHASED';
  return 'SOURCE';
}

function propertyCopy(property) {
  if (property.demoOnly) return 'Demo reference only. Add an authorized house photo to try the same 3D voxel photo → movable voxel flow.';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return 'Your movable voxel is ready. Reopen it, remake it from its reusable source, or optionally mint the finished digital voxel.';
  if (property?.commerce?.status === 'paid') return 'This purchased digital property can be used as a source for a 3D voxel photo and separate movable voxel.';
  return 'Use this property as a source for a photo-matched 3D voxel photo and separate movable voxel.';
}

function propertyCreateHref(property) {
  const params = new URLSearchParams({ source: 'properties', property: String(property.id || '') });
  return `/property?${params.toString()}`;
}

export default function VaultPage() {
  const [properties, setProperties] = useState([]);
  const [voxelRecords, setVoxelRecords] = useState([]);
  const [purchasedTwins, setPurchasedTwins] = useState([]);
  const [session, setSession] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState('Your saved properties and finished movable voxels live here.');
  const clientRef = useRef(null);

  const demoProperty = useMemo(() => readDemoProperty(), [properties.length]);
  const shownProperties = useMemo(
    () => demoProperty ? [demoProperty, ...properties.filter((item) => item.id !== demoProperty.id)] : properties,
    [demoProperty, properties],
  );
  const creations = useMemo(() => voxelRecords.map(summarizeVoxel).filter((item) => item.image), [voxelRecords]);

  function refreshLocal() {
    setProperties(readPropertyDrafts());
    setVoxelRecords(readLocalVoxelRecords());
  }

  useEffect(() => {
    refreshLocal();
    const refresh = () => refreshLocal();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('voxel-vault:property-draft-saved', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('voxel-vault:property-draft-saved', refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function apply(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      if (!nextSession?.user) {
        setPurchasedTwins([]);
        refreshLocal();
        setNote('Saved items on this device are shown below. Sign in to restore purchases and sync across devices.');
        return;
      }

      setSyncing(true);
      try {
        const [cloudProperties, cloudVoxels, ownedTwins] = await Promise.all([
          loadAccountPropertyDrafts(client, nextSession.user).catch(() => []),
          syncLocalVoxelsToAccount(client, nextSession.user).catch(() => []),
          fetch('/api/digital-estates/mine', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${nextSession.access_token}` },
          }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Purchased Digital Twins could not be loaded.');
            return Array.isArray(data.owned) ? data.owned : [];
          }).catch(() => []),
        ]);
        if (!active) return;
        const mergedProperties = mergePropertyDraftRecords(cloudProperties, readPropertyDrafts());
        replaceLocalPropertyDrafts(mergedProperties);
        setProperties(mergedProperties);
        setVoxelRecords(mergeVoxelRecords(cloudVoxels, readLocalVoxelRecords()));
        setPurchasedTwins(ownedTwins);
        setNote('Synced. Your property sources, movable voxels, and purchases are together here.');
      } catch (error) {
        if (active) setNote(error instanceof Error ? error.message : 'Account sync is unavailable. Your local Vault still works.');
      } finally {
        if (active) setSyncing(false);
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => apply(client, next));
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) setNote('Account sync is unavailable. Your saved items on this device are still shown.');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/vault', window.location.origin).toString() },
      });
      if (error) throw error;
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not start sign-in.');
    }
  }

  return <main className="page">
    <ProductTopNav/>
    <div className="shell">
      <header className="hero">
        <small>MY VAULT</small>
        <h1>Everything you made.<br/><em>Nothing confusing.</em></h1>
        <p>{note}</p>
        <div className="heroActions">
          <Link href="/property?source=properties" className="primary">Create a VoxelPop →</Link>
          {!session?.user
            ? <button type="button" onClick={signIn}>Sync with Google</button>
            : <span className="synced">✓ {syncing ? 'SYNCING' : 'SIGNED IN'}</span>}
        </div>
      </header>

      <section className="flow" aria-label="VoxelPop creation flow">
        <span>PHOTO</span><i>→</i><span>3D VOXEL PHOTO</span><i>→</i><span>MOVABLE VOXEL</span><i>→</i><span>VAULT</span><i>→</i><span>OPTIONAL MINT</span>
      </section>

      <section className="section">
        <div className="sectionHead">
          <div><small>MY PROPERTIES</small><h2>Sources + property voxels</h2><p>Pick a saved source to create, reopen, remake, or optionally mint its digital voxel.</p></div>
          <Link href="/property">+ New photo</Link>
        </div>
        {shownProperties.length ? <div className="grid">{shownProperties.map((property) => {
          const modelReady = Boolean(property?.visual?.modelUrl || property?.voxelpop?.modelUrl);
          const taskId = String(property?.visual?.modelTaskId || property?.voxelpop?.modelTaskId || '');
          const creationDraftId = String(property?.voxelpop?.creationDraftId || '');
          const mintReady = modelReady && taskId.startsWith('local-v1:') && creationDraftId;
          const collected = property?.commerce?.kind === 'property_voxel_collectible' && property?.commerce?.status === 'paid';
          return <article className={`card ${property.demoOnly ? 'demo' : ''}`} key={property.id}>
            <div className="visual">
              {property?.visual?.thumbnailUrl
                ? <img src={property.visual.thumbnailUrl} alt=""/>
                : <div className="miniHouse"><i/><i/><b/></div>}
              <span>{propertyStatus(property)}</span>
            </div>
            <div className="body">
              <small>{property.demoOnly ? 'TEST BUY · NOT REAL OWNERSHIP' : collected ? 'PURCHASED DIGITAL PROPERTY' : 'PROPERTY SOURCE'}</small>
              <h3>{property.label || 'Saved property'}</h3>
              <p>{propertyCopy(property)}</p>
              {property.demoOnly && property?.demoPurchase?.priceCents ? <div className="price"><b>{money(property.demoPurchase.priceCents)}</b><span>demo credit</span></div> : null}
              {collected && property?.commerce?.priceCents ? <div className="price"><b>{money(property.commerce.priceCents)}</b><span>{property.commerce.priceLabel || 'digital item'}</span></div> : null}
              <div className="actions">
                {modelReady && !property.demoOnly ? <Link href={`/vault/property-drafts/${encodeURIComponent(property.id)}`}>OPEN 3D</Link> : null}
                <Link className="primarySmall" href={propertyCreateHref(property)}>{modelReady ? 'REMAKE VOXEL' : 'CREATE VOXEL'}</Link>
                {mintReady ? <Link href={`/property/mint?draftId=${encodeURIComponent(creationDraftId)}&taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(property.label || 'VoxelPop Property')}`}>MINT · OPTIONAL</Link> : null}
              </div>
            </div>
          </article>;
        })}</div> : <div className="empty">
          <img src="/voxelpop/demo-house.svg" alt="Built-in illustrative VoxelPop sample house"/>
          <div><small>WHAT YOUR VAULT WILL HOLD</small><b>Property source → 3D voxel photo → movable voxel</b><p>Review the voxel photo first. Once you approve it, VoxelPop builds the separate movable model and saves it here.</p></div>
          <div className="emptyActions"><Link className="primarySmall" href="/demo">SEE FREE DEMO</Link><Link href="/property">CREATE · $4.99</Link></div>
        </div>}
      </section>

      <section className="section">
        <div className="sectionHead"><div><small>MY 3D CREATIONS</small><h2>Finished movable voxels</h2><p>Digital 3D creations tied to this device or signed-in account.</p></div><Link href="/studio">Other 3D tools →</Link></div>
        {creations.length ? <div className="creationGrid">{creations.slice(0, 12).map((creation) => <article className="creation" key={creation.sessionId}><img src={creation.image} alt=""/><div><small>{creation.mint?.tokenId ? 'MINTED' : creation.modelUrl ? '3D READY' : 'SAVED'}</small><h3>{creation.name}</h3><p>{creation.mint?.tokenId ? `VoxelFlip #${creation.mint.tokenId}` : creation.modelUrl ? 'Movable 3D voxel ready' : 'VoxelPop image saved'}</p></div></article>)}</div> : <div className="smallEmpty"><b>No extra creations yet.</b><span>Your property voxels stay organized above.</span></div>}
      </section>

      <details className="purchased" id="purchased-twins">
        <summary><span><small>MY PURCHASED TWINS</small><b>{purchasedTwins.length ? `${purchasedTwins.length} purchase${purchasedTwins.length === 1 ? '' : 's'}` : 'Account purchases'}</b></span><i>+</i></summary>
        <p>Digital Twin purchases live under one signed-in account. Their included voxel flow uses the same 3D voxel photo → movable voxel order.</p>
        {purchasedTwins.length ? <div className="grid purchasedGrid">{purchasedTwins.map((item) => {
          const estate = item.estate || {};
          const voxelReady = Boolean(item.voxelReady && item.voxelTaskId && item.voxelModelUrl);
          const mintHref = voxelReady ? `/property/mint?draftId=${encodeURIComponent(`estate-${estate.id}`)}&taskId=${encodeURIComponent(item.voxelTaskId)}&name=${encodeURIComponent(estate.name || 'Digital Twin')}` : '';
          return <article className="card" key={estate.id}>
            <div className="visual"><div className="miniHouse"><i/><i/><b/></div><span>{voxelReady ? '3D READY' : 'PURCHASED'}</span></div>
            <div className="body"><small>DIGITAL PURCHASE</small><h3>{estate.name || 'Purchased Digital Twin'}</h3><p>{voxelReady ? 'Your exact saved movable voxel is attached to this purchase.' : 'A custom VoxelPop voxel is included—no second $4.99 creation charge.'}</p><div className="actions"><Link className="primarySmall" href={`/vault/estates/${encodeURIComponent(estate.id)}/voxel`}>{voxelReady ? 'OPEN / REMAKE' : 'Create my 3D Voxel · included'}</Link><Link href="/vault/estates/mine">PURCHASE DETAILS</Link>{mintHref ? <Link href={mintHref}>MINT · OPTIONAL</Link> : null}</div></div>
          </article>;
        })}</div> : <div className="smallEmpty">{session?.user ? 'No Digital Twin purchases are attached to this account yet.' : 'Sign in to restore account-secured purchases.'}</div>}
      </details>

      <section className="extras"><div><small>OPTIONAL</small><h2>Need the other tools?</h2><p>Marketplace, property verification, finance/provider screens, wallets, and owner controls stay under More so your Vault remains a collection—not a dashboard.</p></div><Link href="/more">OPEN MORE →</Link></section>
      <p className="truth">A saved item does not mean physical ownership. Saving, sharing, mapping, or minting a VoxelPop does not itself transfer deed/title, rent, occupancy, fractional investment, or other rights in a physical property.</p>
    </div>

    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#24172c;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:0 12px calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 8% 8%,rgba(201,255,84,.2),transparent 24%),radial-gradient(circle at 92% 6%,rgba(113,56,245,.12),transparent 25%),#fffaf0}.shell{width:min(1040px,100%);margin:auto}.hero{text-align:center;padding:42px 0 24px}.hero>small,.sectionHead small,.purchased small,.extras small,.empty small{font-size:8px;letter-spacing:.14em;color:#7138f5;font-weight:1000}.hero h1{margin:10px 0 13px;font-size:clamp(46px,7.5vw,72px);line-height:.91;letter-spacing:-.062em}.hero h1 em{font-style:normal;color:#7138f5}.hero p{max-width:640px;margin:auto;color:#706671;font-size:12px;line-height:1.55}.heroActions{display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px}.heroActions a,.heroActions button,.synced{min-height:46px;padding:0 16px;border:1px solid #dfd6e3;border-radius:14px;background:#fff;color:#615665;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:9px;font-weight:1000}.heroActions .primary{background:#7138f5;color:#fff;border-color:#7138f5;box-shadow:0 5px 0 #4d1bc5}.synced{background:#f4ffe0;color:#52692d;border-color:#d8eeb0}.flow{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 auto 18px;padding:10px;border:1px solid #e5dde8;border-radius:18px;background:rgba(255,255,255,.78)}.flow span{padding:7px 9px;border-radius:999px;background:#f4efff;color:#6740b9;font-size:8px;font-weight:1000;letter-spacing:.05em}.flow i{font-style:normal;color:#aaa0ad}.section,.purchased,.extras{margin-top:12px;padding:22px;border:1px solid #e5dde8;border-radius:26px;background:rgba(255,255,255,.82);box-shadow:0 12px 30px rgba(77,53,91,.05)}.sectionHead{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:14px}.sectionHead h2,.extras h2{margin:5px 0 3px;font-size:27px;letter-spacing:-.04em}.sectionHead p,.extras p,.purchased>p{margin:0;color:#766c78;font-size:10.5px;line-height:1.5}.sectionHead>a,.extras>a{color:#7138f5;font-size:9px;font-weight:1000;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:11px}.card{overflow:hidden;border:1px solid #e7dfea;border-radius:20px;background:#fff}.card.demo{border-style:dashed}.visual{position:relative;height:164px;background:radial-gradient(circle at 50% 34%,rgba(201,255,84,.12),transparent 30%),#201629;overflow:hidden}.visual>img{width:100%;height:100%;object-fit:cover}.visual>span{position:absolute;top:10px;left:10px;padding:6px 8px;border-radius:999px;background:#c9ff54;color:#354c10;font-size:7px;font-weight:1000;letter-spacing:.07em}.miniHouse{position:absolute;left:27%;right:27%;bottom:29%;height:38%;background:#fff;border-radius:3px}.miniHouse:before{content:'';position:absolute;left:-10%;right:-10%;top:-15%;height:20%;background:#7138f5}.miniHouse i{position:absolute;top:28%;width:20%;height:28%;background:#c9ff54}.miniHouse i:first-child{left:15%}.miniHouse i:last-child{right:15%}.miniHouse b{position:absolute;left:43%;bottom:0;width:15%;height:38%;background:#8f654c}.body{padding:15px}.body>small,.creation small{color:#7138f5;font-size:7px;font-weight:1000;letter-spacing:.09em}.body h3,.creation h3{margin:5px 0 7px;font-size:18px;letter-spacing:-.03em}.body p,.creation p{margin:0;color:#766c78;font-size:9.5px;line-height:1.48}.price{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding:8px 9px;border-radius:11px;background:#f4ffe3}.price b{font-size:12px}.price span{font-size:8px;color:#64754a}.actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.actions a{min-height:40px;padding:4px 7px;border:1px solid #e1d9e5;border-radius:11px;color:#625767;text-decoration:none;display:grid;place-items:center;text-align:center;font-size:7px;font-weight:1000}.actions .primarySmall{background:#7138f5;color:#fff;border-color:#7138f5}.empty{display:grid;grid-template-columns:130px 1fr auto;align-items:center;gap:16px;padding:15px;border:1px dashed #dcd1e1;border-radius:19px;background:#fff}.empty>img{width:130px;aspect-ratio:4/3;object-fit:cover;border-radius:13px}.empty b{display:block;margin:5px 0;font-size:14px}.empty p{margin:0;color:#766c78;font-size:9.5px;line-height:1.5}.emptyActions{display:grid;gap:6px}.emptyActions a{min-height:39px;padding:0 11px;border:1px solid #ddd4e2;border-radius:11px;display:grid;place-items:center;color:#655b67;text-decoration:none;font-size:7.5px;font-weight:1000}.emptyActions .primarySmall{background:#7138f5;color:#fff;border-color:#7138f5}.creationGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}.creation{display:grid;grid-template-columns:82px 1fr;gap:11px;align-items:center;padding:9px;border:1px solid #e7dfea;border-radius:16px;background:#fff}.creation img{width:82px;height:72px;object-fit:cover;border-radius:11px;background:#21172c}.smallEmpty{padding:18px;border:1px dashed #ddd4e2;border-radius:16px;color:#776d79;font-size:10px}.smallEmpty b{display:block;color:#33263a;font-size:13px;margin-bottom:4px}.purchased{overflow:hidden}.purchased summary{list-style:none;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.purchased summary::-webkit-details-marker{display:none}.purchased summary span{display:grid;gap:4px}.purchased summary b{font-size:15px}.purchased summary i{width:30px;height:30px;border-radius:10px;background:#f0eaff;color:#7138f5;font-style:normal;display:grid;place-items:center;font-weight:1000}.purchased[open] summary i{transform:rotate(45deg)}.purchased>p{margin:12px 0}.extras{display:flex;align-items:center;justify-content:space-between;gap:18px}.extras>a{min-height:44px;padding:0 15px;border-radius:13px;background:#21172c;color:#fff;display:flex;align-items:center}.truth{max-width:850px;margin:16px auto 0;text-align:center;color:#958b96;font-size:8.5px;line-height:1.55}@media(max-width:700px){.page{padding-inline:9px}.hero{padding-top:30px}.hero h1{font-size:48px}.flow{justify-content:flex-start;overflow-x:auto;flex-wrap:nowrap}.flow span,.flow i{flex:0 0 auto}.section,.purchased,.extras{padding:16px;border-radius:21px}.sectionHead{align-items:flex-start}.grid{grid-template-columns:1fr}.visual{height:190px}.empty{grid-template-columns:92px 1fr}.empty>img{width:92px}.emptyActions{grid-column:1/-1;grid-template-columns:1fr 1fr;width:100%}.extras{align-items:flex-start;flex-direction:column}.extras>a{width:100%;justify-content:center}.actions a{min-height:44px}.creationGrid{grid-template-columns:1fr}}@media(max-width:420px){.hero h1{font-size:42px}.sectionHead{display:grid}.empty{grid-template-columns:1fr;text-align:center}.empty>img{width:100%;max-height:180px}.emptyActions{grid-template-columns:1fr}.creation{grid-template-columns:72px 1fr}.creation img{width:72px}}
    `}</style>
  </main>;
}
