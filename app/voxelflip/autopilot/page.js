'use client';

import {useEffect,useState} from 'react';
import {connectVoxelFlipWallet} from '../../../lib/voxelflip';
import styles from './autopilot.module.css';

const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE=/^\d+$/;
const IS_APPROVED_FOR_ALL='0xe985e9c5';
const SET_APPROVAL_FOR_ALL='0xa22cb465';
const BASE_CHAIN_ID=8453;

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function time(value){try{return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return ''}}
function eth(value){const n=Number(value);return Number.isFinite(n)?`${n.toLocaleString(undefined,{maximumFractionDigits:4})} ETH`:'—'}
function count(value,more=false){return Number.isFinite(Number(value))?`${Number(value)}${more?'+':''}`:'—'}
function paddedAddress(value){return String(value||'').replace(/^0x/i,'').toLowerCase().padStart(64,'0')}
function boolWord(value){return value?'ON':'OFF'}
function suggestedFloor(value){const n=Number(value);if(!Number.isFinite(n)||n<=0)return '';return n.toFixed(6).replace(/0+$/,'').replace(/\.$/,'')}
function walletError(error){const text=String(error?.shortMessage||error?.reason||error?.message||error||'');if(error?.code===4001||/reject|denied|cancel/i.test(text))return 'You cancelled the wallet request. Nothing was listed.';return text||'The listing could not be completed.'}

async function isApprovedForAll(provider,contract,owner,operator){
 const data=`${IS_APPROVED_FOR_ALL}${paddedAddress(owner)}${paddedAddress(operator)}`;
 const result=await provider.request({method:'eth_call',params:[{to:contract,data},'latest']});
 try{return BigInt(result||'0x0')!==0n}catch{return false}
}

async function waitForReceipt(provider,hash){
 for(let i=0;i<80;i++){
  const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});
  if(receipt){if(String(receipt.status).toLowerCase()!=='0x1')throw new Error('The OpenSea approval transaction failed on Base. Nothing was listed.');return receipt}
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 throw new Error('The OpenSea approval is still pending. Check your wallet before trying again.');
}

async function approveOpenSea(provider,contract,owner,operator){
 if(await isApprovedForAll(provider,contract,owner,operator))return false;
 const data=`${SET_APPROVAL_FOR_ALL}${paddedAddress(operator)}${'0'.repeat(63)}1`;
 const hash=await provider.request({method:'eth_sendTransaction',params:[{from:owner,to:contract,data,value:'0x0'}]});
 if(!hash)throw new Error('Your wallet did not return an OpenSea approval transaction.');
 await waitForReceipt(provider,hash);
 if(!await isApprovedForAll(provider,contract,owner,operator))throw new Error('OpenSea approval was not active after the transaction confirmed. Nothing was listed.');
 return true;
}

async function signSeaportOrder(provider,wallet,protocolAddress,orderComponents){
 const typedData={
  types:{
   EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],
   OrderComponents:[{name:'offerer',type:'address'},{name:'zone',type:'address'},{name:'offer',type:'OfferItem[]'},{name:'consideration',type:'ConsiderationItem[]'},{name:'orderType',type:'uint8'},{name:'startTime',type:'uint256'},{name:'endTime',type:'uint256'},{name:'zoneHash',type:'bytes32'},{name:'salt',type:'uint256'},{name:'conduitKey',type:'bytes32'},{name:'counter',type:'uint256'}],
   OfferItem:[{name:'itemType',type:'uint8'},{name:'token',type:'address'},{name:'identifierOrCriteria',type:'uint256'},{name:'startAmount',type:'uint256'},{name:'endAmount',type:'uint256'}],
   ConsiderationItem:[{name:'itemType',type:'uint8'},{name:'token',type:'address'},{name:'identifierOrCriteria',type:'uint256'},{name:'startAmount',type:'uint256'},{name:'endAmount',type:'uint256'},{name:'recipient',type:'address'}],
  },
  primaryType:'OrderComponents',
  domain:{name:'Seaport',version:'1.6',chainId:BASE_CHAIN_ID,verifyingContract:protocolAddress},
  message:orderComponents,
 };
 return provider.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(typedData)]});
}

