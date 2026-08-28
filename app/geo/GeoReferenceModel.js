'use client';

import { createElement, useEffect, useMemo, useRef, useState } from 'react';

const METERS_TO_SCENE = 0.075;

function outerRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return Array.isArray(ring) && ring.length >= 4 ? [ring] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon?.[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 4);
  }
  return [];
}

function toLocalMeters(longitude, latitude, originLongitude, originLatitude) {
  const cosLat = Math.max(0.15, Math.cos(originLatitude * Math.PI / 180));
  return {
    east: (Number(longitude) - originLongitude) * 111320 * cosLat,
    north: (Number(latitude) - originLatitude) * 111320,
  };
}

function localPolygons(geometry, originLongitude, originLatitude) {
  return outerRings(geometry)
    .map((ring) => ring.slice(0, -1)
      .map(([lon, lat]) => toLocalMeters(lon, lat, originLongitude, originLatitude))
      .filter((point) => Number.isFinite(point.east) && Number.isFinite(point.north)))
    .filter((local) => local.length >= 3);
}

function localLineString(geometry, originLongitude, originLatitude) {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates
    .map(([lon, lat]) => toLocalMeters(lon, lat, originLongitude, originLatitude))
    .filter((point) => Number.isFinite(point.east) && Number.isFinite(point.north));
}

