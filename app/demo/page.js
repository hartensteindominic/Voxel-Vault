'use client';

import Link from 'next/link';
import { useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import { DEMO_SAMPLE } from '../property/demoSample';
import styles from './demo.module.css';

export default function DemoPage() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);

  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <small>FREE SAMPLE · NO LOGIN · NO PAYMENT</small>
        <h1>Photo in.<br/><em>Voxel out.</em></h1>
        <p>Built-in demo artwork — one photo becomes a 3D voxel photo, then a movable voxel you can rotate.</p>
      </header>

      <section className={styles.demoCard}>
        <div className={styles.reference}>
          <div className={styles.label}>PHOTO</div>
          <img src={DEMO_SAMPLE} alt="Sample house for the VoxelPop demo"/>
        </div>

        <div className={styles.viewerSide}>
          <div className={styles.viewerHead}>
            <div><small>{stage === 'preview' ? '3D VOXEL PHOTO' : 'MOVABLE 3D VOXEL'}</small><h2>{stage === 'preview' ? 'Match the photo.' : 'Rotate it.'}</h2></div>
            <div className={styles.switcher} role="tablist" aria-label="Demo stage">
              <button type="button" role="tab" aria-selected={stage === 'preview'} className={stage === 'preview' ? styles.active : ''} onClick={() => setStage('preview')}>Voxel photo</button>
              <button type="button" role="tab" aria-selected={stage === 'voxel'} className={stage === 'voxel' ? styles.active : ''} onClick={() => setStage('voxel')}>Movable</button>
            </div>
          </div>
          <div className={styles.viewer}>
            {stage === 'preview'
              ? <PhotoReliefModelViewer imageUrl={DEMO_SAMPLE}/>
              : <LocalVoxelModelViewer imageUrl={DEMO_SAMPLE} sourceImageUrl={DEMO_SAMPLE} onReady={() => setVoxelReady(true)}/>}
          </div>
          <div className={styles.viewerNote}>{stage === 'preview'
            ? 'Colored blocks from the photo — drag to inspect depth.'
            : voxelReady ? 'Same photo, movable 3D voxel. Drag to rotate.' : 'Building movable voxel…'}</div>
          <p className={styles.boundary}>Built from one photo only — not a fake reconstruction of unseen walls. A single photo cannot prove hidden sides or interior geometry.</p>
        </div>
      </section>

      <section className={styles.flow}>
        <div><small>$4.99</small><h2>Create yours.</h2><p>Sign in → photo → pay once → approve → voxel saved to Vault.</p></div>
        <Link href="/property">Create · $4.99 →</Link>
      </section>
    </div>
  </main>;
}
