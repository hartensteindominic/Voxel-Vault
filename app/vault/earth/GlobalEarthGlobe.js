'use client';

import { useEffect, useRef } from 'react';

function toVector(THREE, latitude, longitude, radius) {
  const lat = Number(latitude) * Math.PI / 180;
  const lon = Number(longitude) * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

export default function GlobalEarthGlobe({ listings = [], selectedId = '', onSelect }) {
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(320, mount.clientWidth || 320);
      const height = Math.max(300, mount.clientHeight || 360);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
      camera.position.set(0, 0.2, 13.5);
      const root = new THREE.Group();
      scene.add(root);

      scene.add(new THREE.HemisphereLight(0xf7fbff, 0x06100d, 2.0));
      const rim = new THREE.DirectionalLight(0xb8f5e1, 3.4);
      rim.position.set(-5, 5, 7);
      scene.add(rim);

      const geometries = [];
      const materials = [];
      const earthGeometry = new THREE.SphereGeometry(4.1, 48, 32);
      geometries.push(earthGeometry);
      const earthMaterial = new THREE.MeshStandardMaterial({ color: 0x101916, roughness: 0.82, metalness: 0.12 });
      materials.push(earthMaterial);
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      root.add(earth);

      const gridGeometry = new THREE.SphereGeometry(4.13, 28, 18);
      geometries.push(gridGeometry);
      const gridMaterial = new THREE.MeshBasicMaterial({ color: 0x8edcc2, wireframe: true, transparent: true, opacity: 0.09 });
      materials.push(gridMaterial);
      root.add(new THREE.Mesh(gridGeometry, gridMaterial));

      const haloGeometry = new THREE.RingGeometry(4.55, 4.72, 96);
      geometries.push(haloGeometry);
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x7ce9c4, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
      materials.push(haloMaterial);
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.rotation.x = Math.PI / 2;
      root.add(halo);

      const markers = [];
      const markerGroup = new THREE.Group();
      root.add(markerGroup);
      listings.slice(0, 80).forEach((listing) => {
        if (!Number.isFinite(Number(listing?.latitude)) || !Number.isFinite(Number(listing?.longitude))) return;
        const selected = listing.id === selectedId;
        const geometry = new THREE.SphereGeometry(selected ? 0.12 : 0.075, 10, 8);
        geometries.push(geometry);
        const material = new THREE.MeshStandardMaterial({
          color: selected ? 0xffffff : 0x79efbc,
          emissive: selected ? 0x7765ff : 0x0f5c48,
          emissiveIntensity: selected ? 1.8 : 1.0,
          roughness: 0.25,
        });
        materials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(toVector(THREE, listing.latitude, listing.longitude, 4.22));
        mesh.userData.listingId = listing.id;
        markerGroup.add(mesh);
        markers.push(mesh);
      });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let targetX = 0.25;
      let targetY = -0.45;

      const down = (event) => {
        dragging = true;
        moved = false;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };
      const move = (event) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        targetY += dx * 0.006;
        targetX = Math.max(-1.05, Math.min(1.05, targetX + dy * 0.004));
        lastX = event.clientX;
        lastY = event.clientY;
      };
      const up = (event) => {
        dragging = false;
        if (moved || !markers.length) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(markers, false)[0];
        if (hit?.object?.userData?.listingId) onSelectRef.current?.(hit.object.userData.listingId);
      };

      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        root.rotation.x += (targetX - root.rotation.x) * 0.08;
        root.rotation.y += (targetY - root.rotation.y) * 0.08;
        halo.material.opacity = 0.18 + Math.sin(Date.now() * 0.0012) * 0.04;
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        if (!mountRef.current) return;
        const nextWidth = Math.max(320, mountRef.current.clientWidth || 320);
        const nextHeight = Math.max(300, mountRef.current.clientHeight || 360);
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        mount.innerHTML = '';
      };
    });

    return () => { dead = true; cleanup(); };
  }, [listings, selectedId]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
