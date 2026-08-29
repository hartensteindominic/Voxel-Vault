'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from './property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from './property/LocalVoxelModelViewer';
import styles from './home.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function HeroProductProof() {
  const [mode, setMode] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  return <div className={styles.productProof} aria-label="Interactive VoxelPop product preview">
    <div className={styles.proofTop}>
      <div>
        <small>REAL PRODUCT VIEWER</small>
        <strong>{mode === 'preview' ? 'Textured 3D preview' : 'Movable voxel'}</strong>
      </div>
      <div className={styles.proofSwitch} aria-label="Choose preview stage">
        <button type="button" onClick={() => setMode('preview')} className={mode === 'preview' ? styles.proofActive : ''}>3D</button>
        <button type="button" onClick={() => setMode('voxel')} className={mode === 'voxel' ? styles.proofActive : ''}>Voxel</button>
      </div>
    </div>
    <div className={styles.proofViewer}>
      {mode === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>} 
      <span className={styles.proofStage}>{mode === 'preview' ? '1 · SEE IT FIRST' : voxelReady ? '2 · VOXEL READY' : '2 · BUILDING VOXEL'}</span>
    </div>
    <div className={styles.proofBottom}>
      <span>Drag to inspect</span>
      <b>Same viewer pattern used in the creator</b>
    </div>
  </div>;
}
