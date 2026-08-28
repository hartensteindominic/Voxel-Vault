'use client';

import { createElement, useEffect, useMemo, useRef } from 'react';

const METERS_TO_SCENE = 0.075;

function outerRing(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates[0] || [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || [];
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
  let total = 0;
  for (const sample of samples) {
    const dx = eastMeters - Number(sample.eastMeters || 0);
    const dz = northMeters - Number(sample.northMeters || 0);
    const weight = 1 / Math.max(1, dx * dx + dz * dz);
    weighted += Number(sample.relativeElevationMeters || 0) * weight;
    total += weight;
  }
  return total ? weighted / total : 0;
}

function localPolygon(geometry, originLongitude, originLatitude) {
  const ring = outerRing(geometry);
  if (ring.length < 4) return [];
  return ring.slice(0, -1)
    .map(([lon, lat]) => toLocalMeters(lon, lat, originLongitude, originLatitude))
    .filter((point) => Number.isFinite(point.east) && Number.isFinite(point.north));
}

function shapeFromLocal(THREE, local) {
  if (local.length < 3) return null;
  const shape = new THREE.Shape();
  local.forEach((point, index) => {
    const x = point.east * METERS_TO_SCENE;
    const y = -point.north * METERS_TO_SCENE;
    if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function averageLocalCenter(local) {
  if (!local.length) return { east: 0, north: 0 };
  const sum = local.reduce((acc, point) => ({ east: acc.east + point.east, north: acc.north + point.north }), { east: 0, north: 0 });
  return { east: sum.east / local.length, north: sum.north / local.length };
}

function polygonBounds(local) {
  if (!local.length) return null;
  return local.reduce((b, p) => ({
    minEast: Math.min(b.minEast, p.east), maxEast: Math.max(b.maxEast, p.east),
    minNorth: Math.min(b.minNorth, p.north), maxNorth: Math.max(b.maxNorth, p.north),
  }), { minEast: Infinity, maxEast: -Infinity, minNorth: Infinity, maxNorth: -Infinity });
}

function pointInPolygon(east, north, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.north > north) !== (b.north > north))
      && east < ((b.east - a.east) * (north - a.north)) / ((b.north - a.north) || Number.EPSILON) + a.east;
    if (crosses) inside = !inside;
  }
  return inside;
}

function effectiveHeightMeters(reference, fallback = 3) {
  const measured = reference?.measuredHeight?.verifiedMeasuredHeight === true
    ? Number(reference?.measuredHeight?.heightMeters)
    : NaN;
  if (Number.isFinite(measured) && measured > 0) return measured;
  const sourced = Number(reference?.height?.referenceHeightMeters);
  return Number.isFinite(sourced) && sourced > 0 ? sourced : fallback;
}

function evidenceLabel(reference) {
  if (reference?.found && reference?.measuredHeight?.verifiedMeasuredHeight === true) {
    return { title: 'Verified measured voxel massing', detail: 'Real footprint + accepted measured height · facade details not inferred' };
  }
  const status = String(reference?.height?.heightStatus || '');
  if (reference?.found && status === 'source_reported') {
    return { title: 'Source-backed voxel massing', detail: 'Real footprint + source-reported height · facade details not inferred' };
  }
  if (reference?.found && status === 'derived_from_levels') {
    return { title: 'Source-derived voxel massing', detail: 'Real footprint + height derived from reported floors · facade details not inferred' };
  }
  if (reference?.found && status === 'illustrative_default') {
    return { title: 'Source-backed footprint', detail: 'Footprint is sourced; height is illustrative and facade details are not inferred' };
  }
  if (reference?.found) return { title: 'Source-backed footprint', detail: 'Geometry shown without invented architectural detail' };
  return { title: '3D reference preview', detail: 'Search for a source-backed property to build its voxel massing' };
}

function cameraPreset(viewMode, sceneRadius, compactMode) {
  if (viewMode === 'top') return { azimuth: 0.08, elevation: 1.36, radius: Math.max(compactMode ? 9.2 : 10, sceneRadius * 1.5), autoOrbit: false };
  if (viewMode === 'street') return { azimuth: 0.5, elevation: 0.17, radius: Math.max(compactMode ? 7.6 : 8.5, sceneRadius * 1.18), autoOrbit: false };
  return { azimuth: 0.72, elevation: 0.43, radius: Math.max(compactMode ? 9.7 : 10.7, sceneRadius * 1.58), autoOrbit: true };
}

function addVoxelShell({ THREE, root, local, baseY, height, compactMode, geometries, materials }) {
  const bounds = polygonBounds(local);
  if (!bounds) return;
  const width = Math.max(1, bounds.maxEast - bounds.minEast);
  const depth = Math.max(1, bounds.maxNorth - bounds.minNorth);
  const cellMeters = Math.max(compactMode ? 2.6 : 1.85, width / (compactMode ? 34 : 48), depth / (compactMode ? 34 : 48));
  const cellScene = cellMeters * METERS_TO_SCENE;
  const heightCells = Math.max(1, Math.min(compactMode ? 26 : 38, Math.round(height / cellScene)));
  const cellHeight = height / heightCells;
  const columns = [];

  for (let east = bounds.minEast + cellMeters / 2; east <= bounds.maxEast; east += cellMeters) {
    for (let north = bounds.minNorth + cellMeters / 2; north <= bounds.maxNorth; north += cellMeters) {
      if (!pointInPolygon(east, north, local)) continue;
      const boundary = [[cellMeters, 0], [-cellMeters, 0], [0, cellMeters], [0, -cellMeters]]
        .some(([dx, dz]) => !pointInPolygon(east + dx, north + dz, local));
      columns.push({ east, north, boundary });
    }
  }

  const requested = columns.reduce((sum, column) => sum + (column.boundary ? heightCells : 1), 0);
  const maxInstances = compactMode ? 900 : 1800;
  const stride = Math.max(1, Math.ceil(requested / maxInstances));
  const geometry = new THREE.BoxGeometry(cellScene * 0.93, Math.max(0.045, cellHeight * 0.93), cellScene * 0.93);
  const material = new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 0.68, metalness: 0.025, emissive: 0x171d19, emissiveIntensity: 0.025 });
  geometries.push(geometry);
  materials.push(material);

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, Math.ceil(requested / stride)));
  const matrix = new THREE.Matrix4();
  let cursor = 0;
  let sourceIndex = 0;
  for (const column of columns) {
    const start = column.boundary ? 0 : heightCells - 1;
    for (let level = start; level < heightCells; level += 1) {
      if (!column.boundary && level !== heightCells - 1) continue;
      if (sourceIndex % stride === 0 && cursor < mesh.count) {
        matrix.makeTranslation(column.east * METERS_TO_SCENE, baseY + cellHeight * (level + 0.5), -column.north * METERS_TO_SCENE);
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
      mount.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x101716);
      scene.fog = new THREE.FogExp2(0x101716, compactMode ? 0.026 : 0.021);
      const camera = new THREE.PerspectiveCamera(compactMode ? 41 : 36, width / height, 0.1, 170);
      const root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.HemisphereLight(0xf6efe2, 0x26352f, 2.05));

      const sun = new THREE.DirectionalLight(0xffeed2, compactMode ? 3.4 : 4.15);
      sun.position.set(10, 18, 7);
      sun.castShadow = !compactMode;
      if (!compactMode) {
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 });
      }
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa6c9c1, 1.15);
      fill.position.set(-9, 7, -8);
      scene.add(fill);

      const geometries = [];
      const materials = [];
      const originLatitude = Number(reference?.latitude);
      const originLongitude = Number(reference?.longitude);
      const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
      const terrain = reference?.terrain || null;
      const terrainRadiusMeters = Math.max(55, Math.min(180, Number(terrain?.radiusMeters) || 85));
      const sceneRadius = terrainRadiusMeters * METERS_TO_SCENE;
      const primaryLocal = validOrigin ? localPolygon(reference?.geometry, originLongitude, originLatitude) : [];
      const primaryCenter = averageLocalCenter(primaryLocal);
      const primaryRecordId = String(reference?.source?.recordId || '');

      const plinthGeometry = new THREE.CylinderGeometry(sceneRadius * 1.08, sceneRadius * 1.12, 0.3, 84);
      const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0x202a27, roughness: 0.92, metalness: 0.01 });
      geometries.push(plinthGeometry);
      materials.push(plinthMaterial);
      const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
      plinth.position.y = -0.34;
      plinth.receiveShadow = true;
      root.add(plinth);

      if (terrain?.available && Array.isArray(terrain.samples) && terrain.samples.length >= 4) {
        const sorted = [...terrain.samples].sort((a, b) => Number(a.row) - Number(b.row) || Number(a.column) - Number(b.column));
        const vertices = [];
        for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
          const sample = sorted.find((item) => Number(item.row) === row && Number(item.column) === column);
          vertices.push(
            Number(sample?.eastMeters ?? (column - 1) * terrainRadiusMeters) * METERS_TO_SCENE,
            Number(sample?.relativeElevationMeters || 0) * METERS_TO_SCENE,
            -Number(sample?.northMeters ?? (row - 1) * terrainRadiusMeters) * METERS_TO_SCENE,
          );
        }
        const terrainGeometry = new THREE.BufferGeometry();
        terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        terrainGeometry.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8]);
        terrainGeometry.computeVertexNormals();
        const terrainMaterial = new THREE.MeshStandardMaterial({ color: 0x6f7a6b, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
        geometries.push(terrainGeometry);
        materials.push(terrainMaterial);
        const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrainMesh.receiveShadow = true;
        root.add(terrainMesh);
      } else {
        const groundGeometry = new THREE.CircleGeometry(sceneRadius, 72);
        groundGeometry.rotateX(-Math.PI / 2);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x6f7a6b, roughness: 0.96, metalness: 0 });
        geometries.push(groundGeometry);
        materials.push(groundMaterial);
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.04;
        ground.receiveShadow = true;
        root.add(ground);
      }

      const grid = new THREE.GridHelper(sceneRadius * 1.75, compactMode ? 22 : 32, 0x60746c, 0x42524c);
      grid.position.y = 0.012;
      grid.material.transparent = true;
      grid.material.opacity = 0.13;
      materials.push(grid.material);
      geometries.push(grid.geometry);
      root.add(grid);

      const surroundings = Array.isArray(reference?.neighborhoodBuildings) ? reference.neighborhoodBuildings
        .filter((item) => item?.geometry)
        .map((buildingRef) => {
          const center = buildingRef.center || {};
          const localCenter = validOrigin
            ? toLocalMeters(center.longitude ?? originLongitude, center.latitude ?? originLatitude, originLongitude, originLatitude)
            : { east: 0, north: 0 };
          return { buildingRef, localCenter, distance: Math.hypot(localCenter.east - primaryCenter.east, localCenter.north - primaryCenter.north) };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, compactMode ? 9 : 15) : [];

      if (validOrigin) for (const { buildingRef, localCenter, distance } of surroundings) {
        if (buildingRef.selected === true || String(buildingRef.id || '') === primaryRecordId) continue;
        const local = localPolygon(buildingRef.geometry, originLongitude, originLatitude);
        const shape = shapeFromLocal(THREE, local);
        if (!shape) continue;
        const sourceHeight = Math.max(2.2, Math.min(120, Number(buildingRef?.height?.referenceHeightMeters) || 3));
        const visualHeight = sourceHeight * METERS_TO_SCENE;
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x59635f, roughness: 0.88, metalness: 0, transparent: true, opacity: 0.5 - Math.min(1, distance / terrainRadiusMeters) * 0.16 });
        geometries.push(geometry);
        materials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;
        mesh.receiveShadow = true;
        root.add(mesh);
      }

      const focusTarget = new THREE.Vector3(0, Math.max(0.38, sceneRadius * 0.05), 0);
      let primaryHalo = null;
      if (reference?.found && primaryLocal.length >= 3) {
        const shape = shapeFromLocal(THREE, primaryLocal);
        const sourceHeight = Math.max(2.2, Math.min(500, effectiveHeightMeters(reference, 3)));
        const visualHeight = sourceHeight * METERS_TO_SCENE;
        const baseY = terrainRelativeMeters(terrain, primaryCenter.east, primaryCenter.north) * METERS_TO_SCENE;
        const centerX = primaryCenter.east * METERS_TO_SCENE;
        const centerZ = -primaryCenter.north * METERS_TO_SCENE;
        focusTarget.set(centerX, baseY + Math.max(0.38, visualHeight * 0.44), centerZ);

        if (shape) {
          const coreGeometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          coreGeometry.rotateX(-Math.PI / 2);
          const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x6c746e, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.38 });
          geometries.push(coreGeometry);
          materials.push(coreMaterial);
          const core = new THREE.Mesh(coreGeometry, coreMaterial);
          core.position.y = baseY;
          core.castShadow = !compactMode;
          core.receiveShadow = true;
          root.add(core);
        }

        addVoxelShell({ THREE, root, local: primaryLocal, baseY, height: visualHeight, compactMode, geometries, materials });
        const outlinePoints = primaryLocal.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.026, -point.north * METERS_TO_SCENE));
        outlinePoints.push(outlinePoints[0].clone());
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xf8f1df, transparent: true, opacity: 0.72 });
        geometries.push(outlineGeometry);
        materials.push(outlineMaterial);
        root.add(new THREE.Line(outlineGeometry, outlineMaterial));

        const localRadius = primaryLocal.reduce((largest, point) => Math.max(largest, Math.hypot(point.east - primaryCenter.east, point.north - primaryCenter.north)), 0) * METERS_TO_SCENE;
        const haloRadius = Math.max(0.65, Math.min(2.8, localRadius * 1.32));
        const haloGeometry = new THREE.RingGeometry(haloRadius * 0.94, haloRadius, 80);
        const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xe9d8b8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
        geometries.push(haloGeometry);
        materials.push(haloMaterial);
        primaryHalo = new THREE.Mesh(haloGeometry, haloMaterial);
        primaryHalo.rotation.x = -Math.PI / 2;
        primaryHalo.position.set(centerX, baseY + 0.03, centerZ);
        root.add(primaryHalo);
      }

      const preset = cameraPreset(viewMode, sceneRadius, compactMode);
      let { azimuth, elevation, radius } = preset;
      let autoOrbit = preset.autoOrbit && !reducedMotion;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let pinchDistance = null;
      const pointers = new Map();
      const minRadius = Math.max(compactMode ? 4.7 : 5.5, sceneRadius * 0.6);
      const maxRadius = Math.max(preset.radius * 1.85, sceneRadius * 3.1);
      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(focusTarget.x + Math.sin(azimuth) * c * radius, focusTarget.y + Math.sin(elevation) * radius, focusTarget.z + Math.cos(azimuth) * c * radius);
        camera.lookAt(focusTarget);
      };
      updateCamera();

      const down = (event) => {
        event.preventDefault();
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        autoOrbit = false;
        renderer.domElement.style.cursor = 'grabbing';
        if (pointers.size === 1) {
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
        } else if (pointers.size === 2) {
          dragging = false;
          const [a, b] = [...pointers.values()];
          pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        }
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
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
      const up = (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchDistance = null;
        dragging = pointers.size === 1;
        renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
        if (dragging) {
          const point = [...pointers.values()][0];
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
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      const clock = new THREE.Clock();
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        if (!reducedMotion) {
          const elapsed = clock.getElapsedTime();
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
        mount.replaceChildren();
      };
    });

    return () => { disposed = true; cleanup(); };
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters, reference?.neighborhoodBuildingCount, reference?.terrain?.source?.observedAt, reference?.measuredHeight?.status, reference?.measuredHeight?.heightMeters, reference?.measuredHeight?.verifiedMeasuredHeight, viewMode, resetKey]);

  return createElement('div', { style: { position: 'absolute', inset: 0 }, 'aria-label': 'Interactive realistic voxel property and neighborhood reference' },
    createElement('div', { ref: mountRef, style: { position: 'absolute', inset: 0 } }),
    createElement('div', {
      style: {
        position: 'absolute', left: 12, bottom: 12, maxWidth: 'min(78%, 420px)', padding: '9px 11px', borderRadius: 14,
        border: '1px solid rgba(244, 235, 214, 0.16)', background: 'rgba(12, 18, 17, 0.72)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', color: '#f6efe1', pointerEvents: 'none', boxShadow: '0 12px 34px rgba(0, 0, 0, 0.2)',
      },
    },
    createElement('div', { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.01em' } }, label.title),
    createElement('div', { style: { marginTop: 2, fontSize: 10, lineHeight: 1.35, color: 'rgba(246, 239, 225, 0.68)' } }, label.detail)));
}
