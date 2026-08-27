'use client';

import {useEffect,useRef,useState} from 'react';
import {BrowserProvider,Contract,Interface,formatEther,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../lib/wallet-connect';
import styles from './profit.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const EXECUTOR_STORAGE_KEY='voxelvault.baseArbExecutor.v1';
const APPROVED_OWNER=getAddress('0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb');
const EXECUTOR_ABI=[
  'function executeUniThenAero(uint24 uniFee,bool aeroStable,uint256 minUsdcOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'function executeAeroThenUni(uint24 uniFee,bool aeroStable,uint256 minUsdcOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'event ArbitrageExecuted(bytes32 indexed route,uint256 capitalWei,uint256 finalWei,uint256 grossProfitWei,uint256 minProfitWei)',
];
const VERIFY_ABI=[
  'function owner() view returns (address)',
  'function BASE_CHAIN_ID() view returns (uint256)',
  'function WETH() view returns (address)',
  'function USDC() view returns (address)',
  'function UNISWAP_SWAP_ROUTER_02() view returns (address)',
  'function AERODROME_ROUTER() view returns (address)',
  'function AERODROME_FACTORY() view returns (address)',
];
const EXPECTED={
  weth:getAddress('0x4200000000000000000000000000000000000006'),
  usdc:getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  uni:getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
  aero:getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'),
  factory:getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da'),
};

function errText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Action failed.')}
function prettyEth(value){try{return Number(formatEther(BigInt(value))).toFixed(8)}catch{return '—'}}
function prettyPct(bps){return `${(Number(bps)/100).toFixed(2)}%`}
function prettyBps(value){const n=Number(value);return Number.isFinite(n)?`${n} bps`:'—'}
function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function venueMeta(quote){
  if(!quote)return '—';
  if(quote.fee!==null&&quote.fee!==undefined)return `${quote.venue} · fee ${quote.fee}`;
  if(quote.stable!==null&&quote.stable!==undefined)return `${quote.venue} · ${quote.stable?'stable':'volatile'}`;
  if(quote.tickSpacing!==null&&quote.tickSpacing!==undefined)return `${quote.venue} · tick ${quote.tickSpacing}`;
  return quote.venue;
}

async function ensureBase(provider){
  let chain=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chain===BASE_CHAIN_ID)return;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_CHAIN_ID}]})}
  catch(error){
    if(error?.code===4001)throw new Error('Base network switch was cancelled.');
    if(error?.code!==4902)throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:BASE_CHAIN_ID,chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[BASE_RPC],blockExplorerUrls:[BASE_EXPLORER]}]});
  }
  chain=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chain!==BASE_CHAIN_ID)throw new Error('Switch MetaMask to Base before execution.');
}

async function verifyExecutor(address,browserProvider){
  const candidate=getAddress(address);
  let lastError=null;
  for(let attempt=0;attempt<5;attempt+=1){
    try{
      const code=await browserProvider.getCode(candidate);
      if(!code||code==='0x')throw new Error('Executor code is not visible from the wallet RPC yet.');
      const verify=new Contract(candidate,VERIFY_ABI,browserProvider);
      const owner=await verify.owner();
      const chainId=await verify.BASE_CHAIN_ID();
      const weth=await verify.WETH();
      const usdc=await verify.USDC();
      const uni=await verify.UNISWAP_SWAP_ROUTER_02();
      const aero=await verify.AERODROME_ROUTER();
      const aeroFactory=await verify.AERODROME_FACTORY();
      const ok=getAddress(owner)===APPROVED_OWNER&&BigInt(chainId)===BigInt(8453)&&getAddress(weth)===EXPECTED.weth&&getAddress(usdc)===EXPECTED.usdc&&getAddress(uni)===EXPECTED.uni&&getAddress(aero)===EXPECTED.aero&&getAddress(aeroFactory)===EXPECTED.factory;
      if(!ok)throw new Error('Executor verification failed. Trading blocked.');
      return candidate;
    }catch(error){
      lastError=error;
      if(/Executor verification failed/i.test(errText(error)))break;
      if(attempt<4)await wait(700*(attempt+1));
    }
  }
  throw lastError||new Error('Executor verification failed. Trading blocked.');
}

