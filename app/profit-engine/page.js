'use client';

import {useState} from 'react';
import {BrowserProvider,Contract,Interface,formatEther,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../lib/wallet-connect';
import styles from './profit.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const EXECUTOR_ABI=[
  'function executeUniThenAero(uint24 uniFee,bool aeroStable,uint256 minUsdcOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'function executeAeroThenUni(uint24 uniFee,bool aeroStable,uint256 minUsdcOut,uint256 minWethOut,uint256 minProfitWei,uint256 deadline) payable returns (uint256 grossProfitWei)',
  'event ArbitrageExecuted(bytes32 indexed route,uint256 capitalWei,uint256 finalWei,uint256 grossProfitWei,uint256 minProfitWei)',
];

function errText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Action failed.')}
function prettyEth(value){try{return Number(formatEther(BigInt(value))).toFixed(8)}catch{return '—'}}
function prettyPct(bps){return `${(Number(bps)/100).toFixed(2)}%`}
function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}

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
  const [tx,setTx]=useState(null);

  async function runScan(){
    setBusy(true);setError('');setStatus('Reading live WETH/USDC routes on Base…');setTx(null);
    try{
      const response=await fetch('/api/profit-engine/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountEth,targetBps:Number(targetBps),slippageBps:Number(slippageBps)}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Base scan failed.');
      setScan(data);
      setStatus(data.best?`Candidate found. Quote clears the ${prettyPct(data.targetBps)} target after the conservative gas budget.`:'No trade. Neither cross-DEX route clears your net-profit threshold right now.');
    }catch(e){setError(errText(e));setStatus('');setScan(null)}finally{setBusy(false)}
  }

  async function connect(){
    setError('');
    const provider=await discoverMetaMaskProvider();
    if(!provider){window.location.href=getMetaMaskDeepLink(window.location.href);return}
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
    setInjected(provider);setWallet(getAddress(accounts[0]));
  }

  async function execute(op){
    if(!op?.passes)throw new Error('This route does not clear the profit floor.');
    if(!scan?.executorAddress)throw new Error('The atomic executor is not deployed/activated yet.');
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
      await ensureBase(provider);
      const browserProvider=new BrowserProvider(provider);
      const signer=await browserProvider.getSigner(connectedWallet);
      const contract=new Contract(getAddress(scan.executorAddress),EXECUTOR_ABI,signer);
      const deadline=Math.floor(Date.now()/1000)+Number(op.params.deadlineSeconds||90);
      const args=[Number(op.params.uniFee),Boolean(op.params.aeroStable),BigInt(op.params.minUsdcOut),BigInt(op.params.minWethOut),BigInt(op.params.minProfitWei),BigInt(deadline)];
      const fn=contract.getFunction(op.method);
      setStatus('Running the exact atomic transaction as a no-spend simulation…');
      await fn.staticCall(...args,{value:BigInt(op.inputWei)});
      const gas=await fn.estimateGas(...args,{value:BigInt(op.inputWei)});
      const feeData=await browserProvider.getFeeData();
      const feePerGas=feeData.maxFeePerGas||feeData.gasPrice||0n;
      const estimatedWalletGas=gas*feePerGas;
      const gross=BigInt(op.grossProfitWei);
      const target=BigInt(op.targetProfitWei);
      if(gross-estimatedWalletGas<target)throw new Error('Trade blocked: fresh wallet gas estimate removes the required net profit.');
      setStatus(`Simulation passed. MetaMask will show one atomic Base transaction using ${op.inputEth} ETH. If the profit floor disappears, the transaction reverts.`);
      const sent=await fn(...args,{value:BigInt(op.inputWei),gasLimit:(gas*120n)/100n});
      setTx({hash:sent.hash,pending:true});setStatus('Transaction submitted. Waiting for Base confirmation…');
      const receipt=await sent.wait();
      if(!receipt||receipt.status!==1)throw new Error('Atomic arbitrage transaction failed.');
      const iface=new Interface(EXECUTOR_ABI);let event=null;
      for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='ArbitrageExecuted'){event=parsed;break}}catch{}}
      const grossProfit=event?event.args.grossProfitWei.toString():op.grossProfitWei;
      const actualGas=(receipt.gasUsed||0n)*(receipt.gasPrice||feePerGas||0n);
      const net=BigInt(grossProfit)-actualGas;
      setTx({hash:receipt.hash||sent.hash,pending:false,grossProfitWei:grossProfit,gasWei:actualGas.toString(),netWei:net.toString()});
      setStatus(`Confirmed. Gross spread captured: ${prettyEth(grossProfit)} ETH; transaction gas: ${prettyEth(actualGas)} ETH; estimated wallet net: ${prettyEth(net)} ETH.`);
      await runScan();
    }catch(e){setError(errText(e));setStatus('')}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio">Voxel Vault · Profit Engine</a><span>BASE · SOLO MODE</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>SOLO BASE PROFIT ENGINE V1</small><h1>Scan first.<br/><em>Trade only profit.</em></h1><p>Live WETH/USDC cross-DEX quotes. The engine hard-stops unless the projected round trip covers starting capital, a conservative Base gas budget, and your required net-profit threshold.</p></header>

      <section className={styles.panel}>
        <div className={styles.guardrail}><b>ATOMIC RULE</b><span>No market-order guessing. A live candidate must clear the scanner threshold, then the exact executor call must pass a fresh no-spend simulation and wallet gas estimate before MetaMask is allowed to submit it.</span></div>
        <div className={styles.form}>
          <div className={styles.field}><label>CAPITAL · ETH</label><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} inputMode="decimal"/></div>
          <div className={styles.field}><label>MIN NET · BPS</label><input value={targetBps} onChange={e=>setTargetBps(e.target.value)} inputMode="numeric"/></div>
          <div className={styles.field}><label>SLIPPAGE · BPS</label><input value={slippageBps} onChange={e=>setSlippageBps(e.target.value)} inputMode="numeric"/></div>
          <button className={styles.primary} onClick={runScan} disabled={busy}>{busy?'SCANNING…':'SCAN BASE NOW'}</button>
        </div>
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {scan&&<div className={styles.summary}>
          <div className={styles.stat}><small>PAIR</small><b>{scan.pair}</b></div>
          <div className={styles.stat}><small>GAS BUDGET</small><b>{prettyEth(scan.gasBudgetWei)} ETH</b></div>
          <div className={styles.stat}><small>NET TARGET</small><b>{prettyPct(scan.targetBps)}</b></div>
          <div className={styles.stat}><small>EXECUTOR</small><b>{scan.executionEnabled?short(scan.executorAddress):'LOCKED'}</b></div>
        </div>}
      </section>

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Live routes</h2><span>{new Date(scan.scannedAt).toLocaleTimeString()} · {scan.rule}</span></div>{!wallet&&<button className={styles.secondary} onClick={()=>connect().catch(e=>setError(errText(e)))}>CONNECT METAMASK</button>}</div>
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
          {op.passes&&scan.executionEnabled?<button className={styles.execute} disabled={busy} onClick={()=>execute(op)}>SIMULATE + EXECUTE ATOMICALLY</button>:op.passes?<div className={styles.lock}><b>EXECUTION LOCKED</b><br/>Scanner works now. Live spending stays disabled until the reviewed BaseArbExecutor deployment address is pinned in production.</div>:null}
        </article>)}</div>
        <div className={styles.footnote}>Scanner venues in v1: Uniswap V3 fee tiers 0.01%, 0.05%, 0.30%, 1.00% and Aerodrome classic stable/volatile WETH-USDC pools. A quote is not a guarantee of profit; execution remains blocked unless the atomic transaction itself simulates successfully at the current state.</div>
      </section>}

      {tx&&<section className={styles.panel}><div className={styles.tx}>{tx.pending?'PENDING':'CONFIRMED'} · <a style={{color:'inherit'}} href={`${BASE_EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{tx.hash}</a>{tx.netWei&&<><br/>Estimated wallet net after transaction gas: {prettyEth(tx.netWei)} ETH</>}</div></section>}
    </div>
  </main>;
}
