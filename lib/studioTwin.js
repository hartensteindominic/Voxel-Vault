import * as THREE from 'three';

export function kindForItem(item) {
  const hay = `${item?.id || ''} ${item?.type || ''} ${item?.name || ''}`.toLowerCase();
  if (hay.includes('spiral')) return 'spiral';
  if (hay.includes('desk') && hay.includes('lamp')) return 'desk-lamp';
  if (hay.includes('clock')) return 'clock';
  if (hay.includes('vanity')) return 'vanity';
  if (hay.includes('blender')) return 'blender';
  if (hay.includes('dispenser') && hay.includes('pet')) return 'dispenser';
  if (hay.includes('fountain')) return 'fountain';
  if (hay.includes('bowl')) return 'bowl';
  if (hay.includes('bottle') || hay.includes('cup') || hay.includes('travel')) return 'bottle';
  return 'spiral';
}

export const TWIN_COLORS = {
  spiral: { body: '#e8dcc8', metal: '#b9a07a', glow: '#f6e7c4' },
  'desk-lamp': { body: '#2a2a2c', metal: '#6b6560', glow: '#f3ead4' },
  clock: { body: '#f0ebe3', metal: '#c9b496', glow: '#fff4d6' },
  vanity: { body: '#f7f4ef', metal: '#2a2724', glow: '#fff7e8' },
  blender: { body: '#dce8e4', metal: '#1c1c1e', glow: '#ffffff' },
  dispenser: { body: '#e8eef2', metal: '#cfd6dc', glow: '#d7e8f4' },
  bowl: { body: '#ece7df', metal: '#8d8578', glow: '#f6efe4' },
  fountain: { body: '#cfd6d8', metal: '#8a9396', glow: '#e8eef0' },
  bottle: { body: '#2c3a48', metal: '#c5cdd3', glow: '#dbe4ea' },
};

function phys(color, extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.22,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.1,
    ...extras,
  });
}

