'use client';

import { useState } from 'react';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import VoxelPopHouseRenderPreview from '../property/VoxelPopHouseRenderPreview';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function HomeProductPreview() {
  const [stage, setStage] = useState('picture');
  const [voxelReady, setVoxelReady] = useState(false);
  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>REAL PRODUCT FLOW</small><b>{stage === 'picture' ? 'VoxelPop 3D house' : 'Movable 3D voxel'}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label={stage === 'picture' ? 'Sample VoxelPop 3D house approval image' : 'Interactive movable 3D voxel sample'}>
      {stage === 'picture'
        ? <VoxelPopHouseRenderPreview generatedImage={SAMPLE} sample/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>
    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'picture' ? styles.active : ''} aria-pressed={stage === 'picture'} onClick={() => setStage('picture')}><span>1</span>3D house image</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>2</span>{stage === 'voxel' && !voxelReady ? 'Building voxel…' : 'Movable voxel'}</button>
    </div>
    <p>{stage === 'picture' ? 'First: the paid editor generates a new VoxelPop/NFT-house-style image from your authorized house reference, and you approve it.' : 'Second: VoxelPop builds the separate movable voxel from the approved generated house image.'}</p>
  </div>;
}
