'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GeoReferenceModel from '../geo/GeoReferenceModel';
import PlanetStreamGlobe from '../vault/earth/PlanetStreamGlobe';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './property.module.css';

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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Photo conversion failed.');
    const filename = String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], filename || 'property-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function makeLocalVoxelPreview(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This photo could not be rendered on this device.'));
    });

    const sourceWidth = Math.max(1, image.naturalWidth || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || 1);
    const sourceSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, (sourceWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (sourceHeight - sourceSize) / 2);

    const voxelCanvas = document.createElement('canvas');
    const sampleSize = 88;
    voxelCanvas.width = sampleSize;
    voxelCanvas.height = sampleSize;
    const voxelContext = voxelCanvas.getContext('2d', { willReadFrequently: true });
    if (!voxelContext) throw new Error('Voxel preview is unavailable on this device.');
    voxelContext.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, sampleSize, sampleSize);

    const pixels = voxelContext.getImageData(0, 0, sampleSize, sampleSize);
    const quantize = 34;
    for (let index = 0; index < pixels.data.length; index += 4) {
      const r = pixels.data[index];
      const g = pixels.data[index + 1];
      const b = pixels.data[index + 2];
      const average = (r + g + b) / 3;
      const contrast = average < 118 ? 0.93 : 1.06;
      pixels.data[index] = Math.max(0, Math.min(255, Math.round((r * contrast) / quantize) * quantize));
      pixels.data[index + 1] = Math.max(0, Math.min(255, Math.round((g * contrast) / quantize) * quantize));
      pixels.data[index + 2] = Math.max(0, Math.min(255, Math.round((b * contrast) / quantize) * quantize));
    }
    voxelContext.putImageData(pixels, 0, 0);

    const output = document.createElement('canvas');
    output.width = 576;
    output.height = 576;
    const outputContext = output.getContext('2d');
    if (!outputContext) throw new Error('Voxel preview could not be finished.');
    outputContext.imageSmoothingEnabled = false;
    outputContext.fillStyle = '#e8e5df';
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(voxelCanvas, 0, 0, output.width, output.height);

    const vignette = outputContext.createRadialGradient(288, 240, 120, 288, 288, 410);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(22,16,13,0.12)');
    outputContext.fillStyle = vignette;
    outputContext.fillRect(0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.8);
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
function previewStorageKey(draftId) { return `voxelpop-preview:${clean(draftId)}`; }

