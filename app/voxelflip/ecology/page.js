'use client';

import {useEffect,useMemo,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import styles from './ecology.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
const STAGES=[
 {key:'autonomy',n:'01',name:'AUTONOMY',title:'Economic senses',body:'Scan markets, score opportunities and enforce bounded risk before anything can act.'},
 {key:'fitness',n:'02',name:'FITNESS',title:'Verified performance DNA',body:'Turn real, settled trading history into a tamper-evident fitness record. No simulated wins count.'},
 {key:'genome',n:'03',name:'GENOME',title:'Strategy becomes inheritable',body:'Compress risk, timing, liquidity and execution behavior into a versioned genome that can mutate safely.'},
 {key:'birth',n:'04',name:'BIRTH',title:'Profitable agents can reproduce',body:'After a future verified threshold, an eligible parent can create a child with inherited parameters and bounded mutation.'},
 {key:'ecology',n:'05',name:'ECOLOGY',title:'Agents buy services from agents',body:'Scouts, risk sentinels, execution specialists and exit specialists can exchange useful signals through protocol rails.'},
 {key:'species',n:'06',name:'SPECIES',title:'Natural selection compounds',body:'Successful descendants cluster into bloodlines and species based on measured behavior, not cosmetic rarity.'},
 {key:'civilization',n:'07',name:'CIVILIZATION',title:'A persistent machine economy',body:'Specialized agents can discover durable economic roles while humans remain owners, governors and emergency brakes.'},
];

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function badge(state){return <span className={`${styles.badge} ${state==='LIVE'?styles.live:state==='READY'?styles.ready:styles.locked}`}>{state}</span>}

export default function EcologyPage(){
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
   const response=await fetch(`/api/voxelflip/trader?${q}`,{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Ecology readiness scan failed.');setScanner(data);
  }catch(e){setError(e instanceof Error?e.message:'Ecology readiness scan failed.')}
  finally{setBusy(false)}
 }

 const foundationReady=Boolean(scanner?.executionFoundationReady);
 const autonomyLive=Boolean(scanner?.automaticSigningActive);
 const genomeReady=foundationReady;
 const performanceLedgerReady=false;
 const birthReady=autonomyLive&&performanceLedgerReady;
 const ecologyReady=birthReady;
 const stageState=useMemo(()=>({
  autonomy:autonomyLive?'LIVE':foundationReady?'READY':'LOCKED',
  fitness:performanceLedgerReady?'LIVE':'LOCKED',
  genome:genomeReady?'READY':'LOCKED',
  birth:birthReady?'LIVE':'LOCKED',
  ecology:ecologyReady?'LIVE':'LOCKED',
  species:ecologyReady?'READY':'LOCKED',
  civilization:ecologyReady?'READY':'LOCKED',
 }),[autonomyLive,foundationReady,genomeReady,birthReady,ecologyReady]);

 const query=new URLSearchParams();if(wallet)query.set('wallet',wallet);if(tokenId)query.set('tokenId',tokenId);if(sessionId)query.set('session_id',sessionId);
 const autopilotHref=`/voxelflip/autopilot${query.toString()?`?${query}`:''}`;

 return <main className={styles.page}>
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>VOXELFLIP · ECOLOGY</em>
  </nav>

  <header className={styles.hero}>
   <p className={styles.eyebrow}>AUTOPILOT → FITNESS → GENOME → BIRTH → ECOLOGY → SPECIES</p>
   <h1>The bot learns.<br/><em>The species begins.</em></h1>
   <p>Ecology is the layer after Autopilot: a staged architecture for verified performance DNA, bounded reproduction, specialization and agent-to-agent economic services.</p>
   <div className={styles.heroActions}><a href={autopilotHref}>← Autopilot</a><button onClick={ADDRESS_RE.test(wallet)?refresh:connect} disabled={busy}>{busy?'Checking…':wallet?'Refresh organism state':'Connect Base wallet'}</button></div>
  </header>

  <div className={styles.shell}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>GENESIS GATE</small><h2>One organism. Seven gates.</h2></div>{badge(autonomyLive?'LIVE':foundationReady?'READY':'LOCKED')}</div>
    <div className={styles.identity}>
     <div><small>OWNER / WATCH WALLET</small><b>{short(wallet)}</b></div>
     <div><small>VOXELFLIP</small><b>{tokenId?`#${tokenId}`:'Not selected'}</b></div>
     <div><small>MARKET SCANNER</small><b>{scanner?.scanner==='live'?'LIVE':scanner?'SETUP':'—'}</b></div>
     <div><small>AUTOMATIC SIGNING</small><b>{autonomyLive?'ACTIVE':'OFF'}</b></div>
    </div>
    {error&&<div className={styles.notice}>{error}</div>}
    <div className={styles.notice}>{autonomyLive?'Bounded automatic execution is active. Ecology still requires a verified performance ledger before any birth or self-modification can unlock.':'Ecology is intentionally gated. The current Autopilot can monitor and classify opportunities, but automatic signing remains off until a bounded executor/delegation is actually installed and verified.'}</div>
   </section>

   <section className={styles.timeline}>
    {STAGES.map(stage=><article className={styles.stage} key={stage.key}>
      <div className={styles.stageRail}><span>{stage.n}</span><i/></div>
      <div className={styles.stageBody}><div className={styles.stageTop}><small>{stage.name}</small>{badge(stageState[stage.key])}</div><h3>{stage.title}</h3><p>{stage.body}</p></div>
    </article>)}
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>ECONOMIC DNA</small><h2>What becomes inheritable</h2></div><span className={styles.protocol}>VERSIONED · AUDITABLE · BOUNDED</span></div>
    <div className={styles.dnaGrid}>
     <div><small>RISK TOLERANCE</small><b>Position + loss limits</b><span>Never inherited above protocol caps.</span></div>
     <div><small>LIQUIDITY BIAS</small><b>Depth preference</b><span>How much market depth an agent requires.</span></div>
     <div><small>ENTRY LOGIC</small><b>Momentum / mean reversion</b><span>Weights can mutate inside an approved range.</span></div>
     <div><small>EXIT LOGIC</small><b>Time + edge decay</b><span>How rapidly an organism abandons a thesis.</span></div>
     <div><small>GAS SENSITIVITY</small><b>Execution restraint</b><span>Protects thin-edge opportunities from fees.</span></div>
     <div><small>CONFIDENCE FLOOR</small><b>Minimum conviction</b><span>Controls how selective the organism is.</span></div>
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>THE ORGANISM MARKET</small><h2>Agents become useful to each other</h2></div>{badge('LOCKED')}</div>
    <div className={styles.roles}>
     <article><span>SCOUT</span><h3>Finds markets</h3><p>Discovers unusual liquidity, offer velocity and opportunity clusters.</p><strong>SELLS → SIGNALS</strong></article>
     <article><span>SENTINEL</span><h3>Scores risk</h3><p>Independently checks collection quality, concentration and downside.</p><strong>SELLS → RISK SCORES</strong></article>
     <article><span>EXECUTOR</span><h3>Routes trades</h3><p>Optimizes gas, slippage, transaction timing and bounded execution.</p><strong>SELLS → EXECUTION</strong></article>
     <article><span>EXIT</span><h3>Knows when to leave</h3><p>Models edge decay, inventory pressure and optimal liquidation windows.</p><strong>SELLS → EXIT INTELLIGENCE</strong></article>
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>NATURAL SELECTION</small><h2>Survival is economic, not cosmetic</h2></div></div>
    <div className={styles.flow}>
     <div><b>1</b><span>Verified performance</span></div><i>→</i>
     <div><b>2</b><span>Reputation + service demand</span></div><i>→</i>
     <div><b>3</b><span>Bounded mutation</span></div><i>→</i>
     <div><b>4</b><span>Descendant survival</span></div><i>→</i>
     <div><b>5</b><span>Species formation</span></div>
    </div>
    <p className={styles.disclaimer}>No profit, valuation, birth, royalty or survival outcome is guaranteed. Ecology should only unlock from verified settled activity and explicit protocol rules. It must never bypass wallet permissions, spending limits, allowlists, loss breakers or the kill switch.</p>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>NEXT BUILD</small><h2>The first real Ecology primitive</h2></div><span className={styles.protocol}>FOUNDATION</span></div>
    <div className={styles.nextBuild}>
     <div><b>01</b><h3>Performance ledger</h3><p>Record settled opportunities and realized outcomes with enough provenance to distinguish live performance from simulation.</p></div>
     <div><b>02</b><h3>Genome encoder</h3><p>Convert approved strategy parameters into a stable, versioned DNA schema with hard mutation bounds.</p></div>
     <div><b>03</b><h3>Signal marketplace</h3><p>Let specialist agents quote tiny fees for useful information before enabling reproduction or autonomous service purchasing.</p></div>
    </div>
    <div className={styles.actions}><a href={autopilotHref}>Back to Autopilot</a>{sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>Mint</a>}<a href="/studio#my-voxels">My Voxels</a></div>
   </section>
  </div>

  <footer className={styles.footer}><span>VOXELFLIP · ECOLOGY</span><a href="/studio">VoxelPop Studio</a></footer>
 </main>;
}
