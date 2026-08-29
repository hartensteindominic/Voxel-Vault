'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>REAL PRODUCT VIEWER</small><b>{stage === 'preview' ? '3D voxel photo' : 'Movable 3D voxel'}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label={stage === 'preview' ? 'Interactive 3D voxel photo preview' : 'Interactive movable 3D voxel sample'}>
      {stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>
    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>1</span>3D voxel photo</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>2</span>{stage === 'voxel' && !voxelReady ? 'Building voxel…' : 'Movable voxel'}</button>
    </div>
    <p>{stage === 'preview' ? 'First: VoxelPop turns your house photo into a block-by-block 3D voxel photo you can inspect and approve.' : 'Second: approve the voxel photo, then build the separate movable 3D voxel model.'}</p>
  </div>;
}