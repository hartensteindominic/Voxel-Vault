'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

const PRICE = '$4.99';
const PRICE_CENTS = 499;
const DEVICE_DB = 'voxelpop-house-flow-v1';
const DEVICE_STORE = 'photos';
const emptyLock = () => ({ identityKey: '', atlasId: '', address: '' });
const empty3d = () => ({ status: 'NOT_STARTED', taskId: '', modelUrl: '' });

function clean(value) { return String(value || '').trim(); }
function draftId() {
  const value = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `house-${value.slice(0, 28)}`;
}
function supported(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}
function heic(file) {
  return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('On-device photo storage is unavailable.'));
    const request = indexedDB.open(DEVICE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DEVICE_STORE)) request.result.createObjectStore(DEVICE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Photo storage could not open.'));
  });
}

async function storePhoto(id, file) {
  const db = await openDb();
  const bytes = await file.arrayBuffer();
  await new Promise((resolve, reject) => {
    const request = db.transaction(DEVICE_STORE, 'readwrite').objectStore(DEVICE_STORE).put({
      id,
      bytes,
      type: file.type || 'image/jpeg',
      name: file.name || 'house.jpg',
      lastModified: file.lastModified || Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Photo could not be stored on this device.'));
  });
  db.close();
}

async function restorePhoto(id) {
  if (!id) return null;
  const db = await openDb();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction(DEVICE_STORE, 'readonly').objectStore(DEVICE_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Saved photo could not be reopened.'));
  });
  db.close();
  return record?.bytes ? new File([record.bytes], record.name || 'house.jpg', { type: record.type || 'image/jpeg', lastModified: record.lastModified || Date.now() }) : null;
}

async function normalizePhoto(file) {
  if (!heic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This iPhone photo could not be opened. Try a screenshot instead.'));
    });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo conversion is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .93));
    if (!blob) throw new Error('Photo conversion failed.');
    return new File([blob], String(file.name || 'house.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HouseVoxelFlow() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [id, setId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [address, setAddress] = useState('');
  const [lock, setLock] = useState(emptyLock);
  const [rights, setRights] = useState(false);
  const [paid, setPaid] = useState(false);
  const [voxelImageReady, setVoxelImageReady] = useState(false);
  const [voxelImageApproved, setVoxelImageApproved] = useState(false);
  const [final3d, setFinal3d] = useState(empty3d);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in to start.');
  const fileRef = useRef(null);
  const clientRef = useRef(null);
  const registeringRef = useRef(false);
  const checkoutHandledRef = useRef('');

  const stage = final3d.status === 'SUCCEEDED' ? 5 : voxelImageApproved ? 4 : paid ? 3 : photo ? 2 : 1;
  const labels = ['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'INVENTORY'];

  const showPhoto = useCallback((file) => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : '';
    });
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

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
        setId((current) => current || draftId());
        setMessage('Choose one clear house photo.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) {
          setId((current) => current || draftId());
          setMessage('Choose one clear house photo.');
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
    if (!session?.access_token || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = clean(params.get('generation_session'));
    const cancelledId = clean(params.get('draftId'));

    if (params.get('generation_checkout') === 'cancelled' && cancelledId && checkoutHandledRef.current !== `cancel:${cancelledId}`) {
      checkoutHandledRef.current = `cancel:${cancelledId}`;
      setId(cancelledId);
      restorePhoto(cancelledId).then((file) => {
        if (file) { setPhoto(file); showPhoto(file); }
      }).catch(() => {});
      setMessage('Checkout canceled. Your photo is still here.');
      window.history.replaceState({}, '', '/property');
      return;
    }

    if (!sessionId || checkoutHandledRef.current === sessionId) return;
    checkoutHandledRef.current = sessionId;
    setBusy('payment');
    setMessage('Payment received. Confirming the property lock…');
    (async () => {
      try {
        const form = new FormData();
        form.append('generationSessionId', sessionId);
        const response = await fetch('/api/property-photo-upload', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.paid || !data?.draftId) throw new Error(data?.error || 'Payment could not be verified.');
        const file = await restorePhoto(data.draftId).catch(() => null);
        setId(data.draftId);
        setLock({ identityKey: clean(data.identityKey), atlasId: clean(data.atlasId), address: clean(data.propertyAddress) });
        setAddress(clean(data.propertyAddress));
        setPaid(true);
        setRights(true);
        if (file) { setPhoto(file); showPhoto(file); }
        setMessage(file ? 'Address locked. Building the voxel image.' : 'Address locked. Choose the same photo again—no second charge.');
        window.history.replaceState({}, '', '/property');
      } catch (error) {
        checkoutHandledRef.current = '';
        setMessage(String(error?.message || error || 'Payment could not be verified.'));
      } finally {
        setBusy('');
      }
    })();
  }, [session?.access_token, showPhoto]);

  async function signIn() {
    setBusy('signin');
    setMessage('Opening Google sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'Could not sign in.'));
    }
  }

  function choosePhoto() {
    fileRef.current?.click();
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!supported(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');
    setBusy('photo');
    try {
      const file = await normalizePhoto(selected);
      const nextId = id || draftId();
      setId(nextId);
      setPhoto(file);
      showPhoto(file);
      setAddress('');
      setLock(emptyLock());
      setRights(false);
      setPaid(false);
      setVoxelImageReady(false);
      setVoxelImageApproved(false);
      setFinal3d(empty3d());
      setSaved(null);
      await storePhoto(nextId, file);
      setMessage('Photo ready. Confirm the address.');
    } catch (error) {
      setMessage(String(error?.message || error || 'Photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmAddress() {
    if (!session?.access_token || !clean(address) || busy) return;
    setBusy('address');
    setMessage('Checking the mapped building…');
    try {
      const response = await fetch('/api/property-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ address: clean(address) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.available) throw new Error(data?.error || 'This address could not be confirmed.');
      setAddress(clean(data.address || address));
      setLock({ identityKey: clean(data.identityKey), atlasId: clean(data.atlasId), address: clean(data.address || address) });
      setMessage('Address confirmed. This property is available.');
    } catch (error) {
      setLock(emptyLock());
      setMessage(String(error?.message || error || 'Address could not be confirmed.'));
    } finally {
      setBusy('');
    }
  }

  async function createVoxel() {
    if (!photo || !session?.access_token || !id || !lock.identityKey || !rights || busy) return;
    setBusy('checkout');
    setMessage('Locking this property to one collectible…');
    try {
      await storePhoto(id, photo);
      const form = new FormData();
      form.append('draftId', id);
      form.append('rightsConfirmed', 'true');
      form.append('address', lock.address || address);
      const response = await fetch('/api/property-generation/checkout', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout could not open.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'Voxel creation could not start.'));
    }
  }

  function approveVoxelImage() {
    if (!voxelImageReady) return;
    setVoxelImageApproved(true);
    setFinal3d({ status: 'IN_PROGRESS', taskId: '', modelUrl: '' });
    setMessage('Voxel image approved. Building the movable 3D voxel.');
  }

  const save3d = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !id || registeringRef.current) return;
    registeringRef.current = true;
    setBusy('3d');
    try {
      const response = await fetch('/api/property-local-voxel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId: id, recipe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The 3D voxel could not be saved.');
      const now = new Date().toISOString();
      const item = savePropertyDraft({
        schemaVersion: 1,
        type: 'voxel-vault-property-3d-draft',
        id: `voxelpop:${id}`,
        label: lock.address || address || 'My House Voxel',
        createdAt: now,
        updatedAt: now,
        state: 'saved',
        fidelity: 'photo-approved-local-voxel',
        geometryKind: 'digital-only',
        coordinates: { latitude: null, longitude: null },
        geometry: null,
        propertyIdentity: { atlasId: lock.atlasId || null, parcelId: null, pin: null, sbl: null },
        evidence: {},
        visual: { modelUrl: data.modelUrl, modelTaskId: data.taskId, renderMode: 'voxelpop-local-3d' },
        voxelpop: {
          paidCreation: true,
          priceCents: PRICE_CENTS,
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          sourcePhotoRetainedOnDevice: true,
          previewApproved: true,
          creationDraftId: id,
          modelTaskId: data.taskId,
          modelUrl: data.modelUrl,
          identityKey: lock.identityKey || null,
          atlasId: lock.atlasId || null,
          propertyAddress: lock.address || address || null,
          onePropertyOnePurchase: true,
          onePropertyOneMint: true,
        },
        blockchain: { minted: false, optional: true, optionalAfterCreation: true, onePropertyOneMint: true },
        world: { public: false, publishedAt: null, publicLabel: 'VoxelPop House' },
        legal: {
          titleVerified: false,
          ownershipRightsCreatedByDraft: false,
          ownershipRightsCreatedByMint: false,
          note: 'This is a digital voxel collectible only. Saving or minting it does not create physical-property ownership rights.',
        },
      });
      setFinal3d({ status: 'SUCCEEDED', taskId: data.taskId, modelUrl: data.modelUrl });
      setSaved(item);
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session.user) await savePropertyDraftToAccount(client, session.user, item);
      } catch {}
      setMessage('Done. Your 3D house voxel is in your Vault inventory.');
    } catch (error) {
      setFinal3d({ status: 'FAILED', taskId: '', modelUrl: '' });
      setMessage(String(error?.message || error || 'The 3D voxel could not be saved.'));
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [session?.access_token, session?.user, id, lock, address]);

  function reset() {
    setId(draftId());
    setPhoto(null);
    showPhoto(null);
    setAddress('');
    setLock(emptyLock());
    setRights(false);
    setPaid(false);
    setVoxelImageReady(false);
    setVoxelImageApproved(false);
    setFinal3d(empty3d());
    setSaved(null);
    setBusy('');
    setMessage('Choose one clear house photo.');
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/property');
  }

  if (!authReady) return <main className={styles.page}><section className={styles.maker}><div className={styles.brand}>VOXELPOP</div><p className={styles.bigPrompt}>Opening VoxelPop…</p></section></main>;

  if (!session?.user) return <main className={styles.page}><section className={styles.maker}>
    <div className={styles.brand}>VOXELPOP</div>
    <h1>House in.<br/>Voxel out.</h1>
    <section className={styles.signinPanel}>
      <div className={styles.signinMark}>V</div>
      <p className={styles.bigPrompt}>Sign in once.</p>
      <p className={styles.signinCopy}>Your finished house voxel will be saved to your Vault inventory.</p>
      <button className={styles.primaryPurple} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Continue with Google'}</button>
    </section>
    <p className={styles.message}>{message}</p>
  </section></main>;

  const mintHref = final3d.taskId
    ? `/property/mint?draftId=${encodeURIComponent(id)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(saved?.label || lock.address || 'VoxelPop House')}`
    : '#';

  return <main className={styles.page}><section className={styles.maker}>
    <div className={styles.brand}>VOXELPOP · {stage}/5 · {labels[stage - 1]}</div>
    <h1>House in.<br/>Voxel out.</h1>
    <input ref={fileRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

    {stage === 1 ? <>
      <p className={styles.bigPrompt}>Take or choose a house photo.</p>
      <button className={styles.primaryPurple} type="button" onClick={choosePhoto} disabled={busy === 'photo'}>{busy === 'photo' ? 'Preparing…' : 'Choose photo'}</button>
      <p className={styles.truth}>One clear front photo works best. The source photo stays on this device.</p>
    </> : null}

    {stage === 2 ? <>
      <p className={styles.bigPrompt}>Confirm the address.</p>
      <div className={styles.heroCard}><img src={preview} alt="Selected house"/><span className={styles.badge}>YOUR HOUSE PHOTO</span></div>
      <div className={styles.choicePanel}>
        <div className={styles.searchForm}>
          <input value={address} onChange={(event) => { setAddress(event.target.value); setLock(emptyLock()); }} placeholder="123 Main St, City, State" autoComplete="street-address" autoCapitalize="words" aria-label="House address"/>
          <button type="button" onClick={confirmAddress} disabled={!clean(address) || busy === 'address'}>{busy === 'address' ? 'Checking…' : lock.identityKey ? '✓ Address confirmed' : 'Confirm address'}</button>
        </div>
        {lock.identityKey ? <div className={styles.autoPanel}><b>✓ ONE-OF-ONE PROPERTY</b><span>{lock.address}</span></div> : null}
        <label className={styles.rightsCheck}><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
        <button className={styles.primaryPurple} type="button" onClick={createVoxel} disabled={!lock.identityKey || !rights || Boolean(busy)}>{busy === 'checkout' ? 'Opening checkout…' : `Create house voxel · ${PRICE}`}</button>
        <button className={styles.textButton} type="button" onClick={choosePhoto}>Change photo</button>
      </div>
      <p className={styles.truth}>The confirmed mapped property is limited to one collectible purchase and one NFT mint.</p>
    </> : null}

    {stage === 3 ? <>
      <p className={styles.bigPrompt}>{preview ? 'Approve the voxel image.' : 'Choose the same photo again.'}</p>
      {!preview ? <button className={styles.primaryPurple} type="button" onClick={choosePhoto}>Choose photo · already paid</button> : <>
        <div className={styles.heroCard}>
          <PhotoReliefModelViewer imageUrl={preview} onReady={() => setVoxelImageReady(true)}/>
          <span className={styles.badge}>VOXEL IMAGE</span>
          {!voxelImageReady ? <div className={styles.buildPulse}/> : null}
        </div>
        <div className={styles.choicePanel}>
          <button className={styles.primaryPurple} type="button" onClick={approveVoxelImage} disabled={!voxelImageReady}>Looks good · make it 3D</button>
        </div>
      </>}
      <p className={styles.truth}>{lock.address || address}</p>
    </> : null}

    {stage === 4 ? <>
      <p className={styles.bigPrompt}>Building your 3D voxel.</p>
      <p className={styles.stepCopy}>It saves to your inventory automatically when ready.</p>
      <div className={styles.heroCard}>
        <LocalVoxelModelViewer imageUrl={preview} sourceImageUrl={preview} onReady={save3d}/>
        <span className={styles.badge}>MOVABLE 3D VOXEL</span>
        {final3d.status !== 'SUCCEEDED' ? <div className={styles.buildPulse}/> : null}
      </div>
    </> : null}

    {stage === 5 ? <>
      <div className={styles.autoPanel}><b>✓ SAVED TO INVENTORY</b><span>{lock.address || address}</span></div>
      <p className={styles.bigPrompt}>Your house voxel is ready.</p>
      <div className={styles.heroCard}>
        <LocalVoxelModelViewer imageUrl={preview} sourceImageUrl={preview}/>
        <span className={styles.badge}>YOUR 3D HOUSE VOXEL</span>
      </div>
      <div className={styles.choicePanel}>
        <a className={styles.primaryLink} href={mintHref}>Mint this voxel</a>
        <a className={styles.secondaryLink} href="/vault/property-drafts">Open inventory</a>
      </div>
      <p className={styles.truth}>Minting creates one digital NFT for this finished voxel. It does not create rights in the physical house.</p>
    </> : null}

    {stage > 1 ? <button className={styles.change} type="button" onClick={reset}>Start another house</button> : null}
    <p className={styles.message} role="status">{message}</p>
  </section></main>;
}
