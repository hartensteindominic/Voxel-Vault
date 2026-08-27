'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SpatialAsset } from '@/lib/spatial-assets';
import styles from './spatial.module.css';

type VaultMode = 'vault' | 'gallery';

type Props = {
  assets: SpatialAsset[];
  selectedId?: string | null;
  mode?: VaultMode;
  onSelect?: (assetId: string) => void;
};

type WorldApi = {
  reset: () => void;
  focus: (assetId: string) => void;
  enterXR: () => Promise<void>;
};

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    const mat = item as THREE.MeshStandardMaterial;
    mat.map?.dispose?.();
    mat.normalMap?.dispose?.();
    mat.roughnessMap?.dispose?.();
    mat.metalnessMap?.dispose?.();
    mat.emissiveMap?.dispose?.();
    item.dispose?.();
  }
}

function normalizeModel(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dimension = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 1.15 / dimension;
  model.scale.setScalar(scale);
  const scaled = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaled.getCenter(new THREE.Vector3());
  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.position.y -= scaled.min.y;
  return model;
}

function slotPosition(index: number, count: number, mode: VaultMode) {
  if (mode === 'gallery') {
    const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(Math.max(count, 1)))));
    const row = Math.floor(index / columns);
    const col = index % columns;
    return new THREE.Vector3((col - (columns - 1) / 2) * 3.05, 0, (row - 0.5) * -3.2);
  }
  const radius = Math.max(3.8, Math.min(7.2, 3.8 + count * 0.22));
  const angle = count <= 1 ? 0 : (index / count) * Math.PI * 2;
  return new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
}

function placeholderCrystal(minted: boolean) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: minted ? '#7dd3fc' : '#a78bfa',
    emissive: minted ? '#0e7490' : '#4c1d95',
    emissiveIntensity: 1.35,
    metalness: 0.42,
    roughness: 0.22,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.54, 0), material);
  core.position.y = 0.62;
  core.rotation.z = Math.PI / 4;
  group.add(core);
  for (let i = 0; i < 5; i += 1) {
    const voxel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), material.clone());
    const a = (i / 5) * Math.PI * 2;
    voxel.position.set(Math.sin(a) * 0.72, 0.5 + (i % 2) * 0.25, Math.cos(a) * 0.72);
    voxel.rotation.set(a * 0.2, a, a * 0.12);
    group.add(voxel);
  }
  return group;
}

