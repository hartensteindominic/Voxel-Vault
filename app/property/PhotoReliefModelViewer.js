'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PhotoReliefModelViewer({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;
    image.onload = async () => {
      try {
        const THREE = await import('three');
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        const width = Math.max(280, mount.clientWidth || 360);
        const height = Math.max(280, mount.clientHeight || 360);
        const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.7));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.touchAction = 'none';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbf4, 0x2a1838, 2.35));
        const key = new THREE.DirectionalLight(0xffffff, 3.15);
        key.position.set(4.5, 6.5, 7.5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xd8ccff, 1.1);
        fill.position.set(-4, 2.5, 4);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xc9ff54, 0.42);
        rim.position.set(-2, 4, -4);
        scene.add(rim);

        const sourceCanvas = document.createElement('canvas');
        const maxTexture = compact ? 1400 : 2048;
        const scale = Math.min(1, maxTexture / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        sourceCanvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        sourceCanvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('The 3D photo preview is unavailable on this device.');
        sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
        const texture = new THREE.CanvasTexture(sourceCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);

        // Keep the photo recognizable. The old preview pushed high-contrast edges far
        // forward and could make roofs/windows look melted. This pass only applies a
        // tiny low-frequency relief so perspective/light can read as 3D without
        // materially warping the source photo.
        const sampleSize = 48;
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = sampleSize;
        sampleCanvas.height = sampleSize;
        const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('The 3D photo preview is unavailable on this device.');
        sampleContext.filter = 'blur(1.4px) saturate(1.02) contrast(1.02)';
        sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
        const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
        const luminance = (x, y) => {
          const cx = clamp(Math.round(x), 0, sampleSize - 1);
          const cy = clamp(Math.round(y), 0, sampleSize - 1);
          const index = (cy * sampleSize + cx) * 4;
          return (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
        };

        const ratio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
        const planeHeight = ratio >= 1 ? 4.75 : 5.25;
        const planeWidth = planeHeight * ratio;
        const boundedWidth = Math.min(7.5, Math.max(3.2, planeWidth));
        const boundedHeight = boundedWidth / ratio;
        const geometry = new THREE.PlaneGeometry(boundedWidth, boundedHeight, 36, 36);
        const positions = geometry.attributes.position;
        for (let index = 0; index < positions.count; index += 1) {
          const u = geometry.attributes.uv.getX(index);
          const v = geometry.attributes.uv.getY(index);
          const sx = u * (sampleSize - 1);
          const sy = (1 - v) * (sampleSize - 1);
          const center = luminance(sx, sy);
          const smooth = (
            center
            + luminance(sx - 2, sy)
            + luminance(sx + 2, sy)
            + luminance(sx, sy - 2)
            + luminance(sx, sy + 2)
          ) / 5;
          const edge = Math.abs(luminance(sx + 1, sy) - luminance(sx - 1, sy))
            + Math.abs(luminance(sx, sy + 1) - luminance(sx, sy - 1));
          const relief = (smooth - 0.5) * 0.02 + Math.min(0.03, edge * 0.028);
          positions.setZ(index, clamp(relief, -0.012, 0.05));
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const group = new THREE.Group();
        group.rotation.x = -0.02;
        group.rotation.y = 0.035;
        scene.add(group);

        const backingGeometry = new THREE.BoxGeometry(boundedWidth + 0.11, boundedHeight + 0.11, 0.18);
        const backingMaterial = new THREE.MeshStandardMaterial({ color: 0x24172f, roughness: 0.92, metalness: 0 });
        const backing = new THREE.Mesh(backingGeometry, backingMaterial);
        backing.position.z = -0.095;
        backing.castShadow = true;
        group.add(backing);

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.9,
          metalness: 0,
          side: THREE.FrontSide,
        });
        const photoMesh = new THREE.Mesh(geometry, material);
        photoMesh.position.z = 0.012;
        photoMesh.castShadow = true;
        group.add(photoMesh);

        const floorGeometry = new THREE.PlaneGeometry(15, 11);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x251832, roughness: 1, transparent: true, opacity: 0.66 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -boundedHeight / 2 - 0.38, -1.05);
        floor.receiveShadow = true;
        scene.add(floor);

        const camera = new THREE.PerspectiveCamera(29, width / height, 0.1, 60);
        const cameraDistance = Math.max(8.3, boundedWidth * 1.5);
        camera.position.set(0, 0.05, cameraDistance);
        camera.lookAt(0, -0.03, 0);

        let targetX = -0.02;
        let targetY = 0.035;
        let pointerId = null;
        let lastX = 0;
        let lastY = 0;
        const down = (event) => {
          pointerId = event.pointerId;
          lastX = event.clientX;
          lastY = event.clientY;
          renderer.domElement.setPointerCapture?.(event.pointerId);
        };
        const move = (event) => {
          if (pointerId !== event.pointerId) return;
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          targetY = clamp(targetY + dx * 0.0028, -0.18, 0.18);
          targetX = clamp(targetX + dy * 0.0018, -0.08, 0.07);
        };
        const up = (event) => {
          if (pointerId === event.pointerId) pointerId = null;
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);

        let frame = 0;
        const render = () => {
          if (dead) return;
          group.rotation.x += (targetX - group.rotation.x) * 0.085;
          group.rotation.y += (targetY - group.rotation.y) * 0.085;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        if (reducedMotion) renderer.render(scene, camera);
        else render();

        const resize = () => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || width);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || height);
          renderer.setSize(nextWidth, nextHeight);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          if (reducedMotion) renderer.render(scene, camera);
        };
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        observer?.observe(mount);
        callbackRef.current?.();

        cleanup = () => {
          if (frame) cancelAnimationFrame(frame);
          observer?.disconnect();
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          geometry.dispose();
          material.dispose();
          texture.dispose();
          backingGeometry.dispose();
          backingMaterial.dispose();
          floorGeometry.dispose();
          floorMaterial.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
      } catch (previewError) {
        if (!dead) setError(String(previewError?.message || previewError || 'The 3D photo preview could not open.'));
      }
    };
    image.onerror = () => setError('The selected photo could not be opened for the 3D preview.');

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl]);

  return <div className="viewerShell">
    <div className="viewerGlow" aria-hidden="true"/>
    <div ref={mountRef} className="viewerCanvas"/>
    {!error ? <div className="viewerBadge">SOURCE PHOTO · CLEAN 3D PREVIEW</div> : null}
    {!error ? <div className="viewerHint">DRAG SLIGHTLY TO VIEW DEPTH · PHOTO STAYS RECOGNIZABLE</div> : null}
    {error ? <div className="viewerError">{error}</div> : null}
    <style jsx>{`
      .viewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 24%,#4b3764 0,#2a1b38 38%,#17101f 78%)}
      .viewerGlow{position:absolute;inset:8% 14% 18%;border-radius:48%;background:radial-gradient(circle,rgba(201,255,84,.12),rgba(113,56,245,.08) 45%,transparent 72%);filter:blur(24px)}
      .viewerCanvas{position:absolute;inset:0;z-index:2}
      .viewerBadge{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(24,16,31,.72);color:#f8f3ff;font-size:7px;font-weight:1000;letter-spacing:.11em;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08)}
      .viewerHint{position:absolute;z-index:5;left:12px;right:12px;bottom:10px;color:#eee6f5;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.10em;pointer-events:none;text-shadow:0 1px 7px #000}
      .viewerError{position:absolute;z-index:6;inset:0;display:grid;place-items:center;padding:24px;color:#fff;text-align:center;background:#21172c}
    `}</style>
  </div>;
}
