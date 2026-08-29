'use client';

import { useEffect, useRef, useState } from 'react';

export default function MeshyModelViewer({
  modelUrl,
  previewImageUrl = '',
  previewAlt = 'Generated 3D preview image',
  onModelError = null,
}) {
  const mountRef = useRef(null);
  const onModelErrorRef = useRef(onModelError);
  const repairAttemptRef = useRef('');
  const [error, setError] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  onModelErrorRef.current = onModelError;

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');
    setModelReady(false);

    Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]).then(([THREE, loaderModule]) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setError('Interactive 3D is unavailable in this browser. The generated preview image is still shown when available.');
        return;
      }
      const width = Math.max(280, mount.clientWidth || 360);
      const height = Math.max(260, mount.clientHeight || 340);
      const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.35));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = !compact;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07100f, 14, 27);
      scene.add(new THREE.HemisphereLight(0xf1fff9, 0x07110d, 2.25));
      const key = new THREE.DirectionalLight(0xfff0dc, 4.3);
      key.position.set(6, 9, 8);
      key.castShadow = !compact;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x88baff, 2.2);
      rim.position.set(-6, 3, -5);
      scene.add(rim);

      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 60);
      let cameraDistance = 9.4;
      camera.position.set(0, 2.2, cameraDistance);
      camera.lookAt(0, 1.25, 0);
      const root = new THREE.Group();
      scene.add(root);

      const floorGeometry = new THREE.CircleGeometry(4.8, 64);
      const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x15211c, roughness: 0.95, metalness: 0.02 });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.03;
      floor.receiveShadow = !compact;
      scene.add(floor);

      const loader = new loaderModule.GLTFLoader();
      let model = null;
      loader.load(modelUrl, (gltf) => {
        if (dead) return;
        model = gltf.scene;
        model.traverse((object) => {
          if (!object?.isMesh) return;
          object.castShadow = !compact;
          object.receiveShadow = !compact;
          if (object.material) {
            object.material.envMapIntensity = 0.75;
            object.material.needsUpdate = true;
          }
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const largest = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 5.7 / largest;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        root.add(model);
        repairAttemptRef.current = '';
        setRepairing(false);
        setError('');
        setModelReady(true);
      }, undefined, async () => {
        if (dead) return;
        setModelReady(false);
        setError('Interactive 3D could not load from the cached GLB. Keeping the generated preview visible while Voxel Vault refreshes the model.');
        const repairKey = String(modelUrl || '');
        if (onModelErrorRef.current && repairAttemptRef.current !== repairKey) {
          repairAttemptRef.current = repairKey;
          setRepairing(true);
          try {
            await onModelErrorRef.current();
          } catch {}
          if (!dead) setRepairing(false);
        }
      });

      const pointers = new Map();
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let pinch = 0;
      let targetY = 0.56;
      let targetX = 0;
      const pointerDistance = () => {
        const pair = [...pointers.values()].slice(0, 2);
        return pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
      };
      const updateCamera = () => {
        camera.position.set(0, 2.2, cameraDistance);
        camera.lookAt(0, 1.25, 0);
      };
      const down = (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        moved = false;
        lastX = event.clientX;
        lastY = event.clientY;
        if (pointers.size === 2) pinch = pointerDistance();
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const next = pointerDistance();
          if (pinch) cameraDistance = Math.max(6.5, Math.min(13.5, cameraDistance - (next - pinch) * 0.012));
          pinch = next;
          updateCamera();
          moved = true;
          return;
        }
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        targetY += dx * 0.008;
        targetX = Math.max(-0.32, Math.min(0.32, targetX + dy * 0.003));
        lastX = event.clientX;
        lastY = event.clientY;
      };
      const up = (event) => {
        pointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (pointers.size < 2) pinch = 0;
      };
      const wheel = (event) => {
        event.preventDefault();
        cameraDistance = Math.max(6.5, Math.min(13.5, cameraDistance + Math.sign(event.deltaY) * 0.5));
        updateCamera();
      };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      let visible = true;
      let pageVisible = !document.hidden;
      const observer = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); }, { rootMargin: '120px' })
        : null;
      observer?.observe(mount);
      const visibility = () => { pageVisible = !document.hidden; };
      document.addEventListener('visibilitychange', visibility);

      let frame = 0;
      let lastRender = 0;
      const animate = (time = 0) => {
        frame = requestAnimationFrame(animate);
        if (!visible || !pageVisible) return;
        if (compact && time - lastRender < 33) return;
        lastRender = time;
        if (!reducedMotion && pointers.size === 0 && !moved) targetY += 0.00065;
        root.rotation.y += (targetY - root.rotation.y) * 0.08;
        root.rotation.x += (targetX - root.rotation.x) * 0.08;
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        if (!mountRef.current) return;
        const nextWidth = Math.max(280, mountRef.current.clientWidth || 360);
        const nextHeight = Math.max(260, mountRef.current.clientHeight || 340);
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        root.traverse((object) => {
          if (!object?.isMesh) return;
          object.geometry?.dispose?.();
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((material) => material?.dispose?.());
        });
        floorGeometry.dispose();
        floorMaterial.dispose();
        renderer.dispose();
        mount.innerHTML = '';
      };
    }).catch(() => {
      if (!dead) {
        setModelReady(false);
        setError('The interactive 3D viewer could not start. The generated preview image is still available when provided.');
      }
    });

    return () => { dead = true; cleanup(); };
  }, [modelUrl, retryKey]);

  function retry3D() {
    repairAttemptRef.current = '';
    setError('');
    setRepairing(false);
    setModelReady(false);
    setRetryKey((value) => value + 1);
  }

  return <div className="viewerShell">
    {previewImageUrl ? <img className={`viewerPreview${modelReady ? ' ready' : ''}`} src={previewImageUrl} alt={previewAlt} referrerPolicy="no-referrer"/> : null}
    <div ref={mountRef} className={`viewer${modelReady ? ' ready' : ''}`} aria-label="Interactive Meshy hero-property 3D model" />
    {!modelReady && previewImageUrl ? <div className="viewerPhase">3D PREVIEW IMAGE</div> : null}
    {error ? <div className="viewerError" role="status"><span>{error}</span><button type="button" onClick={retry3D} disabled={repairing}>{repairing ? 'REFRESHING 3D…' : 'TRY 3D AGAIN'}</button></div> : null}
    <div className="viewerHint">{modelReady ? 'DRAG · PINCH TO ZOOM · INTERACTIVE 3D' : previewImageUrl ? 'PREVIEW → INTERACTIVE 3D' : 'LOADING INTERACTIVE 3D…'}</div>
    <style jsx>{`.viewerShell{position:relative;min-height:330px;border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(78,151,126,.16),transparent 42%),#070d0c}.viewerPreview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;transform:scale(1.01);transition:opacity .32s ease,transform .45s ease}.viewerPreview.ready{opacity:0;transform:scale(1.025);pointer-events:none}.viewer{position:absolute;inset:0;opacity:0;transition:opacity .3s ease}.viewer.ready{opacity:1}.viewerPhase{position:absolute;z-index:3;left:12px;top:12px;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.9);color:#18211e;font-size:7px;letter-spacing:.1em;font-weight:950}.viewerError{position:absolute;z-index:4;left:12px;right:12px;bottom:34px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border-radius:13px;color:#dbe5e1;font-size:9px;line-height:1.4;background:rgba(9,16,15,.9);backdrop-filter:blur(8px)}.viewerError span{min-width:0}.viewerError button{flex:0 0 auto;border:0;border-radius:9px;padding:9px 10px;background:#fff;color:#0b110f;font-size:7px;font-weight:950;letter-spacing:.08em}.viewerError button:disabled{opacity:.55}.viewerHint{position:absolute;z-index:3;left:12px;right:12px;bottom:10px;text-align:center;color:#a8b3af;font-size:6px;letter-spacing:.12em;font-weight:900;pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.75)}@media(max-width:520px){.viewerError{align-items:flex-start;flex-direction:column}.viewerError button{width:100%;min-height:42px}}`}</style>
  </div>;
}