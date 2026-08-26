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
 const [error,setError]=useState('');

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const w=q.get('wallet')||'';
  setWallet(ADDRESS_RE.test(w)?w:'');
  setTokenId(q.get('tokenId')||'');
  setSessionId(q.get('session_id')||'');
 },[]);

 useEffect(()=>{
  if(ADDRESS_RE.test(wallet))runScan();
 },[wallet,tokenId]);

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
   if(!response.ok)throw new Error(data.error||'Market refresh failed.');
   setScanner(data);
  }catch(e){setError(e instanceof Error?e.message:'Market refresh failed.')}
  finally{setBusy(false)}
 }

 const openSeaHref=scanner?.openSeaUrl||'https://opensea.io';
 const listed=scanner?.tokenListed===true?'LISTED':scanner?.tokenListed===false?'NOT LISTED':'—';
 const marketReady=scanner?.marketDataConfigured===true;
 const factoryQuery=new URLSearchParams();if(wallet)factoryQuery.set('wallet',wallet);if(tokenId)factoryQuery.set('tokenId',tokenId);if(sessionId)factoryQuery.set('session_id',sessionId);const factoryHref=`/voxelflip/factory${factoryQuery.toString()?`?${factoryQuery}`:''}`;
 const forgeQuery=new URLSearchParams();if(wallet)forgeQuery.set('wallet',wallet);if(tokenId)forgeQuery.set('tokenId',tokenId);const forgeHref=`/forge${forgeQuery.toString()?`?${forgeQuery}`:''}`;
 const mintHref=sessionId?`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`:'/studio#my-voxels';

 return <main className={styles.page}>
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>MAKE · MINT · FORGE · POST</em>
  </nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>CREATOR CONTROL</p>
    <h1>{tokenId?`VoxelFlip #${tokenId}`:'VoxelFlip'}</h1>
    <span>Make the asset, mint it, forge it when eligible, then post/list it. Your wallet approves every onchain action.</span>
   </header>

   <section className={styles.dashboard}>
    <div className={styles.controls}>
     {!wallet?
      <button className={styles.connect} onClick={connect} disabled={busy}>{busy?'CONNECTING…':'CONNECT WALLET'}</button>:
      <div className={styles.wallet}>
       <div><small>BASE WALLET</small><b>{short(wallet)}</b></div>
       <button onClick={runScan} disabled={busy}>{busy?'CHECKING…':'REFRESH MARKET'}</button>
      </div>}
    </div>

    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.metrics}>
     <article><small>FLOOR</small><b>{eth(scanner?.collectionFloorEth)}</b></article>
     <article><small>LISTINGS</small><b>{count(scanner?.collectionListings,scanner?.collectionListingsMore)}</b></article>
     <article><small>24H SALES</small><b>{count(scanner?.sales24h,scanner?.sales24hMore)}</b></article>
     <article><small>YOUR NFT</small><b>{listed}</b></article>
    </div>

    {!scanner&&wallet&&<div className={styles.notice}>Market data loads once when the wallet/token changes. Use Refresh Market whenever you want a newer reading.</div>}
    {scanner&&!marketReady&&<div className={styles.notice}>OpenSea market data is not connected yet. Your VoxelFlip is still safe and this page cannot send a transaction.</div>}
    {scanner&&marketReady&&!scanner.collectionSlug&&tokenId&&<div className={styles.notice}>OpenSea has not returned collection stats yet. Use Refresh Market before posting/listing if you want another check.</div>}
    {scanner?.checkedAt&&<p className={styles.checked}>Checked {time(scanner.checkedAt)} · market data can lag behind Base.</p>}

    <div className={styles.divider}/>

    <div className={styles.actionHead}>
     <div><small>THE CREATOR LOOP</small><h2>Make → Mint → Forge → Post</h2></div>
     <span>YOU APPROVE</span>
    </div>

    <div className={styles.safety}>
     <b>You’re in control.</b>
     <span>No recurring auto-scan, mint, listing or ETH spend is authorized from this page. Your wallet must approve transactions.</span>
    </div>

    <div className={styles.actions}>
     <a className={styles.primary} href="/studio">MAKE A VOXEL</a>
     <a href={mintHref}>MINT</a>
     <a href={forgeHref}>THE FORGE</a>
     <a href={openSeaHref} target="_blank" rel="noreferrer">POST / LIST ↗</a>
     <a href={factoryHref}>FORGE LAUNCHPAD</a>
     <a href="/studio#my-voxels">MY VOXELS</a>
    </div>

    <div className={styles.divider}/>

    <div className={styles.actionHead}>
     <div><small>FORGE LAUNCHPAD</small><h2>The machine that can create more Forges.</h2></div>
     <span>TESTNET BRANCH</span>
    </div>
    <div className={styles.activity}>
     <div className={styles.event}><b>01</b><span>One Forge implementation holds the reviewed 3→1 Common → Rare → Legendary logic.</span></div>
     <div className={styles.event}><b>02</b><span>The Forge Factory creates cheap EIP-1167 clones for creators instead of redeploying the whole contract.</span></div>
     <div className={styles.event}><b>03</b><span>New clones can charge a deploy fee and permanently record the platform merge-fee split they launched with.</span></div>
     <div className={styles.event}><b>04</b><span>The merge curve is contract behavior, not a promise of profit: basePrice + increment × completed merges.</span></div>
    </div>
    <div className={styles.notice}>OpenZeppelin is pinned to the reviewed 5.4.0 release. Clone initialization uses one typed config struct instead of enabling viaIR globally, so the rest of Voxel Vault keeps the same compiler behavior.</div>
    <p className={styles.finePrint}>The launchpad implementation/factory compile and tests are green on the experiment branch. Base mainnet deployment is still intentionally separate.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href="/studio#my-voxels">← MY VOXELS</a><a href={factoryHref}>FORGE LAUNCHPAD →</a></footer>
 </main>;
}
