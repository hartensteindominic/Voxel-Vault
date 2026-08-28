'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrowserProvider, Contract, ContractFactory, JsonRpcProvider, getAddress } from 'ethers';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../../lib/wallet-connect';
import {
  TEST_LAND_BYTECODE_PARTS,
  TEST_LAND_CHAIN_HEX,
  TEST_LAND_CHAIN_ID,
  TEST_LAND_CREATION_BYTECODE_CHARS,
  TEST_LAND_CREATION_SHA256,
  TEST_LAND_EXPLORER_URL,
  TEST_LAND_MAX_PARCELS,
  TEST_LAND_MINT_PRICE_WEI,
  TEST_LAND_RPC_URL,
  TEST_LAND_RUNTIME_BYTECODE_CHARS,
  TEST_LAND_RUNTIME_SHA256,
} from '../../../../lib/test-land-deploy';

const CONSTRUCTOR_ABI = [{
  inputs: [{ internalType: 'address', name: 'initialOwner', type: 'address' }],
  stateMutability: 'nonpayable',
  type: 'constructor',
}];
const READ_ABI = [
  'function owner() view returns (address)',
  'function MAX_PARCELS() view returns (uint256)',
  'function MINT_PRICE() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
];
const RECOVERY_KEY = 'vv-test-land-deployment-recovery';
const CONTRACT_KEY = 'vv-test-land-contract';

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Deployment action failed.');
}

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 8)}…${text.slice(-6)}` : '—';
}

function hexBytes(hex) {
  const clean = String(hex || '').replace(/^0x/, '');
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) throw new Error('Reviewed Test Land bytecode is invalid.');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256Hex(hex) {
  const digest = await window.crypto.subtle.digest('SHA-256', hexBytes(hex));
  return `0x${Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

async function ensureBaseSepolia(injected) {
  let chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId === TEST_LAND_CHAIN_HEX) return;
  try {
    await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TEST_LAND_CHAIN_HEX }] });
  } catch (error) {
    if (error?.code === 4001) throw new Error('Base Sepolia network switch was cancelled.');
    if (error?.code !== 4902) throw error;
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: TEST_LAND_CHAIN_HEX,
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [TEST_LAND_RPC_URL],
        blockExplorerUrls: [TEST_LAND_EXPLORER_URL],
      }],
    });
  }
  chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId !== TEST_LAND_CHAIN_HEX) throw new Error('Switch MetaMask to Base Sepolia before continuing.');
}

async function loadReviewedBytecode() {
  const responses = await Promise.all(TEST_LAND_BYTECODE_PARTS.map(path => fetch(path, { cache: 'no-store' })));
  if (responses.some(response => !response.ok)) throw new Error('One or more reviewed Test Land bytecode parts could not be loaded.');
  const parts = await Promise.all(responses.map(response => response.text()));
  const bytecode = parts.map(part => part.trim()).join('');
  if (!bytecode.startsWith('0x') || bytecode.length !== TEST_LAND_CREATION_BYTECODE_CHARS) {
    throw new Error('Reviewed Test Land bytecode failed its exact length check.');
  }
  const digest = await sha256Hex(bytecode);
  if (digest.toLowerCase() !== TEST_LAND_CREATION_SHA256.toLowerCase()) {
    throw new Error('Reviewed Test Land bytecode failed its SHA-256 integrity check.');
  }
  return bytecode;
}

async function verifyDeployment(address, expectedOwner) {
  const provider = new JsonRpcProvider(TEST_LAND_RPC_URL, TEST_LAND_CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== TEST_LAND_CHAIN_ID) throw new Error('Public RPC is not Base Sepolia.');
  const checksum = getAddress(address);
  const runtime = await provider.getCode(checksum);
  if (!runtime || runtime === '0x') throw new Error('No contract bytecode exists at the deployed address.');
  if (runtime.length !== TEST_LAND_RUNTIME_BYTECODE_CHARS) throw new Error('Deployed Test Land runtime length does not match the reviewed contract.');
  const runtimeHash = await sha256Hex(runtime);
  if (runtimeHash.toLowerCase() !== TEST_LAND_RUNTIME_SHA256.toLowerCase()) {
    throw new Error('Deployed Test Land runtime hash does not match the CI-reviewed contract.');
  }

  const land = new Contract(checksum, READ_ABI, provider);
  const [owner, maxParcels, price, totalMinted] = await Promise.all([
    land.owner(), land.MAX_PARCELS(), land.MINT_PRICE(), land.totalMinted(),
  ]);
  if (getAddress(owner) !== getAddress(expectedOwner)) throw new Error('Deployed Test Land owner does not match the wallet that deployed it.');
  if (BigInt(maxParcels) !== BigInt(TEST_LAND_MAX_PARCELS)) throw new Error('Deployed Test Land parcel cap is not 64.');
  if (BigInt(price) !== TEST_LAND_MINT_PRICE_WEI) throw new Error('Deployed Test Land mint price does not match the reviewed price.');
  if (BigInt(totalMinted) !== 0n) throw new Error('Fresh Test Land deployment unexpectedly has minted parcels.');
  return checksum;
}

