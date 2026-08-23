'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from '../components/RealWorld3DNFT';
import { prime3D } from '../components/threeDSync';
import '../components/CJMarketplace.css';

function liveFor(map,item){return map[item.id]||null}
function modelState(item,live){if(live?.exactModelApproved)return'verified';if(live?.modelUrl||live?.thumbnailUrl)return'review';const model=item.modelUri||item.digitalTwin?.modelUrl;if(model&&item.digitalTwin?.exactModelVerified)return'verified';if(model)return'review';return'pending'}
function isReady(item,live){return Boolean(item.fulfillmentReady&&item.purchaseAssetId&&modelState(item,live)==='verified')}
function selectUrl(id){return `/marketplace?object=${encodeURIComponent(id)}`}
function runtimeItem(item,live){if(!item||!live?.modelUrl)return item;return {...item,modelUri:live.modelUrl,digitalTwin:{...(item.digitalTwin||{}),modelUrl:live.modelUrl,exactModelVerified:Boolean(live.exactModelApproved)}}}
function shortState(item,live){const s=modelState(item,live);if(isReady(item,live))return'Ready';if(s==='verified')return'Approved';if(s==='review')return'Preview ready';if(Number(live?.progress||0)>0)return`${Math.round(Number(live.progress))}%`;return'Preparing'}

