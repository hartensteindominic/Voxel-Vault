'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_SIDE = 24;
const MIN_SIDE = 12;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / 12) * 12));
}

function hex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function rgbDistance(a, b) {
  const dr = Number(a?.[0] || 0) - Number(b?.[0] || 0);
  const dg = Number(a?.[1] || 0) - Number(b?.[1] || 0);
  const db = Number(a?.[2] || 0) - Number(b?.[2] || 0);
  return Math.hypot(dr, dg, db) / 441.673;
}

function averageRgb(samples) {
  if (!samples.length) return [128, 128, 128];
  const total = samples.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]);
  return total.map((value) => value / samples.length);
}

function gridForImage(image) {
  const aspect = clamp((image.naturalWidth || 1) / (image.naturalHeight || 1), 0.5, 2);
  if (aspect >= 1) return { width: MAX_SIDE, height: Math.max(MIN_SIDE, Math.round(MAX_SIDE / aspect)) };
  return { width: Math.max(MIN_SIDE, Math.round(MAX_SIDE * aspect)), height: MAX_SIDE };
}

function sampleRecipe(image) {
  const { width, height } = gridForImage(image);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  context.filter = 'saturate(1.03) contrast(1.04)';
  context.drawImage(image, 0, 0, width, height);
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
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
    colors.push(`${hex(red)}${hex(green)}${hex(blue)}`);
  }

  const skySamples = [];
  const groundSamples = [];
  const topRows = Math.max(2, Math.round(height * 0.14));
  const bottomRows = Math.max(2, Math.round(height * 0.14));
  for (let row = 0; row < topRows; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (column < width * 0.28 || column > width * 0.72 || row === 0) skySamples.push(rgb[row * width + column]);
    }
  }
  for (let row = height - bottomRows; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (column < width * 0.3 || column > width * 0.7 || row === height - 1) groundSamples.push(rgb[row * width + column]);
    }
  }
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);

  const edges = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    const left = luminance[row * width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * width + Math.min(width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * width + column] ?? value;
    const down = luminance[Math.min(height - 1, row + 1) * width + column] ?? value;
    return clamp(Math.abs(left - right) * 1.55 + Math.abs(up - down) * 1.55);
  });

  const raw = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      const x = width === 1 ? 0.5 : column / (width - 1);
      const y = height === 1 ? 0.5 : row / (height - 1);
      const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edges[index];
      const nearSide = x < 0.035 || x > 0.965;
      const likelySky = y < 0.48 && skyDistance < 0.115 + edge * 0.13;
      const likelyGround = y > 0.73 && groundDistance < 0.105 + edge * 0.12;
      const facadeEvidence = skyDistance * 0.5 + edge * 0.34 + center * 0.16;
      const centralBody = y > 0.25 && y < 0.9 && center > 0.2 && skyDistance > 0.07;
      raw[index] = !nearSide && !likelySky && !likelyGround && y > 0.045 && y < 0.96 && (facadeEvidence > 0.23 || centralBody);
    }
  }

  const mask = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    const candidates = [];
    for (let column = 0; column < width; column += 1) {
      if (raw[row * width + column]) candidates.push(column);
    }
    if (!candidates.length) continue;

    const centerColumn = (width - 1) / 2;
    let anchor = candidates[0];
    for (const candidate of candidates) {
      if (Math.abs(candidate - centerColumn) < Math.abs(anchor - centerColumn)) anchor = candidate;
    }

    let left = anchor;
    let right = anchor;
    while (left > 0 && (raw[row * width + left - 1] || raw[row * width + Math.max(0, left - 2)])) left -= 1;
    while (right < width - 1 && (raw[row * width + right + 1] || raw[row * width + Math.min(width - 1, right + 2)])) right += 1;

    const minimumBody = Math.max(3, Math.round(width * 0.2));
    if (right - left < minimumBody && row > Math.round(height * 0.32)) {
      left = Math.max(1, anchor - Math.ceil(minimumBody / 2));
      right = Math.min(width - 2, anchor + Math.ceil(minimumBody / 2));
    }

    for (let column = left; column <= right; column += 1) {
      const index = row * width + column;
      if (raw[index] || (column > left && column < right && row > height * 0.28)) mask[index] = true;
    }
  }

  let activeCount = mask.filter(Boolean).length;
  if (activeCount < width * height * 0.16) {
    mask.fill(false);
    const center = Math.round((width - 1) / 2);
    for (let row = Math.round(height * 0.2); row < Math.round(height * 0.88); row += 1) {
      const roof = row < height * 0.43;
      const progress = clamp((row - height * 0.2) / Math.max(1, height * 0.23));
      const halfWidth = roof ? Math.round(2 + progress * width * 0.31) : Math.round(width * 0.34);
      for (let column = Math.max(1, center - halfWidth); column <= Math.min(width - 2, center + halfWidth); column += 1) {
        mask[row * width + column] = true;
      }
    }
    activeCount = mask.filter(Boolean).length;
  }

  const depths = luminance.map((value, index) => {
    if (!mask[index]) return 0;
    const edge = edges[index];
    return Math.max(3, Math.min(9, Math.round(4 + value * 1.8 + edge * 2.6)));
  });

  return { version: 1, width, height, colors, depths };
}

