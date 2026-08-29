'use client';

import { useEffect, useRef, useState } from 'react';

const GRID = 24;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / 18) * 18));
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rgbDistance(a, b) {
  const dr = Number(a?.[0] || 0) - Number(b?.[0] || 0);
  const dg = Number(a?.[1] || 0) - Number(b?.[1] || 0);
  const db = Number(a?.[2] || 0) - Number(b?.[2] || 0);
  return Math.hypot(dr, dg, db) / 441.673;
}

function averageRgb(pixels) {
  if (!pixels.length) return [128, 128, 128];
  const total = pixels.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]);
  return total.map((value) => value / pixels.length);
}

function sampleRecipe(image) {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  const sourceRatio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth || 1;
  let sh = image.naturalHeight || 1;
  if (sourceRatio > 1) {
    sw = sh;
    sx = ((image.naturalWidth || 1) - sw) / 2;
  } else if (sourceRatio < 1) {
    sh = sw;
    sy = ((image.naturalHeight || 1) - sh) / 2;
  }
  context.filter = 'saturate(1.04) contrast(1.05)';
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

  const skySamples = [];
  const groundSamples = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      if (column < 2 || column > GRID - 3 || row < 2) skySamples.push(rgb[row * GRID + column]);
    }
  }
  for (let row = GRID - 3; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      if (column < 5 || column > GRID - 6 || row > GRID - 2) groundSamples.push(rgb[row * GRID + column]);
    }
  }
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);

  const edgeStrength = luminance.map((value, index) => {
    const row = Math.floor(index / GRID);
    const column = index % GRID;
    const left = luminance[row * GRID + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * GRID + Math.min(GRID - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * GRID + column] ?? value;
    const down = luminance[Math.min(GRID - 1, row + 1) * GRID + column] ?? value;
    return clamp(Math.abs(left - right) * 1.8 + Math.abs(up - down) * 1.8);
  });

  const rawMask = new Array(GRID * GRID).fill(false);
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const index = row * GRID + column;
      const x = column / (GRID - 1);
      const y = row / (GRID - 1);
      const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edgeStrength[index];

      const outsideSide = x < 0.055 || x > 0.945;
      const obviousSky = y < 0.34 && skyDistance < (0.11 + edge * 0.15);
      const obviousGround = y > 0.82 && groundDistance < (0.10 + edge * 0.13);
      const buildingEvidence = skyDistance * 0.48 + edge * 0.36 + center * 0.16;
      const centralLowerBody = y > 0.34 && y < 0.83 && center > 0.22 && skyDistance > 0.08;
      rawMask[index] = !outsideSide && !obviousSky && !obviousGround && y > 0.07 && y < 0.94 && (buildingEvidence > 0.245 || centralLowerBody);
    }
  }

  // Keep the central connected-looking mass and close tiny holes. This is intentionally
  // conservative: a single photo can describe the visible facade, not unseen geometry.
  const mask = new Array(GRID * GRID).fill(false);
  for (let row = 0; row < GRID; row += 1) {
    const candidates = [];
    for (let column = 0; column < GRID; column += 1) {
      if (rawMask[row * GRID + column]) candidates.push(column);
    }
    if (!candidates.length) continue;
    const centerColumn = (GRID - 1) / 2;
    let nearest = candidates[0];
    for (const candidate of candidates) {
      if (Math.abs(candidate - centerColumn) < Math.abs(nearest - centerColumn)) nearest = candidate;
    }
    let left = nearest;
    let right = nearest;
    while (left > 0 && (rawMask[row * GRID + (left - 1)] || rawMask[row * GRID + Math.max(0, left - 2)])) left -= 1;
    while (right < GRID - 1 && (rawMask[row * GRID + (right + 1)] || rawMask[row * GRID + Math.min(GRID - 1, right + 2)])) right += 1;
    if (right - left < 4 && row > Math.round(GRID * 0.35)) {
      left = Math.max(2, nearest - 3);
      right = Math.min(GRID - 3, nearest + 3);
    }
    for (let column = left; column <= right; column += 1) {
      if (rawMask[row * GRID + column] || (column > left && column < right)) mask[row * GRID + column] = true;
    }
  }

  let activeCount = mask.filter(Boolean).length;
  if (activeCount < GRID * GRID * 0.18) {
    // Fallback to a simple house-like silhouette instead of ever returning the old square slab.
    mask.fill(false);
    for (let row = Math.round(GRID * 0.22); row < Math.round(GRID * 0.86); row += 1) {
      const roof = row < GRID * 0.43;
      const progress = clamp((row - GRID * 0.22) / (GRID * 0.21));
      const halfWidth = roof ? Math.round(2 + progress * GRID * 0.30) : Math.round(GRID * 0.34);
      const center = Math.round((GRID - 1) / 2);
      for (let column = Math.max(1, center - halfWidth); column <= Math.min(GRID - 2, center + halfWidth); column += 1) {
        mask[row * GRID + column] = true;
      }
    }
    activeCount = mask.filter(Boolean).length;
  }

  const depths = luminance.map((value, index) => {
    if (!mask[index]) return 0;
    const edge = edgeStrength[index];
    const facadeRelief = Math.round(4 + value * 2 + edge * 2);
    return Math.max(3, Math.min(8, facadeRelief));
  });

  return { version: 1, width: GRID, height: GRID, colors, depths };
}

