'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from '../components/RealWorld3DNFT';
import CJProductCard from '../components/CJProductCard';
import { prime3D } from '../components/threeDSync';
import '../components/CJMarketplace.css';
import '../components/CJMarketplaceCards.css';
import '../components/ReadinessClarity.css';

function modelState(item){const model=item.modelUri||item.digitalTwin?.modelUrl;if(model&&item.digitalTwin?.exactModelVerified)return'verified';if(model)return'review';return'pending'}
function isReady(item){return Boolean(item.fulfillmentReady&&item.purchaseAssetId&&modelState(item)==='verified')}
function selectedState(item){const state=modelState(item);if(state==='verified')return'COLLECTIBLE APPROVED';if(state==='review')return'INTERACTIVE PREVIEW READY';return'PREVIEW BUILDING AUTOMATICALLY'}
function selectUrl(id){return `/marketplace?object=${encodeURIComponent(id)}`}

export default function MarketplacePage(){
 const[query,setQuery]=useState('');const[category,setCategory]=useState('all');const[status,setStatus]=useState('all');const[selectedId,setSelectedId]=useState(REAL_WORLD_CATALOG[0]?.id||'');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('object');if(id&&REAL_WORLD_CATALOG.some(item=>item.id===id))setSelectedId(id)},[]);
 const categories=useMemo(()=>['all',...new Set(REAL_WORLD_CATALOG.map(item=>item.type))],[]);
 const products=useMemo(()=>REAL_WORLD_CATALOG.filter(item=>{const haystack=`${item.name} ${item.type} ${item.sourceName} ${item.supplierSku}`.toLowerCase();const state=modelState(item);const statusMatch=status==='all'||(status==='ready'&&isReady(item))||(status==='verified'&&state==='verified')||(status==='pending'&&state!=='verified');return(!query||haystack.includes(query.toLowerCase()))&&(category==='all'||item.type===category)&&statusMatch}).sort((a,b)=>Number(isReady(b))-Number(isReady(a))||Number(modelState(b)==='verified')-Number(modelState(a)==='verified')),[query,category,status]);
 const selected=REAL_WORLD_CATALOG.find(item=>item.id===selectedId)||products[0]||REAL_WORLD_CATALOG[0];
 const ready=REAL_WORLD_CATALOG.filter(isReady).length;

 useEffect(()=>{
   if(!selected)return;
   prime3D(selected).catch(()=>{});
   const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
   if(connection?.saveData||/2g/.test(connection?.effectiveType||''))return;
   const index=REAL_WORLD_CATALOG.findIndex(item=>item.id===selected.id);
   const warm=REAL_WORLD_CATALOG.slice(index+1,index+3);
   const run=()=>warm.forEach(item=>prime3D(item).catch(()=>{}));
   const idle=window.requestIdleCallback?window.requestIdleCallback(run,{timeout:2200}):window.setTimeout(run,900);
   return()=>{if(window.cancelIdleCallback&&typeof idle==='number')window.cancelIdleCallback(idle);else window.clearTimeout(idle)};
 },[selected?.id]);

 function warm(item){prime3D(item).catch(()=>{})}
 function choose(item,{top=false}={}){warm(item);setSelectedId(item.id);window.history.replaceState(null,'',selectUrl(item.id));if(top)window.scrollTo({top:0,behavior:'smooth'})}
 return <main className="cj-page">
   <header className="cj-header"><Link className="cj-brand" href="/">VOXEL <b>VAULT</b></Link><nav className="cj-nav"><Link href="/">Home</Link><a href="#catalog">Find</a><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link></nav><span className="cj-count">{REAL_WORLD_CATALOG.length} PRODUCTS</span></header>
   <section className="cj-hero"><div><div className="cj-kicker">REAL PRODUCTS · INTERACTIVE PREVIEWS BUILD AUTOMATICALLY</div><h1>Real products.<br/><em>Brought to life.</em></h1><p>Explore physical products as interactive objects. Voxel Vault starts likely previews early, keeps finished models available for return visits, and lets builds continue in the background while you are away.</p><div className="cj-trust"><span>{REAL_WORLD_CATALOG.length} products synced</span><span>multi-angle previews when available</span><span>{ready} live checkout</span><span>USD · no wallet to buy</span></div><div className="cj-explainer"><b>No customer verification step.</b><span>Voxel Vault handles matching and readiness internally. You browse, inspect the object, and buy only when the physical product and matching collectible are ready.</span></div></div>{selected&&<div className="cj-feature"><div className="cj-featureTop"><small>SELECTED OBJECT</small><b>{selectedState(selected)}</b></div><RealWorld3DNFT item={selected} hero/><div className="cj-featureFoot"><div><small>{selected.type}</small><strong>{selected.name}</strong><span>{isReady(selected)?'READY TO BUY':'INTERACTIVE PREVIEW · CHECKOUT OPENS WHEN READY'}</span></div><b>${selected.customerPriceUsd}</b></div><div className="cj-featureActions">{isReady(selected)?<Link className="cj-primary" href={`/marketplace?purchase=${encodeURIComponent(selected.purchaseAssetId)}`}>Buy with card</Link>:<span className="cj-locked">Checkout opens automatically when ready</span>}</div></div>}</section>
   <section id="catalog" className="cj-catalog"><div className="cj-sectionTitle"><div><small>PRODUCT INDEX</small><h2>Choose an object.</h2></div><p>{products.length} shown · likely previews start before selection and can finish in the background.</p></div><div className="cj-toolbar"><input className="cj-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products or categories…"/><select className="cj-select" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(value=><option key={value} value={value}>{value==='all'?'All categories':value}</option>)}</select><select className="cj-select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by readiness"><option value="all">All products</option><option value="ready">Ready to buy</option><option value="verified">Collectible approved</option><option value="pending">Preview building / review</option></select></div>
   {products.length?<div className="cj-grid">{products.map((item,index)=>{const state=modelState(item);const itemReady=isReady(item);const active=selected?.id===item.id;return <CJProductCard key={item.id} item={item} index={index} active={active} state={state} ready={itemReady} onWarm={()=>warm(item)} onSelect={()=>choose(item)} onOpen={()=>choose(item,{top:true})}/>})}</div>:<div className="cj-empty">No products match those filters.</div>}</section>
   <section className="cj-policy"><small>HOW IT WORKS</small><h2>Previews build in the background. Buying stays simple.</h2><p>Voxel Vault syncs product media, uses multiple reference angles when available, stores completed results for reuse, checks product accuracy internally, confirms fulfillment, and only then enables card checkout. If a generated object does not closely match the physical product, it stays a preview and is never promoted as the official collectible.</p><div className="cj-pipeline"><span>01 · PRODUCT SYNCED</span><i>→</i><span>02 · PREVIEW BUILT</span><i>→</i><span>03 · MATCH APPROVED</span><i>→</i><span>04 · FULFILLMENT READY</span><i>→</i><span>05 · BUY WITH CARD</span></div></section>
   <footer className="cj-footer"><span>VOXEL VAULT · REAL PRODUCTS / DIGITAL COLLECTIBLES</span><Link href="/">Home</Link><span>Products fulfilled through third-party supply partners</span></footer>
 </main>
}