export default function TestLandDeployPage() {
  const [injected, setInjected] = useState(null);
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready. Connect MetaMask to deploy the reviewed Test Land contract on Base Sepolia.');
  const [recovery, setRecovery] = useState(null);
  const [deployed, setDeployed] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECOVERY_KEY) || 'null');
      if (saved?.txHash && saved?.wallet) setRecovery(saved);
      const existing = window.localStorage.getItem(CONTRACT_KEY) || '';
      if (/^0x[0-9a-fA-F]{40}$/.test(existing)) setDeployed(getAddress(existing));
    } catch {
      window.localStorage.removeItem(RECOVERY_KEY);
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
      const address = getAddress(accounts[0]);
      setInjected(provider);
      setWallet(address);
      setStatus(`Wallet ${short(address)} connected on Base Sepolia. Nothing has been signed or spent yet.`);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function finish(address, expectedOwner) {
    setStatus('Contract confirmed. Independently verifying runtime bytecode, owner, parcel cap and price…');
    const verified = await verifyDeployment(address, expectedOwner);
    window.localStorage.setItem(CONTRACT_KEY, verified);
    window.localStorage.removeItem(RECOVERY_KEY);
    setRecovery(null);
    setDeployed(verified);
    setStatus('Verified Test Land contract is ready. No parcels were minted during deployment.');
    return verified;
  }

  async function deploy() {
    if (!injected || !wallet) {
      await connect();
      return;
    }
    setBusy(true);
    try {
      await ensureBaseSepolia(injected);
      const accounts = await injected.request({ method: 'eth_accounts' });
      const active = getAddress(accounts?.[0] || '0x0000000000000000000000000000000000000000');
      if (active !== wallet) throw new Error('The active MetaMask wallet changed. Reconnect before deploying.');

      setStatus('Loading and hashing the exact CI-compiled Test Land bytecode…');
      const bytecode = await loadReviewedBytecode();
      const browserProvider = new BrowserProvider(injected);
      const signer = await browserProvider.getSigner(wallet);
      const factory = new ContractFactory(CONSTRUCTOR_ABI, bytecode, signer);

      setStatus('Opening MetaMask for ONE Base Sepolia deployment. Review the testnet gas estimate before approving.');
      const contract = await factory.deploy(wallet);
      const tx = contract.deploymentTransaction();
      if (!tx?.hash) throw new Error('MetaMask did not return a deployment transaction hash.');
      const pending = { txHash: tx.hash, wallet };
      window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(pending));
      setRecovery(pending);
      setStatus(`Deployment submitted: ${short(tx.hash)}. Waiting for Base Sepolia confirmation…`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('The Base Sepolia Test Land deployment did not succeed.');
      await finish(receipt.contractAddress, wallet);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function recoverDeployment() {
    if (!recovery?.txHash || !recovery?.wallet) return;
    setBusy(true);
    try {
      setStatus('Checking the previous Base Sepolia deployment. This sends no new transaction…');
      const provider = new JsonRpcProvider(TEST_LAND_RPC_URL, TEST_LAND_CHAIN_ID, { staticNetwork: true });
      const receipt = await provider.getTransactionReceipt(recovery.txHash);
      if (!receipt) throw new Error('Previous deployment is still pending or not visible yet. Try recovery again shortly.');
      if (receipt.status !== 1 || !receipt.contractAddress) throw new Error('Previous Test Land deployment failed. No contract was activated.');
      await finish(receipt.contractAddress, recovery.wallet);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="page">
    <header><Link href="/vault/test-land">‹ TEST LAND</Link><div><small>BASE SEPOLIA · TESTNET</small><h1>Deploy Test Land</h1></div><a href={TEST_LAND_EXPLORER_URL} target="_blank" rel="noreferrer">BASESCAN ↗</a></header>

    <section className="hero"><small>ONE-TIME TESTNET SETUP</small><h2>Launch the<br/><em>64-parcel world.</em></h2><p>This deploys the exact CI-reviewed Voxel Test Land contract using your MetaMask wallet. It creates a fictional digital world only.</p></section>

    <section className="panel">
      <div className="warning"><b>NO REAL PROPERTY</b><span>Nothing here transfers a deed, physical land, rent rights, a security, or an investment interest. Base Sepolia ETH is testnet currency.</span></div>
      <div className="review"><article><small>NETWORK</small><b>Base Sepolia</b><span>Chain 84532 only.</span></article><article><small>SUPPLY</small><b>64 parcels</b><span>Finite 8×8 test world.</span></article><article><small>MINT PRICE</small><b>0.0001 TEST ETH</b><span>Paid only when you later mint a parcel.</span></article><article><small>DEPLOYMENT</small><b>1 MetaMask tx</b><span>Gas is test ETH. No private key is requested.</span></article></div>
      <div className="integrity"><small>REVIEWED BYTECODE</small><code>{TEST_LAND_CREATION_SHA256}</code><small>REVIEWED RUNTIME</small><code>{TEST_LAND_RUNTIME_SHA256}</code></div>

      {deployed ? <div className="success"><b>✓ VERIFIED TEST LAND READY</b><span>{deployed}</span><a href={`${TEST_LAND_EXPLORER_URL}/address/${deployed}`} target="_blank" rel="noreferrer">VIEW CONTRACT ↗</a><Link href={`/vault/test-land?contract=${encodeURIComponent(deployed)}`}>OPEN 3D LAND MARKET →</Link></div> : <>
        <div className="wallet"><span>CONNECTED WALLET</span><b>{wallet || 'Not connected'}</b><button disabled={busy} onClick={connect}>{wallet ? 'RECONNECT' : 'CONNECT METAMASK'}</button></div>
        {recovery ? <button className="recover" disabled={busy} onClick={recoverDeployment}>RECOVER PREVIOUS DEPLOYMENT — NO NEW GAS</button> : null}
        <button className="primary" disabled={busy} onClick={wallet ? deploy : connect}>{busy ? 'WAITING…' : wallet ? 'DEPLOY 64-PARCEL TEST LAND' : 'CONNECT METAMASK'}</button>
      </>}
      <div className="status">{status}</div>
      <a className="faucet" href="https://docs.base.org/base-chain/network-information/network-faucets" target="_blank" rel="noreferrer">NEED TEST ETH? OPEN BASE'S FAUCET LIST ↗</a>
    </section>

    <footer><Link href="/vault/test-land">← 3D TEST LAND</Link><Link href="/vault">VOXEL VAULT →</Link></footer>
    <style jsx>{`
      .page{min-height:100vh;background:#05060b;color:#f7f8ff;padding:0 16px 36px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page>header{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}header a{color:#fff;text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.08em}header div{text-align:center}header small{font-size:7px;letter-spacing:.18em;color:#9d8fff}header h1{font-size:16px;margin:4px 0}.hero{max-width:720px;margin:52px auto 20px}.hero>small{font-size:8px;letter-spacing:.18em;color:#a99cff;font-weight:900}.hero h2{font-size:48px;line-height:.92;letter-spacing:-.055em;margin:10px 0 15px}.hero h2 em{font-style:normal;color:#aa9cff}.hero p{max-width:600px;color:#8d97aa;font-size:13px;line-height:1.65}.panel{max-width:720px;margin:auto;padding:17px;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.035)}.warning{padding:13px 14px;border:1px solid rgba(255,191,86,.25);background:rgba(255,170,60,.06);border-radius:15px;display:flex;gap:11px}.warning b{font-size:8px;color:#ffca75;white-space:nowrap}.warning span{font-size:10px;color:#9ba4b7;line-height:1.5}.review{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.review article{padding:12px;border-radius:14px;background:#090c15;border:1px solid rgba(255,255,255,.055)}.review small,.integrity small{display:block;font-size:7px;letter-spacing:.13em;color:#6d778a}.review b{display:block;font-size:12px;margin-top:5px}.review span{display:block;font-size:9px;color:#697386;margin-top:4px;line-height:1.45}.integrity{margin:12px 0;padding:11px;border-radius:13px;background:#070a11}.integrity code{display:block;margin:4px 0 9px;font-size:8px;color:#8e98ab;word-break:break-all}.wallet{display:flex;align-items:center;gap:8px;margin:13px 0;font-size:8px}.wallet span{color:#6f788b}.wallet b{flex:1;overflow:hidden;text-overflow:ellipsis}.wallet button{border:0;background:none;color:#a99cff;font-size:8px;font-weight:900}.primary,.recover{width:100%;border:0;border-radius:14px;padding:14px;font-weight:900}.primary{background:#fff;color:#05060b}.recover{margin-bottom:8px;background:#171b2a;color:#bdb6ff}.status{margin-top:11px;padding:10px 11px;border-radius:12px;background:#090c14;color:#909aac;font-size:10px;line-height:1.5}.faucet{display:block;margin-top:11px;color:#a99cff;text-decoration:none;font-size:8px;font-weight:900}.success{padding:15px;border-radius:15px;border:1px solid rgba(96,236,182,.23);background:rgba(96,236,182,.06)}.success b,.success span,.success a{display:block}.success b{color:#83ffd0;font-size:10px}.success span{font-size:9px;color:#94a0b2;word-break:break-all;margin:7px 0}.success a{margin-top:8px;color:#b8aeff;text-decoration:none;font-size:9px;font-weight:900}.page>footer{max-width:720px;margin:20px auto 0;display:flex;justify-content:space-between}.page>footer a{color:#717b8e;text-decoration:none;font-size:8px;font-weight:900}@media(min-width:760px){.hero h2{font-size:68px}.panel{padding:21px}}
    `}</style>
  </main>;
}
