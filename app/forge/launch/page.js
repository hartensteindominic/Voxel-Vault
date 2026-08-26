'use client';

import {useEffect,useMemo,useState} from 'react';
import {BrowserProvider,ContractFactory,Interface,formatEther,getAddress,isAddress,parseEther} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import {
  FORGE_LAUNCHPAD_BOOTSTRAP_ABI,
  FORGE_LAUNCHPAD_BOOTSTRAP_BYTECODE,
  FORGE_LAUNCHPAD_BOOTSTRAP_BYTECODE_BYTES,
} from '../../../lib/forge-launchpad-bootstrap-artifact';
import styles from './launch.module.css';

const BASE_SEPOLIA_CHAIN_ID='0x14a34';
const BASE_SEPOLIA_CHAIN_NAME='Base Sepolia';
const BASE_SEPOLIA_RPC_URL='https://sepolia.base.org';
const BASE_SEPOLIA_EXPLORER_URL='https://sepolia.basescan.org';
const MAX_PLATFORM_BPS=3000;
const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Wallet action failed.')}
function explorerAddress(address){return `${BASE_SEPOLIA_EXPLORER_URL}/address/${address}`}
function explorerTx(hash){return `${BASE_SEPOLIA_EXPLORER_URL}/tx/${hash}`}

async function ensureBaseSepolia(provider){
  let chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId===BASE_SEPOLIA_CHAIN_ID)return chainId;
  try{
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_SEPOLIA_CHAIN_ID}]});
  }catch(error){
    if(error?.code===4001)throw new Error('Base Sepolia network switch was cancelled in your wallet.');
    if(error?.code!==4902)throw new Error(error?.message||'Please switch your wallet to Base Sepolia.');
    await provider.request({
      method:'wallet_addEthereumChain',
      params:[{
        chainId:BASE_SEPOLIA_CHAIN_ID,
        chainName:BASE_SEPOLIA_CHAIN_NAME,
        nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
        rpcUrls:[BASE_SEPOLIA_RPC_URL],
        blockExplorerUrls:[BASE_SEPOLIA_EXPLORER_URL],
      }],
    });
  }
  chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId!==BASE_SEPOLIA_CHAIN_ID)throw new Error('Deployment is locked to Base Sepolia. Switch networks and try again.');
  return chainId;
}

