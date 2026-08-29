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
  if (property.demoOnly) return 'DEMO PROPERTY';
  if (property?.blockchain?.minted) return 'MINTED';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return '3D VOXEL READY';
  if (property?.commerce?.status === 'paid') return 'PURCHASED';
  return 'SAVED PROPERTY';
}

function propertyCopy(property) {
  if (property.demoOnly) return 'Your Test Buy is saved as a demo property reference. Add a house photo to turn the same selected property into a VoxelPop 3D creation.';
  if (property?.visual?.modelUrl || property?.voxelpop?.modelUrl) return 'This property already has a saved 3D voxel. Open it, rebuild from its reusable photo, or mint the finished digital voxel.';
  if (property?.commerce?.status === 'paid') return 'This purchased digital property is in your Vault. Use it as the property source, add or reuse its photo, then create the 3D preview and voxel.';
  return 'Use this saved property as the source for a new photo-matched 3D preview and voxel.';
}

function propertyCreateHref(property) {
  const params = new URLSearchParams({ source: 'properties', property: String(property.id || '') });
  return `/property?${params.toString()}`;
}

export default function VaultPage() {
  const [properties, setProperties] = useState([]);
  const [voxelRecords, setVoxelRecords] = useState([]);
  const [session, setSession] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState('Your properties and VoxelPop creations live here.');
  const clientRef = useRef(null);

  const demoProperty = useMemo(() => readDemoProperty(), [properties.length]);
  const shownProperties = useMemo(() => demoProperty ? [demoProperty, ...properties.filter((item) => item.id !== demoProperty.id)] : properties, [demoProperty, properties]);
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
        refreshLocal();
        setNote('Saved items on this device are shown below. Sign in to sync across devices.');
        return;
      }

      setSyncing(true);
      try {
        const [cloudProperties, cloudVoxels] = await Promise.all([
          loadAccountPropertyDrafts(client, nextSession.user).catch(() => []),
          syncLocalVoxelsToAccount(client, nextSession.user).catch(() => []),
        ]);
        if (!active) return;
        const mergedProperties = mergePropertyDraftRecords(cloudProperties, readPropertyDrafts());
        replaceLocalPropertyDrafts(mergedProperties);
        setProperties(mergedProperties);
        setVoxelRecords(mergeVoxelRecords(cloudVoxels, readLocalVoxelRecords()));
        setNote('Synced. Your property sources and 3D creations are together here.');
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
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not start sign-in.');
    }
  }

  return <main className="page">
    <div className="shell">
      <nav className="top">
        <Link href="/" className="brand"><span>V</span><b>VOXEL VAULT</b></Link>
        <div><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/more">More</Link></div>
      </nav>

      <header className="hero">
        <small>MY VAULT</small>
        <h1>Your properties.<br/><em>Your voxels.</em></h1>
        <p>{note}</p>
        <div className="heroActions">
          <Link href="/property?source=properties" className="primary">Create from My Properties →</Link>
          {!session?.user ? <button type="button" onClick={signIn}>Sync with Google</button> : <span className="synced">✓ {syncing ? 'SYNCING' : 'SIGNED IN'}</span>}
        </div>
      </header>

      <section className="section">
        <div className="sectionHead"><div><small>MY PROPERTIES</small><h2>Pick one. Make it 3D.</h2></div><Link href="/geo/slice">Try $1.99 demo →</Link></div>
        {shownProperties.length ? <div className="propertyGrid">{shownProperties.map((property) => {
          const modelReady = Boolean(property?.visual?.modelUrl || property?.voxelpop?.modelUrl);
          const taskId = String(property?.visual?.modelTaskId || property?.voxelpop?.modelTaskId || '');
          const creationDraftId = String(property?.voxelpop?.creationDraftId || '');
          const mintReady = modelReady && taskId.startsWith('local-v1:') && creationDraftId;
          const collected = property?.commerce?.kind === 'property_voxel_collectible' && property?.commerce?.status === 'paid';
          return <article className={`propertyCard ${property.demoOnly ? 'demo' : ''}`} key={property.id}>
            <div className="propertyVisual">
              {property?.visual?.thumbnailUrl ? <img src={property.visual.thumbnailUrl} alt=""/> : <div className="miniScene"><i/><i/><b/></div>}
              <span>{propertyStatus(property)}</span>
            </div>
            <div className="propertyBody">
              <small>{property.demoOnly ? 'TEST BUY · NOT REAL OWNERSHIP' : collected ? 'PURCHASED DIGITAL PROPERTY' : 'PROPERTY SOURCE'}</small>
              <h3>{property.label || 'Saved property'}</h3>
              <p>{propertyCopy(property)}</p>
              {property.demoOnly && property?.demoPurchase?.priceCents ? <div className="priceLine"><b>{money(property.demoPurchase.priceCents)}</b><span>demo credit</span></div> : null}
              {collected && property?.commerce?.priceCents ? <div className="priceLine"><b>{money(property.commerce.priceCents)}</b><span>{property.commerce.priceLabel || 'digital item'}</span></div> : null}
              <div className="cardActions">
                {modelReady && !property.demoOnly ? <Link href={`/vault/property-drafts/${encodeURIComponent(property.id)}`} className="open3d">Open 3D</Link> : null}
                <Link href={propertyCreateHref(property)} className="make3d">{modelReady ? 'Re-create 3D Voxel' : 'Create 3D Voxel'}</Link>
                {mintReady ? <Link href={`/property/mint?draftId=${encodeURIComponent(creationDraftId)}&taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(property.label || 'VoxelPop Property')}`} className="mint">Mint digital voxel</Link> : null}
              </div>
            </div>
          </article>;
        })}</div> : <div className="empty">
          <div className="emptyIcon">⌂</div><h3>No properties in your Vault yet.</h3><p>Start with a photo or try the demo property selector. Once a property is here, you can use it as the source for the 3D preview → voxel → optional mint flow.</p><Link href="/property">Add my first property →</Link>
        </div>}
      </section>

      <section className="section creationsSection">
        <div className="sectionHead"><div><small>MY 3D CREATIONS</small><h2>Finished digital things.</h2></div><Link href="/studio">Open Studio →</Link></div>
        {creations.length ? <div className="creationGrid">{creations.slice(0, 12).map((creation) => <article className="creationCard" key={creation.sessionId}>
          <div className="creationImage"><img src={creation.image} alt=""/><span>{creation.mint?.tokenId ? 'MINTED' : creation.modelUrl ? '3D READY' : 'IMAGE'}</span></div>
          <div><h3>{creation.name}</h3><p>{creation.mint?.tokenId ? `VoxelFlip #${creation.mint.tokenId}` : creation.modelUrl ? 'Movable 3D model ready' : 'VoxelPop image saved'}</p></div>
        </article>)}</div> : <div className="smallEmpty">Your non-property VoxelPop creations will appear here. <Link href="/studio">Create one →</Link></div>}
      </section>

      <section className="extras">
        <div><small>OPTIONAL</small><h2>Need the other tools?</h2><p>Wallets, marketplace tools, property verification, investment-provider screens, and owner controls are kept out of the main Vault so your collection stays understandable.</p></div>
        <Link href="/more">Open More →</Link>
      </section>

      <footer>A VoxelPop creation, demo property, payment, map marker, or NFT is a digital record—not a deed, title, rent right, security, or ownership of the physical property.</footer>
    </div>
    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#25180f;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px 12px calc(95px + env(safe-area-inset-bottom));background:radial-gradient(circle at 8% 12%,#efffb3 0,transparent 25%),radial-gradient(circle at 92% 8%,#eee4ff 0,transparent 27%),radial-gradient(circle at 80% 82%,#ffe7b8 0,transparent 24%),#fffaf0}.shell{width:min(1050px,100%);margin:auto}.top{min-height:58px;display:flex;justify-content:space-between;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#281b13;font-size:9px;letter-spacing:.13em}.brand span{width:37px;height:37px;border-radius:13px;display:grid;place-items:center;background:#7138f5;color:#fff;font-size:19px;box-shadow:0 5px 0 #4f20c5}.top>div{display:flex;gap:5px}.top>div a{padding:10px 12px;border:1px solid #e1d8e7;border-radius:999px;background:#ffffffbd;color:#615762;text-decoration:none;font-size:8px;font-weight:950}.hero{text-align:center;padding:62px 0 36px}.hero>small,.sectionHead small,.extras small{font-size:8px;letter-spacing:.16em;color:#7138f5;font-weight:1000}.hero h1{margin:10px 0 15px;font-size:clamp(53px,9vw,92px);line-height:.88;letter-spacing:-.07em}.hero h1 em{font-style:normal;color:#7138f5}.hero p{max-width:680px;margin:auto;color:#81756d;font-size:13px;line-height:1.6}.heroActions{margin:22px auto 0;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap}.heroActions a,.heroActions button{min-height:52px;padding:0 19px;border-radius:17px;border:1px solid #ded5e3;background:#fff;color:#655b65;font:inherit;font-size:10px;font-weight:1000;text-decoration:none;cursor:pointer}.heroActions .primary{background:#7138f5;color:#fff;border-color:#7138f5;box-shadow:0 7px 0 #4d1bc5}.synced{padding:10px 13px;border-radius:999px;background:#edffd0;color:#50701d;font-size:8px;font-weight:1000;letter-spacing:.08em}.section{padding:30px 0;border-top:1px solid #e8dfd6}.sectionHead{display:flex;align-items:end;justify-content:space-between;gap:15px;margin-bottom:14px}.sectionHead h2,.extras h2{font-size:clamp(29px,5vw,48px);letter-spacing:-.055em;margin:5px 0 0}.sectionHead>a{font-size:9px;font-weight:950;color:#694fc0;text-decoration:none}.propertyGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.propertyCard{overflow:hidden;border:1px solid #e1d9e5;border-radius:28px;background:#ffffffdb;box-shadow:0 16px 45px rgba(69,43,94,.07)}.propertyCard.demo{border-style:dashed}.propertyVisual{height:235px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 30%,rgba(201,255,84,.16),transparent 32%),#21172c}.propertyVisual>img{width:100%;height:100%;object-fit:cover}.propertyVisual>span,.creationImage>span{position:absolute;left:14px;top:14px;padding:7px 10px;border-radius:999px;background:#c9ff54;color:#314a09;font-size:7px;font-weight:1000;letter-spacing:.09em}.miniScene{position:absolute;inset:0}.miniScene:before{content:'';position:absolute;left:14%;right:14%;bottom:17%;height:33%;background:#8fce52;transform:perspective(330px) rotateX(62deg);border-radius:16px}.miniScene b{position:absolute;left:35%;right:35%;bottom:31%;height:34%;background:#f0c78f}.miniScene b:before{content:'';position:absolute;left:-12%;right:-12%;top:-18%;height:24%;background:#7552c0;transform:skewY(-8deg)}.miniScene i{position:absolute;z-index:2;bottom:38%;width:8%;height:13%;background:#9edee2}.miniScene i:first-child{left:40%}.miniScene i:nth-child(2){right:40%}.propertyBody{padding:19px}.propertyBody>small{font-size:7px;color:#7c5be0;font-weight:1000;letter-spacing:.11em}.propertyBody h3{font-size:27px;letter-spacing:-.045em;margin:7px 0 8px}.propertyBody p{margin:0;color:#7d727a;font-size:10px;line-height:1.55}.priceLine{margin-top:12px;padding:10px 11px;border-radius:13px;background:#f2ffe0;display:flex;align-items:center;justify-content:space-between;color:#526a2e}.priceLine b{font-size:15px}.priceLine span{font-size:8px;font-weight:900}.cardActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:15px}.cardActions a{min-height:47px;border-radius:14px;display:grid;place-items:center;text-align:center;text-decoration:none;font-size:8px;font-weight:1000;padding:4px 7px}.make3d{background:#7138f5;color:#fff;box-shadow:0 5px 0 #4d1bc5}.open3d{border:1px solid #ded6e4;background:#fff;color:#665c69}.mint{grid-column:1/-1;background:#21172c;color:#fff}.empty{padding:34px;border:1px dashed #d9ccdf;border-radius:28px;background:#ffffffa8;text-align:center}.emptyIcon{width:70px;height:70px;border-radius:23px;margin:auto;display:grid;place-items:center;background:#c9ff54;font-size:30px}.empty h3{font-size:24px;margin:14px 0 7px}.empty p{max-width:600px;margin:auto;color:#81756d;font-size:11px;line-height:1.6}.empty a{display:inline-grid;place-items:center;margin-top:15px;padding:14px 18px;border-radius:15px;background:#7138f5;color:#fff;text-decoration:none;font-size:9px;font-weight:1000}.creationsSection{padding-bottom:40px}.creationGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.creationCard{overflow:hidden;border:1px solid #e3dbe7;border-radius:20px;background:#fff}.creationImage{height:165px;position:relative;background:#21172c}.creationImage img{width:100%;height:100%;object-fit:cover}.creationCard>div:last-child{padding:13px}.creationCard h3{margin:0;font-size:17px}.creationCard p{margin:4px 0 0;color:#827883;font-size:8px}.smallEmpty{padding:22px;border-radius:20px;background:#ffffffb0;color:#756b73;font-size:10px}.smallEmpty a{color:#7138f5;font-weight:900}.extras{margin-top:8px;padding:26px;border-radius:28px;background:#21172c;color:#fff;display:grid;grid-template-columns:1fr auto;align-items:center;gap:20px}.extras small{color:#c9ff54}.extras h2{margin-top:6px}.extras p{max-width:670px;margin:8px 0 0;color:#bfb4c9;font-size:10px;line-height:1.6}.extras>a{min-width:145px;min-height:50px;border-radius:15px;background:#c9ff54;color:#294300;text-decoration:none;display:grid;place-items:center;font-size:9px;font-weight:1000}footer{padding:22px 4px 8px;color:#9d938b;font-size:8px;line-height:1.6;text-align:center}@media(max-width:720px){.hero{padding-top:44px}.hero h1{font-size:58px}.propertyGrid,.creationGrid{grid-template-columns:1fr}.sectionHead{align-items:flex-start}.propertyVisual{height:215px}.extras{grid-template-columns:1fr}.extras>a{width:100%}}@media(max-width:480px){.page{padding-left:9px;padding-right:9px}.top>div a{padding:9px 10px}.top>div a:last-child{display:none}.heroActions{display:grid}.heroActions>*{width:100%;box-sizing:border-box}.cardActions{grid-template-columns:1fr}.mint{grid-column:auto}}
    `}</style>
  </main>;
}