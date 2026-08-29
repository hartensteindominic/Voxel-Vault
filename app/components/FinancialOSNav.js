'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  APP_DOCK,
  SIMPLE_PROPERTY_DOCK,
  dockItemForPath,
  isOrganizedUserRoute,
  isSimplePropertyRoute,
  simplePropertyDockItemForPath,
} from '../../lib/product-map';

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;
  // The property maker intentionally stays ultra-condensed; its large actions are its navigation.
  if (pathname === '/property') return null;
  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return (
    <>
      <div aria-hidden="true" className="vvDockSpacer" />
      <nav aria-label="Voxel Vault primary navigation" className={`vvDock ${simple ? 'vvDockSimple' : ''}`} style={{ gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))` }}>
        {dock.map((item) => {
          const selected = item.id === active.id;
          return (
            <Link key={item.id} href={item.href} aria-current={selected ? 'page' : undefined} className={`vvDockItem ${selected ? 'vvDockItemActive' : ''}`}>
              <span className="vvDockIcon" aria-hidden="true">{item.icon}</span>
              <b className="vvDockLabel">{item.label}</b>
            </Link>
          );
        })}
      </nav>
      <style jsx global>{`
        .vvDockSpacer{height:calc(90px + env(safe-area-inset-bottom))}.vvDock{position:fixed;z-index:90;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(600px,calc(100vw - 18px));display:grid;gap:5px;padding:7px;box-sizing:border-box;border:1px solid rgba(75,48,89,.13);border-radius:25px;background:rgba(255,252,247,.92);box-shadow:0 20px 58px rgba(50,29,61,.20),0 1px 0 rgba(255,255,255,.95) inset;backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,sans-serif}.vvDockSimple{width:min(480px,calc(100vw - 18px))}.vvDockItem{position:relative;min-width:0;min-height:55px;display:grid;place-items:center;align-content:center;gap:3px;padding:5px 3px;border-radius:18px;color:#756b79;text-decoration:none;border:1px solid transparent;touch-action:manipulation;overflow:hidden}.vvDockItem:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(124,77,255,.08),rgba(202,255,89,.08));opacity:0;transition:opacity .15s ease}.vvDockItemActive{color:#fff;border-color:rgba(87,43,204,.24);background:linear-gradient(160deg,#8557ff,#6734e8);box-shadow:0 4px 0 #4d20be,0 9px 20px rgba(103,52,232,.24)}.vvDockItemActive:before{opacity:1}.vvDockIcon,.vvDockLabel{position:relative;z-index:1}.vvDockIcon{min-width:29px;height:27px;padding:0 6px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:1000;letter-spacing:-.04em;color:#766d7c;background:rgba(105,78,118,.07)}.vvDockItemActive .vvDockIcon{color:#31420f;background:#caff59;box-shadow:0 2px 0 rgba(85,119,13,.18)}.vvDockLabel{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:9px;line-height:1.05;white-space:nowrap}.vvDockItemActive .vvDockLabel{color:#fff}@media(hover:hover){.vvDockItem:hover:not(.vvDockItemActive){background:rgba(124,77,255,.055);color:#4c3d54}}@media(max-width:520px){.vvDock{bottom:max(7px,env(safe-area-inset-bottom));width:calc(100vw - 12px);gap:2px;padding:5px;border-radius:22px}.vvDockSimple{width:calc(100vw - 12px)}.vvDockItem{min-height:52px;border-radius:16px;padding-inline:1px}.vvDockIcon{min-width:25px;height:24px;font-size:9px;padding:0 4px}.vvDockLabel{font-size:8px}.vvDockSpacer{height:calc(82px + env(safe-area-inset-bottom))}}
      `}</style>
    </>
  );
}
