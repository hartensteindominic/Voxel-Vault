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
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.5));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.shadowMap.enabled = !compact;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive photo-matched 3D voxel view. The front preserves the source-photo composition; drag slightly to inspect cube depth.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(29, initialWidth / initialHeight, 0.1, 80);
        const objectGroup = new THREE.Group();
        scene.add(objectGroup);

        // Keep the front view visually close to the source colors. Side lighting is deliberately
        // subtle: the house identity should read before the relief effect does.
        scene.add(new THREE.AmbientLight(0xffffff, 0.82));
        const key = new THREE.DirectionalLight(0xfffbf4, 0.34);
        key.position.set(4.5, 5.8, 8.5);
        key.castShadow = !compact;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xd9ccff, 0.16);
        rim.position.set(-4.5, 2.4, -5.5);
        scene.add(rim);

        const naturalWidth = Math.max(1, image.naturalWidth || 1);
        const naturalHeight = Math.max(1, image.naturalHeight || 1);
        const ratio = clamp(naturalWidth / naturalHeight, 0.38, 3.4);

        // Stage 3 is the likeness-check stage. Use substantially more source samples than the
        // final stylized voxel so roof lines, window spacing, trim and facade colors survive.
        const longSide = compact ? 50 : 64;
        const minSide = compact ? 24 : 28;
        const columns = ratio >= 1 ? longSide : clamp(Math.round(longSide * ratio), minSide, longSide);
        const rows = ratio >= 1 ? clamp(Math.round(longSide / ratio), minSide, longSide) : longSide;
        const sample = document.createElement('canvas');
        sample.width = columns;
        sample.height = rows;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('Voxel photo processing is unavailable in this browser.');
        sampleContext.imageSmoothingEnabled = true;
        sampleContext.drawImage(image, 0, 0, naturalWidth, naturalHeight, 0, 0, columns, rows);
        const pixels = sampleContext.getImageData(0, 0, columns, rows).data;

        const maxWidth = compact ? 5.3 : 5.85;
        const maxHeight = compact ? 4.55 : 4.9;
        let photoWidth = maxWidth;
        let photoHeight = photoWidth / ratio;
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * ratio;
        }

        const cellWidth = photoWidth / columns;
        const cellHeight = photoHeight / rows;
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
        const voxels = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, columns * rows);
        voxels.castShadow = !compact;
        voxels.receiveShadow = !compact;
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
            const edge = clamp(Math.abs(left - right) * 1.45 + Math.abs(up - down) * 1.45, 0, 1);
            const depth = clamp(0.30 + edge * 0.34 + (1 - light) * 0.08, 0.30, 0.72);
            const xPos = -photoWidth / 2 + cellWidth * (x + 0.5);
            const yPos = photoHeight / 2 - cellHeight * (y + 0.5);

            // Critical fidelity rule: every cube shares z=0 on its FRONT face. Relief extends
            // backward, so the user's normal viewing angle does not warp the photographed facade.
            dummy.position.set(xPos, yPos, -depth * 0.5);
            dummy.scale.set(cellWidth * 0.965, cellHeight * 0.965, depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            voxels.setMatrixAt(instance, dummy.matrix);
            color.setRGB(
              red * alpha + 0.13 * (1 - alpha),
              green * alpha + 0.10 * (1 - alpha),
              blue * alpha + 0.16 * (1 - alpha),
            );
            voxels.setColorAt(instance, color);
            instance += 1;
          }
        }
        voxels.instanceMatrix.needsUpdate = true;
        if (voxels.instanceColor) voxels.instanceColor.needsUpdate = true;
        objectGroup.add(voxels);

        const plinthGeometry = new THREE.BoxGeometry(photoWidth + 0.55, 0.12, 1.7);
        const plinthMaterial = new THREE.MeshLambertMaterial({ color: 0xe9e1d8 });
        const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
        plinth.position.set(0, -photoHeight / 2 - 0.24, -0.34);
        plinth.castShadow = !compact;
        plinth.receiveShadow = !compact;
        scene.add(plinth);

        const edgeGeometry = new THREE.EdgesGeometry(plinthGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.58 });
        const plinthEdge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        plinthEdge.position.copy(plinth.position);
        scene.add(plinthEdge);

        const groundGeometry = new THREE.PlaneGeometry(Math.max(10, photoWidth * 2), 7);
        const groundMaterial = new THREE.ShadowMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -photoHeight / 2 - 0.31, -0.55);
        ground.receiveShadow = !compact;
        scene.add(ground);

        const fitCamera = (width, height) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distanceForHeight = (photoHeight * 0.57) / Math.tan(verticalFov / 2);
          const distanceForWidth = (photoWidth * 0.57) / Math.tan(Math.max(0.12, horizontalFov / 2));
          const distance = Math.max(distanceForHeight, distanceForWidth, 5.4) + 0.72;
          camera.position.set(0, 0.12, distance);
          camera.lookAt(0, -0.05, -0.12);
        };
        fitCamera(initialWidth, initialHeight);

        let targetX = -0.018;
        let targetY = 0.055;
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
          targetY = clamp(targetY + dx * 0.0048, -0.38, 0.38);
          targetX = clamp(targetX + dy * 0.0034, -0.15, 0.15);
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
          if (event.key === 'ArrowLeft') targetY = clamp(targetY - 0.05, -0.38, 0.38);
          else if (event.key === 'ArrowRight') targetY = clamp(targetY + 0.05, -0.38, 0.38);
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.04, -0.15, 0.15);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.04, -0.15, 0.15);
          else if (event.key === 'Home' || event.key === '0') {
            targetX = -0.018;
            targetY = 0.055;
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
            objectGroup.rotation.x += (targetX - objectGroup.rotation.x) * 0.095;
            objectGroup.rotation.y += (targetY - objectGroup.rotation.y) * 0.095;
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(render);
          };
          render();
        }

        const resize = () => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || initialWidth);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || initialHeight);
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
          plinthGeometry.dispose();
          plinthMaterial.dispose();
          edgeGeometry.dispose();
          edgeMaterial.dispose();
          groundGeometry.dispose();
          groundMaterial.dispose();
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
    {status === 'loading' ? <div className={styles.loading}><span>BUILDING HIGH-FIDELITY 3D VOXELS…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>3D VOXEL PHOTO</span><b>SOURCE-MATCHED FRONT</b></div>
      <div className={styles.hint} aria-hidden="true">DRAG SLIGHTLY · FRONT VIEW PRESERVES THE PHOTO</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>ORIGINAL PHOTO · COMPARE</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error} Choose the photo again; you will not be charged again.</p>
    </div> : null}
  </div>;
}
