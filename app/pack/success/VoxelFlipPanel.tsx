'use client';

import {useMemo,useState} from 'react';
import {connectVoxelFlipWallet,mintVoxelFlip,VOXELFLIP_CHAIN_NAME,voxelflipConfigured} from '../../../lib/voxelflip';
import styles from './success.module.css';

type Prepared={ready:boolean;assetId:string;metadataUrl:string;imageUrl:string;modelUrl:string;name:string;wallet:string;voucherId:string;mintConfigured:boolean;signature:string|null};
type Minted={tokenId:string;owner:string;hash:string;explorerUrl:string;openSeaUrl:string};

type Props={
 sessionId:string;
 taskId:string;
 image:string;
 name:string;
 idea:string;
};

export default function VoxelFlipPanel({sessionId,taskId,image,name,idea}:Props){
 const [stage,setStage]=useState<'idle'|'connecting'|'preparing'|'minting'|'verifying'|'done'|'error'>('idle');
 const [message,setMessage]=useState('');
 const [prepared,setPrepared]=useState<Prepared|null>(null);
 const [minted,setMinted]=useState<Minted|null>(null);
 const busy=['connecting','preparing','minting','verifying'].includes(stage);
 const buttonText=useMemo(()=>{
  if(stage==='connecting')return 'Connecting wallet…';
  if(stage==='preparing')return 'Packaging image + GLB…';
  if(stage==='minting')return 'Confirm mint in your wallet…';
  if(stage==='verifying')return 'Verifying ownership…';
  return 'Mint this 3D voxel';
 },[stage]);

 async function start(){
  if(busy)return;
  setMessage('');setStage('connecting');
  try{
   const wallet=await connectVoxelFlipWallet();
   setStage('preparing');
   const response=await fetch('/api/creator-pack/nft/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,image,name,idea,wallet:wallet.address})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not prepare this NFT.');
   setPrepared(data);
   if(!data.mintConfigured)throw new Error('VoxelFlip metadata is ready, but the secure mint signer is not configured on this deployment yet.');
   if(!voxelflipConfigured())throw new Error('VoxelFlip metadata is ready, but the collection contract is not configured on this deployment yet.');
   setStage('minting');
   const mintedResult=await mintVoxelFlip({metadataUrl:data.metadataUrl,voucherId:data.voucherId,signature:data.signature});
   if(!mintedResult?.tokenId)throw new Error('The wallet transaction completed but the token ID could not be read.');
   setStage('verifying');
   const confirm=await fetch('/api/creator-pack/nft/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,tokenId:mintedResult.tokenId,txHash:mintedResult.hash,wallet:mintedResult.owner})});
   const confirmed=await confirm.json();
   if(!confirm.ok)throw new Error(confirmed.error||'The mint was submitted but could not be verified yet.');
   const finalResult={...mintedResult,openSeaUrl:confirmed.openSeaUrl||mintedResult.openSeaUrl,explorerUrl:confirmed.explorerUrl||mintedResult.explorerUrl};
   setMinted(finalResult);setStage('done');setMessage('Your VoxelFlip NFT is minted and owned by your wallet. Open it on OpenSea to choose whether and how to list it.');
  }catch(err:any){
   if(err?.code==='NO_WALLET_PROVIDER'&&err?.deepLink){window.location.href=err.deepLink;return;}
   setStage('error');setMessage(err instanceof Error?err.message:'VoxelFlip minting failed.');
  }
 }

 return <section className={styles.flipPanel} aria-label="VoxelFlip NFT">
  <div className={styles.flipGlow}/>
  <div className={styles.flipTop}>
   <div><p>OPTIONAL · AFTER YOUR 3D MESH</p><h3>VoxelFlip</h3></div>
   <span>3D NFT · {VOXELFLIP_CHAIN_NAME} → OpenSea</span>
  </div>
  <p className={styles.flipLead}>Turn the exact GLB you just created into a wallet-owned 3D NFT, then hold it, transfer it, or list it on OpenSea at a price you choose.</p>
  <div className={styles.flipLadder}>
   <div><b>01</b><strong>$1.99 origin</strong><small>Your VoxelPop creation</small></div><i>→</i>
   <div><b>02</b><strong>Mint 3D NFT</strong><small>Image + GLB metadata</small></div><i>→</i>
   <div><b>03</b><strong>List or trade</strong><small>You choose the ask</small></div><i>→</i>
   <div><b>04</b><strong>Trade up</strong><small>Only if someone values it more</small></div>
  </div>
  {!minted&&<button className={styles.flipButton} disabled={busy} onClick={start}>{buttonText}</button>}
  {prepared&&!minted&&<div className={styles.flipPrepared}><span>✓ 3D NFT package ready</span><a href={prepared.metadataUrl} target="_blank" rel="noreferrer">View metadata</a></div>}
  {message&&<div className={`${styles.flipMessage} ${stage==='error'?styles.flipMessageError:''}`}>{message}</div>}
  {minted&&<div className={styles.flipSuccess}>
   <div><span>MINTED</span><b>VoxelFlip #{minted.tokenId}</b><small>{minted.owner.slice(0,6)}…{minted.owner.slice(-4)}</small></div>
   <a className={styles.flipOpenSea} href={minted.openSeaUrl} target="_blank" rel="noreferrer">Open on OpenSea ↗</a>
   <a className={styles.flipExplorer} href={minted.explorerUrl} target="_blank" rel="noreferrer">View transaction</a>
  </div>}
  <div className={styles.flipFine}>A higher resale is never guaranteed. The seller receives sale proceeds minus applicable marketplace and creator fees. Voxel Vault can receive creator earnings where they are configured and honored by the marketplace.</div>
 </section>;
}
