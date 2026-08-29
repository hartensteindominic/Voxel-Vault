'use client';

import { useState } from 'react';
import ProductTopNav from '../../components/ProductTopNav';
import BankNav from '../BankNav';
import styles from '../section.module.css';

export default function SecurityPage(){const [alerts,setAlerts]=useState(true);const [lock,setLock]=useState(false);return <main className={styles.page}><ProductTopNav/><div className={styles.shell}><BankNav/>
<section className={styles.hero}><span className={styles.eyebrow}>SECURITY CENTER</span><h1>Protect the whole galaxy.</h1><p>Centralize account protection, card controls, device visibility and the identity/security requirements needed before real financial accounts can launch.</p></section>
<section className={styles.grid}>
<article className={`${styles.panel} ${styles.lime}`}><span className={styles.eyebrow}>DEMO SECURITY SCORE</span><div className={styles.metric}>92</div><p>Strong prototype posture. Real scoring requires verified identity and device signals.</p></article>
<article className={`${styles.panel} ${styles.big}`}><h2>Protection controls</h2><div className={styles.row}><div><strong>Transaction alerts</strong><span>Demo notifications</span></div><button className={styles.button} onClick={()=>setAlerts(v=>!v)}>{alerts?'On':'Off'}</button></div><div className={styles.row}><div><strong>Account lock</strong><span>Blocks sandbox actions in this prototype</span></div><button className={styles.button} onClick={()=>setLock(v=>!v)}>{lock?'Unlock':'Lock'}</button></div><div className={styles.row}><div><strong>Two-step verification</strong><span>Required before provider-backed launch</span></div><span className={styles.pill}>PLANNED</span></div></article>
<article className={`${styles.panel} ${styles.purple}`}><h2>Trusted devices</h2><div className={styles.row}><div><strong>Current device</strong><span>Prototype session</span></div><span className={styles.pill}>ACTIVE</span></div><div className={styles.row}><div><strong>Other sessions</strong><span>No verified device registry yet</span></div><b>0</b></div></article>
<article className={`${styles.panel} ${styles.coral}`}><h2>Identity</h2><p>Real accounts require a compliant identity/KYC flow from the eventual banking provider. Galactic Trust does not claim identity verification is active today.</p></article>
<article className={`${styles.panel} ${styles.dark}`}><h2>Provider security boundary</h2><p>Credentials, account numbers, card PANs and regulated identity data should stay with purpose-built providers whenever possible rather than being stored directly by Voxel Vault.</p></article>
</section><div className={styles.footer}>Security controls shown here are product prototypes unless explicitly marked as provider-backed.</div></div></main>}