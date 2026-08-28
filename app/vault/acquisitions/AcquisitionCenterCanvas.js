'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function usd(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function statusPalette(status) {
  if (status === 'reject') return { body: 0x714039, roof: 0xd16a5f, emissive: 0x351713, light: 0xff7768 };
  if (status === 'review-ready') return { body: 0x315b50, roof: 0x93efd8, emissive: 0x17382f, light: 0x9ff5df };
  return { body: 0x66512d, roof: 0xe3bb70, emissive: 0x35280e, light: 0xffd388 };
}

export default function AcquisitionCenterCanvas({ candidates = [] }) {
  const hostRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [webglError, setWebglError] = useState('');
  const entries = useMemo(() => (Array.isArray(candidates) ? candidates : []).slice(0, 9), [candidates]);
  const selected = entries[selectedIndex] || entries[0] || null;

  useEffect(() => {
    if (selectedIndex >= entries.length) setSelectedIndex(0);
  }, [entries.length, selectedIndex]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('3D Acquisition Center is unavailable in this browser. The research/diligence cards below remain available.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070806, 19, 45);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 90);
    camera.position.set(13, 10, 18);
    camera.lookAt(0, 2.3, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.y = -0.34;
    scene.add(root);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(13.5, 14.2, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x121510, roughness: 0.93, metalness: 0.03 })
    );
    ground.position.y = -0.35;
    root.add(ground);

    const perimeter = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(13.6, 14.25, 0.58, 8)),
      new THREE.LineBasicMaterial({ color: 0xb8d88d, transparent: true, opacity: 0.3 })
    );
    perimeter.position.y = -0.34;
    root.add(perimeter);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x252a22, roughness: 0.98 });
    const roadA = new THREE.Mesh(new THREE.BoxGeometry(22, 0.06, 2.1), roadMaterial);
    roadA.position.y = 0.01;
    root.add(roadA);
    const roadB = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 22), roadMaterial);
    roadB.position.y = 0.01;
    root.add(roadB);

    const interactive = [];
    entries.forEach((entry, index) => {
      const count = Math.max(entries.length, 1);
      const angle = (index / count) * Math.PI * 2;
      const radius = count <= 4 ? 6 : 7.7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const palette = statusPalette(entry.status);
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      root.add(group);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.9, 0.22, 20),
        new THREE.MeshStandardMaterial({ color: 0x1d211a, emissive: palette.emissive, emissiveIntensity: 0.16, roughness: 0.85 })
      );
      pad.position.y = 0.11;
      group.add(pad);

      const scoreLift = Math.max(0, Math.min(Number(entry.score || 0) / 100, 1));
      const houseHeight = 1.8 + scoreLift * 1.25;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, houseHeight, 2.15),
        new THREE.MeshStandardMaterial({ color: palette.body, emissive: palette.emissive, emissiveIntensity: 0.35, roughness: 0.62, metalness: 0.07 })
      );
      body.position.y = 0.22 + houseHeight / 2;
      body.userData.candidateIndex = index;
      group.add(body);
      interactive.push(body);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.75, 1.05, 4),
        new THREE.MeshStandardMaterial({ color: palette.roof, emissive: palette.emissive, emissiveIntensity: 0.24, roughness: 0.48 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = houseHeight + 0.72;
      roof.userData.candidateIndex = index;
      group.add(roof);
      interactive.push(roof);

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.9, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x151814, roughness: 0.7 })
      );
      door.position.set(0, 0.68, 1.11);
      group.add(door);

      const beacon = new THREE.PointLight(palette.light, entry.status === 'reject' ? 4 : 7, 6, 2);
      beacon.position.set(0, houseHeight + 2, 0);
      group.add(beacon);

      if (entry.status === 'reject') {
        [-0.9, 0, 0.9].forEach((offset) => {
          const barrier = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 1.1, 3.2),
            new THREE.MeshStandardMaterial({ color: 0xbd5c52, emissive: 0x3b1512, emissiveIntensity: 0.42, roughness: 0.62 })
          );
          barrier.rotation.z = Math.PI / 2;
          barrier.position.set(offset, 0.72, 1.75);
          group.add(barrier);
        });
      }

      if (entry.status === 'diligence') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.45, 0.08, 10, 36),
          new THREE.MeshBasicMaterial({ color: 0xffd388, transparent: true, opacity: 0.58 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.3;
        group.add(ring);
      }
    });

    const executionGate = new THREE.Group();
    executionGate.position.set(0, 0, -11.4);
    root.add(executionGate);

    const gateWall = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 4.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2b2b29, roughness: 0.72, metalness: 0.18 })
    );
    gateWall.position.y = 2.4;
    executionGate.add(gateWall);

    const gateDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 3.35, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x554f45, emissive: 0x221f19, emissiveIntensity: 0.32, roughness: 0.52, metalness: 0.22 })
    );
    gateDoor.position.set(0, 1.75, 0.35);
    executionGate.add(gateDoor);

    const lockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.68, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xd6c08a, emissive: 0x514013, emissiveIntensity: 0.4 })
    );
    lockBody.position.set(0, 1.78, 0.48);
    executionGate.add(lockBody);
    const shackle = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.1, 10, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xd6c08a, emissive: 0x514013, emissiveIntensity: 0.4 })
    );
    shackle.rotation.z = Math.PI;
    shackle.position.set(0, 2.18, 0.48);
    executionGate.add(shackle);

    const grid = new THREE.GridHelper(34, 34, 0x3d4733, 0x1b2018);
    grid.position.y = -0.04;
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    scene.add(grid);

    scene.add(new THREE.HemisphereLight(0xf1f4e9, 0x161815, 2.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(9, 14, 11);
    scene.add(key);
    const gateLight = new THREE.PointLight(0xd6c08a, 5, 9, 2);
    gateLight.position.set(0, 4, -11);
    scene.add(gateLight);

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
      if (Math.abs(event.clientX - startX) > 5 || Math.abs(event.clientY - startY) > 5) moved = true;
      const delta = event.clientX - lastX;
      lastX = event.clientX;
      targetRotation += delta * 0.008;
    };
    const pointerUp = (event) => {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      if (moved || !interactive.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0];
      if (hit && Number.isInteger(hit.object.userData.candidateIndex)) setSelectedIndex(hit.object.userData.candidateIndex);
    };
    const contextLost = (event) => {
      event.preventDefault();
      setWebglError('The browser released its WebGL context. Acquisition research cards remain available below.');
    };

    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setAnimationLoop(() => {
      if (!dragging && !reducedMotion) targetRotation += 0.00065;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetRotation, 0.06);
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
      <div ref={hostRef} style={canvasHost} aria-label="Spatial Acquisition Center visualizing demo property research candidates, diligence status and a locked execution gate" />
      <div style={legend}>
        <span style={legendPill}>TEAL = HUMAN REVIEW ELIGIBLE</span>
        <span style={legendPill}>AMBER = DILIGENCE OPEN</span>
        <span style={legendPill}>RED = HARD STOP</span>
        <span style={legendPill}>EXECUTION GATE = LOCKED</span>
      </div>
      {selected ? (
        <div style={detailCard}>
          <div>
            <div style={eyebrow}>{selected.truthLabel}</div>
            <div style={title}>#{selected.rank} · {selected.title}</div>
            <div style={name}>{selected.location} · score {selected.score}/100 · {selected.failedHardGates.length} hard stop(s)</div>
          </div>
          <div style={economics}>
            <span style={eyebrow}>DEMO ALL-IN BASIS</span>
            <b>{usd(selected.economics.totalBasis)}</b>
            <span style={{ ...name, textAlign: 'right' }}>Modeled net {usd(selected.economics.monthlyNet)}/mo</span>
          </div>
        </div>
      ) : null}
      {webglError ? <div style={errorBox}>{webglError}</div> : null}
    </div>
  );
}

