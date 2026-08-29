'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeRecipe(estate) {
  return {
    version: 1,
    kind: 'purchased-digital-estate-voxel',
    estateId: String(estate?.id || ''),
    architecture: String(estate?.architecture || 'house'),
    floors: clamp(estate?.floors || 1, 1, 4),
    sqft: Number(estate?.sqft || 0),
    colors: {
      accent: String(estate?.accent || '#c9ff54'),
      structure: String(estate?.structure || '#d9d4ca'),
      roof: String(estate?.roof || '#342d3b'),
      terrain: String(estate?.terrain || '#52634b'),
    },
  };
}

function addBox(THREE, root, spec) {
  const geometry = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness ?? 0.78,
    metalness: spec.metalness ?? 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(spec.x || 0, spec.y || 0, spec.z || 0);
  if (spec.rx) mesh.rotation.x = spec.rx;
  if (spec.ry) mesh.rotation.y = spec.ry;
  if (spec.rz) mesh.rotation.z = spec.rz;
  root.add(mesh);
  return mesh;
}

function addWindowRow(THREE, root, { count = 5, width = 5, y = 0.45, z = 1.56, color }) {
  const gap = width / Math.max(1, count);
  for (let index = 0; index < count; index += 1) {
    addBox(THREE, root, {
      x: -width / 2 + gap * (index + 0.5),
      y,
      z,
      w: Math.max(0.34, gap * 0.52),
      h: 0.62,
      d: 0.12,
      color,
      roughness: 0.28,
      metalness: 0.08,
    });
  }
}

function addVoxelRoof(THREE, root, { y, width, depth, color }) {
  addBox(THREE, root, { x: 0, y, z: 0, w: width + 0.28, h: 0.22, d: depth + 0.28, color, roughness: 0.9 });
  const steps = 6;
  for (let index = 0; index < steps; index += 1) {
    const inset = index * 0.18;
    addBox(THREE, root, {
      x: 0,
      y: y + 0.14 + index * 0.13,
      z: 0,
      w: Math.max(0.5, width - inset * 2),
      h: 0.14,
      d: Math.max(0.5, depth - inset * 2),
      color,
      roughness: 0.92,
    });
  }
}

