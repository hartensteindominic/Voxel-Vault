'use client';

import { useEffect, useRef, useState } from 'react';

const GRID_WIDTH = 32;
const GRID_HEIGHT = 24;

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
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  // Preserve the entire source frame. Wide houses and porches should not be
  // chopped into a square or forced through a center crop before voxelization.
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;
  const scale = Math.min(GRID_WIDTH / naturalWidth, GRID_HEIGHT / naturalHeight);
  const drawWidth = Math.max(1, naturalWidth * scale);
  const drawHeight = Math.max(1, naturalHeight * scale);
  const dx = (GRID_WIDTH - drawWidth) / 2;
  const dy = (GRID_HEIGHT - drawHeight) / 2;
  context.clearRect(0, 0, GRID_WIDTH, GRID_HEIGHT);
  context.filter = 'saturate(1.04) contrast(1.05)';
  context.drawImage(image, 0, 0, naturalWidth, naturalHeight, dx, dy, drawWidth, drawHeight);

  const data = context.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT).data;
  const rgb = [];
  const alpha = [];
  const luminance = [];
  const colors = [];

  for (let index = 0; index < GRID_WIDTH * GRID_HEIGHT; index += 1) {
    const offset = index * 4;
    const red = quantize(data[offset]);
    const green = quantize(data[offset + 1]);
    const blue = quantize(data[offset + 2]);
    rgb.push([red, green, blue]);
    alpha.push(data[offset + 3] / 255);
    colors.push(`${toHex(red)}${toHex(green)}${toHex(blue)}`);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
  }

  const skySamples = [];
  const groundSamples = [];
  for (let row = 0; row < GRID_HEIGHT; row += 1) {
    for (let column = 0; column < GRID_WIDTH; column += 1) {
      const index = row * GRID_WIDTH + column;
      if (alpha[index] < 0.45) continue;
      const photoX = clamp((column + 0.5 - dx) / Math.max(1, drawWidth));
      const photoY = clamp((row + 0.5 - dy) / Math.max(1, drawHeight));
      if (photoY < 0.17 && (photoX < 0.18 || photoX > 0.82 || photoY < 0.08)) skySamples.push(rgb[index]);
      if (photoY > 0.86 && (photoX < 0.24 || photoX > 0.76 || photoY > 0.94)) groundSamples.push(rgb[index]);
    }
  }
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);

  const edgeStrength = luminance.map((value, index) => {
    if (alpha[index] < 0.45) return 0;
    const row = Math.floor(index / GRID_WIDTH);
    const column = index % GRID_WIDTH;
    const leftIndex = row * GRID_WIDTH + Math.max(0, column - 1);
    const rightIndex = row * GRID_WIDTH + Math.min(GRID_WIDTH - 1, column + 1);
    const upIndex = Math.max(0, row - 1) * GRID_WIDTH + column;
    const downIndex = Math.min(GRID_HEIGHT - 1, row + 1) * GRID_WIDTH + column;
    const left = alpha[leftIndex] >= 0.45 ? luminance[leftIndex] : value;
    const right = alpha[rightIndex] >= 0.45 ? luminance[rightIndex] : value;
    const up = alpha[upIndex] >= 0.45 ? luminance[upIndex] : value;
    const down = alpha[downIndex] >= 0.45 ? luminance[downIndex] : value;
    return clamp(Math.abs(left - right) * 1.8 + Math.abs(up - down) * 1.8);
  });

  const rawMask = new Array(GRID_WIDTH * GRID_HEIGHT).fill(false);
  for (let row = 0; row < GRID_HEIGHT; row += 1) {
    for (let column = 0; column < GRID_WIDTH; column += 1) {
      const index = row * GRID_WIDTH + column;
      if (alpha[index] < 0.45) continue;
      const photoX = clamp((column + 0.5 - dx) / Math.max(1, drawWidth));
      const photoY = clamp((row + 0.5 - dy) / Math.max(1, drawHeight));
      const center = 1 - Math.min(1, Math.abs(photoX - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edgeStrength[index];

      const outsideSide = photoX < 0.025 || photoX > 0.975;
      const obviousSky = photoY < 0.34 && skySamples.length > 0 && skyDistance < (0.11 + edge * 0.15);
      const obviousGround = photoY > 0.84 && groundSamples.length > 0 && groundDistance < (0.10 + edge * 0.13);
      const buildingEvidence = skyDistance * 0.48 + edge * 0.36 + center * 0.16;
      const centralLowerBody = photoY > 0.34 && photoY < 0.84 && center > 0.16 && skyDistance > 0.07;
      rawMask[index] = !outsideSide && !obviousSky && !obviousGround && photoY > 0.04 && photoY < 0.97 && (buildingEvidence > 0.225 || centralLowerBody);
    }
  }

  // Keep a connected-looking central building mass and close small holes. One
  // photo still cannot prove unseen walls, roof planes or exact dimensions.
  const mask = new Array(GRID_WIDTH * GRID_HEIGHT).fill(false);
  for (let row = 0; row < GRID_HEIGHT; row += 1) {
    const candidates = [];
    for (let column = 0; column < GRID_WIDTH; column += 1) {
      if (rawMask[row * GRID_WIDTH + column]) candidates.push(column);
    }
    if (!candidates.length) continue;
    const centerColumn = (GRID_WIDTH - 1) / 2;
    let nearest = candidates[0];
    for (const candidate of candidates) {
      if (Math.abs(candidate - centerColumn) < Math.abs(nearest - centerColumn)) nearest = candidate;
    }
    let left = nearest;
    let right = nearest;
    while (left > 0 && (rawMask[row * GRID_WIDTH + (left - 1)] || rawMask[row * GRID_WIDTH + Math.max(0, left - 2)])) left -= 1;
    while (right < GRID_WIDTH - 1 && (rawMask[row * GRID_WIDTH + (right + 1)] || rawMask[row * GRID_WIDTH + Math.min(GRID_WIDTH - 1, right + 2)])) right += 1;
    if (right - left < 5 && row > Math.round(GRID_HEIGHT * 0.35)) {
      left = Math.max(2, nearest - 4);
      right = Math.min(GRID_WIDTH - 3, nearest + 4);
    }
    for (let column = left; column <= right; column += 1) {
      if (alpha[row * GRID_WIDTH + column] >= 0.45 && (rawMask[row * GRID_WIDTH + column] || (column > left && column < right))) {
        mask[row * GRID_WIDTH + column] = true;
      }
    }
  }

  let activeCount = mask.filter(Boolean).length;
  if (activeCount < GRID_WIDTH * GRID_HEIGHT * 0.16) {
    // Fallback remains a house silhouette but stays inside the actual visible
    // source-photo frame rather than recreating the old full-square slab.
    mask.fill(false);
    const minColumn = Math.max(1, Math.floor(dx));
    const maxColumn = Math.min(GRID_WIDTH - 2, Math.ceil(dx + drawWidth) - 1);
    const minRow = Math.max(1, Math.floor(dy));
    const maxRow = Math.min(GRID_HEIGHT - 2, Math.ceil(dy + drawHeight) - 1);
    const center = Math.round((minColumn + maxColumn) / 2);
    const availableHalf = Math.max(4, Math.floor((maxColumn - minColumn) * 0.38));
    const roofEnd = minRow + Math.max(4, Math.round((maxRow - minRow) * 0.34));
    for (let row = minRow + 1; row <= maxRow - 1; row += 1) {
      const roof = row < roofEnd;
      const progress = clamp((row - (minRow + 1)) / Math.max(1, roofEnd - minRow - 1));
      const halfWidth = roof ? Math.round(3 + progress * (availableHalf - 3)) : availableHalf;
      for (let column = Math.max(minColumn, center - halfWidth); column <= Math.min(maxColumn, center + halfWidth); column += 1) {
        if (alpha[row * GRID_WIDTH + column] >= 0.45) mask[row * GRID_WIDTH + column] = true;
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

  return { version: 2, width: GRID_WIDTH, height: GRID_HEIGHT, colors, depths };
}

export default function LocalVoxelModelViewer({ imageUrl, sourceImageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef('');
  const sampleUrl = sourceImageUrl || imageUrl || '';
  const previewUrl = imageUrl || sourceImageUrl || '';
  const [approvedUrl, setApprovedUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const buildRequested = Boolean(sampleUrl && approvedUrl === sampleUrl);
  callbackRef.current = onReady;

  useEffect(() => {
    if (approvedUrl !== sampleUrl) {
      setReady(false);
      setError('');
      reportedRef.current = '';
      if (mountRef.current) mountRef.current.innerHTML = '';
    }
  }, [approvedUrl, sampleUrl]);

  useEffect(() => {
    if (!buildRequested || !sampleUrl || !mountRef.current) return undefined;
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
          setError('Interactive 3D is unavailable here. Your approved 3D picture remains visible.');
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

        const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 90);
        let cameraDistance = compact ? 13.1 : 12.3;
        camera.position.set(0, 0.15, cameraDistance);
        camera.lookAt(0, -0.2, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.08;
        root.rotation.y = 0.10;
        scene.add(root);

        const active = recipe.depths.reduce((count, depth) => count + (depth > 0 ? 1 : 0), 0);
        const geometry = new THREE.BoxGeometry(0.235, 0.235, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.015 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, active));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const cell = 0.26;
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

        const baseGeometry = new THREE.CylinderGeometry(4.15, 4.4, 0.22, 36);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.94, metalness: 0 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -3.42, -0.12);
        scene.add(base);

        const ringGeometry = new THREE.TorusGeometry(3.35, 0.055, 10, 72);
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
            if (pinch) cameraDistance = Math.max(9.2, Math.min(16.0, cameraDistance - (next - pinch) * 0.012));
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
          cameraDistance = Math.max(9.2, Math.min(16.0, cameraDistance + Math.sign(event.deltaY) * 0.42));
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
        if (!dead) setError('Interactive 3D could not start. Your approved 3D picture remains visible.');
      });
    };
    image.onerror = () => {
      if (!dead) setError('The property photo could not be opened for local 3D.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [buildRequested, sampleUrl]);

  function buildVoxel() {
    if (!sampleUrl) return;
    setError('');
    setReady(false);
    setApprovedUrl(sampleUrl);
  }

  return <div className="localViewerShell">
    {previewUrl ? <div className={`previewStage ${buildRequested || ready ? 'building' : ''}`}>
      <div className="photoDepth"><img src={previewUrl} alt="Generated VoxelPop 3D picture review of your property"/></div>
      {!buildRequested ? <div className="reviewPanel">
        <b>3D PICTURE READY</b>
        <span>Check that this still looks like your house before VoxelPop turns it into blocks.</span>
        <button type="button" onClick={buildVoxel}>Create 3D Voxel from this picture</button>
      </div> : null}
    </div> : null}
    <div ref={mountRef} className="localCanvas" aria-label="Interactive photo-matched VoxelPop building"/>
    {!buildRequested && !error ? <div className="stage">STEP 3 · REVIEW 3D PICTURE</div> : null}
    {buildRequested && !ready && !error ? <div className="stage">STEP 4 · CREATING 3D VOXEL</div> : null}
    {ready ? <div className="stage readyStage">STEP 4 · 3D VOXEL READY</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    <div className="hint">{ready ? 'DRAG VOXEL · PINCH TO ZOOM · MINT COMES AFTER' : buildRequested ? 'APPROVED PICTURE → BUILDING-SHAPED VOXEL' : 'LOOK FIRST → THEN CREATE THE VOXEL'}</div>
    <style jsx>{`
      .localViewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 34%,#4a3561 0,#25182f 55%,#17101c 100%)}
      .localCanvas{position:absolute;inset:0;width:100%;height:100%;z-index:3}
      .previewStage{position:absolute;inset:0;z-index:4;display:grid;place-items:center;padding:42px 16px 86px;background:radial-gradient(circle at 50% 32%,#5d4775 0,#2b1c35 61%,#17101c 100%);transition:opacity .3s ease}.previewStage.building{opacity:0;pointer-events:none}
      .photoDepth{width:min(88%,640px);height:min(72%,430px);min-height:190px;border-radius:22px;overflow:hidden;background:#120c18;box-shadow:18px 18px 0 rgba(201,255,84,.15),0 24px 55px rgba(0,0,0,.35);transform:perspective(900px) rotateX(1.5deg) rotateY(-4deg)}
      .photoDepth img{display:block;width:100%;height:100%;object-fit:contain;background:#120c18;filter:saturate(1.04) contrast(1.03)}
      .reviewPanel{position:absolute;z-index:8;left:14px;right:14px;bottom:32px;margin:auto;max-width:650px;padding:12px;border-radius:17px;background:rgba(25,16,32,.91);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;color:#f8f4fb}.reviewPanel b{font-size:8px;letter-spacing:.12em}.reviewPanel span{font-size:8px;line-height:1.4;color:#cfc4d5}.reviewPanel button{min-height:44px;border:0;border-radius:13px;padding:0 14px;background:#c9ff54;color:#263800;font-size:8px;font-weight:1000;letter-spacing:.04em;cursor:pointer}
      .stage{position:absolute;z-index:7;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.84);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}.readyStage{background:rgba(54,83,11,.88);color:#efffc6}
      .softError{position:absolute;z-index:8;left:12px;right:12px;bottom:36px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.9);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .hint{position:absolute;z-index:9;left:10px;right:10px;bottom:10px;color:#e6deeb;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.12em;pointer-events:none;text-shadow:0 1px 6px #000}
      @media(max-width:620px){.previewStage{padding:48px 10px 118px}.photoDepth{width:94%;height:67%;border-radius:18px;transform:perspective(700px) rotateX(1deg) rotateY(-2deg)}.reviewPanel{grid-template-columns:1fr;text-align:center;bottom:28px}.reviewPanel button{width:100%;font-size:9px}}
      @media(prefers-reduced-motion:reduce){.previewStage,.photoDepth{transition:none;transform:none}}
    `}</style>
  </div>;
}
