'use client';

import {useEffect,useRef,useState} from 'react';
import GeneratedMeshViewer from '../../pack/success/GeneratedMeshViewer';
import {getSupabaseBrowserAsync} from '../../../lib/supabase-browser';
import {loadAccountVoxel,saveVoxelToAccount} from '../../../lib/voxelpop-account';
import {connectVoxelFlipWallet,mintVoxelFlip} from '../../../lib/voxelflip';
import styles from '../../mint-trade/mint-trade.module.css';

const VERIFY_REQUEST_TIMEOUT_MS=35000;
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:''}
function errorText(error){return String(error?.reason||error?.message||error||'')}
function validAddress(value){return /^0x[a-fA-F0-9]{40}$/.test(String(value||''))}
function isVoucherUsedError(error){const text=errorText(error).toLowerCase();return text.includes('voucher already used')||text.includes('voucher is already minted')||text.includes('voucher was already minted')}
function isStaleVerificationError(error){const text=errorText(error).toLowerCase();return text.includes('did not mint from the registered voxelflip contract')||text.includes('connected wallet does not own')||text.includes('minted token metadata does not match')||text.includes('mint confirmation details are incomplete')}
async function fetchWithTimeout(url,options,timeoutMs=VERIFY_REQUEST_TIMEOUT_MS){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{return await fetch(url,{...options,signal:controller.signal})}catch(error){if(error?.name==='AbortError')throw new Error('Base verification took too long. Your mint is saved. Tap Resume mint verification; do not mint again.');throw error}finally{clearTimeout(timer)}
}

