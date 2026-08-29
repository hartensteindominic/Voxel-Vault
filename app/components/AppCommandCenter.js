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
        <header><div><small>JUMP ANYWHERE</small><b>What are you looking for?</b></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <label className="vvCommandSearch"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Voxel Vault…"/></label>
        <div className="vvCommandResults">
          {results.length ? results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`}><span>{item.icon || '→'}</span><div><b>{item.label}</b><small>{item.description}</small></div><em>{item.badge}</em></Link>) : <div className="vvCommandEmpty"><span>✦</span><b>No matching tool yet.</b><small>Try a simpler word like property, create, vault, AI, or invest.</small></div>}
        </div>
        <footer><span>Search is navigation only. It never executes trades, mints, Meshy generations or property actions.</span><Link href="/more">FULL DIRECTORY →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(86px + max(18px,env(safe-area-inset-bottom)));width:42px;height:42px;border-radius:14px;border:1px solid #ded4ef;background:rgba(255,250,240,.95);color:#6731e5;font-size:19px;font-weight:1000;box-shadow:0 12px 30px rgba(83,55,123,.16);backdrop-filter:blur(18px)}.vvCommandButton:hover{transform:translateY(-2px);background:#fff}.vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:18px 12px;display:grid;place-items:start center;background:rgba(32,20,46,.26);backdrop-filter:blur(14px)}.vvCommandPanel{margin-top:min(8vh,72px);width:min(660px,100%);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid #e3dced;border-radius:28px;background:#fffaf0;color:#171221;box-shadow:0 32px 90px rgba(57,35,88,.24);font-family:Inter,ui-rounded,system-ui,sans-serif}.vvCommandPanel header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px}.vvCommandPanel header div{display:grid;gap:4px}.vvCommandPanel header small{font-size:8px;letter-spacing:.15em;color:#7138f5;font-weight:1000}.vvCommandPanel header b{font-size:22px;letter-spacing:-.035em}.vvCommandPanel header button{width:38px;height:38px;border:1px solid #e4dfea;border-radius:13px;background:#fff;color:#6b6271;font-size:22px;box-shadow:0 6px 16px rgba(83,55,123,.07)}.vvCommandSearch{margin:0 14px 12px;min-height:54px;border:2px solid #ddd4e8;border-radius:18px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:0 14px;background:#fff}.vvCommandSearch:focus-within{border-color:#9f82f7;box-shadow:0 0 0 5px #ece5ff}.vvCommandSearch>span{color:#7138f5;font-weight:1000}.vvCommandSearch input{min-width:0;border:0;outline:0;background:transparent;color:#171221;font:800 14px Inter,system-ui,sans-serif}.vvCommandSearch input::placeholder{color:#9a929f}.vvCommandResults{padding:0 10px 12px;overflow:auto}.vvCommandResults>a{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-radius:16px;color:inherit;text-decoration:none}.vvCommandResults>a:hover{background:#f3edff}.vvCommandResults>a>span{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#eee8ff;color:#6531df;font-weight:1000}.vvCommandResults>a div{display:grid;gap:2px}.vvCommandResults b{font-size:12px}.vvCommandResults small{color:#827a88;font-size:9px;line-height:1.35}.vvCommandResults em{font-style:normal;padding:6px 7px;border-radius:999px;background:#efffb6;color:#52681c;font-size:6px;font-weight:1000;letter-spacing:.08em}.vvCommandEmpty{margin:8px;padding:24px;display:grid;justify-items:center;gap:5px;border:1px dashed #d9ceea;border-radius:19px;text-align:center;background:#fff}.vvCommandEmpty>span{font-size:22px;color:#7138f5}.vvCommandEmpty b{font-size:13px}.vvCommandEmpty small{max-width:360px;color:#8a828f;font-size:10px;line-height:1.5}.vvCommandPanel footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid #e8e2eb;color:#817987;font-size:8px;line-height:1.4;background:#fff}.vvCommandPanel footer a{color:#6630e9;text-decoration:none;font-weight:1000;white-space:nowrap}@media(max-width:640px){.vvCommandPanel{margin-top:2vh;max-height:86vh;border-radius:24px}.vvCommandPanel header b{font-size:20px}.vvCommandResults>a{grid-template-columns:40px minmax(0,1fr)}.vvCommandResults em{display:none}.vvCommandPanel footer{display:grid}.vvCommandButton{right:10px}}
    `}</style>
  </>;
}
