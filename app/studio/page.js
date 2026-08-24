'use client';

import { useState } from 'react';
import styles from './studio.module.css';

const previewAssets = [
  ['sword','SWORD'],['shield','SHIELD'],['potion','POTION'],['gem','GEM'],
  ['chest','CHEST'],['crown','CROWN'],['tree','TREE'],['orb','ORB'],
  ['castle','CASTLE'],['pickaxe','PICKAXE'],['mushroom','MUSHROOM'],['slime','SLIME'],
];

const categories = [
  ['01','Hero set','Character · companion · helmet · signature item'],
  ['02','Combat','Weapon · shield · bow · projectile · tool'],
  ['03','Loot','Coin · gem · chest · key · collectible'],
  ['04','Magic','Potion · crystal · spell · orb · portal'],
  ['05','World','Tree · rock · plant · prop · container'],
  ['06','Landmarks','Building · tower · sign · special structure'],
];

function VoxelIcon({kind}) {
  const common = <><path d="M48 82 16 66V30l32 16 32-16v36L48 82Z" fill="currentColor" opacity=".12"/><path d="M48 46 16 30 48 14l32 16-32 16Z" fill="currentColor" opacity=".22"/></>;
  const shapes = {
    sword:<g transform="rotate(-42 48 48)"><rect x="44" y="20" width="8" height="49" rx="2" fill="currentColor"/><path d="m48 10 8 12H40l8-12Z" fill="currentColor"/><rect x="32" y="65" width="32" height="7" rx="2" fill="#fff" opacity=".88"/><rect x="44" y="70" width="8" height="14" rx="2" fill="currentColor"/></g>,
    shield:<path d="M48 18 70 27v18c0 17-9 29-22 36-13-7-22-19-22-36V27l22-9Z" fill="currentColor"/>,
    potion:<g><rect x="40" y="17" width="16" height="12" rx="2" fill="#fff" opacity=".8"/><path d="M38 28h20v10c9 5 14 13 14 23 0 13-10 21-24 21S24 74 24 61c0-10 5-18 14-23V28Z" fill="currentColor"/><path d="M31 58h34c0 12-6 18-17 18S31 70 31 58Z" fill="#fff" opacity=".25"/></g>,
    gem:<path d="m48 16 22 14 8 20-30 32-30-32 8-20 22-14Zm0 9-12 9 12 34 12-34-12-9Z" fill="currentColor" fillRule="evenodd"/>,
    chest:<g><path d="M23 39c0-12 10-21 25-21s25 9 25 21v7H23v-7Z" fill="currentColor"/><rect x="20" y="43" width="56" height="35" rx="5" fill="currentColor"/><rect x="44" y="45" width="8" height="33" fill="#fff" opacity=".35"/><rect x="42" y="55" width="12" height="10" rx="2" fill="#fff" opacity=".9"/></g>,
    crown:<path d="m20 30 17 15 11-25 11 25 17-15-7 42H27l-7-42Zm12 33h32l2-10H30l2 10Z" fill="currentColor" fillRule="evenodd"/>,
    tree:<g><rect x="43" y="54" width="10" height="28" rx="2" fill="#fff" opacity=".55"/><path d="M48 14 23 51h15L25 67h46L58 51h15L48 14Z" fill="currentColor"/></g>,
    orb:<g><circle cx="48" cy="43" r="25" fill="currentColor"/><circle cx="40" cy="35" r="8" fill="#fff" opacity=".55"/><path d="M29 74h38l-7 9H36l-7-9Z" fill="currentColor"/></g>,
    castle:<g><path d="M22 34h13V22h10v12h7V22h10v12h13v48H22V34Z" fill="currentColor"/><rect x="42" y="59" width="12" height="23" rx="5" fill="#09090e" opacity=".7"/><rect x="29" y="45" width="8" height="9" fill="#fff" opacity=".5"/><rect x="59" y="45" width="8" height="9" fill="#fff" opacity=".5"/></g>,
    pickaxe:<g transform="rotate(-40 48 48)"><rect x="44" y="28" width="8" height="56" rx="3" fill="currentColor"/><path d="M20 25c14-10 42-10 56 0l-5 9c-14-6-32-6-46 0l-5-9Z" fill="#fff" opacity=".9"/></g>,
    mushroom:<g><path d="M20 48c2-20 13-30 28-30s26 10 28 30H20Z" fill="currentColor"/><path d="M38 46h20l6 34H32l6-34Z" fill="#fff" opacity=".82"/><circle cx="36" cy="35" r="5" fill="#fff" opacity=".75"/><circle cx="58" cy="31" r="4" fill="#fff" opacity=".75"/></g>,
    slime:<path d="M23 64c0-23 9-39 25-39s25 16 25 39c0 11-10 18-25 18S23 75 23 64Zm14-9h8v8h-8v-8Zm14 0h8v8h-8v-8Z" fill="currentColor" fillRule="evenodd"/>,
  };
  return <svg viewBox="0 0 96 96" aria-hidden="true">{common}{shapes[kind]}</svg>;
}

