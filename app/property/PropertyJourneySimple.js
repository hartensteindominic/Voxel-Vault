'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import {
  buildPropertyDraft,
  mergePropertyDraftRecords,
  readPropertyDraft,
  replaceLocalPropertyDrafts,
  savePropertyDraft,
} from '../../lib/property-drafts';
import { loadAccountPropertyDrafts, savePropertyDraftToAccount } from '../../lib/property-drafts-account';
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

async function imageReferenceToFile(reference, filename = 'property-reference.jpg') {
  const value = clean(reference);
  if (!value) return null;
  try {
    const response = await fetch(value, { cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!String(blob.type || '').startsWith('image/')) return null;
    return new File([blob], filename, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
  } catch {
    return null;
  }
}

async function createVoxelPoster(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The photo could not be opened for the voxel pass.'));
    });
    const sampleSize = 72;
    const sample = document.createElement('canvas');
    sample.width = sampleSize;
    sample.height = sampleSize;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('Voxel image processing is unavailable.');
    const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth || 1;
    let sh = image.naturalHeight || 1;
    if (sourceRatio > 1) { sw = sh; sx = ((image.naturalWidth || 1) - sw) / 2; }
    else if (sourceRatio < 1) { sh = sw; sy = ((image.naturalHeight || 1) - sh) / 2; }
    sampleContext.filter = 'saturate(1.06) contrast(1.05)';
    sampleContext.drawImage(image, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);
    const output = document.createElement('canvas');
    output.width = 864;
    output.height = 864;
    const context = output.getContext('2d');
    if (!context) throw new Error('Voxel image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ede7df';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(sample, 0, 0, output.width, output.height);
    const shade = context.createLinearGradient(0, 0, output.width, output.height);
    shade.addColorStop(0, 'rgba(255,255,255,.08)');
    shade.addColorStop(0.62, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.12)');
    context.fillStyle = shade;
    context.fillRect(0, 0, output.width, output.height);
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
  const [reuseDraft, setReuseDraft] = useState(null);
  const [reuseEntitled, setReuseEntitled] = useState(false);
  const [previewUnlocked, setPreviewUnlocked] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [voxelPoster, setVoxelPoster] = useState('');
  const [voxelBuildStarted, setVoxelBuildStarted] = useState(false);
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
  const reuseHandledRef = useRef('');

  const localReady = final3d?.status === 'SUCCEEDED';
  const mapped = Boolean(building && mappedAddress);
  const creationIncluded = Boolean(paidSessionId || reuseEntitled);
  const step = savedDraft ? 5 : mapped ? 4 : (voxelBuildStarted || localReady) ? 3 : previewUnlocked ? 2 : 1;
  const labels = ['PHOTO', '3D PREVIEW', '3D VOXEL', 'MAP', 'MY WORLD'];

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
        setMessage('Signed in. Choose one property photo, or open an owned property from your Vault.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose one property photo, or open an owned property from your Vault.');
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

  function usePreparedPhoto(photo, { rights = false, notice = '' } = {}) {
    setPendingPreview((current) => {
      if (current?.startsWith?.('blob:')) URL.revokeObjectURL(current);
      return URL.createObjectURL(photo);
    });
    setPendingPhoto(photo);
    setRightsConfirmed(rights);
    setPreviewUnlocked(false);
    setPreviewReady(false);
    setVoxelPoster('');
    setVoxelBuildStarted(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage(notice || (creationIncluded
      ? 'Photo ready. Create the 3D picture first—there is no second charge for this owned/paid property.'
      : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL} to create the 3D picture.`));
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
      usePreparedPhoto(photo, { rights: false });
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function startLocalBuild(photo) {
    if (!photo) return;
    setBusy('local-build');
    setPreviewReady(false);
    setPreviewUnlocked(true);
    setVoxelPoster('');
    setVoxelBuildStarted(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage('Opening the interactive 3D picture from your actual property photo…');
    setBusy('');
  }

  async function startVoxelBuild() {
    if (!pendingPhoto || !previewReady) return setMessage('Wait for the 3D picture to finish, then approve it.');
    setBusy('voxel-image');
    setMessage('3D picture approved. Creating the separate voxel version from the same property photo…');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setVoxelBuildStarted(true);
      setLocalRecipe(null);
      setFinal3d({ status: 'IN_PROGRESS', progress: 72, modelUrl: null, taskId: null });
      setBusy('local-3d');
      setMessage('Building the movable photo-matched 3D voxel now. No Meshy credits are used.');
    } catch (error) {
      setVoxelBuildStarted(false);
      setBusy('');
      setMessage(String(error?.message || error || 'The voxel stage could not start.'));
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
          setMessage('Payment is verified. Choose the same property photo again; you will not be charged a second time.');
          return;
        }
        usePreparedPhoto(photo, { rights: true, notice: 'Payment verified. Reopening your photo and creating the 3D picture…' });
        await startLocalBuild(photo);
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

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined') return undefined;
    const reuseId = clean(new URLSearchParams(window.location.search).get('reuse'));
    if (!reuseId || reuseHandledRef.current === reuseId) return undefined;
    reuseHandledRef.current = reuseId;
    let active = true;

    (async () => {
      setBusy('reuse');
      setMessage('Opening this property from your Vault…');
      try {
        let source = readPropertyDraft(reuseId);
        if (!source) {
          const client = clientRef.current || await getSupabaseBrowserAsync();
          clientRef.current = client;
          const cloud = await loadAccountPropertyDrafts(client, session.user);
          const merged = mergePropertyDraftRecords(cloud);
          replaceLocalPropertyDrafts(merged);
          source = merged.find((item) => item.id === reuseId) || null;
        }
        if (!active) return;
        if (!source) throw new Error('That property is not in this signed-in Vault.');

        const entitled = source?.voxelpop?.paidCreation === true || source?.commerce?.status === 'paid';
        setReuseDraft(source);
        setReuseEntitled(entitled);
        setDraftId(newDraftId());
        if (clean(source?.label)) setAddress(clean(source.label));

        const deviceKey = clean(
          source?.voxelpop?.sourcePhotoDeviceKey
          || source?.voxelpop?.creationDraftId
          || source?.commerce?.generationDraftId,
        );
        let photo = deviceKey ? await loadDevicePhoto(deviceKey).catch(() => null) : null;
        let reusedOriginal = Boolean(photo);
        if (!photo) {
          const reference = source?.visual?.thumbnailUrl || source?.voxelpop?.thumbnailUrl || '';
          photo = await imageReferenceToFile(reference, 'owned-property-reference.jpg');
          reusedOriginal = false;
        }
        if (!active) return;

        if (photo) {
          usePreparedPhoto(photo, {
            rights: reusedOriginal,
            notice: reusedOriginal
              ? `Loaded the photo you already used for ${source.label || 'this property'}. Create the 3D picture, then the 3D voxel.`
              : `Loaded the saved picture for ${source.label || 'this property'}. Confirm permission, then create the 3D picture and 3D voxel.`,
          });
        } else {
          setPendingPhoto(null);
          setPendingPreview('');
          setRightsConfirmed(false);
          setPreviewUnlocked(false);
          setPreviewReady(false);
          setVoxelPoster('');
          setVoxelBuildStarted(false);
          setFinal3d(empty3d());
          setMessage(`Opened ${source.label || 'your saved property'}. Its original photo is no longer on this device, so add the photo you want to use. ${entitled ? 'Your owned/paid property will not be charged a second creation fee.' : ''}`.trim());
        }
      } catch (error) {
        reuseHandledRef.current = '';
        setMessage(String(error?.message || error || 'This property could not be reopened.'));
      } finally {
        if (active) setBusy('');
      }
    })();

    return () => { active = false; };
  }, [session?.user]);

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      if (creationIncluded) {
        await startLocalBuild(pendingPhoto);
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, your 3D picture starts automatically.`);
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
      setMessage('Your 3D voxel is ready. Check it, then match it to the property address.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage('Your 3D voxel is ready on this device. Enter the address to continue; Vault syncing can retry later.');
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching your 3D voxel to the mapped building and nearby neighborhood…');
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
        ? 'Matched. The map now uses the source-backed building footprint, so the property shape is grounded in real map geometry.'
        : 'Location matched. A source-backed footprint was not available, so the map is showing the verified location reference instead.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this 3D property to My World…');
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
        visual: {
          ...(base.visual || {}),
          thumbnailUrl: voxelPoster || null,
          modelUrl: final3d?.modelUrl || null,
          modelTaskId: final3d?.taskId || null,
          renderMode: 'photo-preview-to-local-voxel',
        },
        voxelpop: {
          paidCreation: true,
          priceCents: paidSessionId ? CREATION_PRICE_CENTS : (Number(reuseDraft?.voxelpop?.priceCents || reuseDraft?.commerce?.priceCents) || CREATION_PRICE_CENTS),
          generationChargeCents: paidSessionId ? CREATION_PRICE_CENTS : (reuseEntitled ? 0 : CREATION_PRICE_CENTS),
          creationAccess: reuseEntitled ? 'owned-vault-property' : 'paid-voxelpop-creation',
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoAvailableOnDevice: true,
          sourcePhotoDeviceKey: draftId,
          photoMatchedFront: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          reusedFromDraftId: reuseDraft?.id || null,
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
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
      setMessage(synced
        ? 'Saved. Your 3D property is in My World and your Vault account. The source photo stays private on this device so you can reuse it later.'
        : 'Saved to My World on this device. The source photo stays private on this device; account sync can retry later.');
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
    const preservePhoto = Boolean(savedDraft);
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current?.startsWith?.('blob:')) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setPaidSessionId('');
    setReuseDraft(null);
    setReuseEntitled(false);
    setPreviewUnlocked(false);
    setPreviewReady(false);
    setVoxelPoster('');
    setVoxelBuildStarted(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setSavedDraft(null);
    setBusy('');
    setMessage('Choose one property photo.');
    if (!preservePhoto) removeDevicePhoto(oldDraft);
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
        <small>A wallet is not needed to create the 3D.</small>
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
        <p className={styles.bigPrompt}>{reuseDraft ? 'Use this property picture.' : 'Choose the building photo.'}</p>
        <p className={styles.flowHint}>{reuseDraft
          ? `${reuseDraft.label || 'Owned property'} → picture → 3D picture → 3D voxel → map → My World.`
          : 'Photo → pay $4.99 once → 3D picture → approve → 3D voxel → map → My World.'}</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {!pendingPreview ? <>
          {reuseDraft ? <section className={styles.donePanel}><b>{reuseDraft.label || 'Your saved property'}</b><span>{reuseEntitled ? 'Owned/paid property loaded. Add the picture you want to turn into 3D; no second creation charge.' : 'Saved property loaded. Add the picture you want to turn into 3D.'}</span></section> : null}
          <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>{reuseDraft ? 'Add property photo' : 'Choose a property photo'}</b><span>iPhone photos supported</span></div>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare' || busy === 'reuse'}>{busy === 'prepare' ? 'Preparing photo…' : reuseDraft ? 'Add photo' : 'Choose photo'}</button>
        </> : <>
          <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>{reuseDraft ? 'REUSED / ADDED PROPERTY PICTURE' : 'YOUR BUILDING PHOTO · DEVICE ONLY'}</span></div>
          <div className={styles.choicePanel}>
            <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use this picture for the digital creation.</span></label>
            <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout' || busy === 'local-build'}>{busy === 'generation-checkout' ? 'Opening checkout…' : busy === 'local-build' ? 'Creating 3D picture…' : creationIncluded ? 'Create 3D Picture · included' : `Pay ${CREATION_PRICE_LABEL} & Create 3D Picture`}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different picture</button>
          </div>
        </>}
        <p className={styles.truth}>The picture is the visual reference, not proof of legal ownership. A saved original stays private on this device when available; it is not uploaded just to make the local 3D.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Check the 3D picture.</p>
        <p className={styles.stepCopy}>This preview keeps the property photo recognizable instead of immediately turning it into a rough voxel. Drag gently to see the 3D relief. If it looks right, create the movable 3D voxel next.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.heroCard}>
          <PhotoReliefModelViewer imageUrl={pendingPreview} onReady={() => { setPreviewReady(true); setMessage('3D picture ready. Check that it still looks like your property, then tap Create 3D Voxel.'); }}/>
          <span className={styles.badge}>INTERACTIVE 3D PICTURE · VOXEL NOT BUILT YET</span>
          {!previewReady ? <div className={styles.buildPulse}/> : null}
        </div>
        <div className={styles.choicePanel}>
          <b>{previewReady ? 'Does this 3D picture still look like your property?' : 'Building the recognizable 3D picture…'}</b>
          <button className={styles.primaryPurple} type="button" onClick={startVoxelBuild} disabled={!previewReady || busy === 'voxel-image' || busy === 'local-3d'}>{busy === 'voxel-image' || busy === 'local-3d' ? 'Starting 3D voxel…' : 'Looks right → Create 3D Voxel'}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Picture does not look right · change photo</button>
        </div>
        <p className={styles.truth}>This is a photo-matched 3D visual preview, not a survey or a perfect reconstruction of unseen sides. The next step makes the movable voxel model from the same source picture.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>{localReady ? 'Your 3D voxel is ready.' : 'Creating the 3D voxel.'}</p>
        <p className={styles.stepCopy}>{localReady
          ? 'Rotate the movable voxel and make sure it still resembles the building. Then match the address to the real source-backed map footprint.'
          : 'VoxelPop is building the movable photo-matched voxel locally from the same picture you approved. No Meshy credits are used.'}</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {pendingPreview && voxelPoster ? <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster} sourceImageUrl={pendingPreview} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{localReady ? 'PHOTO-MATCHED 3D VOXEL' : 'BUILDING LOCAL 3D VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div> : null}
        {localReady ? <form className={styles.searchForm} onSubmit={mapBuilding}>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Match voxel to this building'}</button>
        </form> : <div className={styles.autoPanel}><b>3D PICTURE APPROVED → 3D VOXEL</b><span>The voxel is built locally from your source picture. Your payment or owned-property access is already settled before this step.</span></div>}
        <p className={styles.truth}>The source picture helps the visible front appearance. The address adds source-backed footprint/location data. Unseen sides or dimensions are not claimed as exact.</p>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Matched to the real map.</p>
        <p className={styles.stepCopy}>Your 3D voxel is now paired with the selected property inside its nearby mapped neighborhood. Save it directly to My World.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
        {voxelPoster ? <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelPoster} alt="VoxelPop voxel preview"/></div> : null}
        <section className={styles.donePanel}>
          <b>{mappedAddress}</b>
          <span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; exact building footprint was not available from the map source.'}</span>
          <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save to My World'}</button>
          <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
        </section>
        <p className={styles.truth}>Saving is included in the creation flow. My World is a digital 3D collection, not a land-title registry.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Saved to My World.</p>
        <p className={styles.stepCopy}>Your picture → 3D picture → 3D voxel flow is complete. The private source photo remains on this device so this saved property can reuse it later.</p>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · SAVED</span></div>
        <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>{savedDraft?.label || mappedAddress}</b>
          <span>3D picture created · voxel created · map matched · saved. Optional minting can happen later from Vault; it is never required just to use the 3D.</span>
          <a className={styles.primaryLink} href="/world">View My World</a>
          <a className={styles.secondaryLink} href={`/vault/property-drafts/${encodeURIComponent(savedDraft?.id || '')}`}>Open this property</a>
          <button className={styles.textButton} type="button" onClick={resetCreation}>Create another</button>
        </section>
        <p className={styles.truth}>The digital creation does not create deed/title, ownership, occupancy, rent, fractional-investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {step > 1 && step < 5 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
