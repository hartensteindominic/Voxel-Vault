'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

const STAGES = {
  source: {
    label: 'House photo',
    copy: 'Start with one clear property photo.',
  },
  preview: {
    label: '3D voxel photo',
    copy: 'First, approve a source-matched 3D voxel photo.',
  },
  voxel: {
    label: 'Movable 3D voxel',
    copy: 'Then VoxelPop builds the separate stacked-cube model automatically.',
  },
  nft: {
    label: 'Optional NFT',
    copy: 'Mint only if you want to after the voxel is saved.',
  },
};

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const current = STAGES[stage];
  const showingVoxel = stage === 'voxel';

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>VOXELPOP SAMPLE</small><b>{current.label}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>

    <div className={styles.viewer} aria-label={`${current.label} sample`}>
      {showingVoxel
        ? <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE}/>
        : <PhotoReliefModelViewer imageUrl={SAMPLE}/>}
    </div>

    <div className={styles.controls} style={{gridTemplateColumns:'1fr'}}>
      <button type="button" className={styles.active} onClick={() => setStage(showingVoxel ? 'preview' : 'voxel')}>
        <span>{showingVoxel ? '2' : '3'}</span>
        {showingVoxel ? 'See voxel photo' : 'See movable voxel'}
      </button>
    </div>
    <p>{current.copy}</p>
  </div>;
}
