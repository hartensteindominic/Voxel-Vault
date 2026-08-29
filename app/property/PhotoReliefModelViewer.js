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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.2 : 1.55));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive 3D voxel photo. Drag or use the arrow keys to inspect the voxel depth.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(31, initialWidth / initialHeight, 0.1, 80);
        const objectGroup = new THREE.Group();
        scene.add(objectGroup);

        scene.add(new THREE.HemisphereLight(0xfffcf3, 0x201427, 2.3));
        const key = new THREE.DirectionalLight(0xfff8ee, 3.45);
        key.position.set(5.2, 6.4, 7.5);
        key.castShadow = true;
        key.shadow.mapSize.set(compact ? 512 : 1024, compact ? 512 : 1024);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xd8ceff, 1.3);
        fill.position.set(-4.7, 2.8, 4.2);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xdfff9c, 0.92);
        rim.position.set(3.8, 4.7, -4.2);
        scene.add(rim);

        const ratio = clamp((image.naturalWidth || 1) / (image.naturalHeight || 1), 0.48, 2.6);
        const columns = compact ? 27 : 34;
        const rows = clamp(Math.round(columns / ratio), 15, compact ? 38 : 44);
        const sample = document.createElement('canvas');
        sample.width = columns;
        sample.height = rows;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (!sampleContext) throw new Error('Voxel photo processing is unavailable in this browser.');
        sampleContext.imageSmoothingEnabled = true;
        sampleContext.filter = 'saturate(1.04) contrast(1.035)';
        sampleContext.drawImage(image, 0, 0, columns, rows);
        const pixels = sampleContext.getImageData(0, 0, columns, rows).data;

        const maxWidth = compact ? 5.15 : 5.7;
        const maxHeight = compact ? 4.25 : 4.7;
        let photoWidth = maxWidth;
        let photoHeight = photoWidth / ratio;
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * ratio;
        }
        const cellWidth = photoWidth / columns;
        const cellHeight = photoHeight / rows;
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshStandardMaterial({ roughness: 0.76, metalness: 0.012, vertexColors: true });
        const voxels = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, columns * rows);
        voxels.castShadow = true;
        voxels.receiveShadow = true;
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
            const edge = clamp(Math.abs(left - right) * 1.5 + Math.abs(up - down) * 1.5, 0, 1);
            const depth = 0.42 + (1 - light) * 0.34 + edge * 0.34;
            const xPos = -photoWidth / 2 + cellWidth * (x + 0.5);
            const yPos = photoHeight / 2 - cellHeight * (y + 0.5);

            dummy.position.set(xPos, yPos, depth * 0.46);
            dummy.scale.set(cellWidth * 0.9, cellHeight * 0.9, depth);
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

        const plinthGeometry = new THREE.BoxGeometry(photoWidth + 0.7, 0.16, 2.1);
        const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0xeee7dd, roughness: 0.95, metalness: 0 });
        const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
        plinth.position.set(0, -photoHeight / 2 - 0.28, 0.08);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        scene.add(plinth);

        const edgeGeometry = new THREE.EdgesGeometry(plinthGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.7 });
        const plinthEdge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        plinthEdge.position.copy(plinth.position);
        scene.add(plinthEdge);

        const groundGeometry = new THREE.PlaneGeometry(Math.max(10, photoWidth * 2), 7);
        const groundMaterial = new THREE.ShadowMaterial({ color: 0x000000, transparent: true, opacity: compact ? 0.16 : 0.21 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -photoHeight / 2 - 0.38, -0.62);
        ground.receiveShadow = true;
        scene.add(ground);

        const fitCamera = (width, height) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distanceForHeight = (photoHeight * 0.64) / Math.tan(verticalFov / 2);
          const distanceForWidth = (photoWidth * 0.64) / Math.tan(Math.max(0.12, horizontalFov / 2));
          const distance = Math.max(distanceForHeight, distanceForWidth, 5.6) + 1;
          camera.position.set(0, 0.18, distance);
          camera.lookAt(0, -0.08, 0.2);
        };
        fitCamera(initialWidth, initialHeight);

        let targetX = -0.055;
        let targetY = 0.16;
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
          targetY = clamp(targetY + dx * 0.0052, -0.55, 0.55);
          targetX = clamp(targetX + dy * 0.0037, -0.22, 0.2);
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
          if (event.key === 'ArrowLeft') targetY = clamp(targetY - 0.06, -0.55, 0.55);
          else if (event.key === 'ArrowRight') targetY = clamp(targetY + 0.06, -0.55, 0.55);
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.045, -0.22, 0.2);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.045, -0.22, 0.2);
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
            objectGroup.rotation.x += (targetX - objectGroup.rotation.x) * 0.085;
            objectGroup.rotation.y += (targetY - objectGroup.rotation.y) * 0.085;
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
    {status === 'loading' ? <div className={styles.loading}><span>BUILDING REAL 3D VOXELS…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>3D VOXEL PHOTO</span><b>REAL BLOCK GEOMETRY</b></div>
      <div className={styles.hint} aria-hidden="true">DRAG TO SEE THE VOXEL DEPTH</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>YOUR SOURCE PHOTO</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error} Your original photo is still shown so you can retry without losing the reference.</p>
    </div> : null}
  </div>;
}
