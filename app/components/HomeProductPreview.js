'use client';

import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.jpg';

export default function HomeProductPreview() {
  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>YOUR FINISHED VOXEL</small><b>Drag to rotate</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label="Movable VoxelPop sample">
      <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE}/>
      <span className={styles.badge}>MOVABLE 3D VOXEL</span>
    </div>
    <div className={styles.facts} aria-label="VoxelPop facts">
      <span>1 photo</span>
      <span>3D voxel photo review</span>
      <span>Auto-saved</span>
    </div>
  </div>;
}
