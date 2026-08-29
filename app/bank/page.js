'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import styles from './bank.module.css';

const STORAGE_KEY='voxel-vault:galactic-trust-sandbox:v1';
const START={checking:824063,savings:430000,frozen:false,activity:[{id:1,name:'Voxel Vault Creator',detail:'Income',amount:24500},{id:2,name:'Cloud Compute',detail:'Card',amount:-3200},{id:3,name:'Property pocket',detail:'Savings',amount:-12500}]};
const money=(cents)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);

export default function GalacticTrustPage(){
 const [bank,setBank]=useState(START);const [hidden,setHidden]=useState(false);const [notice,setNotice]=useState('');
 useEffect(()=>{try{const saved=window.localStorage.getItem(STORAGE_KEY);if(saved)setBank({...START,...JSON.parse(saved)})}catch{}},[]);
 useEffect(()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(bank))}catch{}},[bank]);
 const total=useMemo(()=>bank.checking+bank.savings,[bank]);
 const addDemoFunds=()=>{setBank(c=>({...c,checking:c.checking+25000,activity:[{id:Date.now(),name:'Demo deposit',detail:'Added to checking',amount:25000},...c.activity].slice(0,5)}));setNotice('$250 added to demo checking.');};
 return <main className={styles.page}><ProductTopNav/><div className={styles.shell}>
  <header className={styles.hero}><div><div className={styles.brandRow}><span className={styles.mark}>✦</span><strong>GALACTIC TRUST</strong><span className={styles.demo}>DEMO</span></div><h1><span>Spend.</span> Save. <em>Grow.</em></h1><p className={styles.lead}>Simple banking for your Voxel Vault world.</p></div></header>

  <nav className={styles.quickNav} aria-label="Galactic Trust banking"><Link href="/bank/cards"><b>Cards</b><span>Manage your card →</span></Link><Link href="/bank/transfers"><b>Send</b><span>Move money →</span></Link><Link href="/bank/bills"><b>Bills</b><span>See what’s due →</span></Link><Link href="/bank/security"><b>Security</b><span>Stay protected →</span></Link></nav>

  <section className={styles.grid}><article className={`${styles.panel} ${styles.balancePanel}`}><div className={styles.panelTop}><b>Your balance</b><button onClick={()=>setHidden(v=>!v)}>{hidden?'Show':'Hide'}</button></div><div className={styles.balance}>{hidden?'••••••':money(total)}</div><div className={styles.accounts}><div><span>SPEND</span><strong>{hidden?'••••':money(bank.checking)}</strong><small>Orbit Checking</small></div><div><span>SAVE</span><strong>{hidden?'••••':money(bank.savings)}</strong><small>Nova Savings</small></div></div><div className={styles.actions}><button onClick={addDemoFunds}>＋ Add $250 demo</button><Link href="/bank/transfers">Send money →</Link></div>{notice&&<p className={styles.notice}>{notice}</p>}</article>

  <article className={`${styles.panel} ${styles.cardPanel}`}><div className={styles.cardHeader}><b>Your card</b><span className={styles.liveDot}>DEMO</span></div><div className={`${styles.card} ${bank.frozen?styles.frozen:''}`}><div className={styles.cardStars}>✦　✧　·</div><div className={styles.cardName}>GALACTIC<br/>TRUST</div><div className={styles.cardNumber}>••••　4821</div><div className={styles.cardFoot}><span>VOXEL VAULT</span><span>12/29</span></div></div><button className={styles.freeze} onClick={()=>setBank(c=>({...c,frozen:!c.frozen}))}>{bank.frozen?'Unfreeze card':'Freeze card'}</button></article></section>

  <section className={styles.lowerGrid}><article className={styles.panel}><div className={styles.sectionTitle}><div><span>RECENT</span><strong>Activity</strong></div><Link href="/bank/bills">View bills →</Link></div><div className={styles.activity}>{bank.activity.map(item=><div key={item.id} className={styles.activityRow}><div><strong>{item.name}</strong><span>{item.detail}</span></div><b className={item.amount>=0?styles.positive:''}>{`${item.amount>0?'+':''}${money(item.amount)}`}</b></div>)}</div></article>
  <article className={`${styles.panel} ${styles.savePanel}`}><span className={styles.kicker}>SAVE</span><h2>Next property</h2><div className={styles.saveAmount}>{money(Math.round(bank.savings*.52))}</div><p>Your biggest savings pocket.</p><Link href="/bank/transfers">Add money →</Link></article></section>

  <section className={styles.simpleFooter}><div><b>Galactic Trust</b><span>Banking made simple.</span></div><Link href="/vault">Back to Voxel Vault →</Link></section>
  <footer className={styles.disclosure}>Demo experience only. Balances are fictional and are not deposits or FDIC-insured funds. Real banking features require an approved provider.</footer>
 </div></main>;
}
