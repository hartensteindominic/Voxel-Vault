'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './property.module.css';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, thumbnailUrl: null, taskId: null });
const CREATION_PRICE_LABEL = '$4.99';
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';

function clean(value) { return String(value || '').trim(); }
function newDraftId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `vp-${random.slice(0, 28)}`;
}
function isHeic(file) {
  return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}
function isSupportedPhoto(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || isHeic(file);
}
function dollars(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
}
function selectedOrLocation(atlas, address) {
  const selected = atlas?.selectedBuilding || atlas?.buildings?.[0] || null;
  if (selected) return { ...selected, mappedIdentityReady: Boolean(selected.atlasId) };
  const latitude = Number(atlas?.latitude);
  const longitude = Number(atlas?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    atlasId: `location:${latitude.toFixed(7)},${longitude.toFixed(7)}`,
    latitude,
    longitude,
    geometry: null,
    tags: { name: address },
    mappedIdentityReady: false,
  };
}

function openDeviceDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Private on-device photo storage is unavailable in this browser.'));
    const request = indexedDB.open(DEVICE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DEVICE_STORE)) request.result.createObjectStore(DEVICE_STORE, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('On-device photo storage could not open.'));
  });
}

async function saveDevicePhoto(draftId, file) {
  const db = await openDeviceDb();
  const bytes = await file.arrayBuffer();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DEVICE_STORE, 'readwrite');
    const request = transaction.objectStore(DEVICE_STORE).put({
      draftId,
      bytes,
      type: file.type || 'image/jpeg',
      name: file.name || 'property-photo.jpg',
      lastModified: file.lastModified || Date.now(),
      savedAt: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Photo could not be kept on this device for checkout.'));
  });
  db.close();
}

async function loadDevicePhoto(draftId) {
  const db = await openDeviceDb();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction(DEVICE_STORE, 'readonly').objectStore(DEVICE_STORE).get(draftId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Saved photo could not be reopened.'));
  });
  db.close();
  if (!record?.bytes) return null;
  return new File([record.bytes], record.name || 'property-photo.jpg', {
    type: record.type || 'image/jpeg',
    lastModified: record.lastModified || Date.now(),
  });
}

