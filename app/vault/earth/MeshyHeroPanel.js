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

export default function MeshyHeroPanel({ building }) {
  const [session, setSession] = useState(null);
  const [ownerState, setOwnerState] = useState('checking');
  const [status, setStatus] = useState('Checking owner Meshy cache…');
  const [mesh, setMesh] = useState({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null });
  const [references, setReferences] = useState([blankReference(), blankReference()]);
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);
  const atlasId = building?.atlasId || '';

  const readyReferences = useMemo(() => references.filter((item) => item.url && item.rightsBasis && item.rightsReference), [references]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, nextSession) => {
        if (active) setSession(nextSession || null);
      });
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
        setMesh({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null });
        return;
      }
      if (!session?.access_token) {
        setOwnerState('signed-out');
        setStatus('Owner sign-in unlocks cached Meshy hero models and controlled generation.');
        setMesh({ status: 'NOT_STARTED', progress: 0, displayModelUrl: null, taskId: null });
        return;
      }
      setOwnerState('checking');
      setStatus('Checking private hero-model cache…');
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
        if (data?.displayModelUrl) setStatus('Cached hero model loaded. No Meshy credits were spent.');
        else if (data?.taskId && !terminalStatus(data?.status)) setStatus(`Meshy generation ${Math.round(Number(data?.progress || 0))}% complete…`);
        else setStatus('No hero model is cached for this building yet. Generation remains manual.');
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
          setStatus('Hero model complete and cached in Voxel Vault.');
          return;
        }
        if (terminalStatus(data?.status)) {
          setStatus(data?.error || `Meshy finished with status ${data?.status}.`);
          return;
        }
        setStatus(`Meshy generation ${Math.round(Number(data?.progress || 0))}% complete…`);
        timer = window.setTimeout(poll, 4000);
      } catch (error) {
        if (active) setStatus(text(error));
      }
    }
    timer = window.setTimeout(poll, 2000);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [mesh?.taskId, mesh?.displayModelUrl, mesh?.status, session?.access_token]);

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
    try {
      const item = references[index] || blankReference();
      const form = new FormData();
      form.append('file', file);
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
        uploadedName: file.name || 'Private reference',
        uploading: false,
      });
      setStatus(`Reference ${index + 1} is privately stored and ready for this Meshy request.`);
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

  async function generate() {
    if (!session?.access_token || !atlasId || ownerState !== 'ready') return;
    if (readyReferences.length < 2) {
      setStatus('Add at least two rights-cleared reference views before spending Meshy credits.');
      return;
    }
    setBusy('generate');
    setStatus('Submitting one controlled Meshy hero-property job…');
    try {
      const response = await fetch('/api/world-atlas/mesh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ atlasId, referenceImages: readyReferences }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Meshy generation could not start.');
      setMesh(data);
      if (data?.displayModelUrl) setStatus('Existing cached hero model reused. No new Meshy credits were spent.');
      else setStatus(data?.reused ? 'Existing Meshy job resumed.' : 'Meshy hero model started. This is the only credit-spending action in normal Atlas use.');
    } catch (error) {
      setStatus(text(error));
    } finally {
      setBusy('');
    }
  }

  if (!building) {
    return <div className="meshPanel empty"><b>MESHY HERO MODEL</b><span>Select a source-backed building first. Browsing never triggers Meshy automatically.</span><style jsx>{styles}</style></div>;
  }

  return <section className="meshPanel">
    <div className="meshTop">
      <div><small>OPTIONAL HIGH-FIDELITY LAYER</small><h3>Meshy hero model</h3><p>{status}</p></div>
      <div className="policy"><b>30K</b><span>POLYGONS</span><b>2K</b><span>PBR TEXTURES</span></div>
    </div>

    {mesh?.displayModelUrl ? <MeshyModelViewer modelUrl={mesh.displayModelUrl} /> : null}

    {!mesh?.displayModelUrl && ownerState === 'signed-out' ? <button className="ownerButton" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'OPENING SIGN-IN…' : 'OWNER SIGN-IN FOR MESHY'}</button> : null}
    {!mesh?.displayModelUrl && ownerState === 'locked' ? <div className="locked">OWNER TOOLS LOCKED FOR THIS ACCOUNT</div> : null}

    {!mesh?.displayModelUrl && ownerState === 'ready' ? <div className="referenceBuilder">
      <div className="builderIntro"><b>2–4 RIGHTS-CLEARED VIEWS</b><span>Upload your own property photos from iPhone, or paste a URL you are actually licensed to use. Nothing generates until you press the final button.</span></div>
      {references.map((item, index) => <div className="reference" key={`${atlasId}-${index}`}>
        <div className="refHead"><b>VIEW {index + 1}</b>{references.length > 2 ? <button type="button" onClick={() => removeReference(index)}>REMOVE</button> : null}</div>
        <label className="fileButton">{item.uploading ? 'UPLOADING…' : item.uploadedName ? `✓ ${item.uploadedName}` : 'CHOOSE PHOTO / FILE'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => uploadReference(index, event.target.files?.[0])} disabled={item.uploading || Boolean(busy && busy !== `upload-${index}`)} /></label>
        <span className="or">OR</span>
        <input value={item.url} onChange={(event) => patchReference(index, { url: event.target.value, uploadedName: '' })} placeholder="https://licensed-reference.example/photo.jpg" inputMode="url" />
        <div className="rightsRow"><select value={item.rightsBasis} onChange={(event) => patchReference(index, { rightsBasis: event.target.value })}><option value="user-owned">I own this image</option><option value="open-licensed">Open license permits derivatives</option><option value="licensed-derivative">I have derivative rights</option></select><input value={item.rightsReference} onChange={(event) => patchReference(index, { rightsReference: event.target.value })} placeholder={item.uploadedName ? 'Stored rights record attached' : 'License / permission reference'} /></div>
      </div>)}
      <div className="builderActions">{references.length < 4 ? <button type="button" className="add" onClick={addReference}>+ ADD VIEW</button> : <span/>}<button type="button" className="generate" onClick={generate} disabled={busy === 'generate' || readyReferences.length < 2}>{busy === 'generate' ? 'STARTING…' : `GENERATE HERO · ${readyReferences.length}/2+ READY`}</button></div>
      <p className="meshFine">Google Earth/Maps, Zillow, Redfin and Apartments.com imagery is blocked by the server route. User-owned, open-licensed, or explicitly derivative-licensed references only.</p>
    </div> : null}

    {mesh?.taskId && !mesh?.displayModelUrl ? <div className="progress"><div><i style={{ width: `${Math.max(2, Math.min(100, Number(mesh.progress || 0)))}%` }} /></div><span>{String(mesh.status || 'PENDING').toUpperCase()} · {Math.round(Number(mesh.progress || 0))}%</span></div> : null}
    <style jsx>{styles}</style>
  </section>;
}

