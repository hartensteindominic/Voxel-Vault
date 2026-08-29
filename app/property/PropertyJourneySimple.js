'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PropertyPhoto3DPreview from './PropertyPhoto3DPreview';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PropertyWorldMap from './PropertyWorldMap';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../lib/voxelflip';
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
      image.onerror = () => reject(new Error('The approved photo could not be opened for the VoxelPop image.'));
    });
    const sourceWidth = image.naturalWidth || 1;
    const sourceHeight = image.naturalHeight || 1;
    const ratio = Math.max(0.5, Math.min(2, sourceWidth / sourceHeight));
    const longSample = 84;
    const sampleWidth = ratio >= 1 ? longSample : Math.max(42, Math.round(longSample * ratio));
    const sampleHeight = ratio >= 1 ? Math.max(42, Math.round(longSample / ratio)) : longSample;
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop image processing is unavailable.');
    sampleContext.filter = 'saturate(1.06) contrast(1.05)';
    sampleContext.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, sampleWidth, sampleHeight);

    const maxOutput = 900;
    const output = document.createElement('canvas');
    output.width = ratio >= 1 ? maxOutput : Math.max(450, Math.round(maxOutput * ratio));
    output.height = ratio >= 1 ? Math.max(450, Math.round(maxOutput / ratio)) : maxOutput;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#18101f';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(sample, 0, 0, output.width, output.height);
    const shade = context.createLinearGradient(0, 0, output.width, output.height);
    shade.addColorStop(0, 'rgba(255,255,255,.06)');
    shade.addColorStop(0.64, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(38,18,52,.10)');
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
  const [photo3dReady, setPhoto3dReady] = useState(false);
  const [voxelApproved, setVoxelApproved] = useState(false);
  const [voxelPoster, setVoxelPoster] = useState('');
  const [localRecipe, setLocalRecipe] = useState(null);
  const [final3d, setFinal3d] = useState(empty3d);
  const [minted, setMinted] = useState(null);
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
  const step = localReady ? 5 : voxelApproved ? 4 : paidSessionId ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PICTURE', 'VOXEL', 'MINT'];

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

  useEffect(() => {
    if (!draftId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`voxelpop:property-mint:${draftId}`) || 'null');
      if (saved?.tokenId) setMinted(saved);
    } catch {}
  }, [draftId]);

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
      setPhoto3dReady(false);
      setVoxelApproved(false);
      setVoxelPoster('');
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setMinted(null);
      setBuilding(null);
      setAtlasBuildings([]);
      setMappedAddress('');
      setSavedDraft(null);
      setMessage(paidSessionId
        ? 'Payment is already verified. Confirm this photo, then build the 3D picture first—there is no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL}. The 3D picture comes before the voxel.`);
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function startPhoto3D(photo) {
    if (!photo) return;
    setPhoto3dReady(false);
    setVoxelApproved(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });
    setMinted(null);
    setBuilding(null);
    setAtlasBuildings([]);
    setMappedAddress('');
    setSavedDraft(null);
    setBusy('photo-3d');
    setMessage('Payment confirmed. Building the 3D picture from your actual uploaded photo first…');
  }

  function handlePhoto3DReady() {
    setPhoto3dReady(true);
    setBusy('');
    setMessage('3D picture ready. Compare it with your original photo. If the house looks right, create the voxel next.');
  }

  async function createApprovedVoxel() {
    if (!pendingPhoto || !photo3dReady || !paidSessionId) return;
    setVoxelApproved(true);
    setBusy('local-build');
    setFinal3d({ status: 'IN_PROGRESS', progress: 30, modelUrl: null, taskId: null });
    setMessage('Approved. Converting that 3D picture into the actual voxel now—no generic house fallback and no Meshy credits.');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setFinal3d({ status: 'IN_PROGRESS', progress: 72, modelUrl: null, taskId: null });
      setBusy('local-3d');
      setMessage('Voxel image ready. Building the movable 3D voxel from the same approved house photo…');
    } catch (error) {
      setVoxelApproved(false);
      setFinal3d(empty3d());
      setBusy('');
      setMessage(String(error?.message || error || 'The approved photo could not be converted into a voxel.'));
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
    setMessage('Payment received. Reopening your private photo for the 3D picture stage…');

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
        await startPhoto3D(photo);
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
        await startPhoto3D(pendingPhoto);
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. After payment, you see the 3D picture before any voxel is created.`);
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
      setMessage('Your 3D voxel is ready. Mint is now the next primary step. Mapping to My World is optional and does not block minting.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage('Your 3D voxel is ready on this device. Mint needs the Vault model link, so VoxelPop will retry that save when you tap Mint.');
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  async function ensureMintableVoxel() {
    if (final3d?.taskId?.startsWith('local-v1:') && final3d?.modelUrl) return final3d;
    if (!localRecipe || !draftId) throw new Error('The approved voxel recipe is not available to save for minting.');
    setMessage('Saving the finished voxel to your Vault before opening the mint…');
    const response = await fetch('/api/property-local-voxel', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ draftId, recipe: localRecipe }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The finished voxel could not be saved for minting yet.');
    const durable = { status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl, taskId: data.taskId };
    setFinal3d(durable);
    return durable;
  }

  async function persistMintToSavedDraft(mint) {
    if (!savedDraft || !mint?.tokenId) return;
    const updated = {
      ...savedDraft,
      voxelpop: {
        ...(savedDraft.voxelpop || {}),
        mint: {
          chain: 'Base',
          collection: 'VoxelFlip',
          tokenId: String(mint.tokenId),
          owner: mint.owner || null,
          txHash: mint.hash || null,
          explorerUrl: mint.explorerUrl || null,
          openSeaUrl: mint.openSeaUrl || null,
        },
      },
    };
    const localSaved = savePropertyDraft(updated);
    setSavedDraft(localSaved);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      if (session?.user) await savePropertyDraftToAccount(client, session.user, localSaved);
    } catch {}
  }

  async function mintVoxel() {
    if (!localReady || !paidSessionId || !session?.access_token) return;
    setBusy('mint');
    try {
      const durable = await ensureMintableVoxel();
      setMessage('Connect the wallet that should own this VoxelFlip. No wallet was required for the 3D creation itself.');
      const connected = await connectVoxelFlipWallet();
      const mintName = clean(savedDraft?.label || mappedAddress || 'VoxelPop Property').slice(0, 90) || 'VoxelPop Property';
      const response = await fetch('/api/property-local-voxel/mint/prepare', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          generationSessionId: paidSessionId,
          draftId,
          taskId: durable.taskId,
          wallet: connected.address,
          name: mintName,
        }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.signature) throw new Error(prepared?.error || 'The property voxel mint could not be prepared.');
      setMessage('Everything matches. Confirm this one Base NFT mint in your wallet.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      if (!result?.tokenId) throw new Error('The mint transaction finished but the token ID could not be read. Check the transaction before trying again.');
      const finalMint = { ...result, metadataUrl: prepared.metadataUrl, taskId: durable.taskId };
      setMinted(finalMint);
      try { window.localStorage.setItem(`voxelpop:property-mint:${draftId}`, JSON.stringify(finalMint)); } catch {}
      await persistMintToSavedDraft(finalMint);
      setMessage(`Minted. VoxelFlip #${finalMint.tokenId} now represents this finished digital voxel on Base. It does not represent the deed or physical-property ownership.`);
    } catch (error) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setMessage(String(error?.message || error || 'The property voxel could not be minted.'));
    } finally {
      setBusy('');
    }
  }

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching your finished voxel to the mapped building and nearby neighborhood…');
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
        ? 'Matched. My World is using the source-backed building footprint while your finished voxel keeps the approved photo-derived appearance.'
        : 'Location matched. A source-backed footprint was not available, so My World will use the verified location reference instead.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this finished property voxel to My World…');
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
          approved3dPictureFirst: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          modelTaskId: final3d?.taskId || null,
          modelUrl: final3d?.modelUrl || null,
          ...(minted?.tokenId ? {
            mint: {
              chain: 'Base',
              collection: 'VoxelFlip',
              tokenId: String(minted.tokenId),
              owner: minted.owner || null,
              txHash: minted.hash || null,
              explorerUrl: minted.explorerUrl || null,
              openSeaUrl: minted.openSeaUrl || null,
            },
          } : {}),
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
        ? 'Saved. Your finished voxel is in My World and your Vault account.'
        : 'Saved to My World on this device. Account sync can retry from Vault later—your voxel is not blocked.');
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
    setPhoto3dReady(false);
    setVoxelApproved(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setMinted(null);
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setAtlasBuildings([]);
    setSavedDraft(null);
    setBusy('');
    setMessage('Choose one property photo.');
    try { window.localStorage.removeItem(`voxelpop:property-mint:${oldDraft}`); } catch {}
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
        <small>A wallet is not needed until you decide to mint the finished voxel.</small>
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
        <p className={styles.flowHint}>Photo → pay $4.99 → see the 3D picture → approve it → create the 3D voxel → mint.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
        <p className={styles.truth}>Use a clear front or three-quarter photo for the closest visible match. The photo stays on this device through checkout and creation.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Pay once. See the 3D picture first.</p>
        <p className={styles.stepCopy}>The $4.99 purchase includes the 3D picture preview, your approved 3D voxel, and saving it to My World. There is no second creation payment required just to continue.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>YOUR BUILDING PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : `Pay ${CREATION_PRICE_LABEL} & Make 3D Picture`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>The $4.99 charge buys one digital VoxelPop creation. It does not buy the physical property, deed/title, investment rights, rent rights, or guaranteed value.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>Check the 3D picture before voxels.</p>
        <p className={styles.stepCopy}>This stage keeps the full uploaded photo visible on a real interactive 3D relief so you can confirm it still looks like your house. VoxelPop will not build the voxel until you approve this view.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {!pendingPhoto || !pendingPreview ? <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>PAYMENT VERIFIED</b>
          <span>Your photo was not available after checkout. Choose the same photo again—there is no second charge.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo again</button>
        </section> : <div className={styles.comparisonGrid}>
          <div className={styles.compareCard}><img src={pendingPreview} alt="Original house reference"/><span>1 · ORIGINAL PHOTO</span></div>
          <div className={styles.compareCard}><PropertyPhoto3DPreview imageUrl={pendingPreview} onReady={handlePhoto3DReady}/><span>2 · 3D PICTURE</span></div>
        </div>}
        {pendingPreview ? <div className={styles.choicePanel}>
          <button className={styles.primaryPurple} type="button" onClick={createApprovedVoxel} disabled={!photo3dReady || busy === 'photo-3d'}>{photo3dReady ? 'Looks like my house → Create 3D Voxel' : 'Building 3D picture…'}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>That is not the right photo</button>
        </div> : null}
        <p className={styles.truth}>A single photo can preserve the visible facade but cannot prove unseen sides, exact roof geometry, or hidden dimensions. This approval step prevents a generic replacement house from silently taking over.</p>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Now create the 3D voxel.</p>
        <p className={styles.stepCopy}>VoxelPop is converting the same approved house photo into movable voxel geometry. The full photo framing is preserved and the old generic-house fallback is disabled.</p>
        <div className={styles.comparisonGrid}>
          <div className={styles.compareCard}><PropertyPhoto3DPreview imageUrl={pendingPreview} onReady={() => {}}/><span>APPROVED 3D PICTURE</span></div>
          <div className={styles.compareCard}>
            {voxelPoster ? <LocalVoxelModelViewer imageUrl={voxelPoster} sourceImageUrl={pendingPreview} onReady={handleLocal3DReady}/> : <img src={pendingPreview} alt="Approved house while voxel starts"/>}
            <span>{localReady ? '3D VOXEL READY' : 'BUILDING 3D VOXEL'}</span>
          </div>
        </div>
        {!voxelPoster ? <div className={styles.autoPanel}><b>APPROVED → VOXEL</b><span>The 3D picture is locked in. VoxelPop is preparing its voxel version locally.</span></div> : null}
        <p className={styles.truth}>No Meshy credits are used in this normal property flow. If VoxelPop cannot isolate enough real building evidence, it fails clearly instead of inventing a generic house.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Your voxel is ready. Mint it when you want.</p>
        <p className={styles.stepCopy}>You already approved the 3D picture and then created the voxel. Mint is now the next action. A wallet appears only here.</p>
        <div className={styles.comparisonGrid}>
          <div className={styles.compareCard}><img src={pendingPreview || voxelPoster} alt="Original approved property"/><span>APPROVED HOUSE</span></div>
          <div className={styles.compareCard}><LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster}/><span>FINAL 3D VOXEL</span></div>
        </div>

        {!minted?.tokenId ? <section className={styles.mintPanel}>
          <small>OPTIONAL NFT · BASE</small>
          <b>Mint this exact finished voxel</b>
          <p>Connect a wallet only now. VoxelFlip mints the finished digital voxel you just approved—not the physical house, deed, title, rent, or investment rights. Base network gas may apply.</p>
          <button className={styles.primaryPurple} type="button" onClick={mintVoxel} disabled={busy === 'mint'}>{busy === 'mint' ? 'Preparing secure mint…' : 'Mint this voxel on Base'}</button>
        </section> : <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>VOXELFLIP #{minted.tokenId} · MINTED</b>
          <span>This exact digital voxel is now recorded on Base.</span>
          {minted.explorerUrl ? <a className={styles.secondaryLink} href={minted.explorerUrl} target="_blank" rel="noreferrer">View transaction</a> : null}
          {minted.openSeaUrl ? <a className={styles.textLink} href={minted.openSeaUrl} target="_blank" rel="noreferrer">View NFT</a> : null}
        </section>}

        <section className={styles.worldOptional}>
          <small>OPTIONAL · MY WORLD</small>
          <b>Add the voxel to its real map location</b>
          <p>Minting does not require an address. Add one only if you also want this digital voxel placed in My World using source-backed map context.</p>
          {!mapped ? <form className={styles.searchForm} onSubmit={mapBuilding}>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
            <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Match voxel to this building'}</button>
          </form> : null}
          {mapped ? <>
            <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
            <section className={styles.donePanel}>
              <b>{mappedAddress}</b>
              <span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; exact building footprint was not available from the map source.'}</span>
              {!savedDraft ? <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save to My World'}</button> : <>
                <a className={styles.primaryLink} href="/world">View My World</a>
                <a className={styles.secondaryLink} href="/vault/property-drafts">Open My Vault</a>
              </>}
              <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
            </section>
          </> : null}
        </section>
        <p className={styles.truth}>Minting records the digital voxel asset. It does not create deed/title, ownership, occupancy, rent, fractional-investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {step > 1 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
