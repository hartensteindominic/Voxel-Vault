'use client';

import {useEffect,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import styles from '../autopilot/autopilot.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function eth(value){const n=Number(value);return value!==null&&value!==undefined&&Number.isFinite(n)?`${n.toLocaleString(undefined,{maximumFractionDigits:6})} ETH`:'—'}
function time(value){try{return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return ''}}

export default function VoxelFlipFactoryPage(){
 const [wallet,setWallet]=useState('');
 const [tokenId,setTokenId]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [factory,setFactory]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const w=q.get('wallet')||'';
  setWallet(ADDRESS_RE.test(w)?w:'');
  setTokenId(q.get('tokenId')||'');
  setSessionId(q.get('session_id')||'');
 },[]);

 useEffect(()=>{if(ADDRESS_RE.test(wallet))refresh()},[wallet]);

 async function connect(){
  setBusy(true);setError('');
  try{const result=await connectVoxelFlipWallet();setWallet(result.address)}
  catch(e){if(e?.code==='NO_WALLET_PROVIDER'&&e?.deepLink){location.href=e.deepLink;return}setError(e instanceof Error?e.message:'Wallet connection failed.')}
  finally{setBusy(false)}
 }

 async function refresh(){
  if(!ADDRESS_RE.test(wallet)||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(`/api/voxelflip/factory?wallet=${encodeURIComponent(wallet)}`,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Factory check failed.');
   setFactory(data);
  }catch(e){setError(e instanceof Error?e.message:'Factory check failed.')}
  finally{setBusy(false)}
 }

 const policy=factory?.policy||{};
 const observed=factory?.observed||{};
 const readiness=factory?.readiness||{};
 const ledger=factory?.ledger||{};
 const agents=factory?.agents||[];
 const factoryQuery=new URLSearchParams();
 if(wallet)factoryQuery.set('wallet',wallet);if(tokenId)factoryQuery.set('tokenId',tokenId);if(sessionId)factoryQuery.set('session_id',sessionId);
 const autopilotHref=`/voxelflip/autopilot${factoryQuery.toString()?`?${factoryQuery}`:''}`;
 const loop=factory?.loop||[
  {label:'External sale settles',ready:false},{label:'Verify net profit after costs',ready:false},{label:'Reserve capital',ready:false},{label:'Reinvest a capped slice',ready:false},{label:'Draft next voxel candidate',ready:false},{label:'Mint with approval',ready:false},{label:'List with approval',ready:false},{label:'Repeat after another sale',ready:false}
 ];
 const fallbackAgents=[
  {agent:'SCOUT',headline:'Waiting for scan',reason:'Connect a wallet.',proposedAction:'Observe only.',requiresApproval:false},
  {agent:'PRICER',headline:'Waiting for market data',reason:'No live price input yet.',proposedAction:'Observe only.',requiresApproval:true},
  {agent:'RISK',headline:'Ledger required',reason:'Costs must be verified.',proposedAction:'Block spending.',requiresApproval:true},
  {agent:'MAKER',headline:'Profit required',reason:'No verified reinvestment budget yet.',proposedAction:'Keep candidate queued.',requiresApproval:true}
 ];

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>FACTORY</em></nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>OPTIONAL · ADVANCED</p>
    <h1>Factory.</h1>
    <span>Tracks real sales, costs, and profit. It does not spend, mint, list, or sign for you.</span>
   </header>

   <section className={styles.dashboard}>
    <div className={styles.controls}>
     {!wallet?<button className={styles.connect} onClick={connect} disabled={busy}>{busy?'CONNECTING…':'CONNECT WALLET'}</button>:<div className={styles.wallet}><div><small>WALLET</small><b>{short(wallet)}</b></div><button onClick={refresh} disabled={busy}>{busy?'CHECKING…':'REFRESH'}</button></div>}
    </div>
    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.metrics}>
     <article><small>SALES · 30D</small><b>{factory?observed.verifiedExternalSales30d:'—'}</b></article>
     <article><small>GROSS SALES</small><b>{factory?eth(observed.recognizedSaleProceedsEth):'—'}</b></article>
     <article><small>COSTS</small><b>{factory?eth(ledger.verifiedCostEth):'—'}</b></article>
     <article><small>PROFIT</small><b>{factory?(ledger.realizedProfitEth===null?'WAIT':eth(ledger.realizedProfitEth)):'—'}</b></article>
    </div>

    {factory&&<div className={styles.notice}>{factory.nextStep}</div>}
    {(ledger.warnings||[]).map((warning,i)=><div className={styles.notice} key={i}>{warning}</div>)}
    {factory?.checkedAt&&<p className={styles.checked}>Checked {time(factory.checkedAt)}</p>}

    <div className={styles.safety}><b>SIGNING OFF.</b><span>Factory only observes and calculates. Every future wallet action still requires your approval.</span></div>

    <details className={styles.details}>
     <summary>HOW THE LOOP WORKS</summary>
     <div className={styles.detailList}>{loop.map((step,i)=><div key={`${step.key||i}`}><b>{step.ready?'✓ ':''}{i+1}. {step.label}</b></div>)}</div>
    </details>

    <details className={styles.details}>
     <summary>ANALYSIS AGENTS</summary>
     <div className={styles.detailList}>{(agents.length?agents:fallbackAgents).map((agent,i)=><div key={`${agent.agent}-${i}`}><b>{agent.agent} · {agent.headline}</b>{agent.reason}<br/>Next: {agent.proposedAction}{agent.requiresApproval?' · approval required':''}</div>)}</div>
    </details>

    <details className={styles.details}>
     <summary>SAFETY + READINESS</summary>
     <div className={styles.detailList}>
      <div><b>Reserve</b>{factory?`${policy.reservePercent}% kept by default`:'Waiting for Factory data'}</div>
      <div><b>Maximum reinvestment</b>{factory?`${policy.reinvestPercent}% of verified profit · ${eth(policy.maxReinvestPerCycleEth)} max per cycle`:'Waiting for Factory data'}</div>
      <div><b>OpenSea</b>{readiness.openSea?'Ready':'Waiting'}</div>
      <div><b>Base RPC</b>{readiness.productionRpc?'Ready':'Waiting'}</div>
      <div><b>Profit ledger</b>{readiness.profitLedger?'Ready':'Waiting'}</div>
      <div><b>Profit cycle</b>{readiness.profitCycle?'Ready':'Waiting'}</div>
      <div><b>Bounded executor</b>{readiness.boundedExecutor?'Ready':'Not installed'}</div>
     </div>
    </details>

    <div className={styles.actions}>
     <a className={styles.primary} href={autopilotHref}>BACK TO MONITOR</a>
     <a href="/studio">CREATE VOXEL</a>
     <a href="/studio#my-voxels">MY VOXELS</a>
    </div>
    <p className={styles.finePrint}>A sale is not treated as profit until required costs are verified. Unsold NFTs and self-trades do not count as profit.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href={autopilotHref}>← MONITOR</a><a href="/studio#my-voxels">MY VOXELS</a></footer>
 </main>;
}
