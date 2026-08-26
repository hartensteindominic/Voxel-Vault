'use client';

import {useEffect,useMemo,useState} from 'react';
import {
  BrowserProvider,
  Contract,
  Interface,
  formatEther,
  getAddress,
  hexlify,
  isAddress,
  keccak256,
  parseEther,
  randomBytes,
  toUtf8Bytes,
} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import styles from '../launch/launch.module.css';

const BASE_SEPOLIA_CHAIN_ID='0x14a34';
const BASE_SEPOLIA_CHAIN_NAME='Base Sepolia';
const BASE_SEPOLIA_RPC_URL='https://sepolia.base.org';
const BASE_SEPOLIA_EXPLORER_URL='https://sepolia.basescan.org';
const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;

const FACTORY_ABI=[
  'function implementation() view returns (address)',
  'function platformTreasury() view returns (address)',
  'function platformBps() view returns (uint16)',
  'function deployFeeWei() view returns (uint256)',
  'function createForge(string name_,string symbol_,address creatorTreasury,address forgeSigner,uint256 basePriceWei,uint256 priceIncrementWei) payable returns (address forge)',
  'event ForgeCreated(uint256 indexed forgeIndex,address indexed creator,address indexed forge,string name,string symbol,address forgeSigner,uint256 basePriceWei,uint256 priceIncrementWei,uint16 platformBps)',
];

const CLONE_ABI=[
  'function owner() view returns (address)',
  'function forgeSigner() view returns (address)',
  'function nextTokenId() view returns (uint256)',
  'function currentMergePrice() view returns (uint256)',
  'function seedMintBatch(address recipient,uint8 tier,string[] uris) returns (uint256[] tokenIds)',
  'function forge((address account,uint256 parentTokenId0,uint256 parentTokenId1,uint256 parentTokenId2,uint8 outputTier,bytes32 descendantUriHash,uint256 feeWei,bytes32 requestId,uint64 deadline) request,string descendantURI,bytes signature) payable returns (uint256 descendantTokenId)',
  'event SeedMinted(uint256 indexed tokenId,address indexed recipient,uint8 indexed tier,string uri)',
  'event Forged(uint256 indexed descendantTokenId,address indexed account,uint8 indexed outputTier,uint256 parentTokenId0,uint256 parentTokenId1,uint256 parentTokenId2,uint256 feeWei,bytes32 requestId)',
];

const FORGE_REQUEST_TYPES={
  ForgeRequest:[
    {name:'account',type:'address'},
    {name:'parentTokenId0',type:'uint256'},
    {name:'parentTokenId1',type:'uint256'},
    {name:'parentTokenId2',type:'uint256'},
    {name:'outputTier',type:'uint8'},
    {name:'descendantUriHash',type:'bytes32'},
    {name:'feeWei',type:'uint256'},
    {name:'requestId',type:'bytes32'},
    {name:'deadline',type:'uint64'},
  ],
};

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Wallet action failed.')}
function explorerAddress(address){return `${BASE_SEPOLIA_EXPLORER_URL}/address/${address}`}
function explorerTx(hash){return `${BASE_SEPOLIA_EXPLORER_URL}/tx/${hash}`}
function metadataUri(name,description,extra={}){
  return `data:application/json,${encodeURIComponent(JSON.stringify({name,description,...extra}))}`;
}

async function ensureBaseSepolia(provider){
  let chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId===BASE_SEPOLIA_CHAIN_ID)return chainId;
  try{
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_SEPOLIA_CHAIN_ID}]});
  }catch(error){
    if(error?.code===4001)throw new Error('Base Sepolia network switch was cancelled in your wallet.');
    if(error?.code!==4902)throw new Error(error?.message||'Please switch your wallet to Base Sepolia.');
    await provider.request({method:'wallet_addEthereumChain',params:[{
      chainId:BASE_SEPOLIA_CHAIN_ID,
      chainName:BASE_SEPOLIA_CHAIN_NAME,
      nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
      rpcUrls:[BASE_SEPOLIA_RPC_URL],
      blockExplorerUrls:[BASE_SEPOLIA_EXPLORER_URL],
    }]});
  }
  chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId!==BASE_SEPOLIA_CHAIN_ID)throw new Error('This test is locked to Base Sepolia (84532).');
  return chainId;
}