function buildEstate(THREE, root, estate) {
  const recipe = makeRecipe(estate);
  const { accent, structure, roof, terrain } = recipe.colors;
  const floors = recipe.floors;
  const floorHeight = 1.35;
  const bodyY = (floors * floorHeight) / 2 - 0.12;
  const bodyH = floors * floorHeight;
  const architecture = recipe.architecture;

  addBox(THREE, root, { x: 0, y: -0.48, z: 0.25, w: 8.8, h: 0.42, d: 7.5, color: terrain, roughness: 0.98 });
  addBox(THREE, root, { x: 0, y: -0.22, z: 2.7, w: 5.4, h: 0.12, d: 1.35, color: '#efe7d7', roughness: 0.92 });

  if (architecture === 'courtyard') {
    addBox(THREE, root, { x: 0, y: bodyY, z: -1.3, w: 6.5, h: bodyH, d: 1.7, color: structure });
    addBox(THREE, root, { x: -2.55, y: bodyY, z: 0.6, w: 1.4, h: bodyH, d: 3.9, color: structure });
    addBox(THREE, root, { x: 2.55, y: bodyY, z: 0.6, w: 1.4, h: bodyH, d: 3.9, color: structure });
    addBox(THREE, root, { x: 0, y: -0.16, z: 0.75, w: 3.6, h: 0.08, d: 2.7, color: accent, roughness: 0.35 });
    addWindowRow(THREE, root, { count: 4, width: 4.8, y: 0.5, z: -0.39, color: accent });
  } else if (architecture === 'glass') {
    addBox(THREE, root, { x: 0, y: bodyY, z: 0, w: 7.2, h: bodyH, d: 2.75, color: structure });
    addBox(THREE, root, { x: 0, y: bodyY, z: 1.43, w: 6.4, h: Math.max(0.8, bodyH - 0.34), d: 0.13, color: accent, roughness: 0.2, metalness: 0.12 });
    addBox(THREE, root, { x: 0, y: -0.12, z: 2.18, w: 3.6, h: 0.08, d: 0.9, color: '#8dd6db', roughness: 0.28 });
    addBox(THREE, root, { x: 0, y: bodyH + 0.08, z: 0, w: 7.65, h: 0.22, d: 3.2, color: roof });
  } else if (architecture === 'waterfront') {
    addBox(THREE, root, { x: -0.35, y: bodyY, z: 0, w: 5.8, h: bodyH, d: 3.1, color: structure });
    if (floors > 1) addBox(THREE, root, { x: 0.75, y: bodyH + 0.55, z: -0.25, w: 3.7, h: 1.2, d: 2.65, color: structure });
    addWindowRow(THREE, root, { count: 5, width: 4.7, y: 0.5, z: 1.61, color: accent });
    if (floors > 1) addWindowRow(THREE, root, { count: 4, width: 3.2, y: bodyH + 0.55, z: 1.14, color: accent });
    addBox(THREE, root, { x: 0.2, y: -0.08, z: 2.35, w: 5.9, h: 0.16, d: 1.3, color: roof, roughness: 0.9 });
    addBox(THREE, root, { x: 2.55, y: 0.15, z: 2.95, w: 0.7, h: 0.32, d: 2.3, color: '#d7c7a6', roughness: 0.9 });
  } else if (architecture === 'villa') {
    addBox(THREE, root, { x: 0, y: bodyY, z: -0.65, w: 3.2, h: bodyH, d: 2.3, color: structure });
    addBox(THREE, root, { x: -2.45, y: bodyY - 0.18, z: 0.2, w: 2.2, h: Math.max(1.35, bodyH - 0.36), d: 3.3, color: structure });
    addBox(THREE, root, { x: 2.45, y: bodyY - 0.18, z: 0.2, w: 2.2, h: Math.max(1.35, bodyH - 0.36), d: 3.3, color: structure });
    addBox(THREE, root, { x: 0, y: -0.12, z: 1.55, w: 2.6, h: 0.08, d: 1.1, color: accent, roughness: 0.35 });
    addVoxelRoof(THREE, root, { y: bodyH + 0.02, width: 3.45, depth: 2.55, color: roof });
    addVoxelRoof(THREE, root, { y: Math.max(1.35, bodyH - 0.34) + 0.02, width: 2.45, depth: 3.55, color: roof });
    addWindowRow(THREE, root, { count: 3, width: 2.4, y: 0.5, z: 0.56, color: accent });
  } else if (architecture === 'sky-villa') {
    const levels = Math.max(3, floors);
    for (let level = 0; level < levels; level += 1) {
      addBox(THREE, root, {
        x: level % 2 === 0 ? -0.55 : 0.55,
        y: 0.35 + level * 1.25,
        z: level === 1 ? -0.35 : 0,
        w: 5.4 - level * 0.35,
        h: 1.05,
        d: 2.65,
        color: structure,
      });
      addWindowRow(THREE, root, { count: 4, width: 4.1 - level * 0.25, y: 0.35 + level * 1.25, z: 1.38, color: accent });
    }
    addBox(THREE, root, { x: -0.4, y: levels * 1.25 + 0.2, z: 0, w: 4.1, h: 0.2, d: 2.6, color: roof });
    addBox(THREE, root, { x: 1.25, y: levels * 1.25 + 0.42, z: 0.35, w: 1.25, h: 0.24, d: 1.1, color: terrain });
  } else {
    addBox(THREE, root, { x: 0, y: bodyY, z: 0, w: 5.6, h: bodyH, d: 3.0, color: structure });
    addVoxelRoof(THREE, root, { y: bodyH + 0.04, width: 5.9, depth: 3.3, color: roof });
    addWindowRow(THREE, root, { count: 5, width: 4.5, y: 0.5, z: 1.56, color: accent });
  }

  addBox(THREE, root, { x: 0, y: 0.38, z: 1.6, w: 0.72, h: 1.15, d: 0.18, color: roof, roughness: 0.72 });

  const grid = new THREE.GridHelper(9, 18, accent, '#cfc5b8');
  grid.position.y = -0.69;
  grid.material.transparent = true;
  grid.material.opacity = 0.17;
  root.add(grid);

  return recipe;
}

