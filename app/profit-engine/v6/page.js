'use client';

import {useEffect,useRef,useState} from 'react';
import {BrowserProvider,Contract,Interface,formatEther,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import styles from '../profit.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const MULTI_EXECUTOR_STORAGE_KEY='voxelvault.baseMultiArbExecutor.v2';
const APPROVED_OWNER=getAddress('0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb');
const EXPECTED={
  weth:getAddress('0x4200000000000000000000000000000000000006'),
  usdc:getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  cbbtc:getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'),
  cbeth:getAddress('0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'),
  aeroToken:getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),
  uni:getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
  aeroRouter:getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'),
  aeroFactory:getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da'),
};
const EXECUTOR_ABI=[
  'function executeUniThenAero(address quoteToken,uint24 uniFee,bool aeroStable,uint256 minQuoteOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'function executeAeroThenUni(address quoteToken,uint24 uniFee,bool aeroStable,uint256 minQuoteOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'event MultiArbitrageExecuted(bytes32 indexed route,address indexed quoteToken,uint256 capitalWei,uint256 finalWei,uint256 grossProfitWei,uint256 minProfitWei)',
];
const VERIFY_ABI=[
  'function owner() view returns (address)',
  'function BASE_CHAIN_ID() view returns (uint256)',
  'function WETH() view returns (address)',
  'function USDC() view returns (address)',
  'function CBBTC() view returns (address)',
  'function CBETH() view returns (address)',
  'function AERO() view returns (address)',
  'function UNISWAP_SWAP_ROUTER_02() view returns (address)',
  'function AERODROME_ROUTER() view returns (address)',
  'function AERODROME_FACTORY() view returns (address)',
  'function isSupportedQuoteToken(address token) view returns (bool)',
];

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

async function verifyMultiExecutor(address,browserProvider){
  const candidate=getAddress(address);
  let lastError=null;
  for(let attempt=0;attempt<5;attempt+=1){
    try{
      const code=await browserProvider.getCode(candidate);
      if(!code||code==='0x')throw new Error('Multi-pair executor code is not visible from the wallet RPC yet.');
      const verify=new Contract(candidate,VERIFY_ABI,browserProvider);
      const [owner,chainId,weth,usdc,cbbtc,cbeth,aeroToken,uni,aeroRouter,aeroFactory,s1,s2,s3,s4]=await Promise.all([
        verify.owner(),verify.BASE_CHAIN_ID(),verify.WETH(),verify.USDC(),verify.CBBTC(),verify.CBETH(),verify.AERO(),verify.UNISWAP_SWAP_ROUTER_02(),verify.AERODROME_ROUTER(),verify.AERODROME_FACTORY(),
        verify.isSupportedQuoteToken(EXPECTED.usdc),verify.isSupportedQuoteToken(EXPECTED.cbbtc),verify.isSupportedQuoteToken(EXPECTED.cbeth),verify.isSupportedQuoteToken(EXPECTED.aeroToken),
      ]);
      const ok=getAddress(owner)===APPROVED_OWNER&&BigInt(chainId)===BigInt(8453)&&getAddress(weth)===EXPECTED.weth&&getAddress(usdc)===EXPECTED.usdc&&getAddress(cbbtc)===EXPECTED.cbbtc&&getAddress(cbeth)===EXPECTED.cbeth&&getAddress(aeroToken)===EXPECTED.aeroToken&&getAddress(uni)===EXPECTED.uni&&getAddress(aeroRouter)===EXPECTED.aeroRouter&&getAddress(aeroFactory)===EXPECTED.aeroFactory&&s1&&s2&&s3&&s4;
      if(!ok)throw new Error('Multi-pair executor verification failed. Trading blocked.');
      return candidate;
    }catch(error){
      lastError=error;
      if(/verification failed/i.test(errText(error)))break;
      if(attempt<4)await wait(700*(attempt+1));
    }
  }
  throw lastError||new Error('Multi-pair executor verification failed. Trading blocked.');
}

export default function ProfitEngineV6Page(){
  const [amountEth,setAmountEth]=useState('0.01');
  const [targetBps,setTargetBps]=useState('5');
  const [slippageBps,setSlippageBps]=useState('15');
  const [scan,setScan]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [autoWatch,setAutoWatch]=useState(true);
  const [wallet,setWallet]=useState('');
  const [injected,setInjected]=useState(null);
  const [localExecutor,setLocalExecutor]=useState('');
  const [executorVerified,setExecutorVerified]=useState(false);
  const [tx,setTx]=useState(null);
  const [scanCount,setScanCount]=useState(0);
  const [lastScanAt,setLastScanAt]=useState('');
  const scanInFlightRef=useRef(false);
  const nextDelayRef=useRef(12000);
  const manualPauseRef=useRef(false);

  useEffect(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const fromUrl=params.get('executor');
      const saved=window.localStorage.getItem(MULTI_EXECUTOR_STORAGE_KEY);
      if(saved){setLocalExecutor(getAddress(saved));setExecutorVerified(true);return}
      if(fromUrl){setLocalExecutor(getAddress(fromUrl));setExecutorVerified(false);setStatus('Existing V6 executor detected. Verify it—this read-only step costs no gas.');}
    }catch{}
  },[]);

  useEffect(()=>{
    if(!autoWatch)return undefined;
    let cancelled=false;
    let timer=null;
    const tick=async()=>{
      if(cancelled)return;
      await runScan(true);
      if(!cancelled)timer=setTimeout(tick,nextDelayRef.current);
    };
    timer=setTimeout(tick,600);
    return()=>{cancelled=true;if(timer)clearTimeout(timer)};
  },[autoWatch,amountEth,targetBps,slippageBps]);

  useEffect(()=>{
    const resume=()=>{
      if(document.visibilityState!=='visible'||manualPauseRef.current||scan?.best||busy)return;
      nextDelayRef.current=4000;
      setAutoWatch(true);
    };
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pageshow',resume);
    return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',resume)};
  },[scan?.best,busy]);

  function toggleWatch(){
    if(autoWatch){manualPauseRef.current=true;setAutoWatch(false);setStatus('V6 AUTO WATCH PAUSED BY YOU.');return}
    manualPauseRef.current=false;nextDelayRef.current=4000;setAutoWatch(true);setStatus('V6 AUTO WATCH ON · scanning all four executable pairs.');
  }

  async function runScan(automatic=false){
    if(scanInFlightRef.current)return;
    scanInFlightRef.current=true;
    if(!automatic)setBusy(true);
    setError('');
    if(!automatic)setTx(null);
    if(!automatic)setStatus('Scanning WETH/USDC, WETH/cbBTC, WETH/cbETH and WETH/AERO across Uniswap V3 ↔ Aerodrome…');
    try{
      const response=await fetch('/api/profit-engine/multipair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountEth,targetBps:Number(targetBps),slippageBps:Number(slippageBps),preferFlashblocks:true}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'V6 Base scan failed.');
      setScan(data);setScanCount(value=>value+1);setLastScanAt(new Date().toLocaleTimeString());
      nextDelayRef.current=Math.max(4000,Math.min(15000,Number(data.suggestedCadenceMs||12000)));
      if(data.best){
        const ready=Boolean(data.executionEnabled||(localExecutor&&executorVerified));
        setStatus(ready
          ?`PROFIT FLOOR CLEARED · ${data.best.pair} · ${data.best.inputEth} ETH. Auto-watch paused so you can run the fresh simulation.`
          :`PROFITABLE V6 CANDIDATE FOUND · ${data.best.pair}. The V6 multi-pair executor is not active on this device yet. Deploying it costs gas and the opportunity may disappear, so a fresh scan is required after deployment.`);
        try{navigator.vibrate?.([200,100,200])}catch{}
        setAutoWatch(false);
      }else{
        const gap=Number(data.bestQuoted?.distanceToProfitFloorBps||0);
        const heat=String(data.marketHeat||'COLD');
        setStatus(`${automatic?'AUTO WATCH':'SCAN COMPLETE'} · ${data.routesQuoted||0} routes across ${data.pairsScanned||4} pairs. ${heat}. Closest route is about ${gap} bps short of gas + target. Next watch ~${Math.round(nextDelayRef.current/1000)}s.`);
        if(!automatic){manualPauseRef.current=false;setAutoWatch(true)}
      }
    }catch(e){
      nextDelayRef.current=12000;
      if(automatic)setStatus(`V6 AUTO WATCH retrying · ${errText(e)}`);else{setError(errText(e));setStatus('')}
    }finally{scanInFlightRef.current=false;if(!automatic)setBusy(false)}
  }

  async function connect(){
    setError('');
    const provider=await discoverMetaMaskProvider();
    if(!provider){window.location.href=getMetaMaskDeepLink(window.location.href);return}
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
    const address=getAddress(accounts[0]);
    if(address!==APPROVED_OWNER)throw new Error(`Connect the reviewed Profit Engine owner wallet ${APPROVED_OWNER}.`);
    await ensureBase(provider);setInjected(provider);setWallet(address);return {provider,address};
  }

  async function activateExecutor(){
    if(!localExecutor)throw new Error('No V6 executor address was provided.');
    setBusy(true);setError('');
    try{
      let provider=injected;
      if(!provider){const connected=await connect();if(!connected)return;provider=connected.provider}
      const browserProvider=new BrowserProvider(provider);
      setStatus('Verifying the V6 executor live on Base. No transaction is sent…');
      const verified=await verifyMultiExecutor(localExecutor,browserProvider);
      window.localStorage.setItem(MULTI_EXECUTOR_STORAGE_KEY,verified);
      setLocalExecutor(verified);setExecutorVerified(true);manualPauseRef.current=false;setAutoWatch(true);
      setStatus('V6 multi-pair executor verified and activated on this device. Fresh scan running next.');
    }catch(e){setError(errText(e));setStatus('');setExecutorVerified(false)}finally{setBusy(false)}
  }

  async function execute(op){
    if(!op?.passes)throw new Error('This route does not clear the V6 profit floor.');
    const candidate=scan?.executorAddress||(executorVerified?localExecutor:'');
    if(!candidate)throw new Error('Deploy and verify the V6 multi-pair executor first.');
    setBusy(true);setError('');setTx(null);setAutoWatch(false);
    try{
      let provider=injected;let connectedWallet=wallet;
      if(!provider){provider=await discoverMetaMaskProvider();if(!provider){window.location.href=getMetaMaskDeepLink(window.location.href);return}const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');connectedWallet=getAddress(accounts[0]);setInjected(provider);setWallet(connectedWallet)}
      if(getAddress(connectedWallet)!==APPROVED_OWNER)throw new Error(`Connect the reviewed Profit Engine owner wallet ${APPROVED_OWNER}.`);
      await ensureBase(provider);
      const browserProvider=new BrowserProvider(provider);
      const executorAddress=await verifyMultiExecutor(candidate,browserProvider);
      if(!scan?.executorAddress){window.localStorage.setItem(MULTI_EXECUTOR_STORAGE_KEY,executorAddress);setLocalExecutor(executorAddress);setExecutorVerified(true)}
      const signer=await browserProvider.getSigner(connectedWallet);
      const contract=new Contract(executorAddress,EXECUTOR_ABI,signer);
      const deadline=Math.floor(Date.now()/1000)+Number(op.params.deadlineSeconds||75);
      const args=[getAddress(op.params.quoteToken),Number(op.params.uniFee),Boolean(op.params.aeroStable),BigInt(op.params.minQuoteOut),BigInt(op.params.minWethOut),BigInt(op.params.minProfitWei),BigInt(deadline)];
      const fn=contract.getFunction(op.method);
      setStatus(`Fresh simulation · ${op.pair} · ${op.inputEth} ETH. No transaction yet…`);
      const simulatedGross=BigInt(await fn.staticCall(...args,{value:BigInt(op.inputWei)}));
      const gas=await fn.estimateGas(...args,{value:BigInt(op.inputWei)});
      const feeData=await browserProvider.getFeeData();
      const feePerGas=feeData.maxFeePerGas||feeData.gasPrice||0n;
      const estimatedWalletGas=gas*feePerGas;
      const target=BigInt(op.targetProfitWei);
      if(simulatedGross-estimatedWalletGas<target)throw new Error('Trade blocked: fresh simulation plus current wallet gas no longer clears your net-profit target.');
      setStatus(`Simulation passed. MetaMask will show one atomic Base transaction using ${op.inputEth} ETH. The contract still reverts if its profit floor disappears.`);
      const sent=await fn(...args,{value:BigInt(op.inputWei),gasLimit:(gas*120n)/100n});
      setTx({hash:sent.hash,pending:true});setStatus('V6 transaction submitted. Waiting for Base confirmation…');
      const receipt=await sent.wait();
      if(!receipt||receipt.status!==1)throw new Error('V6 atomic arbitrage transaction failed.');
      const iface=new Interface(EXECUTOR_ABI);let event=null;
      for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='MultiArbitrageExecuted'){event=parsed;break}}catch{}}
      const grossProfit=event?event.args.grossProfitWei.toString():simulatedGross.toString();
      const actualGas=(receipt.gasUsed||0n)*(receipt.gasPrice||feePerGas||0n);
      const net=BigInt(grossProfit)-actualGas;
      setTx({hash:receipt.hash||sent.hash,pending:false,grossProfitWei:grossProfit,gasWei:actualGas.toString(),netWei:net.toString()});
      setStatus(`CONFIRMED · gross spread ${prettyEth(grossProfit)} ETH · gas ${prettyEth(actualGas)} ETH · estimated wallet net ${prettyEth(net)} ETH.`);
      manualPauseRef.current=false;setAutoWatch(true);
    }catch(e){setError(errText(e));setStatus('')}finally{setBusy(false)}
  }

  const executorReady=Boolean(scan?.executionEnabled||(localExecutor&&executorVerified));
  const displayedExecutor=scan?.executionEnabled?scan.executorAddress:localExecutor;
  const opportunities=scan?.opportunities||[];
  const top=opportunities.slice(0,12);

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/profit-engine">← V5</a><span>BASE · V6 MULTI-PAIR</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>PROFIT ENGINE V6 · FOUR EXECUTABLE PAIRS</small><h1>Scan wider.<br/><em>Still refuse bad trades.</em></h1><p>V6 deep-scans WETH/USDC, WETH/cbBTC, WETH/cbETH, and WETH/AERO across Uniswap V3 and Aerodrome, with three capital sizes per pair and a conservative gas-adjusted profit floor.</p></header>
      <section className={styles.panel}>
        <div className={styles.guardrail}><b>NO GUARANTEED PROFIT</b><span>V6 only exposes an execute button after a live quote clears conservative gas + your target. Every transaction then gets a second static simulation, current gas estimate, live contract verification, and your MetaMask approval.</span></div>
        <div className={styles.form}>
          <div className={styles.field}><label>MAX CAPITAL · ETH</label><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} inputMode="decimal"/></div>
          <div className={styles.field}><label>MIN NET · BPS</label><input value={targetBps} onChange={e=>setTargetBps(e.target.value)} inputMode="numeric"/></div>
          <div className={styles.field}><label>SLIPPAGE · BPS</label><input value={slippageBps} onChange={e=>setSlippageBps(e.target.value)} inputMode="numeric"/></div>
          <button className={styles.primary} onClick={()=>runScan(false)} disabled={busy}>{busy?'SCANNING…':'SCAN ALL 4 EXECUTABLE PAIRS'}</button>
          <button className={styles.secondary} style={{width:'100%'}} onClick={toggleWatch} disabled={busy}>{autoWatch?`PAUSE V6 AUTO WATCH · ${scan?.marketHeat||'SCANNING'}`:'TURN V6 AUTO WATCH ON'}</button>
        </div>
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {scan&&<div className={styles.summary}>
          <div className={styles.stat}><small>PAIRS</small><b>{scan.pairsScanned||4}</b></div>
          <div className={styles.stat}><small>ROUTES QUOTED</small><b>{scan.routesQuoted||0}</b></div>
          <div className={styles.stat}><small>MARKET HEAT</small><b>{scan.marketHeat||'—'}</b></div>
          <div className={styles.stat}><small>NET TARGET</small><b>{prettyPct(scan.targetBps)}</b></div>
          <div className={styles.stat}><small>LATENCY</small><b>{scan.batchLatencyMs?`${scan.batchLatencyMs} ms`:'—'}</b></div>
          <div className={styles.stat}><small>SCANS</small><b>{scanCount}</b></div>
          <div className={styles.stat}><small>LAST CHECK</small><b>{lastScanAt||'—'}</b></div>
          <div className={styles.stat}><small>V6 EXECUTOR</small><b>{executorReady?`${short(displayedExecutor)}${scan.executionEnabled?'':' · DEVICE'}`:'NOT DEPLOYED'}</b></div>
        </div>}
        {localExecutor&&!executorVerified&&!scan?.executionEnabled&&<button className={styles.secondary} style={{width:'100%',marginTop:14}} onClick={activateExecutor} disabled={busy}>{busy?'VERIFYING…':'VERIFY EXISTING V6 EXECUTOR →'}</button>}
        {!executorReady&&<a className={styles.secondary} style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}} href="/profit-engine/v6/deploy">V6 EXECUTOR UPGRADE →</a>}
      </section>

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Gas-adjusted executable routes</h2><span>{scan.stateMode} · {scan.rpcSource} · 3 sizes/pair</span></div>{!wallet&&<button className={styles.secondary} onClick={()=>connect().catch(e=>setError(errText(e)))}>CONNECT METAMASK</button>}</div>
        <div className={styles.grid}>{top.map(op=><article key={op.id} className={`${styles.card} ${op.passes?styles.good:''}`}>
          <span className={styles.badge}>{op.passes?'PROFIT FLOOR CLEARED':Number(op.distanceToProfitFloorBps)<=5?'NEAR MISS':'NO TRADE'}</span>
          <div className={styles.route}>{op.pair}</div>
          <div className={styles.leg}><span>PATH</span><b>{op.first.venue} → {op.second.venue}</b></div>
          <div className={styles.leg}><span>CAPITAL</span><b>{op.inputEth} ETH</b></div>
          <div className={styles.leg}><span>LEG 1</span><b>{venueMeta(op.first)}</b></div>
          <div className={styles.leg}><span>LEG 2</span><b>{venueMeta(op.second)}</b></div>
          <div className={styles.numbers}>
            <div className={styles.number}><span>Gross spread</span><b className={BigInt(op.grossProfitWei)>0n?styles.positive:styles.negative}>{prettyEth(op.grossProfitWei)} ETH</b></div>
            <div className={styles.number}><span>Gas budget</span><b>-{prettyEth(op.gasBudgetWei)} ETH</b></div>
            <div className={styles.number}><span>Net after gas</span><b className={BigInt(op.netAfterGasWei)>0n?styles.positive:styles.negative}>{prettyEth(op.netAfterGasWei)} ETH · {prettyBps(op.netAfterGasBps)}</b></div>
            <div className={styles.number}><span>Profit-floor margin</span><b className={BigInt(op.marginToProfitFloorWei)>=0n?styles.positive:styles.negative}>{prettyBps(op.marginToProfitFloorBps)}</b></div>
          </div>
          {op.passes&&executorReady?<button className={styles.execute} onClick={()=>execute(op)} disabled={busy}>SIMULATE + EXECUTE ATOMICALLY</button>:op.passes?<div className={styles.lock}><b>V6 EXECUTOR REQUIRED</b><br/>Deploy the reviewed multi-pair executor, then scan again. The current opportunity may not survive deployment.</div>:null}
        </article>)}</div>
        <div className={styles.footnote}>No route here is a promise of profit. Quotes can move before signing. The execute button triggers a fresh no-spend contract simulation and current gas estimate before MetaMask can submit anything.</div>
      </section>}

      {tx&&<section className={styles.panel}><div className={styles.tx}>{tx.pending?'PENDING':'CONFIRMED'} · <a style={{color:'inherit'}} href={`${BASE_EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{tx.hash}</a>{tx.netWei&&<><br/>Estimated wallet net after transaction gas: {prettyEth(tx.netWei)} ETH</>}</div></section>}
    </div>
  </main>;
}
