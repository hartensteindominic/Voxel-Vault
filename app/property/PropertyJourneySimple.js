'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoDepthPreview from './PhotoDepthPreview';
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
      image.onerror = () => reject(new Error('The photo could not be opened for the VoxelPop image.'));
    });
    const aspect = Math.max(0.5, Math.min(2, (image.naturalWidth || 1) / (image.naturalHeight || 1)));
    const sampleWidth = aspect >= 1 ? 96 : Math.max(54, Math.round(96 * aspect));
    const sampleHeight = aspect >= 1 ? Math.max(54, Math.round(96 / aspect)) : 96;
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop image processing is unavailable.');
    sampleContext.filter = 'saturate(1.05) contrast(1.04)';
    sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);

    const scale = 9;
    const output = document.createElement('canvas');
    output.width = sampleWidth * scale;
    output.height = sampleHeight * scale;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.92);
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
  const [voxelStarted, setVoxelStarted] = useState(false);
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
  const mapped = Boolean(building && mappedAddress);
  const step = savedDraft ? 6 : mapped ? 5 : voxelStarted ? 4 : paidSessionId ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PREVIEW', 'VOXEL', 'MAP', 'SAVE + MINT'];

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
        setMessage('Signed in. Choose one clear property photo.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose one clear property photo.');
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
      setVoxelStarted(false);
      setVoxelPoster('');
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setBuilding(null);
      setAtlasBuildings([]);
      setMappedAddress('');
      setSavedDraft(null);
      setRightsConfirmed(Boolean(paidSessionId));
      setMessage(paidSessionId
        ? 'Payment is already verified. Review the 3D preview of this photo, then create the voxel—no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}. You will see the 3D preview before any voxel is built.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
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
      setMessage('Checkout canceled. Nothing was created or charged. Your photo can still be used if you want to try again.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your 3D preview…');

    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        setVoxelStarted(false);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setBusy('');
          setMessage('Payment is verified. Choose the same property photo again to open the 3D preview—there is no second charge.');
          window.history.replaceState({}, '', '/property');
          return;
        }
        setPendingPhoto(photo);
        setPendingPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo);
        });
        setRightsConfirmed(true);
        setBusy('');
        setMessage('Payment verified. This is the 3D preview stage. Check that it looks like your house before creating the voxel.');
        window.history.replaceState({}, '', '/property');
      } catch (error) {
        if (active) {
          checkoutHandledRef.current = '';
          setBusy('');
          setMessage(String(error?.message || error || 'Your paid VoxelPop creation could not be opened.'));
        }
      }
    })();

    return () => { active = false; };
  }, [session?.access_token]);

  async function payAndPreview() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    if (paidSessionId) {
      setMessage('Payment is already verified. Review the 3D preview below, then create the voxel—no second charge.');
      return;
    }

    setBusy('generation-checkout');
    let cachedOnDevice = false;
    try {
      try {
        await saveDevicePhoto(draftId, pendingPhoto);
        cachedOnDevice = true;
      } catch {
        cachedOnDevice = false;
      }
      setMessage(cachedOnDevice
        ? `Opening secure ${CREATION_PRICE_LABEL} checkout. After payment you return to the 3D preview.`
        : `Opening secure ${CREATION_PRICE_LABEL} checkout. Your browser could not keep the photo privately through checkout, so you may need to choose the same photo once after payment.`);
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

  async function startVoxelBuild() {
    if (!paidSessionId || !pendingPhoto || !pendingPreview) return setMessage('A verified payment and property photo are required before voxel creation.');
    setVoxelStarted(true);
    setBusy('local-build');
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d({ status: 'IN_PROGRESS', progress: 28, modelUrl: null, taskId: null });
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('3D preview approved. Creating the voxel version from the same source photo—no Meshy credits are used.');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setFinal3d({ status: 'IN_PROGRESS', progress: 70, modelUrl: null, taskId: null });
      setBusy('local-3d');
      setMessage('Voxelizing the approved house photo locally. You can compare VOXEL vs SOURCE in the viewer.');
    } catch (error) {
      setBusy('');
      setVoxelStarted(false);
      setFinal3d(empty3d());
      setMessage(String(error?.message || error || 'The voxel version could not be prepared.'));
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
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local 3D could not be linked to your Vault.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null });
      setMessage('Voxel ready. Compare it with SOURCE if you want, then enter the address to match it to the real map.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage('The voxel is ready on this device. Enter the address to continue; Vault syncing can retry later.');
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching the voxel to the mapped building and nearby neighborhood…');
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
        ? 'Matched. The map is now grounded to the source-backed building footprint.'
        : 'Location matched. A source-backed footprint was not available, so the verified location is shown instead.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this voxel property to My World…');
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
          engine: 'voxelpop-local-webgl-v1',
          previewEngine: 'voxelpop-photo-relief-v1',
          sourcePhotoStoredByVoxelVault: false,
          photoInformedFront: true,
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
        ? 'Saved. Your voxel is in My World and your Vault. Minting is the optional next step.'
        : 'Saved to My World on this device. You can still continue to optional Verify + Mint; account sync can retry later.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This voxel property could not be saved yet.'));
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
    setVoxelStarted(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setSavedDraft(null);
    setBusy('');
    setMessage('Choose one clear property photo.');
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
        <small>A wallet is not needed to create the 3D preview or voxel.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${step} of 6`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 6 · {labels[step - 1]}</p>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>Start with the real house photo.</p>
        <p className={styles.flowHint}>Photo → pay once → inspect 3D preview → create voxel → match map → save + optional mint.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') choosePhoto(); }}><div>+</div><b>Choose a property photo</b><span>Clear front or three-quarter view · iPhone photos supported</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
        <p className={styles.truth}>The original photo remains the visual source. A single photo cannot prove unseen sides, exact dimensions, deed/title, or ownership rights.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Pay once. Preview first.</p>
        <p className={styles.stepCopy}>The {CREATION_PRICE_LABEL} purchase unlocks the 3D photo preview and the voxel version. You review the 3D preview before voxelization starts.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>YOUR SOURCE PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndPreview} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : `Pay ${CREATION_PRICE_LABEL} · Open 3D Preview`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>This charge buys one digital VoxelPop creation. It does not buy the physical property, deed/title, investment rights, rent rights, or guaranteed value.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>Check the house in 3D first.</p>
        <p className={styles.stepCopy}>This is intentionally not the voxel yet. It keeps your exact photo on the front and adds local depth/tilt so you can confirm the house appearance before voxelization.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {!pendingPhoto || !pendingPreview ? <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>PAYMENT VERIFIED</b>
          <span>Your browser did not keep the source photo through checkout. Choose the same photo again—there is no second charge.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button>
        </section> : <>
          <div className={styles.heroCard}>
            <PhotoDepthPreview imageUrl={pendingPreview}/>
            <span className={styles.badge}>3D PHOTO PREVIEW · NOT VOXEL YET</span>
          </div>
          <div className={styles.choicePanel}>
            <div className={styles.sourceCheck}><img src={pendingPreview} alt="Source property reference"/><div><b>Same source photo</b><span>The preview does not replace your house with a generic building.</span></div></div>
            <button className={styles.primaryPurple} type="button" onClick={startVoxelBuild} disabled={Boolean(busy)}>{busy ? 'Preparing…' : 'Looks right · Create Voxel 3D'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different photo</button>
          </div>
        </>}
        <p className={styles.truth}>The front image is your source photo. The relief/depth is estimated from one photo and is not claimed to reconstruct unseen geometry exactly.</p>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>{localReady ? 'Now the voxel is ready.' : 'Creating the voxel version.'}</p>
        <p className={styles.stepCopy}>{localReady
          ? 'This is the voxel stage. Use VOXEL / SOURCE in the viewer to compare it directly with the original house photo, then add the address.'
          : 'VoxelPop is converting the approved source photo locally. The photo keeps its original aspect ratio instead of being forced into a square crop.'}</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{localReady ? 'VOXEL 3D · READY' : 'BUILDING VOXEL 3D'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {localReady ? <form className={styles.searchForm} onSubmit={mapBuilding}>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Match this voxel to the real map'}</button>
        </form> : <div className={styles.autoPanel}><b>ONE PURCHASE · ZERO MESHY CREDITS</b><span>The voxel is generated locally after you approved the 3D preview. There is no second creation charge.</span></div>}
        <p className={styles.truth}>The voxel is photo-informed, not an architectural survey. The next map step adds source-backed location/footprint data where available.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Matched to the real map.</p>
        <p className={styles.stepCopy}>The map identity is kept separate from the visual model. Save the digital voxel to My World first; optional Verify + Mint comes next.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
        {voxelPoster ? <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelPoster} alt="VoxelPop building preview"/></div> : null}
        <section className={styles.donePanel}>
          <b>{mappedAddress}</b>
          <span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; exact building footprint was not available from the map source.'}</span>
          <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save Voxel to My World'}</button>
          <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
        </section>
        <p className={styles.truth}>My World stores a digital 3D collection/reference. It is not a land-title registry and does not create real-property ownership.</p>
      </> : null}

      {step === 6 ? <>
        <p className={styles.bigPrompt}>Saved. Mint is optional.</p>
        <p className={styles.stepCopy}>Your source photo → 3D preview → voxel → map → My World flow is complete. If you want an NFT, use Verify + Mint as a separate final action.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · SAVED</span></div>
        <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>{savedDraft?.label || mappedAddress}</b>
          <span>Your digital voxel is saved. Minting is not required to view, keep, or use it.</span>
          <a className={styles.primaryLink} href="/vault/properties/claim">Verify + Mint · Optional</a>
          <a className={styles.secondaryLink} href="/world">View My World</a>
          <a className={styles.textLink} href="/vault/property-drafts">Open My Vault</a>
          <button className={styles.textButton} type="button" onClick={resetCreation}>Create another</button>
        </section>
        <p className={styles.truth}>Minting creates a digital blockchain item/reference only. It does not mint the deed, transfer title, create rent rights, fractional investment rights, occupancy rights, or guaranteed appreciation in the physical property.</p>
      </> : null}

      {step > 1 && step < 6 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
