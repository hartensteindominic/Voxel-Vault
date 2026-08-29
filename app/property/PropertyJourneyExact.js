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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
    if (!blob) throw new Error('Photo conversion failed.');
    return new File([blob], String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
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

export default function PropertyJourneyExact() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [reuseDraft, setReuseDraft] = useState(null);
  const [reuseEntitled, setReuseEntitled] = useState(false);
  const [reusePreviewUnlocked, setReusePreviewUnlocked] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
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
  const reuseHandledRef = useRef('');
  const registeringRef = useRef(false);

  const localReady = final3d?.status === 'SUCCEEDED' && Boolean(final3d?.taskId && final3d?.modelUrl);
  const mintReady = localReady && String(final3d.taskId || '').startsWith('local-v1:');
  const creationIncluded = Boolean(paidSessionId || reuseEntitled);
  const stage = localReady ? 5 : previewApproved ? 4 : (paidSessionId || reusePreviewUnlocked) ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PREVIEW', 'VOXEL', 'MINT'];

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
        setMessage('Signed in. Choose the property photo you want the 3D preview to match.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose the property photo you want the 3D preview to match.');
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
    setReusePreviewUnlocked(false);
    setPreviewReady(false);
    setPreviewApproved(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setMessage(notice || (creationIncluded
      ? 'This creation is already paid. Confirm the picture, then open the 3D preview—no second charge.'
      : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}.`));
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
      setMessage('Checkout canceled. Nothing was created or charged. Your photo is still on this device.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your private photo for the 3D preview…');

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
          setMessage('Payment is verified. Choose the same property photo again. You will not be charged again.');
          return;
        }
        setPendingPhoto(photo);
        setPendingPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo);
        });
        setRightsConfirmed(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Payment verified. Loading the recognizable 3D photo preview first.');
        setBusy('');
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

        const entitled = source?.voxelpop?.paidCreation === true;
        setReuseDraft(source);
        setReuseEntitled(entitled);
        setReusePreviewUnlocked(false);
        setDraftId(newDraftId());
        if (clean(source?.label)) setAddress(clean(source.label));

        const deviceKey = clean(source?.voxelpop?.sourcePhotoDeviceKey || source?.voxelpop?.creationDraftId);
        const photo = deviceKey ? await loadDevicePhoto(deviceKey).catch(() => null) : null;
        if (!active) return;

        if (photo) {
          usePreparedPhoto(photo, {
            rights: true,
            notice: entitled
              ? `Loaded the property photo you already used for ${source.label || 'this property'}. Your paid creation is still valid: preview the 3D picture, then approve the 3D voxel.`
              : `Loaded the property photo you already used for ${source.label || 'this property'}. Confirm it, then create the 3D preview.`,
          });
        } else {
          setPendingPhoto(null);
          setPendingPreview('');
          setRightsConfirmed(false);
          setPreviewReady(false);
          setPreviewApproved(false);
          setVoxelPoster('');
          setLocalRecipe(null);
          setFinal3d(empty3d());
          setBuilding(null);
          setAtlasBuildings([]);
          setMappedAddress('');
          setSavedDraft(null);
          setMessage(entitled
            ? `Opened ${source.label || 'your saved property'}. The original private photo is no longer on this device, so add the picture again. Your existing $4.99 creation remains included.`
            : `Opened ${source.label || 'your saved or bought property'}. Add the property picture you want to use, then VoxelPop will show the 3D preview before creating the voxel.`);
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
      if (paidSessionId || reuseEntitled) {
        setReusePreviewUnlocked(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Creation access verified. Loading the 3D photo preview first—no second charge.');
        setBusy('');
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, you will see the 3D preview before any voxel is built.`);
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

  async function approvePreviewAndBuildVoxel() {
    if (!pendingPhoto || !previewReady) return;
    setPreviewApproved(true);
    setBusy('voxel-image');
    setMessage('3D preview approved. Now creating the separate VoxelPop voxel version…');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setFinal3d({ status: 'IN_PROGRESS', progress: 55, modelUrl: null, taskId: null });
      setBusy('voxel-3d');
      setMessage('VOXEL · Building the movable block model from the same house photo.');
    } catch (error) {
      setPreviewApproved(false);
      setBusy('');
      setMessage(String(error?.message || error || 'The voxel stage could not start.'));
    }
  }

  const registerVoxel = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !draftId || registeringRef.current) return;
    registeringRef.current = true;
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
      if (!response.ok || !data?.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The local voxel could not be linked to your account.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl, taskId: data.taskId });
      setMessage('Voxel 3D ready. You can mint this digital voxel now, or add its real address to My World.');
    } catch (error) {
      setFinal3d({ status: 'LOCAL_ONLY', progress: 100, modelUrl: null, taskId: null });
      setMessage(`${String(error?.message || error || 'The voxel is visible on this device, but account registration failed.')} Retry registration before minting.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  const handleLocal3DReady = useCallback((recipe) => {
    setLocalRecipe(recipe);
    registerVoxel(recipe);
  }, [registerVoxel]);

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching the finished voxel to the real mapped building and nearby neighborhood…');
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
        ? 'Matched. The finished voxel is now paired with the source-backed building footprint.'
        : 'Location matched. Exact source-backed footprint was unavailable, so only the verified location reference is used.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this finished voxel to My World…');
    try {
      const base = buildPropertyDraft({ building, fallbackLabel: mappedAddress, focusAuthority: clean(building?.source?.authority) });
      if (!base) throw new Error('This mapped property does not have enough location identity to save.');
      const draft = {
        ...base,
        state: 'saved',
        visual: {
          ...(base.visual || {}),
          thumbnailUrl: voxelPoster || null,
          modelUrl: final3d.modelUrl,
          modelTaskId: final3d.taskId,
          renderMode: 'voxelpop-local-3d',
        },
        voxelpop: {
          paidCreation: true,
          priceCents: CREATION_PRICE_CENTS,
          generationChargeCents: reuseEntitled && !paidSessionId ? 0 : CREATION_PRICE_CENTS,
          creationAccess: reuseEntitled && !paidSessionId ? 'existing-paid-creation' : 'paid-voxelpop-creation',
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoAvailableOnDevice: true,
          sourcePhotoDeviceKey: draftId,
          previewApproved: true,
          photoMatchedFront: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          reusedFromDraftId: reuseDraft?.id || null,
          modelTaskId: final3d.taskId,
          modelUrl: final3d.modelUrl,
        },
        world: { ...(base.world || {}), public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
        blockchain: { ...(base.blockchain || {}), minted: false, optionalAfterCreation: true },
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
      setMessage(synced
        ? 'Saved to My World and your Vault account. The private source photo stays on this device so this property can reuse it later.'
        : 'Saved to My World on this device. The private source photo stays available here; account sync can retry later.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This voxel could not be saved to My World yet.'));
    } finally {
      setBusy('');
    }
  }

  function resetCreation() {
    const oldDraft = draftId;
    const preservePhoto = Boolean(savedDraft);
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setPaidSessionId('');
    setReuseDraft(null);
    setReuseEntitled(false);
    setReusePreviewUnlocked(false);
    setPreviewReady(false);
    setPreviewApproved(false);
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
    if (!preservePhoto) removeDevicePhoto(oldDraft);
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Your house.<br/>Then your voxel.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing charges before sign-in.</small></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Your house.<br/>Then your voxel.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>Your paid creation, finished voxel, optional mint, Vault, and World stay tied to one account.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>No wallet is needed until you choose Mint.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  const mintHref = mintReady
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(mappedAddress || 'VoxelPop Property')}`
    : '#';

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Your house.<br/>Then your voxel.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${stage} of 5`}>{labels.map((label, index) => <span key={label} className={index + 1 <= stage ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {stage} OF 5 · {labels[stage - 1]}</p>
      <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

      {stage === 1 ? <>
        <p className={styles.bigPrompt}>{reuseDraft ? 'Add the property picture.' : 'Choose a clear house photo.'}</p>
        <p className={styles.flowHint}>{reuseDraft
          ? `${reuseDraft.label || 'Saved property'} → picture → 3D preview → approve → voxel 3D → optional mint.`
          : 'Photo → $4.99 → recognizable 3D preview → approve → voxel 3D → optional mint.'}</p>
        {reuseDraft ? <section className={styles.donePanel}><b>{reuseDraft.label || 'Your saved/bought property'}</b><span>{reuseEntitled ? 'Your earlier $4.99 creation is recognized. Add the photo again if the private original is no longer on this device.' : 'This property is loaded from your Vault. Add the picture you want VoxelPop to use for the custom 3D creation.'}</span></section> : null}
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>{reuseDraft ? 'Add property photo' : 'Choose a property photo'}</b><span>Front or three-quarter view works best · iPhone photos supported</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare' || busy === 'reuse'}>{busy === 'prepare' ? 'Preparing photo…' : reuseDraft ? 'Add property photo' : 'Choose photo'}</button>
        <p className={styles.truth}>The first 3D preview uses your actual photo so it stays recognizable. It is a front-view visual preview, not a claim that unseen sides are reconstructed exactly.</p>
      </> : null}

      {stage === 2 ? <>
        <p className={styles.bigPrompt}>{creationIncluded ? 'Your creation is ready to preview.' : 'Pay once. See the 3D first.'}</p>
        <p className={styles.stepCopy}>{creationIncluded
          ? 'Your existing paid creation includes the recognizable 3D preview and voxel build. The voxel does not start until after you see and approve the preview.'
          : 'The $4.99 creation unlocks the 3D preview and the voxel build. The voxel does not start until after you see and approve the preview.'}</p>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>{reuseDraft ? 'YOUR PROPERTY PICTURE · READY FOR 3D' : 'YOUR ACTUAL HOUSE PHOTO · DEVICE ONLY'}</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : creationIncluded ? 'Create 3D Preview · included' : `Pay ${CREATION_PRICE_LABEL} & Make 3D Preview`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>{reuseDraft && !reuseEntitled && reuseDraft?.commerce?.status === 'paid'
          ? 'A previously collected digital voxel is a separate item. A new custom photo-to-3D creation uses the normal $4.99 creation checkout; it does not buy the physical property.'
          : 'The $4.99 payment buys the digital creation only. It does not buy the physical house, deed/title, rent, occupancy, investment rights, or guaranteed value.'}</p>
      </> : null}

      {stage === 3 ? <>
        <p className={styles.bigPrompt}>This is the 3D picture first.</p>
        <p className={styles.stepCopy}>It uses the real photo as the textured front surface, so windows, doors, siding, roofline, and visible details stay tied to what you actually uploaded. Drag gently to see the 3D relief.</p>
        {!pendingPreview ? <section className={styles.donePanel}><b>PAYMENT VERIFIED</b><span>Choose the same photo again. You will not be charged again.</span><button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button></section> : <>
          <div className={styles.heroCard}>
            <PhotoReliefModelViewer imageUrl={pendingPreview} onReady={() => setPreviewReady(true)}/>
            <span className={styles.badge}>3D PHOTO PREVIEW · VOXEL NOT BUILT YET</span>
            {!previewReady ? <div className={styles.buildPulse}/> : null}
          </div>
          <div className={styles.choicePanel}>
            <b>{previewReady ? 'Does this look like the house in your photo?' : 'Building the recognizable 3D preview…'}</b>
            <button className={styles.primaryPurple} type="button" onClick={approvePreviewAndBuildVoxel} disabled={!previewReady || busy === 'voxel-image'}>{busy === 'voxel-image' ? 'Starting voxel…' : 'Looks right → Build the 3D Voxel'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different photo · no second charge</button>
          </div>
        </>}
        <p className={styles.truth}>This stage intentionally shows the source-faithful front first. VoxelPop does not pretend one photo proves the exact geometry of the hidden sides or back.</p>
      </> : null}

      {stage === 4 ? <>
        <p className={styles.bigPrompt}>Now build the 3D voxel.</p>
        <p className={styles.stepCopy}>This is a separate conversion step. The voxel renderer samples the same approved house photo instead of inventing a random generic building.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{final3d.status === 'LOCAL_ONLY' ? 'VOXEL VISIBLE · REGISTRATION NEEDS RETRY' : 'BUILDING PHOTO-MATCHED 3D VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {final3d.status === 'LOCAL_ONLY' && localRecipe ? <button className={styles.primaryPurple} type="button" onClick={() => registerVoxel(localRecipe)} disabled={busy === 'register'}>{busy === 'register' ? 'Registering…' : 'Retry voxel registration'}</button> : <div className={styles.autoPanel}><b>3D PREVIEW APPROVED → VOXEL</b><span>The original photo stays on this device. No Meshy credits are used for this local voxel build.</span></div>}
      </> : null}

      {stage === 5 ? <>
        <p className={styles.bigPrompt}>Voxel ready. Mint is next.</p>
        <p className={styles.stepCopy}>You have already seen the photo-faithful 3D preview and then created the voxel version. Minting is now a separate wallet action for the finished digital voxel.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster}/>
          <span className={styles.badge}>FINAL 3D VOXEL · READY TO MINT</span>
        </div>
        <div className={styles.choicePanel}>
          <a className={styles.primaryLink} href={mintHref}>Mint this digital voxel →</a>
          <span style={{fontSize:11,color:'#7b7068',lineHeight:1.5}}>Your wallet opens only now. You approve the Base transaction yourself; Voxel Vault does not auto-sign or auto-spend.</span>
        </div>

        <form className={styles.searchForm} onSubmit={mapBuilding}>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Optional: property address for My World" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Also match this voxel to the real map'}</button>
        </form>
        {building ? <>
          <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
          <section className={styles.donePanel}>
            <b>{mappedAddress}</b>
            <span>Map context is separate from the voxel image and from NFT ownership.</span>
            <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : savedDraft ? 'Saved to My World ✓' : 'Save to My World'}</button>
            {savedDraft ? <a className={styles.secondaryLink} href="/world">View My World</a> : null}
          </section>
        </> : null}
        <p className={styles.truth}>Minting creates a digital NFT for the finished voxel. It does not create or transfer deed/title, occupancy, rent, fractional investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {stage > 1 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
