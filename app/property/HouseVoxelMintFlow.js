'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraft } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import LocalVoxelModelViewer from './LocalVoxelModelViewer';
import PhotoReliefModelViewer from './PhotoReliefModelViewer';

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

const STAGES = ['photo', 'address', 'image', 'model', 'done'];
const LABELS = ['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'DONE'];

export default function HouseVoxelMintFlow() {
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
  const [message, setMessage] = useState('Choose a house photo.');
  const [claimedByYou, setClaimedByYou] = useState(false);
  const inputRef = useRef(null);
  const clientRef = useRef(null);
  const registeringRef = useRef(false);

  const stageIndex = Math.max(0, STAGES.indexOf(stage));

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

  useEffect(() => {
    if (!voxelImageReady || stage !== 'image') return undefined;
    const timer = window.setTimeout(() => {
      setStage('model');
      setMessage('Voxel image ready. Turning it into your movable 3D voxel…');
    }, 850);
    return () => window.clearTimeout(timer);
  }, [voxelImageReady, stage]);

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
    if (!isSupportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a photo smaller than 12 MB.');

    setBusy('photo');
    setMessage('Preparing photo…');
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
      setMessage('Now confirm the house address.');
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
    setMessage('Confirming this house…');
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
      setStage('image');
      setMessage('Address confirmed. Building the voxel image…');
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
    setMessage('Saving your 3D voxel to inventory…');
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
      if (!finalize.ok || !lock?.finalized) throw new Error(lock?.error || 'The one-property mint lock could not be finalized.');

      const now = new Date().toISOString();
      const finishedDraft = {
        schemaVersion: 1,
        type: 'voxel-vault-property-3d-draft',
        id: `voxelpop:${draftId}`,
        label: property.address || 'My Voxel House',
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
        world: { public: false, publishedAt: null, publicLabel: 'Voxel House' },
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
      setStage('done');
      setMessage('Done. Your 3D voxel is in your inventory and ready to mint.');
    } catch (error) {
      setMessage(`${String(error?.message || error || 'The voxel could not be saved.')} Tap retry.`);
    } finally {
      registeringRef.current = false;
      setBusy('');
    }
  }, [address, draftId, property, session?.access_token, session?.user]);

  async function reset() {
    if (property?.identityKey && stage !== 'done') {
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
    setMessage('Choose a house photo.');
  }

  if (!authReady) return <main className="hvPage"><section className="hvShell"><div className="hvLogo">V</div><h1>Opening Voxel Vault…</h1><style jsx>{styles}</style></section></main>;

  if (!session?.user) return <main className="hvPage"><section className="hvShell hvCentered">
    <div className="hvLogo">V</div>
    <p className="hvEyebrow">VOXEL VAULT</p>
    <h1>Turn a house photo<br/>into your voxel.</h1>
    <p className="hvLead">Sign in once so the finished voxel can stay in your inventory.</p>
    <button className="hvPrimary" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Continue with Google'}</button>
    <p className="hvStatus" role="status">{message}</p>
    <style jsx>{styles}</style>
  </section></main>;

  const mintHref = final3d?.taskId
    ? `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(final3d.taskId)}&name=${encodeURIComponent(savedDraft?.label || 'Voxel House')}`
    : '#';

  return <main className="hvPage"><section className="hvShell">
    <header className="hvHeader">
      <div><p className="hvEyebrow">VOXEL VAULT</p><h1>House → Voxel</h1></div>
      <a href="/vault/property-drafts">Inventory</a>
    </header>

    <div className="hvSteps" aria-label={`Step ${stageIndex + 1} of ${LABELS.length}`}>
      {LABELS.map((label, index) => <div key={label} className={index <= stageIndex ? 'on' : ''}><span>{index + 1}</span><small>{label}</small></div>)}
    </div>

    <input ref={inputRef} className="hvHidden" type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

    {stage === 'photo' ? <section className="hvCard hvUpload">
      <div className="hvBigIcon">⌂</div>
      <h2>Upload one house photo.</h2>
      <p>A clear front or angled photo works best.</p>
      <button className="hvPrimary" type="button" onClick={choosePhoto} disabled={busy === 'photo'}>{busy === 'photo' ? 'Preparing…' : 'Choose photo'}</button>
      <small>Use a photo you own or have permission to use.</small>
    </section> : null}

    {stage === 'address' ? <section className="hvGrid">
      <div className="hvPhotoCard"><img src={photoUrl} alt="Selected house"/><span>YOUR HOUSE PHOTO</span></div>
      <form className="hvCard hvAddress" onSubmit={confirmAddress}>
        <p className="hvMini">NEXT</p>
        <h2>Confirm the address.</h2>
        <p>This locks the real-world building identity so the same property cannot be minted twice.</p>
        <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main St, City, State" autoComplete="street-address" autoCapitalize="words" aria-label="House address"/>
        <button className="hvPrimary" type="submit" disabled={!clean(address) || busy === 'address'}>{busy === 'address' ? 'Confirming…' : 'Confirm address'}</button>
        <button className="hvText" type="button" onClick={choosePhoto}>Change photo</button>
        {claimedByYou ? <a className="hvInventoryLink" href="/vault/property-drafts">Open your inventory →</a> : null}
      </form>
    </section> : null}

    {stage === 'image' ? <section className="hvBuild">
      <div className="hvBuildCopy"><p className="hvMini">ADDRESS CONFIRMED</p><h2>Building the voxel image.</h2><p>{property?.address}</p></div>
      <div className="hvViewer"><PhotoReliefModelViewer imageUrl={photoUrl} onReady={() => setVoxelImageReady(true)}/><span>{voxelImageReady ? 'VOXEL IMAGE READY' : 'VOXELIZING PHOTO'}</span></div>
    </section> : null}

    {stage === 'model' ? <section className="hvBuild">
      <div className="hvBuildCopy"><p className="hvMini">VOXEL IMAGE READY</p><h2>Turning it into 3D.</h2><p>The finished voxel saves to your inventory automatically.</p></div>
      <div className="hvViewer"><LocalVoxelModelViewer imageUrl={photoUrl} sourceImageUrl={photoUrl} onReady={saveFinishedVoxel}/><span>{busy === 'model' ? 'SAVING 3D VOXEL' : 'BUILDING 3D VOXEL'}</span></div>
      {busy !== 'model' && !final3d ? <button className="hvRetry" type="button" onClick={() => setStage('image')}>Restart build</button> : null}
    </section> : null}

    {stage === 'done' ? <section className="hvDone">
      <div className="hvDoneMark">✓</div>
      <p className="hvMini">SAVED TO INVENTORY</p>
      <h2>Your house voxel is ready.</h2>
      <p className="hvDoneAddress">{property?.address}</p>
      <div className="hvViewer"><LocalVoxelModelViewer imageUrl={photoUrl} sourceImageUrl={photoUrl}/><span>YOUR 3D VOXEL</span></div>
      <div className="hvActions">
        <a className="hvPrimary hvAnchor" href={mintHref}>Mint voxel</a>
        <a className="hvSecondary" href="/vault/property-drafts">Keep in inventory</a>
      </div>
      <p className="hvTruth">One property can only have one Voxel Vault mint. The NFT represents the digital voxel, not ownership of the physical house.</p>
    </section> : null}

    {stage !== 'photo' && stage !== 'done' ? <button className="hvStartOver" type="button" onClick={reset}>Start over</button> : null}
    {stage === 'done' ? <button className="hvStartOver" type="button" onClick={reset}>Voxel another house</button> : null}
    <p className="hvStatus" role="status">{message}</p>
    <style jsx>{styles}</style>
  </section></main>;
}

const styles = `
:global(body){margin:0;background:#fff9f1;color:#251a2c;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.hvPage{min-height:100vh;padding:14px 12px calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 14% 5%,rgba(255,196,92,.32),transparent 28%),radial-gradient(circle at 88% 12%,rgba(121,71,255,.17),transparent 30%),radial-gradient(circle at 50% 90%,rgba(187,255,67,.19),transparent 26%),#fff9f1}.hvShell{width:min(720px,100%);margin:0 auto}.hvCentered{text-align:center;padding-top:9vh}.hvLogo{width:64px;height:64px;margin:0 auto 18px;border-radius:21px;display:grid;place-items:center;background:linear-gradient(145deg,#8a55ff,#6530ec);color:#fff;font-size:31px;font-weight:1000;box-shadow:0 8px 0 #5420ce,0 18px 38px rgba(101,48,236,.19)}.hvEyebrow,.hvMini{margin:0;color:#7859bd;font-size:9px;font-weight:1000;letter-spacing:.13em;text-transform:uppercase}.hvCentered h1{margin:10px 0 13px;font-size:clamp(40px,8vw,61px);line-height:.94;letter-spacing:-.06em}.hvLead{max-width:440px;margin:0 auto 22px;color:#7c727c;font-size:14px;line-height:1.55}.hvHeader{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:8px 2px 14px}.hvHeader h1{margin:4px 0 0;font-size:34px;line-height:1;letter-spacing:-.055em}.hvHeader a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border:1px solid #ddd3e5;border-radius:14px;background:rgba(255,255,255,.82);color:#6844b8;text-decoration:none;font-size:10px;font-weight:950}.hvSteps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:7px 0 16px}.hvSteps div{min-width:0;padding:8px 4px;border:1px solid #e5dce9;border-radius:13px;background:rgba(255,255,255,.56);text-align:center}.hvSteps span{width:23px;height:23px;margin:auto;display:grid;place-items:center;border-radius:8px;background:#eee8f2;color:#95899b;font-size:9px;font-weight:1000}.hvSteps small{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;color:#9d949f;font-size:6.5px;font-weight:1000;letter-spacing:.04em;white-space:nowrap}.hvSteps .on{border-color:#d6c4ff;background:#fff}.hvSteps .on span{background:#7a44ff;color:#fff}.hvSteps .on small{color:#61428f}.hvCard{border:1px solid #e4d9e7;border-radius:28px;background:rgba(255,255,255,.92);box-shadow:0 18px 45px rgba(68,45,82,.08)}.hvUpload{display:grid;justify-items:center;gap:10px;padding:42px 22px;text-align:center}.hvBigIcon{width:92px;height:92px;border-radius:28px;display:grid;place-items:center;background:linear-gradient(145deg,#caff56,#f4ffbb);color:#40581a;font-size:51px;font-weight:1000;box-shadow:0 8px 0 #aadd34}.hvUpload h2,.hvAddress h2,.hvBuildCopy h2,.hvDone h2{margin:9px 0 0;font-size:clamp(30px,6vw,44px);line-height:.97;letter-spacing:-.055em}.hvUpload p,.hvAddress p,.hvBuildCopy p,.hvDone>p{margin:0;color:#80757f;font-size:12px;line-height:1.5}.hvUpload small{margin-top:3px;color:#9b929a;font-size:9px}.hvPrimary{min-height:58px;border:0;border-radius:18px;padding:0 22px;background:linear-gradient(180deg,#824dff,#6630ed);color:#fff;font:950 16px inherit;box-shadow:0 6px 0 #5020c9,0 14px 24px rgba(102,48,237,.17);cursor:pointer}.hvPrimary:disabled{opacity:.5;box-shadow:none;cursor:default}.hvGrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:12px}.hvPhotoCard{position:relative;min-height:430px;border-radius:28px;overflow:hidden;background:#251a2d;border:1px solid #e0d6e4}.hvPhotoCard img{width:100%;height:100%;min-height:430px;display:block;object-fit:cover}.hvPhotoCard span,.hvViewer>span{position:absolute;z-index:7;top:12px;left:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.53);border-radius:999px;background:rgba(34,24,40,.73);color:#fff;font-size:7px;font-weight:1000;letter-spacing:.08em;backdrop-filter:blur(10px)}.hvAddress{align-self:stretch;padding:25px 19px;display:flex;flex-direction:column;justify-content:center;gap:12px}.hvAddress input{width:100%;box-sizing:border-box;min-height:56px;border:1px solid #dfd4e4;border-radius:16px;background:#fff;padding:0 14px;color:#2f2731;font:800 16px inherit;outline:none}.hvAddress input:focus{border-color:#9574df;box-shadow:0 0 0 4px rgba(113,56,245,.08)}.hvText,.hvStartOver,.hvRetry{border:0;background:transparent;color:#7450bd;font:850 10px inherit;text-decoration:underline;text-underline-offset:3px;padding:11px;cursor:pointer}.hvInventoryLink{color:#4d681e;font-size:10px;font-weight:950;text-decoration:none}.hvBuild{display:grid;gap:12px}.hvBuildCopy{padding:5px 3px 0}.hvBuildCopy p:last-child{margin-top:8px}.hvViewer{position:relative;width:100%;height:min(62vh,560px);min-height:390px;border:1px solid #e2d8e5;border-radius:30px;overflow:hidden;background:#20172a;box-shadow:0 20px 50px rgba(63,41,77,.12)}.hvViewer>div{height:100%!important;min-height:100%!important}.hvViewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.hvRetry{justify-self:center}.hvDone{text-align:center}.hvDoneMark{width:68px;height:68px;margin:12px auto 10px;border-radius:22px;display:grid;place-items:center;background:#caff56;color:#40591a;font-size:29px;font-weight:1000;box-shadow:0 7px 0 #a9dc39}.hvDoneAddress{margin:8px 0 14px!important;color:#6f6470!important;font-weight:800}.hvActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.hvAnchor,.hvSecondary{display:flex;align-items:center;justify-content:center;text-decoration:none}.hvSecondary{min-height:58px;border:1px solid #ded4e5;border-radius:18px;background:#fff;color:#6945b7;font-size:14px;font-weight:950;box-shadow:0 8px 20px rgba(72,49,86,.06)}.hvTruth{max-width:590px;margin:12px auto 0!important;color:#9b929a!important;font-size:8.5px!important}.hvStartOver{display:block;margin:16px auto 0}.hvStatus{min-height:20px;max-width:620px;margin:12px auto 0;text-align:center;color:#766c76;font-size:10px;font-weight:700;line-height:1.5}.hvHidden{display:none}@media(max-width:680px){.hvGrid{grid-template-columns:1fr}.hvPhotoCard,.hvPhotoCard img{min-height:290px;max-height:360px}.hvAddress{padding:20px 15px}.hvSteps small{font-size:5.7px}.hvViewer{height:470px;min-height:360px}.hvActions{grid-template-columns:1fr}.hvCentered{padding-top:48px}}@media(max-width:390px){.hvPage{padding-left:8px;padding-right:8px}.hvHeader h1{font-size:30px}.hvHeader a{padding:0 10px}.hvSteps{gap:3px}.hvSteps div{padding:7px 2px}.hvSteps small{font-size:5px}.hvViewer{height:420px;min-height:330px}.hvUpload{padding:34px 16px}}
`;
