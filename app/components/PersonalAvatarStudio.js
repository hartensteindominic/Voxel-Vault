'use client';

import { useEffect, useRef, useState } from 'react';

const SKINS = ['#c98f65', '#8f5c43', '#5f392d', '#e3b18a'];
const OUTFITS = [
  { name: 'Vault Lime', color: '#b8ff4a' },
  { name: 'Signal Violet', color: '#8d72ff' },
  { name: 'Orbit Blue', color: '#55c8ff' },
  { name: 'Carbon', color: '#222633' },
];

export default function PersonalAvatarStudio() {
  const mountRef = useRef(null);
  const avatarRef = useRef(null);
  const [skin, setSkin] = useState(SKINS[0]);
  const [outfit, setOutfit] = useState(OUTFITS[0]);
  const [status, setStatus] = useState('Interactive preview ready');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    async function start() {
      const THREE = await import('three');
      if (disposed || !mountRef.current) return;
      const root = mountRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 1.45, 5.2);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      root.appendChild(renderer.domElement);
      const avatar = new THREE.Group();
      avatarRef.current = avatar;
      const skinMaterial = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72 });
      const outfitMaterial = new THREE.MeshStandardMaterial({ color: outfit.color, roughness: 0.56, metalness: 0.08 });
      const darkMaterial = new THREE.MeshStandardMaterial({ color: '#10131b', roughness: 0.62 });
      const add = (geometry, material, position) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        avatar.add(mesh);
        return mesh;
      };
      add(new THREE.SphereGeometry(0.42, 36, 28), skinMaterial, [0, 1.72, 0]);
      add(new THREE.CapsuleGeometry(0.54, 1.05, 8, 20), outfitMaterial, [0, 0.63, 0]);
      add(new THREE.CapsuleGeometry(0.14, 0.9, 6, 16), skinMaterial, [-0.7, 0.68, 0]);
      add(new THREE.CapsuleGeometry(0.14, 0.9, 6, 16), skinMaterial, [0.7, 0.68, 0]);
      add(new THREE.CapsuleGeometry(0.18, 1.05, 6, 16), darkMaterial, [-0.28, -0.73, 0]);
      add(new THREE.CapsuleGeometry(0.18, 1.05, 6, 16), darkMaterial, [0.28, -0.73, 0]);
      add(new THREE.TorusGeometry(0.51, 0.055, 10, 44), new THREE.MeshStandardMaterial({ color: '#d9d2ff', metalness: 0.75, roughness: 0.28 }), [0, 0.88, 0.5]);
      avatar.rotation.y = -0.35;
      scene.add(avatar);
      scene.add(new THREE.HemisphereLight('#dcd7ff', '#071018', 2.2));
      const key = new THREE.DirectionalLight('#b8ff4a', 3.8); key.position.set(3, 4, 4); scene.add(key);
      const rim = new THREE.DirectionalLight('#8d72ff', 4); rim.position.set(-4, 2, -3); scene.add(rim);
      const resize = () => {
        const width = root.clientWidth || 320;
        const height = root.clientHeight || 460;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize); observer.observe(root);
      let frame;
      const animate = () => { frame = requestAnimationFrame(animate); avatar.rotation.y += 0.0025; renderer.render(scene, camera); };
      animate();
      cleanup = () => {
        observer.disconnect(); cancelAnimationFrame(frame); renderer.dispose();
        scene.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
        renderer.domElement.remove(); avatarRef.current = null;
      };
    }
    start().catch(() => setStatus('3D preview unavailable on this device'));
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => {
    if (!avatarRef.current) return;
    [0, 2, 3].forEach((index) => avatarRef.current.children[index]?.material?.color?.set(skin));
  }, [skin]);

  useEffect(() => {
    avatarRef.current?.children?.[1]?.material?.color?.set(outfit.color);
  }, [outfit]);

  function saveLook() {
    localStorage.setItem('voxel-vault-avatar', JSON.stringify({ skin, outfit: outfit.name }));
    setStatus(`${outfit.name} look saved to this device`);
  }

  return <section className="avatarStudio">
    <div className="avatarStage" ref={mountRef} role="img" aria-label={`Rotating 3D personal avatar wearing ${outfit.name}`}><div className="avatarHud"><span>LIVE 3D SELF</span><b>{outfit.name}</b></div></div>
    <div className="avatarControls">
      <small>PERSONAL AVATAR / V1</small><h1>Your vault has a face.</h1><p>Create a private 3D identity, then equip compatible digital twins from purchases you actually own.</p>
      <fieldset><legend>Skin tone</legend><div className="swatches">{SKINS.map((color) => <button key={color} type="button" aria-label={`Select skin tone ${color}`} aria-pressed={skin === color} onClick={() => setSkin(color)} style={{ '--swatch': color }} />)}</div></fieldset>
      <fieldset><legend>Starter outfit</legend><div className="outfits">{OUTFITS.map((item) => <button key={item.name} type="button" className={outfit.name === item.name ? 'active' : ''} onClick={() => setOutfit(item)}>{item.name}</button>)}</div></fieldset>
      <button className="saveLook" type="button" onClick={saveLook}>Save this look</button><div className="avatarStatus" role="status" aria-live="polite">{status}</div>
      <div className="ownedWearables"><span>OWNED WEARABLES</span><b>Connect your wallet to equip verified items.</b><a href="/room">Open My Room</a></div>
    </div>
  </section>;
}
