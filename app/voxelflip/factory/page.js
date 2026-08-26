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

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>VOXELFLIP · FACTORY</em></nav>

  <header className={styles.hero}>
   <p className={styles.eyebrow}>SELL → LEDGER → RESERVE → REINVEST → DRAFT → APPROVE → MINT → LIST → REPEAT</p>
   <h1>The voxel<br/><em>factory loop.</em></h1>
   <span>Factory compounds only verified realized profit. Scout, Pricer, Risk and Maker can think continuously, but spending, minting, listing and signing stay approval-gated.</span>
  </header>

  <div className={styles.shell}>
   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>FACTORY MODE</small><h2>{factory?.automaticFactoryActive?'Running':'Approval-gated'}</h2></div><span className={`${styles.status} ${factory?.automaticFactoryActive?styles.statusOn:''}`}>{factory?.automaticFactoryActive?'AUTOMATIC · ON':'AUTOMATIC · OFF'}</span></div>
    {!wallet?<button className={styles.connect} onClick={connect} disabled={busy}>{busy?'Connecting…':'Connect Factory wallet'}</button>:<div className={styles.wallet}><div><small>FACTORY / SALE WALLET</small><b>{short(wallet)}</b></div><button onClick={refresh} disabled={busy}>{busy?'Checking…':'Refresh factory'}</button></div>}
    {error&&<div className={styles.notice}>{error}</div>}
    <div className={styles.grid4}>
     <article className={styles.metric}><small>EXTERNAL SALES · 30D</small><b>{factory?observed.verifiedExternalSales30d:'—'}</b></article>
     <article className={styles.metric}><small>GROSS SALE PROCEEDS</small><b>{factory?eth(observed.recognizedSaleProceedsEth):'—'}</b></article>
     <article className={styles.metric}><small>VERIFIED ETH COSTS</small><b>{factory?eth(ledger.verifiedCostEth):'—'}</b></article>
     <article className={styles.metric}><small>REALIZED PROFIT</small><b>{factory?(ledger.realizedProfitEth===null?'BLOCKED':eth(ledger.realizedProfitEth)):'—'}</b></article>
    </div>
    {factory&&<div className={styles.notice}>{factory.nextStep}</div>}
    {(ledger.warnings||[]).map((warning,i)=><div className={styles.notice} key={i}>{warning}</div>)}
    {factory?.checkedAt&&<p className={styles.riskText}>Last checked {time(factory.checkedAt)} · a gross sale is never treated as profit until required costs are present.</p>}
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>TRADING AGENTS</small><h2>Think like a desk. Sign like a vault.</h2></div><span className={styles.status}>AGENTS · ANALYSIS ONLY</span></div>
    <div className={styles.activity}>
     {(agents.length?agents:[
      {agent:'SCOUT',state:'observe',headline:'Waiting for scan',reason:'Connect a Factory wallet.',proposedAction:'Observe only.',requiresApproval:false},
      {agent:'PRICER',state:'observe',headline:'Waiting for market data',reason:'No live price input yet.',proposedAction:'Observe only.',requiresApproval:true},
      {agent:'RISK',state:'blocked',headline:'Ledger required',reason:'Costs must be verified.',proposedAction:'Block spending.',requiresApproval:true},
      {agent:'MAKER',state:'blocked',headline:'Profit required',reason:'No verified reinvestment budget yet.',proposedAction:'Keep candidate queued.',requiresApproval:true}
     ]).map((agent,i)=><div className={styles.event} key={`${agent.agent}-${i}`}><b>{agent.agent}</b><span><strong style={{color:'#f7f7f3'}}>{agent.headline}</strong><br/>{agent.reason}<br/>→ {agent.proposedAction}{agent.requiresApproval?' · approval required':''}</span></div>)}
    </div>
    <div className={styles.notice}>Agents may observe, score, wait and draft actions. They cannot independently spend ETH, mint, list, transfer or sign.</div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>THE LOOP</small><h2>One profitable sale can fund the next candidate.</h2></div><span className={styles.status}>PRINCIPAL SPENDING · BLOCKED</span></div>
    <div className={styles.activity}>
     {(factory?.loop||[
      {label:'External sale settles',ready:false},{label:'Verify net profit after costs',ready:false},{label:'Reserve capital',ready:false},{label:'Reinvest a capped slice',ready:false},{label:'Draft next voxel candidate',ready:false},{label:'Mint with approval',ready:false},{label:'List with approval',ready:false},{label:'Repeat after another sale',ready:false}
     ]).map((step,i)=><div className={styles.event} key={`${step.key||i}`}><b>{String(i+1).padStart(2,'0')}</b><span>{step.ready?'✓ ':'○ '}{step.label}</span></div>)}
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>CONSERVATIVE LIMITS</small><h2>Factory cannot snowball recklessly.</h2></div><span className={styles.status}>{factory?.killSwitch?'KILL SWITCH · ON':'KILL SWITCH · READY'}</span></div>
    <div className={styles.grid4}>
     <article className={styles.metric}><small>RESERVE</small><b>{factory?`${policy.reservePercent}%`:'—'}</b></article>
     <article className={styles.metric}><small>MAX REINVEST</small><b>{factory?`${policy.reinvestPercent}%`:'—'}</b></article>
     <article className={styles.metric}><small>MAX / CYCLE</small><b>{factory?eth(policy.maxReinvestPerCycleEth):'—'}</b></article>
     <article className={styles.metric}><small>CURRENT ALLOWANCE</small><b>{factory?eth(ledger.reinvestAllowanceEth):'—'}</b></article>
    </div>
    <div className={styles.guardrails}>
     <div className={styles.guardrail}><span>✓</span><p>Only settled external sales can enter the loop.</p></div>
     <div className={styles.guardrail}><span>✓</span><p>Unsold NFTs and self-trades never count as profit.</p></div>
     <div className={styles.guardrail}><span>✓</span><p>{policy.reservePercent??75}% stays reserved by default; at most {policy.reinvestPercent??25}% of verified profit can be considered.</p></div>
     <div className={styles.guardrail}><span>✓</span><p>Maximum {policy.maxFactoryMintsPerDay??3} Factory mints/day and {policy.maxFactoryInventory??5} Factory inventory items.</p></div>
     <div className={styles.guardrail}><span>✓</span><p>Every spend, mint and listing remains approval-gated until the bounded executor is separately installed and tested.</p></div>
    </div>
   </section>

   <section className={styles.panel}>
    <div className={styles.panelHead}><div><small>READINESS</small><h2>What exists before self-looping.</h2></div></div>
    <div className={styles.activity}>
     <div className={styles.event}><b>{readiness.openSea?'READY':'WAIT'}</b><span>OpenSea sale monitoring</span></div>
     <div className={styles.event}><b>{readiness.productionRpc?'READY':'WAIT'}</b><span>Production Base RPC</span></div>
     <div className={styles.event}><b>{readiness.profitLedger?'READY':'WAIT'}</b><span>Server-owned cost/profit ledger schema</span></div>
     <div className={styles.event}><b>{readiness.profitCycle?'READY':'WAIT'}</b><span>Complete verified costs + realized-profit threshold</span></div>
     <div className={styles.event}><b>{readiness.generationFactory?'READY':'WAIT'}</b><span>Internal factory generation queue</span></div>
     <div className={styles.event}><b>{readiness.boundedExecutor?'READY':'WAIT'}</b><span>Bounded mint/list executor</span></div>
    </div>
    <div className={styles.actions}>
     <a href={autopilotHref}>← Autopilot monitor</a>
     <a href="/studio">Create next voxel</a>
     <a href="/studio#my-voxels">My Voxels</a>
    </div>
    <p className={styles.riskText}>Factory is a compounding workflow, not a profit guarantee. It stops whenever verified net profit, cost coverage, inventory capacity or execution safety is missing.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href={autopilotHref}>← Autopilot</a><a href="/studio#my-voxels">My Voxels</a></footer>
 </main>;
}
