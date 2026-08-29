'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useWalletIdentity } from '../../components/WalletIdentity';
import styles from './page.module.css';

const SLICE_KEY='voxel-vault:property-slice-sandbox';
const PURCHASE_KEY='voxel-vault:property-slice-purchases';
const MONEY_KEY='voxel-vault:unified-money-preview';
const DEFAULT_DEMO_USD_CENTS=1240;
const toCents=(value)=>{const n=Number(value||0);return Number.isFinite(n)?Math.round(n*100):0};
const money=(cents)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(cents||0)/100);
const referenceMoney=(value)=>{const n=Number(value||0);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'$0'};
const percent=(value)=>{const n=Number(value||0);if(!Number.isFinite(n))return'0%';return n>0&&n<0.0001?`${n.toExponential(3)}%`:`${n.toFixed(6)}%`};
const indexLabel=(value)=>{const n=Number(value||0);return Number.isFinite(n)?`${n.toFixed(2)}×`:'—'};
const unitLabelFor=(count)=>Number(count)===1?'1 demo slice':`${Number(count)||0} demo slices`;

export default function PropertySlicePage(){
  const {address,connected,connect}=useWalletIdentity();
  const [slice,setSlice]=useState({selectedName:'Selected property',selectedPrice:'100000',benchmarkName:'My anchor property',benchmarkPrice:'100000',amount:'1.99'});
  const [sliceResult,setSliceResult]=useState(null);
  const [purchase,setPurchase]=useState({demoUsdCents:DEFAULT_DEMO_USD_CENTS,demoUnits:0,lastPurchase:null});
  const [sliceBusy,setSliceBusy]=useState(false);
  const [moneyInputs,setMoneyInputs]=useState({usd:'12.40',crypto:'0',nft:'0',property:'0'});
  const [moneyResult,setMoneyResult]=useState(null);
  const [moneyBusy,setMoneyBusy]=useState(false);
  const [message,setMessage]=useState('Sandbox mode · demo USD auto-refills when needed. No real funds or property rights move here.');
  const shortWallet=useMemo(()=>address?`${address.slice(0,6)}…${address.slice(-4)}`:'',[address]);
  const selected=Number(slice.selectedPrice||0);const benchmark=Number(slice.benchmarkPrice||0);const amount=Number(slice.amount||0);
  const benchmarkWeight=sliceResult?.relativePropertyPriceIndex??(benchmark>0?selected/benchmark:0);
  const adjustedCents=sliceResult?.adjustedTestPriceCents??(benchmark>0?Math.max(1,Math.round(toCents(slice.amount)*(selected/benchmark))):toCents(slice.amount));
  const slicePercent=sliceResult?.hypotheticalPercent??(benchmark>0?(amount/benchmark)*100:0);
  const needsDemoTopUp=adjustedCents>purchase.demoUsdCents;
  const demoUsdDisplay=money(purchase.demoUsdCents);
  const unitLabel=unitLabelFor(purchase.demoUnits);

  useEffect(()=>{try{
    const saved=JSON.parse(window.localStorage.getItem(SLICE_KEY)||'null');if(saved?.slice)setSlice(saved.slice);if(saved?.result)setSliceResult(saved.result);
    const savedPurchase=JSON.parse(window.localStorage.getItem(PURCHASE_KEY)||'null');
    if(savedPurchase?.demoUsdCents>=0){setPurchase({demoUsdCents:Number(savedPurchase.demoUsdCents),demoUnits:Number(savedPurchase.demoUnits||0),lastPurchase:savedPurchase.lastPurchase||null});setMoneyInputs(c=>({...c,usd:(Number(savedPurchase.demoUsdCents)/100).toFixed(2)}));}
    const savedMoney=JSON.parse(window.localStorage.getItem(MONEY_KEY)||'null');if(savedMoney?.inputs)setMoneyInputs(c=>({...c,...savedMoney.inputs}));if(savedMoney?.result)setMoneyResult(savedMoney.result);
  }catch{}},[]);

  function changeSlice(key,value){setSlice(c=>({...c,[key]:value}));setSliceResult(null)}
  function changeMoney(key,value){setMoneyInputs(c=>({...c,[key]:value}));if(key==='usd')setPurchase(c=>({...c,demoUsdCents:Math.max(0,toCents(value))}))}

  async function testBuy(event){event?.preventDefault?.();setSliceBusy(true);try{
    const r=await fetch('/api/geo/property-slice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'purchase',amountCents:toCents(slice.amount),propertyReferencePriceCents:toCents(slice.selectedPrice),benchmarkReferencePriceCents:toCents(slice.benchmarkPrice),selectedName:slice.selectedName,demoUsdBalanceCents:purchase.demoUsdCents,existingDemoUnits:purchase.demoUnits})});
    const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||'Could not complete the sandbox purchase.');
    const result=d.result;const nextUsd=(result.balances.demoUsdAfterCents/100).toFixed(2);
    const nextPurchase={demoUsdCents:result.balances.demoUsdAfterCents,demoUnits:result.purchase.demoUnitsAfter,lastPurchase:{selectedName:result.purchase.selectedName,priceCents:result.purchase.debitDemoUsdCents,percent:result.purchase.hypotheticalPercentPerUnit,boughtAt:new Date().toISOString(),autoTopUpCents:result.balances.demoUsdAutoTopUpCents||0}};
    const nextMoneyInputs={...moneyInputs,usd:nextUsd};setSliceResult(result.slice);setPurchase(nextPurchase);setMoneyInputs(nextMoneyInputs);setMoneyResult(null);
    try{const savedAt=new Date().toISOString();window.localStorage.setItem(SLICE_KEY,JSON.stringify({slice,result:result.slice,savedAt}));window.localStorage.setItem(PURCHASE_KEY,JSON.stringify(nextPurchase));window.localStorage.setItem(MONEY_KEY,JSON.stringify({inputs:nextMoneyInputs,result:null,savedAt}))}catch{}
    const refill=result.balances.demoUsdAutoTopUpCents>0?` Sandbox auto-refilled ${money(result.balances.demoUsdAutoTopUpCents)} demo USD first.`:'';
    setMessage(`${money(result.purchase.debitDemoUsdCents)} demo purchase complete · ${unitLabelFor(result.purchase.demoUnitsAfter)} saved.${refill} No real funds, deed, equity, security, or NFT moved.`);
  }catch(e){setMessage(e instanceof Error?e.message:'Could not complete the sandbox purchase.')}finally{setSliceBusy(false)}}

  async function previewMoney(event){event?.preventDefault?.();setMoneyBusy(true);try{
    const r=await fetch('/api/geo/property-slice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'conversion_preview',settledUsdCents:purchase.demoUsdCents,estimatedCryptoValueCents:toCents(moneyInputs.crypto),estimatedNftValueCents:toCents(moneyInputs.nft),propertyGoalCents:toCents(moneyInputs.property)})});
    const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||'Could not update Vault preview.');setMoneyResult(d.result);
    try{window.localStorage.setItem(PURCHASE_KEY,JSON.stringify(purchase));window.localStorage.setItem(MONEY_KEY,JSON.stringify({inputs:{...moneyInputs,usd:(purchase.demoUsdCents/100).toFixed(2)},result:d.result,savedAt:new Date().toISOString()}))}catch{}
    setMessage('Vault preview saved · crypto/NFT estimates stay estimates until a real provider settles them.');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not update Vault preview.')}finally{setMoneyBusy(false)}}

  return <main className={styles.page}><div className={styles.phone}>
    <header className={styles.topbar}><Link href="/" className={styles.brand}><VoxelLock/><strong>Voxel Vault</strong></Link><button className={styles.avatarButton} type="button" onClick={connect} aria-label={connected?`Wallet ${shortWallet}`:'Connect wallet'}><PixelAvatar/><i className={connected?styles.online:styles.offline}/></button></header>
    <section className={styles.heading}><span>PROPERTY · USD · CRYPTO · NFT</span><h1>Your $1.99 property world</h1><p>Start with a $1.99 anchor. Other sandbox properties scale automatically by reference value, while the app keeps legal ownership and demo value clearly separate.</p></section>

    <form onSubmit={testBuy} className={styles.sliceForm}>
      <section className={styles.heroCard}><div className={styles.sceneSide}><div className={styles.demoPill}>{needsDemoTopUp?'AUTO-FUND DEMO':'DEMO USD'} · {demoUsdDisplay}</div><VoxelScene/><div className={styles.sceneCaption}><b>{slice.selectedName||'Selected property'}</b><span>{referenceMoney(slice.selectedPrice)} reference value</span></div></div><div className={styles.buySide}><small>SANDBOX SLICE PRICE</small><div className={styles.heroPrice}>{money(adjustedCents)}</div><button className={styles.buyButton} disabled={sliceBusy}><span className={styles.bag}>✚</span>{sliceBusy?'Buying…':'Test Buy'}</button><div className={styles.sandbox}>{needsDemoTopUp?'Demo USD will refill automatically · ':''}anchor {money(toCents(slice.amount))}</div></div></section>
      <section className={styles.compareGrid}><div><span className={styles.houseBadge}>⌂</span><small>SELECTED</small><strong>{slice.selectedName||'Selected property'}</strong><b>{referenceMoney(slice.selectedPrice)} reference</b></div><div><span className={styles.anchorBadge}>★</span><small>MY ANCHOR</small><strong>{slice.benchmarkName||'My anchor property'}</strong><b>{referenceMoney(slice.benchmarkPrice)} → {money(toCents(slice.amount))}</b></div></section>
      <section className={styles.metrics}><div><PieIcon/><span><small>Same proportional slice</small><strong>{percent(slicePercent)}</strong></span></div><div><BarsIcon/><span><small>Selected vs. anchor</small><strong>{indexLabel(benchmarkWeight)}</strong></span></div></section>
      <div className={styles.formula}><b>{money(toCents(slice.amount))}</b><span>×</span><b>{referenceMoney(slice.selectedPrice)}</b><span>÷</span><b>{referenceMoney(slice.benchmarkPrice)}</b><span>=</span><strong>{money(adjustedCents)}</strong></div>
      <details className={styles.details}><summary>Change property comparison</summary><div className={styles.fields}><label>Selected property name<input value={slice.selectedName} onChange={e=>changeSlice('selectedName',e.target.value)}/></label><label>Selected reference value<input inputMode="decimal" value={slice.selectedPrice} onChange={e=>changeSlice('selectedPrice',e.target.value)}/></label><label>My anchor property name<input value={slice.benchmarkName} onChange={e=>changeSlice('benchmarkName',e.target.value)}/></label><label>My anchor reference value<input inputMode="decimal" value={slice.benchmarkPrice} onChange={e=>changeSlice('benchmarkPrice',e.target.value)}/></label><label className={styles.fullField}>My anchor test price<input inputMode="decimal" value={slice.amount} onChange={e=>changeSlice('amount',e.target.value)}/></label></div></details>
    </form>

    <div className={styles.sectionLabel}><span>ONE VAULT</span><b>Property + money + wallet, organized without pretending they are the same thing</b></div>
    <section className={styles.assetGrid}><AssetCard kind="property" art={<MiniHouse/>} label="Property" value={purchase.demoUnits?unitLabel:'Ready to test'}/><AssetCard kind="usd" art={<CashStack/>} label="USD" value={`Demo ${demoUsdDisplay}`}/><AssetCard kind="crypto" art={<EthMark/>} label="Crypto" value={connected?'Wallet linked':'Connect wallet'} onClick={connect}/><AssetCard kind="nft" art={<NftFrame/>} label="NFTs" value="Hold · mint · sell"/></section>
    {purchase.lastPurchase?<section className={styles.activityCard}><div><span>RECENT SANDBOX ACTIVITY</span><h2>{purchase.lastPurchase.selectedName}</h2><p>{money(purchase.lastPurchase.priceCents)} demo USD → 1 property slice</p></div><div className={styles.activityValue}><small>VAULT TOTAL</small><strong>{unitLabel}</strong><span>{demoUsdDisplay} demo USD left</span></div></section>:null}
    <section className={styles.convertCard}><div><span>NFT UTILITY</span><h2>Make the NFT useful</h2><p>Create or hold the asset, optionally mint it, sell through a supported market, then route settled proceeds to crypto or USD. Estimated value never becomes cash before settlement.</p></div><div className={styles.convertFlow}><Flow art={<NftFrame/>} label="NFT"/><span>→</span><Flow art={<MarketStall/>} label="Market"/><span>→</span><Flow art={<CashStack/>} label="USD"/><span>→</span><Flow art={<MiniHouse/>} label="Property"/></div></section>
    <details className={styles.details}><summary>Try unified Vault balances</summary><form onSubmit={previewMoney} className={styles.fields}><label>USD demo balance<input value={moneyInputs.usd} onChange={e=>changeMoney('usd',e.target.value)}/></label><label>Crypto estimated value<input value={moneyInputs.crypto} onChange={e=>changeMoney('crypto',e.target.value)}/></label><label>NFT estimated value<input value={moneyInputs.nft} onChange={e=>changeMoney('nft',e.target.value)}/></label><label>Property goal<input value={moneyInputs.property} onChange={e=>changeMoney('property',e.target.value)}/></label><button className={styles.updateButton} disabled={moneyBusy}>{moneyBusy?'Updating…':'Save Vault preview'}</button></form></details>
    <div className={styles.status}>{message}</div><div className={styles.nextLinks}><Link href="/property">Create a 3D property →</Link><Link href="/vault">Open full Vault →</Link></div>
  </div></main>
}

function AssetCard({kind,art,label,value,onClick}){const Tag=onClick?'button':'div';return <Tag type={onClick?'button':undefined} onClick={onClick} className={`${styles.assetCard} ${styles[kind]}`}><div className={styles.assetArt}>{art}</div><b>{label}</b><small>{value}</small></Tag>}
function Flow({art,label}){return <div className={styles.flow}><div>{art}</div><b>{label}</b></div>}
function VoxelLock(){return <span className={styles.voxelLock}><i/><b>+</b></span>}
function PixelAvatar(){return <span className={styles.pixelAvatar}><i/><b/></span>}
function PieIcon(){return <span className={styles.pie}><i/></span>}
function BarsIcon(){return <span className={styles.bars}><i/><i/><i/></span>}
function VoxelScene(){return <svg className={styles.scene} viewBox="0 0 260 220" aria-hidden="true"><g><polygon points="30,105 145,55 232,94 116,148" fill="#85c94b"/><polygon points="30,105 116,148 116,196 30,151" fill="#8f5b32"/><polygon points="116,148 232,94 232,142 116,196" fill="#6e452b"/><rect x="58" y="78" width="14" height="55" fill="#70451f"/><rect x="44" y="52" width="42" height="42" rx="4" fill="#76b83d"/><rect x="51" y="43" width="33" height="32" rx="4" fill="#8bc64b"/><rect x="39" y="66" width="35" height="30" rx="4" fill="#68a934"/><polygon points="94,91 145,69 188,86 137,110" fill="#f58a46"/><polygon points="102,78 139,56 178,72 141,94" fill="#f27636"/><rect x="105" y="91" width="66" height="49" fill="#f6eee0"/><polygon points="171,91 188,86 188,132 171,140" fill="#e3d7c4"/><rect x="129" y="111" width="17" height="29" fill="#8a572c"/><rect x="112" y="104" width="12" height="15" fill="#6cc7e1"/><rect x="151" y="101" width="12" height="15" fill="#6cc7e1"/><rect x="166" y="54" width="11" height="25" fill="#a98b78"/><rect x="171" y="38" width="10" height="10" fill="#eee7e4"/><rect x="176" y="25" width="11" height="11" fill="#f4eeee"/><rect x="90" y="147" width="22" height="7" fill="#d7c9b3"/><rect x="78" y="155" width="19" height="7" fill="#d7c9b3"/><rect x="68" y="163" width="17" height="7" fill="#d7c9b3"/></g></svg>}
function MiniHouse(){return <span className={styles.miniHouse}><i/><b/></span>}
function CashStack(){return <span className={styles.cashStack}><i/><i/><b>$</b></span>}
function EthMark(){return <span className={styles.eth}>◆</span>}
function NftFrame(){return <span className={styles.nftFrame}><i>●</i></span>}
function MarketStall(){return <span className={styles.market}><i/><b/></span>}
