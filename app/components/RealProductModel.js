'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CACHE_PREFIX = 'vv3-image-to-3d:';

function isPlaceholderImage(url = '') {
  return /images\\.unsplash\\.com|unsplash\\.com/i.test(url);
}

async function resolveProductImage(imageUrl, sourceUrl) {
  if (imageUrl && !isPlaceholderImage(imageUrl)) return imageUrl;
  if (!sourceUrl) return imageUrl || '';
  try {
    const response = await fetch(`/api/product-image?url=${encodeURIComponent(sourceUrl)}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.imageUrl) return data.imageUrl;
    }
  } catch {}
  return imageUrl || '';
}

async function generateFromImage(imageUrl, item, cacheKey) {
  const cacheName = CACHE_PREFIX + cacheKey;
  const cached = window.localStorage.getItem(cacheName);
  if (cached) {
    try {
      const response = await fetch(cached, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) return cached;
    } catch {}
    window.localStorage.removeItem(cacheName);
  }
  const start = await fetch('/api/image-to-3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, item: { name: item?.name, type: item?.type, material: item?.material, sourceName: item?.sourceName, sourceNote: item?.sourceNote, sourceUrl: item?.sourceUrl } }),
  });
  if (!start.ok) throw new Error('Image-to-3D generation is not configured or failed to start.');
  const { taskId } = await start.json();
  if (!taskId) throw new Error('Image-to-3D provider returned no task id.');
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const status = await fetch(`/api/image-to-3d?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
    if (!status.ok) throw new Error('Unable to read image-to-3D generation status.');
    const data = await status.json();
    if (data.status === 'SUCCEEDED' && data.modelUrl) {
      window.localStorage.setItem(cacheName, data.modelUrl);
      return data.modelUrl;
    }
    if (['FAILED', 'CANCELED'].includes(data.status)) throw new Error(data.error || 'Image-to-3D generation failed.');
  }
  throw new Error('Image-to-3D generation timed out.');
}

function makeMaterial(texture, color, metalness, roughness) {
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({ color, map: texture || null, metalness, roughness, clearcoat: 0.35, clearcoatRoughness: 0.18 });
}
function box(group, size, position, material) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...position); group.add(mesh); return mesh; }
function createProductTwin(item, imageUrl) {
  const group = new THREE.Group();
  const texture = imageUrl ? new THREE.TextureLoader().load(imageUrl) : null;
  const name = `${item?.name || ''} ${item?.type || ''}`.toLowerCase();
  const product = makeMaterial(texture, 0xf1f3f7, 0.18, 0.3), dark = makeMaterial(null, 0x171a24, 0.72, 0.2), metal = makeMaterial(null, 0x8d93a5, 0.78, 0.22), soft = makeMaterial(null, 0xc8ccd6, 0.12, 0.62);
  if (name.includes('blender')) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 2.15, 48), product); body.position.y = 0.25; group.add(body);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.28, 48), dark); base.position.y = -0.92; group.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.2, 48), dark); cap.position.y = 1.42; group.add(cap);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.11, 18, 48, Math.PI), dark); handle.rotation.z = Math.PI / 2; handle.position.set(0.7, 0.25, 0); group.add(handle);
  } else if (name.includes('spiral')) {
    box(group, [1.55, 0.18, 1.0], [0, -1.15, 0], dark);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 16, 72, Math.PI * 1.75), metal); coil.rotation.z = Math.PI / 2; coil.position.y = 0.15; group.add(coil);
    const diffuser = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.35, 8, 20), product); diffuser.position.set(0, 0.25, 0.05); diffuser.rotation.z = -0.18; group.add(diffuser);
  } else if (name.includes('lamp')) {
    box(group, [1.65, 0.24, 1.05], [0, -1.15, 0], dark);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.85, 24), metal); stem.position.set(0, -0.15, 0); stem.rotation.z = -0.12; group.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, 0.52, 48), product); shade.position.set(0.12, 0.82, 0); shade.rotation.z = -0.18; group.add(shade);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshBasicMaterial({ color: 0xfff1c4 })); glow.position.set(0.2, 0.55, 0.27); group.add(glow);
  } else if (name.includes('bowl') || name.includes('fountain') || name.includes('dispenser')) {
    const reservoir = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 1.0, 48), product); reservoir.position.y = -0.2; group.add(reservoir);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.82, 0.28, 48), soft); basin.position.y = -0.82; group.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.08, 18, 64), dark); rim.rotation.x = Math.PI / 2; rim.position.y = -0.64; group.add(rim);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.72, 24), metal); spout.position.y = 0.55; group.add(spout);
  } else if (name.includes('vanity') || name.includes('desk')) {
    box(group, [2.7, 0.22, 1.15], [0, 0.35, 0], product); box(group, [0.22, 1.55, 0.9], [-1.15, -0.45, 0], dark); box(group, [0.22, 1.55, 0.9], [1.15, -0.45, 0], dark); box(group, [1.45, 1.25, 0.1], [0, 1.15, -0.02], metal);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.08), new THREE.MeshPhysicalMaterial({ color: 0x8fa3c8, metalness: 0.65, roughness: 0.12 })); mirror.position.set(0, 1.15, 0.045); group.add(mirror); box(group, [0.85, 0.28, 0.85], [0, -1.25, 0], soft);
  } else if (name.includes('cup') || name.includes('bottle') || name.includes('water')) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.54, 1.9, 48), product); body.position.y = 0; group.add(body); const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.45, 40), dark); neck.position.y = 1.12; group.add(neck); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 40), dark); cap.position.y = 1.43; group.add(cap);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 32), product); body.scale.set(1.1, 1.05, 0.72); group.add(body); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, 0.25, 48), dark); base.position.y = -0.95; group.add(base);
  }
  return group;
}

