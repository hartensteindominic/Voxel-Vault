'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function marketCount(data) {
  return [data?.licensedMarketMedia?.bridgeConfigured, data?.licensedMarketMedia?.domainConfigured].filter(Boolean).length;
}

export default function HomeCapabilityStrip() {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/world-atlas/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok || !payload?.ok) throw new Error('Capability status unavailable');
        setData(payload);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => { active = false; };
  }, []);

  const marketFeeds = useMemo(() => marketCount(data), [data]);
  const rows = [
    {
      id: 'world',
      label: 'WORLD DATA',
      value: data?.worldAtlas?.configured ? 'READY' : state === 'loading' ? 'CHECKING' : 'UNAVAILABLE',
      detail: data?.worldAtlas?.configured ? 'Overture + OSM fallback' : 'Source-backed atlas status',
      href: '/vault/earth',
      good: Boolean(data?.worldAtlas?.configured),
    },
    {
      id: 'street',
      label: 'OPEN STREET',
      value: data?.openStreetReality?.configured ? 'READY · FREE' : state === 'loading' ? 'CHECKING' : 'UNAVAILABLE',
      detail: data?.openStreetReality?.configured ? `${data.openStreetReality.provider} · ${data.openStreetReality.license}` : 'Open street imagery status',
      href: '/vault/earth',
      good: Boolean(data?.openStreetReality?.configured),
    },
    {
      id: 'meshy',
      label: 'MESHY 7',
      value: data?.meshy?.configured ? 'READY · MANUAL' : state === 'loading' ? 'CHECKING' : 'NOT CONNECTED',
      detail: data?.meshy?.configured ? 'Explicit generation only · no auto-spend' : 'Server API key required for generation',
      href: '/vault/earth',
      good: Boolean(data?.meshy?.configured),
    },
    {
      id: 'market',
      label: 'MARKET FEEDS',
      value: state === 'loading' ? 'CHECKING' : marketFeeds ? `${marketFeeds} CONNECTED` : 'AWAITING ACCESS',
      detail: marketFeeds ? 'Authorized listing providers available' : 'Map coverage remains independent',
      href: '/real-estate/reits',
      good: marketFeeds > 0,
    },
  ];

  return <section className="homeCapability" aria-label="Voxel Vault live capabilities">
    <div className="homeCapabilityHead">
      <div><small>LIVE APP READINESS</small><b>What is actually connected.</b></div>
      <Link href="/more">ALL TOOLS →</Link>
    </div>
    <div className="homeCapabilityGrid">
      {rows.map((row) => <Link href={row.href} key={row.id} className="homeCapabilityCard">
        <span className={`homeCapabilityDot ${row.good ? 'good' : ''}`} aria-hidden="true"/>
        <span className="homeCapabilityCopy"><small>{row.label}</small><b>{row.value}</b><em>{row.detail}</em></span>
        <span className="homeCapabilityArrow">→</span>
      </Link>)}
    </div>
    <p>Readiness is configuration status, not a promise of market inventory, legal ownership, investment availability or AI-generation rights. No API keys or secret values are exposed here.</p>
    <style jsx global>{`
      .homeCapability{width:min(1180px,calc(100% - 32px));margin:0 auto 36px;padding:16px;border:1px solid rgba(159,245,223,.13);border-radius:24px;background:linear-gradient(180deg,rgba(11,19,17,.82),rgba(6,11,10,.9));box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:Inter,system-ui,-apple-system,sans-serif;color:#edf7f3}.homeCapabilityHead{display:flex;align-items:end;justify-content:space-between;gap:16px;padding:2px 3px 13px}.homeCapabilityHead div{display:grid;gap:4px}.homeCapabilityHead small{font-size:7px;font-weight:900;letter-spacing:.15em;color:#83d9c2}.homeCapabilityHead b{font-size:17px;letter-spacing:-.025em}.homeCapabilityHead a{color:#9ff5df;text-decoration:none;font-size:8px;font-weight:900;letter-spacing:.08em}.homeCapabilityGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.homeCapabilityCard{min-width:0;min-height:80px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(255,255,255,.035);color:inherit;text-decoration:none}.homeCapabilityCard:hover,.homeCapabilityCard:focus-visible{background:rgba(159,245,223,.065);border-color:rgba(159,245,223,.18)}.homeCapabilityDot{width:8px;height:8px;border-radius:50%;background:#8a715d;box-shadow:0 0 0 4px rgba(138,113,93,.1)}.homeCapabilityDot.good{background:#79efbc;box-shadow:0 0 14px rgba(121,239,188,.34)}.homeCapabilityCopy{min-width:0;display:grid;gap:3px}.homeCapabilityCopy small{font-size:6.5px;font-weight:900;letter-spacing:.11em;color:#81948e}.homeCapabilityCopy b{font-size:10px}.homeCapabilityCopy em{font-style:normal;font-size:7px;line-height:1.35;color:#697a75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.homeCapabilityArrow{color:#78918a;font-size:14px}.homeCapability>p{margin:10px 3px 0;color:#61726d;font-size:7px;line-height:1.5}@media(max-width:820px){.homeCapabilityGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.homeCapability{width:calc(100% - 20px);padding:10px;border-radius:20px}.homeCapabilityHead{align-items:center;padding:5px 5px 11px}.homeCapabilityHead b{font-size:14px}.homeCapabilityGrid{grid-template-columns:1fr 1fr;gap:6px}.homeCapabilityCard{min-height:72px;padding:9px;grid-template-columns:auto minmax(0,1fr)}.homeCapabilityArrow{display:none}.homeCapabilityCopy em{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
    `}</style>
  </section>;
}
