'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from './VoxelVaultCanvas.module.css';

export default function VoxelVaultCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const root = host.current;
    if (!root) return;

    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let controls: OrbitControls | null = null;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#020617');
      scene.fog = new THREE.Fog('#020617', 8, 18);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(4.2, 3.1, 5.4);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D preview of the VoxelVault secure vault');
      root.replaceChildren(renderer.domElement);

      scene.add(new THREE.HemisphereLight('#b8f7ff', '#030712', 1.35));
      const key = new THREE.DirectionalLight('#e6fbff', 3.2);
      key.position.set(5, 7, 5);
      scene.add(key);
      const cyan = new THREE.PointLight('#00d4ff', 18, 10, 2);
      cyan.position.set(0, 1.8, 2.8);
      scene.add(cyan);
      const violet = new THREE.PointLight('#7c3aed', 9, 9, 2);
      violet.position.set(-3.5, -1.2, -2.5);
      scene.add(violet);

      const vault = new THREE.Group();
      scene.add(vault);

      const core = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 3.05, 2.15),
        new THREE.MeshStandardMaterial({ color: '#080d18', roughness: 0.24, metalness: 0.82 }),
      );
      vault.add(core);

      const frameMaterial = new THREE.MeshBasicMaterial({ color: '#00d4ff', toneMapped: false });
      const ringGeometry = new THREE.BoxGeometry(2.38, 0.12, 2.38);
      [-1.02, 0, 1.02].forEach(y => {
        const ring = new THREE.Mesh(ringGeometry, frameMaterial);
        ring.position.y = y;
        vault.add(ring);
      });

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 1.48, 0.12),
        new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.18, metalness: 0.88, emissive: '#061e2b', emissiveIntensity: 0.65 }),
      );
      door.position.z = 1.11;
      vault.add(door);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.2, 24),
        new THREE.MeshStandardMaterial({ color: '#9ff5ff', roughness: 0.15, metalness: 0.72, emissive: '#00d4ff', emissiveIntensity: 1.25 }),
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.z = 1.23;
      vault.add(hub);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(4.6, 64),
        new THREE.MeshStandardMaterial({ color: '#07101b', roughness: 0.92, metalness: 0.08 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.7;
      scene.add(floor);

      const grid = new THREE.GridHelper(9, 18, '#0e7490', '#123047');
      grid.position.y = -1.68;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.28;
      scene.add(grid);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = false;
      controls.minDistance = 4.2;
      controls.maxDistance = 8.5;
      controls.target.set(0, 0, 0);

      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, root.clientWidth);
        const height = Math.max(320, root.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(root);

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const animate = () => {
        if (disposed || !renderer || !controls) return;
        frame = requestAnimationFrame(animate);
        if (!reduceMotion) vault.rotation.y += 0.0026;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      setError('');

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        controls?.dispose();
        scene.traverse(object => {
          const mesh = object as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.filter(Boolean).forEach(material => material.dispose?.());
        });
        renderer?.dispose();
        renderer?.forceContextLoss();
        renderer?.domElement.remove();
      };
    } catch (renderError) {
      console.error('VoxelVault 3D preview failed', renderError);
      if (!disposed) setError('3D preview is unavailable on this device. The store and checkout remain available.');
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      controls?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, []);

  return (
    <section className={styles.shell} aria-label="VoxelVault interactive 3D product preview">
      <div className={styles.status}><span /> SECURE_VAULT // 3D_ACTIVE</div>
      <div className={styles.canvas} ref={host} />
      <div className={styles.hint}>DRAG TO ROTATE · SCROLL OR PINCH TO ZOOM</div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
