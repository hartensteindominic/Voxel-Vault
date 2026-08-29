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
      <div><small>LIVE VOXELPOP PREVIEW</small><b>{stage === 'preview' ? '3D voxel photo' : 'Movable voxel'}</b></div>
      <span className={styles.price}>$4.99 total</span>
    </div>
    <div className={styles.viewer} aria-label={stage === 'preview' ? 'Interactive 3D voxel photo preview' : 'Interactive movable 3D voxel sample'}>
      {stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>
    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>1</span><b>Voxel photo</b><small>compare first</small></button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>2</span><b>{stage === 'voxel' && !voxelReady ? 'Building…' : 'Movable voxel'}</b><small>after approval</small></button>
    </div>
    <p>{stage === 'preview' ? 'This is the review step: compare the voxelized 3D view with the original photo before moving on.' : 'This is the finished movable version you can save to Vault and optionally mint.'}</p>
  </div>;
}
