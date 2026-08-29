'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { readPropertyDrafts, savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const PRICE = '$4.99';
const PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
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
  return originalDraftId ? loadDevicePhoto(originalDraftId).catch(() => null) : null;
}

function writeContext(draftId, sourceProperty) {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    window.localStorage.setItem(`${CONTEXT_PREFIX}${draftId}`, JSON.stringify({ sourceProperty: sourceProperty || null }));
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
    return new File([blob], String(file.name || 'property-photo.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PropertyJourneySimple() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [sourceProperty, setSourceProperty] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paidSessionId, setPaidSessionId] = useState('');
  const [creationUnlocked, setCreationUnlocked] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [localRecipe, setLocalRecipe] = useState(null);
  const [final3d, setFinal3d] = useState(empty3d);
  const [savedDraft, setSavedDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const clientRef = useRef(null);
  const uploadInputRef = useRef(null);
  const checkoutHandledRef = useRef('');
  const registeringRef = useRef(false);
  const requestedPropertyHandledRef = useRef(false);

  const localReady = final3d.status === 'SUCCEEDED' && Boolean(final3d.taskId && final3d.modelUrl);
  const mintReady = localReady && String(final3d.taskId || '').startsWith('local-v1:');
  const step = localReady ? 4 : previewApproved ? 3 : creationUnlocked ? 2 : 1;
  const labels = ['PHOTO', 'REVIEW', 'BUILD', 'DONE'];

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
        setMessage('Choose one photo to start.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Choose one photo to start.');
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

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined' || requestedPropertyHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'properties' || params.get('generation_session')) return;
    requestedPropertyHandledRef.current = true;
    const propertyId = clean(params.get('property'));
    if (!propertyId) return;
    const property = readPropertyDrafts().find((item) => String(item?.id || '') === propertyId);
    if (!property) {
      setMessage('That saved property is not available on this device. Choose its photo below.');
      return;
    }
    setSourceProperty(property);
    const existingDraftId = clean(property?.voxelpop?.creationDraftId);
    setDraftId(existingDraftId || newDraftId());
    if (property?.voxelpop?.paidCreation) setPaidSessionId('saved-property');
    loadSavedPropertyPhoto(property).then((photo) => {
      if (photo) {
        setPendingPhoto(photo);
        setPreviewFromFile(photo);
        setMessage(property?.voxelpop?.paidCreation ? 'Saved photo loaded. No second creation charge.' : 'Saved photo loaded.');
      } else {
        setMessage(property?.voxelpop?.paidCreation ? 'Choose this property photo again. You will not be charged twice.' : 'Choose a photo for this saved property.');
      }
      window.history.replaceState({}, '', '/property');
    }).catch(() => setMessage('Choose the property photo to continue.'));
  }, [session?.user, setPreviewFromFile]);

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
    setMessage('Preparing your photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This photo is still too large. Try a screenshot or smaller version.');
      setPendingPhoto(photo);
      setPreviewFromFile(photo);
      setRightsConfirmed(false);
      setCreationUnlocked(false);
      setPreviewReady(false);
      setPreviewApproved(false);
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setSavedDraft(null);
      setMessage(paidSessionId ? 'Photo ready. Confirm permission, then continue—already paid.' : `Photo ready. Confirm permission, then pay ${PRICE}.`);
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
      const context = readContext(canceledDraftId);
      if (context?.sourceProperty) setSourceProperty(context.sourceProperty);
      setDraftId(canceledDraftId);
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
    setMessage('Payment received. Opening your voxel photo…');
    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        const context = readContext(data.draftId);
        if (context?.sourceProperty) setSourceProperty(context.sourceProperty);
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setCreationUnlocked(false);
          setMessage('Payment verified. Choose the same photo again—no second charge.');
        } else {
          setPendingPhoto(photo);
          setPreviewFromFile(photo);
          setRightsConfirmed(true);
          setCreationUnlocked(true);
          setPreviewReady(false);
          setPreviewApproved(false);
          setMessage('Payment verified. Building your 3D voxel photo.');
        }
        setBusy('');
        window.history.replaceState({}, '', '/property');
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

  async function payAndCreate() {
    if (!pendingPhoto || !session?.access_token || !draftId) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this photo or have permission to use it.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto).catch(() => {});
      if (sourceProperty?.id) await saveDevicePhoto(propertyPhotoKey(sourceProperty.id), pendingPhoto).catch(() => {});
      writeContext(draftId, sourceProperty);
      if (paidSessionId) {
        setCreationUnlocked(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Already paid. Building your 3D voxel photo.');
        setBusy('');
        return;
      }
      setMessage(`Opening secure ${PRICE} checkout…`);
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'VoxelPop could not start.'));
    }
  }

  function approvePreviewAndBuildVoxel() {
    if (!pendingPhoto || !previewReady) return;
    setPreviewApproved(true);
    setFinal3d({ status: 'IN_PROGRESS', progress: 55, modelUrl: null, taskId: null });
    setBusy('voxel-3d');
    setMessage('Approved. Building the movable voxel now.');
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
      if (!response.ok || !data?.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The voxel could not be saved.');
      setFinal3d({ status: 'SUCCEEDED', progress: 100, modelUrl: data.modelUrl, taskId: data.taskId });

      const now = new Date().toISOString();
      const existing = isSavedPropertyDraft(sourceProperty) ? sourceProperty : null;
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
        evidence: existing?.evidence || {},
        visual: { ...(existing?.visual || {}), modelUrl: data.modelUrl, modelTaskId: data.taskId, renderMode: 'voxelpop-local-3d' },
        voxelpop: {
          ...(existing?.voxelpop || {}),
          paidCreation: true,
          priceCents: existing?.voxelpop?.priceCents || PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoRetainedOnDevice: true,
          previewApproved: true,
          photoMatchedFront: true,
          creationDraftId: draftId,
          modelTaskId: data.taskId,
          modelUrl: data.modelUrl,
        },
        blockchain: { ...(existing?.blockchain || {}), minted: Boolean(existing?.blockchain?.minted), optional: true, optionalAfterCreation: true },
        world: { ...(existing?.world || {}), public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
        legal: {
          ...(existing?.legal || {}),
          titleVerified: Boolean(existing?.legal?.titleVerified),
          ownershipRightsCreatedByDraft: false,
          ownershipRightsCreatedByMint: false,
          note: 'This VoxelPop is a digital creation only. Saving or minting it does not create physical-property ownership rights.',
        },
      };

      const localSaved = savePropertyDraft(finishedDraft);
      setSourceProperty(localSaved);
      setSavedDraft(localSaved);
      if (pendingPhoto) await saveDevicePhoto(propertyPhotoKey(localSaved.id), pendingPhoto).catch(() => {});
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) await savePropertyDraftToAccount(client, session.user, localSaved);
      } catch {}
      setMessage('Done. Your movable voxel is saved to Vault.');
    } catch (error) {
      setFinal3d({ status: 'LOCAL_ONLY', progress: 100, modelUrl: null, taskId: null });
      setMessage(`${String(error?.message || error || 'The voxel is visible, but saving failed.')} Tap retry.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [draftId, session?.access_token, session?.user, sourceProperty, pendingPhoto]);

  const handleLocal3DReady = useCallback((recipe) => {
    setLocalRecipe(recipe);
    registerVoxel(recipe);
  }, [registerVoxel]);

  function resetCreation() {
    const oldDraft = draftId;
    setDraftId(newDraftId());
    setSourceProperty(null);
    setPendingPhoto(null);
    setPreviewFromFile(null);
    setRightsConfirmed(false);
    setPaidSessionId('');
    setCreationUnlocked(false);
    setPreviewReady(false);
    setPreviewApproved(false);
    setLocalRecipe(null);
    setFinal3d(empty3d());
    setSavedDraft(null);
    setBusy('');
    setMessage('Choose one photo to start.');
    removeDevicePhoto(oldDraft);
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>Photo in.<br/>Voxel out.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Loading…</p></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>Photo in.<br/>Voxel out.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in once.</p>
        <p className={styles.signinCopy}>Your voxel will save to your Vault automatically.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Continue with Google'}</button>
        <small>No wallet needed. Minting is optional later.</small>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  const mintHref = mintReady
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(savedDraft?.label || sourceProperty?.label || 'VoxelPop Property')}`
    : '#';

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXELPOP</div>
      <h1>Photo in.<br/>Voxel out.</h1>
      <div className={styles.accountPill}><span>✓ SIGNED IN</span><b>{session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Google account'}</b></div>
      <div className={styles.progress} style={{gridTemplateColumns:'repeat(4,1fr)'}} aria-label={`Step ${step} of 4`}>{labels.map((label, index) => <span key={label} className={index + 1 <= step ? styles.progressOn : ''}/>)}</div>
      <p className={styles.stageLabel}>STEP {step} OF 4 · {labels[step - 1]}</p>
      <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

      {step === 1 && !pendingPhoto ? <>
        <p className={styles.bigPrompt}>Choose one house photo.</p>
        <p className={styles.flowHint}>That is all you need to start.</p>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing…' : 'Choose photo'}</button>
        <a className={styles.textLink} href="/vault/property-drafts">Use a saved property instead</a>
        <p className={styles.truth}>JPG, PNG, WebP, HEIC, and HEIF supported. Your source photo stays on this device for the creation flow.</p>
      </> : null}

      {step === 1 && pendingPhoto ? <>
        <p className={styles.bigPrompt}>{paidSessionId ? 'Ready to create.' : `Create for ${PRICE}.`}</p>
        <div className={styles.heroCard}><img src={pendingPreview} alt="Selected property reference"/><span className={styles.badge}>YOUR PHOTO · DEVICE ONLY</span></div>
        <div className={styles.choicePanel}>
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Opening…' : paidSessionId ? 'Create 3D voxel photo · paid' : `Pay ${PRICE} & create`}</button>
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Change photo</button>
        </div>
        <p className={styles.truth}>The payment buys one digital VoxelPop creation only, not rights in the physical property.</p>
      </> : null}

      {step === 2 ? <>
        <p className={styles.bigPrompt}>{previewReady ? 'Does it look right?' : 'Making your voxel photo…'}</p>
        <p className={styles.stepCopy}>Approve the photo-matched 3D voxel photo before the movable voxel is built.</p>
        {!pendingPreview ? <section className={styles.donePanel}>
          <b>PAYMENT VERIFIED</b><span>Choose the same photo again. You will not pay twice.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo</button>
        </section> : <>
          <div className={styles.heroCard}>
            <PhotoReliefModelViewer imageUrl={pendingPreview} onReady={() => setPreviewReady(true)}/>
            <span className={styles.badge}>3D VOXEL PHOTO</span>
            {!previewReady ? <div className={styles.buildPulse}/> : null}
          </div>
          <div className={styles.choicePanel}>
            <button className={styles.primaryPurple} type="button" onClick={approvePreviewAndBuildVoxel} disabled={!previewReady || busy === 'voxel-3d'}>{busy === 'voxel-3d' ? 'Starting…' : 'Looks good · continue'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different photo</button>
          </div>
        </>}
        <p className={styles.truth}>One photo cannot prove hidden sides, the back, or exact dimensions.</p>
      </> : null}

      {step === 3 ? <>
        <p className={styles.bigPrompt}>Building your voxel.</p>
        <p className={styles.stepCopy}>No more choices. VoxelPop builds and saves it automatically.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={pendingPreview} sourceImageUrl={pendingPreview} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{final3d.status === 'LOCAL_ONLY' ? 'VOXEL READY · SAVE NEEDS RETRY' : 'BUILDING MOVABLE 3D VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {final3d.status === 'LOCAL_ONLY' && localRecipe
          ? <button className={styles.primaryPurple} type="button" onClick={() => registerVoxel(localRecipe)} disabled={busy === 'register'}>{busy === 'register' ? 'Saving…' : 'Retry save'}</button>
          : <div className={styles.autoPanel}><b>AUTOMATIC</b><span>Build → save to Vault → done.</span></div>}
      </> : null}

      {step === 4 ? <>
        <div className={styles.autoPanel}><b>✓ DONE</b><span>Your movable 3D voxel is saved to Vault.</span></div>
        <p className={styles.bigPrompt}>Your voxel is ready.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={pendingPreview} sourceImageUrl={pendingPreview}/>
          <span className={styles.badge}>MOVABLE 3D VOXEL · SAVED</span>
        </div>
        <div className={styles.choicePanel}>
          <a className={styles.primaryLink} href="/vault/property-drafts">Open Vault</a>
          {mintReady ? <a className={styles.textLink} href={mintHref}>Mint NFT · optional</a> : null}
        </div>
        <p className={styles.truth}>Minting is optional and only represents the digital voxel. It does not create physical-property ownership rights.</p>
      </> : null}

      {step > 1 || pendingPhoto ? <button className={styles.change} type="button" onClick={resetCreation}>Start a new VoxelPop</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
