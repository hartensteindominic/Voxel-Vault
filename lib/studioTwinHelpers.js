import * as THREE from 'three';

let cachedEnv = null;

/** Tiny equirect studio so metals read as metal even without PMREM. */
export function getStudioEnvMap() {
  if (cachedEnv) return cachedEnv;
  if (typeof document === 'undefined') {
    cachedEnv = new THREE.Texture();
    return cachedEnv;
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) {
    cachedEnv = new THREE.Texture();
    return cachedEnv;
  }
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#f6f0e4');
  g.addColorStop(0.28, '#d2c4ae');
  g.addColorStop(0.52, '#6e675e');
  g.addColorStop(1, '#161412');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(255,252,244,0.92)';
  ctx.beginPath();
  ctx.ellipse(38, 12, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,200,0.28)';
  ctx.beginPath();
  ctx.ellipse(98, 16, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedEnv = tex;
  return tex;
}

export function phys(color, extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.18,
    clearcoat: 0.4,
    clearcoatRoughness: 0.32,
    envMap: getStudioEnvMap(),
    envMapIntensity: 1.15,
    ...extras,
  });
}

export function makeMats(colors, compact) {
  const glassTx = compact ? 0 : 0.82;
  const waterTx = compact ? 0 : 0.42;
  return {
    body: phys(colors.body, { roughness: 0.42, metalness: 0.08, clearcoat: 0.55 }),
    metal: phys(colors.metal, { metalness: 0.96, roughness: 0.14, clearcoat: 0.85, clearcoatRoughness: 0.12 }),
    dark: phys('#141416', { metalness: 0.55, roughness: 0.38, clearcoat: 0.2 }),
    glow: phys(colors.glow, {
      emissive: colors.glow,
      emissiveIntensity: 1.55,
      roughness: 0.22,
      metalness: 0,
      toneMapped: false,
    }),
    glass: phys('#d5e4ea', {
      roughness: 0.05,
      metalness: 0.02,
      transmission: glassTx,
      thickness: 0.5,
      transparent: true,
      opacity: compact ? 0.38 : 0.9,
      ior: 1.48,
    }),
    water: phys('#7fb6c8', {
      roughness: 0.06,
      metalness: 0,
      transmission: waterTx,
      transparent: true,
      opacity: 0.58,
      thickness: 0.25,
    }),
    gold: phys('#c9a45c', {
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.35,
    }),
    steel: phys('#c5ccd1', { metalness: 0.98, roughness: 0.2, clearcoat: 0.55 }),
    matte: phys('#1a1a1c', { metalness: 0.12, roughness: 0.62, clearcoat: 0.08 }),
    fabric: phys('#f4f0e8', {
      roughness: 0.78,
      metalness: 0,
      sheen: 0.55,
      sheenColor: new THREE.Color('#fff8ee'),
      sheenRoughness: 0.55,
      clearcoat: 0,
    }),
    silicone: phys('#5aa0ae', { roughness: 0.45, metalness: 0.04, clearcoat: 0.35 }),
  };
}

export function lathe(xy, segs) {
  return new THREE.LatheGeometry(
    xy.map(([x, y]) => new THREE.Vector2(x, y)),
    segs,
  );
}

export function helixPts(turns, height, r0, r1, n, y0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 2 * turns;
    const r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + t * height, Math.sin(a) * r));
  }
  return pts;
}

/** Rectangular LED-tape ribbon along a helix. */
export function helixRibbon(turns, height, r0, r1, width, thick, steps, y0) {
  const pos = [];
  const uv = [];
  const idx = [];
  const tan = new THREE.Vector3();
  const rad = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const p = new THREE.Vector3();
  const da = Math.PI * 2 * turns;
  const dr = r1 - r0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * da;
    const r = r0 + dr * t;
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.set(c * r, y0 + t * height, s * r);
    tan.set(-s * r * da + c * dr, height, c * r * da + s * dr).normalize();
    rad.set(c, 0, s);
    bin.crossVectors(tan, rad).normalize();
    nrm.crossVectors(bin, tan).normalize();
    const corners = [[width / 2, thick / 2], [-width / 2, thick / 2], [-width / 2, -thick / 2], [width / 2, -thick / 2]];
    for (const [u, v] of corners) {
      pos.push(p.x + nrm.x * u + bin.x * v, p.y + nrm.y * u + bin.y * v, p.z + nrm.z * u + bin.z * v);
      uv.push(t * turns, u / width + 0.5);
    }
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function add(g, geo, mat, pos = [0, 0, 0], rot) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function pulse(mesh, base = 1.4) {
  mesh.userData.pulse = true;
  mesh.userData.pulseBase = base;
  return mesh;
}

export function liquid(mesh, phase = 0) {
  mesh.userData.water = true;
  mesh.userData.baseY = mesh.position.y;
  mesh.userData.phase = phase;
  return mesh;
}
