'use client';

import {useState} from 'react';
import {BrowserProvider,Contract,ContractFactory,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import styles from '../profit.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const APPROVED_OWNER=getAddress('0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb');
const EXPECTED_BYTECODE_SHA256='b7a78ec53347fac65957dfd0c0c4092031b85244fe1b23ce14ceba3b00fd1e47';
const CONSTRUCTOR_ABI=['constructor(address initialOwner)'];
const VERIFY_ABI=[
  'function owner() view returns (address)',
  'function BASE_CHAIN_ID() view returns (uint256)',
  'function WETH() view returns (address)',
  'function USDC() view returns (address)',
  'function UNISWAP_SWAP_ROUTER_02() view returns (address)',
  'function AERODROME_ROUTER() view returns (address)',
  'function AERODROME_FACTORY() view returns (address)',
];
const EXPECTED={
  weth:getAddress('0x4200000000000000000000000000000000000006'),
  usdc:getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  uni:getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
  aero:getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'),
  factory:getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da'),
};

function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Deployment failed.')}
function short(value){return value?`${String(value).slice(0,8)}…${String(value).slice(-6)}`:'—'}

async function sha256Text(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function ensureBase(provider){
  let chain=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chain===BASE_CHAIN_ID)return;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_CHAIN_ID}]})}
  catch(error){
    if(error?.code===4001)throw new Error('Base network switch was cancelled.');
    if(error?.code!==4902)throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:BASE_CHAIN_ID,chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[BASE_RPC],blockExplorerUrls:[BASE_EXPLORER]}]});
  }
  chain=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chain!==BASE_CHAIN_ID)throw new Error('Switch MetaMask to Base before deployment.');
}

