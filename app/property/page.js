'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import PlanetStreamGlobe from '../vault/earth/PlanetStreamGlobe';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import {
  readPropertyCheckoutPhoto,
  removePropertyCheckoutPhoto,
  savePropertyCheckoutPhoto,
} from '../../lib/property-checkout-photo-client';
import styles from './property.module.css';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, thumbnailUrl: null, taskId: null });
const emptyImage = () => ({ status: 'NOT_STARTED', progress: 0, imageUrl: null, taskId: null, taskToken: null });
const CREATION_PRICE_LABEL = '$4.99';

function clean(value) { return String(value || '').trim(); }
function terminal(value) {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(String(value || '').toUpperCase());
}
function providerNeedsFunds(value) {
  return /insufficient (funds|credits)|credit balance|not enough credits/i.test(String(value || ''));
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
async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('HEIC preview could not be decoded.'));
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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Photo conversion failed.');
    const filename = String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], filename || 'property-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
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
function buildingHeightMeters(building) {
  if (typeof building?.height === 'number') return Number(building.height || 0);
  const value = Number(
    building?.height?.referenceHeightMeters
    ?? building?.height?.heightMeters
    ?? building?.height?.estimatedHeightMeters
    ?? building?.tags?.height
    ?? (Number(building?.tags?.['building:levels'] || 0) * 3),
  );
  return Number.isFinite(value) ? value : 0;
}
function dollars(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
}

