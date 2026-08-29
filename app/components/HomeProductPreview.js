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
      <div><small>REAL PRODUCT VIEWER</small><b>{stage === 'preview' ? 'Photo-faithful 3D preview' : 'Movable voxel'}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label={stage === 'preview' ? 'Interactive photo-faithful 3D house preview' : 'Interactive movable voxel sample'}>
      {stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>
    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>1</span>3D preview</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>2</span>{stage === 'voxel' && !voxelReady ? 'Building voxel…' : '3D voxel'}</button>
    </div>
    <p>{stage === 'preview' ? 'First: your original photo stays intact while real depth, perspective, lighting, and shadow make it inspectable in 3D.' : 'Second: approve that recognizable preview, then build the separate blocky voxel.'}</p>
  </div>;
}
