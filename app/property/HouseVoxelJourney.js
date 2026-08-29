'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const PRICE = '$4.99';
const PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const emptyImage = () => ({ status: 'NOT_STARTED', progress: 0, imageUrl: null, taskId: null, taskToken: null });
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, thumbnailUrl: null, taskId: null });
const emptyPropertyLock = () => ({ identityKey: '', atlasId: '', address: '' });

function clean(value) { return String(value || '').trim(); }
function terminal(value) {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(String(value || '').toUpperCase());
}
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
function previewUrl(modelUrl) {
  const value = clean(modelUrl);
  if (!value) return '';
  return `${value}${value.includes('?') ? '&' : '?'}preview=1`;
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
  if (!draftId || !file) return;
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
    request.onerror = () => reject(request.error || new Error('Photo could not be kept on this device.'));
  });
  db.close();
}

async function loadDevicePhoto(draftId) {
  if (!draftId) return null;
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

function writeContext(draftId, propertyAddress, propertyLock) {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    window.localStorage.setItem(`${CONTEXT_PREFIX}${draftId}`, JSON.stringify({
      propertyAddress: clean(propertyAddress),
      propertyLock: propertyLock || null,
    }));
  } catch {}
}

function readContext(draftId) {
  if (typeof window === 'undefined' || !draftId) return null;
  try { return JSON.parse(window.localStorage.getItem(`${CONTEXT_PREFIX}${draftId}`) || 'null'); } catch { return null; }
}

