'use client';

import {useState} from 'react';
import {connectVoxelPopCryptoWallet,sendVoxelPopEthPayment} from '../../lib/voxelpop-crypto';
import styles from './crypto.module.css';

const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

export default function CryptoCheckout({idea,flowId,attribution}){
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 async function pay(chainId){
  if(busy)return;
  if((idea||'').trim().length<3){setError('Describe what you want first.');return;}
  setBusy(true);setError('');setMessage(chainId===1?'Connecting to Ethereum…':'Connecting to Base…');
  try{
   sessionStorage.setItem('voxelPackBrief',JSON.stringify({idea:idea.trim(),style:'polished'}));
   fetch('/api/creator-pack/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName:'checkout_clicked',flowId,attribution,promptLength:idea.trim().length}),keepalive:true}).catch(()=>{});
   const wallet=await connectVoxelPopCryptoWallet(chainId);
   setMessage('Getting a live $1.99 ETH quote…');
   const quoteResponse=await fetch('/api/creator-pack/crypto/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet:wallet.address,chainId,style:'polished',flowId,attribution})});
   const quote=await quoteResponse.json();
   if(!quoteResponse.ok)throw new Error(quote.error||'Could not create the ETH quote.');
   setMessage(`Confirm ${quote.amountEth} ETH (about $1.99) on ${quote.chainName} in your wallet${quote.warning?' · '+quote.warning:''}`);
   const txHash=await sendVoxelPopEthPayment({provider:wallet.provider,from:wallet.address,receiver:quote.receiver,amountWei:quote.amountWei});
   setMessage('ETH sent. Waiting for blockchain confirmation…');
   for(let attempt=0;attempt<30;attempt++){
    const verifyResponse=await fetch('/api/creator-pack/crypto/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:quote.sessionId,wallet:wallet.address,txHash})});
    const verified=await verifyResponse.json();
    if(verifyResponse.ok&&verified.paid&&verified.successUrl){location.href=verified.successUrl;return;}
    if(verifyResponse.status!==409||!verified.pending)throw new Error(verified.error||'Could not verify the ETH payment.');
    await wait(2000);
   }
   throw new Error('The payment is still confirming. Your transaction is not lost; reopen this checkout after it confirms.');
  }catch(err){
   if(err?.code==='NO_WALLET_PROVIDER'&&err?.deepLink){location.href=err.deepLink;return;}
   setError(err instanceof Error?err.message:'ETH checkout failed.');setMessage('');setBusy(false);
  }
 }

 return <div className={styles.box}>
  <button type="button" className={styles.toggle} disabled={busy} onClick={()=>setOpen(v=>!v)}>◇ Pay $1.99 with ETH</button>
  {open&&<div className={styles.panel}>
   <div><b>Crypto checkout</b><span>Same voxel · same GLB + image · same VoxelFlip eligibility</span></div>
   <button type="button" disabled={busy} onClick={()=>pay(8453)}>Pay with ETH on Base <small>recommended · low gas</small></button>
   <button type="button" disabled={busy} onClick={()=>pay(1)}>Pay with ETH on Ethereum <small>mainnet · gas may exceed $1.99</small></button>
   <p>Base also uses ETH. If your ETH is only on Ethereum mainnet, the Ethereum option works for checkout; VoxelFlip minting itself is designed for Base to keep NFT gas lower.</p>
  </div>}
  {message&&<p className={styles.message}>{message}</p>}
  {error&&<p className={styles.error}>{error}</p>}
 </div>;
}