export default function ForgeLaunchPage(){
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [balanceEth,setBalanceEth]=useState('');
  const [owner,setOwner]=useState('');
  const [treasury,setTreasury]=useState('');
  const [platformBps,setPlatformBps]=useState('1500');
  const [deployFeeEth,setDeployFeeEth]=useState('0.01');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [gasUnits,setGasUnits]=useState('');
  const [submittedHash,setSubmittedHash]=useState('');
  const [deployment,setDeployment]=useState(null);

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const w=q.get('wallet')||'';
    if(ADDRESS_RE.test(w)){setOwner(w);setTreasury(w)}
  },[]);

  const platformPercent=useMemo(()=>{
    const n=Number(platformBps);
    return Number.isFinite(n)?(n/100).toFixed(n%100?2:0):'—';
  },[platformBps]);

  async function connect(){
    setBusy(true);setError('');setStatus('Opening wallet…');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){
        const deepLink=getMetaMaskDeepLink(window.location.href);
        const noProvider=new Error('Open this page in MetaMask Mobile or install a compatible injected wallet.');
        noProvider.deepLink=deepLink;
        throw noProvider;
      }
      const accounts=await injected.request({method:'eth_requestAccounts'});
      if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      await ensureBaseSepolia(injected);
      const address=getAddress(accounts[0]);
      const browserProvider=new BrowserProvider(injected);
      const balance=await browserProvider.getBalance(address);
      setProvider(injected);
      setWallet(address);
      setBalanceEth(formatEther(balance));
      setOwner(current=>isAddress(current)?current:address);
      setTreasury(current=>isAddress(current)?current:address);
      setStatus('Connected to Base Sepolia. Nothing has been deployed.');
    }catch(e){
      if(e?.deepLink){window.location.href=e.deepLink;return}
      setError(errorText(e));setStatus('');
    }finally{setBusy(false)}
  }

  function validateConfig(){
    if(!wallet||!provider)throw new Error('Connect the wallet that will approve the Base Sepolia deployment.');
    if(!isAddress(owner))throw new Error('Enter a valid Factory owner address.');
    if(!isAddress(treasury))throw new Error('Enter a valid platform treasury address.');
    const bps=Number(platformBps);
    if(!Number.isInteger(bps)||bps<0||bps>MAX_PLATFORM_BPS)throw new Error(`Platform share must be an integer from 0 to ${MAX_PLATFORM_BPS} basis points.`);
    const feeText=String(deployFeeEth||'').trim();
    if(!/^\d+(\.\d{0,18})?$/.test(feeText))throw new Error('Enter a valid creator deploy fee in ETH.');
    const feeWei=parseEther(feeText);
    return {owner:getAddress(owner),treasury:getAddress(treasury),bps:BigInt(bps),feeWei};
  }

  async function deployLaunchpad(){
    setBusy(true);setError('');setDeployment(null);setSubmittedHash('');setGasUnits('');
    try{
      const config=validateConfig();
      await ensureBaseSepolia(provider);
      const accounts=await provider.request({method:'eth_accounts'});
      if(!accounts?.[0]||getAddress(accounts[0])!==getAddress(wallet))throw new Error('The connected wallet changed. Reconnect before deploying.');

      const browserProvider=new BrowserProvider(provider);
      const network=await browserProvider.getNetwork();
      if(network.chainId!==84532n)throw new Error('Deployment blocked: this button only works on Base Sepolia (84532).');
      const signer=await browserProvider.getSigner(wallet);
      const factory=new ContractFactory(FORGE_LAUNCHPAD_BOOTSTRAP_ABI,FORGE_LAUNCHPAD_BOOTSTRAP_BYTECODE,signer);
      const request=await factory.getDeployTransaction(config.owner,config.treasury,config.bps,config.feeWei);
      const estimate=await browserProvider.estimateGas({...request,from:wallet});
      setGasUnits(estimate.toString());
      setStatus('Gas estimated. Your wallet will ask you to approve one Base Sepolia deployment transaction.');

      const contract=await factory.deploy(config.owner,config.treasury,config.bps,config.feeWei);
      const tx=contract.deploymentTransaction();
      if(!tx)throw new Error('Wallet did not return a deployment transaction.');
      setSubmittedHash(tx.hash);
      setStatus('Transaction submitted. Waiting for Base Sepolia confirmation…');
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The Base Sepolia deployment transaction did not succeed.');

      const iface=new Interface(FORGE_LAUNCHPAD_BOOTSTRAP_ABI);
      let event=null;
      for(const log of receipt.logs||[]){
        try{
          const parsed=iface.parseLog(log);
          if(parsed?.name==='LaunchpadBootstrapped'){event=parsed;break}
        }catch{}
      }
      if(!event)throw new Error('Deployment confirmed, but LaunchpadBootstrapped could not be decoded. Check the transaction on BaseScan.');

      const bootstrap=receipt.contractAddress||await contract.getAddress();
      const result={
        bootstrap:getAddress(bootstrap),
        implementation:getAddress(event.args.implementation),
        factory:getAddress(event.args.factory),
        owner:getAddress(event.args.initialOwner),
        treasury:getAddress(event.args.platformTreasury),
        platformBps:Number(event.args.platformBps),
        deployFeeWei:event.args.deployFeeWei.toString(),
        txHash:receipt.hash||tx.hash,
      };
      setDeployment(result);
      setStatus('Base Sepolia launchpad confirmed. Implementation + Factory were created by the single wallet-approved transaction.');
      const latestBalance=await browserProvider.getBalance(wallet);
      setBalanceEth(formatEther(latestBalance));
    }catch(e){
      setError(errorText(e));
      setStatus('');
    }finally{setBusy(false)}
  }

  const configReady=isAddress(owner)&&isAddress(treasury)&&Number.isInteger(Number(platformBps))&&Number(platformBps)>=0&&Number(platformBps)<=MAX_PLATFORM_BPS;

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
      <em>FORGE LAUNCHPAD · BASE SEPOLIA</em>
    </nav>

    <div className={styles.shell}>
      <header className={styles.hero}>
        <p>ONE WALLET TRANSACTION · TESTNET ONLY</p>
        <h1>Deploy the <em>Forge machine.</em></h1>
        <span>This creates the locked Forge implementation and its EIP-1167 Factory together. No private key is stored by the page, and Base mainnet is rejected.</span>
      </header>

      <section className={styles.panel}>
        <div className={styles.walletRow}>
          <div><small>DEPLOYMENT WALLET</small><b>{wallet?short(wallet):'Not connected'}</b>{wallet&&<span>{Number(balanceEth||0).toFixed(5)} test ETH</span>}</div>
          <button onClick={connect} disabled={busy}>{wallet?'RECONNECT':'CONNECT WALLET'}</button>
        </div>

        <div className={styles.safety}>
          <b>Base Sepolia only.</b>
          <span>The 0.01 ETH field below is the future creator fee stored in the Factory. It is not sent during this bootstrap. This deployment costs testnet gas only, shown by your wallet before approval.</span>
        </div>

        <div className={styles.sectionHead}><small>LAUNCH CONFIG</small><h2>Set the permanent starting economics.</h2></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>FACTORY OWNER</span><input value={owner} onChange={e=>{setOwner(e.target.value);setDeployment(null)}} placeholder="0x…" autoCapitalize="off" autoCorrect="off" spellCheck="false"/></label>
          <label className={styles.field}><span>PLATFORM TREASURY</span><input value={treasury} onChange={e=>{setTreasury(e.target.value);setDeployment(null)}} placeholder="0x…" autoCapitalize="off" autoCorrect="off" spellCheck="false"/></label>
          <label className={styles.field}><span>PLATFORM SHARE · BPS</span><input inputMode="numeric" value={platformBps} onChange={e=>{setPlatformBps(e.target.value.replace(/\D/g,'').slice(0,4));setDeployment(null)}} placeholder="1500"/><small>{platformPercent}% of Forge merge fees</small></label>
          <label className={styles.field}><span>CREATOR DEPLOY FEE · ETH</span><input inputMode="decimal" value={deployFeeEth} onChange={e=>{setDeployFeeEth(e.target.value.replace(/[^0-9.]/g,'').slice(0,22));setDeployment(null)}} placeholder="0.01"/><small>Stored in Factory; not paid by this bootstrap</small></label>
        </div>

        <div className={styles.buildFacts}>
          <div><small>REVIEWED BYTECODE</small><b>{FORGE_LAUNCHPAD_BOOTSTRAP_BYTECODE_BYTES.toLocaleString()} bytes</b></div>
          <div><small>NETWORK</small><b>Base Sepolia · 84532</b></div>
          <div><small>CREATES</small><b>Implementation + Factory</b></div>
          <div><small>APPROVALS</small><b>1 deployment transaction</b></div>
        </div>

        {gasUnits&&<div className={styles.notice}><b>ESTIMATED GAS UNITS</b><span>{Number(gasUnits).toLocaleString()} · the wallet determines the actual gas price before you sign.</span></div>}
        {status&&<div className={styles.notice}><b>STATUS</b><span>{status}</span></div>}
        {error&&<div className={styles.error}>{error}</div>}
        {submittedHash&&!deployment&&<a className={styles.txLink} href={explorerTx(submittedHash)} target="_blank" rel="noreferrer">VIEW PENDING TRANSACTION ↗</a>}

        <button className={styles.deployButton} onClick={wallet?deployLaunchpad:connect} disabled={busy||(wallet&&!configReady)}>{busy?'WAITING FOR WALLET / BASE…':wallet?'DEPLOY FORGE LAUNCHPAD ON BASE SEPOLIA':'CONNECT WALLET TO CONTINUE'}</button>
        <p className={styles.helper}>Nothing runs automatically. Pressing deploy prepares the reviewed constructor data, verifies chain 84532 again, estimates gas, then your wallet decides whether the transaction is signed.</p>
      </section>

      {deployment&&<section className={styles.result}>
        <div className={styles.confirmed}><b>✓ LAUNCHPAD CONFIRMED ON BASE SEPOLIA</b><a href={explorerTx(deployment.txHash)} target="_blank" rel="noreferrer">TRANSACTION ↗</a></div>
        <div className={styles.addressGrid}>
          <a href={explorerAddress(deployment.bootstrap)} target="_blank" rel="noreferrer"><small>BOOTSTRAP</small><b>{short(deployment.bootstrap)}</b><span>{deployment.bootstrap}</span></a>
          <a href={explorerAddress(deployment.implementation)} target="_blank" rel="noreferrer"><small>FORGE IMPLEMENTATION</small><b>{short(deployment.implementation)}</b><span>{deployment.implementation}</span></a>
          <a href={explorerAddress(deployment.factory)} target="_blank" rel="noreferrer"><small>FORGE FACTORY</small><b>{short(deployment.factory)}</b><span>{deployment.factory}</span></a>
        </div>
        <div className={styles.nextBox}>
          <small>NEXT TESTNET STEP</small>
          <h2>Create the first Forge clone.</h2>
          <p>The Factory is now capable of creating independent creator-owned minimal proxies. The next step is to connect this Factory address to a creator form, create one demo Forge, seed three Common voxels, and execute the first signed 3→1 Common → Rare merge.</p>
          <div className={styles.actions}><a href="/studio">MAKE</a><a href="/studio#my-voxels">MINT</a><a href="/forge">FORGE</a><a href="/voxelflip/autopilot">POST / LIST</a></div>
        </div>
      </section>}
    </div>

    <footer className={styles.footer}><a href="/voxelflip/factory">← FORGE LAUNCHPAD</a><div><a href="/studio">MAKE</a><a href="/studio#my-voxels">MINT</a><a href="/forge">FORGE</a><a href="/voxelflip/autopilot">POST</a></div></footer>
  </main>;
}