async function removeDevicePhoto(draftId) {
  if (!draftId) return;
  try {
    const db = await openDeviceDb();
    await new Promise((resolve) => {
      const request = db.transaction(DEVICE_STORE, 'readwrite').objectStore(DEVICE_STORE).delete(draftId);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
    db.close();
  } catch {}
}

async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('HEIC preview could not be decoded. Try a screenshot of the photo instead.'));
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

async function createVoxelPoster(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The photo could not be opened for the VoxelPop image.'));
    });
    const sampleSize = 54;
    const sample = document.createElement('canvas');
    sample.width = sampleSize;
    sample.height = sampleSize;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop image processing is unavailable.');
    const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth || 1;
    let sh = image.naturalHeight || 1;
    if (sourceRatio > 1) { sw = sh; sx = ((image.naturalWidth || 1) - sw) / 2; }
    else if (sourceRatio < 1) { sh = sw; sy = ((image.naturalHeight || 1) - sh) / 2; }
    sampleContext.filter = 'saturate(1.08) contrast(1.06)';
    sampleContext.drawImage(image, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

    const output = document.createElement('canvas');
    output.width = 864;
    output.height = 864;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, output.width, output.height);
    const shade = context.createLinearGradient(0, 0, output.width, output.height);
    shade.addColorStop(0, 'rgba(255,255,255,.10)');
    shade.addColorStop(0.58, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.15)');
    context.fillStyle = shade;
    context.fillRect(0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.91);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PropertyJourneyPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [sourceReference, setSourceReference] = useState(null);
  const [source3d, setSource3d] = useState(empty3d);
  const [voxelImage, setVoxelImage] = useState('');
  const [final3d, setFinal3d] = useState(empty3d);
  const [localRecipe, setLocalRecipe] = useState(null);
  const [collectionReady, setCollectionReady] = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState('photo');
  const [address, setAddress] = useState('');
  const [mappedAddress, setMappedAddress] = useState('');
  const [building, setBuilding] = useState(null);
  const [atlasBuildings, setAtlasBuildings] = useState([]);
  const [quote, setQuote] = useState(null);
  const [availability, setAvailability] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);
  const checkoutHandledRef = useRef('');

  const finalReady = final3d?.status === 'SUCCEEDED';
  const sourceReady = source3d?.status === 'SUCCEEDED';
  const mapped = Boolean(building && mappedAddress);
  const step = !sourceReference ? 1 : !sourceReady ? 2 : !finalReady ? 3 : !mapped ? 4 : 5;
  const labels = ['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'];
  const displaySource = pendingPreview || '';
  const pipelineRunning = ['pipeline', 'local-3d', 'register', 'payment-return'].includes(busy);

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
      if (data.session?.user) {
        setDraftId((current) => current || newDraftId());
        setMessage('Signed in. Choose one photo to begin.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose one photo to begin.');
        } else setMessage('Sign in to start.');
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

  function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${session?.access_token || ''}`, ...extra };
  }

  async function startLocalBuild(photo, activeDraftId) {
    setBusy('pipeline');
    setSourceReference({
      draftId: activeDraftId,
      rightsBasis: 'user-owned',
      provider: 'voxelpop-local-webgl-v1',
      storagePath: null,
    });
    setSource3d({ status: 'IN_PROGRESS', progress: 22, modelUrl: null, thumbnailUrl: null, taskId: `local-source:${activeDraftId}` });
    setVoxelImage('');
    setFinal3d(empty3d());
    setLocalRecipe(null);
    setCollectionReady(false);
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setQuote(null);
    setAvailability('');
    setPipelinePhase('source3d');
    setMessage('Building the VoxelPop 3D image on this device…');
    await wait(220);
    const poster = await createVoxelPoster(photo);
    setSource3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, thumbnailUrl: poster, taskId: `local-source:${activeDraftId}` });
    setVoxelImage(poster);
    setFinal3d({ status: 'IN_PROGRESS', progress: 72, modelUrl: null, thumbnailUrl: poster, taskId: null });
    setPipelinePhase('voxel-3d');
    setBusy('local-3d');
    setMessage('3D image ready. Turning it into a movable VoxelPop model locally…');
  }

  async function registerLocalRecipe(recipe) {
    const response = await fetch('/api/property-local-voxel', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ draftId, recipe }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local model could not be linked to your account.');
    return data;
  }

  const handleLocal3DReady = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !draftId) return;
    setLocalRecipe(recipe);
    setBusy('register');
    setFinal3d((current) => ({ ...current, status: 'IN_PROGRESS', progress: 92 }));
    try {
      const data = await registerLocalRecipe(recipe);
      setFinal3d({
        status: 'SUCCEEDED',
        progress: 100,
        modelUrl: data.modelUrl || null,
        thumbnailUrl: voxelImage || null,
        taskId: data.taskId,
      });
      setCollectionReady(data.collectionReady === true);
      setPipelinePhase('world');
      setMessage(data.collectionReady
        ? 'Your voxel is ready without Meshy credits. Add the property address to place it on My World.'
        : 'Your local 3D is ready. Add the address now; collection checkout stays off until the account model record can be saved.');
      await removeDevicePhoto(draftId);
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generation_session')) {
        window.history.replaceState({}, '', '/property');
      }
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, thumbnailUrl: voxelImage || null, taskId: `local-device:${draftId}` });
      setCollectionReady(false);
      setPipelinePhase('world');
      setMessage(`The local 3D is ready, but its Vault link needs a retry. ${String(error?.message || error || '')}`.trim());
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token, voxelImage]);

  useEffect(() => {
    if (!session?.access_token || typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    const canceled = params.get('generation_checkout') === 'cancelled';
    const canceledDraftId = clean(params.get('draftId'));
    if (canceled && canceledDraftId) {
      const key = `cancel:${canceledDraftId}`;
      if (checkoutHandledRef.current === key) return undefined;
      checkoutHandledRef.current = key;
      setBusy('');
      setMessage('Checkout canceled. No generation started; your photo is still kept privately on this device so you can retry.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Reopening your private on-device photo…');

    (async () => {
      try {
        const form = new FormData();
        form.append('generationSessionId', generationSessionId);
        const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || data?.paid !== true || !data?.draftId) throw new Error(data?.error || 'Your paid VoxelPop creation could not be verified.');
        if (!active) return;
        setDraftId(data.draftId);
        setPaidSessionId(generationSessionId);
        const photo = await loadDevicePhoto(data.draftId);
        if (!active) return;
        if (!photo) {
          setBusy('');
          setRightsConfirmed(false);
          setMessage('Payment is verified. Choose the property photo again on this device; you will not be charged again.');
          return;
        }
        setPendingPhoto(photo);
        setPendingPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo);
        });
        setRightsConfirmed(true);
        await startLocalBuild(photo, data.draftId);
      } catch (error) {
        if (active) {
          checkoutHandledRef.current = '';
          setBusy('');
          setMessage(String(error?.message || error || 'Your paid VoxelPop creation could not start.'));
        }
      }
    })();
    return () => { active = false; };
  }, [session?.access_token]);

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

  function choosePhoto() {
    if (!session?.access_token) return setMessage('Sign in before choosing a photo.');
    uploadInputRef.current?.click();
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('prepare');
    setMessage(isHeic(selected) ? 'Preparing your iPhone photo…' : 'Preparing your photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This photo is still too large after preparation. Try a screenshot or smaller version.');
      setPendingPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(photo);
      });
      setPendingPhoto(photo);
      setRightsConfirmed(false);
      setMessage(paidSessionId
        ? 'Payment verified. Confirm you can use this photo, then start the local VoxelPop build—no second charge.'
        : `Photo ready. Confirm you can use it, then pay ${CREATION_PRICE_LABEL} to create the complete voxel.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally { setBusy(''); }
  }

  async function usePhotoAndBuild() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      setMessage(paidSessionId ? 'Starting your paid VoxelPop build locally…' : `Keeping your photo on this device and opening ${CREATION_PRICE_LABEL} checkout…`);
      await saveDevicePhoto(draftId, pendingPhoto);
      if (paidSessionId) {
        await startLocalBuild(pendingPhoto, draftId);
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
        return;
      }
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure 3D creation checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(String(error?.message || error || 'Secure VoxelPop creation could not start.'));
      setBusy('');
    }
  }

  async function retryBuild() {
    const photo = pendingPhoto || await loadDevicePhoto(draftId).catch(() => null);
    if (!photo) {
      setMessage('Choose the property photo again. A retry will not create another charge for a verified payment.');
      return;
    }
    await startLocalBuild(photo, draftId);
  }

  async function retryLocalPersistence() {
    if (!localRecipe) return setMessage('The local 3D recipe is not available. Rebuild the voxel first.');
    setBusy('register');
    setMessage('Reconnecting this local voxel to your Vault record…');
    try {
      const data = await registerLocalRecipe(localRecipe);
      setFinal3d((current) => ({ ...current, taskId: data.taskId, modelUrl: data.modelUrl || null }));
      setCollectionReady(data.collectionReady === true);
      setMessage(data.collectionReady ? 'Vault link ready. You can collect this digital voxel now.' : data.note || 'The Vault record is still unavailable.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The Vault link is still unavailable.'));
    } finally { setBusy(''); }
  }

  async function placeOnWorld(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !finalReady) return;
    setBusy('map');
    setMessage('Checking the address and building the local property map…');
    try {
      const params = new URLSearchParams({ address: value, radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const atlas = await response.json().catch(() => ({}));
      if (!response.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped.');
      const selected = selectedOrLocation(atlas, value);
      if (!selected) throw new Error('That address resolved without a usable World location.');
      setBuilding(selected);
      setAtlasBuildings(Array.isArray(atlas?.buildings) ? atlas.buildings : []);
      setMappedAddress(value);
      setQuote(null);
      setAvailability('');

      if (!selected.mappedIdentityReady || String(selected.atlasId || '').startsWith('location:')) {
        setMessage('Map preview ready. We found the location, but not a source-backed building identity, so collection stays unavailable.');
        return;
      }
      const quoteResponse = await fetch('/api/property-collectible/quote', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: value, atlasId: selected.atlasId }),
      });
      const priced = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok || !priced?.ok) throw new Error(priced?.error || 'The voxel collection price could not be verified.');
      setQuote(priced.quote);
      setAvailability(priced.availability || 'AVAILABLE');
      setMessage(priced.sold
        ? 'This mapped digital voxel has already been collected.'
        : collectionReady
          ? 'My World preview ready. If it looks right, collect the voxel and save it to your Vault.'
          : 'My World preview ready. The local 3D works; reconnect its Vault record before collection checkout.');
    } catch (error) {
      setMessage(String(error?.message || error || 'World placement failed.'));
    } finally { setBusy(''); }
  }

  async function collectAndSave() {
    if (!collectionReady) return setMessage('Reconnect the local voxel to its Vault record before opening collection checkout.');
    if (!quote || !building?.atlasId || !final3d?.taskId || !session?.access_token) return;
    setBusy('checkout');
    setMessage('Opening secure checkout for the digital voxel…');
    try {
      const response = await fetch('/api/property-collectible/checkout', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: mappedAddress, atlasId: building.atlasId, draftId, modelTaskId: final3d.taskId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(String(error?.message || error || 'Checkout could not open.'));
      setBusy('');
    }
  }

  function resetCreation() {
    const oldDraft = draftId;
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setPaidSessionId('');
    setSourceReference(null);
    setSource3d(empty3d());
    setVoxelImage('');
    setFinal3d(empty3d());
    setLocalRecipe(null);
    setCollectionReady(false);
    setPipelinePhase('photo');
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setQuote(null);
    setAvailability('');
    setBusy('');
    setMessage('Choose one photo to begin.');
    removeDevicePhoto(oldDraft);
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1><section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing uploads, generates, or charges before sign-in.</small></section></section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>One account keeps your creations, Vault, My World items, and optional mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>A wallet is optional until you choose the separate Verify &amp; Mint step later.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${step} of 5`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 5 · {labels[step - 1]}</p>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>{pendingPhoto ? 'Use this photo?' : 'Choose one photo.'}</p>
        <p className={styles.flowHint}>Photo → 3D image → interactive voxel → address → improved property map → collect to Vault.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {displaySource ? <div className={styles.heroCard}><img src={displaySource} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO · DEVICE ONLY</span></div> : <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>}
        {pendingPhoto ? <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={usePhotoAndBuild} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Preparing…' : paidSessionId ? 'Use photo → start build' : `Pay ${CREATION_PRICE_LABEL} · Use photo → start build`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another</button>
        </div> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>}
        <p className={styles.truth}>The {CREATION_PRICE_LABEL} charge is for one digital VoxelPop creation. The source photo stays on this device through checkout and local generation; VoxelPop does not require Meshy credits or private checkout photo storage. One photo cannot verify unseen sides, exact dimensions, title, ownership, or property value.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Building the 3D image.</p>
        <p className={styles.stepCopy}>VoxelPop is turning your authorized photo into the block-style image locally on your device. No Meshy generation is called.</p>
        <div className={styles.heroCard}>{displaySource ? <img src={displaySource} alt="Source being turned into a VoxelPop image"/> : null}<span className={styles.badge}>LOCAL BUILD · {Math.round(Number(source3d?.progress || 0))}%</span><div className={styles.buildPulse}/></div>
        <div className={styles.autoPanel}><b>NO MESHY CREDITS</b><span>The image stays visible first. Then the movable 3D loads on top only after WebGL is ready.</span></div>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>VoxelPop image → movable 3D.</p>
        <p className={styles.stepCopy}>Your rendered voxel image stays visible until the interactive local 3D has actually rendered.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelImage || displaySource} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>VOXEL IMAGE → INTERACTIVE 3D</span>
          {!finalReady ? <div className={styles.buildPulse}/> : null}
        </div>
        <div className={styles.autoPanel}><b>AUTOMATIC · ON DEVICE</b><span>Photo → VoxelPop image → interactive 3D. No external generation credits are spent.</span></div>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Add the property address.</p>
        <p className={styles.stepCopy}>Enter the address for the property shown in your photo. We use it to find source-backed building footprints and build the improved neighborhood map.</p>
        <div className={styles.heroCard}><LocalVoxelModelViewer imageUrl={voxelImage}/><span className={styles.badge}>VOXEL READY · LOCAL 3D</span></div>
        <form className={styles.searchForm} onSubmit={placeOnWorld}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Building map…' : 'Verify address + preview'}</button></form>
        <small className={styles.mapNote}>The map uses source-backed building data where available. The address is not proof of ownership, title, property value, or an investment offering.</small>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Your World preview.</p>
        <p className={styles.stepCopy}>The selected building is highlighted inside its nearby source-backed neighborhood, with touch rotation and zoom.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · IMPROVED PROPERTY MAP</span></div>
        <div className={styles.miniModel}><LocalVoxelModelViewer imageUrl={voxelImage}/></div>
        <div className={styles.priceCard}>
          <div><small>DIGITAL VOXEL</small><b>{quote?.label || 'World preview'}</b><span>{mappedAddress}</span></div>
          <strong>{quote ? dollars(quote.priceCents) : '—'}</strong>
          {quote ? <p>{quote.explanation} This is the price of the generated digital voxel—not the market value of the house or land.</p> : null}
          {availability === 'SOLD' ? <div className={styles.sold}>ALREADY COLLECTED · THIS MAPPED DIGITAL VOXEL IS ONE-OF-ONE</div> : null}
          {!quote && !building?.mappedIdentityReady ? <div className={styles.sold}>PREVIEW ONLY · A SOURCE-BACKED BUILDING ID IS NEEDED BEFORE COLLECTION</div> : null}
          {quote && availability !== 'SOLD' && collectionReady ? <button className={styles.primaryOrange} type="button" onClick={collectAndSave} disabled={busy === 'checkout'}>{busy === 'checkout' ? 'Opening secure checkout…' : `Collect voxel · ${dollars(quote.priceCents)}`}</button> : null}
          {quote && availability !== 'SOLD' && !collectionReady ? <div className={styles.choicePanel}><b>LOCAL 3D READY · VAULT LINK NEEDS RETRY</b><span>The model works on this device. Reconnect its compact account record before any collection payment opens.</span><button className={styles.primaryPurple} type="button" onClick={retryLocalPersistence} disabled={busy === 'register'}>{busy === 'register' ? 'Reconnecting…' : 'Reconnect Vault model'}</button></div> : null}
          <button className={styles.textButton} type="button" onClick={() => { setBuilding(null); setAtlasBuildings([]); setMappedAddress(''); setQuote(null); setAvailability(''); setMessage('Enter the correct property address.'); }}>Change address</button>
        </div>
        <p className={styles.truth}>This flow creates and may sell the generated digital VoxelPop item only. The photo, local 3D, address, map, payment, or optional later mint does not create deed/title, rent, occupancy, fractional investment, appreciation, or other rights in the physical property. Real-property investing can only appear through a separately verified offering.</p>
      </> : null}

      {step > 1 && !pipelineRunning ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      {step === 3 && !pipelineRunning && !finalReady ? <button className={styles.primaryOrange} type="button" onClick={retryBuild}>Try local build again</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