function localLineSegmentsWithinRadius(local, radiusMeters) {
  if (!Array.isArray(local) || local.length < 2) return [];
  const inside = (point) => Math.hypot(point.east, point.north) <= radiusMeters;
  const segments = [];
  let current = [];
  for (let index = 0; index < local.length - 1; index += 1) {
    const a = local[index];
    const b = local[index + 1];
    if (inside(a) || inside(b)) {
      if (!current.length) current.push(a);
      else if (current[current.length - 1] !== a) current.push(a);
      current.push(b);
    } else if (current.length >= 2) {
      segments.push(current);
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

function densifyLocalLine(local, maxSegmentMeters = 8) {
  if (!Array.isArray(local) || local.length < 2) return local || [];
  const result = [local[0]];
  for (let index = 0; index < local.length - 1; index += 1) {
    const a = local[index];
    const b = local[index + 1];
    const distance = Math.hypot(b.east - a.east, b.north - a.north);
    const steps = Math.max(1, Math.ceil(distance / maxSegmentMeters));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      result.push({
        east: a.east + (b.east - a.east) * t,
        north: a.north + (b.north - a.north) * t,
      });
    }
  }
  return result;
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

function flattenPoints(polygons = []) {
  return polygons.flatMap((polygon) => polygon);
}

function averageLocalCenter(polygons = []) {
  const points = flattenPoints(polygons);
  if (!points.length) return { east: 0, north: 0 };
  const sum = points.reduce((acc, point) => ({ east: acc.east + point.east, north: acc.north + point.north }), { east: 0, north: 0 });
  return { east: sum.east / points.length, north: sum.north / points.length };
}

function footprintRadiusScene(polygons, center) {
  return flattenPoints(polygons).reduce((largest, point) => Math.max(
    largest,
    Math.hypot(point.east - center.east, point.north - center.north) * METERS_TO_SCENE,
  ), 0);
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

function displayHeight(reference, authoritativeTwin) {
  const measured = reference?.measuredHeight?.verifiedMeasuredHeight === true
    ? Number(reference?.measuredHeight?.heightMeters)
    : NaN;
  if (Number.isFinite(measured) && measured > 0) {
    return { meters: measured, status: 'verified_measured' };
  }

  const authoritativeHeight = Number(authoritativeTwin?.structure?.heightMeters);
  if (authoritativeTwin?.structure?.buildingGeometry && Number.isFinite(authoritativeHeight) && authoritativeHeight > 0) {
    return { meters: authoritativeHeight, status: 'authoritative_structure' };
  }

  if (authoritativeTwin?.structure?.buildingGeometry) {
    return { meters: 3, status: 'illustrative_default' };
  }

  const sourced = Number(reference?.height?.referenceHeightMeters);
  if (Number.isFinite(sourced) && sourced > 0) {
    return { meters: sourced, status: String(reference?.height?.heightStatus || 'source_reference') };
  }
  return { meters: 3, status: 'illustrative_default' };
}

function evidenceLabel(reference, authoritativeTwin) {
  const hasCountyBuilding = Boolean(authoritativeTwin?.structure?.buildingGeometry);
  const hasParcelBoundary = Boolean(authoritativeTwin?.location?.parcelGeometry);
  const exactAddressMatch = reference?.matchStrategy === 'exact_source_address_match';
  const nearestOnly = reference?.matchStrategy === 'nearest_source_building_within_neighborhood';

  if (reference?.measuredHeight?.verifiedMeasuredHeight === true) {
    return { title: 'Verified measured voxel massing', detail: 'Parcel-linked footprint + accepted measured height · facade details not inferred' };
  }
  if (hasCountyBuilding) {
    return { title: 'County-backed building footprint', detail: 'Parcel-linked building geometry · height remains illustrative until measured' };
  }
  const status = String(reference?.height?.heightStatus || '');
  if (reference?.found && exactAddressMatch && status === 'source_reported') {
    return { title: 'Address-matched voxel massing', detail: `${hasParcelBoundary ? 'Source address match + jurisdiction parcel boundary' : 'Source address match'} · reported height · facade details not inferred` };
  }
  if (reference?.found && exactAddressMatch && status === 'derived_from_levels') {
    return { title: 'Address-matched source massing', detail: `${hasParcelBoundary ? 'Source address match + jurisdiction parcel boundary' : 'Source address match'} · height derived from reported floors` };
  }
  if (reference?.found && exactAddressMatch) {
    return { title: 'Address-matched source footprint', detail: `${hasParcelBoundary ? 'Source address match + jurisdiction parcel boundary' : 'Source address match'} · unsupported architectural details are not invented` };
  }
  if (reference?.found && nearestOnly) {
    return { title: 'Nearest source-backed building', detail: `${hasParcelBoundary ? 'Jurisdiction parcel boundary shown separately · ' : ''}Exact address match not proven; building is neighborhood reference only` };
  }
  if (reference?.found) {
    return { title: 'Source-backed footprint', detail: 'Footprint is sourced; unsupported architectural details are not invented' };
  }
  return { title: '3D reference preview', detail: 'Search for a source-backed property to build its voxel massing' };
}

function cameraPreset(viewMode, sceneRadius, compactMode, focusRadius, focusHeight) {
  if (focusRadius > 0) {
    const verticalExtent = Math.max(0, Number(focusHeight) || 0) * (compactMode ? 0.72 : 0.64);
    const framingExtent = Math.max(focusRadius, verticalExtent);
    if (viewMode === 'top') {
      return { azimuth: 0.03, elevation: 1.49, radius: Math.max(compactMode ? 5.2 : 5.7, focusRadius * 3.55), autoOrbit: false };
    }
    if (viewMode === 'street') {
      return { azimuth: 0.52, elevation: 0.15, radius: Math.max(compactMode ? 4.1 : 4.7, framingExtent * 3.05), autoOrbit: false };
    }
    return { azimuth: 0.72, elevation: 0.36, radius: Math.max(compactMode ? 4.7 : 5.2, framingExtent * 3.35), autoOrbit: true };
  }
  if (viewMode === 'top') return { azimuth: 0.03, elevation: 1.49, radius: Math.max(compactMode ? 9.8 : 10.8, sceneRadius * 1.68), autoOrbit: false };
  if (viewMode === 'street') return { azimuth: 0.5, elevation: 0.17, radius: Math.max(compactMode ? 7.6 : 8.5, sceneRadius * 1.18), autoOrbit: false };
  return { azimuth: 0.72, elevation: 0.43, radius: Math.max(compactMode ? 9.7 : 10.7, sceneRadius * 1.58), autoOrbit: true };
}

function publicRealmLineClass(way) {
  const highway = String(way?.tags?.highway || '').toLowerCase();
  if (way?.kind === 'walkway') return 'walkway';
  if (['motorway', 'trunk', 'primary'].includes(highway)) return 'major';
  if (['secondary', 'tertiary'].includes(highway)) return 'secondary';
  if (['service', 'track'].includes(highway)) return 'service';
  return 'local';
}

function lineMidpoint(local = []) {
  if (!Array.isArray(local) || local.length < 2) return null;
  const lengths = [];
  let total = 0;
  for (let index = 0; index < local.length - 1; index += 1) {
    const length = Math.hypot(local[index + 1].east - local[index].east, local[index + 1].north - local[index].north);
    lengths.push(length);
    total += length;
  }
  if (!total) return local[Math.floor(local.length / 2)];
  let cursor = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    if (cursor <= lengths[index]) {
      const t = cursor / Math.max(lengths[index], Number.EPSILON);
      return {
        east: local[index].east + (local[index + 1].east - local[index].east) * t,
        north: local[index].north + (local[index + 1].north - local[index].north) * t,
      };
    }
    cursor -= lengths[index];
  }
  return local[local.length - 1];
}

function createTextSprite({ THREE, text, compactMode, foreground = '#f7efdf', background = 'rgba(15,23,21,0.84)', border = 'rgba(245,235,215,0.18)', textures, materials }) {
  if (!text || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const fontSize = compactMode ? 24 : 28;
  const horizontal = compactMode ? 20 : 24;
  context.font = `800 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  const measured = Math.ceil(context.measureText(text).width);
  canvas.width = Math.min(800, Math.max(150, measured + horizontal * 2));
  canvas.height = compactMode ? 54 : 62;

  context.font = `800 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const radius = 16;
  context.beginPath();
  context.roundRect?.(1, 1, canvas.width - 2, canvas.height - 2, radius);
  if (!context.roundRect) context.rect(1, 1, canvas.width - 2, canvas.height - 2);
  context.fillStyle = background;
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = foreground;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textures.push(texture);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  materials.push(material);
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  const height = compactMode ? 0.46 : 0.5;
  sprite.scale.set(height * aspect, height, 1);
  sprite.renderOrder = 12;
  return sprite;
}

function addInterpolatedTerrain({ THREE, root, terrain, terrainRadiusMeters, compactMode, geometries, materials }) {
  if (!terrain?.available || !Array.isArray(terrain.samples) || terrain.samples.length < 4) return false;
  const rings = compactMode ? 8 : 12;
  const segments = compactMode ? 48 : 72;
  const vertices = [0, terrainRelativeMeters(terrain, 0, 0) * METERS_TO_SCENE, 0];
  for (let ring = 1; ring <= rings; ring += 1) {
    const radiusMeters = terrainRadiusMeters * (ring / rings);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const east = Math.cos(angle) * radiusMeters;
      const north = Math.sin(angle) * radiusMeters;
      vertices.push(
        east * METERS_TO_SCENE,
        terrainRelativeMeters(terrain, east, north) * METERS_TO_SCENE,
        -north * METERS_TO_SCENE,
      );
    }
  }

  const indices = [];
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % segments));
  }
  for (let ring = 2; ring <= rings; ring += 1) {
    const innerStart = 1 + (ring - 2) * segments;
    const outerStart = 1 + (ring - 1) * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const innerA = innerStart + segment;
      const innerB = innerStart + next;
      const outerA = outerStart + segment;
      const outerB = outerStart + next;
      indices.push(innerA, outerA, innerB, innerB, outerA, outerB);
    }
  }

  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new THREE.MeshStandardMaterial({ color: 0x667469, roughness: 0.97, metalness: 0, side: THREE.DoubleSide });
  geometries.push(terrainGeometry);
  materials.push(terrainMaterial);
  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);
  return true;
}

