'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './HomeProductPreview.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

const STAGES = {
  source: {
    label: 'House photo',
    copy: 'Start with one clear property photo or reuse a photo from a saved property.',
  },
  preview: {
    label: '3D voxel photo',
    copy: 'VoxelPop rebuilds the visible photo with source-colored 3D blocks so you can compare the likeness before the separate movable voxel starts.',
  },
  voxel: {
    label: 'Movable 3D voxel',
    copy: 'Approve the 3D voxel photo, then VoxelPop creates the separate movable voxel model.',
  },
  nft: {
    label: 'Optional NFT',
    copy: 'After the movable 3D voxel is finished, you can keep it in Vault or mint that digital voxel as an NFT.',
  },
};

export default function HomeProductPreview() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);
  const current = STAGES[stage];

  return <div className={styles.card}>
    <div className={styles.topline}>
      <div><small>VOXELPOP · CENTER CREATOR</small><b>{current.label}</b></div>
      <span className={styles.price}>$4.99</span>
    </div>

    <div className={styles.viewer} aria-label={`${current.label} sample`}>
      {stage === 'source' ? <div className={styles.sourceStage}>
        <img src={SAMPLE} alt="Sample house photo"/>
        <span>1 · YOUR PHOTO</span>
      </div> : stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : stage === 'voxel'
          ? <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>
          : <div className={styles.nftStage}>
              <div className={styles.nftToken}>
                <div className={styles.nftModel}><LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE}/></div>
                <div className={styles.nftMeta}><small>VOXELPOP NFT</small><b>My Property Voxel</b><span>Finished movable 3D voxel · mint optional</span></div>
              </div>
              <span className={styles.nftBadge}>4 · NFT AFTER VOXEL</span>
            </div>}
    </div>

    <div className={styles.controls} role="group" aria-label="Choose VoxelPop sample stage">
      <button type="button" className={stage === 'source' ? styles.active : ''} aria-pressed={stage === 'source'} onClick={() => setStage('source')}><span>1</span>Photo</button>
      <button type="button" className={stage === 'preview' ? styles.active : ''} aria-pressed={stage === 'preview'} onClick={() => setStage('preview')}><span>2</span>Voxel photo</button>
      <button type="button" className={stage === 'voxel' ? styles.active : ''} aria-pressed={stage === 'voxel'} onClick={() => setStage('voxel')}><span>3</span>{stage === 'voxel' && !voxelReady ? 'Building…' : 'Movable'}</button>
      <button type="button" className={stage === 'nft' ? styles.active : ''} aria-pressed={stage === 'nft'} onClick={() => setStage('nft')}><span>4</span>NFT</button>
    </div>
    <p>{current.copy}</p>
  </div>;
}
