'use client';

import { useEffect, useRef, useState } from 'react';
import { feature as topoFeature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';

function toVector(THREE, latitude, longitude, radius) {
  const lat = Number(latitude) * Math.PI / 180;
  const lon = Number(longitude) * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function vectorToLatLng(vector) {
  const radius = vector.length() || 1;
  return {
    latitude: Math.asin(vector.y / radius) * 180 / Math.PI,
    longitude: Math.atan2(vector.x, vector.z) * 180 / Math.PI,
  };
}

function texturePoint(longitude, latitude, width, height) {
  const shifted = ((Number(longitude) + 90 + 540) % 360) - 180;
  return {
    x: ((shifted + 180) / 360) * width,
    y: ((90 - Number(latitude)) / 180) * height,
  };
}

function drawRing(context, ring, width, height) {
  if (!Array.isArray(ring) || ring.length < 3) return;
  let previous = null;
  ring.forEach((coordinate, index) => {
    const next = texturePoint(coordinate?.[0], coordinate?.[1], width, height);
    const jump = previous && Math.abs(next.x - previous.x) > width * 0.48;
    if (index === 0 || jump) context.moveTo(next.x, next.y);
    else context.lineTo(next.x, next.y);
    previous = next;
  });
  context.closePath();
}

function createEarthTexture(THREE, compact) {
  const width = compact ? 1024 : 1536;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const ocean = context.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#0c2530');
  ocean.addColorStop(0.55, '#0a1d24');
  ocean.addColorStop(1, '#07161c');
  context.fillStyle = ocean;
  context.fillRect(0, 0, width, height);

  const collection = topoFeature(countries110m, countries110m.objects.countries);
  const features = Array.isArray(collection?.features) ? collection.features : [];
  for (const country of features) {
    const id = Number(country?.id || 0);
    const shade = 40 + (Math.abs(id * 17) % 16);
    context.beginPath();
    if (country.geometry?.type === 'Polygon') {
      country.geometry.coordinates.forEach((ring) => drawRing(context, ring, width, height));
    } else if (country.geometry?.type === 'MultiPolygon') {
      country.geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => drawRing(context, ring, width, height)));
    }
    context.fillStyle = `hsl(151 18% ${shade}%)`;
    context.fill('evenodd');
    context.strokeStyle = 'rgba(195, 238, 222, .34)';
    context.lineWidth = compact ? 0.65 : 0.8;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function GlobalEarthGlobe({
  listings = [],
  selectedId = '',
  onSelect,
  atlasBuildings = [],
  selectedAtlasId = '',
  onAtlasSelect,
  onLocation,
}) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const dataRef = useRef({ listings, selectedId, atlasBuildings, selectedAtlasId });
  const onSelectRef = useRef(onSelect);
  const onAtlasSelectRef = useRef(onAtlasSelect);
  const onLocationRef = useRef(onLocation);
  const [webglError, setWebglError] = useState('');

  onSelectRef.current = onSelect;
  onAtlasSelectRef.current = onAtlasSelect;
  onLocationRef.current = onLocation;
  dataRef.current = { listings, selectedId, atlasBuildings, selectedAtlasId };

  useEffect(() => {
    engineRef.current?.updateMarkers?.({ listings, selectedId, atlasBuildings, selectedAtlasId });
  }, [listings, selectedId, atlasBuildings, selectedAtlasId]);

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setWebglError('3D globe is unavailable in this browser. Address search and quick locations still work.');
        return;
      }

      const initialWidth = Math.max(280, mount.clientWidth || 320);
      const initialHeight = Math.max(300, mount.clientHeight || 420);
      const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.18 : 1.35));
      renderer.setSize(initialWidth, initialHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.setAttribute('aria-label', 'Interactive world globe. Drag to rotate, pinch or scroll to zoom, tap a location to inspect nearby source-backed buildings.');
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 100);
      let cameraDistance = compact ? 13.9 : 13.2;
      camera.position.set(0, 0.18, cameraDistance);
      const root = new THREE.Group();
      scene.add(root);

      scene.add(new THREE.HemisphereLight(0xe7fff6, 0x041012, 2.25));
      const key = new THREE.DirectionalLight(0xfff6e7, 3.8);
      key.position.set(-5, 6, 8);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x76c8ff, 1.7);
      rim.position.set(7, -2, -4);
      scene.add(rim);

      const geometries = [];
      const materials = [];
      const textures = [];
      const earthGeometry = new THREE.SphereGeometry(4.1, compact ? 48 : 64, compact ? 32 : 48);
      geometries.push(earthGeometry);
      const earthTexture = createEarthTexture(THREE, compact);
      if (earthTexture) textures.push(earthTexture);
      const earthMaterial = new THREE.MeshStandardMaterial({
        map: earthTexture || null,
        color: earthTexture ? 0xffffff : 0x173328,
        roughness: 0.76,
        metalness: 0.04,
      });
      materials.push(earthMaterial);
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      root.add(earth);

      const gridGeometry = new THREE.SphereGeometry(4.115, 24, 16);
      geometries.push(gridGeometry);
      const gridMaterial = new THREE.MeshBasicMaterial({ color: 0xc0f1df, wireframe: true, transparent: true, opacity: 0.035 });
      materials.push(gridMaterial);
      root.add(new THREE.Mesh(gridGeometry, gridMaterial));

      const atmosphereGeometry = new THREE.SphereGeometry(4.28, 48, 32);
      geometries.push(atmosphereGeometry);
      const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0x74d5ff, transparent: true, opacity: 0.075, side: THREE.BackSide });
      materials.push(atmosphereMaterial);
      root.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

      const haloGeometry = new THREE.RingGeometry(4.48, 4.67, 96);
      geometries.push(haloGeometry);
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x79efbc, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
      materials.push(haloMaterial);
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.rotation.x = Math.PI / 2;
      root.add(halo);

      const markerGroup = new THREE.Group();
      const atlasGroup = new THREE.Group();
      root.add(markerGroup, atlasGroup);
      let listingMarkers = [];
      let atlasMarkers = [];
      let markerResources = [];

      function clearMarkers() {
        markerGroup.clear();
        atlasGroup.clear();
        markerResources.forEach((resource) => resource.dispose?.());
        markerResources = [];
        listingMarkers = [];
        atlasMarkers = [];
      }

      function updateMarkers(next = {}) {
        clearMarkers();
        (next.listings || []).slice(0, 80).forEach((listing) => {
          if (!Number.isFinite(Number(listing?.latitude)) || !Number.isFinite(Number(listing?.longitude))) return;
          const selected = listing.id === next.selectedId;
          const geometry = new THREE.SphereGeometry(selected ? 0.12 : 0.075, 10, 8);
          const material = new THREE.MeshStandardMaterial({
            color: selected ? 0xffffff : 0x79efbc,
            emissive: selected ? 0x7661ff : 0x0e5945,
            emissiveIntensity: selected ? 2 : 1.05,
            roughness: 0.24,
          });
          markerResources.push(geometry, material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(toVector(THREE, listing.latitude, listing.longitude, selected ? 4.28 : 4.22));
          mesh.userData.listingId = listing.id;
          markerGroup.add(mesh);
          listingMarkers.push(mesh);
        });

        (next.atlasBuildings || []).slice(0, 120).forEach((building) => {
          if (!Number.isFinite(Number(building?.latitude)) || !Number.isFinite(Number(building?.longitude))) return;
          const selected = building.atlasId === next.selectedAtlasId;
          const geometry = new THREE.OctahedronGeometry(selected ? 0.115 : 0.061, 0);
          const material = new THREE.MeshStandardMaterial({
            color: selected ? 0xffffff : 0xffb792,
            emissive: selected ? 0x6c56ff : 0x6a3222,
            emissiveIntensity: selected ? 1.8 : 0.78,
            roughness: 0.34,
            metalness: 0.08,
          });
          markerResources.push(geometry, material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(toVector(THREE, building.latitude, building.longitude, selected ? 4.29 : 4.19));
          mesh.userData.atlasId = building.atlasId;
          atlasGroup.add(mesh);
          atlasMarkers.push(mesh);
        });
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const activePointers = new Map();
      let moved = false;
      let dragX = 0;
      let dragY = 0;
      let pinchDistance = 0;
      let targetX = 0.18;
      let targetY = -0.42;
      let inViewport = true;
      let pageVisible = !document.hidden;

      const setPointer = (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      };
      const updateCamera = () => {
        camera.position.set(0, 0.18, cameraDistance);
      };

      const down = (event) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        moved = false;
        dragX = event.clientX;
        dragY = event.clientY;
        if (activePointers.size === 2) {
          const pair = [...activePointers.values()];
          pinchDistance = distanceBetween(pair[0], pair[1]);
        }
      };

      const move = (event) => {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointers.size >= 2) {
          const pair = [...activePointers.values()].slice(0, 2);
          const nextDistance = distanceBetween(pair[0], pair[1]);
          if (pinchDistance) {
            cameraDistance = Math.max(10.2, Math.min(17.2, cameraDistance - (nextDistance - pinchDistance) * 0.014));
            updateCamera();
          }
          pinchDistance = nextDistance;
          moved = true;
          return;
        }
        const dx = event.clientX - dragX;
        const dy = event.clientY - dragY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        targetY += dx * 0.006;
        targetX = Math.max(-1.05, Math.min(1.05, targetX + dy * 0.004));
        dragX = event.clientX;
        dragY = event.clientY;
      };

      const tap = (event) => {
        setPointer(event);
        raycaster.setFromCamera(pointer, camera);
        const atlasHit = raycaster.intersectObjects(atlasMarkers, false)[0];
        if (atlasHit?.object?.userData?.atlasId) {
          onAtlasSelectRef.current?.(atlasHit.object.userData.atlasId);
          return;
        }
        const listingHit = raycaster.intersectObjects(listingMarkers, false)[0];
        if (listingHit?.object?.userData?.listingId) {
          onSelectRef.current?.(listingHit.object.userData.listingId);
          return;
        }
        const earthHit = raycaster.intersectObject(earth, false)[0];
        if (!earthHit) return;
        const localPoint = root.worldToLocal(earthHit.point.clone());
        onLocationRef.current?.(vectorToLatLng(localPoint));
      };

      const up = (event) => {
        const singlePointerTap = activePointers.size === 1 && activePointers.has(event.pointerId) && !moved;
        activePointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (activePointers.size < 2) pinchDistance = 0;
        if (singlePointerTap) tap(event);
      };

      const wheel = (event) => {
        event.preventDefault();
        cameraDistance = Math.max(10.2, Math.min(17.2, cameraDistance + Math.sign(event.deltaY) * 0.48));
        updateCamera();
      };

      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      const observer = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => { inViewport = entries.some((entry) => entry.isIntersecting); }, { rootMargin: '180px' })
        : null;
      observer?.observe(mount);
      const visibility = () => { pageVisible = !document.hidden; };
      document.addEventListener('visibilitychange', visibility);

      let frame = 0;
      let lastRender = 0;
      const animate = (time = 0) => {
        frame = requestAnimationFrame(animate);
        if (!inViewport || !pageVisible) return;
        if (compact && time - lastRender < 33) return;
        lastRender = time;
        if (!reducedMotion && activePointers.size === 0) targetY += 0.00045;
        root.rotation.x += (targetX - root.rotation.x) * 0.075;
        root.rotation.y += (targetY - root.rotation.y) * 0.075;
        halo.material.opacity = reducedMotion ? 0.16 : 0.14 + Math.sin(time * 0.0014) * 0.03;
        renderer.render(scene, camera);
      };

      const resize = () => {
        if (!mountRef.current) return;
        const width = Math.max(280, mountRef.current.clientWidth || 320);
        const height = Math.max(300, mountRef.current.clientHeight || 420);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      const engine = {
        updateMarkers,
        reset() {
          targetX = 0.18;
          targetY = -0.42;
          cameraDistance = compact ? 13.9 : 13.2;
          updateCamera();
        },
        zoom(delta) {
          cameraDistance = Math.max(10.2, Math.min(17.2, cameraDistance + delta));
          updateCamera();
        },
      };
      engineRef.current = engine;
      updateMarkers(dataRef.current);
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        clearMarkers();
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        if (engineRef.current === engine) engineRef.current = null;
        mount.innerHTML = '';
      };
    }).catch(() => {
      if (!dead) setWebglError('3D globe could not start. Search and quick locations still work.');
    });

    return () => { dead = true; cleanup(); };
  }, []);

  if (webglError) {
    return <div className="globeFallback" role="status"><b>EARTH SEARCH IS STILL AVAILABLE</b><span>{webglError}</span><style jsx>{`.globeFallback{position:absolute;inset:0;display:grid;place-content:center;gap:8px;text-align:center;padding:28px;background:radial-gradient(circle at 50% 45%,#173a33,#091015 65%);color:#d8e7e2}.globeFallback b{font-size:10px;letter-spacing:.14em}.globeFallback span{max-width:320px;color:#899a95;font-size:11px;line-height:1.5}`}</style></div>;
  }

  return <div className="globeRoot">
    <div ref={mountRef} className="mount" />
    <div className="controls" aria-label="Globe controls">
      <button type="button" onClick={() => engineRef.current?.zoom?.(-0.7)} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => engineRef.current?.zoom?.(0.7)} aria-label="Zoom out">−</button>
      <button type="button" className="reset" onClick={() => engineRef.current?.reset?.()}>RESET</button>
    </div>
    <style jsx>{`.globeRoot,.mount{position:absolute;inset:0}.controls{position:absolute;right:12px;top:12px;z-index:3;display:flex;gap:6px}.controls button{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(4,10,12,.72);backdrop-filter:blur(12px);color:#edf7f3;font-size:18px;font-weight:800}.controls .reset{width:auto;padding:0 11px;font-size:7px;letter-spacing:.1em}@media(max-width:640px){.controls{right:9px;top:9px}.controls button{width:34px;height:34px}}`}</style>
  </div>;
}