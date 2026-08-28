'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, getAddress } from 'ethers';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';

const CHAIN_ID = '0x14a34';
const RPC_URL = 'https://sepolia.base.org';
const EXPLORER = 'https://sepolia.basescan.org';
const ZERO = '0x0000000000000000000000000000000000000000';
const ABI = [
  'function MINT_PRICE() view returns (uint256)',
  'function MAX_PARCELS() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function parcelOwners() view returns (address[])',
  'function mintParcel(uint256 parcelId) payable',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : '—';
}

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}

function validAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
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

function LandScene({ owners, wallet, selected, onSelect }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (disposed || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(320, mount.clientWidth || 320);
      const height = Math.max(380, mount.clientHeight || 430);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x05060b, 16, 34);
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(10.5, 12.5, 13.5);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xbec8ff, 1.35));
      const key = new THREE.DirectionalLight(0xffffff, 2.3);
      key.position.set(7, 14, 9);
      scene.add(key);
      const rim = new THREE.PointLight(0x8f7cff, 16, 30);
      rim.position.set(-9, 7, -6);
      scene.add(rim);

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(13.6, 0.5, 13.6),
        new THREE.MeshStandardMaterial({ color: 0x090d1b, metalness: 0.2, roughness: 0.74 }),
      );
      base.position.y = -0.46;
      scene.add(base);

      const grid = new THREE.GridHelper(13.2, 8, 0x5046af, 0x1d2541);
      grid.position.y = -0.19;
      scene.add(grid);

      const parcels = [];
      const geometry = new THREE.BoxGeometry(1.35, 0.34, 1.35);
      for (let id = 0; id < 64; id++) {
        const owner = String(owners[id] || ZERO).toLowerCase();
        const ownedByYou = wallet && owner === String(wallet).toLowerCase();
        const minted = owner !== ZERO;
        const isSelected = id === selected;
        const material = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xdcd6ff : ownedByYou ? 0x74efba : minted ? 0x29304d : 0x6757df,
          emissive: isSelected ? 0x5143aa : ownedByYou ? 0x113c31 : minted ? 0x090d18 : 0x171039,
          emissiveIntensity: isSelected ? 0.7 : 0.35,
          metalness: isSelected ? 0.5 : 0.2,
          roughness: 0.55,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.parcelId = id;
        mesh.position.set((id % 8 - 3.5) * 1.6, isSelected ? 0.25 : 0, (Math.floor(id / 8) - 3.5) * 1.6);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        scene.add(mesh);
        parcels.push(mesh);
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let azimuth = 0.68;
      let elevation = 0.72;
      const radius = 19;

      function updateCamera() {
        const cosE = Math.cos(elevation);
        camera.position.set(
          Math.sin(azimuth) * cosE * radius,
          Math.sin(elevation) * radius,
          Math.cos(azimuth) * cosE * radius,
        );
        camera.lookAt(0, 0, 0);
      }
      updateCamera();

      function onDown(event) {
        dragging = true;
        moved = false;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      }
      function onMove(event) {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        lastX = event.clientX;
        lastY = event.clientY;
        azimuth -= dx * 0.008;
        elevation = Math.max(0.25, Math.min(1.15, elevation + dy * 0.005));
        updateCamera();
      }
      function onUp(event) {
        dragging = false;
        if (moved) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(parcels, false)[0];
        if (hit) onSelect(Number(hit.object.userData.parcelId));
      }
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);

      let frame;
      function animate() {
        frame = requestAnimationFrame(animate);
        parcels.forEach((mesh) => {
          if (mesh.userData.parcelId === selected) mesh.rotation.y += 0.005;
        });
        renderer.render(scene, camera);
      }
      animate();

      function resize() {
        if (!mountRef.current) return;
        const w = Math.max(320, mountRef.current.clientWidth || 320);
        const h = Math.max(380, mountRef.current.clientHeight || 430);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerup', onUp);
        geometry.dispose();
        parcels.forEach((mesh) => mesh.material.dispose());
        base.geometry.dispose();
        base.material.dispose();
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [owners, wallet, selected, onSelect]);

  return <div className="scene" ref={mountRef} />;
}

