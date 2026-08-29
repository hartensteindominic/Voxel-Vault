'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_GRID = 24;
const MIN_GRID = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantize(value) {
  return clamp(Math.round(Number(value || 0) / 16) * 16, 0, 255);
}

function toHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function recipeDimensions(image) {
  const width = Math.max(1, image.naturalWidth || 1);
  const height = Math.max(1, image.naturalHeight || 1);
  const ratio = clamp(width / height, 0.5, 2);
  if (ratio >= 1) return { width: MAX_GRID, height: Math.max(MIN_GRID, Math.round(MAX_GRID / ratio)) };
  return { width: Math.max(MIN_GRID, Math.round(MAX_GRID * ratio)), height: MAX_GRID };
}

function normalizeRecipe(input) {
  const width = Math.trunc(Number(input?.width));
  const height = Math.trunc(Number(input?.height));
  const count = width * height;
  if (Number(input?.version) !== 1 || width < 8 || height < 8 || width > MAX_GRID || height > MAX_GRID) return null;
  if (!Array.isArray(input?.colors) || !Array.isArray(input?.depths) || input.colors.length !== count || input.depths.length !== count) return null;
  const colors = input.colors.map((value) => String(value || '').toLowerCase()).slice(0, count);
  const depths = input.depths.map((value) => clamp(Math.trunc(Number(value) || 0), 0, 9)).slice(0, count);
  if (colors.some((value) => !/^[a-f0-9]{6}$/.test(value))) return null;
  return { version: 1, width, height, colors, depths };
}

