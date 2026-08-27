'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAssets(assets = [], positions = [], watchlistSymbols = []) {
  const holdings = new Map((positions || []).map((position) => [String(position.symbol || '').toUpperCase(), position]));
  const confirmed = Array.isArray(assets) && assets.length > 0;
  const source = confirmed
    ? assets
    : (watchlistSymbols || []).map((symbol) => ({ id: `watchlist-${symbol}`, symbol, name: `${symbol} watchlist preview` }));

  return source.slice(0, 12).map((asset, index) => {
    const symbol = String(asset.symbol || `ASSET-${index + 1}`).toUpperCase();
    const holding = holdings.get(symbol);
    return {
      id: String(asset.id || `${symbol}-${index}`),
      symbol,
      name: String(asset.name || symbol),
      confirmed,
      held: Boolean(holding && number(holding.amount) > 0),
      amount: number(holding?.amount),
    };
  });
}

export default function ReitVaultCanvas({ assets = [], positions = [], watchlistSymbols = [] }) {
  const hostRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [webglError, setWebglError] = useState('');
  const entries = useMemo(
    () => normalizeAssets(assets, positions, watchlistSymbols),
    [assets, positions, watchlistSymbols]
  );
  const selected = entries[selectedIndex] || entries[0] || null;

  useEffect(() => {
    if (selectedIndex >= entries.length) setSelectedIndex(0);
  }, [entries.length, selectedIndex]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !entries.length) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('3D mode is unavailable in this browser right now. The verified portfolio data below is still usable.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070a08, 18, 38);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(12, 10, 17);
    camera.lookAt(0, 2.6, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.y = -0.42;
    scene.add(root);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(11.8, 12.6, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x10170f, roughness: 0.94, metalness: 0.03 })
    );
    ground.position.y = -0.35;
    root.add(ground);

    const ring = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(12, 12.5, 0.58, 6)),
      new THREE.LineBasicMaterial({ color: 0xb8ff55, transparent: true, opacity: 0.34 })
    );
    ring.position.y = -0.34;
    root.add(ring);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x182018, roughness: 0.96 });
    const roadA = new THREE.Mesh(new THREE.BoxGeometry(20, 0.06, 2.2), roadMaterial);
    roadA.position.y = 0.02;
    root.add(roadA);
    const roadB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 20), roadMaterial);
    roadB.position.y = 0.02;
    root.add(roadB);

    const interactive = [];
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x9ad6ff, emissive: 0x1d5570, emissiveIntensity: 0.72, roughness: 0.28 });

    entries.forEach((entry, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = (column - 1.5) * 4.25;
      const z = (row - 1) * 5.2;
      const heldBoost = entry.held ? Math.min(Math.log10(entry.amount + 1) * 1.55, 2.8) : 0;
      const height = 2.2 + (index % 3) * 0.55 + heldBoost;
      const footprint = 2.35 + (index % 2) * 0.3;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.userData.assetIndex = index;
      root.add(group);

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.16, 3.2),
        new THREE.MeshStandardMaterial({
          color: entry.held ? 0x243b1f : 0x151c16,
          emissive: entry.held ? 0x17300f : 0x000000,
          emissiveIntensity: entry.held ? 0.55 : 0,
          roughness: 0.92,
        })
      );
      pad.position.y = 0.08;
      group.add(pad);

      const towerMaterial = new THREE.MeshStandardMaterial({
        color: entry.held ? 0x89bf52 : 0x334039,
        emissive: entry.held ? 0x203e13 : 0x09100b,
        emissiveIntensity: entry.held ? 0.46 : 0.16,
        roughness: 0.62,
        metalness: 0.08,
      });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(footprint, height, footprint), towerMaterial);
      tower.position.y = height / 2 + 0.17;
      tower.userData.assetIndex = index;
      group.add(tower);
      interactive.push(tower);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(footprint + 0.3, 0.24, footprint + 0.3),
        new THREE.MeshStandardMaterial({ color: entry.held ? 0xb8ff55 : 0x64726a, roughness: 0.42, metalness: 0.16 })
      );
      cap.position.y = height + 0.3;
      group.add(cap);

      const floors = Math.max(2, Math.floor(height / 0.65));
      for (let floor = 0; floor < floors; floor += 1) {
        const y = 0.75 + floor * 0.58;
        [-0.55, 0.55].forEach((offset) => {
          const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.05), windowMaterial);
          windowMesh.position.set(offset, y, footprint / 2 + 0.03);
          group.add(windowMesh);
        });
      }

      if (entry.held) {
        const beacon = new THREE.PointLight(0xb8ff55, 7, 7, 2);
        beacon.position.set(0, height + 1.2, 0);
        group.add(beacon);
      }
    });

    const grid = new THREE.GridHelper(30, 30, 0x354538, 0x1a241c);
    grid.position.y = -0.05;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    scene.add(grid);

    scene.add(new THREE.HemisphereLight(0xeef7ff, 0x152015, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(8, 13, 10);
    scene.add(key);
    const rim = new THREE.PointLight(0xb8ff55, 9, 28, 2);
    rim.position.set(-8, 8, -8);
    scene.add(rim);

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
    let targetRotation = root.rotation.y;

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
      if (hit && Number.isInteger(hit.object.userData.assetIndex)) setSelectedIndex(hit.object.userData.assetIndex);
    };
    const contextLost = (event) => {
      event.preventDefault();
      setWebglError('The 3D view paused because the browser released its WebGL context. Portfolio data remains available below.');
    };

    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setAnimationLoop(() => {
      if (!dragging && !reducedMotion) targetRotation += 0.0008;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetRotation, 0.065);
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
  }, [entries]);

  return (
    <div style={frame}>
      <div ref={hostRef} style={canvasHost} aria-label="Interactive 3D district representing Digital REIT watchlist assets and verified holdings" />
      <div style={legend}>
        <span style={legendPill}>BRIGHT = HELD</span>
        <span style={legendPill}>DRAG TO ROTATE</span>
        <span style={legendPill}>TAP A BUILDING</span>
      </div>
      {selected ? (
        <div style={detailCard}>
          <div>
            <div style={eyebrow}>{selected.confirmed ? 'PROVIDER-CONFIRMED ASSET' : 'WATCHLIST PREVIEW'}</div>
            <div style={symbol}>{selected.symbol}</div>
            <div style={name}>{selected.name}</div>
          </div>
          <div style={holdingBox}>
            <span style={eyebrow}>POSITION</span>
            <b style={{fontSize:18}}>{selected.held ? `${selected.amount.toFixed(6)} units` : 'Not held'}</b>
          </div>
        </div>
      ) : null}
      {webglError ? <div style={errorBox}>{webglError}</div> : null}
    </div>
  );
}

