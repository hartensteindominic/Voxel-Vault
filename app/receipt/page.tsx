'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ReceiptPage() {
  const [verified, setVerified] = useState(false);
  const [selected, setSelected] = useState(false);
  const [minting, setMinting] = useState(false);
  const [message, setMessage] = useState('');
  const verify = () => { setVerified(true); setMessage(''); };
  const mint = async () => {
    setMinting(true);
    setMessage('Preparing secure checkout…');
    try {
      const response = await fetch('/api/receipt-mint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receiptId: 'demo-receipt', collectibleId: 'everyday-object' }) });
      const data = await response.json();
      if (data.url) window.location.assign(data.url);
      else setMessage(data.error || 'Checkout is not configured yet.');
    } catch { setMessage('Checkout could not be started.'); }
    finally { setMinting(false); }
  };
  return <main className="page"><header><Link href="/" className="back">‹</Link><div><small>VOXEL VAULT</small><h1>Scan a receipt</h1></div><Link href="/room" className="room">◇ Room</Link></header>
    <section className="scan"><div className="frame"><span>▣</span><b>{verified ? 'Receipt verified' : 'Place receipt inside frame'}</b><small>{verified ? 'Purchase detected' : 'Card details are never needed'}</small></div><button onClick={verify}>{verified ? 'Verified ✓' : 'Scan receipt'}</button></section>
    {verified && <section className="purchase"><small>VERIFIED PURCHASE</small><h2>Everyday object</h2><p>Choose whether to turn this verified purchase into a digital collectible. A participating merchant or signed receipt provider must authorize the purchase before minting.</p><div className="row"><span>Collectible</span><b>$2.99 USD</b></div><div className="row"><span>3D Room collectible</span><b>Included</b></div><label className="choice"><input type="checkbox" checked={selected} onChange={e=>setSelected(e.target.checked)}/><span>Yes, collect this purchase in my Vault.</span></label><button className="mint" disabled={!selected || minting} onClick={mint}>{minting ? 'Preparing…' : 'Continue · $2.99 USD'}</button>{message && <p className="message">{message}</p>}</section>}
    <section className="note"><b>Verified purchase → collectible</b><p>USD checkout happens before minting. Payment confirmation and merchant verification authorize the mint; blockchain confirmation is required before ownership is shown.</p></section>
    <footer><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></footer>
    <style jsx>{`.page{min-height:100vh;background:#05060b;color:#f6f7fb;padding:0 16px 34px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page header{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}.back,.room{color:#fff;text-decoration:none}.back{font-size:30px}.room{font-size:10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 10px}.page header div{text-align:center}.page header small{font-size:7px;letter-spacing:.18em;color:#9e8dff}.page h1{font-size:18px;margin:3px 0}.scan{padding:30px 0}.frame{height:330px;border:1px dashed rgba(169,145,255,.6);border-radius:24px;background:radial-gradient(circle,rgba(130,100,255,.14),transparent 60%);display:grid;place-content:center;text-align:center;gap:8px}.frame span{font-size:50px;color:#a693ff}.frame b{font-size:16px}.frame small{color:#737d90;font-size:10px}.scan>button,.mint{width:100%;border:0;border-radius:15px;padding:15px;margin-top:10px;font-weight:900;font-size:12px;background:#f5f6f9;color:#08090d}.mint:disabled{opacity:.45}.purchase,.note{border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:19px;background:rgba(255,255,255,.035);margin-bottom:12px}.purchase>small{font-size:8px;color:#9f8fff;letter-spacing:.15em;font-weight:900}.purchase h2{font-size:24px;margin:8px 0}.purchase p,.note p{font-size:10px;line-height:1.5;color:#7d8798}.row{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,.07);font-size:11px}.choice{display:flex;gap:9px;align-items:center;margin-top:12px;font-size:10px;color:#c8ced9}.choice input{accent-color:#a793ff;width:18px;height:18px}.mint{margin-top:13px}.message{margin:10px 0 0!important;color:#a99bff!important}.note b{font-size:11px}.note{margin-top:10px}footer{display:flex;justify-content:center;gap:18px;margin-top:22px}footer a{font-size:9px;color:#626b7d;text-decoration:none}@media(min-width:700px){.page{max-width:620px;margin:auto}}`}</style>
  </main>;
}
