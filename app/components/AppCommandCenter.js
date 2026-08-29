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
    }).filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 16)
      .map((row) => row.item);
  }, [query]);

  useEffect(() => {
    if (!visible) return undefined;
    const keydown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        setOpen(true);
      }
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
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [pathname]);

  if (!visible) return null;

  return <>
    <button className="vvCommandButton" type="button" onClick={() => setOpen(true)} aria-label="Search advanced Voxel Vault tools">⌕</button>
    {open ? <div className="vvCommandBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="vvCommandPanel" role="dialog" aria-modal="true" aria-label="Advanced Voxel Vault tools">
        <header><div><small>ADVANCED TOOLS</small><b>Find a tool.</b></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <label className="vvCommandSearch"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search advanced tools…"/></label>
        <div className="vvCommandResults">
          {results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`}><span>{item.icon || '→'}</span><div><b>{item.label}</b><small>{item.description}</small></div></Link>)}
        </div>
        <footer><span>Navigation only. No trades, mints or property actions happen from search.</span><Link href="/more">FULL DIRECTORY →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(82px + max(18px,env(safe-area-inset-bottom)));width:38px;height:38px;border-radius:13px;border:1px solid rgba(173,236,215,.18);background:rgba(5,10,9,.86);color:#eafff9;font-size:18px;backdrop-filter:blur(18px)}.vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:18px 12px;display:grid;place-items:start center;background:rgba(0,4,5,.72);backdrop-filter:blur(14px)}.vvCommandPanel{margin-top:min(8vh,72px);width:min(650px,100%);max-height:78vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(174,238,217,.16);border-radius:24px;background:#08100e;color:#f1faf7;font-family:Inter,system-ui,sans-serif}.vvCommandPanel header{display:flex;align-items:center;justify-content:space-between;padding:17px}.vvCommandPanel header div{display:grid;gap:4px}.vvCommandPanel header small{font-size:7px;letter-spacing:.14em;color:#9ff5df}.vvCommandPanel header b{font-size:20px}.vvCommandPanel header button{width:36px;height:36px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#111916;color:#fff;font-size:22px}.vvCommandSearch{margin:0 13px 10px;min-height:50px;border:1px solid rgba(159,245,223,.15);border-radius:15px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:0 12px;background:rgba(255,255,255,.04)}.vvCommandSearch input{border:0;outline:0;background:transparent;color:#fff;font:700 13px Inter,system-ui,sans-serif}.vvCommandResults{padding:0 9px 10px;overflow:auto}.vvCommandResults>a{display:grid;grid-template-columns:38px 1fr;gap:9px;align-items:center;padding:9px;border-radius:13px;color:inherit;text-decoration:none}.vvCommandResults>a:hover{background:rgba(159,245,223,.06)}.vvCommandResults>a>span{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:rgba(159,245,223,.07);color:#b9ffed}.vvCommandResults>a div{display:grid;gap:2px}.vvCommandResults b{font-size:10px}.vvCommandResults small{color:#71827c;font-size:8px}.vvCommandPanel footer{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.06);color:#60716a;font-size:7px}.vvCommandPanel footer a{color:#a9f8e4;text-decoration:none;font-weight:900}@media(max-width:640px){.vvCommandPanel{margin-top:3vh;max-height:84vh}.vvCommandPanel footer{display:grid}}
    `}</style>
  </>;
}
