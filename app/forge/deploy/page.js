'use client';

import {useEffect,useState} from 'react';
import {BrowserProvider,ContractFactory,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import styles from '../real/real.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const EXPECTED_BYTECODE_LENGTH=29032;
const CONSTRUCTOR_ABI=[{
  inputs:[
    {internalType:'address',name:'initialOwner',type:'address'},
    {internalType:'address',name:'initialForgeSigner',type:'address'},
    {internalType:'address',name:'initialTreasury',type:'address'},
    {internalType:'address',name:'initialParentCollection',type:'address'},
    {internalType:'uint256',name:'initialForgeFee',type:'uint256'},
    {internalType:'uint96',name:'initialRoyaltyBps',type:'uint96'},
  ],
  stateMutability:'nonpayable',
  type:'constructor',
}];

function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Wallet action failed.')}
function short(value){return value?`${String(value).slice(0,8)}…${String(value).slice(-6)}`:'—'}

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
  if(chainId!==BASE_CHAIN_ID)throw new Error('Switch MetaMask to Base before deploying.');
}

async function loadBytecode(){
  const paths=[1,2,3,4].map(i=>`/forge/bytecode-${i}.txt`);
  const responses=await Promise.all(paths.map(path=>fetch(path,{cache:'no-store'})));
  if(responses.some(response=>!response.ok))throw new Error('The reviewed Forge deployment bytecode could not be loaded.');
  const parts=await Promise.all(responses.map(response=>response.text()));
  const bytecode=parts.map(value=>value.trim()).join('');
  if(!bytecode.startsWith('0x')||bytecode.length!==EXPECTED_BYTECODE_LENGTH)throw new Error('The reviewed Forge bytecode failed its integrity length check. Deployment stopped before MetaMask opened.');
  return bytecode;
}

