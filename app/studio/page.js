'use client';
import {useEffect,useRef,useState} from 'react';
import CryptoCheckout from './CryptoCheckout';
import styles from './studio.module.css';

const examples=[
 ['/voxelpop/relic-chest.jpg','Relic Chest'],
 ['/voxelpop/rune-portal.jpg','Rune Portal'],
 ['/voxelpop/glowcap-lantern.jpg','Glowcap Lantern']
];
const flowStorageKey='voxelpopFlowId';
const voxelStoragePrefix='voxelpop:';

function Brand(){return <a href="/" className={styles.brand}><img src="/voxelpop/voxelpop-logo.svg" alt="VoxelPop" className={styles.brandLogo} width="96" height="96"/></a>}
function getAttribution(){const p=new URLSearchParams(window.location.search);return {source:p.get('utm_source')||'',medium:p.get('utm_medium')||'',campaign:p.get('utm_campaign')||'',content:p.get('utm_content')||''}}
function ensureFlowId(){let id=sessionStorage.getItem(flowStorageKey)||'';if(!/^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();sessionStorage.setItem(flowStorageKey,id)}return id}
function track(eventName,flowId,attribution,promptLength){if(!flowId)return;fetch('/api/creator-pack/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName,flowId,attribution,promptLength}),keepalive:true}).catch(()=>{})}
function loadMyVoxels(){
 const found=[];
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i)||'';
   if(!key.startsWith(voxelStoragePrefix))continue;
   const sessionId=key.slice(voxelStoragePrefix.length);
   if(!sessionId)continue;
   try{
    const parsed=JSON.parse(localStorage.getItem(key)||'{}');
    if(!parsed?.asset?.dataUrl)continue;
    const meshStatus=String(parsed?.mesh?.status||'idle');
    found.push({sessionId,name:String(parsed.asset.name||'Your voxel'),image:String(parsed.asset.dataUrl),meshStatus,taskId:String(parsed?.mesh?.taskId||'')});
   }catch{}
  }
 }catch{}
 return found.reverse();
}

export default function StudioPage(){
 const [idea,setIdea]=useState('Enchanted ruins');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [flowId,setFlowId]=useState('');
 const [attribution,setAttribution]=useState({source:'',medium:'',campaign:'',content:''});
 const [myVoxels,setMyVoxels]=useState([]);
 const promptTracked=useRef(false);
 useEffect(()=>{
  const id=ensureFlowId();const attr=getAttribution();setFlowId(id);setAttribution(attr);setMyVoxels(loadMyVoxels());track('studio_view',id,attr);
  const p=new URLSearchParams(window.location.search);if(p.get('checkout')==='cancelled')track('checkout_cancelled',id,attr);
  const refresh=()=>setMyVoxels(loadMyVoxels());window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)};
 },[]);
 function markPromptStarted(value,id=flowId,attr=attribution){if(promptTracked.current||value.trim().length<3||!id)return;promptTracked.current=true;track('prompt_started',id,attr,value.trim().length)}
 function changeIdea(value){setIdea(value);markPromptStarted(value)}
 function surprise(){const value=['Tiny cyberpunk ramen shop','Cute dragon barista','Haunted forest shrine','Space pirate captain'][Math.floor(Math.random()*4)];setIdea(value);markPromptStarted(value)}
 async function create(){
  if(idea.trim().length<3){setError('Describe what you want first.');return;}
  const id=flowId||ensureFlowId();if(!flowId)setFlowId(id);markPromptStarted(idea,id,attribution);track('checkout_clicked',id,attribution,idea.trim().length);setBusy(true);setError('');
  try{sessionStorage.setItem('voxelPackBrief',JSON.stringify({idea:idea.trim(),style:'polished'}));const r=await fetch('/api/creator-pack/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea:idea.trim().slice(0,180),style:'polished',flowId:id,attribution})});const d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Checkout unavailable');location.href=d.url;}
  catch(e){setError(e instanceof Error?e.message:'Checkout unavailable');setBusy(false)}
 }
 return <main className={styles.page}>
  <nav><Brand/><div className={styles.navActions}>{myVoxels.length>0&&<a href="#my-voxels" className={styles.vaultButton}>VAULT <span>{myVoxels.length}</span></a>}<span className={styles.price}>$1.99</span></div></nav>

  <header><p className={styles.kicker}>MAKE SOMETHING</p><h1>Imagine it.<br/><em>Voxel it.</em></h1><p className={styles.lead}>Type an idea. Get a downloadable 3D voxel.</p></header>

  <section className={styles.card}>
   <div className={styles.step}><span>1</span><div><small>YOUR IDEA</small><h2>What should we make?</h2></div></div>
   <div className={styles.input}><textarea aria-label="Describe your voxel" placeholder="A neon dragon, tiny cafe, game prop…" value={idea} onChange={e=>changeIdea(e.target.value)} maxLength={300}/><button type="button" onClick={surprise}>RANDOM</button></div>
   <div className={styles.quickFacts}><span>3D GLB</span><span>IMAGE</span><span>YOURS</span></div>
   <button className={styles.cta} aria-label="Create my voxel for $1.99" onClick={create} disabled={busy}>{busy?'OPENING…':'CREATE'}</button>
   <p className={styles.checkoutHint}>$1.99 · one-time · card checkout</p>
   <CryptoCheckout idea={idea} flowId={flowId} attribution={attribution}/>
   {error&&<p className={styles.error}>{error}</p>}
  </section>

  <section className={styles.preview}>
   <div className={styles.previewHead}><div><small>LOOK</small><h2>VoxelPop style</h2></div><span>DRAG ↓</span></div>
   <div className={styles.gallery}>{examples.map(([src,name],i)=><figure key={src}><b>0{i+1}</b><img src={src} alt={name}/><figcaption>{name}</figcaption></figure>)}</div>
  </section>

  {myVoxels.length>0&&<section id="my-voxels" className={styles.library}>
   <div className={styles.libraryHead}><div><small>VAULT</small><h2>Your voxels</h2></div><span>{myVoxels.length}</span></div>
   <div className={styles.libraryGrid}>{myVoxels.map(voxel=>{const ready=voxel.meshStatus==='ready';const href=`/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}${ready?'#voxelflip-mint':''}`;return <article key={voxel.sessionId} className={styles.voxelCard}><img src={voxel.image} alt={voxel.name.replaceAll('-',' ')}/><div><small>{ready?'3D READY':'PAID'}</small><h3>{voxel.name.replaceAll('-',' ')}</h3><a href={href} aria-label={`Open ${voxel.name}`}>OPEN</a></div></article>})}</div>
  </section>}

  <footer><Brand/><a href="/">HOME</a></footer>
 </main>
}
