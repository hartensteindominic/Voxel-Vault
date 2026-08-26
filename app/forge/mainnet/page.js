'use client';

import {useMemo,useState} from 'react';
import {BrowserProvider,Contract,Interface,formatEther,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import styles from '../real/real.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const FORGE_ABI=[
  'function forge((address account,address parentContract0,uint256 parentTokenId0,address parentContract1,uint256 parentTokenId1,address parentContract2,uint256 parentTokenId2,bytes32 descendantUriHash,uint256 feeWei,bytes32 requestId,uint64 deadline) request,string descendantURI,bytes signature) payable returns (uint256 descendantTokenId)',
  'event Forged(uint256 indexed descendantTokenId,address indexed account,uint256 feeWei,bytes32 indexed requestId,address parentContract0,uint256 parentTokenId0,address parentContract1,uint256 parentTokenId1,address parentContract2,uint256 parentTokenId2,bytes32 descendantUriHash)',
];

function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Wallet action failed.')}
function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}

async function ensureBase(provider){
  let chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId===BASE_CHAIN_ID)return;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_CHAIN_ID}]})}
  catch(error){
    if(error?.code===4001)throw new Error('Base network switch was cancelled.');
    if(error?.code!==4902)throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:BASE_CHAIN_ID,chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[BASE_RPC],blockExplorerUrls:[BASE_EXPLORER]}]});
  }
  chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId!==BASE_CHAIN_ID)throw new Error('Switch MetaMask to Base before forging.');
}