export default function PurchasedEstateVoxelViewer({ estate, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  callbackRef.current = onReady;

  useEffect(() => {
    if (!estate?.id || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    reportedRef.current = false;
    setReady(false);
    setError('');

    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      } catch {
        if (!dead) setError('Interactive 3D is unavailable in this browser.');
        return;
      }

      const initialWidth = Math.max(280, mount.clientWidth || 360);
      const initialHeight = Math.max(330, mount.clientHeight || 430);
      const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.12 : 1.4));
      renderer.setSize(initialWidth, initialHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.setClearColor(0xf8f0e3, 1);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xf8f0e3, 14, 24);
      scene.add(new THREE.HemisphereLight(0xfffbef, 0x4b3c58, 2.6));
      const key = new THREE.DirectionalLight(0xfff0d5, 4.2);
      key.position.set(6, 9, 7);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xb9a6ff, 1.7);
      fill.position.set(-5, 4, 2);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera(33, initialWidth / initialHeight, 0.1, 70);
      let cameraDistance = compact ? 13.8 : 12.8;
      camera.position.set(0, 3.25, cameraDistance);
      camera.lookAt(0, 1.05, 0);

      const root = new THREE.Group();
      root.rotation.x = -0.06;
      root.rotation.y = 0.46;
      scene.add(root);
      const recipe = buildEstate(THREE, root, estate);

      const pointers = new Map();
      let lastX = 0;
      let lastY = 0;
      let pinch = 0;
      let targetX = root.rotation.x;
      let targetY = root.rotation.y;
      const getDistance = () => {
        const pair = [...pointers.values()].slice(0, 2);
        return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
      };
      const updateCamera = () => {
        camera.position.set(0, 3.25, cameraDistance);
        camera.lookAt(0, 1.05, 0);
      };
      const down = (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        lastX = event.clientX;
        lastY = event.clientY;
        if (pointers.size === 2) pinch = getDistance();
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        const previous = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const nextPinch = getDistance();
          if (pinch > 0 && nextPinch > 0) {
            cameraDistance = clamp(cameraDistance - (nextPinch - pinch) * 0.018, 8.8, 18.5);
            updateCamera();
          }
          pinch = nextPinch;
          return;
        }
        const dx = event.clientX - (previous?.x ?? lastX);
        const dy = event.clientY - (previous?.y ?? lastY);
        targetY += dx * 0.009;
        targetX = clamp(targetX + dy * 0.0055, -0.48, 0.35);
        lastX = event.clientX;
        lastY = event.clientY;
      };
      const up = (event) => {
        pointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        pinch = getDistance();
      };
      const wheel = (event) => {
        event.preventDefault();
        cameraDistance = clamp(cameraDistance + event.deltaY * 0.008, 8.8, 18.5);
        updateCamera();
      };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });

      let frame = 0;
      const draw = () => {
        if (dead) return;
        root.rotation.x += (targetX - root.rotation.x) * 0.12;
        root.rotation.y += (targetY - root.rotation.y) * 0.12;
        if (!reducedMotion && pointers.size === 0) targetY += 0.00125;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(draw);
      };
      draw();

      const resize = () => {
        if (dead || !mountRef.current) return;
        const width = Math.max(280, mount.clientWidth || initialWidth);
        const height = Math.max(330, mount.clientHeight || initialHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      observer?.observe(mount);

      requestAnimationFrame(() => {
        if (dead) return;
        renderer.render(scene, camera);
        let thumbnailDataUrl = '';
        try { thumbnailDataUrl = renderer.domElement.toDataURL('image/jpeg', 0.9); } catch {}
        setReady(true);
        if (!reportedRef.current) {
          reportedRef.current = true;
          callbackRef.current?.({ recipe, thumbnailDataUrl });
        }
      });

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('pointercancel', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        scene.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
          else object.material?.dispose?.();
        });
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    }).catch(() => {
      if (!dead) setError('The 3D renderer could not load.');
    });

    return () => { dead = true; cleanup(); };
  }, [estate?.id]);

  return <div style={{width:'100%',height:'100%',position:'relative'}}>
    <div ref={mountRef} aria-label={`${estate?.name || 'Purchased property'} interactive 3D voxel`} style={{width:'100%',height:'100%',minHeight:330}} />
    {!ready && !error ? <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none',fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#6d6175'}}>BUILDING YOUR VOXEL…</div> : null}
    {error ? <div role="alert" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:24,textAlign:'center',fontSize:13,color:'#7f3030'}}>{error}</div> : null}
  </div>;
}
