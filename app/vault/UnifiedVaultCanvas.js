'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const zoneOrder = ['creator', 'wallet', 'reit'];
const zoneX = { creator: -7.2, wallet: 0, reit: 7.2 };

function cappedEntries(entries = []) {
  const groups = new Map(zoneOrder.map((zone) => [zone, []]));
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!groups.has(entry?.zone)) continue;
    const group = groups.get(entry.zone);
    if (group.length < 8) group.push(entry);
  }
  return zoneOrder.flatMap((zone) => groups.get(zone));
}

function materialFor(zone, active = false) {
  const colors = {
    creator: active ? 0xa985ff : 0x624f88,
    wallet: active ? 0x74dcff : 0x36687a,
    reit: active ? 0xb8ff55 : 0x52743a,
  };
  const emissive = {
    creator: 0x29194c,
    wallet: 0x123c4d,
    reit: 0x1b3810,
  };
  return new THREE.MeshStandardMaterial({
    color: colors[zone] || 0x607060,
    emissive: emissive[zone] || 0x101510,
    emissiveIntensity: active ? 0.78 : 0.28,
    roughness: 0.58,
    metalness: 0.1,
  });
}

function assetGeometry(entry, index) {
  if (entry.zone === 'creator') {
    return new THREE.BoxGeometry(1.5 + (index % 2) * 0.2, 1.5 + (index % 3) * 0.2, 1.5 + (index % 2) * 0.2);
  }
  if (entry.zone === 'wallet') {
    return new THREE.OctahedronGeometry(1.02 + (index % 2) * 0.12, 0);
  }
  const amountBoost = Math.min(Math.log10(Number(entry.amount || 0) + 1) * 0.8, 2.6);
  return new THREE.BoxGeometry(1.65, 2.4 + amountBoost, 1.65);
}

