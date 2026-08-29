'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_DOCK, APP_SECTIONS, isOrganizedUserRoute, isSimplePropertyRoute } from '../../lib/product-map';

const ALL = [
  ...APP_DOCK.map((item) => ({ ...item, description: `Open ${item.label}.`, badge: 'CORE', section: 'Core' })),
  ...APP_SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title }))),
];

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export default function AppCommandCenter() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const visible = isOrganizedUserRoute(pathname) && !isSimplePropertyRoute(pathname);

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return ALL.slice(0, 12);
    const words = needle.split(/\s+/).filter(Boolean);
    return ALL.map((item) => {
      const haystack = normalize(`${item.label} ${item.description} ${item.badge} ${item.section}`);
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { item, score };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label)).slice(0, 16).map((row) => row.item);
  }, [query]);

  useEffect(() => {
    if (!visible) return undefined;
    const keydown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((value) => !value); return; }
      if (!typing && event.key === '/') { event.preventDefault(); setOpen(true); }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [visible]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(timer); document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => { setOpen(false); setQuery(''); }, [pathname]);
  if (!visible) return null;

  return <>
    <button className="vvCommandButton" type="button" onClick={() => setOpen(true)} aria-label="Search advanced Voxel Vault tools">⌕</button>
    {open ? <div className="vvCommandBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="vvCommandPanel" role="dialog" aria-modal="true" aria-label="Advanced Voxel Vault tools">
        <header><div><small>VOXEL VAULT · MORE</small><b>Find a tool</b><span>Advanced features stay out of the main flow until you need them.</span></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <label className="vvCommandSearch"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, wallet, AI, admin…"/></label>
        <div className="vvCommandResults">{results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`}><span>{item.icon || '→'}</span><div><b>{item.label}</b><small>{item.description}</small></div><em>{item.badge || item.section}</em></Link>)}</div>
        <footer><span>Search is navigation only. It never executes trades, mints, Meshy generations or property actions.</span><Link href="/more">OPEN DIRECTORY →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(86px + max(17px,env(safe-area-inset-bottom)));width:42px;height:42px;border-radius:14px;border:1px solid #dfd7e2;background:rgba(255,252,246,.96);color:#6341c7;font-size:20px;box-shadow:0 9px 24px rgba(66,44,78,.14);backdrop-filter:blur(18px)}
      .vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:18px 12px;display:grid;place-items:start center;background:rgba(38,27,42,.35);backdrop-filter:blur(12px)}
      .vvCommandPanel{margin-top:min(8vh,72px);width:min(650px,100%);max-height:78vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid #e4dce7;border-radius:28px;background:linear-gradient(180deg,#fffdf8,#fff8ec);color:#291f2e;box-shadow:0 30px 80px rgba(58,39,68,.24);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .vvCommandPanel header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 19px 13px}.vvCommandPanel header div{display:grid;gap:4px}.vvCommandPanel header small{font-size:8px;letter-spacing:.15em;color:#6d42db;font-weight:1000}.vvCommandPanel header b{font-size:25px;letter-spacing:-.04em}.vvCommandPanel header span{font-size:10px;line-height:1.45;color:#807581}.vvCommandPanel header button{width:38px;height:38px;border:1px solid #e2d9e5;border-radius:13px;background:#fff;color:#6e6471;font-size:23px;box-shadow:0 5px 13px rgba(61,42,72,.07)}
      .vvCommandSearch{margin:0 14px 11px;min-height:52px;border:2px solid #e4dbe6;border-radius:17px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:0 13px;background:#fff}.vvCommandSearch span{color:#6e42d8;font-size:19px}.vvCommandSearch input{border:0;outline:0;background:transparent;color:#2b2130;font:750 13px Inter,system-ui,sans-serif}.vvCommandSearch:focus-within{border-color:#ac92ef;box-shadow:0 0 0 4px #f0ebff}
      .vvCommandResults{padding:0 9px 11px;overflow:auto}.vvCommandResults>a{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-radius:16px;color:inherit;text-decoration:none;border:1px solid transparent}.vvCommandResults>a:hover{background:#f4ffe2;border-color:#d8efad}.vvCommandResults>a>span{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#eee8ff;color:#6640cc;font-weight:1000}.vvCommandResults>a div{display:grid;gap:2px;min-width:0}.vvCommandResults b{font-size:11px}.vvCommandResults small{color:#817681;font-size:9px;line-height:1.35}.vvCommandResults em{font-style:normal;font-size:7px;font-weight:1000;letter-spacing:.08em;color:#537221;background:#e9f8ca;border-radius:999px;padding:5px 7px;white-space:nowrap}
      .vvCommandPanel footer{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid #ebe3e8;color:#817681;font-size:8px;background:#fffdf9}.vvCommandPanel footer a{color:#6540c9;text-decoration:none;font-weight:1000}@media(max-width:640px){.vvCommandPanel{margin-top:3vh;max-height:84vh}.vvCommandPanel footer{display:grid}.vvCommandResults>a{grid-template-columns:38px 1fr}.vvCommandResults em{display:none}}
    `}</style>
  </>;
}
