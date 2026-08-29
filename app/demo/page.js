'use client';

import Link from 'next/link';
import { useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './demo.module.css';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function DemoPage() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);

  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <small>NO LOGIN · NO PAYMENT · PUBLIC SAMPLE</small>
        <h1>See VoxelPop<br/><em>before you sign in.</em></h1>
        <p>This built-in sample shows the same two visual stages used in Create: first a block-by-block 3D voxel photo you can compare with the source, then the separate movable 3D voxel.</p>
      </header>

      <section className={styles.demoCard}>
        <div className={styles.reference}>
          <div className={styles.label}>1 · SAMPLE PHOTO</div>
          <img src={SAMPLE} alt="Illustrative sample house used for the VoxelPop public demo"/>
          <p>Illustrative built-in demo artwork — not a customer property and not evidence of survey-grade or photogrammetric accuracy.</p>
        </div>

        <div className={styles.viewerSide}>
          <div className={styles.viewerHead}>
            <div><small>{stage === 'preview' ? '2 · 3D VOXEL PHOTO' : '3 · MOVABLE VOXEL'}</small><h2>{stage === 'preview' ? 'Compare it first.' : 'Then move it.'}</h2></div>
            <div className={styles.switcher} role="tablist" aria-label="VoxelPop demo stage">
              <button type="button" role="tab" aria-selected={stage === 'preview'} className={stage === 'preview' ? styles.active : ''} onClick={() => setStage('preview')}>Voxel photo</button>
              <button type="button" role="tab" aria-selected={stage === 'voxel'} className={stage === 'voxel' ? styles.active : ''} onClick={() => setStage('voxel')}>Movable voxel</button>
            </div>
          </div>
          <div className={styles.viewer}>
            {stage === 'preview'
              ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
              : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>} 
          </div>
          <div className={styles.viewerNote}>{stage === 'preview'
            ? 'VoxelPop samples the visible source image into real 3D blocks. The original photo stays visible for comparison, and rotation stays bounded so the preview does not pretend to know hidden sides.'
            : voxelReady ? 'The separate movable voxel is built locally from the same visible source image. Drag to rotate.' : 'Building the separate movable voxel from the same visible sample image…'}</div>
        </div>
      </section>

      <section className={styles.flow}>
        <div><small>THE PAID FLOW</small><h2>Your photo follows the same order.</h2><p>Sign in → choose an authorized property photo → pay $4.99 once → inspect the 3D voxel photo → approve it → build the movable voxel → optionally mint the finished digital voxel.</p></div>
        <Link href="/property">Create my house voxel · $4.99 →</Link>
      </section>

      <section className={styles.truth}>
        <b>What this sample proves</b>
        <span>You can inspect the interaction before creating an account. The 3D voxel photo is tied to the visible source image; one photo still cannot prove unseen walls, exact dimensions, roof geometry, title, or any physical-property right.</span>
      </section>
    </div>
  </main>;
}
