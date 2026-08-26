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
  randomBytes,
  toUtf8Bytes,
} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import {getSupabaseBrowserAsync} from '../../../lib/supabase-browser';
import {loadAccountVoxels,mergeVoxelRecords,readLocalVoxelRecords} from '../../../lib/voxelpop-account';
import styles from './real.module.css';

const BASE_SEPOLIA_CHAIN_ID='0x14a34';
const BASE_SEPOLIA_CHAIN_NAME='Base Sepolia';
const BASE_SEPOLIA_RPC_URL='https://sepolia.base.org';
const BASE_SEPOLIA_EXPLORER_URL='https://sepolia.basescan.org';
const DEFAULT_TEST_CLONE='0x8A853C34Dba507f69c3CF802DC9c713a8116201A';
const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;

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

const FORGE_REQUEST_TYPES={ForgeRequest:[
  {name:'account',type:'address'},
  {name:'parentTokenId0',type:'uint256'},
  {name:'parentTokenId1',type:'uint256'},
  {name:'parentTokenId2',type:'uint256'},
  {name:'outputTier',type:'uint8'},
  {name:'descendantUriHash',type:'bytes32'},
  {name:'feeWei',type:'uint256'},
  {name:'requestId',type:'bytes32'},
  {name:'deadline',type:'uint64'},
]};