const frame = { position: 'relative', minHeight: 480, border: '1px solid #333b2d', borderRadius: 28, overflow: 'hidden', background: 'radial-gradient(circle at 50% 16%,#20271a 0%,#0b0d09 47%,#070806 100%)' };
const canvasHost = { height: 480, width: '100%', cursor: 'grab' };
const legend = { position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 7, flexWrap: 'wrap', pointerEvents: 'none' };
const legendPill = { border: '1px solid rgba(216,232,185,.16)', background: 'rgba(7,8,6,.74)', backdropFilter: 'blur(10px)', borderRadius: 999, padding: '6px 9px', fontSize: 9, fontWeight: 900, letterSpacing: '.08em', color: '#d6dec7' };
const detailCard = { position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 14, flexWrap: 'wrap', padding: '14px 16px', border: '1px solid rgba(216,232,185,.17)', borderRadius: 18, background: 'rgba(7,8,6,.86)', backdropFilter: 'blur(16px)' };
const eyebrow = { fontSize: 9, fontWeight: 900, letterSpacing: '.13em', color: '#9ca78d' };
const title = { fontSize: 23, fontWeight: 950, letterSpacing: '-.045em', marginTop: 3 };
const name = { fontSize: 11, color: '#a7ad9e', marginTop: 3, maxWidth: 600 };
const economics = { display: 'grid', gap: 3, textAlign: 'right', fontSize: 18 };
const errorBox = { position: 'absolute', inset: 'auto 14px 14px', padding: 12, border: '1px solid #654844', background: 'rgba(23,13,12,.92)', borderRadius: 14, color: '#f0c5bd', fontSize: 12 };
