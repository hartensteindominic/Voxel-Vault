'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function IntelligenceLab() {
  const [query, setQuery] = useState('Help me understand this product, its source, and its digital collectible.');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const research = async () => {
    setLoading(true); setAnswer('');
    try { const r = await fetch('/api/ai/research', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({query}) }); const d=await r.json(); setAnswer(d.answer || d.error || 'No result.'); }
    catch { setAnswer('Research service unavailable.'); } finally { setLoading(false); }
  };
  return <main className="page"><header><Link href="/">‹ Vault</Link><div><small>VOXEL VAULT</small><h1>Vault AI</h1></div><span>AI</span></header>
    <section className="hero"><small>PRODUCT + COLLECTION INTELLIGENCE</small><h2>Understand what<br/><em>you collect.</em></h2><p>Research product sources, summarize provenance, compare listings, and explain the digital collectible attached to a physical purchase.</p></section>
    <section className="card"><label>AI RESEARCH</label><textarea value={query} onChange={e=>setQuery(e.target.value)} maxLength={1200}/><button onClick={research} disabled={loading}>{loading?'Researching…':'Research current information →'}</button>{answer&&<article className="answer">{answer}</article>}</section>
    <section className="card"><label>VAULT AI CAPABILITIES</label><div className="chips"><span>🌐 Product research</span><span>🧠 Collection intelligence</span><span>🧊 3D asset planning</span><span>🔗 Provenance analysis</span><span>🛡️ Safety gates</span></div></section>
    <footer><Link href="/">Find</Link><Link href="/receipt">Scan</Link><Link href="/room">Vault</Link></footer>
    <style jsx>{`.page{min-height:100vh;background:#05060b;color:#f6f7fb;padding:0 16px 38px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page header{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}header a{color:#fff;text-decoration:none;font-size:10px}header>span{font-size:9px;color:#8d7fff}header div{text-align:center}header small,.card>label,.hero>small{font-size:7px;letter-spacing:.17em;color:#9d8cff;font-weight:900}h1{font-size:18px;margin:4px 0}.hero{padding:32px 0 18px}.hero h2{font-size:39px;line-height:.93;letter-spacing:-.06em;margin:9px 0}.hero em{font-style:normal;color:#a894ff}.hero p,.card p{font-size:10px;line-height:1.55;color:#7e889b}.card{border:1px solid rgba(255,255,255,.09);border-radius:21px;background:rgba(255,255,255,.035);padding:17px;margin-bottom:11px}.card textarea{display:block;width:100%;min-height:110px;margin:10px 0;padding:12px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:#080a11;color:#eef1f7;resize:vertical;outline:none;font:12px/1.45 inherit}.card button{width:100%;border:0;border-radius:13px;padding:13px;background:#f5f6f9;color:#08090d;font-weight:900;font-size:10px}.card button:disabled{opacity:.5}.answer{white-space:pre-wrap;margin-top:12px;padding:13px;border-radius:14px;background:#080a11;border:1px solid rgba(255,255,255,.07);font-size:10px;line-height:1.6;color:#cbd1dd;max-height:480px;overflow:auto}.quantum h3{font-size:18px;margin:8px 0}.states{margin-top:14px;display:grid;gap:10px}.states>div{display:grid;grid-template-columns:50px 48px 1fr;align-items:center;gap:8px;font-size:10px}.states b{text-align:right}.states i{height:7px;border-radius:99px;background:#151823;overflow:hidden}.states u{display:block;height:100%;background:linear-gradient(90deg,#806cff,#5ce1ff);border-radius:99px;text-decoration:none}.note{display:block;margin-top:10px;color:#667084;font-size:8px;line-height:1.4}.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.chips span{padding:8px 9px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#cbd1dc;font-size:8px}footer{display:flex;justify-content:center;gap:22px;margin-top:20px}footer a{color:#687184;text-decoration:none;font-size:9px}@media(min-width:700px){.page{max-width:680px;margin:auto}}`}</style>
  </main>;
}
