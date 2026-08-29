'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    return { id: `demo-slice:${String(purchase.selectedName).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`, type: 'voxel-vault-demo-property-slice', label: purchase.selectedName, demoOnly: true, demoPurchase: purchase };
  } catch { return null; }
}
function propertyStatus(property) {
  if (property.demoOnly) return 'DEMO';
  if (property?.blockchain?.minted) return 'MINTED';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return '3D READY';
  if (property?.commerce?.status === 'paid') return 'PURCHASED';
  return 'PROPERTY';
}
function propertyCopy(property) {
  if (property.demoOnly) return 'A demo property reference. Add a house photo to try the same 3D preview → voxel flow.';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return 'Your voxel is ready. Open it, remake it from the reusable photo, or optionally mint the finished digital voxel.';
  if (property?.commerce?.status === 'paid') return 'This purchased digital property is ready to use as the source for a 3D preview and voxel.';
  return 'Use this property as the source for a new photo-matched 3D preview and voxel.';
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
  const [note, setNote] = useState('Your properties and finished 3D creations live here.');
  const clientRef = useRef(null);

  const demoProperty = useMemo(() => readDemoProperty(), [properties.length]);
  const shownProperties = useMemo(() => demoProperty ? [demoProperty, ...properties.filter((item) => item.id !== demoProperty.id)] : properties, [demoProperty, properties]);
  const creations = useMemo(() => voxelRecords.map(summarizeVoxel).filter((item) => item.image), [voxelRecords]);
  const collectionEmpty = shownProperties.length === 0 && creations.length === 0;

  function refreshLocal() { setProperties(readPropertyDrafts()); setVoxelRecords(readLocalVoxelRecords()); }

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
          fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${nextSession.access_token}` } }).then(async (response) => {
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
        setNote('Synced. Your properties and 3D creations are together here.');
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
    }).catch(() => { if (active) setNote('Account sync is unavailable. Your saved items on this device are still shown.'); });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not start sign-in.');
    }
  }

  return <main className="page"><div className="shell">
    <header className="hero">
      <small>MY VAULT</small>
      <h1>Your 3D<br/><em>collection.</em></h1>
      <p role="status">{note}</p>
      <div className="heroActions">
        <Link href="/property?source=properties" className="primary">Create from My Properties →</Link>
        {!session?.user ? <button type="button" onClick={signIn}>Sync with Google</button> : <span className="synced">✓ {syncing ? 'SYNCING' : 'SIGNED IN'}</span>}
      </div>
    </header>

    {collectionEmpty ? <section className="collectionPreview" aria-label="Preview of a populated Vault">
      <div className="previewHead"><div><small>YOUR FIRST CREATION WILL LAND HERE</small><h2>A vault should show what it will hold.</h2></div><span>PREVIEW ONLY</span></div>
      <div className="previewGrid">
        <div><i>PHOTO</i><b>Property source</b><span>The photo you chose stays reusable on this device.</span></div>
        <div className="purple"><i>3D</i><b>Movable voxel</b><span>The finished 3D creation becomes the main collectible object.</span></div>
        <div className="lime"><i>OPTIONAL</i><b>World / Mint</b><span>Place it in World or mint later. Neither is required.</span></div>
      </div>
      <Link href="/property">Create my first voxel →</Link>
    </section> : null}

    <section className="section">
      <div className="sectionHead"><div><small>MY PROPERTIES</small><h2>Sources you can reuse.</h2><p>Open, remake, or continue from a saved property without hunting through other tools.</p></div><Link href="/property">+ New photo</Link></div>
      {shownProperties.length ? <div className="propertyGrid">{shownProperties.map((property) => {
        const modelReady = Boolean(property?.visual?.modelUrl || property?.voxelpop?.modelUrl);
        const taskId = String(property?.visual?.modelTaskId || property?.voxelpop?.modelTaskId || '');
        const creationDraftId = String(property?.voxelpop?.creationDraftId || '');
        const mintReady = modelReady && taskId.startsWith('local-v1:') && creationDraftId;
        const collected = property?.commerce?.kind === 'property_voxel_collectible' && property?.commerce?.status === 'paid';
        return <article className={`propertyCard ${property.demoOnly ? 'demo' : ''}`} key={property.id}>
          <div className="propertyVisual">{property?.visual?.thumbnailUrl ? <img src={property.visual.thumbnailUrl} alt=""/> : <div className="miniScene"><i/><i/><b/></div>}<span>{propertyStatus(property)}</span></div>
          <div className="propertyBody">
            <small>{property.demoOnly ? 'TEST BUY · NOT REAL OWNERSHIP' : collected ? 'PURCHASED DIGITAL PROPERTY' : 'PROPERTY SOURCE'}</small>
            <h3>{property.label || 'Saved property'}</h3>
            <p>{propertyCopy(property)}</p>
            {property.demoOnly && property?.demoPurchase?.priceCents ? <div className="priceLine"><b>{money(property.demoPurchase.priceCents)}</b><span>demo credit</span></div> : null}
            {collected && property?.commerce?.priceCents ? <div className="priceLine"><b>{money(property.commerce.priceCents)}</b><span>{property.commerce.priceLabel || 'digital item'}</span></div> : null}
            <div className="cardActions">
              {modelReady && !property.demoOnly ? <Link href={`/vault/property-drafts/${encodeURIComponent(property.id)}`} className="open3d">Open 3D</Link> : null}
              <Link href={propertyCreateHref(property)} className="make3d">{modelReady ? 'Remake voxel' : 'Create voxel'}</Link>
              {mintReady ? <Link href={`/property/mint?draftId=${encodeURIComponent(creationDraftId)}&taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(property.label || 'VoxelPop Property')}`} className="mint">Optional mint</Link> : null}
            </div>
          </div>
        </article>;
      })}</div> : <div className="smallEmpty">No property sources yet. Your first authorized photo will appear here after you start a creation.</div>}
    </section>

    <section className="section creationsSection">
      <div className="sectionHead"><div><small>MY 3D CREATIONS</small><h2>Finished work first.</h2><p>These are the VoxelPop outputs tied to this device or account.</p></div><Link href="/studio">Other 3D tools →</Link></div>
      {creations.length ? <div className="creationGrid">{creations.slice(0, 12).map((creation) => <article className="creationCard" key={creation.sessionId}><div className="creationImage"><img src={creation.image} alt=""/><span>{creation.mint?.tokenId ? 'MINTED' : creation.modelUrl ? '3D READY' : 'IMAGE'}</span></div><div><h3>{creation.name}</h3><p>{creation.mint?.tokenId ? `VoxelFlip #${creation.mint.tokenId}` : creation.modelUrl ? 'Movable 3D model ready' : 'VoxelPop image saved'}</p></div></article>)}</div> : <div className="smallEmpty">No finished 3D creations yet. Complete the 3D preview → approval → voxel flow and it will appear here.</div>}
    </section>

    <details className="purchased" id="purchased-twins">
      <summary><span><small>MY PURCHASED TWINS</small><b>{purchasedTwins.length ? `${purchasedTwins.length} purchase${purchasedTwins.length === 1 ? '' : 's'}` : 'Account purchases'}</b></span><i>+</i></summary>
      <p className="purchasedIntro">Purchased Digital Twins stay available without taking over the everyday Vault.</p>
      {purchasedTwins.length ? <div className="propertyGrid">{purchasedTwins.map((item) => {
        const estate = item.estate || {};
        const voxelReady = Boolean(item.voxelReady && item.voxelTaskId && item.voxelModelUrl);
        const mintHref = voxelReady ? `/property/mint?draftId=${encodeURIComponent(`estate-${estate.id}`)}&taskId=${encodeURIComponent(item.voxelTaskId)}&name=${encodeURIComponent(estate.name || 'Digital Twin')}` : '';
        return <article className="propertyCard" key={estate.id}><div className="propertyVisual"><div className="miniScene"><i/><i/><b/></div><span>{voxelReady ? '3D READY' : 'PURCHASED'}</span></div><div className="propertyBody"><small>DIGITAL PURCHASE</small><h3>{estate.name || 'Purchased Digital Twin'}</h3><p>{voxelReady ? 'Your saved 3D voxel is attached to this purchase.' : 'Its custom VoxelPop 3D voxel is included with the purchase—no second property-creation charge.'}</p><div className="cardActions"><Link href={`/vault/estates/${encodeURIComponent(estate.id)}/voxel`} className="make3d">{voxelReady ? 'Open / remake' : 'Create my 3D Voxel · included'}</Link><Link href="/vault/estates/mine" className="open3d">Purchase details</Link>{mintHref ? <Link href={mintHref} className="mint">Optional mint</Link> : null}</div></div></article>;
      })}</div> : <div className="smallEmpty">{session?.user ? 'No Digital Twin purchases are attached to this account yet.' : 'Sign in to restore account-secured purchases.'}</div>}
    </details>

    <section className="extras"><div><small>OPTIONAL</small><h2>Need the other tools?</h2><p>Marketplace, property verification, investment-provider screens, wallets, and owner controls stay under More so this collection remains understandable.</p></div><Link href="/more">Open More →</Link></section>
  </div>

  <style jsx>{`
    :global(body){margin:0;background:#fffaf0;color:#25180f;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:8px 10px 22px;background:radial-gradient(circle at 8% 12%,#efffb350 0,transparent 24%),radial-gradient(circle at 92% 8%,#eee4ff 0,transparent 27%),#fffaf0}.shell{width:min(1050px,100%);margin:auto}.hero{text-align:center;padding:44px 0 31px}.hero>small,.sectionHead small,.extras small,.purchased small,.previewHead small{font-size:10px;letter-spacing:.14em;color:#7138f5;font-weight:1000}.hero h1{margin:8px 0 12px;font-size:clamp(48px,8vw,76px);line-height:.91;letter-spacing:-.064em}.hero h1 em{font-style:normal;color:#7138f5}.hero p{max-width:660px;margin:auto;color:#625a61;font-size:13px;line-height:1.55}.heroActions{margin:17px auto 0;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}.heroActions a,.heroActions button{min-height:48px;padding:0 16px;border-radius:14px;border:1px solid #ded5e3;background:#fff;color:#625866;font:inherit;font-size:11px;font-weight:950;text-decoration:none;cursor:pointer}.heroActions .primary{background:#7138f5;color:#fff;border-color:#7138f5;box-shadow:0 5px 0 #4d1bc5}.synced{padding:9px 12px;border-radius:999px;background:#f2ffd8;color:#4c681b;font-size:10px;font-weight:1000;letter-spacing:.07em}.collectionPreview{margin-bottom:28px;padding:22px;border:1px solid #dcd3e1;border-radius:26px;background:#ffffffd9;box-shadow:0 15px 42px rgba(65,44,79,.07)}.previewHead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:13px}.previewHead h2{margin:5px 0 0;font-size:clamp(25px,4vw,37px);letter-spacing:-.045em}.previewHead>span{padding:7px 9px;border-radius:999px;background:#eee7ff;color:#5c31c6;font-size:9px;font-weight:1000}.previewGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.previewGrid>div{min-height:145px;padding:15px;border:1px solid #e5dde8;border-radius:18px;background:linear-gradient(145deg,#fff7e2,#fff);display:grid;align-content:end;gap:5px}.previewGrid>div.purple{background:linear-gradient(145deg,#eee7ff,#fff)}.previewGrid>div.lime{background:linear-gradient(145deg,#f2ffd8,#fff)}.previewGrid i{width:max-content;padding:5px 7px;border-radius:8px;background:#fff;color:#6a3dcf;font-style:normal;font-size:9px;font-weight:1000}.previewGrid b{font-size:16px}.previewGrid span{color:#655e67;font-size:11px;line-height:1.45}.collectionPreview>a{min-height:48px;margin-top:11px;border-radius:14px;background:#7138f5;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:1000;box-shadow:0 4px 0 #4d1bc5}.section{padding:27px 0;border-top:1px solid #e8dfd6}.sectionHead{display:flex;align-items:end;justify-content:space-between;gap:15px;margin-bottom:13px}.sectionHead h2,.extras h2{font-size:clamp(28px,4.5vw,42px);letter-spacing:-.05em;margin:4px 0 0}.sectionHead p{margin:5px 0 0;color:#675f65;font-size:11px;line-height:1.48}.sectionHead>a{font-size:10px;font-weight:950;color:#5d36c1;text-decoration:none}.propertyGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.propertyCard{overflow:hidden;border:1px solid #e1d9e5;border-radius:22px;background:#ffffffdf;box-shadow:0 12px 34px rgba(69,43,94,.06)}.propertyCard.demo{border-style:dashed}.propertyVisual{height:205px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 30%,rgba(201,255,84,.16),transparent 32%),#21172c}.propertyVisual>img{width:100%;height:100%;object-fit:cover}.propertyVisual>span,.creationImage>span{position:absolute;left:12px;top:12px;padding:6px 9px;border-radius:999px;background:#7138f5;color:#fff;font-size:9px;font-weight:1000;letter-spacing:.08em}.miniScene{position:absolute;inset:0}.miniScene:before{content:'';position:absolute;left:14%;right:14%;bottom:17%;height:33%;background:#8fce52;transform:perspective(330px) rotateX(62deg);border-radius:16px}.miniScene b{position:absolute;left:35%;right:35%;bottom:31%;height:34%;background:#f0c78f}.miniScene b:before{content:'';position:absolute;left:-12%;right:-12%;top:-18%;height:24%;background:#7552c0;transform:skewY(-8deg)}.miniScene i{position:absolute;z-index:2;bottom:38%;width:8%;height:13%;background:#9edee2}.miniScene i:first-child{left:40%}.miniScene i:nth-child(2){right:40%}.propertyBody{padding:16px}.propertyBody>small{font-size:9px;color:#693dd1;font-weight:1000;letter-spacing:.1em}.propertyBody h3{font-size:23px;letter-spacing:-.04em;margin:6px 0 7px}.propertyBody p{margin:0;color:#665f67;font-size:11px;line-height:1.5}.priceLine{margin-top:10px;padding:9px 10px;border-radius:12px;background:#f2ffe0;display:flex;align-items:center;justify-content:space-between;color:#526a2e}.priceLine b{font-size:14px}.priceLine span{font-size:10px;font-weight:900}.cardActions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.cardActions a{min-height:44px;border-radius:12px;display:grid;place-items:center;text-align:center;text-decoration:none;font-size:10px;font-weight:1000;padding:4px 7px}.make3d{background:#7138f5;color:#fff;box-shadow:0 4px 0 #4d1bc5}.open3d{border:1px solid #ded6e4;background:#fff;color:#5f5562}.mint{grid-column:1/-1;background:#27202d;color:#fff}.creationsSection{padding-bottom:28px}.creationGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.creationCard{overflow:hidden;border:1px solid #e3dbe7;border-radius:18px;background:#fff}.creationImage{height:150px;position:relative;background:#21172c}.creationImage img{width:100%;height:100%;object-fit:cover}.creationCard>div:last-child{padding:11px}.creationCard h3{margin:0;font-size:15px}.creationCard p{margin:4px 0 0;color:#6e6570;font-size:10px}.smallEmpty{padding:18px;border:1px solid #e4dce7;border-radius:17px;background:#ffffffb8;color:#655d66;font-size:11px;line-height:1.5}.purchased{margin:2px 0 24px;border:1px solid #e5dce8;border-radius:22px;background:#ffffffb8;overflow:hidden}.purchased summary{list-style:none;cursor:pointer;padding:17px;display:flex;align-items:center;justify-content:space-between;gap:12px}.purchased summary::-webkit-details-marker{display:none}.purchased summary span{display:grid;gap:3px;text-align:left}.purchased summary b{font-size:16px}.purchased summary i{width:33px;height:33px;border-radius:10px;background:#eee8ff;color:#7138f5;display:grid;place-items:center;font-style:normal;font-weight:1000}.purchased[open] summary i{transform:rotate(45deg)}.purchasedIntro{margin:0;padding:0 17px 15px;color:#655e66;font-size:11px}.purchased .propertyGrid,.purchased .smallEmpty{margin:0 17px 17px}.extras{padding:22px;border-radius:22px;background:#21172c;color:#fff;display:grid;grid-template-columns:1fr auto;align-items:center;gap:17px}.extras small{color:#c9ff54}.extras h2{margin-top:5px}.extras p{max-width:650px;margin:7px 0 0;color:#c7bdcb;font-size:11px;line-height:1.55}.extras>a{min-width:135px;min-height:46px;border-radius:13px;background:#7138f5;color:#fff;text-decoration:none;display:grid;place-items:center;font-size:10px;font-weight:1000}@media(max-width:720px){.hero{padding-top:31px}.hero h1{font-size:51px}.previewGrid,.propertyGrid,.creationGrid{grid-template-columns:1fr}.sectionHead{align-items:flex-start}.propertyVisual{height:190px}.extras{grid-template-columns:1fr}.extras>a{width:100%}}@media(max-width:480px){.page{padding-left:8px;padding-right:8px}.heroActions{display:grid}.heroActions>*{width:100%;box-sizing:border-box}.previewHead{align-items:flex-start;display:grid}.cardActions{grid-template-columns:1fr}.mint{grid-column:auto}.purchased .propertyGrid,.purchased .smallEmpty{margin-left:12px;margin-right:12px}}
  `}</style>
  </main>;
}
