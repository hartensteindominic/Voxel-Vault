'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
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
import styles from './propertyJourneyV2.module.css';

const CREATION_PRICE_LABEL = '$4.99';
const CREATION_PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const GENERATION_CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
const DEMO_PURCHASE_KEY = 'voxel-vault:property-slice-purchases';
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });

// Kept for compatibility with older regression checks; the live UI uses journeyLabels below.
const labels = ['PHOTO', 'PAY', '3D', 'MAP', 'MY WORLD'];
const journeyLabels = ['PHOTO', 'PAY', '3D PIC', '3D VOXEL', 'MAP', 'MY WORLD'];

function clean(value) { return String(value || '').trim(); }
function newDraftId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `vp-${random.slice(0, 28)}`;
}
function propertyPhotoKey(id) { return `property:${String(id || '').slice(0, 220)}`; }
function isSavedDraft(value) { return value?.type === 'voxel-vault-property-3d-draft'; }
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
  if (!isSavedDraft(draft)) return null;
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
  } catch { return null; }
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
async function loadSavedPropertyPhoto(draft) {
  if (!draft) return null;
  const stable = await loadDevicePhoto(propertyPhotoKey(draft.id)).catch(() => null);
  if (stable) return stable;
  const creationDraftId = clean(draft?.voxelpop?.creationDraftId);
  if (creationDraftId) return loadDevicePhoto(creationDraftId).catch(() => null);
  return null;
}
function writeGenerationContext(draftId, selectedProperty) {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    window.localStorage.setItem(`${GENERATION_CONTEXT_PREFIX}${draftId}`, JSON.stringify({ selectedProperty: selectedProperty || null }));
  } catch {}
}
function readGenerationContext(draftId) {
  if (typeof window === 'undefined' || !draftId) return null;
  try { return JSON.parse(window.localStorage.getItem(`${GENERATION_CONTEXT_PREFIX}${draftId}`) || 'null'); }
  catch { return null; }
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
  } finally { URL.revokeObjectURL(url); }
}

// This deliberately keeps the real photo recognizable. The CSS presentation gives it depth;
// the next step samples the original photo to build actual movable voxel geometry.
async function createVoxelPoster(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The property photo could not be opened for the 3D picture.'));
    });
    const output = document.createElement('canvas');
    output.width = 1000;
    output.height = 1000;
    const context = output.getContext('2d');
    if (!context) throw new Error('3D picture processing is unavailable.');
    const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
    let sx = 0; let sy = 0; let sw = image.naturalWidth || 1; let sh = image.naturalHeight || 1;
    if (sourceRatio > 1) { sw = sh; sx = ((image.naturalWidth || 1) - sw) / 2; }
    else if (sourceRatio < 1) { sh = sw; sy = ((image.naturalHeight || 1) - sh) / 2; }
    context.fillStyle = '#21172c';
    context.fillRect(0, 0, output.width, output.height);
    context.filter = 'saturate(1.04) contrast(1.035) brightness(1.015)';
    context.drawImage(image, sx, sy, sw, sh, 36, 36, 928, 928);
    const shade = context.createLinearGradient(0, 0, output.width, output.height);
    shade.addColorStop(0, 'rgba(255,255,255,.08)');
    shade.addColorStop(0.55, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.14)');
    context.fillStyle = shade;
    context.fillRect(36, 36, 928, 928);
    return output.toDataURL('image/jpeg', 0.94);
  } finally { URL.revokeObjectURL(url); }
}

