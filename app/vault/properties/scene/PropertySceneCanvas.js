'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function mediaUrl(uri) {
  const value = String(uri || '').trim();
  if (!value) return '';
  if (value.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith('ar://')) return `https://arweave.net/${value.slice(5)}`;
  return value;
}

function decodeMetadata(uri) {
  const value = String(uri || '');
  try {
    if (value.startsWith('data:application/json;base64,')) {
      return JSON.parse(atob(value.slice('data:application/json;base64,'.length)));
    }
    if (value.startsWith('data:application/json,')) {
      return JSON.parse(decodeURIComponent(value.slice('data:application/json,'.length)));
    }
  } catch {
    return null;
  }
  return null;
}

async function metadataFor(uri) {
  const inline = decodeMetadata(uri);
  if (inline) return inline;
  const url = mediaUrl(uri);
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export default function PropertySceneCanvas({ items = [], selectedId = '' }) {
  const hostRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setError('3D scene unavailable in this browser. Your saved scene items remain intact.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050706, 18, 44);
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(12, 9, 16);
    camera.lookAt(0, 2.4, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    world.rotation.y = -0.35;
    scene.add(world);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(10.5, 11.2, 0.65, 12),
      new THREE.MeshStandardMaterial({ color: 0x101a17, roughness: 0.95 })
    );
    ground.position.y = -0.35;
    world.add(ground);

    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x17372b, roughness: 0.98 })
    );
    lawn.position.y = 0.02;
    world.add(lawn);

    const house = new THREE.Group();
    world.add(house);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(6.3, 3.8, 5.0),
      new THREE.MeshStandardMaterial({ color: 0x35545a, emissive: 0x102a2e, emissiveIntensity: 0.22, roughness: 0.62 })
    );
    base.position.y = 2.05;
    house.add(base);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4.15, 2.1, 4),
      new THREE.MeshStandardMaterial({ color: 0xa6d8cf, emissive: 0x173b37, emissiveIntensity: 0.18, roughness: 0.55 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.78;
    roof.position.y = 5.0;
    house.add(roof);

    const itemRoot = new THREE.Group();
    world.add(itemRoot);
    const loader = new GLTFLoader();
    let disposed = false;

    items.forEach((item, index) => {
      const group = new THREE.Group();
      group.position.set(Number(item.position_x || 0), Number(item.position_y || 0.7), Number(item.position_z || 0));
      group.rotation.y = Number(item.rotation_y || 0);
      const scale = Number(item.scale || 1);
      group.scale.setScalar(scale);
      itemRoot.add(group);

      const selected = String(item.id) === String(selectedId);
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshStandardMaterial({
          color: selected ? 0xd9fff5 : 0x9ff5df,
          emissive: selected ? 0x4bc9aa : 0x1c6d5b,
          emissiveIntensity: selected ? 1.1 : 0.65,
          roughness: 0.32,
          metalness: 0.18,
        })
      );
      placeholder.position.y = 0.45;
      group.add(placeholder);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.035, 8, 36),
        new THREE.MeshBasicMaterial({ color: selected ? 0xffffff : 0x9ff5df, transparent: true, opacity: selected ? 0.85 : 0.35 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      group.add(ring);

      metadataFor(item.token_uri).then((metadata) => {
        if (disposed || !metadata) return;
        const modelUri = mediaUrl(metadata.animation_url || metadata.animationUrl || '');
        if (!modelUri || !/\.(glb|gltf)(\?|#|$)/i.test(modelUri)) return;
        loader.load(modelUri, (gltf) => {
          if (disposed) return;
          group.remove(placeholder);
          placeholder.geometry.dispose();
          placeholder.material.dispose();
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
          model.scale.setScalar(1.6 / maxDimension);
          const centeredBox = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          centeredBox.getCenter(center);
          model.position.sub(center);
          const finalBox = new THREE.Box3().setFromObject(model);
          model.position.y -= finalBox.min.y;
          group.add(model);
        }, undefined, () => {});
      });

      group.userData.floatOffset = index * 0.8;
    });

    scene.add(new THREE.HemisphereLight(0xeafff8, 0x101614, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(9, 14, 10);
    scene.add(sun);
    const glow = new THREE.PointLight(0x9ff5df, 7, 18, 2);
    glow.position.set(0, 7, 3);
    scene.add(glow);

    const grid = new THREE.GridHelper(34, 34, 0x2f6457, 0x142821);
    grid.position.y = 0.09;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    world.add(grid);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let dragging = false;
    let lastX = 0;
    let targetRotation = world.rotation.y;
    const down = (event) => { dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture?.(event.pointerId); };
    const move = (event) => { if (!dragging) return; targetRotation += (event.clientX - lastX) * 0.008; lastX = event.clientX; };
    const up = (event) => { dragging = false; renderer.domElement.releasePointerCapture?.(event.pointerId); };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      if (!dragging && !reduced) targetRotation += 0.0006;
      world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, targetRotation, 0.06);
      itemRoot.children.forEach((group) => {
        if (!reduced) group.position.y += Math.sin(t * 1.5 + group.userData.floatOffset) * 0.00035;
      });
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose?.());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [items, selectedId]);

  return (
    <section className="relative min-h-[520px] overflow-hidden rounded-[34px] border border-emerald-100/15 bg-[radial-gradient(circle_at_50%_10%,#18352e_0%,#09110f_48%,#050706_100%)]">
      <div ref={hostRef} className="h-[520px] w-full cursor-grab" aria-label="Interactive 3D property scene with attached Voxel Vault collectibles" />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-100/15 bg-black/45 px-3 py-2 text-[9px] font-black tracking-[.12em] text-emerald-100/75">PROPERTY SCENE</span>
        <span className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[9px] font-black tracking-[.12em] text-white/55">{items.length} ATTACHED VOXEL{items.length === 1 ? '' : 'S'}</span>
        <span className="rounded-full border border-amber-100/15 bg-black/45 px-3 py-2 text-[9px] font-black tracking-[.12em] text-amber-100/70">DIGITAL VALUE ≠ APPRAISAL</span>
      </div>
      {error ? <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-red-200/15 bg-red-950/65 p-4 text-xs text-red-50/80">{error}</div> : null}
    </section>
  );
}