export default function SpatialVaultWorld({ assets, selectedId = null, mode = 'vault', onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<WorldApi | null>(null);
  const [error, setError] = useState('');
  const [xrAvailable, setXrAvailable] = useState(false);
  const [xrActive, setXrActive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let pointerStart = { x: 0, y: 0 };
    let tween: null | {
      startedAt: number;
      fromPosition: THREE.Vector3;
      toPosition: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
    } = null;

    setError('');
    setXrAvailable(false);
    setXrActive(false);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mode === 'gallery' ? '#0b0d12' : '#02040b');
    scene.fog = new THREE.FogExp2(mode === 'gallery' ? '#0b0d12' : '#02040b', mode === 'gallery' ? 0.027 : 0.042);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 120);
    const defaultPosition = mode === 'gallery' ? new THREE.Vector3(7.5, 6.2, 9.5) : new THREE.Vector3(0, 5.1, 10.8);
    const defaultTarget = new THREE.Vector3(0, 0.8, 0);
    camera.position.copy(defaultPosition);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (renderError) {
      console.error('Spatial Vault WebGL initialization failed', renderError);
      setError('Your browser could not start the 3D vault. Your creations are still available in the standard My Vault view.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D view of your VoxelVault creations');
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.target.copy(defaultTarget);
    controls.minDistance = 2.2;
    controls.maxDistance = mode === 'gallery' ? 25 : 18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    scene.add(new THREE.HemisphereLight('#dff8ff', '#080914', mode === 'gallery' ? 1.9 : 1.55));
    const key = new THREE.DirectionalLight('#ffffff', 3.1);
    key.position.set(6, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const cyan = new THREE.PointLight('#00d4ff', 22, 18, 2);
    cyan.position.set(-5, 3.8, 1);
    scene.add(cyan);
    const violet = new THREE.PointLight('#8b5cf6', 18, 16, 2);
    violet.position.set(5, 2.8, -4);
    scene.add(violet);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(mode === 'gallery' ? 18 : 12, 64),
      new THREE.MeshStandardMaterial({ color: mode === 'gallery' ? '#14171d' : '#070a11', metalness: 0.58, roughness: 0.46 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    if (mode === 'vault') {
      const ringMaterial = new THREE.MeshStandardMaterial({ color: '#07111a', emissive: '#063b4c', emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.35 });
      for (let i = 0; i < 3; i += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(8.7 - i * 1.25, 0.035, 6, 96), ringMaterial.clone());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.015;
        scene.add(ring);
      }
      const wallMaterial = new THREE.MeshStandardMaterial({ color: '#080b13', metalness: 0.7, roughness: 0.52, side: THREE.BackSide });
      const vaultShell = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 10.8, 7.5, 16, 1, true), wallMaterial);
      vaultShell.position.y = 3.4;
      scene.add(vaultShell);
    }

    const particleCount = Math.min(240, 80 + assets.length * 10);
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const seed = Math.sin((i + 1) * 93.13) * 43758.5453;
      const seed2 = Math.sin((i + 1) * 41.71) * 24634.6345;
      const seed3 = Math.sin((i + 1) * 17.37) * 13579.2468;
      positions[i * 3] = ((seed - Math.floor(seed)) - 0.5) * 19;
      positions[i * 3 + 1] = (seed2 - Math.floor(seed2)) * 6 + 0.2;
      positions[i * 3 + 2] = ((seed3 - Math.floor(seed3)) - 0.5) * 19;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: '#8be9ff', size: 0.025, transparent: true, opacity: 0.42, depthWrite: false }));
    scene.add(particles);

    const assetGroups = new Map<string, THREE.Group>();
    const rotatingModels: THREE.Object3D[] = [];
    const loader = new GLTFLoader();

    assets.forEach((asset, index) => {
      const position = slotPosition(index, assets.length, mode);
      const group = new THREE.Group();
      group.position.copy(position);
      group.userData.assetId = asset.id;
      scene.add(group);
      assetGroups.set(asset.id, group);

      const baseMaterial = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.82, roughness: 0.28 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.03, 0.34, mode === 'gallery' ? 32 : 8), baseMaterial);
      base.position.y = 0.17;
      base.castShadow = true;
      base.receiveShadow = true;
      base.userData.assetId = asset.id;
      group.add(base);

      const minted = asset.state === 'minted';
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.73, 0.038, 7, 48),
        new THREE.MeshStandardMaterial({ color: minted ? '#86efac' : '#67e8f9', emissive: minted ? '#166534' : '#0e7490', emissiveIntensity: 1.55, metalness: 0.25, roughness: 0.2 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.37;
      ring.userData.assetId = asset.id;
      group.add(ring);

      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.62, 0.48, mode === 'gallery' ? 32 : 8),
        new THREE.MeshStandardMaterial({ color: '#0b1020', metalness: 0.7, roughness: 0.3 }),
      );
      stand.position.y = 0.55;
      stand.userData.assetId = asset.id;
      group.add(stand);

      const contentRoot = new THREE.Group();
      contentRoot.position.y = 0.79;
      contentRoot.userData.assetId = asset.id;
      group.add(contentRoot);
      rotatingModels.push(contentRoot);

      const fallback = placeholderCrystal(minted);
      fallback.userData.assetId = asset.id;
      contentRoot.add(fallback);

      if (asset.modelUrl) {
        loader.load(asset.modelUrl, gltf => {
          if (disposed) return;
          const model = normalizeModel(gltf.scene);
          model.traverse(object => {
            object.userData.assetId = asset.id;
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          contentRoot.remove(fallback);
          fallback.traverse(object => {
            const mesh = object as THREE.Mesh;
            mesh.geometry?.dispose?.();
            if (mesh.material) disposeMaterial(mesh.material);
          });
          contentRoot.add(model);
        }, undefined, loadError => {
          console.warn('Spatial asset model failed to load; using crystal fallback.', asset.id, loadError);
        });
      }
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (moved > 8) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let current: THREE.Object3D | null = hit.object;
        while (current) {
          const assetId = current.userData?.assetId;
          if (assetId) {
            onSelect?.(assetId);
            return;
          }
          current = current.parent;
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(420, host.clientHeight || 520);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const reset = () => {
      tween = {
        startedAt: performance.now(),
        fromPosition: camera.position.clone(),
        toPosition: defaultPosition.clone(),
        fromTarget: controls.target.clone(),
        toTarget: defaultTarget.clone(),
      };
    };
    const focus = (assetId: string) => {
      const group = assetGroups.get(assetId);
      if (!group) return;
      const position = group.getWorldPosition(new THREE.Vector3());
      const direction = position.clone().normalize();
      if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
      const toPosition = position.clone().add(direction.multiplyScalar(2.7)).add(new THREE.Vector3(0, 1.65, 0));
      const toTarget = position.clone().add(new THREE.Vector3(0, 0.95, 0));
      tween = {
        startedAt: performance.now(),
        fromPosition: camera.position.clone(),
        toPosition,
        fromTarget: controls.target.clone(),
        toTarget,
      };
    };
    const enterXR = async () => {
      const xr = (navigator as any).xr;
      if (!xr) throw new Error('WebXR is not available in this browser.');
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      session.addEventListener('end', () => setXrActive(false), { once: true });
      await renderer.xr.setSession(session);
      setXrActive(true);
    };
    apiRef.current = { reset, focus, enterXR };

    const xr = (navigator as any).xr;
    if (xr?.isSessionSupported) {
      xr.isSessionSupported('immersive-vr').then((supported: boolean) => {
        if (!disposed) setXrAvailable(Boolean(supported));
      }).catch(() => {});
    }

    renderer.setAnimationLoop(time => {
      if (disposed || document.hidden) return;
      if (tween) {
        const elapsed = Math.min(1, (time - tween.startedAt) / (reduceMotion ? 1 : 720));
        const eased = 1 - Math.pow(1 - elapsed, 3);
        camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
        if (elapsed >= 1) tween = null;
      }
      if (!reduceMotion && !renderer.xr.isPresenting) {
        rotatingModels.forEach((item, index) => { item.rotation.y += 0.0023 + (index % 4) * 0.0003; });
        particles.rotation.y += 0.00008;
      }
      controls.enabled = !renderer.xr.isPresenting;
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      apiRef.current = null;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        if (mesh.material) disposeMaterial(mesh.material);
      });
      particleGeometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [assets, mode, onSelect]);

  useEffect(() => {
    if (selectedId) apiRef.current?.focus(selectedId);
  }, [selectedId]);

  return (
    <div className={styles.worldFrame}>
      <div className={styles.worldToolbar}>
        <div><span className={styles.worldPill}>{mode === 'gallery' ? 'GALLERY MODE' : 'VAULT MODE'} · {assets.length} ITEMS</span></div>
        <div>
          {xrAvailable && <button type="button" className={styles.worldButton} onClick={() => apiRef.current?.enterXR().catch(err => setError(err instanceof Error ? err.message : 'Could not enter WebXR.'))}>{xrActive ? 'XR ACTIVE' : 'ENTER XR'}</button>}
          <button type="button" className={styles.worldButton} onClick={() => apiRef.current?.reset()}>RESET VIEW</button>
        </div>
      </div>
      <div ref={hostRef} className={styles.worldCanvas} />
      {error && <div className={styles.worldFallback}><div><b>3D view unavailable</b>{error}</div></div>}
      {!error && <div className={styles.worldHint}>DRAG TO ORBIT · TAP A CREATION TO INSPECT · SCROLL/PINCH TO ZOOM</div>}
    </div>
  );
}
