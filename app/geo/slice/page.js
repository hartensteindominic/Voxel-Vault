'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWalletIdentity } from '../../components/WalletIdentity';
import styles from './page.module.css';

function toCents(value){const n=Number(value||0);return Number.isFinite(n)?Math.round(n*100):0}
function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(cents||0)/100)}
function referenceMoney(value){const n=Number(value||0);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'$0'}
function percent(value){const n=Number(value||0);if(!Number.isFinite(n))return'0%';return n>0&&n<0.0001?`${n.toExponential(3)}%`:`${n.toFixed(6)}%`}
function indexLabel(value){const n=Number(value||0);return Number.isFinite(n)?`${n.toFixed(1)}x`:'—'}

export default function PropertySlicePage(){
  const {address,connected,connect}=useWalletIdentity();
  const [slice,setSlice]=useState({selectedName:'Reference property',selectedPrice:'100000',benchmarkName:'My benchmark property',benchmarkPrice:'100000',amount:'1.99'});
  const [sliceResult,setSliceResult]=useState(null);
  const [sliceBusy,setSliceBusy]=useState(false);
  const [moneyInputs,setMoneyInputs]=useState({usd:'12.40',crypto:'0',nft:'0',property:'0'});
  const [moneyResult,setMoneyResult]=useState(null);
  const [moneyBusy,setMoneyBusy]=useState(false);
  const [message,setMessage]=useState('Sandbox slice preview');
  const shortWallet=useMemo(()=>address?`${address.slice(0,6)}…${address.slice(-4)}`:'',[address]);
  const selected=Number(slice.selectedPrice||0);const benchmark=Number(slice.benchmarkPrice||0);const amount=Number(slice.amount||0);
  const slicePercent=sliceResult?.hypotheticalPercent??(selected>0?(amount/selected)*100:0);
  const benchmarkWeight=sliceResult?.relativePropertyPriceIndex??(benchmark>0?selected/benchmark:0);
  const usdDisplay=moneyResult?money(moneyResult.balances.settledUsdCents):'$12.40';

  function changeSlice(key,value){setSlice(c=>({...c,[key]:value}))}
  function changeMoney(key,value){setMoneyInputs(c=>({...c,[key]:value}))}

  async function calculateSlice(event){event?.preventDefault?.();setSliceBusy(true);try{const r=await fetch('/api/geo/property-slice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'slice',amountCents:toCents(slice.amount),propertyReferencePriceCents:toCents(slice.selectedPrice),benchmarkReferencePriceCents:toCents(slice.benchmarkPrice)})});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||'Could not calculate Property Slice.');setSliceResult(d.result);setMessage('Slice saved in sandbox · no deed or funds transfer created.')}catch(e){setMessage(e instanceof Error?e.message:'Could not calculate Property Slice.')}finally{setSliceBusy(false)}}

  async function previewMoney(event){event?.preventDefault?.();setMoneyBusy(true);try{const r=await fetch('/api/geo/property-slice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'conversion_preview',settledUsdCents:toCents(moneyInputs.usd),estimatedCryptoValueCents:toCents(moneyInputs.crypto),estimatedNftValueCents:toCents(moneyInputs.nft),propertyGoalCents:toCents(moneyInputs.property)})});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||'Could not update Vault preview.');setMoneyResult(d.result);setMessage('Vault preview updated · only settled USD is spendable.')}catch(e){setMessage(e instanceof Error?e.message:'Could not update Vault preview.')}finally{setMoneyBusy(false)}}

  return <main className={styles.page}><div className={styles.phone}>
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}><VoxelLock/><strong>Voxel Vault</strong></Link>
      <button className={styles.avatarButton} type="button" onClick={connect} aria-label={connected?`Wallet ${shortWallet}`:'Connect wallet'}><PixelAvatar/><i className={connected?styles.online:styles.offline}/></button>
    </header>

    <section className={styles.heading}><h1>Property Slice</h1><p>Own a tiny piece of the digital property experience.</p></section>

    <form onSubmit={calculateSlice} className={styles.sliceForm}>
      <section className={styles.heroCard}>
        <VoxelScene/>
        <div className={styles.buySide}>
          <div className={styles.heroPrice}>{money(toCents(slice.amount))}</div>
          <button className={styles.buyButton} disabled={sliceBusy}><span className={styles.bag}>✚</span>{sliceBusy?'Saving…':'Buy Slice'}</button>
          <div className={styles.sandbox}>ⓘ Sandbox slice preview</div>
        </div>
      </section>

      <section className={styles.referenceCard}>
        <span className={styles.houseBadge}>⌂</span><span className={styles.referenceLabel}>Reference property:</span><strong>{referenceMoney(slice.selectedPrice)}</strong><span className={styles.chev}>›</span>
      </section>

      <section className={styles.metrics}>
        <div><PieIcon/><span><small>Your {money(toCents(slice.amount))} =</small><strong>{percent(slicePercent)}</strong></span></div>
        <div><BarsIcon/><span><small>Benchmark weight =</small><strong>{indexLabel(benchmarkWeight)}</strong></span></div>
      </section>

      <details className={styles.details}><summary>Change property values</summary><div className={styles.fields}>
        <label>Property name<input value={slice.selectedName} onChange={e=>changeSlice('selectedName',e.target.value)}/></label>
        <label>Property value<input inputMode="decimal" value={slice.selectedPrice} onChange={e=>changeSlice('selectedPrice',e.target.value)}/></label>
        <label>Slice amount<input inputMode="decimal" value={slice.amount} onChange={e=>changeSlice('amount',e.target.value)}/></label>
        <label>Benchmark value<input inputMode="decimal" value={slice.benchmarkPrice} onChange={e=>changeSlice('benchmarkPrice',e.target.value)}/></label>
      </div></details>
    </form>

    <section className={styles.assetGrid}>
      <AssetCard kind="property" art={<MiniHouse/>} label="Property" value={sliceResult?'Slice saved':'Slice ready'}/>
      <AssetCard kind="usd" art={<CashStack/>} label="USD" value={usdDisplay}/>
      <AssetCard kind="crypto" art={<EthMark/>} label="Crypto" value={connected?'Wallet linked':'0.025 ETH'} onClick={connect}/>
      <AssetCard kind="nft" art={<NftFrame/>} label="NFTs" value="2 items"/>
    </section>

    <section className={styles.convertCard}><h2>Convert path</h2><div className={styles.convertFlow}>
      <Flow art={<NftFrame/>} label="NFT"/><span>→</span><Flow art={<MarketStall/>} label="Sale"/><span>→</span><Flow art={<CashStack/>} label="USD"/><span>→</span><Flow art={<MiniHouse/>} label="Property"/>
    </div></section>

    <details className={styles.details}><summary>Update Vault balances</summary><form onSubmit={previewMoney} className={styles.fields}>
      <label>Settled USD<input value={moneyInputs.usd} onChange={e=>changeMoney('usd',e.target.value)}/></label>
      <label>Crypto estimated value<input value={moneyInputs.crypto} onChange={e=>changeMoney('crypto',e.target.value)}/></label>
      <label>NFT estimated value<input value={moneyInputs.nft} onChange={e=>changeMoney('nft',e.target.value)}/></label>
      <label>Property goal<input value={moneyInputs.property} onChange={e=>changeMoney('property',e.target.value)}/></label>
      <button className={styles.updateButton} disabled={moneyBusy}>{moneyBusy?'Updating…':'Update preview'}</button>
    </form></details>

    <div className={styles.status}>{message}</div>
    <nav className={styles.bottomNav}><Link href="/"><span>⌂</span><b>Home</b></Link><Link href="/geo"><span>◉</span><b>Explore</b></Link><Link href="/vault"><span>▣</span><b>Vault</b></Link><button onClick={connect}><span>☺</span><b>Profile</b></button></nav>
  </div></main>
}

function AssetCard({kind,art,label,value,onClick}){const Tag=onClick?'button':'div';return <Tag type={onClick?'button':undefined} onClick={onClick} className={`${styles.assetCard} ${styles[kind]}`}><div className={styles.assetArt}>{art}</div><b>{label}</b><small>{value}</small></Tag>}
function Flow({art,label}){return <div className={styles.flow}><div>{art}</div><b>{label}</b></div>}

function VoxelLock(){return <span className={styles.voxelLock}><i/><b>+</b></span>}
function PixelAvatar(){return <span className={styles.pixelAvatar}><i/><b/></span>}
function PieIcon(){return <span className={styles.pie}><i/></span>}
function BarsIcon(){return <span className={styles.bars}><i/><i/><i/></span>}

function VoxelScene(){return <svg className={styles.scene} viewBox="0 0 260 220" aria-hidden="true">
<defs><filter id="sh"><feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity=".18"/></filter></defs>
<g filter="url(#sh)"><polygon points="30,105 145,55 232,94 116,148" fill="#85c94b"/><polygon points="30,105 116,148 116,196 30,151" fill="#8f5b32"/><polygon points="116,148 232,94 232,142 116,196" fill="#6e452b"/>
<rect x="58" y="78" width="14" height="55" fill="#70451f"/><rect x="44" y="52" width="42" height="42" rx="4" fill="#76b83d"/><rect x="51" y="43" width="33" height="32" rx="4" fill="#8bc64b"/><rect x="39" y="66" width="35" height="30" rx="4" fill="#68a934"/>
<polygon points="94,91 145,69 188,86 137,110" fill="#f58a46"/><polygon points="102,78 139,56 178,72 141,94" fill="#f27636"/><rect x="105" y="91" width="66" height="49" fill="#f6eee0"/><polygon points="171,91 188,86 188,132 171,140" fill="#e3d7c4"/><rect x="129" y="111" width="17" height="29" fill="#8a572c"/><rect x="112" y="104" width="12" height="15" fill="#6cc7e1"/><rect x="151" y="101" width="12" height="15" fill="#6cc7e1"/><rect x="166" y="54" width="11" height="25" fill="#a98b78"/><rect x="171" y="38" width="10" height="10" fill="#eee7e4"/><rect x="176" y="25" width="11" height="11" fill="#f4eeee"/>
<rect x="90" y="147" width="22" height="7" fill="#d7c9b3"/><rect x="78" y="155" width="19" height="7" fill="#d7c9b3"/><rect x="68" y="163" width="17" height="7" fill="#d7c9b3"/>
<rect x="195" y="116" width="7" height="14" fill="#fff"/><rect x="205" y="112" width="7" height="14" fill="#fff"/><rect x="196" y="112" width="16" height="5" fill="#fff"/>
<rect x="187" y="133" width="8" height="8" fill="#ff7b77"/><rect x="194" y="134" width="7" height="7" fill="#ffd15b"/></g></svg>}
function MiniHouse(){return <span className={styles.miniHouse}><i/><b/></span>}
function CashStack(){return <span className={styles.cashStack}><i/><i/><b>$</b></span>}
function EthMark(){return <span className={styles.eth}>◆</span>}
function NftFrame(){return <span className={styles.nftFrame}><i>●</i></span>}
function MarketStall(){return <span className={styles.market}><i/><b/></span>}
