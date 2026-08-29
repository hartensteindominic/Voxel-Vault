'use client';

import { useEffect, useRef, useState } from 'react';

const GRID = 24;

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / 20) * 20));
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sampleRecipe(image) {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
  const targetRatio = 1;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth || 1;
  let sh = image.naturalHeight || 1;
  if (sourceRatio > targetRatio) {
    sw = sh * targetRatio;
    sx = ((image.naturalWidth || 1) - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = sw / targetRatio;
    sy = Math.max(0, ((image.naturalHeight || 1) - sh) * 0.42);
  }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, GRID, GRID);
  const data = context.getImageData(0, 0, GRID, GRID).data;
  const rgb = [];
  const luminance = [];
  const colors = [];

  for (let index = 0; index < GRID * GRID; index += 1) {
    const offset = index * 4;
    const red = quantize(data[offset]);
    const green = quantize(data[offset + 1]);
    const blue = quantize(data[offset + 2]);
    rgb.push([red, green, blue]);
    colors.push(`${toHex(red)}${toHex(green)}${toHex(blue)}`);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
  }

  const cornerIndices = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      cornerIndices.push(row * GRID + column);
      cornerIndices.push(row * GRID + (GRID - 1 - column));
    }
  }
  const background = cornerIndices.reduce((sum, index) => {
    const value = rgb[index];
    return [sum[0] + value[0], sum[1] + value[1], sum[2] + value[2]];
  }, [0, 0, 0]).map((value) => value / Math.max(1, cornerIndices.length));
  const backgroundLuma = (background[0] * 0.2126 + background[1] * 0.7152 + background[2] * 0.0722) / 255;

  const rawMask = rgb.map((value, index) => {
    const row = Math.floor(index / GRID);
    const column = index % GRID;
    const distance = colorDistance(value, background);
    const lumaDelta = Math.abs(luminance[index] - backgroundLuma);
    const inUsefulFrame = column >= 1 && column <= GRID - 2 && row >= 1 && row <= GRID - 2;
    const centerBias = Math.abs(column - (GRID - 1) / 2) / (GRID / 2);
    const threshold = row > GRID * 0.8 ? 74 : 48 + Math.max(0, centerBias - 0.72) * 28;
    return inUsefulFrame && (distance > threshold || lumaDelta > 0.17) ? 1 : 0;
  });

  const mask = rawMask.map((value, index) => {
    if (value) return 1;
    const row = Math.floor(index / GRID);
    const column = index % GRID;
    if (row < 1 || row >= GRID - 1 || column < 1 || column >= GRID - 1) return 0;
    let neighbors = 0;
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -1; x <= 1; x += 1) {
        if (!x && !y) continue;
        neighbors += rawMask[(row + y) * GRID + column + x] || 0;
      }
    }
    return neighbors >= 5 ? 1 : 0;
  });

  const activeCount = mask.reduce((sum, value) => sum + value, 0);
  if (activeCount < GRID * 4) {
    for (let row = 3; row < GRID - 3; row += 1) {
      for (let column = 4; column < GRID - 4; column += 1) mask[row * GRID + column] = 1;
    }
  }

  const depths = luminance.map((value, index) => {
    const row = Math.floor(index / GRID);
    const column = index % GRID;
    const right = luminance[row * GRID + Math.min(GRID - 1, column + 1)] ?? value;
    const down = luminance[Math.min(GRID - 1, row + 1) * GRID + column] ?? value;
    const left = luminance[row * GRID + Math.max(0, column - 1)] ?? value;
    const edge = Math.min(1, Math.abs(value - right) * 2.2 + Math.abs(value - down) * 2.2 + Math.abs(value - left) * 1.4);
    const roofBias = row < GRID * 0.42 ? 1 : 0;
    return Math.max(2, Math.min(9, Math.round(3 + edge * 3 + (1 - value) * 2 + roofBias)));
  });

  return { version: 1, width: GRID, height: GRID, colors, depths, mask };
}

