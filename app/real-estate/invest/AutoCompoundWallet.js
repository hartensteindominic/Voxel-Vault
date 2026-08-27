'use client';

import { useMemo, useState } from 'react';
import { buildFractionalPlan, simulateDailyAutoCompound } from '../../../lib/real-estate/fractional-compound-engine';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export default function AutoCompoundWallet() {
  const [capital, setCapital] = useState(1000);
  const plan = useMemo(() => buildFractionalPlan({ capital }), [capital]);
  const simulation = useMemo(() => simulateDailyAutoCompound({ capital, years: 5 }), [capital]);
  const finalYear = simulation.timeline.at(-1);

  return (
    <div style={{display:'grid',gap:18}}>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
        <article style={card}>
          <div style={label}>AUTO-COMPOUND WALLET · SIMULATION</div>
          <div style={{fontSize:'clamp(2.8rem,8vw,5.8rem)',fontWeight:950,letterSpacing:'-.07em',margin:'8px 0'}}>{money.format(capital)}</div>
          <p style={muted}>Start with fractional property interests instead of waiting for enough cash to buy an entire house. The demo keeps a 10% reserve and diversifies the rest across eligible property shares.</p>
          <input aria-label="Starting capital" type="range" min="250" max="5000" step="50" value={capital} onChange={(e)=>setCapital(Number(e.target.value))} style={{width:'100%',marginTop:10}} />
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{[500,1000,2000,5000].map(v=><button key={v} type="button" onClick={()=>setCapital(v)} style={chip}>{money.format(v)}</button>)}</div>
        </article>

        <article style={card}>
          <div style={label}>FIRST ALLOCATION</div>
          <div style={stats}>
            <Stat title="Protected reserve" value={money.format(plan.protectedReserve)} />
            <Stat title="Property value" value={money.format(plan.investedValue)} />
            <Stat title="Reinvest wallet" value={money.format(plan.reinvestmentWallet)} />
            <Stat title="Projected net rent" value={`${money.format(plan.monthlyNetIncome)}/mo`} />
          </div>
          <p style={{...muted,marginTop:14}}>Illustrative only. Demo yields, share prices and fees are assumptions, not live marketplace quotes.</p>
        </article>
      </section>

      <section style={card}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap'}}>
          <div><div style={label}>3D PROPERTY PORTFOLIO</div><h2 style={heading}>Own slices of several buildings.</h2></div>
          <span style={{...chip,color:'#b8ff55',borderColor:'rgba(184,255,85,.35)'}}>BLOCKCHAIN LEDGER · PROVIDER NOT CONNECTED</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,marginTop:18}}>
          {plan.holdings.map((holding,index)=><article key={holding.id} style={{border:'1px solid rgba(255,255,255,.10)',borderRadius:20,padding:16,background:'rgba(255,255,255,.035)'}}>
            <div style={{height:110,borderRadius:16,display:'grid',placeItems:'center',fontSize:48,background:'linear-gradient(145deg,rgba(184,255,85,.13),rgba(255,255,255,.025))'}}>{['🏠','🏢','🏘️','🏡','🏬'][index%5]}</div>
            <small style={{display:'block',marginTop:13,opacity:.55,fontWeight:900,letterSpacing:'.08em'}}>{holding.id}</small>
            <h3 style={{margin:'5px 0 2px',fontSize:18}}>{holding.label}</h3>
            <div style={{fontSize:13,opacity:.62}}>{holding.market}</div>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:13}}><span>{holding.shares} shares</span><b>{money.format(holding.positionValue)}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:6,fontSize:13,opacity:.7}}><span>Demo net yield</span><b>{pct.format(holding.netYield)}</b></div>
          </article>)}
        </div>
      </section>

      <section style={card}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap'}}>
          <div><div style={label}>DAILY RENT → NEXT SHARE</div><h2 style={heading}>Revenue keeps working.</h2></div>
          <div style={{textAlign:'right'}}><small style={{opacity:.55}}>5-year demo economic value</small><strong style={{display:'block',fontSize:28}}>{money.format(finalYear?.totalEconomicValue || capital)}</strong></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:18}}>
          {simulation.timeline.map(row=><div key={row.year} style={{border:'1px solid rgba(255,255,255,.09)',borderRadius:16,padding:14}}><small style={{opacity:.5}}>YEAR {row.year}</small><b style={{display:'block',fontSize:21,margin:'5px 0'}}>{money.format(row.totalEconomicValue)}</b><span style={{fontSize:12,opacity:.65}}>{row.autoPurchases} automatic share buys · {money.format(row.annualNetIncome)}/yr modeled rent</span></div>)}
        </div>
        <div style={{marginTop:18,padding:16,borderRadius:16,border:'1px solid rgba(184,255,85,.2)',background:'rgba(184,255,85,.06)'}}>
          <b>Auto-compound rule:</b> collect net distributions into the reinvestment wallet; when enough cash exists for an eligible share plus fees, purchase the highest-ranked share that stays inside the diversification limit. If nothing qualifies, keep cash.
        </div>
      </section>

      <section style={{...card,borderColor:'rgba(255,190,90,.28)'}}>
        <div style={label}>LIVE EXECUTION GATE</div>
        <h2 style={heading}>No hidden spending.</h2>
        <p style={muted}>This build does not connect to a brokerage, tokenized-property marketplace, bank account or wallet signer. A production adapter must use the provider's authorized API/custody flow, investor eligibility rules and explicit account permissions before any purchase or reinvestment can occur.</p>
        <button type="button" disabled style={{marginTop:14,border:0,borderRadius:14,padding:'13px 18px',fontWeight:950,opacity:.55,cursor:'not-allowed'}}>LIVE AUTO-INVEST · LOCKED</button>
      </section>
    </div>
  );
}

function Stat({title,value}){return <div><small style={{opacity:.55}}>{title}</small><strong style={{display:'block',fontSize:23,marginTop:4}}>{value}</strong></div>}
const card={border:'1px solid rgba(255,255,255,.12)',borderRadius:26,padding:'clamp(18px,4vw,28px)',background:'rgba(255,255,255,.045)',boxShadow:'0 24px 80px rgba(0,0,0,.18)'};
const label={fontSize:12,fontWeight:900,letterSpacing:'.13em',opacity:.58};
const muted={opacity:.68,lineHeight:1.6,margin:'8px 0 0'};
const heading={fontSize:'clamp(1.8rem,4vw,3rem)',letterSpacing:'-.045em',margin:'7px 0 0'};
const stats={display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:15,marginTop:18};
const chip={border:'1px solid rgba(255,255,255,.14)',borderRadius:999,padding:'8px 11px',fontWeight:850,background:'transparent',color:'inherit',cursor:'pointer'};
