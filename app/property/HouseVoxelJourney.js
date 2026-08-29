'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const PRICE = '$4.99';
const PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
const empty3d = () => ({ status: 'NOT_STARTED', progress: 0, modelUrl: null, taskId: null });
const emptyPropertyLock = () => ({ identityKey: '', atlasId: '', address: '' });

function clean(value) { return String(value || '').trim(); }
function newDraftId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `vp-${random.slice(0, 28)}`;
}
function propertyPhotoKey(id) { return `property:${String(id || '').slice(0, 220)}`; }
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

function writeContext(draftId, propertyAddress) {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    window.localStorage.setItem(`${CONTEXT_PREFIX}${draftId}`, JSON.stringify({ propertyAddress: clean(propertyAddress) }));
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

function JourneyRail({ stage }) {
  const labels = ['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'INVENTORY'];
  return <div aria-label={`Step ${stage} of 5`} style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:5,margin:'4px auto 15px',maxWidth:620}}>
    {labels.map((label, index) => <div key={label} style={{minWidth:0,textAlign:'center'}}>
      <span style={{display:'block',height:5,borderRadius:999,background:index + 1 <= stage ? '#7138f5' : '#e8e2e9'}}/>
      <small style={{display:'block',marginTop:5,color:index + 1 === stage ? '#5d31c7' : '#9b929c',fontSize:7,fontWeight:900,letterSpacing:'.05em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</small>
    </div>)}
  </div>;
}

export default function HouseVoxelJourney() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyLock, setPropertyLock] = useState(emptyPropertyLock);
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

  const localReady = final3d.status === 'SUCCEEDED' && Boolean(final3d.taskId && final3d.modelUrl);
  const mintReady = localReady && String(final3d.taskId || '').startsWith('local-v1:');
  const stage = localReady ? 5 : previewApproved ? 4 : creationUnlocked ? 3 : pendingPhoto ? 2 : 1;

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
        setMessage('Take or choose one house photo.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setDraftId((current) => current || newDraftId());
          setMessage('Take or choose one house photo.');
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

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('prepare');
    setMessage('Preparing your house photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This photo is still too large. Try a screenshot or smaller version.');
      setPendingPhoto(photo);
      setPreviewFromFile(photo);
      setRightsConfirmed(Boolean(paidSessionId));
      setCreationUnlocked(false);
      setPreviewReady(false);
      setPreviewApproved(false);
      setLocalRecipe(null);
      setFinal3d(empty3d());
      setSavedDraft(null);
      if (!paidSessionId) setPropertyLock(emptyPropertyLock());
      setMessage(paidSessionId ? 'Photo ready. Your paid address lock is still confirmed.' : 'Photo ready. Confirm the property address next.');
    } catch (error) {
      setMessage(String(error?.message || error || 'This photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmAddress() {
    if (!session?.access_token || !pendingPhoto) return;
    const address = clean(propertyAddress);
    if (!address) return setMessage('Enter the house address first.');
    setBusy('address');
    setMessage('Confirming this address and checking one-of-one availability…');
    try {
      const response = await fetch('/api/property-identity', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.available || !data?.identityKey) throw new Error(data?.error || 'This address could not be confirmed.');
      const canonicalAddress = clean(data.address || address);
      setPropertyAddress(canonicalAddress);
      setPropertyLock({ identityKey: clean(data.identityKey), atlasId: clean(data.atlasId), address: canonicalAddress });
      setMessage('Address confirmed. This property is available for one Voxel Vault collectible.');
    } catch (error) {
      setPropertyLock(emptyPropertyLock());
      setMessage(String(error?.message || error || 'This address could not be confirmed.'));
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
      if (context?.propertyAddress) setPropertyAddress(clean(context.propertyAddress));
      setDraftId(canceledDraftId);
      loadDevicePhoto(canceledDraftId).then((photo) => {
        if (photo) { setPendingPhoto(photo); setPreviewFromFile(photo); }
      }).catch(() => {});
      setPropertyLock(emptyPropertyLock());
      setMessage('Checkout canceled. Nothing was charged. Confirm the address again when ready.');
      window.history.replaceState({}, '', '/property');
      return undefined;
    }

    const generationSessionId = clean(params.get('generation_session'));
    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return undefined;
    checkoutHandledRef.current = generationSessionId;
    let active = true;
    setBusy('payment-return');
    setMessage('Payment received. Opening your voxel image…');
    (async () => {
      try {
        const data = await verifyPaidSession(generationSessionId);
        if (!active) return;
        const context = readContext(data.draftId);
        const verifiedAddress = clean(data.propertyAddress || context?.propertyAddress);
        setPropertyLock({ identityKey: clean(data.identityKey), atlasId: clean(data.atlasId), address: verifiedAddress });
        if (verifiedAddress) setPropertyAddress(verifiedAddress);
        setPaidSessionId(generationSessionId);
        setDraftId(data.draftId);
        const photo = await loadDevicePhoto(data.draftId).catch(() => null);
        if (!active) return;
        if (!photo) {
          setCreationUnlocked(false);
          setMessage('Payment verified. Choose the same house photo again—there is no second charge.');
        } else {
          setPendingPhoto(photo);
          setPreviewFromFile(photo);
          setRightsConfirmed(true);
          setCreationUnlocked(true);
          setPreviewReady(false);
          setPreviewApproved(false);
          setMessage('Address locked. Building your voxel image now.');
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
    const address = clean(propertyLock.address || propertyAddress);
    if (!paidSessionId && !propertyLock.identityKey) return setMessage('Confirm the property address before creating the voxel.');
    setBusy('generation-checkout');
    try {
      await saveDevicePhoto(draftId, pendingPhoto).catch(() => {});
      writeContext(draftId, address);
      if (paidSessionId) {
        setCreationUnlocked(true);
        setPreviewReady(false);
        setPreviewApproved(false);
        setMessage('Building your voxel image now.');
        setBusy('');
        return;
      }
      setMessage('Re-checking the property before secure checkout…');
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      form.append('address', address);
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Secure checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'VoxelPop could not start.'));
    }
  }

  function approveVoxelImage() {
    if (!pendingPhoto || !previewReady) return;
    setPreviewApproved(true);
    setFinal3d({ status: 'IN_PROGRESS', progress: 55, modelUrl: null, taskId: null });
    setBusy('voxel-3d');
    setMessage('Voxel image approved. Turning it into your movable 3D voxel.');
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
      const savedAddress = clean(propertyLock.address || propertyAddress);
      const finishedDraft = {
        schemaVersion: 1,
        type: 'voxel-vault-property-3d-draft',
        id: `voxelpop:${draftId}`,
        label: savedAddress || 'My Voxel House',
        createdAt: now,
        updatedAt: now,
        state: 'saved',
        fidelity: 'photo-approved-local-voxel',
        geometryKind: 'digital-only',
        coordinates: { latitude: null, longitude: null },
        geometry: null,
        propertyIdentity: { atlasId: clean(propertyLock.atlasId) || null, parcelId: null, pin: null, sbl: null },
        evidence: {},
        visual: { modelUrl: data.modelUrl, modelTaskId: data.taskId, renderMode: 'voxelpop-local-3d' },
        voxelpop: {
          paidCreation: true,
          priceCents: PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoRetainedOnDevice: true,
          previewApproved: true,
          photoMatchedFront: true,
          creationDraftId: draftId,
          modelTaskId: data.taskId,
          modelUrl: data.modelUrl,
          identityKey: clean(propertyLock.identityKey) || null,
          atlasId: clean(propertyLock.atlasId) || null,
          propertyAddress: savedAddress || null,
          onePropertyOnePurchase: true,
          onePropertyOneMint: true,
        },
        blockchain: { minted: false, optional: true, optionalAfterCreation: true, onePropertyOneMint: true },
        world: { public: false, publishedAt: null, publicLabel: 'VoxelPop Property' },
        legal: {
          titleVerified: false,
          ownershipRightsCreatedByDraft: false,
          ownershipRightsCreatedByMint: false,
          note: 'This VoxelPop is a digital creation only. Saving or minting it does not create physical-property ownership rights.',
        },
      };

      const localSaved = savePropertyDraft(finishedDraft);
      setSavedDraft(localSaved);
      if (pendingPhoto) await saveDevicePhoto(propertyPhotoKey(localSaved.id), pendingPhoto).catch(() => {});
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) await savePropertyDraftToAccount(client, session.user, localSaved);
      } catch {}
      setMessage('Done. Your 3D voxel is saved in Inventory and ready to mint.');
    } catch (error) {
      setFinal3d({ status: 'LOCAL_ONLY', progress: 100, modelUrl: null, taskId: null });
      setMessage(`${String(error?.message || error || 'The voxel is visible, but saving failed.')} Tap retry.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [draftId, session?.access_token, session?.user, pendingPhoto, propertyAddress, propertyLock]);

  const handleLocal3DReady = useCallback((recipe) => {
    setLocalRecipe(recipe);
    registerVoxel(recipe);
  }, [registerVoxel]);

  function resetCreation() {
    const oldDraft = draftId;
    setDraftId(newDraftId());
    setPropertyAddress('');
    setPropertyLock(emptyPropertyLock());
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
    setMessage('Take or choose one house photo.');
    removeDevicePhoto(oldDraft);
    if (session?.access_token) fetch('/api/property-identity', { method: 'DELETE', headers: authHeaders() }).catch(() => {});
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXEL VAULT</div>
      <h1>House photo.<br/>Voxel collectible.</h1>
      <section className={styles.signinPanel}><div className={styles.signinMark}>V</div><p className={styles.bigPrompt}>Loading…</p></section>
    </section></main>;
  }

  if (!session?.user) {
    return <main className={styles.page}><section className={styles.maker}>
      <div className={styles.brand}>VOXEL VAULT</div>
      <h1>House photo.<br/>Voxel collectible.</h1>
      <section className={styles.signinPanel}>
        <div className={styles.signinMark}>V</div>
        <p className={styles.bigPrompt}>Sign in once.</p>
        <p className={styles.signinCopy}>Your finished house voxel will stay in your Inventory.</p>
        <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Continue with Google'}</button>
      </section>
      <p className={styles.message}>{message}</p>
    </section></main>;
  }

  const mintHref = mintReady
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(savedDraft?.label || propertyAddress || 'Voxel House')}`
    : '#';

  return <main className={styles.page}>
    <section className={styles.maker}>
      <div className={styles.brand}>VOXEL VAULT · HOUSE</div>
      <h1>Photo → address →<br/>voxel → mint.</h1>
      <JourneyRail stage={stage}/>
      <input ref={uploadInputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

      {stage === 1 ? <>
        <p className={styles.bigPrompt}>{paidSessionId ? 'Choose the same house photo.' : 'Take a photo of a house.'}</p>
        <p className={styles.stepCopy}>{paidSessionId ? 'Your payment and address are already locked. There is no second charge.' : 'Take one now or choose one from your phone.'}</p>
        <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'prepare'}>{busy === 'prepare' ? 'Preparing…' : 'Take or choose photo'}</button>
        <p className={styles.truth}>JPG, PNG, WebP, HEIC, and HEIF supported. The source photo stays on this device during creation.</p>
      </> : null}

      {stage === 2 ? <>
        <p className={styles.bigPrompt}>Confirm the address.</p>
        <div className={styles.heroCard}><img src={pendingPreview} alt="House selected for voxel creation"/><span className={styles.badge}>HOUSE PHOTO</span></div>
        <div className={styles.choicePanel}>
          {propertyLock.identityKey ? <div className={styles.autoPanel}>
            <b>✓ ADDRESS CONFIRMED</b>
            <span>{propertyLock.address}</span>
          </div> : <div className={styles.searchForm}>
            <input value={propertyAddress} onChange={(event) => { setPropertyAddress(event.target.value); setPropertyLock(emptyPropertyLock()); }} placeholder="123 Main St, City, State" autoComplete="street-address" autoCapitalize="words" aria-label="Property address"/>
            <button type="button" onClick={confirmAddress} disabled={!clean(propertyAddress) || busy === 'address'}>{busy === 'address' ? 'Confirming…' : 'Confirm address'}</button>
          </div>}
          <label className={styles.rightsCheck}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
          {propertyLock.identityKey ? <button className={styles.primaryPurple} type="button" onClick={payAndCreate} disabled={!rightsConfirmed || busy === 'generation-checkout'}>{busy === 'generation-checkout' ? 'Checking property…' : paidSessionId ? 'Continue to voxel image' : `Create voxel · ${PRICE}`}</button> : null}
          <button className={styles.textButton} type="button" onClick={choosePhoto}>Change photo</button>
        </div>
        <p className={styles.truth}>The confirmed address is used to prevent a second purchase or second NFT mint for the same mapped property.</p>
      </> : null}

      {stage === 3 ? <>
        <p className={styles.bigPrompt}>{previewReady ? 'Your voxel image.' : 'Building the voxel image…'}</p>
        <p className={styles.stepCopy}>This is the photo rebuilt block by block. Confirm it before the full 3D voxel is made.</p>
        {!pendingPreview ? <section className={styles.donePanel}>
          <b>PAYMENT VERIFIED</b><span>Choose the same house photo again. You will not pay twice.</span>
          <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo</button>
        </section> : <>
          <div className={styles.heroCard}>
            <PhotoReliefModelViewer imageUrl={pendingPreview} onReady={() => setPreviewReady(true)}/>
            <span className={styles.badge}>VOXEL IMAGE</span>
            {!previewReady ? <div className={styles.buildPulse}/> : null}
          </div>
          <div className={styles.choicePanel}>
            <button className={styles.primaryPurple} type="button" onClick={approveVoxelImage} disabled={!previewReady || busy === 'voxel-3d'}>{busy === 'voxel-3d' ? 'Starting 3D…' : 'Use this voxel image'}</button>
          </div>
        </>}
      </> : null}

      {stage === 4 ? <>
        <p className={styles.bigPrompt}>Turning it into 3D.</p>
        <p className={styles.stepCopy}>Your approved voxel image becomes one movable 3D voxel and saves automatically.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={pendingPreview} sourceImageUrl={pendingPreview} onReady={handleLocal3DReady}/>
          <span className={styles.badge}>{final3d.status === 'LOCAL_ONLY' ? '3D VOXEL READY · SAVE NEEDS RETRY' : 'BUILDING 3D VOXEL'}</span>
          {!localReady ? <div className={styles.buildPulse}/> : null}
        </div>
        {final3d.status === 'LOCAL_ONLY' && localRecipe
          ? <button className={styles.primaryPurple} type="button" onClick={() => registerVoxel(localRecipe)} disabled={busy === 'register'}>{busy === 'register' ? 'Saving…' : 'Retry save'}</button>
          : <div className={styles.autoPanel}><b>AUTOMATIC</b><span>3D voxel → save to Inventory.</span></div>}
      </> : null}

      {stage === 5 ? <>
        <div className={styles.autoPanel}><b>✓ SAVED TO INVENTORY</b><span>{propertyAddress || 'Your house voxel'} · one property, one collectible.</span></div>
        <p className={styles.bigPrompt}>Your 3D voxel is ready.</p>
        <div className={styles.heroCard}>
          <LocalVoxelModelViewer imageUrl={pendingPreview} sourceImageUrl={pendingPreview}/>
          <span className={styles.badge}>3D VOXEL · IN INVENTORY</span>
        </div>
        <div className={styles.choicePanel}>
          {mintReady ? <a className={styles.primaryLink} href={mintHref}>Mint this voxel</a> : null}
          <a className={styles.secondaryLink} href="/vault/property-drafts">Open Inventory</a>
          <span>Mint now or later. The 3D voxel stays in your Inventory either way.</span>
        </div>
        <p className={styles.truth}>Minting creates the one NFT for this digital voxel. It does not transfer ownership or rights in the physical house.</p>
      </> : null}

      {stage > 1 ? <button className={styles.change} type="button" onClick={resetCreation}>Start another house</button> : null}
      <p className={styles.message} role="status">{message}</p>
    </section>
  </main>;
}