function sampleRecipe(image) {
  const dimensions = recipeDimensions(image);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  // Preserve the full photo framing instead of square-cropping the building.
  context.filter = 'saturate(1.06) contrast(1.05)';
  context.drawImage(image, 0, 0, image.naturalWidth || 1, image.naturalHeight || 1, 0, 0, dimensions.width, dimensions.height);
  const data = context.getImageData(0, 0, dimensions.width, dimensions.height).data;
  const luminance = [];
  const colors = [];

  for (let index = 0; index < dimensions.width * dimensions.height; index += 1) {
    const offset = index * 4;
    const red = quantize(data[offset]);
    const green = quantize(data[offset + 1]);
    const blue = quantize(data[offset + 2]);
    colors.push(`${toHex(red)}${toHex(green)}${toHex(blue)}`);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
  }

  const depths = luminance.map((value, index) => {
    const row = Math.floor(index / dimensions.width);
    const column = index % dimensions.width;
    const left = luminance[row * dimensions.width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * dimensions.width + Math.min(dimensions.width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * dimensions.width + column] ?? value;
    const down = luminance[Math.min(dimensions.height - 1, row + 1) * dimensions.width + column] ?? value;
    // Structural contrast drives depth. Bright sky no longer becomes a giant block.
    const edge = clamp((Math.abs(value - left) + Math.abs(value - right) + Math.abs(value - up) + Math.abs(value - down)) * 1.9, 0, 1);
    const centerX = dimensions.width > 1 ? Math.abs((column / (dimensions.width - 1)) - 0.5) * 2 : 0;
    const centerY = dimensions.height > 1 ? Math.abs((row / (dimensions.height - 1)) - 0.5) * 2 : 0;
    const centerWeight = clamp(1 - Math.max(centerX, centerY), 0, 1);
    return clamp(Math.round(1 + edge * 7 + centerWeight * 0.7), 1, 9);
  });

  return { version: 1, width: dimensions.width, height: dimensions.height, colors, depths };
}

export default function PhotoVoxelViewer({ imageUrl = '', sourceImageUrl = '', recipe = null, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const supplied = normalizeRecipe(recipe);
    const samplingUrl = sourceImageUrl || imageUrl;
    if (!supplied && !samplingUrl) return undefined;

    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    reportedRef.current = '';

    const renderRecipe = (activeRecipe) => {
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.4));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .35s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x191020, 2.25));
        const key = new THREE.DirectionalLight(0xffead3, 3.8);
        key.position.set(5, 7, 8);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xc6b5ff, 1.8);
        rim.position.set(-5, 2, -3);
        scene.add(rim);

        const cell = compact ? 0.255 : 0.27;
        const facadeWidth = activeRecipe.width * cell;
        const facadeHeight = activeRecipe.height * cell;
        const maxDimension = Math.max(facadeWidth, facadeHeight);
        const camera = new THREE.PerspectiveCamera(35, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = clamp(maxDimension * 1.55 + 1.9, 7.2, 13.8);
        camera.position.set(0, 0.05, cameraDistance);
        camera.lookAt(0, 0, 0.18);

        const root = new THREE.Group();
        root.rotation.x = -0.04;
        root.rotation.y = 0.08;
        scene.add(root);

        const geometry = new THREE.BoxGeometry(cell * 0.94, cell * 0.94, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.01 });
        const mesh = new THREE.InstancedMesh(geometry, material, activeRecipe.width * activeRecipe.height);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        for (let row = 0; row < activeRecipe.height; row += 1) {
          for (let column = 0; column < activeRecipe.width; column += 1) {
            const index = row * activeRecipe.width + column;
            const depth = 0.08 + (activeRecipe.depths[index] / 9) * 0.74;
            dummy.position.set(
              (column - (activeRecipe.width - 1) / 2) * cell,
              ((activeRecipe.height - 1) / 2 - row) * cell,
              depth / 2,
            );
            dummy.scale.set(1, 1, depth);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
            color.set(`#${activeRecipe.colors[index]}`);
            mesh.setColorAt(index, color);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);

        const backingGeometry = new THREE.BoxGeometry(facadeWidth + 0.08, facadeHeight + 0.08, 0.08);
        const backingMaterial = new THREE.MeshStandardMaterial({ color: 0x21172c, roughness: 0.94, metalness: 0 });
        const backing = new THREE.Mesh(backingGeometry, backingMaterial);
        backing.position.z = -0.08;
        root.add(backing);

        const shadowGeometry = new THREE.CircleGeometry(Math.max(2.4, facadeWidth * 0.58), 48);
        const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x130d18, transparent: true, opacity: 0.24 });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, -facadeHeight / 2 - 0.24, 0.8);
        scene.add(shadow);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.04;
        let targetY = 0.08;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.05, cameraDistance);
          camera.lookAt(0, 0, 0.18);
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
            if (pinch) cameraDistance = clamp(cameraDistance - (next - pinch) * 0.012, 5.8, 15.5);
            pinch = next;
            updateCamera();
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          targetY += dx * 0.008;
          targetX = clamp(targetX + dy * 0.004, -0.5, 0.34);
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
          cameraDistance = clamp(cameraDistance + Math.sign(event.deltaY) * 0.45, 5.8, 15.5);
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
          root.rotation.x += (targetX - root.rotation.x) * 0.08;
          root.rotation.y += (targetY - root.rotation.y) * 0.08;
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            const signature = `${activeRecipe.width}x${activeRecipe.height}:${activeRecipe.colors.slice(0, 6).join('')}`;
            if (reportedRef.current !== signature) {
              reportedRef.current = signature;
              callbackRef.current?.(activeRecipe);
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
          backingGeometry.dispose();
          backingMaterial.dispose();
          shadowGeometry.dispose();
          shadowMaterial.dispose();
          renderer.dispose();
          mount.innerHTML = '';
        };
      }).catch(() => {
        if (!dead) setError('Interactive 3D could not start. The VoxelPop image remains visible.');
      });
    };

    if (supplied) {
      renderRecipe(supplied);
    } else {
      const image = new Image();
      image.decoding = 'async';
      image.src = samplingUrl;
      image.onload = () => {
        try { renderRecipe(sampleRecipe(image)); }
        catch (sampleError) { if (!dead) setError(String(sampleError?.message || sampleError || 'Local voxel sampling failed.')); }
      };
      image.onerror = () => { if (!dead) setError('The property photo could not be opened for local 3D.'); };
    }

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl, sourceImageUrl, recipe]);

  const posterUrl = imageUrl || sourceImageUrl;
  return <div className="photoVoxelShell">
    {posterUrl ? <img className={`photoVoxelPoster ${ready ? 'hidden' : ''}`} src={posterUrl} alt="VoxelPop property image"/> : null}
    <div ref={mountRef} className="photoVoxelCanvas" aria-label="Interactive photo-derived VoxelPop 3D model"/>
    {!ready && !error ? <div className="stage">PHOTO → BUILDING LOCAL 3D</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? 'PHOTO-BASED 3D · DRAG · PINCH TO ZOOM' : 'YOUR PHOTO STAYS VISIBLE UNTIL 3D IS READY'}</div>
    <style jsx>{`
      .photoVoxelShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 32%,#3a2850,#18101f 64%)}
      .photoVoxelPoster,.photoVoxelCanvas{position:absolute;inset:0;width:100%;height:100%}.photoVoxelPoster{z-index:1;object-fit:contain;background:#18101f;opacity:1;transition:opacity .35s ease}.photoVoxelPoster.hidden{opacity:0;pointer-events:none}.photoVoxelCanvas{z-index:2}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.78);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:36px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.84);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#d8cedf;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.12em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
