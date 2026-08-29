'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import MeshyModelViewer from './MeshyModelViewer';

const blankReference = () => ({
  url: '',
  rightsBasis: 'user-owned',
  rightsReference: '',
  uploadedName: '',
  uploading: false,
});

function text(error) {
  return String(error?.message || error || 'Action failed.');
}

function terminalStatus(value) {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(String(value || '').toUpperCase());
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo format could not be decoded on this device. Export it as JPEG or PNG and try again.')); };
    image.src = url;
  });
}

async function normalizePhotoForMeshy(file) {
  if (!(file instanceof File)) throw new Error('Choose a photo first.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a photo smaller than 25 MB.');

  let source = null;
  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = source.width;
      height = source.height;
    } catch {}
  }
  if (!source) {
    source = await loadImageFromFile(file);
    width = source.naturalWidth || source.width;
    height = source.naturalHeight || source.height;
  }
  if (!width || !height) throw new Error('The selected photo has no readable dimensions.');

  const maxSide = 2048;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Photo conversion is unavailable in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('The photo could not be converted for Meshy.');
  const stem = String(file.name || 'property-view').replace(/\.[^.]+$/, '').slice(0, 90) || 'property-view';
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

function licensedFeedReferences(listing) {
  const values = Array.isArray(listing?.meshyReferences) ? listing.meshyReferences : [];
  return values.filter((item) => item?.url && item?.rightsBasis && item?.rightsReference).slice(0, 4);
}

function licensedOpenReferences(values) {
  return (Array.isArray(values) ? values : [])
    .filter((item) => item?.url && item?.rightsBasis === 'open-licensed' && item?.rightsReference)
    .slice(0, 4);
}

