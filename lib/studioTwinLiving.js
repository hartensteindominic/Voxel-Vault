import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { phys, lathe, add, pulse, liquid } from './studioTwinHelpers';

export function buildDispenser(g, m, segs) {
  const bowl = phys('#c5dde4', { roughness: 0.28, metalness: 0.06, clearcoat: 0.55 });
  add(g, lathe([[0.08, -0.58], [0.42, -0.56], [0.5, -0.48], [0.52, -0.4], [0.48, -0.36], [0.22, -0.34]], segs), bowl);
  add(g, new THREE.TorusGeometry(0.5, 0.022, 8, segs), phys('#eef4f6', { roughness: 0.4, metalness: 0.05 }), [0, -0.38, 0], [-Math.PI / 2, 0, 0]);
  liquid(add(g, lathe([[0, -0.39], [0.28, -0.375], [0.4, -0.39]], segs), m.water), 0.2);
  add(g, lathe([[0.18, -0.3], [0.22, -0.05], [0.24, 0.28], [0.22, 0.55], [0.16, 0.64]], segs), m.glass);
  liquid(add(g, lathe([[0.16, -0.26], [0.2, 0.05], [0.2, 0.32]], 24), m.water), 1.1);
  add(g, new THREE.CylinderGeometry(0.17, 0.19, 0.08, segs), phys('#f4f7f8', { roughness: 0.35, metalness: 0.08 }), [0, 0.68, 0]);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), m.dark, [0, 0.73, 0]);
}

export function buildBowl(g, m, segs) {
  add(g, lathe([[0.1, -0.5], [0.46, -0.48], [0.54, -0.34], [0.52, -0.22], [0.44, -0.16], [0.16, -0.14]], segs), m.body);
  liquid(add(g, lathe([[0.16, -0.2], [0.32, -0.185], [0.42, -0.2]], segs), m.water), 0.4);
  add(g, lathe([[0.1, -0.14], [0.14, 0.02], [0.12, 0.22], [0.08, 0.28]], 28), m.body);
  liquid(add(g, new THREE.SphereGeometry(0.09, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), m.water, [0, 0.28, 0]), 1.6);
  const drop = add(g, new THREE.SphereGeometry(0.025, 10, 8), m.water, [0, 0.4, 0]);
  drop.userData.bob = true;
  drop.userData.baseY = 0.4;
}

export function buildFountain(g, m, segs) {
  add(g, lathe([[0.08, -0.58], [0.5, -0.58], [0.54, -0.5], [0.5, -0.44], [0.2, -0.4]], segs), m.steel);
  add(g, new THREE.TorusGeometry(0.52, 0.03, 10, segs), m.steel, [0, -0.45, 0], [-Math.PI / 2, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.34, 0.36, 0.08, segs), m.matte, [0, -0.4, 0]);
  liquid(add(g, lathe([[0, -0.35], [0.22, -0.34], [0.32, -0.36]], segs), m.water), 0.7);
  add(g, new THREE.CylinderGeometry(0.075, 0.1, 0.14, 16), m.steel, [0, -0.28, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.045, 10, 8), m.steel, [Math.cos(a) * 0.07, -0.14, Math.sin(a) * 0.07]);
  }
  liquid(add(g, new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24), m.water, [0, -0.1, 0]), 0.9);
  const bubble = add(g, new THREE.SphereGeometry(0.035, 12, 10), m.water, [0, -0.02, 0]);
  bubble.userData.bob = true;
  bubble.userData.baseY = -0.02;
  for (let i = 0; i < 3; i++) {
    const d = add(g, new THREE.SphereGeometry(0.014, 8, 6), m.water, [Math.cos((i / 3) * Math.PI * 2) * 0.07, 0.04 + i * 0.025, Math.sin((i / 3) * Math.PI * 2) * 0.07]);
    d.userData.bob = true;
    d.userData.baseY = d.position.y;
    d.userData.phase = i;
  }
}

