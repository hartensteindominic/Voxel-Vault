'use client';

import {useEffect,useMemo,useState} from 'react';
import {getAddress,hexlify,randomBytes} from 'ethers';
import {discoverMetaMaskProvider,getMetaMaskDeepLink} from '../../../lib/wallet-connect';
import GeneratedMeshViewer from '../../pack/success/GeneratedMeshViewer';
import styles from './fusion.module.css';

function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}
function errorText(error){return String(error?.shortMessage||error?.reason||error?.message||error||'Something went wrong.')}
function assetKey(asset){return `${String(asset.contract||'').toLowerCase()}:${String(asset.tokenId||'')}`}
function displayImage(asset){
  if(asset.imageUrl)return asset.imageUrl;
  const uri=String(asset.tokenURI||'');
  try{
    if(uri.startsWith('data:application/json;base64,')){
      const json=JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
      return String(json?.image||'');
    }
    if(uri.startsWith('data:application/json,')){
      const json=JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)));
      return String(json?.image||'');
    }
  }catch{}
  return '';
}
function canonicalParents(parents){return parents.map(parent=>`${getAddress(parent.contract)}:${String(parent.tokenId)}`)}
function fusionMessage(wallet,parents,nonce,issuedAt){
  const ids=canonicalParents(parents);
  return [
    'VoxelForge Visual Fusion v1',
    `Wallet: ${wallet}`,
    `Parent 1: ${ids[0]}`,
    `Parent 2: ${ids[1]}`,
    `Parent 3: ${ids[2]}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    'Purpose: authorize one off-chain 3D fusion generation. No NFT transfer or ETH spend.',
  ].join('\n');
}
async function apiJson(response,fallback){
  const text=await response.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{}
  if(!response.ok){
    const detail=String(data?.error||data?.message||'').trim();
    let hint=detail;
    if(!hint&&response.status===404)hint='The visual-fusion API is missing from this deployment.';
    if(!hint&&(response.status===401||response.status===403))hint='The deployment blocked the visual-fusion API request or its authorization.';
    if(!hint&&response.status>=500)hint='The deployment hit a server error before it could return JSON. Retry once; if it repeats, the HTTP status now identifies the failing stage.';
    if(!hint)hint='The visual-fusion API returned an unreadable response.';
    throw new Error(`${fallback} (HTTP ${response.status}). ${hint}`);
  }
  return data;
}

export default function VisualFusionPage(){
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState('');
  const [assets,setAssets]=useState([]);
  const [selectedKeys,setSelectedKeys]=useState([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [concept,setConcept]=useState(null);
  const [mesh,setMesh]=useState(null);

  const selected=useMemo(()=>selectedKeys.map(key=>assets.find(asset=>assetKey(asset)===key)).filter(Boolean),[selectedKeys,assets]);

  async function connect(){
    setBusy(true);setError('');setStatus('Opening MetaMask…');
    try{
      const injected=await discoverMetaMaskProvider();
      if(!injected){window.location.href=getMetaMaskDeepLink(window.location.href);return;}
      const accounts=await injected.request({method:'eth_requestAccounts'});
      if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');
      const address=getAddress(accounts[0]);
      setProvider(injected);setWallet(address);setStatus('Wallet connected. Load your verified Base voxel NFTs and choose three parents.');
    }catch(error){setError(errorText(error));setStatus('')}finally{setBusy(false)}
  }

  async function load(){
    setBusy(true);setError('');setConcept(null);setMesh(null);setSelectedKeys([]);setStatus('Reading wallet-owned Base voxel NFTs…');
    try{
      if(!wallet)throw new Error('Connect MetaMask first.');
      const response=await fetch(`/api/forge/owned-assets?${new URLSearchParams({wallet})}`,{cache:'no-store'});
      const data=await apiJson(response,'Could not load wallet NFTs');
      const verified=(Array.isArray(data.nfts)?data.nfts:[]).filter(asset=>asset.selectable!==false&&asset.contract&&asset.tokenId!=null&&displayImage(asset));
      setAssets(verified);
      setStatus(`Found ${verified.length} verified Base voxel NFT${verified.length===1?'':'s'} with usable visual media.`);
    }catch(error){setError(errorText(error));setStatus('')}finally{setBusy(false)}
  }

  function toggle(asset){
    if(concept||mesh)return;
    const key=assetKey(asset);
    setSelectedKeys(current=>current.includes(key)?current.filter(item=>item!==key):current.length>=3?current:[...current,key]);
  }

  async function startConcept(){
    setBusy(true);setError('');setConcept(null);setMesh(null);
    try{
      if(!provider||!wallet)throw new Error('Connect MetaMask first.');
      if(selected.length!==3)throw new Error('Choose exactly three parent NFTs.');
      const nonce=hexlify(randomBytes(16));
      const issuedAt=Date.now();
      const parents=selected.map(asset=>({contract:asset.contract,tokenId:String(asset.tokenId)}));
      const message=fusionMessage(wallet,parents,nonce,issuedAt);
      setStatus('MetaMask will ask for a free signature authorizing one off-chain visual fusion. This signature cannot spend ETH or move NFTs.');
      const signature=await provider.request({method:'personal_sign',params:[message,wallet]});
      setStatus('Signature accepted. Building one coherent multi-view descendant from all three parent visuals…');
      const response=await fetch('/api/forge/visual-fusion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'concept',wallet,parents,nonce,issuedAt,signature})});
      const data=await apiJson(response,'Could not start visual fusion');
      setConcept({taskId:data.conceptTaskId,ticket:data.ticket,parents:data.parents||parents,status:'PENDING',progress:0,imageUrls:[]});
      setStatus('Fusion concept started. The page will keep checking until the same new descendant is rendered from multiple angles.');
    }catch(error){setError(errorText(error));setStatus('')}finally{setBusy(false)}
  }

  useEffect(()=>{
    if(!concept?.taskId||['SUCCEEDED','FAILED','EXPIRED','CANCELED','CANCELLED'].includes(String(concept.status||'').toUpperCase()))return;
    let active=true;
    const poll=async()=>{
      try{
        const response=await fetch(`/api/forge/visual-fusion?${new URLSearchParams({kind:'concept',taskId:concept.taskId})}`,{cache:'no-store'});
        const data=await apiJson(response,'Could not read fusion concept status');
        if(!active)return;
        setConcept(current=>current?{...current,status:data.status,progress:data.progress||0,imageUrls:data.imageUrls||[],error:data.error||''}:current);
        const upper=String(data.status||'').toUpperCase();
        if(upper==='SUCCEEDED')setStatus('The fused descendant concept is ready from multiple angles. Review it, then build the real 3D GLB.');
        else if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(upper))setError(data.error||'The visual-fusion concept failed.');
      }catch(error){if(active)setError(errorText(error))}
    };
    poll();const id=setInterval(poll,3500);return()=>{active=false;clearInterval(id)};
  },[concept?.taskId,concept?.status]);

  async function startMesh(){
    setBusy(true);setError('');
    try{
      if(String(concept?.status||'').toUpperCase()!=='SUCCEEDED')throw new Error('Wait for the fused multi-view concept to finish first.');
      const parents=selected.map(asset=>({contract:asset.contract,tokenId:String(asset.tokenId)}));
      setStatus('Starting the fused 3D reconstruction. This uses the multi-view descendant—not any single parent—as the geometry source.');
      const response=await fetch('/api/forge/visual-fusion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mesh',wallet,parents,conceptTaskId:concept.taskId,ticket:concept.ticket})});
      const data=await apiJson(response,'Could not start fused 3D generation');
      setMesh({taskId:data.meshTaskId,status:'PENDING',progress:0,thumbnailUrl:'',modelUrl:''});
      setStatus('Fused 3D task started. Generating geometry, PBR textures, and GLB…');
    }catch(error){setError(errorText(error));setStatus('')}finally{setBusy(false)}
  }

  useEffect(()=>{
    if(!mesh?.taskId||['SUCCEEDED','FAILED','EXPIRED','CANCELED','CANCELLED'].includes(String(mesh.status||'').toUpperCase()))return;
    let active=true;
    const poll=async()=>{
      try{
        const response=await fetch(`/api/forge/visual-fusion?${new URLSearchParams({kind:'mesh',taskId:mesh.taskId})}`,{cache:'no-store'});
        const data=await apiJson(response,'Could not read fused 3D status');
        if(!active)return;
        setMesh(current=>current?{...current,status:data.status,progress:data.progress||0,thumbnailUrl:data.thumbnailUrl||'',modelUrl:data.modelUrl||'',error:data.error||''}:current);
        const upper=String(data.status||'').toUpperCase();
        if(upper==='SUCCEEDED')setStatus('TRUE VISUAL FUSION COMPLETE. One brand-new 3D descendant was generated from all three parent designs.');
        else if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(upper))setError(data.error||'The fused 3D generation failed.');
      }catch(error){if(active)setError(errorText(error))}
    };
    poll();const id=setInterval(poll,4500);return()=>{active=false;clearInterval(id)};
  },[mesh?.taskId,mesh?.status]);

  function reset(){setSelectedKeys([]);setConcept(null);setMesh(null);setError('');setStatus('Choose three different verified Base voxel NFTs.');}

  const conceptReady=String(concept?.status||'').toUpperCase()==='SUCCEEDED';
  const meshReady=String(mesh?.status||'').toUpperCase()==='SUCCEEDED';
  const previewUrl=meshReady?`/api/forge/visual-fusion?${new URLSearchParams({kind:'mesh',taskId:mesh.taskId,preview:'1'})}`:'';

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/forge/real"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><span>Voxel Forge</span></a><em>VISUAL FUSION · EXPERIMENT</em></nav>
    <div className={styles.shell}>
      <header className={styles.hero}><small>3 PARENTS → 1 NEW 3D DESCENDANT</small><h1>Give the lineage<br/><em>a new body.</em></h1><p>This prototype uses the three verified parent NFT visuals to synthesize one coherent new voxel descendant from multiple angles, then reconstructs that descendant as a fresh textured GLB. Parent NFTs stay untouched.</p></header>

      <section className={styles.panel}>
        <div className={styles.row}><div className={styles.walletInfo}><small>BASE PARENT WALLET</small><b>{wallet||'Not connected'}</b></div><div className={styles.actions}><button className={styles.secondary} onClick={connect} disabled={busy}>{wallet?'RECONNECT':'CONNECT METAMASK'}</button>{wallet&&<button className={styles.button} onClick={load} disabled={busy}>{busy?'LOADING…':'LOAD VERIFIED PARENTS'}</button>}</div></div>
        <div className={styles.safety}><b>Safe boundary:</b> Base mainnet is read-only. The authorization signature is off-chain and cannot spend ETH, approve NFTs, transfer them, burn them, or list them. This experiment generates media only.</div>

        {assets.length>0&&<div className={styles.section}><span className={styles.eyebrow}>STEP 1 · CHOOSE GENETIC PARENTS</span><h2>Select exactly three.</h2><p>Each parent was independently verified as owned by the connected Base wallet and must have usable visual metadata.</p><div className={styles.grid}>{assets.map(asset=>{const key=assetKey(asset);const chosen=selectedKeys.includes(key);return <button key={key} type="button" className={`${styles.card} ${chosen?styles.selected:''}`} onClick={()=>toggle(asset)}><span className={styles.pick}>{chosen?'✓':'+'}</span><img src={displayImage(asset)} alt={asset.name||`Voxel #${asset.tokenId}`}/><div className={styles.cardBody}><small>{asset.legacyVoxelFlip?'LEGACY VOXEL NFT':'BASE VOXEL NFT'} · #{asset.tokenId}</small><b>{asset.name||`Voxel #${asset.tokenId}`}</b><span>{short(asset.contract)}</span></div></button>})}</div><div className={styles.selection}><div><b>{selected.length} / 3 parents selected</b><span>{selected.length===3?'Ready to authorize the off-chain fusion.':'Choose three different parent designs.'}</span></div><div className={styles.actions}>{selected.length>0&&!concept&&<button className={styles.secondary} onClick={()=>setSelectedKeys([])}>CLEAR</button>}{selected.length===3&&!concept&&<button className={styles.button} onClick={startConcept} disabled={busy}>SIGN + CREATE FUSED CONCEPT</button>}</div></div></div>}

        {concept&&<div className={styles.section}><span className={styles.eyebrow}>STEP 2 · FUSED MULTI-VIEW CONCEPT</span><h2>One identity, multiple angles.</h2><p>The image model is explicitly told to create one new descendant that visibly inherits traits from all three parents—not a collage or three separate objects.</p>{!conceptReady&&<><div className={styles.progress}><i style={{width:`${Math.max(4,Math.min(100,concept.progress||0))}%`}}/></div><div className={styles.notice}>Concept status: {concept.status} · {concept.progress||0}%</div></>}{concept.imageUrls?.length>0&&<div className={styles.conceptGrid}>{concept.imageUrls.map((url,index)=><img key={url} src={url} alt={`Fused descendant view ${index+1}`}/>)}</div>}{conceptReady&&!mesh&&<div className={styles.actions}><button className={styles.button} onClick={startMesh} disabled={busy}>{busy?'STARTING 3D…':'BUILD THIS DESCENDANT IN 3D'}</button><button className={styles.secondary} onClick={reset}>START OVER</button></div>}</div>}

        {mesh&&<div className={styles.section}><span className={styles.eyebrow}>STEP 3 · NEW 3D BODY</span><h2>{meshReady?'True visual fusion complete.':'Reconstructing the fused descendant…'}</h2><p>The 3D task uses the fused multi-view concept as its geometry and texture source, so the GLB is a new descendant rather than a media copy of Parent 1.</p>{!meshReady&&<><div className={styles.progress}><i style={{width:`${Math.max(4,Math.min(100,mesh.progress||0))}%`}}/></div><div className={styles.notice}>3D status: {mesh.status} · {mesh.progress||0}%</div></>}{meshReady&&<><div className={styles.success}><b>✓ BRAND-NEW FUSED GLB READY</b><br/>The next integration step is to use this fused media in the Rare descendant metadata while preserving all three on-chain parent IDs.</div><div className={styles.viewerWrap}><GeneratedMeshViewer url={previewUrl} label="fused voxel descendant"/></div><div className={styles.lineage}>{selected.map((asset,index)=><article key={assetKey(asset)}><small>PARENT {index+1}</small><b>{asset.name||`Voxel #${asset.tokenId}`}</b><span>{asset.contract}<br/>Token #{asset.tokenId}</span></article>)}</div><div className={styles.actions}><button className={styles.secondary} onClick={reset}>FUSE ANOTHER THREE</button></div></>}</div>}

        {status&&<div className={styles.notice}>{status}</div>}{error&&<div className={styles.error}>{error}</div>}
      </section>
      <p className={styles.footer}>Experiment only. No claim of increased resale value or profit is made by visual fusion. The current prototype creates off-chain descendant media; the existing Base Sepolia lineage contract remains the separate test write path.</p>
    </div>
  </main>;
}
