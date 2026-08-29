'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const CREATION_PRICE_LABEL = '$4.99';
const CREATION_PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });

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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
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
      image.onerror = () => reject(new Error('The photo could not be opened for the VoxelPop 3D picture.'));
    });

    // This is the review picture, not the voxel. Preserve the complete house photo
    // instead of forcing it through the old 72x72 square crop before the user can
    // decide whether the result is recognizable enough to voxelize.
    const output = document.createElement('canvas');
    output.width = 1200;
    output.height = 900;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop 3D picture processing is unavailable.');

    const background = context.createLinearGradient(0, 0, output.width, output.height);
    background.addColorStop(0, '#f6f1ea');
    background.addColorStop(1, '#ded4e6');
    context.fillStyle = background;
    context.fillRect(0, 0, output.width, output.height);

    const naturalWidth = image.naturalWidth || 1;
    const naturalHeight = image.naturalHeight || 1;
    const maxWidth = 1120;
    const maxHeight = 820;
    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
    const drawWidth = Math.max(1, Math.round(naturalWidth * scale));
    const drawHeight = Math.max(1, Math.round(naturalHeight * scale));
    const dx = Math.round((output.width - drawWidth) / 2);
    const dy = Math.round((output.height - drawHeight) / 2) - 4;

    context.save();
    context.shadowColor = 'rgba(31,18,42,.24)';
    context.shadowBlur = 28;
    context.shadowOffsetX = 18;
    context.shadowOffsetY = 22;
    context.fillStyle = '#1d1425';
    context.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
    context.restore();

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'saturate(1.04) contrast(1.04)';
    context.drawImage(image, 0, 0, naturalWidth, naturalHeight, dx, dy, drawWidth, drawHeight);
    context.filter = 'none';

    const shade = context.createLinearGradient(dx, dy, dx + drawWidth, dy + drawHeight);
    shade.addColorStop(0, 'rgba(255,255,255,.07)');
    shade.addColorStop(0.62, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.09)');
    context.fillStyle = shade;
    context.fillRect(dx, dy, drawWidth, drawHeight);

    context.strokeStyle = 'rgba(201,255,84,.78)';
    context.lineWidth = 6;
    context.strokeRect(dx - 3, dy - 3, drawWidth + 6, drawHeight + 6);
    return output.toDataURL('image/jpeg', 0.94);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PropertyJourneySimple() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [voxelPoster, setVoxelPoster] = useState('');
  const [localRecipe, setLocalRecipe] = useState(null);
  const [final3d, setFinal3d] = useState(empty3d);
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

  const localReady = final3d?.status === 'SUCCEEDED';
  const mintReady = localReady && Boolean(final3d?.modelUrl) && String(final3d?.taskId || '').startsWith('local-v1:');
  const mapped = Boolean(building && mappedAddress);
  const step = savedDraft ? 5 : mapped ? 4 : paidSessionId ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PICTURE → VOXEL', 'MAP · OPTIONAL', 'MINT'];
  const immediateMintHref = mintReady ? `/property/mint?${new URLSearchParams({ draftId, taskId: final3d.taskId }).toString()}` : '';

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
        setMessage('Signed in. Choose one property photo.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose one property photo.');
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
        ? 'Payment is already verified. Confirm the photo, create the 3D picture, review it, then build the voxel—no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL} to create the 3D picture and reviewed voxel.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function startLocalBuild(photo, activeDraftId) {
    setBusy('local-build');
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d({ status: 'IN_PROGRESS', progress: 30, modelUrl: null, taskId: null });
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('Payment confirmed. Creating a house-faithful 3D picture on this device…');
    const poster = await createVoxelPoster(photo);
    setVoxelPoster(poster);
    setFinal3d({ status: 'IN_PROGRESS', progress: 72, modelUrl: null, taskId: null });
    setBusy('local-3d');
    setMessage('3D picture ready. Review it first. VoxelPop will not build the movable voxel until you tap Create 3D Voxel.');
  }

  async function verifyPaidSession(generationSessionId) {
    const form = new FormData();
    form.append('generationSessionId', generationSessionId);
    const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || data?.paid !== true || !data?.draftId) {
      throw new Error(data?.error || 'Your paid VoxelPop creation could not be verified.');
    }
    return data;
  }

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
      setDraftId(canceledDraftId);
      setMessage('Checkout canceled. Nothing was created or charged. Your photo is still on this device if you want to try again.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your private photo and creating the 3D picture…');

    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setBusy('');
          setMessage('Payment is verified. Choose the same property photo again and press Create 3D Picture—you will not be charged again.');
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

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      if (paidSessionId) {
        await startLocalBuild(pendingPhoto, draftId);
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, VoxelPop creates the 3D picture for you to review before any voxel is built.`);
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure 3D creation checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'Secure VoxelPop creation could not start.'));
    }
  }

  const handleLocal3DReady = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !draftId) return;
    setLocalRecipe(recipe);
    setBusy('register');
    setFinal3d((current) => ({ ...current, status: 'IN_PROGRESS', progress: 92 }));
    try {
      const response = await fetch('/api/property-local-voxel', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, recipe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local 3D voxel could not be linked to your Vault.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null });
      setMessage('Your 3D voxel is ready. Inspect it now. You can mint this exact voxel next, or optionally add the address for map context and My World.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage('Your 3D voxel is ready on this device. You can continue to the map, but minting waits until the reviewed voxel is synced to your account.');
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching your reviewed 3D voxel to the mapped building and nearby neighborhood…');
    try {
      const params = new URLSearchParams({ address: value, radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const atlas = await response.json().catch(() => ({}));
      if (!response.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped.');
      const selected = selectedOrLocation(atlas, value);
      if (!selected) throw new Error('That address resolved without a usable map location.');
      setBuilding(selected);
      setAtlasBuildings(Array.isArray(atlas?.buildings) ? atlas.buildings : []);
      setMappedAddress(value);
      setSavedDraft(null);
      setMessage(selected.geometry
        ? 'Matched. The map now uses the source-backed building footprint. Save the reviewed voxel to My World; minting remains a separate optional action.'
        : 'Location matched. A source-backed footprint was not available, so the map is showing the verified location reference. Save the voxel to My World; minting remains optional.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this reviewed 3D voxel to My World…');
    try {
      const base = buildPropertyDraft({
        building,
        fallbackLabel: mappedAddress,
        focusAuthority: clean(building?.source?.authority),
      });
      if (!base) throw new Error('This mapped property does not have enough location identity to save.');
      const draft = {
        ...base,
        state: 'saved',
        voxelpop: {
          paidCreation: true,
          priceCents: CREATION_PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          photoMatchedFront: true,
          reviewPictureApprovedBeforeVoxel: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          modelTaskId: final3d?.taskId || null,
          modelUrl: final3d?.modelUrl || null,
        },
        world: { ...(base.world || {}), public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
      };
      const localSaved = savePropertyDraft(draft);
      let synced = false;
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) {
          await savePropertyDraftToAccount(client, session.user, localSaved);
          synced = true;
        }
      } catch {}
      setSavedDraft(localSaved);
      await removeDevicePhoto(draftId);
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
      setMessage(synced
        ? 'Saved. Your reviewed 3D voxel is in My World and your Vault. Mint remains optional.'
        : 'Saved to My World on this device. Account sync can retry from Vault later; minting waits for the account-synced voxel.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This 3D property could not be saved yet.'));
    } finally {
      setBusy('');
    }
  }

  function changeAddress() {
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('Enter the correct property address.');
  }

  function resetCreation() {
    const oldDraft = draftId;
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setPaidSessionId('');
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setSavedDraft(null);
    setBusy('');
    setMessage('Choose one property photo.');
    removeDevicePhoto(oldDraft);
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing charges before sign-in.</small></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>One account keeps your paid creations, Vault, My World items, and optional mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>A wallet is not needed to create the 3D. It is only needed if you choose to mint after seeing the voxel.</small>
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
        <p className={styles.bigPrompt}>Choose the building photo.</p>
        <p className={styles.flowHint}>One photo → pay $4.99 → review 3D picture → create 3D voxel → mint if you want → optional map/save.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
        <p className={styles.truth}>Use a clear front or three-quarter photo of the building for the closest local match. The review picture keeps the full photo proportions instead of cropping every house into a square.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Pay once. See the 3D picture first.</p>
        <p className={styles.stepCopy}>The $4.99 purchase includes the 3D picture review, the movable VoxelPop voxel, mapping, and saving to My World. The voxel is not built until you review the picture and choose to continue.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>YOUR BUILDING PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : `Pay ${CREATION_PRICE_LABEL} & Create 3D Picture`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>The $4.99 charge buys one digital VoxelPop creation. It does not buy the physical property, deed/title, investment rights, rent rights, or guaranteed value.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>{localReady ? 'Your 3D voxel is ready.' : 'Review the 3D picture.'}</p>
        <p className={styles.stepCopy}>{localReady
          ? 'Drag and inspect the voxel you chose to build. If it looks right, mint this exact digital voxel next. The address/map is optional and does not change the voxel you approved.'
          : 'First VoxelPop shows the higher-fidelity 3D picture without the old square crop. Only after you approve that picture does it build the movable voxel.'}</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {!pendingPhoto && !voxelPoster ? <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>PAYMENT VERIFIED</b>
          <span>Your photo was not available after checkout. Choose it again—there is no second charge.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button>
        </section> : null}
        {pendingPreview || voxelPoster ? <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{localReady ? '3D VOXEL READY · INSPECT IT' : '3D PICTURE · REVIEW FIRST'}</span>
          {busy === 'local-build' ? <div className={styles.buildPulse}/> : null}
        </div> : null}
        {paidSessionId && pendingPhoto && !voxelPoster && busy !== 'local-build' ? <button className={styles.primaryPurple} type="button" onClick={payAndCreate}>Create 3D Picture · already paid</button> : null}
        {mintReady ? <a className={styles.primaryLink} href={immediateMintHref}>Mint this 3D voxel · optional</a> : null}
        {localReady ? <>
          <p className={styles.flowHint}>OPTIONAL MAP · Add the real address only if you also want source-backed location context and My World placement.</p>
          <form className={styles.searchForm} onSubmit={mapBuilding}>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address · optional" aria-label="Property address" autoComplete="street-address"/>
            <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Add address & map'}</button>
          </form>
        </> : <div className={styles.autoPanel}><b>PAY ONCE · REVIEW PICTURE · BUILD VOXEL</b><span>No Meshy credits. No automatic mint. You choose when the voxel is created.</span></div>}
        <p className={styles.truth}>The photo helps the visible front appearance. One photo cannot verify unseen sides, roof planes, or exact dimensions. Minting records the digital voxel only; it does not create rights in the physical property.</p>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Matched to the real map.</p>
        <p className={styles.stepCopy}>The purple/lime building is your selected property inside its nearby mapped neighborhood. Save the reviewed voxel to My World. Minting remains separate and optional.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
        {voxelPoster ? <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelPoster} alt="Reviewed VoxelPop 3D picture"/></div> : null}
        <section className={styles.donePanel}>
          <b>{mappedAddress}</b>
          <span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; exact building footprint was not available from the map source.'}</span>
          <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save voxel to My World'}</button>
          {mintReady ? <a className={styles.primaryLink} href={immediateMintHref}>Mint this 3D voxel · optional</a> : null}
          <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
        </section>
        <p className={styles.truth}>Saving is included in the $4.99 creation. No second payment is required. My World is a digital 3D collection, not a land-title registry.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Voxel saved. Mint it if you want.</p>
        <p className={styles.stepCopy}>You already saw the 3D picture and approved the movable voxel. The digital creation is saved; minting is the optional final blockchain step.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · VOXEL SAVED</span></div>
        <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>{savedDraft?.label || mappedAddress}</b>
          <span>3D picture reviewed · voxel created · map context saved. Mint only if you want this digital voxel in your wallet.</span>
          {savedDraft?.voxelpop?.modelUrl && String(savedDraft?.voxelpop?.modelTaskId || '').startsWith('local-v1:') ? <a className={styles.primaryLink} href={`/vault/property-drafts/${encodeURIComponent(savedDraft.id)}/mint`}>Mint this 3D voxel · optional</a> : null}
          <a className={styles.secondaryLink} href="/world">View My World</a>
          <a className={styles.secondaryLink} href={`/vault/property-drafts/${encodeURIComponent(savedDraft?.id || '')}`}>Open saved voxel</a>
          <button className={styles.textButton} type="button" onClick={resetCreation}>Create another</button>
        </section>
        <p className={styles.truth}>The NFT is the digital voxel only. It does not create deed/title, ownership, occupancy, rent, fractional-investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {step > 1 && step < 5 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
