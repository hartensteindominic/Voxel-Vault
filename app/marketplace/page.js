'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from '../components/RealWorld3DNFT';
import CJProductCard from '../components/CJProductCard';
import '../components/CJMarketplace.css';
import '../components/CJMarketplaceCards.css';

function modelState(item){const model=item.modelUri||item.digitalTwin?.modelUrl;if(model&&item.digitalTwin?.exactModelVerified)return'verified';if(model)return'review';return'pending'}
function isReady(item){return Boolean(item.fulfillmentReady&&item.purchaseAssetId&&modelState(item)==='verified')}
function selectUrl(id){return `/marketplace?object=${encodeURIComponent(id)}`}

export default function MarketplacePage(){
 const[query,setQuery]=useState('');const[category,setCategory]=useState('all');const[status,setStatus]=useState('all');const[selectedId,setSelectedId]=useState(REAL_WORLD_CATALOG[0]?.id||'');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('object');if(id&&REAL_WORLD_CATALOG.some(item=>item.id===id))setSelectedId(id)},[]);
 const categories=useMemo(()=>['all',...new Set(REAL_WORLD_CATALOG.map(item=>item.type))],[]);
 const products=useMemo(()=>REAL_WORLD_CATALOG.filter(item=>{const haystack=`${item.name} ${item.type} ${item.sourceName} ${item.supplierSku}`.toLowerCase();const state=modelState(item);const statusMatch=status==='all'||(status==='ready'&&isReady(item))||(status==='verified'&&state==='verified')||(status==='pending'&&state!=='verified');return(!query||haystack.includes(query.toLowerCase()))&&(category==='all'||item.type===category)&&statusMatch}).sort((a,b)=>Number(isReady(b))-Number(isReady(a))||Number(modelState(b)==='verified')-Number(modelState(a)==='verified')),[query,category,status]);
 const selected=REAL_WORLD_CATALOG.find(item=>item.id===selectedId)||products[0]||REAL_WORLD_CATALOG[0];
 const verified=REAL_WORLD_CATALOG.filter(item=>modelState(item)==='verified').length;const ready=REAL_WORLD_CATALOG.filter(isReady).length;
 function choose(item,{top=false}={}){setSelectedId(item.id);window.history.replaceState(null,'',selectUrl(item.id));if(top)window.scrollTo({top:0,behavior:'smooth'})}
 return <main className="cj-page">
   <header className="cj-header"><Link className="cj-brand" href="/">VOXEL <b>VAULT</b></Link><nav className="cj-nav"><Link href="/">Home</Link><a href="#catalog">Find</a><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link></nav><span className="cj-count">{REAL_WORLD_CATALOG.length} OBJECTS</span></header>
   <section className="cj-hero"><div><div className="cj-kicker">PHYSICAL PRODUCTS · VERIFIED 3D WHEN READY</div><h1>Find the product.<br/><em>Inspect the object.</em></h1><p>Every listing maps to a real CJ-sourced product. Browse everything now; exact interactive 3D and checkout unlock only after that specific product passes media and fulfillment verification.</p><div className="cj-trust"><span>{REAL_WORLD_CATALOG.length} CJ mapped</span><span>{verified} exact 3D verified</span><span>{ready} checkout ready</span><span>USD · no wallet to buy</span></div></div>{selected&&<div className="cj-feature"><div className="cj-featureTop"><small>SELECTED · {selected.supplierSku}</small><b>{modelState(selected)==='verified'?'3D VERIFIED':modelState(selected)==='review'?'3D REVIEW':'ACCURACY PENDING'}</b></div><RealWorld3DNFT item={selected} hero/><div className="cj-featureFoot"><div><small>{selected.type}</small><strong>{selected.name}</strong><span>{isReady(selected)?'READY TO BUY':'PREVIEW ONLY · CHECKOUT LOCKED'}</span></div><b>${selected.customerPriceUsd}</b></div><div className="cj-featureActions">{isReady(selected)?<Link className="cj-primary" href={`/marketplace?purchase=${encodeURIComponent(selected.purchaseAssetId)}`}>Buy with card</Link>:<span className="cj-locked">Checkout opens after verification</span>}<a className="cj-secondary" href={selected.sourceUrl} target="_blank" rel="noreferrer">View CJ product ↗</a></div></div>}</section>
   <section id="catalog" className="cj-catalog"><div className="cj-sectionTitle"><div><small>OBJECT INDEX</small><h2>Browse without the noise.</h2></div><p>{products.length} shown · open any object in the verified viewer above.</p></div><div className="cj-toolbar"><input className="cj-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product, category or SKU…"/><select className="cj-select" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(value=><option key={value} value={value}>{value==='all'?'All categories':value}</option>)}</select><select className="cj-select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by readiness"><option value="all">All readiness states</option><option value="ready">Checkout ready</option><option value="verified">3D verified</option><option value="pending">3D pending / review</option></select></div>
   {products.length?<div className="cj-grid">{products.map((item,index)=>{const state=modelState(item);const itemReady=isReady(item);const active=selected?.id===item.id;return <CJProductCard key={item.id} item={item} index={index} active={active} state={state} ready={itemReady} onSelect={()=>choose(item)} onOpen={()=>choose(item,{top:true})}/>})}</div>:<div className="cj-empty">No products match those filters.</div>}</section>
   <section className="cj-policy"><small>THE VOXEL RULE</small><h2>Browse broadly. Verify precisely.</h2><p>Supplier mapping, product media, exact 3D, fulfillment readiness, and checkout eligibility remain separate states. That lets the catalog scale without pretending unfinished media is ready.</p><div className="cj-pipeline"><span>01 · CJ MAPPED</span><i>→</i><span>02 · MEDIA VERIFIED</span><i>→</i><span>03 · 3D VERIFIED</span><i>→</i><span>04 · CHECKOUT READY</span></div></section>
   <footer className="cj-footer"><span>VOXEL VAULT · REAL PRODUCTS / 3D COLLECTIBLES</span><Link href="/">Home</Link><span>NO CRYPTO REQUIRED</span></footer>
 </main>
}
