'use client';

import { useEffect, useRef, useState } from 'react';

// Keep the prior 24-cell baseline visible for regression context, but use a
// 32-cell long side for the current proportion-preserving renderer.
const GRID = 24;
const MAX_GRID = GRID + 8;
const MIN_GRID = 12;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / 16) * 16));
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

function recipeDimensions(image) {
  const sourceWidth = Math.max(1, image.naturalWidth || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || 1);
  const ratio = clamp(sourceWidth / sourceHeight, MIN_GRID / MAX_GRID, MAX_GRID / MIN_GRID);
  if (ratio >= 1) return { width: MAX_GRID, height: Math.max(MIN_GRID, Math.round(MAX_GRID / ratio)) };
  return { width: Math.max(MIN_GRID, Math.round(MAX_GRID * ratio)), height: MAX_GRID };
}

function centeredMass(rawMask, width, height) {
  const mask = new Array(width * height).fill(false);
  const centerColumn = (width - 1) / 2;
  for (let row = 0; row < height; row += 1) {
    const candidates = [];
    for (let column = 0; column < width; column += 1) {
      if (rawMask[row * width + column]) candidates.push(column);
    }
    if (!candidates.length) continue;
    let nearest = candidates[0];
    for (const candidate of candidates) {
      if (Math.abs(candidate - centerColumn) < Math.abs(nearest - centerColumn)) nearest = candidate;
    }
    let left = nearest;
    let right = nearest;
    while (left > 0 && (rawMask[row * width + (left - 1)] || rawMask[row * width + Math.max(0, left - 2)])) left -= 1;
    while (right < width - 1 && (rawMask[row * width + (right + 1)] || rawMask[row * width + Math.min(width - 1, right + 2)])) right += 1;
    for (let column = left; column <= right; column += 1) {
      if (rawMask[row * width + column] || (column > left && column < right)) mask[row * width + column] = true;
    }
  }
  return mask;
}