export default function UnifiedVaultCanvas({ entries = [] }) {
  const hostRef = useRef(null);
  const normalized = useMemo(() => cappedEntries(entries), [entries]);
  const [selectedId, setSelectedId] = useState('');
  const [webglError, setWebglError] = useState('');
  const selected = normalized.find((entry) => entry.id === selectedId) || normalized[0] || null;

  useEffect(() => {
    if (selectedId && !normalized.some((entry) => entry.id === selectedId)) setSelectedId('');
  }, [normalized, selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('3D mode is unavailable in this browser. Every verified asset remains listed below.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070b, 22, 48);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(16, 13, 22);
    camera.lookAt(0, 1.8, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    world.rotation.y = -0.38;
    scene.add(world);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(14.8, 15.6, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x0d1314, roughness: 0.94, metalness: 0.03 })
    );
    floor.position.y = -0.38;
    world.add(floor);

    const floorEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(14.9, 15.7, 0.57, 8)),
      new THREE.LineBasicMaterial({ color: 0x7f98a2, transparent: true, opacity: 0.22 })
    );
    floorEdge.position.y = -0.37;
    world.add(floorEdge);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x151d20, roughness: 0.98 });
    [-3.6, 3.6].forEach((x) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 24), roadMaterial);
      road.position.set(x, -0.02, 0);
      world.add(road);
    });
    const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.06, 1.3), roadMaterial);
    crossRoad.position.set(0, -0.01, 4.8);
    world.add(crossRoad);

    const zonePads = [
      ['creator', 0x281f3e],
      ['wallet', 0x102c38],
      ['reit', 0x1a2d15],
    ];
    zonePads.forEach(([zone, color]) => {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.12, 10.6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.92 })
      );
      pad.position.set(zoneX[zone], 0.02, 0.1);
      world.add(pad);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(5.6, 0.13, 10.6)),
        new THREE.LineBasicMaterial({ color: zone === 'creator' ? 0xa985ff : zone === 'wallet' ? 0x74dcff : 0xb8ff55, transparent: true, opacity: 0.28 })
      );
      edges.position.copy(pad.position);
      world.add(edges);
    });

    const interactive = [];
    const zoneCounts = { creator: 0, wallet: 0, reit: 0 };
    normalized.forEach((entry, index) => {
      const localIndex = zoneCounts[entry.zone]++;
      const column = localIndex % 2;
      const row = Math.floor(localIndex / 2);
      const x = zoneX[entry.zone] + (column === 0 ? -1.35 : 1.35);
      const z = 3.35 - row * 2.25;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      world.add(group);

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.28, 1.42, 0.28, entry.zone === 'wallet' ? 6 : 8),
        new THREE.MeshStandardMaterial({ color: 0x1b2426, roughness: 0.78, metalness: 0.08 })
      );
      pedestal.position.y = 0.14;
      group.add(pedestal);

      const mesh = new THREE.Mesh(assetGeometry(entry, localIndex), materialFor(entry.zone, true));
      const geometryHeight = entry.zone === 'reit'
        ? 2.4 + Math.min(Math.log10(Number(entry.amount || 0) + 1) * 0.8, 2.6)
        : entry.zone === 'creator'
          ? 1.5 + (localIndex % 3) * 0.2
          : 2.1;
      mesh.position.y = 0.48 + geometryHeight / 2;
      mesh.userData.assetId = entry.id;
      group.add(mesh);
      interactive.push(mesh);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.035, 8, 32),
        new THREE.MeshBasicMaterial({
          color: entry.zone === 'creator' ? 0xa985ff : entry.zone === 'wallet' ? 0x74dcff : 0xb8ff55,
          transparent: true,
          opacity: 0.62,
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.37;
      group.add(halo);

      if (entry.zone === 'reit') {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.18, 1.9),
          new THREE.MeshStandardMaterial({ color: 0xb8ff55, emissive: 0x244812, emissiveIntensity: 0.5, roughness: 0.45 })
        );
        cap.position.y = 0.5 + geometryHeight;
        group.add(cap);
      }

      if (entry.zone === 'wallet') mesh.rotation.y = Math.PI / 4;
      if (entry.zone === 'creator') mesh.rotation.y = (localIndex % 4) * 0.18;
    });

    const gate = new THREE.Group();
    gate.position.set(0, 0, -7.2);
    world.add(gate);
    const gateMaterial = new THREE.MeshStandardMaterial({ color: 0x66573e, emissive: 0x241b0c, emissiveIntensity: 0.3, roughness: 0.72 });
    [-2.1, 2.1].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.2, 0.75), gateMaterial);
      pillar.position.set(x, 1.6, 0);
      gate.add(pillar);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 0.75), gateMaterial);
    lintel.position.set(0, 3.05, 0);
    gate.add(lintel);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 0.34), gateMaterial);
    lock.position.set(0, 1.45, 0.18);
    gate.add(lock);

    const grid = new THREE.GridHelper(36, 36, 0x253239, 0x151e21);
    grid.position.y = -0.08;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

    scene.add(new THREE.HemisphereLight(0xddeeff, 0x111819, 2.25));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(9, 14, 10);
    scene.add(key);
    const creatorLight = new THREE.PointLight(0xa985ff, 8, 18, 2);
    creatorLight.position.set(-8, 7, 1);
    scene.add(creatorLight);
    const reitLight = new THREE.PointLight(0xb8ff55, 8, 18, 2);
    reitLight.position.set(8, 7, 1);
    scene.add(reitLight);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let targetRotation = world.rotation.y;

    const pointerDown = (event) => {
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!dragging) return;
      const delta = event.clientX - lastX;
      lastX = event.clientX;
      if (Math.abs(event.clientX - startX) > 5 || Math.abs(event.clientY - startY) > 5) moved = true;
      targetRotation += delta * 0.008;
    };
    const pointerUp = (event) => {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0];
      const assetId = hit?.object?.userData?.assetId;
      if (assetId) setSelectedId(assetId);
    };
    const contextLost = (event) => {
      event.preventDefault();
      setWebglError('The 3D view paused because the browser released WebGL. Verified asset records are still available below.');
    };

    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setAnimationLoop(() => {
      if (!dragging && !reducedMotion) targetRotation += 0.00055;
      world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, targetRotation, 0.065);
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose?.());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [normalized]);

  return (
    <div style={frame}>
      <div ref={hostRef} style={canvasHost} aria-label="Interactive spatial Vault containing creator assets, verified wallet collectibles, provider-reported Digital REIT positions, and a locked direct-property wing" />
      <div style={zoneLegend}>
        <span style={{...legendPill,borderColor:'rgba(169,133,255,.35)'}}>CREATOR GALLERY</span>
        <span style={{...legendPill,borderColor:'rgba(116,220,255,.35)'}}>WALLET COLLECTION</span>
        <span style={{...legendPill,borderColor:'rgba(184,255,85,.35)'}}>DIGITAL REIT DISTRICT</span>
        <span style={{...legendPill,borderColor:'rgba(218,183,118,.35)'}}>DIRECT PROPERTY · LOCKED</span>
      </div>
      <div style={instruction}>DRAG TO ROTATE · TAP AN ASSET</div>
      {selected ? (
        <div style={detailCard}>
          <div style={{minWidth:0}}>
            <div style={eyebrow}>{selected.truthLabel}</div>
            <div style={title}>{selected.title}</div>
            <div style={source}>{selected.sourceLabel}</div>
          </div>
          <div style={detailRight}>
            {selected.kind === 'digital-reit' ? <b>{Number(selected.amount || 0).toFixed(6)} units</b> : null}
            <a href={selected.href} style={openLink}>OPEN ASSET →</a>
          </div>
        </div>
      ) : (
        <div style={emptyCard}>Your spatial Vault is ready. Verified assets appear in their own source-specific wings as you connect them.</div>
      )}
      {webglError ? <div style={errorBox}>{webglError}</div> : null}
    </div>
  );
}

