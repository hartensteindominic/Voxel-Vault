'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PropertyPhoto3DPreview({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;
    image.onload = () => {
      import('three').then((THREE) => {
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        } catch {
          setError('Interactive 3D is unavailable here, so the original photo is staying visible.');
          return;
        }

        const widthPx = Math.max(280, mount.clientWidth || 360);
        const heightPx = Math.max(300, mount.clientHeight || 390);
        const compact = widthPx < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.45));
        renderer.setSize(widthPx, heightPx);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .3s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x191020, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(3, 5, 6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xcdbfff, 1.3);
        rim.position.set(-4, 1, -3);
        scene.add(rim);

        const ratio = clamp((image.naturalWidth || 1) / (image.naturalHeight || 1), 0.5, 2.2);
        const planeHeight = ratio >= 1 ? 4.7 : 5.3;
        const planeWidth = planeHeight * ratio;
        const segmentsX = ratio >= 1 ? 56 : Math.max(32, Math.round(56 * ratio));
        const segmentsY = ratio >= 1 ? Math.max(32, Math.round(56 / ratio)) : 56;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);

        const sample = document.createElement('canvas');
        sample.width = segmentsX + 1;
        sample.height = segmentsY + 1;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('Photo depth preview is unavailable in this browser.');
        sampleContext.drawImage(image, 0, 0, image.naturalWidth || 1, image.naturalHeight || 1, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
        const luminance = [];
        for (let index = 0; index < sample.width * sample.height; index += 1) {
          const offset = index * 4;
          luminance.push((pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255);
        }

        const positions = geometry.attributes.position;
        const uvs = geometry.attributes.uv;
        for (let index = 0; index < positions.count; index += 1) {
          const u = clamp(uvs.getX(index), 0, 1);
          const v = clamp(uvs.getY(index), 0, 1);
          const column = Math.min(sample.width - 1, Math.max(0, Math.round(u * (sample.width - 1))));
          const row = Math.min(sample.height - 1, Math.max(0, Math.round((1 - v) * (sample.height - 1))));
          const pixelIndex = row * sample.width + column;
          const value = luminance[pixelIndex] ?? 0.5;
          const left = luminance[row * sample.width + Math.max(0, column - 1)] ?? value;
          const right = luminance[row * sample.width + Math.min(sample.width - 1, column + 1)] ?? value;
          const up = luminance[Math.max(0, row - 1) * sample.width + column] ?? value;
          const down = luminance[Math.min(sample.height - 1, row + 1) * sample.width + column] ?? value;
          const edge = clamp(Math.abs(left - right) + Math.abs(up - down), 0, 1);
          const center = clamp(1 - Math.hypot(u - 0.5, v - 0.52) * 1.15, 0, 1);
          const relief = edge * 0.48 + center * 0.10 + (0.58 - value) * 0.06;
          positions.setZ(index, relief);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.84, metalness: 0, side: THREE.DoubleSide });
        const photoMesh = new THREE.Mesh(geometry, material);

        const root = new THREE.Group();
        root.add(photoMesh);
        root.rotation.x = -0.035;
        root.rotation.y = 0.06;
        scene.add(root);

        const frameGeometry = new THREE.BoxGeometry(planeWidth + 0.12, planeHeight + 0.12, 0.10);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x241a2d, roughness: 0.92, metalness: 0 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.07;
        root.add(frame);
        root.remove(frame);
        root.add(frame);
        root.remove(photoMesh);
        root.add(photoMesh);

        const camera = new THREE.PerspectiveCamera(34, widthPx / heightPx, 0.1, 60);
        let cameraDistance = Math.max(6.7, Math.max(planeWidth, planeHeight) * 1.45);
        camera.position.set(0, 0, cameraDistance);
        camera.lookAt(0, 0, 0.1);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.035;
        let targetY = 0.06;
        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.z = cameraDistance;
          camera.lookAt(0, 0, 0.1);
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          if (pointers.size === 2) pinch = distance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = distance();
            if (pinch) cameraDistance = clamp(cameraDistance - (next - pinch) * 0.012, 5.2, 13.5);
            pinch = next;
            updateCamera();
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          targetY = clamp(targetY + dx * 0.0035, -0.24, 0.24);
          targetX = clamp(targetX + dy * 0.0024, -0.14, 0.12);
          lastX = event.clientX;
          lastY = event.clientY;
        };
        const up = (event) => {
          pointers.delete(event.pointerId);
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          if (pointers.size < 2) pinch = 0;
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);

        let frameId = 0;
        let firstFrame = true;
        const animate = () => {
          frameId = requestAnimationFrame(animate);
          if (!reducedMotion) {
            root.rotation.x += (targetX - root.rotation.x) * 0.085;
            root.rotation.y += (targetY - root.rotation.y) * 0.085;
          } else {
            root.rotation.x = targetX;
            root.rotation.y = targetY;
          }
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            callbackRef.current?.();
          }
        };
        animate();

        const resize = () => {
          if (!mountRef.current) return;
          const width = Math.max(280, mountRef.current.clientWidth || 360);
          const height = Math.max(300, mountRef.current.clientHeight || 390);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', resize);

        cleanup = () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener('resize', resize);
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          geometry.dispose();
          material.dispose();
          texture.dispose();
          frameGeometry.dispose();
          frameMaterial.dispose();
          renderer.dispose();
          mount.innerHTML = '';
        };
      }).catch((loadError) => {
        if (!dead) setError(String(loadError?.message || loadError || 'Photo 3D preview could not start.'));
      });
    };
    image.onerror = () => {
      if (!dead) setError('The property photo could not be opened for the 3D picture preview.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl]);

  return <div className="photo3dShell">
    <img className={`photo3dFallback ${ready ? 'hidden' : ''}`} src={imageUrl} alt="Original property photo"/>
    <div ref={mountRef} className="photo3dCanvas" aria-label="Interactive 3D picture made from the original property photo"/>
    {!ready && !error ? <div className="stage">BUILDING YOUR 3D PICTURE</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? '3D PICTURE · DRAG TO CHECK THE HOUSE · NO VOXELS YET' : 'THE ORIGINAL PHOTO STAYS VISIBLE WHILE 3D STARTS'}</div>
    <style jsx>{`
      .photo3dShell{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:radial-gradient(circle at 50% 32%,#3a2850,#18101f 65%)}
      .photo3dCanvas,.photo3dFallback{position:absolute;inset:0;width:100%;height:100%}.photo3dCanvas{z-index:2}.photo3dFallback{z-index:1;object-fit:contain;background:#18101f;transition:opacity .3s ease}.photo3dFallback.hidden{opacity:0;pointer-events:none}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.78);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:38px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.86);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#e4dcec;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.11em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
