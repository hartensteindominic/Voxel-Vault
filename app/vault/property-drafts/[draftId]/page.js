'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import GeoReferenceModel from '../../../geo/GeoReferenceModel';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { mergePropertyDraftRecords, readPropertyDraft, replaceLocalPropertyDrafts } from '../../../../lib/property-drafts';
import { loadAccountPropertyDrafts } from '../../../../lib/property-drafts-account';

function fidelityLabel(value) {
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

  useEffect(() => {
    let active = true;
    let subscription = null;
    async function restore(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      const local = readPropertyDraft(draftId);
      if (local) {
        setDraft(local);
        setStatus('Loaded the exact geometry snapshot saved in your Vault.');
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
        setStatus(restored ? 'Restored this exact saved 3D property snapshot from your account.' : 'This draft was not found in your synced account library.');
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
        setStatus(local ? 'Loaded the exact geometry snapshot saved on this device.' : 'This draft is not stored on this device.');
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
        ? `Current ${source} evidence returns ${data.buildingCount} nearby source-backed building${data.buildingCount === 1 ? '' : 's'}. Your saved 3D snapshot was not changed.`
        : `The current ${source} lookup resolved the location but returned no building footprint. Your saved snapshot remains unchanged.`);
    } catch (error) {
      setLiveStatus(`${String(error?.message || error)} Your saved snapshot remains unchanged.`);
    } finally { setBusy(false); }
  }

  if (!draft) return <main className="page"><header><Link href="/vault/property-drafts">← DRAFTS</Link><span>VOXEL VAULT · SAVED 3D</span></header><section className="missing"><b>{status}</b>{!session ? <button onClick={signIn} disabled={busy}>{busy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</button> : null}<Link href="/vault/earth">EXPLORE EARTH</Link></section><style jsx>{styles}</style></main>;

  return <main className="page">
    <header><Link href="/vault/property-drafts">← DRAFTS</Link><span>EXACT SAVED 3D SNAPSHOT</span><Link href="/vault/properties/claim">VERIFY ↗</Link></header>
    <section className="hero"><small>{fidelityLabel(draft.fidelity)}</small><h1>{draft.label || 'Saved property draft'}</h1><p>{status} This viewer uses the geometry saved with the draft; live map updates do not silently replace it.</p></section>
    <section className="viewer"><GeoReferenceModel reference={reference} authoritativeTwin={authoritativeTwin} viewMode="orbit" resetKey={0}/></section>
    <section className="panel">
      <div><small>SAVED SOURCE</small><b>{draft?.evidence?.mapAuthority || 'Saved draft evidence'}</b></div>
      <div><small>GEOMETRY</small><b>{draft.geometryKind === 'parcel-boundary' ? 'PARCEL · NO BUILDING INVENTED' : draft?.evidence?.exactParcelLinkedBuilding ? 'PARCEL-LINKED BUILDING' : draft?.evidence?.sourceBackedBuilding ? 'SOURCE-BACKED BUILDING' : 'REFERENCE'}</b></div>
      <div><small>MINT</small><b>{draft?.blockchain?.minted ? 'MINTED' : 'NOT REQUIRED'}</b></div>
      <div><small>TITLE</small><b>{draft?.legal?.titleVerified ? 'VERIFIED' : 'SEPARATE'}</b></div>
    </section>
    <div className="actions"><button className="primary" onClick={refreshLiveEvidence} disabled={busy}>{busy ? 'CHECKING CURRENT EVIDENCE…' : 'CHECK CURRENT MAP EVIDENCE'}</button><Link href="/vault/earth">OPEN EARTH</Link><Link href="/vault/properties/claim">VERIFY PROPERTY RIGHTS</Link></div>
    {liveStatus ? <div className="live" role="status">{liveStatus}</div> : null}
    <p className="truth">This is the exact saved digital geometry snapshot, not a deed or guaranteed perfect replica. Parcel-only drafts stay parcels; Voxel Vault does not extrude vacant land into a fake building. Checking current evidence never overwrites this saved draft unless you explicitly save a newer version.</p>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
:global(body){margin:0;background:#07090c;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:18px clamp(14px,4vw,58px) 86px;background:radial-gradient(circle at 75% 7%,rgba(121,239,188,.1),transparent 30%),#07090c}header{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:8px;font-weight:950;letter-spacing:.12em;color:#7f8a86}header a{color:#a5afac;text-decoration:none}.hero{max-width:980px;margin:56px auto 20px}.hero small{font-size:7px;letter-spacing:.15em;color:#7fe0bb;font-weight:950}.hero h1{font-size:clamp(34px,6vw,72px);line-height:.95;letter-spacing:-.055em;margin:9px 0 13px}.hero p{max-width:760px;color:#85908c;font-size:10px;line-height:1.65}.viewer{max-width:1050px;height:min(64vh,650px);min-height:390px;margin:0 auto;border:1px solid rgba(255,255,255,.08);border-radius:25px;overflow:hidden;background:#0b0e11}.panel{max-width:1050px;margin:12px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.panel div{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}.panel small{display:block;color:#67736f;font-size:6px;font-weight:950;letter-spacing:.1em}.panel b{display:block;margin-top:5px;font-size:9px}.actions{max-width:1050px;margin:10px auto;display:grid;grid-template-columns:1.3fr .7fr 1fr;gap:8px}.actions a,.actions button{display:grid;place-items:center;min-height:46px;border:1px solid rgba(255,255,255,.08);border-radius:12px;text-decoration:none;color:#a8b3af;background:transparent;font:inherit;font-size:7px;font-weight:950;letter-spacing:.08em}.actions .primary{background:#7fe0bb;color:#06100c;border-color:#7fe0bb}.live{max-width:1050px;margin:10px auto;padding:11px 12px;border:1px solid rgba(121,239,188,.14);border-radius:12px;background:rgba(121,239,188,.035);color:#91b9aa;font-size:8px;line-height:1.55}.truth{max-width:1050px;margin:12px auto;color:#64706b;font-size:8px;line-height:1.6}.missing{max-width:720px;margin:110px auto;padding:28px;border:1px dashed rgba(121,239,188,.24);border-radius:20px;display:grid;gap:12px}.missing b{font-size:13px}.missing button,.missing a{border:0;border-radius:11px;padding:12px;background:#7fe0bb;color:#06100c;text-align:center;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.08em}@media(max-width:620px){.page{padding:15px 12px 74px}.hero{margin-top:42px}.viewer{height:55vh;min-height:360px}.panel{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr}}
`;
