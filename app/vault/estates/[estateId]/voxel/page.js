'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import PhotoReliefModelViewer from '../../../../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../../../../property/LocalVoxelModelViewer';
import SavedVoxelModelViewer from './SavedVoxelModelViewer';
import { getSupabaseBrowserAsync } from '../../../../../lib/supabase-browser';
import styles from './page.module.css';

function clean(value) { return String(value || '').trim(); }
function isHeic(file) { return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || '')); }
function isSupportedPhoto(file) { return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || isHeic(file); }

async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This iPhone photo could not be decoded. Try a screenshot instead.')); });
    const maxEdge = 2400; const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale)); canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Photo conversion is unavailable on this device.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93)); if (!blob) throw new Error('Photo conversion failed.');
    return new File([blob], String(file.name || 'property.heic').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  } finally { URL.revokeObjectURL(url); }
}

function estateDesignUrl(estate) {
  if (!estate) return '';
  const accent = estate.accent || '#c9ff54'; const structure = estate.structure || '#d8d0c4'; const roof = estate.roof || '#4d4448'; const terrain = estate.terrain || '#344738';
  const name = String(estate.name || 'Digital Twin').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f0ff"/><stop offset="1" stop-color="#fff5d9"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#sky)"/><ellipse cx="510" cy="760" rx="390" ry="120" fill="${terrain}" opacity=".88"/><path d="M220 500 L500 350 L790 470 L505 620 Z" fill="${roof}"/><path d="M245 500 L505 620 L505 805 L245 680 Z" fill="${structure}"/><path d="M505 620 L770 485 L770 665 L505 805 Z" fill="#b9afa4"/><rect x="310" y="555" width="74" height="105" rx="5" fill="${accent}"/><rect x="410" y="600" width="64" height="98" rx="5" fill="${accent}"/><polygon points="570,585 640,550 640,650 570,684" fill="${accent}"/><polygon points="666,536 726,506 726,603 666,633" fill="${accent}"/><rect x="60" y="60" width="880" height="90" rx="32" fill="#ffffff" opacity=".86"/><text x="105" y="117" fill="#3f2a58" font-family="Arial,sans-serif" font-size="34" font-weight="800">${name}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function PurchasedTwinVoxelPage() {
  const params = useParams();
  const estateId = clean(params?.estateId); const draftId = `estate-${estateId}`;
  const [authReady, setAuthReady] = useState(false); const [session, setSession] = useState(null); const [ownedItem, setOwnedItem] = useState(null);
  const [sourceUrl, setSourceUrl] = useState(''); const [sourceKind, setSourceKind] = useState(''); const [sourceAccepted, setSourceAccepted] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false); const [previewReady, setPreviewReady] = useState(false); const [previewApproved, setPreviewApproved] = useState(false);
  const [final3d, setFinal3d] = useState({ status: 'NOT_STARTED', taskId: null, modelUrl: null }); const [busy, setBusy] = useState(''); const [status, setStatus] = useState('Verifying this purchase…');
  const clientRef = useRef(null); const inputRef = useRef(null); const registeringRef = useRef(false);
  const estate = ownedItem?.estate || null; const finalReady = final3d.status === 'SUCCEEDED' && Boolean(final3d.taskId && final3d.modelUrl);
  const stage = finalReady ? 4 : previewApproved ? 3 : sourceAccepted ? 2 : 1; const labels = ['SOURCE', '3D PREVIEW', 'VOXEL', 'MINT'];
  const mintHref = finalReady ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(estate?.name || 'Digital Twin')}` : '#';

  async function loadPurchase(nextSession) {
    if (!nextSession?.access_token || !estateId) return;
    setStatus('Verifying your purchased Digital Twin…');
    try {
      const response = await fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${nextSession.access_token}` } });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || 'Your purchases could not be loaded.');
      const item = (Array.isArray(data.owned) ? data.owned : []).find((entry) => entry?.estate?.id === estateId) || null;
      if (!item) throw new Error('This Digital Twin is not a paid purchase on the signed-in account.');
      setOwnedItem(item); setSourceUrl(estateDesignUrl(item.estate)); setSourceKind('purchased-design'); setRightsConfirmed(true);
      if (item.voxelReady && item.voxelTaskId && item.voxelModelUrl) {
        setSourceAccepted(true); setPreviewApproved(true); setFinal3d({ status: 'SUCCEEDED', taskId: item.voxelTaskId, modelUrl: item.voxelModelUrl }); setStatus('Purchase verified. Your exact saved 3D voxel is open.');
      } else setStatus('Purchase verified. Your custom 3D voxel is included—no second VoxelPop creation charge.');
    } catch (error) { setOwnedItem(null); setStatus(error instanceof Error ? error.message : 'This purchase could not be verified.'); }
  }

  useEffect(() => {
    let active = true; let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return; clientRef.current = client; const { data } = await client.auth.getSession(); if (!active) return;
      const next = data.session || null; setSession(next); setAuthReady(true); if (next) await loadPurchase(next); else setStatus('Sign in with the account that bought this Digital Twin.');
      const auth = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!active) return; setSession(nextSession || null); setAuthReady(true);
        if (nextSession) await loadPurchase(nextSession); else { setOwnedItem(null); setStatus('Sign in with the account that bought this Digital Twin.'); }
      }); subscription = auth.data.subscription;
    }).catch(() => { if (active) { setAuthReady(true); setStatus('Account sign-in is unavailable on this deployment.'); } });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [estateId]);

  async function signIn() {
    setBusy('signin');
    try { const client = clientRef.current || await getSupabaseBrowserAsync(); clientRef.current = client; const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } }); if (error) throw error; }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not sign in.'); setBusy(''); }
  }

  function resetSource() { setSourceUrl(estateDesignUrl(estate)); setSourceKind('purchased-design'); setRightsConfirmed(true); setSourceAccepted(false); setPreviewReady(false); setPreviewApproved(false); setFinal3d({ status: 'NOT_STARTED', taskId: null, modelUrl: null }); setStatus('Choose the purchased design or an authorized property photo.'); }
  function usePurchasedDesign() { if (!estate) return; setSourceUrl(estateDesignUrl(estate)); setSourceKind('purchased-design'); setRightsConfirmed(true); setSourceAccepted(true); setPreviewReady(false); setPreviewApproved(false); setFinal3d({ status: 'NOT_STARTED', taskId: null, modelUrl: null }); setStatus('Using the Digital Twin design you bought. Loading its 3D preview first.'); }
  function choosePhoto() { inputRef.current?.click(); }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return;
    if (!isSupportedPhoto(selected)) return setStatus('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.'); if (selected.size > 12 * 1024 * 1024) return setStatus('Choose a photo smaller than 12 MB.');
    setBusy('photo');
    try {
      const photo = await normalizeIphonePhoto(selected);
      setSourceUrl((current) => { if (current?.startsWith('blob:')) URL.revokeObjectURL(current); return URL.createObjectURL(photo); });
      setSourceKind('photo'); setRightsConfirmed(false); setSourceAccepted(false); setPreviewReady(false); setPreviewApproved(false); setFinal3d({ status: 'NOT_STARTED', taskId: null, modelUrl: null });
      setStatus('Photo ready. Confirm permission, then use it as the source for this purchased twin.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Photo could not be prepared.'); } finally { setBusy(''); }
  }

  function acceptPhoto() { if (sourceKind !== 'photo' || !rightsConfirmed) return setStatus('Confirm that you took this photo or have permission to use it.'); setSourceAccepted(true); setPreviewReady(false); setStatus('Photo approved. Loading the recognizable 3D preview first.'); }
  function approvePreview() { if (!previewReady) return; setPreviewApproved(true); setFinal3d({ status: 'IN_PROGRESS', taskId: null, modelUrl: null }); setStatus('3D preview approved. Building the separate voxel version now…'); }

  const registerVoxel = useCallback(async (recipe) => {
    if (!recipe || !session?.access_token || registeringRef.current) return; registeringRef.current = true; setBusy('register'); setStatus('Saving this voxel to your account…');
    try {
      const response = await fetch('/api/property-local-voxel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ draftId, recipe }) });
      const data = await response.json().catch(() => ({})); if (!response.ok || !data?.ok || !data?.taskId || !data?.modelUrl) throw new Error(data?.error || 'This voxel could not be attached to your purchase.');
      setFinal3d({ status: 'SUCCEEDED', taskId: data.taskId, modelUrl: data.modelUrl }); setStatus('3D voxel ready and attached to your purchased Digital Twin.');
    } catch (error) { setFinal3d({ status: 'LOCAL_ONLY', taskId: null, modelUrl: null }); setStatus(`${error instanceof Error ? error.message : 'The voxel could not be saved.'} The visible local model was not treated as account-ready.`); }
    finally { registeringRef.current = false; setBusy(''); }
  }, [session?.access_token, draftId]);

  if (!authReady) return <main className={styles.page}><div className={styles.shell}><section className={styles.hero}><small>PURCHASED TWIN → VOXEL</small><h1>Opening your purchase…</h1><p>{status}</p></section></div></main>;
  if (!session?.user) return <main className={styles.page}><div className={styles.shell}><section className={styles.hero}><small>PURCHASED TWIN → VOXEL</small><h1>Sign in first.</h1><p>Use the Google account that bought this Digital Twin so Voxel Vault can unlock the included voxel creation.</p></section><div className={styles.choice}><button className={styles.primary} onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button><Link className={styles.upload} href="/vault">Back to Vault</Link></div><p className={styles.message}>{status}</p></div></main>;
  if (!ownedItem) return <main className={styles.page}><div className={styles.shell}><section className={styles.hero}><small>PURCHASE CHECK</small><h1>This twin is not unlocked.</h1><p>{status}</p></section><div className={styles.choice}><Link className={styles.primary} href="/vault">Back to my Vault</Link></div></div></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.top}><Link href="/vault">← MY VAULT</Link><span className={styles.brand}>VOXELPOP · INCLUDED CREATION</span><Link href="/more">MORE</Link></nav>
    <section className={styles.hero}><small>YOU ALREADY BOUGHT THIS DIGITAL TWIN</small><h1>Turn it into<br/>your 3D voxel.</h1><p>No second $4.99 VoxelPop creation charge. Choose the purchased design itself, or add a photo you are allowed to use for a more personal visual match.</p></section>
    <div className={styles.progress}>{labels.map((label, index) => <span key={label} className={index + 1 <= stage ? styles.on : ''}/>)}</div><div className={styles.stage}>STEP {stage} OF 4 · {labels[stage - 1]}</div>
    <section className={styles.purchase}><div className={styles.art} style={{ '--accent': estate.accent || '#c9ff54' }}><div className={styles.land}/><div className={styles.house}><i/><i/><i/></div></div><div className={styles.purchaseCopy}><small>PURCHASE VERIFIED</small><h2>{estate.name}</h2><p>{estate.locationLabel}. The purchase unlocks this included custom voxel workflow; it does not create physical-property rights.</p></div></section>

    {stage === 1 ? <div className={styles.choice}><button className={styles.primary} type="button" onClick={usePurchasedDesign}>Use the twin I bought → 3D preview</button><button className={styles.upload} type="button" onClick={choosePhoto} disabled={busy === 'photo'}>{busy === 'photo' ? 'Preparing photo…' : 'Use my property photo instead'}</button><input ref={inputRef} className={styles.hidden} type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>{sourceKind === 'photo' ? <><label className={styles.rights}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label><button className={styles.secondary} type="button" onClick={acceptPhoto} disabled={!rightsConfirmed}>Use this photo → 3D preview</button></> : null}</div> : null}
    {stage === 2 ? <><p className={styles.copy}>See the 3D picture first. The voxel does not start until you approve this preview.</p><div className={styles.viewer}><PhotoReliefModelViewer imageUrl={sourceUrl} onReady={() => setPreviewReady(true)}/><span className={styles.badge}>{sourceKind === 'photo' ? 'YOUR PHOTO · 3D PREVIEW' : 'PURCHASED TWIN · 3D PREVIEW'}</span></div><div className={styles.choice}><button className={styles.primary} type="button" onClick={approvePreview} disabled={!previewReady}>{previewReady ? 'Looks right → Build my 3D voxel' : 'Building 3D preview…'}</button><button className={styles.upload} type="button" onClick={resetSource}>Change source</button></div></> : null}
    {stage === 3 ? <><p className={styles.copy}>Now VoxelPop converts the approved source into the separate movable block model. No Meshy credits are used.</p><div className={styles.viewer}><LocalVoxelModelViewer imageUrl={sourceUrl} sourceImageUrl={sourceUrl} onReady={registerVoxel}/><span className={styles.badge}>BUILDING INCLUDED 3D VOXEL</span></div>{final3d.status === 'LOCAL_ONLY' ? <div className={styles.done}><b>Voxel visible, but not saved yet.</b><span>Reload this page and rebuild before minting so the account binding is complete.</span></div> : null}</> : null}
    {stage === 4 ? <><p className={styles.copy}>Your purchased Digital Twin now opens the exact saved 3D voxel attached to this account.</p><div className={styles.viewer}><SavedVoxelModelViewer modelUrl={final3d.modelUrl}/><span className={styles.badge}>PURCHASED TWIN · EXACT SAVED 3D VOXEL</span></div><div className={styles.done}><b>Saved to your account ✓</b><span>You can reopen this exact voxel from Vault. Minting is optional and applies to the digital voxel only.</span><Link className={styles.primary} href={mintHref}>Mint this digital voxel →</Link><button className={styles.upload} type="button" onClick={resetSource}>Remake with another source</button><Link className={styles.secondary} href="/vault">Back to my Vault</Link></div></> : null}
    <p className={styles.message} role="status">{status}</p><div className={styles.truth}>The purchased item and resulting voxel are digital assets. Using a real-property photo, mapping an address, or minting the voxel does not create deed/title, rent, occupancy, investment, or guaranteed appreciation rights in physical real estate.</div>
  </div></main>;
}
