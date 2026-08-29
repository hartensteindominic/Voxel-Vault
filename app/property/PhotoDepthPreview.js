'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

export default function PhotoDepthPreview({ imageUrl, onReady }) {
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
          setError('Interactive 3D picture preview is unavailable here. Your original photo is still shown.');
          return;
        }

        const width = Math.max(280, mount.clientWidth || 360);
        const height = Math.max(280, mount.clientHeight || 380);
        const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.45));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.03;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .28s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x2b2030, 2.25));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(3, 5, 7);
        scene.add(key);

        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 60);
        let cameraDistance = compact ? 9.3 : 8.5;
        camera.position.set(0, 0, cameraDistance);
        camera.lookAt(0, 0, 0);

        const sampleSize = 48;
        const sample = document.createElement('canvas');
        sample.width = sampleSize + 1;
        sample.height = sampleSize + 1;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('This browser cannot create the 3D picture depth preview.');
        sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;

        const ratio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
        const planeWidth = ratio >= 1 ? 6.4 : 6.4 * ratio;
        const planeHeight = ratio >= 1 ? 6.4 / ratio : 6.4;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, sampleSize, sampleSize);
        const positions = geometry.attributes.position;
        for (let row = 0; row <= sampleSize; row += 1) {
          for (let column = 0; column <= sampleSize; column += 1) {
            const vertex = row * (sampleSize + 1) + column;
            const pixel = vertex * 4;
            const red = pixels[pixel] || 0;
            const green = pixels[pixel + 1] || 0;
            const blue = pixels[pixel + 2] || 0;
            const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
            const x = column / sampleSize;
            const y = row / sampleSize;
            const center = 1 - Math.min(1, Math.hypot((x - 0.5) * 1.15, (y - 0.52) * 0.85));
            const relief = (luminance - 0.48) * 0.22 + center * 0.16;
            positions.setZ(vertex, clamp(relief, -0.12, 0.30));
          }
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
        const card = new THREE.Mesh(geometry, material);
        scene.add(card);

        const frameGeometry = new THREE.BoxGeometry(planeWidth + 0.16, planeHeight + 0.16, 0.10);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x24182d, roughness: 0.9, metalness: 0 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.12;
        scene.add(frame);

        let targetX = -0.03;
        let targetY = 0.04;
        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinchDistance = 0;
        const pointerDistance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0, cameraDistance);
          camera.lookAt(0, 0, 0);
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          if (pointers.size === 2) pinchDistance = pointerDistance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = pointerDistance();
            if (pinchDistance) cameraDistance = clamp(cameraDistance - (next - pinchDistance) * 0.012, 6.9, 12.8);
            pinchDistance = next;
            updateCamera();
            return;
          }
          targetY = clamp(targetY + (event.clientX - lastX) * 0.004, -0.32, 0.32);
          targetX = clamp(targetX + (event.clientY - lastY) * 0.003, -0.22, 0.22);
          lastX = event.clientX;
          lastY = event.clientY;
        };
        const up = (event) => {
          pointers.delete(event.pointerId);
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          if (pointers.size < 2) pinchDistance = 0;
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);

        let frameId = 0;
        let firstFrame = true;
        const animate = () => {
          frameId = requestAnimationFrame(animate);
          card.rotation.x += (targetX - card.rotation.x) * 0.10;
          card.rotation.y += (targetY - card.rotation.y) * 0.10;
          frame.rotation.copy(card.rotation);
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
          const nextWidth = Math.max(280, mountRef.current.clientWidth || 360);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || 380);
          renderer.setSize(nextWidth, nextHeight);
          camera.aspect = nextWidth / nextHeight;
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
      }).catch((previewError) => {
        if (!dead) setError(String(previewError?.message || previewError || 'The 3D picture preview could not start.'));
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

  return <div className="depthShell">
    <img className={`fallbackPhoto ${ready ? 'hidden' : ''}`} src={imageUrl} alt="Original property photo"/>
    <div ref={mountRef} className="depthCanvas" aria-label="Interactive 3D picture made from the original property photo"/>
    {!ready && !error ? <div className="status">BUILDING 3D PICTURE…</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="label">{ready ? '3D PICTURE · ORIGINAL HOUSE PHOTO · DRAG TO TILT' : 'ORIGINAL PHOTO → 3D PICTURE'}</div>
    <style jsx>{`
      .depthShell{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:radial-gradient(circle at 50% 38%,#5a4666 0,#2a1e31 58%,#17101c 100%)}
      .fallbackPhoto,.depthCanvas{position:absolute;inset:0;width:100%;height:100%}.fallbackPhoto{z-index:1;object-fit:contain;background:#17101c;transition:opacity .28s ease}.fallbackPhoto.hidden{opacity:0;pointer-events:none}.depthCanvas{z-index:2}
      .status{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(25,17,31,.82);color:#f4edff;font-size:8px;font-weight:1000;letter-spacing:.12em;backdrop-filter:blur(10px)}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:38px;padding:10px 12px;border-radius:13px;background:rgba(25,17,31,.88);color:#f2eaf7;font-size:10px;line-height:1.45}
      .label{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;text-align:center;color:#efe9f3;font-size:7px;font-weight:1000;letter-spacing:.11em;text-shadow:0 1px 6px #000;pointer-events:none}
    `}</style>
  </div>;
}
