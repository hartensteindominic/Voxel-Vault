'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function ElementalPreview({ color, energy }) {
  const host = useRef(null);
  useEffect(() => {
    const root = host.current; if (!root) return;
    let alive = true, raf, down = false, px = 0, py = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'; root.appendChild(renderer.domElement);
    const geometry = new THREE.IcosahedronGeometry(1.25, 4);
    const material = new THREE.MeshPhysicalMaterial({ color, metalness: .48, roughness: .2, transmission: .16, clearcoat: 1 });
    const core = new THREE.Mesh(geometry, material); scene.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, .025, 10, 120), new THREE.MeshBasicMaterial({ color: 0xb8ff4a })); ring.rotation.x = 1.15; scene.add(ring);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x171026, 3)); const key = new THREE.PointLight(0x9f84ff, 35); key.position.set(3, 3, 4); scene.add(key);
    const resize = () => { const w = Math.max(root.clientWidth, 1), h = Math.max(root.clientHeight, 1); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(root);
    const start = event => { down = true; px = event.clientX; py = event.clientY; renderer.domElement.setPointerCapture?.(event.pointerId); };
    const move = event => { if (!down) return; core.rotation.y += (event.clientX - px) * .012; core.rotation.x += (event.clientY - py) * .01; px = event.clientX; py = event.clientY; };
    const stop = () => { down = false; };
    renderer.domElement.addEventListener('pointerdown', start); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', stop); renderer.domElement.addEventListener('pointercancel', stop);
    const tick = () => { if (!alive) return; raf = requestAnimationFrame(tick); if (!down) { core.rotation.y += .003 + energy * .0000003; ring.rotation.z += .002; } core.scale.setScalar(1 + Math.sin(performance.now() * .002) * .025); renderer.render(scene, camera); }; tick();
    return () => { alive = false; cancelAnimationFrame(raf); observer.disconnect(); root.removeChild(renderer.domElement); geometry.dispose(); material.dispose(); renderer.dispose(); };
  }, [color, energy]);
  return <div className="cap3d" ref={host} role="img" aria-label="Interactive elemental 3D twin. Drag in any direction to rotate." />;
}

async function fileHash(file) { const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''); }

export default function CaptureStudio() {
  const [media, setMedia] = useState(''); const [name, setName] = useState(''); const [story, setStory] = useState(''); const [claimedValue, setClaimedValue] = useState('');
  const [code, setCode] = useState(''); const [hash, setHash] = useState(''); const [element, setElement] = useState('Aether'); const [status, setStatus] = useState(''); const [saved, setSaved] = useState(null);
  const palette = { Aether: '#9f84ff', Solar: '#ffb84a', Tide: '#55c8ff', Grove: '#b8ff4a', Ember: '#ff5d76' };

  async function chooseMedia(event) { const file = event.target.files?.[0]; if (!file) return; if (file.size > 25e6) { setStatus('Choose a photo or video under 25 MB.'); return; } setMedia(URL.createObjectURL(file)); setHash(await fileHash(file)); setStatus('Capture fingerprinted locally. Nothing has been minted or valued yet.'); }
  async function scanQr() {
    if (!('BarcodeDetector' in window)) { setStatus('Live QR scanning is unavailable here. Photograph the QR or enter its text.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); const video = document.createElement('video'); video.srcObject = stream; await video.play(); const detector = new window.BarcodeDetector({ formats: ['qr_code'] }); let result = []; for (let i = 0; i < 20 && !result.length; i += 1) { await new Promise(resolve => setTimeout(resolve, 160)); result = await detector.detect(video); } if (result[0]?.rawValue) { setCode(result[0].rawValue); setStatus('QR identity captured. Verify its issuer before treating it as provenance.'); } else setStatus('No QR found. Try brighter light.'); }
    catch (error) { setStatus(error?.message || 'Camera scanning was cancelled.'); } finally { stream?.getTracks().forEach(track => track.stop()); }
  }
  function createDraft() {
    if (!media || !name.trim() || !hash) { setStatus('Add a photo or video and name the object first.'); return; }
    const draft = { id: crypto.randomUUID(), name: name.trim(), story: story.trim(), claimedValue: claimedValue ? Number(claimedValue) : null, valuationStatus: 'unverified_owner_claim', qrReference: code.trim() || null, mediaFingerprint: hash, element, createdAt: new Date().toISOString(), status: 'private_memory_twin' };
    const current = JSON.parse(localStorage.getItem('vault-capture-drafts') || '[]'); localStorage.setItem('vault-capture-drafts', JSON.stringify([draft, ...current].slice(0, 100))); setSaved(draft); setStatus('Private elemental twin saved. Free creation does not create cash value or transferable ownership.');
  }

  return <main className="capRoot"><header><Link href="/">VOXEL VAULT</Link><nav><Link href="/vault">Collection</Link><Link href="/ai">Ask AI</Link></nav></header><section className="capHero"><div><small>FREE CREATION LAB</small><h1>Scan reality.<br/><em>Keep the spark.</em></h1><p>Photograph an object, record a short clip, or scan its QR identity. Vault makes a private elemental twin first, then separates provenance, appraisal, minting, and trading into honest steps.</p><div className="capTrust"><span>FREE PRIVATE DRAFT</span><span>LOCAL MEDIA FINGERPRINT</span><span>NO FAKE CASH VALUE</span></div></div><div className="capPreview"><ElementalPreview color={palette[element]} energy={Number(claimedValue) || 0} /><div className="capPreviewMeta"><small>{element.toUpperCase()} ELEMENT</small><strong>{name || 'Unnamed reality spark'}</strong><span>DRAG ANY DIRECTION</span></div></div></section><section className="capBuilder"><div className="capSteps"><article><b>01</b><h2>Capture</h2><p>Use your camera, photo library, video, or a QR code.</p><label className="capUpload">Choose photo or video<input type="file" accept="image/*,video/*" capture="environment" onChange={chooseMedia} /></label><button className="capSecondary" onClick={scanQr}>Scan a QR code</button>{media && <img src={media} alt="Captured object preview" />}</article><article><b>02</b><h2>Describe</h2><label>Object name<input value={name} onChange={event => setName(event.target.value)} placeholder="Signed championship football" /></label><label>Story<textarea value={story} onChange={event => setStory(event.target.value)} placeholder="Where it came from and why it matters" /></label><label>Owner-stated value (optional)<div className="capMoney"><span>$</span><input inputMode="decimal" value={claimedValue} onChange={event => setClaimedValue(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="2000" /></div><small>A claim—not an appraisal or guaranteed resale price.</small></label><label>QR / certificate reference<input value={code} onChange={event => setCode(event.target.value)} /></label></article><article><b>03</b><h2>Element</h2><div className="capElements">{Object.keys(palette).map(value => <button key={value} className={element === value ? 'active' : ''} onClick={() => setElement(value)}><i style={{ background: palette[value] }} />{value}</button>)}</div><button className="capPrimary" onClick={createDraft}>Create free elemental twin</button><div className="capLadder"><strong>Value ladder</strong><span>Memory twin · free, private</span><span>Provenance twin · issuer/QR verified</span><span>Appraised twin · professional evidence</span><span>Tradeable NFT · wallet mint + market price</span></div></article></div>{status && <p className="capStatus" role="status">{status}</p>}{saved && <div className="capSaved"><small>TWIN CREATED</small><strong>{saved.name}</strong><span>{saved.id}</span><Link href="/room">Place in my room</Link></div>}</section></main>;
}