async function compressReference(file){
  const bitmap=await createImageBitmap(file);
  const max=640;
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Image preview is not supported in this browser.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg',.78);
}

export default function StudioPage(){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [idea,setIdea]=useState('Cozy medieval fantasy adventure with warm lantern light, mossy stone and emerald accents');
  const [style,setStyle]=useState('polished');
  const [reference,setReference]=useState('');
  const [referenceName,setReferenceName]=useState('');

  async function chooseReference(event){
    const file=event.target.files?.[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){setError('Please choose a JPG, PNG or WebP image.');return;}
    if(file.size>12*1024*1024){setError('Please choose an image under 12 MB.');return;}
    try{
      setError('');
      setReference(await compressReference(file));
      setReferenceName(file.name);
    }catch(err){setError(err instanceof Error?err.message:'Could not read that image.');}
  }

  async function buy(){
    if(idea.trim().length<8){setError('Describe the world or subject you want first.');return;}
    setBusy(true); setError('');
    try{
      sessionStorage.setItem('voxelPackBrief',JSON.stringify({idea:idea.trim().slice(0,600),style,reference,referenceName}));
      const response=await fetch('/api/creator-pack/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea:idea.trim().slice(0,180),style})});
      const data=await response.json();
      if(!response.ok||!data.url) throw new Error(data.error||'Checkout unavailable');
      location.href=data.url;
    }catch(err){
      setError(err instanceof Error?err.message:'Checkout unavailable');
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/"><span>VV</span><b>Voxel Vault</b></a>
      <div className={styles.navLinks}><a href="#make">Make yours</a><a href="#inside">What you get</a><a href="#license">License</a></div>
      <button className={styles.navBuy} onClick={()=>document.getElementById('make')?.scrollIntoView({behavior:'smooth'})}>Create a pack <b>$15</b></button>
    </nav>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><span>AI</span> CUSTOM VOXEL ASSET PACK</div>
        <h1>One idea in.<br/><em>25 matching assets out.</em></h1>
        <p className={styles.lead}>Describe a world — or add a reference photo — and get a coordinated 25-piece voxel-style PNG asset pack generated for your project.</p>
        <div className={styles.heroPoints}><span>✓ Your theme</span><span>✓ Transparent PNGs</span><span>✓ Commercial-use license</span></div>
        <a className={styles.heroButton} href="#make">Build my pack — $15 <span>→</span></a>
        <p className={styles.heroFine}>One-time payment · no subscription · generated after purchase</p>
      </div>

      <div className={styles.productWrap}>
        <div className={styles.glow}/>
        <div className={styles.productWindow}>
          <div className={styles.windowTop}><div><i/><i/><i/></div><span>CUSTOM_PACK / PREVIEW</span><b>25 ASSETS</b></div>
          <div className={styles.assetGrid}>{previewAssets.map(([kind,name],i)=><div className={styles.asset} key={kind}><span className={styles.assetNumber}>{String(i+1).padStart(2,'0')}</span><VoxelIcon kind={kind}/><small>{name}</small></div>)}</div>
          <div className={styles.windowBottom}><div><b>25</b><span>matching PNGs</span></div><div><b>1:1</b><span>square assets</span></div><div><b>$0.60</b><span>per asset</span></div></div>
        </div>
        <div className={styles.floatBadge}><span>+</span><div><b>MADE FROM YOUR IDEA</b><small>not a generic stock pack</small></div></div>
      </div>
    </section>

    <section className={styles.trustBar}><span>25 CUSTOM ASSETS</span><i>◆</i><span>YOUR PHOTO OR WORDS</span><i>◆</i><span>TRANSPARENT PNG</span><i>◆</i><span>ONE ZIP DOWNLOAD</span></section>

    <section className={styles.builderSection} id="make">
      <div className={styles.builderIntro}><p className={styles.kicker}>MAKE YOUR PACK</p><h2>Give the generator a direction.</h2><p>Keep it simple. A game world, character, product, pet, brand mascot or visual theme is enough.</p></div>
      <div className={styles.builderCard}>
        <label className={styles.field}><span>1. Describe the pack</span><textarea value={idea} maxLength={600} onChange={e=>setIdea(e.target.value)} placeholder="Example: cute cyberpunk cat café with neon pink signs and tiny robot waiters"/><small>{idea.length}/600</small></label>
        <div className={styles.styleRow}><span>2. Pick a finish</span><div>{[['polished','Polished'],['chunky','Chunky'],['cute','Cute'],['dark','Dark fantasy']].map(([value,label])=><button key={value} type="button" className={style===value?styles.styleActive:''} onClick={()=>setStyle(value)}>{label}</button>)}</div></div>
        <label className={styles.upload}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference}/><div className={styles.uploadIcon}>{reference?<img src={reference} alt="Reference preview"/>:<span>＋</span>}</div><div><b>{referenceName||'3. Add a reference photo (optional)'}</b><p>{reference?'We’ll use its subject, palette and visual cues. Tap to replace it.':'Photo, sketch, product, pet or character reference · JPG/PNG/WebP'}</p></div><strong>{reference?'CHANGE':'UPLOAD'}</strong></label>
        <div className={styles.orderBox}><div><span>Custom AI Voxel Pack</span><small>25 coordinated transparent PNG assets + ZIP + license</small></div><strong>$15</strong></div>
        <button className={styles.buy} onClick={buy} disabled={busy}>{busy?'Opening secure checkout…':'Generate my 25-asset pack — $15'}</button>
        {error&&<p className={styles.error}>{error}</p>}
        <p className={styles.builderFine}>Secure Stripe checkout. Generation starts after payment. Upload only images you own or have permission to use.</p>
      </div>
    </section>

    <section className={styles.section} id="inside">
      <div className={styles.sectionIntro}><div><p className={styles.kicker}>A WHOLE COORDINATED LIBRARY</p><h2>Not one image. A usable pack.</h2></div><p>The generator asks for a consistent 5×5 collection, then the download tool separates the sheet into 25 individual transparent PNG files and packages them with your license and manifest.</p></div>
      <div className={styles.categories}>{categories.map(([number,title,list])=><article key={title}><div><span>{number}</span><b>{title}</b></div><p>{list}</p></article>)}</div>
    </section>

    <section className={styles.workflow}>
      <div className={styles.workflowCopy}><p className={styles.kicker}>BUILT FOR FAST PROJECTS</p><h2>Describe. Generate. Download. Use.</h2><p>Your ZIP includes the 25 PNGs, the original master sheet, a manifest, a straightforward commercial-use license and bonus Facebook-ad copy starters.</p><div className={styles.appPills}><span>GAMES</span><span>CANVA</span><span>FIGMA</span><span>THUMBNAILS</span><span>SOCIAL</span></div></div>
      <div className={styles.steps}><article><b>01</b><span>Describe your theme</span></article><article><b>02</b><span>Pay once with Stripe</span></article><article><b>03</b><span>AI builds the collection</span></article><article><b>04</b><span>Download one ZIP</span></article></div>
    </section>

    <section className={styles.section} id="license">
      <div className={styles.license}>
        <div><p className={styles.kicker}>STRAIGHTFORWARD LICENSE</p><h2>Make things with it.<br/><em>Even commercial things.</em></h2></div>
        <div className={styles.licenseRules}><article><span>✓</span><div><b>Use & modify your generated pack</b><p>Use the outputs in games, videos, social posts, marketing, client work and other finished personal or commercial projects.</p></div></article><article><span>!</span><div><b>Third-party rights still matter</b><p>Don’t upload material you lack permission to use, and don’t assume the pack grants rights to third-party characters, logos or trademarks.</p></div></article></div>
      </div>
    </section>

    <section className={styles.finalCta}><div className={styles.finalGlow}/><p className={styles.kicker}>YOUR IDEA · 25 ASSETS · $15</p><h2>Turn a theme into<br/>a tiny visual world.</h2><p>Build a matching asset pack from words or a reference image, then download the whole collection in one ZIP.</p><a href="#make">Create my pack — $15</a><small>One-time payment · secure checkout · AI-generated output can vary</small></section>

    <footer className={styles.footer}><a className={styles.brand} href="/"><span>VV</span><b>Voxel Vault</b></a><p>Independent digital asset studio · AI-generated digital product; no promise of earnings.</p></footer>
    <div className={styles.mobileBuy}><div><b>$15</b><span>25 custom assets</span></div><button onClick={()=>document.getElementById('make')?.scrollIntoView({behavior:'smooth'})}>Create pack</button></div>
  </main>;
}