function helixCurve(turns = 5.1, height = 1.38, r0 = 0.2, r1 = 0.34) {
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const a = t * Math.PI * 2 * turns;
    const r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, t * height - height * 0.46, Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function lathe(xy, segs = 48) {
  return new THREE.LatheGeometry(
    xy.map(([x, y]) => new THREE.Vector2(x, y)),
    segs,
  );
}

export function createStudioTwin(kind, colors) {
  const g = new THREE.Group();
  const body = phys(colors.body, { roughness: 0.38, metalness: 0.12 });
  const metal = phys(colors.metal, { metalness: 0.92, roughness: 0.16, clearcoat: 0.7 });
  const dark = phys('#161618', { metalness: 0.62, roughness: 0.28 });
  const glow = phys(colors.glow, {
    emissive: colors.glow,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.04,
    transmission: 0.15,
    thickness: 0.2,
  });
  const glass = phys('#d7e6ea', {
    roughness: 0.06,
    metalness: 0.04,
    transmission: 0.86,
    thickness: 0.45,
    transparent: true,
    opacity: 0.92,
    ior: 1.45,
  });
  const water = phys('#9ec4d4', {
    roughness: 0.08,
    metalness: 0.02,
    transmission: 0.55,
    transparent: true,
    opacity: 0.55,
    color: '#7fb3c8',
  });

  const add = (geo, mat, pos = [0, 0, 0], rot) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  if (kind === 'spiral') {
    add(new THREE.CylinderGeometry(0.42, 0.5, 0.08, 48), metal, [0, -0.72, 0]);
    add(new THREE.CylinderGeometry(0.34, 0.4, 0.05, 48), dark, [0, -0.66, 0]);
    add(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 24), dark, [0, -0.58, 0]);
    add(new THREE.TubeGeometry(helixCurve(), 220, 0.048, 16, false), glow);
    add(new THREE.TubeGeometry(helixCurve(5.1, 1.38, 0.17, 0.3), 180, 0.018, 10, false), metal);
    const light = new THREE.PointLight(colors.glow, 1.6, 3.2, 1.6);
    light.position.set(0, 0.15, 0);
    g.add(light);
  } else if (kind === 'desk-lamp') {
    add(new THREE.CylinderGeometry(0.48, 0.54, 0.07, 48), dark, [0, -0.7, 0]);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 40), glass, [0, -0.655, 0]);
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 20), metal, [0, -0.6, 0]);
    add(new THREE.CylinderGeometry(0.028, 0.034, 0.72, 16), body, [-0.08, -0.18, 0], [0, 0, 0.22]);
    add(new THREE.SphereGeometry(0.05, 16, 16), metal, [0.08, 0.18, 0]);
    add(new THREE.CylinderGeometry(0.024, 0.028, 0.42, 16), body, [0.26, 0.34, 0], [0, 0, 1.05]);
    add(new THREE.BoxGeometry(0.34, 0.08, 0.22), dark, [0.42, 0.48, 0], [0, 0, 0.2]);
    add(new THREE.PlaneGeometry(0.28, 0.16), glow, [0.42, 0.435, 0], [-Math.PI / 2, 0, 0.2]);
    const light = new THREE.SpotLight(colors.glow, 2.2, 4, 0.55, 0.4);
    light.position.set(0.42, 0.46, 0);
    light.target.position.set(0.2, -0.6, 0);
    g.add(light, light.target);
  } else if (kind === 'clock') {
    add(lathe([[0.08, -0.55], [0.38, -0.5], [0.4, -0.12], [0.34, 0.38], [0.18, 0.48]], 56), body);
    add(new THREE.CircleGeometry(0.2, 48), glow, [0, 0.08, 0.33], [0.12, 0, 0]);
    add(new THREE.RingGeometry(0.2, 0.225, 48), metal, [0, 0.08, 0.335], [0.12, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add(new THREE.BoxGeometry(0.012, 0.04, 0.01), dark, [Math.sin(a) * 0.16, 0.08 + Math.cos(a) * 0.16 * 0.96, 0.34], [0.12, 0, -a]);
    }
  } else if (kind === 'blender') {
    add(new THREE.CylinderGeometry(0.26, 0.3, 0.28, 40), dark, [0, -0.58, 0]);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), metal, [0.22, -0.58, 0], [0, 0, Math.PI / 2]);
    add(lathe([[0.2, -0.42], [0.24, -0.1], [0.22, 0.38], [0.18, 0.48]], 48), glass);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 32), body, [0, 0.52, 0]);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), dark, [0, 0.58, 0]);
    add(new THREE.CircleGeometry(0.09, 24), metal, [0, -0.42, 0], [-Math.PI / 2, 0, 0]);
  } else if (kind === 'dispenser') {
    add(lathe([[0.22, -0.2], [0.28, 0.1], [0.27, 0.62], [0.2, 0.7]], 48), glass);
    add(new THREE.CylinderGeometry(0.3, 0.28, 0.08, 40), body, [0, 0.72, 0]);
    add(new THREE.TorusGeometry(0.3, 0.05, 16, 40), body, [0.38, -0.58, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.26, 0.22, 0.08, 32), water, [0.38, -0.55, 0]);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), metal, [0.18, -0.38, 0], [0, 0, 0.9]);
  } else if (kind === 'bowl') {
    add(lathe([[0.16, -0.42], [0.48, -0.38], [0.52, -0.18], [0.46, -0.08]], 56), body);
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 40), water, [0, -0.16, 0]);
    add(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 28), metal, [0, 0.08, 0]);
    add(new THREE.SphereGeometry(0.08, 20, 16), water, [0, 0.3, 0]);
  } else if (kind === 'fountain') {
    add(new THREE.CylinderGeometry(0.52, 0.56, 0.1, 48), metal, [0, -0.58, 0]);
    add(lathe([[0.18, -0.5], [0.42, -0.42], [0.4, -0.22]], 48), metal);
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 40), water, [0, -0.24, 0]);
    add(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 20), dark, [0, -0.08, 0]);
    add(new THREE.SphereGeometry(0.06, 16, 12), water, [0, 0.08, 0]);
  } else if (kind === 'bottle') {
    add(lathe([[0.16, -0.55], [0.2, -0.2], [0.18, 0.35], [0.1, 0.5], [0.08, 0.62]], 40), body);
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 20), metal, [0, 0.68, 0]);
    add(new THREE.TorusGeometry(0.16, 0.035, 12, 28), metal, [0.28, -0.42, 0], [Math.PI / 2, 0, 0.4]);
    add(new THREE.CylinderGeometry(0.14, 0.12, 0.06, 24), dark, [0.28, -0.44, 0]);
  } else {
    add(new THREE.BoxGeometry(1.22, 0.08, 0.52), body, [0, -0.5, 0.04]);
    add(new THREE.BoxGeometry(0.22, 0.28, 0.48), body, [-0.48, -0.32, 0.04]);
    add(new THREE.BoxGeometry(0.22, 0.28, 0.48), body, [0.48, -0.32, 0.04]);
    add(new THREE.BoxGeometry(0.72, 0.86, 0.04), dark, [0, 0.08, -0.2], [-0.08, 0, 0]);
    add(new THREE.PlaneGeometry(0.6, 0.72), glow, [0, 0.08, -0.175], [-0.08, 0, 0]);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 20), dark, [0.38, -0.68, 0.18]);
    add(new THREE.TorusGeometry(0.11, 0.025, 10, 20), body, [0.38, -0.58, 0.18]);
  }

  return g;
}

export function disposeStudioTwin(group) {
  group.traverse((mesh) => {
    mesh.geometry?.dispose?.();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.filter(Boolean).forEach((m) => m.dispose?.());
  });
}
