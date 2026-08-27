'use client';

import {useEffect,useState} from 'react';
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
function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

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
  const [targetBps,setTargetBps]=useState('25');
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

  async function runScan(){
    setBusy(true);setError('');setStatus('Reading Base Flashblocks pending state and live WETH/USDC routes…');setTx(null);
    try{
      const response=await fetch('/api/profit-engine/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountEth,targetBps:Number(targetBps),slippageBps:Number(slippageBps),preferFlashblocks:true}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Base scan failed.');
      setScan(data);
      const source=data.flashblocks?'Flashblocks pending state':'sealed Base state fallback';
      setStatus(data.best?`Candidate found on ${source}. Quote clears the ${prettyPct(data.targetBps)} target after the conservative gas budget.`:`No trade on ${source}. Neither cross-DEX route clears your net-profit threshold right now.`);
    }catch(e){setError(errText(e));setStatus('');setScan(null)}finally{setBusy(false)}
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
      setStatus('Executor verified and activated on this device. Scan Flashblocks now.');
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
    setBusy(true);setError('');setTx(null);
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
      setStatus(`Confirmed. Gross spread captured: ${prettyEth(grossProfit)} ETH; transaction gas: ${prettyEth(actualGas)} ETH; estimated wallet net: ${prettyEth(net)} ETH. Scan again for the next opportunity.`);
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

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio">Voxel Vault · Profit Engine</a><span>BASE · V2 MACHINE LAYER</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>PROFIT ENGINE V2 · FLASHBLOCKS + X402</small><h1>See sooner.<br/><em>Sell the intelligence.</em></h1><p>The scanner prefers Base pre-confirmed Flashblocks state, enforces the net-profit gate, and can immediately use a reviewed executor verified on this device after deployment.</p></header>

      <section className={styles.panel}>
        <div className={styles.guardrail}><b>EXECUTION RULE</b><span>A candidate must clear the scanner, the executor address is re-verified live against the reviewed owner/router constants, and the exact call must pass a fresh no-spend simulation plus wallet gas estimate before MetaMask can submit it.</span></div>
        <div className={styles.form}>
          <div className={styles.field}><label>CAPITAL · ETH</label><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} inputMode="decimal"/></div>
          <div className={styles.field}><label>MIN NET · BPS</label><input value={targetBps} onChange={e=>setTargetBps(e.target.value)} inputMode="numeric"/></div>
          <div className={styles.field}><label>SLIPPAGE · BPS</label><input value={slippageBps} onChange={e=>setSlippageBps(e.target.value)} inputMode="numeric"/></div>
          <button className={styles.primary} onClick={runScan} disabled={busy}>{busy?'SCANNING…':'SCAN FLASHBLOCKS NOW'}</button>
        </div>
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {scan&&<div className={styles.summary}>
          <div className={styles.stat}><small>PAIR</small><b>{scan.pair}</b></div>
          <div className={styles.stat}><small>STATE</small><b>{scan.flashblocks?'FLASHBLOCKS':'SEALED FALLBACK'}</b></div>
          <div className={styles.stat}><small>NET TARGET</small><b>{prettyPct(scan.targetBps)}</b></div>
          <div className={styles.stat}><small>EXECUTOR</small><b>{executorReady?`${short(displayedExecutor)}${scan.executionEnabled?'':' · DEVICE'}`:localExecutor?`${short(localExecutor)} · VERIFY`:'LOCKED'}</b></div>
        </div>}
        {localExecutor&&!executorVerified&&!scan?.executionEnabled&&<button className={styles.secondary} style={{width:'100%',marginTop:14}} onClick={()=>activateExecutor()} disabled={busy}>{busy?'VERIFYING…':'VERIFY EXISTING EXECUTOR →'}</button>}
        {!localExecutor&&!scan?.executionEnabled&&<a className={styles.secondary} style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}} href="/profit-engine/deploy">DEPLOY REVIEWED EXECUTOR →</a>}
      </section>

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Live routes</h2><span>{new Date(scan.scannedAt).toLocaleTimeString()} · {scan.stateMode} · {scan.rpcSource}</span></div>{!wallet&&<button className={styles.secondary} onClick={()=>connect().catch(e=>setError(errText(e)))}>CONNECT METAMASK</button>}</div>
        <div className={styles.grid}>{scan.opportunities.map(op=><article key={op.id} className={`${styles.card} ${op.passes?styles.good:''}`}>
          <span className={styles.badge}>{op.passes?'PROFIT FLOOR CLEARED':'NO TRADE'}</span>
          <div className={styles.route}>{op.first.venue} → {op.second.venue}</div>
          <div className={styles.leg}><span>LEG 1</span><b>{op.first.venue}{op.first.fee?` · fee ${op.first.fee}`:''}{op.first.stable!==null?` · ${op.first.stable?'stable':'volatile'}`:''}</b></div>
          <div className={styles.leg}><span>LEG 2</span><b>{op.second.venue}{op.second.fee?` · fee ${op.second.fee}`:''}{op.second.stable!==null?` · ${op.second.stable?'stable':'volatile'}`:''}</b></div>
          <div className={styles.numbers}>
            <div className={styles.number}><span>Start</span><b>{prettyEth(op.inputWei)} ETH</b></div>
            <div className={styles.number}><span>Quoted final</span><b>{prettyEth(op.finalWei)} WETH</b></div>
            <div className={styles.number}><span>Gross spread</span><b className={BigInt(op.grossProfitWei)>0n?styles.positive:styles.negative}>{prettyEth(op.grossProfitWei)} ETH</b></div>
            <div className={styles.number}><span>Conservative gas</span><b>-{prettyEth(op.gasBudgetWei)} ETH</b></div>
            <div className={styles.number}><span>Net after gas</span><b className={BigInt(op.netAfterGasWei)>0n?styles.positive:styles.negative}>{prettyEth(op.netAfterGasWei)} ETH</b></div>
          </div>
          {op.passes&&executorReady?<button className={styles.execute} disabled={busy} onClick={()=>execute(op)}>SIMULATE + EXECUTE ATOMICALLY</button>:op.passes?<div className={styles.lock}><b>EXECUTION LOCKED</b><br/>{localExecutor?'Verify the existing executor above.':<a style={{color:'inherit'}} href="/profit-engine/deploy">Deploy the reviewed executor</a>}</div>:null}
        </article>)}</div>
        <div className={styles.footnote}>The scanner prefers the official Base Flashblocks pre-confirmation RPC and quotes against pending sequencer state. A quote is never a profit guarantee. No wallet transaction is offered unless the candidate clears the configured net target, and the final executor call is simulated again immediately before MetaMask.</div>
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
