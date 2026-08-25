'use client';

import {useEffect,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import styles from './autopilot.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function time(value){try{return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return ''}}
function eth(value){const n=Number(value);return Number.isFinite(n)?`${n.toLocaleString(undefined,{maximumFractionDigits:4})} ETH`:'—'}
function count(value,more=false){return Number.isFinite(Number(value))?`${Number(value)}${more?'+':''}`:'—'}

export default function VoxelFlipAutopilotPage(){
 const [wallet,setWallet]=useState('');
 const [tokenId,setTokenId]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [scanner,setScanner]=useState(null);
 const [busy,setBusy]=useState(false);
 const [autoScan,setAutoScan]=useState(true);
 const [error,setError]=useState('');

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const w=q.get('wallet')||'';
  setWallet(ADDRESS_RE.test(w)?w:'');
  setTokenId(q.get('tokenId')||'');
  setSessionId(q.get('session_id')||'');
 },[]);

 useEffect(()=>{
  if(!ADDRESS_RE.test(wallet)||!autoScan)return;
  runScan();
  const timer=setInterval(runScan,30000);
  return()=>clearInterval(timer);
 },[wallet,tokenId,autoScan]);

 async function connect(){
  setBusy(true);setError('');
  try{const result=await connectVoxelFlipWallet();setWallet(result.address)}
  catch(e){if(e?.code==='NO_WALLET_PROVIDER'&&e?.deepLink){location.href=e.deepLink;return}setError(e instanceof Error?e.message:'Wallet connection failed.')}
  finally{setBusy(false)}
 }

 async function runScan(){
  if(!ADDRESS_RE.test(wallet)||busy)return;
  setBusy(true);setError('');
  try{
   const q=new URLSearchParams({wallet});if(/^\d+$/.test(tokenId))q.set('tokenId',tokenId);
   const response=await fetch(`/api/voxelflip/trader?${q}`,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Autopilot scan failed.');
   setScanner(data);
  }catch(e){setError(e instanceof Error?e.message:'Autopilot scan failed.')}
  finally{setBusy(false)}
 }

 const watching=tokenId?`VoxelFlip #${tokenId}`:'your VoxelFlip wallet';
 const openSeaHref=scanner?.openSeaUrl||'https://opensea.io';
 const listed=scanner?.tokenListed===true?'LISTED':scanner?.tokenListed===false?'NOT LISTED':'—';
 const marketReady=scanner?.marketDataConfigured===true;

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>VOXELFLIP · AUTOPILOT</em></nav>

  <header className={styles.hero}>
   <p className={styles.eyebrow}>MONITORING MODE · NO AUTOMATIC SIGNING</p>
   <h1>Watching<br/><em>{watching}.</em></h1>
   <span>Autopilot watches OpenSea and Base for you. It cannot buy, sell, list, or sign transactions yet.</span>
  </header>

  <div className={styles.shell}>
   <section className={styles.panel}>
    <div className={styles.panelHead}>
     <div><small>LIVE MARKET MONITOR</small><h2>{tokenId?`VoxelFlip #${tokenId}`:'Connect your VoxelFlip'}</h2></div>
     <button className={`${styles.status} ${autoScan?styles.statusOn:''}`} onClick={()=>setAutoScan(v=>!v)}>{autoScan?'AUTO SCAN · ON':'AUTO SCAN · OFF'}</button>
    </div>

    {!wallet?<button className={styles.connect} onClick={connect} disabled={busy}>{busy?'Connecting…':'Connect Base wallet'}</button>:<div className={styles.wallet}><div><small>WATCH WALLET</small><b>{short(wallet)}</b></div><button onClick={runScan} disabled={busy}>{busy?'Scanning…':'Refresh now'}</button></div>}
    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.grid4}>
     <article className={styles.metric}><small>FLOOR PRICE</small><b>{eth(scanner?.collectionFloorEth)}</b></article>
     <article className={styles.metric}><small>ACTIVE LISTINGS</small><b>{count(scanner?.collectionListings,scanner?.collectionListingsMore)}</b></article>
     <article className={styles.metric}><small>24H SALES</small><b>{count(scanner?.sales24h,scanner?.sales24hMore)}</b></article>
     <article className={styles.metric}><small>YOUR VOXEL</small><b>{listed}</b></article>
    </div>

    {!scanner&&wallet&&<div className={styles.notice}>Waiting for the first market scan.</div>}
    {scanner&&!marketReady&&<div className={styles.notice}>OpenSea market data is not connected yet, so live floor, listings and sales are unavailable. Your VoxelFlip is still safe and no transaction can be sent from this page.</div>}
    {scanner&&marketReady&&!scanner.collectionSlug&&tokenId&&<div className={styles.notice}>OpenSea has not returned collection-level stats for this VoxelFlip yet. Autopilot will keep checking every 30 seconds.</div>}
    {scanner?.checkedAt&&<p className={styles.riskText}>Last checked {time(scanner.checkedAt)} · OpenSea data can lag behind on-chain activity.</p>}
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>WHAT YOU CAN DO NOW</small><h2>Watch it or sell manually.</h2></div><span className={styles.status}>AUTOPILOT TRADING · COMING SOON</span></div>
    <div className={styles.notice}>Automatic signing is OFF. Nothing on this page can spend ETH or list your NFT without you.</div>
    <div className={styles.actions}>
     <a href={openSeaHref} target="_blank" rel="noreferrer">List manually on OpenSea ↗</a>
     <a href={openSeaHref} target="_blank" rel="noreferrer">Open {tokenId?`VoxelFlip #${tokenId}`:'VoxelFlip'} ↗</a>
     <a href="/studio#my-voxels">My Voxels</a>
     {sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>Open minted 3D</a>}
    </div>
    <p className={styles.riskText}>Next development phase: a separately tested bounded executor with explicit spending limits and approvals. It is not active here.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href="/studio#my-voxels">← My Voxels</a><a href={openSeaHref} target="_blank" rel="noreferrer">OpenSea ↗</a></footer>
 </main>;
}