export default function VoxelFlipMintPage(){
 const [sessionId,setSessionId]=useState('');
 const [voxel,setVoxel]=useState(null);
 const [wallet,setWallet]=useState('');
 const [stage,setStage]=useState('loading');
 const [message,setMessage]=useState('Loading your paid voxel…');
 const [minted,setMinted]=useState(null);
 const [pendingMint,setPendingMint]=useState(null);
 const [recoverMode,setRecoverMode]=useState(false);
 const recovering=useRef(false);

 useEffect(()=>{
  const sid=new URLSearchParams(window.location.search).get('session_id')||'';setSessionId(sid);
  if(!sid){setStage('error');setMessage('Open Mint from one of your paid voxels.');return;}
  let local=null;
  try{local=JSON.parse(localStorage.getItem(`voxelpop:${sid}`)||'null')}catch{}
  if(local?.asset?.dataUrl){setVoxel(local);setStage('ready');setMessage(local.mesh?.status==='ready'?'Your 3D voxel is ready for VoxelFlip.':'Finish the 3D mesh before minting.');}

  getSupabaseBrowserAsync().then(async supabase=>{
   const {data}=await supabase.auth.getSession();const user=data.session?.user;if(!user||local?.asset?.dataUrl)return;
   try{const record=await loadAccountVoxel(supabase,user,sid);if(record?.payload?.asset?.dataUrl){setVoxel(record.payload);if(record.payload.mint?.tokenId){setMinted(record.payload.mint);setWallet(record.payload.mint.owner||'');setStage('done');setMessage(`VoxelFlip #${record.payload.mint.tokenId} is already minted and confirmed.`)}else{setStage('ready');setMessage(record.payload.mesh?.status==='ready'?'Restored from Google. Ready for VoxelFlip.':'Restored from Google. Finish its 3D mesh first.')}}}catch{}
  }).catch(()=>{});

  let confirmed=local?.mint?.tokenId?local.mint:null;
  try{const savedMint=JSON.parse(localStorage.getItem(`voxelflip:mint:${sid}`)||'null');if(savedMint?.tokenId)confirmed=savedMint}catch{}
  if(confirmed?.tokenId){setMinted(confirmed);setWallet(confirmed.owner||'');setStage('done');setMessage(`VoxelFlip #${confirmed.tokenId} is already minted and confirmed.`)}
  if(!confirmed?.tokenId){try{const pending=JSON.parse(localStorage.getItem(`voxelflip:pending:${sid}`)||'null');if(pending?.tokenId&&pending?.hash&&pending?.metadataUrl){setPendingMint(pending);setWallet(pending.owner||'');setStage('ready');setMessage(`A previous Base transaction is saved for VoxelFlip #${pending.tokenId}. Resume verification before doing anything else.`)}}catch{}}
 },[]);

 useEffect(()=>{if(!sessionId||!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'||voxel.mesh?.taskId||recovering.current)return;recoverTask(voxel)},[sessionId,voxel?.asset?.dataUrl,voxel?.mesh?.status,voxel?.mesh?.taskId]);

 async function persist(next){const saved={...next,updatedAt:new Date().toISOString()};setVoxel(saved);try{localStorage.setItem(`voxelpop:${sessionId}`,JSON.stringify(saved))}catch{}}
 async function recoverTask(current){
  if(recovering.current||!sessionId||!current?.asset?.dataUrl)return current?.mesh?.taskId||'';recovering.current=true;
  try{setMessage('Restoring the finished 3D mesh…');const response=await fetch('/api/creator-pack/mesh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,index:0,image:current.asset.dataUrl,name:current.asset.name||'your-voxel',idea:current.idea||current.asset.name||'VoxelPop creation',forceRestart:false})});const data=await response.json();if(!response.ok||!data.taskId)throw new Error(data.error||'Could not restore the 3D mesh task.');const next={...current,mesh:{...(current.mesh||{}),taskId:String(data.taskId),status:'ready'}};await persist(next);setStage('ready');setMessage('3D mesh restored. Ready for VoxelFlip.');return String(data.taskId)}catch(error){setStage('error');setMessage(errorText(error)||'Could not restore this mesh.');return ''}finally{recovering.current=false}
 }
 async function verifySubmitted(submission){
  setStage('verifying');setMessage(`Verifying VoxelFlip #${submission.tokenId} on Base…`);
  const txHash=submission.hash||submission.txHash||'';const confirm=await fetchWithTimeout('/api/creator-pack/nft/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId:submission.taskId,tokenId:submission.tokenId,txHash,wallet:submission.owner,metadataUrl:submission.metadataUrl})});const verified=await confirm.json();if(!confirm.ok)throw new Error(verified.error||'The mint was submitted but could not be verified yet.');const finalResult={...submission,hash:txHash,owner:verified.wallet||submission.owner,openSeaUrl:verified.openSeaUrl||submission.openSeaUrl||'',explorerUrl:verified.explorerUrl||submission.explorerUrl||''};const nextVoxel=voxel?.asset?.dataUrl?{...voxel,mint:finalResult,updatedAt:new Date().toISOString()}:null;setMinted(finalResult);if(nextVoxel)setVoxel(nextVoxel);setPendingMint(null);setRecoverMode(false);setWallet(finalResult.owner||wallet);setStage('done');setMessage(`VoxelFlip #${finalResult.tokenId} is minted and owned by ${short(finalResult.owner)}.`);try{localStorage.setItem(`voxelflip:mint:${sessionId}`,JSON.stringify(finalResult));localStorage.removeItem(`voxelflip:pending:${sessionId}`);if(nextVoxel)localStorage.setItem(`voxelpop:${sessionId}`,JSON.stringify(nextVoxel))}catch{};if(nextVoxel){getSupabaseBrowserAsync().then(async supabase=>{const {data}=await supabase.auth.getSession();if(data.session?.user)await saveVoxelToAccount(supabase,data.session.user,sessionId,nextVoxel)}).catch(()=>{})}return finalResult
 }
 async function resumeVerification(){if(!pendingMint)return;try{await verifySubmitted(pendingMint)}catch(error){if(isStaleVerificationError(error)){try{localStorage.removeItem(`voxelflip:pending:${sessionId}`)}catch{}setPendingMint(null);setRecoverMode(true);setStage('error');setMessage('The saved browser transaction was not the VoxelFlip mint. It was cleared safely. Tap Recover existing mint — no new mint will be sent.');return}setStage('error');setMessage(`Verification is still pending: ${errorText(error)||'Base RPC unavailable'}. Do not mint again.`)}}
 async function recoverExistingMint(){
  if(!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'){setStage('error');setMessage('Finish the 3D mesh before recovering its VoxelFlip.');return}
  let taskId=voxel.mesh?.taskId||'';if(!taskId)taskId=await recoverTask(voxel);if(!taskId)return;
  let recoveryWallet=wallet;
  try{
   if(!validAddress(recoveryWallet)){
    setStage('connecting');setMessage('Connect the MetaMask wallet that should own this existing VoxelFlip. Recovery will not create a transaction.');
    const connected=await connectVoxelFlipWallet();recoveryWallet=connected.address;setWallet(connected.address);
   }
   setStage('preparing');setMessage('Checking Base for the original VoxelFlip… This is read-only. No new mint transaction will be sent.');
   const response=await fetchWithTimeout('/api/creator-pack/nft/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,wallet:recoveryWallet})},45000);
   const recovered=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===404&&recovered?.voucherUsed===false){setRecoverMode(false);setStage('ready');setMessage('No existing VoxelFlip was found and this voucher is unused. It is safe to mint this voxel now.');return}
    setRecoverMode(true);setStage('error');setMessage(recovered.error||'The existing mint could not be recovered yet. No new mint transaction was sent.');return;
   }
   const existing=recovered.existingMint;
   if(!existing?.tokenId||!existing?.txHash||!existing?.metadataUrl)throw new Error('Base returned no complete VoxelFlip mint record. No new transaction was sent.');
   const submission={tokenId:String(existing.tokenId),owner:existing.owner||recoveryWallet,hash:existing.txHash,status:'confirmed',metadataUrl:existing.metadataUrl,taskId,openSeaUrl:recovered.openSeaUrl||'',explorerUrl:recovered.explorerUrl||''};
   setPendingMint(submission);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}
   setMessage(`Found VoxelFlip #${submission.tokenId}. Verifying the original Base transaction…`);
   await verifySubmitted(submission);
  }catch(error){if(error?.code==='NO_WALLET_PROVIDER'&&error?.deepLink){location.href=error.deepLink;return}setRecoverMode(true);setStage('error');setMessage(`${errorText(error)||'Existing mint recovery is temporarily unavailable.'} No new mint transaction was sent.`)}
 }
 async function mint(){
  if(pendingMint){await resumeVerification();return}
  if(!voxel?.asset?.dataUrl||voxel.mesh?.status!=='ready'){setStage('error');setMessage('Finish the 3D mesh before minting.');return}
  let taskId=voxel.mesh?.taskId||'';if(!taskId)taskId=await recoverTask(voxel);if(!taskId)return;let submission=null;
  try{
   setStage('connecting');setMessage('Connect the wallet that should own this VoxelFlip.');const connected=await connectVoxelFlipWallet();setWallet(connected.address);
   setStage('preparing');setMessage('Checking Base for an existing voucher before creating a mint…');const prep=await fetch('/api/creator-pack/nft/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,image:voxel.asset.dataUrl,name:voxel.asset.name||'your-voxel',idea:voxel.idea||voxel.asset.name||'VoxelPop creation',wallet:connected.address})});const prepared=await prep.json();if(!prep.ok){if(prepared?.voucherUsed)setRecoverMode(true);throw new Error(prepared.error||'Could not prepare or recover this VoxelFlip.')}
   if(prepared.existingMint?.tokenId&&prepared.existingMint?.txHash){const chainMetadataUrl=prepared.existingMint.metadataUrl||prepared.metadataUrl;submission={tokenId:String(prepared.existingMint.tokenId),owner:prepared.existingMint.owner||connected.address,hash:prepared.existingMint.txHash,status:'confirmed',metadataUrl:chainMetadataUrl,taskId,openSeaUrl:'',explorerUrl:''};setPendingMint(submission);setRecoverMode(true);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}setMessage(`Recovered VoxelFlip #${submission.tokenId}. Verifying the original Base transaction…`);await verifySubmitted(submission);return}
   if(prepared.voucherUsed){setRecoverMode(true);throw new Error('This voucher is already minted. Recover the existing mint instead of creating another.')}
   if(!prepared.mintConfigured||!prepared.signature)throw new Error('The secure VoxelFlip mint signer is not configured on this deployment.')
   setStage('minting');setMessage('Confirm this one Base mint in your wallet. VoxelFlip will remember it and verify it automatically.');const result=await mintVoxelFlip({metadataUrl:prepared.metadataUrl,voucherId:prepared.voucherId,signature:prepared.signature});if(!result?.tokenId)throw new Error('The mint transaction completed but the token ID could not be read.');submission={...result,metadataUrl:prepared.metadataUrl,taskId};setPendingMint(submission);try{localStorage.setItem(`voxelflip:pending:${sessionId}`,JSON.stringify(submission))}catch{}await verifySubmitted(submission)
  }catch(error){if(error?.code==='NO_WALLET_PROVIDER'&&error?.deepLink){location.href=error.deepLink;return}if(submission?.tokenId){setPendingMint(submission);setStage('error');setMessage(`VoxelFlip #${submission.tokenId} was submitted. Verification is not finished: ${errorText(error)||'temporarily unavailable'}. Resume; do not mint again.`);return}if(isVoucherUsedError(error)){setRecoverMode(true);setStage('error');setMessage('That one-time voucher is already consumed. Tap Recover existing mint; VoxelFlip will not issue another mint.');return}setStage('error');setMessage(errorText(error)||'VoxelFlip minting failed.')}
 }

 const asset=voxel?.asset;const mesh=voxel?.mesh;const taskId=mesh?.taskId||'';const previewUrl=sessionId&&taskId?`/api/creator-pack/mesh?${new URLSearchParams({sessionId,taskId,preview:'1'}).toString()}`:'';const busy=['connecting','preparing','minting','verifying'].includes(stage);const mintLabel=pendingMint?(stage==='verifying'?'Verifying existing mint…':'Resume mint verification'):recoverMode?(stage==='connecting'?'Connecting wallet…':stage==='preparing'?'Checking Base for existing mint…':'Recover existing mint'):stage==='connecting'?'Connecting wallet…':stage==='preparing'?'Checking Base…':stage==='minting'?'Confirm mint in wallet…':stage==='verifying'?'Verifying on Base…':'Mint this voxel on Base';
 const autopilotHref=`/voxelflip/autopilot?${new URLSearchParams({wallet:minted?.owner||wallet,tokenId:String(minted?.tokenId||''),session_id:sessionId}).toString()}`;

 return <main className={styles.page}>
  <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>VOXELFLIP · MINT</em></nav>
  <header className={styles.hero}><p>VOXELPOP → VOXELFLIP</p><h1>Mint it.<br/><em>Verify it.</em></h1><span>This page does one job: create or recover your Base NFT without ever sending a duplicate mint.</span></header>
  <section className={styles.assetCard}>
   <div className={styles.preview}>{previewUrl&&mesh?.status==='ready'?<GeneratedMeshViewer url={previewUrl} label={asset?.name||'Your voxel'}/>:asset?.dataUrl?<img src={asset.dataUrl} alt={asset.name||'Your voxel'}/>:<div className={styles.missing}>Sign in with Google in VoxelPop Studio or open this page from your paid voxel.</div>}</div>
   <div className={styles.assetInfo}><small>YOUR PAID VOXEL</small><h2>{(asset?.name||'Your voxel').replaceAll('-',' ')}</h2><div className={styles.statusRow}><span>{mesh?.status==='ready'?'✓ 3D READY':'3D NOT READY'}</span><span>Base mainnet</span></div><p>{message}</p>{!minted&&<button disabled={busy||(!pendingMint&&(!asset?.dataUrl||mesh?.status!=='ready'))} onClick={pendingMint?resumeVerification:recoverMode?recoverExistingMint:mint}>{mintLabel}</button>}{minted&&<div className={styles.minted}><b>✓ VoxelFlip #{minted.tokenId} confirmed</b><a href={minted.openSeaUrl} target="_blank" rel="noreferrer">Open on OpenSea ↗</a><a href={minted.explorerUrl} target="_blank" rel="noreferrer">Verify on Base ↗</a><a href={autopilotHref}>Open Autopilot Trading →</a></div>}</div>
  </section>
  <footer className={styles.footer}><a href={sessionId?`/pack/success?session_id=${encodeURIComponent(sessionId)}`:'/studio'}>← Back to voxel</a><a href="/studio#my-voxels">My Voxels / Google</a></footer>
 </main>;
}
