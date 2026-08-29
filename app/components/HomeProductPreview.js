'use client';

import { useState } from 'react';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import VoxelPopHouseRenderPreview from '../property/VoxelPopHouseRenderPreview';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

const STAGES = {
  source: {
    label: 'House photo',
    copy: 'Start with one clear front or three-quarter photo of the house.',
  },
  preview: {
    label: 'VoxelPop 3D house',
    copy: 'VoxelPop generates a new NFT-house-style image from the authorized photo for you to compare and approve first.',
  },
  voxel: {
    label: 'Movable 3D voxel',
    copy: 'Approve the generated VoxelPop house, then build the separate movable voxel model. Minting stays optional.',
  },
};

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  const current = STAGES[stage];

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>LIVE VOXELPOP FLOW</small><b>{current.label}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>

    <div className={styles.viewer} aria-label={`${current.label} sample`}>
      {stage === 'source' ? <div className={styles.sourceStage}>
        <img src={SAMPLE} alt="Sample house photo"/>
        <span>1 · YOUR PHOTO</span>
      </div> : stage === 'preview'
        ? <VoxelPopHouseRenderPreview generatedImage={SAMPLE} sample/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>

    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'source' ? styles.active : ''} aria-pressed={stage === 'source'} onClick={() => setStage('source')}><span>1</span>Photo</button>
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>2</span>3D house image</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>3</span>{stage === 'voxel' && !voxelReady ? 'Building…' : 'Movable voxel'}</button>
    </div>
    <p>{current.copy}</p>
  </div>;
}
