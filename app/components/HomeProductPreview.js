'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  const previewStage = stage === 'preview';

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div className={styles.sampleLabel}>
        <span className={styles.liveDot}/>
        <div><small>INTERACTIVE SAMPLE</small><b>{previewStage ? '3D Voxel Photo' : 'Movable 3D Voxel'}</b></div>
      </div>
      <span className={styles.stagePill}>{previewStage ? 'STEP 1' : 'STEP 2'}</span>
    </div>

    <div className={styles.viewer} aria-label={previewStage ? 'Interactive 3D Voxel Photo sample' : 'Interactive movable 3D voxel sample'}>
      {previewStage
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>}
    </div>

    <div className={styles.controls} role="group" aria-label="Choose which VoxelPop result to preview">
      <button type="button" className={previewStage ? styles.active : ''} aria-pressed={previewStage} onClick={() => setStage('preview')}>
        <span>01</span><div><small>FIRST</small><b>Voxel Photo</b></div>
      </button>
      <button type="button" className={!previewStage ? styles.active : ''} aria-pressed={!previewStage} onClick={() => setStage('voxel')}>
        <span>02</span><div><small>AFTER APPROVAL</small><b>{!previewStage && !voxelReady ? 'Building…' : 'Movable Voxel'}</b></div>
      </button>
    </div>

    <p>{previewStage
      ? 'Rotate the Voxel Photo and check that the visible house matches your source before continuing.'
      : 'This is the separate movable 3D model. Save it to Vault; minting stays optional.'}</p>
  </div>;
}
