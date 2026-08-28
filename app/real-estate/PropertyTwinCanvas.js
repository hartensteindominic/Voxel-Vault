'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const STONE = [0xe9deca, 0xd9cbb4, 0xcab99e, 0xf2e8d7, 0xbdaa8f];
const ROOF = [0x30343b, 0x252b31, 0x3b3d42, 0x1f252b];
const GREEN = [0x5a873c, 0x6b9a48, 0x436f35, 0x7aa553];

function hash01(value) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function material(color, roughness = 0.72, metalness = 0.02, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function addBox(root, geometries, materials, {
  size = [1, 1, 1], position = [0, 0, 0], color = 0xffffff, roughness = 0.72,
  metalness = 0.02, emissive = 0x000000, emissiveIntensity = 0, castShadow = true,
  receiveShadow = true, rotation = [0, 0, 0], material: suppliedMaterial = null,
}) {
  const geometry = new THREE.BoxGeometry(...size);
  const meshMaterial = suppliedMaterial || material(color, roughness, metalness, { emissive, emissiveIntensity });
  geometries.push(geometry);
  if (!suppliedMaterial) materials.push(meshMaterial);
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  root.add(mesh);
  return mesh;
}

function addVoxelInstances({ root, geometries, materials, compactMode, entries, palette, size, roughness = 0.78, metalness = 0.01 }) {
  if (!entries.length) return null;
  const geometry = new THREE.BoxGeometry(...size);
  const meshMaterial = material(0xffffff, roughness, metalness, { vertexColors: true });
  geometries.push(geometry);
  materials.push(meshMaterial);
  const stride = compactMode && entries.length > 1050 ? 2 : 1;
  const count = Math.ceil(entries.length / stride);
  const mesh = new THREE.InstancedMesh(geometry, meshMaterial, count);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let cursor = 0;
  entries.forEach((entry, index) => {
    if (index % stride !== 0) return;
    position.set(entry.x, entry.y, entry.z);
    quaternion.setFromEuler(new THREE.Euler(entry.rx || 0, entry.ry || 0, entry.rz || 0));
    const s = entry.scale || 1;
    scale.set(s * (entry.sx || 1), s * (entry.sy || 1), s * (entry.sz || 1));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(cursor, matrix);
    color.setHex(palette[entry.tone % palette.length]);
    mesh.setColorAt(cursor, color);
    cursor += 1;
  });
  mesh.count = cursor;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function masonryFacade({ width, height, z, y0, seed, front = true }) {
  const brickW = 0.42;
  const brickH = 0.2;
  const entries = [];
  const rows = Math.floor(height / brickH);
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 ? brickW * 0.5 : 0;
    const cols = Math.ceil(width / brickW) + 1;
    for (let col = 0; col < cols; col += 1) {
      const x = -width / 2 + col * brickW + offset;
      if (Math.abs(x) > width / 2 - 0.04) continue;
      const h = hash01(seed + row * 31 + col * 17);
      entries.push({
        x: x + (h - 0.5) * 0.018,
        y: y0 + brickH * (row + 0.5),
        z: z + (front ? 1 : -1) * (0.02 + h * 0.022),
        tone: Math.floor(h * STONE.length),
        scale: 0.96 + h * 0.045,
        sz: 0.88 + h * 0.16,
      });
    }
  }
  return entries;
}

function masonrySide({ depth, height, x, y0, seed, right = true }) {
  const brickW = 0.42;
  const brickH = 0.2;
  const entries = [];
  const rows = Math.floor(height / brickH);
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 ? brickW * 0.5 : 0;
    const cols = Math.ceil(depth / brickW) + 1;
    for (let col = 0; col < cols; col += 1) {
      const z = -depth / 2 + col * brickW + offset;
      if (Math.abs(z) > depth / 2 - 0.04) continue;
      const h = hash01(seed + row * 43 + col * 23);
      entries.push({
        x: x + (right ? 1 : -1) * (0.02 + h * 0.022),
        y: y0 + brickH * (row + 0.5),
        z: z + (h - 0.5) * 0.018,
        ry: Math.PI / 2,
        tone: Math.floor(h * STONE.length),
        scale: 0.96 + h * 0.045,
        sz: 0.88 + h * 0.16,
      });
    }
  }
  return entries;
}

