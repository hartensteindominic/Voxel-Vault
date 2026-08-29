'use client';

import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import { DEMO_SAMPLE } from '../property/demoSample';
import styles from './HomeProductPreview.module.css';

export default function HomeProductPreview() {
  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>VOXEL VAULT</small><b>Drag to rotate</b></div>
      <span className={styles.price}>1 OF 1</span>
    </div>
    <div className={styles.viewer} aria-label="Movable house voxel sample">
      <LocalVoxelModelViewer imageUrl={DEMO_SAMPLE} sourceImageUrl={DEMO_SAMPLE}/>
      <span className={styles.badge}>MOVABLE 3D VOXEL</span>
    </div>
    <div className={styles.facts} aria-label="House voxel flow">
      <span>Photo</span>
      <span>Address</span>
      <span>Inventory</span>
    </div>
  </div>;
}