export default function PropertyJourneyPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sourceReference, setSourceReference] = useState(null);
  const [voxelImage, setVoxelImage] = useState('');
  const [atlas, setAtlas] = useState(null);
  const [address, setAddress] = useState('');
  const [mappedAddress, setMappedAddress] = useState('');
  const [building, setBuilding] = useState(null);
  const [worldConfirmed, setWorldConfirmed] = useState(false);
  const [quote, setQuote] = useState(null);
  const [availability, setAvailability] = useState('');
  const [mapView, setMapView] = useState('orbit');
  const [mapReset, setMapReset] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);

  const step = !sourceReference ? 1 : !voxelImage ? 2 : !mappedAddress ? 3 : !worldConfirmed ? 4 : 5;
  const labels = ['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'];
  const mapReference = useMemo(() => {
    if (!atlas?.reference) return null;
    return {
      ...atlas.reference,
      radiusMeters: atlas.radiusMeters || atlas.reference.radiusMeters || 180,
      neighborhoodBuildingCount: Number(atlas.buildingCount || atlas.reference?.neighborhoodBuildings?.length || 0),
    };
  }, [atlas]);
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
      fidelity: 'private-world-preview',
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
    if (!session?.access_token || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('generation_session') && !params.has('generation_checkout')) return;
    window.history.replaceState({}, '', '/property');
    setMessage('VoxelPop creation now runs without a pre-generation checkout or Meshy credits. Choose a photo to use the new on-device preview and source-backed 3D map.');
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
      setMessage('Photo ready. Confirm you can use it, then VoxelPop makes the preview on this device—no Meshy credits or generation checkout.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally { setBusy(''); }
  }

  async function usePhotoAndBuild() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('local-build');
    setSourceReference({ draftId, local: true });
    setMessage('Building the VoxelPop preview on your iPhone…');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 240));
      const preview = await makeLocalVoxelPreview(pendingPhoto);
      setVoxelImage(preview);
      try { window.localStorage.setItem(previewStorageKey(draftId), preview); } catch {}
      setPendingPhoto(null);
      setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
      setRightsConfirmed(false);
      setMessage('VoxelPop preview ready. Add the property address to build its source-backed interactive 3D map.');
    } catch (error) {
      setSourceReference(null);
      setMessage(String(error?.message || error || 'The local VoxelPop preview could not be created.'));
    } finally { setBusy(''); }
  }

  async function placeOnWorld(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value || !voxelImage) return;
    setBusy('map');
    setMessage('Finding the mapped building and building its 3D neighborhood…');
    try {
      const params = new URLSearchParams({ address: value, radius: '180' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const nextAtlas = await response.json().catch(() => ({}));
      if (!response.ok || !nextAtlas?.ok) throw new Error(nextAtlas?.error || 'That property could not be mapped.');
      const selected = selectedOrLocation(nextAtlas, value);
      if (!selected) throw new Error('That address resolved without a usable World location.');
      setAtlas(nextAtlas);
      setBuilding(selected);
      setMappedAddress(value);
      setWorldConfirmed(false);
      setMapView('orbit');
      setMapReset((current) => current + 1);
      setQuote(null);
      setAvailability('');

      if (!selected.mappedIdentityReady || String(selected.atlasId || '').startsWith('location:')) {
        setMessage('3D location preview ready. A source-backed building footprint was not found, so collection stays unavailable.');
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
      setMessage(priced.sold
        ? 'Interactive 3D map ready. This mapped digital voxel has already been collected.'
        : 'Interactive 3D map ready. Drag, pinch, switch views, then place it in My World.');
    } catch (error) {
      setMessage(String(error?.message || error || 'World placement failed.'));
    } finally { setBusy(''); }
  }

  function confirmWorldPreview() {
    if (!building || !mappedAddress) return;
    setWorldConfirmed(true);
    setMessage('Added to your private My World preview. Collecting it is optional.');
  }

  async function collectAndSave() {
    if (!quote || !building?.atlasId || !draftId || !session?.access_token) return;
    setBusy('checkout');
    setMessage('Opening secure checkout for the digital voxel…');
    try {
      const modelTaskId = `map-voxel:${draftId}`;
      const response = await fetch('/api/property-collectible/checkout', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          address: mappedAddress,
          atlasId: building.atlasId,
          draftId,
          modelTaskId,
          modelKind: 'source-backed-map-3d',
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
    const previousDraftId = draftId;
    setDraftId(newDraftId());
    setPendingPhoto(null);
    setPendingPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setRightsConfirmed(false);
    setSourceReference(null);
    setVoxelImage('');
    setAtlas(null);
    setAddress('');
    setMappedAddress('');
    setBuilding(null);
    setWorldConfirmed(false);
    setQuote(null);
    setAvailability('');
    setMapView('orbit');
    setMapReset(0);
    setBusy('');
    setMessage('Choose one photo to begin.');
    try { window.localStorage.removeItem(previewStorageKey(previousDraftId)); } catch {}
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

  const displaySource = pendingPreview || '';
  const sourceAuthority = clean(building?.source?.authority || atlas?.reference?.source?.authority) || 'Open map data';
  const pipelineRunning = busy === 'local-build' || busy === 'map';

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP · PROPERTY</div>
      <h1>Build your world.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} aria-label={`Step ${step} of 5`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 5 · {labels[step - 1]}</p>

      {step === 1 ? <>
        <p className={styles.bigPrompt}>{pendingPhoto ? 'Ready to voxel it?' : 'Choose one photo.'}</p>
        <p className={styles.flowHint}>Photo → VoxelPop preview → source-backed 3D map → My World → optional collection.</p>
        <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
        {displaySource ? <div className={styles.heroCard}><img src={displaySource} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO</span></div> : <div className={styles.photoDrop} onClick={choosePhoto} role="button" tabIndex={0}><div>+</div><b>Choose a property photo</b><span>iPhone photos supported</span></div>}
        {pendingPhoto ? <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <span>Preview is made on this device · no Meshy credits · no generation checkout.</span>
          <button className={styles.primaryPurple} type="button" onClick={usePhotoAndBuild} disabled={!rightsConfirmed || busy === 'local-build'}>{busy === 'local-build' ? 'Building preview…' : 'Use photo → make VoxelPop preview'}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Choose another</button>
        </div> : <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing photo…' : 'Choose photo'}</button>}
        <p className={styles.truth}>Your source photo stays on this device for this preview and is not staged in Voxel Vault checkout storage. The VoxelPop image is a stylized visual preview; one photo cannot verify unseen sides, exact dimensions, roof details, title, ownership, or property value.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>Building your VoxelPop preview.</p>
        <p className={styles.stepCopy}>This lightweight pass runs in your browser, so it does not spend Meshy credits or wait for a paid 3D provider.</p>
        <div className={styles.heroCard}>{displaySource ? <img src={displaySource} alt="Photo being transformed into a VoxelPop preview"/> : null}<span className={styles.badge}>ON-DEVICE BUILD</span><div className={styles.buildPulse}/></div>
        <div className={styles.autoPanel}><b>NO PROVIDER CREDITS</b><span>Your interactive 3D comes next from source-backed map geometry.</span></div>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>Voxel look ready.</p>
        <p className={styles.stepCopy}>Now add the address for the property in your photo. Voxel Vault will build an interactive 3D neighborhood from mapped building footprints instead of buying another AI generation.</p>
        <div className={`${styles.heroCard} ${styles.voxelPreview}`}><img src={voxelImage} alt="Local VoxelPop property preview"/><span className={styles.badge}>VOXEL LOOK · LOCAL</span></div>
        <form className={styles.searchForm} onSubmit={placeOnWorld}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" aria-label="Property address" autoComplete="street-address"/><button disabled={busy === 'map' || !clean(address)}>{busy === 'map' ? 'Building 3D map…' : 'Build 3D map + verify address'}</button></form>
        <small className={styles.mapNote}>The address locates the map reference. It is not proof of ownership, title, property value, or an investment offering.</small>
      </> : null}

      {step === 4 ? <>
        <p className={styles.bigPrompt}>Explore it in 3D.</p>
        <p className={styles.stepCopy}>This is the mapped neighborhood around {mappedAddress}. Drag to orbit, pinch to zoom, or switch camera views. Building footprints and nearby map context are source-backed; unsupported facade details are not invented.</p>
        <div className={styles.mapStage}>
          {mapReference ? <GeoReferenceModel reference={mapReference} viewMode={mapView} resetKey={mapReset}/> : null}
          <span className={styles.worldBadge}>SOURCE-BACKED 3D MAP</span>
        </div>
        <div className={styles.mapControls} aria-label="3D map camera controls">
          {['orbit', 'street', 'top'].map((mode) => <button key={mode} type="button" className={mapView === mode ? styles.mapControlOn : ''} onClick={() => setMapView(mode)}>{mode.toUpperCase()}</button>)}
          <button type="button" onClick={() => setMapReset((current) => current + 1)}>RESET</button>
        </div>
        <div className={styles.mapFacts}>
          <div><small>MAP SOURCE</small><b>{sourceAuthority}</b></div>
          <div><small>NEARBY BUILDINGS</small><b>{Number(atlas?.buildingCount || 0)}</b></div>
          <div><small>SELECTED</small><b>{building?.mappedIdentityReady ? 'SOURCE-BACKED' : 'LOCATION ONLY'}</b></div>
        </div>
        <button className={styles.primaryTeal} type="button" onClick={confirmWorldPreview}>Place this preview in My World</button>
        <button className={styles.textButton} type="button" onClick={() => { setMappedAddress(''); setAtlas(null); setBuilding(null); setQuote(null); setAvailability(''); setWorldConfirmed(false); setMessage('Enter the correct property address.'); }}>Change address</button>
        <p className={styles.truth}>The 3D map uses mapped geometry and contextual evidence, not the photo as a survey. Height can be source-reported, derived, or illustrative where the source does not provide a measured height.</p>
      </> : null}

      {step === 5 ? <>
        <p className={styles.bigPrompt}>Your World preview.</p>
        <p className={styles.stepCopy}>Your mapped voxel is now shown in a private World preview. It is not published publicly unless you choose to share it later from Vault.</p>
        <div className={styles.worldCard}><PlanetStreamGlobe listings={worldListing} selectedId="my-voxel-preview" simpleMode/><span className={styles.worldBadge}>MY WORLD · PRIVATE PREVIEW</span></div>
        <div className={`${styles.miniModel} ${styles.voxelMini}`}><img src={voxelImage} alt="VoxelPop preview thumbnail"/></div>
        <div className={styles.priceCard}>
          <div><small>DIGITAL VOXEL</small><b>{quote?.label || 'World preview'}</b><span>{mappedAddress}</span></div>
          <strong>{quote ? dollars(quote.priceCents) : '—'}</strong>
          {quote ? <p>{quote.explanation} This is the optional collection price for the digital map-backed voxel—not the market value of the house or land.</p> : null}
          {availability === 'SOLD' ? <div className={styles.sold}>ALREADY COLLECTED · THIS MAPPED DIGITAL VOXEL IS ONE-OF-ONE</div> : null}
          {!quote && !building?.mappedIdentityReady ? <div className={styles.sold}>PREVIEW ONLY · A SOURCE-BACKED BUILDING ID IS NEEDED BEFORE COLLECTION</div> : null}
          {quote && availability !== 'SOLD' ? <button className={styles.primaryOrange} type="button" onClick={collectAndSave} disabled={busy === 'checkout'}>{busy === 'checkout' ? 'Opening secure checkout…' : `Collect voxel · ${dollars(quote.priceCents)}`}</button> : null}
          <button className={styles.textButton} type="button" onClick={() => { setWorldConfirmed(false); setMessage('Back in the interactive 3D map.'); }}>Back to 3D map</button>
          <button className={styles.textButton} type="button" onClick={() => { setMappedAddress(''); setAtlas(null); setBuilding(null); setQuote(null); setAvailability(''); setWorldConfirmed(false); setMessage('Enter the correct property address.'); }}>Change address</button>
        </div>
        <p className={styles.truth}>Creation itself does not require Meshy credits or a pre-generation payment. If you choose Collect, that separate checkout purchases the digital VoxelPop collectible only. The photo, map, payment, World marker, or optional later mint does not create deed/title, rent, occupancy, fractional investment, appreciation, or other rights in the physical property.</p>
      </> : null}

      {step > 1 && !pipelineRunning ? <button className={styles.change} type="button" onClick={resetCreation}>Start over with another photo</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
