'use client';

import { useEffect, useRef, useState } from 'react';

function retryUrl(modelUrl, attempt) {
  if (!modelUrl || attempt <= 0) return modelUrl;
  try {
    const url = new URL(modelUrl, window.location.href);
    url.searchParams.set('previewRetry', String(attempt));
    return url.toString();
  } catch {
    return modelUrl;
  }
}

export default function MeshyModelViewer({
  modelUrl,
  fallbackImageUrl = '',
  label = 'Interactive Meshy 3D model',
}) {
  const mountRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(modelUrl));
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setError('');
    setLoading(Boolean(modelUrl));
    setLoaded(false);
  }, [modelUrl]);

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');
    setLoading(true);
    setLoaded(false);

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
        setLoading(false);
        setError('3D preview is unavailable in this browser. Your image is still shown.');
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
      renderer.domElement.style.opacity = '0';
      renderer.domElement.style.transition = 'opacity 220ms ease';
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
      let loadRetryTimer = 0;
      const loadModel = (attempt = 0) => {
        loader.load(retryUrl(modelUrl, attempt + reloadKey * 4), (gltf) => {
          if (dead) return;
          model = gltf.scene;
          model.traverse((object) => {
            if (!object?.isMesh) return;
            object.castShadow = !compact;
            object.receiveShadow = !compact;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
              if (!material) return;
              material.envMapIntensity = 0.75;
              material.needsUpdate = true;
            });
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
          renderer.domElement.style.opacity = '1';
          setLoading(false);
          setLoaded(true);
          setError('');
        }, undefined, () => {
          if (dead) return;
          if (attempt < 3) {
            setLoading(true);
            setError('');
            loadRetryTimer = window.setTimeout(() => loadModel(attempt + 1), 1200 * (attempt + 1));
            return;
          }
          setLoading(false);
          setError('The 3D preview did not open. Your image is safe—tap Reload 3D or rebuild from the photo.');
        });
      };
      loadModel();

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
        window.clearTimeout(loadRetryTimer);
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
        setLoading(false);
        setError('The 3D viewer could not start. Your image is still shown.');
      }
    });

    return () => { dead = true; cleanup(); };
  }, [modelUrl, reloadKey]);

  return <div className="viewerShell">
    {fallbackImageUrl ? <img className={`viewerFallback ${loaded ? 'viewerFallbackHidden' : ''}`} src={fallbackImageUrl} alt="3D source preview"/> : null}
    <div ref={mountRef} className="viewer" aria-label={label}/>
    {loading && !fallbackImageUrl ? <div className="viewerLoading">Loading live 3D model…</div> : null}
    {error ? <div className="viewerError" role="status"><span>{error}</span><button type="button" onClick={() => setReloadKey((current) => current + 1)}>Reload 3D</button></div> : null}
    <div className="viewerHint">{loaded ? 'DRAG · PINCH TO ZOOM · 3D READY' : 'IMAGE FIRST · LOADING 3D'}</div>
    <style jsx>{`.viewerShell{position:relative;min-height:330px;border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(78,151,126,.16),transparent 42%),#070d0c}.viewerFallback{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .22s ease}.viewerFallbackHidden{opacity:0}.viewer{position:absolute;inset:0;z-index:2}.viewerLoading{position:absolute;inset:0;display:grid;place-content:center;padding:28px;text-align:center;color:#bdc8c4;font-size:11px;line-height:1.5;background:rgba(9,16,15,.68);pointer-events:none}.viewerError{position:absolute;z-index:4;left:14px;right:14px;bottom:34px;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;padding:10px 12px;text-align:center;color:#e7efec;font-size:10px;line-height:1.45;background:rgba(9,16,15,.86);border:1px solid rgba(255,255,255,.1);border-radius:14px;backdrop-filter:blur(10px)}.viewerError button{min-height:36px;border:0;border-radius:12px;padding:0 13px;background:#c9ff54;color:#24310e;font:900 10px inherit;cursor:pointer}.viewerHint{position:absolute;z-index:3;left:12px;right:12px;bottom:10px;text-align:center;color:#9aa9a4;font-size:6px;letter-spacing:.12em;font-weight:900;pointer-events:none}`}</style>
  </div>;
}