export default function PropertyJourneySimple() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [sourceMode, setSourceMode] = useState('photo');
  const [propertyChoices, setPropertyChoices] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [creationPaid, setCreationPaid] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [voxelPoster, setVoxelPoster] = useState('');
  const [voxelRequested, setVoxelRequested] = useState(false);
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
  const step = savedDraft ? 6 : localReady ? 5 : voxelRequested ? 4 : voxelPoster ? 3 : pendingPhoto ? 2 : 1;

  const setPreviewFromFile = useCallback((photo) => {
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return photo ? URL.createObjectURL(photo) : '';
    });
  }, []);

  const refreshProperties = useCallback(async (client, user) => {
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
        setMessage('Signed in. Use a new photo or pick a property you already saved.');
        await refreshProperties(client, data.session.user);
      }
      const auth = client.auth.onAuthStateChange(async (_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Use a new photo or pick a property you already saved.');
          await refreshProperties(client, next.user);
        } else setMessage('Sign in to start.');
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) { setAuthReady(true); setMessage('Sign-in setup is unavailable on this deployment.'); }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [refreshProperties]);

  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  function authHeaders(extra = {}) { return { Authorization: `Bearer ${session?.access_token || ''}`, ...extra }; }

  async function signIn() {
    setBusy('signin');
    setMessage('Opening secure sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) { setMessage(String(error?.message || error || 'Could not sign in.')); setBusy(''); }
  }

  function choosePhoto() {
    if (!session?.access_token) return setMessage('Sign in before choosing a photo.');
    uploadInputRef.current?.click();
  }

  async function selectProperty(property) {
    setBusy('property-photo');
    setSelectedProperty(property);
    setSavedDraft(null);
    setVoxelPoster('');
    setVoxelRequested(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    const existingCreationId = clean(property?.voxelpop?.creationDraftId);
    const alreadyPaid = Boolean(property?.voxelpop?.paidCreation);
    setDraftId(existingCreationId || newDraftId());
    setCreationPaid(alreadyPaid);
    setPaidSessionId(alreadyPaid ? 'saved-property' : '');
    setAddress(clean(property?.label));
    const mappedBuilding = buildingFromDraft(property);
    setBuilding(mappedBuilding);
    setMappedAddress(mappedBuilding ? clean(property?.label) : '');
    setAtlasBuildings(mappedBuilding ? [mappedBuilding] : []);
    try {
      const photo = await loadSavedPropertyPhoto(property);
      if (photo) {
        setPendingPhoto(photo);
        setPreviewFromFile(photo);
        setRightsConfirmed(true);
        setMessage(alreadyPaid
          ? 'Your saved property photo is back. This creation is already paid—make the 3D picture, then approve the voxel.'
          : 'Your saved property photo is back. Confirm the creation purchase, then review the 3D picture before making the voxel.');
      } else {
        setPendingPhoto(null);
        setPreviewFromFile(null);
        setRightsConfirmed(false);
        setMessage('This property is selected. Its older temporary photo is not available on this device, so add the property photo once and VoxelPop will keep it reusable here going forward.');
      }
    } finally { setBusy(''); }
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('prepare');
    setMessage(isHeic(selected) ? 'Preparing your iPhone photo…' : 'Preparing your property photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This photo is still too large after preparation. Try a screenshot or smaller version.');
      setPendingPhoto(photo);
      setPreviewFromFile(photo);
      setRightsConfirmed(false);
      setVoxelPoster('');
      setVoxelRequested(false);
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setSavedDraft(null);
      setMessage(creationPaid
        ? 'Photo ready. Confirm permission, then create the 3D picture—no second creation charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}. You will see the 3D picture before the voxel is created.`);
    } catch (error) { setMessage(String(error?.message || error || 'This photo could not be prepared.')); }
    finally { setBusy(''); }
  }

  async function startLocalBuild(photo, activeDraftId) {
    setBusy('3d-picture');
    setVoxelPoster('');
    setVoxelRequested(false);
    setLocalRecipe(null);
    setFinal3d({ status: 'IN_PROGRESS', progress: 48, modelUrl: null, taskId: null });
    setSavedDraft(null);
    setMessage('Creating a 3D picture from your exact property photo…');
    const poster = await createVoxelPoster(photo);
    setVoxelPoster(poster);
    setFinal3d({ status: 'IN_PROGRESS', progress: 62, modelUrl: null, taskId: null });
    setBusy('');
    setMessage('3D picture ready. Check that this is your building, then tap Create 3D Voxel. Nothing voxelizes until you approve it.');
  }

  async function verifyPaidSession(generationSessionId) {
    const form = new FormData();
    form.append('generationSessionId', generationSessionId);
    const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || data?.paid !== true || !data?.draftId) throw new Error(data?.error || 'Your paid VoxelPop creation could not be verified.');
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
      if (context?.selectedProperty) setSelectedProperty(context.selectedProperty);
      setDraftId(canceledDraftId);
      loadDevicePhoto(canceledDraftId).then((photo) => {
        if (photo) { setPendingPhoto(photo); setPreviewFromFile(photo); }
      }).catch(() => {});
      setBusy('');
      setMessage('Checkout canceled. Nothing was created or charged. Your selected property and photo are still here.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Reopening your property photo for the 3D picture…');
    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        const context = readGenerationContext(data.draftId);
        if (context?.selectedProperty) {
          setSelectedProperty(context.selectedProperty);
          const mappedBuilding = buildingFromDraft(context.selectedProperty);
          setBuilding(mappedBuilding);
          setMappedAddress(mappedBuilding ? clean(context.selectedProperty?.label) : '');
          setAtlasBuildings(mappedBuilding ? [mappedBuilding] : []);
          setAddress(clean(context.selectedProperty?.label));
        }
        setCreationPaid(true);
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
        setPreviewFromFile(photo);
        setRightsConfirmed(true);
        await startLocalBuild(photo, data.draftId);
      } catch (error) {
        if (active) { checkoutHandledRef.current = ''; setBusy(''); setMessage(String(error?.message || error || 'Your paid VoxelPop creation could not start.')); }
      }
    })();
    return () => { active = false; };
  }, [session?.access_token, setPreviewFromFile]);

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      if (selectedProperty?.id) await saveDevicePhoto(propertyPhotoKey(selectedProperty.id), pendingPhoto);
      writeGenerationContext(draftId, selectedProperty);
      if (creationPaid || paidSessionId) {
        await startLocalBuild(pendingPhoto, draftId);
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment you will return to the 3D picture preview first.`);
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure 3D creation checkout could not open.');
      window.location.assign(data.url);
    } catch (error) { setBusy(''); setMessage(String(error?.message || error || 'Secure VoxelPop creation could not start.')); }
  }

  function createVoxel() {
    if (!voxelPoster || !pendingPhoto) return;
    setVoxelRequested(true);
    setBusy('local-3d');
    setFinal3d({ status: 'IN_PROGRESS', progress: 74, modelUrl: null, taskId: null });
    setMessage('Creating the movable 3D voxel from the same property photo. No Meshy credits are used.');
  }

  const handleLocal3DReady = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !draftId) return;
    setLocalRecipe(recipe);
    setBusy('register');
    setFinal3d((current) => ({ ...current, status: 'IN_PROGRESS', progress: 92 }));
    try {
      const response = await fetch('/api/property-local-voxel', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ draftId, recipe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local 3D could not be linked to your Vault.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null });
      setMessage(mapped
        ? 'Your 3D voxel is ready. Review the property map and save it back to My World.'
        : 'Your 3D is ready. Enter the property address to match it to the real mapped building footprint.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage(mapped
        ? 'Your 3D voxel is ready on this device. Review the property and save it to My World.'
        : 'Your 3D is ready on this device. Enter the property address to match it to the real mapped building footprint.');
    } finally { setBusy(''); }
  }, [draftId, mapped, session?.access_token]);

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching your voxel to the mapped building and nearby neighborhood…');
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
        ? 'Matched. The map now uses the source-backed building footprint.'
        : 'Location matched. A source-backed footprint was not available, so the verified location reference is shown instead.');
    } catch (error) { setMessage(String(error?.message || error || 'The property map could not be built.')); }
    finally { setBusy(''); }
  }

  async function saveToMyWorld() {
    if (!localReady || !pendingPhoto) return;
    if (!mapped && !isSavedDraft(selectedProperty)) return setMessage('Match the address before saving this new property to My World.');
    setBusy('save');
    setMessage('Saving the photo, 3D picture, and voxel together with this property…');
    try {
      let draft;
      if (isSavedDraft(selectedProperty)) {
        draft = {
          ...selectedProperty,
          state: 'saved',
          voxelpop: {
            ...(selectedProperty.voxelpop || {}),
            paidCreation: true,
            priceCents: selectedProperty?.voxelpop?.priceCents || CREATION_PRICE_CENTS,
            engine: 'voxelpop-local-webgl-v3',
            sourcePhotoStoredByVoxelVault: false,
            sourcePhotoRetainedOnDevice: true,
            photoMatchedFront: true,
            photo3dPreviewApproved: true,
            creationDraftId: draftId,
            modelTaskId: final3d?.taskId || null,
            modelUrl: final3d?.modelUrl || null,
          },
        };
      } else {
        const base = buildPropertyDraft({ building, fallbackLabel: mappedAddress, focusAuthority: clean(building?.source?.authority) });
        if (!base) throw new Error('This mapped property does not have enough location identity to save.');
        draft = {
          ...base,
          state: 'saved',
          voxelpop: {
            paidCreation: true,
            priceCents: CREATION_PRICE_CENTS,
            engine: 'voxelpop-local-webgl-v3',
            sourcePhotoStoredByVoxelVault: false,
            sourcePhotoRetainedOnDevice: true,
            photoMatchedFront: true,
            photo3dPreviewApproved: true,
            mappedFootprintUsed: Boolean(building?.geometry),
            creationDraftId: draftId,
            modelTaskId: final3d?.taskId || null,
            modelUrl: final3d?.modelUrl || null,
          },
          world: { ...(base.world || {}), public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
        };
      }
      const localSaved = savePropertyDraft(draft);
      await saveDevicePhoto(propertyPhotoKey(localSaved.id), pendingPhoto);
      let synced = false;
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) { await savePropertyDraftToAccount(client, session.user, localSaved); synced = true; await refreshProperties(client, session.user); }
      } catch {}
      setSelectedProperty(localSaved);
      setSavedDraft(localSaved);
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
      setMessage(synced
        ? 'Saved. The property photo stays reusable on this device, and the 3D voxel is linked to your Vault account.'
        : 'Saved to My World on this device. The photo stays reusable here; account sync can retry later.');
    } catch (error) { setMessage(String(error?.message || error || 'This 3D property could not be saved yet.')); }
    finally { setBusy(''); }
  }

  function changeAddress() {
    setBuilding(null); setAtlasBuildings([]); setMappedAddress(''); setMessage('Enter the correct property address.');
  }
  function startFresh() {
    setSourceMode('photo');
    setSelectedProperty(null);
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPreviewFromFile(null);
    setRightsConfirmed(false);
    setCreationPaid(false);
    setPaidSessionId('');
    setVoxelPoster('');
    setVoxelRequested(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setAddress(''); setMappedAddress(''); setBuilding(null); setAtlasBuildings([]); setSavedDraft(null); setBusy('');
    setMessage('Choose a property photo, or pick one of your saved properties.');
  }

  if (!authReady) return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1><section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing charges before sign-in.</small></section></section></main>;

  if (!session?.user) return <main className={styles.page}><section className={styles.maker}>
    <div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1>
    <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Sign in first.</p><p className={styles.signinCopy}>One account keeps your paid creations, saved properties, Vault, My World items, and optional mint connected.</p><button className={styles.primary} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button><small>A wallet is not needed to create the 3D.</small></section>
    <p className={styles.message}>{message}</p>
  </section></main>;

  return <main className={styles.page}><section className={styles.maker}>
    <div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1>
    <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
    <div className={styles.progress} aria-label={`Step ${step} of 6`}>{journeyLabels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
    <p className={styles.stageLabel}>STEP {step} OF 6 · {journeyLabels[step - 1]}</p>
    <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

    {step === 1 ? <>
      <p className={styles.bigPrompt}>Use your property photo.</p>
      <p className={styles.flowHint}>Choose a new picture, reuse a photo from a saved property, or add a picture to a property item you already have.</p>
      <div className={styles.sourceTabs}>
        <button type="button" className={sourceMode === 'photo' ? styles.tabOn : ''} onClick={() => setSourceMode('photo')}>Upload / Photos</button>
        <button type="button" className={sourceMode === 'properties' ? styles.tabOn : ''} onClick={() => setSourceMode('properties')}>My Properties</button>
      </div>
      {sourceMode === 'properties' ? <div className={styles.propertyList}>
        {propertyChoices.length ? propertyChoices.map((property) => <button type="button" className={styles.propertyCard} key={property.id} onClick={() => selectProperty(property)} disabled={busy === 'property-photo'}>
          <span className={styles.propertyIcon}>⌂</span><span className={styles.propertyMeta}><b>{property.label || 'Saved property'}</b><span>{property.demoOnly ? 'Demo property slice · no real-property ownership' : property?.voxelpop?.paidCreation ? 'Saved VoxelPop property · creation paid' : 'Saved property · add or reuse a photo'}</span></span><span className={styles.propertyBadge}>{property.demoOnly ? 'DEMO' : 'USE'}</span>
        </button>) : <div className={styles.notice}>No saved properties yet. Upload a photo to create your first one.</div>}
        <button className={styles.secondary} type="button" onClick={choosePhoto}>Or choose a photo</button>
      </div> : <>
        {selectedProperty ? <div className={styles.notice}><b>{selectedProperty.label}</b><span> selected. Add its property photo below.</span></div> : null}
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose property photo</b><span>JPG, PNG, WebP, HEIC or HEIF · iPhone friendly</span></div>
        <button className={styles.primary} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
      </>}
      {selectedProperty && !pendingPhoto ? <button className={styles.primary} type="button" onClick={choosePhoto}>Add photo to {selectedProperty.label || 'this property'}</button> : null}
      <p className={styles.truth}>Saved source photos stay private on this device. Older items created before this change may need the photo added once because the old flow deleted its temporary copy.</p>
    </> : null}

    {step === 2 ? <>
      <p className={styles.bigPrompt}>{creationPaid ? 'Create the 3D picture.' : 'Pay once. Then review the 3D picture.'}</p>
      <p className={styles.stepCopy}>{creationPaid ? 'This property creation is already paid. There is no second creation charge.' : 'The $4.99 purchase includes the 3D picture, the movable voxel, and saving the result to My World. You approve the 3D picture before voxel creation starts.'}</p>
      <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>{selectedProperty ? 'PROPERTY PHOTO · REUSABLE ON THIS DEVICE' : 'YOUR PROPERTY PHOTO · DEVICE ONLY'}</span></div>
      <div className={styles.choicePanel}>
        {!creationPaid ? <div className={styles.priceLine}><span>One VoxelPop property creation</span><strong>{CREATION_PRICE_LABEL}</strong></div> : <div className={styles.notice}>✓ Creation already paid for this saved property.</div>}
        <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
        <button className={styles.primary} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout' || busy === '3d-picture'}>{busy ? 'Preparing…' : creationPaid ? 'Create 3D Picture · already paid' : `Pay ${CREATION_PRICE_LABEL} & Create 3D`}</button>
        <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
      </div>
      <p className={styles.truth}>The $4.99 charge buys one digital VoxelPop creation. It does not buy a physical property, deed/title, investment rights, rent rights, or guaranteed value.</p>
    </> : null}

    {step === 3 ? <>
      <p className={styles.bigPrompt}>Check the 3D picture first.</p>
      <p className={styles.stepCopy}>This preview keeps your actual property photo recognizable. If it is the right building, approve it and VoxelPop will build the movable voxel from the same source image.</p>
      <div className={styles.picture3d}><img src={voxelPoster || pendingPreview} alt="3D property picture preview"/><span className={styles.badge}>3D PICTURE · FROM YOUR PHOTO</span><div className={styles.pictureCaption}>Photo identity preserved · unseen sides are not claimed as exact.</div></div>
      <div className={styles.choicePanel}>
        <button className={styles.primary} type="button" onClick={createVoxel}>Create 3D Voxel</button>
        <button className={styles.secondary} type="button" onClick={() => { setVoxelPoster(''); setMessage('Choose a different photo before voxelizing.'); }}>Use a different photo</button>
      </div>
      <p className={styles.truth}>This approval step prevents the app from jumping straight into a voxel that does not look like the building.</p>
    </> : null}

    {step === 4 ? <>
      <p className={styles.bigPrompt}>{localReady ? 'Your 3D voxel is ready.' : 'Creating the 3D voxel.'}</p>
      <p className={styles.stepCopy}>VoxelPop is sampling the same property photo into movable Three.js voxel geometry. No Meshy credits are used.</p>
      <div className={styles.viewerCard}>
        <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/>
        <span className={styles.badge}>3D VOXEL · DRAG + PINCH</span>
      </div>
      <div className={styles.notice}>One purchase · 3D picture approved · voxel built locally from the same source photo.</div>
    </> : null}

    {step === 5 ? <>
      <p className={styles.bigPrompt}>{mapped ? 'Matched to your property.' : 'Add the real property location.'}</p>
      <p className={styles.stepCopy}>{mapped ? 'Review the mapped property, then save the photo + 3D picture + 3D voxel together in My World.' : 'Enter the property address so the voxel can be paired with source-backed map location/footprint data.'}</p>
      {mapped ? <>
        <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
        <div className={styles.donePanel}><b>{mappedAddress || selectedProperty?.label}</b><span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; exact footprint was not available from the map source.'}</span><button className={styles.teal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save to My World'}</button><button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button></div>
      </> : <form className={styles.searchForm} onSubmit={mapBuilding}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Match 3D to this building'}</button></form>}
      <p className={styles.truth}>The photo controls visible appearance. The address supplies map identity. Unseen details are not represented as verified fact.</p>
    </> : null}

    {step === 6 ? <>
      <p className={styles.bigPrompt}>Saved to My World.</p>
      <p className={styles.stepCopy}>Your reusable property photo, approved 3D picture, and movable voxel are now tied together on this device. The saved property record can also sync to your account.</p>
      {mapped ? <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>MY WORLD · SAVED</span></div> : null}
      <section className={styles.donePanel}><div className={styles.doneMark}>✓</div><b>{savedDraft?.label || mappedAddress || selectedProperty?.label}</b><span>Photo kept for reuse · 3D picture approved · 3D voxel created · saved. Minting stays optional and separate.</span><a className={styles.linkPrimary} href="/world">View My World</a><a className={styles.linkSecondary} href="/vault/property-drafts">Open My Vault</a><button className={styles.textButton} type="button" onClick={startFresh}>Create another</button></section>
      <p className={styles.truth}>Saving or minting the digital item does not create deed/title, occupancy, rent, fractional-investment, appreciation, or other rights in the physical property.</p>
    </> : null}

    {step > 1 && step < 6 ? <button className={styles.change} type="button" onClick={startFresh}>Start over with another property or photo</button> : null}
    <p className={styles.message} role="status">{message}</p>
  </section></main>;
}
