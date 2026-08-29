'use client';

import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import { DEMO_SAMPLE } from '../property/demoSample';
import styles from './HomeProductPreview.module.css';

export default function HomeProductPreview() {
  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>VOXELPOP</small><b>Drag to rotate</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label="Movable VoxelPop sample">
      <LocalVoxelModelViewer imageUrl={DEMO_SAMPLE} sourceImageUrl={DEMO_SAMPLE}/>
      <span className={styles.badge}>MOVABLE 3D VOXEL</span>
    </div>
    <div className={styles.facts} aria-label="VoxelPop facts">
      <span>Photo</span>
      <span>3D voxel photo review</span>
      <span>Movable voxel</span>
    </div>
  </div>;
}
