'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function PropertyPassportCanvas({ passport }) {
  const hostRef = useRef(null);
  const [webglError, setWebglError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !passport) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('The 3D Property Passport is unavailable in this browser. Verification details remain available below.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05090a, 17, 38);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(10.5, 7.8, 14.5);
    camera.lookAt(0, 2.1, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    world.rotation.y = -0.45;
    scene.add(world);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(8.8, 9.3, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: 0x10191a, roughness: 0.92, metalness: 0.04 })
    );
    island.position.y = -0.34;
    world.add(island);

    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.12, 8.4),
      new THREE.MeshStandardMaterial({ color: 0x1b342b, roughness: 0.96 })
    );
    lawn.position.y = 0.05;
    world.add(lawn);

    const driveway = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 5.3),
      new THREE.MeshStandardMaterial({ color: 0x343b3b, roughness: 0.94 })
    );
    driveway.position.set(3.35, 0.12, 1.75);
    world.add(driveway);

    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.36, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x5b6261, roughness: 0.78 })
    );
    foundation.position.y = 0.28;
    world.add(foundation);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(6.15, 3.7, 4.85),
      new THREE.MeshStandardMaterial({ color: 0x35545a, emissive: 0x102a2e, emissiveIntensity: 0.26, roughness: 0.57, metalness: 0.07 })
    );
    body.position.y = 2.28;
    world.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4.05, 2.0, 4),
      new THREE.MeshStandardMaterial({ color: 0xa6d8cf, emissive: 0x173b37, emissiveIntensity: 0.22, roughness: 0.5 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.78;
    roof.position.y = 5.05;
    world.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.9, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x151b1c, roughness: 0.66 })
    );
    door.position.set(0, 1.45, 2.47);
    world.add(door);

    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x8ce7e3, emissive: 0x2b6f70, emissiveIntensity: 0.65, roughness: 0.24 });
    [[-1.9, 2.6], [1.9, 2.6], [-1.9, 1.4], [1.9, 1.4]].forEach(([x, y]) => {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 0.08), windowMaterial);
      window.position.set(x, y, 2.48);
      world.add(window);
    });

    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(5.1, 0.05, 12, 72),
      new THREE.MeshBasicMaterial({ color: 0x9ff5df, transparent: true, opacity: 0.46 })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.y = 0.28;
    world.add(beacon);

    const passportCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 0),
      new THREE.MeshStandardMaterial({ color: 0xc9fff2, emissive: 0x3d9e8c, emissiveIntensity: 1.2, roughness: 0.18, metalness: 0.35 })
    );
    passportCore.position.set(0, 7.3, 0);
    world.add(passportCore);

    const passportRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.05, 8, 52),
      new THREE.MeshBasicMaterial({ color: 0x9ff5df, transparent: true, opacity: 0.72 })
    );
    passportRing.position.copy(passportCore.position);
    passportRing.rotation.x = Math.PI / 2;
    world.add(passportRing);

    const lockedWing = new THREE.Group();
    lockedWing.position.set(-7.1, 0.1, -4.1);
    world.add(lockedWing);
    const vault = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.1, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x292724, emissive: 0x281c0d, emissiveIntensity: 0.28, roughness: 0.68, metalness: 0.2 })
    );
    vault.position.y = 1.55;
    lockedWing.add(vault);
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.55, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xe4bd77, emissive: 0x5a3c12, emissiveIntensity: 0.45 })
    );
    lock.position.set(0, 1.5, 0.85);
    lockedWing.add(lock);

    scene.add(new THREE.HemisphereLight(0xe9fffa, 0x101416, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(8, 14, 11);
    scene.add(key);
    const accent = new THREE.PointLight(0x9ff5df, 9, 12, 2);
    accent.position.set(0, 7.5, 1.5);
    scene.add(accent);
    const lockLight = new THREE.PointLight(0xe4bd77, 5, 8, 2);
    lockLight.position.set(-7, 3.8, -3.2);
    scene.add(lockLight);

    const grid = new THREE.GridHelper(30, 30, 0x2e5c53, 0x132320);
    grid.position.y = -0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

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
    const pointerDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!dragging) return;
      targetRotation += (event.clientX - lastX) * 0.008;
      lastX = event.clientX;
    };
    const pointerUp = (event) => {
      dragging = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    };
    const contextLost = (event) => {
      event.preventDefault();
      setWebglError('The browser released its WebGL context. The Property Passport evidence remains available below.');
    };

    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setAnimationLoop(() => {
      if (!dragging && !reducedMotion) targetRotation += 0.0008;
      world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, targetRotation, 0.06);
      passportCore.rotation.y += reducedMotion ? 0 : 0.008;
      passportRing.rotation.z += reducedMotion ? 0 : 0.004;
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
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
  }, [passport]);

  return (
    <section className="relative min-h-[500px] overflow-hidden rounded-[32px] border border-emerald-100/15 bg-[radial-gradient(circle_at_50%_18%,#17302c_0%,#09100f_48%,#050706_100%)]">
      <div ref={hostRef} className="h-[500px] w-full cursor-grab" aria-label="Rotatable 3D visualization of one canonical real-world Property Passport with a locked legal-interest chamber" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-100/15 bg-black/35 px-3 py-2 text-[9px] font-black tracking-[.12em] text-emerald-100/75">ONE CANONICAL PROPERTY ID</span>
        <span className="rounded-full border border-emerald-100/15 bg-black/35 px-3 py-2 text-[9px] font-black tracking-[.12em] text-emerald-100/75">3D MODEL v{passport?.modelVersion || 1}</span>
        <span className="rounded-full border border-amber-100/15 bg-black/35 px-3 py-2 text-[9px] font-black tracking-[.12em] text-amber-100/75">LEGAL INTEREST LOCKED</span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-[24px] border border-white/10 bg-black/55 p-4 backdrop-blur-xl md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="text-[9px] font-black tracking-[.14em] text-emerald-100/55">{passport?.state?.replaceAll('-', ' ').toUpperCase()}</div>
          <div className="mt-1 text-xl font-black tracking-[-.04em]">{passport?.title || 'Property Passport'}</div>
          <div className="mt-1 text-xs text-white/40">Canonical supply {passport?.canonicalMintSupply || 1} · Property Passport ≠ deed</div>
        </div>
        <div className="text-left md:text-right">
          <div className="text-[9px] font-black tracking-[.13em] text-white/35">VERIFIED TWIN STARTS</div>
          <div className="mt-1 text-xl font-black">${Number(passport?.pricing?.canonicalTwinStartingPriceUsd || 0).toLocaleString()}</div>
        </div>
      </div>
      {webglError ? <div className="absolute inset-x-4 top-20 rounded-2xl border border-red-200/15 bg-red-950/60 p-4 text-xs text-red-50/80">{webglError}</div> : null}
    </section>
  );
}
