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
        <p>This built-in sample uses the same two visual stages as Create: first the image is rebuilt as a real 3D voxel photo, then you can compare it with the separate movable 3D voxel model.</p>
      </header>

      <section className={styles.demoCard}>
        <div className={styles.reference}>
          <div className={styles.label}>1 · SAMPLE PHOTO</div>
          <img src={SAMPLE} alt="Illustrative sample house used for the VoxelPop public demo"/>
          <p>Illustrative built-in demo artwork — not a customer property and not evidence of photogrammetric accuracy.</p>
        </div>

        <div className={styles.viewerSide}>
          <div className={styles.viewerHead}>
            <div><small>{stage === 'preview' ? '2 · 3D VOXEL PHOTO' : '3 · MOVABLE 3D VOXEL'}</small><h2>{stage === 'preview' ? 'See the blocks first.' : 'Then move the model.'}</h2></div>
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
            ? 'The visible sample is rebuilt block by block as real Three.js voxel geometry. Drag gently to inspect its depth while the original image stays visible for comparison.'
            : voxelReady ? 'The separate movable voxel is built locally from the same visible source image. Drag to rotate and pinch to zoom.' : 'Building the separate movable voxel from the same visible sample image…'}</div>
        </div>
      </section>

      <section className={styles.flow}>
        <div><small>THE PAID FLOW</small><h2>Your photo follows the same order.</h2><p>Sign in → choose an authorized property photo → pay $4.99 once → inspect the 3D voxel photo → approve it → build the movable voxel → optionally mint the finished digital voxel.</p></div>
        <Link href="/property">Create my house voxel · $4.99 →</Link>
      </section>

      <section className={styles.truth}>
        <b>What this sample proves</b>
        <span>You can inspect the product interaction before creating an account. One photo can drive the visible voxel-photo treatment and the later digital model, but it does not prove unseen walls, survey-grade dimensions, roof geometry, title, or any physical-property right.</span>
      </section>
    </div>
  </main>;
}
