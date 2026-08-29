'use client';

import { useEffect, useRef, useState } from 'react';

function loadErrorMessage(error) {
  const status = Number(error?.status || 0);
  if (status === 401 || status === 403) return 'The saved 3D link expired before the model finished loading.';
  if (status === 404) return 'The saved 3D file is temporarily unavailable.';
  return 'The interactive 3D model could not be loaded right now.';
}

async function fetchModelBlob(modelUrl, deadRef) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (deadRef.current) throw new Error('Viewer closed.');
    try {
      const response = await fetch(modelUrl, { cache: 'no-store' });
      if (!response.ok) {
        const error = new Error(`3D file request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      const bytes = await response.blob();
      if (!bytes.size) throw new Error('The 3D file was empty.');
      return URL.createObjectURL(bytes);
    } catch (error) {
      lastError = error;
      if (attempt === 0 && !deadRef.current) await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
  }
  throw lastError || new Error('3D file request failed.');
}

export default function MeshyModelViewer({ modelUrl, posterUrl = '' }) {
  const mountRef = useRef(null);
  const deadRef = useRef(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [poster, setPoster] = useState(posterUrl || '');

  useEffect(() => {
    if (posterUrl) {
      setPoster(posterUrl);
      return;
    }
    const shell = mountRef.current?.closest?.('.meshPanel');
    const image = shell?.querySelector?.('.displayOnly img');
    const discovered = image?.currentSrc || image?.src || '';
    if (discovered) setPoster(discovered);
  }, [posterUrl, modelUrl]);

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return undefined;
    deadRef.current = false;
    let cleanup = () => {};
    let objectUrl = '';
    setError('');
    setPhase('loading');

    Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      fetchModelBlob(modelUrl, deadRef),
    ]).then(([THREE, loaderModule, localModelUrl]) => {
      if (deadRef.current || !mountRef.current) {
        URL.revokeObjectURL(localModelUrl);
        return;
      }
      objectUrl = localModelUrl;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setError('Interactive 3D is unavailable in this browser, so the property image is staying visible.');
        setPhase('error');
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
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
      renderer.domElement.style.transition = reducedMotion ? 'none' : 'opacity 280ms ease';
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
      loader.load(localModelUrl, (gltf) => {
        if (deadRef.current) return;
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
        renderer.render(scene, camera);
        renderer.domElement.style.opacity = '1';
        setPhase('ready');
      }, undefined, (loadError) => {
        if (!deadRef.current) {
          setError(loadErrorMessage(loadError));
          setPhase('error');
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
        if (!visible || !pageVisible || phase === 'error') return;
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
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }).catch((loadError) => {
      if (!deadRef.current) {
        setError(loadErrorMessage(loadError));
        setPhase('error');
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });

    return () => {
      deadRef.current = true;
      cleanup();
    };
  }, [modelUrl, retryKey]);

  const retry = () => {
    setError('');
    setPhase('loading');
    setRetryKey((value) => value + 1);
  };

  return <div className={`viewerShell ${phase}`}>
    {poster ? <img className="poster" src={poster} alt="Property reference while interactive 3D loads" referrerPolicy="no-referrer" /> : <div className="posterFallback" aria-hidden="true"><div className="fallbackHouse"><i/><b/><span/></div></div>}
    <div ref={mountRef} className="viewer" aria-label="Interactive Meshy hero-property 3D model" aria-busy={phase === 'loading'} />
    {phase === 'loading' ? <div className="loadingCard"><i/><div><b>PHOTO → 3D</b><span>Preparing the interactive model…</span></div></div> : null}
    {phase === 'error' ? <div className="recoveryCard"><div><b>Property image kept visible</b><span>{error} Retry the saved 3D file without creating a new paid Meshy job.</span></div><button type="button" onClick={retry}>RETRY 3D</button></div> : null}
    {phase === 'ready' ? <div className="viewerHint">DRAG · PINCH TO ZOOM · 3D READY</div> : null}
    <style jsx>{`.viewerShell{position:relative;min-height:330px;border-radius:22px;overflow:hidden;background:#0b1210;border:1px solid rgba(255,255,255,.08)}.poster,.posterFallback{position:absolute;inset:0;width:100%;height:100%}.poster{object-fit:cover;filter:saturate(.92) contrast(1.02)}.posterFallback{display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,rgba(121,239,188,.15),transparent 42%),linear-gradient(160deg,#14231d,#07100e)}.fallbackHouse{position:relative;width:110px;height:82px;border-radius:12px;background:#d7f6e6;box-shadow:inset 0 -28px 0 #a4d8bd;transform:perspective(300px) rotateX(4deg) rotateY(-8deg)}.fallbackHouse:before{content:'';position:absolute;left:7px;right:7px;top:-42px;border-left:48px solid transparent;border-right:48px solid transparent;border-bottom:44px solid #8cbba4}.fallbackHouse i,.fallbackHouse b,.fallbackHouse span{position:absolute;bottom:0;background:#173a2f}.fallbackHouse i{left:18px;width:23px;height:28px}.fallbackHouse b{right:18px;width:25px;height:22px;bottom:30px}.fallbackHouse span{right:18px;width:25px;height:22px}.viewer{position:absolute;inset:0}.loadingCard{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(7,13,12,.78);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1)}.loadingCard>i{width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,.24);border-top-color:#d8fff0;animation:spin .8s linear infinite}.loadingCard div,.recoveryCard div{display:grid;gap:2px}.loadingCard b,.recoveryCard b{font-size:8px;letter-spacing:.09em}.loadingCard span,.recoveryCard span{font-size:8px;color:#9ba9a3;line-height:1.4}.recoveryCard{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:12px;justify-content:space-between;align-items:center;padding:11px;border-radius:15px;background:rgba(7,13,12,.9);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.11)}.recoveryCard button{flex:0 0 auto;min-height:38px;border:0;border-radius:11px;padding:0 12px;background:#fff;color:#07100e;font-size:7px;font-weight:950;letter-spacing:.09em}.viewerHint{position:absolute;left:12px;right:12px;bottom:10px;text-align:center;color:#b4c4bd;font-size:6px;letter-spacing:.12em;font-weight:900;pointer-events:none;text-shadow:0 1px 8px #000}.ready .poster{opacity:0;transition:opacity 280ms ease}.error .viewer{opacity:0;pointer-events:none}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.loadingCard>i{animation:none}.ready .poster{transition:none}}@media(max-width:520px){.viewerShell{min-height:360px}.recoveryCard{align-items:stretch;flex-direction:column}.recoveryCard button{width:100%}}`}</style>
  </div>;
}
