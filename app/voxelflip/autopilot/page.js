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

 const openSeaHref=scanner?.openSeaUrl||'https://opensea.io';
 const listed=scanner?.tokenListed===true?'LISTED':scanner?.tokenListed===false?'NOT LISTED':'—';
 const marketReady=scanner?.marketDataConfigured===true;
 const factoryQuery=new URLSearchParams();if(wallet)factoryQuery.set('wallet',wallet);if(tokenId)factoryQuery.set('tokenId',tokenId);if(sessionId)factoryQuery.set('session_id',sessionId);const factoryHref=`/voxelflip/factory${factoryQuery.toString()?`?${factoryQuery}`:''}`;
 const forgeQuery=new URLSearchParams();if(wallet)forgeQuery.set('wallet',wallet);if(tokenId)forgeQuery.set('tokenId',tokenId);const forgeHref=`/forge${forgeQuery.toString()?`?${forgeQuery}`:''}`;

 return <main className={styles.page}>
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>AUTOPILOT</em>
  </nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>LIVE MONITOR</p>
    <h1>{tokenId?`VoxelFlip #${tokenId}`:'VoxelFlip'}</h1>
    <span>Watch the market. You approve every action.</span>
   </header>

   <section className={styles.dashboard}>
    <div className={styles.controls}>
     {!wallet?
      <button className={styles.connect} onClick={connect} disabled={busy}>{busy?'CONNECTING…':'CONNECT WALLET'}</button>:
      <div className={styles.wallet}>
       <div><small>BASE WALLET</small><b>{short(wallet)}</b></div>
       <button onClick={runScan} disabled={busy}>{busy?'SCANNING…':'REFRESH'}</button>
      </div>}
     <button className={`${styles.autoButton} ${autoScan?styles.autoOn:''}`} onClick={()=>setAutoScan(v=>!v)}>AUTO {autoScan?'ON':'OFF'}</button>
    </div>

    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.metrics}>
     <article><small>FLOOR</small><b>{eth(scanner?.collectionFloorEth)}</b></article>
     <article><small>LISTINGS</small><b>{count(scanner?.collectionListings,scanner?.collectionListingsMore)}</b></article>
     <article><small>24H SALES</small><b>{count(scanner?.sales24h,scanner?.sales24hMore)}</b></article>
     <article><small>YOUR NFT</small><b>{listed}</b></article>
    </div>

    {!scanner&&wallet&&<div className={styles.notice}>Waiting for the first market scan.</div>}
    {scanner&&!marketReady&&<div className={styles.notice}>OpenSea market data is not connected yet. Your VoxelFlip is still safe and this page cannot send a transaction.</div>}
    {scanner&&marketReady&&!scanner.collectionSlug&&tokenId&&<div className={styles.notice}>OpenSea has not returned collection stats yet. Auto Scan will keep checking every 30 seconds.</div>}
    {scanner?.checkedAt&&<p className={styles.checked}>Checked {time(scanner.checkedAt)} · OpenSea data can lag behind Base.</p>}

    <div className={styles.divider}/>

    <div className={styles.actionHead}>
     <div><small>YOUR NFT</small><h2>What do you want to do?</h2></div>
     <span>YOU APPROVE</span>
    </div>

    <div className={styles.safety}>
     <b>You’re in control.</b>
     <span>Your wallet must approve every listing or ETH transaction.</span>
    </div>

    <div className={styles.actions}>
     <a className={styles.primary} href={openSeaHref} target="_blank" rel="noreferrer">LIST ON OPENSEA ↗</a>
     <a href={openSeaHref} target="_blank" rel="noreferrer">VIEW NFT ↗</a>
     {sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>OPEN 3D</a>}
     <a href={forgeHref}>THE FORGE</a>
     <a href={factoryHref}>SALES & PROFIT</a>
     <a href="/studio#my-voxels">MY VOXELS</a>
    </div>

    <p className={styles.finePrint}>Sales & Profit tracks completed sales and your reinvestment limits. It cannot spend or list for you.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href="/studio#my-voxels">← MY VOXELS</a><a href={openSeaHref} target="_blank" rel="noreferrer">OPENSEA ↗</a></footer>
 </main>;
}
