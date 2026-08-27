'use client';

import { useMemo, useState } from 'react';
import { buildAcquisitionPlan, demoAssetCatalog, futureAssetAdapters, simulateReinvestment } from '../../lib/real-estate/global-asset-engine';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export default function CapitalCompoundingDemo() {
  const [capital, setCapital] = useState(10000);
  const plan = useMemo(() => buildAcquisitionPlan({ capital, reserveFloor: 0.1 }), [capital]);
  const simulation = useMemo(() => simulateReinvestment({ capital, years: 8 }), [capital]);
  const finalYear = simulation.timeline.at(-1);

  return (
    <div style={{display:'grid',gap:18}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>
        <div style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:24,padding:22,background:'rgba(255,255,255,.05)'}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:'.13em',opacity:.65}}>PROFILE CAPITAL · SIMULATION</div>
          <div style={{fontSize:'clamp(2.6rem,7vw,5rem)',fontWeight:950,letterSpacing:'-.06em',margin:'8px 0 18px'}}>{money.format(capital)}</div>
          <input
            aria-label="Simulated profile capital"
            type="range"
            min="500"
            max="50000"
            step="500"
            value={capital}
            onChange={(event) => setCapital(Number(event.target.value))}
            style={{width:'100%'}}
          />
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
            {[2000,5000,10000,25000].map((value)=><button key={value} type="button" onClick={()=>setCapital(value)} style={{border:'1px solid rgba(255,255,255,.14)',borderRadius:999,padding:'8px 11px',fontWeight:850,background:'transparent',color:'inherit',cursor:'pointer'}}>{money.format(value)}</button>)}
          </div>
          <p style={{opacity:.7,lineHeight:1.55,margin:'18px 0 0'}}>The engine protects a 10% cash reserve, ranks only eligible demo assets, then allocates the remaining simulated capital by net yield, occupancy, liquidity, price efficiency and operating risk.</p>
        </div>

        <div style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:24,padding:22,background:'rgba(255,255,255,.05)'}}>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:'.13em',opacity:.65}}>FIRST ACQUISITION CYCLE</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:14}}>
            <div><small style={{opacity:.58}}>Protected reserve</small><strong style={{display:'block',fontSize:24,marginTop:3}}>{money.format(plan.protectedReserve)}</strong></div>
            <div><small style={{opacity:.58}}>Capital deployed</small><strong style={{display:'block',fontSize:24,marginTop:3}}>{money.format(plan.spent)}</strong></div>
            <div><small style={{opacity:.58}}>Projected net rent</small><strong style={{display:'block',fontSize:24,marginTop:3}}>{money.format(plan.monthlyNetRent)}/mo</strong></div>
            <div><small style={{opacity:.58}}>Assets acquired</small><strong style={{display:'block',fontSize:24,marginTop:3}}>{plan.purchases.length}</strong></div>
          </div>
          <div style={{display:'grid',gap:9,marginTop:18}}>
            {plan.purchases.length ? plan.purchases.map((asset)=><div key={asset.id} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'12px 0',borderTop:'1px solid rgba(255,255,255,.1)'}}><div><b>{asset.label}</b><div style={{fontSize:12,opacity:.6,marginTop:2}}>{asset.assetClass} · {asset.market}</div></div><div style={{textAlign:'right'}}><b>{money.format(asset.acquisitionCost)}</b><div style={{fontSize:12,opacity:.6,marginTop:2}}>{pct.format(asset.netYield)} net yield</div></div></div>) : <div style={{padding:'18px 0',opacity:.65}}>No demo asset fits the deployable balance yet. Capital remains protected instead of forcing a bad purchase.</div>}
          </div>
        </div>
      </div>

      <div style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:24,padding:22,background:'rgba(255,255,255,.05)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'end',flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:12,fontWeight:900,letterSpacing:'.13em',opacity:.65}}>COMPOUND LOOP · 8-YEAR DEMO</div>
            <h3 style={{fontSize:'clamp(1.8rem,4vw,3rem)',letterSpacing:'-.04em',margin:'7px 0 0'}}>Rent becomes the next asset.</h3>
          </div>
          <div style={{textAlign:'right'}}><small style={{opacity:.58}}>Ending demo cash</small><strong style={{display:'block',fontSize:25}}>{money.format(finalYear?.endingCash || capital)}</strong></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:18}}>
          {simulation.timeline.map((row)=><div key={row.year} style={{border:'1px solid rgba(255,255,255,.09)',borderRadius:16,padding:14}}><small style={{opacity:.55}}>YEAR {row.year}</small><b style={{display:'block',fontSize:20,margin:'5px 0'}}>{row.ownedCount} assets</b><span style={{fontSize:13,opacity:.7}}>{money.format(row.annualNetRent)} net rent/yr</span></div>)}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:18}}>
          {futureAssetAdapters.map((adapter)=><span key={adapter.id} style={{border:'1px solid rgba(255,255,255,.11)',borderRadius:999,padding:'8px 11px',fontSize:12,fontWeight:800,opacity:adapter.status==='pilot'?1:.65}}>{adapter.label} · {adapter.status}</span>)}
        </div>
        <p style={{opacity:.64,lineHeight:1.55,margin:'16px 0 0'}}>This is intentionally a sandbox model, not a forecast. Live purchases, pooled investing, rent collection and reinvestment remain disabled until each asset class, jurisdiction, custody/payment flow and legal structure is production-approved.</p>
      </div>
    </div>
  );
}