const frame={position:'relative',minHeight:520,border:'1px solid rgba(255,255,255,.10)',borderRadius:30,overflow:'hidden',background:'radial-gradient(circle at 50% 15%,#182126 0%,#080c10 48%,#05060c 100%)',boxShadow:'0 40px 120px rgba(0,0,0,.32)'};
const canvasHost={height:520,width:'100%',cursor:'grab'};
const zoneLegend={position:'absolute',top:14,left:14,right:14,display:'flex',gap:7,flexWrap:'wrap',pointerEvents:'none'};
const legendPill={border:'1px solid rgba(255,255,255,.18)',background:'rgba(5,6,12,.72)',backdropFilter:'blur(14px)',borderRadius:999,padding:'7px 10px',fontSize:9,fontWeight:900,letterSpacing:'.1em',color:'#e8edf0'};
const instruction={position:'absolute',top:54,right:14,fontSize:9,fontWeight:900,letterSpacing:'.11em',color:'#849199',background:'rgba(5,6,12,.64)',borderRadius:999,padding:'6px 9px',pointerEvents:'none'};
const detailCard={position:'absolute',left:14,right:14,bottom:14,display:'flex',justifyContent:'space-between',alignItems:'end',gap:14,flexWrap:'wrap',padding:'15px 17px',border:'1px solid rgba(255,255,255,.12)',borderRadius:19,background:'rgba(5,6,12,.84)',backdropFilter:'blur(18px)'};
const eyebrow={fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'#8f9ba3'};
const title={fontSize:27,fontWeight:900,letterSpacing:'-.045em',marginTop:3,textTransform:'capitalize',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:520};
const source={fontSize:10,color:'#9aa5ab',marginTop:4,letterSpacing:'.06em'};
const detailRight={display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',fontSize:12};
const openLink={display:'inline-flex',alignItems:'center',borderRadius:999,padding:'9px 12px',background:'#fff',color:'#080a0e',textDecoration:'none',fontSize:10,fontWeight:950,letterSpacing:'.08em'};
const emptyCard={position:'absolute',left:14,right:14,bottom:14,padding:'14px 16px',border:'1px solid rgba(255,255,255,.1)',borderRadius:18,background:'rgba(5,6,12,.82)',color:'#aeb8bd',fontSize:12,lineHeight:1.6,backdropFilter:'blur(16px)'};
const errorBox={position:'absolute',inset:'auto 14px 14px',padding:12,border:'1px solid #654844',background:'rgba(23,13,12,.94)',borderRadius:14,color:'#f0c5bd',fontSize:12};
