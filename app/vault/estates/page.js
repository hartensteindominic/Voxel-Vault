'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatUnits, getAddress } from 'ethers';
import { DIGITAL_ESTATE_DISCLOSURE, DIGITAL_ESTATES, formatUsdCents, getDigitalEstate } from '../../../lib/digital-estates';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';

const BASE_CHAIN_ID = '0x2105';
const BASE_RPC = 'https://mainnet.base.org';
const BASE_EXPLORER = 'https://basescan.org';
const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
];

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : '—';
}
function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}
function googleReturnUrl(estateId) {
  const url = new URL('/vault/estates', window.location.origin);
  url.searchParams.set('estate', estateId);
  url.searchParams.set('auth', 'google');
  return url.toString();
}

async function ensureBase(provider) {
  let chainId = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId === BASE_CHAIN_ID) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
  } catch (error) {
    if (error?.code === 4001) throw new Error('Base network switch was cancelled.');
    if (error?.code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [BASE_RPC], blockExplorerUrls: [BASE_EXPLORER] }] });
  }
  chainId = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId !== BASE_CHAIN_ID) throw new Error('Switch MetaMask to Base before continuing.');
}

function EstateScene({ estate }) {
  const mountRef = useRef(null);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import('three').then((THREE) => {
      if (disposed || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(320, mount.clientWidth || 320);
      const height = Math.max(390, mount.clientHeight || 520);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07080c, 18, 38);
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      const world = new THREE.Group();
      scene.add(world);
      scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x11151c, 2.1));
      const key = new THREE.DirectionalLight(0xffffff, 3.1);
      key.position.set(10, 14, 9);
      scene.add(key);
      const accent = new THREE.PointLight(new THREE.Color(estate.accent), 34, 32);
      accent.position.set(-7, 5, 7);
      scene.add(accent);

      const geometries = [];
      const materials = [];
      function mat(color, options = {}) {
        const material = new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .62, metalness: options.metalness ?? .08, transparent: Boolean(options.transparent), opacity: options.opacity ?? 1, emissive: options.emissive || 0x000000, emissiveIntensity: options.emissiveIntensity || 0 });
        materials.push(material);
        return material;
      }
      function box(w, h, d, color, x, y, z, options = {}) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, mat(color, options));
        mesh.position.set(x, y, z);
        world.add(mesh);
        return mesh;
      }
      function glass(w, h, x, y, z) {
        return box(w, h, .08, estate.accent, x, y, z, { roughness: .12, metalness: .35, transparent: true, opacity: .58, emissive: estate.accent, emissiveIntensity: .22 });
      }

      box(18, .55, 15, estate.terrain, 0, -.6, 0, { roughness: .96 });
      box(14.2, .18, 11.3, 0x131720, 0, -.22, 0, { roughness: .9 });
      const structure = estate.structure;
      const roof = estate.roof;

      if (estate.architecture === 'courtyard') {
        box(5.3, 2.8, 3.4, structure, -3.5, 1.25, -1.6); box(4.5, 2.8, 3.4, structure, 3.8, 1.25, -1.6); box(3.2, 2.8, 4.5, structure, .1, 1.25, 2.1);
        box(5.7,.28,3.7,roof,-3.5,2.8,-1.6); box(4.9,.28,3.7,roof,3.8,2.8,-1.6); glass(2.7,1.85,.1,1.35,-.18); box(4,.14,2.4,0x29453a,.1,-.08,-.3);
      } else if (estate.architecture === 'glass') {
        box(11.2,2.7,4.4,structure,0,1.2,0); box(12.5,.34,5.5,roof,0,2.75,0); glass(9.5,1.85,0,1.3,2.22); box(5.6,.18,2.7,0x25566a,1.7,-.08,4.3,{roughness:.2,metalness:.25});
      } else if (estate.architecture === 'waterfront') {
        box(9,2.8,4.9,structure,-1.1,1.25,.4); box(6.4,2.55,3.9,structure,2.1,3.75,-.2); box(9.4,.3,5.2,roof,-1.1,2.82,.4); box(6.8,.3,4.3,roof,2.1,5.17,-.2); glass(4.8,1.9,-1.6,1.35,2.88); glass(4,1.7,2.1,3.78,1.78); box(10.8,.18,2.3,0x26566b,.2,-.08,4.9,{roughness:.2});
      } else if (estate.architecture === 'villa') {
        box(4.8,3.1,5.3,structure,-4,1.4,0); box(4.8,3.1,5.3,structure,4,1.4,0); box(4.7,2.7,3.9,structure,0,4,-1); box(5.2,.34,5.7,roof,-4,3.1,0); box(5.2,.34,5.7,roof,4,3.1,0); box(5.1,.34,4.3,roof,0,5.5,-1); glass(3.5,1.75,0,4,.98); box(4.6,.18,3.2,0x255a69,0,-.08,3.7,{roughness:.2});
      } else {
        box(8.4,2.6,4.4,structure,-1.2,1.2,.7); box(7.2,2.5,3.9,structure,1.3,3.65,-.2); box(6.1,2.3,3.3,structure,-.9,5.95,-.7); box(8.8,.3,4.8,roof,-1.2,2.68,.7); box(7.7,.3,4.3,roof,1.3,5.03,-.2); box(6.5,.3,3.7,roof,-.9,7.25,-.7); glass(4.9,1.6,-1.2,1.25,2.93); glass(4.4,1.5,1.3,3.68,1.78); glass(3.9,1.4,-.9,5.98,.98);
      }

      for (let i = 0; i < 8; i += 1) {
        const x = (i % 2 ? 1 : -1) * (6.2 + (i % 3) * .55);
        const z = -4.8 + (i * 1.47) % 9.7;
        box(.25,1.25,.25,0x6b5848,x,.45,z);
        const g = new THREE.SphereGeometry(.65 + (i % 3) * .08, 8, 6); geometries.push(g);
        const crown = new THREE.Mesh(g, mat(0x31543c,{roughness:.95})); crown.position.set(x,1.35,z); world.add(crown);
      }
      const ringG = new THREE.RingGeometry(7,7.12,64); geometries.push(ringG);
      const ring = new THREE.Mesh(ringG, mat(estate.accent,{emissive:estate.accent,emissiveIntensity:.5,transparent:true,opacity:.5})); ring.rotation.x=-Math.PI/2; ring.position.y=-.24; world.add(ring);

      let azimuth=.72, elevation=.5, radius=estate.architecture==='sky-villa'?24:21, dragging=false, lx=0, ly=0;
      const updateCamera=()=>{const c=Math.cos(elevation);camera.position.set(Math.sin(azimuth)*c*radius,Math.sin(elevation)*radius,Math.cos(azimuth)*c*radius);camera.lookAt(0,estate.architecture==='sky-villa'?2:1.35,0)}; updateCamera();
      const down=e=>{dragging=true;lx=e.clientX;ly=e.clientY;renderer.domElement.setPointerCapture?.(e.pointerId)};
      const move=e=>{if(!dragging)return;azimuth-=(e.clientX-lx)*.008;elevation=Math.max(.22,Math.min(1.02,elevation+(e.clientY-ly)*.005));lx=e.clientX;ly=e.clientY;updateCamera()};
      const up=()=>{dragging=false};
      const wheel=e=>{radius=Math.max(15,Math.min(29,radius+Math.sign(e.deltaY)*1.15));updateCamera()};
      renderer.domElement.addEventListener('pointerdown',down); renderer.domElement.addEventListener('pointermove',move); renderer.domElement.addEventListener('pointerup',up); renderer.domElement.addEventListener('wheel',wheel,{passive:true});
      let frame, t=0;
      const animate=()=>{frame=requestAnimationFrame(animate);t+=.01;accent.intensity=30+Math.sin(t)*5;ring.material.opacity=.42+Math.sin(t*.7)*.08;renderer.render(scene,camera)}; animate();
      const resize=()=>{if(!mountRef.current)return;const w=Math.max(320,mountRef.current.clientWidth||320),h=Math.max(390,mountRef.current.clientHeight||520);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}; window.addEventListener('resize',resize);
      cleanup=()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('wheel',wheel);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();mount.innerHTML=''};
    });
    return()=>{disposed=true;cleanup()};
  },[estate]);
  return <div className="scene" ref={mountRef}/>;
}

