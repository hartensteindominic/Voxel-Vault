'use client';
import {useState} from 'react';
import styles from './studio.module.css';

const examples=[
 ['/voxelpop/relic-chest.jpg','Relic Chest'],
 ['/voxelpop/rune-portal.jpg','Rune Portal'],
 ['/voxelpop/glowcap-lantern.jpg','Glowcap Lantern']
];
function Brand(){return <a href="/" className={styles.brand}><img src="/voxelpop/voxelpop-logo-exact.webp" alt="VoxelPop" width="256" height="256" loading="eager" style={{display:'block',width:'clamp(108px,28vw,132px)',height:'clamp(108px,28vw,132px)',objectFit:'contain'}}/></a>}
export default function StudioPage(){
 const [idea,setIdea]=useState('Enchanted ruins');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function create(){
  if(idea.trim().length<3){setError('Describe what you want first.');return;}
  setBusy(true);setError('');
  try{
   sessionStorage.setItem('voxelPackBrief',JSON.stringify({idea:idea.trim(),style:'polished'}));
   const r=await fetch('/api/creator-pack/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea:idea.trim().slice(0,180),style:'polished'})});
   const d=await r.json(); if(!r.ok||!d.url) throw new Error(d.error||'Checkout unavailable'); location.href=d.url;
  }catch(e){setError(e instanceof Error?e.message:'Checkout unavailable');setBusy(false)}
 }
 return <main className={styles.page}>
  <nav><Brand/><span className={styles.price}><i/>$1.99 per 3D asset</span></nav>
  <header>
   <p className={styles.kicker}>✦ MADE FOR GAME CREATORS</p>
   <h1>Your idea.<br/><em>Built in voxels.</em></h1>
   <p className={styles.lead}>Type absolutely anything. See the voxel style, then create one real 3D asset for only $1.99.</p>
  </header>
  <section className={styles.card}>
   <div className={styles.step}><span>1</span><div><h2>Describe anything</h2><p>If you can type it, VoxelPop can voxel it.</p></div></div>
   <div className={styles.input}><textarea value={idea} onChange={e=>setIdea(e.target.value)} maxLength={300}/><button onClick={()=>setIdea(['Tiny cyberpunk ramen shop','Cute dragon barista','Haunted forest shrine','Space pirate captain'][Math.floor(Math.random()*4)])}>✦ Surprise me</button></div>
   <div className={styles.checks}><span>✓ <b>One custom voxel</b></span><span>✓ <b>One-time $1.99 payment</b></span><span>✓ <b>3D GLB + image</b></span></div>
   <button className={styles.cta} onClick={create} disabled={busy}>✦ {busy?'Opening checkout…':'Create my voxel · $1.99'}</button>
   <small>No account · One payment, one custom asset</small>{error&&<p className={styles.error}>{error}</p>}
  </section>
  <section className={styles.preview}>
   <div className={styles.previewHead}><div><small>STYLE PREVIEW</small><h2>{idea||'Your idea'}</h2></div><span>● EXAMPLES</span></div>
   <div className={styles.gallery}>{examples.map(([src,name],i)=><figure key={src}><b>0{i+1}</b><img src={src} alt={name}/><figcaption>{name}</figcaption></figure>)}</div>
   <div className={styles.empty}>✦ Your paid voxel will appear after checkout.</div>
  </section>
  <section className={styles.facts}><div><b>Anything</b><span>prompted into voxels</span></div><div><b>1 voxel</b><span>created after payment</span></div><div><b>Real 3D</b><span>rotate, zoom & move</span></div><div><b>$1.99</b><span>one-time, per asset</span></div></section>
  <footer><Brand/><p>One idea. One payment.<br/>One voxel you own.</p></footer>
 </main>
}