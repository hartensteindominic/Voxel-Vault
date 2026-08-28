'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(amount, currency) {
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 4,
    }).format(number(amount));
  } catch {
    return `${number(amount).toFixed(4)} ${code}`;
  }
}

function formatDate(value) {
  if (!value) return 'Date not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not reported';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function IncomeCenterCanvas({ records = [] }) {
  const hostRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [webglError, setWebglError] = useState('');
  const entries = useMemo(() => (Array.isArray(records) ? records : []).slice(0, 12), [records]);
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
      setWebglError('3D Income Center is unavailable in this browser. The provider payment records below remain available.');
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070a, 18, 40);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(12, 9, 17);
    camera.lookAt(0, 2.2, 0);

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

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(12.8, 13.4, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.9, metalness: 0.08 })
    );
    floor.position.y = -0.32;
    root.add(floor);

    const floorEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(12.9, 13.45, 0.52, 10)),
      new THREE.LineBasicMaterial({ color: 0x8ce7d0, transparent: true, opacity: 0.32 })
    );
    floorEdge.position.y = -0.31;
    root.add(floorEdge);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(4.4, 4.55, 64),
      new THREE.MeshBasicMaterial({ color: 0x8ce7d0, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.02;
    root.add(innerRing);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.7, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x17232a, roughness: 0.58, metalness: 0.22 })
    );
    pedestal.position.y = 0.35;
    root.add(pedestal);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshStandardMaterial({ color: 0xb9fff0, emissive: 0x2f7f70, emissiveIntensity: 0.75, roughness: 0.24, metalness: 0.12 })
    );
    core.position.y = 2.15;
    root.add(core);

    const coreLight = new THREE.PointLight(0x9dffe9, 14, 13, 2);
    coreLight.position.set(0, 2.8, 0);
    root.add(coreLight);

    const interactive = [];
    entries.forEach((entry, index) => {
      const angle = (index / Math.max(entries.length, 1)) * Math.PI * 2;
      const radius = entries.length <= 4 ? 6.1 : 7.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const amountBoost = Math.min(Math.log10(number(entry.amount) + 1) * 0.8, 1.6);
      const height = 0.62 + amountBoost;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      root.add(group);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.45, 0.2, 20),
        new THREE.MeshStandardMaterial({ color: 0x17241f, emissive: 0x102b23, emissiveIntensity: 0.34, roughness: 0.72 })
      );
      pad.position.y = 0.1;
      group.add(pad);

      const payment = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, height, 24),
        new THREE.MeshStandardMaterial({ color: 0x86e8d1, emissive: 0x1f6357, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2 })
      );
      payment.rotation.z = Math.PI / 2;
      payment.position.y = 1.05 + index % 2 * 0.32;
      payment.userData.paymentIndex = index;
      group.add(payment);
      interactive.push(payment);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.08, 0.06, 10, 40),
        new THREE.MeshBasicMaterial({ color: 0xb9fff0, transparent: true, opacity: 0.52 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 1.05 + index % 2 * 0.32;
      group.add(halo);
    });

    const chamber = new THREE.Group();
    chamber.position.set(0, 0, -10.2);
    root.add(chamber);

    const chamberBase = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.25, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x241b12, roughness: 0.82 })
    );
    chamberBase.position.y = 0.13;
    chamber.add(chamberBase);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(5.1, 4.6, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x2d251d, roughness: 0.76, metalness: 0.12 })
    );
    wall.position.set(0, 2.3, -0.8);
    chamber.add(wall);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.25, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x806342, emissive: 0x3c2915, emissiveIntensity: 0.38, roughness: 0.48, metalness: 0.25 })
    );
    door.position.set(0, 1.7, -0.52);
    chamber.add(door);

    const lock = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.09, 10, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffc977, emissive: 0x6c4512, emissiveIntensity: 0.5 })
    );
    lock.rotation.z = Math.PI;
    lock.position.set(0, 2.05, -0.38);
    chamber.add(lock);
    const lockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.58, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffc977, emissive: 0x6c4512, emissiveIntensity: 0.45 })
    );
    lockBody.position.set(0, 1.68, -0.38);
    chamber.add(lockBody);

    scene.add(new THREE.HemisphereLight(0xdffaff, 0x111717, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(8, 13, 10);
    scene.add(key);
    const amber = new THREE.PointLight(0xffb65f, 6, 9, 2);
    amber.position.set(0, 4, -10);
    scene.add(amber);

    const grid = new THREE.GridHelper(32, 32, 0x29423d, 0x111b1a);
    grid.position.y = -0.04;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

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
      if (hit && Number.isInteger(hit.object.userData.paymentIndex)) setSelectedIndex(hit.object.userData.paymentIndex);
    };
    const contextLost = (event) => {
      event.preventDefault();
      setWebglError('The browser released the WebGL context. Provider payment records remain available below.');
    };

    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setAnimationLoop(() => {
      if (!dragging && !reducedMotion) targetRotation += 0.0007;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetRotation, 0.06);
      core.rotation.x += reducedMotion ? 0 : 0.003;
      core.rotation.y += reducedMotion ? 0 : 0.005;
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
      <div ref={hostRef} style={canvasHost} aria-label="Spatial Income Center showing user-bound provider dividend payment records and a locked future direct-property distribution chamber" />
      <div style={legend}>
        <span style={legendPill}>TEAL = PROVIDER PAYMENT RECORD</span>
        <span style={legendPill}>AMBER DOOR = DIRECT PROPERTY LOCKED</span>
        <span style={legendPill}>DRAG TO ROTATE</span>
      </div>
      {selected ? (
        <div style={detailCard}>
          <div>
            <div style={eyebrow}>USER-BOUND PROVIDER PAYMENT</div>
            <div style={symbol}>{selected.symbol || 'DIVIDEND'}</div>
            <div style={name}>{formatDate(selected.payableDate)} · {selected.status || 'Provider status not supplied'}</div>
          </div>
          <div style={holdingBox}>
            <span style={eyebrow}>REPORTED AMOUNT</span>
            <b style={{ fontSize: 20 }}>{formatAmount(selected.amount, selected.currency)}</b>
          </div>
        </div>
      ) : (
        <div style={detailCard}>
          <div>
            <div style={eyebrow}>INCOME CENTER READY</div>
            <div style={{ fontSize: 19, fontWeight: 900, marginTop: 4 }}>No positive provider dividend-payment records yet.</div>
            <div style={name}>The room stays empty instead of inventing income.</div>
          </div>
        </div>
      )}
      {webglError ? <div style={errorBox}>{webglError}</div> : null}
    </div>
  );
}

