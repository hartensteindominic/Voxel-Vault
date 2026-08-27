'use client';

import {useState} from 'react';
import styles from '../profit-engine/profit.module.css';

function short(value){return value?`${String(value).slice(0,8)}…${String(value).slice(-6)}`:'—'}
function feeLabel(fee){return `${(Number(fee)/10000).toFixed(2)}%`}
function errorText(error){return String(error?.message||error||'Scan failed.')}

export default function LiquidityEnginePage(){
  const [width,setWidth]=useState('10');
  const [scan,setScan]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function runScan(){
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/liquidity-engine/scan',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({widthMultiples:Number(width),requireFlashblocks:true}),
        cache:'no-store',
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Liquidity scan failed.');
      setScan(data);
    }catch(e){setError(errorText(e));setScan(null)}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/profit-engine">Voxel Vault · Liquidity Engine</a><span>BASE · READ-ONLY PHASE 1</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <small>FLASHBLOCKS LIQUIDITY ENGINE</small>
        <h1>Watch fee activity.<br/><em>Deploy only with limits.</em></h1>
        <p>Reads WETH/USDC Uniswap V3 pools from Base Flashblocks pending state and compares fee-growth against sealed state. This scanner does not sign, deploy liquidity, or claim guaranteed APR.</p>
      </header>

      <section className={styles.panel}>
        <div className={styles.guardrail}><b>PHASE 1 SAFETY</b><span>The live scanner is read-only. Capital-moving liquidity contracts are separately bounded by owner-set inventory, per-position caps, active-position caps, tick alignment, pause, treasury routing, and emergency exit.</span></div>
        <div className={styles.form}>
          <div className={styles.field}><label>RANGE · TICK SPACING MULTIPLES</label><input value={width} onChange={e=>setWidth(e.target.value)} inputMode="numeric"/></div>
          <button className={styles.primary} onClick={runScan} disabled={busy}>{busy?'SCANNING…':'SCAN FLASHBLOCKS NOW'}</button>
        </div>
        {error&&<div className={styles.error}>{error}</div>}
        {scan&&<div className={styles.summary}>
          <div className={styles.stat}><small>STATE</small><b>{scan.stateMode}</b></div>
          <div className={styles.stat}><small>RPC</small><b>{scan.rpcHost}</b></div>
          <div className={styles.stat}><small>PAIR</small><b>{scan.pair}</b></div>
          <div className={styles.stat}><small>MANAGER</small><b>{scan.executionConfigured?short(scan.managerAddress):'NOT DEPLOYED'}</b></div>
        </div>}
      </section>

      {scan&&<section className={styles.panel}>
        <div className={styles.sectionHead}><div><h2>Uniswap V3 fee tiers</h2><span>{new Date(scan.scannedAt).toLocaleTimeString()} · pending activity signal only</span></div></div>
        <div className={styles.grid}>{scan.pools.map(pool=><article key={pool.poolAddress} className={`${styles.card} ${pool.feeGrowthChanged?styles.good:''}`}>
          <span className={styles.badge}>{pool.signal}</span>
          <div className={styles.route}>WETH/USDC · {feeLabel(pool.fee)}</div>
          <div className={styles.leg}><span>POOL</span><b>{short(pool.poolAddress)}</b></div>
          <div className={styles.leg}><span>PENDING TICK</span><b>{pool.pendingTick}</b></div>
          <div className={styles.leg}><span>RANGE TEMPLATE</span><b>{pool.suggestedRange.tickLower} → {pool.suggestedRange.tickUpper}</b></div>
          <div className={styles.numbers}>
            <div className={styles.number}><span>Liquidity raw</span><b>{pool.liquidityRaw}</b></div>
            <div className={styles.number}><span>Fee growth Δ token0 · X128</span><b>{pool.feeGrowthDelta0X128}</b></div>
            <div className={styles.number}><span>Fee growth Δ token1 · X128</span><b>{pool.feeGrowthDelta1X128}</b></div>
          </div>
        </article>)}</div>
        <div className={styles.footnote}>{scan.interpretation}</div>
      </section>}
    </div>
  </main>;
}
