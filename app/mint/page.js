'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getWallet, mintCollectible } from '../../lib/blockchain';
import { supabaseBrowser } from '../../lib/supabase-browser';

function metadataUri(item) {
  const payload = {
    name: item.name,
    description: `Voxel Vault original 3D digital twin of a ${item.realityBasis}. Purchased in USD through Voxel Vault.`,
    image: item.nftImageUrl,
    animation_url: item.nftAnimationUrl,
    external_url: item.nftAnimationUrl,
    attributes: [
      { trait_type: 'Creator', value: item.creator },
      { trait_type: 'Rarity', value: item.rarity },
      { trait_type: 'Reality basis', value: item.realityBasis },
      { trait_type: 'Material', value: item.material || 'Digital material study' },
      { trait_type: '3D asset', value: 'Voxel Vault native procedural twin' },
      { trait_type: 'Purchase', value: 'USD verified' },
      { trait_type: 'Identity', value: `VV-${item.id}` },
    ],
  };
  return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
}

export default function MintPage() {
  const [wallet, setWallet] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [item, setItem] = useState(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mint, setMint] = useState(null);

  const history = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('vv-mint-history') || '[]'); } catch { return []; }
  }, [mint]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSessionId(p.get('session_id') || '');
    setCatalogId(p.get('catalog') || '');
  }, []);

  async function connect() {
    try { const result = await getWallet(); setWallet(result.address); setMessage(`Wallet connected · ${result.address.slice(0, 6)}…${result.address.slice(-4)}`); }
    catch (error) { setMessage(error.message || 'Wallet connection failed.'); }
  }

  async function verify() {
    if (!sessionId || !wallet) return;
    setBusy(true); setMessage('Verifying your USD payment…');
    try {
      const response = await fetch(`/api/mint-verify?session_id=${encodeURIComponent(sessionId)}&wallet=${encodeURIComponent(wallet)}`);
      const data = await response.json();
      if (!response.ok || !data.paid) throw new Error(data.error || 'Payment is not confirmed yet.');
      setItem(data.item); setCatalogId(String(data.catalogId)); setPaid(data.claimEligible !== false); setMessage(data.claimEligible === false ? `Payment verified · ${data.fulfillmentStatus || 'fulfillment pending'}. Claim unlocks after confirmed delivery.` : 'Payment verified. Your original 3D NFT is ready to claim.');
    } catch (error) { setMessage(error.message || 'Could not verify payment.'); }
    finally { setBusy(false); }
  }

  async function startCheckout() {
    if (!catalogId) return;
    if (!wallet) { await connect(); return; }
    setBusy(true); setMessage('Opening secure USD checkout…');
    try {
      const response = await fetch('/api/mint-checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catalogId: Number(catalogId), wallet }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Checkout unavailable.');
      window.location.assign(data.url);
    } catch (error) { setMessage(error.message || 'Could not start checkout.'); setBusy(false); }
  }

  async function startPhysicalAndNftCheckout() {
    if (!catalogId) return;
    if (!wallet) { await connect(); return; }
    setBusy(true); setMessage('Preparing physical delivery + digital twin checkout…');
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in to Vault before entering a shipping address.');
      const response = await fetch('/api/physical-nft-checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ catalogId: Number(catalogId), wallet }) });
      const data = await response.json();
      if (!response.ok || !data.url) {
        if (data.sourceUrl) {
          setMessage('Automated fulfillment is not connected yet. Opening the verified retailer so the physical product can be purchased safely.');
          window.open(data.sourceUrl, '_blank', 'noopener,noreferrer');
          setBusy(false);
          return;
        }
        throw new Error(data.error || 'Physical checkout unavailable.');
      }
      window.location.assign(data.url);
    } catch (error) { setMessage(error.message || 'Could not start physical + NFT checkout.'); setBusy(false); }
  }

  async function mintNow() {
    if (!item || !paid) return;
    setBusy(true); setMessage('Minting your original 3D digital twin… confirm the wallet transaction.');
    try {
      const result = await mintCollectible({ uri: metadataUri(item), royaltyBps: 500 });
      const entry = { id: item.id, name: item.name, creator: item.creator, rarity: item.rarity, priceUsd: item.priceUsd, wallet, tokenId: result.tokenId, hash: result.hash, explorerTx: result.explorerTx, createdAt: new Date().toISOString() };
      const current = JSON.parse(localStorage.getItem('vv-mint-history') || '[]');
      localStorage.setItem('vv-mint-history', JSON.stringify([entry, ...current].slice(0, 100)));
      setMint(result); setMessage(`Mint confirmed${result.tokenId ? ` · token #${result.tokenId}` : ''}.`);
    } catch (error) { setMessage(error.message || 'Mint failed.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (sessionId && wallet) verify(); }, [sessionId, wallet]);

  return <main className="page">
    <header><Link href="/" className="brand">VOXEL VAULT</Link><Link href="/" className="back">Back</Link></header>
    <section className="hero"><small>PHYSICAL + DIGITAL</small><h1>Buy it.<br /><em>Own both.</em></h1><p>Choose a verified real-world product, keep its original Voxel Vault 3D twin in your Vault, and place the collectible in your Room or the world.</p></section>
    <section className="panel">
      <div className="step"><b>01</b><strong>Connect your wallet</strong><button onClick={connect} disabled={busy}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Connect'}</button></div>
      <div className="step"><b>02</b><strong>Physical + NFT · one USD total</strong><button onClick={startPhysicalAndNftCheckout} disabled={busy || !catalogId}>{catalogId ? 'Buy + ship + NFT' : 'Choose an object first'}</button></div>
      <div className="step"><b>03</b><strong>Digital-only checkout</strong><button onClick={startCheckout} disabled={busy || !catalogId}>{catalogId ? 'Buy NFT' : 'Choose an object first'}</button></div>
      <div className="step"><b>04</b><strong>Verify payment</strong><button onClick={verify} disabled={busy || !sessionId || !wallet}>Verify</button></div>
      <div className="step"><b>05</b><strong>Claim the original 3D twin</strong><button onClick={mintNow} disabled={busy || !paid}>{paid ? 'Claim NFT' : 'Locked until paid'}</button></div>
    </section>
    {item && <section className="object"><small>REAL-WORLD OBJECT · ORIGINAL 3D TWIN</small><h2>{item.name}</h2><p>by {item.creator} · {item.rarity}</p><div className="facts"><span>${item.priceUsd}</span><span>Source verified</span><span>Native 3D media</span><span>VV-{item.id}</span></div><Link href={`/twin?asset=${catalogId}`} className="twinLink">Inspect the permanent 3D twin ↗</Link>{mint && <a href={mint.explorerTx} target="_blank" rel="noreferrer">View confirmed transaction ↗</a>}</section>}
    {history.length > 0 && <section className="history"><small>YOUR HISTORY</small><h2>Collected objects.</h2>{history.slice(0, 8).map((entry, index) => <article key={`${entry.hash}-${index}`}><div><strong>{entry.name}</strong><span>{entry.creator} · {entry.createdAt.slice(0, 10)}</span></div><b>{entry.tokenId ? `#${entry.tokenId}` : 'Minted'}</b></article>)}</section>}
    {message && <p className="message" role="status">{message}</p>}
    <footer><Link href="/orders">Track orders</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></footer>
    <style jsx>{`.page{min-height:100vh;background:#05060b;color:#f7f8fb;padding:0 16px 45px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page *{box-sizing:border-box}header{height:62px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.brand{color:#fff;text-decoration:none;font-size:11px;font-weight:950;letter-spacing:.16em}.back{color:#858ea1;text-decoration:none;font-size:10px}.hero{padding:44px 0 25px}.hero small,.panel+section small,.history>small{color:#a895ff;font-size:9px;font-weight:900;letter-spacing:.17em}.hero h1{font-size:clamp(52px,13vw,80px);line-height:.86;letter-spacing:-.07em;margin:10px 0}.hero em{font-style:normal;color:#a894ff}.hero p{max-width:460px;color:#858ea1;font-size:13px;line-height:1.5}.panel,.object,.history{border:1px solid rgba(255,255,255,.09);border-radius:22px;background:rgba(255,255,255,.035);padding:10px}.step{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:center;padding:14px 8px;border-bottom:1px solid rgba(255,255,255,.07)}.step:last-child{border-bottom:0}.step b{color:#727b8e;font-size:9px}.step strong{font-size:12px}.step button{border:1px solid rgba(255,255,255,.12);background:#f5f6f9;color:#08090d;border-radius:10px;padding:9px 10px;font-size:9px;font-weight:900}.step button:disabled{opacity:.45}.object{margin-top:12px;padding:20px;background:linear-gradient(135deg,rgba(143,112,255,.14),rgba(255,255,255,.025))}.object h2,.history h2{font-size:26px;letter-spacing:-.04em;margin:8px 0 3px}.object p{color:#7e8799;font-size:10px}.facts{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}.facts span{border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 9px;color:#dce1ea;font-size:8px}.object a,.twinLink{display:inline-block;color:#a894ff;text-decoration:none;font-size:9px;margin-right:12px}.history{margin-top:12px}.history h2{margin-bottom:12px}.history article{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.07)}.history article div{min-width:0}.history strong,.history span{display:block}.history strong{font-size:11px}.history span{font-size:8px;color:#737c8e;margin-top:3px}.history article>b{font-size:9px;color:#67eeb0}.message{color:#9aa3b5;font-size:10px;line-height:1.5;padding:10px 2px}.page footer{display:flex;justify-content:center;gap:18px;margin-top:24px}.page footer a{color:#5f687a;text-decoration:none;font-size:9px}@media(min-width:700px){.page{max-width:760px;margin:0 auto;padding-left:24px;padding-right:24px}}`}</style>
  </main>;
}
