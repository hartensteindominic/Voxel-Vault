'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import GeoReferenceModel from '../../../geo/GeoReferenceModel';
import MeshyModelViewer from '../../earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { mergePropertyDraftRecords, readPropertyDraft, replaceLocalPropertyDrafts } from '../../../../lib/property-drafts';
import { loadAccountPropertyDrafts } from '../../../../lib/property-drafts-account';

function fidelityLabel(value) {
  if (value === 'photo-to-3d-to-voxel-collectible' || value === 'purchased-photo-guided-voxel-3d') return 'COLLECTED · VOXELPOP 3D';
  if (value === 'parcel-linked-ready-for-high-fidelity') return 'PARCEL-LINKED · HIGH-FIDELITY READY';
  if (value === 'source-backed-ready-for-high-fidelity') return 'SOURCE-BACKED · HIGH-FIDELITY READY';
  if (value === 'parcel-linked-3d-draft') return 'PARCEL-LINKED 3D DRAFT';
  if (value === 'source-backed-3d-draft') return 'SOURCE-BACKED 3D DRAFT';
  if (value === 'parcel-3d-draft') return 'PARCEL 3D DRAFT';
  return 'LOCATION REFERENCE';
}

function savedReference(draft) {
  if (!draft) return null;
  const parcelOnly = draft.geometryKind === 'parcel-boundary';
  const lat = Number(draft?.coordinates?.latitude);
  const lng = Number(draft?.coordinates?.longitude);
  const height = Number(draft?.evidence?.calibratedVisualHeightMeters);
  return {
    found: Boolean(draft.geometry && !parcelOnly),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    geometry: parcelOnly ? null : (draft.geometry || null),
    tags: { name: draft.label || 'Saved property draft' },
    height: Number.isFinite(height) && height > 0 ? {
      referenceHeightMeters: height,
      heightStatus: 'saved_calibrated_reference',
      heightSource: draft?.evidence?.mapAuthority || 'Saved property draft',
    } : null,
    matchStrategy: draft?.evidence?.exactParcelLinkedBuilding ? 'saved_parcel_linked_draft' : 'saved_source_backed_draft',
    source: {
      authority: draft?.evidence?.mapAuthority || 'Saved Voxel Vault draft',
      license: draft?.evidence?.mapLicense || '',
      sourceUrl: draft?.evidence?.mapSourceUrl || '',
    },
    neighborhoodBuildings: [],
  };
}

function savedAuthoritativeTwin(draft) {
  if (!draft || draft.geometryKind !== 'parcel-boundary' || !draft.geometry) return null;
  return {
    location: {
      parcelGeometry: draft.geometry,
      latitude: draft?.coordinates?.latitude ?? null,
      longitude: draft?.coordinates?.longitude ?? null,
      source: { authority: draft?.evidence?.mapAuthority || 'Saved parcel evidence' },
    },
    structure: { buildingGeometry: null },
  };
}

