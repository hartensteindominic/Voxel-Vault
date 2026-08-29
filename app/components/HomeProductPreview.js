'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';
const STAGES = [
  { id: 'photo', label: 'Photo' },
  { id: 'preview', label: '3D voxel photo' },
  { id: 'voxel', label: 'Movable voxel' },
];

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);

  const title = stage === 'photo' ? 'Original house photo' : stage === 'preview' ? '3D voxel photo' : 'Movable 3D voxel';

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>SEE THE DIFFERENCE</small><b>{title}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>

    <div className={`${styles.viewer} ${stage === 'photo' ? styles.photoStage : ''}`} aria-label={`${title} sample`}>
      {stage === 'photo' ? <img src={SAMPLE} alt="Sample house photo"/> : null}
      {stage === 'preview' ? <PhotoReliefModelViewer imageUrl={SAMPLE}/> : null}
      {stage === 'voxel' ? <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/> : null}
      <div className={styles.viewerLabel}>{stage === 'photo' ? 'START HERE' : stage === 'preview' ? 'REVIEW THIS FIRST' : voxelReady ? 'MOVE + ROTATE' : 'BUILDING VOXEL…'}</div>
    </div>

    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      {STAGES.map((item, index) => <button key={item.id} type="button" className={stage === item.id ? styles.active : ''} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>
        <span>{index + 1}</span>{item.label}
      </button>)}
    </div>

    <p>{stage === 'photo'
      ? 'Use one clear house photo.'
      : stage === 'preview'
        ? 'This is the 3D voxel photo you inspect before the movable voxel is created.'
        : 'After you approve the voxel photo, VoxelPop builds the separate movable model.'}</p>
  </div>;
}
