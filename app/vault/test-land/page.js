'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, getAddress } from 'ethers';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';

const CHAIN_ID = '0x14a34';
const RPC_URL = 'https://sepolia.base.org';
const EXPLORER = 'https://sepolia.basescan.org';
const ZERO = '0x0000000000000000000000000000000000000000';
const ABI = [
  'function MINT_PRICE() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function parcelOwners() view returns (address[])',
  'function parcelOwner(uint256 parcelId) view returns (address)',
  'function mintParcel(uint256 parcelId) payable',
];

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : '—';
}

function validAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
}

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}

async function ensureBaseSepolia(injected) {
  let chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId === CHAIN_ID) return;
  try {
    await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
  } catch (error) {
    if (error?.code === 4001) throw new Error('Base Sepolia network switch was cancelled.');
    if (error?.code !== 4902) throw error;
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN_ID,
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER],
      }],
    });
  }
  chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId !== CHAIN_ID) throw new Error('Switch MetaMask to Base Sepolia before continuing.');
}

function ParcelWorld({ owners, wallet, selected, onSelect }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let dead = false;
    let dispose = () => {};
    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(300, mount.clientWidth || 300);
      const height = Math.max(430, mount.clientHeight || 430);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x05060b, 16, 31);
      scene.add(new THREE.AmbientLight(0xc6ceff, 1.45));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(8, 15, 9);
      scene.add(sun);

      const camera = new THREE.PerspectiveCamera(43, width / height, 0.1, 100);
      let azimuth = 0.72;
      let elevation = 0.68;
      const radius = 19;
      function updateCamera() {
        const ce = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * ce * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * ce * radius);
        camera.lookAt(0, 0, 0);
      }
      updateCamera();

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(13.8, 0.55, 13.8),
        new THREE.MeshStandardMaterial({ color: 0x090d19, roughness: 0.76, metalness: 0.2 }),
      );
      base.position.y = -0.48;
      scene.add(base);
      const grid = new THREE.GridHelper(13.2, 8, 0x6656d9, 0x242b45);
      grid.position.y = -0.19;
      scene.add(grid);

      const geometry = new THREE.BoxGeometry(1.34, 0.34, 1.34);
      const meshes = [];
      for (let id = 0; id < 64; id += 1) {
        const owner = String(owners[id] || ZERO).toLowerCase();
        const yours = Boolean(wallet) && owner === String(wallet).toLowerCase();
        const taken = owner !== ZERO;
        const active = id === selected;
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: active ? 0xe5e0ff : yours ? 0x63eab2 : taken ? 0x303750 : 0x6d5dfc,
            emissive: active ? 0x5245a9 : yours ? 0x12362c : taken ? 0x080b15 : 0x17103d,
            emissiveIntensity: active ? 0.75 : 0.35,
            roughness: 0.54,
            metalness: active ? 0.45 : 0.2,
          }),
        );
        mesh.userData.parcelId = id;
        mesh.position.set((id % 8 - 3.5) * 1.6, active ? 0.26 : 0, (Math.floor(id / 8) - 3.5) * 1.6);
        scene.add(mesh);
        meshes.push(mesh);
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      function down(event) {
        dragging = true;
        moved = false;
        lastX = event.clientX;
        lastY = event.clientY;
      }
      function move(event) {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        lastX = event.clientX;
        lastY = event.clientY;
        azimuth -= dx * 0.008;
        elevation = Math.max(0.25, Math.min(1.12, elevation + dy * 0.005));
        updateCamera();
      }
      function up(event) {
        dragging = false;
        if (moved) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (hit) onSelect(Number(hit.object.userData.parcelId));
      }
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);

      let frame = 0;
      function animate() {
        frame = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();

      dispose = () => {
        cancelAnimationFrame(frame);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        meshes.forEach((mesh) => mesh.material.dispose());
        geometry.dispose();
        base.geometry.dispose();
        base.material.dispose();
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    });
    return () => { dead = true; dispose(); };
  }, [owners, wallet, selected, onSelect]);

  return <div ref={mountRef} className="scene" />;
}

