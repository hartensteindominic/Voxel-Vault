'use client';

import { useEffect, useRef } from 'react';

function outerRing(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0] : [];
  if (geometry.type === 'MultiPolygon') return Array.isArray(geometry.coordinates?.[0]?.[0]) ? geometry.coordinates[0][0] : [];
  return [];
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
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07100d, 22, 42);
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xf5fff9, 0x06100d, 2.5));
      const sun = new THREE.DirectionalLight(0xffffff, 3.4);
      sun.position.set(7, 10, 8);
      scene.add(sun);
      const accent = new THREE.PointLight(0x7ce9c4, 30, 30);
      accent.position.set(-5, 5, 6);
      scene.add(accent);

      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const mat = (params) => { const material = new THREE.MeshStandardMaterial(params); materials.push(material); return material; };

      const groundGeometry = new THREE.CylinderGeometry(6.4, 6.8, 0.35, 64);
      geometries.push(groundGeometry);
      const ground = new THREE.Mesh(groundGeometry, mat({ color: 0x15251f, roughness: 0.86, metalness: 0.05 }));
      ground.position.y = -0.25;
      root.add(ground);

      const orbitGeometry = new THREE.RingGeometry(5.8, 6.0, 72);
      geometries.push(orbitGeometry);
      const orbitRing = new THREE.Mesh(orbitGeometry, mat({ color: 0x7ce9c4, emissive: 0x164c3c, emissiveIntensity: 1.1, side: THREE.DoubleSide }));
      orbitRing.rotation.x = -Math.PI / 2;
      orbitRing.position.y = -0.06;
      root.add(orbitRing);

      const polygonRing = outerRing(reference?.geometry);
      if (reference?.found && polygonRing.length >= 4) {
        const lat0 = Number(polygonRing[0][1]);
        const lon0 = Number(polygonRing[0][0]);
        const cosLat = Math.max(0.2, Math.cos(lat0 * Math.PI / 180));
        const points = polygonRing.slice(0, -1).map(([lon, lat]) => ({
          x: (Number(lon) - lon0) * 111320 * cosLat,
          y: (Number(lat) - lat0) * 111320,
        }));
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const span = Math.max(maxX - minX, maxY - minY, 1);
        const scale = 7.2 / span;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const shape = new THREE.Shape();
        points.forEach((point, index) => {
          const x = (point.x - centerX) * scale;
          const y = (point.y - centerY) * scale;
          if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        });
        shape.closePath();
        const sourceHeight = Math.max(0.5, Number(reference?.height?.referenceHeightMeters) || 3);
        const visualDepth = Math.max(0.55, Math.min(8, sourceHeight * scale));
        const buildingGeometry = new THREE.ExtrudeGeometry(shape, { depth: visualDepth, bevelEnabled: false, curveSegments: 1, steps: 1 });
        buildingGeometry.rotateX(-Math.PI / 2);
        geometries.push(buildingGeometry);
        const building = new THREE.Mesh(buildingGeometry, mat({ color: 0xd7ddd9, roughness: 0.48, metalness: 0.08 }));
        root.add(building);

        const edgesGeometry = new THREE.EdgesGeometry(buildingGeometry, 28);
        geometries.push(edgesGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x7ce9c4, transparent: true, opacity: 0.65 });
        materials.push(edgeMaterial);
        root.add(new THREE.LineSegments(edgesGeometry, edgeMaterial));
      } else {
        const markerGeometry = new THREE.TorusGeometry(2.3, 0.12, 12, 64);
        geometries.push(markerGeometry);
        const marker = new THREE.Mesh(markerGeometry, mat({ color: 0x7ce9c4, emissive: 0x164c3c, emissiveIntensity: 1.2 }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.05;
        root.add(marker);
      }

      let azimuth = 0.75;
      let elevation = 0.55;
      let radius = 17;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const updateCamera = () => {
        const c = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * c * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * c * radius);
        camera.lookAt(0, 1.5, 0);
      };
      updateCamera();
      const down = (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; };
      const move = (event) => {
        if (!dragging) return;
        azimuth -= (event.clientX - lastX) * 0.008;
        elevation = Math.max(0.18, Math.min(1.0, elevation + (event.clientY - lastY) * 0.005));
        lastX = event.clientX; lastY = event.clientY; updateCamera();
      };
      const up = () => { dragging = false; };
      const wheel = (event) => { radius = Math.max(9, Math.min(25, radius + event.deltaY * 0.01)); updateCamera(); };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: true });

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        orbitRing.rotation.z += 0.0018;
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
  }, [reference?.source?.recordId, reference?.height?.referenceHeightMeters]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