function addPublicRealmContext({ THREE, root, publicRealm, originLongitude, originLatitude, terrain, terrainRadiusMeters, compactMode, geometries, materials, textures, pickables, streetLabels }) {
  const ways = Array.isArray(publicRealm?.ways) ? publicRealm.ways.slice(0, compactMode ? 20 : 32) : [];
  if (!ways.length) return 0;
  const majorStreetMaterial = new THREE.LineDashedMaterial({
    color: 0xf0d7aa, transparent: true, opacity: 0.94, dashSize: compactMode ? 0.24 : 0.28, gapSize: compactMode ? 0.055 : 0.06, depthWrite: false,
  });
  const secondaryStreetMaterial = new THREE.LineDashedMaterial({
    color: 0xe6cda5, transparent: true, opacity: 0.86, dashSize: compactMode ? 0.2 : 0.23, gapSize: compactMode ? 0.065 : 0.07, depthWrite: false,
  });
  const streetMaterial = new THREE.LineDashedMaterial({
    color: 0xd8c19e, transparent: true, opacity: 0.75, dashSize: compactMode ? 0.16 : 0.19, gapSize: compactMode ? 0.07 : 0.075, depthWrite: false,
  });
  const serviceMaterial = new THREE.LineDashedMaterial({
    color: 0xc3b59c, transparent: true, opacity: 0.58, dashSize: compactMode ? 0.1 : 0.12, gapSize: compactMode ? 0.085 : 0.09, depthWrite: false,
  });
  const walkwayMaterial = new THREE.LineDashedMaterial({
    color: 0xf0b99c, transparent: true, opacity: 0.78, dashSize: compactMode ? 0.08 : 0.1, gapSize: compactMode ? 0.055 : 0.06, depthWrite: false,
  });
  materials.push(majorStreetMaterial, secondaryStreetMaterial, streetMaterial, serviceMaterial, walkwayMaterial);
  const materialForWay = (way) => {
    const lineClass = publicRealmLineClass(way);
    if (lineClass === 'walkway') return walkwayMaterial;
    if (lineClass === 'major') return majorStreetMaterial;
    if (lineClass === 'secondary') return secondaryStreetMaterial;
    if (lineClass === 'service') return serviceMaterial;
    return streetMaterial;
  };
  const named = new Set();
  const maxLabels = compactMode ? 4 : 8;
  let rendered = 0;

  for (const way of ways) {
    const local = localLineString(way?.geometry, originLongitude, originLatitude);
    const clippedSegments = localLineSegmentsWithinRadius(local, terrainRadiusMeters * 1.08);
    const feature = {
      type: way?.kind === 'walkway' ? 'Mapped path' : 'Mapped street',
      title: way?.tags?.name || way?.tags?.highway || (way?.kind === 'walkway' ? 'Mapped path' : 'Mapped street'),
      subtitle: way?.tags?.name ? String(way?.tags?.highway || 'OpenStreetMap way') : 'OpenStreetMap centerline',
      facts: [
        way?.tags?.surface ? `Surface tag: ${way.tags.surface}` : null,
        way?.tags?.lanes ? `Lanes tag: ${way.tags.lanes}` : null,
        way?.tags?.sidewalk ? `Sidewalk tag: ${way.tags.sidewalk}` : null,
      ].filter(Boolean),
      note: 'Source-backed mapped centerline. The rendered stroke is cartographic styling only, not measured road, curb, right-of-way, lane, or sidewalk width.',
      sourceUrl: way?.sourceUrl || '',
    };

    for (const segment of clippedSegments) {
      const dense = densifyLocalLine(segment, compactMode ? 10 : 7);
      const points = dense.map((point) => new THREE.Vector3(
        point.east * METERS_TO_SCENE,
        terrainRelativeMeters(terrain, point.east, point.north) * METERS_TO_SCENE + 0.03,
        -point.north * METERS_TO_SCENE,
      ));
      if (points.length < 2) continue;

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometries.push(geometry);
      const line = new THREE.Line(geometry, materialForWay(way));
      line.computeLineDistances();
      line.userData.feature = feature;
      line.renderOrder = 3;
      root.add(line);
      pickables.push(line);
      rendered += 1;
    }

    const name = String(way?.tags?.name || '').trim();
    if (name && !named.has(name.toLowerCase()) && named.size < maxLabels) {
      const midpoint = lineMidpoint(local);
      if (midpoint && Math.hypot(midpoint.east, midpoint.north) <= terrainRadiusMeters * 0.95) {
        const sprite = createTextSprite({
          THREE,
          text: name,
          compactMode,
          foreground: way?.kind === 'walkway' ? '#ffd6c0' : '#f5e6c7',
          textures,
          materials,
        });
        if (sprite) {
          sprite.position.set(
            midpoint.east * METERS_TO_SCENE,
            terrainRelativeMeters(terrain, midpoint.east, midpoint.north) * METERS_TO_SCENE + (compactMode ? 0.34 : 0.4),
            -midpoint.north * METERS_TO_SCENE,
          );
          root.add(sprite);
          streetLabels.push(sprite);
          named.add(name.toLowerCase());
        }
      }
    }
  }
  return rendered;
}

function addVoxelShell({ THREE, root, local, baseY, visualHeight, compactMode, geometries, materials }) {
  const bounds = polygonBounds(local);
  if (!bounds) return;
  const width = Math.max(1, bounds.maxEast - bounds.minEast);
  const depth = Math.max(1, bounds.maxNorth - bounds.minNorth);
  const cellMeters = Math.max(compactMode ? 2.1 : 1.5, width / (compactMode ? 38 : 56), depth / (compactMode ? 38 : 56));
  const cellScene = cellMeters * METERS_TO_SCENE;
  const heightCells = Math.max(3, Math.min(compactMode ? 26 : 38, Math.round(visualHeight / Math.max(0.045, cellScene * 0.72))));
  const cellHeight = visualHeight / heightCells;
  const columns = [];

  for (let east = bounds.minEast + cellMeters / 2; east <= bounds.maxEast; east += cellMeters) {
    for (let north = bounds.minNorth + cellMeters / 2; north <= bounds.maxNorth; north += cellMeters) {
      if (!pointInPolygon(east, north, local)) continue;
      const boundary = [[cellMeters, 0], [-cellMeters, 0], [0, cellMeters], [0, -cellMeters]]
        .some(([dx, dz]) => !pointInPolygon(east + dx, north + dz, local));
      columns.push({ east, north, boundary });
    }
  }

  if (!columns.length) return;
  const requested = columns.reduce((sum, column) => sum + (column.boundary ? heightCells : 1), 0);
  const maxInstances = compactMode ? 950 : 1900;
  const stride = Math.max(1, Math.ceil(requested / maxInstances));
  const geometry = new THREE.BoxGeometry(cellScene * 0.9, Math.max(0.03, cellHeight * 0.86), cellScene * 0.9);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf2e7d4,
    roughness: 0.61,
    metalness: 0.02,
    emissive: 0x1d231f,
    emissiveIntensity: 0.04,
  });
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
        matrix.makeTranslation(
          column.east * METERS_TO_SCENE,
          baseY + cellHeight * (level + 0.5),
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
}

