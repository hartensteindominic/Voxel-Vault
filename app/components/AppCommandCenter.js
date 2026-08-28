'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_DOCK, APP_SECTIONS, isOrganizedUserRoute } from '../../lib/product-map';

const CORE = APP_DOCK.map((item) => ({
  id: `dock-${item.id}`,
  href: item.href,
  label: item.label,
  icon: item.icon,
  badge: 'CORE',
  description: item.id === 'home' ? 'The Voxel Vault front door.' : `Open ${item.label}.`,
  section: 'Core',
}));

const ALL = [
  ...CORE,
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
  const visible = isOrganizedUserRoute(pathname);

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
    if (!open) return;
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
    <button className="vvCommandButton" type="button" onClick={() => setOpen(true)} aria-label="Search Voxel Vault">
      <span>⌕</span><b>SEARCH</b>
    </button>
    {open ? <div className="vvCommandBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="vvCommandPanel" role="dialog" aria-modal="true" aria-label="Voxel Vault command center">
        <header>
          <div><small>SPATIAL OS · COMMAND CENTER</small><b>Go anywhere.</b></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close command center">×</button>
        </header>
        <label className="vvCommandSearch">
          <span>⌕</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Earth, Meshy, AI, Vault, Invest…" />
          <kbd>ESC</kbd>
        </label>
        <div className="vvCommandMeta"><span>{results.length} RESULT{results.length === 1 ? '' : 'S'}</span><span>⌘K / CTRL K</span></div>
        <div className="vvCommandResults">
          {results.length ? results.map((item) => <Link href={item.href} key={`${item.id}-${item.href}`} className="vvCommandResult">
            <span className="vvCommandIcon">{item.icon || '→'}</span>
            <span className="vvCommandCopy"><b>{item.label}</b><small>{item.description}</small></span>
            <span className="vvCommandBadge">{item.badge || item.section || 'OPEN'}</span>
          </Link>) : <div className="vvCommandEmpty"><b>NO MATCH</b><span>Try “Earth”, “Meshy”, “AI”, “property”, “income”, “Forge” or “capture”.</span></div>}
        </div>
        <footer><span>Search is navigation only. It never executes trades, mints, Meshy generations or property actions.</span><Link href="/more">OPEN FULL DIRECTORY →</Link></footer>
      </section>
    </div> : null}
    <style jsx global>{`
      .vvCommandButton{position:fixed;z-index:89;right:max(12px,env(safe-area-inset-right));bottom:calc(82px + max(18px,env(safe-area-inset-bottom)));height:39px;padding:0 12px;border-radius:14px;border:1px solid rgba(173,236,215,.18);background:rgba(5,10,9,.86);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 12px 36px rgba(0,0,0,.3);color:#eafff9;display:flex;align-items:center;gap:7px;font:900 8px/1 Inter,system-ui,sans-serif;letter-spacing:.11em;touch-action:manipulation}.vvCommandButton span{font-size:18px;font-weight:500}.vvCommandBackdrop{position:fixed;inset:0;z-index:9998;padding:max(18px,env(safe-area-inset-top)) 12px max(18px,env(safe-area-inset-bottom));display:grid;place-items:start center;background:rgba(0,4,5,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.vvCommandPanel{margin-top:min(8vh,72px);width:min(680px,100%);max-height:min(78vh,760px);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(174,238,217,.16);border-radius:26px;background:linear-gradient(180deg,rgba(14,23,21,.98),rgba(5,10,10,.99));box-shadow:0 30px 90px rgba(0,0,0,.58);color:#f1faf7;font-family:Inter,system-ui,-apple-system,sans-serif}.vvCommandPanel>header{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 12px}.vvCommandPanel>header div{display:grid;gap:4px}.vvCommandPanel>header small{font-size:7px;letter-spacing:.16em;color:#9ff5df}.vvCommandPanel>header b{font-size:20px;letter-spacing:-.03em}.vvCommandPanel>header button{width:38px;height:38px;border-radius:13px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#fff;font-size:23px}.vvCommandSearch{margin:0 14px;min-height:54px;border:1px solid rgba(159,245,223,.17);border-radius:17px;background:rgba(255,255,255,.055);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:0 13px}.vvCommandSearch>span{font-size:21px;color:#9ff5df}.vvCommandSearch input{min-width:0;border:0;outline:0;background:transparent;color:#fff;font:700 14px/1.2 Inter,system-ui,sans-serif}.vvCommandSearch input::placeholder{color:#6f807b}.vvCommandSearch kbd{border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:5px 6px;color:#71807c;background:rgba(0,0,0,.2);font-size:7px}.vvCommandMeta{display:flex;justify-content:space-between;padding:10px 18px 7px;color:#5e716b;font-size:7px;font-weight:900;letter-spacing:.12em}.vvCommandResults{padding:0 10px 10px;overflow:auto;overscroll-behavior:contain}.vvCommandResult{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px;border-radius:15px;color:inherit;text-decoration:none;border:1px solid transparent}.vvCommandResult:hover,.vvCommandResult:focus-visible{outline:0;border-color:rgba(159,245,223,.15);background:rgba(159,245,223,.065)}.vvCommandIcon{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:rgba(159,245,223,.08);color:#b9ffed;font-weight:950}.vvCommandCopy{min-width:0;display:grid;gap:3px}.vvCommandCopy b{font-size:11px}.vvCommandCopy small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#788984;font-size:8px}.vvCommandBadge{border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:6px 7px;color:#869691;font-size:6px;font-weight:950;letter-spacing:.08em}.vvCommandEmpty{padding:28px;text-align:center;display:grid;gap:7px}.vvCommandEmpty b{font-size:10px;letter-spacing:.14em}.vvCommandEmpty span{color:#73837e;font-size:9px}.vvCommandPanel>footer{display:flex;justify-content:space-between;gap:16px;padding:12px 17px 15px;border-top:1px solid rgba(255,255,255,.06);color:#62736e;font-size:7px;line-height:1.5}.vvCommandPanel>footer a{color:#a9f8e4;text-decoration:none;white-space:nowrap;font-weight:900}@media(max-width:640px){.vvCommandButton{right:10px;bottom:calc(78px + max(12px,env(safe-area-inset-bottom)));height:36px;padding:0 10px}.vvCommandButton b{display:none}.vvCommandPanel{margin-top:3vh;max-height:84vh;border-radius:22px}.vvCommandCopy small{max-width:55vw}.vvCommandPanel>footer{display:grid}.vvCommandPanel>footer a{justify-self:start}}
    `}</style>
  </>;
}
