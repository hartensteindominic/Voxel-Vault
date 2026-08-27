'use client';

import {useState} from 'react';
import {BrowserProvider,Contract,ContractFactory,getAddress} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../../lib/wallet-connect';
import styles from '../../profit.module.css';

const BASE_CHAIN_ID='0x2105';
const BASE_RPC='https://mainnet.base.org';
const BASE_EXPLORER='https://basescan.org';
const MULTI_EXECUTOR_STORAGE_KEY='voxelvault.baseMultiArbExecutor.v2';
const APPROVED_OWNER=getAddress('0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb');
const EXPECTED_BYTECODE_SHA256='cee514d98a08a191a5d4db4253fe3712c23c2207ae1199b16ef58904b22a05ee';
const CONSTRUCTOR_ABI=['constructor(address initialOwner)'];
const VERIFY_ABI=[
  'function owner() view returns (address)',
  'function BASE_CHAIN_ID() view returns (uint256)',
  'function WETH() view returns (address)',
  'function USDC() view returns (address)',
  'function CBBTC() view returns (address)',
  'function CBETH() view returns (address)',
  'function AERO() view returns (address)',
  'function UNISWAP_SWAP_ROUTER_02() view returns (address)',
  'function AERODROME_ROUTER() view returns (address)',
  'function AERODROME_FACTORY() view returns (address)',
  'function MAX_CAPITAL_PER_CALL() view returns (uint256)',
  'function isSupportedQuoteToken(address token) view returns (bool)',
];
const EXPECTED={
  weth:getAddress('0x4200000000000000000000000000000000000006'),
  usdc:getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  cbbtc:getAddress('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'),
  cbeth:getAddress('0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22'),
  aeroToken:getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),
  uni:getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
  aeroRouter:getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'),
  aeroFactory:getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da'),
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

async function verifyLiveExecutor(address,browserProvider){
  const verify=new Contract(address,VERIFY_ABI,browserProvider);
  const [owner,chainId,weth,usdc,cbbtc,cbeth,aeroToken,uni,aeroRouter,aeroFactory,maxCapital,s1,s2,s3,s4]=await Promise.all([
    verify.owner(),verify.BASE_CHAIN_ID(),verify.WETH(),verify.USDC(),verify.CBBTC(),verify.CBETH(),verify.AERO(),verify.UNISWAP_SWAP_ROUTER_02(),verify.AERODROME_ROUTER(),verify.AERODROME_FACTORY(),verify.MAX_CAPITAL_PER_CALL(),
    verify.isSupportedQuoteToken(EXPECTED.usdc),verify.isSupportedQuoteToken(EXPECTED.cbbtc),verify.isSupportedQuoteToken(EXPECTED.cbeth),verify.isSupportedQuoteToken(EXPECTED.aeroToken),
  ]);
  const ok=getAddress(owner)===APPROVED_OWNER&&BigInt(chainId)===8453n&&getAddress(weth)===EXPECTED.weth&&getAddress(usdc)===EXPECTED.usdc&&getAddress(cbbtc)===EXPECTED.cbbtc&&getAddress(cbeth)===EXPECTED.cbeth&&getAddress(aeroToken)===EXPECTED.aeroToken&&getAddress(uni)===EXPECTED.uni&&getAddress(aeroRouter)===EXPECTED.aeroRouter&&getAddress(aeroFactory)===EXPECTED.aeroFactory&&BigInt(maxCapital)===1000000000000000000n&&s1&&s2&&s3&&s4;
  if(!ok)throw new Error('Deployment confirmed, but V6 live constants did not match the reviewed production configuration. Do not fund, use, or redeploy this contract.');
}

