'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

const COPY = {
  photo: {
    eyebrow: 'STEP 1 · SOURCE',
    title: 'Your house photo',
    note: 'Start with the photo you actually want VoxelPop to use.',
  },
  preview: {
    eyebrow: 'STEP 2 · REVIEW',
    title: '3D voxel photo',
    note: 'Inspect the voxelized photo first. Nothing moves to the final model until you approve it.',
  },
  voxel: {
    eyebrow: 'STEP 3 · MODEL',
    title: 'Movable 3D voxel',
    note: 'After approval, VoxelPop builds the separate model you can rotate, save, and optionally mint.',
  },
};

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  const current = COPY[stage];

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>{current.eyebrow}</small><b>{current.title}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>

    <div className={styles.viewer} aria-label={`${current.title} sample`}>
      {stage === 'photo' ? <div className={styles.photoOnly}>
        <img src={SAMPLE} alt="Example house source photo"/>
        <span>ORIGINAL HOUSE PHOTO</span>
      </div> : null}
      {stage === 'preview' ? <PhotoReliefModelViewer imageUrl={SAMPLE}/> : null}
      {stage === 'voxel' ? <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/> : null}
    </div>

    <div className={styles.controls} role="group" aria-label="Choose a VoxelPop sample stage">
      <button type="button" className={stage === 'photo' ? styles.active : ''} aria-pressed={stage === 'photo'} onClick={() => setStage('photo')}><span>1</span>Photo</button>
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>2</span>Voxel photo</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>3</span>{stage === 'voxel' && !voxelReady ? 'Building…' : 'Movable voxel'}</button>
    </div>

    <p>{current.note}</p>
  </div>;
}