export default function CreateForgePage(){
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [balanceEth,setBalanceEth]=useState('');
  const [factoryAddress,setFactoryAddress]=useState('');
  const [factoryInfo,setFactoryInfo]=useState(null);
  const [name,setName]=useState('Voxel Forge Demo');
  const [symbol,setSymbol]=useState('VFORGE');
  const [creatorTreasury,setCreatorTreasury]=useState('');
  const [forgeSigner,setForgeSigner]=useState('');
  const [basePriceEth,setBasePriceEth]=useState('0.0005');
  const [priceIncrementEth,setPriceIncrementEth]=useState('0.00001');
  const [clone,setClone]=useState(null);
  const [seeded,setSeeded]=useState([]);
  const [descendant,setDescendant]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const f=q.get('factory')||'';
    if(ADDRESS_RE.test(f))setFactoryAddress(getAddress(f));
  },[]);

  const feeText=useMemo(()=>factoryInfo?`${formatEther(factoryInfo.deployFeeWei)} test ETH`:'—',[factoryInfo]);

  async function connect(){
    setBusy(true);setError('');setStatus('Opening MetaMask…');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){
        const deepLink=getMetaMaskDeepLink(window.location.href);
        const noProvider=new Error('Open this page in MetaMask Mobile or another injected wallet.');
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
      setCreatorTreasury(current=>isAddress(current)?current:address);
      setForgeSigner(current=>isAddress(current)?current:address);
      setStatus('Connected to Base Sepolia. Verify the Factory before creating a clone.');
    }catch(e){
      if(e?.deepLink){window.location.href=e.deepLink;return}
      setError(errorText(e));setStatus('');
    }finally{setBusy(false)}
  }

  async function getBrowserProvider(){
    if(!provider||!wallet)throw new Error('Connect your Base Sepolia wallet first.');
    await ensureBaseSepolia(provider);
    const accounts=await provider.request({method:'eth_accounts'});
    if(!accounts?.[0]||getAddress(accounts[0])!==getAddress(wallet))throw new Error('The connected wallet changed. Reconnect before continuing.');
    const browserProvider=new BrowserProvider(provider);
    const network=await browserProvider.getNetwork();
    if(network.chainId!==84532n)throw new Error('Blocked: this test only works on Base Sepolia (84532).');
    return browserProvider;
  }

  async function verifyFactory(){
    setBusy(true);setError('');setFactoryInfo(null);setClone(null);setSeeded([]);setDescendant(null);
    try{
      if(!isAddress(factoryAddress))throw new Error('Enter the Forge Factory address from the confirmed launchpad deployment.');
      const browserProvider=await getBrowserProvider();
      const address=getAddress(factoryAddress);
      const code=await browserProvider.getCode(address);
      if(!code||code==='0x')throw new Error('No contract code exists at this Factory address on Base Sepolia.');
      const factory=new Contract(address,FACTORY_ABI,browserProvider);
      const [implementation,platformTreasury,platformBps,deployFeeWei]=await Promise.all([
        factory.implementation(),factory.platformTreasury(),factory.platformBps(),factory.deployFeeWei(),
      ]);
      setFactoryInfo({
        address,
        implementation:getAddress(implementation),
        platformTreasury:getAddress(platformTreasury),
        platformBps:Number(platformBps),
        deployFeeWei,
      });
      setStatus('Factory verified on Base Sepolia. Creating a Forge will require the exact live creator deploy fee plus testnet gas.');
    }catch(e){setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  function validateCreatorConfig(){
    if(!factoryInfo)throw new Error('Verify the live Factory first.');
    if(!name.trim())throw new Error('Enter a Forge collection name.');
    if(!symbol.trim())throw new Error('Enter a Forge symbol.');
    if(!isAddress(creatorTreasury))throw new Error('Enter a valid creator treasury address.');
    if(!isAddress(forgeSigner))throw new Error('Enter a valid Forge signer address.');
    const price=String(basePriceEth||'').trim();
    const step=String(priceIncrementEth||'').trim();
    if(!/^\d+(\.\d{0,18})?$/.test(price))throw new Error('Enter a valid base merge price in ETH.');
    if(!/^\d+(\.\d{0,18})?$/.test(step))throw new Error('Enter a valid merge price increment in ETH.');
    return {
      name:name.trim(),
      symbol:symbol.trim(),
      creatorTreasury:getAddress(creatorTreasury),
      forgeSigner:getAddress(forgeSigner),
      basePriceWei:parseEther(price),
      priceIncrementWei:parseEther(step),
    };
  }

  async function createForge(){
    setBusy(true);setError('');setClone(null);setSeeded([]);setDescendant(null);
    try{
      const config=validateCreatorConfig();
      const browserProvider=await getBrowserProvider();
      const signer=await browserProvider.getSigner(wallet);
      const factory=new Contract(factoryInfo.address,FACTORY_ABI,signer);
      const liveFee=await factory.deployFeeWei();
      const liveBalance=await browserProvider.getBalance(wallet);
      if(liveBalance<=liveFee)throw new Error(`This creator transaction needs ${formatEther(liveFee)} Base Sepolia ETH plus gas. Your test balance is ${formatEther(liveBalance)} ETH.`);
      setStatus(`MetaMask will ask you to approve the ${formatEther(liveFee)} test ETH creator fee plus Base Sepolia gas.`);
      const tx=await factory.createForge(
        config.name,
        config.symbol,
        config.creatorTreasury,
        config.forgeSigner,
        config.basePriceWei,
        config.priceIncrementWei,
        {value:liveFee}
      );
      setStatus('Forge creation submitted. Waiting for Base Sepolia confirmation…');
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The Forge creation transaction did not succeed.');
      const iface=new Interface(FACTORY_ABI);
      let event=null;
      for(const log of receipt.logs||[]){
        try{const parsed=iface.parseLog(log);if(parsed?.name==='ForgeCreated'){event=parsed;break}}catch{}
      }
      if(!event)throw new Error('Forge was confirmed, but ForgeCreated could not be decoded. Open the transaction on BaseScan.');
      const result={address:getAddress(event.args.forge),txHash:receipt.hash||tx.hash};
      setClone(result);
      setStatus('First creator-owned Forge clone confirmed. Next: seed three Common test voxels.');
      const latestBalance=await browserProvider.getBalance(wallet);
      setBalanceEth(formatEther(latestBalance));
    }catch(e){setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  async function seedThreeCommon(){
    setBusy(true);setError('');setSeeded([]);setDescendant(null);
    try{
      if(!clone?.address)throw new Error('Create the Forge clone first.');
      const browserProvider=await getBrowserProvider();
      const signer=await browserProvider.getSigner(wallet);
      const contract=new Contract(clone.address,CLONE_ABI,signer);
      const cloneOwner=getAddress(await contract.owner());
      if(cloneOwner!==getAddress(wallet))throw new Error(`This wallet is not the Forge owner. Owner is ${cloneOwner}.`);
      const startingTokenId=await contract.nextTokenId();
      const uris=[1,2,3].map(index=>metadataUri(
        `Voxel Forge Common ${index}`,
        'Base Sepolia test Common minted only to prove the 3-to-1 Forge flow.',
        {tier:'Common',testnet:true,forge:clone.address}
      ));
      setStatus('MetaMask will ask you to approve one testnet transaction that seeds 3 Common voxels into your Forge.');
      const tx=await contract.seedMintBatch(wallet,0,uris);
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The Common seed transaction did not succeed.');
      const iface=new Interface(CLONE_ABI);
      const tokenIds=[];
      for(const log of receipt.logs||[]){
        try{const parsed=iface.parseLog(log);if(parsed?.name==='SeedMinted')tokenIds.push(parsed.args.tokenId.toString())}catch{}
      }
      if(tokenIds.length!==3){
        tokenIds.splice(0,tokenIds.length,startingTokenId.toString(),(startingTokenId+1n).toString(),(startingTokenId+2n).toString());
      }
      setSeeded(tokenIds);
      setClone(current=>({...current,seedTxHash:receipt.hash||tx.hash}));
      setStatus(`Seeded Common tokens #${tokenIds.join(', #')}. Next: sign the exact Forge request, then approve the 3→1 merge transaction.`);
      const latestBalance=await browserProvider.getBalance(wallet);
      setBalanceEth(formatEther(latestBalance));
    }catch(e){setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  async function forgeRare(){
    setBusy(true);setError('');setDescendant(null);
    try{
      if(!clone?.address||seeded.length!==3)throw new Error('Seed three Common tokens first.');
      const browserProvider=await getBrowserProvider();
      const signer=await browserProvider.getSigner(wallet);
      const contract=new Contract(clone.address,CLONE_ABI,signer);
      const configuredSigner=getAddress(await contract.forgeSigner());
      if(configuredSigner!==getAddress(wallet))throw new Error(`The demo Forge signer is ${configuredSigner}, not the connected wallet. Recreate the demo clone with this wallet as Forge signer.`);
      const feeWei=await contract.currentMergePrice();
      const descendantURI=metadataUri(
        'Voxel Forge Rare #1',
        'First Base Sepolia 3-to-1 Forge descendant created from three Common test voxels.',
        {tier:'Rare',testnet:true,parents:seeded,forge:clone.address}
      );
      const request={
        account:getAddress(wallet),
        parentTokenId0:BigInt(seeded[0]),
        parentTokenId1:BigInt(seeded[1]),
        parentTokenId2:BigInt(seeded[2]),
        outputTier:1,
        descendantUriHash:keccak256(toUtf8Bytes(descendantURI)),
        feeWei,
        requestId:hexlify(randomBytes(32)),
        deadline:BigInt(Math.floor(Date.now()/1000)+15*60),
      };
      const domain={name:'VoxelForgeClone',version:'1',chainId:84532,verifyingContract:clone.address};
      setStatus('MetaMask will first ask you to sign the Forge authorization. This signature alone does not spend ETH.');
      const signature=await signer.signTypedData(domain,FORGE_REQUEST_TYPES,request);
      setStatus(`Authorization signed. MetaMask will now ask you to approve the ${formatEther(feeWei)} test ETH merge fee plus gas.`);
      const tx=await contract.forge(request,descendantURI,signature,{value:feeWei});
      const receipt=await tx.wait();
      if(!receipt||receipt.status!==1)throw new Error('The 3→1 Forge transaction did not succeed.');
      const iface=new Interface(CLONE_ABI);
      let event=null;
      for(const log of receipt.logs||[]){
        try{const parsed=iface.parseLog(log);if(parsed?.name==='Forged'){event=parsed;break}}catch{}
      }
      if(!event)throw new Error('Forge transaction confirmed, but the Forged event could not be decoded.');
      const result={tokenId:event.args.descendantTokenId.toString(),txHash:receipt.hash||tx.hash,feeWei:event.args.feeWei.toString()};
      setDescendant(result);
      setStatus(`Forge complete: Common #${seeded[0]}, #${seeded[1]}, #${seeded[2]} were burned and Rare #${result.tokenId} was minted.`);
      const latestBalance=await browserProvider.getBalance(wallet);
      setBalanceEth(formatEther(latestBalance));
    }catch(e){setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a>
      <em>FIRST FORGE · BASE SEPOLIA</em>
    </nav>

    <div className={styles.shell}>
      <header className={styles.hero}>
        <p>CREATOR CLONE TEST · WALLET APPROVALS ONLY</p>
        <h1>Create your <em>first Forge.</em></h1>
        <span>This uses the live Factory you just deployed. Each money-moving step is separate and visible in MetaMask. Nothing signs, spends, seeds, or Forges automatically.</span>
      </header>

      <section className={styles.panel}>
        <div className={styles.walletRow}>
          <div><small>CREATOR WALLET</small><b>{wallet?short(wallet):'Not connected'}</b>{wallet&&<span>{Number(balanceEth||0).toFixed(5)} Base Sepolia ETH</span>}</div>
          <button onClick={connect} disabled={busy}>{wallet?'RECONNECT':'CONNECT METAMASK'}</button>
        </div>

        <div className={styles.safety}>
          <b>Testnet only · chain 84532.</b>
          <span>Creating a clone pays the live Factory creator fee in Base Sepolia test ETH. Seeding costs only testnet gas. Forging uses the clone's live merge price plus testnet gas.</span>
        </div>

        <div className={styles.sectionHead}><small>1 · VERIFY FACTORY</small><h2>Use the Launchpad you just confirmed.</h2></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>FORGE FACTORY</span><input value={factoryAddress} onChange={e=>{setFactoryAddress(e.target.value);setFactoryInfo(null);setClone(null);setSeeded([]);setDescendant(null)}} placeholder="0x…" autoCapitalize="off" autoCorrect="off" spellCheck="false"/></label>
          <div className={styles.field}><span>LIVE CREATOR DEPLOY FEE</span><input readOnly value={feeText}/><small>Read directly from the Factory after verification.</small></div>
        </div>
        <button className={styles.deployButton} onClick={wallet?verifyFactory:connect} disabled={busy}>{busy?'WAITING…':wallet?'VERIFY FACTORY ON BASE SEPOLIA':'CONNECT METAMASK'}</button>

        {factoryInfo&&<div className={styles.buildFacts}>
          <div><small>IMPLEMENTATION</small><b>{short(factoryInfo.implementation)}</b></div>
          <div><small>PLATFORM TREASURY</small><b>{short(factoryInfo.platformTreasury)}</b></div>
          <div><small>PLATFORM SHARE</small><b>{(factoryInfo.platformBps/100).toFixed(2)}%</b></div>
          <div><small>DEPLOY FEE</small><b>{formatEther(factoryInfo.deployFeeWei)} ETH</b></div>
        </div>}

        {factoryInfo&&<>
          <div className={styles.sectionHead}><small>2 · CREATE CLONE</small><h2>Mint your creator-owned Forge machine.</h2></div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>COLLECTION NAME</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={48}/></label>
            <label className={styles.field}><span>SYMBOL</span><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12))} maxLength={12}/></label>
            <label className={styles.field}><span>CREATOR TREASURY</span><input value={creatorTreasury} onChange={e=>setCreatorTreasury(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck="false"/></label>
            <label className={styles.field}><span>FORGE SIGNER</span><input value={forgeSigner} onChange={e=>setForgeSigner(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck="false"/><small>Keep this as your connected wallet for the first signed demo.</small></label>
            <label className={styles.field}><span>FIRST MERGE PRICE · ETH</span><input inputMode="decimal" value={basePriceEth} onChange={e=>setBasePriceEth(e.target.value.replace(/[^0-9.]/g,'').slice(0,22))}/></label>
            <label className={styles.field}><span>PRICE INCREMENT · ETH</span><input inputMode="decimal" value={priceIncrementEth} onChange={e=>setPriceIncrementEth(e.target.value.replace(/[^0-9.]/g,'').slice(0,22))}/></label>
          </div>
          <button className={styles.deployButton} onClick={createForge} disabled={busy||!!clone}>{clone?'FORGE CLONE CONFIRMED':busy?'WAITING FOR METAMASK / BASE…':'CREATE FIRST FORGE CLONE'}</button>
        </>}

        {status&&<div className={styles.notice}><b>STATUS</b><span>{status}</span></div>}
        {error&&<div className={styles.error}>{error}</div>}
      </section>

      {clone&&<section className={styles.result}>
        <div className={styles.confirmed}><b>✓ CREATOR FORGE CLONE CONFIRMED</b><a href={explorerTx(clone.txHash)} target="_blank" rel="noreferrer">TRANSACTION ↗</a></div>
        <div className={styles.addressGrid}>
          <a href={explorerAddress(clone.address)} target="_blank" rel="noreferrer"><small>YOUR FORGE CLONE</small><b>{short(clone.address)}</b><span>{clone.address}</span></a>
          <a href={explorerAddress(factoryInfo.address)} target="_blank" rel="noreferrer"><small>PARENT FACTORY</small><b>{short(factoryInfo.address)}</b><span>{factoryInfo.address}</span></a>
          <a href={explorerAddress(factoryInfo.implementation)} target="_blank" rel="noreferrer"><small>SHARED IMPLEMENTATION</small><b>{short(factoryInfo.implementation)}</b><span>{factoryInfo.implementation}</span></a>
        </div>

        <div className={styles.nextBox}>
          <small>3 · SEED 3 COMMON</small>
          <h2>Give the Forge its first parents.</h2>
          <p>This owner-only test mints three Common tokens to your connected wallet. It does not mint anything on Base mainnet.</p>
          <button className={styles.deployButton} onClick={seedThreeCommon} disabled={busy||seeded.length===3}>{seeded.length===3?'3 COMMON TOKENS SEEDED':busy?'WAITING FOR METAMASK…':'SEED 3 COMMON TEST VOXELS'}</button>
          {clone.seedTxHash&&<a className={styles.txLink} href={explorerTx(clone.seedTxHash)} target="_blank" rel="noreferrer">VIEW SEED TRANSACTION ↗</a>}
        </div>

        {seeded.length===3&&<div className={styles.nextBox}>
          <small>4 · FORGE COMMON → RARE</small>
          <h2>Burn 3. Mint 1.</h2>
          <p>Parents: #{seeded[0]}, #{seeded[1]}, #{seeded[2]}. MetaMask first signs the EIP-712 authorization, then separately asks you to approve the merge transaction and its live testnet merge fee.</p>
          <button className={styles.deployButton} onClick={forgeRare} disabled={busy||!!descendant}>{descendant?'3 → 1 FORGE COMPLETE':busy?'WAITING FOR SIGNATURE / METAMASK…':'SIGN + FORGE FIRST RARE'}</button>
        </div>}

        {descendant&&<div className={styles.confirmed} style={{marginTop:18}}><b>✓ COMMON ×3 → RARE #{descendant.tokenId} CONFIRMED</b><a href={explorerTx(descendant.txHash)} target="_blank" rel="noreferrer">FORGE TRANSACTION ↗</a></div>}

        {descendant&&<div className={styles.nextBox}>
          <small>FIRST END-TO-END FORGE COMPLETE</small>
          <h2>MAKE → MINT → FORGE → POST.</h2>
          <p>The contract path is now proven on Base Sepolia. This does not imply profit or resale value; the next product step is to connect real VoxelPop/VoxelFlip assets and market/listing data to the creator Forge flow.</p>
          <div className={styles.actions}><a href="/studio">MAKE</a><a href="/studio#my-voxels">MINT</a><a href="/forge">FORGE</a><a href="/voxelflip/autopilot">POST / LIST</a></div>
        </div>}
      </section>}
    </div>

    <footer className={styles.footer}><a href="/forge/launch">← LAUNCHPAD</a><div><a href="/studio">MAKE</a><a href="/studio#my-voxels">MINT</a><a href="/forge">FORGE</a><a href="/voxelflip/autopilot">POST</a></div></footer>
  </main>;
}