const styles = `
.meshPanel{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(145deg,rgba(121,239,188,.05),rgba(255,255,255,.018));padding:16px;display:grid;gap:14px}.meshPanel.empty{min-height:120px;align-content:center}.meshPanel.empty>b{font-size:9px;letter-spacing:.13em}.meshPanel.empty>span{color:#78847f;font-size:10px;line-height:1.6}.meshTop{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.meshTop small{font-size:7px;color:#72cba9;letter-spacing:.14em;font-weight:950}.meshTop h3{font-size:22px;letter-spacing:-.04em;margin:4px 0 5px}.meshTop p{margin:0;max-width:600px;color:#87938e;font-size:10px;line-height:1.55}.policy{display:grid;grid-template-columns:auto auto;gap:2px 8px;align-items:baseline;border:1px solid rgba(255,255,255,.08);padding:9px 10px;border-radius:13px;background:rgba(0,0,0,.16)}.policy b{font-size:13px}.policy span{font-size:6px;color:#6e7a75;letter-spacing:.1em}.ownerButton,.generate,.add{border:0;border-radius:13px;padding:13px 14px;font-size:8px;font-weight:950;letter-spacing:.1em}.ownerButton,.generate{background:#fff;color:#070a09}.locked{border:1px solid rgba(255,173,137,.2);background:rgba(255,173,137,.06);border-radius:13px;padding:12px;color:#f0ad8d;font-size:8px;font-weight:950;letter-spacing:.1em}.referenceBuilder{display:grid;gap:10px}.builderIntro{display:grid;gap:4px}.builderIntro b{font-size:8px;letter-spacing:.12em}.builderIntro span,.meshFine{font-size:8px;color:#74807b;line-height:1.55}.reference{display:grid;gap:7px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(0,0,0,.14)}.refHead{display:flex;justify-content:space-between;align-items:center}.refHead b{font-size:7px;letter-spacing:.12em}.refHead button{border:0;background:transparent;color:#7c8782;font-size:6px;font-weight:900}.fileButton{position:relative;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(121,239,188,.25);background:rgba(121,239,188,.045);border-radius:12px;padding:11px;color:#91ddc1;font-size:7px;font-weight:950;letter-spacing:.09em;overflow:hidden}.fileButton input{position:absolute;inset:0;opacity:0;cursor:pointer}.or{text-align:center;font-size:6px;color:#59635f;font-weight:900}.reference>input,.rightsRow input,.rightsRow select{min-width:0;border:1px solid rgba(255,255,255,.08);background:#0b1110;color:#e6edeb;border-radius:11px;padding:10px;font-size:9px;outline:none}.rightsRow{display:grid;grid-template-columns:.8fr 1.2fr;gap:7px}.builderActions{display:flex;justify-content:space-between;gap:9px}.add{background:rgba(255,255,255,.06);color:#a4afab}.generate:disabled{opacity:.38}.meshFine{margin:0}.progress{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.progress>div{height:6px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}.progress i{display:block;height:100%;background:#79efbc;border-radius:999px}.progress span{font-size:7px;color:#86928d;font-weight:900;letter-spacing:.08em}@media(max-width:640px){.meshPanel{padding:12px;border-radius:20px}.meshTop{display:grid}.policy{justify-self:start}.rightsRow{grid-template-columns:1fr}.builderActions{display:grid;grid-template-columns:1fr}.builderActions button{width:100%}}
`;