function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Wallet action failed.')}
function explorerAddress(address){return `${BASE_SEPOLIA_EXPLORER_URL}/address/${address}`}
function explorerTx(hash){return `${BASE_SEPOLIA_EXPLORER_URL}/tx/${hash}`}
function ipfsToHttp(value){const text=String(value||'');return text.startsWith('ipfs://')?`https://ipfs.io/ipfs/${text.slice(7)}`:text}
function safeDecode(value){try{return decodeURIComponent(value)}catch{return value}}
function parseDataMetadata(uri){
  const value=String(uri||'');
  try{
    if(value.startsWith('data:application/json;base64,')){
      const raw=atob(value.slice('data:application/json;base64,'.length));
      const json=decodeURIComponent(Array.prototype.map.call(raw,c=>`%${c.charCodeAt(0).toString(16).padStart(2,'0')}`).join(''));
      return JSON.parse(json);
    }
    if(value.startsWith('data:application/json,'))return JSON.parse(safeDecode(value.slice('data:application/json,'.length)));
  }catch{}
  return null;
}
function displayAsset(asset){
  const parsed=parseDataMetadata(asset.tokenURI)||{};
  return {
    ...asset,
    key:asset.key||`nft:${asset.tokenId}`,
    selectable:asset.selectable!==false,
    name:asset.name||parsed.name||`VoxelFlip #${asset.tokenId}`,
    description:asset.description||parsed.description||'',
    imageUrl:ipfsToHttp(asset.imageUrl||parsed.image||''),
    animationUrl:ipfsToHttp(asset.animationUrl||parsed.animation_url||parsed.animationUrl||''),
  };
}
function meshReady(payload){
  const mesh=payload?.mesh||{};
  return String(mesh.status||'').toLowerCase()==='ready'||Boolean(String(mesh.modelUrl||'').trim())||Number(mesh.progress||0)>=100;
}
async function loadMyVoxels(){
  const local=readLocalVoxelRecords();
  let cloud=[];
  try{
    const supabase=await getSupabaseBrowserAsync();
    const {data}=await supabase.auth.getSession();
    if(data.session?.user)cloud=await loadAccountVoxels(supabase,data.session.user);
  }catch{}
  return mergeVoxelRecords(cloud,local).map(record=>{
    const payload=record.payload||{};
    const mint=payload.mint||{};
    const ready=meshReady(payload);
    return {
      key:`library:${record.sessionId}`,
      sessionId:record.sessionId,
      tokenId:mint.tokenId==null?'':String(mint.tokenId),
      name:String(payload.asset?.name||'Your voxel').replaceAll('-',' '),
      imageUrl:String(payload.asset?.dataUrl||''),
      animationUrl:String(payload.mesh?.modelUrl||''),
      mintOwner:String(mint.owner||''),
      openSeaUrl:String(mint.openSeaUrl||''),
      libraryRecord:true,
      library3d:ready,
      meshStatus:String(payload.mesh?.status||'idle'),
      meshProgress:Number(payload.mesh?.progress||0),
    };
  });
}
function mergeLibraryAndChain(library,chainAssets){
  const chainByToken=new Map(chainAssets.map(asset=>[String(asset.tokenId),displayAsset({...asset,key:`nft:${asset.tokenId}`,selectable:true})]));
  const merged=new Map();
  for(const item of library){
    const chain=item.tokenId?chainByToken.get(String(item.tokenId)):null;
    if(chain){
      const joined={
        ...chain,
        key:`nft:${chain.tokenId}`,
        name:item.name||chain.name,
        imageUrl:item.imageUrl||chain.imageUrl,
        animationUrl:item.animationUrl||chain.animationUrl,
        sessionId:item.sessionId,
        libraryRecord:true,
        library3d:item.library3d||Boolean(chain.animationUrl),
        meshStatus:item.meshStatus,
        meshProgress:item.meshProgress,
        selectable:true,
      };
      merged.set(joined.key,joined);
      chainByToken.delete(String(item.tokenId));
    }else{
      merged.set(item.key,{
        ...item,
        selectable:false,
        tokenURI:'',
        contract:'',
        description:item.library3d
          ?'3D-ready VoxelPop asset. Link or recover its Base VoxelFlip NFT before using it as a Forge parent.'
          :'Saved VoxelPop asset. Finish its 3D mesh before minting or forging.',
      });
    }
  }
  for(const chain of chainByToken.values())merged.set(chain.key,chain);
  return Array.from(merged.values());
}
function descendantMetadata(selected,clone){
  const first=selected[0]||{};
  const names=selected.map(item=>item.name||`VoxelFlip #${item.tokenId}`);
  const sourceTokens=selected.map(item=>String(item.tokenId));
  const metadata={
    name:`Rare Fusion · ${names.join(' + ')}`,
    description:'Base Sepolia lineage test proving three wallet-owned production VoxelFlip metadata records can be copied into the test Forge and merged 3-to-1. Production NFTs remain untouched.',
    image:first.imageUrl||undefined,
    animation_url:first.animationUrl||undefined,
    attributes:[
      {trait_type:'Tier',value:'Rare'},
      {trait_type:'Network',value:'Base Sepolia Test'},
      {trait_type:'Source VoxelFlips',value:sourceTokens.join(', ')},
      {trait_type:'Source Count',value:3},
    ],
    forge_test:{testnet:true,forge:clone,source_chain:'base',source_contract:first.contract||'',source_token_ids:sourceTokens,note:'Visual/3D media is inherited from the first selected source for this lineage test; a newly generated fused 3D descendant is a later product stage.'},
  };
  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
}

async function ensureBaseSepolia(provider){
  let chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId===BASE_SEPOLIA_CHAIN_ID)return chainId;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_SEPOLIA_CHAIN_ID}]});}
  catch(error){
    if(error?.code===4001)throw new Error('Base Sepolia network switch was cancelled in MetaMask.');
    if(error?.code!==4902)throw new Error(error?.message||'Please switch MetaMask to Base Sepolia.');
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:BASE_SEPOLIA_CHAIN_ID,chainName:BASE_SEPOLIA_CHAIN_NAME,nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[BASE_SEPOLIA_RPC_URL],blockExplorerUrls:[BASE_SEPOLIA_EXPLORER_URL]}]});
  }
  chainId=String(await provider.request({method:'eth_chainId'})||'').toLowerCase();
  if(chainId!==BASE_SEPOLIA_CHAIN_ID)throw new Error('This Forge test is locked to Base Sepolia (84532).');
  return chainId;
}

