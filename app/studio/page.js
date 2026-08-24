'use client';

import { useState } from 'react';
import styles from './studio.module.css';

const previewAssets = [
  ['sword','SWORD'],['shield','SHIELD'],['potion','POTION'],['gem','GEM'],
  ['chest','CHEST'],['crown','CROWN'],['tree','TREE'],['orb','ORB'],
  ['castle','CASTLE'],['pickaxe','PICKAXE'],['mushroom','MUSHROOM'],['slime','SLIME'],
];

const categories = [
  ['01','Combat','Sword · shield · bow · arrow · helmet'],
  ['02','Loot','Coin · gem · chest · key · crown · ring'],
  ['03','Magic','Potions · crystal · scroll · book · orb · portal'],
  ['04','World','Tree · rock · torch · mushroom · slime'],
  ['05','Tools','Pickaxe · axe · hammer · backpack · map'],
  ['06','Buildings','Castle · tower · house · crate · barrel'],
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

export default function StudioPage(){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function buy(){
    setBusy(true); setError('');
    try{
      const response=await fetch('/api/creator-pack/checkout',{method:'POST'});
      const data=await response.json();
      if(!response.ok||!data.url) throw new Error(data.error||'Checkout unavailable');
      location.href=data.url;
    }catch(error){
      setError(error instanceof Error ? error.message : 'Checkout unavailable');
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/"><span>VV</span><b>Voxel Vault</b></a>
      <div className={styles.navLinks}><a href="#inside">What’s inside</a><a href="#license">License</a></div>
      <button className={styles.navBuy} onClick={buy} disabled={busy}>Get the pack <b>$15</b></button>
    </nav>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><span>NEW</span> THE VOXEL CREATOR PACK</div>
        <h1>Build your world.<br/><em>Skip the blank canvas.</em></h1>
        <p className={styles.lead}>36 editable voxel-style assets for games, thumbnails, communities and creator projects — ready to download in one organized pack.</p>
        <div className={styles.offer}>
          <div className={styles.offerPrice}><strong>$15</strong><span><b>ONE-TIME</b>Instant download</span></div>
          <button className={styles.buy} onClick={buy} disabled={busy}>{busy?'Opening secure checkout…':'Get all 36 assets →'}</button>
          <div className={styles.micro}><span>✓ Commercial use</span><span>✓ Editable SVG</span><span>✓ No subscription</span></div>
        </div>
        {error&&<p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.productWrap}>
        <div className={styles.glow}/>
        <div className={styles.productWindow}>
          <div className={styles.windowTop}><div><i/><i/><i/></div><span>VOXEL_CREATOR_PACK / PREVIEW</span><b>36 FILES</b></div>
          <div className={styles.assetGrid}>{previewAssets.map(([kind,name],i)=><div className={styles.asset} key={kind}><span className={styles.assetNumber}>{String(i+1).padStart(2,'0')}</span><VoxelIcon kind={kind}/><small>{name}</small></div>)}</div>
          <div className={styles.windowBottom}><div><b>36</b><span>editable assets</span></div><div><b>SVG</b><span>scalable files</span></div><div><b>$0.42</b><span>per asset</span></div></div>
        </div>
        <div className={styles.floatBadge}><span>+</span><div><b>COMMERCIAL LICENSE</b><small>included in the download</small></div></div>
      </div>
    </section>

    <section className={styles.trustBar}><span>36 EDITABLE ASSETS</span><i>◆</i><span>INSTANT DOWNLOAD</span><i>◆</i><span>COMMERCIAL USE</span><i>◆</i><span>SECURE CHECKOUT</span></section>

    <section className={styles.section} id="inside">
      <div className={styles.sectionIntro}><div><p className={styles.kicker}>ONE PACK. A WHOLE STARTING LIBRARY.</p><h2>Everything you need to start building.</h2></div><p>Weapons, loot, magic, tools, scenery and buildings — organized as editable SVG files so you can recolor, resize and remix them for your project.</p></div>
      <div className={styles.categories}>{categories.map(([number,title,list])=><article key={title}><div><span>{number}</span><b>{title}</b></div><p>{list}</p></article>)}</div>
    </section>

    <section className={styles.workflow}>
      <div className={styles.workflowCopy}><p className={styles.kicker}>MADE TO BE USED</p><h2>From download to design in minutes.</h2><p>Drop the SVG files into Figma, Canva, Illustrator, Photopea or any SVG-compatible workflow. Scale without blur, change colors, combine pieces and ship.</p><div className={styles.appPills}><span>FIGMA</span><span>CANVA</span><span>ILLUSTRATOR</span><span>PHOTOPEA</span></div></div>
      <div className={styles.stack} aria-hidden="true"><div className={styles.stackCard}><span>01</span><VoxelIcon kind="sword"/></div><div className={styles.stackCard}><span>02</span><VoxelIcon kind="gem"/></div><div className={styles.stackCard}><span>03</span><VoxelIcon kind="castle"/></div></div>
    </section>

    <section className={styles.section} id="license">
      <div className={styles.license}>
        <div><p className={styles.kicker}>STRAIGHTFORWARD LICENSE</p><h2>Make things with it.<br/><em>Even commercial things.</em></h2></div>
        <div className={styles.licenseRules}><article><span>✓</span><div><b>Use & modify</b><p>Games, videos, social posts, marketing, client work and other finished personal or commercial projects.</p></div></article><article><span>×</span><div><b>Don’t redistribute the source pack</b><p>The editable source files can’t be resold, sublicensed or given away as a competing asset library.</p></div></article></div>
      </div>
    </section>

    <section className={styles.finalCta}><div className={styles.finalGlow}/><p className={styles.kicker}>36 ASSETS · ONE DOWNLOAD · $15</p><h2>Your next world starts<br/>with a better first block.</h2><p>Get the complete Voxel Creator Pack, commercial-use license and bonus Facebook ad-copy starters.</p><button onClick={buy} disabled={busy}>{busy?'Opening checkout…':'Get the Voxel Creator Pack — $15'}</button><small>Secure Stripe checkout · one-time payment · instant access after purchase</small></section>

    <footer className={styles.footer}><a className={styles.brand} href="/"><span>VV</span><b>Voxel Vault</b></a><p>Independent digital asset studio · Digital product; no promise of earnings.</p></footer>
    <div className={styles.mobileBuy}><div><b>$15</b><span>36 assets · instant</span></div><button onClick={buy} disabled={busy}>{busy?'Opening…':'Get the pack'}</button></div>
  </main>;
}