export default function ProfitEnginePage(){
  const [amountEth,setAmountEth]=useState('0.01');
  const [targetBps,setTargetBps]=useState('5');
  const [slippageBps,setSlippageBps]=useState('15');
  const [scan,setScan]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [wallet,setWallet]=useState('');
  const [injected,setInjected]=useState(null);
  const [localExecutor,setLocalExecutor]=useState('');
  const [executorVerified,setExecutorVerified]=useState(false);
  const [tx,setTx]=useState(null);
  const [autoWatch,setAutoWatch]=useState(true);
  const [scanCount,setScanCount]=useState(0);
  const [lastScanAt,setLastScanAt]=useState('');
  const scanInFlightRef=useRef(false);
  const autoCycleRef=useRef(0);
  const nextDelayRef=useRef(12000);
  const manualPauseRef=useRef(false);

  useEffect(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const fromUrl=params.get('executor');
      const saved=window.localStorage.getItem(EXECUTOR_STORAGE_KEY);
      if(saved){setLocalExecutor(getAddress(saved));setExecutorVerified(true);return}
      if(fromUrl){
        setLocalExecutor(getAddress(fromUrl));
        setExecutorVerified(false);
        setStatus('Existing executor detected. Verify it now—this does not deploy or spend anything.');
      }
    }catch{}
  },[]);

  useEffect(()=>{
    if(!autoWatch)return undefined;
    let cancelled=false;
    let timer=null;
    const tick=async()=>{
      if(cancelled)return;
      autoCycleRef.current+=1;
      const mode=autoCycleRef.current===1||autoCycleRef.current%8===0?'wide':'fast';
      await runScan({mode,automatic:true});
      if(!cancelled)timer=setTimeout(tick,nextDelayRef.current);
    };
    timer=setTimeout(tick,700);
    return()=>{cancelled=true;if(timer)clearTimeout(timer)};
  },[autoWatch,amountEth,targetBps,slippageBps]);

  useEffect(()=>{
    const resumeWhenVisible=()=>{
      if(document.visibilityState!=='visible')return;
      if(manualPauseRef.current||scan?.best||busy)return;
      autoCycleRef.current=0;
      nextDelayRef.current=4000;
      setAutoWatch(true);
    };
    document.addEventListener('visibilitychange',resumeWhenVisible);
    window.addEventListener('pageshow',resumeWhenVisible);
    return()=>{
      document.removeEventListener('visibilitychange',resumeWhenVisible);
      window.removeEventListener('pageshow',resumeWhenVisible);
    };
  },[scan?.best,busy]);

  function toggleAutoWatch(){
    if(autoWatch){
      manualPauseRef.current=true;
      setAutoWatch(false);
      setStatus('BOSS AUTO WATCH PAUSED BY YOU. Tap TURN BOSS AUTO WATCH ON to resume hunting.');
      return;
    }
    manualPauseRef.current=false;
    autoCycleRef.current=0;
    nextDelayRef.current=4000;
    setAutoWatch(true);
    setStatus('BOSS AUTO WATCH ON · scanning immediately and adapting cadence to market heat.');
  }

  async function runScan({mode='wide',automatic=false}={}){
    if(scanInFlightRef.current)return;
    scanInFlightRef.current=true;
    if(!automatic)setBusy(true);
    setError('');
    if(!automatic)setTx(null);
    if(!automatic)setStatus(mode==='wide'?'Running V5 boss scan: executable matrix + wide market radar…':'Refreshing boss executable matrix…');
    try{
      const response=await fetch('/api/profit-engine/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountEth,targetBps:Number(targetBps),slippageBps:Number(slippageBps),preferFlashblocks:true,mode}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Base scan failed.');
      setScan(previous=>{
        if(mode!=='fast'||!previous?.wideMarkets)return data;
        return {
          ...data,
          wideMarkets:previous.wideMarkets,
          wideScanError:previous.wideScanError,
          coverage:{
            ...data.coverage,
            widePairsRequested:previous.coverage?.widePairsRequested||0,
            widePairsQuoted:previous.coverage?.widePairsQuoted||0,
            wideVenues:previous.coverage?.wideVenues||[],
            slipstreamTickSpacings:previous.coverage?.slipstreamTickSpacings||[],
          },
        };
      });
      setScanCount(value=>value+1);
      setLastScanAt(new Date().toLocaleTimeString());
      const suggested=Math.max(4000,Math.min(15000,Number(data.suggestedCadenceMs||12000)));
      nextDelayRef.current=suggested;
      const source=data.flashblocks?'Flashblocks pending state':'sealed Base state fallback';
      const sizes=data.executionSizesScanned||1;
      const heat=String(data.marketHeat||'COLD');
      if(data.best){
        setStatus(`PROFIT FLOOR CLEARED on ${source} after checking ${sizes} sizes. Auto-watch paused. Tap SIMULATE + EXECUTE ATOMICALLY; the wallet will re-check the exact trade before anything is sent.`);
        try{navigator.vibrate?.([200,100,200])}catch{}
        try{document.title='PROFIT FOUND · Voxel Vault'}catch{}
        if(automatic)setAutoWatch(false);
      }else{
        try{document.title='Profit Engine V5 · Voxel Vault'}catch{}
        const gap=Number(data.nearMiss?.distanceToProfitFloorBps??data.bestQuoted?.distanceToProfitFloorBps??0);
        if(!automatic){
          manualPauseRef.current=false;
          autoCycleRef.current=0;
          setAutoWatch(true);
        }
        if(automatic&&heat==='HOT'){
          setStatus(`BOSS BURST · closest executable route is about ${gap} bps short of gas + target. Scanning again in ~${Math.round(suggested/1000)}s.`);
        }else if(automatic&&heat==='WARM'){
          setStatus(`BOSS WATCH · market is warming. Closest route is about ${gap} bps short of the profit floor; next scan in ~${Math.round(suggested/1000)}s.`);
        }else if(automatic){
          setStatus(`AUTO WATCHING · ${sizes} sizes checked on ${source}. No trade clears gas + ${prettyPct(data.targetBps)} net yet; next scan in ~${Math.round(suggested/1000)}s.`);
        }else{
          const wideQuoted=data.coverage?.widePairsQuoted||0;
          const wideRequested=data.coverage?.widePairsRequested||0;
          setStatus(mode==='wide'
            ?`No executable trade right now. Checked ${sizes} sizes plus ${wideQuoted}/${wideRequested} wide Base pairs. BOSS AUTO WATCH IS ON and will keep hunting.`
            :`No executable trade right now after checking ${sizes} sizes. BOSS AUTO WATCH IS ON and will keep hunting.`);
        }
      }
    }catch(e){
      nextDelayRef.current=12000;
      if(!automatic){setError(errText(e));setStatus('')}
      else setStatus(`AUTO WATCH retrying · last scan error: ${errText(e)}`);
    }finally{
      scanInFlightRef.current=false;
      if(!automatic)setBusy(false);
    }
  }

  async function connect(){
    setError('');
    const provider=await discoverMetaMaskProvider();
    if(!provider){window.location.href=getMetaMaskDeepLink(window.location.href);return}
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
    const address=getAddress(accounts[0]);
    if(address!==APPROVED_OWNER)throw new Error(`Connect the reviewed Profit Engine owner wallet ${APPROVED_OWNER}.`);
    setInjected(provider);setWallet(address);
    return {provider,address};
  }

  async function activateExecutor(){
    if(!localExecutor)throw new Error('No existing executor address was provided.');
    setBusy(true);setError('');setTx(null);
    try{
      let provider=injected;
      if(!provider){
        const connected=await connect();
        if(!connected)return;
        provider=connected.provider;
      }
      await ensureBase(provider);
      const browserProvider=new BrowserProvider(provider);
      setStatus('Re-reading the deployed executor from Base. No transaction will be sent…');
      const verified=await verifyExecutor(localExecutor,browserProvider);
      window.localStorage.setItem(EXECUTOR_STORAGE_KEY,verified);
      setLocalExecutor(verified);setExecutorVerified(true);
      manualPauseRef.current=false;
      setAutoWatch(true);
      setStatus('Executor verified and activated on this device. Boss auto-watch is ON and scanning.');
    }catch(e){
      if(/Executor verification failed/i.test(errText(e))){
        try{window.localStorage.removeItem(EXECUTOR_STORAGE_KEY)}catch{}
        setExecutorVerified(false);
      }
      setError(errText(e));setStatus('');
    }finally{setBusy(false)}
  }

  async function execute(op){
    if(!op?.passes)throw new Error('This route does not clear the profit floor.');
    const candidate=scan?.executorAddress||(executorVerified?localExecutor:'');
    if(!candidate)throw new Error('Verify the existing BaseArbExecutor first.');
    setBusy(true);setError('');setTx(null);setAutoWatch(false);
    try{
      let provider=injected;
      let connectedWallet=wallet;
      if(!provider){
        provider=await discoverMetaMaskProvider();
        if(!provider){window.location.href=getMetaMaskDeepLink(window.location.href);return}
        const accounts=await provider.request({method:'eth_requestAccounts'});
        if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
        connectedWallet=getAddress(accounts[0]);setInjected(provider);setWallet(connectedWallet);
      }
      if(getAddress(connectedWallet)!==APPROVED_OWNER)throw new Error(`Connect the reviewed Profit Engine owner wallet ${APPROVED_OWNER}.`);
      await ensureBase(provider);
      const browserProvider=new BrowserProvider(provider);
      const executorAddress=await verifyExecutor(candidate,browserProvider);
      if(!scan?.executorAddress){
        window.localStorage.setItem(EXECUTOR_STORAGE_KEY,executorAddress);
        setLocalExecutor(executorAddress);setExecutorVerified(true);
      }
      const signer=await browserProvider.getSigner(connectedWallet);
      const contract=new Contract(executorAddress,EXECUTOR_ABI,signer);
      const deadline=Math.floor(Date.now()/1000)+Number(op.params.deadlineSeconds||90);
      const args=[Number(op.params.uniFee),Boolean(op.params.aeroStable),BigInt(op.params.minUsdcOut),BigInt(op.params.minWethOut),BigInt(op.params.minProfitWei),BigInt(deadline)];
      const fn=contract.getFunction(op.method);
      setStatus('Running the exact atomic transaction as a fresh no-spend wallet simulation…');
      const simulatedGross=BigInt(await fn.staticCall(...args,{value:BigInt(op.inputWei)}));
      const gas=await fn.estimateGas(...args,{value:BigInt(op.inputWei)});
      const feeData=await browserProvider.getFeeData();
      const feePerGas=feeData.maxFeePerGas||feeData.gasPrice||0n;
      const estimatedWalletGas=gas*feePerGas;
      const target=BigInt(op.targetProfitWei);
      if(simulatedGross-estimatedWalletGas<target)throw new Error('Trade blocked: the fresh atomic simulation plus wallet gas estimate no longer clears your net-profit target.');
      setStatus(`Simulation passed with ${prettyEth(simulatedGross)} ETH gross spread. MetaMask will show one atomic Base transaction using ${op.inputEth} ETH. If the profit floor disappears, the transaction reverts.`);
      const sent=await fn(...args,{value:BigInt(op.inputWei),gasLimit:(gas*120n)/100n});
      setTx({hash:sent.hash,pending:true});setStatus('Transaction submitted. Waiting for Base confirmation…');
      const receipt=await sent.wait();
      if(!receipt||receipt.status!==1)throw new Error('Atomic arbitrage transaction failed.');
      const iface=new Interface(EXECUTOR_ABI);let event=null;
      for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='ArbitrageExecuted'){event=parsed;break}}catch{}}
      const grossProfit=event?event.args.grossProfitWei.toString():simulatedGross.toString();
      const actualGas=(receipt.gasUsed||0n)*(receipt.gasPrice||feePerGas||0n);
      const net=BigInt(grossProfit)-actualGas;
      setTx({hash:receipt.hash||sent.hash,pending:false,grossProfitWei:grossProfit,gasWei:actualGas.toString(),netWei:net.toString()});
      manualPauseRef.current=false;
      setAutoWatch(true);
      setStatus(`Confirmed. Gross spread captured: ${prettyEth(grossProfit)} ETH; transaction gas: ${prettyEth(actualGas)} ETH; estimated wallet net: ${prettyEth(net)} ETH. BOSS AUTO WATCH is back ON for the next opportunity.`);
    }catch(e){
      if(!scan?.executorAddress&&/Executor verification failed/i.test(errText(e))){
        try{window.localStorage.removeItem(EXECUTOR_STORAGE_KEY)}catch{}
        setExecutorVerified(false);
      }
      setError(errText(e));setStatus('');
    }finally{setBusy(false)}
  }

  const executorReady=Boolean(scan?.executionEnabled||(localExecutor&&executorVerified));
  const displayedExecutor=scan?.executionEnabled?scan.executorAddress:localExecutor;
  const widePairs=scan?.wideMarkets?.pairs||[];
  const marketHeat=String(scan?.marketHeat||'COLD');
  const nearMiss=scan?.nearMiss||(!scan?.best?scan?.bestQuoted:null);

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio">Voxel Vault · Profit Engine</a><span>BASE · V5 BOSS MODE</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>PROFIT ENGINE V5 · BOSS SCAN</small><h1>Hunt faster.<br/><em>Attack only real edge.</em></h1><p>V5 batches six capital sizes against one Base state source, parallelizes venue quotes, ranks every route by distance to the on-chain profit floor, and automatically enters burst mode when the market gets close.</p></header>

      <section className={styles.panel}>
        <div className={styles.guardrail}><b>EXECUTION RULE</b><span>Boss auto-watch only reads quotes. It never signs or submits anything. A candidate still needs conservative gas + profit clearance, live executor verification, a fresh static simulation, a fresh wallet gas estimate, and your MetaMask approval.</span></div>
        <div className={styles.form}>
          <div className={styles.field}><label>MAX CAPITAL · ETH</label><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} inputMode="decimal"/></div>
          <div className={styles.field}><label>MIN NET · BPS</label><input value={targetBps} onChange={e=>setTargetBps(e.target.value)} inputMode="numeric"/></div>
          <div className={styles.field}><label>SLIPPAGE · BPS</label><input value={slippageBps} onChange={e=>setSlippageBps(e.target.value)} inputMode="numeric"/></div>
          <button className={styles.primary} onClick={()=>runScan({mode:'wide',automatic:false})} disabled={busy}>{busy?'SCANNING BASE…':'RUN BOSS WIDE SCAN + KEEP WATCHING'}</button>
          <button className={styles.secondary} style={{width:'100%'}} onClick={toggleAutoWatch} disabled={busy}>{autoWatch?`PAUSE BOSS AUTO WATCH · ${marketHeat}`:'TURN BOSS AUTO WATCH ON'}</button>
        </div>
        <div className={styles.footnote}>Manual Boss Wide Scan automatically keeps auto-watch ON unless a real profitable candidate is being held. V5 dynamically watches about every 12 seconds in cold markets, about 7 seconds when warm, and as fast as about 4 seconds in HOT near-miss conditions. Returning to the foreground resumes watching unless you explicitly paused it.</div>
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {nearMiss&&!scan?.best&&<div className={styles.status}>Closest executable: {nearMiss.first?.venue} → {nearMiss.second?.venue} at {nearMiss.inputEth} ETH. It is about {nearMiss.distanceToProfitFloorBps} bps ({prettyEth(nearMiss.distanceToProfitFloorWei)} ETH) short of gas + your profit target. V5 automatically speeds up as that gap closes.</div>}
        {scan&&<div className={styles.summary}>
          <div className={styles.stat}><small>EXECUTION SIZES</small><b>{scan.executionSizesScanned||1}</b></div>
          <div className={styles.stat}><small>MARKET HEAT</small><b>{marketHeat}</b></div>
          <div className={styles.stat}><small>WIDE PAIRS</small><b>{scan.coverage?.widePairsQuoted||0}/{scan.coverage?.widePairsRequested||0}</b></div>
          <div className={styles.stat}><small>NET TARGET</small><b>{prettyPct(scan.targetBps)}</b></div>
          <div className={styles.stat}><small>BATCH LATENCY</small><b>{scan.batchLatencyMs?`${scan.batchLatencyMs} ms`:'—'}</b></div>
          <div className={styles.stat}><small>AUTO WATCH</small><b>{autoWatch?'ON':'PAUSED'}</b></div>
          <div className={styles.stat}><small>SCANS THIS PAGE</small><b>{scanCount}</b></div>
          <div className={styles.stat}><small>LAST CHECK</small><b>{lastScanAt||'—'}</b></div>
          <div className={styles.stat}><small>EXECUTOR</small><b>{executorReady?`${short(displayedExecutor)}${scan.executionEnabled?'':' · DEVICE'}`:localExecutor?`${short(localExecutor)} · VERIFY`:'LOCKED'}</b></div>
        </div>}
        {localExecutor&&!executorVerified&&!scan?.executionEnabled&&<button className={styles.secondary} style={{width:'100%',marginTop:14}} onClick={()=>activateExecutor()} disabled={busy}>{busy?'VERIFYING…':'VERIFY EXISTING EXECUTOR →'}</button>}
        {!localExecutor&&!scan?.executionEnabled&&<a className={styles.secondary} style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}} href="/profit-engine/deploy">DEPLOY REVIEWED EXECUTOR →</a>}
      </section>

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Executable matrix</h2><span>{scan.executionSizesScanned||1} sizes · WETH/USDC · {scan.stateMode} · {scan.rpcSource}</span></div>{!wallet&&<button className={styles.secondary} onClick={()=>connect().catch(e=>setError(errText(e)))}>CONNECT METAMASK</button>}</div>
        <div className={styles.grid}>{scan.opportunities.map(op=><article key={op.id} className={`${styles.card} ${op.passes?styles.good:''}`}>
          <span className={styles.badge}>{op.passes?'PROFIT FLOOR CLEARED':Number(op.distanceToProfitFloorBps)<=5?'NEAR MISS':'NO TRADE'}</span>
          <div className={styles.route}>{op.first.venue} → {op.second.venue}</div>
          <div className={styles.leg}><span>CAPITAL</span><b>{prettyEth(op.inputWei)} ETH</b></div>
          <div className={styles.leg}><span>LEG 1</span><b>{venueMeta(op.first)}</b></div>
          <div className={styles.leg}><span>LEG 2</span><b>{venueMeta(op.second)}</b></div>
          <div className={styles.numbers}>
            <div className={styles.number}><span>Quoted final</span><b>{prettyEth(op.finalWei)} WETH</b></div>
            <div className={styles.number}><span>Gross spread</span><b className={BigInt(op.grossProfitWei)>0n?styles.positive:styles.negative}>{prettyEth(op.grossProfitWei)} ETH</b></div>
            <div className={styles.number}><span>Net after gas</span><b className={BigInt(op.netAfterGasWei)>0n?styles.positive:styles.negative}>{prettyEth(op.netAfterGasWei)} ETH · {prettyBps(op.netAfterGasBps)}</b></div>
            <div className={styles.number}><span>Profit-floor margin</span><b className={BigInt(op.marginToProfitFloorWei)>=0n?styles.positive:styles.negative}>{prettyBps(op.marginToProfitFloorBps)}</b></div>
          </div>
          {op.passes&&executorReady?<button className={styles.execute} disabled={busy} onClick={()=>execute(op)}>SIMULATE + EXECUTE ATOMICALLY</button>:op.passes?<div className={styles.lock}><b>EXECUTION LOCKED</b><br/>{localExecutor?'Verify the existing executor above.':<a style={{color:'inherit'}} href="/profit-engine/deploy">Deploy the reviewed executor</a>}</div>:null}
        </article>)}</div>
        <div className={styles.footnote}>This is the only execution-capable section. Six adaptive sizes never exceed MAX CAPITAL. V5 ranks by margin to the actual contract profit floor, not by a raw price difference. Every real attempt still gets a fresh wallet simulation immediately before MetaMask.</div>
      </section>}

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Wide market radar</h2><span>{scan.coverage?.widePairsQuoted||0}/{scan.coverage?.widePairsRequested||0} pairs · {(scan.coverage?.wideVenues||[]).join(' + ')||'read-only discovery'}</span></div></div>
        {scan.wideScanError&&<div className={styles.status}>Wide radar was partial on this scan: {scan.wideScanError}</div>}
        {widePairs.length?<div className={styles.grid}>{widePairs.map(pair=>{
          const signal=pair.bestRaw;
          const positive=signal&&BigInt(signal.grossSpreadWei)>0n;
          return <article key={pair.pair} className={`${styles.card} ${positive?styles.good:''}`}>
            <span className={styles.badge}>{signal?'RAW MARKET SIGNAL':'NO ROUTE'}</span>
            <div className={styles.route}>{pair.pair}</div>
            {signal?<>
              <div className={styles.leg}><span>LEG 1</span><b>{venueMeta(signal.first)}</b></div>
              <div className={styles.leg}><span>LEG 2</span><b>{venueMeta(signal.second)}</b></div>
              <div className={styles.numbers}>
                <div className={styles.number}><span>Sample size</span><b>{pair.sampleInputEth} ETH</b></div>
                <div className={styles.number}><span>Raw spread</span><b className={positive?styles.positive:styles.negative}>{prettyEth(signal.grossSpreadWei)} ETH</b></div>
                <div className={styles.number}><span>Raw spread rate</span><b className={positive?styles.positive:styles.negative}>{prettyBps(signal.grossSpreadBps)}</b></div>
                <div className={styles.number}><span>Status</span><b>{signal.executionCompatibility==='CURRENT_EXECUTOR'?'CHECKED AGAIN ABOVE':'WATCH ONLY'}</b></div>
              </div>
            </>:<p className={styles.footnote}>No complete cross-venue round trip was quotable for this pair on this state.</p>}
          </article>;
        })}</div>:<div className={styles.status}>No additional wide-market routes were available on this scan.</div>}
        <div className={styles.footnote}>Radar values are raw quote differences before a route-specific gas model, slippage reserve, contract compatibility check, or wallet simulation. They remain discovery-only so V5 never mistakes a raw price discrepancy for guaranteed profit.</div>
      </section>}

      <section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Machine revenue API</h2><span>Read-only intelligence · x402 v2 · Base USDC</span></div></div>
        <div className={styles.grid}>
          <article className={styles.card}>
            <span className={styles.badge}>FREE DISCOVERY</span>
            <div className={styles.route}>Manifest + OpenAPI</div>
            <div className={styles.leg}><span>MANIFEST</span><b>/api/agent/manifest</b></div>
            <div className={styles.leg}><span>SCHEMA</span><b>/api/agent/openapi</b></div>
            <p className={styles.footnote}>Agents can inspect capabilities, request shapes, network, safety limits, prices, and whether the x402 receiver/facilitator are activated.</p>
            <a className={styles.secondary} style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}} href="/api/agent/manifest" target="_blank" rel="noreferrer">OPEN MACHINE MANIFEST</a>
          </article>
          <article className={styles.card}>
            <span className={styles.badge}>X402 PAID</span>
            <div className={styles.route}>Quote + Optimize</div>
            <div className={styles.leg}><span>BASE QUOTE</span><b>/api/agent/base-quote</b></div>
            <div className={styles.leg}><span>MULTI-SIZE</span><b>/api/agent/optimize</b></div>
            <p className={styles.footnote}>Unpaid requests receive the standard PAYMENT-REQUIRED challenge. Paid requests are verified and settled before the market-intelligence response is released.</p>
            <a className={styles.secondary} style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}} href="/api/agent/openapi" target="_blank" rel="noreferrer">OPEN API SCHEMA</a>
          </article>
        </div>
      </section>

      {tx&&<section className={styles.panel}><div className={styles.tx}>{tx.pending?'PENDING':'CONFIRMED'} · <a style={{color:'inherit'}} href={`${BASE_EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{tx.hash}</a>{tx.netWei&&<><br/>Estimated wallet net after transaction gas: {prettyEth(tx.netWei)} ETH</>}</div></section>}
    </div>
  </main>;
}
