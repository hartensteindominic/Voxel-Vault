'use client';

import { useEffect, useRef, useState } from 'react';

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildingHeightMeters(building) {
  const direct = finite(building?.height);
  if (direct !== null) return direct;
  const structured = finite(building?.height?.referenceHeightMeters)
    ?? finite(building?.height?.heightMeters)
    ?? finite(building?.height?.estimatedHeightMeters);
  if (structured !== null) return structured;
  const tagged = Number.parseFloat(String(building?.tags?.height || ''));
  if (Number.isFinite(tagged)) return tagged;
  const levels = Number.parseFloat(String(building?.tags?.levels || ''));
  return Number.isFinite(levels) ? levels * 3.1 : 7.5;
}

function exteriorRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0] ? [geometry.coordinates[0]] : [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => polygon?.[0]).filter(Boolean);
  return [];
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PropertyWorldMap({ selectedBuilding, buildings = [] }) {
  const mountRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mountRef.current || !selectedBuilding) return undefined;
    let dead = false;
    let cleanup = () => {};
    setError('');

    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setError('3D neighborhood map is unavailable in this browser.');
        return;
      }

      const width = Math.max(280, mount.clientWidth || 360);
      const height = Math.max(300, mount.clientHeight || 390);
      const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.12 : 1.35));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.shadowMap.enabled = !compact;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.setAttribute('aria-label', 'Focused 3D map of the selected property and nearby source-backed buildings.');
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xf8f1df, 14, 30);
      scene.add(new THREE.HemisphereLight(0xfffbef, 0x75837d, 2.4));
      const sun = new THREE.DirectionalLight(0xffe6c2, 3.4);
      sun.position.set(-5, 9, 8);
      sun.castShadow = !compact;
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xcfc5ff, 1.5);
      fill.position.set(8, 4, -7);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);
      let cameraDistance = compact ? 13.4 : 12.2;
      let cameraHeight = compact ? 9.2 : 8.4;
      const updateCamera = () => {
        camera.position.set(0, cameraHeight, cameraDistance);
        camera.lookAt(0, 0.4, 0);
      };
      updateCamera();

      const root = new THREE.Group();
      root.rotation.y = -0.38;
      scene.add(root);
      const resources = [];

      const groundGeometry = new THREE.CircleGeometry(11, 64);
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ead7, roughness: 0.98, metalness: 0 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.025;
      ground.receiveShadow = !compact;
      root.add(ground);
      resources.push(groundGeometry, groundMaterial);

      const grid = new THREE.GridHelper(20, 20, 0x9f8ec9, 0xd9cfc1);
      grid.position.y = 0.005;
      if (Array.isArray(grid.material)) grid.material.forEach((material) => { material.opacity = 0.18; material.transparent = true; });
      else { grid.material.opacity = 0.18; grid.material.transparent = true; }
      root.add(grid);

      const centerLat = finite(selectedBuilding.latitude) ?? 0;
      const centerLon = finite(selectedBuilding.longitude) ?? 0;
      const metersLat = 110540;
      const metersLon = Math.max(25000, 111320 * Math.cos(centerLat * Math.PI / 180));
      const unitsPerMeter = 1 / 18;
      const project = (longitude, latitude) => ({
        x: ((Number(longitude) - centerLon) * metersLon) * unitsPerMeter,
        z: -((Number(latitude) - centerLat) * metersLat) * unitsPerMeter,
      });

      const visibleBuildings = [selectedBuilding, ...buildings]
        .filter((item, index, list) => item && list.findIndex((candidate) => candidate?.atlasId === item.atlasId) === index)
        .filter((item) => finite(item.latitude) !== null && finite(item.longitude) !== null)
        .slice(0, compact ? 26 : 36);

      const selectedId = selectedBuilding.atlasId;
      for (const building of visibleBuildings) {
        const selected = building.atlasId === selectedId;
        const rings = exteriorRings(building.geometry);
        const heightMeters = Math.max(3.2, Math.min(48, buildingHeightMeters(building)));
        const heightUnits = Math.max(0.28, Math.min(2.65, heightMeters * unitsPerMeter));
        const material = new THREE.MeshStandardMaterial({
          color: selected ? 0x7138f5 : 0xd9d1c3,
          emissive: selected ? 0x2f116f : 0x000000,
          emissiveIntensity: selected ? 0.38 : 0,
          roughness: selected ? 0.58 : 0.86,
          metalness: 0.01,
        });
        resources.push(material);

        let addedFootprint = false;
        for (const ring of rings.slice(0, 2)) {
          const points = (Array.isArray(ring) ? ring : [])
            .map((coordinate) => {
              if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
              const point = project(coordinate[0], coordinate[1]);
              return Number.isFinite(point.x) && Number.isFinite(point.z) ? point : null;
            })
            .filter(Boolean);
          if (points.length < 3) continue;
          const shape = new THREE.Shape();
          points.forEach((point, index) => {
            if (index === 0) shape.moveTo(point.x, -point.z);
            else shape.lineTo(point.x, -point.z);
          });
          shape.closePath();
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: heightUnits, bevelEnabled: false, curveSegments: 1, steps: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = !compact;
          mesh.receiveShadow = !compact;
          root.add(mesh);
          resources.push(geometry);
          addedFootprint = true;

          if (selected) {
            const edgesGeometry = new THREE.EdgesGeometry(geometry, 24);
            const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.95 });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            root.add(edges);
            resources.push(edgesGeometry, edgesMaterial);
          }
        }

        if (!addedFootprint) {
          const point = project(building.longitude, building.latitude);
          const geometry = new THREE.BoxGeometry(selected ? 0.8 : 0.48, heightUnits, selected ? 0.8 : 0.48);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(point.x, heightUnits / 2, point.z);
          mesh.castShadow = !compact;
          root.add(mesh);
          resources.push(geometry);
        }
      }

      const ringGeometry = new THREE.RingGeometry(0.7, 0.92, 48);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      root.add(ring);
      resources.push(ringGeometry, ringMaterial);

      const beaconGeometry = new THREE.CylinderGeometry(0.035, 0.035, 3.1, 10);
      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x7138f5, transparent: true, opacity: 0.33 });
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.y = 1.55;
      root.add(beacon);
      resources.push(beaconGeometry, beaconMaterial);

      const pointers = new Map();
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let pinch = 0;
      let targetYaw = -0.38;
      const distance = () => {
        const pair = [...pointers.values()].slice(0, 2);
        return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
      };
      const down = (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        lastX = event.clientX;
        lastY = event.clientY;
        moved = false;
        if (pointers.size === 2) pinch = distance();
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const next = distance();
          if (pinch) cameraDistance = Math.max(7.2, Math.min(18.5, cameraDistance - (next - pinch) * 0.018));
          pinch = next;
          updateCamera();
          moved = true;
          return;
        }
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        targetYaw += dx * 0.006;
        cameraHeight = Math.max(5.4, Math.min(13.2, cameraHeight + dy * 0.012));
        updateCamera();
        lastX = event.clientX;
        lastY = event.clientY;
      };
      const up = (event) => {
        pointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (pointers.size < 2) pinch = 0;
      };
      const wheel = (event) => {
        event.preventDefault();
        cameraDistance = Math.max(7.2, Math.min(18.5, cameraDistance + Math.sign(event.deltaY) * 0.6));
        updateCamera();
      };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        root.rotation.y += (targetYaw - root.rotation.y) * 0.08;
        if (!reducedMotion && pointers.size === 0 && !moved) ring.rotation.z += 0.0015;
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        if (!mountRef.current) return;
        const nextWidth = Math.max(280, mountRef.current.clientWidth || 360);
        const nextHeight = Math.max(300, mountRef.current.clientHeight || 390);
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      const reset = () => {
        targetYaw = -0.38;
        cameraDistance = compact ? 13.4 : 12.2;
        cameraHeight = compact ? 9.2 : 8.4;
        updateCamera();
      };
      mount.dataset.ready = 'true';
      mount.__voxelMapReset = reset;
      mount.__voxelMapZoom = (delta) => {
        cameraDistance = Math.max(7.2, Math.min(18.5, cameraDistance + delta));
        updateCamera();
      };

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        resources.forEach((resource) => resource.dispose?.());
        renderer.dispose();
        mount.innerHTML = '';
      };
    }).catch(() => {
      if (!dead) setError('3D neighborhood map could not start.');
    });

    return () => {
      dead = true;
      cleanup();
    };
  }, [selectedBuilding, buildings]);

  const zoom = (delta) => mountRef.current?.__voxelMapZoom?.(delta);
  const reset = () => mountRef.current?.__voxelMapReset?.();
  const count = Array.isArray(buildings) ? buildings.length : 0;

  return <div className="propertyMapRoot">
    <div ref={mountRef} className="propertyMapMount"/>
    <div className="mapStatus"><i/><span>PROPERTY MAP · {Math.max(1, count)} BUILDINGS</span></div>
    <div className="mapControls">
      <button type="button" onClick={() => zoom(-0.8)} aria-label="Zoom property map in">+</button>
      <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom property map out">−</button>
      <button type="button" className="wide" onClick={reset}>RESET</button>
    </div>
    <div className="north">N ↑</div>
    {error ? <div className="mapFallback"><b>MAP PREVIEW</b><span>{error}</span><small>{Number(selectedBuilding?.latitude).toFixed(5)}, {Number(selectedBuilding?.longitude).toFixed(5)}</small></div> : null}
    <style jsx>{`
      .propertyMapRoot,.propertyMapMount{position:absolute;inset:0}.propertyMapRoot{overflow:hidden;background:linear-gradient(180deg,#efe7d8,#d9e8df)}
      .mapStatus{position:absolute;z-index:4;left:12px;top:12px;display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;background:rgba(255,250,240,.88);border:1px solid rgba(67,46,86,.12);backdrop-filter:blur(10px);color:#51445c;font-size:7px;font-weight:1000;letter-spacing:.1em}.mapStatus i{width:7px;height:7px;border-radius:50%;background:#7138f5;box-shadow:0 0 0 3px rgba(113,56,245,.12)}
      .mapControls{position:absolute;z-index:4;right:12px;top:12px;display:grid;grid-template-columns:36px 36px;gap:6px}.mapControls button{height:36px;border:1px solid rgba(67,46,86,.14);border-radius:12px;background:rgba(255,250,240,.9);color:#4d3563;font-size:18px;font-weight:1000;box-shadow:0 5px 16px rgba(52,39,30,.08)}.mapControls .wide{grid-column:1/-1;font-size:7px;letter-spacing:.1em}
      .north{position:absolute;z-index:4;right:15px;bottom:13px;padding:7px 9px;border-radius:10px;background:rgba(31,22,39,.76);color:#fff;font-size:8px;font-weight:1000;letter-spacing:.1em}
      .mapFallback{position:absolute;z-index:6;inset:0;display:grid;place-content:center;gap:7px;padding:30px;text-align:center;background:linear-gradient(150deg,#f6efdf,#e8e1f7);color:#55455f}.mapFallback b{font-size:10px;letter-spacing:.12em}.mapFallback span,.mapFallback small{font-size:11px;color:#7e7185}
      @media(max-width:520px){.mapStatus{left:9px;top:9px}.mapControls{right:9px;top:48px;grid-template-columns:34px 34px}.mapControls button{height:34px}.north{right:10px;bottom:10px}}
    `}</style>
  </div>;
}
