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
  return { x: ((shifted + 180) / 360) * width, y: ((90 - Number(latitude)) / 180) * height };
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
  const width = compact ? 768 : 1280;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const ocean = context.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#102f39');
  ocean.addColorStop(0.55, '#0a1f27');
  ocean.addColorStop(1, '#061318');
  context.fillStyle = ocean;
  context.fillRect(0, 0, width, height);

  const collection = topoFeature(countries110m, countries110m.objects.countries);
  const features = Array.isArray(collection?.features) ? collection.features : [];
  for (const country of features) {
    context.beginPath();
    if (country.geometry?.type === 'Polygon') country.geometry.coordinates.forEach((ring) => drawRing(context, ring, width, height));
    if (country.geometry?.type === 'MultiPolygon') country.geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => drawRing(context, ring, width, height)));
    const id = Number(country?.id || 0);
    const shade = 38 + (Math.abs(id * 13) % 14);
    context.fillStyle = `hsl(151 17% ${shade}%)`;
    context.fill('evenodd');
    context.strokeStyle = 'rgba(191,239,222,.34)';
    context.lineWidth = compact ? 0.55 : 0.75;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PlanetStreamGlobe({
  listings = [],
  selectedId = '',
  onSelect,
  atlasBuildings = [],
  selectedAtlasId = '',
  onAtlasSelect,
  onLocation,
  onViewport,
  streaming = false,
  simpleMode = false,
}) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const dataRef = useRef({ listings, selectedId, atlasBuildings, selectedAtlasId });
  const callbacksRef = useRef({ onSelect, onAtlasSelect, onLocation, onViewport });
  const [webglError, setWebglError] = useState('');

  dataRef.current = { listings, selectedId, atlasBuildings, selectedAtlasId };
  callbacksRef.current = { onSelect, onAtlasSelect, onLocation, onViewport };

  useEffect(() => {
    engineRef.current?.updateMarkers?.(dataRef.current);
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
        setWebglError('3D globe is unavailable here.');
        return;
      }

      const initialWidth = Math.max(280, mount.clientWidth || 320);
      const initialHeight = Math.max(300, mount.clientHeight || 420);
      const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.35));
      renderer.setSize(initialWidth, initialHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.setAttribute('aria-label', 'Interactive world globe. Drag to rotate, pinch to zoom, and tap a voxel property.');
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 100);
      let cameraDistance = compact ? 13.9 : 13.1;
      camera.position.set(0, 0.18, cameraDistance);

      const root = new THREE.Group();
      root.rotation.x = 0.18;
      root.rotation.y = -0.42;
      scene.add(root);

      scene.add(new THREE.HemisphereLight(0xe7fff6, 0x041012, 2.15));
      const key = new THREE.DirectionalLight(0xfff5e6, 3.65);
      key.position.set(-5, 6, 8);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x74cfff, 1.55);
      rim.position.set(7, -2, -4);
      scene.add(rim);

      const resources = [];
      const textures = [];
      const earthGeometry = new THREE.SphereGeometry(4.1, compact ? 44 : 62, compact ? 28 : 44);
      const earthTexture = createEarthTexture(THREE, compact);
      if (earthTexture) textures.push(earthTexture);
      const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture || null, color: earthTexture ? 0xffffff : 0x173328, roughness: 0.78, metalness: 0.035 });
      resources.push(earthGeometry, earthMaterial);
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      root.add(earth);

      const gridGeometry = new THREE.SphereGeometry(4.118, 24, 16);
      const gridMaterial = new THREE.MeshBasicMaterial({ color: 0xc0f1df, wireframe: true, transparent: true, opacity: 0.03 });
      resources.push(gridGeometry, gridMaterial);
      root.add(new THREE.Mesh(gridGeometry, gridMaterial));

      const atmosphereGeometry = new THREE.SphereGeometry(4.29, compact ? 36 : 48, compact ? 24 : 32);
      const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0x74d5ff, transparent: true, opacity: 0.07, side: THREE.BackSide });
      resources.push(atmosphereGeometry, atmosphereMaterial);
      root.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

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

      function addCommunityHouse(listing, selected) {
        const radius = selected ? 4.34 : 4.24;
        const position = toVector(THREE, listing.latitude, listing.longitude, radius);
        const normal = position.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
        const scale = selected ? 1.45 : 1;
        const bodyGeometry = new THREE.BoxGeometry(0.12 * scale, 0.15 * scale, 0.12 * scale);
        const roofGeometry = new THREE.ConeGeometry(0.105 * scale, 0.09 * scale, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: selected ? 0xffffff : 0x79efbc, emissive: selected ? 0x6e5bff : 0x164f3d, emissiveIntensity: selected ? 1.5 : 0.7, roughness: 0.38 });
        const roofMaterial = new THREE.MeshStandardMaterial({ color: selected ? 0xd9d1ff : 0x25352f, emissive: selected ? 0x5844ce : 0x10231c, emissiveIntensity: 0.7, roughness: 0.48 });
        markerResources.push(bodyGeometry, roofGeometry, bodyMaterial, roofMaterial);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        body.quaternion.copy(quaternion);
        roof.quaternion.copy(quaternion);
        body.position.copy(position);
        roof.position.copy(position.clone().add(normal.clone().multiplyScalar(0.12 * scale)));
        body.userData.listingId = listing.id;
        roof.userData.listingId = listing.id;
        markerGroup.add(body, roof);
        listingMarkers.push(body, roof);
      }

      function updateMarkers(next = {}) {
        clearMarkers();
        (next.listings || []).slice(0, 96).forEach((listing) => {
          if (!Number.isFinite(Number(listing?.latitude)) || !Number.isFinite(Number(listing?.longitude))) return;
          const selected = listing.id === next.selectedId;
          if (listing?.kind === 'community-property') {
            addCommunityHouse(listing, selected);
            return;
          }
          const geometry = new THREE.SphereGeometry(selected ? 0.115 : 0.068, 8, 7);
          const material = new THREE.MeshStandardMaterial({ color: selected ? 0xffffff : 0x79efbc, emissive: selected ? 0x7560ff : 0x0e5945, emissiveIntensity: selected ? 2 : 1, roughness: 0.28 });
          markerResources.push(geometry, material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(toVector(THREE, listing.latitude, listing.longitude, selected ? 4.28 : 4.21));
          mesh.userData.listingId = listing.id;
          markerGroup.add(mesh);
          listingMarkers.push(mesh);
        });

        (next.atlasBuildings || []).slice(0, compact ? 170 : 240).forEach((building) => {
          if (!Number.isFinite(Number(building?.latitude)) || !Number.isFinite(Number(building?.longitude))) return;
          const selected = building.atlasId === next.selectedAtlasId;
          const geometry = new THREE.OctahedronGeometry(selected ? 0.105 : 0.052, 0);
          const material = new THREE.MeshStandardMaterial({ color: selected ? 0xffffff : 0xffb792, emissive: selected ? 0x6c56ff : 0x6a3222, emissiveIntensity: selected ? 1.7 : 0.72, roughness: 0.36 });
          markerResources.push(geometry, material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(toVector(THREE, building.latitude, building.longitude, selected ? 4.29 : 4.18));
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
      let viewportTimer = 0;

      function visibleCenter() {
        const worldFront = new THREE.Vector3(0, 0, 4.1);
        const localFront = root.worldToLocal(worldFront.clone());
        return vectorToLatLng(localFront);
      }

      function emitViewport() {
        const center = visibleCenter();
        callbacksRef.current.onViewport?.({ ...center, cameraDistance });
      }

      function scheduleViewport(delay = 420) {
        window.clearTimeout(viewportTimer);
        window.setTimeout(emitViewport, delay);
      }

      const setPointer = (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      };

      const updateCamera = () => camera.position.set(0, 0.18, cameraDistance);
      const down = (event) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        moved = false;
        dragX = event.clientX;
        dragY = event.clientY;
        if (activePointers.size === 2) {
          const pair = [...activePointers.values()];
          pinchDistance = pointerDistance(pair[0], pair[1]);
        }
      };

      const move = (event) => {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointers.size >= 2) {
          const pair = [...activePointers.values()].slice(0, 2);
          const nextDistance = pointerDistance(pair[0], pair[1]);
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
        if (atlasHit?.object?.userData?.atlasId) return callbacksRef.current.onAtlasSelect?.(atlasHit.object.userData.atlasId);
        const listingHit = raycaster.intersectObjects(listingMarkers, false)[0];
        if (listingHit?.object?.userData?.listingId) return callbacksRef.current.onSelect?.(listingHit.object.userData.listingId);
        const earthHit = raycaster.intersectObject(earth, false)[0];
        if (!earthHit) return;
        const localPoint = root.worldToLocal(earthHit.point.clone());
        callbacksRef.current.onLocation?.(vectorToLatLng(localPoint));
      };

      const up = (event) => {
        const singlePointerTap = activePointers.size === 1 && activePointers.has(event.pointerId) && !moved;
        activePointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (activePointers.size < 2) pinchDistance = 0;
        if (singlePointerTap) tap(event);
        else scheduleViewport();
      };

      const wheel = (event) => {
        event.preventDefault();
        cameraDistance = Math.max(10.2, Math.min(17.2, cameraDistance + Math.sign(event.deltaY) * 0.48));
        updateCamera();
        scheduleViewport(300);
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
        root.rotation.x += (targetX - root.rotation.x) * 0.075;
        root.rotation.y += (targetY - root.rotation.y) * 0.075;
        if (!reducedMotion && activePointers.size === 0 && Math.abs(targetY - root.rotation.y) < 0.002) targetY += 0.00018;
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
          cameraDistance = compact ? 13.9 : 13.1;
          updateCamera();
          scheduleViewport(500);
        },
        zoom(delta) {
          cameraDistance = Math.max(10.2, Math.min(17.2, cameraDistance + delta));
          updateCamera();
          scheduleViewport(280);
        },
        streamHere() { emitViewport(); },
      };
      engineRef.current = engine;
      updateMarkers(dataRef.current);
      animate();
      scheduleViewport(900);

      cleanup = () => {
        window.clearTimeout(viewportTimer);
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
        resources.forEach((resource) => resource.dispose?.());
        textures.forEach((texture) => texture.dispose?.());
        renderer.dispose();
        if (engineRef.current === engine) engineRef.current = null;
        mount.innerHTML = '';
      };
    }).catch(() => {
      if (!dead) setWebglError('3D globe could not start.');
    });

    return () => { dead = true; cleanup(); };
  }, [simpleMode]);

  if (webglError) {
    return <div className="planetFallback" role="status"><b>3D WORLD UNAVAILABLE</b><span>{webglError}</span><style jsx>{`.planetFallback{position:absolute;inset:0;display:grid;place-content:center;gap:8px;text-align:center;padding:28px;background:radial-gradient(circle at 50% 45%,#173a33,#091015 65%);color:#d8e7e2}.planetFallback b{font-size:10px;letter-spacing:.14em}.planetFallback span{max-width:320px;color:#899a95;font-size:11px;line-height:1.5}`}</style></div>;
  }

  return <div className="planetRoot">
    <div ref={mountRef} className="planetMount" />
    <div className="planetStatus"><i className={streaming ? 'busy' : ''}/><span>{simpleMode ? 'PUBLIC 3D PROPERTY WORLD' : streaming ? 'STREAMING VISIBLE REGION' : 'GLOBAL ON-DEMAND ATLAS'}</span></div>
    <div className="planetControls" aria-label="Globe controls">
      <button type="button" onClick={() => engineRef.current?.zoom?.(-0.7)} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => engineRef.current?.zoom?.(0.7)} aria-label="Zoom out">−</button>
      {!simpleMode ? <button type="button" className="stream" onClick={() => engineRef.current?.streamHere?.()}>LOAD HERE</button> : null}
      <button type="button" className="stream" onClick={() => engineRef.current?.reset?.()}>RESET</button>
    </div>
    <style jsx>{`.planetRoot,.planetMount{position:absolute;inset:0}.planetStatus{position:absolute;left:12px;top:12px;z-index:3;display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(4,10,12,.7);backdrop-filter:blur(12px);color:#b8c9c4;font-size:7px;font-weight:900;letter-spacing:.1em}.planetStatus i{width:7px;height:7px;border-radius:50%;background:#79efbc;box-shadow:0 0 12px rgba(121,239,188,.5)}.planetStatus i.busy{animation:planetPulse .9s ease-in-out infinite alternate}.planetControls{position:absolute;right:12px;top:12px;z-index:3;display:flex;gap:6px}.planetControls button{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(4,10,12,.72);backdrop-filter:blur(12px);color:#edf7f3;font-size:18px;font-weight:800}.planetControls .stream{width:auto;padding:0 10px;font-size:7px;letter-spacing:.08em}@keyframes planetPulse{from{opacity:.35;transform:scale(.75)}to{opacity:1;transform:scale(1.15)}}@media(max-width:640px){.planetStatus{left:9px;top:9px;max-width:55%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.planetControls{right:9px;top:48px;display:grid;grid-template-columns:34px 34px}.planetControls button{width:34px;height:34px}.planetControls .stream{grid-column:span 2;width:74px}}`}</style>
  </div>;
}
