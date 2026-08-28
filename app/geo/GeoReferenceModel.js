'use client';

import { useEffect, useRef } from 'react';

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07100d, 22, 44);
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xf5fff9, 0x06100d, 2.35));
      const sun = new THREE.DirectionalLight(0xffffff, 3.2);
      sun.position.set(8, 12, 9);
      scene.add(sun);
      const accent = new THREE.PointLight(0x7ce9c4, 24, 28);
      accent.position.set(-6, 6, 7);
      scene.add(accent);

      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const mat = (params) => { const material = new THREE.MeshStandardMaterial(params); materials.push(material); return material; };
      const lineMat = (params) => { const material = new THREE.LineBasicMaterial(params); materials.push(material); return material; };

      const groundGeometry = new THREE.CylinderGeometry(6.65, 6.95, 0.32, 64);
      geometries.push(groundGeometry);
      const ground = new THREE.Mesh(groundGeometry, mat({ color: 0x13231d, roughness: 0.92, metalness: 0.03 }));
      ground.position.y = -0.27;
      root.add(ground);

      const grid = new THREE.GridHelper(11.8, 18, 0x315d4f, 0x1a332a);
      grid.position.y = -0.095;
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.22; materials.push(material); });
      root.add(grid);

      const orbitGeometry = new THREE.RingGeometry(5.9, 6.02, 96);
      geometries.push(orbitGeometry);
      const orbitRing = new THREE.Mesh(orbitGeometry, mat({ color: 0x7ce9c4, emissive: 0x164c3c, emissiveIntensity: 0.9, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
      orbitRing.rotation.x = -Math.PI / 2;
      orbitRing.position.y = -0.075;
      root.add(orbitRing);

      const polygonRing = outerRing(reference?.geometry);
      if (reference?.found && polygonRing.length >= 4) {
        const lat0 = Number(polygonRing[0][1]);
        const lon0 = Number(polygonRing[0][0]);
        const cosLat = Math.max(0.2, Math.cos(lat0 * Math.PI / 180));
        const rawPoints = polygonRing.slice(0, -1).map(([lon, lat]) => ({
          x: (Number(lon) - lon0) * 111320 * cosLat,
          y: (Number(lat) - lat0) * 111320,
        })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

        if (rawPoints.length >= 3) {
          const xs = rawPoints.map((point) => point.x);
          const ys = rawPoints.map((point) => point.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const span = Math.max(maxX - minX, maxY - minY, 1);
          const scale = 7.1 / span;
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const points = rawPoints.map((point) => ({ x: (point.x - centerX) * scale, y: (point.y - centerY) * scale }));
          const shape = new THREE.Shape();
          points.forEach((point, index) => {
            if (index === 0) shape.moveTo(point.x, point.y); else shape.lineTo(point.x, point.y);
          });
          shape.closePath();

          const sourceHeight = Math.max(0.5, Number(reference?.height?.referenceHeightMeters) || 3);
          const visualHeight = Math.max(0.8, Math.min(8.2, sourceHeight * scale));
          const levels = numericLevels(reference, sourceHeight);

          const footprintPoints = points.map((point) => new THREE.Vector3(point.x, 0.015, -point.y));
          if (footprintPoints.length) footprintPoints.push(footprintPoints[0].clone());
          const footprintGeometry = new THREE.BufferGeometry().setFromPoints(footprintPoints);
          geometries.push(footprintGeometry);
          root.add(new THREE.Line(footprintGeometry, lineMat({ color: 0x7ce9c4, transparent: true, opacity: 0.9 })));

          const buildingGeometry = new THREE.ExtrudeGeometry(shape, { depth: visualHeight, bevelEnabled: false, curveSegments: 1, steps: 1 });
          buildingGeometry.rotateX(-Math.PI / 2);
          geometries.push(buildingGeometry);
          const buildingMaterial = mat({ color: 0xcbd4d0, roughness: 0.58, metalness: 0.06, transparent: true, opacity: 0.96 });
          const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
          root.add(building);

          const edgesGeometry = new THREE.EdgesGeometry(buildingGeometry, 18);
          geometries.push(edgesGeometry);
          root.add(new THREE.LineSegments(edgesGeometry, lineMat({ color: 0x8bf1ce, transparent: true, opacity: 0.72 })));

          const roofGeometry = new THREE.ShapeGeometry(shape);
          roofGeometry.rotateX(-Math.PI / 2);
          geometries.push(roofGeometry);
          const roof = new THREE.Mesh(roofGeometry, mat({ color: 0xe6eeea, roughness: 0.4, metalness: 0.08, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
          roof.position.y = visualHeight + 0.012;
          root.add(roof);

          const bandCount = Math.min(levels - 1, 11);
          for (let floor = 1; floor <= bandCount; floor += 1) {
            const y = visualHeight * (floor / levels);
            const bandPoints = points.map((point) => new THREE.Vector3(point.x, y, -point.y));
            if (bandPoints.length) bandPoints.push(bandPoints[0].clone());
            const bandGeometry = new THREE.BufferGeometry().setFromPoints(bandPoints);
            geometries.push(bandGeometry);
            root.add(new THREE.Line(bandGeometry, lineMat({ color: 0x5cae93, transparent: true, opacity: 0.34 })));
          }

          const pillarGeometry = new THREE.CylinderGeometry(0.025, 0.025, visualHeight, 5);
          geometries.push(pillarGeometry);
          const pillarMaterial = mat({ color: 0x7ce9c4, emissive: 0x173d32, emissiveIntensity: 0.5, roughness: 0.45 });
          const stride = Math.max(1, Math.ceil(points.length / 18));
          points.filter((_, index) => index % stride === 0).slice(0, 18).forEach((point) => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(point.x, visualHeight / 2, -point.y);
            root.add(pillar);
          });

          const beaconGeometry = new THREE.RingGeometry(Math.max(0.35, Math.min(2.4, span * scale * 0.23)), Math.max(0.41, Math.min(2.48, span * scale * 0.23 + 0.08)), 64);
          geometries.push(beaconGeometry);
          const beacon = new THREE.Mesh(beaconGeometry, mat({ color: 0xffffff, emissive: 0x356f5e, emissiveIntensity: 0.8, transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
          beacon.rotation.x = -Math.PI / 2;
          beacon.position.y = visualHeight + 0.075;
          root.add(beacon);
        }
      } else {
        const markerGeometry = new THREE.TorusGeometry(2.3, 0.1, 12, 72);
        geometries.push(markerGeometry);
        const marker = new THREE.Mesh(markerGeometry, mat({ color: 0x7ce9c4, emissive: 0x164c3c, emissiveIntensity: 1.15 }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.05;
        root.add(marker);
      }

      let azimuth = 0.72;
      let elevation = 0.5;
      let radius = 17;
      let dragging = false;
      let autoOrbit = true;
      let lastX = 0;
      let lastY = 0;
      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * c * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * c * radius);
        camera.lookAt(0, 1.55, 0);
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
        elevation = Math.max(0.18, Math.min(1.08, elevation + (event.clientY - lastY) * 0.005));
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
        radius = Math.max(8.5, Math.min(26, radius + event.deltaY * 0.012));
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
        orbitRing.rotation.z += 0.00125;
        if (autoOrbit) {
          azimuth += 0.0011;
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
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters, reference?.tags?.levels]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
