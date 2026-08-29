'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawCover(context, image, width, height) {
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function averageEdgeColor(context, width, height, edge) {
  const strip = Math.max(2, Math.round(Math.min(width, height) * 0.025));
  let x = 0;
  let y = 0;
  let w = width;
  let h = strip;
  if (edge === 'bottom') y = Math.max(0, height - strip);
  if (edge === 'left') { w = strip; h = height; }
  if (edge === 'right') { x = Math.max(0, width - strip); w = strip; h = height; }
  const data = context.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
  const stride = Math.max(4, Math.floor(data.length / 1000 / 4) * 4 || 4);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += stride) {
    r += data[index] || 0;
    g += data[index + 1] || 0;
    b += data[index + 2] || 0;
    count += 1;
  }
  if (!count) return { r: 38, g: 31, b: 43 };
  return { r: r / count, g: g / count, b: b / count };
}

function shadeEdge(color, amount = 0.78) {
  return {
    r: clamp(Math.round(color.r * amount), 0, 255),
    g: clamp(Math.round(color.g * amount), 0, 255),
    b: clamp(Math.round(color.b * amount), 0, 255),
  };
}

function colorNumber(color) {
  return (color.r << 16) + (color.g << 8) + color.b;
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
        const height = Math.max(280, mount.clientHeight || 420);
        const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 2 : 2.25));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.cursor = 'grab';
        renderer.domElement.setAttribute('aria-label', 'Interactive source-faithful 3D picture. Drag gently to tilt.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x17121d);

        const sourceCanvas = document.createElement('canvas');
        const maxTexture = compact ? 1600 : 2200;
        const sourceWidth = Math.max(1, image.naturalWidth || 1);
        const sourceHeight = Math.max(1, image.naturalHeight || 1);
        const scale = Math.min(1, maxTexture / Math.max(sourceWidth, sourceHeight));
        sourceCanvas.width = Math.max(1, Math.round(sourceWidth * scale));
        sourceCanvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('The 3D picture is unavailable on this device.');
        sourceContext.imageSmoothingEnabled = true;
        sourceContext.imageSmoothingQuality = 'high';
        sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

        const texture = new THREE.CanvasTexture(sourceCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const backgroundCanvas = document.createElement('canvas');
        const backgroundSize = compact ? 640 : 900;
        backgroundCanvas.width = backgroundSize;
        backgroundCanvas.height = backgroundSize;
        const backgroundContext = backgroundCanvas.getContext('2d');
        if (!backgroundContext) throw new Error('The 3D picture background is unavailable on this device.');
        backgroundContext.fillStyle = '#17121d';
        backgroundContext.fillRect(0, 0, backgroundSize, backgroundSize);
        backgroundContext.save();
        backgroundContext.filter = 'blur(22px) saturate(.76) brightness(.72)';
        backgroundContext.globalAlpha = 0.72;
        drawCover(backgroundContext, image, backgroundSize, backgroundSize);
        backgroundContext.restore();
        const wash = backgroundContext.createLinearGradient(0, 0, backgroundSize, backgroundSize);
        wash.addColorStop(0, 'rgba(255,250,242,.34)');
        wash.addColorStop(0.48, 'rgba(62,42,72,.18)');
        wash.addColorStop(1, 'rgba(17,12,22,.58)');
        backgroundContext.fillStyle = wash;
        backgroundContext.fillRect(0, 0, backgroundSize, backgroundSize);
        const backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
        backgroundTexture.colorSpace = THREE.SRGBColorSpace;
        backgroundTexture.minFilter = THREE.LinearFilter;
        backgroundTexture.magFilter = THREE.LinearFilter;

        const ratio = sourceWidth / sourceHeight;
        const maxCardWidth = 6.7;
        const maxCardHeight = 5.35;
        let cardWidth = maxCardWidth;
        let cardHeight = cardWidth / ratio;
        if (cardHeight > maxCardHeight) {
          cardHeight = maxCardHeight;
          cardWidth = cardHeight * ratio;
        }
        cardWidth = Math.max(2.45, cardWidth);
        cardHeight = Math.max(2.45, cardHeight);
        const depth = clamp(Math.min(cardWidth, cardHeight) * 0.055, 0.18, 0.34);

        const top = shadeEdge(averageEdgeColor(sourceContext, sourceCanvas.width, sourceCanvas.height, 'top'), 0.93);
        const bottom = shadeEdge(averageEdgeColor(sourceContext, sourceCanvas.width, sourceCanvas.height, 'bottom'), 0.58);
        const left = shadeEdge(averageEdgeColor(sourceContext, sourceCanvas.width, sourceCanvas.height, 'left'), 0.70);
        const right = shadeEdge(averageEdgeColor(sourceContext, sourceCanvas.width, sourceCanvas.height, 'right'), 0.82);

        const edgeMaterial = (color, roughness = 0.72) => new THREE.MeshStandardMaterial({
          color: colorNumber(color),
          roughness,
          metalness: 0.02,
        });
        const frontMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        const materials = [
          edgeMaterial(right),
          edgeMaterial(left),
          edgeMaterial(top, 0.66),
          edgeMaterial(bottom, 0.82),
          frontMaterial,
          new THREE.MeshStandardMaterial({ color: 0x19111f, roughness: 0.9, metalness: 0 }),
        ];

        const group = new THREE.Group();
        group.position.y = 0.08;
        scene.add(group);

        const geometry = new THREE.BoxGeometry(cardWidth, cardHeight, depth, 1, 1, 1);
        const picture = new THREE.Mesh(geometry, materials);
        group.add(picture);

        const rimGeometry = new THREE.BoxGeometry(cardWidth + 0.09, cardHeight + 0.09, Math.max(0.05, depth - 0.04), 1, 1, 1);
        const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.78, metalness: 0.02, side: THREE.BackSide });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.position.z = -0.045;
        group.add(rim);

        const backgroundGeometry = new THREE.PlaneGeometry(15, 15);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ map: backgroundTexture, depthWrite: false, toneMapped: false });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = -3.4;
        scene.add(background);

        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 512;
        shadowCanvas.height = 256;
        const shadowContext = shadowCanvas.getContext('2d');
        if (shadowContext) {
          const gradient = shadowContext.createRadialGradient(256, 128, 18, 256, 128, 210);
          gradient.addColorStop(0, 'rgba(0,0,0,.56)');
          gradient.addColorStop(0.45, 'rgba(0,0,0,.24)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          shadowContext.fillStyle = gradient;
          shadowContext.fillRect(0, 0, 512, 256);
        }
        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowGeometry = new THREE.PlaneGeometry(Math.max(4.1, cardWidth * 0.98), 1.25);
        const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.58, depthWrite: false });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.position.set(0, -cardHeight * 0.56, -0.35);
        shadow.rotation.x = -0.94;
        scene.add(shadow);

        scene.add(new THREE.HemisphereLight(0xfff8ec, 0x1a1122, 1.55));
        const key = new THREE.DirectionalLight(0xffffff, 2.25);
        key.position.set(4.5, 5.5, 7);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xc8b7ff, 0.9);
        fill.position.set(-5, 1.5, 4);
        scene.add(fill);
        const warm = new THREE.DirectionalLight(0xffd8a6, 0.55);
        warm.position.set(1, -2, 5);
        scene.add(warm);

        const camera = new THREE.PerspectiveCamera(27, width / height, 0.1, 70);
        const frameCamera = (nextWidth, nextHeight) => {
          const aspect = Math.max(0.5, nextWidth / Math.max(1, nextHeight));
          camera.aspect = aspect;
          const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
          const heightDistance = (cardHeight * 0.5) / Math.tan(halfFov);
          const widthDistance = (cardWidth * 0.5) / (Math.tan(halfFov) * aspect);
          const distance = Math.max(heightDistance, widthDistance) * (compact ? 1.34 : 1.25) + 0.45;
          camera.position.set(0, 0.04, distance);
          camera.lookAt(0, 0.04, 0);
          camera.updateProjectionMatrix();
        };
        frameCamera(width, height);

        let targetX = -0.025;
        let targetY = 0.10;
        let pointerId = null;
        let lastX = 0;
        let lastY = 0;
        let frame = 0;

        const renderScene = () => renderer.render(scene, camera);
        const applyReducedMotionTarget = () => {
          group.rotation.x = targetX;
          group.rotation.y = targetY;
          renderScene();
        };
        const down = (event) => {
          pointerId = event.pointerId;
          lastX = event.clientX;
          lastY = event.clientY;
          renderer.domElement.style.cursor = 'grabbing';
          renderer.domElement.setPointerCapture?.(event.pointerId);
        };
        const move = (event) => {
          if (pointerId !== event.pointerId) return;
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          targetY = clamp(targetY + dx * 0.0036, -0.32, 0.32);
          targetX = clamp(targetX + dy * 0.0028, -0.12, 0.10);
          if (reducedMotion) applyReducedMotionTarget();
        };
        const up = (event) => {
          if (pointerId === event.pointerId) pointerId = null;
          renderer.domElement.style.cursor = 'grab';
        };
        const reset = () => {
          targetX = -0.025;
          targetY = 0.10;
          if (reducedMotion) applyReducedMotionTarget();
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('dblclick', reset);

        const renderLoop = () => {
          if (dead) return;
          group.rotation.x += (targetX - group.rotation.x) * 0.095;
          group.rotation.y += (targetY - group.rotation.y) * 0.095;
          renderScene();
          frame = requestAnimationFrame(renderLoop);
        };
        if (reducedMotion) applyReducedMotionTarget();
        else renderLoop();

        const resize = () => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || width);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || height);
          renderer.setSize(nextWidth, nextHeight);
          frameCamera(nextWidth, nextHeight);
          if (reducedMotion) renderScene();
        };
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        observer?.observe(mount);

        renderScene();
        callbackRef.current?.();

        cleanup = () => {
          if (frame) cancelAnimationFrame(frame);
          observer?.disconnect();
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          renderer.domElement.removeEventListener('dblclick', reset);
          geometry.dispose();
          rimGeometry.dispose();
          backgroundGeometry.dispose();
          shadowGeometry.dispose();
          materials.forEach((material) => material.dispose());
          rimMaterial.dispose();
          backgroundMaterial.dispose();
          shadowMaterial.dispose();
          texture.dispose();
          backgroundTexture.dispose();
          shadowTexture.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
      } catch (previewError) {
        if (!dead) setError(String(previewError?.message || previewError || 'The 3D picture could not open.'));
      }
    };
    image.onerror = () => setError('The selected photo could not be opened for the 3D picture.');

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl]);

  return <div className="viewerShell" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300, overflow: 'hidden', background: '#17121d' }}>
    <div ref={mountRef} style={{ position: 'absolute', inset: 0 }}/>
    {error ? <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: '1fr auto', background: '#17121d' }}>
      <img src={imageUrl} alt="Source property" style={{ width: '100%', height: '100%', minHeight: 0, objectFit: 'contain', background: '#17121d' }}/>
      <div style={{ padding: '10px 14px 13px', color: '#f4edf6', textAlign: 'center', fontSize: 11, lineHeight: 1.45 }}>{error} Showing the original photo instead.</div>
    </div> : null}
  </div>;
}
