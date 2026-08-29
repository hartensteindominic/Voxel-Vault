'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
      image.onerror = () => reject(new Error('The photo could not be opened for the VoxelPop picture.'));
    });

    const sourceWidth = Math.max(1, image.naturalWidth || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || 1);
    const ratio = sourceWidth / sourceHeight;
    const longSample = 96;
    const sampleWidth = ratio >= 1 ? longSample : Math.max(54, Math.round(longSample * ratio));
    const sampleHeight = ratio >= 1 ? Math.max(54, Math.round(longSample / ratio)) : longSample;
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop picture processing is unavailable.');
    sampleContext.filter = 'saturate(1.05) contrast(1.04)';
    sampleContext.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, sampleWidth, sampleHeight);

    const output = document.createElement('canvas');
    output.width = 960;
    output.height = 720;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop picture processing is unavailable.');
    context.fillStyle = '#1f1528';
    context.fillRect(0, 0, output.width, output.height);

    const maxWidth = 830;
    const maxHeight = 590;
    const scale = Math.min(maxWidth / sampleWidth, maxHeight / sampleHeight);
    const drawWidth = Math.round(sampleWidth * scale);
    const drawHeight = Math.round(sampleHeight * scale);
    const x = Math.round((output.width - drawWidth) / 2 - 8);
    const y = Math.round((output.height - drawHeight) / 2 - 8);
    context.imageSmoothingEnabled = false;

    // Small layered offsets create a 3D-picture feel without changing or cropping
    // the visible house. The full source proportions remain intact for review.
    for (let offset = 28; offset >= 7; offset -= 7) {
      context.globalAlpha = 0.10 + ((28 - offset) / 28) * 0.05;
      context.drawImage(sample, x + offset, y + offset, drawWidth, drawHeight);
    }
    context.globalAlpha = 1;
    context.fillStyle = '#fffaf0';
    context.fillRect(x - 12, y - 12, drawWidth + 24, drawHeight + 24);
    context.drawImage(sample, x, y, drawWidth, drawHeight);

    const highlight = context.createLinearGradient(x, y, x + drawWidth, y + drawHeight);
    highlight.addColorStop(0, 'rgba(255,255,255,.13)');
    highlight.addColorStop(0.52, 'rgba(255,255,255,0)');
    highlight.addColorStop(1, 'rgba(49,23,65,.12)');
    context.fillStyle = highlight;
    context.fillRect(x, y, drawWidth, drawHeight);
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
  const [voxelPoster, setVoxelPoster] = useState('');
  const [pictureApproved, setPictureApproved] = useState(false);
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
  const mintReady = Boolean(savedDraft && paidSessionId && final3d?.modelUrl && String(final3d?.taskId || '').startsWith('local-v1:'));
  const step = savedDraft ? 6 : mapped ? 5 : pictureApproved ? 4 : paidSessionId ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', 'PICTURE', 'VOXEL', 'WORLD', 'MINT'];
  const mintHref = useMemo(() => {
    if (!mintReady) return '';
    const params = new URLSearchParams({
      saved: savedDraft.id,
      creation: draftId,
      task: final3d.taskId,
      generation_session: paidSessionId,
    });
    return `/property/mint?${params.toString()}`;
  }, [mintReady, savedDraft, draftId, final3d?.taskId, paidSessionId]);

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
      setRightsConfirmed(Boolean(paidSessionId));
      setVoxelPoster('');
      setPictureApproved(false);
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setBuilding(null);
      setAtlasBuildings([]);
      setMappedAddress('');
      setSavedDraft(null);
      setMessage(paidSessionId
        ? 'Payment is already verified. Create a new 3D picture from this photo—there is no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function startPictureBuild(photo) {
    if (!photo) return;
    setBusy('picture');
    setVoxelPoster('');
    setPictureApproved(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('Creating the VoxelPop 3D picture first…');
    try {
      const poster = await createVoxelPoster(photo);
      setVoxelPoster(poster);
      setMessage('3D picture ready. Check that it still looks like your building before creating the movable voxel.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The 3D picture could not be created.'));
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
      setMessage('Checkout canceled. Nothing was created or charged. Your photo is still on this device if you want to try again.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your photo and creating the 3D picture…');

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
          setMessage('Payment is verified. Choose the same property photo again; you will not be charged again.');
          return;
        }
        setPendingPhoto(photo);
        setPendingPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo);
        });
        setRightsConfirmed(true);
        await startPictureBuild(photo);
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

  async function payAndCreatePicture() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      if (paidSessionId) {
        await startPictureBuild(pendingPhoto);
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, you will see the 3D picture before any voxel is built.`);
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

  function approvePictureAndBuildVoxel() {
    if (!voxelPoster || !pendingPreview) return setMessage('Create the 3D picture first.');
    setPictureApproved(true);
    setFinal3d({ status: 'IN_PROGRESS', progress: 55, modelUrl: null, taskId: null });
    setBusy('local-3d');
    setMessage('Picture approved. Building the movable voxel from the original house photo…');
  }

  async function registerLocalRecipe(recipe) {
    const response = await fetch('/api/property-local-voxel', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ draftId, recipe }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local voxel could not be linked to your account.');
    return data;
  }

  const handleLocal3DReady = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !draftId || !pictureApproved) return;
    setLocalRecipe(recipe);
    setBusy('register');
    setFinal3d((current) => ({ ...current, status: 'IN_PROGRESS', progress: 92 }));
    try {
      const data = await registerLocalRecipe(recipe);
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null });
      setMessage('Voxel ready. Enter the property address to place this creation on the correct real-world map location.');
    } catch {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage('The movable voxel works on this device. Continue to the address; the account model link can be retried before minting.');
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token, pictureApproved]);

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
        ? 'Matched. The map is using a source-backed building footprint for location/shape context.'
        : 'Location matched. An exact source-backed footprint was not available, so the map shows the verified location reference.');
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
        fidelity: 'photo-reviewed-local-voxel',
        visual: {
          ...(base.visual || {}),
          modelUrl: final3d?.modelUrl || null,
          modelTaskId: final3d?.taskId || null,
          thumbnailUrl: null,
          renderMode: 'photo-reviewed-local-voxel',
        },
        voxelpop: {
          paidCreation: true,
          priceCents: CREATION_PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v3',
          sourcePhotoStoredByVoxelVault: false,
          pictureReviewedBeforeVoxel: true,
          photoMatchedFront: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          paymentSessionId: paidSessionId,
          modelTaskId: final3d?.taskId || null,
          modelUrl: final3d?.modelUrl || null,
        },
        blockchain: { ...(base.blockchain || {}), minted: false, optional: true, network: null, tokenId: null },
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
        ? 'Saved. The digital voxel is in My World and your Vault. Minting is the optional next step.'
        : 'Saved on this device. You can continue; account sync can retry later.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This 3D property could not be saved yet.'));
    } finally {
      setBusy('');
    }
  }

  async function reconnectVoxelForMint() {
    if (!localRecipe) return setMessage('Rebuild the voxel before reconnecting it for minting.');
    setBusy('register');
    setMessage('Reconnecting the finished voxel so it can be minted safely…');
    try {
      const data = await registerLocalRecipe(localRecipe);
      const next3d = { status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null };
      setFinal3d(next3d);
      if (savedDraft) {
        const nextDraft = savePropertyDraft({
          ...savedDraft,
          visual: { ...(savedDraft.visual || {}), modelUrl: next3d.modelUrl, modelTaskId: next3d.taskId, renderMode: 'photo-reviewed-local-voxel' },
          voxelpop: { ...(savedDraft.voxelpop || {}), modelUrl: next3d.modelUrl, modelTaskId: next3d.taskId },
        });
        setSavedDraft(nextDraft);
        try {
          const client = clientRef.current || await getSupabaseBrowserAsync();
          if (session?.user) await savePropertyDraftToAccount(client, session.user, nextDraft);
        } catch {}
      }
      setMessage('Voxel link restored. Mint digital voxel is ready.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The voxel link is still unavailable.'));
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
    setPictureApproved(false);
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
      <div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing charges before sign-in.</small></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>One account keeps your paid creations, Vault, My World items, and optional digital NFT mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>A wallet is not needed until you choose Mint at the end.</small>
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
      <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>Choose your house photo.</p>
        <p className={styles.flowHint}>Photo → pay $4.99 → review 3D picture → build voxel → map/save → mint.</p>
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>Use a clear front or three-quarter view</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
        <p className={styles.truth}>The clearer and more centered the building is, the closer the visible facade can match. One photo cannot reveal unseen sides or exact dimensions.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Pay once.</p>
        <p className={styles.stepCopy}>Your $4.99 unlocks the full digital creation flow. You see the 3D picture first, approve it, then create the movable voxel. No second creation charge.</p>
        <div className={`${styles.heroCard} ${styles.pictureCard}`}><img src={pendingPreview} alt="Selected house reference"/><span className={styles.badge}>YOUR HOUSE PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreatePicture} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : `Pay ${CREATION_PRICE_LABEL} → Create 3D picture`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>This purchase is for one digital VoxelPop creation. It does not purchase the physical property or create deed/title, rent, investment, or occupancy rights.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>{voxelPoster ? 'Does this look like your house?' : 'Creating your 3D picture.'}</p>
        <p className={styles.stepCopy}>{voxelPoster
          ? 'Review the picture before VoxelPop creates any movable voxel. The full photo proportions are preserved instead of forcing the house into a square crop.'
          : 'Your payment is verified. VoxelPop is building the picture on this device without Meshy credits.'}</p>
        {voxelPoster ? <div className={`${styles.heroCard} ${styles.pictureCard}`}><img src={voxelPoster} alt="VoxelPop 3D picture for review"/><span className={styles.badge}>3D PICTURE · REVIEW FIRST</span></div> : pendingPreview ? <div className={`${styles.heroCard} ${styles.pictureCard}`}><img src={pendingPreview} alt="House photo waiting for 3D picture"/><span className={styles.badge}>PAYMENT VERIFIED</span>{busy === 'picture' ? <div className={styles.buildPulse}/> : null}</div> : null}
        {voxelPoster ? <div className={styles.choicePanel}>
          <button className={styles.primaryTeal} type="button" onClick={approvePictureAndBuildVoxel}>Looks like my house → Create 3D voxel</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Not close enough · use another photo</button>
          <small>No extra charge for choosing another photo for this verified creation.</small>
        </div> : <div className={styles.choicePanel}>
          <b>PAYMENT VERIFIED</b>
          <span>{pendingPhoto ? 'Create the 3D picture now.' : 'Choose the house photo again. You will not be charged again.'}</span>
          {pendingPhoto ? <button className={styles.primaryPurple} type="button" onClick={() => startPictureBuild(pendingPhoto)} disabled={busy === 'picture'}>{busy === 'picture' ? 'Creating picture…' : 'Create 3D picture · already paid'}</button> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button>}
        </div>}
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>{localReady ? 'Your voxel is ready.' : 'Creating the movable voxel.'}</p>
        <p className={styles.stepCopy}>{localReady
          ? 'Drag it and pinch to zoom. The voxel is sampled from the original house photo—not the decorative picture—so the visible building shape and proportions stay as faithful as this local method can make them.'
          : 'VoxelPop is turning the approved house picture into movable voxel geometry now.'}</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{localReady ? 'MOVABLE 3D VOXEL' : 'CREATING VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {localReady ? <form className={styles.searchForm} onSubmit={mapBuilding}>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Add address → match map'}</button>
        </form> : <div className={styles.autoPanel}><b>PICTURE APPROVED</b><span>The movable voxel is the next distinct step. No second payment and no Meshy credits.</span></div>}
        <p className={styles.truth}>The photo controls the visible facade. The map step adds source-backed location/footprint context; it does not invent unseen architecture.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Put it in your world.</p>
        <p className={styles.stepCopy}>Your digital voxel is complete. The address anchors it to the mapped property context; save it before choosing whether to mint the digital voxel.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED MAP FOOTPRINT' : 'VERIFIED MAP LOCATION'}</span></div>
        {voxelPoster ? <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelPoster} alt="VoxelPop house picture"/></div> : null}
        <section className={styles.donePanel}>
          <b>{mappedAddress}</b>
          <span>{building?.geometry ? 'Mapped building footprint found.' : 'Location found; an exact source-backed building footprint was not available.'}</span>
          <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save voxel to My World'}</button>
          <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
        </section>
        <p className={styles.truth}>Saving is included in the $4.99 creation. No collectible purchase is required to finish this flow.</p>
      </> : null}

      {step === 6 ? <>
        <p className={styles.bigPrompt}>Created. Saved. Mint if you want.</p>
        <p className={styles.stepCopy}>The digital creation is finished. Minting turns this voxel into a VoxelFlip NFT on Base; it does not turn the NFT into a deed or real-property ownership.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · SAVED</span></div>
        <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>{savedDraft?.label || mappedAddress}</b>
          <span>3D picture reviewed · movable voxel created · map saved.</span>
          {mintReady ? <a className={styles.primaryLink} href={mintHref}>Mint digital voxel →</a> : <button className={styles.primaryPurple} type="button" onClick={reconnectVoxelForMint} disabled={busy === 'register'}>{busy === 'register' ? 'Reconnecting voxel…' : 'Reconnect voxel for mint'}</button>}
          <a className={styles.secondaryLink} href="/world">View My World</a>
          <a className={styles.textLink} href="/vault/property-drafts">Open My Vault</a>
          <button className={styles.textButton} type="button" onClick={resetCreation}>Create another</button>
        </section>
        <p className={styles.truth}>Minting here is for the digital voxel/NFT only. Real-property title, ownership verification, Property Passport, rent, or investment rights remain separate processes.</p>
      </> : null}

      {step > 1 && step < 6 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with a new creation</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
