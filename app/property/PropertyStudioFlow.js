'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';
import styles from './PropertyStudio.module.css';

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
      image.onerror = () => reject(new Error('This HEIC photo could not be opened. Try a screenshot instead.'));
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
    return new File([blob], String(file.name || 'house.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const STAGES = ['photo', 'address', 'preview', 'build', 'complete'];
const PROGRESS = [
  { label: 'PHOTO', detail: 'Choose' },
  { label: 'ADDRESS', detail: 'Confirm' },
  { label: 'VOXEL', detail: 'Preview' },
  { label: 'BUILD', detail: 'Create 3D' },
  { label: 'VAULT', detail: 'Save + mint' },
];

function StudioTopbar() {
  return <header className={styles.topbar}>
    <Link className={styles.brand} href="/">
      <span className={styles.brandMark}>V</span>
      <span>VOXEL VAULT</span>
    </Link>
    <nav className={styles.nav} aria-label="Voxel Vault navigation">
      <Link href="/property">Create</Link>
      <Link href="/vault/property-drafts">Inventory</Link>
    </nav>
  </header>;
}

function Progress({ stage }) {
  const stageIndex = Math.max(0, STAGES.indexOf(stage));
  return <div className={styles.progressWrap} aria-label={`Step ${stageIndex + 1} of ${PROGRESS.length}`}>
    <div className={styles.progress}>
      {PROGRESS.map((item, index) => {
        const className = index < stageIndex
          ? `${styles.progressItem} ${styles.progressDone}`
          : index === stageIndex
            ? `${styles.progressItem} ${styles.progressCurrent}`
            : styles.progressItem;
        return <div key={item.label} className={className}>
          <span>{index < stageIndex ? '✓' : index + 1}</span>
          <div><b>{item.label}</b><small>{item.detail}</small></div>
        </div>;
      })}
    </div>
  </div>;
}

export default function PropertyStudioFlow() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [draftId, setDraftId] = useState('');
  const [stage, setStage] = useState('photo');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [property, setProperty] = useState(null);
  const [voxelImageReady, setVoxelImageReady] = useState(false);
  const [final3d, setFinal3d] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Choose a property photo to begin.');
  const [claimedByYou, setClaimedByYou] = useState(false);
  const inputRef = useRef(null);
  const clientRef = useRef(null);
  const registeringRef = useRef(false);

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
      if (data.session?.user) setDraftId(newDraftId());
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
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

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
      setBusy('');
      setMessage(String(error?.message || error || 'Could not sign in.'));
    }
  }

  function choosePhoto() {
    if (!session?.access_token) return;
    inputRef.current?.click();
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!isSupportedPhoto(selected)) {
      setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
      return;
    }
    if (selected.size > 12 * 1024 * 1024) {
      setMessage('Choose a photo smaller than 12 MB.');
      return;
    }

    setBusy('photo');
    setMessage('Preparing your photo…');
    try {
      const normalized = await normalizeIphonePhoto(selected);
      if (normalized.size > 8 * 1024 * 1024) throw new Error('This photo is still too large. Try a screenshot or smaller version.');
      setPhoto(normalized);
      setPhotoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(normalized);
      });
      setAddress('');
      setProperty(null);
      setVoxelImageReady(false);
      setFinal3d(null);
      setSavedDraft(null);
      setClaimedByYou(false);
      setStage('address');
      setMessage('Photo ready. Confirm the property address.');
    } catch (error) {
      setMessage(String(error?.message || error || 'The photo could not be prepared.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmAddress(event) {
    event.preventDefault();
    if (!photo || !draftId || !session?.access_token || !clean(address)) return;
    setBusy('address');
    setClaimedByYou(false);
    setMessage('Confirming this property…');
    try {
      const response = await fetch('/api/property-generation/confirm', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, address: clean(address) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.confirmed) {
        if (data?.ownedByYou) setClaimedByYou(true);
        throw new Error(data?.error || 'This address could not be confirmed.');
      }
      setAddress(data.address || clean(address));
      setProperty({ identityKey: data.identityKey, atlasId: data.atlasId, address: data.address || clean(address) });
      setVoxelImageReady(false);
      setStage('preview');
      setMessage('Address confirmed. Building your voxel preview…');
    } catch (error) {
      setMessage(String(error?.message || error || 'This address could not be confirmed.'));
    } finally {
      setBusy('');
    }
  }

  const saveFinishedVoxel = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || !session?.user || !draftId || !property?.identityKey || registeringRef.current) return;
    registeringRef.current = true;
    setBusy('model');
    setMessage('Saving your finished 3D voxel to inventory…');
    try {
      const response = await fetch('/api/property-local-voxel', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, recipe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'The 3D voxel could not be saved.');

      const finalize = await fetch('/api/property-generation/finalize', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ draftId, identityKey: property.identityKey, taskId: data.taskId }),
      });
      const lock = await finalize.json().catch(() => ({}));
      if (!finalize.ok || !lock?.finalized) throw new Error(lock?.error || 'The one-property collectible lock could not be finalized.');

      const now = new Date().toISOString();
      const finishedDraft = {
        schemaVersion: 1,
        type: 'voxel-vault-property-3d-draft',
        id: `voxelpop:${draftId}`,
        label: property.address || 'My Voxel Property',
        createdAt: now,
        updatedAt: now,
        state: 'saved',
        fidelity: 'photo-approved-local-voxel',
        geometryKind: 'digital-only',
        coordinates: { latitude: null, longitude: null },
        geometry: null,
        propertyIdentity: { atlasId: property.atlasId || null, parcelId: null, pin: null, sbl: null },
        evidence: {},
        visual: { modelUrl: data.modelUrl, modelTaskId: data.taskId, renderMode: 'voxelpop-local-3d' },
        voxelpop: {
          engine: 'voxelpop-local-webgl-v2',
          sourcePhotoStoredByVoxelVault: false,
          previewApproved: true,
          creationDraftId: draftId,
          modelTaskId: data.taskId,
          modelUrl: data.modelUrl,
          identityKey: property.identityKey,
          atlasId: property.atlasId || null,
          propertyAddress: property.address || address,
          onePropertyOneMint: true,
          onePropertyOnePurchase: true,
        },
        blockchain: { minted: false, optional: true, optionalAfterCreation: true, onePropertyOneMint: true, tokenId: null, network: null },
        world: { public: false, publishedAt: null, publicLabel: 'Voxel Property' },
        legal: {
          titleVerified: false,
          ownershipRightsCreatedByDraft: false,
          ownershipRightsCreatedByMint: false,
          note: 'This is a digital voxel collectible only. Saving or minting it does not create rights in the physical property.',
        },
      };

      const localSaved = savePropertyDraft(finishedDraft);
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await savePropertyDraftToAccount(client, session.user, localSaved);
      } catch {}

      setFinal3d({ taskId: data.taskId, modelUrl: data.modelUrl });
      setSavedDraft(localSaved);
      setStage('complete');
      setMessage('Done. Your voxel is saved in Inventory and ready to mint.');
    } catch (error) {
      setMessage(`${String(error?.message || error || 'The voxel could not be saved.')} Tap retry.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [address, draftId, property, session?.access_token, session?.user]);

  async function reset() {
    if (property?.identityKey && stage !== 'complete') {
      fetch('/api/property-generation/confirm', {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ identityKey: property.identityKey }),
      }).catch(() => {});
    }
    setDraftId(newDraftId());
    setStage('photo');
    setPhoto(null);
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    setAddress('');
    setProperty(null);
    setVoxelImageReady(false);
    setFinal3d(null);
    setSavedDraft(null);
    setClaimedByYou(false);
    setBusy('');
    setMessage('Choose a property photo to begin.');
  }

  if (!authReady) return <main className={styles.page}><section className={styles.shell}><StudioTopbar/><div className={styles.signInCard}><div className={styles.signInVoxel} aria-hidden="true"/><p className={styles.eyebrow}>PROPERTY STUDIO</p><h1>Opening your studio…</h1></div></section></main>;

  if (!session?.user) return <main className={styles.page}><section className={styles.shell}>
    <StudioTopbar/>
    <div className={styles.signInCard}>
      <div className={styles.signInVoxel} aria-hidden="true"/>
      <p className={styles.eyebrow}>PROPERTY STUDIO</p>
      <h1>Make a property collectible.</h1>
      <p>Sign in once so the finished voxel can be saved to your private Inventory and minted later if you choose.</p>
      <button className={styles.primary} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Continue with Google'}</button>
      <p className={styles.status} role="status">{message}</p>
    </div>
  </section></main>;

  const mintHref = final3d?.taskId && final3d?.modelUrl
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(savedDraft?.label || 'Voxel Property')}&modelUrl=${encodeURIComponent(final3d.modelUrl)}`
    : '#';

  return <main className={styles.page}><section className={styles.shell}>
    <StudioTopbar/>
    <Progress stage={stage}/>
    <input ref={inputRef} className={styles.hiddenInput} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

    {stage === 'photo' ? <>
      <header className={styles.stageHeader}><p className={styles.eyebrow}>STEP 1 · PHOTO</p><h1>Start with one great photo.</h1><p>Front or angled exterior shots work best. We use the image to build the collectible; your original photo stays on your device.</p></header>
      <section className={styles.stageCard}><div className={styles.uploadZone}>
        <div className={styles.uploadArt} aria-hidden="true"><div className={styles.uploadArtHouse}/><span className={styles.sparkOne}>✦</span><span className={styles.sparkTwo}>⌂</span><span className={styles.sparkThree}>3D</span></div>
        <div className={styles.uploadCopy}><p className={styles.eyebrow}>CAMERA ROLL → VOXEL</p><h2>Choose a property photo.</h2><p>Use a photo you own or have permission to use. JPG, PNG, WebP and iPhone HEIC photos are supported.</p><button className={styles.primary} type="button" onClick={choosePhoto} disabled={busy === 'photo'}>{busy === 'photo' ? 'Preparing photo…' : 'Choose photo'}</button><span className={styles.helper}>Up to 12 MB · mobile camera photos supported</span></div>
      </div></section>
    </> : null}

    {stage === 'address' ? <>
      <header className={styles.stageHeader}><p className={styles.eyebrow}>STEP 2 · ADDRESS</p><h1>Which property is this?</h1><p>Confirming the address gives the collectible a real property identity and prevents duplicate Voxel Vault mints.</p></header>
      <section className={`${styles.stageCard} ${styles.splitCard}`}>
        <div className={styles.photoPanel}><img src={photoUrl} alt="Selected property"/><span className={styles.photoBadge}>YOUR PHOTO</span></div>
        <div className={styles.addressCopy}><p className={styles.eyebrow}>PROPERTY IDENTITY</p><h2>Confirm the address.</h2><p>We only use it to identify the building and enforce the one-property collectible rule.</p>
          <form className={styles.addressForm} onSubmit={confirmAddress}>
            <input className={styles.addressInput} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main St, City, State" autoComplete="street-address" autoCapitalize="words" aria-label="Property address"/>
            <button className={styles.primary} type="submit" disabled={!clean(address) || busy === 'address'}>{busy === 'address' ? 'Confirming property…' : 'Confirm address'}</button>
            <button className={styles.textButton} type="button" onClick={choosePhoto}>Use a different photo</button>
          </form>
          {claimedByYou ? <div className={styles.inlineWarning}>This property is already in your account. <Link href="/vault/property-drafts">Open Inventory</Link> to view it.</div> : null}
        </div>
      </section>
    </> : null}

    {stage === 'preview' ? <>
      <header className={styles.stageHeader}><p className={styles.eyebrow}>STEP 3 · VOXEL PREVIEW</p><h1>See the voxel look first.</h1><p>We turn the property photo into a block-built preview before creating the movable 3D collectible.</p></header>
      <section className={`${styles.stageCard} ${styles.viewerStage}`}>
        <div className={styles.viewerShell}><PhotoReliefModelViewer imageUrl={photoUrl} onReady={() => setVoxelImageReady(true)}/><span className={styles.viewerBadge}>{voxelImageReady ? 'PREVIEW READY' : 'BUILDING PREVIEW'}</span></div>
        <div className={styles.viewerCaption}><div><b>{voxelImageReady ? 'Your voxel preview is ready.' : 'Voxelizing your photo…'}</b><span>{property?.address}</span></div><button className={styles.primary} type="button" disabled={!voxelImageReady} onClick={() => { setStage('build'); setMessage('Preview approved. Building your movable 3D voxel…'); }}>Build the 3D voxel</button></div>
      </section>
    </> : null}

    {stage === 'build' ? <>
      <header className={styles.stageHeader}><p className={styles.eyebrow}>STEP 4 · BUILD</p><h1>Your property becomes 3D.</h1><p>The finished movable voxel is saved to your Inventory automatically. You can mint it after it finishes.</p></header>
      <section className={`${styles.stageCard} ${styles.buildLayout}`}>
        <div className={styles.buildCopy}><p className={styles.eyebrow}>3D BUILD</p><h2>Building the collectible.</h2><p>{property?.address}</p><div className={styles.buildSteps}><div className={styles.buildStep}><span>✓</span>Photo prepared</div><div className={styles.buildStep}><span>✓</span>Address locked</div><div className={styles.buildStep}><span>3</span>Constructing voxel geometry</div><div className={styles.buildStep}><span>4</span>Saving to Inventory</div></div></div>
        <div className={styles.buildViewer}><div className={styles.viewerShell}><LocalVoxelModelViewer imageUrl={photoUrl} sourceImageUrl={photoUrl} onReady={saveFinishedVoxel}/><span className={styles.viewerBadge}>{busy === 'model' ? 'SAVING TO VAULT' : 'BUILDING 3D VOXEL'}</span></div></div>
      </section>
    </> : null}

    {stage === 'complete' ? <>
      <header className={styles.stageHeader}><p className={styles.eyebrow}>STEP 5 · VAULT</p><h1>Your voxel is yours.</h1><p>It is already saved in your Inventory. Mint the one-of-one collectible now, or keep it private and come back later.</p></header>
      <section className={`${styles.stageCard} ${styles.completeGrid}`}>
        <div className={styles.completeViewer}><div className={styles.viewerShell}><LocalVoxelModelViewer imageUrl={photoUrl} sourceImageUrl={photoUrl}/><span className={styles.viewerBadge}>SAVED 3D VOXEL</span></div></div>
        <div className={styles.completeCopy}><div className={styles.completeMark}>✓</div><p className={styles.eyebrow}>SAVED TO INVENTORY</p><h1>Ready to keep or mint.</h1><p className={styles.completeAddress}>{property?.address}</p><div className={styles.completeActions}><Link className={styles.mintLink} href={mintHref}>Mint this voxel</Link><Link className={styles.secondary} href="/vault/property-drafts">Keep in Inventory</Link><button className={styles.textButton} type="button" onClick={reset}>Create another property</button></div></div>
      </section>
    </> : null}

    {stage !== 'photo' && stage !== 'complete' ? <button className={styles.textButton} type="button" onClick={reset}>Start over</button> : null}
    <p className={styles.status} role="status">{message}</p>
    <p className={styles.truth}>A Voxel Vault mint represents the digital voxel collectible only. It does not create or transfer deed, title, equity, rent, occupancy, or other rights in the physical property.</p>
  </section></main>;
}