export default function ProfitEngineDeployPage(){
  const [wallet,setWallet]=useState('');
  const [provider,setProvider]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [deployment,setDeployment]=useState(null);
  const [bytecodeReady,setBytecodeReady]=useState(false);

  async function connect(){
    setBusy(true);setError('');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){window.location.href=getMetaMaskDeepLink(window.location.href);return}
      const accounts=await injected.request({method:'eth_requestAccounts'});
      if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      const address=getAddress(accounts[0]);
      if(address!==APPROVED_OWNER)throw new Error(`Connect the reviewed Profit Engine owner wallet ${APPROVED_OWNER}.`);
      await ensureBase(injected);
      setProvider(injected);setWallet(address);
      setStatus('Owner wallet connected on Base. Checking the exact CI-compiled executor bytecode…');
      const response=await fetch('/profit-engine/executor-bytecode.txt',{cache:'no-store'});
      if(!response.ok)throw new Error('Could not load the reviewed executor deployment bytecode.');
      const bytecode=(await response.text()).trim();
      if(!/^0x[0-9a-fA-F]+$/.test(bytecode)||bytecode.length<1000)throw new Error('Executor deployment bytecode is malformed.');
      const digest=await sha256Text(bytecode);
      if(digest!==EXPECTED_BYTECODE_SHA256)throw new Error('Executor bytecode integrity check failed. Do not deploy.');
      setBytecodeReady(true);
      setStatus(`Ready. Bytecode hash verified (${digest.slice(0,12)}…). Deployment will require one Base gas transaction and sends no trading capital.`);
    }catch(e){setError(errorText(e));setStatus('');setBytecodeReady(false)}finally{setBusy(false)}
  }

  async function deploy(){
    if(deployment)throw new Error('Executor already deployed in this session. Do not deploy another copy.');
    if(!provider||!wallet||!bytecodeReady)throw new Error('Connect the approved owner wallet and verify bytecode first.');
    setBusy(true);setError('');
    try{
      await ensureBase(provider);
      const response=await fetch('/profit-engine/executor-bytecode.txt',{cache:'no-store'});
      if(!response.ok)throw new Error('Could not reload executor deployment bytecode.');
      const bytecode=(await response.text()).trim();
      const digest=await sha256Text(bytecode);
      if(digest!==EXPECTED_BYTECODE_SHA256)throw new Error('Executor bytecode changed since verification. Deployment blocked.');

      const browserProvider=new BrowserProvider(provider);
      const signer=await browserProvider.getSigner(wallet);
      const current=getAddress(await signer.getAddress());
      if(current!==APPROVED_OWNER)throw new Error('Connected wallet changed. Reconnect the reviewed owner wallet.');

      setStatus('Opening MetaMask for ONE Base contract-deployment transaction. This transaction contains no arbitrage capital.');
      const factory=new ContractFactory(CONSTRUCTOR_ABI,bytecode,signer);
      const contract=await factory.deploy(APPROVED_OWNER);
      const tx=contract.deploymentTransaction();
      if(!tx)throw new Error('Deployment transaction was not created.');
      setStatus(`Deployment submitted: ${short(tx.hash)}. Waiting for Base confirmation…`);
      await contract.waitForDeployment();
      const address=getAddress(await contract.getAddress());

      const verify=new Contract(address,VERIFY_ABI,browserProvider);
      const [owner,chainId,weth,usdc,uni,aero,aeroFactory]=await Promise.all([
        verify.owner(),verify.BASE_CHAIN_ID(),verify.WETH(),verify.USDC(),verify.UNISWAP_SWAP_ROUTER_02(),verify.AERODROME_ROUTER(),verify.AERODROME_FACTORY(),
      ]);
      if(getAddress(owner)!==APPROVED_OWNER||BigInt(chainId)!==BigInt(8453)||getAddress(weth)!==EXPECTED.weth||getAddress(usdc)!==EXPECTED.usdc||getAddress(uni)!==EXPECTED.uni||getAddress(aero)!==EXPECTED.aero||getAddress(aeroFactory)!==EXPECTED.factory){
        throw new Error('Deployment confirmed, but live executor constants did not match the reviewed production configuration. Do not fund or use this contract.');
      }

      setDeployment({address,txHash:tx.hash});
      setStatus('BaseArbExecutor deployed and live constants verified. Do not redeploy. The address now needs to be pinned into Profit Engine production before live execution is unlocked.');
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/profit-engine">← Profit Engine</a><span>BASE · DEPLOY EXECUTOR</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>ONE-TIME EXECUTOR DEPLOYMENT</small><h1>Deploy the<br/><em>atomic guardrail.</em></h1><p>This creates the owner-only Base contract that can execute a two-DEX round trip in one transaction and revert if its minimum profit floor is not met.</p></header>
      <section className={styles.panel}>
        <div className={styles.guardrail}><b>DEPLOYMENT SAFETY</b><span>Owner is pinned to {APPROVED_OWNER}. The creation bytecode must match the CI-compiled SHA-256 before MetaMask is allowed to deploy. This page never receives or stores your private key.</span></div>
        <div className={styles.summary}>
          <div className={styles.stat}><small>NETWORK</small><b>Base · 8453</b></div>
          <div className={styles.stat}><small>OWNER</small><b>{wallet?short(wallet):'Not connected'}</b></div>
          <div className={styles.stat}><small>BYTECODE</small><b>{bytecodeReady?'VERIFIED':'LOCKED'}</b></div>
          <div className={styles.stat}><small>TRADING CAPITAL</small><b>0 ETH at deploy</b></div>
        </div>
        {!deployment&&<button className={styles.primary} style={{width:'100%',marginTop:16}} onClick={wallet?deploy:connect} disabled={busy}>{busy?'WORKING…':wallet&&bytecodeReady?'DEPLOY BASE ARB EXECUTOR':'CONNECT OWNER + VERIFY'}</button>}
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {deployment&&<div className={styles.tx}><b>✓ EXECUTOR DEPLOYED</b><br/>Contract: {deployment.address}<br/>Transaction: <a style={{color:'inherit'}} href={`${BASE_EXPLORER}/tx/${deployment.txHash}`} target="_blank" rel="noreferrer">{deployment.txHash}</a></div>}
      </section>
    </div>
  </main>;
}
