'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function modelPresentation(modelUrl) {
  const raw = String(modelUrl || '').trim();
  if (!raw) return { assetUrl: '', previewImageUrl: '' };
  try {
    const url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://voxelvault.local');
    const metadata = new URLSearchParams(url.hash.replace(/^#/, ''));
    const previewImageUrl = String(metadata.get('vvPreview') || '').trim();
    url.hash = '';
    const assetUrl = raw.startsWith('/') ? `${url.pathname}${url.search}` : url.toString();
    return { assetUrl, previewImageUrl };
  } catch {
    return { assetUrl: raw, previewImageUrl: '' };
  }
}

function retryUrl(modelUrl, attempt) {
  if (!modelUrl || attempt <= 0) return modelUrl;
  try {
    const url = new URL(modelUrl, window.location.href);
    url.searchParams.set('previewRetry', String(attempt));
    url.hash = '';
    return url.toString();
  } catch {
    return modelUrl;
  }
}

export default function MeshyModelViewer({ modelUrl }) {
  const mountRef = useRef(null);
  const presentation = useMemo(() => modelPresentation(modelUrl), [modelUrl]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(presentation.assetUrl));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!presentation.assetUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    let loadRetryTimer = 0;
    let revealTimer = 0;
    setError('');
    setLoading(true);
    setReady(false);
    const startedAt = Date.now();

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
        setError(presentation.previewImageUrl
          ? 'Interactive 3D is unavailable in this browser. The rendered 3D image is still shown.'
          : '3D model preview is unavailable in this browser.');
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
      renderer.domElement.style.opacity = presentation.previewImageUrl ? '0' : '1';
      renderer.domElement.style.transition = 'opacity .38s ease';
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
      const loadModel = (attempt = 0) => {
        loader.load(retryUrl(presentation.assetUrl, attempt), (gltf) => {
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
          setError('');
          const previewDelay = presentation.previewImageUrl ? Math.max(0, 650 - (Date.now() - startedAt)) : 0;
          revealTimer = window.setTimeout(() => {
            if (dead) return;
            renderer.domElement.style.opacity = '1';
            setLoading(false);
            setReady(true);
          }, previewDelay);
        }, undefined, () => {
          if (dead) return;
          if (attempt < 3) {
            setLoading(true);
            setError('');
            loadRetryTimer = window.setTimeout(() => loadModel(attempt + 1), 900 * (attempt + 1));
            return;
          }
          setLoading(false);
          setReady(false);
          setError(presentation.previewImageUrl
            ? 'Interactive 3D is reconnecting. The rendered 3D image stays visible.'
            : 'The 3D preview could not be loaded. The completed job is still recoverable; try again shortly.');
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
        if (!ready) return;
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
        if (!ready) return;
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
        window.clearTimeout(revealTimer);
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
        setError(presentation.previewImageUrl
          ? 'Interactive 3D viewer could not start. The rendered 3D image is still shown.'
          : 'The 3D model viewer could not start.');
      }
    });

    return () => { dead = true; cleanup(); };
  }, [presentation.assetUrl, presentation.previewImageUrl]);

  return <div className="viewerShell">
    {presentation.previewImageUrl ? <img className={`viewerPreview ${ready ? 'viewerPreviewHidden' : ''}`} src={presentation.previewImageUrl} alt="Rendered Meshy 3D preview" referrerPolicy="no-referrer"/> : null}
    <div ref={mountRef} className="viewer" aria-label="Interactive Meshy hero-property 3D model" />
    {loading && presentation.previewImageUrl ? <div className="viewerStage">3D IMAGE · LOADING INTERACTIVE 3D</div> : null}
    {loading && !presentation.previewImageUrl && !error ? <div className="viewerLoading">Loading interactive 3D…</div> : null}
    {error ? <div className={`viewerError ${presentation.previewImageUrl ? 'viewerErrorSoft' : ''}`}>{error}</div> : null}
    <div className="viewerHint">{ready ? 'DRAG · PINCH TO ZOOM · INTERACTIVE 3D' : presentation.previewImageUrl ? '3D IMAGE → INTERACTIVE 3D' : 'PREPARING INTERACTIVE 3D'}</div>
    <style jsx>{`.viewerShell{position:relative;min-height:330px;border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(78,151,126,.16),transparent 42%),#070d0c}.viewerPreview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;opacity:1;transition:opacity .38s ease}.viewerPreviewHidden{opacity:0;pointer-events:none}.viewer{position:absolute;inset:0;z-index:2}.viewerStage{position:absolute;z-index:4;top:12px;left:12px;padding:7px 9px;border-radius:999px;background:rgba(7,13,12,.76);backdrop-filter:blur(8px);color:#d8e7e1;font-size:7px;letter-spacing:.12em;font-weight:900}.viewerLoading{position:absolute;inset:0;z-index:3;display:grid;place-content:center;padding:28px;text-align:center;color:#bdc8c4;font-size:11px;line-height:1.5;background:rgba(9,16,15,.68);pointer-events:none}.viewerError{position:absolute;inset:0;z-index:5;display:grid;place-content:center;padding:28px;text-align:center;color:#bdc8c4;font-size:11px;line-height:1.5;background:#09100f}.viewerErrorSoft{inset:auto 12px 36px 12px;display:block;padding:9px 11px;border-radius:12px;background:rgba(7,13,12,.82);backdrop-filter:blur(8px);font-size:9px}.viewerHint{position:absolute;z-index:6;left:12px;right:12px;bottom:10px;text-align:center;color:#9aaaa4;font-size:6px;letter-spacing:.12em;font-weight:900;pointer-events:none}`}</style>
  </div>;
}
