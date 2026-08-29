'use client';

import { useEffect, useRef, useState } from 'react';

export default function EstateScene({ estate }) {
  const hostRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !estate) return undefined;

    let disposed = false;
    let cleanup = () => {};
    setError('');

    import('three').then((THREE) => {
      if (disposed || !hostRef.current) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setError('3D is unavailable in this browser. The property facts and purchase controls still work.');
        return;
      }

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0b1412, 19, 42);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
      const world = new THREE.Group();
      scene.add(world);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';
      host.replaceChildren(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xf5fff9, 0x14251f, 2.45));
      const sun = new THREE.DirectionalLight(0xffffff, 3.1);
      sun.position.set(10, 15, 8);
      scene.add(sun);
      const accentLight = new THREE.PointLight(new THREE.Color(estate.accent), 26, 32);
      accentLight.position.set(-7, 5, 7);
      scene.add(accentLight);

      const geometries = [];
      const materials = [];
      const makeMaterial = (color, options = {}) => {
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: options.roughness ?? 0.67,
          metalness: options.metalness ?? 0.04,
          transparent: Boolean(options.transparent),
          opacity: options.opacity ?? 1,
          emissive: options.emissive || 0x000000,
          emissiveIntensity: options.emissiveIntensity || 0,
        });
        materials.push(material);
        return material;
      };
      const box = (width, height, depth, color, x, y, z, options = {}) => {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, makeMaterial(color, options));
        mesh.position.set(x, y, z);
        world.add(mesh);
        return mesh;
      };
      const glass = (width, height, x, y, z) => box(width, height, 0.09, estate.accent, x, y, z, {
        roughness: 0.16,
        metalness: 0.22,
        transparent: true,
        opacity: 0.58,
        emissive: estate.accent,
        emissiveIntensity: 0.18,
      });

      box(18, 0.55, 15, estate.terrain, 0, -0.6, 0, { roughness: 0.98 });
      box(14.4, 0.14, 11.4, 0x19231f, 0, -0.23, 0, { roughness: 0.94 });
      const structure = estate.structure;
      const roof = estate.roof;

      if (estate.architecture === 'reference-home') {
        box(8.2, 2.65, 5.4, structure, 0, 1.15, 0.2);
        box(7.5, 2.45, 4.8, structure, 0.3, 3.65, -0.1);
        box(8.8, 0.32, 5.9, roof, 0, 2.62, 0.2);
        box(8.1, 0.32, 5.3, roof, 0.3, 5.03, -0.1);
        glass(4.8, 1.55, 0, 1.25, 2.94);
        glass(4.1, 1.45, 0.3, 3.7, 2.34);
        box(2.1, 0.16, 2.6, 0x546e5f, -4.7, -0.06, 2.2);
      } else if (estate.architecture === 'courtyard') {
        box(5.3, 2.8, 3.4, structure, -3.5, 1.25, -1.6);
        box(4.5, 2.8, 3.4, structure, 3.8, 1.25, -1.6);
        box(3.2, 2.8, 4.5, structure, 0.1, 1.25, 2.1);
        box(5.7, 0.28, 3.7, roof, -3.5, 2.8, -1.6);
        box(4.9, 0.28, 3.7, roof, 3.8, 2.8, -1.6);
        glass(2.7, 1.85, 0.1, 1.35, -0.18);
      } else if (estate.architecture === 'glass') {
        box(11.2, 2.7, 4.4, structure, 0, 1.2, 0);
        box(12.5, 0.34, 5.5, roof, 0, 2.75, 0);
        glass(9.5, 1.85, 0, 1.3, 2.22);
        box(5.6, 0.18, 2.7, 0x25566a, 1.7, -0.08, 4.3, { roughness: 0.2, metalness: 0.25 });
      } else if (estate.architecture === 'waterfront') {
        box(9, 2.8, 4.9, structure, -1.1, 1.25, 0.4);
        box(6.4, 2.55, 3.9, structure, 2.1, 3.75, -0.2);
        box(9.4, 0.3, 5.2, roof, -1.1, 2.82, 0.4);
        box(6.8, 0.3, 4.3, roof, 2.1, 5.17, -0.2);
        glass(4.8, 1.9, -1.6, 1.35, 2.88);
        glass(4, 1.7, 2.1, 3.78, 1.78);
        box(10.8, 0.18, 2.3, 0x26566b, 0.2, -0.08, 4.9, { roughness: 0.2 });
      } else if (estate.architecture === 'villa') {
        box(4.8, 3.1, 5.3, structure, -4, 1.4, 0);
        box(4.8, 3.1, 5.3, structure, 4, 1.4, 0);
        box(4.7, 2.7, 3.9, structure, 0, 4, -1);
        box(5.2, 0.34, 5.7, roof, -4, 3.1, 0);
        box(5.2, 0.34, 5.7, roof, 4, 3.1, 0);
        box(5.1, 0.34, 4.3, roof, 0, 5.5, -1);
        glass(3.5, 1.75, 0, 4, 0.98);
      } else {
        box(8.4, 2.6, 4.4, structure, -1.2, 1.2, 0.7);
        box(7.2, 2.5, 3.9, structure, 1.3, 3.65, -0.2);
        box(6.1, 2.3, 3.3, structure, -0.9, 5.95, -0.7);
        box(8.8, 0.3, 4.8, roof, -1.2, 2.68, 0.7);
        box(7.7, 0.3, 4.3, roof, 1.3, 5.03, -0.2);
        box(6.5, 0.3, 3.7, roof, -0.9, 7.25, -0.7);
        glass(4.9, 1.6, -1.2, 1.25, 2.93);
        glass(4.4, 1.5, 1.3, 3.68, 1.78);
      }

      for (let index = 0; index < 8; index += 1) {
        const x = (index % 2 ? 1 : -1) * (6.3 + (index % 3) * 0.5);
        const z = -4.8 + (index * 1.47) % 9.7;
        box(0.25, 1.25, 0.25, 0x6b5848, x, 0.45, z);
        const geometry = new THREE.SphereGeometry(0.62 + (index % 3) * 0.08, 8, 6);
        geometries.push(geometry);
        const crown = new THREE.Mesh(geometry, makeMaterial(0x31543c, { roughness: 0.98 }));
        crown.position.set(x, 1.35, z);
        world.add(crown);
      }

      const ringGeometry = new THREE.RingGeometry(7.15, 7.28, 64);
      geometries.push(ringGeometry);
      const ring = new THREE.Mesh(ringGeometry, makeMaterial(estate.accent, { emissive: estate.accent, emissiveIntensity: 0.48, transparent: true, opacity: 0.48 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.24;
      world.add(ring);

      let azimuth = 0.72;
      let elevation = 0.5;
      let radius = estate.architecture === 'sky-villa' ? 25 : 22;
      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let pinchDistance = 0;
      const activePointers = new Map();

      const updateCamera = () => {
        const cosine = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * cosine * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * cosine * radius);
        camera.lookAt(0, estate.architecture === 'sky-villa' ? 2.4 : 1.55, 0);
      };
      updateCamera();

      const pointerDown = (event) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        dragging = true;
        pointerX = event.clientX;
        pointerY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };
      const pointerMove = (event) => {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...activePointers.values()];
        if (points.length >= 2) {
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          if (pinchDistance) radius = Math.max(15, Math.min(31, radius + (pinchDistance - distance) * 0.035));
          pinchDistance = distance;
        } else if (dragging) {
          azimuth -= (event.clientX - pointerX) * 0.008;
          elevation = Math.max(0.22, Math.min(1.02, elevation + (event.clientY - pointerY) * 0.005));
          pointerX = event.clientX;
          pointerY = event.clientY;
        }
        updateCamera();
      };
      const pointerUp = (event) => {
        activePointers.delete(event.pointerId);
        dragging = activePointers.size > 0;
        if (activePointers.size < 2) pinchDistance = 0;
      };
      const wheel = (event) => {
        radius = Math.max(15, Math.min(31, radius + Math.sign(event.deltaY) * 1.1));
        updateCamera();
      };

      renderer.domElement.addEventListener('pointerdown', pointerDown);
      renderer.domElement.addEventListener('pointermove', pointerMove);
      renderer.domElement.addEventListener('pointerup', pointerUp);
      renderer.domElement.addEventListener('pointercancel', pointerUp);
      renderer.domElement.addEventListener('wheel', wheel, { passive: true });

      const resize = () => {
        if (!hostRef.current) return;
        const width = Math.max(280, hostRef.current.clientWidth || 280);
        const height = Math.max(360, hostRef.current.clientHeight || 360);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      let frame = 0;
      let time = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        time += 0.01;
        accentLight.intensity = 24 + Math.sin(time) * 3;
        ring.material.opacity = 0.42 + Math.sin(time * 0.7) * 0.07;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerdown', pointerDown);
        renderer.domElement.removeEventListener('pointermove', pointerMove);
        renderer.domElement.removeEventListener('pointerup', pointerUp);
        renderer.domElement.removeEventListener('pointercancel', pointerUp);
        renderer.domElement.removeEventListener('wheel', wheel);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      };
    }).catch(() => setError('3D could not load. The property facts and purchase controls still work.'));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [estate]);

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} aria-label={`Interactive 3D model of ${estate?.name || 'digital property'}`}>
      {error ? <div role="status" style={{ position: 'absolute', inset: 20, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'rgba(255,255,255,.58)', fontSize: 12, lineHeight: 1.5 }}>{error}</div> : null}
    </div>
  );
}
