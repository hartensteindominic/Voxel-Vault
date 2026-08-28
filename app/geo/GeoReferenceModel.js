'use client';

import { useEffect, useRef } from 'react';

const METERS_TO_SCENE = 0.075;

function outerRing(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0] : [];
  if (geometry.type === 'MultiPolygon') return Array.isArray(geometry.coordinates?.[0]?.[0]) ? geometry.coordinates[0][0] : [];
  return [];
}

function numericLevels(reference, sourceHeightMeters) {
  const reported = Number(String(reference?.tags?.levels || '').split(';')[0]);
  if (Number.isFinite(reported) && reported > 0) return Math.min(40, Math.round(reported));
  if (Number.isFinite(sourceHeightMeters) && sourceHeightMeters >= 5.5) return Math.min(40, Math.max(1, Math.round(sourceHeightMeters / 3)));
  return 1;
}

function toLocalMeters(longitude, latitude, originLongitude, originLatitude) {
  const cosLat = Math.max(0.15, Math.cos(originLatitude * Math.PI / 180));
  return {
    east: (Number(longitude) - originLongitude) * 111320 * cosLat,
    north: (Number(latitude) - originLatitude) * 111320,
  };
}

function terrainRelativeMeters(terrain, eastMeters, northMeters) {
  const samples = Array.isArray(terrain?.samples) ? terrain.samples : [];
  if (!terrain?.available || !samples.length) return 0;
  let weighted = 0;
  let weightTotal = 0;
  for (const sample of samples) {
    const dx = eastMeters - Number(sample.eastMeters || 0);
    const dz = northMeters - Number(sample.northMeters || 0);
    const distanceSquared = dx * dx + dz * dz;
    const weight = 1 / Math.max(1, distanceSquared);
    weighted += Number(sample.relativeElevationMeters || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weighted / weightTotal : 0;
}

function shapeFromGeometry(THREE, geometry, originLongitude, originLatitude) {
  const ring = outerRing(geometry);
  if (ring.length < 4) return null;
  const local = ring.slice(0, -1)
    .map(([lon, lat]) => toLocalMeters(lon, lat, originLongitude, originLatitude))
    .filter((point) => Number.isFinite(point.east) && Number.isFinite(point.north));
  if (local.length < 3) return null;
  const shape = new THREE.Shape();
  local.forEach((point, index) => {
    const x = point.east * METERS_TO_SCENE;
    const zAsShapeY = -point.north * METERS_TO_SCENE;
    if (index === 0) shape.moveTo(x, zAsShapeY); else shape.lineTo(x, zAsShapeY);
  });
  shape.closePath();
  return { shape, local };
}

export default function GeoReferenceModel({ reference }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import('three').then((THREE) => {
      if (disposed || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(300, mount.clientWidth || 320);
      const height = Math.max(320, mount.clientHeight || 400);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07100d, 20, 39);
      const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 120);
      scene.add(new THREE.HemisphereLight(0xf5fff9, 0x06100d, 2.15));
      const sun = new THREE.DirectionalLight(0xffffff, 3.1);
      sun.position.set(10, 16, 10);
      scene.add(sun);
      const accent = new THREE.PointLight(0x7ce9c4, 18, 32);
      accent.position.set(-7, 7, 8);
      scene.add(accent);

      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const mat = (params) => { const material = new THREE.MeshStandardMaterial(params); materials.push(material); return material; };
      const lineMat = (params) => { const material = new THREE.LineBasicMaterial(params); materials.push(material); return material; };

      const originLatitude = Number(reference?.latitude);
      const originLongitude = Number(reference?.longitude);
      const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
      const terrain = reference?.terrain || null;
      const terrainRadiusMeters = Math.max(60, Math.min(180, Number(terrain?.radiusMeters) || 90));
      const sceneRadius = terrainRadiusMeters * METERS_TO_SCENE;

      const baseGeometry = new THREE.CylinderGeometry(sceneRadius * 1.08, sceneRadius * 1.13, 0.26, 72);
      geometries.push(baseGeometry);
      const base = new THREE.Mesh(baseGeometry, mat({ color: 0x101d18, roughness: 0.95, metalness: 0.02 }));
      base.position.y = -0.32;
      root.add(base);

      if (terrain?.available && Array.isArray(terrain.samples) && terrain.samples.length >= 4) {
        const sorted = [...terrain.samples].sort((a, b) => Number(a.row) - Number(b.row) || Number(a.column) - Number(b.column));
        const vertices = [];
        for (let row = 0; row < 3; row += 1) {
          for (let column = 0; column < 3; column += 1) {
            const sample = sorted.find((item) => Number(item.row) === row && Number(item.column) === column);
            const east = Number(sample?.eastMeters ?? (column - 1) * terrainRadiusMeters);
            const north = Number(sample?.northMeters ?? (row - 1) * terrainRadiusMeters);
            const elevation = Number(sample?.relativeElevationMeters || 0);
            vertices.push(east * METERS_TO_SCENE, elevation * METERS_TO_SCENE, -north * METERS_TO_SCENE);
          }
        }
        const indices = [];
        for (let row = 0; row < 2; row += 1) {
          for (let column = 0; column < 2; column += 1) {
            const a = row * 3 + column;
            const b = a + 1;
            const c = a + 3;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
          }
        }
        const terrainGeometry = new THREE.BufferGeometry();
        terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        terrainGeometry.setIndex(indices);
        terrainGeometry.computeVertexNormals();
        geometries.push(terrainGeometry);
        const terrainMesh = new THREE.Mesh(terrainGeometry, mat({ color: 0x1d3028, roughness: 0.96, metalness: 0.01, side: THREE.DoubleSide }));
        root.add(terrainMesh);
        const terrainEdges = new THREE.EdgesGeometry(terrainGeometry, 1);
        geometries.push(terrainEdges);
        root.add(new THREE.LineSegments(terrainEdges, lineMat({ color: 0x4f8b76, transparent: true, opacity: 0.34 })));
      } else {
        const flatGeometry = new THREE.CircleGeometry(sceneRadius, 64);
        flatGeometry.rotateX(-Math.PI / 2);
        geometries.push(flatGeometry);
        const flat = new THREE.Mesh(flatGeometry, mat({ color: 0x172720, roughness: 0.96, metalness: 0.01 }));
        flat.position.y = -0.04;
        root.add(flat);
      }

      const compassGeometry = new THREE.RingGeometry(sceneRadius * 0.97, sceneRadius, 96);
      geometries.push(compassGeometry);
      const compass = new THREE.Mesh(compassGeometry, mat({ color: 0x7ce9c4, emissive: 0x123b30, emissiveIntensity: 0.7, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      compass.rotation.x = -Math.PI / 2;
      compass.position.y = -0.025;
      root.add(compass);

      const surroundings = Array.isArray(reference?.neighborhoodBuildings) ? reference.neighborhoodBuildings.slice(0, 20) : [];
      const primaryRecordId = String(reference?.source?.recordId || '');

      if (validOrigin) {
        for (const buildingRef of surroundings) {
          if (!buildingRef?.geometry) continue;
          const isPrimary = buildingRef.selected === true || String(buildingRef.id || '') === primaryRecordId;
          if (isPrimary) continue;
          const shaped = shapeFromGeometry(THREE, buildingRef.geometry, originLongitude, originLatitude);
          if (!shaped) continue;
          const center = buildingRef.center || {};
          const localCenter = toLocalMeters(center.longitude ?? originLongitude, center.latitude ?? originLatitude, originLongitude, originLatitude);
          const baseY = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;
          const sourceHeight = Math.max(2.2, Math.min(120, Number(buildingRef?.height?.referenceHeightMeters) || 3));
          const visualHeight = Math.max(0.18, sourceHeight * METERS_TO_SCENE);
          const geometry = new THREE.ExtrudeGeometry(shaped.shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometries.push(geometry);
          const mesh = new THREE.Mesh(geometry, mat({ color: 0x465b53, roughness: 0.76, metalness: 0.03, transparent: true, opacity: 0.7 }));
          mesh.position.y = baseY;
          root.add(mesh);
          const edges = new THREE.EdgesGeometry(geometry, 28);
          geometries.push(edges);
          const lines = new THREE.LineSegments(edges, lineMat({ color: 0x76988b, transparent: true, opacity: 0.25 }));
          lines.position.y = baseY;
          root.add(lines);
        }
      }

      const primaryGeometry = reference?.geometry;
      const shapedPrimary = validOrigin ? shapeFromGeometry(THREE, primaryGeometry, originLongitude, originLatitude) : null;
      if (reference?.found && shapedPrimary) {
        const sourceHeight = Math.max(2.2, Math.min(500, Number(reference?.height?.referenceHeightMeters) || 3));
        const visualHeight = Math.max(0.24, sourceHeight * METERS_TO_SCENE);
        const levels = numericLevels(reference, sourceHeight);
        const center = reference?.neighborhoodBuildings?.[0]?.center || { longitude: originLongitude, latitude: originLatitude };
        const localCenter = toLocalMeters(center.longitude ?? originLongitude, center.latitude ?? originLatitude, originLongitude, originLatitude);
        const baseY = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;

        const buildingGeometry = new THREE.ExtrudeGeometry(shapedPrimary.shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
        buildingGeometry.rotateX(-Math.PI / 2);
        geometries.push(buildingGeometry);
        const building = new THREE.Mesh(buildingGeometry, mat({ color: 0xd7e0dc, roughness: 0.54, metalness: 0.06, transparent: true, opacity: 0.98 }));
        building.position.y = baseY;
        root.add(building);

        const edgesGeometry = new THREE.EdgesGeometry(buildingGeometry, 18);
        geometries.push(edgesGeometry);
        const edges = new THREE.LineSegments(edgesGeometry, lineMat({ color: 0x8bf1ce, transparent: true, opacity: 0.86 }));
        edges.position.y = baseY;
        root.add(edges);

        const footprintPoints = shapedPrimary.local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.018, -point.north * METERS_TO_SCENE));
        if (footprintPoints.length) footprintPoints.push(footprintPoints[0].clone());
        const footprintGeometry = new THREE.BufferGeometry().setFromPoints(footprintPoints);
        geometries.push(footprintGeometry);
        root.add(new THREE.Line(footprintGeometry, lineMat({ color: 0x7ce9c4, transparent: true, opacity: 0.95 })));

        const bandCount = Math.min(levels - 1, 12);
        for (let floor = 1; floor <= bandCount; floor += 1) {
          const y = baseY + visualHeight * (floor / levels);
          const bandPoints = shapedPrimary.local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, y, -point.north * METERS_TO_SCENE));
          if (bandPoints.length) bandPoints.push(bandPoints[0].clone());
          const bandGeometry = new THREE.BufferGeometry().setFromPoints(bandPoints);
          geometries.push(bandGeometry);
          root.add(new THREE.Line(bandGeometry, lineMat({ color: 0x6fc4a7, transparent: true, opacity: 0.42 })));
        }

        const beaconRadius = Math.max(0.45, Math.min(2.4, 1.2 + Number(reference?.distanceMeters || 0) * 0.002));
        const beaconGeometry = new THREE.RingGeometry(beaconRadius, beaconRadius + 0.08, 72);
        geometries.push(beaconGeometry);
        const beacon = new THREE.Mesh(beaconGeometry, mat({ color: 0xffffff, emissive: 0x356f5e, emissiveIntensity: 0.9, transparent: true, opacity: 0.44, side: THREE.DoubleSide }));
        beacon.rotation.x = -Math.PI / 2;
        beacon.position.set(localCenter.east * METERS_TO_SCENE, baseY + visualHeight + 0.08, -localCenter.north * METERS_TO_SCENE);
        root.add(beacon);
      } else {
        const markerGeometry = new THREE.TorusGeometry(1.2, 0.08, 12, 72);
        geometries.push(markerGeometry);
        const marker = new THREE.Mesh(markerGeometry, mat({ color: 0x7ce9c4, emissive: 0x164c3c, emissiveIntensity: 1.15 }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.05;
        root.add(marker);
      }

      let azimuth = 0.72;
      let elevation = 0.53;
      let radius = Math.max(14, sceneRadius * 2.25);
      let dragging = false;
      let autoOrbit = true;
      let lastX = 0;
      let lastY = 0;
      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * c * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * c * radius);
        camera.lookAt(0, 0.8, 0);
      };
      updateCamera();
      const down = (event) => {
        dragging = true;
        autoOrbit = false;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };
      const move = (event) => {
        if (!dragging) return;
        azimuth -= (event.clientX - lastX) * 0.008;
        elevation = Math.max(0.16, Math.min(1.08, elevation + (event.clientY - lastY) * 0.005));
        lastX = event.clientX;
        lastY = event.clientY;
        updateCamera();
      };
      const up = (event) => {
        dragging = false;
        renderer.domElement.releasePointerCapture?.(event.pointerId);
      };
      const wheel = (event) => {
        autoOrbit = false;
        radius = Math.max(sceneRadius * 1.15, Math.min(sceneRadius * 3.5, radius + event.deltaY * 0.014));
        updateCamera();
      };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: true });

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        compass.rotation.z += 0.00075;
        if (autoOrbit) {
          azimuth += 0.00085;
          updateCamera();
        }
        renderer.render(scene, camera);
      };
      animate();
      const resize = () => {
        if (!mountRef.current) return;
        const nextW = Math.max(300, mount.clientWidth || 320);
        const nextH = Math.max(320, mount.clientHeight || 400);
        renderer.setSize(nextW, nextH);
        camera.aspect = nextW / nextH;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        mount.innerHTML = '';
      };
    });
    return () => { disposed = true; cleanup(); };
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters, reference?.neighborhoodBuildingCount, reference?.terrain?.source?.observedAt, reference?.measuredHeight?.status]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
