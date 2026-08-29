'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleGrid(image) {
  const ratio = Math.max(0.2, Math.min(5, (image.naturalWidth || 1) / (image.naturalHeight || 1)));
  const longSide = 96;
  const minShort = 52;
  if (ratio >= 1) return { width: longSide, height: Math.max(minShort, Math.round(longSide / ratio)) };
  return { width: Math.max(minShort, Math.round(longSide * ratio)), height: longSide };
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.18 : 1.45));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.02;
        renderer.domElement.style.touchAction = 'none';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x21172c);
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.1));
        const key = new THREE.DirectionalLight(0xffffff, 2.7);
        key.position.set(4, 5, 6);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xc7b7ff, 1.35);
        fill.position.set(-4, 2, 3);
        scene.add(fill);

        // The visible material is the full uploaded photo. No square crop is
        // introduced at the preview stage.
        const sourceCanvas = document.createElement('canvas');
        const maxTexture = compact ? 1024 : 1400;
        const scale = Math.min(1, maxTexture / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        sourceCanvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        sourceCanvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('The 3D photo preview is unavailable on this device.');
        sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
        const texture = new THREE.CanvasTexture(sourceCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() || 1);

        // Relief sampling now follows the source aspect ratio as well. The old
        // square luminance map could warp a wide roofline even though the front
        // texture itself was correct.
        const sample = sampleGrid(image);
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = sample.width;
        sampleCanvas.height = sample.height;
        const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('The 3D photo preview is unavailable on this device.');
        sampleContext.filter = 'contrast(1.06) saturate(1.02)';
        sampleContext.drawImage(image, 0, 0, image.naturalWidth || 1, image.naturalHeight || 1, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
        const luminance = (x, y) => {
          const cx = clamp(Math.round(x), 0, sample.width - 1);
          const cy = clamp(Math.round(y), 0, sample.height - 1);
          const index = (cy * sample.width + cx) * 4;
          return (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
        };

        const ratio = Math.max(0.2, Math.min(5, (image.naturalWidth || 1) / (image.naturalHeight || 1)));
        const maxPlaneWidth = 7.6;
        const maxPlaneHeight = 6.1;
        const planeWidth = ratio >= 1 ? maxPlaneWidth : maxPlaneHeight * ratio;
        const planeHeight = ratio >= 1 ? maxPlaneWidth / ratio : maxPlaneHeight;
        const xSegments = ratio >= 1 ? 64 : Math.max(36, Math.round(64 * ratio));
        const ySegments = ratio >= 1 ? Math.max(36, Math.round(64 / ratio)) : 64;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, xSegments, ySegments);
        const positions = geometry.attributes.position;
        for (let index = 0; index < positions.count; index += 1) {
          const u = geometry.attributes.uv.getX(index);
          const v = geometry.attributes.uv.getY(index);
          const sx = u * (sample.width - 1);
          const sy = (1 - v) * (sample.height - 1);
          const center = luminance(sx, sy);
          const edge = Math.abs(luminance(sx + 1, sy) - luminance(sx - 1, sy))
            + Math.abs(luminance(sx, sy + 1) - luminance(sx, sy - 1));
          const centerWeight = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.52) / 0.78);
          const relief = edge * 0.48 + (center - 0.5) * 0.055 + centerWeight * 0.018;
          positions.setZ(index, clamp(relief, -0.055, 0.34));
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const group = new THREE.Group();
        scene.add(group);
        const backing = new THREE.Mesh(
          new THREE.BoxGeometry(planeWidth + 0.08, planeHeight + 0.08, 0.20),
          new THREE.MeshStandardMaterial({ color: 0x170f20, roughness: 0.88, metalness: 0 }),
        );
        backing.position.z = -0.11;
        group.add(backing);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78, metalness: 0.01, side: THREE.FrontSide });
        const photoMesh = new THREE.Mesh(geometry, material);
        photoMesh.position.z = 0.03;
        group.add(photoMesh);

        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 60);
        const cameraDistance = Math.max(8.4, Math.max(planeWidth, planeHeight) * 1.45);
        camera.position.set(0, 0, cameraDistance);
        camera.lookAt(0, 0, 0);

        // Keep movement gentle: this stage is for comparing the preview with
        // the uploaded house, not for pretending unseen sides were generated.
        let targetX = -0.025;
        let targetY = 0.05;
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
          targetY = clamp(targetY + dx * 0.0045, -0.34, 0.34);
          targetX = clamp(targetX + dy * 0.003, -0.18, 0.17);
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
          group.rotation.x += (targetX - group.rotation.x) * 0.08;
          group.rotation.y += (targetY - group.rotation.y) * 0.08;
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
          backing.geometry.dispose();
          backing.material.dispose();
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

  return <div className="viewerShell" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
    <div ref={mountRef} style={{ position: 'absolute', inset: 0 }}/>
    {error ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, color: '#fff', textAlign: 'center', background: '#21172c' }}>{error}</div> : null}
  </div>;
}