function sampleRecipe(image) {
  const { width, height } = recipeDimensions(image);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  // Preserve the complete uploaded frame. Wide houses stay wide; portrait photos
  // stay portrait. The renderer never center-crops the building into a square.
  context.filter = 'saturate(1.04) contrast(1.05)';
  context.drawImage(image, 0, 0, image.naturalWidth || 1, image.naturalHeight || 1, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const rgb = [];
  const luminance = [];
  const colors = [];

  for (let index = 0; index < width * height; index += 1) {
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
  const topRows = Math.max(2, Math.round(height * 0.16));
  const bottomRows = Math.max(2, Math.round(height * 0.14));
  const edgeColumns = Math.max(2, Math.round(width * 0.07));
  for (let row = 0; row < topRows; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row < 2 || column < edgeColumns || column >= width - edgeColumns) skySamples.push(rgb[row * width + column]);
    }
  }
  for (let row = height - bottomRows; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row > height - 3 || column < edgeColumns + 1 || column >= width - edgeColumns - 1) groundSamples.push(rgb[row * width + column]);
    }
  }
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);

  const edgeStrength = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    const left = luminance[row * width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * width + Math.min(width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * width + column] ?? value;
    const down = luminance[Math.min(height - 1, row + 1) * width + column] ?? value;
    return clamp(Math.abs(left - right) * 1.72 + Math.abs(up - down) * 1.72);
  });

  const rawMask = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      const x = width > 1 ? column / (width - 1) : 0.5;
      const y = height > 1 ? row / (height - 1) : 0.5;
      const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edgeStrength[index];
      const outsideSide = x < 0.03 || x > 0.97;
      const obviousSky = y < 0.42 && skyDistance < (0.102 + edge * 0.10);
      const obviousGround = y > 0.80 && groundDistance < (0.092 + edge * 0.11);
      const structuralEvidence = skyDistance * 0.44 + groundDistance * 0.12 + edge * 0.35 + center * 0.09;
      const centralFacade = y > 0.21 && y < 0.89 && center > 0.15 && skyDistance > 0.065;
      rawMask[index] = !outsideSide && !obviousSky && !obviousGround && y > 0.04 && y < 0.97 && (structuralEvidence > 0.218 || centralFacade);
    }
  }

  let mask = centeredMass(rawMask, width, height);
  let activeCount = mask.filter(Boolean).length;

  // Difficult light can make a real facade resemble sky or lawn. Relax only
  // toward edges/colors that still exist in the uploaded photo. Never invent a
  // generic roof/body silhouette that was not present in the source.
  if (activeCount < width * height * 0.12) {
    const relaxed = new Array(width * height).fill(false);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        const x = width > 1 ? column / (width - 1) : 0.5;
        const y = height > 1 ? row / (height - 1) : 0.5;
        const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
        const skyDistance = rgbDistance(rgb[index], sky);
        const groundDistance = rgbDistance(rgb[index], ground);
        const edge = edgeStrength[index];
        relaxed[index] = x > 0.04 && x < 0.96 && y > 0.07 && y < 0.95 && center > 0.07 && (
          skyDistance > 0.072 || groundDistance > 0.085 || edge > 0.085
        );
      }
    }
    mask = centeredMass(relaxed, width, height);
    activeCount = mask.filter(Boolean).length;
  }

  if (activeCount < Math.max(16, Math.round(width * height * 0.055))) {
    throw new Error('VoxelPop could not isolate enough of the uploaded building to make a trustworthy voxel. Try a clearer front or three-quarter photo.');
  }

  const depths = luminance.map((value, index) => {
    if (!mask[index]) return 0;
    const edge = edgeStrength[index];
    const facadeRelief = Math.round(3 + value * 2.1 + edge * 3.4);
    return Math.max(2, Math.min(9, facadeRelief));
  });

  return { version: 1, width, height, colors, depths };
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
          setError('Interactive 3D is unavailable here. Your approved house photo remains visible.');
          return;
        }

        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.12 : 1.4));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .34s ease';
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

        const cell = 7.0 / Math.max(recipe.width, recipe.height);
        const facadeWidth = recipe.width * cell;
        const facadeHeight = recipe.height * cell;
        const maxDimension = Math.max(facadeWidth, facadeHeight);
        const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = clamp(maxDimension * (compact ? 1.72 : 1.58) + 0.45, 7.2, 13.0);
        const minDistance = maxDimension * 1.05;
        const maxDistance = maxDimension * 2.15;
        camera.position.set(0, 0.1, cameraDistance);
        camera.lookAt(0, -0.08, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.07;
        root.rotation.y = 0.10;
        scene.add(root);

        const active = recipe.depths.reduce((count, depth) => count + (depth > 0 ? 1 : 0), 0);
        const geometry = new THREE.BoxGeometry(cell * 0.90, cell * 0.90, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.012 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, active));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        let instance = 0;

        for (let row = 0; row < recipe.height; row += 1) {
          for (let column = 0; column < recipe.width; column += 1) {
            const index = row * recipe.width + column;
            if (recipe.depths[index] <= 0) continue;
            const depth = 0.44 + (recipe.depths[index] / 9) * 0.92;
            dummy.position.set(
              (column - (recipe.width - 1) / 2) * cell,
              ((recipe.height - 1) / 2 - row) * cell,
              depth / 2 - 0.46,
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

        const baseRadius = Math.max(2.15, facadeWidth * 0.52);
        const baseGeometry = new THREE.CylinderGeometry(baseRadius, baseRadius + 0.22, 0.20, 36);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.94, metalness: 0 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -facadeHeight / 2 - 0.30, -0.12);
        scene.add(base);

        const ringGeometry = new THREE.TorusGeometry(baseRadius * 0.82, 0.05, 10, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.88 });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -facadeHeight / 2 - 0.20, -0.08);
        scene.add(ring);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.07;
        let targetY = 0.10;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.1, cameraDistance);
          camera.lookAt(0, -0.08, 0);
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
            if (pinch) cameraDistance = clamp(cameraDistance - (next - pinch) * 0.012, minDistance, maxDistance);
            pinch = next;
            updateCamera();
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          targetY += dx * 0.0072;
          targetX = clamp(targetX + dy * 0.0038, -0.46, 0.30);
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
          cameraDistance = clamp(cameraDistance + Math.sign(event.deltaY) * 0.40, minDistance, maxDistance);
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
          if (!reducedMotion) ring.rotation.z += 0.001;
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
        if (!dead) setError('Interactive 3D could not start. Your approved house photo remains visible.');
      });
    };
    image.onerror = () => {
      if (!dead) setError('The approved property photo could not be opened for local voxel creation.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl, sourceImageUrl]);

  return <div className="localViewerShell">
    {imageUrl ? <img className={`localPoster ${ready ? 'hidden' : ''}`} src={imageUrl} alt="Approved VoxelPop house preview"/> : null}
    <div ref={mountRef} className="localCanvas" aria-label="Interactive photo-shaped VoxelPop house voxel"/>
    {!ready && !error ? <div className="stage">MATCHING YOUR HOUSE · LOCAL VOXEL</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? 'DRAG BUILDING · PINCH TO ZOOM' : 'USING THE UPLOADED HOUSE SHAPE · NO GENERIC BUILDING'}</div>
    <style jsx>{`
      .localViewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 34%,#4a3561 0,#25182f 55%,#17101c 100%)}
      .localPoster,.localCanvas{position:absolute;inset:0;width:100%;height:100%}.localPoster{z-index:1;object-fit:contain;background:#20172a;opacity:1;transition:opacity .34s ease}.localPoster.hidden{opacity:0;pointer-events:none}.localCanvas{z-index:2}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.8);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:36px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.88);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#e6deeb;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.11em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
