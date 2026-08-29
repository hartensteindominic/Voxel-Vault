'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';

const PRICE = '$4.99';
const PRICE_CENTS = 499;
const PHOTO_DB = 'voxel-vault-house-photo-v1';
const PHOTO_STORE = 'house-photos';

function clean(value) {
  return String(value || '').trim();
}

function newDraftId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `house-${random.slice(0, 28)}`;
}

function isHeic(file) {
  return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}

function isSupportedPhoto(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || isHeic(file);
}

function openPhotoDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Private on-device photo storage is unavailable in this browser.'));
    const request = indexedDB.open(PHOTO_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) request.result.createObjectStore(PHOTO_STORE, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Private photo storage could not open.'));
  });
}

async function saveDevicePhoto(draftId, file) {
  if (!draftId || !file) return;
  const db = await openPhotoDb();
  const bytes = await file.arrayBuffer();
  await new Promise((resolve, reject) => {
    const request = db.transaction(PHOTO_STORE, 'readwrite').objectStore(PHOTO_STORE).put({
      draftId,
      bytes,
      type: file.type || 'image/jpeg',
      name: file.name || 'house-photo.jpg',
      lastModified: file.lastModified || Date.now(),
      savedAt: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('The photo could not be kept on this device.'));
  });
  db.close();
}

async function loadDevicePhoto(draftId) {
  if (!draftId) return null;
  const db = await openPhotoDb();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction(PHOTO_STORE, 'readonly').objectStore(PHOTO_STORE).get(draftId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('The saved house photo could not be reopened.'));
  });
  db.close();
  if (!record?.bytes) return null;
  return new File([record.bytes], record.name || 'house-photo.jpg', {
    type: record.type || 'image/jpeg',
    lastModified: record.lastModified || Date.now(),
  });
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
    return new File([blob], String(file.name || 'house-photo.heic').replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyModel() {
  return { taskId: '', modelUrl: '' };
}

export default function HouseVoxelApp() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [address, setAddress] = useState('');
  const [addressLock, setAddressLock] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [voxelImageReady, setVoxelImageReady] = useState(false);
  const [voxelImageApproved, setVoxelImageApproved] = useState(false);
  const [localRecipe, setLocalRecipe] = useState(null);
  const [finalModel, setFinalModel] = useState(emptyModel);
  const [savedDraft, setSavedDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Sign in once so your finished house can live in your Vault.');

  const clientRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewRef = useRef('');
  const checkoutHandledRef = useRef('');
  const recipeHandledRef = useRef(false);
  const registeringRef = useRef(false);

  const setPreviewFromFile = useCallback((nextPhoto) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const nextUrl = nextPhoto ? URL.createObjectURL(nextPhoto) : '';
    previewRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
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
      if (data.session?.user) setDraftId((current) => current || newDraftId());
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        if (next?.user) setDraftId((current) => current || newDraftId());
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in is unavailable on this deployment.');
      }
    });
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/property-identity', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.selected || !data?.address) return;
        setAddress(data.address);
      }).catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cancelledDraft = clean(params.get('draftId'));
    const cancelled = params.get('generation_checkout') === 'cancelled';
    const generationSessionId = clean(params.get('generation_session'));

    if (cancelled && cancelledDraft && checkoutHandledRef.current !== `cancel:${cancelledDraft}`) {
      checkoutHandledRef.current = `cancel:${cancelledDraft}`;
      setDraftId(cancelledDraft);
      loadDevicePhoto(cancelledDraft).then((savedPhoto) => {
        if (savedPhoto) {
          setPhoto(savedPhoto);
          setPreviewFromFile(savedPhoto);
        }
      }).catch(() => {});
      setMessage('Checkout was canceled. Your photo is still private on this device.');
      window.history.replaceState({}, '', '/property');
      return;
    }

    if (!generationSessionId || checkoutHandledRef.current === generationSessionId) return;
    checkoutHandledRef.current = generationSessionId;
    setBusy('payment-return');
    setMessage('Payment received. Reopening your house photo…');

    (async () => {
      try {
        const form = new FormData();
        form.append('generationSessionId', generationSessionId);
        const response = await fetch('/api/property-photo-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || data?.paid !== true || !data?.draftId) throw new Error(data?.error || 'Your paid house creation could not be verified.');

        setPaid(true);
        setDraftId(data.draftId);
        setAddress(data.propertyAddress || '');
        setAddressLock({
          address: data.propertyAddress || '',
          atlasId: data.atlasId || '',
          identityKey: data.identityKey || '',
        });
        setRightsConfirmed(true);
        const savedPhoto = await loadDevicePhoto(data.draftId).catch(() => null);
        if (savedPhoto) {
          setPhoto(savedPhoto);
          setPreviewFromFile(savedPhoto);
          setMessage('Address locked. Building your voxel image now.');
        } else {
          setMessage('Payment and address are confirmed. Choose the same house photo again to continue. You will not be charged twice.');
        }
      } catch (error) {
        setMessage(String(error?.message || error || 'The paid house creation could not be reopened.'));
      } finally {
        setBusy('');
        window.history.replaceState({}, '', '/property');
      }
    })();
  }, [session?.access_token, setPreviewFromFile]);

  async function signIn() {
    setBusy('signin');
    setMessage('Opening secure Google sign-in…');
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
    if (!session?.access_token) return setMessage('Sign in first so the finished voxel can be saved to your Vault.');
    fileInputRef.current?.click();
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF house photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');

    setBusy('photo');
    setMessage('Preparing your house photo…');
    try {
      const normalized = await normalizeIphonePhoto(selected);
      if (normalized.size > 8 * 1024 * 1024) throw new Error('This photo is still too large. Try a screenshot or a smaller version.');
      setPhoto(normalized);
      setPreviewFromFile(normalized);
      setVoxelImageReady(false);
      setVoxelImageApproved(false);
      setLocalRecipe(null);
      setFinalModel(emptyModel());
      setSavedDraft(null);
      recipeHandledRef.current = false;
      if (!paid) {
        setAddressLock(null);
        setRightsConfirmed(false);
        setMessage('Photo ready. Enter and confirm the house address.');
      } else {
        setMessage('Photo ready. Your address and payment are already confirmed. Building the voxel image now.');
      }
    } catch (error) {
      setMessage(String(error?.message || error || 'This house photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmAddress() {
    if (!photo || !session?.access_token || !clean(address) || busy) return;
    setBusy('address');
    setMessage('Confirming this address and checking that the house is still available…');
    try {
      const response = await fetch('/api/property-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ address: clean(address) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.available) throw new Error(data?.error || 'This address could not be confirmed.');
      const lock = {
        address: data.address || clean(address),
        atlasId: data.atlasId || '',
        identityKey: data.identityKey || '',
      };
      setAddress(lock.address);
      setAddressLock(lock);
      setMessage('Address confirmed. This house is available as a one-of-one Voxel Vault collectible.');
    } catch (error) {
      setAddressLock(null);
      setMessage(String(error?.message || error || 'This address could not be confirmed.'));
    } finally {
      setBusy('');
    }
  }

  async function unlockCreation() {
    if (!photo || !draftId || !session?.access_token || !addressLock?.address || !rightsConfirmed || busy) return;
    setBusy('checkout');
    setMessage('Locking this address to one purchase and one mint…');
    try {
      await saveDevicePhoto(draftId, photo);
      const form = new FormData();
      form.append('draftId', draftId);
      form.append('rightsConfirmed', 'true');
      form.append('address', addressLock.address);
      const response = await fetch('/api/property-generation/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout could not be opened.');
      window.location.assign(data.url);
    } catch (error) {
      setBusy('');
      setMessage(String(error?.message || error || 'Checkout could not be opened.'));
    }
  }

  function approveVoxelImage() {
    if (!voxelImageReady) return;
    setVoxelImageApproved(true);
    setMessage('Voxel image confirmed. Turning it into your interactive 3D voxel now.');
  }

  async function registerVoxel(recipe) {
    if (!recipe || !draftId || !session?.access_token || registeringRef.current || finalModel.taskId) return;
    registeringRef.current = true;
    setBusy('build');
    setMessage('Finishing the 3D voxel and saving it to your inventory…');
    try {
      const response = await fetch('/api/property-local-voxel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId, recipe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The 3D voxel could not be saved.');

      const now = new Date().toISOString();
      const houseName = clean(addressLock?.address || address) || 'My House Voxel';
      const finishedDraft = {
        schemaVersion: 1,
        type: 'voxel-vault-property-3d-draft',
        id: `voxelpop:${draftId}`,
        label: houseName,
        address: houseName,
        createdAt: now,
        updatedAt: now,
        state: 'saved',
        fidelity: 'photo-approved-local-voxel',
        coordinates: { latitude: null, longitude: null },
        geometry: null,
        propertyIdentity: {
          atlasId: addressLock?.atlasId || null,
          parcelId: null,
          pin: null,
          sbl: null,
        },
        evidence: {},
        visual: {
          modelUrl: data.modelUrl,
          modelTaskId: data.taskId,
          renderMode: 'voxelpop-local-3d',
        },
        world: { public: false },
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
          identityKey: addressLock?.identityKey || null,
          atlasId: addressLock?.atlasId || null,
          propertyAddress: houseName,
          onePropertyOnePurchase: true,
          onePropertyOneMint: true,
        },
        legal: {
          digitalOnly: true,
          physicalPropertyRights: false,
          ownershipRightsCreatedByMint: false,
          note: 'This house voxel is a digital collectible only. Saving or minting it does not create ownership rights in the physical property.',
        },
      };

      const localSaved = savePropertyDraft(finishedDraft);
      setSavedDraft(localSaved);
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        if (session?.user) await savePropertyDraftToAccount(client, session.user, localSaved);
      } catch {}
      setFinalModel({ taskId: data.taskId, modelUrl: data.modelUrl });
      setMessage('Done. Your 3D house voxel is saved in your Vault inventory and is ready to mint.');
    } catch (error) {
      recipeHandledRef.current = false;
      setMessage(String(error?.message || error || 'The 3D voxel is visible, but it could not be saved. Tap retry.'));
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }

  function handleRecipeReady(recipe) {
    setLocalRecipe(recipe);
    if (recipeHandledRef.current) return;
    recipeHandledRef.current = true;
    registerVoxel(recipe);
  }

  const mintHref = finalModel.taskId
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(finalModel.taskId)}&name=${encodeURIComponent(clean(addressLock?.address || address) || 'VoxelPop House')}`
    : '';

  const activeStep = finalModel.taskId ? 4 : voxelImageApproved ? 3 : paid ? 2 : photo && addressLock ? 1 : 0;
  const steps = ['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'MINT'];

  if (!authReady) {
    return <main className="houseApp"><section className="houseShell"><div className="loadingMark">V</div><p className="status">Opening Voxel Vault…</p><style jsx>{styles}</style></section></main>;
  }

  return <main className="houseApp">
    <section className="houseShell">
      <header className="intro">
        <span className="eyebrow">HOUSE → VOXEL → VAULT</span>
        <h1>Turn one house photo into a one-of-one voxel.</h1>
        <p>Upload the house, confirm its address, approve the voxel image, then keep or mint the finished 3D voxel.</p>
      </header>

      <div className="steps" aria-label="House voxel creation steps">
        {steps.map((label, index) => <div key={label} className={index <= activeStep ? 'step active' : 'step'}><i>{index + 1}</i><span>{label}</span></div>)}
      </div>

      {!session?.user ? <section className="card accountCard">
        <div className="bigIcon">⌂</div>
        <h2>Sign in once.</h2>
        <p>Your finished 3D voxel is automatically saved to your private Vault inventory before minting.</p>
        <button className="primary" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Continue with Google'}</button>
      </section> : <>
        {!photo ? <section className="card uploadCard">
          <input ref={fileInputRef} className="hiddenInput" type="file" accept="image/*,.heic,.heif" capture="environment" onChange={selectPhoto}/>
          <div className="bigIcon">＋</div>
          <h2>1. Add one house photo.</h2>
          <p>A clear front or three-quarter photo works best.</p>
          <button className="primary" type="button" onClick={choosePhoto} disabled={busy === 'photo'}>{busy === 'photo' ? 'Preparing photo…' : 'Choose house photo'}</button>
        </section> : null}

        {photo && !paid ? <section className="card addressCard">
          <div className="photoAddressGrid">
            <div className="photoFrame"><img src={previewUrl} alt="Selected house"/><span>HOUSE PHOTO</span></div>
            <div className="addressSide">
              <span className="miniLabel">2 · CONFIRM ADDRESS</span>
              <h2>Which house is this?</h2>
              <p>Confirm the real address so Voxel Vault can keep this property one-of-one.</p>
              <label className="addressField"><span>Property address</span><input value={address} onChange={(event) => { setAddress(event.target.value); setAddressLock(null); }} placeholder="123 Main St, City, State" autoComplete="street-address"/></label>
              {!addressLock ? <button className="secondary" type="button" onClick={confirmAddress} disabled={!clean(address) || busy === 'address'}>{busy === 'address' ? 'Checking address…' : 'Confirm address'}</button> : <div className="confirmed"><b>✓ ADDRESS CONFIRMED</b><span>{addressLock.address}</span></div>}
            </div>
          </div>
          {addressLock ? <div className="unlockBox">
            <label className="permission"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
            <button className="primary" type="button" onClick={unlockCreation} disabled={!rightsConfirmed || busy === 'checkout'}>{busy === 'checkout' ? 'Opening secure checkout…' : `Create this house voxel · ${PRICE}`}</button>
            <small>One confirmed address can be purchased once and minted once.</small>
          </div> : null}
          <button className="textButton" type="button" onClick={choosePhoto}>Use a different photo</button>
        </section> : null}

        {paid && !photo ? <section className="card uploadCard">
          <input ref={fileInputRef} className="hiddenInput" type="file" accept="image/*,.heic,.heif" capture="environment" onChange={selectPhoto}/>
          <div className="bigIcon">✓</div>
          <h2>Address and payment confirmed.</h2>
          <p>Choose the same house photo again. You will not be charged twice.</p>
          <button className="primary" type="button" onClick={choosePhoto}>Choose house photo</button>
        </section> : null}

        {paid && photo && !voxelImageApproved ? <section className="card viewerCard">
          <div className="sectionHead"><span className="miniLabel">3 · VOXEL IMAGE</span><h2>Confirm the voxel image.</h2><p>This first build keeps the photographed colors and shape visible before the full 3D voxel is made.</p></div>
          <div className="viewerWrap"><PhotoReliefModelViewer imageUrl={previewUrl} onReady={() => setVoxelImageReady(true)}/></div>
          <button className="primary" type="button" onClick={approveVoxelImage} disabled={!voxelImageReady}>{voxelImageReady ? 'Looks right · build 3D voxel' : 'Building voxel image…'}</button>
        </section> : null}

        {voxelImageApproved && !finalModel.taskId ? <section className="card viewerCard">
          <div className="sectionHead"><span className="miniLabel">4 · 3D VOXEL</span><h2>Your house is becoming a movable voxel.</h2><p>Drag it to inspect the shape. When it finishes, it saves to your inventory automatically.</p></div>
          <div className="viewerWrap dark"><LocalVoxelModelViewer imageUrl={previewUrl} sourceImageUrl={previewUrl} onReady={handleRecipeReady}/></div>
          {busy === 'build' ? <div className="saving"><span></span>Saving finished voxel to Vault…</div> : null}
          {!busy && localRecipe && !finalModel.taskId ? <button className="secondary" type="button" onClick={() => { recipeHandledRef.current = true; registerVoxel(localRecipe); }}>Retry save</button> : null}
        </section> : null}

        {finalModel.taskId ? <section className="card doneCard">
          <div className="doneBadge">✓ SAVED TO INVENTORY</div>
          <div className="sectionHead"><span className="miniLabel">5 · MINT OR KEEP</span><h2>Your 3D house voxel is done.</h2><p>{clean(addressLock?.address || address)}</p></div>
          <div className="viewerWrap dark"><LocalVoxelModelViewer imageUrl={previewUrl} sourceImageUrl={previewUrl}/></div>
          <div className="finalActions">
            <Link className="primary linkButton" href={mintHref}>Mint voxel</Link>
            <Link className="secondary linkButton" href="/vault/property-drafts">Open inventory</Link>
          </div>
          <small className="finalNote">Minting is optional. The voxel is already saved in your Vault.</small>
          {savedDraft ? <span className="savedId">Inventory item · {savedDraft.id}</span> : null}
        </section> : null}
      </>}

      <p className="status" role="status">{message}</p>
      <p className="truth">Digital collectible only. Confirming an address or minting a voxel does not create deed, title, equity, occupancy, or other rights in the physical property.</p>
    </section>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
:global(body){margin:0;background:#fffaf2;color:#261b2c;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.houseApp{min-height:100vh;padding:18px 12px calc(112px + env(safe-area-inset-bottom));background:radial-gradient(circle at 12% 4%,rgba(255,221,164,.4),transparent 29%),radial-gradient(circle at 88% 7%,rgba(113,56,245,.13),transparent 29%),radial-gradient(circle at 50% 100%,rgba(201,255,84,.18),transparent 28%),#fffaf2}.houseShell{width:min(760px,100%);margin:auto}.intro{text-align:center;padding:24px 8px 18px}.eyebrow,.miniLabel{font-size:8px;font-weight:1000;letter-spacing:.12em;color:#7138f5}.intro h1{max-width:680px;margin:10px auto 9px;font-size:clamp(35px,7vw,58px);line-height:.96;letter-spacing:-.055em}.intro p{max-width:600px;margin:auto;color:#776d7b;font-size:13px;line-height:1.55}.steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:4px 0 14px}.step{min-width:0;display:grid;justify-items:center;gap:5px;padding:8px 3px;border:1px solid #e9e0eb;border-radius:13px;background:rgba(255,255,255,.7);color:#aaa0ad}.step i{width:23px;height:23px;border-radius:8px;display:grid;place-items:center;background:#eee8ef;font-style:normal;font-size:9px;font-weight:1000}.step span{font-size:6.5px;font-weight:1000;letter-spacing:.055em;white-space:nowrap}.step.active{border-color:#d7c6ff;color:#6041a7;background:#fff}.step.active i{background:#7138f5;color:#fff}.card{border:1px solid #e6dce8;border-radius:28px;background:rgba(255,255,255,.94);box-shadow:0 18px 46px rgba(73,51,88,.09);padding:20px;text-align:center}.accountCard,.uploadCard{max-width:560px;margin:34px auto 0}.bigIcon,.loadingMark{width:62px;height:62px;margin:0 auto 13px;border-radius:20px;display:grid;place-items:center;background:#c9ff54;color:#426019;font-size:29px;font-weight:1000;box-shadow:0 7px 0 #a9dc34}.card h2{margin:5px 0 8px;font-size:27px;letter-spacing:-.035em}.card p{margin:0 auto;color:#7e7481;font-size:11px;line-height:1.5}.primary,.secondary{width:100%;min-height:56px;border-radius:17px;font:950 15px inherit;cursor:pointer}.primary{border:0;margin-top:16px;background:linear-gradient(180deg,#7c45ff,#6630eb);color:#fff;box-shadow:0 6px 0 #5120cf,0 14px 27px rgba(113,56,245,.16)}.primary:disabled,.secondary:disabled{opacity:.48;box-shadow:none;cursor:default}.secondary{border:1px solid #ddd1e8;background:#fff;color:#6040a7;box-shadow:0 6px 18px rgba(73,51,88,.06)}.hiddenInput{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}.photoAddressGrid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px;align-items:stretch}.photoFrame{position:relative;min-height:330px;overflow:hidden;border-radius:22px;background:#24192d}.photoFrame img{width:100%;height:100%;min-height:330px;object-fit:cover;display:block}.photoFrame span{position:absolute;left:12px;top:12px;padding:7px 9px;border-radius:999px;background:rgba(35,24,44,.72);color:#fff;font-size:7px;font-weight:1000;letter-spacing:.09em;backdrop-filter:blur(8px)}.addressSide{text-align:left;display:flex;flex-direction:column;justify-content:center;padding:6px}.addressSide h2{font-size:30px}.addressSide p{margin:0 0 16px}.addressField{display:grid;gap:6px}.addressField span{font-size:8px;font-weight:950;letter-spacing:.07em;color:#817586}.addressField input{width:100%;height:52px;border:1px solid #ded4e1;border-radius:15px;background:#fff;padding:0 13px;box-sizing:border-box;color:#2c2231;font:800 15px inherit;outline:none}.addressField input:focus{border-color:#8e6be0;box-shadow:0 0 0 4px rgba(113,56,245,.08)}.addressSide .secondary{margin-top:10px}.confirmed{display:grid;gap:4px;margin-top:10px;padding:12px;border:1px solid #cde7a1;border-radius:15px;background:#f7ffe7}.confirmed b{color:#4f7021;font-size:8px;letter-spacing:.08em}.confirmed span{color:#66704f;font-size:10px;line-height:1.4}.unlockBox{max-width:560px;margin:16px auto 0;padding:14px;border:1px solid #e7ddeb;border-radius:20px;background:#fffafc}.permission{display:flex;align-items:flex-start;gap:9px;text-align:left;color:#655b68;font-size:10px;font-weight:750;line-height:1.45}.permission input{width:20px;height:20px;flex:0 0 20px;accent-color:#7138f5}.unlockBox small{display:block;margin-top:10px;color:#9a909b;font-size:8px}.textButton{border:0;background:transparent;color:#6d4aba;text-decoration:underline;text-underline-offset:3px;font:850 10px inherit;margin-top:14px;padding:9px;cursor:pointer}.viewerCard,.doneCard{margin-top:6px}.sectionHead{max-width:590px;margin:0 auto 15px}.sectionHead h2{font-size:31px}.viewerWrap{position:relative;width:100%;height:min(66vh,560px);min-height:390px;overflow:hidden;border:1px solid #e4d9e6;border-radius:24px;background:#f7f3f8}.viewerWrap.dark{background:#21172c}.viewerWrap :global(.viewerShell){height:100%!important;min-height:100%!important;border-radius:0!important}.viewerCard>.primary{max-width:520px}.saving{display:flex;align-items:center;justify-content:center;gap:8px;margin:14px auto 0;color:#6c6270;font-size:10px;font-weight:850}.saving span{width:12px;height:12px;border:2px solid #d5cce0;border-top-color:#7138f5;border-radius:50%;animation:spin .8s linear infinite}.doneBadge{display:inline-flex;padding:8px 11px;border:1px solid #cfe6a7;border-radius:999px;background:#f4ffe1;color:#527224;font-size:8px;font-weight:1000;letter-spacing:.09em}.finalActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:620px;margin:0 auto}.linkButton{display:flex;align-items:center;justify-content:center;box-sizing:border-box;text-decoration:none}.finalActions .secondary{margin-top:16px}.finalNote{display:block;margin-top:12px;color:#8e848f;font-size:9px}.savedId{display:block;margin-top:6px;color:#aaa0aa;font-size:7px;word-break:break-all}.status{min-height:18px;max-width:640px;margin:14px auto 0;text-align:center;color:#675d69;font-size:10px;font-weight:750;line-height:1.5}.truth{max-width:620px;margin:10px auto 0;text-align:center;color:#9d949e;font-size:8px;line-height:1.55}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:620px){.houseApp{padding:10px 8px calc(104px + env(safe-area-inset-bottom))}.intro{padding:18px 6px 13px}.intro h1{font-size:39px}.steps{gap:4px}.step{padding:7px 1px}.step span{font-size:5.6px;letter-spacing:.02em}.card{padding:13px;border-radius:22px}.photoAddressGrid{grid-template-columns:1fr}.photoFrame,.photoFrame img{min-height:250px}.addressSide{padding:6px 2px}.viewerWrap{min-height:350px;height:55vh}.finalActions{grid-template-columns:1fr}.finalActions .secondary{margin-top:0}.card h2,.sectionHead h2,.addressSide h2{font-size:26px}}@media(prefers-reduced-motion:reduce){.saving span{animation:none}}
`;
