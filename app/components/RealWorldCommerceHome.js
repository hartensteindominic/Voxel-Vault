'use client';

import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import VaultRewardsInvite from './VaultRewardsInvite';
import './VaultHomeV3.css';
import './VaultCommercePolish.css';

function Icon({ name, size = 18 }) {
  const paths = {
    arrow:<><path d="M5 13 13 5"/><path d="M7 5h6v6"/></>,
    cube:<><path d="m10 2.5 6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2Z"/><path d="m3.7 6.3 6.3 3.6 6.3-3.6M10 9.9v7.3"/></>,
    shield:<><path d="M10 2.5 16 5v4.5c0 3.6-2.2 6.3-6 8-3.8-1.7-6-4.4-6-8V5Z"/><path d="m7.2 10 1.8 1.8 3.8-4"/></>
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand(){
  return <Link href="/" className="vv3-brand" aria-label="Voxel Vault home"><span className="vv3-brandMark"><i/><i/><i/></span><span>VOXEL <b>VAULT</b></span></Link>;
}

function BuyBoth({item}){
  const ready=Boolean(item.fulfillmentReady&&item.purchaseAssetId);
  return <div className="vv3-buyBoth">
    {ready
      ? <Link href={`/marketplace?purchase=${encodeURIComponent(item.purchaseAssetId)}`} className="vv3-buyButton">BUY PHYSICAL + 3D NFT · ${item.customerPriceUsd}</Link>
      : <div className="vv3-buyButton vv3-buyButtonDisabled">CHECKOUT LOCKED · SUPPLIER CONNECTION REQUIRED</div>}
    <div className="vv3-buyPerks"><span>📦 physical object</span><span>🧊 3D twin included</span><span>🏠 Vault + Room</span></div>
    {item.customerPriceUsd&&<div className="vv3-priceNote">Target retail · {item.markupPercent}% configured Vault markup over the reference price · physical checkout unlocks after a real supplier/SKU is connected</div>}
  </div>;
}

function Card({item,index}){
  return <article className="vv3-objectCard">
    <div className="vv3-objectVisual">
      <RealWorld3DNFT item={item}/>
      <span className="vv3-cardIndex">{String(index+1).padStart(2,'0')}</span>
      <span className="vv3-liveBadge"><i/> REAL OBJECT</span>
      <span className="vv3-nftBadge">3D NFT INCLUDED</span>
    </div>
    <div className="vv3-objectDetails"><div><small>{item.type}</small><h3>{item.name}</h3></div><strong>{item.customerPriceUsd?`$${item.customerPriceUsd}`:'Price on request'}</strong></div>
    <div className="vv3-objectMeta"><span>{item.sourceName}</span><span>3D TWIN · {item.digitalTwin?.status || 'READY'}</span></div>
    <div className="vv3-sourceRow"><a href={item.sourceUrl} target="_blank" rel="noreferrer">View physical source ↗</a><span>{item.markupPercent ? `${item.markupPercent}% Vault markup` : 'Reference pricing'}</span></div>
    <BuyBoth item={item}/>
  </article>;
}

function TrustSection(){
  return <div className="vv3-trustSection">
    <strong>How the offer works.</strong>
    <span>Real product sources establish the physical object's reference and identity.</span>
    <span>Voxel Vault can apply a configured markup to eligible reference pricing.</span>
    <span>The interactive 3D collectible is presented as the digital layer.</span>
    <span>Physical checkout stays locked until a real supplier, SKU, cost and fulfillment route are connected.</span>
  </div>;
}

function MobileNav(){
  return <nav className="vv3-mobileNav" aria-label="Mobile navigation"><Link href="/discover">World</Link><Link href="/capture">Create</Link><Link href="/avatar">Avatar</Link><Link href="/messages">People</Link><Link href="/trade">Trade</Link></nav>;
}

export default function RealWorldCommerceHome(){
  const hero=REAL_WORLD_CATALOG[0];
  return <main className="vv3-home">
    <div className="vv3-noise" aria-hidden="true"/>
    <header className="vv3-header"><div className="vv3-topbar"><Brand/><nav className="vv3-desktopNav" aria-label="Primary navigation"><Link href="/discover">Discover</Link><Link href="/marketplace">Marketplace</Link><Link href="/room">My vault</Link><Link href="/ai">Intelligence</Link></nav><Link className="vv3-headerCta" href="#collection">Shop physical + NFT <Icon name="arrow" size={15}/></Link></div></header>
    <section className="vv3-hero">
      <div className="vv3-heroGlow" aria-hidden="true"/>
      <div className="vv3-heroCopy">
        <div className="vv3-eyebrow"><i/> PHYSICAL + DIGITAL COLLECTION</div>
        <h1>Real objects.<br/><em>3D NFTs.</em></h1>
        <p>Buy a verified physical object and unlock its interactive 3D twin. Wear it, place it in your room, pin it to the world, or trade it wallet-to-wallet.</p>
        <div className="vv3-heroActions"><Link className="vv3-primaryCta" href="#collection">Shop both <Icon name="arrow" size={17}/></Link><Link className="vv3-textCta" href="/room"><span><Icon name="cube" size={14}/></span> Open Vault</Link></div>
        <div className="vv3-proofRow"><span><Icon name="shield" size={16}/><b>Real product source</b></span><span><Icon name="cube" size={16}/><b>Interactive 3D twin</b></span><span><Icon name="shield" size={16}/><b>Ownership-ready asset</b></span></div>
      </div>
      <div className="vv3-heroVisual">
        <div className="vv3-visualTop"><span><i/> 3D NFT</span><small>PHYSICAL PRODUCT + DIGITAL TWIN</small></div>
        <RealWorld3DNFT item={hero} hero/>
        <div className="vv3-featureMeta"><div><small>PHYSICAL + DIGITAL BUNDLE</small><strong>{hero.name}</strong><span>{hero.creator} · {hero.customerPriceUsd?`$${hero.customerPriceUsd}`:'Price on request'}</span></div></div>
        <BuyBoth item={hero}/>
      </div>
    </section>
    <section className="vv3-signalBar"><span>REAL PRODUCTS</span><i/><span>INTERACTIVE 3D TWINS</span><i/><span>NFT-READY ASSETS</span><i/><span>VAULT + ROOM + WORLD</span></section>
    <section className="vv3-coreLoop" aria-label="Voxel Vault experiences">
      <Link href="/discover"><small>WORLD</small><strong>Place digital twins on a living globe.</strong><span>Explore public drops and location-linked objects.</span></Link>
      <Link href="/avatar"><small>AVATAR</small><strong>Build the 3D version of you.</strong><span>Wear compatible items from your verified collection.</span></Link>
      <Link href="/trade"><small>TAP TRADE</small><strong>Start a secure phone-to-phone handoff.</strong><span>Share the offer nearby; both wallets still approve.</span></Link>
      <Link href="/ai"><small>CRESTODIAN AI</small><strong>Ask your collection what it knows.</strong><span>Research, organize, and plan without autonomous spending.</span></Link>
      <Link href="/capture"><small>FREE CAPTURE</small><strong>Turn a photo or QR scan into an elemental twin.</strong><span>Create a private memory first; verify provenance before trading.</span></Link>
      <Link href="/messages"><small>VAULT SOCIAL</small><strong>Message people and prepare personal handoffs.</strong><span>Private profiles, chat, and approval-gated NFT requests.</span></Link>
    </section>
    <section className="vv3-collection" id="collection">
      <div className="vv3-collectionHead"><div><div className="vv3-sectionLabel"><span>01</span> SHOP THE COLLECTION</div><h2>Buy the object.<br/><em>Own the twin.</em></h2></div><p>Each listing is anchored to a real-world product source. Voxel Vault keeps reference pricing, target retail markup, supplier cost and actual profit as separate concepts so the store never pretends a retail reference price is a dropship cost.</p></div>
      <div className="vv3-objectGrid">{REAL_WORLD_CATALOG.map((item,i)=><Card key={item.id} item={item} index={i}/>)}</div>
      <TrustSection/>
      <VaultRewardsInvite/>
    </section>
    <section className="vv3-finalCta"><div><small>VOXEL VAULT</small><h2>Physical in your hands. Digital in your world.</h2><p>Buy both when a verified supplier route is live, keep the 3D collectible in your Vault, place it in your Room, and make it discoverable in the World.</p></div><Link className="vv3-primaryCta" href="/room">Open My Room <Icon name="arrow" size={17}/></Link></section>
    <MobileNav/>
  </main>;
}
