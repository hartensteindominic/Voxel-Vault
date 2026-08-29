'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './demo.module.css';

const STAGES = ['PHOTO', '3D PREVIEW', 'VOXEL'];

export default function DemoPage() {
  const [stage, setStage] = useState(0);
  const [angle, setAngle] = useState(-12);

  const rotate = (delta) => setAngle((value) => Math.max(-54, Math.min(54, value + delta)));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.brand}>← VOXEL VAULT</Link>
          <Link href="/property" className={styles.create}>CREATE FROM MY PHOTO →</Link>
        </nav>

        <header className={styles.hero}>
          <p>PUBLIC · NO LOGIN · NO PAYMENT</p>
          <h1>See the VoxelPop flow <em>before you sign in.</em></h1>
          <span>This built-in sample demonstrates the product order and interaction. It is an illustration, not a customer result and not a guarantee that every property photo will produce identical geometry.</span>
        </header>

        <section className={styles.demoCard}>
          <div className={styles.stageTabs} role="tablist" aria-label="VoxelPop demo stages">
            {STAGES.map((label, index) => (
              <button key={label} type="button" onClick={() => setStage(index)} className={stage === index ? styles.activeTab : ''} aria-selected={stage === index}>{index + 1}. {label}</button>
            ))}
          </div>

          <div className={styles.viewer}>
            {stage === 0 && (
              <div className={styles.photoFrame} aria-label="Illustrated sample property photo">
                <div className={styles.sky}/><div className={styles.sun}/><div className={styles.ground}/>
                <div className={styles.photoHouse}><div className={styles.photoRoof}/><div className={styles.photoBody}><i/><i/><b/></div></div>
                <div className={styles.frameLabel}>BUILT-IN SAMPLE PHOTO</div>
              </div>
            )}

            {stage === 1 && (
              <div className={styles.previewScene} aria-label="Illustrated 3D preview" style={{ '--angle': `${angle}deg` }}>
                <div className={styles.previewGround}/>
                <div className={styles.previewHouse}>
                  <div className={styles.previewRoof}/>
                  <div className={styles.previewFront}><i/><i/><b/></div>
                  <div className={styles.previewSide}/>
                </div>
                <div className={styles.viewerBadge}>3D PREVIEW · REVIEW BEFORE VOXEL</div>
              </div>
            )}

            {stage === 2 && (
              <div className={styles.voxelScene} aria-label="Illustrated movable voxel" style={{ '--angle': `${angle}deg` }}>
                <div className={styles.voxelGround}/>
                <div className={styles.voxelModel}>
                  <div className={`${styles.block} ${styles.b1}`}/><div className={`${styles.block} ${styles.b2}`}/><div className={`${styles.block} ${styles.b3}`}/><div className={`${styles.block} ${styles.b4}`}/><div className={`${styles.block} ${styles.b5}`}/><div className={`${styles.block} ${styles.b6}`}/><div className={`${styles.block} ${styles.b7}`}/><div className={`${styles.block} ${styles.b8}`}/><div className={`${styles.block} ${styles.b9}`}/><div className={`${styles.block} ${styles.b10}`}/><div className={`${styles.block} ${styles.b11}`}/><div className={`${styles.block} ${styles.b12}`}/>
                </div>
                <div className={styles.viewerBadge}>MOVABLE VOXEL · MINT OPTIONAL</div>
              </div>
            )}
          </div>

          {stage > 0 && <div className={styles.controls}><button type="button" onClick={() => rotate(-12)}>↶ ROTATE</button><button type="button" onClick={() => setAngle(-12)}>RESET</button><button type="button" onClick={() => rotate(12)}>ROTATE ↷</button></div>}

          <div className={styles.nextRow}>
            <div><small>REAL FLOW</small><strong>Photo → $4.99 → 3D preview → approve → voxel → optional mint</strong></div>
            {stage < 2 ? <button type="button" className={styles.next} onClick={() => setStage(stage + 1)}>NEXT: {STAGES[stage + 1]} →</button> : <Link className={styles.next} href="/property">USE MY PROPERTY PHOTO →</Link>}
          </div>
        </section>

        <section className={styles.truth}>
          <div><b>$4.99</b><span>one digital VoxelPop creation</span></div>
          <div><b>DEVICE-LOCAL</b><span>source photo during normal creation</span></div>
          <div><b>OPTIONAL</b><span>wallet and mint only after voxel</span></div>
          <div><b>NO DEED</b><span>digital creation does not grant property rights</span></div>
        </section>

        <footer className={styles.footer}><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></footer>
      </div>
    </main>
  );
}