async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This HEIC photo could not be opened. Try a screenshot of it instead.'));
    });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo conversion is unavailable on this device.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
    if (!blob) throw new Error('Photo conversion failed.');
    return new File([blob], String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HouseVoxelJourney() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyLock, setPropertyLock] = useState(emptyPropertyLock);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [voxelImage, setVoxelImage] = useState(emptyImage);
  const [final3d, setFinal3d] = useState(empty3d);
  const [savedDraft, setSavedDraft] = useState(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);
  const checkoutHandledRef = useRef('');
  const pipelineRef = useRef(0);

  const finalReady = final3d.status === 'SUCCEEDED' && Boolean(final3d.taskId && final3d.modelUrl);
  const voxelReady = Boolean(voxelImage.imageUrl);
  const generationStarted = Boolean(paidSessionId && (voxelImage.taskId || final3d.taskId || busy === 'pipeline' || generationFailed));
  const step = finalReady ? 5 : voxelReady ? 4 : generationStarted ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'DONE'];

  const setPreviewFromFile = useCallback((photo) => {
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return photo ? URL.createObjectURL(photo) : '';
    });
  }, []);

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
        setMessage('Choose one house photo.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Choose one house photo.');
        } else setMessage('Sign in to start.');
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in is unavailable on this deployment.');
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

  async function pollVoxelImage(started, iteration) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2500);
      if (iteration !== pipelineRef.current) throw new Error('Creation changed.');
      const params = new URLSearchParams({ taskId: started.taskId, taskToken: started.taskToken });
      const response = await fetch(`/api/property-voxel-image?${params.toString()}`, {
        cache: 'no-store',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The voxel image could not be created.');
      const next = { ...started, ...data, taskToken: started.taskToken };
      setVoxelImage(next);
      if (data?.imageUrl) return next;
      if (terminal(data?.status)) throw new Error(data?.error || `Voxel image ended with ${data?.status}.`);
      setMessage(Number(data?.progress) > 0 ? `Building the voxel image… ${Math.round(Number(data.progress))}%` : 'Building the voxel image…');
    }
    throw new Error('The voxel image is taking longer than expected. Retry this paid creation shortly.');
  }

  async function pollFinal3D(taskId, iteration) {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      await wait(attempt === 0 ? 1500 : 3000);
      if (iteration !== pipelineRef.current) throw new Error('Creation changed.');
      const response = await fetch(`/api/property-voxel-3d?taskId=${encodeURIComponent(taskId)}`, {
        cache: 'no-store',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The final 3D voxel could not be read.');
      setFinal3d(data);
      if (data?.modelUrl) return { ...data, status: 'SUCCEEDED', progress: 100 };
      if (terminal(data?.status)) throw new Error(data?.error || `3D voxel ended with ${data?.status}.`);
      setMessage(Number(data?.progress) > 0 ? `Building the movable 3D voxel… ${Math.round(Number(data.progress))}%` : 'Building the movable 3D voxel…');
    }
    throw new Error('The 3D voxel is taking longer than expected. Retry this paid creation shortly.');
  }

  async function saveFinishedVoxel({ activeDraftId, finalDone, voxelDone, lock }) {
    const now = new Date().toISOString();
    const savedAddress = clean(lock?.address || propertyAddress);
    const stablePreview = previewUrl(finalDone.modelUrl);
    const finishedDraft = {
      schemaVersion: 1,
      type: 'voxel-vault-property-3d-draft',
      id: `voxelpop:${activeDraftId}`,
      label: savedAddress ? savedAddress.split(',')[0] : 'My VoxelPop House',
      createdAt: now,
      updatedAt: now,
      state: 'saved',
      fidelity: 'photo-to-voxel-image-to-3d',
      geometryKind: 'digital-only',
      coordinates: { latitude: null, longitude: null },
      geometry: null,
      propertyIdentity: { atlasId: clean(lock?.atlasId) || null, parcelId: null, pin: null, sbl: null },
      evidence: {},
      visual: {
        modelUrl: finalDone.modelUrl,
        modelTaskId: finalDone.taskId,
        thumbnailUrl: stablePreview,
        renderMode: 'voxelpop-meshy-3d',
      },
      voxelpop: {
        paidCreation: true,
        priceCents: PRICE_CENTS,
        engine: 'voxelpop-direct-photo-voxel-v1',
        sourcePhotoStoredByVoxelVault: false,
        sourcePhotoRetainedOnDevice: false,
        creationDraftId: activeDraftId,
        voxelImageTaskId: voxelDone.taskId,
        modelTaskId: finalDone.taskId,
        modelUrl: finalDone.modelUrl,
        identityKey: clean(lock?.identityKey) || null,
        atlasId: clean(lock?.atlasId) || null,
        propertyAddress: savedAddress || null,
        onePropertyOnePurchase: true,
        onePropertyOneMint: true,
      },
      blockchain: { minted: false, optional: true, optionalAfterCreation: true, onePropertyOneMint: true },
      world: { address: savedAddress || null, public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
      legal: {
        titleVerified: false,
        ownershipRightsCreatedByDraft: false,
        ownershipRightsCreatedByMint: false,
        note: 'This VoxelPop is a digital creation only. Saving or minting it does not create physical-property ownership rights.',
      },
    };

    const localSaved = savePropertyDraft(finishedDraft);
    setSavedDraft(localSaved);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      if (session?.user) await savePropertyDraftToAccount(client, session.user, localSaved);
    } catch {}
    return localSaved;
  }

  async function startDirectBuild({ photo, activeDraftId, generationSessionId, lock }) {
    if (!photo || !activeDraftId || !generationSessionId || !session?.access_token) return;
    const iteration = ++pipelineRef.current;
    setGenerationFailed(false);
    setBusy('pipeline');
    setVoxelImage(emptyImage());
    setFinal3d(empty3d());
    try {
      setMessage('Turning your house photo into a voxel image…');
      const form = new FormData();
      form.append('generationSessionId', generationSessionId);
      form.append('draftId', activeDraftId);
      form.append('rightsConfirmed', 'true');
      form.append('photo', photo);
      const imageResponse = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
      const imageStart = await imageResponse.json().catch(() => ({}));
      if (!imageResponse.ok || !imageStart?.ok || !imageStart?.voxelImage?.taskId || !imageStart?.voxelImage?.taskToken) {
        throw new Error(imageStart?.error || 'The voxel image could not start.');
      }
      const started = imageStart.voxelImage;
      setVoxelImage(started);
      const voxelDone = await pollVoxelImage(started, iteration);
      if (iteration !== pipelineRef.current) return;

      setMessage('Voxel image ready. Building the movable 3D voxel…');
      const finalResponse = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          draftId: activeDraftId,
          phase: 'voxel',
          voxelImageTaskId: voxelDone.taskId,
          voxelImageTaskToken: voxelDone.taskToken,
        }),
      });
      const finalStart = await finalResponse.json().catch(() => ({}));
      if (!finalResponse.ok || !finalStart?.ok || !finalStart?.taskId) throw new Error(finalStart?.error || 'The final 3D voxel could not start.');
      setFinal3d(finalStart);
      const finalDone = finalStart.modelUrl
        ? { ...finalStart, status: 'SUCCEEDED', progress: 100 }
        : await pollFinal3D(finalStart.taskId, iteration);
      if (iteration !== pipelineRef.current) return;
      setFinal3d(finalDone);

      const verifiedLock = {
        identityKey: clean(imageStart.identityKey || lock?.identityKey),
        atlasId: clean(imageStart.atlasId || lock?.atlasId),
        address: clean(imageStart.propertyAddress || lock?.address || propertyAddress),
      };
      setPropertyLock(verifiedLock);
      if (verifiedLock.address) setPropertyAddress(verifiedLock.address);
      await saveFinishedVoxel({ activeDraftId, finalDone, voxelDone, lock: verifiedLock });
      await removeDevicePhoto(activeDraftId);
      setPendingPhoto(null);
      setPreviewFromFile(null);
      setGenerationFailed(false);
      setMessage('Done. Your 3D voxel is in your Vault and ready to mint.');
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
    } catch (error) {
      if (iteration === pipelineRef.current) {
        setGenerationFailed(true);
        setMessage(String(error?.message || error || 'The paid voxel build stopped. Your purchase is still tied to this property, so you can retry without paying again.'));
      }
    } finally {
      if (iteration === pipelineRef.current) setBusy('');
    }
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('prepare');
    setMessage('Preparing your photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This photo is still too large. Try a screenshot or smaller version.');
      setPendingPhoto(photo);
      setPreviewFromFile(photo);
      setGenerationFailed(false);

      if (paidSessionId && draftId) {
        await saveDevicePhoto(draftId, photo).catch(() => {});
        setRightsConfirmed(true);
        setAddressConfirmed(Boolean(propertyAddress));
        setMessage('Paid creation recovered. Building your voxel image…');
        const lock = { ...propertyLock, address: clean(propertyLock.address || propertyAddress) };
        setBusy('');
        await startDirectBuild({ photo, activeDraftId: draftId, generationSessionId: paidSessionId, lock });
        return;
      }

      setPropertyAddress('');
      setPropertyLock(emptyPropertyLock());
      setAddressConfirmed(false);
      setRightsConfirmed(false);
      setVoxelImage(emptyImage());
      setFinal3d(empty3d());
      setSavedDraft(null);
      setMessage('Photo ready. Enter and confirm the property address.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      if (!paidSessionId) setBusy('');
    }
  }

  async function confirmAddress() {
    const address = clean(propertyAddress);
    if (!address || !session?.access_token || busy) return;
    setBusy('address');
    setMessage('Confirming the property address…');
    try {
      const response = await fetch('/api/property-identity', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.available || !data?.atlasId || !data?.identityKey) throw new Error(data?.error || 'That address could not be confirmed.');
      const lock = { identityKey: clean(data.identityKey), atlasId: clean(data.atlasId), address: clean(data.address || address) };
      setPropertyLock(lock);
      setPropertyAddress(lock.address);
      setAddressConfirmed(true);
      setMessage('Address confirmed. Create this one-of-one voxel when ready.');
    } catch (error) {
      setPropertyLock(emptyPropertyLock());
      setAddressConfirmed(false);
      setMessage(String(error?.message || error || 'Property confirmation failed.'));
    } finally {
      setBusy('');
    }
  }

  async function verifyPaidSession(generationSessionId) {
    const form = new FormData();
    form.append('generationSessionId', generationSessionId);
    const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || data?.paid !== true || !data?.draftId) throw new Error(data?.error || 'Your paid VoxelPop creation could not be verified.');
    return data;
  }

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId || busy) return;
    if (!addressConfirmed || !clean(propertyLock.identityKey) || !clean(propertyLock.atlasId)) return setMessage('Confirm the property address first.');
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      writeContext(draftId, propertyAddress, propertyLock);
      setMessage('Checking the one-of-one property lock…');
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      form.append('address', propertyAddress);
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'VoxelPop checkout could not start.'));
    }
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
      const context = readContext(canceledDraftId);
      setDraftId(canceledDraftId);
      if (context?.propertyAddress) setPropertyAddress(clean(context.propertyAddress));
      if (context?.propertyLock) {
        setPropertyLock(context.propertyLock);
        setAddressConfirmed(Boolean(context.propertyLock.identityKey && context.propertyLock.atlasId));
      }
      loadDevicePhoto(canceledDraftId).then((photo) => {
        if (photo) { setPendingPhoto(photo); setPreviewFromFile(photo); }
      }).catch(() => {});
      setMessage('Checkout canceled. Nothing was charged.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Confirming the one-of-one property lock…');
    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        const context = readContext(data.draftId);
        const lock = {
          identityKey: clean(data.identityKey || context?.propertyLock?.identityKey),
          atlasId: clean(data.atlasId || context?.propertyLock?.atlasId),
          address: clean(data.propertyAddress || context?.propertyAddress || context?.propertyLock?.address),
        };
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        setPropertyLock(lock);
        setPropertyAddress(lock.address);
        setAddressConfirmed(true);
        setRightsConfirmed(true);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setBusy('');
          setMessage('Payment is confirmed. Choose the same house photo again—there is no second charge.');
          return;
        }
        setPendingPhoto(photo);
        setPreviewFromFile(photo);
        setBusy('');
        await startDirectBuild({ photo, activeDraftId: data.draftId, generationSessionId, lock });
      } catch (error) {
        if (active) {
          checkoutHandledRef.current = '';
          setBusy('');
          setMessage(String(error?.message || error || 'Your paid creation could not start.'));
        }
      }
    })();
    return () => { active = false; };
  }, [session?.access_token, setPreviewFromFile]);

  async function retryPaidBuild() {
    if (!paidSessionId || !draftId || busy) return;
    const photo = pendingPhoto || await loadDevicePhoto(draftId).catch(() => null);
    if (!photo) {
      setMessage('Choose the same house photo again. You will not be charged twice.');
      choosePhoto();
      return;
    }
    setPendingPhoto(photo);
    if (!pendingPreview) setPreviewFromFile(photo);
    await startDirectBuild({ photo, activeDraftId: draftId, generationSessionId: paidSessionId, lock: propertyLock });
  }

  function changeAddress() {
    setAddressConfirmed(false);
    setPropertyLock(emptyPropertyLock());
    setMessage('Edit the address, then confirm it again.');
  }

  function resetCreation() {
    pipelineRef.current += 1;
    const oldDraft = draftId;
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPreviewFromFile(null);
    setPropertyAddress('');
    setPropertyLock(emptyPropertyLock());
    setAddressConfirmed(false);
    setRightsConfirmed(false);
    setPaidSessionId('');
    setVoxelImage(emptyImage());
    setFinal3d(empty3d());
    setSavedDraft(null);
    setGenerationFailed(false);
    setBusy('');
    setMessage('Choose one house photo.');
    removeDevicePhoto(oldDraft);
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>House photo.<br/>Voxel collectible.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Loading…</p></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>House photo.<br/>Voxel collectible.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in once.</p>
        <p className={styles.signinCopy}>Your finished 3D voxel saves to your Voxel Vault inventory.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Continue with Google'}</button>
        <small>You only need a wallet if you decide to mint after the voxel is finished.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  const mintName = savedDraft?.label || 'VoxelPop Property';
  const mintHref = finalReady
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(mintName)}&modelUrl=${encodeURIComponent(final3d.modelUrl)}`
    : '#';

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>House photo.<br/>Voxel collectible.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${step} of 5`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 5 · {labels[step - 1]}</p>
      <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>Choose a house photo.</p>
        <p className={styles.stepCopy}>One clear exterior photo is all you need to start.</p>
        <div className={styles.photoDrop} onClick={choosePhoto} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') choosePhoto(); }} role="button" tabIndex={0}>
          <div>+</div><b>Add house photo</b><span>JPG, PNG, WebP, HEIC and HEIF · up to 12 MB</span>
        </div>
      </> : null}

      {step === 2 && pendingPhoto ? <>
        <p className={styles.bigPrompt}>Confirm the address.</p>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected house"/><span className={styles.badge}>YOUR HOUSE PHOTO</span></div>
        <div className={styles.choicePanel}>
          {addressConfirmed ? <div className={styles.autoPanel}><b>✓ ADDRESS CONFIRMED</b><span>{propertyAddress}</span></div> : <div className={styles.searchForm}>
            <input
              value={propertyAddress}
              onChange={(event) => { setPropertyAddress(event.target.value); setAddressConfirmed(false); setPropertyLock(emptyPropertyLock()); }}
              placeholder="123 Main St, City, State"
              autoComplete="street-address"
              autoCapitalize="words"
              aria-label="Property address"
            />
            <button type="button" onClick={confirmAddress} disabled={!clean(propertyAddress) || busy === 'address'}>{busy === 'address' ? 'Confirming…' : 'Confirm address'}</button>
          </div>}
          {addressConfirmed ? <button className={styles.textButton} type="button" onClick={changeAddress}>Change address</button> : null}
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!addressConfirmed || !rightsConfirmed || Boolean(busy)}>{busy === 'checkout' ? 'Opening checkout…' : `Create voxel · ${PRICE}`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto} disabled={Boolean(busy)}>Use a different photo</button>
        </div>
        <p className={styles.truth}>The confirmed address gives this digital collectible a one-property identity. A property can only be purchased once and minted once. The voxel does not represent deed or title ownership.</p>
      </> : null}

      {generationStarted && !voxelReady && !finalReady ? <>
        <p className={styles.bigPrompt}>{generationFailed ? 'Build paused.' : 'Making the voxel image.'}</p>
        <p className={styles.stepCopy}>{generationFailed ? 'Your paid property lock is safe. Retry the same build without paying again.' : 'VoxelPop is translating the house photo into the block-style image that will drive the final 3D model.'}</p>
        {pendingPreview ? <div className={styles.heroCard}><img src={pendingPreview} alt="House source photo"/><span className={styles.badge}>PHOTO → VOXEL IMAGE</span>{!generationFailed ? <div className={styles.buildPulse}/> : null}</div> : null}
        {generationFailed ? <div className={styles.choicePanel}><button className={styles.primaryPurple} type="button" onClick={retryPaidBuild} disabled={Boolean(busy)}>Retry paid build</button><button className={styles.textButton} type="button" onClick={choosePhoto}>Choose same photo again</button></div> : null}
      </> : null}

      {voxelReady && !finalReady ? <>
        <p className={styles.bigPrompt}>{generationFailed ? '3D build paused.' : 'Now making it 3D.'}</p>
        <p className={styles.stepCopy}>The voxel image is finished. VoxelPop is turning that exact result into the movable 3D collectible.</p>
        <div className={`${styles.heroCard} ${styles.voxelPreview}`}><img src={voxelImage.imageUrl} alt="Generated voxel image of the house"/><span className={styles.badge}>VOXEL IMAGE · 3D NEXT</span>{!generationFailed ? <div className={styles.buildPulse}/> : null}</div>
        {generationFailed ? <div className={styles.choicePanel}><button className={styles.primaryPurple} type="button" onClick={retryPaidBuild} disabled={Boolean(busy)}>Retry paid build</button></div> : null}
      </> : null}

      {finalReady ? <>
        <div className={styles.autoPanel}><b>✓ SAVED TO YOUR VAULT</b><span>{propertyAddress}</span></div>
        <p className={styles.bigPrompt}>Your 3D voxel is ready.</p>
        <p className={styles.stepCopy}>Rotate it, keep it in your inventory, or mint the one allowed NFT for this property.</p>
        <div className={styles.heroCard}><MeshyModelViewer modelUrl={final3d.modelUrl}/><span className={styles.badge}>FINAL 3D VOXEL</span></div>
        <div className={styles.choicePanel}>
          <a className={styles.primaryLink} href="/vault/property-drafts">Open inventory</a>
          <a className={styles.secondaryLink} href={mintHref}>Mint this voxel</a>
          <span>Minting is optional. The 3D voxel is already saved to your Voxel Vault.</span>
        </div>
        <p className={styles.truth}>The NFT represents this digital voxel only. It does not create or transfer physical-property ownership, deed, title, occupancy, rent, or investment rights.</p>
      </> : null}

      {step > 1 && !finalReady ? <button className={styles.change} type="button" onClick={resetCreation} disabled={busy === 'pipeline'}>Start over</button> : null}
      {finalReady ? <button className={styles.change} type="button" onClick={resetCreation}>Create another house</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
