'use client';
import {useEffect,useRef,useState} from 'react';
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
    found.push({sessionId,name:String(parsed.asset.name||'Your voxel'),image:String(parsed.asset.dataUrl),meshStatus:String(parsed?.mesh?.status||'idle')});
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
  const id=ensureFlowId();const attr=getAttribution();
  setFlowId(id);setAttribution(attr);setMyVoxels(loadMyVoxels());track('studio_view',id,attr);
  const p=new URLSearchParams(window.location.search);if(p.get('checkout')==='cancelled')track('checkout_cancelled',id,attr);
  const refresh=()=>setMyVoxels(loadMyVoxels());
  window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)};
 },[]);
 function markPromptStarted(value,id=flowId,attr=attribution){if(promptTracked.current||value.trim().length<3||!id)return;promptTracked.current=true;track('prompt_started',id,attr,value.trim().length)}
 function changeIdea(value){setIdea(value);markPromptStarted(value)}
 function surprise(){const value=['Tiny cyberpunk ramen shop','Cute dragon barista','Haunted forest shrine','Space pirate captain'][Math.floor(Math.random()*4)];setIdea(value);markPromptStarted(value)}
 async function create(){
  if(idea.trim().length<3){setError('Describe what you want first.');return;}
  const id=flowId||ensureFlowId();if(!flowId)setFlowId(id);markPromptStarted(idea,id,attribution);track('checkout_clicked',id,attribution,idea.trim().length);
  setBusy(true);setError('');
  try{
   sessionStorage.setItem('voxelPackBrief',JSON.stringify({idea:idea.trim(),style:'polished'}));
   const r=await fetch('/api/creator-pack/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea:idea.trim().slice(0,180),style:'polished',flowId:id,attribution})});
   const d=await r.json(); if(!r.ok||!d.url) throw new Error(d.error||'Checkout unavailable'); location.href=d.url;
  }catch(e){setError(e instanceof Error?e.message:'Checkout unavailable');setBusy(false)}
 }
 return <main className={styles.page}>
  <nav>
   <Brand/>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}>
    <a href="#my-voxels" style={{textDecoration:'none',border:'1px solid rgba(255,255,255,.16)',borderRadius:999,padding:'9px 14px',fontWeight:800,color:'inherit',background:'rgba(255,255,255,.06)'}}>My Voxels{myVoxels.length?` · ${myVoxels.length}`:''}</a>
    <span className={styles.price}><i/>$1.99 per 3D asset</span>
   </div>
  </nav>

  <section id="my-voxels" style={{maxWidth:980,margin:'22px auto 8px',padding:'22px',border:'1px solid rgba(255,255,255,.14)',borderRadius:24,background:'rgba(10,12,20,.72)',boxShadow:'0 18px 60px rgba(0,0,0,.22)'}}>
   <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:16}}>
    <div><small style={{fontWeight:900,letterSpacing:'.14em',opacity:.72}}>MY VOXELS</small><h2 style={{margin:'5px 0 0',fontSize:'clamp(1.55rem,4vw,2.35rem)'}}>Your paid creations</h2></div>
    <span style={{fontSize:13,opacity:.72}}>Account-style library · Google sync next</span>
   </div>
   {myVoxels.length>0?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14}}>
    {myVoxels.map(voxel=>{
     const ready=voxel.meshStatus==='ready';
     const href=`/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}`;
     return <article key={voxel.sessionId} style={{overflow:'hidden',borderRadius:18,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.045)'}}>
      <img src={voxel.image} alt={voxel.name.replaceAll('-',' ')} style={{width:'100%',height:190,display:'block',objectFit:'cover',background:'#111'}}/>
      <div style={{padding:14}}>
       <small style={{fontWeight:900,letterSpacing:'.08em',opacity:.65}}>{ready?'3D READY':'PAID VOXEL'}</small>
       <h3 style={{margin:'5px 0 12px',fontSize:18,textTransform:'capitalize'}}>{voxel.name.replaceAll('-',' ')}</h3>
       <a href={href} style={{display:'block',textAlign:'center',textDecoration:'none',padding:'11px 12px',borderRadius:12,fontWeight:900,background:'#fff',color:'#111'}}>{ready?'Open 3D voxel':'Continue voxel'}</a>
      </div>
     </article>;
    })}
   </div>:<div style={{padding:'24px 18px',border:'1px dashed rgba(255,255,255,.18)',borderRadius:16,textAlign:'center',background:'rgba(255,255,255,.025)'}}><b style={{display:'block',fontSize:18,marginBottom:5}}>Your library is ready.</b><span style={{opacity:.72}}>After you create a paid voxel on VoxelPop, it will appear here automatically on this browser.</span></div>}
  </section>

  <header>
   <p className={styles.kicker}>✦ YOUR IDEA, MADE 3D ✦</p>
   <h1>Your idea.<br/><em>Built in voxels.</em></h1>
   <p className={styles.lead}>Type absolutely anything. See the voxel style, then create one real 3D asset for only $1.99.</p>
  </header>
  <section className={styles.card}>
   <div className={styles.step}><span>1</span><div><h2>Describe anything</h2><p>If you can type it, VoxelPop can voxel it.</p></div></div>
   <div className={styles.input}><textarea value={idea} onChange={e=>changeIdea(e.target.value)} maxLength={300}/><button onClick={surprise}>✦ Surprise me</button></div>
   <div className={styles.checks}><span>✓ <b>One custom voxel</b></span><span>✓ <b>One-time $1.99 payment</b></span><span>✓ <b>3D GLB + image</b></span></div>
   <button className={styles.cta} onClick={create} disabled={busy}>✦ {busy?'Opening checkout…':'Create my voxel · $1.99'}</button>
   <small>Paid creations return to My Voxels on this browser · Google account sync comes next</small>{error&&<p className={styles.error}>{error}</p>}
  </section>
  <section className={styles.preview}>
   <div className={styles.previewHead}><div><small>STYLE PREVIEW</small><h2>{idea||'Your idea'}</h2></div><span>● EXAMPLES</span></div>
   <div className={styles.gallery}>{examples.map(([src,name],i)=><figure key={src}><b>0{i+1}</b><img src={src} alt={name}/><figcaption>{name}</figcaption></figure>)}</div>
   <div className={styles.empty}>{myVoxels.length?'✦ Your paid voxels are saved in My Voxels above.':'✦ Your paid voxel will appear in My Voxels after checkout.'}</div>
  </section>
  <section className={styles.facts}><div><b>Anything</b><span>prompted into voxels</span></div><div><b>1 voxel</b><span>created after payment</span></div><div><b>Real 3D</b><span>rotate, zoom & move</span></div><div><b>$1.99</b><span>one-time, per asset</span></div></section>
  <footer><Brand/><p>One idea. One payment.<br/>One voxel you own.</p></footer>
 </main>
}
