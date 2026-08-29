'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PhotoReliefModelViewer.module.css';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PhotoReliefModelViewer({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('loading');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');
    setStatus('loading');

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;
    image.onload = async () => {
      try {
        const THREE = await import('three');
        if (dead || !mountRef.current) return;

        const mount = mountRef.current;
        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(250, mount.clientHeight || 320);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.45));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.98;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive high-fidelity 3D voxel photo. The front view preserves the photographed house. Drag gently or use the arrow keys to inspect the shallow voxel depth.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, initialWidth / initialHeight, 0.1, 60);
        const objectGroup = new THREE.Group();
        scene.add(objectGroup);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x26192e, 2.65));
        const key = new THREE.DirectionalLight(0xfffbf5, 1.05);
        key.position.set(4.5, 5.2, 7.4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xe7e1ff, 0.42);
        fill.position.set(-4.2, 2.2, 4.6);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xf2ffd2, 0.28);
        rim.position.set(3.5, 3.8, -3.6);
        scene.add(rim);

        // Force a raster intermediate. SVGs (and some remote images) can report
        // naturalWidth 0 or produce empty getImageData when drawn at sample size only.
        const sourceW = Math.max(2, image.naturalWidth || image.width || 960);
        const sourceH = Math.max(2, image.naturalHeight || image.height || 640);
        const raster = document.createElement('canvas');
        raster.width = sourceW;
        raster.height = sourceH;
        const rasterContext = raster.getContext('2d', { willReadFrequently: true });
        if (!rasterContext) throw new Error('Voxel photo processing is unavailable in this browser.');
        rasterContext.drawImage(image, 0, 0, sourceW, sourceH);

        const ratio = clamp(sourceW / sourceH, 0.45, 2.8);
        const maxWidth = compact ? 5.0 : 5.7;
        const maxHeight = compact ? 4.0 : 4.45;
        let photoWidth = maxWidth;
        let photoHeight = photoWidth / ratio;
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * ratio;
        }

        const columns = compact ? 52 : 64;
        const rows = clamp(Math.round(columns / ratio), 26, compact ? 64 : 72);
        const sample = document.createElement('canvas');
        sample.width = columns;
        sample.height = rows;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('Voxel photo processing is unavailable in this browser.');
        sampleContext.imageSmoothingEnabled = true;
        sampleContext.imageSmoothingQuality = 'high';
        sampleContext.drawImage(raster, 0, 0, columns, rows);
        const pixels = sampleContext.getImageData(0, 0, columns, rows).data;

        const cellWidth = photoWidth / columns;
        const cellHeight = photoHeight / rows;
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, vertexColors: true });
        const voxels = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, columns * rows);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        const luminance = new Array(columns * rows).fill(0);
        for (let index = 0; index < columns * rows; index += 1) {
          const offset = index * 4;
          const red = pixels[offset] / 255;
          const green = pixels[offset + 1] / 255;
          const blue = pixels[offset + 2] / 255;
          luminance[index] = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        }

        let instance = 0;
        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < columns; x += 1) {
            const index = y * columns + x;
            const offset = index * 4;
            const red = pixels[offset] / 255;
            const green = pixels[offset + 1] / 255;
            const blue = pixels[offset + 2] / 255;
            const alpha = pixels[offset + 3] / 255;
            const light = luminance[index];
            const left = luminance[y * columns + Math.max(0, x - 1)] ?? light;
            const right = luminance[y * columns + Math.min(columns - 1, x + 1)] ?? light;
            const up = luminance[Math.max(0, y - 1) * columns + x] ?? light;
            const down = luminance[Math.min(rows - 1, y + 1) * columns + x] ?? light;
            const edge = clamp(Math.abs(left - right) * 1.35 + Math.abs(up - down) * 1.35, 0, 1);

            const baseDepth = 0.10;
            const depth = baseDepth + (1 - light) * 0.05 + edge * 0.055;
            const xPos = -photoWidth / 2 + cellWidth * (x + 0.5);
            const yPos = photoHeight / 2 - cellHeight * (y + 0.5);

            dummy.position.set(xPos, yPos, depth * 0.5);
            dummy.scale.set(cellWidth * 0.985, cellHeight * 0.985, depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            voxels.setMatrixAt(instance, dummy.matrix);
            color.setRGB(
              red * alpha + 0.12 * (1 - alpha),
              green * alpha + 0.09 * (1 - alpha),
              blue * alpha + 0.14 * (1 - alpha),
              THREE.SRGBColorSpace,
            );
            voxels.setColorAt(instance, color);
            instance += 1;
          }
        }
        voxels.instanceMatrix.needsUpdate = true;
        if (voxels.instanceColor) voxels.instanceColor.needsUpdate = true;
        objectGroup.add(voxels);

        const fitCamera = (width, height) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distanceForHeight = (photoHeight * 0.59) / Math.tan(verticalFov / 2);
          const distanceForWidth = (photoWidth * 0.59) / Math.tan(Math.max(0.12, horizontalFov / 2));
          const distance = Math.max(distanceForHeight, distanceForWidth, 5.25) + 0.72;
          camera.position.set(0, 0.08, distance);
          camera.lookAt(0, -0.01, 0.045);
        };
        fitCamera(initialWidth, initialHeight);

        let targetX = -0.012;
        let targetY = 0.045;
        let pointerId = null;
        let lastX = 0;
        let lastY = 0;
        let frameId = 0;

        const renderOnce = () => renderer.render(scene, camera);
        const applyReducedMotionRotation = () => {
          if (!reducedMotion) return;
          objectGroup.rotation.x = targetX;
          objectGroup.rotation.y = targetY;
          renderOnce();
        };
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
          targetY = clamp(targetY + dx * 0.0034, -0.28, 0.28);
          targetX = clamp(targetX + dy * 0.0028, -0.11, 0.11);
          applyReducedMotionRotation();
        };
        const up = (event) => {
          if (pointerId === event.pointerId) {
            renderer.domElement.releasePointerCapture?.(event.pointerId);
            pointerId = null;
          }
        };
        const keydown = (event) => {
          let handled = true;
          if (event.key === 'ArrowLeft') targetY = clamp(targetY - 0.04, -0.28, 0.28);
          else if (event.key === 'ArrowRight') targetY = clamp(targetY + 0.04, -0.28, 0.28);
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.03, -0.11, 0.11);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.03, -0.11, 0.11);
          else if (event.key === 'Home') {
            targetX = -0.012;
            targetY = 0.045;
          } else handled = false;
          if (handled) {
            event.preventDefault();
            applyReducedMotionRotation();
          }
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('keydown', keydown);

        objectGroup.rotation.set(targetX, targetY, 0);
        if (reducedMotion) renderOnce();
        else {
          const render = () => {
            if (dead) return;
            objectGroup.rotation.x += (targetX - objectGroup.rotation.x) * 0.1;
            objectGroup.rotation.y += (targetY - objectGroup.rotation.y) * 0.1;
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(render);
          };
          render();
        }

        const resize = () => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || initialWidth);
          const nextHeight = Math.max(250, mountRef.current.clientHeight || initialHeight);
          renderer.setSize(nextWidth, nextHeight);
          fitCamera(nextWidth, nextHeight);
          if (reducedMotion) renderOnce();
        };
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        observer?.observe(mount);

        if (!dead) {
          setStatus('ready');
          callbackRef.current?.();
        }

        cleanup = () => {
          if (frameId) cancelAnimationFrame(frameId);
          observer?.disconnect();
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          renderer.domElement.removeEventListener('keydown', keydown);
          cubeGeometry.dispose();
          cubeMaterial.dispose();
          renderer.dispose();
          renderer.forceContextLoss?.();
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
      } catch (previewError) {
        if (!dead) {
          setStatus('error');
          setError(String(previewError?.message || previewError || 'The 3D voxel photo could not open.'));
        }
      }
    };
    image.onerror = () => {
      if (!dead) {
        setStatus('error');
        setError('The selected photo could not be opened for the 3D voxel photo.');
      }
    };

    return () => {
      dead = true;
      image.onload = null;
      image.onerror = null;
      cleanup();
    };
  }, [imageUrl]);

  return <div className={`viewerShell ${styles.shell}`}>
    <div ref={mountRef} className={styles.canvasMount}/>
    {status === 'loading' ? <div className={styles.loading}><span>BUILDING HIGH-FIDELITY 3D VOXEL PHOTO…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>3D VOXEL PHOTO</span><b>HIGH-FIDELITY PHOTO MATCH</b></div>
      <div className={styles.hint} aria-hidden="true">FRONT = PHOTO MATCH · DRAG GENTLY</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>ORIGINAL PHOTO</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error} Choose the photo again; you will not be charged again.</p>
    </div> : null}
  </div>;
}
