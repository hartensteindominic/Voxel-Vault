'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import PlanetStreamGlobe from '../vault/earth/PlanetStreamGlobe';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './property.module.css';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, thumbnailUrl: null, taskId: null });
const emptyImage = () => ({ status: 'NOT_STARTED', progress: 0, imageUrl: null, taskId: null, taskToken: null });

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

  const finalReady = Boolean(final3d?.modelUrl);
  const sourceReady = Boolean(source3d?.modelUrl);
  const mapped = Boolean(building && mappedAddress);
  const step = !sourceReference ? 1 : !sourceReady ? 2 : !finalReady ? 3 : !mapped ? 4 : 5;
  const labels = ['PHOTO', '3D', 'VOXEL', 'WORLD', 'BUY'];
  const worldListing = useMemo(() => {
    if (!building) return [];
    return [{
      id: 'my-voxel-preview',
      kind: 'community-property',
      label: 'MY VOXEL · PREVIEW',
      latitude: Number(building.latitude),
      longitude: Number(building.longitude),
      geometry: building.geometry || null,
      geometryKind: building.geometry ? 'source-backed-building' : 'location-reference',
      fidelity: 'private-purchase-preview',
      minted: false,
      rightsVerified: false,
    }];
  }, [building]);

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
        setMessage('Signed in. Add one photo to begin.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Signed in. Add one photo to begin.');
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
      setMessage('Photo ready. Confirm you can use it, then VoxelPop takes over.');
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
    throw new Error(`${label} is taking longer than expected. Your provider job is still account-bound; try again shortly.`);
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
    setBusy('pipeline');
    try {
      setPipelinePhase('source3d');
      setMessage('Building the first 3D version from your photo…');
      const sourceResponse = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, phase: 'source', sourceStoragePath: reference.storagePath }),
      });
      const sourceStart = await sourceResponse.json().catch(() => ({}));
      if (!sourceResponse.ok || !sourceStart?.ok || !sourceStart?.taskId) throw new Error(sourceStart?.error || 'The first 3D build could not start.');
      setSource3d(sourceStart);
      const sourceDone = sourceStart.modelUrl ? sourceStart : await poll3D(sourceStart.taskId, setSource3d, iteration, 'Building your first 3D');

      setPipelinePhase('voxel-image');
      setMessage('3D ready. Now turning that 3D into your VoxelPop style…');
      const imageResponse = await fetch('/api/property-voxel-image', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, source3dTaskId: sourceDone.taskId }),
      });
      const imageStart = await imageResponse.json().catch(() => ({}));
      if (!imageResponse.ok || !imageStart?.ok || !imageStart?.taskId || !imageStart?.taskToken) throw new Error(imageStart?.error || 'Voxel style pass could not start.');
      setVoxelJob(imageStart);
      const voxelDone = await pollVoxelImage(imageStart, iteration);
      setVoxelImage(voxelDone.imageUrl);

      setPipelinePhase('voxel-3d');
      setMessage('Voxel look ready. Building the final 3D collectible…');
      const finalResponse = await fetch('/api/property-voxel-3d', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          draftId,
          phase: 'voxel',
          voxelImageTaskId: voxelDone.taskId,
          voxelImageTaskToken: voxelDone.taskToken,
        }),
      });
      const finalStart = await finalResponse.json().catch(() => ({}));
      if (!finalResponse.ok || !finalStart?.ok || !finalStart?.taskId) throw new Error(finalStart?.error || 'Final voxel 3D could not start.');
      setFinal3d(finalStart);
      const finalDone = finalStart.modelUrl ? finalStart : await poll3D(finalStart.taskId, setFinal3d, iteration, 'Building your final VoxelPop 3D');
      setFinal3d(finalDone);
      setPipelinePhase('world');
      setMessage('Your voxel is ready. Now put it on My World.');
    } catch (error) {
      if (iteration === pipelineRef.current) {
        setMessage(String(error?.message || error || 'The automatic build stopped.'));
        setPipelinePhase('paused');
      }
    } finally {
      if (iteration === pipelineRef.current) setBusy('');
    }
  }

  async function usePhotoAndBuild() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    const iteration = ++pipelineRef.current;
    setBusy('upload');
    setMessage('Saving your photo privately…');
    try {
      const form = new FormData();
      form.append('photo', pendingPhoto);
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.reference?.storagePath) throw new Error(data?.error || 'Photo upload failed.');
      setSourceReference(data.reference);
      setPendingPhoto(null);
      setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
      setSource3d(empty3d());
      setVoxelJob(emptyImage());
      setVoxelImage('');
      setFinal3d(empty3d());
      setBuilding(null);
      setMappedAddress('');
      setQuote(null);
      setAvailability('');
      await runAutomaticBuild(data.reference, iteration);
    } catch (error) {
      if (iteration === pipelineRef.current) setMessage(String(error?.message || error || 'Could not start this creation.'));
    } finally {
      if (iteration === pipelineRef.current && busy !== 'pipeline') setBusy('');
    }
  }

  async function retryBuild() {
    if (!sourceReference) return;
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
    setMessage('Finding its place on My World…');
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
        setMessage('World preview ready. This location does not have a source-backed building identity yet, so once-only checkout stays locked.');
        return;
      }
      const quoteResponse = await fetch('/api/property-collectible/quote', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: value, atlasId: selected.atlasId }),
      });
      const priced = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok || !priced?.ok) throw new Error(priced?.error || 'Digital collectible price could not be verified.');
      setQuote(priced.quote);
      setAvailability(priced.availability || 'AVAILABLE');
      setMessage(priced.sold ? 'This mapped Voxel World property collectible is already owned.' : 'My World preview ready. If you like it, buy it and send it to your Vault.');
    } catch (error) {
      setMessage(String(error?.message || error || 'World placement failed.'));
    } finally { setBusy(''); }
  }

  async function buyAndSave() {
    if (!quote || !building?.atlasId || !final3d?.taskId || !session?.access_token) return;
    setBusy('checkout');
    setMessage('Securing this one-of-one World checkout…');
    try {
      const response = await fetch('/api/property-collectible/checkout', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: mappedAddress, atlasId: building.atlasId, draftId, modelTaskId: final3d.taskId }),
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
    setMessage('Add one photo to begin.');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP · PROPERTY</div><h1>Build your world.</h1><section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Checking your account…</p><small>Nothing uploads, generates or charges before sign-in.</small></section></section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in first.</p>
        <p className={styles.signinCopy}>One account keeps your photo jobs, purchases, Vault and optional wallet mint connected.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button>
        <small>Wallet connection is optional until you decide to mint later.</small>
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
        <p className={styles.bigPrompt}>{pendingPhoto ? 'Use this photo?' : 'Add one photo.'}</p>
        <p className={styles.flowHint}>Photo → automatic 3D → VoxelPop → My World → buy &amp; save.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {displaySource ? <div className={styles.heroCard}><img src={displaySource} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO</span></div> : <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>}
        {pendingPhoto ? <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={usePhotoAndBuild} disabled={!rightsConfirmed || busy === 'upload'}>{busy === 'upload' ? 'Saving photo…' : 'Use photo → build 3D'}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another</button>
        </div> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Upload photo'}</button>}
        <p className={styles.truth}>The photo guides appearance only. A single view cannot verify unseen sides, roof details or exact dimensions.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Making the 3D.</p>
        <p className={styles.stepCopy}>VoxelPop is building a first 3D interpretation from your authorized photo. You do not need to press another generation button.</p>
        <div className={styles.heroCard}>{source3d?.modelUrl ? <MeshyModelViewer modelUrl={source3d.modelUrl}/> : displaySource ? <img src={displaySource} alt="Source being turned into 3D"/> : null}<span className={styles.badge}>3D · {Math.round(Number(source3d?.progress || 0))}%</span><div className={styles.buildPulse}/></div>
        <div className={styles.autoPanel}><b>BUILDING 3D</b><span>When this finishes, the voxel step starts automatically.</span></div>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>{pipelinePhase === 'voxel-3d' ? 'Building the final voxel.' : 'Turning 3D into VoxelPop.'}</p>
        <p className={styles.stepCopy}>The voxel style pass uses the generated 3D preview, then builds one final movable 3D collectible.</p>
        <div className={styles.heroCard}>
          {final3d?.modelUrl ? <MeshyModelViewer modelUrl={final3d.modelUrl}/> : voxelImage ? <img src={voxelImage} alt="VoxelPop property rendering"/> : source3d?.modelUrl ? <MeshyModelViewer modelUrl={source3d.modelUrl}/> : null}
          <span className={styles.badge}>{pipelinePhase === 'voxel-3d' ? `FINAL 3D · ${Math.round(Number(final3d?.progress || 0))}%` : `VOXEL · ${Math.round(Number(voxelJob?.progress || 0))}%`}</span>
          {pipelineRunning ? <div className={styles.buildPulse}/> : null}
        </div>
        {pipelinePhase === 'paused' ? <div className={styles.choicePanel}><b>The automatic build paused.</b><button className={styles.primaryOrange} type="button" onClick={retryBuild}>Try build again</button></div> : <div className={styles.autoPanel}><b>AUTOMATIC</b><span>3D → voxel look → final 3D. Keep this page open while it builds.</span></div>}
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Your voxel is ready.</p>
        <p className={styles.stepCopy}>Now tell us where the real-world reference belongs so you can preview the digital collectible on My World.</p>
        <div className={styles.heroCard}><MeshyModelViewer modelUrl={final3d.modelUrl}/><span className={styles.badge}>VOXEL READY</span></div>
        <form className={styles.searchForm} onSubmit={placeOnWorld}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Placing on World…' : 'Preview on My World'}</button></form>
        <small className={styles.mapNote}>The address is used to resolve a source-backed map identity. It is not used as deed/title proof.</small>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>There it is.</p>
        <p className={styles.stepCopy}>This is your private purchase preview. It is not published to the public World unless you choose that later from Vault.</p>
        <div className={styles.worldCard}><PlanetStreamGlobe listings={worldListing} selectedId="my-voxel-preview" simpleMode/><span className={styles.worldBadge}>MY WORLD · PRIVATE PREVIEW</span></div>
        <div className={styles.miniModel}><MeshyModelViewer modelUrl={final3d.modelUrl}/></div>
        <div className={styles.priceCard}>
          <div><small>DIGITAL COLLECTIBLE</small><b>{quote?.label || 'World preview'}</b><span>{mappedAddress}</span></div>
          <strong>{quote ? dollars(quote.priceCents) : '—'}</strong>
          {quote ? <p>{quote.explanation} This is a digital build price, not a real-estate valuation.</p> : null}
          {availability === 'SOLD' ? <div className={styles.sold}>ALREADY OWNED · THIS WORLD IDENTITY CANNOT BE BOUGHT AGAIN</div> : null}
          {!quote && !building?.mappedIdentityReady ? <div className={styles.sold}>PREVIEW ONLY · SOURCE-BACKED BUILDING IDENTITY REQUIRED TO BUY ONCE-ONLY</div> : null}
          {quote && availability !== 'SOLD' ? <button className={styles.primaryOrange} type="button" onClick={buyAndSave} disabled={busy === 'checkout'}>{busy === 'checkout' ? 'Opening secure checkout…' : `Buy & save · ${dollars(quote.priceCents)}`}</button> : null}
          <button className={styles.textButton} type="button" onClick={() => { setBuilding(null); setMappedAddress(''); setQuote(null); setAvailability(''); setMessage('Choose the correct property location.'); }}>Change location</button>
        </div>
        <p className={styles.truth}>You are buying the generated digital VoxelPop collectible, not the physical house or land. Payment does not create deed/title, rent, occupancy, investment or appreciation rights. Minting is optional later and remains separate from legal property ownership.</p>
      </> : null}

      {step > 1 && !pipelineRunning ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