export default function MainnetForgePage(){
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [assets,setAssets]=useState([]);
  const [selectedKeys,setSelectedKeys]=useState([]);
  const [authorization,setAuthorization]=useState(null);
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');

  const eligible=useMemo(()=>assets.filter(asset=>asset.selectable&&asset.currentProduction),[assets]);
  const selected=useMemo(()=>selectedKeys.map(key=>assets.find(asset=>`${asset.contract}:${asset.tokenId}`===key)).filter(Boolean),[selectedKeys,assets]);

  async function connect(){
    setBusy(true);setError('');setAuthorization(null);setResult(null);
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){window.location.href=getMetaMaskDeepLink(window.location.href);return}
      const accounts=await injected.request({method:'eth_requestAccounts'});
      if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      const address=getAddress(accounts[0]);
      setProvider(injected);setWallet(address);
      setStatus('Wallet connected. Loading your verified VoxelFlip NFTs on Base…');
      await loadAssets(address);
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  async function loadAssets(address=wallet){
    if(!address)throw new Error('Connect MetaMask first.');
    setBusy(true);setError('');setAuthorization(null);setResult(null);setSelectedKeys([]);
    try{
      const response=await fetch(`/api/forge/owned-assets?${new URLSearchParams({wallet:address})}`,{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not load your Base VoxelFlip NFTs.');
      const list=Array.isArray(data.nfts)?data.nfts.filter(asset=>asset.currentProduction===true&&asset.selectable!==false):[];
      setAssets(list);
      setStatus(list.length>=3?`Found ${list.length} verified production VoxelFlip NFTs. Choose exactly three parents.`:`Found ${list.length} eligible VoxelFlip NFT${list.length===1?'':'s'}. You need three to use the revenue Forge.`);
    }finally{setBusy(false)}
  }

  function toggle(asset){
    if(authorization||result)return;
    const key=`${asset.contract}:${asset.tokenId}`;
    setSelectedKeys(current=>current.includes(key)?current.filter(item=>item!==key):current.length>=3?current:[...current,key]);
  }

  async function reviewFee(){
    if(selected.length!==3)throw new Error('Choose exactly three parent NFTs.');
    setBusy(true);setError('');setAuthorization(null);setResult(null);
    try{
      const response=await fetch('/api/forge/mainnet-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet,parents:selected.map(asset=>({contract:asset.contract,tokenId:asset.tokenId}))})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not prepare the real Base Forge.');
      setAuthorization(data);
      setStatus(`Ready. The Forge fee is ${formatEther(BigInt(data.feeWei))} ETH. MetaMask will show the exact Base transaction before anything is paid.`);
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  async function forge(){
    if(!authorization)throw new Error('Review the live Forge fee first.');
    if(!provider||!wallet)throw new Error('Connect MetaMask first.');
    setBusy(true);setError('');setResult(null);
    try{
      await ensureBase(provider);
      const accounts=await provider.request({method:'eth_accounts'});
      if(!accounts?.[0]||getAddress(accounts[0])!==getAddress(wallet))throw new Error('The connected wallet changed. Reconnect before paying.');
      const browserProvider=new BrowserProvider(provider);
      const signer=await browserProvider.getSigner(wallet);
      const contract=new Contract(getAddress(authorization.forge),FORGE_ABI,signer);
      const req=authorization.request;
      const requestForContract={
        account:getAddress(req.account),
        parentContract0:getAddress(req.parentContract0),parentTokenId0:BigInt(req.parentTokenId0),
        parentContract1:getAddress(req.parentContract1),parentTokenId1:BigInt(req.parentTokenId1),
        parentContract2:getAddress(req.parentContract2),parentTokenId2:BigInt(req.parentTokenId2),
        descendantUriHash:req.descendantUriHash,
        feeWei:BigInt(req.feeWei),requestId:req.requestId,deadline:BigInt(req.deadline),
      };
      setStatus(`Opening MetaMask for a REAL Base transaction of ${formatEther(BigInt(authorization.feeWei))} ETH plus gas. Your three parent NFTs are not approved or transferred.`);
      const tx=await contract.forge(requestForContract,authorization.descendantURI,authorization.signature,{value:BigInt(authorization.feeWei)});
      setStatus('Forge transaction submitted. Waiting for Base confirmation…');
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The Base Forge transaction did not succeed.');
      const iface=new Interface(FORGE_ABI);let event=null;
      for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='Forged'){event=parsed;break}}catch{}}
      if(!event)throw new Error('Forge confirmed, but the descendant event could not be decoded.');
      const finished={tokenId:event.args.descendantTokenId.toString(),txHash:receipt.hash||tx.hash,feeWei:event.args.feeWei.toString()};
      setResult(finished);setAuthorization(null);
      setStatus(`Confirmed on Base. Descendant #${finished.tokenId} was minted to your wallet and the ${formatEther(BigInt(finished.feeWei))} ETH Forge fee is now revenue held by the Forge contract for treasury withdrawal.`);
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>Voxel Forge</b></a><em>BASE · REAL ETH</em></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><p>REVENUE FORGE · BASE MAINNET</p><h1>Three parents.<br/><em>One real descendant.</em></h1><span>This is the paid production path. The parent NFTs stay in the customer wallet. A successful Forge mints a separate descendant and collects the displayed ETH fee as Forge revenue.</span></header>

      <section className={styles.panel}>
        <div className={styles.safety} style={{background:'rgba(255,183,77,.08)',borderColor:'rgba(255,183,77,.26)'}}><b style={{color:'#ffcf76'}}>REAL MONEY MODE</b><span>This page uses Base mainnet ETH, not Sepolia test ETH. Nothing is paid until MetaMask displays a transaction and you approve it.</span></div>
        <div className={styles.safety} style={{marginTop:12,background:'rgba(190,255,55,.06)',borderColor:'rgba(190,255,55,.22)'}}><b>HOW FORGE REVENUE WORKS</b><span>A customer who completes a Forge pays the live contract fee (launch target: 0.001 ETH). That ETH accrues inside the Forge contract and can be withdrawn only by the Forge owner to the configured treasury. Forging from your own owner wallet is useful as a test, but it is not new outside revenue. The 5% ERC-2981 royalty is a royalty request for marketplaces that honor it; secondary-sale royalty payment is not guaranteed.</span></div>
        <div className={styles.row}><div><small>CONNECTED WALLET</small><b>{wallet||'Not connected'}</b></div><button onClick={connect} disabled={busy}>{wallet?'RECONNECT':'CONNECT METAMASK'}</button></div>
        <button className={styles.primary} onClick={()=>wallet?loadAssets():connect()} disabled={busy}>{busy?'WORKING…':wallet?'LOAD VERIFIED VOXELFLIP NFTS':'CONNECT TO START'}</button>
        {status&&<div className={styles.notice}><b>STATUS</b><span>{status}</span></div>}
        {error&&<div className={styles.error}>{error}</div>}
      </section>

      {assets.length>0&&<section className={styles.panel}>
        <div className={styles.sectionHead}><small>1 · CHOOSE THREE</small><h2>Select the lineage.</h2><p>Only NFTs from the reviewed production VoxelFlip collection that Base currently confirms are owned by this wallet can be selected.</p></div>
        <div className={styles.assetGrid}>{assets.map(asset=>{const key=`${asset.contract}:${asset.tokenId}`;const chosen=selectedKeys.includes(key);return <button key={key} type="button" className={`${styles.asset} ${chosen?styles.selected:''}`} onClick={()=>toggle(asset)} disabled={Boolean(authorization)||Boolean(result)}><span className={styles.check}>{chosen?'✓':'+'}</span>{asset.imageUrl?<img src={asset.imageUrl} alt={asset.name||`VoxelFlip #${asset.tokenId}`}/>:<div className={styles.placeholder}>NFT #{asset.tokenId}</div>}<div className={styles.assetBody}><small>VERIFIED BASE NFT · #{asset.tokenId}</small><b>{asset.name||`VoxelFlip #${asset.tokenId}`}</b><span>{short(asset.contract)} · owned by connected wallet</span></div></button>})}</div>
        <div className={styles.selectionBar}><div><b>{selected.length} / 3 selected</b><span>{selected.length===3?'Ready to fetch the live real-ETH Forge fee.':'Choose three different verified parents.'}</span></div>{selected.length>0&&!authorization&&!result&&<button className={styles.secondary} onClick={()=>setSelectedKeys([])}>CLEAR</button>}</div>
        {selected.length===3&&!authorization&&!result&&<button className={styles.primary} onClick={reviewFee} disabled={busy}>{busy?'CHECKING BASE…':'REVIEW LIVE FORGE FEE'}</button>}
      </section>}

      {authorization&&<section className={styles.panel}>
        <div className={styles.sectionHead}><small>2 · REAL PAYMENT REVIEW</small><h2>{formatEther(BigInt(authorization.feeWei))} ETH Forge fee.</h2><p>The fee comes directly from the deployed Base contract. The server authorization expires in about {Math.round(Number(authorization.expiresInSeconds||600)/60)} minutes and cannot move your parent NFTs.</p></div>
        <div className={styles.review}>{selected.map((asset,index)=><article key={`${asset.contract}:${asset.tokenId}`}><small>PARENT {index+1}</small><b>{asset.name||`VoxelFlip #${asset.tokenId}`}</b><span>{short(asset.contract)} #{asset.tokenId}</span></article>)}</div>
        <div className={styles.notice}><b>REVENUE DESTINATION</b><span>Forge contract: {authorization.forge}<br/>Treasury: {authorization.treasury}<br/>Fee: {formatEther(BigInt(authorization.feeWei))} ETH. The fee first accrues inside the Forge contract and can only be withdrawn to its configured treasury by the Forge owner.</span></div>
        <button className={styles.primary} onClick={forge} disabled={busy}>{busy?'WAITING FOR METAMASK…':`PAY ${formatEther(BigInt(authorization.feeWei))} ETH + FORGE ON BASE`}</button>
        <button className={styles.secondary} style={{width:'100%',marginTop:10}} onClick={()=>setAuthorization(null)} disabled={busy}>CANCEL / CHANGE PARENTS</button>
      </section>}

      {result&&<section className={styles.panel}>
        <div className={styles.confirmed}><b>✓ BASE MAINNET FORGE COMPLETE · DESCENDANT #{result.tokenId}</b><span>The descendant is a separate NFT. The three parent NFTs remained in the connected wallet during the Forge.</span><a href={`${BASE_EXPLORER}/tx/${result.txHash}`} target="_blank" rel="noreferrer">VIEW REAL BASE TRANSACTION ↗</a></div>
        <div className={styles.sectionHead}><small>REVENUE</small><h2>{formatEther(BigInt(result.feeWei))} ETH collected.</h2><p>This is contract revenue before any applicable taxes or business expenses. It remains in the Forge contract until the owner withdraws it to the configured treasury.</p></div>
        <button className={styles.primary} onClick={()=>{setResult(null);setSelectedKeys([]);setStatus('Choose another set of three parents.')}}>FORGE AGAIN</button>
      </section>}
    </div>
    <footer className={styles.footer}><a href="/forge/real">← TEST FORGE</a><a href="/studio">VOXELPOP HOME →</a></footer>
  </main>;
}
