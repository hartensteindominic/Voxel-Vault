'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createUniversalCollectible, collectibleFingerprint } from '../../lib/universalCollectible';
import { ethOfferOnToken, transferCollectible, hasContracts, hasNftContract, EVM_CHAIN_NAME } from '../../lib/blockchain';

const DEMO_OBJECTS = [
  createUniversalCollectible({ name: 'Field Camera', family: 'technology', subtype: 'camera', rarity: 'rare', seed: 'camera-001' }),
  createUniversalCollectible({ name: 'Survey Robot', family: 'technology', subtype: 'robot', rarity: 'epic', seed: 'robot-001' }),
  createUniversalCollectible({ name: 'Street Deck', family: 'sports', subtype: 'skateboard', rarity: 'uncommon', seed: 'board-001' }),
];

export default function TapToTrade({ initialOfferId = '', mode = 'create' }) {
  const [wallet, setWallet] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedOffered, setSelectedOffered] = useState([DEMO_OBJECTS[0].name]);
  const [tokenId, setTokenId] = useState('');
  const [ethAmount, setEthAmount] = useState('0.01');
  const [status, setStatus] = useState(
    mode === 'accept' && initialOfferId ? `Opened offer ${initialOfferId}. Connect wallet and accept.` : ''
  );
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);

  const deepLink = useMemo(() => {
    if (!offer) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://voxel-vault.vercel.app';
    return `${base}/trade?mode=accept&offer=${encodeURIComponent(offer.id || 'local')}`;
  }, [offer]);

  const canWriteNfc = typeof window !== 'undefined' && 'NDEFReader' in window;

  async function shareNearby() {
    if (!deepLink) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Voxel Vault trade', text: 'Open this secure trade offer in Voxel Vault.', url: deepLink });
        setStatus('Trade offer opened in the system share sheet. Choose a nearby device or contact.');
      } else {
        await navigator.clipboard.writeText(deepLink);
        setStatus('Trade link copied. Send it to the recipient.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus(error?.message || 'Could not share this offer');
    }
  }

  async function writeNfcTag() {
    if (!deepLink || !canWriteNfc) { setStatus('Web NFC writing is not available in this browser. Use the nearby share button.'); return; }
    try {
      const writer = new window.NDEFReader();
      await writer.write({ records: [{ recordType: 'url', data: deepLink }] });
      setStatus('NFC tag written. Tapping the tag opens this offer; both wallets must still approve settlement.');
    } catch (error) {
      setStatus(error?.message || 'NFC write cancelled');
    }
  }

  async function connectWallet() {
    try {
      if (typeof window === 'undefined' || !window.ethereum) throw new Error('Wallet not detected');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWallet(accounts?.[0] || '');
      setStatus(accounts?.[0] ? `Connected ${accounts[0].slice(0, 6)}…${accounts[0].slice(-4)} · ${EVM_CHAIN_NAME}` : 'Cancelled');
    } catch (e) {
      setStatus(e?.message || 'Wallet failed');
    }
  }

  async function createOffer() {
    if (!wallet) { setStatus('Connect your wallet first'); return; }
    if (!selectedOffered.length) { setStatus('Select at least one object to offer'); return; }
    setBusy(true);
    try {
      const offered = DEMO_OBJECTS.filter((o) => selectedOffered.includes(o.name)).map((o) => ({
        type: 'collectible',
        name: o.name,
        fingerprint: collectibleFingerprint(o),
        family: o.family,
        rarity: o.rarity,
      }));
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          offerer: wallet,
          recipient: recipient.trim() || undefined,
          offered,
          requested: [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create offer');
      setOffer(data.offer);
      setStatus(data.message || 'Trade offer stored. Use ETH actions below when you have a token ID.');
    } catch (e) {
      setStatus(e?.message || 'Could not create offer');
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer() {
    if (!wallet) { setStatus('Connect wallet first'); return; }
    if (!offer?.id && !initialOfferId) { setStatus('Create or open an offer first'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', id: offer?.id || initialOfferId, walletAddress: wallet }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Accept failed');
      setOffer(data.offer);
      setStatus(data.message || 'Accepted in app state. Settle with ETH transfer or marketplace below.');
    } catch (e) {
      setStatus(e?.message || 'Accept failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendEthOffer() {
    if (!tokenId) { setStatus('Enter an on-chain token ID first'); return; }
    if (!hasContracts()) { setStatus('Marketplace contract not configured (NEXT_PUBLIC_VOXEL_MARKET_ADDRESS)'); return; }
    setBusy(true);
    try {
      const result = await ethOfferOnToken(tokenId, ethAmount || '0.01');
      setStatus(`ETH offer confirmed on ${EVM_CHAIN_NAME}. ${result.explorerTx || result.hash}`);
    } catch (e) {
      setStatus(e?.shortMessage || e?.message || 'ETH offer failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendTransfer() {
    if (!tokenId) { setStatus('Enter token ID'); return; }
    if (!recipient.trim()) { setStatus('Enter recipient wallet'); return; }
    if (!hasNftContract()) { setStatus('NFT contract not configured'); return; }
    setBusy(true);
    try {
      const result = await transferCollectible(tokenId, recipient.trim());
      setStatus(`Transferred token #${tokenId} on ${EVM_CHAIN_NAME}. ${result.explorerTx || result.hash}`);
    } catch (e) {
      setStatus(e?.shortMessage || e?.message || 'Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tradeRoot">
      <nav className="tradeNav">
        <Link className="brand" href="/">V<span>V</span>OXELVAULT</Link>
        <div className="navLinks">
          <Link href="/">Gallery</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/trade" className="active">Trade</Link>
          <Link href="/marketplace">Marketplace</Link>
        </div>
        <button type="button" className="walletBtn" onClick={connectWallet}>
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '◈ Connect Wallet'}
        </button>
      </nav>

      <header className="tradeHero">
        <div className="eyebrow"><i /> TAP TO TRADE · {EVM_CHAIN_NAME} · ETH</div>
        <h1>Trade like <em>passing a card.</em></h1>
        <p>
          App offers coordinate the handoff. Real ownership moves with <strong>ETH gas</strong> on {EVM_CHAIN_NAME}:
          NFT transfer or marketplace ETH offers. Nearby sharing never moves an asset by itself; both wallets approve the settlement.
        </p>
      </header>

      <section className="tradeGrid">
        <div className="panel">
          <h3>1. Choose objects / create app offer</h3>
          <div className="objectList">
            {DEMO_OBJECTS.map((obj) => {
              const checked = selectedOffered.includes(obj.name);
              return (
                <label key={obj.name} className={`obj ${checked ? 'on' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => {
                    setSelectedOffered((prev) => checked ? prev.filter((n) => n !== obj.name) : [...prev, obj.name]);
                  }} />
                  <div><strong>{obj.name}</strong><span>{obj.family} · {obj.rarity}</span></div>
                </label>
              );
            })}
          </div>
          <label className="field">Recipient wallet<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" /></label>
          <button type="button" className="primary" onClick={createOffer} disabled={!wallet || !selectedOffered.length || busy}>
            {busy ? 'Working…' : 'Create trade offer'}
          </button>

          <h3 style={{ marginTop: 22 }}>3. Settle on Ethereum (ETH)</h3>
          <label className="field">Token ID (from claim mint)<input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="e.g. 1" /></label>
          <label className="field">ETH offer amount<input value={ethAmount} onChange={(e) => setEthAmount(e.target.value)} placeholder="0.01" /></label>
          <div className="actions" style={{ marginTop: 10 }}>
            <button type="button" className="secondary" onClick={sendEthOffer} disabled={busy || !wallet}>Offer ETH on token</button>
            <button type="button" className="secondary" onClick={sendTransfer} disabled={busy || !wallet}>Transfer NFT</button>
          </div>
        </div>

        <div className="panel handoff">
          <h3>2. Phone handoff</h3>
          {offer ? (
            <>
              <div className="handoffReady"><small>NEARBY OFFER READY</small><strong>Bring the recipient into this handoff.</strong><span>State: <b>{offer.state}</b></span></div>
              <p className="linkLabel">Deep link</p>
              <code className="deeplink">{deepLink}</code>
              <div className="actions">
                <button type="button" className="primary" onClick={shareNearby}>Share to nearby phone</button>
                <button type="button" className="secondary" onClick={writeNfcTag}>{canWriteNfc ? 'Write NFC tag' : 'NFC tag unavailable'}</button>
                <button type="button" className="secondary" onClick={acceptOffer} disabled={busy || !wallet}>
                  {busy ? 'Working…' : 'Accept as recipient'}
                </button>
              </div>
              <p className="hint">iPhone uses the system share sheet for nearby handoff. Compatible Android browsers can also write the offer URL to an NFC tag. The recipient reviews the offer before either wallet signs.</p>
            </>
          ) : (
            <div className="emptyHandoff"><p>Create an offer to generate a secure nearby handoff link.</p></div>
          )}
        </div>
      </section>

      {status && (
        <div className="statusBar"><span>●</span>{status}<button type="button" onClick={() => setStatus('')}>×</button></div>
      )}

      <style jsx>{`
        .tradeRoot{min-height:100vh;background:#05060b;color:#f7f8ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .tradeNav{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(5,6,11,.9);position:sticky;top:0;z-index:40}
        .brand{font-size:16px;font-weight:950;letter-spacing:.14em;text-decoration:none;color:#fff}.brand span{color:#9b7cff}
        .navLinks{display:flex;gap:22px;font-size:13px}.navLinks a{color:#9da3b5;text-decoration:none}.navLinks a.active{color:#fff}
        .walletBtn{border:1px solid rgba(255,255,255,.14);background:#0b0d15;border-radius:999px;padding:10px 14px;color:#fff;font-weight:800;cursor:pointer}
        .tradeHero{max-width:900px;margin:0 auto;padding:48px 5vw 20px}
        .eyebrow{font-size:10px;letter-spacing:.18em;color:#8e95aa;font-weight:850;margin-bottom:12px}.eyebrow i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#55e6ff;margin-right:8px}
        .tradeHero h1{font-size:clamp(40px,6vw,72px);line-height:.92;margin:0 0 14px;font-weight:950}
        .tradeHero h1 em{font-family:Georgia,serif;font-weight:400;color:#ad99ff}
        .tradeHero p{color:#a7adbe;line-height:1.65;font-size:15px}
        .tradeGrid{max-width:1100px;margin:0 auto;padding:20px 5vw 80px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .panel{border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:22px;background:rgba(8,10,17,.95)}
        .panel h3{margin:0 0 16px;font-size:16px}
        .objectList{display:grid;gap:8px;margin-bottom:16px}
        .obj{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;cursor:pointer}
        .obj.on{border-color:rgba(155,124,255,.45);background:rgba(155,124,255,.08)}
        .obj strong{display:block}.obj span{font-size:11px;color:#7f879b;text-transform:capitalize}
        .field{display:grid;gap:6px;font-size:11px;letter-spacing:.08em;color:#8f97ad;margin-bottom:14px}
        .field input{background:#090b12;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px;color:#fff}
        .primary,.secondary{border-radius:999px;padding:12px 18px;font-weight:850;cursor:pointer;border:1px solid transparent}
        .primary{background:#fff;color:#07080c;border-color:#fff;width:100%}.secondary{background:#0b0d15;color:#e7e2ff;border-color:rgba(155,124,255,.35)}
        .handoff{display:flex;flex-direction:column;align-items:center;text-align:center}
        .handoffReady{width:100%;min-height:190px;display:grid;place-items:center;align-content:center;gap:10px;padding:24px;border-radius:18px;background:radial-gradient(circle at 50% 45%,rgba(85,230,255,.16),transparent 42%),#090b12;border:1px solid rgba(85,230,255,.22);margin-bottom:12px}.handoffReady small{color:#55e6ff;font-size:9px;letter-spacing:.16em;font-weight:900}.handoffReady strong{max-width:300px;font-size:24px;line-height:1.05}.handoffReady span{font-size:11px;color:#9da3b5}.handoffReady b{color:#55e6ff;text-transform:uppercase}
        .offerState{margin-top:8px;font-size:12px;color:#9da3b5}.offerState b{color:#55e6ff;text-transform:uppercase}
        .linkLabel{font-size:10px;letter-spacing:.14em;color:#7f879b;margin:8px 0 4px}
        .deeplink{display:block;font-size:10px;word-break:break-all;color:#a183ff;padding:8px;background:rgba(0,0,0,.3);border-radius:8px}
        .hint{font-size:12px;color:#8a91a5;line-height:1.5;margin:12px 0}
        .actions{display:flex;gap:8px;width:100%;flex-wrap:wrap;justify-content:center}.actions button{flex:1;min-width:120px}
        .emptyHandoff{padding:40px 20px;color:#7f879b}
        .statusBar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:80;background:#11141e;border:1px solid rgba(255,255,255,.14);padding:11px 14px;border-radius:999px;display:flex;align-items:center;gap:9px;font-size:12px;max-width:min(920px,94vw)}.statusBar span{color:#9b7cff}.statusBar button{border:0;background:transparent;color:#8e94a7;cursor:pointer}
        @media(max-width:800px){.tradeGrid{grid-template-columns:1fr}.navLinks{display:none}}
      `}</style>
    </main>
  );
}
