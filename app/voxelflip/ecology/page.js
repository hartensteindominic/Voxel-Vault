'use client';

import {useEffect,useMemo,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import styles from './ecology.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
const STAGES=[
 {key:'autonomy',name:'Monitoring + bounded automation',body:'Scan markets, score opportunities, and enforce risk limits.'},
 {key:'fitness',name:'Verified performance',body:'Use settled trading history only. Simulated wins do not count.'},
 {key:'genome',name:'Strategy genome',body:'Turn risk, timing, and liquidity behavior into a versioned strategy record.'},
 {key:'birth',name:'Future descendants',body:'Only after verified profit and separately approved execution rules.'},
 {key:'ecology',name:'Agent services',body:'Future agents may exchange useful signals under protocol limits.'},
 {key:'species',name:'Species',body:'Group successful descendants by measured behavior.'},
 {key:'civilization',name:'Machine economy',body:'A future persistent economy with humans as owners and emergency brakes.'},
];

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function stateLabel(state){return state==='LIVE'?'LIVE':state==='READY'?'READY':'WAIT'}

export default function EcologyPage(){
 const [wallet,setWallet]=useState('');
 const [tokenId,setTokenId]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [scanner,setScanner]=useState(null);
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

 useEffect(()=>{if(ADDRESS_RE.test(wallet))refresh()},[wallet,tokenId]);

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
   const q=new URLSearchParams({wallet});if(/^\d+$/.test(tokenId))q.set('tokenId',tokenId);
   const [traderResponse,factoryResponse]=await Promise.all([
    fetch(`/api/voxelflip/trader?${q}`,{cache:'no-store'}),
    fetch(`/api/voxelflip/factory?wallet=${encodeURIComponent(wallet)}`,{cache:'no-store'}),
   ]);
   const [traderData,factoryData]=await Promise.all([traderResponse.json(),factoryResponse.json()]);
   if(!traderResponse.ok)throw new Error(traderData.error||'Ecology market scan failed.');
   setScanner(traderData);
   if(factoryResponse.ok)setFactory(factoryData);else setFactory(null);
  }catch(e){setError(e instanceof Error?e.message:'Ecology readiness scan failed.')}
  finally{setBusy(false)}
 }

 const foundationReady=Boolean(scanner?.executionFoundationReady);
 const autonomyLive=Boolean(scanner?.automaticSigningActive);
 const performanceLedgerReady=Boolean(factory?.readiness?.profitLedger);
 const profitCycleReady=Boolean(factory?.readiness?.profitCycle);
 const genomeReady=foundationReady&&performanceLedgerReady;
 const birthReady=autonomyLive&&profitCycleReady;
 const ecologyReady=birthReady;
 const stageState=useMemo(()=>({
  autonomy:autonomyLive?'LIVE':foundationReady?'READY':'LOCKED',
  fitness:performanceLedgerReady?'READY':'LOCKED',
  genome:genomeReady?'READY':'LOCKED',
  birth:birthReady?'LIVE':'LOCKED',
  ecology:ecologyReady?'LIVE':'LOCKED',
  species:ecologyReady?'READY':'LOCKED',
  civilization:ecologyReady?'READY':'LOCKED',
 }),[autonomyLive,foundationReady,performanceLedgerReady,profitCycleReady,genomeReady,birthReady,ecologyReady]);

 const query=new URLSearchParams();if(wallet)query.set('wallet',wallet);if(tokenId)query.set('tokenId',tokenId);if(sessionId)query.set('session_id',sessionId);
 const autopilotHref=`/voxelflip/autopilot${query.toString()?`?${query}`:''}`;
 const factoryHref=`/voxelflip/factory${query.toString()?`?${query}`:''}`;

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>FUTURE</em></nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>OPTIONAL · FUTURE ROADMAP</p>
    <h1>Ecology.</h1>
    <span>See what could come after monitoring and verified profit. Nothing on this page can spend, mint, list, or sign.</span>
   </header>

   <section className={styles.card}>
    {!wallet?<button className={styles.primary} onClick={connect} disabled={busy}>{busy?'CONNECTING…':'CHECK READINESS'}</button>:<div className={styles.wallet}><div><small>WALLET</small><b>{short(wallet)}</b></div><button onClick={refresh} disabled={busy}>{busy?'CHECKING…':'REFRESH'}</button></div>}
    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.metrics}>
     <div><small>VOXELFLIP</small><b>{tokenId?`#${tokenId}`:'—'}</b></div>
     <div><small>PROFIT LEDGER</small><b>{performanceLedgerReady?'READY':'WAIT'}</b></div>
     <div><small>FOUNDATION</small><b>{foundationReady?'READY':'WAIT'}</b></div>
     <div><small>AUTO SIGNING</small><b>{autonomyLive?'ON':'OFF'}</b></div>
    </div>

    <div className={styles.safety}><b>AUTOMATIC SIGNING {autonomyLive?'ON':'OFF'}.</b><span>{autonomyLive?'A bounded executor is reporting active, but future reproduction rules are still separate.':'Ecology stays read-only and gated.'}</span></div>

    <details className={styles.details} open>
     <summary>ROADMAP</summary>
     <div className={styles.stageList}>{STAGES.map((stage,i)=><div key={stage.key}><span>{String(i+1).padStart(2,'0')}</span><div><b>{stage.name}</b><p>{stage.body}</p></div><em>{stateLabel(stageState[stage.key])}</em></div>)}</div>
    </details>

    <details className={styles.details}>
     <summary>WHAT COULD BE LEARNED</summary>
     <div className={styles.detailList}>
      <div><b>Risk tolerance</b>Position and loss limits, always below protocol caps.</div>
      <div><b>Liquidity bias</b>How much market depth a strategy requires.</div>
      <div><b>Entry / exit logic</b>Timing behavior that can only change inside approved bounds.</div>
      <div><b>Gas sensitivity</b>Avoid thin opportunities where fees erase the edge.</div>
      <div><b>Confidence floor</b>How selective a future strategy is.</div>
     </div>
    </details>

    <details className={styles.details}>
     <summary>WHAT MUST EXIST FIRST</summary>
     <div className={styles.detailList}>
      <div><b>1. Complete profit accounting</b>Verified sale fees and production costs before net profit is trusted.</div>
      <div><b>2. Generation queue</b>Draft candidates without spending or minting.</div>
      <div><b>3. Bounded approvals</b>Tightly scoped mint/list permissions tested separately before any automation decision.</div>
     </div>
    </details>

    <div className={styles.actions}><a className={styles.primaryLink} href={autopilotHref}>BACK TO MONITOR</a><a href={factoryHref}>FACTORY</a>{sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>MINT</a>}<a href="/studio#my-voxels">MY VOXELS</a></div>
    <p className={styles.finePrint}>No profit, valuation, birth, royalty, or survival outcome is guaranteed. Future features must still obey wallet permissions, spending limits, allowlists, loss breakers, and kill switches.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href={autopilotHref}>← MONITOR</a><a href="/studio">STUDIO</a></footer>
 </main>;
}