export default function LocalVoxelModelViewer({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    reportedRef.current = '';

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;

    image.onload = () => {
      let recipe;
      try {
        recipe = sampleRecipe(image);
      } catch (sampleError) {
        if (!dead) setError(String(sampleError?.message || sampleError || 'Local voxel sampling failed.'));
        return;
      }

      import('three').then((THREE) => {
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        } catch {
          setError('Interactive 3D is unavailable here. The VoxelPop image remains visible.');
          return;
        }

        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.4));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .42s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x180f25, 2.45));
        const key = new THREE.DirectionalLight(0xffedd5, 4.4);
        key.position.set(5, 7, 8);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbca8ff, 2.15);
        rim.position.set(-5, 2, -3);
        scene.add(rim);

        const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = compact ? 10.1 : 9.3;
        camera.position.set(0, 0.2, cameraDistance);
        camera.lookAt(0, 0, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.1;
        root.rotation.y = 0.28;
        root.position.y = 0.2;
        scene.add(root);

        const activeIndices = recipe.mask.map((value, index) => value ? index : -1).filter((index) => index >= 0);
        const geometry = new THREE.BoxGeometry(0.25, 0.25, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.015 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, activeIndices.length));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const cell = 0.27;

        activeIndices.forEach((index, instanceIndex) => {
          const row = Math.floor(index / recipe.width);
          const column = index % recipe.width;
          const depth = 0.34 + (recipe.depths[index] / 9) * 1.12;
          dummy.position.set(
            (column - (recipe.width - 1) / 2) * cell,
            ((recipe.height - 1) / 2 - row) * cell,
            depth / 2 - 0.42,
          );
          dummy.scale.set(1, 1, depth);
          dummy.updateMatrix();
          mesh.setMatrixAt(instanceIndex, dummy.matrix);
          color.set(`#${recipe.colors[index]}`);
          mesh.setColorAt(instanceIndex, color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);

        const floorGeometry = new THREE.BoxGeometry(6.7, 0.16, 3.5);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x7b9656, roughness: 0.96, metalness: 0 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(0, -3.08, 0.15);
        root.add(floor);

        const shadowGeometry = new THREE.CircleGeometry(3.4, 48);
        const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x120c18, transparent: true, opacity: 0.25 });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, -3.13, 0.55);
        scene.add(shadow);

        const pointers = new Map();
        let moved = false;
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.1;
        let targetY = 0.28;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.2, cameraDistance);
          camera.lookAt(0, 0, 0);
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          moved = false;
          if (pointers.size === 2) pinch = distance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = distance();
            if (pinch) cameraDistance = Math.max(6.8, Math.min(13, cameraDistance - (next - pinch) * 0.012));
            pinch = next;
            updateCamera();
            moved = true;
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          targetY += dx * 0.008;
          targetX = Math.max(-0.52, Math.min(0.34, targetX + dy * 0.004));
          lastX = event.clientX;
          lastY = event.clientY;
        };
        const up = (event) => {
          pointers.delete(event.pointerId);
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          if (pointers.size < 2) pinch = 0;
        };
        const wheel = (event) => {
          event.preventDefault();
          cameraDistance = Math.max(6.8, Math.min(13, cameraDistance + Math.sign(event.deltaY) * 0.45));
          updateCamera();
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });

        let frame = 0;
        let firstFrame = true;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          if (!reducedMotion && pointers.size === 0 && !moved) targetY += 0.00042;
          root.rotation.x += (targetX - root.rotation.x) * 0.075;
          root.rotation.y += (targetY - root.rotation.y) * 0.075;
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            const signature = `${recipe.width}x${recipe.height}:${activeIndices.length}:${recipe.colors.slice(0, 4).join('')}`;
            if (reportedRef.current !== signature) {
              reportedRef.current = signature;
              callbackRef.current?.(recipe);
            }
          }
        };
        animate();

        const resize = () => {
          if (!mountRef.current) return;
          const width = Math.max(280, mountRef.current.clientWidth || 360);
          const height = Math.max(280, mountRef.current.clientHeight || 360);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', resize);

        cleanup = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener('resize', resize);
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          renderer.domElement.removeEventListener('wheel', wheel);
          geometry.dispose();
          material.dispose();
          floorGeometry.dispose();
          floorMaterial.dispose();
          shadowGeometry.dispose();
          shadowMaterial.dispose();
          renderer.dispose();
          mount.innerHTML = '';
        };
      }).catch(() => {
        if (!dead) setError('Interactive 3D could not start. The VoxelPop image remains visible.');
      });
    };
    image.onerror = () => {
      if (!dead) setError('The VoxelPop image could not be opened for local 3D.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl]);

  return <div className="localViewerShell">
    {imageUrl ? <img className={`localPoster ${ready ? 'hidden' : ''}`} src={imageUrl} alt="VoxelPop rendered 3D image"/> : null}
    <div ref={mountRef} className="localCanvas" aria-label="Interactive on-device VoxelPop 3D model"/>
    {!ready && !error ? <div className="stage">3D IMAGE · BUILDING PROPERTY SHAPE</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? 'DRAG · PINCH TO ZOOM · PHOTO-MATCHED SILHOUETTE' : '3D IMAGE → INTERACTIVE 3D'}</div>
    <style jsx>{`
      .localViewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 32%,#3a2850,#18101f 64%)}
      .localPoster,.localCanvas{position:absolute;inset:0;width:100%;height:100%}.localPoster{z-index:1;object-fit:cover;opacity:1;transition:opacity .42s ease}.localPoster.hidden{opacity:0;pointer-events:none}.localCanvas{z-index:2}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.78);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:36px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.84);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#d8cedf;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.12em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