export default function SavedPropertyDraft3DPage() {
  const params = useParams();
  const draftId = String(params?.draftId || '');
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('Opening your saved 3D property snapshot…');
  const [liveStatus, setLiveStatus] = useState('');
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const reference = useMemo(() => savedReference(draft), [draft]);
  const authoritativeTwin = useMemo(() => savedAuthoritativeTwin(draft), [draft]);
  const generatedModelUrl = draft?.visual?.modelUrl || null;
  const collected = draft?.commerce?.kind === 'property_voxel_collectible' && draft?.commerce?.status === 'paid';

  useEffect(() => {
    let active = true;
    let subscription = null;
    async function restore(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      const local = readPropertyDraft(draftId);
      if (local) {
        setDraft(local);
        setStatus(local?.visual?.modelUrl ? 'Loaded the exact saved VoxelPop model from your Vault.' : 'Loaded the exact geometry snapshot saved in your Vault.');
        return;
      }
      if (!nextSession?.user) {
        setStatus('This draft is not stored on this device. Sign in to restore synced property drafts.');
        return;
      }
      try {
        const cloud = await loadAccountPropertyDrafts(client, nextSession.user);
        const merged = mergePropertyDraftRecords(cloud);
        replaceLocalPropertyDrafts(merged);
        const restored = merged.find((item) => item.id === draftId) || null;
        if (!active) return;
        setDraft(restored);
        setStatus(restored ? (restored?.visual?.modelUrl ? 'Restored this saved VoxelPop model from your account.' : 'Restored this exact saved 3D property snapshot from your account.') : 'This draft was not found in your synced account library.');
      } catch (error) {
        if (active) setStatus(String(error?.message || error || 'Could not restore this draft.'));
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      const { data } = await client.auth.getSession();
      await restore(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => restore(client, next));
      subscription = auth.data.subscription;
    }).catch(() => {
      const local = readPropertyDraft(draftId);
      if (active) {
        setDraft(local);
        setStatus(local ? 'Loaded the exact saved 3D property snapshot on this device.' : 'This draft is not stored on this device.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [draftId]);

  async function signIn() {
    setBusy(true);
    try {
      const client = await getSupabaseBrowserAsync();
      const redirectTo = new URL(`/vault/property-drafts/${encodeURIComponent(draftId)}`, window.location.origin).toString();
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
    } catch (error) {
      setStatus(String(error?.message || error || 'Could not start sign-in.'));
      setBusy(false);
    }
  }

  async function refreshLiveEvidence() {
    const lat = Number(draft?.coordinates?.latitude);
    const lng = Number(draft?.coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLiveStatus('This saved draft does not contain usable coordinates for a live map refresh.');
      return;
    }
    setBusy(true);
    setLiveStatus('Checking current source-backed map evidence near the saved coordinates…');
    try {
      const query = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${query.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Current map evidence could not be loaded.');
      const source = data?.sourceStatus?.fallbackUsed ? 'OpenStreetMap fallback' : 'Overture';
      setLiveStatus(data.buildingCount
        ? `Current ${source} evidence returns ${data.buildingCount} nearby source-backed building${data.buildingCount === 1 ? '' : 's'}. Your saved model and snapshot were not changed.`
        : `The current ${source} lookup resolved the location but returned no building footprint. Your saved model and snapshot remain unchanged.`);
    } catch (error) {
      setLiveStatus(`${String(error?.message || error)} Your saved model and snapshot remain unchanged.`);
    } finally { setBusy(false); }
  }

  if (!draft) return <main className="page"><header><Link href="/vault/property-drafts">← VAULT</Link><span>VOXEL VAULT · SAVED 3D</span></header><section className="missing"><b>{status}</b>{!session ? <button onClick={signIn} disabled={busy}>{busy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</button> : null}<Link href="/property">CREATE ANOTHER</Link></section><style jsx>{styles}</style></main>;

  return <main className="page">
    <header><Link href="/vault/property-drafts">← MY VAULT</Link><span>{collected ? 'OWNED DIGITAL VOXEL' : 'EXACT SAVED 3D SNAPSHOT'}</span><Link href="/vault/properties/claim">{collected ? 'MINT · OPTIONAL ↗' : 'VERIFY ↗'}</Link></header>
    <section className="hero"><small>{fidelityLabel(draft.fidelity)}</small><h1>{draft.label || 'Saved property draft'}</h1><p>{status} Reuse the property picture you already used when it is still on this device, or add a picture to this saved/bought property. The builder will show the 3D picture first and only create the voxel after you approve it.</p></section>
    <section className="viewer">{generatedModelUrl ? <MeshyModelViewer modelUrl={generatedModelUrl}/> : <GeoReferenceModel reference={reference} authoritativeTwin={authoritativeTwin} viewMode="orbit" resetKey={0}/>}</section>
    <section className="panel">
      <div><small>ITEM</small><b>{collected ? 'COLLECTED DIGITAL VOXEL' : 'SAVED 3D DRAFT'}</b></div>
      <div><small>MAP EVIDENCE</small><b>{draft.geometryKind === 'parcel-boundary' ? 'PARCEL · NO BUILDING INVENTED' : draft?.evidence?.exactParcelLinkedBuilding ? 'PARCEL-LINKED BUILDING' : draft?.evidence?.sourceBackedBuilding ? 'SOURCE-BACKED BUILDING' : 'REFERENCE'}</b></div>
      <div><small>MINT</small><b>{draft?.blockchain?.minted ? 'MINTED' : 'OPTIONAL'}</b></div>
      <div><small>REAL TITLE</small><b>{draft?.legal?.titleVerified ? 'VERIFIED' : 'SEPARATE'}</b></div>
    </section>
    <div className="actions">
      <Link className="primary" href={`/property?reuse=${encodeURIComponent(draft.id)}`}>USE / ADD PHOTO → 3D</Link>
      <Link href="/world">VIEW MY WORLD</Link>
      <Link href="/vault/properties/claim">{collected ? 'MINT TO WALLET · OPTIONAL' : 'VERIFY PROPERTY RIGHTS'}</Link>
      <Link href="/property">+ NEW PROPERTY</Link>
    </div>
    <button className="evidence" onClick={refreshLiveEvidence} disabled={busy}>{busy ? 'CHECKING CURRENT EVIDENCE…' : 'CHECK CURRENT MAP EVIDENCE'}</button>
    {liveStatus ? <div className="live" role="status">{liveStatus}</div> : null}
    <p className="truth">The VoxelPop model is a saved digital collectible/representation, not a deed or guaranteed perfect replica. A single source photo cannot verify unseen sides, roof details or exact dimensions. Parcel-only evidence stays parcel-only; no vacant land is turned into a fake building. Payment or optional minting does not create deed/title, rent, occupancy, fractional investment or appreciation rights.</p>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
:global(body){margin:0;background:#fffaf0;color:#24170e;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:18px clamp(14px,4vw,58px) calc(70px + env(safe-area-inset-bottom));background:radial-gradient(circle at 10% 10%,#fff0cc,transparent 26%),radial-gradient(circle at 90% 8%,#eee5ff,transparent 28%),radial-gradient(circle at 50% 95%,#efffc8,transparent 25%),#fffaf0}header{max-width:1050px;margin:auto;display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:8px;font-weight:950;letter-spacing:.12em;color:#80736d}header a{color:#6749bd;text-decoration:none}.hero{max-width:1050px;margin:50px auto 20px;text-align:center}.hero small{font-size:8px;letter-spacing:.15em;color:#7138f5;font-weight:950}.hero h1{font-size:clamp(38px,7vw,70px);line-height:.94;letter-spacing:-.055em;margin:9px 0 13px}.hero p{max-width:760px;margin:auto;color:#83766e;font-size:10px;line-height:1.65}.viewer{position:relative;max-width:1050px;height:min(64vh,650px);min-height:390px;margin:0 auto;border:1px solid #493b55;border-radius:30px;overflow:hidden;background:#21162c;box-shadow:0 24px 58px rgba(80,50,25,.15)}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.panel{max-width:1050px;margin:12px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.panel div{padding:12px;border:1px solid #e7ded3;border-radius:14px;background:#ffffffd9}.panel small{display:block;color:#92857c;font-size:6px;font-weight:950;letter-spacing:.1em}.panel b{display:block;margin-top:5px;font-size:9px}.actions{max-width:1050px;margin:10px auto;display:grid;grid-template-columns:1.15fr .85fr;gap:8px}.actions a,.evidence{display:grid;place-items:center;min-height:50px;border:1px solid #e0d6e7;border-radius:15px;text-decoration:none;color:#65586c;background:#fff;font:inherit;font-size:8px;font-weight:950;letter-spacing:.06em;text-align:center;padding:0 10px}.actions .primary{background:#7138f5;color:#fff;border-color:#7138f5;box-shadow:0 6px 0 #4d1bc5}.actions a:nth-child(2){background:#c9ff54;color:#2c4306;border-color:#c9ff54;box-shadow:0 6px 0 #aee43c}.actions a:nth-child(3){background:#20172a;color:#fff;border-color:#20172a}.evidence{max-width:1050px;width:100%;margin:10px auto;cursor:pointer}.live{max-width:1050px;margin:10px auto;padding:11px 12px;border:1px solid #d9ecbd;border-radius:12px;background:#f4ffe4;color:#66774f;font-size:8px;line-height:1.55}.truth{max-width:1050px;margin:12px auto;color:#9c928b;font-size:8px;line-height:1.6}.missing{max-width:720px;margin:110px auto;padding:28px;border:1px dashed #d9ccff;border-radius:20px;display:grid;gap:12px}.missing b{font-size:13px}.missing button,.missing a{border:0;border-radius:11px;padding:12px;background:#7138f5;color:#fff;text-align:center;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.08em}@media(max-width:620px){.page{padding:15px 11px calc(74px + env(safe-area-inset-bottom))}.hero{margin-top:42px}.viewer{height:55vh;min-height:360px;border-radius:26px}.panel{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr}}
`;