export default function VoxelFlipAutopilotPage(){
 const [wallet,setWallet]=useState('');
 const [tokenId,setTokenId]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [scanner,setScanner]=useState(null);
 const [busy,setBusy]=useState(false);
 const [autoScan,setAutoScan]=useState(true);
 const [error,setError]=useState('');
 const [listingOpen,setListingOpen]=useState(false);
 const [listingPrice,setListingPrice]=useState('');
 const [listingDuration,setListingDuration]=useState(30);
 const [listingBusy,setListingBusy]=useState(false);
 const [listingMessage,setListingMessage]=useState('');
 const [listingError,setListingError]=useState('');
 const [listingDone,setListingDone]=useState(null);

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const w=q.get('wallet')||'';
  setWallet(ADDRESS_RE.test(w)?w:'');
  setTokenId(q.get('tokenId')||'');
  setSessionId(q.get('session_id')||'');
 },[]);

 useEffect(()=>{
  if(!ADDRESS_RE.test(wallet)||!autoScan)return;
  runScan();
  const timer=setInterval(runScan,30000);
  return()=>clearInterval(timer);
 },[wallet,tokenId,autoScan]);

 useEffect(()=>{
  if(!listingPrice&&scanner?.collectionFloorEth)setListingPrice(suggestedFloor(scanner.collectionFloorEth));
 },[scanner?.collectionFloorEth]);

 async function connect(){
  setBusy(true);setError('');
  try{const result=await connectVoxelFlipWallet();setWallet(result.address);return result}
  catch(e){if(e?.code==='NO_WALLET_PROVIDER'&&e?.deepLink){location.href=e.deepLink;return null}setError(e instanceof Error?e.message:'Wallet connection failed.');return null}
  finally{setBusy(false)}
 }

 async function runScan(){
  if(!ADDRESS_RE.test(wallet)||busy)return;
  setBusy(true);setError('');
  try{
   const q=new URLSearchParams({wallet});if(TOKEN_RE.test(tokenId))q.set('tokenId',tokenId);
   const response=await fetch(`/api/voxelflip/trader?${q}`,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Autopilot scan failed.');
   setScanner(data);
  }catch(e){setError(e instanceof Error?e.message:'Autopilot scan failed.')}
  finally{setBusy(false)}
 }

 async function openListing(){
  setListingDone(null);setListingError('');setListingMessage('');setListingOpen(true);
  if(!TOKEN_RE.test(tokenId)){setListingError('Open Autopilot from a minted VoxelFlip so its token ID is selected.');return}
  if(!listingPrice&&scanner?.collectionFloorEth)setListingPrice(suggestedFloor(scanner.collectionFloorEth));
  if(!ADDRESS_RE.test(wallet))await connect();
 }

 async function createListing(){
  if(listingBusy)return;
  if(!TOKEN_RE.test(tokenId)){setListingError('Choose a minted VoxelFlip before listing.');return}
  const price=String(listingPrice||'').trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)||Number(price)<=0){setListingError('Enter a valid ETH price greater than zero.');return}
  setListingBusy(true);setListingError('');setListingDone(null);
  try{
   setListingMessage('Connecting the wallet that owns this VoxelFlip…');
   const connected=await connectVoxelFlipWallet();
   const activeWallet=String(connected.address||'').toLowerCase();
   setWallet(connected.address);

   setListingMessage('Verifying ownership and preparing the OpenSea order…');
   const prepareResponse=await fetch('/api/voxelflip/listing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',wallet:activeWallet,tokenId,priceEth:price,durationDays:Number(listingDuration),useCreatorFee:true})});
   const prepared=await prepareResponse.json().catch(()=>({}));
   if(!prepareResponse.ok||!prepared?.prepared)throw new Error(prepared?.error||'OpenSea could not prepare this listing.');

   setListingMessage('Checking whether OpenSea already has approval for this NFT…');
   const approved=await isApprovedForAll(connected.provider,prepared.contract,activeWallet,prepared.conduitAddress);
   if(!approved){
    setListingMessage('Approve OpenSea in your wallet. This is a Base transaction and your wallet will show any gas before you approve.');
    await approveOpenSea(connected.provider,prepared.contract,activeWallet,prepared.conduitAddress);
   }

   setListingMessage('Sign the listing in your wallet. This signature does not send ETH.');
   const signature=await signSeaportOrder(connected.provider,activeWallet,prepared.protocolAddress,prepared.orderComponents);
   if(!signature)throw new Error('Your wallet did not return a listing signature. Nothing was listed.');

   setListingMessage('Submitting your signed listing to OpenSea…');
   const submitResponse=await fetch('/api/voxelflip/listing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit',wallet:activeWallet,tokenId,orderComponents:prepared.orderComponents,signature})});
   const submitted=await submitResponse.json().catch(()=>({}));
   if(!submitResponse.ok||submitted?.listed!==true)throw new Error(submitted?.error||'OpenSea did not confirm the listing.');

   setListingDone(submitted);setListingMessage(`VoxelFlip #${tokenId} is listed on OpenSea.`);
   setListingOpen(false);
   setTimeout(()=>runScan(),1200);
  }catch(e){setListingError(walletError(e));setListingMessage('')}
  finally{setListingBusy(false)}
 }

 const openSeaHref=listingDone?.openSeaUrl||scanner?.openSeaUrl||'https://opensea.io';
 const listed=scanner?.tokenListed===true?'LISTED':scanner?.tokenListed===false?'NOT LISTED':'—';
 const marketReady=scanner?.marketDataConfigured===true;
 const factoryQuery=new URLSearchParams();if(wallet)factoryQuery.set('wallet',wallet);if(tokenId)factoryQuery.set('tokenId',tokenId);if(sessionId)factoryQuery.set('session_id',sessionId);const factoryHref=`/voxelflip/factory${factoryQuery.toString()?`?${factoryQuery}`:''}`;

 return <main className={styles.page}>
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>AUTOPILOT</em>
  </nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>LIVE MONITOR</p>
    <h1>{tokenId?`VoxelFlip #${tokenId}`:'VoxelFlip'}</h1>
    <span>Watch the market. You approve every action.</span>
   </header>

   <section className={styles.dashboard}>
    <div className={styles.controls}>
     {!wallet?
      <button className={styles.connect} onClick={connect} disabled={busy}>{busy?'CONNECTING…':'CONNECT WALLET'}</button>:
      <div className={styles.wallet}>
       <div><small>BASE WALLET</small><b>{short(wallet)}</b></div>
       <button onClick={runScan} disabled={busy}>{busy?'SCANNING…':'REFRESH'}</button>
      </div>}
     <button className={`${styles.autoButton} ${autoScan?styles.autoOn:''}`} onClick={()=>setAutoScan(v=>!v)}>AUTO {autoScan?'ON':'OFF'}</button>
    </div>

    {error&&<div className={styles.notice}>{error}</div>}

    <div className={styles.metrics}>
     <article><small>FLOOR</small><b>{eth(scanner?.collectionFloorEth)}</b></article>
     <article><small>LISTINGS</small><b>{count(scanner?.collectionListings,scanner?.collectionListingsMore)}</b></article>
     <article><small>24H SALES</small><b>{count(scanner?.sales24h,scanner?.sales24hMore)}</b></article>
     <article><small>YOUR NFT</small><b>{listingDone?'LISTED':listed}</b></article>
    </div>

    {!scanner&&wallet&&<div className={styles.notice}>Waiting for the first market scan.</div>}
    {scanner&&!marketReady&&<div className={styles.notice}>OpenSea market data is not connected yet. Your VoxelFlip is still safe and this page cannot send a transaction.</div>}
    {scanner&&marketReady&&!scanner.collectionSlug&&tokenId&&<div className={styles.notice}>OpenSea has not returned collection stats yet. Auto Scan will keep checking every 30 seconds.</div>}
    {scanner?.checkedAt&&<p className={styles.checked}>Checked {time(scanner.checkedAt)} · OpenSea data can lag behind Base.</p>}

    <div className={styles.divider}/>

    <div className={styles.actionHead}>
     <div><small>YOUR NFT</small><h2>What do you want to do?</h2></div>
     <span>YOU APPROVE</span>
    </div>

    <div className={styles.safety}>
     <b>You’re in control.</b>
     <span>VoxelPop prepares the listing. Your wallet approves OpenSea and signs the final listing.</span>
    </div>

    {listingDone&&<div className={styles.listingSuccess}><b>✓ LISTED</b><span>VoxelFlip #{tokenId} was accepted by OpenSea.</span><a href={openSeaHref} target="_blank" rel="noreferrer">VIEW ON OPENSEA ↗</a></div>}

    {listingOpen&&<div className={styles.listingBox}>
     <div className={styles.listingHead}><div><small>LIST VOXELFLIP #{tokenId||'—'}</small><b>Choose your sale price</b></div><button type="button" onClick={()=>!listingBusy&&setListingOpen(false)} disabled={listingBusy}>×</button></div>
     <div className={styles.listingFields}>
      <label><span>PRICE</span><div><input inputMode="decimal" value={listingPrice} onChange={e=>setListingPrice(e.target.value)} disabled={listingBusy} placeholder="0.01"/><b>ETH</b></div>{scanner?.collectionFloorEth&&<small>Live floor: {eth(scanner.collectionFloorEth)} · edit before signing</small>}</label>
      <label><span>DURATION</span><select value={listingDuration} onChange={e=>setListingDuration(Number(e.target.value))} disabled={listingBusy}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select><small>Creator fee: {boolWord(true)}</small></label>
     </div>
     <button className={styles.listingButton} type="button" onClick={createListing} disabled={listingBusy}>{listingBusy?'FOLLOW THE WALLET PROMPTS':'REVIEW & LIST WITH WALLET'}</button>
     <p>VoxelPop verifies ownership and prepares the OpenSea order first. If OpenSea needs NFT approval, your wallet will show a Base transaction. Then your wallet signs the listing. Nothing is called “listed” until OpenSea accepts the signed order.</p>
    </div>}

    {(listingMessage||listingError)&&<div className={`${styles.listingMessage} ${listingError?styles.listingError:''}`}>{listingError||listingMessage}</div>}

    <div className={styles.actions}>
     {scanner?.tokenListed===true||listingDone?<a className={styles.primary} href={openSeaHref} target="_blank" rel="noreferrer">VIEW LISTING ↗</a>:<button className={styles.primary} type="button" onClick={openListing} disabled={listingBusy}>{listingBusy?'LISTING…':'LIST ON OPENSEA'}</button>}
     <a href={openSeaHref} target="_blank" rel="noreferrer">VIEW NFT ↗</a>
     {sessionId&&<a href={`/voxelflip/mint?session_id=${encodeURIComponent(sessionId)}`}>OPEN 3D</a>}
     <a href={factoryHref}>SALES & PROFIT</a>
     <a href="/studio#my-voxels">MY VOXELS</a>
    </div>

    <p className={styles.finePrint}>Sales & Profit tracks completed sales and your reinvestment limits. VoxelPop never receives your private key and never signs a listing for you.</p>
   </section>
  </div>

  <footer className={styles.footer}><a href="/studio#my-voxels">← MY VOXELS</a><a href={openSeaHref} target="_blank" rel="noreferrer">OPENSEA ↗</a></footer>
 </main>;
}
