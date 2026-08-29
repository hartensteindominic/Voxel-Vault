'use client';

import { useState } from 'react';
import ProductTopNav from '../../components/ProductTopNav';
import BankNav from '../BankNav';
import styles from '../section.module.css';

export default function TransfersPage(){
 const [amount,setAmount]=useState('100'); const [to,setTo]=useState('Nova Savings'); const [notice,setNotice]=useState('');
 const submit=(e)=>{e.preventDefault();const n=Number(amount);setNotice(Number.isFinite(n)&&n>0?`Demo transfer of $${n.toFixed(2)} to ${to} created.`:'Enter a valid amount.');};
 return <main className={styles.page}><ProductTopNav/><div className={styles.shell}><BankNav/>
 <section className={styles.hero}><span className={styles.eyebrow}>TRANSFERS · SANDBOX</span><h1>Move money without the maze.</h1><p>Prototype internal transfers, future external-bank connections and scheduled movement from one clear Galactic Trust flow.</p></section>
 <section className={styles.grid}>
  <article className={`${styles.panel} ${styles.big}`}><h2>New demo transfer</h2><form className={styles.form} onSubmit={submit}><label>FROM<select><option>Orbit Checking · $8,240.63</option><option>Nova Savings · $4,300.00</option></select></label><label>TO<select value={to} onChange={e=>setTo(e.target.value)}><option>Nova Savings</option><option>Orbit Checking</option><option>External bank · Provider required</option></select></label><label>AMOUNT<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className={styles.button}>Review demo transfer</button></form>{notice&&<div className={styles.notice}>{notice}</div>}</article>
  <article className={`${styles.panel} ${styles.lime}`}><span className={styles.eyebrow}>TRANSFER SPEED</span><div className={styles.metric}>Instant</div><p>Between Galactic Trust demo accounts. External rails are not active.</p></article>
  <article className={`${styles.panel} ${styles.purple}`}><h2>Scheduled</h2><div className={styles.row}><div><strong>$150 → Nova Savings</strong><span>Every Friday · demo</span></div><span className={styles.pill}>ACTIVE</span></div><div className={styles.row}><div><strong>$75 → Property pocket</strong><span>Monthly · demo</span></div><span className={styles.pill}>ACTIVE</span></div></article>
  <article className={styles.panel}><h2>External accounts</h2><p>Connect-bank UX belongs here, but account linking and ACH/wire movement must be supplied by an approved provider before activation.</p><button className={`${styles.button} ${styles.buttonLight}`} disabled>Connect bank · coming later</button></article>
  <article className={`${styles.panel} ${styles.dark}`}><h2>Transfer truth</h2><p>Galactic Trust will never label a transfer settled merely because the interface says it was submitted. Provider-backed states must drive real-money status.</p></article>
 </section><div className={styles.footer}>All transfer activity on this page is sandbox simulation and does not move real funds.</div>
 </div></main>;
}