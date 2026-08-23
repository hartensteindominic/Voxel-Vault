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
function selectedState(item){const state=modelState(item);if(state==='verified')return'EXACT 3D APPROVED';if(state==='review')return'3D PREVIEW READY';return'3D BUILDING AUTOMATICALLY'}
function selectUrl(id){return `/marketplace?object=${encodeURIComponent(id)}`}

export default function MarketplacePage(){
 const[query,setQuery]=useState('');const[category,setCategory]=useState('all');const[status,setStatus]=useState('all');const[selectedId,setSelectedId]=useState(REAL_WORLD_CATALOG[0]?.id||'');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('object');if(id&&REAL_WORLD_CATALOG.some(item=>item.id===id))setSelectedId(id)},[]);
 const categories=useMemo(()=>['all',...new Set(REAL_WORLD_CATALOG.map(item=>item.type))],[]);
 const products=useMemo(()=>REAL_WORLD_CATALOG.filter(item=>{const haystack=`${item.name} ${item.type} ${item.sourceName} ${item.supplierSku}`.toLowerCase();const state=modelState(item);const statusMatch=status==='all'||(status==='ready'&&isReady(item))||(status==='verified'&&state==='verified')||(status==='pending'&&state!=='verified');return(!query||haystack.includes(query.toLowerCase()))&&(category==='all'||item.type===category)&&statusMatch}).sort((a,b)=>Number(isReady(b))-Number(isReady(a))||Number(modelState(b)==='verified')-Number(modelState(a)==='verified')),[query,category,status]);
 const selected=REAL_WORLD_CATALOG.find(item=>item.id===selectedId)||products[0]||REAL_WORLD_CATALOG[0];
 const verified=REAL_WORLD_CATALOG.filter(item=>modelState(item)==='verified').length;const ready=REAL_WORLD_CATALOG.filter(isReady).length;

 useEffect(()=>{
   if(!selected)return;
   prime3D(selected).catch(()=>{});
   const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
   if(connection?.saveData||/2g/.test(connection?.effectiveType||''))return;
   const index=REAL_WORLD_CATALOG.findIndex(item=>item.id===selected.id);
   const warm=REAL_WORLD_CATALOG.slice(index+1,index+3);
   const run=()=>warm.forEach(item=>prime3D(item).catch(()=>{}));
   const idle=window.requestIdleCallback?window.requestIdleCallback(run,{timeout:2500}):window.setTimeout(run,1200);
   return()=>{if(window.cancelIdleCallback&&typeof idle==='number')window.cancelIdleCallback(idle);else window.clearTimeout(idle)};
 },[selected?.id]);

 function warm(item){prime3D(item).catch(()=>{})}
 function choose(item,{top=false}={}){warm(item);setSelectedId(item.id);window.history.replaceState(null,'',selectUrl(item.id));if(top)window.scrollTo({top:0,behavior:'smooth'})}
 return <main className="cj-page">
   <header className="cj-header"><Link className="cj-brand" href="/">VOXEL <b>VAULT</b></Link><nav className="cj-nav"><Link href="/">Home</Link><a href="#catalog">Find</a><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link></nav><span className="cj-count">{REAL_WORLD_CATALOG.length} PRODUCTS</span></header>
   <section className="cj-hero"><div><div className="cj-kicker">REAL CJ PRODUCTS · 3D BUILDS IN THE BACKGROUND</div><h1>Real products.<br/><em>Now in 3D.</em></h1><p>Browse physical CJ products as interactive objects. Voxel Vault starts building likely 3D previews before you open them, reuses finished models, and keeps checkout simple: normal USD, real delivery, 3D collectible included.</p><div className="cj-trust"><span>{REAL_WORLD_CATALOG.length} CJ products synced</span><span>{verified} exact 3D approved</span><span>{ready} live checkout</span><span>USD · no wallet to buy</span></div><div className="cj-explainer"><b>No customer verification step.</b><span>Voxel Vault handles product matching and readiness internally. You just browse, open the 3D, and buy when the listing is ready.</span></div></div>{selected&&<div className="cj-feature"><div className="cj-featureTop"><small>SELECTED · {selected.supplierSku}</small><b>{selectedState(selected)}</b></div><RealWorld3DNFT item={selected} hero/><div className="cj-featureFoot"><div><small>{selected.type}</small><strong>{selected.name}</strong><span>{isReady(selected)?'READY TO BUY':'3D PREVIEW AVAILABLE · CHECKOUT OPENS WHEN READY'}</span></div><b>${selected.customerPriceUsd}</b></div><div className="cj-featureActions">{isReady(selected)?<Link className="cj-primary" href={`/marketplace?purchase=${encodeURIComponent(selected.purchaseAssetId)}`}>Buy with card</Link>:<span className="cj-locked">Checkout opens automatically when ready</span>}<a className="cj-secondary" href={selected.sourceUrl} target="_blank" rel="noreferrer">View CJ listing ↗</a></div></div>}</section>
   <section id="catalog" className="cj-catalog"><div className="cj-sectionTitle"><div><small>PRODUCT INDEX</small><h2>Choose an object.</h2></div><p>{products.length} shown · 3D previews begin warming before selection.</p></div><div className="cj-toolbar"><input className="cj-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product, category or SKU…"/><select className="cj-select" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(value=><option key={value} value={value}>{value==='all'?'All categories':value}</option>)}</select><select className="cj-select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by readiness"><option value="all">All products</option><option value="ready">Ready to buy</option><option value="verified">Exact 3D approved</option><option value="pending">3D building / review</option></select></div>
   {products.length?<div className="cj-grid">{products.map((item,index)=>{const state=modelState(item);const itemReady=isReady(item);const active=selected?.id===item.id;return <CJProductCard key={item.id} item={item} index={index} active={active} state={state} ready={itemReady} onWarm={()=>warm(item)} onSelect={()=>choose(item)} onOpen={()=>choose(item,{top:true})}/>})}</div>:<div className="cj-empty">No products match those filters.</div>}</section>
   <section className="cj-policy"><small>HOW IT WORKS</small><h2>3D starts early. Buying stays simple.</h2><p>Voxel Vault syncs CJ media, begins likely 3D jobs in the background, reuses generated models, checks product accuracy internally, confirms fulfillment, and then enables card checkout. The customer never has to run a verification workflow.</p><div className="cj-pipeline"><span>01 · CJ SYNCED</span><i>→</i><span>02 · 3D PREWARMED</span><i>→</i><span>03 · 3D APPROVED</span><i>→</i><span>04 · FULFILLMENT READY</span><i>→</i><span>05 · BUY WITH CARD</span></div></section>
   <footer className="cj-footer"><span>VOXEL VAULT · REAL PRODUCTS / 3D COLLECTIBLES</span><Link href="/">Home</Link><span>NO CRYPTO REQUIRED</span></footer>
 </main>
}
