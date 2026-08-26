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
   if(factoryResponse.ok)setFactory(factoryData);
   else setFactory(null);
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
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>VOXELFLIP · ECOLOGY</em>
  </nav>

  <header className={styles.hero}>
   <p className={styles.eyebrow}>AUTOPILOT → FACTORY LEDGER → FITNESS → GENOME → BIRTH → ECOLOGY</p>
   <h1>The bot learns.<br/><em>The species waits.</em></h1>
   <p>Ecology is future architecture after monitoring and Factory accounting. Analysis agents may learn from verified results, but automatic signing, reproduction and agent-to-agent spending remain locked.</p>
   <div className={styles.heroActions}><a href={autopilotHref}>← Autopilot</a><button onClick={ADDRESS_RE.test(wallet)?refresh:connect} disabled={busy}>{busy?'Checking…':wallet?'Refresh readiness':'Connect Base wallet'}</button></div>
  </header>

  <div className={styles.shell}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>GENESIS GATE</small><h2>One organism. Seven gates.</h2></div>{badge(autonomyLive?'LIVE':foundationReady?'READY':'LOCKED')}</div>
    <div className={styles.identity}>
     <div><small>OWNER / WATCH WALLET</small><b>{short(wallet)}</b></div>
     <div><small>VOXELFLIP</small><b>{tokenId?`#${tokenId}`:'Not selected'}</b></div>
     <div><small>PROFIT LEDGER</small><b>{performanceLedgerReady?'READY':'WAIT'}</b></div>
     <div><small>AUTOMATIC SIGNING</small><b>{autonomyLive?'ACTIVE':'OFF'}</b></div>
    </div>
    {error&&<div className={styles.notice}>{error}</div>}
    <div className={styles.notice}>{autonomyLive?'A bounded executor is reporting active. Ecology still requires verified realized profit and separate reproduction rules before any birth or self-modification can unlock.':performanceLedgerReady?'The Factory ledger is available, but Ecology stays locked: automatic signing is OFF and complete realized-profit coverage is required before future birth logic.':'Ecology is intentionally gated. Apply the Factory ledger migration and complete verified cost coverage before performance can become economic DNA.'}</div>
   </section>

   <section className={styles.timeline}>
    {STAGES.map(stage=><article className={styles.stage} key={stage.key}>
      <div className={styles.stageRail}><span>{stage.n}</span><i/></div>
      <div className={styles.stageBody}><div className={styles.stageTop}><small>{stage.name}</small>{badge(stageState[stage.key])}</div><h3>{stage.title}</h3><p>{stage.body}</p></div>
    </article>)}
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>ECONOMIC DNA</small><h2>What could become inheritable</h2></div><span className={styles.protocol}>VERSIONED · AUDITABLE · BOUNDED</span></div>
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
    <div className={styles.panelHead}><div><small>THE ORGANISM MARKET</small><h2>Agents can become useful before they can spend.</h2></div>{badge('LOCKED')}</div>
    <div className={styles.roles}>
     <article><span>SCOUT</span><h3>Finds markets</h3><p>Discovers unusual liquidity, offer velocity and opportunity clusters.</p><strong>OUTPUT → SIGNALS</strong></article>
     <article><span>PRICER / SENTINEL</span><h3>Scores price + risk</h3><p>Checks collection quality, concentration, downside and live pricing context.</p><strong>OUTPUT → PRICE + RISK</strong></article>
     <article><span>MAKER</span><h3>Drafts the next voxel</h3><p>Uses verified profit constraints to propose a next candidate without minting it.</p><strong>OUTPUT → CANDIDATE</strong></article>
     <article><span>EXECUTOR</span><h3>Future bounded action</h3><p>Mint/list execution stays locked until explicit permissions, limits and approvals are independently verified.</p><strong>OUTPUT → APPROVAL REQUEST</strong></article>
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>NATURAL SELECTION</small><h2>Survival is economic, not cosmetic</h2></div></div>
    <div className={styles.flow}>
     <div><b>1</b><span>Verified performance</span></div><i>→</i>
     <div><b>2</b><span>Reputation + demand</span></div><i>→</i>
     <div><b>3</b><span>Bounded mutation</span></div><i>→</i>
     <div><b>4</b><span>Approved descendants</span></div><i>→</i>
     <div><b>5</b><span>Species formation</span></div>
    </div>
    <p className={styles.disclaimer}>No profit, valuation, birth, royalty or survival outcome is guaranteed. Ecology must only unlock from verified settled activity and explicit protocol rules. It must never bypass wallet permissions, spending limits, allowlists, loss breakers or the kill switch.</p>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>NEXT BUILD</small><h2>The real prerequisites</h2></div><span className={styles.protocol}>FOUNDATION</span></div>
    <div className={styles.nextBuild}>
     <div><b>01</b><h3>Complete ledger coverage</h3><p>The Factory ledger exists in code; production must have its migration and verified sale-fee/production-cost coverage before net profit can be trusted.</p></div>
     <div><b>02</b><h3>Generation queue</h3><p>Let Maker draft candidates under inventory and reinvestment limits without spending or minting.</p></div>
     <div><b>03</b><h3>Bounded approvals</h3><p>Only after testing should an executor accept tightly scoped mint/list approvals. Automatic signing remains a separate future decision.</p></div>
    </div>
    <div className={styles.actions}><a href={factoryHref}>Open Factory</a><a href={autopilotHref}>Back to Autopilot</a>{sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>Mint page</a>}<a href="/studio#my-voxels">My Voxels</a></div>
   </section>
  </div>

  <footer className={styles.footer}><span>VOXELFLIP · ECOLOGY</span><a href="/studio">VoxelPop Studio</a></footer>
 </main>;
}
