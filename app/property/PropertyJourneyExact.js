'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import VoxelPopHouseImageGenerator from './VoxelPopHouseImageGenerator';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import {
  buildPropertyDraft,
  mergePropertyDraftRecords,
  readPropertyDrafts,
  replaceLocalPropertyDrafts,
  savePropertyDraft,
} from '../../lib/property-drafts';
import { loadAccountPropertyDrafts, savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const CREATION_PRICE_LABEL = '$4.99';
const CREATION_PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const GENERATION_CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
const DEMO_PURCHASE_KEY = 'voxel-vault:property-slice-purchases';
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });

function clean(value) { return String(value || '').trim(); }
function newDraftId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `vp-${random.slice(0, 28)}`;
}
function propertyPhotoKey(id) { return `property:${String(id || '').slice(0, 220)}`; }
function isSavedPropertyDraft(value) { return value?.type === 'voxel-vault-property-3d-draft'; }
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
function buildingFromDraft(draft) {
  if (!isSavedPropertyDraft(draft)) return null;
  const latitude = Number(draft?.coordinates?.latitude);
  const longitude = Number(draft?.coordinates?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    atlasId: draft?.propertyIdentity?.atlasId || draft.id,
    latitude,
    longitude,
    geometry: draft.geometry || null,
    tags: { name: draft.label || 'Saved property' },
    source: {
      authority: draft?.evidence?.mapAuthority || null,
      license: draft?.evidence?.mapLicense || null,
      sourceUrl: draft?.evidence?.mapSourceUrl || null,
    },
    mappedIdentityReady: true,
  };
}
function readDemoProperty() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(DEMO_PURCHASE_KEY) || 'null');
    if (!raw?.lastPurchase?.selectedName) return null;
    return {
      id: `demo-slice:${clean(raw.lastPurchase.selectedName).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      type: 'voxel-vault-demo-property-slice',
      label: raw.lastPurchase.selectedName,
      demoOnly: true,
      demoPurchase: raw.lastPurchase,
    };
  } catch {
    return null;
  }
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

async function loadSavedPropertyPhoto(property) {
  if (!property?.id) return null;
  const stable = await loadDevicePhoto(propertyPhotoKey(property.id)).catch(() => null);
  if (stable) return stable;
  const originalDraftId = clean(property?.voxelpop?.creationDraftId);
  if (!originalDraftId) return null;
  return loadDevicePhoto(originalDraftId).catch(() => null);
}

function writeGenerationContext(draftId, selectedProperty) {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    window.localStorage.setItem(`${GENERATION_CONTEXT_PREFIX}${draftId}`, JSON.stringify({ selectedProperty: selectedProperty || null }));
  } catch {}
}
function readGenerationContext(draftId) {
  if (typeof window === 'undefined' || !draftId) return null;
  try {
    return JSON.parse(window.localStorage.getItem(`${GENERATION_CONTEXT_PREFIX}${draftId}`) || 'null');
  } catch {
    return null;
  }
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
  const [sourceMode, setSourceMode] = useState('photo');
  const [propertyChoices, setPropertyChoices] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [creationUnlocked, setCreationUnlocked] = useState(false);
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
  const registeringRef = useRef(false);

  const localReady = final3d?.status === 'SUCCEEDED' && Boolean(final3d?.taskId && final3d?.modelUrl);
  const mintReady = localReady && String(final3d.taskId || '').startsWith('local-v1:');
  const stage = localReady ? 5 : previewApproved ? 4 : creationUnlocked ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PREVIEW', 'VOXEL', 'MINT'];

  const setPreviewFromFile = useCallback((photo) => {
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return photo ? URL.createObjectURL(photo) : '';
    });
  }, []);

  const refreshPropertyChoices = useCallback(async (client, user) => {
    const local = readPropertyDrafts();
    let merged = local;
    try {
      const cloud = await loadAccountPropertyDrafts(client, user);
      merged = mergePropertyDraftRecords(cloud, local);
      replaceLocalPropertyDrafts(merged);
    } catch {}
    const demo = readDemoProperty();
    setPropertyChoices(demo ? [...merged, demo] : merged);
    return merged;
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
        setMessage('Signed in. Choose a new photo or reuse a property you already saved.');
        await refreshPropertyChoices(client, data.session.user);
      }
      const auth = client.auth.onAuthStateChange(async (_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose a new photo or reuse a property you already saved.');
          await refreshPropertyChoices(client, next.user);
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
  }, [refreshPropertyChoices]);

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

  function restoreMapFromProperty(property) {
    const mappedBuilding = buildingFromDraft(property);
    if (mappedBuilding) {
      setBuilding(mappedBuilding);
      setAtlasBuildings([mappedBuilding]);
      setMappedAddress(clean(property?.label));
      setAddress(clean(property?.label));
    } else {
      setBuilding(null);
      setAtlasBuildings([]);
      setMappedAddress('');
      setAddress(clean(property?.label));
    }
  }

  async function selectProperty(property) {
    if (!property) return;
    setBusy('reuse-photo');
    setSelectedProperty(property);
    setSourceMode('properties');
    setSavedDraft(null);
    setCreationUnlocked(false);
    setPreviewReady(false);
    setPreviewApproved(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    const alreadyPaid = Boolean(property?.voxelpop?.paidCreation);
    const existingDraftId = clean(property?.voxelpop?.creationDraftId);
    setDraftId(existingDraftId || newDraftId());
    setPaidSessionId(alreadyPaid ? 'saved-property' : '');
    restoreMapFromProperty(property);
    try {
      const photo = await loadSavedPropertyPhoto(property);
      if (photo) {
        await saveDevicePhoto(propertyPhotoKey(property.id), photo).catch(() => {});
        setPendingPhoto(photo);
        setPreviewFromFile(photo);
        setRightsConfirmed(false);
        setMessage(alreadyPaid
          ? 'Your saved property photo is ready to reuse. Confirm permission, then make the VoxelPop 3D house—no second creation charge.'
          : 'Your saved property photo is ready. Confirm permission, then continue to the VoxelPop 3D house.');
      } else {
        setPendingPhoto(null);
        setPreviewFromFile(null);
        setRightsConfirmed(false);
        setMessage(alreadyPaid
          ? 'This paid property is selected. Its older temporary photo is no longer on this device, so add the property photo once; you will not pay the creation charge again.'
          : 'This property is selected. Add its photo to create the VoxelPop 3D house and voxel.');
      }
    } finally {
      setBusy('');
    }
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
      setPreviewFromFile(photo);
      setPendingPhoto(photo);
      setRightsConfirmed(false);
      setCreationUnlocked(false);
      setPreviewReady(false);
      setPreviewApproved(false);
      setVoxelPoster('');
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setSavedDraft(null);
      restoreMapFromProperty(selectedProperty);
      setMessage(paidSessionId
        ? 'Payment is already verified. Confirm permission, then generate the VoxelPop 3D house—no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}.`);
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
      const context = readGenerationContext(canceledDraftId);
      if (context?.selectedProperty) {
        setSelectedProperty(context.selectedProperty);
        restoreMapFromProperty(context.selectedProperty);
      }
      setBusy('');
      setDraftId(canceledDraftId);
      loadDevicePhoto(canceledDraftId).then((photo) => {
        if (photo) {
          setPendingPhoto(photo);
          setPreviewFromFile(photo);
        }
      }).catch(() => {});
      setMessage('Checkout canceled. Nothing was created or charged. Your property photo is still on this device.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your private photo for the VoxelPop 3D house render…');

    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        const context = readGenerationContext(data.draftId);
        if (context?.selectedProperty) {
          setSelectedProperty(context.selectedProperty);
          restoreMapFromProperty(context.selectedProperty);
        }
        setPaidSessionId(generationSessionId);
        setCreationUnlocked(true);
        setDraftId(data.draftId);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setCreationUnlocked(false);
          setBusy('');
          setMessage('Payment is verified. Choose the same property photo again. You will not be charged again.');
          return;
        }
        if (context?.selectedProperty?.id) await saveDevicePhoto(propertyPhotoKey(context.selectedProperty.id), photo).catch(() => {});
        setPendingPhoto(photo);
        setPreviewFromFile(photo);
        setRightsConfirmed(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Payment verified. Generating your VoxelPop 3D house first.');
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
  }, [session?.access_token, setPreviewFromFile]);

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    let cachedOnDevice = false;
    try {
      try {
        await saveDevicePhoto(draftId, pendingPhoto);
        cachedOnDevice = true;
      } catch {}
      if (selectedProperty?.id) await saveDevicePhoto(propertyPhotoKey(selectedProperty.id), pendingPhoto).catch(() => {});
      writeGenerationContext(draftId, selectedProperty);
      if (paidSessionId) {
        setCreationUnlocked(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Payment already verified. Generating the VoxelPop 3D house—no second charge.');
        setBusy('');
        return;
      }
      setMessage(cachedOnDevice
        ? `Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, VoxelPop will generate the 3D house image before any voxel is built.`
        : `Opening secure ${CREATION_PRICE_LABEL} checkout. Your browser could not keep the photo through checkout, so after payment you may need to choose the same photo once. You will not be charged again.`);
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
    setMessage('VoxelPop 3D house approved. Creating your separate movable voxel…');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setFinal3d({ status: 'IN_PROGRESS', progress: 55, modelUrl: null, taskId: null });
      setBusy('voxel-3d');
      setMessage('Creating the 3D voxel from the approved VoxelPop house render…');
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

      const now = new Date().toISOString();
      const existing = isSavedPropertyDraft(selectedProperty) ? selectedProperty : null;
      const finishedDraft = {
        ...(existing || {}),
        schemaVersion: existing?.schemaVersion || 1,
        type: 'voxel-vault-property-3d-draft',
        id: existing?.id || `voxelpop:${draftId}`,
        label: existing?.label || 'My VoxelPop Property',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        state: 'saved',
        fidelity: 'photo-approved-local-voxel',
        geometryKind: existing?.geometryKind || 'digital-only',
        coordinates: existing?.coordinates || { latitude: null, longitude: null },
        geometry: existing?.geometry || null,
        propertyIdentity: existing?.propertyIdentity || { atlasId: null, parcelId: null, pin: null, sbl: null },
        evidence: existing?.evidence || {
          exactParcelLinkedBuilding: false,
          sourceBackedBuilding: false,
          authoritativeParcelBoundary: false,
          calibratedStories: null,
          calibratedVisualHeightMeters: null,
          openStreetPhotoCount: 0,
          reconstructionReferenceCount: 0,
          mapAuthority: null,
          mapLicense: null,
          mapSourceUrl: null,
          listingProvider: null,
        },
        visual: {
          ...(existing?.visual || {}),
          modelUrl: data.modelUrl,
          modelTaskId: data.taskId,
          renderMode: 'voxelpop-local-3d',
        },
        voxelpop: {
          ...(existing?.voxelpop || {}),
          paidCreation: true,
          priceCents: existing?.voxelpop?.priceCents || CREATION_PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoRetainedOnDevice: true,
          previewApproved: true,
          photoMatchedFront: true,
          mappedFootprintUsed: Boolean(existing?.geometry),
          creationDraftId: draftId,
          modelTaskId: data.taskId,
          modelUrl: data.modelUrl,
        },
        blockchain: {
          ...(existing?.blockchain || {}),
          minted: Boolean(existing?.blockchain?.minted),
          optional: true,
          optionalAfterCreation: true,
          tokenId: existing?.blockchain?.tokenId || null,
          network: existing?.blockchain?.network || null,
        },
        world: {
          ...(existing?.world || {}),
          public: false,
          publishedAt: null,
          publicLabel: 'VoxelPop Property',
        },
        legal: {
          ...(existing?.legal || {}),
          titleVerified: Boolean(existing?.legal?.titleVerified),
          ownershipRightsCreatedByDraft: false,
          ownershipRightsCreatedByMint: false,
          note: 'This saved VoxelPop 3D is a digital creation only. Saving or minting it does not transfer deed/title, investment, rent, occupancy, or guaranteed-value rights.',
        },
      };

      const localSaved = savePropertyDraft(finishedDraft);
      setSelectedProperty(localSaved);
      setSavedDraft(localSaved);
      if (pendingPhoto) await saveDevicePhoto(propertyPhotoKey(localSaved.id), pendingPhoto).catch(() => {});

      let synced = false;
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) {
          await savePropertyDraftToAccount(client, session.user, localSaved);
          synced = true;
          await refreshPropertyChoices(client, session.user);
        }
      } catch {}

      setMessage(synced
        ? 'Your 3D voxel is ready and saved to Vault. Mint it now or keep it for later.'
        : 'Your 3D voxel is ready and saved on this device. Mint it now or later; account sync can retry from Vault.');
    } catch (error) {
      setFinal3d({ status: 'LOCAL_ONLY', progress: 100, modelUrl: null, taskId: null });
      setMessage(`${String(error?.message || error || 'The voxel is visible on this device, but account registration failed.')} Retry registration before minting.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [draftId, session?.access_token, session?.user, selectedProperty, pendingPhoto, refreshPropertyChoices]);

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
    setMessage('Adding this saved voxel to My World…');
    try {
      const existing = isSavedPropertyDraft(selectedProperty) ? selectedProperty : savedDraft;
      const mappedBase = buildPropertyDraft({ building, fallbackLabel: mappedAddress, focusAuthority: clean(building?.source?.authority) });
      if (!mappedBase) throw new Error('This mapped property does not have enough location identity to save.');
      const base = existing || mappedBase;
      const draft = {
        ...base,
        id: existing?.id || mappedBase.id,
        label: mappedAddress || base.label,
        state: 'saved',
        fidelity: base.fidelity === 'photo-approved-local-voxel' ? mappedBase.fidelity : base.fidelity,
        geometryKind: mappedBase.geometryKind,
        coordinates: mappedBase.coordinates,
        geometry: mappedBase.geometry,
        propertyIdentity: { ...(base.propertyIdentity || {}), ...(mappedBase.propertyIdentity || {}) },
        evidence: { ...(base.evidence || {}), ...(mappedBase.evidence || {}) },
        visual: { ...(base.visual || {}), modelUrl: final3d.modelUrl, modelTaskId: final3d.taskId, renderMode: 'voxelpop-local-3d' },
        voxelpop: {
          ...(base.voxelpop || {}),
          paidCreation: true,
          priceCents: base?.voxelpop?.priceCents || CREATION_PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoRetainedOnDevice: true,
          previewApproved: true,
          photoMatchedFront: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          modelTaskId: final3d.taskId,
          modelUrl: final3d.modelUrl,
        },
        world: { ...(base.world || {}), public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
        blockchain: { ...(base.blockchain || {}), minted: Boolean(base?.blockchain?.minted), optional: true, optionalAfterCreation: true },
      };
      const localSaved = savePropertyDraft(draft);
      if (pendingPhoto) await saveDevicePhoto(propertyPhotoKey(localSaved.id), pendingPhoto).catch(() => {});
      let synced = false;
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) {
          await savePropertyDraftToAccount(client, session.user, localSaved);
          synced = true;
          await refreshPropertyChoices(client, session.user);
        }
      } catch {}
      setSelectedProperty(localSaved);
      setSavedDraft(localSaved);
      setMessage(synced
        ? 'Added to My World and synced to your Vault account.'
        : 'Added to My World on this device. Account sync can retry later.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This voxel could not be added to My World yet.'));
    } finally {
      setBusy('');
    }
  }

  function resetCreation() {
    const oldDraft = draftId;
    const keepStablePropertyPhoto = Boolean(selectedProperty?.id);
    setDraftId(newDraftId());
    setSourceMode('photo');
    setSelectedProperty(null);
    setPendingPhoto(null);
    setPreviewFromFile(null);
    setRightsConfirmed(false);
    setPaidSessionId('');
    setCreationUnlocked(false);
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
    setMessage('Choose a new photo or reuse one of your saved properties.');
    if (!keepStablePropertyPhoto) removeDevicePhoto(oldDraft);
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
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(mappedAddress || selectedProperty?.label || 'VoxelPop Property')}`
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
        <p className={styles.bigPrompt}>Choose a clear house photo.</p>
        <p className={styles.flowHint}>Photo → $4.99 → VoxelPop 3D house → 3D voxel → mint now or save for later.</p>
        <div className={styles.choicePanel}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <button className={sourceMode === 'photo' ? styles.primaryPurple : styles.primaryTeal} style={{minHeight:50,boxShadow:'none',fontSize:14}} type="button" onClick={() => setSourceMode('photo')}>Upload / Photos</button>
            <button className={sourceMode === 'properties' ? styles.primaryPurple : styles.primaryTeal} style={{minHeight:50,boxShadow:'none',fontSize:14}} type="button" onClick={() => setSourceMode('properties')}>My Properties</button>
          </div>
        </div>

        {sourceMode === 'properties' ? <div className={styles.choicePanel}>
          {propertyChoices.length ? propertyChoices.map((property) => <button key={property.id} className={styles.secondaryLink} style={{border:0,cursor:'pointer',minHeight:58,padding:'10px 14px',display:'grid',gridTemplateColumns:'1fr auto',textAlign:'left',gap:8}} type="button" onClick={() => selectProperty(property)} disabled={busy === 'reuse-photo'}>
            <span><b style={{display:'block',fontSize:13}}>{property.label || 'Saved property'}</b><small style={{display:'block',marginTop:4,color:'#7d7168'}}>{property.demoOnly ? 'Demo property slice · not real-property ownership' : property?.voxelpop?.paidCreation ? 'Saved VoxelPop property · creation already paid' : 'Saved property · add or reuse a photo'}</small></span>
            <b style={{fontSize:9,letterSpacing:'.08em'}}>{property.demoOnly ? 'DEMO' : 'USE'}</b>
          </button>) : <div className={styles.autoPanel}><b>NO SAVED PROPERTIES YET</b><span>Upload a property photo to create your first one.</span></div>}
          <button className={styles.primaryTeal} type="button" onClick={choosePhoto}>Add a property photo</button>
        </div> : <>
          {selectedProperty ? <div className={styles.autoPanel}><b>PROPERTY SELECTED</b><span>{selectedProperty.label || 'Saved property'} · add its photo below.</span></div> : null}
          <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>Front or three-quarter view works best · iPhone photos supported</span></div>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : selectedProperty ? 'Add photo to this property' : 'Choose photo'}</button>
        </>}
        {selectedProperty && !pendingPhoto ? <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Add photo to {selectedProperty.label || 'this property'}</button> : null}
        <p className={styles.truth}>Your source photo is kept on this device for checkout continuity. After payment, a prepared copy is sent transiently to the configured image-generation provider to make the VoxelPop 3D house picture. Voxel Vault does not save the original in generation storage. Demo property slices remain demo-only.</p>
      </> : null}

      {stage === 2 ? <>
        <p className={styles.bigPrompt}>{paidSessionId ? 'Generate the 3D house.' : 'Pay $4.99. Generate the 3D house.'}</p>
        <p className={styles.stepCopy}>VoxelPop generates the NFT-house-style 3D image first. You see and approve that generated house before VoxelPop creates the separate voxel. {paidSessionId ? 'This creation is already paid, so there is no second creation charge.' : ''}</p>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>{selectedProperty ? 'REUSABLE PROPERTY PHOTO · LOCAL UNTIL 3D RENDER' : 'YOUR HOUSE PHOTO · LOCAL UNTIL 3D RENDER'}</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : paidSessionId ? 'Generate VoxelPop 3D House · already paid' : `Pay ${CREATION_PRICE_LABEL} & Make 3D Picture`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>The $4.99 payment buys one digital VoxelPop creation. It does not buy the physical property or any deed, rent, occupancy, investment, or guaranteed-value rights.</p>
      </> : null}

      {stage === 3 ? <>
        <p className={styles.bigPrompt}>{previewReady ? 'VoxelPop 3D house ready.' : 'Generating your VoxelPop 3D house.'}</p>
        <p className={styles.stepCopy}>Review the generated VoxelPop/NFT-house-style image against the original reference. The voxel is not created until you approve this generated house.</p>
        {!pendingPreview ? <section className={styles.donePanel}><b>PAYMENT VERIFIED</b><span>Choose the same photo again. You will not be charged again.</span><button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button></section> : <>
          <div className={styles.heroCard}>
            <VoxelPopHouseImageGenerator imageUrl={pendingPreview} onReady={() => setPreviewReady(true)}/>
            <span className={styles.badge}>VOXELPOP 3D HOUSE · VOXEL NOT BUILT YET</span>
            {!previewReady ? <div className={styles.buildPulse}/> : null}
          </div>
          <div className={styles.choicePanel}>
            <b>{previewReady ? 'Does this generated VoxelPop house match your photo?' : 'Generating the VoxelPop 3D house from your photo…'}</b>
            <button className={styles.primaryPurple} type="button" onClick={approvePreviewAndBuildVoxel} disabled={!previewReady || busy === 'voxel-image'}>{busy === 'voxel-image' ? 'Starting voxel…' : 'Looks good → Create 3D Voxel'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different photo · no second charge</button>
          </div>
        </>}
        <p className={styles.truth}>This is an AI-generated visual interpretation based on your authorized photo. Compare it with the original before approving. One photo cannot verify hidden sides, the rear, or exact dimensions.</p>
      </> : null}

      {stage === 4 ? <>
        <p className={styles.bigPrompt}>Create the 3D voxel.</p>
        <p className={styles.stepCopy}>VoxelPop now converts the approved VoxelPop house render into the separate movable voxel version.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{final3d.status === 'LOCAL_ONLY' ? 'VOXEL VISIBLE · SAVE NEEDS RETRY' : 'CREATING RENDER-MATCHED 3D VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {final3d.status === 'LOCAL_ONLY' && localRecipe ? <button className={styles.primaryPurple} type="button" onClick={() => registerVoxel(localRecipe)} disabled={busy === 'register'}>{busy === 'register' ? 'Saving voxel…' : 'Retry saving voxel'}</button> : <div className={styles.autoPanel}><b>VOXELPOP 3D HOUSE APPROVED → 3D VOXEL</b><span>The local voxel is being built from the approved generated house image. The original photo is not the voxel source after approval.</span></div>}
      </> : null}

      {stage === 5 ? <>
        <div className={styles.autoPanel}><b>✓ PAID · $4.99 COMPLETE</b><span>VoxelPop 3D house approved · 3D voxel created · saved to Vault</span></div>
        <p className={styles.bigPrompt}>Your voxel is ready.</p>
        <p className={styles.stepCopy}>Mint it now, or keep the finished digital voxel in your Vault and mint it later.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster}/>
          <span className={styles.badge}>FINAL 3D VOXEL · SAVED</span>
        </div>
        <div className={styles.choicePanel}>
          <a className={styles.primaryLink} href={mintHref}>Mint Now</a>
          <a className={styles.secondaryLink} href="/vault/property-drafts">Mint Later · Saved to Vault</a>
          <span>Minting is optional. Your wallet is only requested if you choose Mint Now.</span>
        </div>

        <details className={styles.optionalDetails}>
          <summary>Optional · add this voxel to My World</summary>
          <form className={styles.searchForm} onSubmit={mapBuilding}>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
            <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Match address to map'}</button>
          </form>
          {building ? <>
            <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
            <section className={styles.donePanel}>
              <b>{mappedAddress}</b>
              <span>Map context is separate from the voxel and from NFT ownership.</span>
              <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Adding…' : savedDraft?.geometry ? 'Added to My World ✓' : 'Add to My World'}</button>
              {savedDraft?.geometry ? <a className={styles.secondaryLink} href="/world">View My World</a> : null}
            </section>
          </> : null}
        </details>
        <p className={styles.truth}>Minting creates an NFT for the finished digital voxel only. It does not create or transfer deed/title, rent, occupancy, investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {stage > 1 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another property or photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
