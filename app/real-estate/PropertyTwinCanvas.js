'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function PropertyTwinCanvas({ className = '' }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(10.5, 7.4, 12.5);
    camera.lookAt(0, 1.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.y = -0.55;
    scene.add(root);

    const landMaterial = new THREE.MeshStandardMaterial({ color: 0xa8d672, roughness: 0.82, metalness: 0.04 });
    const land = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.38, 7.4), landMaterial);
    land.position.y = -0.2;
    land.receiveShadow = true;
    root.add(land);

    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.06, 4.7),
      new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.9 })
    );
    walkway.position.set(0, 0.03, 2.05);
    walkway.receiveShadow = true;
    root.add(walkway);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 3.15, 4.35),
      new THREE.MeshStandardMaterial({ color: 0xf1e9d9, roughness: 0.62 })
    );
    base.position.y = 1.55;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.65, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xe6dcc7, roughness: 0.65 })
    );
    upper.position.set(-0.35, 3.7, -0.1);
    upper.castShadow = true;
    root.add(upper);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.75, 1.85, 4),
      new THREE.MeshStandardMaterial({ color: 0x263246, roughness: 0.5, metalness: 0.08 })
    );
    roof.position.set(-0.35, 5.25, -0.1);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.88;
    roof.castShadow = true;
    root.add(roof);

    const porch = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 0.22, 1.18),
      new THREE.MeshStandardMaterial({ color: 0x72533d, roughness: 0.72 })
    );
    porch.position.set(0.05, 0.28, 2.55);
    porch.castShadow = true;
    root.add(porch);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 2.15, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x355363, roughness: 0.45 })
    );
    door.position.set(0.1, 1.35, 2.23);
    root.add(door);

    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x8ed6e8, roughness: 0.2, metalness: 0.15, emissive: 0x18384a, emissiveIntensity: 0.25 });
    [
      [-1.75, 1.65, 2.24],
      [1.85, 1.65, 2.24],
      [-1.25, 3.85, 1.69],
      [0.55, 3.85, 1.69],
    ].forEach(([x, y, z]) => {
      const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.08, 0.1), windowMaterial);
      windowMesh.position.set(x, y, z);
      root.add(windowMesh);
    });

    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 1.55, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x9d6b50, roughness: 0.9 })
    );
    chimney.position.set(1.25, 5.2, -0.55);
    chimney.castShadow = true;
    root.add(chimney);

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x704f36, roughness: 0.9 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4b8c57, roughness: 0.8 });
    [[-3.5, -2.05], [3.6, -1.7]].forEach(([x, z], index) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 8), trunkMaterial);
      trunk.position.set(x, 0.9, z);
      trunk.castShadow = true;
      root.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(index ? 1.05 : 1.25, 1), leafMaterial);
      crown.position.set(x, 2.05, z);
      crown.castShadow = true;
      root.add(crown);
    });

    const parcel = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(9.9, 0.42, 7.7)),
      new THREE.LineBasicMaterial({ color: 0xb6ff5f, transparent: true, opacity: 0.85 })
    );
    parcel.position.y = -0.18;
    root.add(parcel);

    const grid = new THREE.GridHelper(22, 22, 0x6a7e91, 0x29394a);
    grid.position.y = -0.42;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    scene.add(grid);

    const ambient = new THREE.HemisphereLight(0xf6fbff, 0x24333b, 2.15);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(7, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.PointLight(0xb6ff5f, 18, 20, 2);
    rim.position.set(-6, 5, -4);
    scene.add(rim);

    let width = 1;
    let height = 1;
    const resize = () => {
      width = Math.max(host.clientWidth, 1);
      height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let dragging = false;
    let lastX = 0;
    let targetY = root.rotation.y;
    let targetX = 0;

    const down = (event) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!dragging) return;
      const delta = event.clientX - lastX;
      lastX = event.clientX;
      targetY += delta * 0.009;
      targetX = THREE.MathUtils.clamp(targetX + (event.movementY || 0) * 0.0025, -0.12, 0.16);
    };
    const up = (event) => {
      dragging = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    };

    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      if (!dragging) targetY += 0.00135;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetY, 0.075);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, targetX + Math.sin(t * 0.6) * 0.012, 0.04);
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose?.());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-label="Interactive demo 3D digital twin of a house and parcel" />;
}