export default function LocalVoxelModelViewer({ imageUrl, sourceImageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [showSource, setShowSource] = useState(false);
  callbackRef.current = onReady;

  useEffect(() => {
    const sampleUrl = sourceImageUrl || imageUrl;
    if (!sampleUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    setShowSource(false);

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
          setError('Interactive 3D is unavailable here. Your source photo is still available for comparison.');
          setReady(true);
          callbackRef.current?.(recipe);
          return;
        }

        const width = Math.max(280, mount.clientWidth || 360);
        const height = Math.max(280, mount.clientHeight || 360);
        const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.4));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.6));
        const key = new THREE.DirectionalLight(0xffedd5, 4.1);
        key.position.set(5, 8, 7);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xc5b4ff, 1.9);
        rim.position.set(-5, 3, -4);
        scene.add(rim);

        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 80);
        let cameraDistance = compact ? 10.8 : 10.2;
        camera.position.set(0, 0.05, cameraDistance);
        camera.lookAt(0, -0.15, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.055;
        root.rotation.y = 0.08;
        scene.add(root);

        const active = recipe.depths.reduce((count, depth) => count + (depth > 0 ? 1 : 0), 0);
        const cell = 0.285;
        const geometry = new THREE.BoxGeometry(0.255, 0.255, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.01 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, active));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        let instance = 0;

        for (let row = 0; row < recipe.height; row += 1) {
          for (let column = 0; column < recipe.width; column += 1) {
            const index = row * recipe.width + column;
            if (recipe.depths[index] <= 0) continue;
            const depth = 0.58 + (recipe.depths[index] / 9) * 0.78;
            dummy.position.set(
              (column - (recipe.width - 1) / 2) * cell,
              ((recipe.height - 1) / 2 - row) * cell - 0.15,
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

        const bodyWidth = Math.max(3.2, recipe.width * cell * 0.55);
        const baseGeometry = new THREE.CylinderGeometry(bodyWidth, bodyWidth + 0.25, 0.2, 36);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.94, metalness: 0 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -recipe.height * cell * 0.54, -0.12);
        scene.add(base);

        const ringGeometry = new THREE.TorusGeometry(bodyWidth * 0.82, 0.052, 10, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, base.position.y + 0.11, -0.08);
        scene.add(ring);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.055;
        let targetY = 0.08;

        const pointerDistance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          if (pair.length < 2) return 0;
          return Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        };
        const updateCamera = () => {
          camera.position.set(0, 0.05, cameraDistance);
          camera.lookAt(0, -0.15, 0);
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          pinch = pointerDistance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = pointerDistance();
            if (pinch > 0 && next > 0) {
              cameraDistance = clamp(cameraDistance - (next - pinch) * 0.012, 7.1, 14.5);
              updateCamera();
            }
            pinch = next;
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          targetY += dx * 0.007;
          targetX = clamp(targetX + dy * 0.004, -0.42, 0.35);
        };
        const up = (event) => {
          pointers.delete(event.pointerId);
          pinch = pointerDistance();
          renderer.domElement.releasePointerCapture?.(event.pointerId);
        };
        const wheel = (event) => {
          event.preventDefault();
          cameraDistance = clamp(cameraDistance + event.deltaY * 0.005, 7.1, 14.5);
          updateCamera();
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });

        let frame = 0;
        const animate = () => {
          if (dead) return;
          root.rotation.x += (targetX - root.rotation.x) * 0.13;
          root.rotation.y += (targetY - root.rotation.y) * 0.13;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        animate();

        const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
          if (dead || !mountRef.current) return;
          const nextWidth = Math.max(280, mountRef.current.clientWidth || width);
          const nextHeight = Math.max(280, mountRef.current.clientHeight || height);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight);
        }) : null;
        resize?.observe(mount);

        setReady(true);
        callbackRef.current?.(recipe);

        cleanup = () => {
          cancelAnimationFrame(frame);
          resize?.disconnect();
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
          if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
      }).catch(() => {
        if (!dead) {
          setError('Interactive 3D could not start. The source photo is still available for comparison.');
          setReady(true);
          callbackRef.current?.(recipe);
        }
      });
    };

    image.onerror = () => {
      if (!dead) setError('The property photo could not be opened for voxel creation.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl, sourceImageUrl]);

  return <div className="viewerShell">
    <div ref={mountRef} className="viewerMount" aria-label="Interactive VoxelPop 3D model"/>
    {showSource && (sourceImageUrl || imageUrl) ? <div className="sourceOverlay"><img src={sourceImageUrl || imageUrl} alt="Original property source"/></div> : null}
    <div className="viewerTools">
      <button type="button" className={!showSource ? 'active' : ''} onClick={() => setShowSource(false)}>VOXEL</button>
      <button type="button" className={showSource ? 'active' : ''} onClick={() => setShowSource(true)}>SOURCE</button>
    </div>
    <div className="viewerHelp">
      <b>{ready ? 'DRAG TO ROTATE · PINCH TO ZOOM' : 'BUILDING VOXEL…'}</b>
      <span>{error || 'Same source photo, preserved at its original aspect instead of square-cropping the house.'}</span>
    </div>
    <style jsx>{`
      .viewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#4b3562 0,#22172c 50%,#141019 100%)}
      .viewerMount{position:absolute;inset:0}.sourceOverlay{position:absolute;inset:0;z-index:2;background:#17111d}.sourceOverlay img{width:100%;height:100%;object-fit:contain;display:block}
      .viewerTools{position:absolute;z-index:4;top:14px;right:14px;display:flex;gap:6px;padding:5px;border-radius:999px;background:rgba(18,12,23,.72);backdrop-filter:blur(10px)}
      .viewerTools button{min-height:36px;border:0;border-radius:999px;padding:0 11px;background:transparent;color:#d8cedf;font:900 8px inherit;letter-spacing:.08em}.viewerTools button.active{background:#c9ff54;color:#2d3b15}
      .viewerHelp{position:absolute;z-index:4;left:14px;right:14px;bottom:14px;padding:10px 12px;border-radius:16px;background:rgba(20,13,26,.72);color:#fff;backdrop-filter:blur(12px);display:grid;gap:2px;text-align:left;pointer-events:none}
      .viewerHelp b{font-size:9px;letter-spacing:.09em}.viewerHelp span{font-size:9px;line-height:1.35;color:#ddd2e5}
    `}</style>
  </div>;
}
