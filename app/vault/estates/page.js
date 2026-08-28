'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatUnits, getAddress } from 'ethers';
import { DIGITAL_ESTATE_DISCLOSURE, DIGITAL_ESTATES, formatUsdCents, getDigitalEstate } from '../../../lib/digital-estates';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';
import { mintVoxelFlip } from '../../../lib/voxelflip';

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
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: BASE_CHAIN_ID,
        chainName: 'Base',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [BASE_RPC],
        blockExplorerUrls: [BASE_EXPLORER],
      }],
    });
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
      const height = Math.max(420, mount.clientHeight || 520);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07080d, 20, 42);
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      const world = new THREE.Group();
      scene.add(world);

      const hemi = new THREE.HemisphereLight(0xe8edff, 0x171b24, 1.9);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(9, 14, 11);
      scene.add(key);
      const accent = new THREE.PointLight(new THREE.Color(estate.accent), 28, 32);
      accent.position.set(-8, 6, -6);
      scene.add(accent);

      const disposable = [];
      function material(options) {
        const m = new THREE.MeshStandardMaterial(options);
        disposable.push(m);
        return m;
      }
      function box(w, h, d, color, x, y, z, options = {}) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, material({ color, metalness: options.metalness ?? 0.08, roughness: options.roughness ?? 0.62, transparent: Boolean(options.transparent), opacity: options.opacity ?? 1, emissive: options.emissive || 0x000000, emissiveIntensity: options.emissiveIntensity || 0 }));
        mesh.position.set(x, y, z);
        world.add(mesh);
        disposable.push(geometry);
        return mesh;
      }
      function cylinder(r, h, color, x, y, z) {
        const geometry = new THREE.CylinderGeometry(r, r * 1.12, h, 8);
        const mesh = new THREE.Mesh(geometry, material({ color, roughness: 0.8 }));
        mesh.position.set(x, y, z);
        world.add(mesh);
        disposable.push(geometry);
        return mesh;
      }

      box(17, 0.6, 15, estate.terrain, 0, -0.55, 0, { roughness: 0.94 });
      box(13.6, 0.18, 11.4, 0x121620, 0, -0.17, 0, { roughness: 0.9 });

      const structure = new THREE.Color(estate.structure);
      const roof = new THREE.Color(estate.roof);
      const glow = new THREE.Color(estate.accent);
      const glassMat = material({ color: glow, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.58, emissive: glow, emissiveIntensity: 0.23 });
      const glassGeometries = [];
      function glass(w, h, d, x, y, z) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, glassMat);
        mesh.position.set(x, y, z);
        world.add(mesh);
        glassGeometries.push(geometry);
        return mesh;
      }

      if (estate.architecture === 'courtyard') {
        box(5.2, 2.7, 3.3, structure, -3.5, 1.2, -1.8);
        box(4.2, 2.7, 3.3, structure, 3.9, 1.2, -1.8);
        box(3.1, 2.7, 4.4, structure, 0.2, 1.2, 2.2);
        box(5.5, 0.28, 3.6, roof, -3.5, 2.7, -1.8);
        box(4.5, 0.28, 3.6, roof, 3.9, 2.7, -1.8);
        glass(2.6, 1.8, 0.08, 0.2, 1.3, 0.0);
        box(3.7, 0.16, 2.2, 0x26342e, 0.2, -0.02, -0.4);
      } else if (estate.architecture === 'glass') {
        box(10.8, 2.6, 4.2, structure, 0, 1.18, 0);
        box(12.2, 0.32, 5.4, roof, 0, 2.7, 0);
        glass(9.2, 1.8, 0.1, 0, 1.25, 2.12);
        glass(0.1, 1.8, 3.1, 5.42, 1.25, 0);
        box(5.4, 0.22, 2.5, 0x23505d, 1.7, -0.02, 4.2, { metalness: 0.25, roughness: 0.2 });
      } else if (estate.architecture === 'waterfront') {
        box(8.8, 2.7, 4.8, structure, -1.1, 1.22, 0.4);
        box(6.2, 2.5, 3.8, structure, 2.2, 3.68, -0.2);
        box(9.3, 0.3, 5.1, roof, -1.1, 2.72, 0.4);
        box(6.6, 0.3, 4.2, roof, 2.2, 5.08, -0.2);
        glass(4.8, 1.85, 0.08, -1.6, 1.3, 2.83);
        glass(3.9, 1.65, 0.08, 2.2, 3.72, 1.72);
        box(10.5, 0.2, 2.2, 0x274b5e, 0.3, -0.06, 4.8, { roughness: 0.24 });
        box(7.2, 0.18, 1.2, 0x5f5146, -0.3, 0.02, 6.5);
      } else if (estate.architecture === 'villa') {
        box(4.7, 3.0, 5.2, structure, -4.0, 1.35, 0);
        box(4.7, 3.0, 5.2, structure, 4.0, 1.35, 0);
        box(4.6, 2.6, 3.8, structure, 0, 3.95, -1.1);
        box(5.1, 0.34, 5.6, roof, -4.0, 3.0, 0);
        box(5.1, 0.34, 5.6, roof, 4.0, 3.0, 0);
        box(5.0, 0.34, 4.2, roof, 0, 5.42, -1.1);
        glass(3.4, 1.7, 0.08, 0, 3.95, 0.84);
        box(4.4, 0.2, 3.0, 0x245866, 0, -0.04, 3.6, { roughness: 0.18 });
      } else {
        box(8.2, 2.5, 4.3, structure, -1.2, 1.15, 0.7);
        box(7.1, 2.4, 3.8, structure, 1.3, 3.55, -0.2);
        box(6.0, 2.2, 3.2, structure, -0.9, 5.82, -0.7);
        box(8.7, 0.3, 4.7, roof, -1.2, 2.58, 0.7);
        box(7.6, 0.3, 4.2, roof, 1.3, 4.92, -0.2);
        box(6.4, 0.3, 3.6, roof, -0.9, 7.1, -0.7);
        glass(4.8, 1.55, 0.08, -1.2, 1.2, 2.88);
        glass(4.3, 1.45, 0.08, 1.3, 3.58, 1.74);
        glass(3.8, 1.35, 0.08, -0.9, 5.85, 0.94);
        box(5.2, 0.16, 2.2, 0x263b38, -0.9, 7.35, -0.7);
      }

      for (let i = 0; i < 9; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (6.3 + (i % 3) * 0.55);
        const z = -5 + (i * 1.33) % 10;
        cylinder(0.18, 1.4 + (i % 2) * 0.5, 0x6f5947, x, 0.55, z);
        const crownGeometry = new THREE.SphereGeometry(0.7 + (i % 3) * 0.08, 8, 6);
        const crown = new THREE.Mesh(crownGeometry, material({ color: 0x31543c, roughness: 0.95 }));
        crown.position.set(x, 1.5 + (i % 2) * 0.45, z);
        world.add(crown);
        disposable.push(crownGeometry);
      }

      const ringGeometry = new THREE.RingGeometry(6.9, 7.05, 64);
      const ring = new THREE.Mesh(ringGeometry, material({ color: glow, emissive: glow, emissiveIntensity: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.22;
      world.add(ring);
      disposable.push(ringGeometry);

      let azimuth = 0.7;
      let elevation = 0.52;
      let radius = estate.architecture === 'sky-villa' ? 24 : 21;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      function updateCamera() {
        const cosE = Math.cos(elevation);
        camera.position.set(Math.sin(azimuth) * cosE * radius, Math.sin(elevation) * radius, Math.cos(azimuth) * cosE * radius);
        camera.lookAt(0, estate.architecture === 'sky-villa' ? 2.0 : 1.3, 0);
      }
      updateCamera();
      function down(event) { dragging = true; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture?.(event.pointerId); }
      function move(event) {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        azimuth -= dx * 0.008;
        elevation = Math.max(0.22, Math.min(1.02, elevation + dy * 0.005));
        updateCamera();
      }
      function up() { dragging = false; }
      function wheel(event) { radius = Math.max(15, Math.min(29, radius + Math.sign(event.deltaY) * 1.2)); updateCamera(); }
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: true });

      let frame;
      let t = 0;
      function animate() {
        frame = requestAnimationFrame(animate);
        t += 0.01;
        accent.intensity = 25 + Math.sin(t) * 4;
        ring.material.opacity = 0.42 + Math.sin(t * 0.7) * 0.08;
        renderer.render(scene, camera);
      }
      animate();

      function resize() {
        if (!mountRef.current) return;
        const w = Math.max(320, mountRef.current.clientWidth || 320);
        const h = Math.max(420, mountRef.current.clientHeight || 520);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('pointerdown', down);
        renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up);
        renderer.domElement.removeEventListener('wheel', wheel);
        glassGeometries.forEach((geometry) => geometry.dispose());
        disposable.forEach((item) => item?.dispose?.());
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    });

    return () => { disposed = true; cleanup(); };
  }, [estate]);

  return <div className="estateScene" ref={mountRef} aria-label={`Interactive 3D model of ${estate.name}`} />;
}