export default function MarketplacePage(){
 const[query,setQuery]=useState('');
 const[selectedId,setSelectedId]=useState(REAL_WORLD_CATALOG[0]?.id||'');
 const[liveModels,setLiveModels]=useState({});
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('object');if(id&&REAL_WORLD_CATALOG.some(item=>item.id===id))setSelectedId(id)},[]);
 useEffect(()=>{let active=true;let timer;const sync=async()=>{try{const response=await fetch('/api/catalog-3d',{cache:'no-store'});const data=await response.json().catch(()=>null);if(active&&Array.isArray(data?.items))setLiveModels(Object.fromEntries(data.items.map(row=>[row.itemId,row])))}catch{};if(active)timer=window.setTimeout(sync,6000)};sync();return()=>{active=false;if(timer)window.clearTimeout(timer)}},[]);

 const products=useMemo(()=>REAL_WORLD_CATALOG.filter(item=>!query||`${item.name} ${item.type}`.toLowerCase().includes(query.toLowerCase())),[query]);
 const selectedBase=REAL_WORLD_CATALOG.find(item=>item.id===selectedId)||products[0]||REAL_WORLD_CATALOG[0];
 const selectedLive=selectedBase?liveFor(liveModels,selectedBase):null;
 const selected=runtimeItem(selectedBase,selectedLive);
 const selectedReady=selectedBase?isReady(selectedBase,selectedLive):false;
 const selectedStatus=selectedBase?shortState(selectedBase,selectedLive):'';

 useEffect(()=>{if(!selectedBase)return;prime3D(selectedBase).catch(()=>{});const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(connection?.saveData||/2g/.test(connection?.effectiveType||''))return;const index=REAL_WORLD_CATALOG.findIndex(item=>item.id===selectedBase.id);const next=REAL_WORLD_CATALOG.slice(index+1,index+3);const run=()=>next.forEach(item=>prime3D(item).catch(()=>{}));const idle=window.requestIdleCallback?window.requestIdleCallback(run,{timeout:1800}):window.setTimeout(run,700);return()=>{if(window.cancelIdleCallback&&typeof idle==='number')window.cancelIdleCallback(idle);else window.clearTimeout(idle)}},[selectedBase?.id]);

 function choose(item){prime3D(item).catch(()=>{});setSelectedId(item.id);window.history.replaceState(null,'',selectUrl(item.id));window.scrollTo({top:0,behavior:'smooth'})}

 return <main className="cj-page">
   <header className="cj-header">
     <Link className="cj-brand" href="/">VOXEL <b>VAULT</b></Link>
     <nav className="cj-nav"><Link href="/">Home</Link><a href="#collection">Shop</a><Link href="/vault">Vault</Link></nav>
     <Link className="cj-bag" href="/vault">My Vault</Link>
   </header>

   <section className="cj-showcase">
     <div className="cj-copy">
       <span className="cj-overline">PHYSICAL OBJECT + DIGITAL COLLECTIBLE</span>
       <h1>Own the object.<br/><em>Keep the story.</em></h1>
       <p>Useful physical products paired with a digital collectible. Pay normally, get the real product delivered, and keep the matching object in Voxel Vault.</p>
       <div className="cj-actionsTop"><a href="#collection" className="cj-mainCta">Browse collection</a><a href="#how" className="cj-quietCta">How it works</a></div>
       <div className="cj-proof"><span>USD checkout</span><span>Home delivery</span><span>Collectible included</span></div>
     </div>

     {selected&&<div className="cj-stageWrap">
       <div className="cj-stageHead"><span>{selected.type}</span><b>{selectedStatus}</b></div>
       <div className="cj-stage"><RealWorld3DNFT item={selected} hero/></div>
       <div className="cj-stageInfo"><div><h2>{selected.name}</h2><p>Physical product + digital collectible</p></div><strong>${selected.customerPriceUsd}</strong></div>
       {selectedReady?<Link className="cj-buy" href={`/marketplace?purchase=${encodeURIComponent(selected.purchaseAssetId)}`}>Buy with card</Link>:<div className="cj-soon">Coming soon <span>· preview and fulfillment checks finish automatically</span></div>}
       <small className="cj-disclosure">Fulfilled through a third-party product partner.</small>
     </div>}
   </section>

   <section id="collection" className="cj-collection">
     <div className="cj-collectionHead"><div><span>THE COLLECTION</span><h2>Pick what you want.</h2></div><div className="cj-searchWrap"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search objects"/><b>{products.length}</b></div></div>
     <div className="cj-rail">{products.map((item,index)=>{const live=liveFor(liveModels,item);const state=modelState(item,live);const active=item.id===selectedBase?.id;const thumbnail=live?.thumbnailUrl||'';return <button key={item.id} className={`cj-product ${active?'active':''}`} onMouseEnter={()=>prime3D(item).catch(()=>{})} onFocus={()=>prime3D(item).catch(()=>{})} onTouchStart={()=>prime3D(item).catch(()=>{})} onClick={()=>choose(item)}>
       <div className="cj-productVisual">{thumbnail?<img src={thumbnail} alt=""/>:<div className="cj-placeholder"><span>◆</span></div>}<small>{state==='verified'?'APPROVED':state==='review'?'PREVIEW READY':Number(live?.progress||0)>0?`${Math.round(Number(live.progress))}%`:'SOON'}</small></div>
       <div className="cj-productText"><span>{String(index+1).padStart(2,'0')} · {item.type}</span><h3>{item.name}</h3><div><strong>${item.customerPriceUsd}</strong><i>View</i></div></div>
     </button>})}</div>
   </section>

   <section id="how" className="cj-story">
     <div><span>HOW IT WORKS</span><h2>Simple on purpose.</h2><p>You shop like any normal store. Voxel Vault handles the technical layer in the background.</p></div>
     <ol><li><b>01</b><strong>Choose</strong><p>Browse the physical products and previews.</p></li><li><b>02</b><strong>Pay</strong><p>Use normal USD card checkout when the product is ready.</p></li><li><b>03</b><strong>Receive</strong><p>The real item ships to your home.</p></li><li><b>04</b><strong>Keep</strong><p>Your digital collectible lives in Voxel Vault.</p></li></ol>
   </section>

   <footer className="cj-footer"><Link href="/">VOXEL VAULT</Link><span>Real products. Digital collectibles.</span><small>Products are fulfilled through third-party supply partners.</small></footer>
 </main>
}
