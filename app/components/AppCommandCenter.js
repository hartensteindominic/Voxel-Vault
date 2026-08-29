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
    <button className="vvCommandButton" type="button" onClick={() => setOpen(true)} aria-label="Find Voxel Vault tools">⌕</button>
    {open ? <div className="vvCommandBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="vvCommandPanel" role="dialog" aria-modal="true" aria-label="Find Voxel Vault tools">
        <header><div><small>VOXEL VAULT</small><b>Where do you want to go?</b></div><button type="button" onClick={() => setOpen(false)} aria-label="Close tool finder">×</button></header>
        <label className="vvCommandSearch"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Create, Earth, NFTs, property…"/></label>
        <div className="vvCommandResults">
          {results.length ? results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`}><span>{item.icon || '→'}</span><div><b>{item.label}</b><small>{item.description}</small></div><i>›</i></Link>) : <div className="vvCommandEmpty"><b>No matching tool yet.</b><span>Try “property”, “NFT”, “create”, “Earth”, or “wallet”.</span></div>}
        </div>
        <footer><span>This finder only navigates. It never spends money, mints, trades, or starts a paid 3D generation.</span><Link href="/more">ALL TOOLS →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(84px + max(18px,env(safe-area-inset-bottom)));width:44px;height:44px;border-radius:15px;border:1px solid rgba(77,48,91,.13);background:linear-gradient(145deg,#fffdf9,#f4efff);box-shadow:0 10px 30px rgba(60,35,72,.18),0 1px 0 #fff inset;color:#6734e8;font-size:20px;font-weight:1000;backdrop-filter:blur(18px)}.vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:18px 12px;display:grid;place-items:start center;background:rgba(40,25,48,.38);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}.vvCommandPanel{margin-top:min(8vh,72px);width:min(660px,100%);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(80,51,94,.13);border-radius:29px;background:linear-gradient(160deg,#fffefa,#fff8ef 55%,#f6f0ff);color:#24182b;box-shadow:0 32px 90px rgba(42,24,51,.28);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,sans-serif}.vvCommandPanel header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px}.vvCommandPanel header div{display:grid;gap:4px}.vvCommandPanel header small{font-size:8px;letter-spacing:.16em;color:#7547ef;font-weight:1000}.vvCommandPanel header b{font-size:23px;letter-spacing:-.035em}.vvCommandPanel header button{width:38px;height:38px;border:1px solid rgba(78,52,90,.1);border-radius:13px;background:#fff;color:#675c6b;font-size:22px;box-shadow:0 5px 14px rgba(57,35,67,.08)}.vvCommandSearch{margin:0 14px 12px;min-height:54px;border:1px solid rgba(95,61,112,.13);border-radius:17px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:0 14px;background:#fff;box-shadow:0 8px 24px rgba(61,38,72,.07)}.vvCommandSearch>span{color:#7042ee;font-size:19px}.vvCommandSearch input{min-width:0;border:0;outline:0;background:transparent;color:#281d2e;font:750 14px Inter,ui-rounded,system-ui,sans-serif}.vvCommandSearch input::placeholder{color:#a198a5}.vvCommandResults{padding:0 9px 12px;overflow:auto}.vvCommandResults>a{display:grid;grid-template-columns:42px 1fr auto;gap:11px;align-items:center;padding:10px;border-radius:16px;color:inherit;text-decoration:none}.vvCommandResults>a:hover{background:rgba(124,77,255,.06)}.vvCommandResults>a>span{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#efe8ff,#e5ffd0);color:#6333e6;font-weight:950}.vvCommandResults>a div{display:grid;gap:2px}.vvCommandResults b{font-size:12px}.vvCommandResults small{color:#807582;font-size:9px;line-height:1.35}.vvCommandResults i{font-style:normal;color:#b0a5b3;font-size:20px}.vvCommandEmpty{margin:8px;padding:25px;border:1px dashed rgba(95,61,112,.18);border-radius:18px;text-align:center;display:grid;gap:5px;color:#6e6471}.vvCommandEmpty b{font-size:14px}.vvCommandEmpty span{font-size:10px}.vvCommandPanel footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 18px;border-top:1px solid rgba(80,51,94,.08);color:#8c828f;font-size:8px;line-height:1.4}.vvCommandPanel footer span{max-width:440px}.vvCommandPanel footer a{color:#6734e8;text-decoration:none;font-weight:1000;white-space:nowrap}@media(max-width:640px){.vvCommandPanel{margin-top:2vh;max-height:88vh;border-radius:25px}.vvCommandPanel header{padding:17px 17px 12px}.vvCommandPanel header b{font-size:20px}.vvCommandPanel footer{display:grid}.vvCommandButton{right:10px;width:42px;height:42px}}
    `}</style>
  </>;
}