export default function TestLandPage() {
  const [contractAddress, setContractAddress] = useState('');
  const [owners, setOwners] = useState(Array(64).fill(ZERO));
  const [selected, setSelected] = useState(0);
  const [wallet, setWallet] = useState('');
  const [provider, setProvider] = useState(null);
  const [price, setPrice] = useState(100000000000000n);
  const [minted, setMinted] = useState(0);
  const [status, setStatus] = useState('Loading the Base Sepolia land grid…');
  const [busy, setBusy] = useState(false);

  const selectedOwner = String(owners[selected] || ZERO);
  const selectedMinted = selectedOwner.toLowerCase() !== ZERO;
  const selectedIsYours = wallet && selectedOwner.toLowerCase() === wallet.toLowerCase();
  const row = Math.floor(selected / 8);
  const column = selected % 8;
  const available = 64 - minted;

  const selectedLabel = useMemo(() => `TEST LAND #${selected} · R${row} C${column}`, [selected, row, column]);

  async function loadChain(address = contractAddress) {
    if (!validAddress(address)) {
      setStatus('Deploy or open a Test Land contract first. Nothing can be minted until a Base Sepolia contract is selected.');
      return;
    }
    setBusy(true);
    try {
      const readProvider = new JsonRpcProvider(RPC_URL, 84532, { staticNetwork: true });
      const land = new Contract(getAddress(address), ABI, readProvider);
      const [nextPrice, nextMinted, nextOwners] = await Promise.all([
        land.MINT_PRICE(),
        land.totalMinted(),
        land.parcelOwners(),
      ]);
      if (!Array.isArray(nextOwners) || nextOwners.length !== 64) throw new Error('This address is not a compatible 64-parcel Test Land contract.');
      setPrice(nextPrice);
      setMinted(Number(nextMinted));
      setOwners(nextOwners.map((value) => getAddress(value)));
      setStatus('Live Base Sepolia ownership loaded. Select any unminted parcel in the 3D grid.');
    } catch (error) {
      setOwners(Array(64).fill(ZERO));
      setMinted(0);
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('contract') || '';
    const stored = window.localStorage.getItem('vv-test-land-contract') || '';
    const address = validAddress(fromUrl) ? fromUrl : validAddress(stored) ? stored : '';
    const parcel = Number(params.get('parcel'));
    if (Number.isInteger(parcel) && parcel >= 0 && parcel < 64) setSelected(parcel);
    if (address) {
      const checksum = getAddress(address);
      setContractAddress(checksum);
      window.localStorage.setItem('vv-test-land-contract', checksum);
      loadChain(checksum);
    } else {
      setStatus('No Test Land deployment is selected yet. Deploy the reviewed Base Sepolia contract first.');
    }
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const injected = await discoverMetaMaskProvider();
      if (!injected) {
        window.location.href = getMetaMaskDeepLink(window.location.href);
        return;
      }
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      await ensureBaseSepolia(injected);
      const address = getAddress(accounts[0]);
      setProvider(injected);
      setWallet(address);
      setStatus('Wallet connected on Base Sepolia. Test ETH only; no real-property rights are involved.');
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function buySelected() {
    if (!validAddress(contractAddress)) {
      setStatus('Deploy the Test Land contract first.');
      return;
    }
    if (selectedMinted) {
      setStatus(selectedIsYours ? 'You already own this test parcel.' : 'That test parcel is already owned by another wallet.');
      return;
    }
    if (!provider || !wallet) {
      await connect();
      return;
    }
    setBusy(true);
    try {
      await ensureBaseSepolia(provider);
      const accounts = await provider.request({ method: 'eth_accounts' });
      const active = getAddress(accounts?.[0] || ZERO);
      if (active !== wallet) throw new Error('The active MetaMask wallet changed. Reconnect before minting.');

      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner(active);
      const land = new Contract(getAddress(contractAddress), ABI, signer);
      const currentOwner = await land.parcelOwner?.(selected).catch?.(() => null);
      if (currentOwner && String(currentOwner).toLowerCase() !== ZERO) throw new Error('This parcel was just minted. Pick another one.');

      setStatus(`MetaMask will show one Base Sepolia transaction for ${formatEther(price)} TEST ETH. Review it before approving.`);
      const tx = await land.mintParcel(selected, { value: price });
      setStatus(`Mint submitted: ${short(tx.hash)}. Waiting for Base Sepolia confirmation…`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The parcel mint did not succeed.');
      setStatus(`You now own ${selectedLabel} on Base Sepolia. This is a testnet digital collectible, not real land.`);
      await loadChain(contractAddress);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header>
        <Link href="/vault" className="back">‹ VAULT</Link>
        <div><small>BASE SEPOLIA · TESTNET</small><h1>Voxel Test Land</h1></div>
        <Link href="/vault/test-land/deploy" className="deploy">DEPLOY</Link>
      </header>

      <section className="hero">
        <div className="copy">
          <small>3D DIGITAL LAND LAB</small>
          <h2>Pick a parcel.<br/><em>Mint it tonight.</em></h2>
          <p>Explore a finite 8×8 world and mint one fictional parcel directly to your wallet using Base Sepolia test ETH.</p>
        </div>
        <div className="truth"><b>TESTNET ONLY</b><span>No deed. No physical land. No rent. No security or investment rights. Test ETH has no intended monetary value.</span></div>
      </section>

      <section className="world">
        <LandScene owners={owners} wallet={wallet} selected={selected} onSelect={setSelected} />
        <div className="hud"><span>DRAG TO ORBIT · TAP A PARCEL</span><b>{minted}/64 MINTED</b></div>
      </section>

      <section className="panel">
        <div className="parcelHead">
          <div><small>SELECTED PARCEL</small><h3>{selectedLabel}</h3></div>
          <span className={selectedMinted ? 'pill minted' : 'pill available'}>{selectedMinted ? 'MINTED' : 'AVAILABLE'}</span>
        </div>

        <div className="stats">
          <article><small>PRICE</small><b>{formatEther(price)} TEST ETH</b></article>
          <article><small>AVAILABLE</small><b>{available}/64</b></article>
          <article><small>OWNER</small><b>{selectedMinted ? short(selectedOwner) : 'UNCLAIMED'}</b></article>
        </div>

        {!validAddress(contractAddress) ? (
          <Link className="primary linkButton" href="/vault/test-land/deploy">DEPLOY TEST LAND FIRST →</Link>
        ) : !wallet ? (
          <button className="primary" disabled={busy} onClick={connect}>{busy ? 'CONNECTING…' : 'CONNECT METAMASK'}</button>
        ) : selectedMinted ? (
          <button className="primary disabled" disabled>{selectedIsYours ? '✓ YOU OWN THIS TEST PARCEL' : 'PARCEL ALREADY MINTED'}</button>
        ) : (
          <button className="primary" disabled={busy} onClick={buySelected}>{busy ? 'WAITING…' : `BUY TEST PARCEL · ${formatEther(price)} TEST ETH`}</button>
        )}

        <div className="walletRow"><span>WALLET</span><b>{wallet || 'Not connected'}</b>{wallet && <button onClick={connect}>RECONNECT</button>}</div>
        <div className="status">{status}</div>
        {validAddress(contractAddress) && <a className="explorer" href={`${EXPLORER}/address/${contractAddress}`} target="_blank" rel="noreferrer">VIEW TEST LAND CONTRACT ON BASESCAN ↗</a>}
      </section>

      <section className="legend">
        <span><i className="dot open"/>Available</span>
        <span><i className="dot yours"/>Yours</span>
        <span><i className="dot taken"/>Minted</span>
        <span><i className="dot selectedDot"/>Selected</span>
      </section>

      <footer><Link href="/vault">← BACK TO VAULT</Link><Link href="/vault/test-land/deploy">DEPLOY TEST CONTRACT →</Link></footer>

      <style jsx>{`
        .page{min-height:100vh;background:#05060b;color:#f7f8ff;padding:0 16px 36px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page>header{height:72px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}header>div{text-align:center}header small{font-size:7px;letter-spacing:.2em;color:#9b8dff}header h1{font-size:17px;margin:4px 0}.back,.deploy{color:#fff;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:.08em}.deploy{padding:8px 11px;border:1px solid rgba(255,255,255,.13);border-radius:999px}.hero{max-width:760px;margin:34px auto 18px}.copy small{font-size:8px;color:#9d8dff;letter-spacing:.18em;font-weight:900}.copy h2{font-size:42px;line-height:.98;margin:9px 0 13px;letter-spacing:-.045em}.copy h2 em{font-style:normal;color:#a99cff}.copy p{max-width:540px;color:#8c95a8;line-height:1.6;font-size:13px}.truth{margin-top:18px;padding:13px 14px;border-radius:15px;border:1px solid rgba(255,190,92,.24);background:rgba(255,169,59,.06);display:flex;gap:12px;align-items:flex-start}.truth b{font-size:8px;letter-spacing:.12em;color:#ffc66e;white-space:nowrap}.truth span{font-size:10px;line-height:1.5;color:#9ca5b8}.world{max-width:760px;height:480px;margin:auto;position:relative;border:1px solid rgba(255,255,255,.09);border-radius:26px;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(104,82,224,.18),transparent 42%),linear-gradient(160deg,#101426,#05060b 70%)}.world :global(.scene){position:absolute;inset:0;touch-action:none}.hud{position:absolute;left:16px;right:16px;bottom:14px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}.hud span,.hud b{font-size:8px;letter-spacing:.1em}.hud span{color:#8a93a6}.hud b{color:#d5d0ff}.panel{max-width:730px;margin:18px auto 0;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:rgba(255,255,255,.035)}.parcelHead{display:flex;justify-content:space-between;align-items:flex-start}.parcelHead small{font-size:7px;color:#7f899d;letter-spacing:.14em}.parcelHead h3{font-size:21px;margin:5px 0 0}.pill{font-size:7px;font-weight:900;letter-spacing:.12em;padding:7px 9px;border-radius:999px}.pill.available{color:#8dffd0;background:rgba(83,235,174,.09);border:1px solid rgba(83,235,174,.2)}.pill.minted{color:#b4bdd1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09)}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.stats article{padding:12px;border-radius:14px;background:#0a0d17;border:1px solid rgba(255,255,255,.06)}.stats small{display:block;font-size:7px;color:#6f788b;letter-spacing:.13em}.stats b{display:block;margin-top:6px;font-size:10px;word-break:break-all}.primary{width:100%;border:0;border-radius:14px;padding:14px;background:#fff;color:#05060b;font-weight:900;font-size:11px;letter-spacing:.03em}.primary.disabled{background:#242938;color:#778096}.linkButton{display:block;text-align:center;text-decoration:none;box-sizing:border-box}.walletRow{margin-top:12px;display:flex;gap:8px;align-items:center;font-size:8px;color:#697386}.walletRow b{flex:1;color:#aab2c4;overflow:hidden;text-overflow:ellipsis}.walletRow button{background:none;border:0;color:#9c8cff;font-size:8px;font-weight:900}.status{margin-top:12px;color:#8e98aa;font-size:10px;line-height:1.5;padding:10px 11px;border-radius:12px;background:#090c14}.explorer{display:block;margin-top:10px;color:#a99cff;text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.06em}.legend{max-width:730px;margin:14px auto;display:flex;flex-wrap:wrap;gap:14px;color:#727c90;font-size:8px}.legend span{display:flex;gap:5px;align-items:center}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.open{background:#6757df}.yours{background:#74efba}.taken{background:#29304d}.selectedDot{background:#dcd6ff}.page>footer{max-width:730px;margin:20px auto 0;display:flex;justify-content:space-between}.page>footer a{color:#737d91;text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.08em}@media(min-width:760px){.page{padding-left:26px;padding-right:26px}.copy h2{font-size:62px}.world{height:560px}.panel{padding:20px}.stats article{padding:15px}}
      `}</style>
    </main>
  );
}