export default function DigitalEstatesPage() {
  const [selectedId,setSelectedId]=useState(DIGITAL_ESTATES[0].id);
  const estate=useMemo(()=>getDigitalEstate(selectedId)||DIGITAL_ESTATES[0],[selectedId]);
  const [session,setSession]=useState(null);
  const [wallet,setWallet]=useState('');
  const [status,setStatus]=useState('Explore a property. Real payment buttons are clearly labeled; use Testnet Land to test without real money.');
  const [busy,setBusy]=useState('');
  const [secured,setSecured]=useState(null);
  const [recoveryTx,setRecoveryTx]=useState('');
  const clientRef=useRef(null);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const requested=getDigitalEstate(params.get('estate'));
    if(requested)setSelectedId(requested.id);
    if(params.get('checkout')==='cancelled')setStatus('Checkout cancelled. No purchase was completed.');
    let active=true,subscription=null;
    getSupabaseBrowserAsync().then(async client=>{
      if(!active)return;clientRef.current=client;const{data}=await client.auth.getSession();setSession(data.session||null);
      const auth=client.auth.onAuthStateChange((_event,next)=>active&&setSession(next));subscription=auth.data.subscription;
      if(params.get('auth')==='google'){params.delete('auth');window.history.replaceState({},'',`${window.location.pathname}?${params.toString()}`)}
    }).catch(error=>setStatus(errorText(error)));
    return()=>{active=false;subscription?.unsubscribe?.()};
  },[]);
  useEffect(()=>{try{setRecoveryTx(window.localStorage.getItem(`vv-digital-estate-usdc:${estate.id}`)||'')}catch{setRecoveryTx('')}},[estate.id]);

  async function signIn(){setBusy('signin');try{const client=clientRef.current||await getSupabaseBrowserAsync();clientRef.current=client;const{error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleReturnUrl(estate.id)}});if(error)throw error}catch(error){setStatus(errorText(error));setBusy('')}}
  async function connectWallet(){const injected=await discoverMetaMaskProvider();if(!injected){window.location.href=getMetaMaskDeepLink(window.location.href);return null}const accounts=await injected.request({method:'eth_requestAccounts'});if(!accounts?.[0])throw new Error('Wallet connection was cancelled.');const address=getAddress(accounts[0]);setWallet(address);return{provider:injected,wallet:address}}

  async function paySecurely(){
    if(!session?.access_token){await signIn();return}
    setBusy('stripe');setSecured(null);
    try{
      let activeWallet=wallet;if(!activeWallet){const connected=await connectWallet();if(!connected)return;activeWallet=connected.wallet}
      setStatus(`Creating secure checkout for ${estate.name}. This is a REAL ${formatUsdCents(estate.purchasePriceCents)} digital-asset payment.`);
      const response=await fetch('/api/digital-estates/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({estateId:estate.id,wallet:activeWallet})});
      const data=await response.json().catch(()=>({}));if(!response.ok||!data?.url)throw new Error(data?.error||'Checkout could not be created.');window.location.href=data.url;
    }catch(error){setStatus(errorText(error));setBusy('')} 
  }

  async function secureUsdcPayment(txHash,activeWallet){
    setStatus('USDC transfer confirmed. Independently verifying the exact Base payment and securing ownership — no NFT mint will run.');
    const response=await fetch('/api/digital-estates/claim',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({source:'base-usdc',action:'secure',estateId:estate.id,wallet:activeWallet,txHash})});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data?.ownershipSecured)throw new Error(data?.error||'USDC payment could not be verified.');
    setSecured(data);try{window.localStorage.removeItem(`vv-digital-estate-usdc:${estate.id}`)}catch{}setRecoveryTx('');
    setStatus(`${estate.name} is PURCHASED & SECURED to ${short(activeWallet)}. Minting is optional. Nobody else can buy this unique estate.`);
  }

  async function payUsdc(){
    if(!session?.access_token){await signIn();return}
    setBusy('usdc');setSecured(null);
    try{
      const connected=await connectWallet();if(!connected)return;await ensureBase(connected.provider);
      const response=await fetch('/api/digital-estates/crypto-config',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({estateId:estate.id,wallet:connected.wallet})});
      const config=await response.json().catch(()=>({}));if(!response.ok||!config?.ready)throw new Error(config?.error||'USDC purchase could not be prepared.');
      const browser=new BrowserProvider(connected.provider);const signer=await browser.getSigner(connected.wallet);const usdc=new Contract(config.usdcAddress,USDC_ABI,signer);const amount=BigInt(config.amountUsdcUnits);const balance=await usdc.balanceOf(connected.wallet);
      if(balance<amount)throw new Error(`This real purchase requires ${formatUnits(amount,6)} USDC. Wallet balance is ${formatUnits(balance,6)} USDC.`);
      setStatus(`REAL PAYMENT: MetaMask will request exactly ${formatUnits(amount,6)} USDC on Base. Buying secures the estate first; minting will NOT happen automatically.`);
      const tx=await usdc.transfer(getAddress(config.recipient),amount);try{window.localStorage.setItem(`vv-digital-estate-usdc:${estate.id}`,tx.hash)}catch{}setRecoveryTx(tx.hash);setStatus(`USDC submitted ${short(tx.hash)}. Waiting for Base confirmation…`);
      const receipt=await tx.wait();if(!receipt||Number(receipt.status)!==1)throw new Error('The USDC transfer did not succeed.');await secureUsdcPayment(tx.hash,connected.wallet);
    }catch(error){setStatus(errorText(error))}finally{setBusy('')}
  }

  async function recoverUsdc(){
    if(!recoveryTx)return;if(!session?.access_token){await signIn();return}setBusy('recover');
    try{const connected=await connectWallet();if(!connected)return;await secureUsdcPayment(recoveryTx,connected.wallet)}catch(error){setStatus(errorText(error))}finally{setBusy('')}
  }

  return <main className="page">
    <header><Link href="/vault">VOXEL VAULT</Link><nav><Link href="/vault/estates/mine">MY ESTATES</Link><Link className="safe" href="/vault/test-land">SAFE TESTNET LAND</Link></nav></header>
    <section className="layout">
      <div className="viewer"><EstateScene estate={estate}/><div className="viewerTag"><span>LIVE 3D DIGITAL ESTATE</span><b>DRAG TO ORBIT · SCROLL TO ZOOM</b></div></div>
      <aside>
        <div className="eyebrow"><i/> UNIQUE DIGITAL PROPERTY · {estate.locationLabel}</div>
        <h1>{estate.name}</h1><p className="summary">{estate.summary}</p>
        <div className="specs"><div><b>{estate.beds}</b><span>BEDS</span></div><div><b>{estate.baths}</b><span>BATHS</span></div><div><b>{estate.sqft.toLocaleString()}</b><span>SQ FT</span></div><div><b>{estate.floors}</b><span>FLOORS</span></div></div>
        <div className="prices"><div><span>REAL-WORLD REFERENCE</span><strong>{formatUsdCents(estate.referenceValueCents)}</strong></div><div><span>DIGITAL ESTATE LIST PRICE</span><strong>{formatUsdCents(estate.purchasePriceCents)}</strong></div><small>Same nominal price by design. Reference value is creative model pricing, not an appraisal.</small></div>
        <div className="ownership"><b>1 · BUY</b><span>Payment secures this unique estate to your account + bound wallet.</span><b>2 · MINT LATER (OPTIONAL)</b><span>Add Base provenance and wallet visibility whenever you want.</span></div>
        <div className="status">{status}</div>
        {!session?<button onClick={signIn} disabled={Boolean(busy)} className="primary">SIGN IN TO BUY</button>:null}
        {session?<><button onClick={paySecurely} disabled={Boolean(busy)} className="primary">{busy==='stripe'?'OPENING CHECKOUT…':`REAL PAYMENT · PAY SECURELY`}</button><button onClick={payUsdc} disabled={Boolean(busy)} className="secondary">{busy==='usdc'?'VERIFYING WALLET…':'REAL PAYMENT · PAY USDC ON BASE'}</button></>:null}
        {recoveryTx&&session?<button onClick={recoverUsdc} disabled={Boolean(busy)} className="recover">RECOVER EXISTING USDC PURCHASE · NO NEW TRANSFER</button>:null}
        {secured?<Link className="owned" href="/vault/estates/mine">✓ PURCHASED & SECURED · OPEN MY ESTATES</Link>:null}
        <Link className="testButton" href="/vault/test-land">TRY BLOCKCHAIN SAFELY · BASE SEPOLIA TESTNET →</Link>
        <p className="warning"><strong>REAL PAYMENT WARNING:</strong> The two payment buttons above can initiate real-money transactions at the displayed Digital Estate price when providers are live. Use Testnet Land to experiment without real money.</p>
      </aside>
    </section>
    <section className="rail">{DIGITAL_ESTATES.map(item=><button key={item.id} onClick={()=>{setSelectedId(item.id);setSecured(null);setStatus('Explore this property. Real payment buttons are labeled; Testnet Land uses no real purchase money.')}} className={item.id===estate.id?'active':''}><div className="thumb" style={{background:`radial-gradient(circle at 60% 35%,${item.accent}55,transparent 30%),linear-gradient(145deg,${item.terrain},#090b0f)`}}><span>{item.architecture.toUpperCase()}</span></div><strong>{item.name}</strong><small>{formatUsdCents(item.purchasePriceCents)}</small></button>)}</section>
    <footer><strong>DIGITAL ESTATES</strong><p>{DIGITAL_ESTATE_DISCLOSURE} Purchase ownership is secured before minting. Minting is optional and does not guarantee appreciation.</p></footer>
    <style jsx>{`
      :global(body){margin:0;background:#050609;color:#f5f6f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:18px clamp(14px,3vw,42px) 80px;background:radial-gradient(circle at 74% 8%,rgba(101,85,223,.13),transparent 26%),#050609}header{height:46px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06)}header>a{color:#fff;text-decoration:none;font-size:11px;font-weight:950;letter-spacing:.16em}nav{display:flex;gap:8px}nav a{color:#8e96a7;text-decoration:none;font-size:8px;letter-spacing:.11em;font-weight:900;padding:9px 11px;border:1px solid rgba(255,255,255,.08);border-radius:12px}.safe{color:#79efbc!important;border-color:rgba(121,239,188,.2)!important}.layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr);gap:18px;margin-top:18px}.viewer{position:relative;min-height:660px;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:linear-gradient(145deg,#0c0e14,#08090d)}.scene{position:absolute;inset:0}.viewerTag{position:absolute;left:18px;right:18px;bottom:16px;display:flex;justify-content:space-between;gap:12px;pointer-events:none}.viewerTag span,.viewerTag b{padding:8px 10px;border-radius:999px;background:rgba(5,7,10,.72);border:1px solid rgba(255,255,255,.09);font-size:7px;letter-spacing:.12em}.viewerTag span{color:#9ff0d4}.viewerTag b{color:#767f91}aside{border:1px solid rgba(255,255,255,.08);border-radius:30px;padding:28px;background:linear-gradient(150deg,rgba(255,255,255,.05),rgba(255,255,255,.015));align-self:start}.eyebrow{font-size:8px;color:#858ea0;letter-spacing:.13em;font-weight:900}.eyebrow i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#79efbc;margin-right:8px;box-shadow:0 0 15px #79efbc}h1{font-size:clamp(44px,5vw,72px);line-height:.9;letter-spacing:-.065em;margin:18px 0}.summary{color:#8b94a5;line-height:1.65;font-size:12px}.specs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:20px 0}.specs div{padding:12px 8px;border:1px solid rgba(255,255,255,.07);border-radius:12px}.specs b{display:block;font-size:14px}.specs span{display:block;margin-top:4px;font-size:6px;color:#697284;letter-spacing:.1em;font-weight:900}.prices{padding:18px;border-radius:18px;background:#0b0d12;border:1px solid rgba(255,255,255,.08)}.prices>div{display:flex;justify-content:space-between;gap:12px;align-items:end;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}.prices span{font-size:7px;color:#70798a;font-weight:900;letter-spacing:.11em}.prices strong{font-size:20px;letter-spacing:-.03em}.prices small{display:block;margin-top:10px;color:#626b7c;font-size:8px;line-height:1.5}.ownership{display:grid;grid-template-columns:auto 1fr;gap:7px 10px;margin:16px 0;padding:14px;border:1px solid rgba(121,239,188,.12);border-radius:14px;background:rgba(121,239,188,.025)}.ownership b{font-size:7px;color:#9ee8cd;letter-spacing:.1em}.ownership span{font-size:8px;color:#7a8394}.status{font-size:9px;line-height:1.55;color:#9aa3b3;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:12px;margin:12px 0}.primary,.secondary,.recover,.testButton,.owned{box-sizing:border-box;width:100%;border:0;border-radius:13px;padding:14px 13px;margin-top:7px;font-size:8px;font-weight:950;letter-spacing:.09em;text-align:center;text-decoration:none;display:block}.primary{background:#fff;color:#06070a}.secondary{background:#6656df;color:#fff}.recover{background:transparent;color:#f2c77c;border:1px solid rgba(242,199,124,.22)}.testButton{background:rgba(121,239,188,.08);border:1px solid rgba(121,239,188,.18);color:#79efbc}.owned{background:rgba(121,239,188,.1);border:1px solid rgba(121,239,188,.2);color:#8cf2cf}.warning{font-size:8px;line-height:1.55;color:#6f7787;margin:12px 2px}.warning strong{color:#e5b66a}.rail{display:flex;gap:10px;overflow-x:auto;margin-top:18px;padding-bottom:8px}.rail>button{flex:0 0 210px;text-align:left;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:8px;opacity:.64}.rail>button.active{opacity:1;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.025)}.thumb{height:105px;border-radius:12px;display:flex;align-items:flex-end;padding:9px;box-sizing:border-box}.thumb span{font-size:6px;font-weight:950;letter-spacing:.1em;background:rgba(0,0,0,.5);padding:5px 7px;border-radius:999px}.rail strong{display:block;font-size:12px;margin:9px 5px 2px}.rail small{display:block;font-size:9px;color:#8d96a8;margin:0 5px 5px}footer{max-width:900px;margin-top:30px;border-top:1px solid rgba(255,255,255,.06);padding-top:18px}footer strong{font-size:8px;letter-spacing:.14em}footer p{color:#687183;font-size:8px;line-height:1.6}@media(max-width:900px){.layout{grid-template-columns:1fr}.viewer{min-height:480px}aside{padding:22px}.specs{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.page{padding:12px 10px 70px}.viewer{min-height:420px;border-radius:22px}aside{border-radius:22px;padding:18px}.viewerTag b{display:none}h1{font-size:48px}.rail>button{flex-basis:175px}}
    `}</style>
  </main>
}
