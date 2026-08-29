'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PhotoDepthPreview({ imageUrl }) {
  const mountRef = useRef(null);
  const cleanupRef = useRef(() => {});
  const [status, setStatus] = useState('loading');
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = () => {};
    setStatus(imageUrl ? 'loading' : 'empty');
    setFallback(false);
    if (!imageUrl || !mountRef.current) return undefined;

    let dead = false;
    let dispose = () => {};

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;

    image.onload = () => {
      if (dead || !mountRef.current) return;

      import('three').then((THREE) => {
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        const width = Math.max(280, mount.clientWidth || 420);
        const height = Math.max(280, mount.clientHeight || 420);
        const aspect = Math.max(0.55, Math.min(1.85, (image.naturalWidth || 1) / (image.naturalHeight || 1)));
        const compact = width < 680 || window.matchMedia?.('(pointer: coarse)')?.matches;

        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        } catch {
          setFallback(true);
          setStatus('ready');
          return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.2 : 1.45));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
        let cameraDistance = compact ? 8.7 : 8.2;
        camera.position.set(0, 0.05, cameraDistance);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x352744, 2.7));
        const key = new THREE.DirectionalLight(0xffffff, 3.6);
        key.position.set(4, 6, 7);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xdad0ff, 1.7);
        rim.position.set(-5, 2, -3);
        scene.add(rim);

        const sample = document.createElement('canvas');
        const sampleWidth = 84;
        const sampleHeight = Math.max(48, Math.round(sampleWidth / aspect));
        sample.width = sampleWidth;
        sample.height = sampleHeight;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) {
          renderer.dispose();
          setFallback(true);
          setStatus('ready');
          return;
        }
        sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
        const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;

        const planeHeight = aspect >= 1 ? 4.7 / aspect : 4.7;
        const planeWidth = aspect >= 1 ? 4.7 : 4.7 * aspect;
        const segmentsX = compact ? 36 : 52;
        const segmentsY = Math.max(24, Math.round(segmentsX / aspect));
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
        const position = geometry.attributes.position;

        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i);
          const y = position.getY(i);
          const u = clamp((x / planeWidth) + 0.5, 0, 1);
          const v = clamp(0.5 - (y / planeHeight), 0, 1);
          const px = Math.min(sampleWidth - 1, Math.max(0, Math.round(u * (sampleWidth - 1))));
          const py = Math.min(sampleHeight - 1, Math.max(0, Math.round(v * (sampleHeight - 1))));
          const idx = (py * sampleWidth + px) * 4;
          const lum = (pixels[idx] * 0.2126 + pixels[idx + 1] * 0.7152 + pixels[idx + 2] * 0.0722) / 255;
          const center = 1 - Math.min(1, Math.hypot((u - 0.5) * 1.1, (v - 0.52) * 0.75));
          const relief = (0.5 - lum) * 0.13 + center * 0.12;
          position.setZ(i, relief);
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();

        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.92,
          metalness: 0,
          side: THREE.DoubleSide,
        });

        const root = new THREE.Group();
        root.rotation.x = -0.035;
        root.rotation.y = 0.11;
        scene.add(root);

        const relief = new THREE.Mesh(geometry, material);
        root.add(relief);

        const backGeometry = new THREE.BoxGeometry(planeWidth + 0.08, planeHeight + 0.08, 0.18);
        const backMaterial = new THREE.MeshStandardMaterial({ color: 0x21172c, roughness: 0.82, metalness: 0.02 });
        const back = new THREE.Mesh(backGeometry, backMaterial);
        back.position.z = -0.12;
        root.add(back);
        root.remove(relief);
        root.add(back);
        root.add(relief);

        let targetX = -0.035;
        let targetY = 0.11;
        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinchDistance = 0;

        const updateCamera = () => {
          camera.position.set(0, 0.05, cameraDistance);
          camera.lookAt(0, 0, 0);
        };

        const pointerDistance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          if (pair.length < 2) return 0;
          return Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        };

        const onDown = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          pinchDistance = pointerDistance();
        };

        const onMove = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = pointerDistance();
            if (pinchDistance > 0 && next > 0) {
              cameraDistance = clamp(cameraDistance - (next - pinchDistance) * 0.012, 6.1, 11.2);
              updateCamera();
            }
            pinchDistance = next;
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          targetY = clamp(targetY + dx * 0.0065, -0.52, 0.52);
          targetX = clamp(targetX + dy * 0.0045, -0.28, 0.22);
        };

        const onUp = (event) => {
          pointers.delete(event.pointerId);
          pinchDistance = pointerDistance();
          renderer.domElement.releasePointerCapture?.(event.pointerId);
        };

        const onWheel = (event) => {
          event.preventDefault();
          cameraDistance = clamp(cameraDistance + event.deltaY * 0.004, 6.1, 11.2);
          updateCamera();
        };

        renderer.domElement.addEventListener('pointerdown', onDown);
        renderer.domElement.addEventListener('pointermove', onMove);
        renderer.domElement.addEventListener('pointerup', onUp);
        renderer.domElement.addEventListener('pointercancel', onUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

        let frame = 0;
        const animate = () => {
          if (dead) return;
          root.rotation.x += (targetX - root.rotation.x) * 0.12;
          root.rotation.y += (targetY - root.rotation.y) * 0.12;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        animate();

        const resize = new ResizeObserver(() => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || width);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || height);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight);
        });
        resize.observe(mount);

        setStatus('ready');

        dispose = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          renderer.domElement.removeEventListener('pointerdown', onDown);
          renderer.domElement.removeEventListener('pointermove', onMove);
          renderer.domElement.removeEventListener('pointerup', onUp);
          renderer.domElement.removeEventListener('pointercancel', onUp);
          renderer.domElement.removeEventListener('wheel', onWheel);
          geometry.dispose();
          material.dispose();
          texture.dispose();
          backGeometry.dispose();
          backMaterial.dispose();
          renderer.dispose();
          if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
        cleanupRef.current = dispose;
      }).catch(() => {
        if (!dead) {
          setFallback(true);
          setStatus('ready');
        }
      });
    };

    image.onerror = () => {
      if (!dead) {
        setFallback(true);
        setStatus('ready');
      }
    };

    return () => {
      dead = true;
      dispose();
      cleanupRef.current = () => {};
    };
  }, [imageUrl]);

  return <div className="depthPreviewShell">
    <div ref={mountRef} className="depthPreviewMount" aria-label="Interactive photo-faithful 3D preview">
      {fallback && imageUrl ? <img src={imageUrl} alt="Property source preview"/> : null}
    </div>
    <div className="depthPreviewHelp">
      <b>{status === 'loading' ? 'BUILDING 3D PREVIEW…' : 'DRAG TO TILT · PINCH TO ZOOM'}</b>
      <span>Uses your exact photo on the front. Depth is estimated locally.</span>
    </div>
    <style jsx>{`
      .depthPreviewShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#4a3564 0,#24172f 48%,#17111d 100%)}
      .depthPreviewMount{position:absolute;inset:0;display:grid;place-items:center}
      .depthPreviewMount img{width:100%;height:100%;object-fit:contain;background:#17111d}
      .depthPreviewHelp{position:absolute;z-index:3;left:14px;right:14px;bottom:14px;padding:10px 12px;border-radius:16px;background:rgba(20,13,26,.72);color:#fff;backdrop-filter:blur(12px);display:grid;gap:2px;text-align:left;pointer-events:none}
      .depthPreviewHelp b{font-size:9px;letter-spacing:.09em}.depthPreviewHelp span{font-size:9px;line-height:1.35;color:#ddd2e5}
    `}</style>
  </div>;
}
