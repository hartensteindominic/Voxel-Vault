'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import VaultRewardsInvite from './VaultRewardsInvite';
import './VaultHomeV3.css';
import './VaultCommercePolish.css';
import './ImmersiveCommerce.css';

function Icon({ name, size = 18 }) {
  const paths = {
    arrow: <><path d="M5 13 13 5"/><path d="M7 5h6v6"/></>,
    cube: <><path d="m10 2.5 6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2Z"/><path d="m3.7 6.3 6.3 3.6 6.3-3.6M10 9.9v7.3"/></>,
    shield: <><path d="M10 2.5 16 5v4.5c0 3.6-2.2 6.3-6 8-3.8-1.7-6-4.4-6-8V5Z"/><path d="m7.2 10 1.8 1.8 3.8-4"/></>,
    scan: <><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><path d="M7 7h6v6H7z"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <Link href="/" className="iv-brand" aria-label="Voxel Vault home"><span className="iv-brandGlyph"><i/><i/><i/></span><span>VOXEL<span>VAULT</span></span></Link>;
}

function Checkout({ item, compact = false }) {
  const ready = Boolean(item.fulfillmentReady && item.purchaseAssetId);
  return ready
    ? <Link href={`/marketplace?purchase=${encodeURIComponent(item.purchaseAssetId)}`} className="iv-buy">Buy bundle · ${item.customerPriceUsd}<Icon name="arrow" size={15}/></Link>
    : <button className={`iv-buy iv-buyLocked ${compact ? 'compact' : ''}`} type="button" disabled><span>Join launch queue</span><small>Fulfillment connection pending</small></button>;
}

function ProductCard({ item, index }) {
  return <article className="iv-card">
    <div className="iv-cardTop"><span>0{index + 1}</span><span><i/> SOURCE VERIFIED</span></div>
    <div className="iv-cardMedia"><RealWorld3DNFT item={item}/></div>
    <div className="iv-cardBody">
      <div className="iv-cardType">{item.type}</div><h3>{item.name}</h3>
      <div className="iv-cardPrice"><strong>${item.customerPriceUsd}</strong><span>physical object + 3D twin</span></div>
      <div className="iv-cardActions"><a href={item.sourceUrl} target="_blank" rel="noreferrer">Inspect source <Icon name="arrow" size={13}/></a><Link href={`/twin?asset=${encodeURIComponent(item.id)}`}>Open twin</Link></div>
      <Checkout item={item} compact/>
    </div>
  </article>;
}

const FILTERS = {
  Featured: () => true,
  'Pet tech': item => /pet|dog/i.test(`${item.name} ${item.type}`),
  Lighting: item => /lamp|light/i.test(`${item.name} ${item.type}`),
  Living: item => !/pet|dog|lamp|light/i.test(`${item.name} ${item.type}`),
};

export default function RealWorldCommerceHome() {
  const [filter, setFilter] = useState('Featured');
  const hero = REAL_WORLD_CATALOG[2];
  const products = useMemo(() => REAL_WORLD_CATALOG.filter(FILTERS[filter]), [filter]);
  return <main className="iv-shell" id="main-content">
    <a className="iv-skip" href="#collection">Skip to collection</a><div className="iv-ambient" aria-hidden="true"><i/><i/><i/></div>
    <div className="iv-announcement"><span>THE PHYSICAL–DIGITAL OBJECT STORE</span><span>LAUNCH COLLECTION / 01</span><span>FULFILLMENT OPENS AFTER SUPPLIER VERIFICATION</span></div>
    <header className="iv-header"><Brand/><nav aria-label="Primary navigation"><Link href="/discover">Discover</Link><Link href="/marketplace">Objects</Link><Link href="/room">My Vault</Link><Link href="/ai">Crestodian AI</Link></nav><Link className="iv-navCta" href="#collection">Explore drop <Icon name="arrow" size={14}/></Link></header>
    <section className="iv-hero" aria-labelledby="hero-title">
      <div className="iv-heroCopy"><div className="iv-kicker"><span>DROP 001</span><i/> OBJECTS WITH A SECOND LIFE</div><h1 id="hero-title">Hold it.<br/><em>Enter it.</em></h1><p>Real products paired with interactive 3D collectibles—one object for your space, one living twin for your digital world.</p><div className="iv-heroActions"><Link className="iv-primary" href="#collection">Explore the collection <Icon name="arrow" size={16}/></Link><Link className="iv-secondary" href={`/twin?asset=${hero.id}`}><Icon name="cube" size={16}/> Enter featured twin</Link></div><dl className="iv-metrics"><div><dt>09</dt><dd>launch objects</dd></div><div><dt>1:1</dt><dd>physical + digital</dd></div><div><dt>3D</dt><dd>interactive twins</dd></div></dl></div>
      <div className="iv-heroStage"><div className="iv-stageChrome"><span><i/> LIVE OBJECT / 003</span><span>DRAG · ORBIT · ZOOM</span></div><RealWorld3DNFT item={hero} hero/><div className="iv-stageInfo"><div><small>FEATURED OBJECT</small><strong>{hero.name}</strong><span>{hero.type} · source verified</span></div><div><small>BUNDLE TARGET</small><strong>${hero.customerPriceUsd}</strong></div></div><Checkout item={hero}/></div>
    </section>
    <div className="iv-ticker" aria-label="Collection principles"><div><span>REAL OBJECTS</span><i>✦</i><span>INTERACTIVE TWINS</span><i>✦</i><span>VERIFIED SOURCES</span><i>✦</i><span>YOUR VAULT</span><i>✦</i><span>REAL OBJECTS</span><i>✦</i><span>INTERACTIVE TWINS</span></div></div>
    <section className="iv-manifesto"><div className="iv-index">01 / THE PREMISE</div><h2>Commerce should not end<br/>at the <em>checkout.</em></h2><p>Every Voxel Vault bundle is designed to continue beyond delivery: inspect the digital twin, organize it in your Vault, place it in your Room, and let Crestodian understand the objects around you.</p></section>
    <section className="iv-path" aria-label="How Voxel Vault works"><article><span>01</span><Icon name="scan" size={24}/><h3>Find the object</h3><p>Start with a real product and a traceable online source.</p></article><article><span>02</span><Icon name="cube" size={24}/><h3>Inspect the twin</h3><p>Explore its interactive 3D counterpart before launch.</p></article><article><span>03</span><Icon name="shield" size={24}/><h3>Verify the route</h3><p>Checkout unlocks only after inventory and fulfillment are real.</p></article><article><span>04</span><Icon name="arrow" size={24}/><h3>Build your world</h3><p>Keep the twin in your Vault, Room, and connected experiences.</p></article></section>
    <section className="iv-collection" id="collection" aria-labelledby="collection-title"><div className="iv-collectionHead"><div className="iv-index">02 / LAUNCH COLLECTION</div><div><h2 id="collection-title">Choose your<br/><em>first object.</em></h2><p>Nine source-backed products. Nine interactive digital twins. Checkout remains locked until the supply chain is ready.</p></div></div><div className="iv-filter" role="group" aria-label="Filter collection">{Object.keys(FILTERS).map(name => <button type="button" key={name} className={filter === name ? 'active' : ''} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}<span>{REAL_WORLD_CATALOG.filter(FILTERS[name]).length}</span></button>)}</div><p className="iv-results" aria-live="polite">Showing {products.length} source-verified objects</p><div className="iv-grid">{products.map((item, index) => <ProductCard item={item} index={index} key={item.id}/>)}</div></section>
    <section className="iv-ai"><div className="iv-aiOrb" aria-hidden="true"><i/><i/><span>✦</span></div><div><div className="iv-index">03 / CRESTODIAN INTELLIGENCE</div><h2>Your collection,<br/><em>self-aware.</em></h2><p>Ask what an object is, where it came from, how it connects to your collection, and what deserves your attention next.</p><Link className="iv-primary" href="/ai">Meet Crestodian <Icon name="arrow" size={16}/></Link></div></section>
    <section className="iv-rewards"><VaultRewardsInvite/></section><section className="iv-end"><div><small>YOUR WORLD STARTS WITH ONE OBJECT</small><h2>Collect beyond the physical.</h2></div><Link className="iv-primary" href="#collection">Explore launch drop <Icon name="arrow" size={16}/></Link></section>
    <footer className="iv-footer"><Brand/><p>Real objects. Intelligent twins.<br/>One living collection.</p><nav aria-label="Footer navigation"><Link href="/discover">Discover</Link><Link href="/room">Vault</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><span>© 2026 VOXEL VAULT</span></footer><nav className="iv-mobileNav" aria-label="Mobile navigation"><Link href="/discover">Discover</Link><Link href="#collection">Objects</Link><Link href="/room">Vault</Link><Link href="/ai">AI</Link></nav>
  </main>;
}
