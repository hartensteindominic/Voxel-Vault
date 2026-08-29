'use client';

import { useEffect, useRef, useState } from 'react';

export default function SavedVoxelModelViewer({ modelUrl }) {
  const mountRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');

    Promise.all([import('three'), import('three/examples/jsm/loaders/GLTFLoader.js')]).then(([THREE, loaderModule]) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
      catch { setError('Interactive 3D is unavailable in this browser.'); return; }

      const width = Math.max(280, mount.clientWidth || 360);
      const height = Math.max(280, mount.clientHeight || 360);
      const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.1 : 1.35));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.7));
      const key = new THREE.DirectionalLight(0xffedd5, 4.1); key.position.set(5, 8, 7); scene.add(key);
      const rim = new THREE.DirectionalLight(0xc5b4ff, 2.1); rim.position.set(-5, 3, -4); scene.add(rim);
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 80);
      let cameraDistance = compact ? 10.8 : 10.1;
      camera.position.set(0, 0.45, cameraDistance); camera.lookAt(0, 0, 0);
      const root = new THREE.Group(); scene.add(root);

      const loader = new loaderModule.GLTFLoader();
      loader.load(modelUrl, (gltf) => {
        if (dead) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3(); const center = new THREE.Vector3();
        box.getSize(size); box.getCenter(center);
        const scale = 5.9 / Math.max(size.x, size.y, size.z, 0.001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        root.add(model);
      }, undefined, () => { if (!dead) setError('The saved 3D voxel could not be reopened. Your account record is unchanged.'); });

      const pointers = new Map();
      let lastX = 0; let lastY = 0; let pinch = 0; let targetX = -0.05; let targetY = 0.12;
      const pointerDistance = () => {
        const pair = [...pointers.values()].slice(0, 2);
        return pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
      };
      const updateCamera = () => { camera.position.set(0, 0.45, cameraDistance); camera.lookAt(0, 0, 0); };
      const down = (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); renderer.domElement.setPointerCapture?.(event.pointerId);
        lastX = event.clientX; lastY = event.clientY; if (pointers.size === 2) pinch = pointerDistance();
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const next = pointerDistance(); if (pinch) cameraDistance = Math.max(6.5, Math.min(14, cameraDistance - (next - pinch) * 0.012));
          pinch = next; updateCamera(); return;
        }
        const dx = event.clientX - lastX; const dy = event.clientY - lastY;
        targetY += dx * 0.009; targetX = Math.max(-0.4, Math.min(0.4, targetX + dy * 0.003)); lastX = event.clientX; lastY = event.clientY;
      };
      const up = (event) => { pointers.delete(event.pointerId); renderer.domElement.releasePointerCapture?.(event.pointerId); if (pointers.size < 2) pinch = 0; };
      renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up);

      let frame = 0;
      const animate = () => { frame = requestAnimationFrame(animate); root.rotation.x += (targetX - root.rotation.x) * 0.08; root.rotation.y += (targetY - root.rotation.y) * 0.08; renderer.render(scene, camera); };
      animate();
      const resize = () => {
        if (!mountRef.current) return;
        const nextWidth = Math.max(280, mountRef.current.clientWidth || 360); const nextHeight = Math.max(280, mountRef.current.clientHeight || 360);
        renderer.setSize(nextWidth, nextHeight); camera.aspect = nextWidth / nextHeight; camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame); window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up);
        root.traverse((object) => { if (!object?.isMesh) return; object.geometry?.dispose?.(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach((material) => material?.dispose?.()); });
        renderer.dispose(); mount.innerHTML = '';
      };
    }).catch(() => { if (!dead) setError('The saved 3D viewer could not start.'); });

    return () => { dead = true; cleanup(); };
  }, [modelUrl]);

  return <div className="viewerShell"><div ref={mountRef} className="savedViewer" aria-label="Exact saved purchased-twin 3D voxel"/>{error ? <div className="error">{error}</div> : null}<div className="hint">DRAG · PINCH TO ZOOM · SAVED 3D VOXEL</div><style jsx>{`.viewerShell{position:relative;min-height:330px;height:100%;background:radial-gradient(circle at 50% 35%,rgba(113,56,245,.18),transparent 44%),#21172c}.savedViewer{position:absolute;inset:0}.error{position:absolute;left:12px;right:12px;bottom:38px;padding:9px 10px;border-radius:12px;background:rgba(25,17,34,.86);color:#eadff5;font-size:9px;line-height:1.4}.hint{position:absolute;left:12px;right:12px;bottom:11px;text-align:center;color:#cbbfd6;font-size:7px;font-weight:900;letter-spacing:.1em;pointer-events:none}`}</style></div>;
}