export default function DigitalEstatesPage() {
  const [selectedId, setSelectedId] = useState(DIGITAL_ESTATES[2].id);
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [wallet, setWallet] = useState('');
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('Explore the collection. Sign in and connect a wallet only when you are ready to reserve an estate.');
  const [mintResult, setMintResult] = useState(null);
  const clientRef = useRef(null);

  const estate = useMemo(() => getDigitalEstate(selectedId) || DIGITAL_ESTATES[0], [selectedId]);
  const price = formatUsdCents(estate.purchasePriceCents);
  const recoveryTx = typeof window !== 'undefined' ? window.localStorage.getItem(`vv-digital-estate-usdc:${estate.id}`) || '' : '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = getDigitalEstate(params.get('estate'));
    if (requested) setSelectedId(requested.id);
    if (params.get('checkout') === 'cancelled') setStatus('Checkout was cancelled. No ownership changed. Your temporary reservation will expire automatically.');

    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setStatus(error.message);
      } else {
        setSession(data.session);
        setAuthState(data.session?.user ? 'signed-in' : 'signed-out');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next);
        setAuthState(next?.user ? 'signed-in' : 'signed-out');
      });
      subscription = auth.data.subscription;
      if (params.get('auth') === 'google') {
        params.delete('auth');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }).catch((error) => {
      if (!active) return;
      setAuthState('error');
      setStatus(errorText(error));
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  function selectEstate(id) {
    setSelectedId(id);
    setMintResult(null);
    const url = new URL(window.location.href);
    url.searchParams.set('estate', id);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
    setStatus('Estate selected. Rotate the 3D model, review the price and rights disclosure, then choose a payment rail.');
  }

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl(estate.id) } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setStatus(errorText(error));
    }
  }

  async function connectWallet({ requireBase = false } = {}) {
    setBusy('wallet');
    try {
      const injected = provider || await discoverMetaMaskProvider();
      if (!injected) {
        window.location.href = getMetaMaskDeepLink(window.location.href);
        return null;
      }
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      if (requireBase) await ensureBase(injected);
      const address = getAddress(accounts[0]);
      setProvider(injected);
      setWallet(address);
      setStatus(`${short(address)} connected${requireBase ? ' on Base' : ''}. No payment has been sent.`);
      return { provider: injected, wallet: address };
    } catch (error) {
      setStatus(errorText(error));
      return null;
    } finally {
      setBusy('');
    }
  }

  async function startHostedCheckout() {
    if (!session?.access_token) { await signIn(); return; }
    let activeWallet = wallet;
    if (!activeWallet) {
      const connected = await connectWallet();
      activeWallet = connected?.wallet || '';
      if (!activeWallet) return;
    }
    setBusy('checkout');
    setStatus(`Reserving ${estate.name} and asking the payment provider for eligible payment methods…`);
    try {
      const response = await fetch('/api/digital-estates/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ estateId: estate.id, wallet: activeWallet }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout could not be created.');
      window.location.href = data.url;
    } catch (error) {
      setStatus(errorText(error));
      setBusy('');
    }
  }

  async function claimAndMintUsdc(txHash, activeWallet, injected) {
    setStatus('USDC transfer confirmed. Voxel Vault is independently verifying the exact Base transaction before issuing the NFT voucher…');
    const response = await fetch('/api/digital-estates/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ source: 'base-usdc', estateId: estate.id, wallet: activeWallet, txHash }),
    });
    const claim = await response.json().catch(() => ({}));
    if (!response.ok || !claim?.ready) throw new Error(claim?.error || 'USDC payment could not be verified for minting.');

    setStatus('Payment verified. MetaMask will open a second transaction to mint the unique estate NFT on Base. Review the gas before approving.');
    setProvider(injected);
    setWallet(activeWallet);
    const minted = await mintVoxelFlip({ metadataUrl: claim.metadataUrl, voucherId: claim.voucherId, signature: claim.signature });
    setMintResult(minted);
    window.localStorage.removeItem(`vv-digital-estate-usdc:${estate.id}`);
    window.localStorage.setItem(`vv-digital-estate-mint:${estate.id}`, JSON.stringify(minted));
    window.dispatchEvent(new CustomEvent('voxel-vault:transaction-confirmed', { detail: minted }));
    setStatus(`${estate.name} is minted to ${short(activeWallet)} on Base. It is a digital-only NFT estate; no physical property rights were created.`);
  }

  async function payUsdc() {
    if (!session?.access_token) { await signIn(); return; }
    const connected = await connectWallet({ requireBase: true });
    if (!connected) return;
    const injected = connected.provider;
    const activeWallet = connected.wallet;
    setBusy('usdc');
    try {
      const preflightResponse = await fetch('/api/digital-estates/crypto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ estateId: estate.id, wallet: activeWallet }),
      });
      const config = await preflightResponse.json().catch(() => ({}));
      if (!preflightResponse.ok || !config?.ready) throw new Error(config?.error || 'USDC payment is not ready.');
      if (config.wallet !== activeWallet || config.chainId !== 8453) throw new Error('USDC preflight returned an unexpected wallet or network.');

      const browserProvider = new BrowserProvider(injected);
      const signer = await browserProvider.getSigner(activeWallet);
      const usdc = new Contract(getAddress(config.usdcAddress), USDC_ABI, signer);
      const balance = await usdc.balanceOf(activeWallet);
      const amount = BigInt(config.amountUsdcUnits);
      if (balance < amount) throw new Error(`This wallet has ${Number(formatUnits(balance, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC, but ${Number(formatUnits(amount, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC is required.`);

      setStatus(`MetaMask will show a REAL ${Number(config.amountUsd).toLocaleString('en-US')} USDC payment on Base to ${short(config.recipient)}. This buys only the digital NFT estate.`);
      const tx = await usdc.transfer(getAddress(config.recipient), amount);
      window.localStorage.setItem(`vv-digital-estate-usdc:${estate.id}`, tx.hash);
      setStatus(`USDC payment submitted: ${short(tx.hash)}. Waiting for Base confirmation…`);
      const receipt = await tx.wait();
      if (!receipt || Number(receipt.status) !== 1) throw new Error('The USDC transfer did not succeed.');
      await claimAndMintUsdc(tx.hash, activeWallet, injected);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function recoverUsdc() {
    if (!recoveryTx) return;
    if (!session?.access_token) { await signIn(); return; }
    const connected = await connectWallet({ requireBase: true });
    if (!connected) return;
    setBusy('recover');
    try { await claimAndMintUsdc(recoveryTx, connected.wallet, connected.provider); }
    catch (error) { setStatus(errorText(error)); }
    finally { setBusy(''); }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link href="/vault" className="brand">VOXEL VAULT</Link>
        <div className="mode"><span /> DIGITAL ESTATES</div>
        <div className="topActions">
          {wallet ? <button className="ghost" onClick={() => connectWallet()}>{short(wallet)}</button> : <button className="ghost" onClick={() => connectWallet()} disabled={Boolean(busy)}>CONNECT WALLET</button>}
          {authState === 'signed-in' ? <span className="signed">SIGNED IN</span> : <button className="ghost" onClick={signIn} disabled={Boolean(busy)}>SIGN IN</button>}
        </div>
      </header>

      <section className="hero">
        <div className="sceneWrap">
          <EstateScene estate={estate} />
          <div className="sceneBadge">DRAG TO ORBIT · SCROLL TO ZOOM</div>
          <div className="chainBadge">UNIQUE NFT · BASE</div>
        </div>

        <aside className="details">
          <div className="eyebrow">{estate.locationLabel}</div>
          <h1>{estate.name}</h1>
          <p className="summary">{estate.summary}</p>
          <div className="specs">
            <div><strong>{estate.beds}</strong><span>BEDS</span></div>
            <div><strong>{estate.baths}</strong><span>BATHS</span></div>
            <div><strong>{estate.sqft.toLocaleString()}</strong><span>SQ FT</span></div>
            <div><strong>{estate.lotSqft.toLocaleString()}</strong><span>LOT SQ FT</span></div>
          </div>

          <div className="pricePanel">
            <div><span>REAL-WORLD REFERENCE</span><strong>{price}</strong></div>
            <div className="divider" />
            <div><span>DIGITAL ESTATE LIST PRICE</span><strong>{price}</strong></div>
            <small>Same nominal price by design. The reference is a creative model-pricing reference, not a physical-property appraisal.</small>
          </div>

          <div className="payGrid">
            <button className="primary" onClick={startHostedCheckout} disabled={Boolean(busy)}>
              <span>{busy === 'checkout' ? 'OPENING CHECKOUT…' : 'PAY SECURELY'}</span>
              <small>Card · Apple Pay · Google Pay · Link · bank/wallet methods when eligible</small>
            </button>
            <button className="crypto" onClick={payUsdc} disabled={Boolean(busy)}>
              <span>{busy === 'usdc' ? 'VERIFYING BASE…' : 'PAY USDC ON BASE'}</span>
              <small>Direct wallet payment · exact digital list price</small>
            </button>
          </div>
          {recoveryTx ? <button className="recover" onClick={recoverUsdc} disabled={Boolean(busy)}>RECOVER CONFIRMED USDC PAYMENT · {short(recoveryTx)}</button> : null}

          <div className="status">{status}</div>
          {mintResult?.hash ? <a className="minted" href={mintResult.explorerUrl} target="_blank" rel="noreferrer">VIEW MINT ON BASE ↗</a> : null}
          <div className="disclosure"><strong>DIGITAL-ONLY ASSET</strong>{DIGITAL_ESTATE_DISCLOSURE}</div>
        </aside>
      </section>

      <section className="collection">
        <div className="sectionTitle"><div><small>THE FIRST DISTRICT</small><h2>Choose your estate.</h2></div><span>{DIGITAL_ESTATES.length} UNIQUE MODELS</span></div>
        <div className="cards">
          {DIGITAL_ESTATES.map((item) => (
            <button key={item.id} className={`card ${item.id === estate.id ? 'active' : ''}`} onClick={() => selectEstate(item.id)}>
              <div className="mini" style={{ '--accent': item.accent, '--terrain': item.terrain, '--structure': item.structure }}>
                <div className="miniHouse"><i /><i /><i /></div>
              </div>
              <div className="cardCopy"><small>{item.locationLabel}</small><strong>{item.name}</strong><span>{item.beds} bd · {item.baths} ba · {item.sqft.toLocaleString()} sq ft</span><b>{formatUsdCents(item.purchasePriceCents)}</b></div>
            </button>
          ))}
        </div>
      </section>

      <section className="truth">
        <div><small>WHAT YOU BUY</small><h3>A unique blockchain estate.</h3><p>After verified payment, Voxel Vault issues a one-use mint voucher bound to your wallet. You approve the Base transaction and the NFT enters your wallet.</p></div>
        <div><small>WHAT YOU DO NOT BUY</small><h3>No deed hidden in the fine print.</h3><p>No physical parcel, title, tenancy, rental income, security, appraisal, mortgage, or legal claim on a real building is included in this digital phase.</p></div>
      </section>

      <style jsx>{`
        :global(body){margin:0;background:#05060a;color:#f5f7fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;background:radial-gradient(circle at 12% 12%,rgba(103,87,223,.12),transparent 28%),radial-gradient(circle at 88% 30%,rgba(70,220,180,.06),transparent 24%),#05060a}.topbar{min-height:72px;padding:0 4vw;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:18px;position:relative;z-index:4;background:rgba(5,6,10,.72);backdrop-filter:blur(18px)}.brand{color:white;text-decoration:none;font-size:13px;font-weight:950;letter-spacing:.15em}.mode{font-size:10px;letter-spacing:.2em;color:#929aab;font-weight:900;display:flex;align-items:center;gap:9px}.mode span{width:7px;height:7px;border-radius:50%;background:#76efbc;box-shadow:0 0 18px #76efbc}.topActions{display:flex;align-items:center;gap:8px}.ghost{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);color:white;border-radius:999px;padding:10px 14px;font-size:9px;font-weight:900;letter-spacing:.08em}.signed{font-size:9px;font-weight:900;color:#76efbc;letter-spacing:.1em}.hero{max-width:1480px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(360px,.72fr);min-height:720px}.sceneWrap{min-height:720px;position:relative;overflow:hidden;border-right:1px solid rgba(255,255,255,.07);background:radial-gradient(circle at 50% 38%,rgba(130,142,190,.10),transparent 40%)}.estateScene{position:absolute;inset:0;touch-action:none}.sceneBadge,.chainBadge{position:absolute;bottom:22px;font-size:8px;font-weight:900;letter-spacing:.17em;color:#727b8e;border:1px solid rgba(255,255,255,.08);background:rgba(5,6,10,.68);backdrop-filter:blur(12px);border-radius:999px;padding:9px 12px}.sceneBadge{left:24px}.chainBadge{right:24px;color:#aab5ff}.details{padding:64px 44px 40px;display:flex;flex-direction:column;justify-content:center}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:#838ca0}.details h1{font-size:clamp(44px,4.2vw,72px);letter-spacing:-.065em;line-height:.9;margin:14px 0 18px;max-width:570px}.summary{color:#8e96a8;font-size:14px;line-height:1.75;margin:0 0 26px;max-width:560px}.specs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:22px}.specs div{padding:14px 8px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025);text-align:center}.specs strong{display:block;font-size:16px}.specs span{display:block;font-size:7px;letter-spacing:.12em;color:#6f7889;margin-top:4px}.pricePanel{border:1px solid rgba(255,255,255,.09);border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.018));padding:18px;margin-bottom:16px}.pricePanel>div:not(.divider){display:flex;align-items:center;justify-content:space-between;gap:16px}.pricePanel span{font-size:8px;font-weight:900;letter-spacing:.14em;color:#7f8797}.pricePanel strong{font-size:22px;letter-spacing:-.04em}.divider{height:1px;background:rgba(255,255,255,.07);margin:11px 0}.pricePanel small{display:block;margin-top:13px;color:#676f80;line-height:1.45;font-size:9px}.payGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.primary,.crypto{border:0;border-radius:16px;min-height:78px;padding:14px 16px;text-align:left;cursor:pointer}.primary{background:white;color:#07080c}.crypto{background:#6355df;color:white}.primary span,.crypto span{display:block;font-size:11px;font-weight:950;letter-spacing:.07em}.primary small,.crypto small{display:block;font-size:8px;line-height:1.4;margin-top:7px;opacity:.62}.primary:disabled,.crypto:disabled,.ghost:disabled{opacity:.45;cursor:wait}.recover{margin-top:8px;width:100%;border:1px solid rgba(118,239,188,.25);background:rgba(118,239,188,.06);color:#9af3ce;border-radius:12px;padding:11px;font-size:8px;font-weight:900;letter-spacing:.07em}.status{margin-top:12px;padding:12px 14px;border-radius:13px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065);font-size:10px;line-height:1.55;color:#9098a8;min-height:30px}.minted{display:block;margin-top:8px;text-decoration:none;color:#9af3ce;font-size:9px;font-weight:900;letter-spacing:.08em}.disclosure{margin-top:14px;color:#626b7b;font-size:9px;line-height:1.5}.disclosure strong{display:block;color:#a0a8b8;font-size:8px;letter-spacing:.14em;margin-bottom:4px}.collection{max-width:1480px;margin:0 auto;padding:74px 4vw 85px;border-top:1px solid rgba(255,255,255,.07)}.sectionTitle{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:24px}.sectionTitle small{font-size:9px;letter-spacing:.2em;color:#727b8d;font-weight:900}.sectionTitle h2{font-size:42px;letter-spacing:-.05em;margin:8px 0 0}.sectionTitle>span{font-size:8px;letter-spacing:.16em;color:#667083}.cards{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:10px;overflow:auto;padding-bottom:8px}.card{min-width:220px;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.02);border-radius:19px;padding:0;overflow:hidden;color:white;text-align:left;cursor:pointer;transition:.2s transform,.2s border-color}.card:hover,.card.active{transform:translateY(-3px);border-color:rgba(190,184,255,.44)}.mini{height:150px;position:relative;overflow:hidden;background:linear-gradient(#10131d 0 58%,var(--terrain) 58% 100%)}.mini:after{content:"";position:absolute;width:80px;height:80px;border-radius:50%;background:var(--accent);opacity:.12;filter:blur(14px);right:16px;top:20px}.miniHouse{position:absolute;left:50%;bottom:22px;width:118px;height:65px;transform:translateX(-50%);background:var(--structure);clip-path:polygon(0 28%,72% 0,100% 25%,100% 100%,0 100%);box-shadow:0 18px 40px rgba(0,0,0,.4)}.miniHouse i{position:absolute;width:20px;height:25px;background:var(--accent);bottom:9px;opacity:.65}.miniHouse i:nth-child(1){left:20px}.miniHouse i:nth-child(2){left:49px}.miniHouse i:nth-child(3){left:78px}.cardCopy{padding:16px}.cardCopy small{font-size:7px;text-transform:uppercase;letter-spacing:.14em;color:#6f7788}.cardCopy strong{display:block;margin:7px 0 6px;font-size:15px}.cardCopy span{display:block;color:#7b8495;font-size:9px}.cardCopy b{display:block;margin-top:13px;font-size:17px}.truth{max-width:1480px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.07)}.truth>div{padding:65px 6vw 75px}.truth>div+div{border-left:1px solid rgba(255,255,255,.07)}.truth small{font-size:8px;letter-spacing:.18em;color:#737c8e;font-weight:900}.truth h3{font-size:32px;letter-spacing:-.04em;margin:11px 0}.truth p{color:#7e8799;line-height:1.7;max-width:560px;font-size:13px}@media(max-width:980px){.hero{grid-template-columns:1fr}.sceneWrap{min-height:520px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.details{padding:38px 22px 46px}.cards{grid-template-columns:repeat(5,250px)}.truth{grid-template-columns:1fr}.truth>div+div{border-left:0;border-top:1px solid rgba(255,255,255,.07)}}@media(max-width:620px){.topbar{padding:0 16px;min-height:62px}.mode{display:none}.topActions .signed{display:none}.ghost{padding:9px 10px}.sceneWrap{min-height:450px}.details h1{font-size:48px}.specs{grid-template-columns:repeat(2,1fr)}.payGrid{grid-template-columns:1fr}.collection{padding:55px 16px}.sectionTitle h2{font-size:34px}.sectionTitle>span{display:none}.truth>div{padding:50px 22px}.sceneBadge{left:14px}.chainBadge{right:14px}.pricePanel>div:not(.divider){align-items:flex-end}.pricePanel strong{font-size:19px}}
      `}</style>
    </main>
  );
}