export default function PropertyJourneyPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sourceReference, setSourceReference] = useState(null);
  const [source3d, setSource3d] = useState(empty3d);
  const [voxelJob, setVoxelJob] = useState(emptyImage);
  const [voxelImage, setVoxelImage] = useState('');
  const [final3d, setFinal3d] = useState(empty3d);
  const [pipelinePhase, setPipelinePhase] = useState('photo');
  const [address, setAddress] = useState('');
  const [mappedAddress, setMappedAddress] = useState('');
  const [building, setBuilding] = useState(null);
  const [quote, setQuote] = useState(null);
  const [availability, setAvailability] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);
  const pipelineRef = useRef(0);
  const checkoutHandledRef = useRef('');

  const mapVoxelMode = pipelinePhase === 'map-voxel';
  const finalReady = Boolean(final3d?.modelUrl) || mapVoxelMode;
  const sourceReady = Boolean(source3d?.modelUrl) || mapVoxelMode;
  const mapped = Boolean(building && mappedAddress);
  const step = !sourceReference ? 1 : !sourceReady ? 2 : !finalReady ? 3 : !mapped ? 4 : 5;
  const labels = ['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'];
  const worldListing = useMemo(() => {
    if (!building) return [];
    return [{
      id: 'my-voxel-preview',
      kind: 'community-property',
      label: mappedAddress || building?.tags?.name || 'MY VOXEL · PREVIEW',
      latitude: Number(building.latitude),
      longitude: Number(building.longitude),
      heightMeters: buildingHeightMeters(building),
      geometry: building.geometry || null,
      geometryKind: building.geometry ? 'source-backed-building' : 'location-reference',
      fidelity: mapVoxelMode ? 'source-backed-map-voxel' : 'private-world-preview',
      mapVoxel: mapVoxelMode,
      minted: false,
      rightsVerified: false,
    }];
  }, [building, mapVoxelMode, mappedAddress]);

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
        setMessage('Signed in. Choose one photo to begin.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Choose one photo to begin.');
        } else {
          setMessage('Sign in to start.');
        }
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
    if (!session?.access_token || typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    const canceled = params.get('generation_checkout') === 'cancelled';
    const canceledDraftId = clean(params.get('draftId'));
    if (canceled && canceledDraftId) {
      const cancelKey = `cancel:${canceledDraftId}`;
      if (checkoutHandledRef.current === cancelKey) return undefined;
      checkoutHandledRef.current = cancelKey;
      setBusy('');
      setMessage('Enhanced 3D checkout canceled. Your no-credit Map Voxel option is still available.');
      removePropertyCheckoutPhoto(canceledDraftId).catch(() => {});
      fetch(`/api/property-generation/checkout?draftId=${encodeURIComponent(canceledDraftId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {});
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    const returnDraftId = clean(params.get('draftId'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    const iteration = ++pipelineRef.current;
    setBusy('payment-return');
    setMessage('Payment received. Starting your optional enhanced VoxelPop 3D creation…');

    (async () => {
      try {
        const checkoutPhoto = returnDraftId ? await readPropertyCheckoutPhoto(returnDraftId) : null;
        const form = new FormData();
        form.append('generationSessionId', generationSessionId);
        if (checkoutPhoto) form.append('photo', checkoutPhoto);
        const response = await fetch('/api/property-photo-upload', {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.reference?.storagePath) {
          throw new Error(data?.error || 'Your paid enhanced 3D creation could not start.');
        }
        if (!active) return;
        if (returnDraftId) removePropertyCheckoutPhoto(returnDraftId).catch(() => {});
        setDraftId(data.draftId);
        setSourceReference(data.reference);
        setPendingPhoto(null);
        setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
        setRightsConfirmed(false);
        setSource3d(data.source3d || empty3d());
        setVoxelJob(emptyImage());
        setVoxelImage('');
        setFinal3d(empty3d());
        setBuilding(null);
        setMappedAddress('');
        setQuote(null);
        setAvailability('');
        window.history.replaceState({}, '', '/property');
        await runAutomaticBuild(data.reference, iteration);
      } catch (error) {
        if (active && iteration === pipelineRef.current) {
          setBusy('');
          setPipelinePhase('photo');
          setMessage(String(error?.message || error || 'Your paid enhanced VoxelPop creation could not start.'));
        }
      }
    })();

    return () => { active = false; };
  }, [session?.access_token]);

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
      setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(photo); });
      setPendingPhoto(photo);
      setRightsConfirmed(false);
      setMessage('Photo ready. Continue with the no-credit Map Voxel, or choose the optional enhanced AI 3D build.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally { setBusy(''); }
  }

  async function poll3D(taskId, setter, iteration, label) {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      await wait(attempt === 0 ? 1500 : 3000);
      if (iteration !== pipelineRef.current) throw new Error('Creation changed.');
      const response = await fetch(`/api/property-voxel-3d?taskId=${encodeURIComponent(taskId)}`, {
        cache: 'no-store', headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `${label} could not be read.`);
      setter(data);
      if (data?.modelUrl) return data;
      if (terminal(data?.status)) throw new Error(data?.error || `${label} ended with ${data?.status}.`);
      setMessage(`${label}… ${Math.round(Number(data?.progress || 0))}%`);
    }
    throw new Error(`${label} is taking longer than expected. The job is still tied to your account; try again shortly.`);
  }

  async function pollVoxelImage(started, iteration) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2500);
      if (iteration !== pipelineRef.current) throw new Error('Creation changed.');
      const params = new URLSearchParams({ taskId: started.taskId, taskToken: started.taskToken });
      const response = await fetch(`/api/property-voxel-image?${params.toString()}`, {
        cache: 'no-store', headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Voxel style pass failed.');
      setVoxelJob((current) => ({ ...current, ...data, taskToken: started.taskToken }));
      if (data?.imageUrl) return { ...data, taskToken: started.taskToken };
      setMessage(Number(data?.progress) > 0 ? `Turning the 3D into VoxelPop… ${Math.round(Number(data.progress))}%` : 'Turning the 3D into VoxelPop…');
    }
    throw new Error('The voxel style pass is taking longer than expected. Try again shortly.');
  }

  async function runAutomaticBuild(reference, iteration) {
    const activeDraftId = reference?.draftId || draftId;
    if (!activeDraftId) throw new Error('The paid VoxelPop creation ID is missing.');
    setBusy('pipeline');
    let finalCheckpoint = null;
    try {
      setPipelinePhase('source3d');
      setMessage('Building a first 3D model from your photo…');
      const sourceResponse = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId: activeDraftId, phase: 'source', sourceStoragePath: reference.storagePath }),
      });
      const sourceStart = await sourceResponse.json().catch(() => ({}));
      if (!sourceResponse.ok || !sourceStart?.ok || !sourceStart?.taskId) throw new Error(sourceStart?.error || 'The first 3D build could not start.');
      setSource3d(sourceStart);
      const sourceDone = sourceStart.modelUrl ? sourceStart : await poll3D(sourceStart.taskId, setSource3d, iteration, 'Building your first 3D');

      setPipelinePhase('voxel-image');
      setMessage('First 3D ready. Turning it into the VoxelPop look…');
      const imageResponse = await fetch('/api/property-voxel-image', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId: activeDraftId, source3dTaskId: sourceDone.taskId }),
      });
      const imageStart = await imageResponse.json().catch(() => ({}));
      if (!imageResponse.ok || !imageStart?.ok || !imageStart?.taskId || !imageStart?.taskToken) throw new Error(imageStart?.error || 'Voxel style pass could not start.');
      setVoxelJob(imageStart);
      const voxelDone = await pollVoxelImage(imageStart, iteration);
      finalCheckpoint = voxelDone;
      setVoxelImage(voxelDone.imageUrl);

      setPipelinePhase('voxel-3d');
      setMessage('Voxel look ready. Building the final movable 3D voxel…');
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
      if (!finalResponse.ok || !finalStart?.ok || !finalStart?.taskId) {
        const finalError = finalStart?.error || 'Final voxel 3D could not start.';
        throw new Error(providerNeedsFunds(finalError)
          ? 'Final 3D is waiting for Meshy credits. Your finished VoxelPop image is preserved on this page. Add Meshy credits, then tap Resume final 3D.'
          : finalError);
      }
      setFinal3d(finalStart);
      const finalDone = finalStart.modelUrl ? finalStart : await poll3D(finalStart.taskId, setFinal3d, iteration, 'Building your final VoxelPop 3D');
      setFinal3d(finalDone);
      setPipelinePhase('world');
      setMessage('Your enhanced voxel is ready. Add the property address to place the reference on My World.');
    } catch (error) {
      if (iteration === pipelineRef.current) {
        setMessage(String(error?.message || error || 'The automatic build stopped.'));
        setPipelinePhase(finalCheckpoint?.taskId ? 'paused-final' : 'paused');
      }
    } finally {
      if (iteration === pipelineRef.current) setBusy('');
    }
  }

  function continueWithMapVoxel() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    pipelineRef.current += 1;
    const reference = {
      url: pendingPreview || null,
      draftId,
      rightsBasis: 'user-owned',
      rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it as a visual reference for this digital map voxel.',
      label: 'Selected property photo',
      sourcePhotoId: `local-map:${draftId}`,
      provider: 'voxelpop-source-backed-map',
      storagePath: `map-voxel:${draftId}`,
      uploadedAt: new Date().toISOString(),
    };
    setSourceReference(reference);
    setSource3d({ ...empty3d(), status: 'SUCCEEDED', progress: 100, mapVoxel: true });
    setVoxelJob(emptyImage());
    setVoxelImage('');
    setFinal3d({ ...empty3d(), status: 'SUCCEEDED', progress: 100, mapVoxel: true });
    setBuilding(null);
    setMappedAddress('');
    setQuote(null);
    setAvailability('');
    setPipelinePhase('map-voxel');
    setMessage('Map Voxel ready with no AI generation credits. Add the property address to build its source-backed 3D World representation.');
  }

  async function usePhotoAndBuild() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    setMessage(`Opening optional ${CREATION_PRICE_LABEL} enhanced 3D checkout…`);
    try {
      await savePropertyCheckoutPhoto(draftId, pendingPhoto);
      const form = new FormData();
      form.append('photo', pendingPhoto);
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure enhanced 3D checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      await removePropertyCheckoutPhoto(draftId).catch(() => {});
      setMessage(String(error?.message || error || 'Secure enhanced 3D checkout could not open.'));
      setBusy('');
    }
  }

  async function resumeFinal3D() {
    if (!voxelImage || !voxelJob?.taskId || !voxelJob?.taskToken) return retryBuild();
    const iteration = ++pipelineRef.current;
    setBusy('pipeline');
    setPipelinePhase('voxel-3d');
    setMessage('Resuming only the final 3D voxel…');
    try {
      const finalResponse = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          draftId,
          phase: 'voxel',
          voxelImageTaskId: voxelJob.taskId,
          voxelImageTaskToken: voxelJob.taskToken,
        }),
      });
      const finalStart = await finalResponse.json().catch(() => ({}));
      if (!finalResponse.ok || !finalStart?.ok || !finalStart?.taskId) {
        const finalError = finalStart?.error || 'Final voxel 3D could not start.';
        throw new Error(providerNeedsFunds(finalError)
          ? 'Meshy still needs credits for the final 3D step. Your completed VoxelPop image is still preserved here; add credits, then tap Resume final 3D again.'
          : finalError);
      }
      setFinal3d(finalStart);
      const finalDone = finalStart.modelUrl ? finalStart : await poll3D(finalStart.taskId, setFinal3d, iteration, 'Building your final VoxelPop 3D');
      setFinal3d(finalDone);
      setPipelinePhase('world');
      setMessage('Your enhanced voxel is ready. Add the property address to place the reference on My World.');
    } catch (error) {
      if (iteration === pipelineRef.current) {
        const text = String(error?.message || error || 'Final voxel 3D could not resume.');
        setMessage(providerNeedsFunds(text)
          ? 'Meshy still needs credits for the final 3D step. Your completed VoxelPop image is still preserved here; add credits, then tap Resume final 3D again.'
          : text);
        setPipelinePhase('paused-final');
      }
    } finally {
      if (iteration === pipelineRef.current) setBusy('');
    }
  }

  async function retryBuild() {
    if (pipelinePhase === 'paused-final' && voxelImage && voxelJob?.taskId && voxelJob?.taskToken) return resumeFinal3D();
    if (!sourceReference || mapVoxelMode) return;
    const iteration = ++pipelineRef.current;
    setSource3d(empty3d());
    setVoxelJob(emptyImage());
    setVoxelImage('');
    setFinal3d(empty3d());
    await runAutomaticBuild(sourceReference, iteration);
  }

  async function placeOnWorld(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !finalReady) return;
    setBusy('map');
    setMessage('Checking the address and placing the reference on My World…');
    try {
      const params = new URLSearchParams({ address: value, radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const atlas = await response.json().catch(() => ({}));
      if (!response.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped.');
      const selected = selectedOrLocation(atlas, value);
      if (!selected) throw new Error('That address resolved without a usable World location.');
      setBuilding(selected);
      setMappedAddress(value);
      setQuote(null);
      setAvailability('');

      if (!selected.mappedIdentityReady || String(selected.atlasId || '').startsWith('location:')) {
        setMessage('World preview ready. We found the location, but not a source-backed building identity, so collection stays unavailable.');
        return;
      }
      const quoteResponse = await fetch('/api/property-collectible/quote', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: value, atlasId: selected.atlasId }),
      });
      const priced = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok || !priced?.ok) throw new Error(priced?.error || 'The voxel collection price could not be verified.');
      setQuote(priced.quote);
      setAvailability(priced.availability || 'AVAILABLE');
      setMessage(priced.sold ? 'This mapped digital voxel has already been collected.' : 'My World preview ready. The selected building is focused automatically; collect it if it looks right.');
    } catch (error) {
      setMessage(String(error?.message || error || 'World placement failed.'));
    } finally { setBusy(''); }
  }

  async function collectAndSave() {
    if (!quote || !building?.atlasId || !session?.access_token) return;
    if (!mapVoxelMode && !final3d?.taskId) return;
    setBusy('checkout');
    setMessage('Opening secure checkout for the digital voxel…');
    try {
      const response = await fetch('/api/property-collectible/checkout', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          address: mappedAddress,
          atlasId: building.atlasId,
          draftId,
          representationKind: mapVoxelMode ? 'map-voxel' : 'generated-3d',
          ...(mapVoxelMode ? {} : { modelTaskId: final3d.taskId }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(String(error?.message || error || 'Checkout could not open.'));
      setBusy('');
    }
  }

  function resetCreation() {
    pipelineRef.current += 1;
    removePropertyCheckoutPhoto(draftId).catch(() => {});
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setSourceReference(null);
    setSource3d(empty3d());
    setVoxelJob(emptyImage());
    setVoxelImage('');
    setFinal3d(empty3d());
    setPipelinePhase('photo');
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setQuote(null);
    setAvailability('');
    setBusy('');
    setMessage('Choose one photo to begin.');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1><section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing uploads, generates, or charges before sign-in.</small></section></section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>One account keeps your creations, Vault, My World items, and optional mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>A wallet is optional until you choose the separate Verify &amp; Mint step later.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  const displaySource = pendingPreview || sourceReference?.url || '';
  const pipelineRunning = busy === 'pipeline' || ['source3d', 'voxel-image', 'voxel-3d'].includes(pipelinePhase);

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${step} of 5`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 5 · {labels[step - 1]}</p>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>{pendingPhoto ? 'Ready to map it?' : 'Choose one photo.'}</p>
        <p className={styles.flowHint}>Photo → Map Voxel → My World. No AI credits required. Enhanced AI 3D stays optional.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {displaySource ? <div className={styles.heroCard}><img src={displaySource} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO</span></div> : <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>}
        {pendingPhoto ? <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <span>Map Voxel uses the mapped building footprint/location and available height evidence. It does not spend Meshy credits.</span>
          <button className={styles.primaryPurple} type="button" onClick={continueWithMapVoxel} disabled={!rightsConfirmed}>Continue with Map Voxel · no AI credits</button>
          <button className={styles.primaryOrange} type="button" onClick={usePhotoAndBuild} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening $4.99 checkout…' : 'Optional enhanced AI 3D · $4.99'}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another</button>
        </div> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>}
        <p className={styles.truth}>The no-credit Map Voxel is a digital map representation built from source-backed location/footprint/height evidence when available; it is not an AI reconstruction of unseen building details. Optional {CREATION_PRICE_LABEL} enhanced AI 3D uses a separate provider. For that optional checkout, the source photo stays on your device across Stripe and is fingerprint-verified afterward—Voxel Vault no longer creates a private checkout photo bucket. Neither path buys or values the physical property.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Building the first 3D.</p>
        <p className={styles.stepCopy}>Payment is verified. VoxelPop is making an optional enhanced 3D interpretation from your authorized photo. When it finishes, the voxel step starts automatically.</p>
        <div className={styles.heroCard}>{source3d?.modelUrl ? <MeshyModelViewer modelUrl={source3d.modelUrl}/> : displaySource ? <img src={displaySource} alt="Source being turned into 3D"/> : null}<span className={styles.badge}>PAID 3D BUILD · {Math.round(Number(source3d?.progress || 0))}%</span><div className={styles.buildPulse}/></div>
        <div className={styles.autoPanel}><b>AUTOMATIC BUILD</b><span>No extra button. First 3D → VoxelPop look → final 3D voxel.</span></div>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>{pipelinePhase === 'paused-final' ? 'Voxel image ready. Final 3D is paused.' : pipelinePhase === 'voxel-3d' ? 'Building the final 3D voxel.' : 'Making the VoxelPop version.'}</p>
        <p className={styles.stepCopy}>The optional enhanced VoxelPop style pass uses the generated 3D preview, then creates one final movable 3D voxel.</p>
        <div className={styles.heroCard}>
          {final3d?.modelUrl ? <MeshyModelViewer modelUrl={final3d.modelUrl}/> : voxelImage ? <img src={voxelImage} alt="VoxelPop property rendering"/> : source3d?.modelUrl ? <MeshyModelViewer modelUrl={source3d.modelUrl}/> : null}
          <span className={styles.badge}>{pipelinePhase === 'voxel-3d' ? `FINAL 3D VOXEL · ${Math.round(Number(final3d?.progress || 0))}%` : `VOXEL LOOK · ${Math.round(Number(voxelJob?.progress || 0))}%`}</span>
          {pipelineRunning ? <div className={styles.buildPulse}/> : null}
        </div>
        {pipelinePhase === 'paused-final' ? <div className={styles.choicePanel}><b>VoxelPop image complete.</b><span>The finished image stays here. Resume only the final 3D step after the 3D provider has credits available.</span><button className={styles.primaryOrange} type="button" onClick={resumeFinal3D}>Resume final 3D</button></div> : pipelinePhase === 'paused' ? <div className={styles.choicePanel}><b>The automatic build paused.</b><button className={styles.primaryOrange} type="button" onClick={retryBuild}>Try build again</button></div> : <div className={styles.autoPanel}><b>AUTOMATIC</b><span>Keep this page open while the current build finishes.</span></div>}
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Add the property address.</p>
        <p className={styles.stepCopy}>{mapVoxelMode ? 'Enter the address so VoxelPop can find the source-backed building and build its no-credit 3D map voxel.' : 'Enter the address for the property shown in your photo. We use it to place this digital representation on the map and check its mapped identity.'}</p>
        <div className={styles.heroCard}>{mapVoxelMode ? (displaySource ? <img src={displaySource} alt="Property reference for map voxel"/> : null) : <MeshyModelViewer modelUrl={final3d.modelUrl}/>}<span className={styles.badge}>{mapVoxelMode ? 'MAP VOXEL · NO AI CREDITS' : 'VOXEL READY'}</span></div>
        <form className={styles.searchForm} onSubmit={placeOnWorld}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Checking address…' : 'Verify address + preview'}</button></form>
        <small className={styles.mapNote}>The address helps locate the reference. It is not proof of ownership, title, property value, or an investment offering.</small>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Your World preview.</p>
        <p className={styles.stepCopy}>{mapVoxelMode ? 'Your selected building is focused automatically in the 3D World. Drag, pinch, zoom, or tap FOCUS to return to it.' : 'This preview is private to your account. It is not published publicly unless you choose to share it later from Vault.'}</p>
        <div className={styles.worldCard}><PlanetStreamGlobe listings={worldListing} selectedId="my-voxel-preview" simpleMode/><span className={styles.worldBadge}>MY WORLD · PRIVATE PREVIEW</span></div>
        {mapVoxelMode ? <div className={styles.miniModel}>{displaySource ? <img src={displaySource} alt="Source photo for map voxel" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}</div> : <div className={styles.miniModel}><MeshyModelViewer modelUrl={final3d.modelUrl}/></div>}
        <div className={styles.priceCard}>
          <div><small>{mapVoxelMode ? 'DIGITAL MAP VOXEL' : 'DIGITAL VOXEL'}</small><b>{quote?.label || 'World preview'}</b><span>{mappedAddress}</span></div>
          <strong>{quote ? dollars(quote.priceCents) : '—'}</strong>
          {quote ? <p>{quote.explanation} This is the price of the digital voxel—not the market value of the house or land.</p> : null}
          {availability === 'SOLD' ? <div className={styles.sold}>ALREADY COLLECTED · THIS MAPPED DIGITAL VOXEL IS ONE-OF-ONE</div> : null}
          {!quote && !building?.mappedIdentityReady ? <div className={styles.sold}>PREVIEW ONLY · A SOURCE-BACKED BUILDING ID IS NEEDED BEFORE COLLECTION</div> : null}
          {quote && availability !== 'SOLD' ? <button className={styles.primaryOrange} type="button" onClick={collectAndSave} disabled={busy === 'checkout'}>{busy === 'checkout' ? 'Opening secure checkout…' : `Collect voxel · ${dollars(quote.priceCents)}`}</button> : null}
          <button className={styles.textButton} type="button" onClick={() => { setBuilding(null); setMappedAddress(''); setQuote(null); setAvailability(''); setMessage('Enter the correct property address.'); }}>Change address</button>
        </div>
        <p className={styles.truth}>{mapVoxelMode ? 'The Map Voxel path uses no Meshy generation credits and stores the mapped representation rather than a generated GLB.' : `The ${CREATION_PRICE_LABEL} enhanced generation payment covers creating the optional AI-generated VoxelPop model.`} Any collection price shown here is a separate digital-collectible purchase and is not the market value of the physical property. Payment or optional minting does not create deed/title, rent, occupancy, fractional investment, appreciation, or other rights in the physical property. Real-property investing can only appear through a separately verified offering.</p>
      </> : null}

      {step > 1 && !pipelineRunning ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
