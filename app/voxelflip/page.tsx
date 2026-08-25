'use client';

import {useEffect,useMemo,useState} from 'react';
import GeneratedMeshViewer from '../pack/success/GeneratedMeshViewer';
import {connectVoxelFlipWallet} from '../../lib/voxelflip';
import styles from './voxelflip.module.css';

type Item={tokenId:string;owner:string;contract:string;tokenUri:string;openSeaUrl:string;explorerUrl:string;metadata:{name:string;description:string;image:string;animationUrl:string;externalUrl:string;attributes:any[]};openSea?:any};

function short(value:string){return value?`${value.slice(0,6)}…${value.slice(-4)}`:''}

export default function VoxelFlipVault(){
 const [wallet,setWallet]=useState('');
 const [token,setToken]=useState('');
 const [items,setItems]=useState<Item[]>([]);
 const [active,setActive]=useState<string>('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const storageKey=useMemo(()=>wallet?`voxelflip:kept:${wallet.toLowerCase()}`:'',[wallet]);

 useEffect(()=>{const p=new URLSearchParams(window.location.search);const incoming=p.get('token')||p.get('opensea')||'';if(incoming)setToken(incoming)},[]);
 useEffect(()=>{if(!storageKey)return;try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved)){setItems(saved);if(saved[0]?.tokenId)setActive(String(saved[0].tokenId))}}catch{}},[storageKey]);
 function persist(next:Item[]){setItems(next);try{if(storageKey)localStorage.setItem(storageKey,JSON.stringify(next))}catch{}}

 async function connect(){setError('');setMessage('Connecting wallet on Base…');try{const result=await connectVoxelFlipWallet();setWallet(result.address);setMessage(`Connected ${short(result.address)}`)}catch(err:any){if(err?.code==='NO_WALLET_PROVIDER'&&err?.deepLink){location.href=err.deepLink;return}setError(err instanceof Error?err.message:'Wallet connection failed.');setMessage('')}}
 async function importToken(){if(!wallet){await connect();return}if(!token.trim()){setError('Paste an OpenSea VoxelFlip URL or token ID.');return}setBusy(true);setError('');setMessage('Verifying ownership and restoring 3D metadata…');try{const response=await fetch('/api/creator-pack/nft/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet,token:token.trim()})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not import this VoxelFlip.');const next=[data,...items.filter(item=>String(item.tokenId)!==String(data.tokenId))].slice(0,50);persist(next);setActive(String(data.tokenId));setToken('');setMessage(`VoxelFlip #${data.tokenId} is back in your VoxelPop vault.`)}catch(err){setError(err instanceof Error?err.message:'Import failed.');setMessage('')}finally{setBusy(false)}}
 function remove(tokenId:string){const next=items.filter(item=>item.tokenId!==tokenId);persist(next);if(active===tokenId)setActive(next[0]?.tokenId||'')}
 const selected=items.find(item=>item.tokenId===active)||items[0]||null;

 return <main className={styles.page}>
  <nav><a href="/studio"><b>VoxelPop</b></a><span>VOXELFLIP VAULT</span></nav>
  <header><p>OPEN SEA → BACK TO VOXELPOP</p><h1>Keep your flips<br/><em>in one place.</em></h1><span>Import a VoxelFlip you currently own. VoxelPop verifies ownership on-chain, restores the image + GLB metadata, and keeps it in your browser vault.</span></header>
  <section className={styles.importer}>
   <div className={styles.wallet}><b>{wallet?`Connected · ${short(wallet)}`:'Connect the wallet that owns the NFT'}</b><button onClick={connect}>{wallet?'Reconnect':'Connect wallet'}</button></div>
   <label><span>OpenSea asset URL or VoxelFlip token ID</span><input value={token} onChange={e=>setToken(e.target.value)} placeholder="https://opensea.io/assets/base/.../1 or 1"/></label>
   <button className={styles.importButton} disabled={busy} onClick={importToken}>{busy?'Verifying on-chain…':'Import to VoxelPop'}</button>
   {message&&<p className={styles.message}>{message}</p>}{error&&<p className={styles.error}>{error}</p>}
  </section>
  {selected&&<section className={styles.feature}>
   <div className={styles.viewer}>{selected.metadata.animationUrl?<GeneratedMeshViewer url={selected.metadata.animationUrl} label={selected.metadata.name}/>:selected.metadata.image?<img src={selected.metadata.image} alt={selected.metadata.name}/>:null}</div>
   <div className={styles.details}><small>VOXELFLIP #{selected.tokenId}</small><h2>{selected.metadata.name}</h2><p>{selected.metadata.description}</p><div className={styles.actions}><a href={selected.openSeaUrl} target="_blank" rel="noreferrer">Open / list on OpenSea ↗</a><a href={selected.explorerUrl} target="_blank" rel="noreferrer">Verify on-chain</a></div><em>Trading can increase or decrease value. VoxelPop does not guarantee a resale, profit, or higher trade.</em></div>
  </section>}
  <section className={styles.collection}><div className={styles.collectionHead}><div><small>MY VOXELFLIPS</small><h2>{items.length} kept here</h2></div><span>Wallet ownership is re-verified whenever you import.</span></div>{items.length?<div className={styles.grid}>{items.map(item=><article key={item.tokenId} className={item.tokenId===selected?.tokenId?styles.active:''} onClick={()=>setActive(item.tokenId)}><div>{item.metadata.image?<img src={item.metadata.image} alt={item.metadata.name}/>:<span>3D</span>}</div><b>#{item.tokenId} · {item.metadata.name}</b><button onClick={e=>{e.stopPropagation();remove(item.tokenId)}}>Remove</button></article>)}</div>:<div className={styles.empty}>Mint a VoxelFlip or paste one of your OpenSea asset links above.</div>}</section>
  <footer><a href="/studio">← Create another voxel</a><span>Only NFTs owned by the connected wallet can be imported.</span></footer>
 </main>;
}