function addWindow(root, geometries, materials, x, y, z, scale = 1, warmLight = false) {
  const trim = material(0xe9ddc6, 0.66, 0.02);
  const frame = material(0x171b1f, 0.42, 0.15);
  const glass = material(0x9cc7cf, 0.19, 0.18, {
    emissive: warmLight ? 0xffb865 : 0x21343b,
    emissiveIntensity: warmLight ? 1.55 : 0.26,
  });
  materials.push(trim, frame, glass);
  const w = 0.92 * scale;
  const h = 1.38 * scale;
  addBox(root, geometries, materials, { size: [w + 0.28, 0.13, 0.18], position: [x, y + h / 2 + 0.12, z], material: trim });
  addBox(root, geometries, materials, { size: [w + 0.28, 0.13, 0.18], position: [x, y - h / 2 - 0.12, z], material: trim });
  addBox(root, geometries, materials, { size: [0.13, h + 0.12, 0.18], position: [x - w / 2 - 0.08, y, z], material: trim });
  addBox(root, geometries, materials, { size: [0.13, h + 0.12, 0.18], position: [x + w / 2 + 0.08, y, z], material: trim });
  addBox(root, geometries, materials, { size: [w, h, 0.11], position: [x, y, z + 0.02], material: glass, castShadow: false });
  addBox(root, geometries, materials, { size: [0.075, h, 0.14], position: [x, y, z + 0.09], material: frame });
  addBox(root, geometries, materials, { size: [w, 0.075, 0.14], position: [x, y, z + 0.09], material: frame });
  if (warmLight) {
    const light = new THREE.PointLight(0xffbb72, 2.8, 4.2, 2);
    light.position.set(x, y, z + 0.45);
    root.add(light);
  }
}

function addVoxelTree(root, geometries, materials, x, z, seed, compactMode) {
  const trunk = material(0x63472f, 0.92, 0);
  materials.push(trunk);
  addBox(root, geometries, materials, { size: [0.34, 2.0, 0.34], position: [x, 1.0, z], material: trunk });
  const entries = [];
  const radius = compactMode ? 1 : 2;
  for (let y = 0; y < 4; y += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const h = hash01(seed + y * 91 + dx * 13 + dz * 37);
        if (Math.hypot(dx, dz) > radius + 0.3 || h < 0.22) continue;
        entries.push({ x: x + dx * 0.46 + (h - 0.5) * 0.16, y: 2.0 + y * 0.4, z: z + dz * 0.46, tone: Math.floor(h * GREEN.length), scale: 0.86 + h * 0.22 });
      }
    }
  }
  addVoxelInstances({ root, geometries, materials, compactMode, entries, palette: GREEN, size: [0.5, 0.5, 0.5], roughness: 0.9 });
}

function addFence(root, geometries, materials) {
  const iron = material(0x16191d, 0.4, 0.54);
  materials.push(iron);
  const posts = [];
  for (let x = -4.4; x <= 4.4; x += 0.46) {
    if (Math.abs(x) < 1.35) continue;
    posts.push([x, 0.55, 3.25]);
  }
  for (let z = -2.7; z <= 3.25; z += 0.46) {
    posts.push([-4.4, 0.55, z], [4.4, 0.55, z]);
  }
  posts.forEach(([x, y, z]) => addBox(root, geometries, materials, { size: [0.055, 0.95, 0.055], position: [x, y, z], material: iron }));
  addBox(root, geometries, materials, { size: [3.05, 0.07, 0.07], position: [-2.85, 0.87, 3.25], material: iron });
  addBox(root, geometries, materials, { size: [3.05, 0.07, 0.07], position: [2.85, 0.87, 3.25], material: iron });
  addBox(root, geometries, materials, { size: [0.07, 0.07, 5.95], position: [-4.4, 0.87, 0.28], material: iron });
  addBox(root, geometries, materials, { size: [0.07, 0.07, 5.95], position: [4.4, 0.87, 0.28], material: iron });
}

