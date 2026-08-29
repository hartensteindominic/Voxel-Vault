'use client';

import { useEffect, useRef, useState } from 'react';

const GRID = 24;
const MIN_SIDE = 12;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value || 0)));
const quantize = (value) => Math.max(0, Math.min(255, Math.round(Number(value || 0) / 12) * 12));
const toHex = (value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
const rgbDistance = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[1] || 0) - (b?.[1] || 0), (a?.[2] || 0) - (b?.[2] || 0)) / 441.673;
const averageRgb = (pixels) => pixels.length ? pixels.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]).map((v) => v / pixels.length) : [128, 128, 128];

function gridForImage(image) {
  const aspect = clamp((image.naturalWidth || 1) / (image.naturalHeight || 1), 0.5, 2);
  return aspect >= 1
    ? { width: GRID, height: Math.max(MIN_SIDE, Math.round(GRID / aspect)) }
    : { width: Math.max(MIN_SIDE, Math.round(GRID * aspect)), height: GRID };
}

function sampleRecipe(image) {
  const { width, height } = gridForImage(image);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');
  context.filter = 'saturate(1.04) contrast(1.05)';
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const rgb = [];
  const luminance = [];
  const colors = [];
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const pixel = [quantize(data[offset]), quantize(data[offset + 1]), quantize(data[offset + 2])];
    rgb.push(pixel);
    colors.push(`${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`);
    luminance.push((pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722) / 255);
  }
  const skySamples = [];
  const groundSamples = [];
  const topRows = Math.max(2, Math.round(height * 0.14));
  const bottomRows = Math.max(2, Math.round(height * 0.14));
  for (let row = 0; row < topRows; row += 1) for (let column = 0; column < width; column += 1) if (column < width * 0.28 || column > width * 0.72 || row === 0) skySamples.push(rgb[row * width + column]);
  for (let row = height - bottomRows; row < height; row += 1) for (let column = 0; column < width; column += 1) if (column < width * 0.3 || column > width * 0.7 || row === height - 1) groundSamples.push(rgb[row * width + column]);
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);
  const edges = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    const left = luminance[row * width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * width + Math.min(width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * width + column] ?? value;
    const down = luminance[Math.min(height - 1, row + 1) * width + column] ?? value;
    return clamp(Math.abs(left - right) * 1.65 + Math.abs(up - down) * 1.65);
  });
  const rawMask = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      const x = column / Math.max(1, width - 1);
      const y = row / Math.max(1, height - 1);
      const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edges[index];
      const likelySky = y < 0.46 && skyDistance < 0.115 + edge * 0.13;
      const likelyGround = y > 0.75 && groundDistance < 0.105 + edge * 0.12;
      const evidence = skyDistance * 0.5 + edge * 0.34 + center * 0.16;
      rawMask[index] = x > 0.035 && x < 0.965 && y > 0.045 && y < 0.96 && !likelySky && !likelyGround && (evidence > 0.23 || (y > 0.27 && y < 0.9 && center > 0.2 && skyDistance > 0.07));
    }
  }
  const mask = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    const candidates = [];
    for (let column = 0; column < width; column += 1) if (rawMask[row * width + column]) candidates.push(column);
    if (!candidates.length) continue;
    const centerColumn = (width - 1) / 2;
    let anchor = candidates.reduce((best, value) => Math.abs(value - centerColumn) < Math.abs(best - centerColumn) ? value : best, candidates[0]);
    let left = anchor;
    let right = anchor;
    while (left > 0 && (rawMask[row * width + left - 1] || rawMask[row * width + Math.max(0, left - 2)])) left -= 1;
    while (right < width - 1 && (rawMask[row * width + right + 1] || rawMask[row * width + Math.min(width - 1, right + 2)])) right += 1;
    if (right - left < Math.max(3, Math.round(width * 0.2)) && row > height * 0.32) {
      left = Math.max(1, anchor - Math.ceil(width * 0.11));
      right = Math.min(width - 2, anchor + Math.ceil(width * 0.11));
    }
    for (let column = left; column <= right; column += 1) if (rawMask[row * width + column] || (column > left && column < right && row > height * 0.28)) mask[row * width + column] = true;
  }
  if (mask.filter(Boolean).length < width * height * 0.16) {
    mask.fill(false);
    const center = Math.round((width - 1) / 2);
    for (let row = Math.round(height * 0.2); row < Math.round(height * 0.88); row += 1) {
      const roof = row < height * 0.43;
      const progress = clamp((row - height * 0.2) / Math.max(1, height * 0.23));
      const half = roof ? Math.round(2 + progress * width * 0.31) : Math.round(width * 0.34);
      for (let column = Math.max(1, center - half); column <= Math.min(width - 2, center + half); column += 1) mask[row * width + column] = true;
    }
  }
  const depths = luminance.map((value, index) => {
    if (!mask[index]) return 0;
    return Math.max(3, Math.min(9, Math.round(4 + value * 1.8 + edges[index] * 2.6)));
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
    image.onload = async () => {
      let recipe;
      try { recipe = sampleRecipe(image); } catch (cause) { if (!dead) setError(String(cause?.message || cause)); return; }
      try {
        const THREE = await import('three');
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialWidth < 720 ? 1.15 : 1.4));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .3s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.6));
        const key = new THREE.DirectionalLight(0xffedd5, 4);
        key.position.set(5, 8, 7);
        scene.add(key);
        const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = initialWidth < 720 ? 10.8 : 10.2;
        camera.position.set(0, 0.12, cameraDistance);
        camera.lookAt(0, -0.15, 0);
        const root = new THREE.Group();
        root.rotation.set(-0.07, 0.1, 0);
        scene.add(root);
        const geometry = new THREE.BoxGeometry(0.255, 0.255, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.015 });
        const active = recipe.depths.filter((depth) => depth > 0).length;
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, active));
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const cell = 0.285;
        let instance = 0;
        for (let row = 0; row < recipe.height; row += 1) for (let column = 0; column < recipe.width; column += 1) {
          const index = row * recipe.width + column;
          if (recipe.depths[index] <= 0) continue;
          const depth = 0.58 + recipe.depths[index] / 9 * 0.78;
          dummy.position.set((column - (recipe.width - 1) / 2) * cell, ((recipe.height - 1) / 2 - row) * cell - 0.15, depth / 2 - 0.58);
          dummy.scale.set(1, 1, depth);
          dummy.updateMatrix();
          mesh.setMatrixAt(instance, dummy.matrix);
          color.set(`#${recipe.colors[index]}`);
          mesh.setColorAt(instance, color);
          instance += 1;
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);
        const bodyWidth = Math.max(2.2, recipe.width * cell * 0.5);
        const baseGeometry = new THREE.CylinderGeometry(bodyWidth, bodyWidth + 0.22, 0.2, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.94 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -recipe.height * cell * 0.54, -0.12);
        scene.add(base);
        const pointers = new Map();
        let lastX = 0, lastY = 0, pinch = 0, targetX = -0.07, targetY = 0.1;
        const distance = () => { const pair = [...pointers.values()].slice(0, 2); return pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0; };
        const updateCamera = () => { camera.position.set(0, 0.12, cameraDistance); camera.lookAt(0, -0.15, 0); };
        const down = (event) => { pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); renderer.domElement.setPointerCapture?.(event.pointerId); lastX = event.clientX; lastY = event.clientY; pinch = distance(); };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) { const next = distance(); if (pinch > 0 && next > 0) { cameraDistance = clamp(cameraDistance - (next - pinch) * 0.012, 7, 14.5); updateCamera(); } pinch = next; return; }
          const dx = event.clientX - lastX, dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; targetY += dx * 0.007; targetX = clamp(targetX + dy * 0.004, -0.42, 0.35);
        };
        const up = (event) => { pointers.delete(event.pointerId); pinch = distance(); renderer.domElement.releasePointerCapture?.(event.pointerId); };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        let frame = 0;
        const animate = () => { if (dead) return; root.rotation.x += (targetX - root.rotation.x) * 0.13; root.rotation.y += (targetY - root.rotation.y) * 0.13; renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
        animate();
        requestAnimationFrame(() => { if (dead) return; renderer.domElement.style.opacity = '1'; setReady(true); callbackRef.current?.(recipe); });
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!mountRef.current) return; const w = Math.max(280, mountRef.current.clientWidth || initialWidth), h = Math.max(280, mountRef.current.clientHeight || initialHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }) : null;
        observer?.observe(mount);
        cleanup = () => { cancelAnimationFrame(frame); observer?.disconnect(); geometry.dispose(); material.dispose(); baseGeometry.dispose(); baseMaterial.dispose(); renderer.dispose(); };
      } catch (cause) {
        if (!dead) { setError(String(cause?.message || cause || 'Interactive 3D could not start.')); setReady(true); callbackRef.current?.(recipe); }
      }
    };
    image.onerror = () => setError('The property photo could not be opened for voxel creation.');
    return () => { dead = true; cleanup(); };
  }, [imageUrl, sourceImageUrl]);

  return <div className="viewerShell">
    <div ref={mountRef} className="viewerMount" aria-label="Interactive VoxelPop 3D model"/>
    {showSource && (sourceImageUrl || imageUrl) ? <div className="sourceOverlay"><img src={sourceImageUrl || imageUrl} alt="Original property source"/></div> : null}
    <div className="viewerTools"><button type="button" className={!showSource ? 'active' : ''} onClick={() => setShowSource(false)}>VOXEL</button><button type="button" className={showSource ? 'active' : ''} onClick={() => setShowSource(true)}>SOURCE</button></div>
    <div className="viewerHelp"><b>{ready ? 'DRAG BUILDING · PINCH TO ZOOM' : 'BUILDING VOXEL…'}</b><span>{error || 'Compare VOXEL with SOURCE. The original house framing is preserved instead of square-cropped.'}</span></div>
    <style jsx>{`.viewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:#21172c}.viewerMount{position:absolute;inset:0}.sourceOverlay{position:absolute;inset:0;z-index:2;background:#17111d}.sourceOverlay img{width:100%;height:100%;object-fit:contain;display:block}.viewerTools{position:absolute;z-index:4;top:14px;right:14px;display:flex;gap:6px;padding:5px;border-radius:999px;background:rgba(18,12,23,.72)}.viewerTools button{min-height:36px;border:0;border-radius:999px;padding:0 11px;background:transparent;color:#d8cedf;font:900 8px inherit}.viewerTools button.active{background:#c9ff54;color:#2d3b15}.viewerHelp{position:absolute;z-index:4;left:14px;right:14px;bottom:14px;padding:10px 12px;border-radius:16px;background:rgba(20,13,26,.72);color:#fff;display:grid;gap:2px;text-align:left;pointer-events:none}.viewerHelp b{font-size:9px;letter-spacing:.09em}.viewerHelp span{font-size:9px;color:#ddd2e5}`}</style>
  </div>;
}
