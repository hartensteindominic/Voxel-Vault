import * as THREE from 'three';
import { makeMats } from './studioTwinHelpers';
export { getStudioEnvMap } from './studioTwinHelpers';
import { buildSpiral, buildDeskLamp, buildClock, buildBlender } from './studioTwinLamps';
import { buildDispenser, buildBowl, buildFountain, buildBottle, buildVanity } from './studioTwinLiving';

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
  spiral: { body: '#d4b07a', metal: '#c9a45c', glow: '#ffe9b0' },
  'desk-lamp': { body: '#1a1a1c', metal: '#3e3e42', glow: '#fff4dc' },
  clock: { body: '#f3efe8', metal: '#d4c4a8', glow: '#fff1cc' },
  vanity: { body: '#f6f3ed', metal: '#c4a574', glow: '#ffe9c2' },
  blender: { body: '#f1eee8', metal: '#1a1a1c', glow: '#ffffff' },
  dispenser: { body: '#c5dde4', metal: '#eef4f6', glow: '#c5e4ee' },
  bowl: { body: '#e6dccf', metal: '#c5c0b6', glow: '#d6e8ee' },
  fountain: { body: '#1c1c1e', metal: '#c5ccd0', glow: '#dce8ec' },
  bottle: { body: '#1c2a36', metal: '#c8d0d6', glow: '#5aa0ae' },
};

export function createStudioTwin(kind, colors, quality = 'hero') {
  const g = new THREE.Group();
  const compact = quality === 'compact';
  const segs = compact ? 32 : 64;
  const steps = compact ? 110 : 200;
  const mats = makeMats(colors, compact);
  if (kind === 'spiral') buildSpiral(g, mats, colors, segs, steps);
  else if (kind === 'desk-lamp') buildDeskLamp(g, mats, colors, segs);
  else if (kind === 'clock') buildClock(g, mats, segs);
  else if (kind === 'blender') buildBlender(g, mats, segs);
  else if (kind === 'dispenser') buildDispenser(g, mats, segs);
  else if (kind === 'bowl') buildBowl(g, mats, segs);
  else if (kind === 'fountain') buildFountain(g, mats, segs);
  else if (kind === 'bottle') buildBottle(g, mats, segs);
  else buildVanity(g, mats, colors);
  g.userData.studioTwin = true;
  return g;
}

export function animateStudioTwin(group, t) {
  group.traverse((node) => {
    const d = node.userData;
    if (d.pulse && 'material' in node) {
      const mat = node.material;
      if (mat && mat.emissiveIntensity != null) {
        mat.emissiveIntensity = (d.pulseBase ?? 1.3) * (1 + Math.sin(t * 2.05) * 0.16);
      }
    }
    if (d.water) {
      node.position.y = (d.baseY ?? 0) + Math.sin(t * 1.65 + (d.phase ?? 0)) * 0.007;
      const s = 1 + Math.sin(t * 1.2 + (d.phase ?? 0)) * 0.012;
      node.scale.set(s, 1, s);
    }
    if (d.orbit) {
      const a = t * 0.75;
      node.position.set(Math.cos(a) * (d.orbitR ?? 0.24), (d.orbitY ?? 0.1) + Math.sin(t * 0.9) * 0.14, Math.sin(a) * (d.orbitR ?? 0.24));
    }
    if (d.spin) node.rotation.y = t * d.spin;
    if (d.bob) node.position.y = (d.baseY ?? 0) + Math.abs(Math.sin(t * 2.4 + (d.phase ?? 0))) * 0.05;
  });
}

export function disposeStudioTwin(group) {
  group.traverse((node) => {
    const mesh = node;
    mesh.geometry?.dispose?.();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.filter(Boolean).forEach((mat) => { mat.dispose?.(); });
  });
}
