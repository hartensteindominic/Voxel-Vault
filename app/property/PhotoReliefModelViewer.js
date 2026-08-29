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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.7));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive photo-faithful 3D preview. Drag or use the arrow keys to inspect the depth.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(31, initialWidth / initialHeight, 0.1, 80);
        const objectGroup = new THREE.Group();
        scene.add(objectGroup);

        const hemisphere = new THREE.HemisphereLight(0xfffcf3, 0x1b1220, 2.25);
        scene.add(hemisphere);
        const key = new THREE.DirectionalLight(0xfff7eb, 3.2);
        key.position.set(4.5, 5.5, 6.5);
        key.castShadow = true;
        key.shadow.mapSize.set(compact ? 512 : 1024, compact ? 512 : 1024);
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 24;
        key.shadow.camera.left = -8;
        key.shadow.camera.right = 8;
        key.shadow.camera.top = 8;
        key.shadow.camera.bottom = -8;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xded5ff, 1.25);
        fill.position.set(-4.5, 1.8, 4);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xe8ffc0, 0.85);
        rim.position.set(1.5, 4, -3);
        scene.add(rim);

        const ratio = Math.max(0.32, Math.min(3.2, (image.naturalWidth || 1) / (image.naturalHeight || 1)));
        const maxWidth = compact ? 4.8 : 5.45;
        const maxHeight = compact ? 3.8 : 4.25;
        let photoWidth = maxWidth;
        let photoHeight = photoWidth / ratio;
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * ratio;
        }
        const depth = clamp(Math.min(photoWidth, photoHeight) * 0.085, 0.22, 0.38);

        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const frameGeometry = new THREE.BoxGeometry(photoWidth + 0.18, photoHeight + 0.18, depth, 1, 1, 1);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1a111f, roughness: 0.62, metalness: 0.08 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.castShadow = true;
        frame.receiveShadow = true;
        objectGroup.add(frame);

        const photoGeometry = new THREE.PlaneGeometry(photoWidth, photoHeight, 1, 1);
        const photoMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false });
        const photo = new THREE.Mesh(photoGeometry, photoMaterial);
        photo.position.z = depth / 2 + 0.012;
        photo.castShadow = true;
        objectGroup.add(photo);

        const edgeGeometry = new THREE.EdgesGeometry(frameGeometry, 24);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.19 });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        objectGroup.add(edges);

        const groundGeometry = new THREE.PlaneGeometry(Math.max(8, photoWidth * 1.8), 6);
        const groundMaterial = new THREE.ShadowMaterial({ color: 0x000000, transparent: true, opacity: compact ? 0.16 : 0.23 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -photoHeight / 2 - 0.5, 0.25);
        ground.receiveShadow = true;
        scene.add(ground);

        const fitCamera = (width, height) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distanceForHeight = (photoHeight * 0.62) / Math.tan(verticalFov / 2);
          const distanceForWidth = (photoWidth * 0.62) / Math.tan(Math.max(0.12, horizontalFov / 2));
          const distance = Math.max(distanceForHeight, distanceForWidth, 5.2) + 0.65;
          camera.position.set(0, 0.18, distance);
          camera.lookAt(0, -0.05, 0);
        };
        fitCamera(initialWidth, initialHeight);

        let targetX = -0.035;
        let targetY = 0.09;
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
          targetY = clamp(targetY + dx * 0.0048, -0.36, 0.36);
          targetX = clamp(targetX + dy * 0.0035, -0.14, 0.14);
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
          if (event.key === 'ArrowLeft') targetY = clamp(targetY - 0.055, -0.36, 0.36);
          else if (event.key === 'ArrowRight') targetY = clamp(targetY + 0.055, -0.36, 0.36);
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.04, -0.14, 0.14);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.04, -0.14, 0.14);
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
        if (reducedMotion) {
          renderOnce();
        } else {
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
          photoGeometry.dispose();
          photoMaterial.dispose();
          texture.dispose();
          edgeGeometry.dispose();
          edgeMaterial.dispose();
          frameGeometry.dispose();
          frameMaterial.dispose();
          groundGeometry.dispose();
          groundMaterial.dispose();
          renderer.dispose();
          renderer.forceContextLoss?.();
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
      } catch (previewError) {
        if (!dead) {
          setStatus('error');
          setError(String(previewError?.message || previewError || 'The 3D photo preview could not open.'));
        }
      }
    };
    image.onerror = () => {
      if (!dead) {
        setStatus('error');
        setError('The selected photo could not be opened for the 3D preview.');
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
    {status === 'loading' ? <div className={styles.loading}><span>PREPARING PHOTO-FAITHFUL 3D…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>PHOTO-FAITHFUL 3D</span><b>NO WARPING</b></div>
      <div className={styles.hint} aria-hidden="true">DRAG TO INSPECT DEPTH</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>ORIGINAL REFERENCE</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error} The original reference is still shown so the property is never replaced by a misleading render.</p>
    </div> : null}
  </div>;
}