export default function RealVoxelForgePage(){
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [balanceEth,setBalanceEth]=useState('');
  const [cloneAddress,setCloneAddress]=useState(DEFAULT_TEST_CLONE);
  const [cloneVerified,setCloneVerified]=useState(false);
  const [assets,setAssets]=useState([]);
  const [selectedIds,setSelectedIds]=useState([]);
  const [scanInfo,setScanInfo]=useState(null);
  const [imported,setImported]=useState([]);
  const [importTx,setImportTx]=useState('');
  const [rare,setRare]=useState(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{const q=new URLSearchParams(window.location.search);const clone=q.get('clone')||'';if(ADDRESS_RE.test(clone))setCloneAddress(getAddress(clone));},[]);

  const selected=useMemo(()=>selectedIds.map(id=>assets.find(asset=>asset.key===id)).filter(Boolean),[selectedIds,assets]);
  const selectableCount=useMemo(()=>assets.filter(asset=>asset.selectable).length,[assets]);
  const savedCount=useMemo(()=>assets.filter(asset=>asset.libraryRecord).length,[assets]);
  const readyCount=useMemo(()=>assets.filter(asset=>asset.libraryRecord&&asset.library3d).length,[assets]);
  const stage=rare?5:imported.length===3?4:selected.length===3?3:assets.length?2:wallet?1:0;

  async function connect(){
    setBusy(true);setError('');setStatus('Opening MetaMask…');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){const deepLink=getMetaMaskDeepLink(window.location.href);const noProvider=new Error('Open this page inside MetaMask Mobile or another injected wallet.');noProvider.deepLink=deepLink;throw noProvider;}
      const accounts=await injected.request({method:'eth_requestAccounts'});if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      const address=getAddress(accounts[0]);setProvider(injected);setWallet(address);setStatus('Wallet connected. Step 1: load My Voxels first, then verify this wallet’s real VoxelFlip NFTs on Base. The scan is read-only.');
    }catch(e){if(e?.deepLink){window.location.href=e.deepLink;return}setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  async function scanAssets(){
    setBusy(true);setError('');setAssets([]);setSelectedIds([]);setImported([]);setRare(null);setCloneVerified(false);setScanInfo(null);
    try{
      if(!wallet)throw new Error('Connect MetaMask first.');
      setStatus('Loading your saved My Voxels first…');
      const library=await loadMyVoxels();
      const localDisplay=mergeLibraryAndChain(library,[]);
      setAssets(localDisplay);
      setScanInfo({libraryLoaded:true,libraryCount:library.length,eligibleCount:0,totalShown:localDisplay.length,sourceWarning:null});
      setStatus(`Loaded ${library.length} saved My Voxel${library.length===1?'':'s'}. Now checking Base ownership; your library stays visible even if that scan is slow.`);

      try{
        const response=await fetch(`/api/forge/owned-assets?${new URLSearchParams({wallet})}`,{cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Could not scan your VoxelFlip NFTs.');
        const chain=Array.isArray(data.nfts)?data.nfts.map(displayAsset):[];
        const combined=mergeLibraryAndChain(library,chain);
        const eligible=combined.filter(asset=>asset.selectable).length;
        const ready=combined.filter(asset=>asset.libraryRecord&&asset.library3d).length;
        setAssets(combined);
        setScanInfo({...data,libraryLoaded:true,libraryCount:library.length,readyCount:ready,eligibleCount:eligible,totalShown:combined.length});
        if(eligible>=3)setStatus(`Loaded ${library.length} saved My Voxel${library.length===1?'':'s'} (${ready} 3D ready) and verified ${eligible} wallet-owned VoxelFlip NFTs. Step 2: choose exactly 3 REAL BASE NFT cards.`);
        else setStatus(`Loaded ${library.length} saved My Voxel${library.length===1?'':'s'} (${ready} 3D ready). ${eligible} confirmed VoxelFlip NFT${eligible===1?' is':'s are'} selectable; 3 are required for the Forge test.`);
      }catch(scanError){
        setScanInfo(current=>({...current,sourceWarning:`Base NFT verification is temporarily unavailable: ${errorText(scanError)} Your saved My Voxels are still shown below.`}));
        setStatus(`Loaded ${library.length} saved My Voxel${library.length===1?'':'s'}. Base NFT verification did not finish, but it no longer hides your library.`);
      }
    }catch(e){setError(errorText(e));setStatus('')}
    finally{setBusy(false)}
  }

  function toggle(key){if(imported.length||rare)return;const asset=assets.find(item=>item.key===key);if(!asset?.selectable)return;setSelectedIds(current=>current.includes(key)?current.filter(id=>id!==key):current.length>=3?current:[...current,key]);}

  async function getSepoliaProvider(){
    if(!provider||!wallet)throw new Error('Connect MetaMask first.');await ensureBaseSepolia(provider);
    const accounts=await provider.request({method:'eth_accounts'});if(!accounts?.[0]||getAddress(accounts[0])!==getAddress(wallet))throw new Error('The connected account changed. Reconnect before continuing.');
    const browserProvider=new BrowserProvider(provider);const network=await browserProvider.getNetwork();if(network.chainId!==84532n)throw new Error('Blocked: the import/Forge transaction only works on Base Sepolia.');
    const balance=await browserProvider.getBalance(wallet);setBalanceEth(formatEther(balance));return browserProvider;
  }

  async function verifyClone(){
    setBusy(true);setError('');setCloneVerified(false);
    try{
      if(selected.length!==3)throw new Error('Select exactly 3 confirmed VoxelFlip NFTs first.');if(!isAddress(cloneAddress))throw new Error('Enter a valid Base Sepolia Forge clone address.');
      const browserProvider=await getSepoliaProvider();const address=getAddress(cloneAddress);const code=await browserProvider.getCode(address);if(!code||code==='0x')throw new Error('No Forge contract exists at that address on Base Sepolia.');
      const contract=new Contract(address,CLONE_ABI,browserProvider);const [owner,forgeSigner,price]=await Promise.all([contract.owner(),contract.forgeSigner(),contract.currentMergePrice()]);
      if(getAddress(owner)!==getAddress(wallet))throw new Error(`This wallet does not own the test Forge. Forge owner is ${owner}.`);if(getAddress(forgeSigner)!==getAddress(wallet))throw new Error(`This wallet is not the configured test Forge signer. Forge signer is ${forgeSigner}.`);
      setCloneVerified(true);setStatus(`Test Forge verified. Current 3→1 merge fee is ${formatEther(price)} Base Sepolia ETH. Step 3: review and import metadata copies of your 3 real VoxelFlips.`);
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  async function importSelected(){
    setBusy(true);setError('');setImported([]);setRare(null);setImportTx('');
    try{
      if(!cloneVerified||selected.length!==3)throw new Error('Verify the test Forge with exactly 3 selected VoxelFlips first.');if(selected.some(item=>!String(item.tokenURI||'').trim()))throw new Error('One selected production NFT has no readable tokenURI, so it cannot be copied safely into the test Forge.');
      const browserProvider=await getSepoliaProvider();const signer=await browserProvider.getSigner(wallet);const contract=new Contract(getAddress(cloneAddress),CLONE_ABI,signer);const startingTokenId=await contract.nextTokenId();
      setStatus('MetaMask will ask for ONE Base Sepolia transaction. It mints 3 Common TEST COPIES using the exact production tokenURIs. Your production NFTs are not approved, transferred, burned, or changed.');
      const tx=await contract.seedMintBatch(wallet,0,selected.map(item=>item.tokenURI));setStatus('Import-copy transaction submitted. Waiting for Base Sepolia confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('The test import transaction did not succeed.');
      const iface=new Interface(CLONE_ABI);const tokenIds=[];for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='SeedMinted')tokenIds.push(parsed.args.tokenId.toString())}catch{}}
      if(tokenIds.length!==3)tokenIds.splice(0,tokenIds.length,startingTokenId.toString(),(startingTokenId+1n).toString(),(startingTokenId+2n).toString());setImported(selected.map((item,index)=>({...item,testTokenId:tokenIds[index]})));setImportTx(receipt.hash||tx.hash);
      setStatus(`Step 3 complete. Production VoxelFlips #${selected.map(item=>item.tokenId).join(', #')} remain untouched; test Common copies #${tokenIds.join(', #')} now exist inside your Sepolia Forge.`);const balance=await browserProvider.getBalance(wallet);setBalanceEth(formatEther(balance));
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  async function forgeRare(){
    setBusy(true);setError('');setRare(null);
    try{
      if(imported.length!==3)throw new Error('Import the 3 Common metadata copies first.');const browserProvider=await getSepoliaProvider();const signer=await browserProvider.getSigner(wallet);const contract=new Contract(getAddress(cloneAddress),CLONE_ABI,signer);const [configuredSigner,feeWei]=await Promise.all([contract.forgeSigner(),contract.currentMergePrice()]);if(getAddress(configuredSigner)!==getAddress(wallet))throw new Error('The connected wallet is no longer the configured Forge signer.');
      const descendantURI=descendantMetadata(imported,getAddress(cloneAddress));const request={account:getAddress(wallet),parentTokenId0:BigInt(imported[0].testTokenId),parentTokenId1:BigInt(imported[1].testTokenId),parentTokenId2:BigInt(imported[2].testTokenId),outputTier:1,descendantUriHash:keccak256(toUtf8Bytes(descendantURI)),feeWei,requestId:hexlify(randomBytes(32)),deadline:BigInt(Math.floor(Date.now()/1000)+15*60)};const domain={name:'VoxelForgeClone',version:'1',chainId:84532,verifyingContract:getAddress(cloneAddress)};
      setStatus('Step 4A: MetaMask will ask you to SIGN the ForgeRequest. This signature alone does not spend ETH and cannot touch your production VoxelFlips.');const signature=await signer.signTypedData(domain,FORGE_REQUEST_TYPES,request);setStatus(`Step 4B: signature accepted. MetaMask will now ask you to approve the ${formatEther(feeWei)} Base Sepolia merge fee plus testnet gas.`);const tx=await contract.forge(request,descendantURI,signature,{value:feeWei});setStatus('3→1 Forge submitted. Waiting for Base Sepolia confirmation…');const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw new Error('The real-metadata 3→1 Forge transaction did not succeed.');
      const iface=new Interface(CLONE_ABI);let event=null;for(const log of receipt.logs||[]){try{const parsed=iface.parseLog(log);if(parsed?.name==='Forged'){event=parsed;break}}catch{}}if(!event)throw new Error('Forge confirmed, but the Forged event could not be decoded.');const result={tokenId:event.args.descendantTokenId.toString(),txHash:receipt.hash||tx.hash,feeWei:event.args.feeWei.toString(),uri:descendantURI};setRare(result);setStatus(`Complete. The 3 test Common copies were burned and Rare #${result.tokenId} was minted on Base Sepolia. Your original production VoxelFlips are still untouched on Base mainnet.`);const balance=await browserProvider.getBalance(wallet);setBalanceEth(formatEther(balance));
    }catch(e){setError(errorText(e));setStatus('')}finally{setBusy(false)}
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>REAL VOXELS → TEST FORGE</em></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><p>GUIDED REAL-ASSET LINEAGE TEST</p><h1>Pick 3 real voxels.<br/><em>Forge a Rare.</em></h1><span>This selector shows your full saved My Voxels library first, then verifies Base VoxelFlip ownership. Non-minted voxels no longer disappear. Only confirmed wallet-owned VoxelFlip NFTs can be selected for the 3→1 test.</span></header>
      <div className={styles.steps}>{[['1','LOAD'],['2','SELECT 3'],['3','IMPORT COPIES'],['4','SIGN + FORGE'],['5','RARE READY']].map(([number,label],index)=><div key={number} className={`${styles.step} ${stage===index?styles.active:''} ${stage>index?styles.done:''}`}><small>{stage>index?'✓':number}</small><b>{label}</b></div>)}</div>
      <section className={styles.panel}>
        <div className={styles.row}><div><small>WALLET</small><b>{wallet?short(wallet):'Not connected'}</b>{balanceEth&&<span>{Number(balanceEth).toFixed(5)} Base Sepolia ETH</span>}</div><button onClick={connect} disabled={busy}>{wallet?'RECONNECT':'CONNECT METAMASK'}</button></div>
        <div className={styles.safety}><b>Your Base mainnet NFTs are read-only here.</b><span>The browser never calls approve, transferFrom, safeTransferFrom, burn, list, or sign against the production VoxelFlip contract. The only write contract used below is your Base Sepolia Forge clone.</span></div>
        <div className={styles.sectionHead}><small>STEP 1 · LOAD MY VOXELS + VERIFY NFTS</small><h2>Show everything first.</h2><p>We load every saved My Voxel from this browser and your signed-in Google-backed VoxelPop library before checking the blockchain. A temporary Base/OpenSea problem can no longer hide your local voxels.</p></div>
        <button className={styles.primary} onClick={wallet?scanAssets:connect} disabled={busy}>{busy?'LOADING…':wallet?'LOAD ALL MY VOXELS':'CONNECT METAMASK'}</button>
        {scanInfo?.sourceWarning&&<div className={styles.notice}><b>SCAN NOTE</b><span>{scanInfo.sourceWarning}</span></div>}
        {scanInfo&&<div className={styles.notice}><b>MY VOXELS + PRODUCTION COLLECTION · READ ONLY</b><span>{savedCount} saved My Voxel{savedCount===1?'':'s'} shown · {readyCount} 3D ready · {selectableCount} confirmed wallet-owned VoxelFlip NFT{selectableCount===1?'':'s'} selectable.</span></div>}
        {assets.length>0&&<><div className={styles.sectionHead}><small>STEP 2 · REVIEW LIBRARY / CHOOSE 3 NFTS</small><h2>Your saved voxels stay visible.</h2><p>A card can be selected only after Base confirms that this wallet owns its VoxelFlip NFT. Non-minted 3D voxels are intentionally shown but not selectable yet.</p></div><div className={styles.assetGrid}>{assets.map(asset=>{const chosen=selectedIds.includes(asset.key);const label=asset.selectable?`REAL BASE NFT · #${asset.tokenId}`:asset.library3d?'3D READY · MINT / RECOVER FIRST':'3D NOT READY';const detail=asset.selectable?(asset.animationUrl?'3D-ready + NFT verified':'NFT verified on Base'):asset.library3d?'This 3D voxel is saved. It still needs its Base VoxelFlip mint linked before Forge selection.':`Saved in My Voxels · mesh status ${asset.meshStatus||'idle'}.`;return <button key={asset.key} type="button" className={`${styles.asset} ${chosen?styles.selected:''} ${!asset.selectable?styles.unavailable:''}`} onClick={()=>toggle(asset.key)} disabled={imported.length>0||!asset.selectable}><span className={styles.check}>{chosen?'✓':asset.selectable?'+':'!'}</span>{asset.imageUrl?<img src={asset.imageUrl} alt={asset.name}/>:<div className={styles.placeholder}>{asset.selectable?`VOXELFLIP #${asset.tokenId}`:'MY VOXEL'}</div>}<div className={styles.assetBody}><small>{label}</small><b>{asset.name}</b><span>{detail}</span></div></button>})}</div><div className={styles.selectionBar}><div><b>{selected.length} / 3 selected</b><span>{selected.length===3?'Ready to verify your test Forge.':selectableCount>=3?'Choose three cards marked REAL BASE NFT.':'Your full library is visible; you still need 3 confirmed Base VoxelFlip NFTs to run the Forge test.'}</span></div>{selected.length>0&&imported.length===0&&<button className={styles.secondary} onClick={()=>setSelectedIds([])}>CLEAR SELECTION</button>}</div></>}
        {scanInfo&&selectableCount<3&&<div className={styles.notice}><b>FORGE NEEDS 3 CONFIRMED NFTS</b><span>Non-minted 3D voxels should now remain visible. They cannot be used as Forge parents until their Base VoxelFlip mint is confirmed/recovered. No automatic mint is performed here.</span></div>}
        {selected.length===3&&<><div className={styles.sectionHead}><small>STEP 3 · VERIFY TEST FORGE</small><h2>Review the destination before anything is written.</h2><p>This is your already-deployed Base Sepolia creator Forge. MetaMask may switch networks here, but verifying it does not spend ETH.</p></div><div className={styles.inputRow}><input value={cloneAddress} onChange={e=>{setCloneAddress(e.target.value);setCloneVerified(false)}} placeholder="Base Sepolia Forge clone 0x…" autoCapitalize="off" autoCorrect="off" spellCheck="false"/><button className={styles.secondary} onClick={verifyClone} disabled={busy}>{cloneVerified?'✓ VERIFIED':'VERIFY FORGE'}</button></div><div className={styles.review}>{selected.map((asset,index)=><article key={asset.key}><small>PARENT {index+1}</small><b>{asset.name}</b><span>Production VoxelFlip #{asset.tokenId}<br/>{short(asset.contract)}</span></article>)}</div>{cloneVerified&&<button className={styles.primary} onClick={importSelected} disabled={busy||imported.length===3}>{imported.length===3?'3 TEST COPIES IMPORTED':busy?'WAITING FOR METAMASK…':'IMPORT 3 METADATA COPIES TO SEPOLIA'}</button>}<p className={styles.fine}>Import means minting three separate Common NFTs inside the test Forge with the same tokenURI metadata. It does not move the production NFTs.</p></>}
        {status&&<div className={styles.notice}><b>STATUS</b><span>{status}</span></div>}{error&&<div className={styles.error}>{error}</div>}
      </section>
      {imported.length===3&&<section className={styles.panel}><div className={styles.confirmed}><b>✓ 3 REAL-METADATA COMMON COPIES READY</b><span>{imported.map(item=>`VoxelFlip #${item.tokenId} → Test Common #${item.testTokenId}`).join(' · ')}</span>{importTx&&<a href={explorerTx(importTx)} target="_blank" rel="noreferrer">VIEW IMPORT TRANSACTION ↗</a>}</div><div className={styles.sectionHead}><small>STEP 4 · SIGN + FORGE</small><h2>Now run the real lineage 3→1.</h2><p>First MetaMask shows a ForgeRequest signature. Then it separately shows the Base Sepolia transaction with the live merge fee. The three TEST copies are burned; the three production NFTs are not.</p></div><button className={styles.primary} onClick={forgeRare} disabled={busy||!!rare}>{rare?'RARE CONFIRMED':busy?'WAITING FOR SIGNATURE / METAMASK…':'SIGN + FORGE THESE 3 INTO A RARE'}</button></section>}
      {rare&&<section className={styles.panel}><div className={styles.confirmed}><b>✓ REAL-VOXEL LINEAGE TEST COMPLETE · RARE #{rare.tokenId}</b><span>Three verified production VoxelFlip metadata records entered the Sepolia test flow, their Common copies were burned, and one Rare descendant was minted. Your production assets stayed untouched.</span><a href={explorerTx(rare.txHash)} target="_blank" rel="noreferrer">VIEW FORGE TRANSACTION ↗</a></div><div className={styles.sectionHead}><small>STEP 5 · WHAT THIS PROVES</small><h2>The bridge works. The next leap is visual fusion.</h2><p>This Rare currently records the real parent lineage and inherits the first parent’s visual/3D media as a test reference. It does not yet generate a brand-new combined 3D model from the three parents. That generation layer is the next product milestone before any mainnet Forge design.</p></div><div className={styles.review}>{imported.map((asset,index)=><article key={asset.key||asset.tokenId}><small>SOURCE {index+1}</small><b>{asset.name}</b><span>Production #{asset.tokenId} · still on Base</span></article>)}</div><p className={styles.fine}>No claim of resale value or profit is made by the Forge tier. Rarity here is contract state and lineage, not a guarantee of market price.</p></section>}
    </div>
    <footer className={styles.footer}><a href="/studio#my-voxels">← MY VOXELS</a><a href={explorerAddress(cloneAddress)} target="_blank" rel="noreferrer">TEST FORGE ON BASESCAN ↗</a></footer>
  </main>;
}
