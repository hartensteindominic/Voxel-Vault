'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, readPropertyDraft, savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const emptyModel = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });

function clean(value) { return String(value || '').trim(); }
function terminal(value) {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(String(value || '').toUpperCase());
}
function readableDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
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
function isHeic(file) {
  return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}
function isSupportedPhoto(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || isHeic(file);
}
async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('HEIC preview could not be decoded.'));
    });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo conversion is unavailable on this device.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Photo conversion failed.');
    const filename = String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], filename || 'property-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SimplePropertyPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [building, setBuilding] = useState(null);
  const [openImagery, setOpenImagery] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [streetPhotoChosen, setStreetPhotoChosen] = useState(false);
  const [uploadedReference, setUploadedReference] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);
  const [voxelImage, setVoxelImage] = useState('');
  const [model, setModel] = useState(emptyModel);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const [saved, setSaved] = useState(null);
  const clientRef = useRef(null);
  const imageIterationRef = useRef(0);
  const uploadInputRef = useRef(null);

  const photos = Array.isArray(openImagery?.photos) ? openImagery.photos : [];
  const openPhoto = photos[photoIndex] || photos[0] || null;
  const activePhoto = uploadedReference ? {
    id: uploadedReference.sourcePhotoId,
    imageUrl: uploadedReference.url,
    provider: uploadedReference.provider,
    shotDate: null,
    uploadedAt: uploadedReference.uploadedAt,
    storagePath: uploadedReference.storagePath,
  } : openPhoto;
  const activeReference = useMemo(() => {
    if (uploadedReference) return uploadedReference;
    const refs = Array.isArray(openImagery?.meshyReferences) ? openImagery.meshyReferences : [];
    if (!openPhoto) return null;
    return refs.find((item) => item?.sourcePhotoId === openPhoto.id) || refs[photoIndex] || null;
  }, [openImagery, openPhoto, photoIndex, uploadedReference]);

  const baseDraft = useMemo(() => buildPropertyDraft({ building, openImagery, fallbackLabel: resolvedQuery }), [building, openImagery, resolvedQuery]);
  const draft = useMemo(() => {
    if (!baseDraft) return null;
    return {
      ...baseDraft,
      fidelity: model?.modelUrl ? 'photo-guided-voxel-3d' : voxelImage ? 'photo-guided-voxel-image' : baseDraft.fidelity,
      visual: {
        referenceImageUrl: activePhoto?.imageUrl || null,
        referencePhotoId: activePhoto?.id || null,
        referenceShotDate: activePhoto?.shotDate || null,
        referenceUploadedAt: activePhoto?.uploadedAt || null,
        referenceStoragePath: activePhoto?.storagePath || null,
        referenceProvider: activePhoto?.provider || null,
        referenceRightsBasis: activeReference?.rightsBasis || null,
        voxelImageUrl: voxelImage || null,
        modelUrl: model?.modelUrl || null,
        modelTaskId: model?.taskId || null,
      },
    };
  }, [baseDraft, activePhoto, activeReference?.rightsBasis, voxelImage, model?.modelUrl, model?.taskId]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    const initial = new URLSearchParams(window.location.search).get('q') || '';
    if (initial) setQuery(initial);
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setAuthReady(true);
      if (data.session?.user) setMessage('Signed in. Start with the property address.');
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        setMessage(next?.user ? 'Signed in. Start with the property address.' : 'Sign in to start.');
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in setup is unavailable on this deployment.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

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
          setMessage('3D ready. Save it to your Vault.');
          return;
        }
        if (terminal(data?.status)) {
          setMessage(data?.error || `3D generation ended with ${data?.status}.`);
          return;
        }
        setMessage(`Building your 3D voxel… ${Math.round(Number(data?.progress || 0))}%`);
        timer = window.setTimeout(poll, 3500);
      } catch (error) {
        if (active) setMessage(String(error?.message || error));
      }
    }
    timer = window.setTimeout(poll, 1800);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [model?.taskId, model?.modelUrl, model?.status, session?.access_token]);

  function clearPendingPhoto() {
    setPendingPhoto(null);
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }

  async function signIn() {
    setBusy('signin');
    setMessage('Opening secure sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setMessage(String(error?.message || error || 'Could not sign in.'));
      setBusy('');
    }
  }

  async function search(value = query) {
    if (!session?.access_token) return setMessage('Sign in before starting a property.');
    const address = clean(value);
    if (!address) return;
    imageIterationRef.current += 1;
    setBusy('search');
    clearPendingPhoto();
    setBuilding(null);
    setOpenImagery(null);
    setPhotoIndex(0);
    setStreetPhotoChosen(false);
    setUploadedReference(null);
    setUploadRightsConfirmed(false);
    setVoxelImage('');
    setModel(emptyModel());
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
      setMessage('Property found. Choose the clearest photo.');
    } catch (error) {
      setResolvedQuery('');
      setMessage(String(error?.message || error || 'Property lookup failed.'));
    } finally { setBusy(''); }
  }

  function chooseUpload() {
    if (!session?.access_token) return setMessage('Sign in before choosing a photo.');
    uploadInputRef.current?.click();
  }

  async function selectLocalPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('prepare-photo');
    setMessage(isHeic(selected) ? 'Preparing your iPhone photo…' : 'Preparing your photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) return setMessage('This photo is still too large after preparation. Try a screenshot or a smaller version.');
      clearPendingPhoto();
      setPendingPhoto(photo);
      setPendingPreview(URL.createObjectURL(photo));
      setStreetPhotoChosen(false);
      setUploadRightsConfirmed(false);
      setMessage('Photo ready. Confirm you can use it.');
    } catch {
      setMessage('This iPhone photo could not be prepared. A screenshot of the property photo will work too.');
    } finally { setBusy(''); }
  }

  async function usePendingPhoto() {
    if (!pendingPhoto || !building?.atlasId || !session?.access_token) return;
    if (!uploadRightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('upload');
    setMessage('Saving your photo privately…');
    try {
      const form = new FormData();
      form.append('photo', pendingPhoto);
      form.append('atlasId', building.atlasId);
      form.append('address', resolvedQuery);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-photo-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.reference?.url) throw new Error(data?.error || 'Property photo upload failed.');
      imageIterationRef.current += 1;
      setStreetPhotoChosen(false);
      setUploadedReference(data.reference);
      clearPendingPhoto();
      setVoxelImage('');
      setModel(emptyModel());
      setSaved(null);
      setMessage('Photo locked in. Now make the voxel first.');
    } catch (error) { setMessage(String(error?.message || error)); }
    finally { setBusy(''); }
  }

  function useStreetPhoto() {
    if (!activeReference) return;
    imageIterationRef.current += 1;
    clearPendingPhoto();
    setUploadedReference(null);
    setStreetPhotoChosen(true);
    setVoxelImage('');
    setModel(emptyModel());
    setSaved(null);
    setMessage('Photo locked in. Now make the voxel first.');
  }

  async function createImage() {
    if (!building?.atlasId || !activeReference || !session?.access_token) return setMessage('Choose a property photo first.');
    const iteration = ++imageIterationRef.current;
    setBusy('image');
    setMessage('Starting your VoxelPop image…');
    try {
      const startResponse = await fetch('/api/property-voxel-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ address: resolvedQuery, atlasId: building.atlasId, references: [activeReference] }),
      });
      const started = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok || !started?.ok || !started?.taskId || !started?.taskToken) throw new Error(started?.error || 'Voxel image could not start.');

      for (let attempt = 0; attempt < 100; attempt += 1) {
        await wait(attempt === 0 ? 1400 : 2500);
        if (iteration !== imageIterationRef.current) return;
        const params = new URLSearchParams({ taskId: started.taskId, taskToken: started.taskToken });
        const response = await fetch(`/api/property-voxel-image?${params.toString()}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Voxel image processing failed.');
        if (data?.imageUrl) {
          setVoxelImage(data.imageUrl);
          setModel(emptyModel());
          setSaved(null);
          setMessage('Your voxel image is ready. Approve it, then make the 3D version.');
          return;
        }
        const providerProgress = Math.round(Number(data?.progress || 0));
        setMessage(providerProgress > 0 ? `Making your voxel… ${providerProgress}%` : 'Making your voxel… this can take a minute.');
      }
      throw new Error('The voxel image is still processing. Try Make my voxel again in a moment.');
    } catch (error) {
      if (iteration === imageIterationRef.current) setMessage(String(error?.message || error));
    } finally {
      if (iteration === imageIterationRef.current) setBusy('');
    }
  }

  async function create3D() {
    if (!voxelImage || !building?.atlasId || !session?.access_token) return setMessage('Make the voxel image first.');
    if (model?.taskId && !terminal(model?.status) && !model?.modelUrl) return;
    setBusy('3d');
    setMessage('Building the 3D voxel from the image you approved…');
    try {
      const response = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ atlasId: building.atlasId, imageUrl: voxelImage }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || '3D generation could not start.');
      setModel(data);
      setMessage(data?.modelUrl ? '3D ready. Save it to your Vault.' : 'Building your 3D voxel…');
    } catch (error) { setMessage(String(error?.message || error)); }
    finally { setBusy(''); }
  }

  async function saveToVault() {
    if (!draft || !model?.modelUrl || !session?.user) return setMessage('Create the 3D property first.');
    try {
      const next = savePropertyDraft(draft);
      setSaved(next);
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await savePropertyDraftToAccount(client, session.user, next);
      setMessage('Saved to your account Vault. Verify and mint only when you are ready.');
    } catch (error) { setMessage(String(error?.message || error)); }
  }

  function changePhoto() {
    imageIterationRef.current += 1;
    clearPendingPhoto();
    setStreetPhotoChosen(false);
    setUploadedReference(null);
    setVoxelImage('');
    setModel(emptyModel());
    setSaved(null);
    setMessage('Choose the clearest photo of this property.');
  }

  function changeProperty() {
    imageIterationRef.current += 1;
    clearPendingPhoto();
    setBuilding(null);
    setResolvedQuery('');
    setOpenImagery(null);
    setStreetPhotoChosen(false);
    setUploadedReference(null);
    setUploadRightsConfirmed(false);
    setVoxelImage('');
    setModel(emptyModel());
    setSaved(null);
    setMessage('Start with the property address.');
  }

  const modelRunning = Boolean(model?.taskId && !model?.modelUrl && !terminal(model?.status));
  const photoChosen = Boolean(uploadedReference || streetPhotoChosen);
  const stage = !building ? 1 : model?.modelUrl ? (saved ? 6 : 5) : modelRunning ? 4 : (pendingPhoto || !photoChosen) ? 2 : !voxelImage ? 3 : 4;
  const displayImage = model?.modelUrl ? '' : voxelImage || pendingPreview || activePhoto?.imageUrl || '';
  const photoDate = readableDate(activePhoto?.shotDate);

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXEL VAULT</div><h1>Property</h1><section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing starts until your sign-in is verified.</small></section></section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXEL VAULT</div>
      <h1>Property</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>Your photos, voxel jobs, 3D drafts and Vault saves stay tied to one verified account.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>Nothing is uploaded, generated or saved before sign-in.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXEL VAULT</div>
      <h1>Property</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${stage} of 6`}>
        {[1,2,3,4,5,6].map((step) => <span key={step} className={step <= stage ? styles.progressOn : ''}/>) }
      </div>
      <p className={styles.stageLabel}>STEP {stage} OF 6 · {stage === 1 ? 'ADDRESS' : stage === 2 ? 'PHOTO' : stage === 3 ? 'MAKE VOXEL' : stage === 4 ? 'MAKE 3D' : stage === 5 ? 'SAVE' : 'READY'}</p>

      {!building ? <>
        <p className={styles.bigPrompt}>Which property?</p>
        <p className={styles.flowHint}>Address → photo → <b>make the voxel first</b> → 3D → Vault.</p>
        <form className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); search(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'search'}>{busy === 'search' ? 'Finding…' : 'Find property'}</button>
        </form>
        <div className={styles.homeLinks}><Link href="/vault/property-drafts">Vault</Link><Link href="/world">World</Link></div>
      </> : <>
        <div className={styles.heroCard}>
          {model?.modelUrl
            ? <MeshyModelViewer modelUrl={model.modelUrl}/>
            : displayImage
              ? <img src={displayImage} alt={voxelImage ? `Voxel rendering of ${resolvedQuery}` : `Property reference for ${resolvedQuery}`} referrerPolicy="no-referrer"/>
              : <div className={styles.noPhoto}><b>Add a photo</b><span>No facade invented.</span></div>}
          <span className={styles.badge}>{model?.modelUrl ? '3D VOXEL' : voxelImage ? 'VOXEL READY' : pendingPhoto ? 'YOUR PHOTO' : activeReference ? 'PROPERTY PHOTO' : 'PHOTO NEEDED'}</span>
          {stage === 2 && !pendingPhoto && !uploadedReference && photos.length > 1 ? <div className={styles.photoPicker}>
            <button type="button" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)} aria-label="Previous reference photo">‹</button>
            <b>{photoIndex + 1}/{photos.length}</b>
            <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} aria-label="Next reference photo">›</button>
          </div> : null}
        </div>

        <div className={styles.meta}>
          <b>{resolvedQuery}</b>
          <span>{model?.modelUrl ? '3D voxel property' : voxelImage ? 'Voxel image created from your selected property photo' : pendingPhoto ? 'Your selected photo' : activePhoto ? `${uploadedReference ? 'Your uploaded photo' : 'Available street photo'}${photoDate ? ` · ${photoDate}` : ''}` : 'Choose or upload a property photo'}</span>
        </div>

        {stage === 2 && !pendingPhoto ? <div className={styles.choicePanel}>
          <p className={styles.bigPrompt}>Pick the clearest photo.</p>
          <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectLocalPhoto}/>
          <button className={styles.primaryPurple} type="button" onClick={chooseUpload} disabled={busy === 'prepare-photo'}>{busy === 'prepare-photo' ? 'Preparing photo…' : 'Upload your photo'}</button>
          {activeReference ? <button className={styles.secondaryButton} type="button" onClick={useStreetPhoto}>Use this street photo</button> : null}
          <small>iPhone photos supported · JPG, PNG, WebP, HEIC/HEIF</small>
        </div> : null}

        {stage === 2 && pendingPhoto ? <div className={styles.choicePanel}>
          <p className={styles.bigPrompt}>Use this photo?</p>
          <label className={styles.rightsCheck}>
            <input type="checkbox" checked={uploadRightsConfirmed} onChange={(event) => setUploadRightsConfirmed(event.target.checked)}/>
            <span>I took this photo or have permission to use it.</span>
          </label>
          <button className={styles.primaryPurple} type="button" onClick={usePendingPhoto} disabled={!uploadRightsConfirmed || busy === 'upload'}>{busy === 'upload' ? 'Saving photo…' : 'Use this photo'}</button>
          <button className={styles.textButton} type="button" onClick={chooseUpload}>Choose another</button>
        </div> : null}

        {stage === 3 ? <div className={styles.choicePanel}>
          <p className={styles.bigPrompt}>Make the voxel first.</p>
          <p className={styles.stepCopy}>We process the exact photo you chose into the VoxelPop image before 3D unlocks.</p>
          <button className={styles.primaryOrange} type="button" onClick={createImage} disabled={busy === 'image'}>{busy === 'image' ? 'Making your voxel…' : 'Make my voxel'}</button>
          <button className={styles.textButton} type="button" onClick={changePhoto} disabled={busy === 'image'}>Change photo</button>
        </div> : null}

        {stage === 4 ? <div className={styles.choicePanel}>
          <p className={styles.bigPrompt}>{modelRunning ? 'Building your 3D voxel…' : 'Voxel looks right?'}</p>
          {!modelRunning ? <p className={styles.stepCopy}>This is the image that will become 3D. Redo it now if you want a different result.</p> : null}
          <button className={styles.primaryTeal} type="button" onClick={create3D} disabled={busy === '3d' || modelRunning}>{modelRunning ? `Creating 3D${Number(model?.progress) ? ` · ${Math.round(Number(model.progress))}%` : '…'}` : 'Make it 3D'}</button>
          {!modelRunning ? <button className={styles.textButton} type="button" onClick={createImage} disabled={busy === 'image'}>Redo voxel</button> : null}
        </div> : null}

        {stage === 5 ? <div className={styles.choicePanel}>
          <p className={styles.bigPrompt}>Save it.</p>
          <button className={styles.primaryPurple} type="button" onClick={saveToVault}>Save to my Vault</button>
          <button className={styles.textButton} type="button" onClick={changePhoto}>Start over with photo</button>
        </div> : null}

        {stage === 6 ? <div className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <p className={styles.bigPrompt}>Saved to your Vault.</p>
          <Link className={styles.primaryLink} href="/vault/properties/claim">Verify &amp; mint once</Link>
          <div className={styles.doneLinks}><Link href="/vault/property-drafts">Open Vault</Link><Link href="/world">World</Link></div>
        </div> : null}

        <button className={styles.change} type="button" onClick={changeProperty}>Choose a different property</button>
      </>}

      <p className={styles.message} role="status">{message}</p>
      <p className={styles.truth}>Photo = appearance · Map = location · Parcel verification = canonical mint identity. A voxel or NFT is not a deed. Parcel identity—not the address text—blocks duplicate canonical mints.</p>
    </section>
  </main>;
}