export default function DeployRevenueForgePage(){
  const [config,setConfig]=useState(null);
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('Loading reviewed deployment configuration…');
  const [error,setError]=useState('');
  const [deployment,setDeployment]=useState(null);

  useEffect(()=>{refreshConfig()},[]);

  async function refreshConfig(){
    try{
      const response=await fetch('/api/forge/deployment-config',{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Deployment configuration is unavailable.');
      setConfig(data);
      if(data.existingDeployment){
        setDeployment(data.existingDeployment);
        setStatus('The Base revenue Forge is already deployed and registered. No second deployment is needed.');
      }else setStatus('Ready. Connect the reviewed owner wallet to prepare the one-time Base deployment transaction.');
    }catch(e){setError(errorText(e));setStatus('')}
  }

  async function connect(){
    setBusy(true);setError('');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){window.location.href=getMetaMaskDeepLink(window.location.href);return}
      const accounts=await injected.request({method:'eth_requestAccounts'});
      if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      const address=getAddress(accounts[0]);
      if(config?.requiredOwner&&address!==getAddress(config.requiredOwner))throw new Error(`Connect the reviewed VoxelFlip owner wallet ${short(config.requiredOwner)}. This deployment is locked to that owner.`);
      setProvider(injected);setWallet(address);
      setStatus('Owner wallet verified. Next, MetaMask will show one real Base contract-deployment transaction. Only Base gas is spent during deployment.');
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  async function register(address,txHash,addressWallet=wallet){
    const response=await fetch('/api/forge/register-mainnet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet:addressWallet,address,txHash})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'The contract deployed, but automatic production registration did not finish.');
    setDeployment(data.deployment);
    setStatus('Production Forge verified and registered on Base. The real-money Forge page is now activated.');
    return data.deployment;
  }

  async function deploy(){
    if(!config)throw new Error('Deployment configuration is still loading.');
    if(config.existingDeployment||deployment?.address){setStatus('The production Forge is already registered.');return}
    if(!provider||!wallet)throw new Error('Connect the reviewed owner wallet first.');
    if(wallet!==getAddress(config.requiredOwner))throw new Error('Connected wallet is not the reviewed VoxelFlip owner.');
    setBusy(true);setError('');
    try{
      await ensureBase(provider);
      const accounts=await provider.request({method:'eth_accounts'});
      const active=getAddress(accounts?.[0]||'0x0000000000000000000000000000000000000000');
      if(active!==wallet)throw new Error('The active MetaMask wallet changed. Reconnect before deployment.');

      setStatus('Loading the exact CI-passed Forge deployment bytecode…');
      const bytecode=await loadBytecode();
      const browserProvider=new BrowserProvider(provider);
      const signer=await browserProvider.getSigner(wallet);
      const factory=new ContractFactory(CONSTRUCTOR_ABI,bytecode,signer);

      setStatus('Opening MetaMask. Review the Base gas estimate carefully, then approve only if you want to deploy the real revenue Forge.');
      const contract=await factory.deploy(
        wallet,
        getAddress(config.forgeSigner),
        wallet,
        getAddress(config.parentCollection),
        BigInt(config.feeWei),
        Number(config.royaltyBps),
      );
      const tx=contract.deploymentTransaction();
      if(!tx?.hash)throw new Error('MetaMask did not return a deployment transaction hash.');
      setStatus('Deployment submitted to Base. Waiting for confirmation…');
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The Base deployment transaction did not succeed.');
      const address=await contract.getAddress();
      setDeployment({address,deploymentTxHash:tx.hash,owner:wallet,treasury:wallet,forgeSigner:config.forgeSigner,forgeFeeWei:config.feeWei,royaltyBps:config.royaltyBps,pendingRegistration:true});
      setStatus('Contract confirmed on Base. Verifying owner, signer, treasury, fee and approved parent collection before activation…');
      await register(address,tx.hash,wallet);
      await refreshConfig();
    }catch(e){setError(errorText(e));if(!deployment?.address)setStatus('Deployment stopped or needs attention. No retry will happen automatically.')}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>Voxel Forge</b></a><em>BASE · PRODUCTION DEPLOY</em></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><p>ONE-TIME PRODUCTION STEP</p><h1>Deploy the<br/><em>revenue Forge.</em></h1><span>This page is locked to the reviewed VoxelFlip owner wallet. It deploys the CI-passed Forge contract on Base, with a 0.001 ETH customer Forge fee. Deployment itself only spends the Base gas MetaMask shows you.</span></header>

      <section className={styles.panel}>
        <div className={styles.safety} style={{background:'rgba(255,183,77,.08)',borderColor:'rgba(255,183,77,.26)'}}><b style={{color:'#ffcf76'}}>REAL BASE TRANSACTION</b><span>No private key is requested here. MetaMask shows the exact deployment transaction and gas before anything is sent. Cancelling in MetaMask deploys nothing.</span></div>
        {config&&<div className={styles.review}>
          <article><small>OWNER + TREASURY</small><b>{short(config.requiredOwner)}</b><span>Only this reviewed wallet can register production.</span></article>
          <article><small>FORGE FEE</small><b>{config.feeEth} ETH</b><span>Collected from each successful customer 3→1 Forge.</span></article>
          <article><small>ROYALTY</small><b>{Number(config.royaltyBps)/100}%</b><span>Descendant ERC-2981 royalty to treasury.</span></article>
        </div>}
        <div className={styles.row}><div><small>CONNECTED WALLET</small><b>{wallet||'Not connected'}</b></div><button onClick={connect} disabled={busy||Boolean(deployment?.address)}>{wallet?'RECONNECT':'CONNECT METAMASK'}</button></div>
        {status&&<div className={styles.notice}><b>STATUS</b><span>{status}</span></div>}
        {error&&<div className={styles.error}>{error}</div>}

        {!deployment?.address&&<button className={styles.primary} onClick={wallet?deploy:connect} disabled={busy||!config}>{busy?'WAITING…':wallet?'DEPLOY REVENUE FORGE ON BASE':'CONNECT OWNER WALLET'}</button>}

        {deployment?.address&&<div className={styles.confirmed}>
          <b>✓ {deployment.pendingRegistration?'BASE CONTRACT DEPLOYED':'PRODUCTION FORGE READY'}</b>
          <span>Contract: {deployment.address}<br/>{deployment.deploymentTxHash?`Transaction: ${deployment.deploymentTxHash}`:''}</span>
          {deployment.deploymentTxHash&&<a href={`${BASE_EXPLORER}/tx/${deployment.deploymentTxHash}`} target="_blank" rel="noreferrer">VIEW DEPLOYMENT ON BASESCAN ↗</a>}
          {!deployment.pendingRegistration&&<a href="/forge/mainnet">OPEN REAL-MONEY FORGE →</a>}
        </div>}
      </section>
    </div>
    <footer className={styles.footer}><a href="/forge/real">← TEST FORGE</a><a href="/studio">VOXELPOP HOME →</a></footer>
  </main>;
}
