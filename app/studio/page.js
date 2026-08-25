'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './studio.module.css';
import {getSupabaseBrowserAsync} from '../../lib/supabase-browser';
import {mergeVoxelRecords,readLocalVoxelRecords,summarizeVoxel,syncLocalVoxelsToAccount} from '../../lib/voxelpop-account';

const examples=[
 ['/voxelpop/relic-chest.jpg','Relic Chest'],
 ['/voxelpop/rune-portal.jpg','Rune Portal'],
 ['/voxelpop/glowcap-lantern.jpg','Glowcap Lantern']
];
const flowStorageKey='voxelpopFlowId';

function Brand(){return <a href="/" className={styles.brand}><img src="/voxelpop/voxelpop-logo.svg" alt="VoxelPop" className={styles.brandLogo} width="96" height="96"/></a>}
function getAttribution(){const p=new URLSearchParams(window.location.search);return {source:p.get('utm_source')||'',medium:p.get('utm_medium')||'',campaign:p.get('utm_campaign')||'',content:p.get('utm_content')||''}}
function ensureFlowId(){let id=sessionStorage.getItem(flowStorageKey)||'';if(!/^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();sessionStorage.setItem(flowStorageKey,id)}return id}
function track(eventName,flowId,attribution,promptLength){if(!flowId)return;fetch('/api/creator-pack/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName,flowId,attribution,promptLength}),keepalive:true}).catch(()=>{})}
function userName(user){return String(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||'Google account')}
function userAvatar(user){return String(user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'')}
function googleReturnUrl(){const target=new URL('/studio',window.location.origin);target.searchParams.set('auth','google');target.hash='my-voxels';return target.toString()}

export default function StudioPage(){
 const [idea,setIdea]=useState('Enchanted ruins');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [flowId,setFlowId]=useState('');
 const [attribution,setAttribution]=useState({source:'',medium:'',campaign:'',content:''});
 const [voxelRecords,setVoxelRecords]=useState([]);
 const [session,setSession]=useState(null);
 const [accountBusy,setAccountBusy]=useState(false);
 const [accountStatus,setAccountStatus]=useState('');
 const [accountReady,setAccountReady]=useState(null);
 const promptTracked=useRef(false);
 const accountClient=useRef(null);
 const myVoxels=voxelRecords.map(summarizeVoxel).filter(voxel=>voxel.image);

 useEffect(()=>{
  const id=ensureFlowId();const attr=getAttribution();
  setFlowId(id);setAttribution(attr);setVoxelRecords(readLocalVoxelRecords());track('studio_view',id,attr);
  const p=new URLSearchParams(window.location.search);if(p.get('checkout')==='cancelled')track('checkout_cancelled',id,attr);
 },[]);

 useEffect(()=>{
  let active=true;let subscription=null;
  async function apply(client,next){
   if(!active)return;setSession(next);
   if(!next?.user){setVoxelRecords(current=>mergeVoxelRecords(current,readLocalVoxelRecords()));return;}
   setAccountBusy(true);
   try{
    const cloud=await syncLocalVoxelsToAccount(client,next.user);
    if(!active)return;
    setVoxelRecords(mergeVoxelRecords(cloud,readLocalVoxelRecords()));
    setAccountStatus(`Google connected. My Voxels is synced for ${userName(next.user)}.`);
    setAccountReady(true);
    if(new URLSearchParams(window.location.search).get('auth')==='google')document.getElementById('my-voxels')?.scrollIntoView({behavior:'smooth',block:'start'});
   }catch(e){if(active)setAccountStatus(e instanceof Error?e.message:'Google account connected, but My Voxels could not sync.');}
   finally{if(active)setAccountBusy(false)}
  }
  getSupabaseBrowserAsync().then(async client=>{
   if(!active)return;accountClient.current=client;setAccountReady(true);
   const {data,error}=await client.auth.getSession();
   if(error&&active)setAccountStatus(error.message);else await apply(client,data.session);
   const auth=client.auth.onAuthStateChange((_event,next)=>{apply(client,next)});subscription=auth.data.subscription;
  }).catch(e=>{if(active){setAccountReady(false);setAccountStatus(e instanceof Error?e.message:'Google account setup is incomplete.')}});
  return()=>{active=false;subscription?.unsubscribe?.()};
 },[]);

 useEffect(()=>{
  const refresh=async()=>{
   const local=readLocalVoxelRecords();setVoxelRecords(current=>mergeVoxelRecords(current,local));
   if(session?.user&&accountClient.current){try{const cloud=await syncLocalVoxelsToAccount(accountClient.current,session.user);setVoxelRecords(mergeVoxelRecords(cloud,readLocalVoxelRecords()))}catch{}}
  };
  window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)};
 },[session?.user?.id]);

 async function signInGoogle(){
  setAccountStatus('');setAccountBusy(true);
  try{
   const client=accountClient.current||await getSupabaseBrowserAsync();accountClient.current=client;setAccountReady(true);
   const redirectTo=googleReturnUrl();
   try{localStorage.setItem('voxelpop:google:return','/studio?auth=google#my-voxels')}catch{}
   const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
   if(error)throw error;
  }catch(e){setAccountReady(false);setAccountStatus(e instanceof Error?e.message:'Could not start Google sign-in.');setAccountBusy(false)}
 }
 async function signOut(){setAccountBusy(true);try{const client=accountClient.current||await getSupabaseBrowserAsync();const {error}=await client.auth.signOut();if(error)throw error;setSession(null);setVoxelRecords(readLocalVoxelRecords());setAccountStatus('Signed out of Google. Your browser copies are still here.')}catch(e){setAccountStatus(e instanceof Error?e.message:'Could not sign out.')}finally{setAccountBusy(false)}}
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
    <a href="#my-voxels" style={{textDecoration:'none',border:'1px solid rgba(17,24,39,.08)',borderRadius:999,padding:'9px 14px',fontWeight:800,color:'#111827',background:'#fff',boxShadow:'0 8px 24px rgba(15,23,42,.08)'}}>My Voxels{myVoxels.length?` · ${myVoxels.length}`:''}</a>
    <span className={styles.price}><i/>$1.99 per 3D asset</span>
   </div>
  </nav>

  <header>
   <p className={styles.kicker}>✦ YOUR IDEA, MADE 3D ✦</p>
   <h1>Your idea.<br/><em>Built in voxels.</em></h1>
   <p className={styles.lead}>Type absolutely anything. See the voxel style, then create one real 3D asset for only $1.99.</p>
  </header>

  <section id="my-voxels" style={{maxWidth:980,margin:'14px auto 28px',padding:'24px',border:'1px solid #e5e7eb',borderRadius:24,background:'#fff',color:'#111827',boxShadow:'0 18px 50px rgba(15,23,42,.10)',scrollMarginTop:20}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:16}}>
    <div><small style={{fontWeight:900,letterSpacing:'.14em',color:'#6b7280'}}>MY VOXELS · PHONE + DESKTOP</small><h2 style={{margin:'5px 0 0',fontSize:'clamp(1.55rem,4vw,2.35rem)',color:'#111827'}}>Your paid creations</h2></div>
    {session?.user?<div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',border:'1px solid #dbeafe',borderRadius:14,padding:'10px 12px',background:'#eff6ff'}}>
      {userAvatar(session.user)?<img src={userAvatar(session.user)} alt="Google profile" style={{width:32,height:32,borderRadius:'50%'}}/>:<span aria-hidden="true" style={{width:32,height:32,borderRadius:'50%',display:'grid',placeItems:'center',background:'#fff',border:'1px solid #bfdbfe',fontWeight:900,color:'#2563eb'}}>G</span>}
      <div><b style={{display:'block',fontSize:14,color:'#111827'}}>Google connected</b><small style={{color:'#475569'}}>{userName(session.user)}</small></div>
      <button type="button" onClick={signOut} disabled={accountBusy} style={{border:'1px solid #cbd5e1',borderRadius:10,padding:'7px 10px',background:'#fff',color:'#334155',fontWeight:800,cursor:'pointer'}}>Sign out</button>
     </div>:<button type="button" onClick={signInGoogle} disabled={accountBusy} style={{display:'flex',alignItems:'center',gap:10,border:'1px solid #d1d5db',borderRadius:14,padding:'10px 14px',background:'#fff',color:'#111827',boxShadow:'0 6px 18px rgba(15,23,42,.08)',fontWeight:900,cursor:accountBusy?'wait':'pointer'}}>
      <span aria-hidden="true" style={{width:28,height:28,borderRadius:'50%',display:'grid',placeItems:'center',background:'#fff',border:'1px solid #e5e7eb',fontWeight:900,color:'#2563eb'}}>G</span>
      {accountBusy?'Connecting…':'Continue with Google'}
     </button>}
   </div>
   {accountStatus&&<div role="status" style={{margin:'0 0 16px',padding:'10px 12px',borderRadius:12,background:accountReady===false?'#fff7ed':'#f8fafc',border:`1px solid ${accountReady===false?'#fed7aa':'#e5e7eb'}`,fontSize:13,color:accountReady===false?'#9a3412':'#475569'}}>{accountStatus}</div>}
   {myVoxels.length>0?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14}}>
    {myVoxels.map(voxel=>{
     const ready=voxel.meshStatus==='ready';
     const href=`/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}`;
     return <article key={voxel.sessionId} style={{overflow:'hidden',borderRadius:18,border:'1px solid #e5e7eb',background:'#f8fafc'}}>
      <img src={voxel.image} alt={voxel.name.replaceAll('-',' ')} style={{width:'100%',height:190,display:'block',objectFit:'cover',background:'#f3f4f6'}}/>
      <div style={{padding:14}}>
       <small style={{fontWeight:900,letterSpacing:'.08em',color:'#6b7280'}}>{ready?'3D READY':'PAID VOXEL'}</small>
       <h3 style={{margin:'5px 0 12px',fontSize:18,textTransform:'capitalize',color:'#111827'}}>{voxel.name.replaceAll('-',' ')}</h3>
       <a href={href} style={{display:'block',textAlign:'center',textDecoration:'none',padding:'11px 12px',borderRadius:12,fontWeight:900,background:'#111827',color:'#fff'}}>{ready?'Open 3D voxel':'Continue voxel'}</a>
      </div>
     </article>;
    })}
   </div>:<div style={{padding:'24px 18px',border:'1px dashed #d1d5db',borderRadius:16,textAlign:'center',background:'#f8fafc'}}><b style={{display:'block',fontSize:18,marginBottom:5,color:'#111827'}}>Your library is ready.</b><span style={{color:'#6b7280'}}>{session?.user?'Paid voxels saved to this Google account will appear here on every device.':'Continue with Google to make My Voxels follow you from your computer to your phone.'}</span></div>}
  </section>

  <section className={styles.card}>
   <div className={styles.step}><span>1</span><div><h2>Describe anything</h2><p>If you can type it, VoxelPop can voxel it.</p></div></div>
   <div className={styles.input}><textarea value={idea} onChange={e=>changeIdea(e.target.value)} maxLength={300}/><button onClick={surprise}>✦ Surprise me</button></div>
   <div className={styles.checks}><span>✓ <b>One custom voxel</b></span><span>✓ <b>One-time $1.99 payment</b></span><span>✓ <b>3D GLB + image</b></span></div>
   <button className={styles.cta} onClick={create} disabled={busy}>✦ {busy?'Opening checkout…':'Create my voxel · $1.99'}</button>
   <small>{session?.user?'Signed in · paid creations sync to My Voxels across devices':'Sign in with Google above to keep paid creations in My Voxels across devices'}</small>{error&&<p className={styles.error}>{error}</p>}
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