function addSilhouetteLines({ THREE, root, local, baseY, visualHeight, geometries, materials }) {
  const footprint = local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.018, -point.north * METERS_TO_SCENE));
  const roof = local.map((point) => new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + visualHeight + 0.012, -point.north * METERS_TO_SCENE));
  if (!footprint.length || !roof.length) return;
  footprint.push(footprint[0].clone());
  roof.push(roof[0].clone());

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0.88 });
  materials.push(lineMaterial);
  const footprintGeometry = new THREE.BufferGeometry().setFromPoints(footprint);
  const roofGeometry = new THREE.BufferGeometry().setFromPoints(roof);
  geometries.push(footprintGeometry, roofGeometry);
  root.add(new THREE.Line(footprintGeometry, lineMaterial));
  root.add(new THREE.Line(roofGeometry, lineMaterial));

  const verticalPoints = [];
  const cornerStride = Math.max(1, Math.ceil(local.length / 18));
  local.forEach((point, index) => {
    if (index % cornerStride !== 0) return;
    verticalPoints.push(
      new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + 0.018, -point.north * METERS_TO_SCENE),
      new THREE.Vector3(point.east * METERS_TO_SCENE, baseY + visualHeight + 0.012, -point.north * METERS_TO_SCENE),
    );
  });
  if (verticalPoints.length) {
    const verticalGeometry = new THREE.BufferGeometry().setFromPoints(verticalPoints);
    geometries.push(verticalGeometry);
    root.add(new THREE.LineSegments(verticalGeometry, lineMaterial));
  }
}

function addParcelBoundary({ THREE, root, parcelGeometry, originLongitude, originLatitude, terrain, geometries, materials, pickables }) {
  const parcelPolygons = localPolygons(parcelGeometry, originLongitude, originLatitude);
  if (!parcelPolygons.length) return;
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xb7f0d5, transparent: true, opacity: 0.98, depthTest: true });
  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x9ddfc5, transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false });
  const markerGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xc7f5e2, transparent: true, opacity: 0.72 });
  materials.push(outlineMaterial, fillMaterial, markerMaterial);
  geometries.push(markerGeometry);

  const feature = {
    type: 'Parcel boundary',
    title: 'Source-backed parcel boundary',
    subtitle: 'Jurisdiction parcel geometry',
    facts: [],
    note: 'This outline represents the jurisdiction parcel geometry supplied to GEO. It does not by itself prove current deed ownership, title condition, building footprint, measured dimensions, or investment rights.',
    sourceUrl: '',
  };

  for (const local of parcelPolygons) {
    const points = local.map((point) => new THREE.Vector3(
      point.east * METERS_TO_SCENE,
      terrainRelativeMeters(terrain, point.east, point.north) * METERS_TO_SCENE + 0.045,
      -point.north * METERS_TO_SCENE,
    ));
    if (points.length < 3) continue;
    points.push(points[0].clone());
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometries.push(geometry);
    const outline = new THREE.Line(geometry, outlineMaterial);
    outline.renderOrder = 5;
    root.add(outline);

    const shape = shapeFromLocal(THREE, local);
    if (shape) {
      const fillGeometry = new THREE.ShapeGeometry(shape);
      fillGeometry.rotateX(-Math.PI / 2);
      geometries.push(fillGeometry);
      const center = averageLocalCenter([local]);
      const fill = new THREE.Mesh(fillGeometry, fillMaterial);
      fill.position.y = terrainRelativeMeters(terrain, center.east, center.north) * METERS_TO_SCENE + 0.022;
      fill.userData.feature = feature;
      fill.renderOrder = 1;
      root.add(fill);
      pickables.push(fill);
    }

    const stride = Math.max(1, Math.ceil(local.length / 10));
    local.forEach((point, index) => {
      if (index % stride !== 0) return;
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(
        point.east * METERS_TO_SCENE,
        terrainRelativeMeters(terrain, point.east, point.north) * METERS_TO_SCENE + 0.1,
        -point.north * METERS_TO_SCENE,
      );
      root.add(marker);
    });
  }
}

function featureCardStyle() {
  return {
    position: 'absolute', left: 12, top: 12, width: 'min(72%, 286px)', padding: '11px 12px', borderRadius: 16,
    border: '1px solid rgba(244, 235, 214, 0.18)', background: 'rgba(10, 16, 15, 0.84)', backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)', color: '#f6efe1', boxShadow: '0 16px 38px rgba(0, 0, 0, 0.24)', zIndex: 5,
  };
}