export default function PropertyTwinCanvas({ className = '', style }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const compactMode = window.matchMedia('(max-width: 680px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x121619, compactMode ? 0.025 : 0.018);

    const camera = new THREE.PerspectiveCamera(compactMode ? 43 : 36, 1, 0.1, 100);
    camera.position.set(compactMode ? 11.7 : 10.2, compactMode ? 7.3 : 7.1, compactMode ? 14.1 : 12.0);
    camera.lookAt(0, 2.45, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.touchAction = 'none';
    host.replaceChildren(renderer.domElement);

    const geometries = [];
    const materials = [];
    const root = new THREE.Group();
    root.rotation.y = -0.5;
    scene.add(root);

    const stoneCore = material(0xb9a78e, 0.82, 0.01);
    const darkStone = material(0x3b3b3a, 0.78, 0.02);
    const limestone = material(0xe8dcc6, 0.68, 0.02);
    const iron = material(0x16191d, 0.4, 0.55);
    const grass = material(0x64864d, 0.96, 0);
    materials.push(stoneCore, darkStone, limestone, iron, grass);

    addBox(root, geometries, materials, { size: [10.2, 0.42, 8.1], position: [0, -0.23, 0], color: 0x383d38, roughness: 0.94 });
    addBox(root, geometries, materials, { size: [9.55, 0.3, 7.45], position: [0, 0.02, 0], material: grass });

    // Paver walk and front court.
    const pavers = [];
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const h = hash01(row * 17 + col * 29 + 2);
        pavers.push({ x: (col - 2) * 0.42, y: 0.2, z: 3.15 - row * 0.36, tone: Math.floor(h * STONE.length), scale: 0.94 + h * 0.04 });
      }
    }
    addVoxelInstances({ root, geometries, materials, compactMode, entries: pavers, palette: STONE, size: [0.38, 0.09, 0.33], roughness: 0.9 });

    // Solid mass behind the visible voxel masonry so there are no gaps while rotating.
    addBox(root, geometries, materials, { size: [6.6, 3.25, 4.75], position: [0, 1.72, -0.12], material: stoneCore });
    addBox(root, geometries, materials, { size: [6.1, 2.2, 4.4], position: [0, 4.38, -0.2], material: stoneCore });

    const masonry = [
      ...masonryFacade({ width: 6.6, height: 3.25, z: 2.275, y0: 0.1, seed: 5, front: true }),
      ...masonryFacade({ width: 6.6, height: 3.25, z: -2.515, y0: 0.1, seed: 13, front: false }),
      ...masonrySide({ depth: 4.75, height: 3.25, x: 3.32, y0: 0.1, seed: 23, right: true }),
      ...masonrySide({ depth: 4.75, height: 3.25, x: -3.32, y0: 0.1, seed: 31, right: false }),
      ...masonryFacade({ width: 6.1, height: 2.2, z: 2.01, y0: 3.27, seed: 41, front: true }),
      ...masonryFacade({ width: 6.1, height: 2.2, z: -2.41, y0: 3.27, seed: 53, front: false }),
      ...masonrySide({ depth: 4.4, height: 2.2, x: 3.07, y0: 3.27, seed: 61, right: true }),
      ...masonrySide({ depth: 4.4, height: 2.2, x: -3.07, y0: 3.27, seed: 71, right: false }),
    ];
    addVoxelInstances({ root, geometries, materials, compactMode, entries: masonry, palette: STONE, size: [0.39, 0.17, 0.16], roughness: 0.82 });

    // Limestone belt courses and cornice create deep voxel edge relief.
    [0.28, 3.28, 5.45].forEach((y, index) => {
      addBox(root, geometries, materials, { size: [index === 2 ? 6.55 : 6.95, 0.18, index === 2 ? 4.8 : 5.02], position: [0, y, -0.12], material: limestone });
      if (index !== 2) addBox(root, geometries, materials, { size: [7.14, 0.08, 5.18], position: [0, y + 0.14, -0.12], material: darkStone });
    });

    // Stepped voxel mansard roof; every layer remains explicitly block-built.
    for (let layer = 0; layer < 8; layer += 1) {
      const t = layer / 7;
      const width = THREE.MathUtils.lerp(6.55, 5.1, t);
      const depth = THREE.MathUtils.lerp(4.75, 3.65, t);
      const entries = [];
      const step = 0.42;
      for (let x = -width / 2; x <= width / 2; x += step) {
        entries.push({ x, y: 5.58 + layer * 0.19, z: depth / 2, tone: Math.floor(hash01(layer * 100 + x * 9) * ROOF.length) });
        entries.push({ x, y: 5.58 + layer * 0.19, z: -depth / 2, tone: Math.floor(hash01(layer * 120 + x * 7) * ROOF.length) });
      }
      for (let z = -depth / 2 + step; z < depth / 2; z += step) {
        entries.push({ x: width / 2, y: 5.58 + layer * 0.19, z, ry: Math.PI / 2, tone: Math.floor(hash01(layer * 140 + z * 11) * ROOF.length) });
        entries.push({ x: -width / 2, y: 5.58 + layer * 0.19, z, ry: Math.PI / 2, tone: Math.floor(hash01(layer * 160 + z * 13) * ROOF.length) });
      }
      addVoxelInstances({ root, geometries, materials, compactMode, entries, palette: ROOF, size: [0.4, 0.18, 0.24], roughness: 0.7, metalness: 0.08 });
    }
    addBox(root, geometries, materials, { size: [5.0, 0.18, 3.55], position: [0, 7.02, -0.12], material: darkStone });

    // Roof terrace rail.
    for (let x = -2.35; x <= 2.35; x += 0.38) {
      addBox(root, geometries, materials, { size: [0.05, 0.48, 0.05], position: [x, 7.30, 1.54], material: iron });
      addBox(root, geometries, materials, { size: [0.05, 0.48, 0.05], position: [x, 7.30, -1.78], material: iron });
    }
    addBox(root, geometries, materials, { size: [4.9, 0.06, 0.06], position: [0, 7.50, 1.54], material: iron });
    addBox(root, geometries, materials, { size: [4.9, 0.06, 0.06], position: [0, 7.50, -1.78], material: iron });

    // Chimneys built from small masonry blocks.
    [-2.1, 2.05].forEach((x, chimneyIndex) => {
      for (let y = 0; y < 7; y += 1) {
        for (let side = -1; side <= 1; side += 2) {
          const h = hash01(300 + chimneyIndex * 80 + y * 7 + side);
          addBox(root, geometries, materials, { size: [0.34, 0.2, 0.34], position: [x + side * 0.17, 6.7 + y * 0.19, -0.5], color: STONE[Math.floor(h * STONE.length)], roughness: 0.88 });
        }
      }
      addBox(root, geometries, materials, { size: [0.9, 0.18, 0.68], position: [x, 8.02, -0.5], material: limestone });
    });

    // Recessed windows with deep voxel stone surrounds and warm interior glow.
    [-2.15, -0.75, 0.75, 2.15].forEach((x, index) => addWindow(root, geometries, materials, x, 1.75, 2.39, 0.76, index % 2 === 0));
    [-1.75, -0.58, 0.58, 1.75].forEach((x, index) => addWindow(root, geometries, materials, x, 4.28, 2.13, 0.68, index % 2 === 1));

    // Door, stone portal and voxel steps.
    const doorMaterial = material(0x201d19, 0.55, 0.18);
    materials.push(doorMaterial);
    addBox(root, geometries, materials, { size: [1.18, 2.2, 0.18], position: [0, 1.28, 2.49], material: doorMaterial });
    addBox(root, geometries, materials, { size: [0.25, 2.55, 0.42], position: [-0.79, 1.4, 2.58], material: limestone });
    addBox(root, geometries, materials, { size: [0.25, 2.55, 0.42], position: [0.79, 1.4, 2.58], material: limestone });
    addBox(root, geometries, materials, { size: [1.85, 0.28, 0.5], position: [0, 2.72, 2.58], material: limestone });
    for (let step = 0; step < 5; step += 1) {
      addBox(root, geometries, materials, { size: [2.15 + step * 0.22, 0.16, 0.42], position: [0, 0.08 + step * 0.12, 3.08 - step * 0.28], material: limestone });
    }

    // Small balcony with voxel ironwork.
    addBox(root, geometries, materials, { size: [2.05, 0.16, 0.75], position: [0, 3.38, 2.55], material: darkStone });
    for (let x = -0.92; x <= 0.92; x += 0.23) addBox(root, geometries, materials, { size: [0.045, 0.62, 0.045], position: [x, 3.73, 2.88], material: iron });
    addBox(root, geometries, materials, { size: [2.0, 0.055, 0.055], position: [0, 4.02, 2.88], material: iron });

    // Formal voxel landscaping and fence complete the miniature architectural model feel.
    addFence(root, geometries, materials);
    for (let x = -3.8; x <= 3.8; x += 0.5) {
      if (Math.abs(x) < 1.45) continue;
      const h = hash01(x * 37 + 500);
      addBox(root, geometries, materials, { size: [0.46, 0.38 + h * 0.14, 0.62], position: [x, 0.37, 2.72], color: GREEN[Math.floor(h * GREEN.length)], roughness: 0.94 });
    }
    addVoxelTree(root, geometries, materials, -3.75, -1.35, 701, compactMode);
    addVoxelTree(root, geometries, materials, 3.78, -1.15, 811, compactMode);

    // Neutral studio lighting with warm window accents.
    scene.add(new THREE.HemisphereLight(0xf8f0df, 0x232b30, 1.7));
    const key = new THREE.DirectionalLight(0xfff1d7, compactMode ? 3.7 : 4.4);
    key.position.set(8, 13, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(compactMode ? 1024 : 2048, compactMode ? 1024 : 2048);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.00035;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fc7d5, 1.25);
    fill.position.set(-8, 7, -6);
    scene.add(fill);
    const warmRim = new THREE.PointLight(0xffc281, 6.5, 18, 2);
    warmRim.position.set(-5.5, 6, 5.5);
    scene.add(warmRim);

    let width = 1;
    let height = 1;
    const resize = () => {
      width = Math.max(host.clientWidth, 1);
      height = Math.max(host.clientHeight, 1);
      const compact = compactMode || width < 520;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = compact ? 44 : 36;
      camera.position.set(compact ? 12.3 : 10.6, compact ? 7.6 : 7.3, compact ? 15.0 : 12.6);
      camera.lookAt(0, 2.8, 0);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let targetY = root.rotation.y;
    let targetX = 0;
    let inViewport = true;
    let documentVisible = !document.hidden;
    let lastRenderAt = 0;
    const compactFrameInterval = 1000 / 30;

    const down = (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!dragging) return;
      targetY += (event.clientX - lastX) * 0.008;
      targetX = THREE.MathUtils.clamp(targetX + (event.clientY - lastY) * 0.0024, -0.11, 0.15);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const up = (event) => {
      dragging = false;
      try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch {}
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    const intersectionObserver = new IntersectionObserver((entries) => {
      inViewport = entries.some((entry) => entry.isIntersecting);
    }, { threshold: 0.01 });
    intersectionObserver.observe(host);
    const visibilityChange = () => { documentVisible = !document.hidden; };
    document.addEventListener('visibilitychange', visibilityChange);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop((time = 0) => {
      if (!inViewport || !documentVisible) return;
      if (compactMode && time - lastRenderAt < compactFrameInterval) return;
      lastRenderAt = time;
      const delta = Math.min(clock.getDelta(), 0.05);
      if (!dragging && !reducedMotion) targetY += delta * 0.055;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetY, 0.065);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, targetX, 0.045);
      renderer.render(scene, camera);
    });

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((meshMaterial) => meshMaterial.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={style}
      aria-label="Interactive illustrative hyperreal voxel architecture model; visual demo only, not a sourced property record"
    />
  );
}
