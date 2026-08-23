'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createCollectibleDraft, detectMediaType, validateCollectibleFile } from '../../lib/media-collectible';

const VoxelViewer = dynamic(() => import('../components/VoxelViewer'), { ssr: false });
const TYPES = [
  { id: '3d', title: '3D OBJECT', copy: 'GLB / GLTF · flagship format', icon: '◇' },
  { id: 'image', title: 'IMAGE', copy: 'Photo or digital artwork', icon: '▧' },
  { id: 'video', title: 'VIDEO', copy: 'Animated collectible', icon: '▶' },
];

export default function CreateCollectible() {
  const [type, setType] = useState('3d');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const validation = useMemo(() => file ? validateCollectibleFile(file, type) : null, [file, type]);
  function chooseType(next) { setType(next); setFile(null); setStatus(''); if (preview) URL.revokeObjectURL(preview); setPreview(''); }
  function chooseFile(nextFile) {
    if (!nextFile) return;
    const detected = detectMediaType(nextFile);
    if (detected !== type) { setStatus(`This file is detected as ${detected || 'unsupported'} media. Choose the matching tab.`); return; }
    const result = validateCollectibleFile(nextFile, type);
    if (!result.ok) { setStatus(result.error); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile); setPreview(URL.createObjectURL(nextFile));
    setStatus(`${type.toUpperCase()} staged locally. Nothing has been minted.`);
  }
  function createDraft() {
    if (!file || !validation?.ok) { setStatus('Add a valid asset before creating the collectible.'); return; }
    const draft = createCollectibleDraft({ name, description, mediaType: type, assetUrl: preview, location: locationEnabled ? 'device-location-required' : null });
    window.localStorage.setItem(`voxel-vault-draft-${Date.now()}`, JSON.stringify(draft));
    setStatus('Draft created locally. Upload/storage and on-chain minting remain separate confirmation steps.');
  }
  return (
    <main className="createPage">
      <nav><a href="/">V<span>V</span>OXELVAULT</a><a href="/discover">Discover</a><a href="/hunt">Hunt</a><a href="/trade">Trade</a></nav>
      <section className="shell">
        <div className="eyebrow">CREATOR STUDIO · UNIVERSAL COLLECTIBLES</div>
        <h1>Create something <em>worth finding.</em></h1>
        <p className="lede">3D is the flagship. Images and videos can join the same collectible and scavenger-hunt system.</p>
        <div className="typeGrid">{TYPES.map(item => <button key={item.id} className={type === item.id ? 'active' : ''} onClick={() => chooseType(item.id)}><b>{item.icon} {item.title}</b><span>{item.copy}</span></button>)}</div>
        <div className="workspace">
          <div className="preview">
            {!file && <div className="emptyPreview"><strong>{type === '3d' ? 'DROP A 3D ASSET HERE' : type === 'image' ? 'DROP AN IMAGE HERE' : 'DROP A VIDEO HERE'}</strong><span>Preview stays local until you explicitly publish.</span></div>}
            {file && type === 'image' && <img src={preview} alt="Collectible preview" />}
            {file && type === 'video' && <video src={preview} controls playsInline />}
            {file && type === '3d' && <VoxelViewer assetUrl={preview} />}
          </div>
          <div className="form">
            <label>NAME<input value={name} onChange={e => setName(e.target.value)} placeholder="Obsidian Relic" /></label>
            <label>DESCRIPTION<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What makes this collectible worth finding?" /></label>
            <label className="drop"><span>ASSET</span><input type="file" accept={type === '3d' ? '.glb,.gltf,model/gltf-binary,model/gltf+json' : type === 'image' ? 'image/*' : 'video/mp4,video/webm,video/quicktime'} onChange={e => chooseFile(e.target.files?.[0])} /><b>{file ? file.name : 'Choose file'}</b><small>{type === '3d' ? 'GLB/GLTF · up to 150 MB' : type === 'video' ? 'MP4/WebM/MOV · up to 250 MB' : 'JPG/PNG/WebP/GIF · up to 25 MB'}</small></label>
            <label className="toggle"><input type="checkbox" checked={locationEnabled} onChange={e => setLocationEnabled(e.target.checked)} /><span>Make this a map drop</span><small>Location is a discovery rule, not proof of blockchain ownership.</small></label>
            <button className="create" onClick={createDraft}>STAGE COLLECTIBLE →</button>
            {status && <div className="status">● {status}</div>}
          </div>
        </div>
        <div className="principles"><div><b>3D FIRST</b><span>Real GLB/GLTF assets get the richest inspection, trading and future AR experience.</span></div><div><b>ONE OWNERSHIP MODEL</b><span>Image, video and 3D collectibles share the same metadata, provenance and wallet architecture.</span></div><div><b>DROP ANYWHERE</b><span>Any supported media can become a hunt clue or map drop.</span></div></div>
      </section>
      <style jsx>{`.createPage{min-height:100vh;background:#05060b;color:#f7f8ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding-bottom:80px}.createPage *{box-sizing:border-box}.createPage nav{height:78px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:28px;padding:0 5vw;position:sticky;top:0;background:rgba(5,6,11,.86);backdrop-filter:blur(18px);z-index:5}.createPage nav a{text-decoration:none;color:#9da3b5;font-size:13px;font-weight:750}.createPage nav a:first-child{margin-right:auto;color:#fff;font-size:18px;letter-spacing:.15em;font-weight:950}.createPage nav a:first-child span{color:#9b7cff}.shell{max-width:1250px;margin:auto;padding:72px 5vw}.eyebrow{font-size:10px;letter-spacing:.2em;color:#9299ad;font-weight:900;margin-bottom:16px}.shell h1{font-size:clamp(46px,7vw,88px);line-height:.92;letter-spacing:-.06em;margin:0;max-width:900px}.shell h1 em{font-style:normal;color:#9b7cff}.lede{max-width:800px;color:#aeb4c5;line-height:1.7;font-size:16px;margin:24px 0 36px}.typeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.typeGrid button{background:#0b0d15;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:20px;text-align:left;color:#fff;cursor:pointer}.typeGrid button.active{border-color:#8064ff;box-shadow:0 0 30px rgba(128,100,255,.14)}.typeGrid b,.typeGrid span{display:block}.typeGrid b{font-size:14px;letter-spacing:.08em}.typeGrid span{color:#7f879a;font-size:12px;margin-top:7px}.workspace{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.preview,.form{background:#090b13;border:1px solid rgba(255,255,255,.1);border-radius:24px;min-height:520px}.preview{display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(111,80,255,.14),transparent 50%),#080a12}.preview :global(canvas){width:100%!important;height:100%!important;min-height:520px}.preview img,.preview video{width:100%;height:100%;min-height:520px;object-fit:contain}.emptyPreview{text-align:center;color:#9aa1b4;padding:40px}.emptyPreview strong{display:block;color:#fff;letter-spacing:.1em}.emptyPreview span{display:block;margin-top:10px;color:#70788b}.form{padding:24px;display:flex;flex-direction:column;gap:18px}.form label{font-size:10px;letter-spacing:.15em;color:#858da2;font-weight:900}.form input:not([type=checkbox]),.form textarea{display:block;width:100%;margin-top:8px;background:#05060b;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:13px;color:#fff;outline:none}.form textarea{min-height:110px;resize:vertical}.drop{padding:18px;border:1px dashed rgba(155,124,255,.45);border-radius:14px;background:rgba(155,124,255,.04)}.drop input{display:none}.drop b,.drop small{display:block;letter-spacing:normal;margin-top:8px;color:#fff}.drop small{color:#70788b}.toggle{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;letter-spacing:normal!important}.toggle small{grid-column:2;color:#70788b;letter-spacing:normal}.create{margin-top:auto;border:0;border-radius:999px;padding:15px;background:#8d6cff;color:#fff;font-weight:950;letter-spacing:.08em;cursor:pointer}.status{font-size:12px;color:#aeb4c5;line-height:1.5}.principles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.principles div{padding:20px;background:#090b13;border:1px solid rgba(255,255,255,.08);border-radius:18px}.principles b,.principles span{display:block}.principles b{font-size:11px;letter-spacing:.15em;color:#b6a4ff}.principles span{margin-top:9px;color:#858da2;font-size:12px;line-height:1.6}@media(max-width:800px){.typeGrid,.workspace,.principles{grid-template-columns:1fr}.workspace .preview,.workspace .form{min-height:390px}.preview :global(canvas),.preview img,.preview video{min-height:390px}.createPage nav{gap:14px}.createPage nav a:not(:first-child){display:none}.shell{padding-top:45px}}`}</style>
    </main>
  );
}