export default function GeoReferenceModel({ reference, authoritativeTwin = null, viewMode = 'orbit', resetKey = 0 }) {
  const mountRef = useRef(null);
  const compassNeedleRef = useRef(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const label = useMemo(() => evidenceLabel(reference, authoritativeTwin), [reference, authoritativeTwin]);
  const publicRealmFound = reference?.publicRealm?.found === true && Number(reference?.publicRealm?.mappedWayCount || 0) > 0;
  const terrainFound = reference?.terrain?.available === true;
  const mappedWayCount = Number(reference?.publicRealm?.mappedWayCount || 0);
  const buildingCount = Number(reference?.neighborhoodBuildingCount || reference?.neighborhoodBuildings?.length || 0);

  useEffect(() => { setSelectedFeature(null); }, [reference?.source?.recordId, authoritativeTwin?.location?.source?.recordId]);

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
      renderer.toneMappingExposure = viewMode === 'top' ? 1.12 : 1.08;
      renderer.shadowMap.enabled = !compactMode;
      if (!compactMode) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D property map. Drag or use arrow keys to orbit, pinch or plus and minus to zoom, and tap mapped buildings, streets, paths, or the parcel to inspect source context.');
      mount.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(viewMode === 'top' ? 0x0f1816 : 0x101716);
      scene.fog = new THREE.FogExp2(0x101716, compactMode ? 0.021 : 0.017);
      const camera = new THREE.PerspectiveCamera(viewMode === 'top' ? (compactMode ? 35 : 31) : (compactMode ? 42 : 37), width / height, 0.05, 170);
      const root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.HemisphereLight(0xf8f0df, 0x26352f, viewMode === 'top' ? 2.45 : 2.2));

      const sun = new THREE.DirectionalLight(0xffeed2, compactMode ? 3.6 : 4.3);
      sun.position.set(10, 18, 7);
      sun.castShadow = !compactMode;
      if (!compactMode) {
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 });
      }
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa6d2c8, 1.25);
      fill.position.set(-9, 7, -8);
      scene.add(fill);

      const geometries = [];
      const materials = [];
      const textures = [];
      const pickables = [];
      const streetLabels = [];
      const contextDetails = [];
      const authoritativeGeometry = authoritativeTwin?.structure?.buildingGeometry || null;
      const parcelGeometry = authoritativeTwin?.location?.parcelGeometry || null;
      const displayGeometry = authoritativeGeometry || reference?.geometry || null;
      const originLatitude = Number(reference?.latitude ?? authoritativeTwin?.location?.latitude);
      const originLongitude = Number(reference?.longitude ?? authoritativeTwin?.location?.longitude);
      const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
      const terrain = reference?.terrain || null;
      const terrainRadiusMeters = Math.max(55, Math.min(180, Number(terrain?.radiusMeters) || Number(reference?.radiusMeters) || 85));
      const sceneRadius = terrainRadiusMeters * METERS_TO_SCENE;
      const primaryPolygons = validOrigin ? localPolygons(displayGeometry, originLongitude, originLatitude) : [];
      const primaryCenter = averageLocalCenter(primaryPolygons);
      const primaryRadius = footprintRadiusScene(primaryPolygons, primaryCenter);
      const primaryRecordId = String(reference?.source?.recordId || '');
      const hasPrimary = primaryPolygons.length > 0;
      const heightInfo = hasPrimary ? displayHeight(reference, authoritativeTwin) : { meters: 0, status: 'none' };
      const primaryVisualHeight = hasPrimary ? Math.max(2.2, Math.min(500, Number(heightInfo.meters) || 3)) * METERS_TO_SCENE : 0;

      const plinthGeometry = new THREE.CylinderGeometry(sceneRadius * 1.08, sceneRadius * 1.12, 0.3, compactMode ? 64 : 84);
      const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0x202a27, roughness: 0.92, metalness: 0.01 });
      geometries.push(plinthGeometry);
      materials.push(plinthMaterial);
      const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
      plinth.position.y = -0.34;
      plinth.receiveShadow = true;
      root.add(plinth);

      const terrainRendered = addInterpolatedTerrain({ THREE, root, terrain, terrainRadiusMeters, compactMode, geometries, materials });
      if (!terrainRendered) {
        const groundGeometry = new THREE.CircleGeometry(sceneRadius, compactMode ? 56 : 72);
        groundGeometry.rotateX(-Math.PI / 2);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x667469, roughness: 0.97, metalness: 0 });
        geometries.push(groundGeometry);
        materials.push(groundMaterial);
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.04;
        ground.receiveShadow = true;
        root.add(ground);
      }

      if (validOrigin && reference?.publicRealm?.found) {
        addPublicRealmContext({
          THREE,
          root,
          publicRealm: reference.publicRealm,
          originLongitude,
          originLatitude,
          terrain,
          terrainRadiusMeters,
          compactMode,
          geometries,
          materials,
          textures,
          pickables,
          streetLabels,
        });
      }

      const grid = new THREE.GridHelper(sceneRadius * 1.75, compactMode ? 22 : 32, 0x729086, 0x4c625a);
      grid.position.y = 0.012;
      grid.material.transparent = true;
      grid.material.opacity = reference?.publicRealm?.found ? (viewMode === 'top' ? 0.045 : 0.025) : 0.09;
      materials.push(grid.material);
      geometries.push(grid.geometry);
      root.add(grid);

      if (validOrigin && parcelGeometry) {
        addParcelBoundary({ THREE, root, parcelGeometry, originLongitude, originLatitude, terrain, geometries, materials, pickables });
      }

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
        .slice(0, compactMode ? 10 : 18) : [];

      const contextEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xaab9b2, transparent: true, opacity: compactMode ? 0.16 : 0.22 });
      materials.push(contextEdgeMaterial);
      if (validOrigin) for (const { buildingRef, localCenter, distance } of surroundings) {
        if (buildingRef.selected === true || String(buildingRef.id || '') === primaryRecordId) continue;
        const polygons = localPolygons(buildingRef.geometry, originLongitude, originLatitude);
        for (const local of polygons) {
          const shape = shapeFromLocal(THREE, local);
          if (!shape) continue;
          const sourceHeight = Math.max(2.2, Math.min(120, Number(buildingRef?.height?.referenceHeightMeters) || 3));
          const visualHeight = sourceHeight * METERS_TO_SCENE;
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          geometry.rotateX(-Math.PI / 2);
          const nearFactor = 1 - Math.min(1, distance / terrainRadiusMeters);
          const material = new THREE.MeshStandardMaterial({
            color: nearFactor > 0.6 ? 0x5b6964 : 0x4b5753,
            roughness: 0.9,
            metalness: 0,
            transparent: true,
            opacity: 0.29 + nearFactor * 0.16,
          });
          geometries.push(geometry);
          materials.push(material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.y = terrainRelativeMeters(terrain, localCenter.east, localCenter.north) * METERS_TO_SCENE;
          mesh.receiveShadow = true;
          const address = [buildingRef?.tags?.houseNumber, buildingRef?.tags?.street].filter(Boolean).join(' ');
          mesh.userData.feature = {
            type: 'Mapped building',
            title: buildingRef?.tags?.name || address || 'Nearby mapped building',
            subtitle: buildingRef?.height?.heightStatus === 'source_reported' ? 'OSM footprint + reported height' : buildingRef?.height?.heightStatus === 'derived_from_levels' ? 'OSM footprint + level-derived height' : 'OSM footprint + illustrative height',
            facts: [
              buildingRef?.tags?.building ? `Building tag: ${buildingRef.tags.building}` : null,
              Number.isFinite(Number(buildingRef?.distanceMeters)) ? `${Math.round(Number(buildingRef.distanceMeters))} m from search point` : null,
            ].filter(Boolean),
            note: 'Neighborhood reference geometry only. It is not a cadastral parcel, deed record, ownership record, current-condition survey, or independently verified spatial twin.',
            sourceUrl: buildingRef?.sourceUrl || '',
          };
          root.add(mesh);
          pickables.push(mesh);

          if (!compactMode || distance < terrainRadiusMeters * 0.45) {
            const edgesGeometry = new THREE.EdgesGeometry(geometry, 32);
            geometries.push(edgesGeometry);
            const edges = new THREE.LineSegments(edgesGeometry, contextEdgeMaterial);
            edges.position.copy(mesh.position);
            root.add(edges);
            contextDetails.push(edges);
          }
        }
      }

      const focusTarget = new THREE.Vector3(0, Math.max(0.22, sceneRadius * 0.035), 0);
      let primaryHalo = null;
      if (hasPrimary) {
        const visualHeight = primaryVisualHeight;
        const baseY = terrainRelativeMeters(terrain, primaryCenter.east, primaryCenter.north) * METERS_TO_SCENE;
        const centerX = primaryCenter.east * METERS_TO_SCENE;
        const centerZ = -primaryCenter.north * METERS_TO_SCENE;
        focusTarget.set(centerX, baseY + Math.max(0.09, visualHeight * 0.5), centerZ);
        const sourceAddress = [reference?.tags?.houseNumber, reference?.tags?.street].filter(Boolean).join(' ');
        const primaryFeature = {
          type: authoritativeGeometry ? 'Selected parcel building' : 'Selected mapped building',
          title: reference?.tags?.name || sourceAddress || 'Selected property',
          subtitle: label.title,
          facts: [
            Number.isFinite(Number(heightInfo.meters)) && heightInfo.meters > 0 ? `Displayed height: ${Number(heightInfo.meters).toFixed(1)} m (${heightInfo.status.replaceAll('_', ' ')})` : null,
            reference?.matchStrategy === 'exact_source_address_match' ? 'Exact source address match' : reference?.matchStrategy === 'nearest_source_building_within_neighborhood' ? 'Nearest source building; exact address match not proven' : null,
          ].filter(Boolean),
          note: label.detail,
          sourceUrl: reference?.source?.sourceUrl || '',
        };

        for (const local of primaryPolygons) {
          const shape = shapeFromLocal(THREE, local);
          if (shape) {
            const coreGeometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
            coreGeometry.rotateX(-Math.PI / 2);
            const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x9c9585, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.62 });
            geometries.push(coreGeometry);
            materials.push(coreMaterial);
            const core = new THREE.Mesh(coreGeometry, coreMaterial);
            core.position.y = baseY;
            core.castShadow = !compactMode;
            core.receiveShadow = true;
            core.userData.feature = primaryFeature;
            root.add(core);
            pickables.push(core);
          }
          addVoxelShell({ THREE, root, local, baseY, visualHeight, compactMode, geometries, materials });
          addSilhouetteLines({ THREE, root, local, baseY, visualHeight, geometries, materials });
        }

        const propertyLabelText = reference?.tags?.name || sourceAddress;
        if (propertyLabelText) {
          const propertyLabel = createTextSprite({
            THREE,
            text: propertyLabelText,
            compactMode,
            foreground: '#fff2d9',
            background: 'rgba(30,31,27,0.9)',
            border: 'rgba(255,235,197,0.28)',
            textures,
            materials,
          });
          if (propertyLabel) {
            propertyLabel.position.set(centerX, baseY + visualHeight + (compactMode ? 0.58 : 0.68), centerZ);
            propertyLabel.scale.multiplyScalar(compactMode ? 0.95 : 1.08);
            root.add(propertyLabel);
            streetLabels.push(propertyLabel);
          }
        }

        const haloRadius = Math.max(0.65, Math.min(3.2, primaryRadius * 1.18 || 0.9));
        const haloGeometry = new THREE.RingGeometry(haloRadius * 0.94, haloRadius, 80);
        const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xf0d8aa, transparent: true, opacity: 0.29, side: THREE.DoubleSide, depthWrite: false });
        geometries.push(haloGeometry);
        materials.push(haloMaterial);
        primaryHalo = new THREE.Mesh(haloGeometry, haloMaterial);
        primaryHalo.rotation.x = -Math.PI / 2;
        primaryHalo.position.set(centerX, baseY + 0.026, centerZ);
        root.add(primaryHalo);
      }

      const preset = cameraPreset(viewMode, sceneRadius, compactMode, hasPrimary ? primaryRadius : 0, primaryVisualHeight);
      let { azimuth, elevation, radius } = preset;
      let autoOrbit = preset.autoOrbit && !reducedMotion;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let pinchDistance = null;
      let pointerStart = null;
      const pointers = new Map();
      const framingExtent = Math.max(primaryRadius, primaryVisualHeight * (compactMode ? 0.72 : 0.64));
      const minRadius = hasPrimary
        ? Math.max(compactMode ? 2.7 : 3.1, framingExtent * 1.65)
        : Math.max(compactMode ? 4.7 : 5.5, sceneRadius * 0.6);
      const maxRadius = Math.max(preset.radius * 2.1, sceneRadius * 3.1);
      const raycaster = new THREE.Raycaster();
      raycaster.params.Line.threshold = compactMode ? 0.2 : 0.14;
      const pointerVector = new THREE.Vector2();

      const updateCompass = () => {
        if (!compassNeedleRef.current) return;
        const centerProjected = focusTarget.clone().project(camera);
        const northProjected = focusTarget.clone().add(new THREE.Vector3(0, 0, -1)).project(camera);
        const dx = northProjected.x - centerProjected.x;
        const dy = northProjected.y - centerProjected.y;
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.00001) return;
        const angle = Math.atan2(dx, dy);
        compassNeedleRef.current.style.transform = `rotate(${angle}rad)`;
      };

      const updateLod = () => {
        const normalized = radius / Math.max(preset.radius, 0.001);
        const labelsVisible = viewMode === 'top' ? normalized < 1.95 : normalized < 1.36;
        streetLabels.forEach((sprite) => { sprite.visible = labelsVisible; });
        const detailVisible = normalized < (viewMode === 'top' ? 1.65 : 1.18);
        contextDetails.forEach((object) => { object.visible = detailVisible; });
        grid.material.opacity = reference?.publicRealm?.found
          ? (viewMode === 'top' ? Math.max(0.02, 0.06 - normalized * 0.012) : Math.max(0.012, 0.045 - normalized * 0.016))
          : 0.09;
      };

      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(
          focusTarget.x + Math.sin(azimuth) * c * radius,
          focusTarget.y + Math.sin(elevation) * radius,
          focusTarget.z + Math.cos(azimuth) * c * radius,
        );
        camera.lookAt(focusTarget);
        camera.updateMatrixWorld();
        updateCompass();
        updateLod();
      };
      const resetCamera = () => {
        azimuth = preset.azimuth;
        elevation = preset.elevation;
        radius = preset.radius;
        autoOrbit = preset.autoOrbit && !reducedMotion;
        updateCamera();
      };
      updateCamera();

      const inspectAt = (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointerVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointerVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerVector, camera);
        const intersections = raycaster.intersectObjects(pickables, false);
        const feature = intersections.find((hit) => hit?.object?.userData?.feature)?.object?.userData?.feature || null;
        if (feature) setSelectedFeature({ ...feature });
      };

      const down = (event) => {
        event.preventDefault();
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pointerStart = pointers.size === 1 ? { x: event.clientX, y: event.clientY, at: performance.now() } : null;
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
          pointerStart = null;
          return;
        }
        if (!dragging) return;
        const movement = pointerStart ? Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) : 999;
        if (movement > 7) pointerStart = null;
        azimuth -= (event.clientX - lastX) * 0.0065;
        elevation = Math.max(0.08, Math.min(1.5, elevation + (event.clientY - lastY) * 0.004));
        lastX = event.clientX;
        lastY = event.clientY;
        updateCamera();
      };

      const up = (event) => {
        const wasTap = Boolean(pointerStart
          && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 7
          && performance.now() - pointerStart.at < 520
          && pointers.size === 1);
        pointers.delete(event.pointerId);
        if (wasTap) inspectAt(event);
        pointerStart = null;
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
        radius = Math.max(minRadius, Math.min(maxRadius, radius + event.deltaY * 0.01));
        updateCamera();
      };

      const keydown = (event) => {
        const key = event.key;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'].includes(key)) return;
        event.preventDefault();
        autoOrbit = false;
        if (key === 'ArrowLeft') azimuth += 0.11;
        if (key === 'ArrowRight') azimuth -= 0.11;
        if (key === 'ArrowUp') elevation = Math.min(1.5, elevation + 0.08);
        if (key === 'ArrowDown') elevation = Math.max(0.08, elevation - 0.08);
        if (key === '+' || key === '=') radius = Math.max(minRadius, radius * 0.9);
        if (key === '-' || key === '_') radius = Math.min(maxRadius, radius * 1.1);
        if (key === 'Home') resetCamera(); else updateCamera();
      };

      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });
      renderer.domElement.addEventListener('keydown', keydown);

      const clock = new THREE.Clock();
      let frame = 0;
      let inViewport = true;
      let documentVisible = !document.hidden;
      let lastRenderAt = 0;
      const compactFrameInterval = 1000 / 30;
      const animate = (time = 0) => {
        frame = requestAnimationFrame(animate);
        if (!inViewport || !documentVisible) return;
        if (compactMode && time - lastRenderAt < compactFrameInterval) return;
        lastRenderAt = time;
        const delta = Math.min(clock.getDelta(), 0.05);
        if (!reducedMotion) {
          const elapsed = clock.elapsedTime;
          if (primaryHalo) primaryHalo.material.opacity = 0.245 + (Math.sin(elapsed * 1.15) + 1) * 0.035;
          if (autoOrbit) {
            azimuth += delta * 0.015;
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
        updateCompass();
      };
      const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(mount);
      const intersectionObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
        inViewport = entries.some((entry) => entry.isIntersecting);
        if (inViewport) clock.getDelta();
      }, { threshold: 0.01 }) : null;
      intersectionObserver?.observe(mount);
      const visibilityChange = () => {
        documentVisible = !document.hidden;
        if (documentVisible) clock.getDelta();
      };
      document.addEventListener('visibilitychange', visibilityChange);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        document.removeEventListener('visibilitychange', visibilityChange);
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        renderer.domElement.removeEventListener('keydown', keydown);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        mount.replaceChildren();
      };
    });

    return () => { disposed = true; cleanup(); };
  }, [
    reference?.source?.recordId,
    reference?.source?.observedAt,
    reference?.matchStrategy,
    reference?.height?.referenceHeightMeters,
    reference?.neighborhoodBuildingCount,
    reference?.publicRealm?.mappedWayCount,
    reference?.publicRealm?.source?.observedAt,
    reference?.terrain?.source?.observedAt,
    reference?.measuredHeight?.status,
    reference?.measuredHeight?.heightMeters,
    reference?.measuredHeight?.verifiedMeasuredHeight,
    authoritativeTwin?.location?.source?.recordId,
    authoritativeTwin?.structure?.source?.recordId,
    authoritativeTwin?.structure?.heightMeters,
    viewMode,
    resetKey,
    label.title,
    label.detail,
  ]);

  const inspector = selectedFeature ? createElement('div', { style: featureCardStyle(), role: 'status', 'aria-label': `${selectedFeature.type} details` },
    createElement('button', {
      type: 'button',
      onClick: () => setSelectedFeature(null),
      'aria-label': 'Close map feature details',
      style: { position: 'absolute', right: 8, top: 7, width: 30, height: 30, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.055)', color: '#f6efe1', fontSize: 18, cursor: 'pointer' },
    }, '×'),
    createElement('div', { style: { paddingRight: 34, fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', fontWeight: 900, color: '#a9d9c8' } }, selectedFeature.type),
    createElement('div', { style: { paddingRight: 28, marginTop: 3, fontSize: 14, lineHeight: 1.18, fontWeight: 850 } }, selectedFeature.title),
    createElement('div', { style: { marginTop: 4, fontSize: 10, lineHeight: 1.35, color: 'rgba(246,239,225,0.7)' } }, selectedFeature.subtitle),
    Array.isArray(selectedFeature.facts) && selectedFeature.facts.length ? createElement('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 } },
      ...selectedFeature.facts.slice(0, 3).map((fact, index) => createElement('span', { key: `${fact}-${index}`, style: { fontSize: 9, padding: '4px 6px', borderRadius: 999, background: 'rgba(169,217,200,0.08)', border: '1px solid rgba(169,217,200,0.12)', color: 'rgba(236,248,242,0.84)' } }, fact)),
    ) : null,
    createElement('div', { style: { marginTop: 8, fontSize: 9, lineHeight: 1.4, color: 'rgba(246,239,225,0.58)' } }, selectedFeature.note),
  ) : createElement('div', { style: { ...featureCardStyle(), width: 'auto', maxWidth: 'min(72%, 250px)', padding: '8px 10px', pointerEvents: 'none' }, 'aria-label': 'Map source summary' },
    createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
      createElement('span', { style: { width: 7, height: 7, borderRadius: 999, background: '#a9d9c8', boxShadow: '0 0 14px rgba(169,217,200,0.55)' } }),
      createElement('strong', { style: { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' } }, viewMode === 'top' ? 'Source map view' : 'Interactive source map'),
    ),
    createElement('div', { style: { marginTop: 4, fontSize: 9, lineHeight: 1.3, color: 'rgba(246,239,225,0.62)' } }, `${buildingCount} mapped building${buildingCount === 1 ? '' : 's'} · ${mappedWayCount} street/path way${mappedWayCount === 1 ? '' : 's'}${authoritativeTwin?.location?.parcelGeometry ? ' · parcel boundary' : ''}`),
    createElement('div', { style: { marginTop: 3, fontSize: 9, color: 'rgba(246,239,225,0.48)' } }, 'Tap a building, street, path, or parcel to inspect its evidence.'),
  );

  return createElement('div', { style: { position: 'absolute', inset: 0 }, 'aria-label': 'Interactive realistic voxel property and neighborhood reference' },
    createElement('div', { ref: mountRef, style: { position: 'absolute', inset: 0 } }),
    inspector,
    createElement('div', {
      'aria-label': 'North compass',
      style: {
        position: 'absolute', right: 12, top: 12, width: 42, height: 50, borderRadius: 16,
        border: '1px solid rgba(244, 235, 214, 0.16)', background: 'rgba(12, 18, 17, 0.7)', backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)', color: '#f6efe1', pointerEvents: 'none', display: 'grid', placeItems: 'center',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)', zIndex: 4,
      },
    },
    createElement('div', { ref: compassNeedleRef, style: { fontSize: 22, lineHeight: 1, transformOrigin: '50% 50%', transition: 'transform 80ms linear' } }, '↑'),
    createElement('div', { style: { position: 'absolute', bottom: 5, fontSize: 8, fontWeight: 900, letterSpacing: '0.08em', opacity: 0.82 } }, 'N')),
    createElement('div', {
      style: {
        position: 'absolute', left: 12, bottom: 12, maxWidth: 'min(88%, 500px)', padding: '9px 11px', borderRadius: 14,
        border: '1px solid rgba(244, 235, 214, 0.16)', background: 'rgba(12, 18, 17, 0.76)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', color: '#f6efe1', pointerEvents: 'none', boxShadow: '0 12px 34px rgba(0, 0, 0, 0.2)', zIndex: 4,
      },
    },
    createElement('div', { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.01em' } }, label.title),
    createElement('div', { style: { marginTop: 2, fontSize: 10, lineHeight: 1.35, color: 'rgba(246, 239, 225, 0.68)' } }, label.detail),
    authoritativeTwin?.location?.parcelGeometry ? createElement('div', { style: { marginTop: 5, fontSize: 9, color: 'rgba(183, 240, 213, 0.92)' } }, 'Mint outline + translucent fill = source-backed parcel boundary') : null,
    publicRealmFound ? createElement('div', { style: { marginTop: 4, fontSize: 9, color: 'rgba(232, 207, 166, 0.92)' } }, 'Sand/peach dashes = mapped street/path centerlines · stroke thickness is visual only') : null,
    publicRealmFound ? createElement('div', { style: { marginTop: 4, fontSize: 9, color: 'rgba(238, 220, 186, 0.72)' } }, 'Dash rhythm and color distinguish mapped road/path classes without inventing road width. Source street names appear as you zoom closer; tap mapped features for evidence context.') : null,
    terrainFound ? createElement('div', { style: { marginTop: 4, fontSize: 9, color: 'rgba(198, 214, 202, 0.82)' } }, `Terrain = interpolated visual surface from ${Number(reference?.terrain?.sampleCount || reference?.terrain?.samples?.length || 0)} USGS point samples · not a survey`) : null));
}
