'use client';

import {useEffect,useState} from 'react';
import {connectVoxelFlipWallet} from '../../lib/voxelflip';
import styles from './forge.module.css';

const TOKEN_RE=/^\d+$/;
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function errorText(error){return String(error?.reason||error?.message||error||'')}

export default function ForgePage(){
 const [wallet,setWallet]=useState('');
 const [tokenIds,setTokenIds]=useState(['','','']);
 const [preview,setPreview]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const first=q.get('tokenId')||'';
  const w=q.get('wallet')||'';
  if(TOKEN_RE.test(first))setTokenIds([first,'','']);
  if(/^0x[a-fA-F0-9]{40}$/.test(w))setWallet(w);
 },[]);

 async function connect(){
  setBusy(true);setError('');
  try{const result=await connectVoxelFlipWallet();setWallet(result.address);setPreview(null)}
  catch(e){if(e?.code==='NO_WALLET_PROVIDER'&&e?.deepLink){location.href=e.deepLink;return}setError(errorText(e)||'Wallet connection failed.')}
  finally{setBusy(false)}
 }

 function setToken(index,value){
  const clean=value.replace(/\D/g,'').slice(0,78);
  setTokenIds(current=>current.map((tokenId,i)=>i===index?clean:tokenId));
  setPreview(null);setError('');
 }

 async function buildPreview(){
  if(!wallet){await connect();return}
  if(tokenIds.some(tokenId=>!TOKEN_RE.test(tokenId))){setError('Enter three VoxelFlip token IDs first.');return}
  if(new Set(tokenIds).size!==3){setError('Choose three different VoxelFlips.');return}
  setBusy(true);setError('');setPreview(null);
  try{
   const response=await fetch('/api/voxelflip/forge/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet,tokenIds})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Forge preview failed.');
   setPreview(data);
  }catch(e){setError(errorText(e)||'Forge preview failed safely.')}
  finally{setBusy(false)}
 }

 const palette=preview?.descendant?.palette||['#9c83ff','#c8ff54','#6f5cff'];
 const allTokensReady=tokenIds.every(tokenId=>TOKEN_RE.test(tokenId))&&new Set(tokenIds).size===3;

 return <main className={styles.page}>
  <nav className={styles.nav}>
   <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
   <em>THE FORGE</em>
  </nav>

  <div className={styles.shell}>
   <header className={styles.hero}>
    <p>VOXELFLIP FORGE · V1</p>
    <h1>Three become <em>one.</em></h1>
    <span>Choose three VoxelFlips. Forge verifies ownership on Base and builds one descendant recipe from their traits.</span>
   </header>

   <section className={styles.panel}>
    <div className={styles.topRow}>
     <div><small>BASE WALLET</small><b>{wallet?short(wallet):'Not connected'}</b></div>
     <button onClick={connect} disabled={busy}>{wallet?'CHANGE WALLET':'CONNECT WALLET'}</button>
    </div>

    <div className={styles.safety}>
     <b>Preview first.</b>
     <span>Nothing on this Forge preview can burn, mint, approve, sign, or charge your wallet.</span>
    </div>

    <div className={styles.sectionHead}><small>PARENTS</small><h2>Pick 3 VoxelFlips</h2></div>
    <div className={styles.tokenGrid}>
     {tokenIds.map((tokenId,index)=><label key={index} className={styles.tokenInput}>
      <span>PARENT {index+1}</span>
      <div><b>#</b><input inputMode="numeric" pattern="[0-9]*" value={tokenId} onChange={e=>setToken(index,e.target.value)} placeholder={String(index+1)}/></div>
     </label>)}
    </div>

    {error&&<div className={styles.error}>{error}</div>}
    <button className={styles.previewButton} onClick={buildPreview} disabled={busy||(!wallet&&!allTokensReady)}>{busy?'VERIFYING ON BASE…':wallet?'VERIFY 3 + BUILD DESCENDANT':'CONNECT WALLET TO START'}</button>
    <p className={styles.helper}>The same three parents always produce the same V1 recipe. There is no paid reroll.</p>
   </section>

   {preview&&<section className={styles.result}>
    <div className={styles.verified}><b>✓ ALL 3 OWNED BY {short(preview.wallet)}</b><span>Verified on Base</span></div>

    <div className={styles.parents}>
     {preview.parents.map((parent,index)=><article key={parent.tokenId}>
      <div className={styles.parentImage}>{parent.image?<img src={parent.image} alt={parent.name}/>:<b>#{parent.tokenId}</b>}</div>
      <small>PARENT {index+1}</small>
      <h3>{parent.name}</h3>
      <p>VoxelFlip #{parent.tokenId}</p>
      {parent.attributes?.slice(0,2).map((trait,i)=><span key={`${trait.traitType}-${i}`}>{trait.traitType}: <b>{trait.value}</b></span>)}
     </article>)}
    </div>

    <div className={styles.forgeArrow}><span>3 VERIFIED PARENTS</span><b>↓ FORGE ↓</b></div>

    <div className={styles.descendant}>
     <div className={styles.fusionArt} style={{'--forge-a':palette[0],'--forge-b':palette[1],'--forge-c':palette[2]}}>
      <div/><div/><div/><strong>{preview.descendant.forgeClass}</strong>
     </div>
     <div className={styles.descendantInfo}>
      <small>DESCENDANT RECIPE</small>
      <h2>{preview.descendant.name}</h2>
      <p>{preview.descendant.conceptPrompt}</p>
      <div className={styles.inherited}>
       {preview.descendant.inheritedTraits.map(trait=><span key={trait.fromTokenId}><i>#{trait.fromTokenId}</i><b>{trait.traitType}</b>{trait.value}</span>)}
      </div>
      <div className={styles.signature}><span>FUSION SIGNATURE</span><b>{preview.descendant.signature}</b></div>
     </div>
    </div>

    <div className={styles.checkoutPreview}>
     <div><small>PLANNED FORGE FEE</small><b>${preview.feeUsd}</b></div>
     <div><small>FINAL TRANSACTION</small><b>3 PARENTS → 1 DESCENDANT</b></div>
     <button disabled>ON-CHAIN FORGE LOCKED UNTIL ATOMIC SAFETY IS READY</button>
    </div>
    <p className={styles.atomicNote}>The production NFT can mint securely with one-time vouchers, but it does not currently expose one atomic “consume 3 + mint 1” Forge call. The final button stays locked until that step can happen safely in one wallet-approved transaction.</p>
   </section>}
  </div>

  <footer className={styles.footer}><a href="/voxelflip/autopilot">← AUTOPILOT</a><a href="/studio#my-voxels">MY VOXELS</a></footer>
 </main>;
}