const frame={position:'relative',minHeight:430,border:'1px solid #2e3a2c',borderRadius:24,overflow:'hidden',background:'radial-gradient(circle at 50% 20%,#18231a 0%,#0a0f0b 45%,#070a08 100%)'};
const canvasHost={height:430,width:'100%',cursor:'grab'};
const legend={position:'absolute',top:14,left:14,right:14,display:'flex',gap:7,flexWrap:'wrap',pointerEvents:'none'};
const legendPill={border:'1px solid rgba(184,255,85,.2)',background:'rgba(7,10,8,.72)',backdropFilter:'blur(10px)',borderRadius:999,padding:'6px 9px',fontSize:9,fontWeight:900,letterSpacing:'.09em',color:'#cdd9c5'};
const detailCard={position:'absolute',left:14,right:14,bottom:14,display:'flex',justifyContent:'space-between',alignItems:'end',gap:14,flexWrap:'wrap',padding:'14px 16px',border:'1px solid rgba(184,255,85,.18)',borderRadius:18,background:'rgba(7,10,8,.82)',backdropFilter:'blur(16px)'};
const eyebrow={fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'#8d9a87'};
const symbol={fontSize:28,fontWeight:950,letterSpacing:'-.05em',marginTop:3};
const name={fontSize:11,color:'#aab4a4',marginTop:2,maxWidth:420,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};
const holdingBox={display:'grid',gap:4,textAlign:'right'};
const errorBox={position:'absolute',inset:'auto 14px 14px',padding:12,border:'1px solid #654844',background:'rgba(23,13,12,.92)',borderRadius:14,color:'#f0c5bd',fontSize:12};
