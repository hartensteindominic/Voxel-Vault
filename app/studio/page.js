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
function googleReturnUrl(){const target=new URL('/studio',window.location.origin);target.searchParams.set('auth','google');return target.toString()}
function readLocalVoxelsWithMints(){
 const records=readLocalVoxelRecords();if(typeof window==='undefined')return records;
 return records.map(record=>{
  if(record.payload?.mint?.tokenId)return record;
  try{
   const mint=JSON.parse(window.localStorage.getItem(`voxelflip:mint:${record.sessionId}`)||'null');
   if(!mint?.tokenId)return record;
   const updatedAt=new Date().toISOString();const payload={...record.payload,mint,updatedAt};
   try{window.localStorage.setItem(`voxelpop:${record.sessionId}`,JSON.stringify(payload))}catch{}
   return {...record,payload,updatedAt};
  }catch{return record}
 });
}

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
  setFlowId(id);setAttribution(attr);setVoxelRecords(readLocalVoxelsWithMints());track('studio_view',id,attr);
  const p=new URLSearchParams(window.location.search);if(p.get('checkout')==='cancelled')track('checkout_cancelled',id,attr);
 },[]);

 useEffect(()=>{
  let active=true;let subscription=null;
  async function apply(client,next){
   if(!active)return;setSession(next);const local=readLocalVoxelsWithMints();
   if(!next?.user){setVoxelRecords(current=>mergeVoxelRecords(current,local));return;}
   setAccountBusy(true);
   try{
    const cloud=await syncLocalVoxelsToAccount(client,next.user);
    if(!active)return;
    setVoxelRecords(mergeVoxelRecords(cloud,readLocalVoxelsWithMints()));
    setAccountStatus(`Google connected. My Voxels is synced for ${userName(next.user)}.`);
    setAccountReady(true);
    if(new URLSearchParams(window.location.search).get('auth')==='google'){
     window.history.replaceState({},'', '/studio#my-voxels');
     document.getElementById('my-voxels')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
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
   const local=readLocalVoxelsWithMints();setVoxelRecords(current=>mergeVoxelRecords(current,local));
   if(session?.user&&accountClient.current){try{const cloud=await syncLocalVoxelsToAccount(accountClient.current,session.user);setVoxelRecords(mergeVoxelRecords(cloud,readLocalVoxelsWithMints()))}catch{}}
  };
  window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)};
 },[session?.user?.id]);

 async function signInGoogle(){
  setAccountStatus('');setAccountBusy(true);
  try{
   const statusResponse=await fetch('/api/account/status',{cache:'no-store'});
   const providerStatus=await statusResponse.json().catch(()=>({}));
   if(!statusResponse.ok||!providerStatus?.supabaseConfigured)throw new Error('Google sign-in still needs the Voxel Vault Supabase public configuration.');
   if(providerStatus.googleProviderEnabled!==true)throw new Error('Google sign-in is connected to Supabase, but Google is not enabled there yet. In Supabase: Authentication → Providers → Google → Enable, add the Google OAuth Client ID and Secret, save, then tap Continue with Google again.');
   const client=accountClient.current||await getSupabaseBrowserAsync();accountClient.current=client;setAccountReady(true);
   const redirectTo=googleReturnUrl();
   try{localStorage.setItem('voxelpop:google:return','/studio?auth=google')}catch{}
   const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
   if(error)throw error;
  }catch(e){setAccountReady(false);setAccountStatus(e instanceof Error?e.message:'Could not start Google sign-in.');setAccountBusy(false)}
 }
 async function signOut(){setAccountBusy(true);try{const client=accountClient.current||await getSupabaseBrowserAsync();const {error}=await client.auth.signOut();if(error)throw error;setSession(null);setVoxelRecords(readLocalVoxelsWithMints());setAccountStatus('Signed out of Google. Your browser copies are still here.')}catch(e){setAccountStatus(e instanceof Error?e.message:'Could not sign out.')}finally{setAccountBusy(false)}}
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
  <nav className={styles.nav}>
   <Brand/>
   <div className={styles.navActions}><a href="#my-voxels">MY VOXELS{myVoxels.length?` · ${myVoxels.length}`:''}</a><span>$1.99</span></div>
  </nav>

  <section className={styles.shell}>
   <header className={styles.hero}>
    <p>3D VOXEL MAKER</p>
    <h1>Describe it.<br/><em>Make it 3D.</em></h1>
    <span>One idea → one downloadable 3D voxel.</span>
   </header>

   <section className={styles.createCard}>
    <label htmlFor="voxel-idea">What should we make?</label>
    <textarea id="voxel-idea" value={idea} onChange={e=>changeIdea(e.target.value)} maxLength={300}/>
    <div className={styles.createRow}><button type="button" className={styles.random} onClick={surprise}>RANDOM</button><button className={styles.create} onClick={create} disabled={busy}>{busy?'OPENING…':'CREATE · $1.99'}</button></div>
    <small>Includes the image + downloadable 3D GLB. One-time payment.</small>
    {error&&<p className={styles.error}>{error}</p>}
   </section>

   <section className={styles.accountCard}>
    <div><small>SAVE ACROSS DEVICES</small><b>{session?.user?'Google connected':'Keep your voxels'}</b><span>{session?.user?userName(session.user):'Use Google to see paid voxels on phone + desktop.'}</span></div>
    {session?.user?<div className={styles.accountActions}>{userAvatar(session.user)&&<img src={userAvatar(session.user)} alt="Google profile"/>}<button type="button" onClick={signOut} disabled={accountBusy}>SIGN OUT</button></div>:<button type="button" className={styles.google} onClick={signInGoogle} disabled={accountBusy}><span>G</span>{accountBusy?'CONNECTING…':'CONTINUE WITH GOOGLE'}</button>}
   </section>
   {accountStatus&&<div className={`${styles.accountStatus} ${accountReady===false?styles.accountError:''}`}>{accountStatus}</div>}

   <section id="my-voxels" className={styles.library}>
    <div className={styles.sectionHead}><div><small>MY VOXELS</small><h2>Your creations</h2></div><span>{myVoxels.length}</span></div>
    {myVoxels.length>0?<div className={styles.voxelGrid}>{myVoxels.map(voxel=>{
     const ready=voxel.meshStatus==='ready';const minted=voxel.mint?.tokenId?voxel.mint:null;
     const assetHref=`/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}`;const mintHref=`/voxelflip/mint?session_id=${encodeURIComponent(voxel.sessionId)}`;const href=minted?mintHref:assetHref;
     return <article className={styles.voxelCard} key={voxel.sessionId}>
      <img src={voxel.image} alt={voxel.name.replaceAll('-',' ')}/>
      <div><small>{minted?`VOXELFLIP #${minted.tokenId}`:ready?'3D READY':'PAID'}</small><b>{voxel.name.replaceAll('-',' ')}</b><a href={href}>{minted?'OPEN NFT':ready?'OPEN 3D':'CONTINUE'}</a>{minted?.openSeaUrl&&<a className={styles.openSea} href={minted.openSeaUrl} target="_blank" rel="noreferrer">OPENSEA ↗</a>}</div>
     </article>;
    })}</div>:<div className={styles.empty}>{session?.user?'Your paid voxels will appear here.':'Connect Google or create your first voxel.'}</div>}
   </section>

   <section className={styles.examples}>
    <div className={styles.sectionHead}><div><small>EXAMPLES</small><h2>Anything works</h2></div></div>
    <div>{examples.map(([src,name])=><figure key={src}><img src={src} alt={name}/><figcaption>{name}</figcaption></figure>)}</div>
   </section>
  </section>
 </main>
}