export function buildBottle(g, m, segs) {
  add(g, lathe([[0.02, -0.52], [0.18, -0.5], [0.2, -0.16], [0.18, 0.3], [0.12, 0.48], [0.09, 0.6]], segs), m.body);
  add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.1, 20), m.steel, [0, 0.66, 0]);
  add(g, new THREE.TorusGeometry(0.055, 0.012, 8, 16), m.steel, [0, 0.74, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.TorusGeometry(0.05, 0.01, 8, 14), m.steel, [0.07, 0.74, 0], [Math.PI / 2, 0.35, 0]);
  add(g, lathe([[0.04, -0.58], [0.2, -0.56], [0.22, -0.42], [0.2, -0.36], [0.17, -0.34]], 28), m.silicone, [0, 0.04, 0.34]);
}

export function buildVanity(g, m, colors) {
  add(g, new RoundedBoxGeometry(1.16, 0.06, 0.5, 2, 0.016), m.body, [0, -0.3, 0.08]);
  add(g, new RoundedBoxGeometry(0.34, 0.4, 0.48, 2, 0.012), m.body, [-0.38, -0.53, 0.08]);
  add(g, new RoundedBoxGeometry(0.34, 0.4, 0.48, 2, 0.012), m.body, [0.38, -0.53, 0.08]);
  const inset = phys('#efeae2', { roughness: 0.5, metalness: 0.04, clearcoat: 0.2 });
  add(g, new THREE.BoxGeometry(0.28, 0.14, 0.012), inset, [-0.38, -0.42, 0.325]);
  add(g, new THREE.BoxGeometry(0.28, 0.14, 0.012), inset, [-0.38, -0.6, 0.325]);
  add(g, new THREE.BoxGeometry(0.1, 0.01, 0.01), m.gold, [-0.38, -0.42, 0.335]);
  add(g, new THREE.BoxGeometry(0.1, 0.01, 0.01), m.gold, [-0.38, -0.6, 0.335]);
  add(g, new THREE.BoxGeometry(0.26, 0.26, 0.02), m.dark, [0.38, -0.5, 0.3]);
  for (const [x, z] of [[-0.5, -0.12], [0.5, -0.12], [-0.5, 0.26], [0.5, 0.26]]) {
    add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), m.gold, [x, -0.7, z]);
  }
  const mirror = phys('#b7c2cc', { metalness: 0.94, roughness: 0.07, envMapIntensity: 1.7, clearcoat: 0.4 });
  add(g, new RoundedBoxGeometry(0.74, 0.9, 0.032, 2, 0.01), m.body, [0, 0.2, -0.14], [-0.08, 0, 0]);
  add(g, new THREE.PlaneGeometry(0.64, 0.8), mirror, [0, 0.2, -0.122], [-0.08, 0, 0]);
  const led = phys(colors.glow, { emissive: colors.glow, emissiveIntensity: 1.2, toneMapped: false, roughness: 0.3, metalness: 0 });
  const tilt = [-0.08, 0, 0];
  pulse(add(g, new THREE.BoxGeometry(0.68, 0.016, 0.01), led, [0, 0.62, -0.118], tilt), 1.25);
  pulse(add(g, new THREE.BoxGeometry(0.68, 0.016, 0.01), led, [0, -0.22, -0.118], tilt), 1.25);
  pulse(add(g, new THREE.BoxGeometry(0.016, 0.84, 0.01), led, [-0.33, 0.2, -0.118], tilt), 1.25);
  pulse(add(g, new THREE.BoxGeometry(0.016, 0.84, 0.01), led, [0.33, 0.2, -0.118], tilt), 1.25);
  add(g, new THREE.CylinderGeometry(0.155, 0.165, 0.055, 24), m.fabric, [0.06, -0.62, 0.44]);
  add(g, new THREE.SphereGeometry(0.155, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.fabric, [0.06, -0.59, 0.44]);
  for (const [x, z] of [[-0.06, 0.36], [0.18, 0.36], [-0.06, 0.52], [0.18, 0.52]]) {
    add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.18, 8), m.gold, [x, -0.72, z]);
  }
  const lamp = new THREE.PointLight(colors.glow, 1.35, 3.4, 1.7);
  lamp.position.set(0, 0.34, 0.12);
  g.add(lamp);
}
