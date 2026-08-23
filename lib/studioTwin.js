import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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
