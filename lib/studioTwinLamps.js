import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { phys, lathe, helixPts, helixRibbon, add, pulse } from './studioTwinHelpers';

export function buildSpiral(g, m, colors, segs, steps) {
  add(g, lathe([[0.02, -0.74], [0.48, -0.74], [0.5, -0.7], [0.46, -0.66], [0.18, -0.64]], segs), m.gold);
  add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.02, segs), m.dark, [0, -0.655, 0]);
  add(g, new THREE.CylinderGeometry(0.09, 0.11, 0.1, 24), m.gold, [0, -0.6, 0]);
  add(g, helixRibbon(5.15, 1.36, 0.2, 0.33, 0.07, 0.014, steps, -0.54), m.gold);
  const led = add(g, helixRibbon(5.15, 1.36, 0.195, 0.325, 0.048, 0.01, steps, -0.54), m.glow);
  pulse(led, 1.7);
  const core = add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts(5.15, 1.36, 0.2, 0.33, steps, -0.54)), steps, 0.008, 6, false), m.gold);
  core.castShadow = false;
  const light = new THREE.PointLight(colors.glow, 1.85, 3.4, 1.5);
  light.position.set(0, 0.12, 0);
  g.add(light);
  const spark = new THREE.PointLight(colors.glow, 0.85, 1.4, 2);
  spark.userData.orbit = true;
  spark.userData.orbitR = 0.26;
  spark.userData.orbitY = 0.1;
  g.add(spark);
}

export function buildDeskLamp(g, m, colors, segs) {
  add(g, lathe([[0.02, -0.72], [0.48, -0.72], [0.5, -0.68], [0.48, -0.64]], segs), m.matte);
  add(g, new THREE.RingGeometry(0.16, 0.24, segs), m.metal, [0, -0.635, 0], [-Math.PI / 2, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.008, segs), m.glass, [0, -0.632, 0]);
  add(g, new THREE.TorusGeometry(0.2, 0.007, 8, segs), m.dark, [0, -0.628, 0], [-Math.PI / 2, 0, 0]);
  add(g, new THREE.BoxGeometry(0.08, 0.018, 0.03), m.steel, [0.49, -0.675, 0]);
  add(g, new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16), m.matte, [0, -0.58, -0.28]);
  add(g, new THREE.SphereGeometry(0.046, 16, 12), m.metal, [0, -0.53, -0.28]);
  add(g, new THREE.CylinderGeometry(0.032, 0.038, 0.74, 14), m.matte, [0, -0.16, -0.2], [0.28, 0, 0]);
  add(g, new THREE.SphereGeometry(0.044, 14, 12), m.metal, [0, 0.18, -0.1]);
  add(g, new THREE.CylinderGeometry(0.028, 0.032, 0.24, 12), m.matte, [0, 0.28, 0.05], [1.12, 0, 0]);
  add(g, new RoundedBoxGeometry(0.48, 0.05, 0.26, 2, 0.02), m.matte, [0, 0.38, 0.18], [0.38, 0, 0]);
  const panel = add(g, new THREE.PlaneGeometry(0.42, 0.2), m.glow, [0, 0.352, 0.18], [-Math.PI / 2 + 0.38, 0, 0]);
  pulse(panel, 1.85);
  const spot = new THREE.SpotLight(colors.glow, 2.6, 4.2, 0.7, 0.4);
  spot.position.set(0, 0.36, 0.18);
  spot.target.position.set(0, -0.64, 0);
  g.add(spot, spot.target);
}

export function buildClock(g, m, segs) {
  const shell = phys('#f3efe8', { roughness: 0.3, metalness: 0.04, transmission: 0.06, thickness: 0.45, clearcoat: 0.62, clearcoatRoughness: 0.22, emissive: '#f3e6c8', emissiveIntensity: 0.28 });
  add(g, lathe([[0.06, -0.58], [0.18, -0.56], [0.22, -0.4], [0.32, -0.16], [0.4, 0.02], [0.41, 0.18], [0.34, 0.4], [0.18, 0.52], [0.02, 0.55]], segs), shell);
  add(g, new THREE.CylinderGeometry(0.15, 0.17, 0.04, segs), m.dark, [0, -0.58, 0]);
  const faceMat = phys('#faf7f2', { roughness: 0.46, metalness: 0, emissive: '#fff4d4', emissiveIntensity: 0.32, clearcoat: 0.2 });
  add(g, new THREE.CircleGeometry(0.25, segs), faceMat, [0, 0.12, 0.33], [0.16, 0, 0]);
  add(g, new THREE.RingGeometry(0.25, 0.278, segs), m.gold, [0, 0.12, 0.335], [0.16, 0, 0]);
  const tick = phys('#1c1b18', { roughness: 0.42, metalness: 0.15, clearcoat: 0 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    add(g, new THREE.BoxGeometry(long ? 0.018 : 0.012, long ? 0.052 : 0.032, 0.01), tick, [Math.sin(a) * 0.205, 0.12 + Math.cos(a) * 0.198, 0.345], [0.16, 0, -a]);
  }
  add(g, new THREE.BoxGeometry(0.02, 0.12, 0.012), tick, [0.038, 0.175, 0.35], [0.16, 0, -0.55]);
  add(g, new THREE.BoxGeometry(0.016, 0.086, 0.012), tick, [-0.034, 0.148, 0.35], [0.16, 0, 0.85]);
  add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16), m.gold, [0, 0.12, 0.352], [Math.PI / 2, 0, 0]);
  const inner = new THREE.PointLight('#ffe9b8', 1.05, 2.4, 2);
  inner.position.set(0, 0.1, 0.05);
  g.add(inner);
}

export function buildBlender(g, m, segs) {
  add(g, lathe([[0.02, -0.72], [0.28, -0.72], [0.3, -0.5], [0.26, -0.42]], segs), m.matte);
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), m.steel, [0.29, -0.58, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12), m.dark, [0.18, -0.56, 0.2]);
  const cup = phys('#f1eee8', { roughness: 0.3, metalness: 0.04, clearcoat: 0.7, transmission: 0.03, thickness: 0.22 });
  add(g, lathe([[0.22, -0.42], [0.24, -0.1], [0.23, 0.28], [0.2, 0.42]], segs), cup);
  add(g, new THREE.TorusGeometry(0.22, 0.012, 8, segs), m.matte, [0, -0.42, 0], [-Math.PI / 2, 0, 0]);
  const blades = new THREE.Group();
  blades.position.set(0, -0.36, 0);
  blades.userData.spin = 1.8;
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.01, 0.04, 1, 0.004), m.steel);
    b.rotation.y = (i * Math.PI) / 2;
    b.rotation.z = i % 2 === 0 ? 0.15 : -0.15;
    b.position.y = i % 2 === 0 ? 0.01 : -0.01;
    b.castShadow = true;
    blades.add(b);
  }
  blades.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), m.matte));
  g.add(blades);
  add(g, new THREE.CylinderGeometry(0.205, 0.205, 0.09, segs), m.matte, [0, 0.48, 0]);
  add(g, new THREE.TorusGeometry(0.07, 0.012, 8, 16), m.matte, [0, 0.58, 0], [0, 0, Math.PI / 2]);
}
