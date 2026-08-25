'use client';

import {useEffect,useRef,useState} from 'react';
import GeneratedMeshViewer from '../pack/success/GeneratedMeshViewer';
import {getSupabaseBrowser} from '../../lib/supabase-browser';
import {loadAccountVoxel,saveVoxelToAccount,voxelAccountConfigured} from '../../lib/voxelpop-account';
import {connectVoxelFlipWallet,mintVoxelFlip} from '../../lib/voxelflip';
import styles from './mint-trade.module.css';

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:''}

export default function MintTradePage(){
 const [sessionId,setSessionId]=useState('');
 const [voxel,setVoxel]=useState(null);
 const [accountUser,setAccountUser]=useState(null);
 const [wallet,setWallet]=useState('');
 const [stage,setStage]=useState('loading');
 const [message,setMessage]=useState('Loading your paid voxel…');
 const [minted,setMinted]=useState(null);
 const [pendingMint,setPendingMint]=useState(null);
 const [scannerOn,setScannerOn]=useState(true);
 const [scanner,setScanner]=useState(null);
 const [scannerBusy,setScannerBusy]=useState(false);
 const recovering=useRef(false);

 useEffect(()=>{
  const sid=new URLSearchParams(window.location.search).get('session_id')||'';setSessionId(sid);
  if(!sid){setStage('error');setMessage('Open Mint & Trade from one of your paid voxels.');return;}
  let local=null;
  try{local=JSON.parse(localStorage.getItem(`voxelpop:${sid}`)||'null')}catch{}
  if(local?.asset?.dataUrl){setVoxel(local);setStage('ready');setMessage(local.mesh?.status==='ready'?'Your 3D voxel is ready to mint.':'Finish the 3D mesh before minting.');}
  if(voxelAccountConfigured()){
   const supabase=getSupabaseBrowser();
   supabase.auth.getSession().then(async({data})=>{
    const user=data.session?.user||null;setAccountUser(user);
    if(!user)return;
    try{
     const record=await loadAccountVoxel(supabase,user,sid);
     if(!local?.asset?.dataUrl&&record?.payload?.asset?.dataUrl){setVoxel(record.payload);setStage('ready');setMessage(record.payload.mesh?.status==='ready'?'Restored from your Google account. Ready to mint.':'Restored from your Google account. Finish its 3D mesh first.');}
    }catch{}
   });
  }
  let confirmed=null;
  try{confirmed=JSON.parse(localStorage.getItem(`voxelflip:mint:${sid}`)||'null');if(confirmed?.tokenId){setMinted(confirmed);setWallet(confirmed.owner||'');setStage('done');setMessage(`VoxelFlip #${confirmed.tokenId} is already minted.`)}}catch{}
  if(!confirmed?.tokenId){
   try{const pending=JSON.parse(localStorage.getItem(`voxelflip:pending:${sid}`)||'null');if(pending?.tokenId&&pending?.hash&&pending?.metadataUrl){setPendingMint(pending);setWallet(pending.owner||'');setStage('ready');setMessage(`VoxelFlip #${pending.tokenId} was already submitted to Base. Resume verification — do not mint it again.`)}}catch{}
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
   const next={...current,mesh:{...(current.mesh||{}),taskId:String(data.taskId),status:'ready'}};await persist(next);setStage('ready');setMessage('3D mesh restored. Ready to mint.');return String(data.taskId);
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
  const finalResult={...submission,hash:txHash,openSeaUrl:verified.openSeaUrl||submission.openSeaUrl||'',explorerUrl:verified.explorerUrl||submission.explorerUrl||''};
  setMinted(finalResult);setPendingMint(null);setWallet(finalResult.owner||wallet);setStage('done');setMessage(`VoxelFlip #${finalResult.tokenId} is minted and owned by ${short(finalResult.owner)}.`);
  try{localStorage.setItem(`voxelflip:mint:${sessionId}`,JSON.stringify(finalResult));localStorage.removeItem(`voxelflip:pending:${sessionId}`)}catch{}
  return finalResult;
 }

 async function resumeVerification(){
  if(!pendingMint)return;
  try{await verifySubmitted(pendingMint)}catch(error){setStage('error');setMessage(`Your VoxelFlip was already submitted to Base. Verification is still pending: ${error instanceof Error?error.message:'RPC unavailable'}. Do not mint it again; use Resume mint verification.`)}
 }

 async function mint(){
  if(pendingMint){await resumeVerification();return;}
  if(!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'){setStage('error');setMessage('Finish the 3D mesh before minting.');return;}
  let taskId=voxel.mesh?.taskId||'';if(!taskId)taskId=await recoverTask(voxel);if(!taskId)return;
  let submission=null;
  try{
   setStage('connecting');setMessage('Connect the wallet that should own this VoxelFlip.');
   const connected=await connectVoxelFlipWallet();setWallet(connected.address);
   setStage('preparing');setMessage('Packaging your exact image + GLB into VoxelFlip metadata…');
   const prep=await fetch('/api/creator-pack/nft/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,image:voxel.asset.dataUrl,name:voxel.asset.name||'your-voxel',idea:voxel.idea||voxel.asset.name||'VoxelPop creation',wallet:connected.address})});
   const prepared=await prep.json();if(!prep.ok)throw new Error(prepared.error||'Could not prepare this VoxelFlip.');

   if(prepared.existingMint?.tokenId&&prepared.existingMint?.txHash){
    submission={tokenId:String(prepared.existingMint.tokenId),owner:prepared.existingMint.owner||connected.address,hash:prepared.existingMint.txHash,status:'confirmed',metadataUrl:prepared.metadataUrl,taskId,openSeaUrl:'',explorerUrl:''};
    setPendingMint(submission);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
    setMessage(`Found your earlier VoxelFlip #${submission.tokenId} on Base. Verifying it instead of minting a duplicate…`);
    await verifySubmitted(submission);return;
   }

   if(!prepared.mintConfigured||!prepared.signature)throw new Error('The secure VoxelFlip mint signer is not configured on this deployment.');
   setStage('minting');setMessage('Confirm the Base mint transaction in your wallet.');
   const result=await mintVoxelFlip({metadataUrl:prepared.metadataUrl,voucherId:prepared.voucherId,signature:prepared.signature});if(!result?.tokenId)throw new Error('The mint transaction completed but the token ID could not be read.');
   submission={...result,metadataUrl:prepared.metadataUrl,taskId};
   setPendingMint(submission);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
   await verifySubmitted(submission);
  }catch(error){
   if(error?.code==='NO_WALLET_PROVIDER'&&error?.deepLink){location.href=error.deepLink;return}
   if(submission?.tokenId){setPendingMint(submission);setStage('error');setMessage(`Your VoxelFlip #${submission.tokenId} was already submitted to Base, but verification hit an RPC problem: ${error instanceof Error?error.message:'verification unavailable'}. Do not mint again; use Resume mint verification.`);return}
   setStage('error');setMessage(error instanceof Error?error.message:'VoxelFlip minting failed.');
  }
 }

 async function runScanner(){
  if(!wallet||scannerBusy)return;setScannerBusy(true);
  try{const query=new URLSearchParams({wallet});if(minted?.tokenId)query.set('tokenId',minted.tokenId);const response=await fetch(`/api/voxelflip/trader?${query}`,{cache:'no-store'});const data=await response.json();if(response.ok)setScanner(data);else setScanner({...data,scanner:'error'})}catch{setScanner({scanner:'error',marketDataConfigured:false})}finally{setScannerBusy(false)}
 }

 const asset=voxel?.asset;const mesh=voxel?.mesh;const taskId=mesh?.taskId||'';const previewUrl=sessionId&&taskId?`/api/creator-pack/mesh?${new URLSearchParams({sessionId,taskId,preview:'1'}).toString()}`:'';
 const busy=['connecting','preparing','minting','verifying'].includes(stage);
 const mintLabel=pendingMint?(stage==='verifying'?'Verifying existing mint…':'Resume mint verification'):stage==='connecting'?'Connecting wallet…':stage==='preparing'?'Preparing NFT…':stage==='minting'?'Confirm mint in wallet…':stage==='verifying'?'Verifying on Base…':'Mint this voxel on Base';

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>MINT & TRADE</em></nav>
  <header className={styles.hero}><p>VOXELPOP → VOXELFLIP → MARKET</p><h1>Mint it.<br/><em>Then watch the market.</em></h1><span>Your 3D voxel stays yours. Minting creates the Base NFT; the market bot watches listings, offers and portfolio changes automatically.</span></header>
  <section className={styles.assetCard}>
   <div className={styles.preview}>{previewUrl&&mesh?.status==='ready'?<GeneratedMeshViewer url={previewUrl} label={asset?.name||'Your voxel'}/>:asset?.dataUrl?<img src={asset.dataUrl} alt={asset.name||'Your voxel'}/>:<div className={styles.missing}>Open this page from a paid voxel in My Voxels.</div>}</div>
   <div className={styles.assetInfo}><small>YOUR PAID VOXEL</small><h2>{(asset?.name||'Your voxel').replaceAll('-',' ')}</h2><div className={styles.statusRow}><span>{mesh?.status==='ready'?'✓ 3D READY':'3D NOT READY'}</span><span>Base mainnet</span></div><p>{message}</p>{!minted&&<button disabled={busy||(!pendingMint&&(!asset?.dataUrl||mesh?.status!=='ready'))} onClick={pendingMint?resumeVerification:mint}>{mintLabel}</button>}{minted&&<div className={styles.minted}><b>✓ VoxelFlip #{minted.tokenId}</b><a href={minted.openSeaUrl} target="_blank" rel="noreferrer">Open / list on OpenSea ↗</a><a href={minted.explorerUrl} target="_blank" rel="noreferrer">Verify transaction ↗</a></div>}</div>
  </section>
  <section className={styles.bot}>
   <div className={styles.botHead}><div><small>VOXELFLIP MARKET BOT</small><h2>Automatic market monitor</h2></div><button onClick={()=>setScannerOn(value=>!value)} className={scannerOn?styles.on:styles.off}>{scannerOn?'AUTO SCAN ON':'AUTO SCAN OFF'}</button></div>
   <div className={styles.mode}><div><b>Market scanning</b><span>{wallet?(scanner?.scanner==='live'?'LIVE · refreshes every 30 sec':scanner?.scanner==='configuration-needed'?'OPENSEA KEY NEEDED':'CONNECTING…'):'CONNECT WALLET'}</span></div><div><b>Trade execution</b><span>APPROVAL REQUIRED</span></div><div><b>Collection</b><span>VoxelFlip · Base</span></div></div>
   {!wallet?<button className={styles.connect} onClick={connect}>Connect wallet & start bot monitoring</button>:<div className={styles.walletLine}><b>{short(wallet)}</b><button onClick={runScanner} disabled={scannerBusy}>{scannerBusy?'Refreshing…':'Refresh now'}</button></div>}
   <div className={styles.stats}><article><small>ACTIVE LISTINGS</small><b>{scanner?.listings??'—'}</b></article><article><small>OFFERS RECEIVED</small><b>{scanner?.offersReceived??'—'}</b></article><article><small>PORTFOLIO</small><b>{scanner?.portfolio?'LIVE':'—'}</b></article><article><small>EXECUTION</small><b>APPROVAL</b></article></div>
   {scanner&&!scanner.marketDataConfigured&&<div className={styles.notice}>Automatic scanner code is active, but the production server still needs <b>OPENSEA_API_KEY</b> to pull live marketplace data.</div>}
   <div className={styles.automation}><div><span>✓</span><p><b>Watch offers automatically</b><small>Detect offers received by the connected wallet.</small></p></div><div><span>✓</span><p><b>Watch listing status</b><small>Track active listings without exposing the OpenSea API key to the browser.</small></p></div><div><span>✓</span><p><b>Watch portfolio changes</b><small>Refresh market and portfolio data every 30 seconds while this page is open.</small></p></div><div><span>🔒</span><p><b>Buying and selling stays approval-gated</b><small>The bot cannot silently sign wallet transactions or spend funds.</small></p></div></div>
   <p className={styles.risk}>NFT prices can rise or fall. Market monitoring does not guarantee a buyer, a sale, or a profit.</p>
  </section>
  <footer className={styles.footer}><a href={sessionId?`/pack/success?session_id=${encodeURIComponent(sessionId)}`:'/'}>← Back to your voxel</a><a href="/">My Voxels</a></footer>
 </main>;
}
