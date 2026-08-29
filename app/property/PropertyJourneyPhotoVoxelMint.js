'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoDepthPreview from './PhotoDepthPreview';
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
function mintErrorText(error) {
  return String(error?.reason || error?.shortMessage || error?.message || error || 'VoxelFlip minting failed.');
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
      image.onerror = () => reject(new Error('The photo could not be opened for the VoxelPop voxel preview.'));
    });
    const sampleSize = 96;
    const sample = document.createElement('canvas');
    sample.width = sampleSize;
    sample.height = sampleSize;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) throw new Error('VoxelPop image processing is unavailable.');
    const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth || 1;
    let sh = image.naturalHeight || 1;
    if (sourceRatio > 1) { sw = sh; sx = ((image.naturalWidth || 1) - sw) / 2; }
    else if (sourceRatio < 1) { sh = sw; sy = ((image.naturalHeight || 1) - sh) / 2; }
    sampleContext.filter = 'saturate(1.05) contrast(1.04)';
    sampleContext.drawImage(image, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

    const output = document.createElement('canvas');
    output.width = 864;
    output.height = 864;
    const context = output.getContext('2d');
    if (!context) throw new Error('VoxelPop image processing is unavailable.');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ede7df';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(sample, 0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.93);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PropertyJourneyPhotoVoxelMint() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [photo3dReady, setPhoto3dReady] = useState(false);
  const [voxelRequested, setVoxelRequested] = useState(false);
  const [voxelPoster, setVoxelPoster] = useState('');
  const [localRecipe, setLocalRecipe] = useState(null);
  const [final3d, setFinal3d] = useState(empty3d);
  const [voxelApproved, setVoxelApproved] = useState(false);
  const [pendingMint, setPendingMint] = useState(null);
  const [mintResult, setMintResult] = useState(null);
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
  const mintable = localReady && Boolean(final3d?.modelUrl) && String(final3d?.taskId || '').startsWith('local-v1:');
  const mapped = Boolean(building && mappedAddress);
  const step = voxelApproved ? 5 : voxelRequested ? 4 : paidSessionId ? 3 : pendingPhoto ? 2 : 1;
  const labels = ['PHOTO', 'PAY', '3D PICTURE', '3D VOXEL', 'MINT'];

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
      setPhoto3dReady(false);
      setVoxelRequested(false);
      setVoxelPoster('');
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setVoxelApproved(false);
      setPendingMint(null);
      setMintResult(null);
      setRightsConfirmed(Boolean(paidSessionId));
      setMessage(paidSessionId
        ? 'Payment is already verified. This photo will open as the 3D picture first—there is no second charge.'
        : `Photo ready. Confirm permission, then pay ${CREATION_PRICE_LABEL} to unlock its 3D picture.`);
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
      setMessage('Checkout canceled. Nothing was created or charged. Your photo is still on this device if you want to try again.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Reopening your private photo for the 3D picture…');

    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        setBusy('');
        if (!photo) {
          setMessage('Payment is verified. Choose the same property photo again. You will not be charged again; the 3D picture comes next.');
          return;
        }
        setPendingPhoto(photo);
        setPendingPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo);
        });
        setRightsConfirmed(true);
        setPhoto3dReady(false);
        setVoxelRequested(false);
        setMessage('Payment confirmed. First inspect your actual house as a movable 3D picture. The voxel does not start until you approve it.');
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

  async function payAndUnlock3DPicture() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto);
      if (paidSessionId) {
        setBusy('');
        setMessage('Payment already verified. Inspect the 3D picture first—no second charge.');
        return;
      }
      setMessage(`Opening secure ${CREATION_PRICE_LABEL} checkout. Payment unlocks the 3D picture; voxel creation waits for your approval.`);
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure 3D picture checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'Secure VoxelPop creation could not start.'));
    }
  }

  async function create3DVoxel() {
    if (!pendingPhoto || !paidSessionId || !photo3dReady || busy) return;
    setVoxelRequested(true);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d({ status: 'IN_PROGRESS', progress: 30, modelUrl: null, taskId: null });
    setVoxelApproved(false);
    setPendingMint(null);
    setMintResult(null);
    setBusy('local-build');
    setMessage('3D picture approved. Now creating the separate 3D voxel from the original house photo…');
    try {
      const poster = await createVoxelPoster(pendingPhoto);
      setVoxelPoster(poster);
      setFinal3d({ status: 'IN_PROGRESS', progress: 72, modelUrl: null, taskId: null });
      setBusy('local-3d');
      setMessage('Voxel preview ready. Building the movable house-shaped voxel locally…');
    } catch (error) {
      setBusy('');
      setVoxelRequested(false);
      setFinal3d(empty3d());
      setMessage(String(error?.message || error || 'The local voxel could not start.'));
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
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'The local 3D voxel could not be linked to your account.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl || null, taskId: data.taskId || null });
      setMessage('Your 3D voxel is ready. Rotate it and inspect it before choosing Mint.');
    } catch (error) {
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: null, taskId: `local-device:${draftId}` });
      setMessage(`Your voxel is visible on this device, but its Vault link needs a retry before minting. ${String(error?.message || error || '')}`.trim());
    } finally {
      setBusy('');
    }
  }, [draftId, session?.access_token]);

  async function verifySubmittedMint(submission) {
    setBusy('mint-verify');
    setMessage(`Verifying VoxelFlip #${submission.tokenId} on Base…`);
    try {
      const response = await fetch('/api/property-local-voxel/mint/confirm', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          generationSessionId: paidSessionId,
          draftId,
          taskId: final3d.taskId,
          tokenId: submission.tokenId,
          txHash: submission.hash || submission.txHash,
          wallet: submission.owner,
          metadataUrl: submission.metadataUrl,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.confirmed) throw new Error(data?.error || 'The Base mint has not been verified yet.');
      const confirmed = { ...submission, ...data, hash: submission.hash || submission.txHash || data.txHash };
      setPendingMint(null);
      setMintResult(confirmed);
      setMessage(`VoxelFlip #${confirmed.tokenId} is minted to your wallet. You can still place the digital voxel in My World below.`);
      return confirmed;
    } catch (error) {
      setPendingMint(submission);
      setMessage(`The mint transaction is saved, but verification is not finished: ${mintErrorText(error)} Do not mint again; tap Resume mint verification.`);
      return null;
    } finally {
      setBusy('');
    }
  }

  async function mintPropertyVoxel() {
    if (pendingMint) return verifySubmittedMint(pendingMint);
    if (!mintable || !paidSessionId || busy) return;
    setBusy('mint-connect');
    setMessage('Connecting the wallet that will own this VoxelFlip…');
    try {
      const connected = await connectVoxelFlipWallet();
      setBusy('mint-prepare');
      setMessage('Checking the exact paid voxel and one-time Base mint voucher…');
      const response = await fetch('/api/property-local-voxel/mint/prepare', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ generationSessionId: paidSessionId, draftId, taskId: final3d.taskId, wallet: connected.address }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || prepared?.ok === false) throw new Error(prepared?.error || 'This property voxel could not be prepared for minting.');
      if (prepared?.alreadyMinted && prepared?.existingMint?.tokenId) {
        const existing = {
          tokenId: String(prepared.existingMint.tokenId),
          owner: prepared.existingMint.owner || connected.address,
          hash: prepared.existingMint.txHash || '',
          txHash: prepared.existingMint.txHash || '',
          metadataUrl: prepared.existingMint.metadataUrl || '',
          contractAddress: prepared.contractAddress,
          explorerUrl: prepared.existingMint.txHash ? `https://basescan.org/tx/${prepared.existingMint.txHash}` : '',
          openSeaUrl: `https://opensea.io/assets/base/${prepared.contractAddress}/${prepared.existingMint.tokenId}`,
        };
        setMintResult(existing);
        setBusy('');
        setMessage(`VoxelFlip #${existing.tokenId} already represents this voxel. VoxelPop did not send a duplicate mint.`);
        return;
      }
      if (!prepared?.ready || !prepared?.signature || !prepared?.metadataUrl || !prepared?.voucherId) {
        throw new Error(prepared?.error || 'The secure one-time VoxelFlip voucher is incomplete.');
      }

      setBusy('mint-wallet');
      setMessage('Confirm the optional VoxelFlip mint in your wallet. This mints the digital 3D voxel—not the physical property.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      if (!result?.tokenId) throw new Error('The Base transaction completed but the NFT token ID could not be read.');
      const submission = { ...result, metadataUrl: prepared.metadataUrl, contractAddress: prepared.contractAddress };
      setPendingMint(submission);
      await verifySubmittedMint(submission);
    } catch (error) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setBusy('');
      setMessage(mintErrorText(error));
    }
  }

  async function mapBuilding(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !localReady) return;
    setBusy('map');
    setMessage('Matching your finished voxel to the real mapped property location…');
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
        ? 'Matched. My World now uses the source-backed building footprint for location context.'
        : 'Location matched. The exact source-backed building footprint was unavailable, so My World keeps a location reference only.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The property map could not be built.'));
    } finally {
      setBusy('');
    }
  }

  async function saveToMyWorld() {
    if (!building || !mappedAddress || !localReady) return;
    setBusy('save');
    setMessage('Saving this finished 3D voxel to My World…');
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
          threeDPictureReviewed: true,
          voxelReviewed: true,
          mappedFootprintUsed: Boolean(building?.geometry),
          creationDraftId: draftId,
          modelTaskId: final3d?.taskId || null,
          modelUrl: final3d?.modelUrl || null,
        },
        blockchain: mintResult?.tokenId ? {
          minted: true,
          network: 'base',
          tokenId: String(mintResult.tokenId),
          contractAddress: mintResult.contractAddress || null,
          txHash: mintResult.hash || mintResult.txHash || null,
          owner: mintResult.wallet || mintResult.owner || null,
          metadataUrl: mintResult.metadataUrl || null,
        } : { minted: false },
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
        ? 'Saved. Your reviewed 3D voxel is in My World and your Vault account.'
        : 'Saved to My World on this device. Account sync can retry later without blocking the creation.');
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
    setVoxelRequested(false);
    setVoxelPoster('');
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setVoxelApproved(false);
    setPendingMint(null);
    setMintResult(null);
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
        <p className={styles.signinCopy}>One account keeps your paid property creations, reviewed 3D voxels, My World items, and optional NFT mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>A wallet is needed only if you choose to mint the finished digital voxel.</small>
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
        <p className={styles.bigPrompt}>Start with your house.</p>
        <p className={styles.flowHint}>Photo → $4.99 → inspect 3D picture → create 3D voxel → review → optional mint.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose your property photo</b><span>Clear front or three-quarter view works best</span></div>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>
        <p className={styles.truth}>VoxelPop keeps this source photo on your device during creation. A single photo can preserve the visible front appearance, but it cannot prove unseen sides or exact dimensions.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Unlock the 3D picture.</p>
        <p className={styles.stepCopy}>Your one $4.99 payment unlocks this property creation. After payment you see the actual house photo as a movable 3D picture first. Voxel creation does not begin until you press Create 3D Voxel.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>YOUR HOUSE PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndUnlock3DPicture} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening checkout…' : `Pay ${CREATION_PRICE_LABEL} & Create 3D Picture`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another photo</button>
        </div>
        <p className={styles.truth}>The $4.99 charge buys the digital creation workflow. It does not buy the physical property, deed/title, rent rights, investment rights, or guaranteed value.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>See your house in 3D first.</p>
        <p className={styles.stepCopy}>This stage uses your original house photo as the visible texture and adds shallow interactive depth. Inspect it before VoxelPop turns the visible facade into voxels.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {!pendingPhoto || !pendingPreview ? <section className={styles.donePanel}>
          <div className={styles.doneMark}>✓</div>
          <b>PAYMENT VERIFIED</b>
          <span>Your private photo is not available in this browser session. Choose the same photo again—there is no second charge.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose same photo again</button>
        </section> : <>
          <div className={styles.heroCard}>
            <PhotoDepthPreview imageUrl={pendingPreview} onReady={() => {
              setPhoto3dReady(true);
              setMessage('3D picture ready. If this is the right house, press Create 3D Voxel.');
            }}/>
            <span className={styles.badge}>3D PICTURE · YOUR ORIGINAL HOUSE</span>
          </div>
          <div className={styles.choicePanel}>
            <button className={styles.primaryPurple} type="button" onClick={create3DVoxel} disabled={!photo3dReady || Boolean(busy)}>{photo3dReady ? 'Create 3D Voxel' : 'Preparing 3D picture…'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>This is the wrong photo · change it</button>
          </div>
        </>}
        <p className={styles.truth}>This 3D-picture checkpoint intentionally keeps the house recognizable. No voxel or blockchain action happens until you choose the next step.</p>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>{localReady ? 'Review your 3D voxel.' : 'Creating your 3D voxel.'}</p>
        <p className={styles.stepCopy}>{localReady
          ? 'Rotate and zoom the voxel. The visible facade is sampled from your original photo at higher local detail; sky and most ground are removed from the voxel shape.'
          : 'VoxelPop is now building a separate movable voxel from the original house photo. This happens locally and does not spend Meshy credits.'}</p>
        <div className={styles.heroCard}>
          {voxelPoster || pendingPreview ? <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster} onReady={handleLocal3DReady}/> : null}
          <span className={styles.badge}>{localReady ? '3D VOXEL · REVIEW BEFORE MINT' : 'CREATING HOUSE-SHAPED VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {localReady ? <div className={styles.choicePanel}>
          {!mintable && localRecipe ? <button className={styles.primaryOrange} type="button" onClick={() => handleLocal3DReady(localRecipe)} disabled={Boolean(busy)}>Retry Vault link for mint</button> : null}
          <button className={styles.primaryPurple} type="button" onClick={() => {
            setVoxelApproved(true);
            setMessage(mintable ? 'Voxel approved. Mint it now, or skip minting and place it in My World.' : 'Voxel approved. Minting stays locked until the saved model link is ready; My World placement still works.');
          }}>This looks right → Mint</button>
          <button className={styles.textButton} type="button" onClick={() => {
            setVoxelRequested(false);
            setVoxelPoster('');
            setLocalRecipe(null);
            setFinal3d(empty3d());
            setPhoto3dReady(true);
            setMessage('Back to the 3D picture. You can inspect it again before rebuilding the voxel.');
          }}>Back to 3D picture</button>
        </div> : <div className={styles.autoPanel}><b>BUILDING LOCALLY · ZERO MESHY CREDITS</b><span>The voxel starts only because you approved the 3D picture. It is not being minted or mapped yet.</span></div>}
        <p className={styles.truth}>The voxel approximates the visible facade from one photo. Unseen sides, roof geometry and exact measurements are not represented as verified facts.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Mint the voxel—if you want.</p>
        <p className={styles.stepCopy}>The finished 3D voxel is ready. Minting creates a VoxelFlip NFT on Base for this digital voxel only. It does not tokenize or transfer the physical house.</p>
        <div className={styles.heroCard}>
          {voxelPoster || pendingPreview ? <LocalVoxelModelViewer imageUrl={voxelPoster || pendingPreview} sourceImageUrl={pendingPreview || voxelPoster}/> : null}
          <span className={styles.badge}>{mintResult?.tokenId ? `MINTED · VOXELFLIP #${mintResult.tokenId}` : 'FINISHED 3D VOXEL'}</span>
        </div>

        <section className={styles.donePanel}>
          {mintResult?.tokenId ? <>
            <div className={styles.doneMark}>✓</div>
            <b>VoxelFlip #{mintResult.tokenId} minted on Base</b>
            <span>The blockchain item is the reviewed digital 3D voxel. Your private source photo is not stored in the NFT metadata.</span>
            {mintResult.openSeaUrl ? <a className={styles.primaryLink} href={mintResult.openSeaUrl} target="_blank" rel="noreferrer">View NFT on OpenSea</a> : null}
            {mintResult.explorerUrl ? <a className={styles.secondaryLink} href={mintResult.explorerUrl} target="_blank" rel="noreferrer">View Base transaction</a> : null}
          </> : <>
            <b>{pendingMint ? 'Mint submitted · verification pending' : 'OPTIONAL NFT MINT'}</b>
            <span>{mintable ? 'Connect a wallet and confirm one Base transaction. VoxelPop checks for a used voucher first so the same voxel cannot be minted twice through this flow.' : 'Minting needs the finished voxel to be securely linked to your account first.'}</span>
            <button className={styles.primaryPurple} type="button" onClick={mintPropertyVoxel} disabled={!mintable || Boolean(busy)}>{pendingMint ? (busy === 'mint-verify' ? 'Verifying existing mint…' : 'Resume mint verification') : busy ? 'Working…' : 'Mint this 3D voxel on Base'}</button>
          </>}
        </section>

        <div className={styles.autoPanel}><b>PLACE IT IN MY WORLD · OPTIONAL</b><span>Mapping is separate from minting. Add the address only if you want this digital voxel placed against source-backed location/building data.</span></div>
        {!mapped ? <form className={styles.searchForm} onSubmit={mapBuilding}>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/>
          <button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Matching building…' : 'Place this voxel in My World'}</button>
        </form> : <>
          <div className={styles.worldCard}><PropertyWorldMap selectedBuilding={building} buildings={atlasBuildings}/><span className={styles.worldBadge}>{building?.geometry ? 'SOURCE-BACKED BUILDING FOOTPRINT' : 'VERIFIED LOCATION REFERENCE'}</span></div>
          {voxelPoster ? <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelPoster} alt="VoxelPop building preview"/></div> : null}
          <section className={styles.donePanel}>
            <b>{mappedAddress}</b>
            <span>{building?.geometry ? 'Building footprint matched from map data.' : 'Location matched; an exact building footprint was not available from the map source.'}</span>
            {!savedDraft ? <button className={styles.primaryTeal} type="button" onClick={saveToMyWorld} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save to My World'}</button> : <>
              <div className={styles.doneMark}>✓</div>
              <span>Saved to My World{mintResult?.tokenId ? ` · VoxelFlip #${mintResult.tokenId}` : ' · not minted'}.</span>
              <a className={styles.primaryLink} href="/world">View My World</a>
              <a className={styles.secondaryLink} href="/vault/property-drafts">Open My Vault</a>
            </>}
            <button className={styles.textButton} type="button" onClick={changeAddress}>Use a different address</button>
          </section>
        </>}
        <p className={styles.truth}>3D picture ≠ 3D voxel ≠ NFT ≠ deed. Each is a separate step. The NFT represents only the digital voxel; physical-property ownership remains governed by ordinary legal title records.</p>
      </> : null}

      {step > 1 ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
