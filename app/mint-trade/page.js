'use client';

import {useEffect,useRef,useState} from 'react';
import GeneratedMeshViewer from '../pack/success/GeneratedMeshViewer';
import {getSupabaseBrowser} from '../../lib/supabase-browser';
import {loadAccountVoxel,saveVoxelToAccount,voxelAccountConfigured} from '../../lib/voxelpop-account';
import {connectVoxelFlipWallet,mintVoxelFlip} from '../../lib/voxelflip';
import styles from './mint-trade.module.css';

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:''}
function errorText(error){return String(error?.reason||error?.message||error||'')}
function isVoucherUsedError(error){const text=errorText(error).toLowerCase();return text.includes('voucher already used')||text.includes('voucher is already minted')||text.includes('voucher was already minted')}
function isStaleVerificationError(error){const text=errorText(error).toLowerCase();return text.includes('did not mint from the registered voxelflip contract')||text.includes('connected wallet does not own')||text.includes('minted token metadata does not match')||text.includes('mint confirmation details are incomplete')}

export default function MintTradePage(){
 const [sessionId,setSessionId]=useState('');
 const [voxel,setVoxel]=useState(null);
 const [accountUser,setAccountUser]=useState(null);
 const [wallet,setWallet]=useState('');
 const [stage,setStage]=useState('loading');
 const [message,setMessage]=useState('Loading your paid voxel…');
 const [minted,setMinted]=useState(null);
 const [pendingMint,setPendingMint]=useState(null);
 const [recoverMode,setRecoverMode]=useState(false);
 const [scannerOn,setScannerOn]=useState(true);
 const [scanner,setScanner]=useState(null);
 const [scannerBusy,setScannerBusy]=useState(false);
 const recovering=useRef(false);

 useEffect(()=>{
  const sid=new URLSearchParams(window.location.search).get('session_id')||'';setSessionId(sid);
  if(!sid){setStage('error');setMessage('Open Mint & Trade from one of your paid voxels.');return;}
  let local=null;
  try{local=JSON.parse(localStorage.getItem(`voxelpop:${sid}`)||'null')}catch{}
  if(local?.asset?.dataUrl){setVoxel(local);setStage('ready');setMessage(local.mesh?.status==='ready'?'Your 3D voxel is ready to mint or recover.':'Finish the 3D mesh before minting.');}
  if(voxelAccountConfigured()){
   const supabase=getSupabaseBrowser();
   supabase.auth.getSession().then(async({data})=>{
    const user=data.session?.user||null;setAccountUser(user);
    if(!user)return;
    try{
     const record=await loadAccountVoxel(supabase,user,sid);
     if(!local?.asset?.dataUrl&&record?.payload?.asset?.dataUrl){setVoxel(record.payload);setStage('ready');setMessage(record.payload.mesh?.status==='ready'?'Restored from your Google account. Ready to mint or recover.':'Restored from your Google account. Finish its 3D mesh first.');}
    }catch{}
   });
  }
  let confirmed=null;
  try{confirmed=JSON.parse(localStorage.getItem(`voxelflip:mint:${sid}`)||'null');if(confirmed?.tokenId){setMinted(confirmed);setWallet(confirmed.owner||'');setStage('done');setMessage(`VoxelFlip #${confirmed.tokenId} is already minted.`)}}catch{}
  if(!confirmed?.tokenId){
   try{const pending=JSON.parse(localStorage.getItem(`voxelflip:pending:${sid}`)||'null');if(pending?.tokenId&&pending?.hash&&pending?.metadataUrl){setPendingMint(pending);setWallet(pending.owner||'');setStage('ready');setMessage(`A prior mint record exists for VoxelFlip #${pending.tokenId}. Resume verification will validate it, then fall back to voucher recovery automatically if that local record is stale.`)}}catch{}
  }
 },[]);

 useEffect(()=>{if(!sessionId||!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'||voxel.mesh?.taskId||recovering.current)return;recoverTask(voxel)},[sessionId,voxel?.asset?.dataUrl,voxel?.mesh?.status,voxel?.mesh?.taskId]);
 useEffect(()=>{if(!wallet||!scannerOn)return;runScanner();const timer=setInterval(runScanner,30000);return()=>clearInterval(timer)},[wallet,scannerOn,minted?.tokenId]);

 async function persist(next){
  const saved={...next,updatedAt:new Date().toISOString()};setVoxel(saved);
  try{localStorage.setItem(`voxelpop:${sessionId}`,JSON.stringify(saved))}catch{}
  if(accountUser&&voxelAccountConfigured())saveVoxelToAccount(getSupabaseBrowser(),accountUser,sessionId,saved).catch(()=>{});
 }

 async function recoverTask(current){
  if(recovering.current||!sessionId||!current.asset?.dataUrl)return current.mesh?.taskId||'';recovering.current=true;
  try{
   setMessage('Restoring the finished 3D mesh for minting…');
   const response=await fetch('/api/creator-pack/mesh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,index:0,image:current.asset.dataUrl,name:current.asset.name||'your-voxel',idea:current.idea||current.asset.name||'VoxelPop creation',forceRestart:false})});
   const data=await response.json();if(!response.ok||!data.taskId)throw new Error(data.error||'Could not restore the 3D mesh task.');
   const next={...current,mesh:{...(current.mesh||{}),taskId:String(data.taskId),status:'ready'}};await persist(next);setStage('ready');setMessage('3D mesh restored. Ready to mint or recover.');return String(data.taskId);
  }catch(error){setStage('error');setMessage(error instanceof Error?error.message:'Could not restore this mesh.');return ''}finally{recovering.current=false}
 }

 async function connect(){
  setStage('connecting');setMessage('Connecting your wallet on Base…');
  try{const result=await connectVoxelFlipWallet();setWallet(result.address);setStage(minted?'done':'ready');setMessage(`Wallet connected · ${short(result.address)}. Automatic market monitoring is on.`);return result.address}
  catch(error){if(error?.code==='NO_WALLET_PROVIDER'&&error?.deepLink){location.href=error.deepLink;return ''}setStage('error');setMessage(error instanceof Error?error.message:'Wallet connection failed.');return ''}
 }

 async function verifySubmitted(submission){
  setStage('verifying');setMessage(`Verifying VoxelFlip #${submission.tokenId} on Base…`);
  const txHash=submission.hash||submission.txHash||'';
  const confirm=await fetch('/api/creator-pack/nft/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId:submission.taskId,tokenId:submission.tokenId,txHash,wallet:submission.owner,metadataUrl:submission.metadataUrl})});
  const verified=await confirm.json();if(!confirm.ok)throw new Error(verified.error||'The mint was submitted but could not be verified yet.');
  const finalResult={...submission,hash:txHash,owner:verified.wallet||submission.owner,openSeaUrl:verified.openSeaUrl||submission.openSeaUrl||'',explorerUrl:verified.explorerUrl||submission.explorerUrl||''};
  setMinted(finalResult);setPendingMint(null);setRecoverMode(false);setWallet(finalResult.owner||wallet);setStage('done');setMessage(`VoxelFlip #${finalResult.tokenId} is minted and owned by ${short(finalResult.owner)}.`);
  try{localStorage.setItem(`voxelflip:mint:${sessionId}`,JSON.stringify(finalResult));localStorage.removeItem(`voxelflip:pending:${sessionId}`)}catch{}
  return finalResult;
 }

 async function prepareForWallet(address,taskId,recoveryOnly=false){
  setStage('preparing');setMessage(recoveryOnly?'Recovering the consumed voucher from Base and Blockscout…':'Checking Base for an existing voucher before any transaction is created…');
  const prep=await fetch('/api/creator-pack/nft/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,image:voxel.asset.dataUrl,name:voxel.asset.name||'your-voxel',idea:voxel.idea||voxel.asset.name||'VoxelPop creation',wallet:address})});
  const prepared=await prep.json();
  if(!prep.ok){if(prepared?.voucherUsed)setRecoverMode(true);const failure=new Error(prepared.error||'Could not prepare or recover this VoxelFlip.');failure.voucherUsed=Boolean(prepared?.voucherUsed);throw failure;}
  return prepared;
 }

 async function recoverExistingMint(ownerHint=''){
  if(!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'){setStage('error');setMessage('Finish the 3D mesh before recovering the mint.');return null;}
  let taskId=voxel.mesh?.taskId||'';if(!taskId)taskId=await recoverTask(voxel);if(!taskId)return null;
  let address=ownerHint||wallet;
  if(!address){const connected=await connectVoxelFlipWallet();address=connected.address;setWallet(address)}
  const prepared=await prepareForWallet(address,taskId,true);
  if(prepared.existingMint?.tokenId&&prepared.existingMint?.txHash){
   const chainMetadataUrl=prepared.existingMint.metadataUrl||prepared.metadataUrl;
   const submission={tokenId:String(prepared.existingMint.tokenId),owner:prepared.existingMint.owner||address,hash:prepared.existingMint.txHash,status:'confirmed',metadataUrl:chainMetadataUrl,taskId,openSeaUrl:'',explorerUrl:''};
   setPendingMint(submission);setRecoverMode(true);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
   setMessage(`Recovered VoxelFlip #${submission.tokenId} from the consumed voucher. Verifying the original Base transaction…`);
   return verifySubmitted(submission);
  }
  if(prepared.voucherUsed){setRecoverMode(true);throw new Error('The voucher is confirmed used, but the original mint event has not indexed yet. No new transaction will be sent.');}
  setRecoverMode(false);throw new Error('This voucher is not consumed on Base, so there is no earlier mint to recover.');
 }

 async function resumeVerification(){
  if(!pendingMint)return;
  const stale=pendingMint;
  try{await verifySubmitted(stale)}catch(error){
   if(isStaleVerificationError(error)){
    try{localStorage.removeItem(`voxelflip:pending:${sessionId}`)}catch{}
    setPendingMint(null);setRecoverMode(true);setStage('preparing');setMessage('The saved local transaction record was stale. Recovering the NFT from its one-time voucher instead…');
    try{await recoverExistingMint(stale.owner||wallet)}catch(recoveryError){setStage('error');setMessage(errorText(recoveryError)||'Voucher recovery is temporarily unavailable. No new mint was sent.');}
    return;
   }
   setStage('error');setMessage(`The prior Base transaction still needs verification: ${errorText(error)||'RPC unavailable'}. No new mint will be sent while this record is pending.`);
  }
 }

 async function mint(){
  if(pendingMint){await resumeVerification();return;}
  if(recoverMode){try{await recoverExistingMint(wallet)}catch(error){setStage('error');setMessage(errorText(error)||'Could not recover the existing mint.');}return;}
  if(!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'){setStage('error');setMessage('Finish the 3D mesh before minting.');return;}
  let taskId=voxel.mesh?.taskId||'';if(!taskId)taskId=await recoverTask(voxel);if(!taskId)return;
  let submission=null;
  try{
   setStage('connecting');setMessage('Connect the wallet that should own this VoxelFlip.');
   const connected=await connectVoxelFlipWallet();setWallet(connected.address);
   const prepared=await prepareForWallet(connected.address,taskId,false);

   if(prepared.existingMint?.tokenId&&prepared.existingMint?.txHash){
    const chainMetadataUrl=prepared.existingMint.metadataUrl||prepared.metadataUrl;
    submission={tokenId:String(prepared.existingMint.tokenId),owner:prepared.existingMint.owner||connected.address,hash:prepared.existingMint.txHash,status:'confirmed',metadataUrl:chainMetadataUrl,taskId,openSeaUrl:'',explorerUrl:''};
    setPendingMint(submission);setRecoverMode(true);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
    setMessage(`Found your earlier VoxelFlip #${submission.tokenId} by voucher. Verifying it instead of minting a duplicate…`);
    await verifySubmitted(submission);return;
   }

   if(prepared.voucherUsed){setRecoverMode(true);throw new Error('This voucher is already minted. Recover the existing mint instead of creating another.');}
   if(!prepared.mintConfigured||!prepared.signature)throw new Error('The secure VoxelFlip mint signer is not configured on this deployment.');
   setRecoverMode(false);setStage('minting');setMessage('Confirm this one Base mint in your wallet. After it lands, VoxelFlip will remember and recover it automatically.');
   const result=await mintVoxelFlip({metadataUrl:prepared.metadataUrl,voucherId:prepared.voucherId,signature:prepared.signature});if(!result?.tokenId)throw new Error('The mint transaction completed but the token ID could not be read.');
   submission={...result,metadataUrl:prepared.metadataUrl,taskId};
   setPendingMint(submission);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
   await verifySubmitted(submission);
  }catch(error){
   if(error?.code==='NO_WALLET_PROVIDER'&&error?.deepLink){location.href=error.deepLink;return}
   if(submission?.tokenId){setPendingMint(submission);setStage('error');setMessage(`VoxelFlip #${submission.tokenId} was submitted to Base. Verification is not finished: ${errorText(error)||'verification unavailable'}. Use Resume; do not send a second mint.`);return}
   if(isVoucherUsedError(error)||error?.voucherUsed){setRecoverMode(true);setStage('error');setMessage('That voucher is already consumed on Base. Click Recover existing mint — no second mint transaction will be created.');return}
   setStage('error');setMessage(errorText(error)||'VoxelFlip minting failed.');
  }
 }

 async function runScanner(){
  if(!wallet||scannerBusy)return;setScannerBusy(true);
  try{const query=new URLSearchParams({wallet});if(minted?.tokenId)query.set('tokenId',minted.tokenId);const response=await fetch(`/api/voxelflip/trader?${query}`,{cache:'no-store'});const data=await response.json();if(response.ok)setScanner(data);else setScanner({...data,scanner:'error'})}catch{setScanner({scanner:'error',marketDataConfigured:false,autoExecutionEnabled:false,autoExecutionReady:false})}finally{setScannerBusy(false)}
 }

 const asset=voxel?.asset;const mesh=voxel?.mesh;const taskId=mesh?.taskId||'';const previewUrl=sessionId&&taskId?`/api/creator-pack/mesh?${new URLSearchParams({sessionId,taskId,preview:'1'}).toString()}`:'';
 const busy=['connecting','preparing','minting','verifying'].includes(stage);
 const mintLabel=pendingMint?(stage==='verifying'?'Verifying existing mint…':'Resume mint verification'):recoverMode?(stage==='preparing'?'Recovering existing mint…':'Recover existing mint'):stage==='connecting'?'Connecting wallet…':stage==='preparing'?'Checking Base…':stage==='minting'?'Confirm mint in wallet…':stage==='verifying'?'Verifying on Base…':'Mint this voxel on Base';
 const executionLabel=scanner?.autoExecutionEnabled?'AUTOPILOT ON':scanner?.autoExecutionReady?'AUTOPILOT READY':'AUTOPILOT SETUP';
 const risk=scanner?.riskPolicy||{};

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>MINT & TRADE</em></nav>
  <header className={styles.hero}><p>VOXELPOP → VOXELFLIP → MARKET</p><h1>Mint it.<br/><em>Then let it work.</em></h1><span>Your 3D voxel stays yours. VoxelFlip recovers completed mints automatically and the market system watches opportunities continuously.</span></header>
  <section className={styles.assetCard}>
   <div className={styles.preview}>{previewUrl&&mesh?.status==='ready'?<GeneratedMeshViewer url={previewUrl} label={asset?.name||'Your voxel'}/>:asset?.dataUrl?<img src={asset.dataUrl} alt={asset.name||'Your voxel'}/>:<div className={styles.missing}>Open this page from a paid voxel in My Voxels.</div>}</div>
   <div className={styles.assetInfo}><small>YOUR PAID VOXEL</small><h2>{(asset?.name||'Your voxel').replaceAll('-',' ')}</h2><div className={styles.statusRow}><span>{mesh?.status==='ready'?'✓ 3D READY':'3D NOT READY'}</span><span>Base mainnet</span></div><p>{message}</p>{!minted&&<button disabled={busy||(!pendingMint&&!recoverMode&&(!asset?.dataUrl||mesh?.status!=='ready'))} onClick={pendingMint?resumeVerification:mint}>{mintLabel}</button>}{minted&&<div className={styles.minted}><b>✓ VoxelFlip #{minted.tokenId}</b><a href={minted.openSeaUrl} target="_blank" rel="noreferrer">Open / list on OpenSea ↗</a><a href={minted.explorerUrl} target="_blank" rel="noreferrer">Verify transaction ↗</a></div>}</div>
  </section>
  <section className={styles.bot}>
   <div className={styles.botHead}><div><small>VOXELFLIP AUTOPILOT</small><h2>Monitored automatic trading</h2></div><button onClick={()=>setScannerOn(value=>!value)} className={scannerOn?styles.on:styles.off}>{scannerOn?'AUTO SCAN ON':'AUTO SCAN OFF'}</button></div>
   <div className={styles.mode}><div><b>Market scanning</b><span>{wallet?(scanner?.scanner==='live'?'LIVE · EVERY 30 SEC':scanner?.scanner==='configuration-needed'?'OPENSEA KEY NEEDED':'CONNECTING…'):'CONNECT WALLET'}</span></div><div><b>Trade execution</b><span>{executionLabel}</span></div><div><b>Collection</b><span>VoxelFlip · Base</span></div></div>
   {!wallet?<button className={styles.connect} onClick={connect}>Connect wallet & start monitoring</button>:<div className={styles.walletLine}><b>{short(wallet)}</b><button onClick={runScanner} disabled={scannerBusy}>{scannerBusy?'Refreshing…':'Refresh now'}</button></div>}
   <div className={styles.stats}><article><small>ACTIVE LISTINGS</small><b>{scanner?.listings??'—'}</b></article><article><small>OFFERS RECEIVED</small><b>{scanner?.offersReceived??'—'}</b></article><article><small>PORTFOLIO</small><b>{scanner?.portfolio?'LIVE':'—'}</b></article><article><small>EXECUTION</small><b>{scanner?.autoExecutionEnabled?'AUTO':scanner?.autoExecutionReady?'READY':'SETUP'}</b></article></div>
   {scanner&&!scanner.marketDataConfigured&&<div className={styles.notice}>Market monitoring needs <b>OPENSEA_API_KEY</b> on the production server.</div>}
   <div className={styles.autopilot}>
    <div className={styles.autopilotTitle}><div><small>AUTO-EXECUTION</small><b>{executionLabel}</b></div><span className={scanner?.autoExecutionEnabled?styles.liveDot:styles.setupDot}></span></div>
    <p>Repeated MetaMask popups are not the automation model. VoxelFlip uses a separate trading signer or delegated Base account so the bot can execute inside hard limits while your owner and mint-signer keys stay out of trading.</p>
    <div className={styles.limits}><div><small>MAX / TRADE</small><b>{risk.maxTradeEth??'—'} ETH</b></div><div><small>DAILY SPEND</small><b>{risk.maxDailySpendEth??'—'} ETH</b></div><div><small>DAILY LOSS</small><b>{risk.maxDailyLossEth??'—'} ETH</b></div><div><small>MAX INVENTORY</small><b>{risk.maxInventory??'—'}</b></div></div>
    {scanner?.botWalletAddress&&<p className={styles.botWallet}>BOT WALLET · {short(scanner.botWalletAddress)}</p>}
    {scanner&&!scanner.autoExecutionReady&&<div className={styles.notice}>Autopilot execution is intentionally blocked until a <b>dedicated trader signer</b>, <b>production Base RPC</b>, and <b>OpenSea API access</b> are configured. The collection-owner/mint-signer key will not be reused.</div>}
   </div>
   <div className={styles.automation}><div><span>✓</span><p><b>Watch offers and listings automatically</b><small>Refresh market, portfolio and order state every 30 seconds while open.</small></p></div><div><span>↻</span><p><b>Recover mints instead of duplicating them</b><small>A consumed voucher is resolved back to its original Base mint before another transaction can be created.</small></p></div><div><span>⚡</span><p><b>Auto-execute only inside explicit limits</b><small>Once the dedicated signer/delegation is active, execution can happen without a MetaMask prompt for every trade.</small></p></div><div><span>■</span><p><b>Monitor every action + circuit breakers</b><small>Per-trade, daily spend, daily loss, inventory and minimum-edge limits stay visible and enforceable.</small></p></div></div>
   <p className={styles.risk}>Automatic execution can lose money as well as make money. Limits reduce risk; they do not guarantee profit or prevent every loss.</p>
  </section>
  <footer className={styles.footer}><a href={sessionId?`/pack/success?session_id=${encodeURIComponent(sessionId)}`:'/'}>← Back to your voxel</a><a href="/">My Voxels</a></footer>
 </main>;
}