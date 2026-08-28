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

function averageLocalCenter(local = []) {
  if (!local.length) return { east: 0, north: 0 };
  const total = local.reduce((sum, point) => ({ east: sum.east + point.east, north: sum.north + point.north }), { east: 0, north: 0 });
  return { east: total.east / local.length, north: total.north / local.length };
}

function cameraPreset(viewMode, sceneRadius, compactMode) {
  if (viewMode === 'top') return { azimuth: 0.02, elevation: 1.36, radius: Math.max(compactMode ? 9.5 : 10.5, sceneRadius * 1.55), autoOrbit: false };
  if (viewMode === 'street') return { azimuth: 0.44, elevation: 0.2, radius: Math.max(compactMode ? 8 : 9, sceneRadius * 1.25), autoOrbit: false };
  return { azimuth: 0.72, elevation: 0.5, radius: Math.max(compactMode ? 10 : 11, sceneRadius * 1.72), autoOrbit: true };
}

export default function GeoReferenceModel({ reference, viewMode = 'orbit', resetKey = 0 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (disposed || !mountRef.current) return;
      const mount = mountRef.current;
      const compactMode = window.matchMedia?.('(max-width: 680px)').matches === true;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      const width = Math.max(300, mount.clientWidth || 320);
      const height = Math.max(320, mount.clientHeight || 400);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactMode ? 1.18 : 1.32));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0b1519, 19, 46);
      const camera = new THREE.PerspectiveCamera(compactMode ? 42 : 38, width / height, 0.1, 150);
      scene.add(new THREE.HemisphereLight(0xfffbf5, 0x071310, 2.3));

      const sun = new THREE.DirectionalLight(0xfff4dd, 3.15);
      sun.position.set(11, 17, 8);
      scene.add(sun);

      const mintLight = new THREE.PointLight(0x8bf1ce, 17, 34);
      mintLight.position.set(-8, 8, 8);
      scene.add(mintLight);

      const peachLight = new THREE.PointLight(0xffc7a8, 6.5, 26);
      peachLight.position.set(8, 5, -6);
      scene.add(peachLight);

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
      const primaryRecordId = String(reference?.source?.recordId || '');
      const primaryGeometry = reference?.geometry;
      const shapedPrimary = validOrigin ? shapeFromGeometry(THREE, primaryGeometry, originLongitude, originLatitude) : null;
      const primaryCenterLocal = shapedPrimary ? averageLocalCenter(shapedPrimary.local) : { east: 0, north: 0 };

      const baseGeometry = new THREE.CylinderGeometry(sceneRadius * 1.09, sceneRadius * 1.14, 0.34, 72);
      geometries.push(baseGeometry);
      const base = new THREE.Mesh(baseGeometry, mat({ color: 0x17231f, roughness: 0.93, metalness: 0.02 }));
      base.position.y = -0.38;
      root.add(base);

      const underGlowGeometry = new THREE.RingGeometry(sceneRadius * 0.95, sceneRadius * 1.07, 96);
      geometries.push(underGlowGeometry);
      const underGlow = new THREE.Mesh(underGlowGeometry, mat({ color: 0x8bf1ce, emissive: 0x315d4f, emissiveIntensity: 0.75, transparent: true, opacity: 0.09, side: THREE.DoubleSide }));
      underGlow.rotation.x = -Math.PI / 2;
      underGlow.position.y = -0.19;
      root.add(underGlow);

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
        const terrainMesh = new THREE.Mesh(terrainGeometry, mat({ color: 0x294239, roughness: 0.94, metalness: 0.01, side: THREE.DoubleSide }));
        root.add(terrainMesh);
        const terrainEdges = new THREE.EdgesGeometry(terrainGeometry, 1);
        geometries.push(terrainEdges);
        root.add(new THREE.LineSegments(terrainEdges, lineMat({ color: 0x8bcbb5, transparent: true, opacity: 0.14 })));
      } else {
        const flatGeometry = new THREE.CircleGeometry(sceneRadius, 64);
        flatGeometry.rotateX(-Math.PI / 2);
        geometries.push(flatGeometry);
        const flat = new THREE.Mesh(flatGeometry, mat({ color: 0x263d35, roughness: 0.96, metalness: 0.01 }));
        flat.position.y = -0.04;
        root.add(flat);
      }

      [0.56, 0.82].forEach((ratio) => {
        const ringGeometry = new THREE.RingGeometry(sceneRadius * ratio - 0.014, sceneRadius * ratio + 0.014, 80);
        geometries.push(ringGeometry);
        const ring = new THREE.Mesh(ringGeometry, mat({ color: 0xbaf7e2, transparent: true, opacity: ratio === 0.82 ? 0.075 : 0.045, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.012;
        root.add(ring);
      });

      const compassGeometry = new THREE.RingGeometry(sceneRadius * 0.97, sceneRadius, 96);
      geometries.push(compassGeometry);
      const compass = new THREE.Mesh(compassGeometry, mat({ color: 0x8bf1ce, emissive: 0x183f34, emissiveIntensity: 0.7, transparent: true, opacity: 0.31, side: THREE.DoubleSide }));
      compass.rotation.x = -Math.PI / 2;
      compass.position.y = -0.015;
      root.add(compass);

      const maxSurroundings = compactMode ? 10 : 16;
      const surroundings = Array.isArray(reference?.neighborhoodBuildings)
        ? reference.neighborhoodBuildings
          .filter((buildingRef) => buildingRef?.geometry)
          .map((buildingRef) => {
            const center = buildingRef.center || {};
            const localCenter = validOrigin
              ? toLocalMeters(center.longitude ?? originLongitude, center.latitude ?? originLatitude, originLongitude, originLatitude)
              : { east: 0, north: 0 };
            return { buildingRef, localCenter, distance: Math.hypot(localCenter.east - primaryCenterLocal.east, localCenter.north - primaryCenterLocal.north) };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, maxSurroundings)
        : [];

      if (validOrigin) {
        for (const { buildingRef, localCenter, distance } of surroundings) {
          const isPrimary = buildingRef.selected === true || String(buildingRef.id || '') === primaryRecordId;
          if (isPrimary) continue;
          const shaped = shapeFromGeometry(THREE, buildingRef.geometry, originLongitude, originLatitude);
          if (!shaped) continue;
          const baseY = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;
          const sourceHeight = Math.max(2.2, Math.min(120, Number(buildingRef?.height?.referenceHeightMeters) || 3));
          const visualHeight = Math.max(0.18, sourceHeight * METERS_TO_SCENE);
          const distanceRatio = Math.max(0, Math.min(1, distance / Math.max(terrainRadiusMeters, 1)));
          const geometry = new THREE.ExtrudeGeometry(shaped.shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometries.push(geometry);
          const mesh = new THREE.Mesh(geometry, mat({ color: 0x4d615a, roughness: 0.82, metalness: 0.015, transparent: true, opacity: 0.4 - distanceRatio * 0.13 }));
          mesh.position.y = baseY;
          root.add(mesh);
          const edges = new THREE.EdgesGeometry(geometry, 28);
          geometries.push(edges);
          const lines = new THREE.LineSegments(edges, lineMat({ color: 0xa7c1b8, transparent: true, opacity: 0.13 - distanceRatio * 0.045 }));
          lines.position.y = baseY;
          root.add(lines);
        }
      }

      let primaryBeacon = null;
      let primaryGlow = null;
      const focusTarget = new THREE.Vector3(0, Math.max(0.45, sceneRadius * 0.055), 0);

      if (reference?.found && shapedPrimary) {
        const sourceHeight = Math.max(2.2, Math.min(500, Number(reference?.height?.referenceHeightMeters) || 3));
        const visualHeight = Math.max(0.24, sourceHeight * METERS_TO_SCENE);
        const levels = numericLevels(reference, sourceHeight);
        const baseY = terrainRelativeMeters(terrain, primaryCenterLocal.east, primaryCenterLocal.north) * METERS_TO_SCENE;
        const centerX = primaryCenterLocal.east * METERS_TO_SCENE;
        const centerZ = -primaryCenterLocal.north * METERS_TO_SCENE;
        focusTarget.set(centerX, baseY + Math.max(0.34, visualHeight * 0.42), centerZ);

        const buildingGeometry = new THREE.ExtrudeGeometry(shapedPrimary.shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
        buildingGeometry.rotateX(-Math.PI / 2);
        geometries.push(buildingGeometry);
        const building = new THREE.Mesh(buildingGeometry, mat({ color: 0xebfff9, emissive: 0x174739, emissiveIntensity: 0.18, roughness: 0.52, metalness: 0.035, transparent: true, opacity: 0.995 }));
        building.position.y = baseY;
        root.add(building);

        const edgesGeometry = new THREE.EdgesGeometry(buildingGeometry, 18);
        geometries.push(edgesGeometry);
        const edges = new THREE.LineSegments(edgesGeometry, lineMat({ color: 0xa9f6dc, transparent: true, opacity: 0.96 }));
        edges.position.y = baseY;
        root.add(edges);

        const footprintPoints = shapedPrimary.local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.018, -point.north * METERS_TO_SCENE));
        if (footprintPoints.length) footprintPoints.push(footprintPoints[0].clone());
        const footprintGeometry = new THREE.BufferGeometry().setFromPoints(footprintPoints);
        geometries.push(footprintGeometry);
        root.add(new THREE.Line(footprintGeometry, lineMat({ color: 0xc6ffea, transparent: true, opacity: 1 })));

        const bandCount = Math.min(levels - 1, 10);
        for (let floor = 1; floor <= bandCount; floor += 1) {
          const y = baseY + visualHeight * (floor / levels);
          const bandPoints = shapedPrimary.local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, y, -point.north * METERS_TO_SCENE));
          if (bandPoints.length) bandPoints.push(bandPoints[0].clone());
          const bandGeometry = new THREE.BufferGeometry().setFromPoints(bandPoints);
          geometries.push(bandGeometry);
          root.add(new THREE.Line(bandGeometry, lineMat({ color: 0x82d7bd, transparent: true, opacity: 0.27 })));
        }

        const localRadius = shapedPrimary.local.reduce((largest, point) => Math.max(largest, Math.hypot(point.east - primaryCenterLocal.east, point.north - primaryCenterLocal.north)), 0) * METERS_TO_SCENE;
        const selectionRadius = Math.max(0.58, Math.min(2.7, localRadius * 1.25 || sceneRadius * 0.13));
        const glowGeometry = new THREE.CircleGeometry(selectionRadius, 48);
        glowGeometry.rotateX(-Math.PI / 2);
        geometries.push(glowGeometry);
        primaryGlow = new THREE.Mesh(glowGeometry, mat({ color: 0x8bf1ce, emissive: 0x3f8c73, emissiveIntensity: 0.9, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
        primaryGlow.position.set(centerX, baseY + 0.024, centerZ);
        root.add(primaryGlow);

        const beaconGeometry = new THREE.RingGeometry(selectionRadius * 0.9, selectionRadius, 72);
        geometries.push(beaconGeometry);
        primaryBeacon = new THREE.Mesh(beaconGeometry, mat({ color: 0xfff4e6, emissive: 0x5b8d7b, emissiveIntensity: 0.75, transparent: true, opacity: 0.44, side: THREE.DoubleSide }));
        primaryBeacon.rotation.x = -Math.PI / 2;
        primaryBeacon.position.set(centerX, baseY + visualHeight + 0.065, centerZ);
        root.add(primaryBeacon);
      } else {
        const markerGeometry = new THREE.TorusGeometry(1.18, 0.08, 12, 72);
        geometries.push(markerGeometry);
        const marker = new THREE.Mesh(markerGeometry, mat({ color: 0x9ff4d7, emissive: 0x225c49, emissiveIntensity: 1.05 }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.05;
        root.add(marker);
      }

      // Decorative UI sparkles only. These are deliberately not map/property data.
      const sparkleCount = compactMode ? 14 : 22;
      const sparklePositions = [];
      for (let index = 0; index < sparkleCount; index += 1) {
        const angle = index * 2.3999632297;
        const radial = sceneRadius * (0.58 + ((index * 17) % 34) / 100);
        const y = 1 + ((index * 29) % 31) / 13;
        sparklePositions.push(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
      }
      const sparkleGeometry = new THREE.BufferGeometry();
      sparkleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sparklePositions, 3));
      geometries.push(sparkleGeometry);
      const sparkleMaterial = new THREE.PointsMaterial({ color: 0xfff4e6, size: compactMode ? 0.045 : 0.05, transparent: true, opacity: 0.3, sizeAttenuation: true });
      materials.push(sparkleMaterial);
      const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
      root.add(sparkles);

      const preset = cameraPreset(viewMode, sceneRadius, compactMode);
      let azimuth = preset.azimuth;
      let elevation = preset.elevation;
      let radius = preset.radius;
      let dragging = false;
      let autoOrbit = preset.autoOrbit && !reducedMotion;
      let lastX = 0;
      let lastY = 0;
      const activePointers = new Map();
      let pinchDistance = null;
      const minRadius = Math.max(compactMode ? 5.4 : 6.2, sceneRadius * 0.68);
      const maxRadius = Math.max(preset.radius * 1.7, sceneRadius * 3.25);

      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(
          focusTarget.x + Math.sin(azimuth) * c * radius,
          focusTarget.y + Math.sin(elevation) * radius,
          focusTarget.z + Math.cos(azimuth) * c * radius,
        );
        camera.lookAt(focusTarget);
      };
      updateCamera();

      const down = (event) => {
        event.preventDefault();
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        autoOrbit = false;
        renderer.domElement.style.cursor = 'grabbing';
        if (activePointers.size === 1) {
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
        } else if (activePointers.size === 2) {
          dragging = false;
          const points = [...activePointers.values()];
          pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        }
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };

      const move = (event) => {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointers.size === 2) {
          const points = [...activePointers.values()];
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          if (pinchDistance && distance > 0) {
            radius = Math.max(minRadius, Math.min(maxRadius, radius * (pinchDistance / distance)));
            updateCamera();
          }
          pinchDistance = distance;
          return;
        }
        if (!dragging) return;
        azimuth -= (event.clientX - lastX) * 0.0068;
        elevation = Math.max(0.12, Math.min(1.42, elevation + (event.clientY - lastY) * 0.0042));
        lastX = event.clientX;
        lastY = event.clientY;
        updateCamera();
      };

      const up = (event) => {
        activePointers.delete(event.pointerId);
        if (activePointers.size < 2) pinchDistance = null;
        dragging = activePointers.size === 1;
        renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
        if (dragging) {
          const point = [...activePointers.values()][0];
          lastX = point.x;
          lastY = point.y;
        }
        try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch {}
      };

      const wheel = (event) => {
        event.preventDefault();
        autoOrbit = false;
        radius = Math.max(minRadius, Math.min(maxRadius, radius + event.deltaY * 0.012));
        updateCamera();
      };

      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      let frame = 0;
      let elapsed = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        elapsed += 0.016;
        if (!reducedMotion) {
          compass.rotation.z += 0.00028;
          sparkles.rotation.y += 0.00008;
          if (primaryBeacon) primaryBeacon.scale.setScalar(1 + Math.sin(elapsed * 1.45) * 0.025);
          if (primaryGlow) primaryGlow.material.opacity = 0.07 + (Math.sin(elapsed * 1.3) + 1) * 0.012;
          if (autoOrbit) {
            azimuth += 0.00034;
            updateCamera();
          }
        }
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        if (!mountRef.current) return;
        const nextW = Math.max(300, mount.clientWidth || 320);
        const nextH = Math.max(320, mount.clientHeight || 400);
        renderer.setSize(nextW, nextH, false);
        camera.aspect = nextW / nextH;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(mount);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
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
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters, reference?.neighborhoodBuildingCount, reference?.terrain?.source?.observedAt, reference?.measuredHeight?.status, viewMode, resetKey]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} aria-label="Interactive 3D property and neighborhood reference" />;
}
