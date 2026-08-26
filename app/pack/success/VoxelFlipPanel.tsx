'use client';

import {useMemo,useState} from 'react';
import {connectVoxelFlipWallet,mintVoxelFlip,VOXELFLIP_CHAIN_NAME} from '../../../lib/voxelflip';
import styles from './VoxelFlipPanel.module.css';

type Prepared={ready:boolean;assetId:string;metadataUrl:string;imageUrl:string;modelUrl:string;name:string;wallet:string;voucherId:string;mintConfigured:boolean;signature:string|null};
type Minted={tokenId:string;owner:string;hash:string;explorerUrl:string;openSeaUrl:string};
type Props={sessionId:string;taskId:string;image:string;name:string;idea:string;};

export default function VoxelFlipPanel({sessionId,taskId,image,name,idea}:Props){
 const [stage,setStage]=useState<'idle'|'connecting'|'preparing'|'minting'|'verifying'|'done'|'error'>('idle');const [message,setMessage]=useState('');const [prepared,setPrepared]=useState<Prepared|null>(null);const [minted,setMinted]=useState<Minted|null>(null);const busy=['connecting','preparing','minting','verifying'].includes(stage);
 const buttonText=useMemo(()=>{if(stage==='connecting')return 'CONNECTING…';if(stage==='preparing')return 'PREPARING…';if(stage==='minting')return 'SIGN';if(stage==='verifying')return 'VERIFYING…';return 'MINT';},[stage]);
 async function start(){
  if(busy)return;setMessage('');setStage('connecting');
  try{const wallet=await connectVoxelFlipWallet();setStage('preparing');const response=await fetch('/api/creator-pack/nft/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,image,name,idea,wallet:wallet.address})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not prepare this NFT.');setPrepared(data);if(!data.mintConfigured)throw new Error('VoxelFlip metadata is ready, but the secure mint signer is not configured on this deployment yet.');setStage('minting');const mintedResult=await mintVoxelFlip({metadataUrl:data.metadataUrl,voucherId:data.voucherId,signature:data.signature});if(!mintedResult?.tokenId)throw new Error('The wallet transaction completed but the token ID could not be read.');setStage('verifying');const confirm=await fetch('/api/creator-pack/nft/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,taskId,tokenId:mintedResult.tokenId,txHash:mintedResult.hash,wallet:mintedResult.owner,metadataUrl:data.metadataUrl})});const confirmed=await confirm.json();if(!confirm.ok)throw new Error(confirmed.error||'The mint was submitted but could not be verified yet.');const finalResult={...mintedResult,openSeaUrl:confirmed.openSeaUrl||mintedResult.openSeaUrl,explorerUrl:confirmed.explorerUrl||mintedResult.explorerUrl};setMinted(finalResult);setStage('done');setMessage('Minted. You own it. List it only if you want to.');}
  catch(err:any){if(err?.code==='NO_WALLET_PROVIDER'&&err?.deepLink){window.location.href=err.deepLink;return;}setStage('error');setMessage(err instanceof Error?err.message:'VoxelFlip minting failed.');}
 }
 return <section id="voxelflip-mint" className={styles.panel} aria-label="VoxelFlip NFT">
  <div className={styles.glow}/><div className={styles.top}><div><p>OPTIONAL</p><h3>VoxelFlip</h3></div><span>{VOXELFLIP_CHAIN_NAME} · OPENSEA</span></div>
  <p className={styles.lead}>Turn this exact 3D voxel into an NFT you control.</p>
  <div className={styles.ladder}><div><b>1</b><strong>MINT</strong></div><i>→</i><div><b>2</b><strong>OWN</strong></div><i>→</i><div><b>3</b><strong>LIST</strong></div></div>
  {!minted&&<button className={styles.button} aria-label="Mint this 3D voxel as a VoxelFlip NFT" disabled={busy} onClick={start}>{buttonText}</button>}
  {prepared&&!minted&&<div className={styles.prepared}><span>READY</span><a href={prepared.metadataUrl} target="_blank" rel="noreferrer">DETAILS</a></div>}
  {message&&<div className={`${styles.message} ${stage==='error'?styles.messageError:''}`}>{message}</div>}
  {minted&&<div className={styles.success}><div><span>MINTED</span><b>VoxelFlip #{minted.tokenId}</b><small>{minted.owner.slice(0,6)}…{minted.owner.slice(-4)}</small></div><a className={styles.openSea} aria-label="Open or list this VoxelFlip on OpenSea" href={minted.openSeaUrl} target="_blank" rel="noreferrer">LIST</a><a className={styles.explorer} href={`/voxelflip?token=${encodeURIComponent(minted.tokenId)}`}>KEEP</a><a className={styles.explorer} href={minted.explorerUrl} target="_blank" rel="noreferrer">VERIFY</a></div>}
  <div className={styles.fine}>Minting requires your wallet approval on Base. Resale is never guaranteed; marketplace and creator fees may apply.</div>
 </section>;
}
