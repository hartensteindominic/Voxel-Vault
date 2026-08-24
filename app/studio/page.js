'use client';

import { useState } from 'react';
import styles from './studio.module.css';

const brief = `Hi VoxelForge — I’d like a custom voxel package.

1. What should be created?
2. How many assets?
3. Preferred style or references?
4. Needed file formats?
5. Target deadline?`;

const packages = [
  { name: 'Quick Voxel', price: '$5', note: 'Easy first commission', items: ['1 custom voxel artwork', '1 polished PNG render', 'Your picture or description', '48-hour delivery'] },
  { name: 'Asset Mini-Pack', price: '$15', note: 'Games & communities', items: ['3 coordinated artworks', 'Characters, props, or items', 'Transparent PNG versions', '1 revision round'] },
  { name: 'NFT Art Pack', price: '$30', note: 'Collections & galleries', items: ['6 coordinated artworks', 'Unified traits and palette', 'Metadata-ready organization', 'Commercial-use license'] },
];

export default function StudioPage() {
  const [copied, setCopied] = useState(false);
  async function copyBrief() {
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a className={styles.brand} href="/"><span>VV</span> Voxel Vault</a><a href="#packages">Packages</a><a href="#process">Process</a><a href="/">Gallery</a></nav>
    <section className={styles.hero}>
      <div><p className={styles.kicker}>CUSTOM VOXEL ASSET STUDIO</p><h1>Voxel worlds, <em>built to ship.</em></h1><p className={styles.lead}>Original 3D-style voxel characters, game assets, and NFT-ready artwork—starting at just $5.</p><div className={styles.actions}><a className={styles.primary} href="#packages">Start for $5</a><button className={styles.secondary} onClick={copyBrief}>{copied ? 'Brief copied ✓' : 'Copy project brief'}</button></div><div className={styles.proof}><span><b>48h</b> turnaround</span><span><b>$5</b> starting price</span><span><b>100%</b> original direction</span></div></div>
      <div className={styles.heroArt}><img src="https://voxelforge-assets.voxel-vault-5748.chatgpt.site/voxel-mascots.png" alt="Original voxel fox, robot, and dragon concepts" /><p>Character concept showcase</p></div>
    </section>
    <section className={styles.strip}><span>GAME ASSETS</span><i>◆</i><span>3D VOXELS</span><i>◆</i><span>MASCOTS</span><i>◆</i><span>NFT ART</span></section>
    <section className={styles.section} id="packages"><div className={styles.sectionHead}><div><p className={styles.kicker}>CLEAR SCOPE. FAST DELIVERY.</p><h2>Choose your package.</h2></div><p>Projects begin after scope and payment are confirmed. NFT-ready art is a creative deliverable; no financial return is promised.</p></div><div className={styles.cards}>{packages.map((p,i)=><article className={i===0?styles.featured:''} key={p.name}>{i===0&&<span className={styles.popular}>START HERE</span>}<p>{p.note}</p><h3>{p.name}</h3><strong>{p.price}</strong><ul>{p.items.map(item=><li key={item}>✓ {item}</li>)}</ul><button onClick={copyBrief}>{copied?'Copied — reply by email':'Request this package'}</button></article>)}</div></section>
    <section className={`${styles.process} ${styles.section}`} id="process"><div><p className={styles.kicker}>FROM REFERENCE TO READY</p><h2>A simple four-step build.</h2></div><ol><li><b>01</b><span><strong>Send references</strong><small>Pictures, sketches, or a written description.</small></span></li><li><b>02</b><span><strong>Confirm the brief</strong><small>Assets, format, usage, timing, and price.</small></span></li><li><b>03</b><span><strong>Review direction</strong><small>A focused preview before final delivery.</small></span></li><li><b>04</b><span><strong>Receive the pack</strong><small>Organized files and agreed usage rights.</small></span></li></ol></section>
    <section className={styles.cta}><p className={styles.kicker}>HAVE A CHARACTER OR WORLD IN MIND?</p><h2>Send the reference.<br/>We’ll shape the pixels.</h2><button onClick={copyBrief}>{copied?'Project brief copied ✓':'Copy the project brief'}</button><p>Paste it into your reply email with your reference images.</p></section>
    <footer className={styles.footer}><a className={styles.brand} href="/"><span>VV</span> Voxel Vault</a><p>Independent voxel asset studio · Digital delivery worldwide</p><p>Artwork shown is concept imagery. Final deliverables are confirmed per project.</p></footer>
  </main>;
}
