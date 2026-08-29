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
      <div><small>TRY THE REAL VIEWER</small><b>{stage === 'preview' ? 'First · review the 3D Voxel Photo' : 'Then · explore the 3D Voxel Model'}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>
    <div className={styles.viewer} aria-label={stage === 'preview' ? 'Interactive 3D Voxel Photo preview' : 'Interactive movable 3D Voxel Model sample'}>
      {stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>
    <div className={styles.controls} role="group" aria-label="Switch between the VoxelPop 3D Voxel Photo and 3D Voxel Model sample">
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>1</span>3D Voxel Photo</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>2</span>{stage === 'voxel' && !voxelReady ? 'Building…' : '3D Voxel Model'}</button>
    </div>
    <p>{stage === 'preview' ? 'Review the 3D Voxel Photo first. In your own creation, you approve this voxel-style photo before the movable model is built.' : 'The 3D Voxel Model is the separate movable version. Save it to Vault and mint only if you choose to.'}</p>
  </div>;
}
