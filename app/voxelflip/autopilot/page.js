'use client';

import {useEffect,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import {getSupabaseBrowserAsync} from '../../../lib/supabase-browser';
import styles from './autopilot.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function yes(value){return value?<span className={styles.good}>READY</span>:<span className={styles.bad}>NEEDED</span>}
function time(value){try{return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return ''}}

export default function VoxelFlipAutopilotPage(){
 const [wallet,setWallet]=useState('');
 const [tokenId,setTokenId]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [scanner,setScanner]=useState(null);
 const [busy,setBusy]=useState(false);
 const [autoScan,setAutoScan]=useState(true);
 const [error,setError]=useState('');
 const [googleConnected,setGoogleConnected]=useState(false);

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);const w=q.get('wallet')||'';setWallet(ADDRESS_RE.test(w)?w:'');setTokenId(q.get('tokenId')||'');setSessionId(q.get('session_id')||'');
  getSupabaseBrowserAsync().then(async client=>{const {data}=await client.auth.getSession();setGoogleConnected(Boolean(data.session?.user))}).catch(()=>setGoogleConnected(false));
 },[]);
 useEffect(()=>{if(!ADDRESS_RE.test(wallet)||!autoScan)return;runScan();const timer=setInterval(runScan,30000);return()=>clearInterval(timer)},[wallet,tokenId,autoScan]);

 async function connect(){setBusy(true);setError('');try{const result=await connectVoxelFlipWallet();setWallet(result.address)}catch(e){if(e?.code==='NO_WALLET_PROVIDER'&&e?.deepLink){location.href=e.deepLink;return}setError(e instanceof Error?e.message:'Wallet connection failed.')}finally{setBusy(false)}}
 async function runScan(){if(!ADDRESS_RE.test(wallet)||busy)return;setBusy(true);setError('');try{const q=new URLSearchParams({wallet});if(/^\d+$/.test(tokenId))q.set('tokenId',tokenId);const response=await fetch(`/api/voxelflip/trader?${q}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Autopilot scan failed.');setScanner(data)}catch(e){setError(e instanceof Error?e.message:'Autopilot scan failed.')}finally{setBusy(false)}}

 const risk=scanner?.riskPolicy||{};const policy=scanner?.gatewayPolicy||{};const setup=scanner?.setup||{};const execution=scanner?.automaticSigningActive?'RUNNING':scanner?.executionFoundationReady?'FOUNDATION READY':'SETUP';const activity=scanner?.activity||[];
 const ecologyQuery=new URLSearchParams();if(wallet)ecologyQuery.set('wallet',wallet);if(tokenId)ecologyQuery.set('tokenId',tokenId);if(sessionId)ecologyQuery.set('session_id',sessionId);const ecologyHref=`/voxelflip/ecology${ecologyQuery.toString()?`?${ecologyQuery}`:''}`;
 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>VOXELFLIP · AUTOPILOT</em></nav>
  <header className={styles.hero}><p className={styles.eyebrow}>SCAN → SCORE → GATE → EXECUTE → MONITOR</p><h1>Your market bot.<br/><em>With speed bumps.</em></h1><span>This is the trading workspace. Minting is separate. Every opportunity is classified into automatic, one-tap, or manual review before money or inventory can move.</span></header>
  <div className={styles.shell}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>LIVE SYSTEM</small><h2>Autopilot status</h2></div><button className={`${styles.status} ${autoScan?styles.statusOn:''}`} onClick={()=>setAutoScan(v=>!v)}>{autoScan?'AUTO SCAN ON':'AUTO SCAN OFF'}</button></div>
    {!wallet?<button className={styles.connect} onClick={connect} disabled={busy}>{busy?'Connecting…':'Connect Base wallet'}</button>:<div className={styles.wallet}><div><small>CONNECTED OWNER / WATCH WALLET</small><b>{short(wallet)}</b></div><button onClick={runScan} disabled={busy}>{busy?'Scanning…':'Refresh now'}</button></div>}
    {error&&<div className={styles.notice}>{error}</div>}
    <div className={styles.grid4}><article className={styles.metric}><small>SCANNER</small><b>{scanner?.scanner==='live'?'LIVE':scanner?'SETUP':'—'}</b></article><article className={styles.metric}><small>EXECUTION</small><b>{execution}</b></article><article className={styles.metric}><small>LISTINGS</small><b>{scanner?.listings??'—'}</b></article><article className={styles.metric}><small>OFFERS</small><b>{scanner?.offersReceived??'—'}</b></article></div>
    {scanner?.executionNotice&&<div className={styles.notice}>{scanner.executionNotice}</div>}
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>TRANSACTION GATEWAY</small><h2>Three approval modes</h2></div><span className={styles.status}>POLICY ENFORCED SERVER-SIDE</span></div>
    <div className={styles.tiers}>
     <article className={styles.tier}><div className={styles.tierTop}><span className={styles.auto}>TIER 1 · AUTO</span><span>NO TAP</span></div><h3>Small, verified trades</h3><p>{policy.auto?.description||'Allowlisted trading inventory only.'}</p><ul><li>Up to {policy.auto?.maxTradeEth??risk.maxTradeEth??'—'} ETH per trade</li><li>Daily cap {policy.auto?.dailySpendCapEth??risk.maxDailySpendEth??'—'} ETH</li><li>Gas must stay under {policy.auto?.maxGasPercent??risk.maxGasPercent??'—'}%</li><li>Whitelist only · never grails</li></ul></article>
     <article className={styles.tier}><div className={styles.tierTop}><span className={styles.oneTap}>TIER 2 · 1-TAP</span><span>PHONE</span></div><h3>Medium-risk opportunities</h3><p>{policy.oneTap?.description||'Bot pauses for your approval.'}</p><ul><li>{policy.oneTap?.minTradeEth??risk.maxTradeEth??'—'}–{policy.oneTap?.maxTradeEth??'0.05'} ETH</li><li>{policy.oneTap?.timeoutSeconds??60}-second approval window</li><li>Approve or reject from phone</li><li>No silent execution after timeout</li></ul></article>
     <article className={styles.tier}><div className={styles.tierTop}><span className={styles.manual}>TIER 3 · MANUAL</span><span>STOP</span></div><h3>Grails, swaps & high risk</h3><p>{policy.manual?.description||'Manual review is mandatory.'}</p><ul><li>All swaps</li><li>All grail-tagged assets</li><li>Unverified/new collections</li><li>Anything above the 1-tap cap</li></ul></article>
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>SAFETY + READINESS</small><h2>Execution controls</h2></div><span className={styles.status}>{scanner?.killSwitch?'KILL SWITCH ON':'KILL SWITCH READY'}</span></div>
    <div className={styles.split}>
     <div className={styles.subpanel}><h3>System checklist</h3><div className={styles.checks}><div className={styles.check}><b>OpenSea market data</b>{yes(setup.openSea)}</div><div className={styles.check}><b>Production Base RPC</b>{yes(setup.productionRpc)}</div><div className={styles.check}><b>Separate trader signer</b>{yes(setup.traderSigner)}</div><div className={styles.check}><b>VoxelFlip contract</b>{yes(setup.collection)}</div><div className={styles.check}><b>Automatic-buy allowlist</b>{yes(setup.allowlist)}</div><div className={styles.check}><b>Bounded executor / delegation</b>{yes(setup.executor)}</div><div className={styles.check}><b>Google phone identity</b>{yes(googleConnected)}</div></div></div>
     <div className={styles.subpanel}><h3>Hard limits</h3><div className={styles.riskGrid}><div className={styles.risk}><small>MAX / TRADE</small><b>{risk.maxTradeEth??'—'} ETH</b></div><div className={styles.risk}><small>DAILY SPEND</small><b>{risk.maxDailySpendEth??'—'} ETH</b></div><div className={styles.risk}><small>DAILY LOSS STOP</small><b>{risk.maxDailyLossEth??'—'} ETH</b></div><div className={styles.risk}><small>BOT WALLET MAX</small><b>{risk.maxBotWalletEth??'—'} ETH</b></div><div className={styles.risk}><small>INVENTORY CAP</small><b>{risk.maxInventory??'—'}</b></div><div className={styles.risk}><small>MIN EDGE</small><b>{risk.minimumEdgeBps??'—'} bps</b></div><div className={styles.risk}><small>GAS GUARD</small><b>{risk.maxGasPercent??'—'}%</b></div><div className={styles.risk}><small>LOSS BREAKER</small><b>{risk.lossesBeforePause??'—'} / {risk.lossWindowMinutes??'—'}m</b></div></div></div>
    </div>
    <div className={styles.notice}>{policy.inventoryModel||'Trading inventory stays separate from owner-wallet grails.'}</div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>MONITOR</small><h2>Bot activity stream</h2></div><span className={styles.status}>{scanner?.checkedAt?`UPDATED ${time(scanner.checkedAt)}`:'NOT STARTED'}</span></div>
    <div className={styles.activity}>{activity.length?activity.map((event,i)=><div className={styles.event} key={`${event.at}-${i}`}><b>{event.type}</b><span>{time(event.at)} · {event.text}</span></div>):<div className={styles.event}><b>STANDBY</b><span>Connect a wallet to begin the live market scan.</span></div>}</div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>NON-NEGOTIABLE</small><h2>Guardrails</h2></div></div>
    <div className={styles.guardrails}>{(scanner?.protections||['Dedicated trader wallet only','Whitelist-only automatic buys','Grails stay manual','Gas guard','Daily loss circuit breaker','Kill switch']).map((item,i)=><div className={styles.guardrail} key={i}><span>✓</span><p>{item}</p></div>)}</div>
    <div className={styles.actions}><a href={ecologyHref}>Enter Ecology →</a><a href="/studio#my-voxels">Google / My Voxels</a>{sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>Mint page</a>}<a href="https://opensea.io" target="_blank" rel="noreferrer">OpenSea ↗</a></div>
    <p className={styles.riskText}>Automatic NFT trading can lose money. Limits, allowlists and circuit breakers reduce risk but cannot guarantee profit or prevent every loss. Automatic signing remains off until the separate bounded executor/delegation is actually installed and verified.</p>
   </section>
  </div>
  <footer className={styles.footer}><a href="/studio">← VoxelPop Studio</a><a href={ecologyHref}>Ecology →</a></footer>
 </main>;
}