export default function LocalVoxelModelViewer({ imageUrl, sourceImageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    const sampleUrl = sourceImageUrl || imageUrl;
    if (!sampleUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    reportedRef.current = '';

    const image = new Image();
    image.decoding = 'async';
    image.src = sampleUrl;

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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.12 : 1.38));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .36s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.6));
        const key = new THREE.DirectionalLight(0xffedd5, 4.0);
        key.position.set(5, 8, 7);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xc5b4ff, 2.0);
        rim.position.set(-5, 3, -4);
        scene.add(rim);

        const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = compact ? 11.3 : 10.6;
        camera.position.set(0, 0.15, cameraDistance);
        camera.lookAt(0, -0.2, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.08;
        root.rotation.y = 0.10;
        scene.add(root);

        const active = recipe.depths.reduce((count, depth) => count + (depth > 0 ? 1 : 0), 0);
        const geometry = new THREE.BoxGeometry(0.255, 0.255, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.015 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, active));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const cell = 0.285;
        let instance = 0;

        for (let row = 0; row < recipe.height; row += 1) {
          for (let column = 0; column < recipe.width; column += 1) {
            const index = row * recipe.width + column;
            if (recipe.depths[index] <= 0) continue;
            const depth = 0.58 + (recipe.depths[index] / 9) * 0.78;
            dummy.position.set(
              (column - (recipe.width - 1) / 2) * cell,
              ((recipe.height - 1) / 2 - row) * cell - 0.18,
              depth / 2 - 0.58,
            );
            dummy.scale.set(1, 1, depth);
            dummy.updateMatrix();
            mesh.setMatrixAt(instance, dummy.matrix);
            color.set(`#${recipe.colors[index]}`);
            mesh.setColorAt(instance, color);
            instance += 1;
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);

        const baseGeometry = new THREE.CylinderGeometry(3.2, 3.45, 0.22, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.94, metalness: 0 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -3.42, -0.12);
        scene.add(base);

        const ringGeometry = new THREE.TorusGeometry(2.65, 0.055, 10, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.88 });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -3.29, -0.08);
        scene.add(ring);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.08;
        let targetY = 0.10;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.15, cameraDistance);
          camera.lookAt(0, -0.2, 0);
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
            if (pinch) cameraDistance = Math.max(8.1, Math.min(14.2, cameraDistance - (next - pinch) * 0.012));
            pinch = next;
            updateCamera();
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          targetY += dx * 0.0075;
          targetX = Math.max(-0.50, Math.min(0.34, targetX + dy * 0.004));
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
          cameraDistance = Math.max(8.1, Math.min(14.2, cameraDistance + Math.sign(event.deltaY) * 0.42));
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
          if (!reducedMotion) ring.rotation.z += 0.0012;
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            const activeCount = recipe.depths.filter((depth) => depth > 0).length;
            const signature = `${recipe.width}x${recipe.height}:${activeCount}:${recipe.colors.slice(0, 4).join('')}`;
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
          baseGeometry.dispose();
          baseMaterial.dispose();
          ringGeometry.dispose();
          ringMaterial.dispose();
          renderer.dispose();
          mount.innerHTML = '';
        };
      }).catch(() => {
        if (!dead) setError('Interactive 3D could not start. The VoxelPop image remains visible.');
      });
    };
    image.onerror = () => {
      if (!dead) setError('The property photo could not be opened for local 3D.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl, sourceImageUrl]);

  return <div className="localViewerShell">
    {imageUrl ? <img className={`localPoster ${ready ? 'hidden' : ''}`} src={imageUrl} alt="VoxelPop rendered building preview"/> : null}
    <div ref={mountRef} className="localCanvas" aria-label="Interactive photo-matched VoxelPop building"/>
    {!ready && !error ? <div className="stage">MATCHING BUILDING · LOCAL 3D</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? 'DRAG BUILDING · PINCH TO ZOOM' : 'PHOTO → BUILDING-SHAPED VOXEL'}</div>
    <style jsx>{`
      .localViewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 34%,#4a3561 0,#25182f 55%,#17101c 100%)}
      .localPoster,.localCanvas{position:absolute;inset:0;width:100%;height:100%}.localPoster{z-index:1;object-fit:cover;opacity:1;transition:opacity .36s ease}.localPoster.hidden{opacity:0;pointer-events:none}.localCanvas{z-index:2}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.8);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:36px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.86);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#e6deeb;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.12em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
