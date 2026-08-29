'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, readPropertyDraft, savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

function clean(value) { return String(value || '').trim(); }
function selectedOrLocation(atlas, address) {
  const selected = atlas?.selectedBuilding || atlas?.buildings?.[0] || null;
  if (selected) return selected;
  const latitude = Number(atlas?.latitude);
  const longitude = Number(atlas?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    atlasId: `location:${latitude.toFixed(7)},${longitude.toFixed(7)}`,
    latitude,
    longitude,
    geometry: null,
    tags: { name: address },
    height: null,
    source: atlas?.reference?.source || { authority: 'Resolved Earth location', license: '', sourceUrl: '' },
  };
}
function readableDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function terminal(value) {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(String(value || '').toUpperCase());
}

export default function SimplePropertyPage() {
  const [query, setQuery] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [building, setBuilding] = useState(null);
  const [openImagery, setOpenImagery] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [voxelImage, setVoxelImage] = useState('');
  const [model, setModel] = useState({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Add an address.');
  const [saved, setSaved] = useState(null);
  const [session, setSession] = useState(null);
  const clientRef = useRef(null);

  const photos = Array.isArray(openImagery?.photos) ? openImagery.photos : [];
  const activePhoto = photos[photoIndex] || photos[0] || null;
  const activeReference = useMemo(() => {
    const refs = Array.isArray(openImagery?.meshyReferences) ? openImagery.meshyReferences : [];
    if (!activePhoto) return null;
    return refs.find((item) => item?.sourcePhotoId === activePhoto.id) || refs[photoIndex] || null;
  }, [openImagery, activePhoto, photoIndex]);
  const baseDraft = useMemo(() => buildPropertyDraft({
    building,
    openImagery,
    fallbackLabel: resolvedQuery,
  }), [building, openImagery, resolvedQuery]);
  const draft = useMemo(() => {
    if (!baseDraft) return null;
    return {
      ...baseDraft,
      fidelity: model?.modelUrl ? 'photo-guided-voxel-3d' : voxelImage ? 'photo-guided-voxel-image' : baseDraft.fidelity,
      visual: {
        referenceImageUrl: activePhoto?.imageUrl || null,
        referencePhotoId: activePhoto?.id || null,
        referenceShotDate: activePhoto?.shotDate || null,
        referenceProvider: activePhoto?.provider || null,
        voxelImageUrl: voxelImage || null,
        modelUrl: model?.modelUrl || null,
        modelTaskId: model?.taskId || null,
      },
    };
  }, [baseDraft, activePhoto, voxelImage, model?.modelUrl, model?.taskId]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next || null); });
      subscription = auth.data.subscription;
    }).catch(() => {});

    const initial = new URLSearchParams(window.location.search).get('q') || '';
    if (initial) {
      setQuery(initial);
      window.setTimeout(() => search(initial), 0);
    }
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!building?.atlasId || !session?.access_token) return;
    let active = true;
    fetch(`/api/property-voxel-3d?atlasId=${encodeURIComponent(building.atlasId)}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!active || !response.ok || !data?.ok) return;
      if (data?.exists && (data?.taskId || data?.modelUrl)) setModel(data);
    }).catch(() => {});
    return () => { active = false; };
  }, [building?.atlasId, session?.access_token]);

  useEffect(() => {
    if (!model?.taskId || model?.modelUrl || terminal(model?.status) || !session?.access_token) return undefined;
    let active = true;
    let timer = null;
    async function poll() {
      try {
        const response = await fetch(`/api/property-voxel-3d?taskId=${encodeURIComponent(model.taskId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not read 3D progress.');
        setModel(data);
        if (data?.modelUrl) {
          setMessage('3D ready. Drag it to inspect the property.');
          return;
        }
        if (terminal(data?.status)) {
          setMessage(data?.error || `3D generation ended with ${data?.status}.`);
          return;
        }
        setMessage(`Creating 3D… ${Math.round(Number(data?.progress || 0))}%`);
        timer = window.setTimeout(poll, 3500);
      } catch (error) {
        if (active) setMessage(String(error?.message || error));
      }
    }
    timer = window.setTimeout(poll, 1800);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [model?.taskId, model?.modelUrl, model?.status, session?.access_token]);

  async function search(value = query) {
    const address = clean(value);
    if (!address) return;
    setBusy('search');
    setBuilding(null);
    setOpenImagery(null);
    setPhotoIndex(0);
    setVoxelImage('');
    setModel({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });
    setSaved(null);
    setMessage('Finding the property…');
    try {
      const params = new URLSearchParams({ address, radius: '180' });
      const atlasResponse = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const atlas = await atlasResponse.json().catch(() => ({}));
      if (!atlasResponse.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped yet.');
      const selected = selectedOrLocation(atlas, address);
      if (!selected) throw new Error('That address resolved without a usable map location.');

      const imageryResponse = await fetch(`/api/world-atlas/open-imagery?lat=${encodeURIComponent(selected.latitude)}&lng=${encodeURIComponent(selected.longitude)}&radius=140`, { cache: 'no-store' });
      const imagery = await imageryResponse.json().catch(() => ({}));
      setResolvedQuery(address);
      setBuilding(selected);
      setOpenImagery(imagery?.ok ? imagery : { photos: [], meshyReferences: [], note: imagery?.note || imagery?.error || '' });
      const nextDraft = buildPropertyDraft({ building: selected, openImagery: imagery?.ok ? imagery : null, fallbackLabel: address });
      setSaved(nextDraft?.id ? readPropertyDraft(nextDraft.id) : null);
      setMessage(imagery?.photos?.length
        ? 'Newest nearby open photo loaded. Make sure it shows the right facade, then create the voxel image.'
        : 'No rights-cleared street photo was found here, so Voxel Vault will not invent the building appearance.');
    } catch (error) {
      setResolvedQuery('');
      setMessage(String(error?.message || error || 'Property lookup failed.'));
    } finally { setBusy(''); }
  }

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) { setMessage(String(error?.message || error || 'Could not sign in.')); }
  }

  async function createImage() {
    if (!building?.atlasId || !activeReference) return setMessage('A rights-cleared property photo is required first.');
    if (!session?.access_token) {
      setMessage('Sign in once to create the voxel image.');
      await signIn();
      return;
    }
    setBusy('image');
    setMessage('Creating a voxel image from this exact selected photo…');
    try {
      const response = await fetch('/api/property-voxel-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          address: resolvedQuery,
          atlasId: building.atlasId,
          references: [activeReference],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Voxel image could not be created.');
      setVoxelImage(data.imageUrl);
      setMessage('Voxel image ready. Compare it to the real photo, then create 3D.');
    } catch (error) { setMessage(String(error?.message || error)); }
    finally { setBusy(''); }
  }

  async function create3D() {
    if (!voxelImage || !building?.atlasId) return setMessage('Create the voxel image first.');
    if (!session?.access_token) {
      setMessage('Sign in once to create 3D.');
      await signIn();
      return;
    }
    setBusy('3d');
    setMessage('Creating 3D from the voxel image…');
    try {
      const response = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ atlasId: building.atlasId, imageUrl: voxelImage }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || '3D generation could not start.');
      setModel(data);
      setMessage(data?.modelUrl ? '3D ready.' : 'Creating 3D…');
    } catch (error) { setMessage(String(error?.message || error)); }
    finally { setBusy(''); }
  }

  async function saveToVault() {
    if (!draft || !model?.modelUrl) return setMessage('Create the 3D property first.');
    try {
      const next = savePropertyDraft(draft);
      setSaved(next);
      if (session?.user) {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await savePropertyDraftToAccount(client, session.user, next);
      }
      setMessage('Saved to your Vault. Minting can wait.');
    } catch (error) { setMessage(String(error?.message || error)); }
  }

  function changeProperty() {
    setBuilding(null);
    setResolvedQuery('');
    setOpenImagery(null);
    setVoxelImage('');
    setModel({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });
    setSaved(null);
    setMessage('Add an address.');
  }

  const displayImage = voxelImage || activePhoto?.imageUrl || '';
  const photoDate = readableDate(activePhoto?.shotDate);

  return <main className={styles.page}>
    <section className={styles.maker}>
      <h1>Property</h1>

      {!building ? <>
        <p className={styles.intro}>Turn a real place into a voxel property.</p>
        <form className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); search(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'search'}>{busy === 'search' ? 'Finding…' : 'Add property'}</button>
        </form>
        <div className={styles.homeLinks}><Link href="/vault/property-drafts">Vault</Link><Link href="/world">World</Link></div>
        <p className={styles.message} role="status">{message}</p>
      </> : <>
        <div className={styles.heroCard}>
          {model?.modelUrl
            ? <MeshyModelViewer modelUrl={model.modelUrl}/>
            : displayImage
              ? <img src={displayImage} alt={voxelImage ? `Voxel rendering of ${resolvedQuery}` : `Newest open street reference near ${resolvedQuery}`} referrerPolicy="no-referrer"/>
              : <div className={styles.noPhoto}><b>No photo</b><span>No facade invented.</span></div>}
          <span className={styles.badge}>{model?.modelUrl ? '3D' : voxelImage ? 'VOXEL IMAGE' : 'REAL REFERENCE'}</span>
          {!voxelImage && !model?.modelUrl && photos.length > 1 ? <div className={styles.photoPicker}>
            <button type="button" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)} aria-label="Previous reference photo">‹</button>
            <b>{photoIndex + 1}/{photos.length}</b>
            <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} aria-label="Next reference photo">›</button>
          </div> : null}
        </div>

        <div className={styles.meta}>
          <b>{resolvedQuery}</b>
          <span>{activePhoto ? `Newest open photo${photoDate ? ` · ${photoDate}` : ''}` : 'No rights-cleared photo available'}</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.imageButton} type="button" onClick={createImage} disabled={!activeReference || Boolean(voxelImage) || busy === 'image'}>{voxelImage ? '✓ Image created' : busy === 'image' ? 'Creating image…' : 'Create image'}</button>
          <button className={styles.modelButton} type="button" onClick={create3D} disabled={!voxelImage || Boolean(model?.modelUrl) || busy === '3d'}>{model?.modelUrl ? '✓ 3D created' : busy === '3d' || (model?.taskId && !terminal(model?.status)) ? `Creating 3D${Number(model?.progress) ? ` · ${Math.round(Number(model.progress))}%` : '…'}` : 'Create 3D'}</button>
          <button className={styles.vaultButton} type="button" onClick={saveToVault} disabled={!model?.modelUrl || Boolean(saved)}>{saved ? '✓ In Vault' : 'Vault'}</button>
        </div>

        <Link className={`${styles.mintLater} ${!saved ? styles.mintDisabled : ''}`} href={saved ? '/vault/properties/claim' : '#'} onClick={(event) => { if (!saved) { event.preventDefault(); setMessage('Save the 3D property to your Vault first.'); } }}>Mint later</Link>
        <button className={styles.change} type="button" onClick={changeProperty}>Change property</button>
        <p className={styles.message} role="status">{message}</p>
        <p className={styles.truth}>The photo guides appearance. Map data guides location. The voxel image and 3D model are digital interpretations, not a deed, survey, or guarantee of perfect physical accuracy.</p>
      </>}
    </section>
  </main>;
}
