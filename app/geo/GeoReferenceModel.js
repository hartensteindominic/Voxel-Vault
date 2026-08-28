'use client';

import { createElement, useEffect, useMemo, useRef } from 'react';

const METERS_TO_SCENE = 0.075;

function outerRing(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0] : [];
  if (geometry.type === 'MultiPolygon') return Array.isArray(geometry.coordinates?.[0]?.[0]) ? geometry.coordinates[0][0] : [];
  return [];
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

function localPolygon(geometry, originLongitude, originLatitude) {
  const ring = outerRing(geometry);
  if (ring.length < 4) return [];
  return ring.slice(0, -1)
    .map(([lon, lat]) => toLocalMeters(lon, lat, originLongitude, originLatitude))
    .filter((point) => Number.isFinite(point.east) && Number.isFinite(point.north));
}

function shapeFromLocal(THREE, local) {
  if (!Array.isArray(local) || local.length < 3) return null;
  const shape = new THREE.Shape();
  local.forEach((point, index) => {
    const x = point.east * METERS_TO_SCENE;
    const y = -point.north * METERS_TO_SCENE;
    if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function averageLocalCenter(local = []) {
  if (!local.length) return { east: 0, north: 0 };
  const sum = local.reduce((total, point) => ({ east: total.east + point.east, north: total.north + point.north }), { east: 0, north: 0 });
  return { east: sum.east / local.length, north: sum.north / local.length };
}

function pointInPolygon(east, north, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].east;
    const yi = polygon[i].north;
    const xj = polygon[j].east;
    const yj = polygon[j].north;
    const intersects = ((yi > north) !== (yj > north))
      && (east < ((xj - xi) * (north - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonBounds(local) {
  if (!local.length) return null;
  return local.reduce((bounds, point) => ({
    minEast: Math.min(bounds.minEast, point.east),
    maxEast: Math.max(bounds.maxEast, point.east),
    minNorth: Math.min(bounds.minNorth, point.north),
    maxNorth: Math.max(bounds.maxNorth, point.north),
  }), { minEast: Infinity, maxEast: -Infinity, minNorth: Infinity, maxNorth: -Infinity });
}

function cameraPreset(viewMode, sceneRadius, compactMode) {
  if (viewMode === 'top') return { azimuth: 0.08, elevation: 1.36, radius: Math.max(compactMode ? 9.2 : 10, sceneRadius * 1.5), autoOrbit: false };
  if (viewMode === 'street') return { azimuth: 0.5, elevation: 0.17, radius: Math.max(compactMode ? 7.6 : 8.5, sceneRadius * 1.18), autoOrbit: false };
  return { azimuth: 0.72, elevation: 0.43, radius: Math.max(compactMode ? 9.7 : 10.7, sceneRadius * 1.58), autoOrbit: true };
}

function evidenceLabel(reference) {
  const measured = String(reference?.measuredHeight?.status || '').toLowerCase();
  if (reference?.found && measured && !['unavailable', 'unknown', 'missing'].includes(measured)) {
    return { title: 'Measured voxel massing', detail: 'Footprint + measured height · facade details not inferred' };
  }
  if (reference?.found && Number.isFinite(Number(reference?.height?.referenceHeightMeters))) {
    return { title: 'Source-backed voxel massing', detail: 'Real footprint + sourced height · facade details not inferred' };
  }
  if (reference?.found) return { title: 'Source-backed footprint', detail: 'Geometry shown without invented architectural detail' };
  return { title: '3D reference preview', detail: 'Search for a source-backed property to build its voxel massing' };
}

function addTerrain(THREE, root, terrain, sceneRadius, terrainRadiusMeters, geometries, materials) {
  const material = new THREE.MeshStandardMaterial({ color: 0x6f7a6b, roughness: 0.96, metalness: 0 });
  materials.push(material);
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
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    root.add(mesh);
    return;
  }
  const geometry = new THREE.CircleGeometry(sceneRadius, 72);
  geometry.rotateX(-Math.PI / 2);
  geometries.push(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.04;
  mesh.receiveShadow = true;
  root.add(mesh);
}

function addVoxelShell({ THREE, root, local, baseY, visualHeight, compactMode, geometries, materials }) {
  const bounds = polygonBounds(local);
  if (!bounds) return null;
  const widthMeters = Math.max(1, bounds.maxEast - bounds.minEast);
  const depthMeters = Math.max(1, bounds.maxNorth - bounds.minNorth);
  const targetCellMeters = compactMode ? 2.6 : 1.85;
  const maxAcross = compactMode ? 34 : 48;
  const cellMeters = Math.max(targetCellMeters, widthMeters / maxAcross, depthMeters / maxAcross);
  const cellScene = cellMeters * METERS_TO_SCENE;
  const heightCells = Math.max(1, Math.min(compactMode ? 26 : 38, Math.round(visualHeight / cellScene)));
  const actualCellHeight = visualHeight / heightCells;
  const columns = [];

  for (let east = bounds.minEast + cellMeters * 0.5; east <= bounds.maxEast; east += cellMeters) {
    for (let north = bounds.minNorth + cellMeters * 0.5; north <= bounds.maxNorth; north += cellMeters) {
      if (!pointInPolygon(east, north, local)) continue;
      const boundary = [
        [east + cellMeters, north],
        [east - cellMeters, north],
        [east, north + cellMeters],
        [east, north - cellMeters],
      ].some(([x, z]) => !pointInPolygon(x, z, local));
      columns.push({ east, north, boundary });
    }
  }

  const requested = columns.reduce((count, column) => count + (column.boundary ? heightCells : 1), 0);
  const maxInstances = compactMode ? 900 : 1800;
  const stride = Math.max(1, Math.ceil(requested / maxInstances));
  const geometry = new THREE.BoxGeometry(cellScene * 0.93, Math.max(0.045, actualCellHeight * 0.93), cellScene * 0.93);
  geometries.push(geometry);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe7e0d2,
    roughness: 0.68,
    metalness: 0.025,
    emissive: 0x171d19,
    emissiveIntensity: 0.025,
  });
  materials.push(material);
  const count = Math.max(1, Math.ceil(requested / stride));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  let cursor = 0;
  let sourceIndex = 0;

  for (const column of columns) {
    const levels = column.boundary ? heightCells : 1;
    const startLevel = column.boundary ? 0 : heightCells - 1;
    for (let level = startLevel; level < heightCells && level < startLevel + levels; level += 1) {
      if (sourceIndex % stride === 0 && cursor < count) {
        matrix.makeTranslation(
          column.east * METERS_TO_SCENE,
          baseY + actualCellHeight * (level + 0.5),
          -column.north * METERS_TO_SCENE,
        );
        mesh.setMatrixAt(cursor, matrix);
        cursor += 1;
      }
      sourceIndex += 1;
    }
  }
  mesh.count = cursor;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = !compactMode;
  mesh.receiveShadow = true;
  root.add(mesh);
  return { mesh, cellScene };
}

export default function GeoReferenceModel({ reference, viewMode = 'orbit', resetKey = 0 }) {
  const mountRef = useRef(null);
  const label = useMemo(() => evidenceLabel(reference), [reference]);

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactMode ? 1.18 : 1.45));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.shadowMap.enabled = !compactMode;
      if (!compactMode) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x101716);
      scene.fog = new THREE.FogExp2(0x101716, compactMode ? 0.026 : 0.021);
      const camera = new THREE.PerspectiveCamera(compactMode ? 41 : 36, width / height, 0.1, 170);

      scene.add(new THREE.HemisphereLight(0xf6efe2, 0x26352f, 2.05));
      const sun = new THREE.DirectionalLight(0xffeed2, compactMode ? 3.4 : 4.15);
      sun.position.set(10, 18, 7);
      sun.castShadow = !compactMode;
      if (!compactMode) {
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -18;
        sun.shadow.camera.right = 18;
        sun.shadow.camera.top = 18;
        sun.shadow.camera.bottom = -18;
      }
      scene.add(sun);
      const coolFill = new THREE.DirectionalLight(0xa6c9c1, 1.15);
      coolFill.position.set(-9, 7, -8);
      scene.add(coolFill);

      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const originLatitude = Number(reference?.latitude);
      const originLongitude = Number(reference?.longitude);
      const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
      const terrain = reference?.terrain || null;
      const terrainRadiusMeters = Math.max(55, Math.min(180, Number(terrain?.radiusMeters) || 85));
      const sceneRadius = terrainRadiusMeters * METERS_TO_SCENE;
      const primaryLocal = validOrigin ? localPolygon(reference?.geometry, originLongitude, originLatitude) : [];
      const primaryCenterLocal = averageLocalCenter(primaryLocal);
      const primaryRecordId = String(reference?.source?.recordId || '');

      const plinthGeometry = new THREE.CylinderGeometry(sceneRadius * 1.08, sceneRadius * 1.12, 0.3, 84);
      geometries.push(plinthGeometry);
      const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0x202a27, roughness: 0.92, metalness: 0.01 });
      materials.push(plinthMaterial);
      const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
      plinth.position.y = -0.34;
      plinth.receiveShadow = true;
      root.add(plinth);
      addTerrain(THREE, root, terrain, sceneRadius, terrainRadiusMeters, geometries, materials);

      const grid = new THREE.GridHelper(sceneRadius * 1.75, compactMode ? 22 : 32, 0x60746c, 0x42524c);
      grid.position.y = 0.012;
      grid.material.transparent = true;
      grid.material.opacity = 0.13;
      materials.push(grid.material);
      root.add(grid);

      const surroundings = Array.isArray(reference?.neighborhoodBuildings)
        ? reference.neighborhoodBuildings
          .filter((item) => item?.geometry)
          .map((buildingRef) => {
            const center = buildingRef.center || {};
            const localCenter = validOrigin
              ? toLocalMeters(center.longitude ?? originLongitude, center.latitude ?? originLatitude, originLongitude, originLatitude)
              : { east: 0, north: 0 };
            return { buildingRef, localCenter, distance: Math.hypot(localCenter.east - primaryCenterLocal.east, localCenter.north - primaryCenterLocal.north) };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, compactMode ? 9 : 15)
        : [];

      if (validOrigin) {
        for (const { buildingRef, localCenter, distance } of surroundings) {
          const isPrimary = buildingRef.selected === true || String(buildingRef.id || '') === primaryRecordId;
          if (isPrimary) continue;
          const local = localPolygon(buildingRef.geometry, originLongitude, originLatitude);
          const shape = shapeFromLocal(THREE, local);
          if (!shape) continue;
          const sourceHeight = Math.max(2.2, Math.min(120, Number(buildingRef?.height?.referenceHeightMeters) || 3));
          const visualHeight = Math.max(0.18, sourceHeight * METERS_TO_SCENE);
          const baseY = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;
          const distanceRatio = Math.max(0, Math.min(1, distance / terrainRadiusMeters));
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          geometry.rotateX(-Math.PI / 2);
          geometries.push(geometry);
          const material = new THREE.MeshStandardMaterial({
            color: 0x59635f,
            roughness: 0.88,
            metalness: 0,
            transparent: true,
            opacity: 0.5 - distanceRatio * 0.16,
          });
          materials.push(material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.y = baseY;
          mesh.receiveShadow = true;
          root.add(mesh);
        }
      }

      const focusTarget = new THREE.Vector3(0, Math.max(0.38, sceneRadius * 0.05), 0);
      let primaryHalo = null;

      if (reference?.found && primaryLocal.length >= 3) {
        const shape = shapeFromLocal(THREE, primaryLocal);
        const sourceHeight = Math.max(2.2, Math.min(500, Number(reference?.height?.referenceHeightMeters) || 3));
        const visualHeight = Math.max(0.24, sourceHeight * METERS_TO_SCENE);
        const baseY = terrainRelativeMeters(terrain, primaryCenterLocal.east, primaryCenterLocal.north) * METERS_TO_SCENE;
        const centerX = primaryCenterLocal.east * METERS_TO_SCENE;
        const centerZ = -primaryCenterLocal.north * METERS_TO_SCENE;
        focusTarget.set(centerX, baseY + Math.max(0.38, visualHeight * 0.44), centerZ);

        if (shape) {
          const coreGeometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          coreGeometry.rotateX(-Math.PI / 2);
          geometries.push(coreGeometry);
          const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x6c746e, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.38 });
          materials.push(coreMaterial);
          const core = new THREE.Mesh(coreGeometry, coreMaterial);
          core.position.y = baseY;
          core.castShadow = !compactMode;
          core.receiveShadow = true;
          root.add(core);
        }

        addVoxelShell({ THREE, root, local: primaryLocal, baseY, visualHeight, compactMode, geometries, materials });

        const outlinePoints = primaryLocal.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.026, -point.north * METERS_TO_SCENE));
        if (outlinePoints.length) outlinePoints.push(outlinePoints[0].clone());
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        geometries.push(outlineGeometry);
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xf8f1df, transparent: true, opacity: 0.72 });
        materials.push(outlineMaterial);
        root.add(new THREE.Line(outlineGeometry, outlineMaterial));

        const localRadius = primaryLocal.reduce((largest, point) => Math.max(largest, Math.hypot(point.east - primaryCenterLocal.east, point.north - primaryCenterLocal.north)), 0) * METERS_TO_SCENE;
        const haloRadius = Math.max(0.65, Math.min(2.8, localRadius * 1.32 || 1));
        const haloGeometry = new THREE.RingGeometry(haloRadius * 0.94, haloRadius, 80);
        geometries.push(haloGeometry);
        const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xe9d8b8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
        materials.push(haloMaterial);
        primaryHalo = new THREE.Mesh(haloGeometry, haloMaterial);
        primaryHalo.rotation.x = -Math.PI / 2;
        primaryHalo.position.set(centerX, baseY + 0.03, centerZ);
        root.add(primaryHalo);
      }

      const preset = cameraPreset(viewMode, sceneRadius, compactMode);
      let azimuth = preset.azimuth;
      let elevation = preset.elevation;
      let radius = preset.radius;
      let autoOrbit = preset.autoOrbit && !reducedMotion;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let pinchDistance = null;
      const activePointers = new Map();
      const minRadius = Math.max(compactMode ? 4.7 : 5.5, sceneRadius * 0.6);
      const maxRadius = Math.max(preset.radius * 1.85, sceneRadius * 3.1);

      const updateCamera = () => {
        const cosElevation = Math.cos(elevation);
        camera.position.set(
          focusTarget.x + Math.sin(azimuth) * cosElevation * radius,
          focusTarget.y + Math.sin(elevation) * radius,
          focusTarget.z + Math.cos(azimuth) * cosElevation * radius,
        );
        camera.lookAt(focusTarget);
      };
      updateCamera();

      const pointerDown = (event) => {
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

      const pointerMove = (event) => {
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
        azimuth -= (event.clientX - lastX) * 0.0065;
        elevation = Math.max(0.1, Math.min(1.44, elevation + (event.clientY - lastY) * 0.004));
        lastX = event.clientX;
        lastY = event.clientY;
        updateCamera();
      };

      const pointerUp = (event) => {
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
        radius = Math.max(minRadius, Math.min(maxRadius, radius + event.deltaY * 0.011));
        updateCamera();
      };

      renderer.domElement.addEventListener('pointerdown', pointerDown);
      renderer.domElement.addEventListener('pointermove', pointerMove);
      renderer.domElement.addEventListener('pointerup', pointerUp);
      renderer.domElement.addEventListener('pointercancel', pointerUp);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      const clock = new THREE.Clock();
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        if (!reducedMotion) {
          if (primaryHalo) primaryHalo.material.opacity = 0.22 + (Math.sin(elapsed * 1.15) + 1) * 0.035;
          if (autoOrbit) {
            azimuth += 0.00028;
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
        renderer.domElement.removeEventListener('pointerdown', pointerDown);
        renderer.domElement.removeEventListener('pointermove', pointerMove);
        renderer.domElement.removeEventListener('pointerup', pointerUp);
        renderer.domElement.removeEventListener('pointercancel', pointerUp);
        renderer.domElement.removeEventListener('wheel', wheel);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        mount.innerHTML = '';
      };
    });

    return () => { disposed = true; cleanup(); };
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters, reference?.neighborhoodBuildingCount, reference?.terrain?.source?.observedAt, reference?.measuredHeight?.status, viewMode, resetKey]);

  return createElement('div', {
    style: { position: 'absolute', inset: 0 },
    'aria-label': 'Interactive realistic voxel property and neighborhood reference',
  },
  createElement('div', { ref: mountRef, style: { position: 'absolute', inset: 0 } }),
  createElement('div', {
    style: {
      position: 'absolute',
      left: 12,
      bottom: 12,
      maxWidth: 'min(78%, 420px)',
      padding: '9px 11px',
      borderRadius: 14,
      border: '1px solid rgba(244, 235, 214, 0.16)',
      background: 'rgba(12, 18, 17, 0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#f6efe1',
      pointerEvents: 'none',
      boxShadow: '0 12px 34px rgba(0, 0, 0, 0.2)',
    },
  },
  createElement('div', { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.01em' } }, label.title),
  createElement('div', { style: { marginTop: 2, fontSize: 10, lineHeight: 1.35, color: 'rgba(246, 239, 225, 0.68)' } }, label.detail)));
}
