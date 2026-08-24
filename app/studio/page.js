'use client';
import { useState } from 'react';
import styles from './studio.module.css';

const items=['36 editable voxel SVG assets','Weapons, loot, props, buildings & magic items','Transparent backgrounds + scalable vectors','Commercial-use license for finished projects','Facebook ad copy starters','Instant download after secure checkout'];
const icons=['⚔','◆','✦','⬢','♜','★','▲','●','♦','⬟','⌂','♛'];

export default function StudioPage(){
 const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 async function buy(){setBusy(true);setError('');try{const r=await fetch('/api/creator-pack/checkout',{method:'POST'});const d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Checkout unavailable');location.href=d.url}catch(e){setError(e.message);setBusy(false)}}
 return <main className={styles.page}>
  <nav className={styles.nav}><a className={styles.brand} href="/"><span>VV</span> Voxel Vault</a><a href="#inside">Inside</a><a href="#license">License</a></nav>
  <section className={styles.hero}><div><p className={styles.kicker}>THE VOXEL CREATOR PACK</p><h1>36 assets.<br/><em>One tiny price.</em></h1><p className={styles.lead}>A ready-to-use voxel art kit for indie games, thumbnails, communities, world-building and social content.</p><div className={styles.price}><strong>$15</strong><span>one-time · instant download</span></div><button className={styles.buy} onClick={buy} disabled={busy}>{busy?'Opening secure checkout…':'Get the full pack — $15'}</button>{error&&<p className={styles.error}>{error}</p>}<small>Secure Stripe checkout · no subscription</small></div>
  <div className={styles.preview}><div className={styles.badges}><b>36 FILES</b><b>SVG</b><b>COMMERCIAL USE</b></div><div className={styles.grid}>{icons.map((x,i)=><div key={i}><span>{x}</span><small>{['SWORD','SHIELD','POTION','COIN','CHEST','GEM','TREE','CRYSTAL','CROWN','ORB','CASTLE','SLIME'][i]}</small></div>)}</div><p>+ 24 more editable assets in the full pack</p></div></section>
  <div className={styles.strip}>EDITABLE <i>◆</i> SCALABLE <i>◆</i> INSTANT <i>◆</i> COMMERCIAL USE</div>
  <section className={styles.section} id="inside"><p className={styles.kicker}>DROP IT INTO YOUR PROJECT</p><h2>Everything in one download.</h2><div className={styles.included}>{items.map((x,i)=><article key={x}><b>{String(i+1).padStart(2,'0')}</b><p>{x}</p></article>)}</div></section>
  <section className={styles.use}><p className={styles.kicker}>BUILT FOR PEOPLE WHO SHIP</p><h2>Games. Thumbnails.<br/>Communities. Worlds.</h2><p>Use the pack in game UI, social graphics, creator branding, videos, mockups, client work and finished commercial projects.</p></section>
  <section className={styles.section} id="license"><div className={styles.license}><div><p className={styles.kicker}>SIMPLE LICENSE</p><h2>Use it commercially.</h2></div><div><p><b>You can</b> edit the files and use them in personal or commercial finished products.</p><p><b>You can’t</b> resell or redistribute the source files as a competing asset pack.</p></div></div></section>
  <section className={styles.cta}><p className={styles.kicker}>YOUR NEXT PROJECT NEEDS ART</p><h2>Skip the empty canvas.</h2><button onClick={buy} disabled={busy}>{busy?'Opening checkout…':'Download all 36 assets — $15'}</button><p>One purchase. Instant access. No recurring charge.</p></section>
  <footer className={styles.footer}>Voxel Vault · Independent digital asset studio · Digital product; no promise of earnings.</footer>
 </main>
}