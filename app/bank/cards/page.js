'use client';

import { useState } from 'react';
import ProductTopNav from '../../components/ProductTopNav';
import BankNav from '../BankNav';
import styles from '../section.module.css';

export default function CardsPage(){
 const [frozen,setFrozen]=useState(false); const [online,setOnline]=useState(true); const [travel,setTravel]=useState(false);
 return <main className={styles.page}><ProductTopNav/><div className={styles.shell}><BankNav/>
  <section className={styles.hero}><span className={styles.eyebrow}>CARDS · SANDBOX</span><h1>Your card, your controls.</h1><p>Manage a Galactic Trust virtual card with instant demo controls. Real issuance remains unavailable until an approved card/banking provider is connected.</p></section>
  <section className={styles.grid}>
   <article className={`${styles.panel} ${styles.big} ${styles.purple}`}><span className={styles.eyebrow}>VIRTUAL CARD</span><div className={styles.card} style={{filter:frozen?'grayscale(1)':'none',opacity:frozen?.6:1}}><span>✦ GALACTIC TRUST</span><strong>ORBIT<br/>DEBIT</strong><span>•••• •••• •••• 4821　12/29</span></div></article>
   <article className={`${styles.panel} ${styles.lime}`}><span className={styles.eyebrow}>STATUS</span><div className={styles.metric}>{frozen?'Frozen':'Ready'}</div><button className={styles.button} onClick={()=>setFrozen(v=>!v)}>{frozen?'Unfreeze card':'Freeze card'}</button></article>
   <article className={styles.panel}><h2>Card controls</h2><div className={styles.row}><div><strong>Online purchases</strong><span>Demo merchant authorization</span></div><button className={styles.button} onClick={()=>setOnline(v=>!v)}>{online?'On':'Off'}</button></div><div className={styles.row}><div><strong>Travel mode</strong><span>Demo travel preference</span></div><button className={styles.button} onClick={()=>setTravel(v=>!v)}>{travel?'On':'Off'}</button></div></article>
   <article className={`${styles.panel} ${styles.coral}`}><h2>Card details</h2><div className={styles.row}><div><strong>Spending account</strong><span>Orbit Checking</span></div><span className={styles.pill}>DEMO</span></div><div className={styles.row}><div><strong>Network / issuer</strong><span>Not connected</span></div><span className={styles.pill}>GATED</span></div></article>
   <article className={`${styles.panel} ${styles.dark}`}><h2>Real card issuance</h2><p>Requires provider underwriting, identity verification, card program approval, secure PAN handling and compliant transaction processing.</p></article>
  </section><div className={styles.footer}>Sandbox only. No real card has been issued and no merchant transactions are authorized by Galactic Trust.</div>
 </div></main>;
}