export default function MeshyHeroPanel({ building, listing = null, openReferences = [] }) {
  const [session, setSession] = useState(null);
  const [ownerState, setOwnerState] = useState('checking');
  const [status, setStatus] = useState('Checking Meshy 7 cache…');
  const [mesh, setMesh] = useState({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null, thumbnailUrl: null });
  const [references, setReferences] = useState([blankReference(), blankReference()]);
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);
  const atlasId = building?.atlasId || '';
  const feedReferences = useMemo(() => licensedFeedReferences(listing), [listing]);
  const openStreetReferences = useMemo(() => licensedOpenReferences(openReferences), [openReferences]);
  const readyReferences = useMemo(() => references.filter((item) => item.url && item.rightsBasis && item.rightsReference), [references]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, nextSession) => { if (active) setSession(nextSession || null); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (active) {
        setOwnerState('unavailable');
        setStatus(text(error));
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    setReferences([blankReference(), blankReference()]);
  }, [atlasId]);

  useEffect(() => {
    let active = true;
    async function loadCached() {
      if (!atlasId) {
        setOwnerState('idle');
        setStatus('Select a mapped building first.');
        setMesh({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null, thumbnailUrl: null });
        return;
      }
      if (!session?.access_token) {
        setOwnerState('signed-out');
        setStatus('Owner sign-in unlocks private Meshy 7 reconstruction and cached hero models.');
        setMesh({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null, thumbnailUrl: null });
        return;
      }
      setOwnerState('checking');
      setStatus('Checking private Meshy hero cache…');
      try {
        const response = await fetch(`/api/world-atlas/mesh?atlasId=${encodeURIComponent(atlasId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.status === 403) {
          setOwnerState('locked');
          setStatus(data?.error || 'This account is not authorized for owner Meshy tools.');
          return;
        }
        if (!response.ok) throw new Error(data?.error || 'Owner Meshy status is unavailable.');
        setOwnerState('ready');
        setMesh(data);
        if (data?.displayModelUrl) setStatus('Meshy preview ready. Loading the interactive 3D from the private cache…');
        else if (data?.taskId && !terminalStatus(data?.status)) setStatus(`Meshy 7 generation ${Math.round(Number(data?.progress || 0))}% complete…`);
        else setStatus('No Meshy 7 hero model is cached for this building yet.');
      } catch (error) {
        if (!active) return;
        setOwnerState('unavailable');
        setStatus(text(error));
      }
    }
    loadCached();
    return () => { active = false; };
  }, [atlasId, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token || !mesh?.taskId || mesh?.displayModelUrl || terminalStatus(mesh?.status)) return undefined;
    let active = true;
    let timer = null;
    async function poll() {
      try {
        const response = await fetch(`/api/world-atlas/mesh?taskId=${encodeURIComponent(mesh.taskId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) throw new Error(data?.error || 'Could not read Meshy progress.');
        setMesh(data);
        if (data?.displayModelUrl) {
          setStatus('Meshy preview ready. Loading the interactive 3D…');
          return;
        }
        if (terminalStatus(data?.status)) {
          setStatus(data?.error || `Meshy finished with status ${data?.status}.`);
          return;
        }
        setStatus(`Meshy 7 generation ${Math.round(Number(data?.progress || 0))}% complete…`);
        timer = window.setTimeout(poll, 4000);
      } catch (error) {
        if (active) setStatus(text(error));
      }
    }
    timer = window.setTimeout(poll, 2000);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [mesh?.taskId, mesh?.displayModelUrl, mesh?.status, session?.access_token]);

  async function refreshModelAfterViewerError() {
    if (!session?.access_token || !mesh?.taskId) return;
    setStatus('The cached GLB did not open. Keeping the Meshy preview visible while Voxel Vault refreshes this same 3D task…');
    const response = await fetch(`/api/world-atlas/mesh?taskId=${encodeURIComponent(mesh.taskId)}&repair=1&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'The existing Meshy 3D could not be refreshed.');
    setMesh(data);
    setStatus(data?.displayModelUrl
      ? 'Meshy preview kept visible. Refreshed the existing 3D model without starting a new paid generation.'
      : 'The existing Meshy task was refreshed, but its 3D file is not available yet.');
  }

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/vault/earth', window.location.origin).toString() },
      });
      if (error) throw error;
    } catch (error) {
      setStatus(text(error));
      setBusy('');
    }
  }

  function patchReference(index, patch) {
    setReferences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function uploadReference(index, file) {
    if (!file || !session?.access_token) return;
    patchReference(index, { uploading: true });
    setBusy(`upload-${index}`);
    setStatus('Preparing an iPhone-safe JPEG for Meshy 7…');
    try {
      const normalized = await normalizePhotoForMeshy(file);
      const item = references[index] || blankReference();
      const form = new FormData();
      form.append('file', normalized);
      form.append('rightsBasis', item.rightsBasis || 'user-owned');
      if (item.rightsReference) form.append('rightsReference', item.rightsReference);
      const response = await fetch('/api/world-atlas/reference-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Reference upload failed.');
      patchReference(index, {
        url: data.url,
        rightsBasis: data.rightsBasis,
        rightsReference: data.rightsReference,
        uploadedName: file.name || normalized.name || 'Private reference',
        uploading: false,
      });
      setStatus(`View ${index + 1} is privately stored as a Meshy-compatible JPEG with a rights record.`);
    } catch (error) {
      patchReference(index, { uploading: false });
      setStatus(text(error));
    } finally {
      setBusy('');
    }
  }

  function addReference() {
    setReferences((current) => current.length >= 4 ? current : [...current, blankReference()]);
  }

  function removeReference(index) {
    setReferences((current) => current.length <= 2 ? current : current.filter((_item, itemIndex) => itemIndex !== index));
  }

  function loadReferences(items, label) {
    if (!items.length) return;
    const next = items.map((item) => ({
      url: item.url,
      rightsBasis: item.rightsBasis,
      rightsReference: item.rightsReference,
      uploadedName: item.label || label,
      uploading: false,
    }));
    while (next.length < 2) next.push(blankReference());
    setReferences(next.slice(0, 4));
  }

  function useLicensedFeedReferences() {
    loadReferences(feedReferences, 'Licensed provider view');
    setStatus(`${feedReferences.length} provider image${feedReferences.length === 1 ? '' : 's'} loaded because the feed explicitly supplied derivative-generation rights.`);
  }

  function useOpenStreetReferences() {
    loadReferences(openStreetReferences, 'KartaView open street view');
    setStatus(`${openStreetReferences.length} KartaView view${openStreetReferences.length === 1 ? '' : 's'} loaded under CC BY-SA 4.0. If you generate a derivative model, preserve the attribution/share-alike obligations recorded with these inputs.`);
  }

  async function generate() {
    if (!session?.access_token || !atlasId || ownerState !== 'ready') return;
    if (readyReferences.length < 2) {
      setStatus('Add at least two rights-cleared views. Meshy 7 supports up to four; the first should be the front/primary view.');
      return;
    }
    setBusy('generate');
    setStatus('Submitting one controlled Meshy 7 property reconstruction…');
    try {
      const response = await fetch('/api/world-atlas/mesh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ atlasId, referenceImages: readyReferences }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Meshy generation could not start.');
      setMesh(data);
      if (data?.displayModelUrl) setStatus('Existing Meshy preview found. Loading the interactive 3D without spending new credits.');
      else setStatus(data?.reused ? 'Existing Meshy 7 job resumed.' : 'Meshy 7 reconstruction started. Normal Atlas browsing still spends zero Meshy credits.');
    } catch (error) {
      setStatus(text(error));
    } finally {
      setBusy('');
    }
  }

  if (!building) {
    return <div className="meshPanel empty"><b>MESHY 7 PROPERTY MODEL</b><span>Select a source-backed building first. Browsing never triggers paid generation automatically.</span><style jsx>{styles}</style></div>;
  }

  const previewImageUrl = mesh?.thumbnailUrl || listing?.imageUrl || '';

  return <section className="meshPanel">
    <div className="meshTop">
      <div><small>OPTIONAL HIGH-FIDELITY LAYER</small><h3>Meshy 7 property reconstruction</h3><p>{status}</p></div>
      <div className="policy"><b>30K</b><span>POLYGONS</span><b>2K</b><span>PBR</span><b>2–4</b><span>VIEWS</span></div>
    </div>

    {listing?.imageUrl ? <div className="displayOnly"><img src={listing.imageUrl} alt="" referrerPolicy="no-referrer"/><div><b>LISTING PHOTO · DISPLAY EVIDENCE</b><span>This photo can help a person compare the model, but Voxel Vault will not send it to Meshy unless the provider separately grants derivative-generation rights.</span></div></div> : null}
    {openStreetReferences.length >= 2 ? <button className="openFeed" type="button" onClick={useOpenStreetReferences}>USE {openStreetReferences.length} FREE OPEN KARTAVIEW VIEW{openStreetReferences.length === 1 ? '' : 'S'} · CC BY-SA</button> : null}
    {feedReferences.length ? <button className="licensedFeed" type="button" onClick={useLicensedFeedReferences}>USE {feedReferences.length} DERIVATIVE-LICENSED PROVIDER VIEW{feedReferences.length === 1 ? '' : 'S'}</button> : null}

    {mesh?.displayModelUrl ? <MeshyModelViewer modelUrl={mesh.displayModelUrl} previewImageUrl={previewImageUrl} previewAlt="Meshy-generated property 3D preview" onModelError={refreshModelAfterViewerError} /> : null}

    {!mesh?.displayModelUrl && ownerState === 'signed-out' ? <button className="ownerButton" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'OPENING SIGN-IN…' : 'OWNER SIGN-IN FOR MESHY 7'}</button> : null}
    {!mesh?.displayModelUrl && ownerState === 'locked' ? <div className="locked">OWNER TOOLS LOCKED FOR THIS ACCOUNT</div> : null}

    {!mesh?.displayModelUrl && ownerState === 'ready' ? <div className="referenceBuilder">
      <div className="builderIntro"><b>2–4 RIGHTS-CLEARED VIEWS</b><span>Use free KartaView frames when available, derivative-licensed provider media, or your own photos. Front view first. iPhone HEIC/WebP/JPEG/PNG selections are normalized in-browser to a high-quality JPEG before private upload. Nothing generates until you press the final button.</span></div>
      {references.map((item, index) => <div className="reference" key={`${atlasId}-${index}`}>
        <div className="refHead"><b>{index === 0 ? 'VIEW 1 · FRONT / PRIMARY' : `VIEW ${index + 1}`}</b>{references.length > 2 ? <button type="button" onClick={() => removeReference(index)}>REMOVE</button> : null}</div>
        <label className="fileButton">{item.uploading ? 'PREPARING + UPLOADING…' : item.uploadedName ? `✓ ${item.uploadedName}` : 'CHOOSE PROPERTY PHOTO'}<input type="file" accept="image/*" onChange={(event) => uploadReference(index, event.target.files?.[0])} disabled={item.uploading || Boolean(busy && busy !== `upload-${index}`)} /></label>
        <span className="or">OR LICENSED URL</span>
        <input value={item.url} onChange={(event) => patchReference(index, { url: event.target.value, uploadedName: '' })} placeholder="https://licensed-reference.example/front.jpg" inputMode="url" />
        <div className="rightsRow"><select value={item.rightsBasis} onChange={(event) => patchReference(index, { rightsBasis: event.target.value })}><option value="user-owned">I own this image</option><option value="open-licensed">Open license permits derivatives</option><option value="licensed-derivative">I have derivative rights</option></select><input value={item.rightsReference} onChange={(event) => patchReference(index, { rightsReference: event.target.value })} placeholder={item.uploadedName ? 'Stored rights record attached' : 'License / permission reference'} /></div>
      </div>)}
      <div className="builderActions">{references.length < 4 ? <button type="button" className="add" onClick={addReference}>+ ADD VIEW</button> : <span/>}<button type="button" className="generate" onClick={generate} disabled={busy === 'generate' || readyReferences.length < 2}>{busy === 'generate' ? 'STARTING…' : `GENERATE WITH MESHY 7 · ${readyReferences.length}/2+ READY`}</button></div>
      <p className="meshFine">KartaView open imagery can be used only with its CC BY-SA attribution/share-alike obligations preserved. Google Maps/Earth/Street View, Zillow, Redfin and Apartments.com remain optional comparison/reference surfaces, not automatic Meshy inputs. User-owned and explicitly derivative-licensed photos remain supported.</p>
    </div> : null}

    {mesh?.taskId && !mesh?.displayModelUrl ? <div className="progress"><div><i style={{ width: `${Math.max(2, Math.min(100, Number(mesh.progress || 0)))}%` }} /></div><span>{String(mesh.status || 'PENDING').toUpperCase()} · {Math.round(Number(mesh.progress || 0))}%</span></div> : null}
    <style jsx>{styles}</style>
  </section>;
}

const styles = `
.meshPanel{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(145deg,rgba(121,239,188,.05),rgba(255,255,255,.018));padding:16px;display:grid;gap:14px}.meshPanel.empty{min-height:120px;align-content:center}.meshPanel.empty>b{font-size:9px;letter-spacing:.13em}.meshPanel.empty>span{color:#78847f;font-size:10px;line-height:1.6}.meshTop{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.meshTop small{font-size:7px;color:#72cba9;letter-spacing:.14em;font-weight:950}.meshTop h3{font-size:22px;letter-spacing:-.04em;margin:4px 0 5px}.meshTop p{margin:0;max-width:600px;color:#87938e;font-size:10px;line-height:1.55}.policy{display:grid;grid-template-columns:auto auto;gap:2px 8px;align-items:baseline;border:1px solid rgba(255,255,255,.08);padding:9px 10px;border-radius:13px;background:rgba(0,0,0,.16)}.policy b{font-size:13px}.policy span{font-size:6px;color:#6e7a75;letter-spacing:.1em}.displayOnly{display:grid;grid-template-columns:110px 1fr;gap:10px;padding:8px;border-radius:15px;border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.15)}.displayOnly img{width:110px;height:82px;object-fit:cover;border-radius:10px}.displayOnly div{display:grid;align-content:center;gap:4px}.displayOnly b{font-size:7px;letter-spacing:.1em}.displayOnly span{font-size:8px;color:#7f8c86;line-height:1.5}.ownerButton,.generate,.add,.licensedFeed,.openFeed{border:0;border-radius:13px;padding:13px 14px;font-size:8px;font-weight:950;letter-spacing:.1em}.ownerButton,.generate{background:#fff;color:#070a09}.licensedFeed{background:#133d31;color:#bff4df;border:1px solid rgba(121,239,188,.16)}.openFeed{background:linear-gradient(90deg,#17392f,#123b35);color:#d0f8e8;border:1px solid rgba(121,239,188,.28)}.locked{border:1px solid rgba(255,173,137,.2);background:rgba(255,173,137,.06);border-radius:13px;padding:12px;color:#f0ad8d;font-size:8px;font-weight:950;letter-spacing:.1em}.referenceBuilder{display:grid;gap:10px}.builderIntro{display:grid;gap:4px}.builderIntro b{font-size:8px;letter-spacing:.12em}.builderIntro span,.meshFine{font-size:8px;color:#74807b;line-height:1.55}.reference{display:grid;gap:7px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(0,0,0,.14)}.refHead{display:flex;justify-content:space-between;align-items:center}.refHead b{font-size:7px;letter-spacing:.12em}.refHead button{border:0;background:transparent;color:#7c8782;font-size:6px;font-weight:900}.fileButton{position:relative;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(121,239,188,.25);background:rgba(121,239,188,.045);border-radius:12px;padding:11px;color:#bdebd9;font-size:7px;font-weight:950;letter-spacing:.09em;overflow:hidden}.fileButton input{position:absolute;inset:0;opacity:0}.or{text-align:center;color:#5f6b66;font-size:6px;letter-spacing:.12em}.reference>input,.rightsRow input,.rightsRow select{width:100%;border:1px solid rgba(255,255,255,.08);background:#07100e;color:#dce6e2;border-radius:11px;padding:10px;font-size:8px;outline:none}.rightsRow{display:grid;grid-template-columns:160px 1fr;gap:7px}.builderActions{display:flex;justify-content:space-between;gap:8px}.add{background:rgba(255,255,255,.06);color:#aebbb5}.generate:disabled,.add:disabled,.ownerButton:disabled{opacity:.4}.progress{display:grid;gap:6px}.progress>div{height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}.progress i{display:block;height:100%;background:#79efbc;border-radius:999px}.progress span{font-size:7px;color:#84918b;letter-spacing:.1em}.meshFine{margin:0}.meshFine b{color:#a9b6b0}
@media(max-width:680px){.meshTop{display:grid}.policy{justify-self:start}.rightsRow{grid-template-columns:1fr}.builderActions{display:grid}.displayOnly{grid-template-columns:86px 1fr}.displayOnly img{width:86px;height:76px}}
`;