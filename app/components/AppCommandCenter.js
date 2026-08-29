'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_DOCK, APP_SECTIONS, isOrganizedUserRoute, isSimplePropertyRoute } from '../../lib/product-map';

const ALL = [...APP_DOCK.map((item) => ({ ...item, description: `Open ${item.label}.`, badge: 'CORE', section: 'Core' })), ...APP_SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })))];
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
    return ALL.map((item) => ({ item, score: words.reduce((total, word) => total + (normalize(`${item.label} ${item.description} ${item.badge} ${item.section}`).includes(word) ? 1 : 0), 0) })).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label)).slice(0, 16).map((row) => row.item);
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
    <button className="vvCommandButton" type="button" onClick={() => setOpen(true)} aria-label="Search Voxel Vault tools">✦</button>
    {open ? <div className="vvCommandBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="vvCommandPanel" role="dialog" aria-modal="true" aria-label="Voxel Vault tools">
        <header><div><small>✦ VOXEL VAULT</small><b>What do you want to do?</b></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <label className="vvCommandSearch"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search create, property, wallet, NFT…"/></label>
        <div className="vvCommandResults">{results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`}><span>{item.icon || '→'}</span><div><b>{item.label}</b><small>{item.description}</small></div><i>›</i></Link>)}</div>
        <footer><span>Opening a tool never automatically spends money, mints an NFT, or starts a paid 3D generation.</span><Link href="/more">ALL TOOLS →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(92px + max(18px,env(safe-area-inset-bottom)));width:44px;height:44px;border-radius:15px;border:1px solid #d9cff0;background:linear-gradient(180deg,#fff,#f5efff);color:#7138f5;font-size:17px;font-weight:1000;box-shadow:0 10px 28px rgba(73,43,94,.17),0 3px 0 #ddd1f6;backdrop-filter:blur(18px)}
      .vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:18px 12px;display:grid;place-items:start center;background:rgba(39,25,47,.34);backdrop-filter:blur(16px)}
      .vvCommandPanel{margin-top:min(8vh,72px);width:min(650px,100%);max-height:78vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(83,55,102,.13);border-radius:30px;background:linear-gradient(180deg,#fffefb,#fff8ec);color:#1d1722;box-shadow:0 28px 90px rgba(45,27,57,.25);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .vvCommandPanel header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 15px}.vvCommandPanel header div{display:grid;gap:4px}.vvCommandPanel header small{font-size:8px;letter-spacing:.14em;color:#7138f5;font-weight:1000}.vvCommandPanel header b{font-size:23px;letter-spacing:-.035em}.vvCommandPanel header button{width:38px;height:38px;border:1px solid #e2dce6;border-radius:13px;background:#fff;color:#5f5564;font-size:22px}
      .vvCommandSearch{margin:0 14px 12px;min-height:54px;border:1px solid #ddd4e8;border-radius:17px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:0 14px;background:#fff;box-shadow:0 7px 20px rgba(70,45,85,.06)}.vvCommandSearch span{color:#7138f5}.vvCommandSearch input{border:0;outline:0;background:transparent;color:#241c29;font:750 13px Inter,system-ui,sans-serif}
      .vvCommandResults{padding:0 9px 11px;overflow:auto}.vvCommandResults>a{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:16px;color:inherit;text-decoration:none}.vvCommandResults>a:hover{background:#f5efff}.vvCommandResults>a>span{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#eee7ff;color:#6738d8;font-weight:1000}.vvCommandResults>a div{display:grid;gap:2px}.vvCommandResults b{font-size:11px}.vvCommandResults small{color:#847a88;font-size:9px;line-height:1.35}.vvCommandResults i{font-style:normal;color:#aaa0ad;font-size:22px}
      .vvCommandPanel footer{display:flex;justify-content:space-between;gap:12px;padding:13px 17px;border-top:1px solid #e9e1e8;color:#8c828f;font-size:8px;line-height:1.4}.vvCommandPanel footer a{color:#6630e9;text-decoration:none;font-weight:1000;white-space:nowrap}@media(max-width:640px){.vvCommandPanel{margin-top:3vh;max-height:84vh;border-radius:26px}.vvCommandPanel footer{display:grid}.vvCommandPanel header b{font-size:20px}}
    `}</style>
  </>;
}
