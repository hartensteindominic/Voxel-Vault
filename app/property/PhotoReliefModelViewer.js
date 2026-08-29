'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PhotoReliefModelViewer.module.css';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PhotoReliefModelViewer({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const resetRef = useRef(null);
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
        const initialHeight = Math.max(270, mount.clientHeight || 330);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.45));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive photo-matched 3D voxel photo. The front view preserves the photographed facade; drag gently or use arrow keys to inspect real voxel depth.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, initialWidth / initialHeight, 0.1, 60);
        const objectGroup = new THREE.Group();
        scene.add(objectGroup);

        const naturalWidth = Math.max(1, image.naturalWidth || 1);
        const naturalHeight = Math.max(1, image.naturalHeight || 1);
        const ratio = clamp(naturalWidth / naturalHeight, 0.38, 3.4);
        const maxWidth = compact ? 5.15 : 5.85;
        const maxHeight = compact ? 4.25 : 4.9;
        let photoWidth = maxWidth;
        let photoHeight = photoWidth / ratio;
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * ratio;
        }

        // Stage 3 is the likeness-check image, so it intentionally samples the source much
        // more densely than the stylized movable voxel that comes after approval.
        const longSide = compact ? 64 : 88;
        const columns = ratio >= 1 ? longSide : Math.max(14, Math.round(longSide * ratio));
        const rows = ratio >= 1 ? Math.max(14, Math.round(longSide / ratio)) : longSide;
        const sample = document.createElement('canvas');
        sample.width = columns;
        sample.height = rows;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('Voxel photo processing is unavailable in this browser.');
        sampleContext.imageSmoothingEnabled = true;
        sampleContext.imageSmoothingQuality = 'high';
        sampleContext.drawImage(image, 0, 0, naturalWidth, naturalHeight, 0, 0, columns, rows);
        const pixels = sampleContext.getImageData(0, 0, columns, rows).data;

        const cellWidth = photoWidth / columns;
        const cellHeight = photoHeight / rows;
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

        // The front face is unlit so the approved photo colors are not cosmetically changed.
        // Side faces are only slightly darker; this proves depth when rotated without making
        // the default likeness view look like a differently lit or recolored house.
        const sideMaterial = new THREE.MeshBasicMaterial({ color: 0xd7d7dd, vertexColors: true });
        const frontMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
        const backMaterial = new THREE.MeshBasicMaterial({ color: 0xb8b4c0, vertexColors: true });
        const cubeMaterials = [sideMaterial, sideMaterial, sideMaterial, sideMaterial, frontMaterial, backMaterial];
        const voxels = new THREE.InstancedMesh(cubeGeometry, cubeMaterials, columns * rows);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        const luminance = new Float32Array(columns * rows);
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
            const edge = clamp(Math.abs(left - right) * 1.25 + Math.abs(up - down) * 1.25, 0, 1);
            const depth = clamp(0.12 + edge * 0.07 + (1 - light) * 0.035, 0.12, 0.225);
            const xPos = -photoWidth / 2 + cellWidth * (x + 0.5);
            const yPos = photoHeight / 2 - cellHeight * (y + 0.5);

            // Fidelity invariant: every +Z/front face lands exactly on z=0. Depth extends
            // backward from the photographed plane instead of pushing darker/detail pixels
            // toward the camera and warping the facade during the approval view.
            dummy.position.set(xPos, yPos, -depth * 0.5);
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

        // No backing image, frame or plinth: the visible result itself is instanced 3D voxel
        // geometry. The source photo remains separate as a comparison card only.
        const fitCamera = (width, height) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distanceForHeight = (photoHeight * 0.59) / Math.tan(verticalFov / 2);
          const distanceForWidth = (photoWidth * 0.59) / Math.tan(Math.max(0.12, horizontalFov / 2));
          const distance = Math.max(distanceForHeight, distanceForWidth, 5.2) + 0.7;
          camera.position.set(0, 0.06, distance);
          camera.lookAt(0, -0.01, -0.04);
        };
        fitCamera(initialWidth, initialHeight);

        let targetX = -0.008;
        let targetY = 0.035;
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
        const resetFront = () => {
          targetX = -0.008;
          targetY = 0.035;
          if (reducedMotion) {
            objectGroup.rotation.set(targetX, targetY, 0);
            renderOnce();
          }
        };
        resetRef.current = resetFront;

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
          targetY = clamp(targetY + dx * 0.0031, -0.22, 0.22);
          targetX = clamp(targetX + dy * 0.0025, -0.09, 0.09);
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
          if (event.key === 'ArrowLeft') targetY = clamp(targetY - 0.035, -0.22, 0.22);
          else if (event.key === 'ArrowRight') targetY = clamp(targetY + 0.035, -0.22, 0.22);
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.025, -0.09, 0.09);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.025, -0.09, 0.09);
          else if (event.key === 'Home' || event.key === '0') resetFront();
          else handled = false;
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
            objectGroup.rotation.x += (targetX - objectGroup.rotation.x) * 0.11;
            objectGroup.rotation.y += (targetY - objectGroup.rotation.y) * 0.11;
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(render);
          };
          render();
        }

        const resize = () => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || initialWidth);
          const nextHeight = Math.max(270, mountRef.current.clientHeight || initialHeight);
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
          if (resetRef.current === resetFront) resetRef.current = null;
          cubeGeometry.dispose();
          sideMaterial.dispose();
          frontMaterial.dispose();
          backMaterial.dispose();
          voxels.dispose?.();
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
      resetRef.current = null;
      cleanup();
    };
  }, [imageUrl]);

  return <div className={`viewerShell ${styles.shell}`}>
    <div ref={mountRef} className={styles.canvasMount}/>
    {status === 'loading' ? <div className={styles.loading}><span>BUILDING PHOTO-MATCHED 3D VOXELS…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>3D VOXEL PHOTO</span><b>PHOTO-MATCHED FRONT</b></div>
      {status === 'ready' ? <button type="button" className={styles.frontButton} onClick={() => resetRef.current?.()} aria-label="Reset 3D voxel photo to the source-matched front view">RESET FRONT</button> : null}
      <div className={styles.hint} aria-hidden="true">FRONT = PHOTO MATCH · DRAG TO CHECK VOXEL DEPTH</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>ORIGINAL PHOTO · COMPARE</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error} Choose the photo again; you will not be charged again.</p>
    </div> : null}
  </div>;
}