export default function RealProductModel({ item, onLoaded, onUnavailable }) {
  const host = useRef(null);
  const onLoadedRef = useRef(onLoaded);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);
  useEffect(() => { onUnavailableRef.current = onUnavailable; }, [onUnavailable]);

  useEffect(() => {
    const root = host.current;
    const directUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
    let imageUrl = item?.previewUri || item?.digitalTwin?.previewUrl;
    if (!root || (!directUrl && !imageUrl && !item?.sourceUrl)) return undefined;
    let alive = true;
    let renderer;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || probe.getContext('webgl', { failIfMajorPerformanceCaveat: false });
      if (!gl) { onUnavailableRef.current?.(); return undefined; }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) {
      console.warn('Interactive 3D unavailable; keeping the product image fallback.', error);
      onUnavailableRef.current?.();
      return undefined;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:auto;z-index:5';
    root.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x11131c, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 4.5); key.position.set(4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7566ff, 2.5); rim.position.set(-4, 3, -4); scene.add(rim);

    let model = null;
    let raf;
    let upgraded = false;
    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    let targetX = -0.08;
    let targetY = -0.18;
    let distance = 5.2;
    const normalize = object => {
      const box3 = new THREE.Box3().setFromObject(object);
      const size = box3.getSize(new THREE.Vector3());
      const center = box3.getCenter(new THREE.Vector3());
      object.position.sub(center);
      object.scale.setScalar(2.65 / (Math.max(size.x, size.y, size.z) || 1));
      object.position.y += 0.05;
    };
    const disposeModel = object => {
      if (!object) return;
      scene.remove(object);
      object.traverse(node => {
        node.geometry?.dispose?.();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.filter(Boolean).forEach(material => { material.map?.dispose?.(); material.dispose?.(); });
      });
    };
    const showModel = (object, isUpgrade = false) => {
      if (!alive) return false;
      normalize(object);
      if (model) disposeModel(model);
      scene.add(object);
      model = object;
      upgraded = isUpgrade;
      model.rotation.set(targetX, targetY, 0);
      camera.position.set(0, 0.15, distance);
      camera.lookAt(0, 0, 0);
      onLoadedRef.current?.(true);
      return true;
    };
    const loadGlb = url => new Promise((resolve, reject) => new GLTFLoader().load(url, gltf => resolve(gltf.scene), undefined, reject));

    const resize = () => {
      if (!alive) return;
      const width = Math.max(root.clientWidth, 1), height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(root);

    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${item?.name || 'Product'} interactive 3D twin. Drag in any direction to rotate. Use the mouse wheel or pinch gesture to zoom.`);
    canvas.style.touchAction = 'none';
    const pointerDown = event => {
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture?.(pointerId);
    };
    const pointerMove = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      targetY += (event.clientX - lastX) * 0.012;
      targetX = THREE.MathUtils.clamp(targetX + (event.clientY - lastY) * 0.01, -Math.PI / 2, Math.PI / 2);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const pointerUp = event => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      canvas.releasePointerCapture?.(pointerId);
      pointerId = null;
    };
    const wheel = event => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.004, 3.2, 7.2);
    };
    const resetView = () => { targetX = -0.08; targetY = -0.18; distance = 5.2; };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('dblclick', resetView);
    canvas.addEventListener('wheel', wheel, { passive: false });

    const createImmediateTwin = () => {
      const twin = createProductTwin(item, imageUrl);
      showModel(twin, false);
    };

    (async () => {
      imageUrl = await resolveProductImage(imageUrl, item?.sourceUrl);
      if (!alive) return;
      if (directUrl) {
        try { showModel(await loadGlb(directUrl), true); return; }
        catch { createImmediateTwin(); }
      } else {
        createImmediateTwin();
      }
      if (!imageUrl || !alive) return;
      try {
        const generatedUrl = await generateFromImage(imageUrl, item, item?.id || item?.slug || imageUrl);
        if (!alive || !generatedUrl) return;
        const generatedModel = await loadGlb(generatedUrl);
        if (alive) showModel(generatedModel, true);
      } catch {
        // Keep the visible product-specific procedural twin. No blank state.
      }
    })();

    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (model) {
        if (!dragging) targetY += upgraded ? 0.0012 : 0.0017;
        model.rotation.x += (targetX - model.rotation.x) * 0.14;
        model.rotation.y += (targetY - model.rotation.y) * 0.14;
      }
      camera.position.z += (distance - camera.position.z) * 0.16;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('dblclick', resetView);
      canvas.removeEventListener('wheel', wheel);
      if (renderer.domElement.parentNode === root) root.removeChild(renderer.domElement);
      disposeModel(model);
      renderer.dispose();
    };
  }, [item]);

  if (!item?.modelUri && !item?.digitalTwin?.modelUrl && !item?.previewUri && !item?.digitalTwin?.previewUrl && !item?.sourceUrl) return null;
  return <div ref={host} style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center' }} />;
}