export default function TestLandPage() {
  const [contractAddress, setContractAddress] = useState('');
  const [owners, setOwners] = useState(Array(64).fill(ZERO));
  const [selected, setSelected] = useState(0);
  const [wallet, setWallet] = useState('');
  const [injected, setInjected] = useState(null);
  const [price, setPrice] = useState(100000000000000n);
  const [minted, setMinted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Choose a Test Land deployment to begin.');

  const owner = String(owners[selected] || ZERO);
  const taken = owner.toLowerCase() !== ZERO;
  const yours = Boolean(wallet) && owner.toLowerCase() === wallet.toLowerCase();
  const row = Math.floor(selected / 8);
  const column = selected % 8;

  async function refresh(address = contractAddress) {
    if (!validAddress(address)) return;
    setBusy(true);
    try {
      const provider = new JsonRpcProvider(RPC_URL, 84532, { staticNetwork: true });
      const land = new Contract(getAddress(address), ABI, provider);
      const [nextPrice, nextMinted, nextOwners] = await Promise.all([land.MINT_PRICE(), land.totalMinted(), land.parcelOwners()]);
      if (!Array.isArray(nextOwners) || nextOwners.length !== 64) throw new Error('This is not a compatible Voxel Test Land contract.');
      setPrice(nextPrice);
      setMinted(Number(nextMinted));
      setOwners(nextOwners.map((value) => getAddress(value)));
      setStatus('Live Base Sepolia ownership loaded. Drag to orbit and tap an available parcel.');
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('contract') || '';
    const fromStorage = window.localStorage.getItem('vv-test-land-contract') || '';
    const next = validAddress(fromUrl) ? fromUrl : validAddress(fromStorage) ? fromStorage : '';
    const parcel = Number(params.get('parcel'));
    if (Number.isInteger(parcel) && parcel >= 0 && parcel < 64) setSelected(parcel);
    if (next) {
      const address = getAddress(next);
      setContractAddress(address);
      window.localStorage.setItem('vv-test-land-contract', address);
      refresh(address);
    }
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const provider = await discoverMetaMaskProvider();
      if (!provider) {
        window.location.href = getMetaMaskDeepLink(window.location.href);
        return;
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      await ensureBaseSepolia(provider);
      setInjected(provider);
      setWallet(getAddress(accounts[0]));
      setStatus('MetaMask connected on Base Sepolia. Only test ETH will be used.');
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!validAddress(contractAddress)) {
      setStatus('Deploy the reviewed Test Land contract first.');
      return;
    }
    if (taken) {
      setStatus(yours ? 'You already own this test parcel.' : 'That test parcel is already minted. Pick another.');
      return;
    }
    if (!injected || !wallet) {
      await connect();
      return;
    }
    setBusy(true);
    try {
      await ensureBaseSepolia(injected);
      const browserProvider = new BrowserProvider(injected);
      const signer = await browserProvider.getSigner();
      const active = getAddress(await signer.getAddress());
      if (active !== wallet) throw new Error('The active wallet changed. Reconnect before minting.');
      const land = new Contract(getAddress(contractAddress), ABI, signer);
      const latestOwner = await land.parcelOwner(selected);
      if (String(latestOwner).toLowerCase() !== ZERO) throw new Error('That parcel was just minted. Pick another.');
      setStatus(`MetaMask will show one Base Sepolia mint for ${formatEther(price)} TEST ETH. Review it before approving.`);
      const tx = await land.mintParcel(selected, { value: price });
      setStatus(`Submitted ${short(tx.hash)}. Waiting for Base Sepolia…`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The test parcel mint did not succeed.');
      await refresh(contractAddress);
      setStatus(`You now own Test Land #${selected} on Base Sepolia. It is a digital test collectible, not real land.`);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="page">
    <header><Link href="/vault">‹ VAULT</Link><div><small>BASE SEPOLIA · TESTNET</small><h1>Voxel Test Land</h1></div><Link href="/vault/test-land/deploy">DEPLOY</Link></header>

    <section className="hero"><small>3D DIGITAL LAND LAB</small><h2>Pick a parcel.<br/><em>Mint it tonight.</em></h2><p>64 finite fictional parcels. Mint one directly to your wallet using Base Sepolia test ETH.</p><div className="warning"><b>TESTNET ONLY</b><span>No deed, physical land, rent, security, or investment rights. Test ETH has no intended monetary value.</span></div></section>

    <section className="world"><ParcelWorld owners={owners} wallet={wallet} selected={selected} onSelect={setSelected}/><div className="hud"><span>DRAG TO ORBIT · TAP TO SELECT</span><b>{minted}/64 MINTED</b></div></section>

    <section className="panel">
      <div className="top"><div><small>SELECTED</small><h3>TEST LAND #{selected} · R{row} C{column}</h3></div><span className={taken ? 'pill taken' : 'pill open'}>{taken ? 'MINTED' : 'AVAILABLE'}</span></div>
      <div className="stats"><article><small>PRICE</small><b>{formatEther(price)} TEST ETH</b></article><article><small>OWNER</small><b>{taken ? short(owner) : 'UNCLAIMED'}</b></article><article><small>LEFT</small><b>{64 - minted}/64</b></article></div>
      {!validAddress(contractAddress) ? <Link className="primary link" href="/vault/test-land/deploy">DEPLOY TEST CONTRACT FIRST →</Link> : !wallet ? <button className="primary" disabled={busy} onClick={connect}>{busy ? 'CONNECTING…' : 'CONNECT METAMASK'}</button> : taken ? <button className="primary off" disabled>{yours ? '✓ YOU OWN THIS PARCEL' : 'PARCEL ALREADY MINTED'}</button> : <button className="primary" disabled={busy} onClick={buy}>{busy ? 'WAITING…' : `BUY TEST PARCEL · ${formatEther(price)} TEST ETH`}</button>}
      <div className="status">{status}</div>
      {validAddress(contractAddress) ? <a className="scan" href={`${EXPLORER}/address/${contractAddress}`} target="_blank" rel="noreferrer">VIEW CONTRACT ON BASESCAN ↗</a> : null}
    </section>

    <footer><Link href="/vault">← BACK TO VAULT</Link><Link href="/vault/test-land/deploy">DEPLOY TEST LAND →</Link></footer>

    <style jsx>{`
      .page{min-height:100vh;background:#05060b;color:#f7f8ff;padding:0 16px 34px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page>header{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}header a{color:#fff;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:.08em}header div{text-align:center}header small{font-size:7px;letter-spacing:.2em;color:#9f91ff}header h1{font-size:17px;margin:4px 0}.hero{max-width:760px;margin:34px auto 18px}.hero>small{font-size:8px;color:#a99cff;letter-spacing:.18em;font-weight:900}.hero h2{font-size:43px;line-height:.96;letter-spacing:-.05em;margin:10px 0 13px}.hero h2 em{font-style:normal;color:#aa9cff}.hero p{max-width:560px;color:#8993a6;line-height:1.6;font-size:13px}.warning{margin-top:17px;padding:13px 14px;border-radius:15px;border:1px solid rgba(255,190,92,.24);background:rgba(255,169,59,.06);display:flex;gap:11px}.warning b{font-size:8px;color:#ffc873;white-space:nowrap}.warning span{font-size:10px;color:#99a3b6;line-height:1.5}.world{max-width:760px;height:500px;margin:auto;position:relative;overflow:hidden;border-radius:25px;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 50% 40%,rgba(103,85,220,.18),transparent 43%),#070912}.world :global(.scene){position:absolute;inset:0;touch-action:none}.hud{position:absolute;left:15px;right:15px;bottom:13px;display:flex;justify-content:space-between;pointer-events:none;font-size:8px;letter-spacing:.1em;color:#80899c}.hud b{color:#d5d0ff}.panel{max-width:730px;margin:17px auto 0;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(255,255,255,.035)}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.top small,.stats small{display:block;font-size:7px;color:#737d91;letter-spacing:.13em}.top h3{font-size:20px;margin:5px 0}.pill{font-size:7px;font-weight:900;letter-spacing:.1em;padding:7px 9px;border-radius:999px}.pill.open{color:#8fffd1;border:1px solid rgba(96,236,182,.23);background:rgba(96,236,182,.07)}.pill.taken{color:#a8b0c1;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.stats article{padding:11px;border-radius:13px;background:#0a0d16;border:1px solid rgba(255,255,255,.05)}.stats b{display:block;margin-top:6px;font-size:10px;overflow:hidden;text-overflow:ellipsis}.primary{width:100%;border:0;border-radius:14px;padding:14px;background:#fff;color:#05060b;font-weight:900;font-size:11px}.primary.off{background:#222735;color:#727b8e}.link{display:block;text-align:center;text-decoration:none;box-sizing:border-box}.status{margin-top:11px;padding:10px 11px;border-radius:12px;background:#090c14;color:#8f99ab;font-size:10px;line-height:1.5}.scan{display:block;margin-top:10px;color:#aa9cff;text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.06em}.page>footer{max-width:730px;margin:20px auto 0;display:flex;justify-content:space-between}.page>footer a{color:#6f798c;text-decoration:none;font-size:8px;font-weight:900}@media(min-width:760px){.hero h2{font-size:62px}.world{height:580px}.panel{padding:20px}}
    `}</style>
  </main>;
}
