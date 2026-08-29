'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoVoxelViewer from './PhotoVoxelViewer';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import styles from './property.module.css';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, thumbnailUrl: null, taskId: null });
const CREATION_PRICE_LABEL = '$4.99';
const CREATION_PRICE_CENTS = 499;
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
    source: atlas?.sourceStatus || null,
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
    const request = db.transaction(DEVICE_STORE, 'readwrite').objectStore(DEVICE_STORE).put({
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

    const sourceWidth = Math.max(1, image.naturalWidth || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || 1);
    const ratio = Math.max(0.45, Math.min(2.2, sourceWidth / sourceHeight));
    const sampleMax = 72;
    const sampleWidth = ratio >= 1 ? sampleMax : Math.max(32, Math.round(sampleMax * ratio));
    const sampleHeight = ratio >= 1 ? Math.max(32, Math.round(sampleMax / ratio)) : sampleMax;
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop image processing is unavailable.');
    sampleContext.filter = 'saturate(1.08) contrast(1.06)';
    sampleContext.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, sampleWidth, sampleHeight);

    const output = document.createElement('canvas');
    if (ratio >= 1) {
      output.width = 864;
      output.height = Math.max(432, Math.round(864 / ratio));
    } else {
      output.height = 864;
      output.width = Math.max(432, Math.round(864 * ratio));
    }
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, output.width, output.height);
    const shade = context.createLinearGradient(0, 0, output.width, output.height);
    shade.addColorStop(0, 'rgba(255,255,255,.08)');
    shade.addColorStop(0.62, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.13)');
    context.fillStyle = shade;
    context.fillRect(0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function paidDraftRecord({ draftId, address, building, recipe, modelUrl, taskId, generationSessionId }) {
  const latitude = Number(building?.latitude);
  const longitude = Number(building?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const source = building?.source || {};
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    type: 'voxel-vault-property-3d-draft',
    id: `voxelpop:${draftId}`,
    label: address || building?.tags?.name || 'VoxelPop property',
    createdAt: now,
    updatedAt: now,
    state: 'ready',
    fidelity: 'purchased-photo-guided-voxel-3d',
    geometryKind: building?.geometry ? 'source-backed-building' : 'location-reference',
    coordinates: {
      latitude: hasCoordinates ? Number(latitude.toFixed(7)) : null,
      longitude: hasCoordinates ? Number(longitude.toFixed(7)) : null,
    },
    geometry: building?.geometry || null,
    propertyIdentity: {
      atlasId: clean(building?.atlasId) || null,
      parcelId: null,
      pin: null,
      sbl: null,
    },
    evidence: {
      exactParcelLinkedBuilding: false,
      sourceBackedBuilding: Boolean(building?.geometry),
      authoritativeParcelBoundary: false,
      calibratedStories: null,
      calibratedVisualHeightMeters: Number(building?.heightMeters) || null,
      openStreetPhotoCount: 0,
      reconstructionReferenceCount: 1,
      mapAuthority: clean(source?.authority) || 'World Atlas',
      mapLicense: clean(source?.license) || null,
      mapSourceUrl: clean(source?.sourceUrl) || null,
      listingProvider: null,
    },
    visual: {
      kind: 'photo-derived-local-voxel',
      engine: 'browser-local-v2',
      recipe,
      modelUrl: modelUrl || null,
      taskId: taskId || `local-device:${draftId}`,
      sourcePhotoStored: false,
      photoDerived: true,
    },
    commerce: {
      kind: 'property_voxel_creation',
      status: 'paid',
      creationPriceCents: CREATION_PRICE_CENTS,
      generationSessionId: generationSessionId || null,
      additionalCollectionPaymentRequired: false,
    },
    blockchain: { minted: false, optional: true, tokenId: null, network: null },
    world: { public: false, publishedAt: null, publicLabel: '3D Property' },
    legal: {
      titleVerified: false,
      ownershipRightsCreatedByDraft: false,
      ownershipRightsCreatedByMint: false,
      note: 'This paid VoxelPop creation is a digital representation only. The $4.99 creation payment, saving it, mapping it, or later minting it does not transfer deed/title, investment rights, rent rights, occupancy rights, or guarantee value.',
    },
  };
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
  const [address, setAddress] = useState('');
  const [mappedAddress, setMappedAddress] = useState('');
  const [building, setBuilding] = useState(null);
  const [atlasBuildings, setAtlasBuildings] = useState([]);
  const [savedDraft, setSavedDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);
  const checkoutHandledRef = useRef('');

  const finalReady = final3d?.status === 'SUCCEEDED';
  const sourceReady = source3d?.status === 'SUCCEEDED';
  const mapped = Boolean(building && mappedAddress && savedDraft);
  const step = !sourceReference ? 1 : !sourceReady ? 2 : !finalReady ? 3 : !mapped ? 4 : 5;
  const labels = ['PHOTO', 'CREATE', '3D', 'MAP', 'READY'];
  const displaySource = pendingPreview || '';
  const pipelineRunning = ['pipeline', 'local-3d', 'payment-return'].includes(busy);

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
    setSourceReference({ draftId: activeDraftId, rightsBasis: 'user-owned', provider: 'voxelpop-local-webgl-v2', storagePath: null });
    setSource3d({ status: 'IN_PROGRESS', progress: 24, modelUrl: null, thumbnailUrl: null, taskId: `local-source:${activeDraftId}` });
    setVoxelImage('');
    setFinal3d(empty3d());
    setLocalRecipe(null);
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('Building your VoxelPop image from the photo on this device…');
    await wait(180);
    const poster = await createVoxelPoster(photo);
    setSource3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, thumbnailUrl: poster, taskId: `local-source:${activeDraftId}` });
    setVoxelImage(poster);
    setFinal3d({ status: 'IN_PROGRESS', progress: 76, modelUrl: null, thumbnailUrl: poster, taskId: null });
    setBusy('local-3d');
    setMessage('Image ready. Building the movable photo-based 3D now…');
  }

  async function registerLocalRecipe(recipe) {
    const response = await fetch('/api/property-local-voxel', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ draftId, recipe }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Background Vault sync is unavailable.');
    return data;
  }

  const handleLocal3DReady = useCallback((recipe) => {
    if (!recipe || !draftId) return;
    const deviceTaskId = `local-device:${draftId}`;
    setLocalRecipe(recipe);
    setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, thumbnailUrl: voxelImage || null, taskId: deviceTaskId });
    setBusy('');
    setMessage('Your $4.99 3D creation is ready. Add the property address to place it on the map and save it.');

    // Account/catalog persistence is best-effort. It must never block a paid creation.
    if (session?.access_token) {
      registerLocalRecipe(recipe).then((data) => {
        setFinal3d((current) => ({
          ...current,
          modelUrl: data?.modelUrl || current.modelUrl || null,
          taskId: data?.taskId || current.taskId || deviceTaskId,
        }));
      }).catch(() => {});
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
      setMessage('Checkout canceled. Nothing was charged; your photo is still on this device so you can retry.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Reopening your photo and starting the 3D creation…');

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
          setMessage('Payment is verified. Choose the same property photo again on this device; you will not be charged again.');
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
        ? 'Payment verified. Confirm you can use this photo, then continue—there is no second charge.'
        : `Photo ready. Confirm you can use it, then pay ${CREATION_PRICE_LABEL} once for the complete 3D creation.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally { setBusy(''); }
  }

  async function usePhotoAndBuild() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      setMessage(paidSessionId ? 'Starting your already-paid VoxelPop 3D…' : `Keeping the photo on this device and opening the ${CREATION_PRICE_LABEL} creation checkout…`);
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
      setMessage('Choose the property photo again. A verified $4.99 payment will not be charged again.');
      return;
    }
    await startLocalBuild(photo, draftId);
  }

  async function placeOnWorld(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !finalReady || !localRecipe) return;
    setBusy('map');
    setMessage('Finding the address and building the source-backed property map…');
    try {
      const params = new URLSearchParams({ address: value, radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const atlas = await response.json().catch(() => ({}));
      if (!response.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped.');
      const selected = selectedOrLocation(atlas, value);
      if (!selected) throw new Error('That address resolved without a usable World location.');
      const draft = paidDraftRecord({
        draftId,
        address: value,
        building: selected,
        recipe: localRecipe,
        modelUrl: final3d?.modelUrl || null,
        taskId: final3d?.taskId || null,
        generationSessionId: paidSessionId,
      });
      const saved = savePropertyDraft(draft);
      setBuilding(selected);
      setAtlasBuildings(Array.isArray(atlas?.buildings) ? atlas.buildings : []);
      setMappedAddress(value);
      setSavedDraft(saved);
      await removeDevicePhoto(draftId);
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
      setMessage('Done. Your $4.99 VoxelPop 3D is mapped and saved. There is no second collection payment required.');
    } catch (error) {
      setMessage(String(error?.message || error || 'World placement failed.'));
    } finally { setBusy(''); }
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
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setSavedDraft(null);
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
        <small>A wallet is optional. Minting is a later choice and is not required to create or save your 3D.</small>
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
        <p className={styles.flowHint}>Photo → pay $4.99 once → photo-based 3D → map → saved. No second purchase.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {displaySource ? <div className={styles.heroCard}><img src={displaySource} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO · DEVICE ONLY</span></div> : <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>}
        {pendingPhoto ? <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={usePhotoAndBuild} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Preparing…' : paidSessionId ? 'Use photo → create 3D' : `Pay ${CREATION_PRICE_LABEL} · Create 3D`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another</button>
        </div> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>}
        <p className={styles.truth}>The {CREATION_PRICE_LABEL} charge is for one complete digital VoxelPop creation. It includes the local 3D, map placement and saving the digital creation. The photo stays on this device; no Meshy credits are used. One photo cannot verify unseen sides, exact dimensions, title, ownership, or property value.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Creating your voxel image.</p>
        <p className={styles.stepCopy}>VoxelPop keeps the original framing and turns the authorized photo into a block-style image locally. No external 3D-generation credits are used.</p>
        <div className={styles.heroCard}>{displaySource ? <img src={displaySource} alt="Source being turned into a VoxelPop image"/> : null}<span className={styles.badge}>LOCAL CREATE · {Math.round(Number(source3d?.progress || 0))}%</span><div className={styles.buildPulse}/></div>
        <div className={styles.autoPanel}><b>PAID CREATION IN PROGRESS</b><span>Your $4.99 payment is already verified. This step does not charge again.</span></div>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>Your photo → movable 3D.</p>
        <p className={styles.stepCopy}>The 3D now samples the full source photo instead of a square crop, so the visible façade and silhouette stay recognizable. Depth is stylized because one photo cannot reveal hidden sides.</p>
        <div className={styles.heroCard}>
          <PhotoVoxelViewer imageUrl={voxelImage || displaySource} sourceImageUrl={displaySource} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>PHOTO-BASED INTERACTIVE 3D</span>
          {!finalReady ? <div className={styles.buildPulse}/> : null}
        </div>
        <div className={styles.autoPanel}><b>INCLUDED IN YOUR $4.99</b><span>When the 3D renders, you automatically continue to the property map. Background Vault sync cannot stop you.</span></div>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Now add the address.</p>
        <p className={styles.stepCopy}>This connects your photo-based 3D to source-backed map context. Enter the address shown in the photo, then save it.</p>
        <div className={styles.heroCard}><PhotoVoxelViewer imageUrl={voxelImage} sourceImageUrl={displaySource} recipe={localRecipe}/><span className={styles.badge}>3D READY · $4.99 PAID</span></div>
        <form className={styles.searchForm} onSubmit={placeOnWorld}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Mapping + saving…' : 'Map + save to Vault'}</button></form>
        <small className={styles.mapNote}>The map uses source-backed building data where available. Saving a digital voxel does not prove ownership or change legal title.</small>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Done. It is yours in Voxel Vault.</p>
        <p className={styles.stepCopy}>Your paid photo-based 3D is saved, and the mapped building context is shown separately so the app does not invent legal or physical facts.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · SOURCE-BACKED MAP</span></div>
        <div className={styles.miniModel}><PhotoVoxelViewer recipe={localRecipe}/></div>
        <div className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>CREATED + SAVED · {CREATION_PRICE_LABEL} PAID ONCE</b>
          <span className={styles.signinCopy}>{mappedAddress}</span>
          <Link className={styles.primaryLink} href={`/vault/property-drafts/${encodeURIComponent(savedDraft?.id || '')}`}>Open saved 3D</Link>
          <Link className={styles.secondaryLink} href="/world">Open My World</Link>
          <Link className={styles.textLink} href="/vault/properties/claim">Verify / mint later · optional</Link>
          <small>No $1.99 collection checkout is required after the $4.99 creation payment.</small>
        </div>
        <p className={styles.truth}>The VoxelPop 3D is a photo-derived digital representation, not a guaranteed exact replica or deed. The source-backed map describes mapped building context separately. Payment, saving, mapping, or optional minting does not create deed/title, rent, occupancy, fractional investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {step > 1 && !pipelineRunning ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      {step === 3 && !pipelineRunning && !finalReady ? <button className={styles.primaryOrange} type="button" onClick={retryBuild}>Try local build again</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