export default function ProfitEngineV6DeployPage(){
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
      setStatus('Owner wallet connected on Base. Verifying the exact CI-compiled V6 creation bytecode…');
      const response=await fetch('/profit-engine/multi-executor-bytecode.txt',{cache:'no-store'});
      if(!response.ok)throw new Error('Could not load the reviewed V6 executor deployment bytecode.');
      const bytecode=(await response.text()).trim();
      if(!/^0x[0-9a-fA-F]+$/.test(bytecode)||bytecode.length<1000)throw new Error('V6 executor deployment bytecode is malformed.');
      const digest=await sha256Text(bytecode);
      if(digest!==EXPECTED_BYTECODE_SHA256)throw new Error('V6 executor bytecode integrity check failed. Do not deploy.');
      setBytecodeReady(true);
      setStatus(`Ready. V6 bytecode hash verified (${digest.slice(0,12)}…). Deployment requires one Base gas transaction and sends 0 ETH trading capital.`);
    }catch(e){setError(errorText(e));setStatus('');setBytecodeReady(false)}finally{setBusy(false)}
  }

  async function deploy(){
    if(deployment)throw new Error('V6 executor already deployed in this session. Do not deploy another copy.');
    if(!provider||!wallet||!bytecodeReady)throw new Error('Connect the approved owner wallet and verify V6 bytecode first.');
    setBusy(true);setError('');
    let deployedRecord=null;
    try{
      await ensureBase(provider);
      const response=await fetch('/profit-engine/multi-executor-bytecode.txt',{cache:'no-store'});
      if(!response.ok)throw new Error('Could not reload V6 executor deployment bytecode.');
      const bytecode=(await response.text()).trim();
      const digest=await sha256Text(bytecode);
      if(digest!==EXPECTED_BYTECODE_SHA256)throw new Error('V6 executor bytecode changed since verification. Deployment blocked.');

      const browserProvider=new BrowserProvider(provider);
      const signer=await browserProvider.getSigner(wallet);
      const current=getAddress(await signer.getAddress());
      if(current!==APPROVED_OWNER)throw new Error('Connected wallet changed. Reconnect the reviewed owner wallet.');

      setStatus('Opening MetaMask for ONE V6 Base contract-deployment transaction. It contains no arbitrage capital.');
      const factory=new ContractFactory(CONSTRUCTOR_ABI,bytecode,signer);
      const contract=await factory.deploy(APPROVED_OWNER);
      const tx=contract.deploymentTransaction();
      if(!tx)throw new Error('V6 deployment transaction was not created.');
      setStatus(`V6 deployment submitted: ${short(tx.hash)}. Waiting for Base confirmation…`);
      await contract.waitForDeployment();
      const address=getAddress(await contract.getAddress());
      deployedRecord={address,txHash:tx.hash,verified:false};
      setDeployment(deployedRecord);
      setStatus(`V6 executor deployed at ${short(address)}. Verifying owner, routers, token allowlist, chain and capital cap…`);

      await verifyLiveExecutor(address,browserProvider);
      window.localStorage.setItem(MULTI_EXECUTOR_STORAGE_KEY,address);
      deployedRecord={address,txHash:tx.hash,verified:true};
      setDeployment(deployedRecord);
      setStatus('V6 multi-pair executor deployed, live constants verified, and activated on this device. Return to V6 and run a fresh scan. Every trade still requires a fresh simulation and your MetaMask approval.');
    }catch(e){
      setError(errorText(e));
      if(deployedRecord){
        setDeployment(deployedRecord);
        setStatus('The V6 deployment exists. Do not deploy another copy. Use the read-only verification recovery link below; it sends no transaction.');
      }else setStatus('');
    }finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/profit-engine/v6">← Profit Engine V6</a><span>BASE · V6 DEPLOY</span></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>ONE-TIME V6 MULTI-PAIR EXECUTOR</small><h1>Upgrade the<br/><em>atomic guardrail.</em></h1><p>This reviewed contract adds fixed execution support for WETH/USDC, WETH/cbBTC, WETH/cbETH and WETH/AERO across Uniswap V3 ↔ Aerodrome. It still starts and ends every trade in WETH and reverts if its minimum profit floor is not met.</p></header>
      <section className={styles.panel}>
        <div className={styles.guardrail}><b>DEPLOYMENT SAFETY</b><span>The owner and Base network are fixed, the quote-token allowlist is fixed, max capital per call is 1 ETH, and the creation bytecode must match the CI-compiled SHA-256 before MetaMask can deploy. This page never receives or stores your private key.</span></div>
        <div className={styles.summary}>
          <div className={styles.stat}><small>NETWORK</small><b>Base · 8453</b></div>
          <div className={styles.stat}><small>OWNER</small><b>{wallet?short(wallet):'Not connected'}</b></div>
          <div className={styles.stat}><small>BYTECODE</small><b>{bytecodeReady?'VERIFIED':'LOCKED'}</b></div>
          <div className={styles.stat}><small>TRADING CAPITAL</small><b>0 ETH at deploy</b></div>
          <div className={styles.stat}><small>QUOTE TOKENS</small><b>USDC · cbBTC · cbETH · AERO</b></div>
          <div className={styles.stat}><small>MAX / TRADE</small><b>1 ETH hard cap</b></div>
        </div>
        {!deployment&&<button className={styles.primary} style={{width:'100%',marginTop:16}} onClick={wallet?deploy:connect} disabled={busy}>{busy?'WORKING…':wallet&&bytecodeReady?'DEPLOY V6 MULTI-PAIR EXECUTOR':'CONNECT OWNER + VERIFY V6'}</button>}
        {status&&<div className={styles.status}>{status}</div>}
        {error&&<div className={styles.error}>{error}</div>}
        {deployment&&<div className={styles.tx}><b>{deployment.verified?'✓ V6 EXECUTOR DEPLOYED + DEVICE ACTIVATED':'✓ V6 EXECUTOR DEPLOYED · VERIFYING/RECOVERY NEEDED'}</b><br/>Contract: {deployment.address}<br/>Transaction: <a style={{color:'inherit'}} href={`${BASE_EXPLORER}/tx/${deployment.txHash}`} target="_blank" rel="noreferrer">{deployment.txHash}</a><br/>{deployment.verified?<><a style={{color:'inherit',fontWeight:800}} href="/profit-engine/v6">OPEN V6 PROFIT ENGINE →</a><br/></>:<><a style={{color:'inherit',fontWeight:800}} href={`/profit-engine/v6?executor=${deployment.address}`}>VERIFY EXISTING V6 EXECUTOR →</a><br/></>}<b>Do not deploy another copy.</b></div>}
      </section>
    </div>
  </main>;
}