const frame = { position: 'relative', minHeight: 470, border: '1px solid #283638', borderRadius: 28, overflow: 'hidden', background: 'radial-gradient(circle at 50% 16%,#142428 0%,#080d10 48%,#05070a 100%)' };
const canvasHost = { height: 470, width: '100%', cursor: 'grab' };
const legend = { position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 7, flexWrap: 'wrap', pointerEvents: 'none' };
const legendPill = { border: '1px solid rgba(185,255,240,.18)', background: 'rgba(5,8,10,.72)', backdropFilter: 'blur(10px)', borderRadius: 999, padding: '6px 9px', fontSize: 9, fontWeight: 900, letterSpacing: '.08em', color: '#cce3de' };
const detailCard = { position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 14, flexWrap: 'wrap', padding: '14px 16px', border: '1px solid rgba(185,255,240,.18)', borderRadius: 18, background: 'rgba(5,8,10,.84)', backdropFilter: 'blur(16px)' };
const eyebrow = { fontSize: 9, fontWeight: 900, letterSpacing: '.13em', color: '#8ba49e' };
const symbol = { fontSize: 28, fontWeight: 950, letterSpacing: '-.05em', marginTop: 3 };
const name = { fontSize: 11, color: '#9aaba7', marginTop: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const holdingBox = { display: 'grid', gap: 4, textAlign: 'right' };
const errorBox = { position: 'absolute', inset: 'auto 14px 14px', padding: 12, border: '1px solid #654844', background: 'rgba(23,13,12,.92)', borderRadius: 14, color: '#f0c5bd', fontSize: 12 };
