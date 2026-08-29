'use client';

import Link from 'next/link';
import { useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';
import styles from './demo.module.css';

// Explicit width/height on the SVG is required so canvas sampling gets real pixels.
const SAMPLE = '/voxelpop/demo-house.svg';

export default function DemoPage() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);

  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <small>FREE SAMPLE · NO LOGIN · NO PAYMENT</small>
        <h1>See the voxel photo.<br/><em>Then see the movable voxel.</em></h1>
        <p>VoxelPop has two different outputs. First, the visible house photo becomes a block-by-block 3D voxel photo. After you approve that likeness, VoxelPop builds the separate movable 3D voxel model.</p>
      </header>

      <section className={styles.demoCard}>
        <div className={styles.reference}>
          <div className={styles.label}>1 · SOURCE PHOTO</div>
          <img src={SAMPLE} alt="Illustrative sample house used for the VoxelPop public demo"/>
          <p>This is built-in demo artwork. Your own creation uses the property photo you choose on your device.</p>
        </div>

        <div className={styles.viewerSide}>
          <div className={styles.viewerHead}>
            <div><small>{stage === 'preview' ? '2 · 3D VOXEL PHOTO' : '3 · MOVABLE 3D VOXEL'}</small><h2>{stage === 'preview' ? 'Check the likeness first.' : 'Then move the model.'}</h2></div>
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
            ? 'This first result is intentionally a 3D voxel photo: colored blocks sampled from the visible source image with real depth you can inspect. It is not a fake reconstruction of unseen walls.'
            : voxelReady ? 'This is the separate movable voxel model built from the same visible source image. Drag to rotate it.' : 'Building the movable voxel from the same visible source image…'}</div>
        </div>
      </section>

      <section className={styles.flow}>
        <div><small>THE $4.99 FLOW</small><h2>One simple creation journey.</h2><p>Sign in → choose an authorized house photo → pay once → inspect the 3D voxel photo → approve it → build the movable voxel → save it to Vault → mint only if you want.</p></div>
        <Link href="/property">Create my VoxelPop · $4.99 →</Link>
      </section>

      <section className={styles.truth}>
        <b>What the demo does and does not claim</b>
        <span>One photo can represent the visible view of a house. It cannot prove hidden sides, exact dimensions, parcel boundaries, deed/title, rent, occupancy, investment rights, or physical-property ownership.</span>
      </section>
    </div>
  </main>;
}
