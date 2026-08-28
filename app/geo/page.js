'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import GeoReferenceModel from './GeoReferenceModel';
import styles from './page.module.css';

function dollars(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100);
}

function statusClass(status) {
  if (status === 'verified_authoritative') return styles.verified;
  if (status === 'conflict') return styles.conflict;
  return '';
}

export default function GeoPage() {
  const [form, setForm] = useState({ address: '618 Main Street, Buffalo, NY', latitude: '', longitude: '', countryCode: 'US', subdivisionCode: 'NY', countyCode: 'ERIE', pin: '', sbl: '111.38-3-8' });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Add a property. GEO will fetch live reference geometry and use a jurisdiction parcel source when one is supported.');
  const [busy, setBusy] = useState(false);
  const [factBusy, setFactBusy] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [goal, setGoal] = useState({ targetDollars: '100000', savedDollars: '0', contributionDollars: '0.01' });
  const [goalResult, setGoalResult] = useState(null);
  const [cash, setCash] = useState({ settledDollars: '0', pendingDollars: '0', projectedDollars: '0', requestedDollars: '0' });
  const [cashResult, setCashResult] = useState(null);

  const reference = result?.globalReference || null;
  const factReport = result?.factCheck || null;
  const readiness = result?.readiness || null;
  const factRows = useMemo(() => Array.isArray(factReport?.facts) ? factReport.facts.slice(0, 12) : [], [factReport]);

  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function intake(event) {
    event?.preventDefault?.();
    setBusy(true);
    setMessage('Checking global geometry and any supported authoritative parcel source…');
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      };
      const response = await fetch('/api/geo/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'GEO intake failed.');
      setResult(data);
      setMessage(data.authoritativeEvidence
        ? 'Global reference + jurisdiction evidence loaded. Ownership is still a separate legal check.'
        : data.globalReference?.found
          ? 'Source-backed global building reference loaded. Jurisdiction parcel verification is still pending or unsupported for this location.'
          : 'Location loaded, but no nearby source building footprint was returned. GEO did not invent one.');
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : 'GEO intake failed.');
    } finally { setBusy(false); }
  }

  async function factCheck() {
    if (!factReport?.facts) return;
    setFactBusy(true);
    try {
      const response = await fetch('/api/geo/fact-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: factReport.propertyId, facts: factReport.facts }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Fact check failed.');
      setResult((current) => ({ ...current, factCheck: data.report }));
      setMessage(`Fact Check complete: ${data.report.verdict}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Fact check failed.'); }
    finally { setFactBusy(false); }
  }

  async function calculateGoal(event) {
    event?.preventDefault?.();
    setGoalBusy(true);
    try {
      const toCents = (value) => Math.round(Number(value || 0) * 100);
      const response = await fetch('/api/geo/ownership-goal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'goal', targetPropertyPriceCents: toCents(goal.targetDollars), savedCents: toCents(goal.savedDollars), contributionCents: toCents(goal.contributionDollars) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Property goal could not be calculated.');
      setGoalResult(data.result);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Property goal failed.'); }
    finally { setGoalBusy(false); }
  }

  async function cashAction(action) {
    try {
      const toCents = (value) => Math.round(Number(value || 0) * 100);
      const response = await fetch('/api/geo/ownership-goal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cash_action', action,
          settledCashCents: toCents(cash.settledDollars), pendingCashCents: toCents(cash.pendingDollars), projectedIncomeCents: toCents(cash.projectedDollars), requestedCents: toCents(cash.requestedDollars),
          providerWithdrawalsReady: false, providerReinvestmentReady: false, userOptIn: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Cash readiness check failed.');
      setCashResult(data.result);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cash readiness check failed.'); }
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/geo">GEO</Link>
        <div className={styles.navLinks}><Link href="/vault/earth">EXPLORE EARTH</Link><Link href="/vault">VAULT</Link><Link href="/real-estate/property/erie-618-main">618 MAIN</Link></div>
      </nav>

      <section className={styles.hero}>
        <article className={styles.heroCopy}>
          <div className={styles.kicker}>GEO · WORKING NAME · GLOBAL PROPERTY LAYER</div>
          <h1>See the property.<br/><em>Know what is real.</em></h1>
          <p className={styles.lead}>Add a property anywhere. GEO looks up a real global building reference on demand, upgrades to authoritative parcel evidence where a jurisdiction adapter exists, and keeps 3D truth, investment rights, and title ownership separate.</p>
          <div className={styles.truthLine}>
            <span className={styles.pill}>{readiness?.threeD?.label || '3D SOURCE CHECK'}</span>
            <span className={styles.pill}>{readiness?.investment?.label || 'PROPERTY GOAL FROM $0.01'}</span>
            <span className={styles.pill}>{factReport?.verdict || 'FACT CHECK READY'}</span>
          </div>
          <p className={styles.disclaimer}><span className={styles.brandPending}>Brand note:</span> GEO is a working name, not a claim of trademark clearance. Property investment availability, minimums, resale, withdrawals, and reinvestment depend on the actual legal offering and provider.</p>
        </article>
        <aside className={styles.modelCard}>
          <GeoReferenceModel reference={reference}/>
          <div className={styles.modelMeta}><strong>{reference?.found ? 'LIVE 3D REFERENCE' : '3D SOURCE AREA'}</strong><span>{reference?.found ? `${reference.height?.heightStatus?.replaceAll('_',' ')} · ${Number(reference.distanceMeters || 0).toFixed(1)} m from lookup point` : 'No fake building is substituted when source geometry is missing.'}</span></div>
        </aside>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.kicker}>ADD A PROPERTY</div><h2>Download the evidence around it.</h2>
          <p>Use an address anywhere. Coordinates are optional. For Erie County you can also provide the official PIN or SBL to trigger the stricter county parcel path.</p>
          <form onSubmit={intake} className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>ADDRESS</label><input value={form.address} onChange={(e)=>change('address',e.target.value)} placeholder="Address, city, region, country"/></div>
            <div className={styles.field}><label>LATITUDE · OPTIONAL</label><input inputMode="decimal" value={form.latitude} onChange={(e)=>change('latitude',e.target.value)} placeholder="42.8908"/></div>
            <div className={styles.field}><label>LONGITUDE · OPTIONAL</label><input inputMode="decimal" value={form.longitude} onChange={(e)=>change('longitude',e.target.value)} placeholder="-78.8731"/></div>
            <div className={styles.field}><label>COUNTRY</label><input value={form.countryCode} onChange={(e)=>change('countryCode',e.target.value)} placeholder="US"/></div>
            <div className={styles.field}><label>STATE / REGION</label><input value={form.subdivisionCode} onChange={(e)=>change('subdivisionCode',e.target.value)} placeholder="NY"/></div>
            <div className={styles.field}><label>COUNTY / JURISDICTION</label><input value={form.countyCode} onChange={(e)=>change('countyCode',e.target.value)} placeholder="ERIE"/></div>
            <div className={styles.field}><label>SBL · IF KNOWN</label><input value={form.sbl} onChange={(e)=>change('sbl',e.target.value)} placeholder="111.38-3-8"/></div>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>PIN · IF KNOWN</label><input value={form.pin} onChange={(e)=>change('pin',e.target.value)} placeholder="Official parcel PIN"/></div>
            <div className={`${styles.actions} ${styles.fieldWide}`}><button className={styles.button} disabled={busy}>{busy?'CHECKING SOURCES…':'ADD TO GEO'}</button><Link className={styles.secondary} href="/vault/earth">BROWSE LIVE LISTINGS</Link></div>
          </form>
          <div className={`${styles.status} ${message.toLowerCase().includes('failed') ? styles.error : ''}`}>{message}</div>
        </article>

        <article className={styles.panel}>
          <div className={styles.kicker}>FACT CHECK</div><h2>Every fact keeps its source.</h2>
          <p>GEO does not flatten asking prices, tax assessments, community map geometry, title records, and user claims into one fake “truth” score.</p>
          <div className={styles.metrics}>
            <div className={styles.metric}><small>AUTHORITATIVE</small><strong>{factReport?.authoritativeFactCount ?? 0}</strong></div>
            <div className={styles.metric}><small>SOURCE-REPORTED</small><strong>{factReport?.sourceReportedFactCount ?? 0}</strong></div>
            <div className={styles.metric}><small>CONFLICT</small><strong>{factReport?.hasConflict ? 'YES' : 'NO'}</strong></div>
          </div>
          <div className={styles.factRows}>{factRows.length ? factRows.map((fact,index)=><div className={styles.fact} key={`${fact.field}-${index}`}><b>{fact.label}</b><span className={statusClass(fact.status)}>{fact.status.replaceAll('_',' ')}</span></div>) : <div className={styles.status}>Add a property to build its source ledger.</div>}</div>
          <div className={styles.actions}><button className={styles.secondary} onClick={factCheck} disabled={!factRows.length||factBusy}>{factBusy?'CHECKING…':'FACT CHECK'}</button>{reference?.source?.sourceUrl ? <a className={styles.sourceLink} href={reference.source.sourceUrl} target="_blank" rel="noreferrer">OPEN GEOMETRY SOURCE ↗</a> : null}</div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.kicker}>OWNERSHIP GOAL</div><h2>Start with one penny.</h2>
          <p>The first penny is a savings/acquisition goal, not fake fractional ownership. When a property has a verified legal offering, the regulated purchase can become a separate next step.</p>
          <form onSubmit={calculateGoal} className={styles.formGrid}>
            <div className={styles.field}><label>TARGET PROPERTY $</label><input inputMode="decimal" value={goal.targetDollars} onChange={(e)=>setGoal({...goal,targetDollars:e.target.value})}/></div>
            <div className={styles.field}><label>ALREADY SAVED $</label><input inputMode="decimal" value={goal.savedDollars} onChange={(e)=>setGoal({...goal,savedDollars:e.target.value})}/></div>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>ADD TO GOAL $ · MINIMUM 0.01</label><input inputMode="decimal" value={goal.contributionDollars} onChange={(e)=>setGoal({...goal,contributionDollars:e.target.value})}/></div>
            <button className={`${styles.button} ${styles.fieldWide}`} disabled={goalBusy}>{goalBusy?'CALCULATING…':'BUILD MY PROPERTY GOAL'}</button>
          </form>
          {goalResult ? <div className={styles.goalResult}><strong>{dollars(goalResult.nextSavedCents)} toward {dollars(goalResult.targetPropertyPriceCents)}</strong><p>{goalResult.progressPercent.toFixed(6)}% progress · {dollars(goalResult.remainingCents)} remaining. No ownership is created by this goal.</p><div className={styles.goalBar}><div className={styles.goalFill} style={{width:`${Math.max(.2,Math.min(100,goalResult.progressPercent))}%`}}/></div></div> : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.kicker}>SETTLED CASH CONTROL</div><h2>Withdraw or compound what actually settled.</h2>
          <p>Projected rent or paper gains never become spendable cash in GEO. A provider must confirm settlement and the withdrawal/reinvestment rail before the button can execute.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}><label>SETTLED $</label><input inputMode="decimal" value={cash.settledDollars} onChange={(e)=>setCash({...cash,settledDollars:e.target.value})}/></div>
            <div className={styles.field}><label>PENDING $</label><input inputMode="decimal" value={cash.pendingDollars} onChange={(e)=>setCash({...cash,pendingDollars:e.target.value})}/></div>
            <div className={styles.field}><label>PROJECTED $</label><input inputMode="decimal" value={cash.projectedDollars} onChange={(e)=>setCash({...cash,projectedDollars:e.target.value})}/></div>
            <div className={styles.field}><label>REQUESTED $</label><input inputMode="decimal" value={cash.requestedDollars} onChange={(e)=>setCash({...cash,requestedDollars:e.target.value})}/></div>
          </div>
          <div className={styles.twoActions}><button className={styles.secondary} onClick={()=>cashAction('withdraw')}>CHECK WITHDRAW</button><button className={styles.secondary} onClick={()=>cashAction('reinvest')}>CHECK REINVEST</button></div>
          {cashResult ? <div className={styles.status}><b>{cashResult.canExecute?'READY':'LOCKED'}</b> · available now {dollars(cashResult.availableNowCents)}. {cashResult.blockers?.join(' · ') || cashResult.note}</div> : null}
        </article>
      </section>

      <section className={styles.panel} style={{marginTop:18}}>
        <div className={styles.kicker}>HOW A DIGITAL ASSET CAN HELP BUY REAL PROPERTY</div><h2>Asset → settled money → property goal → legal ownership rail.</h2>
        <div className={styles.flow}>
          <div className={styles.step}><small>01</small><b>Create / own an asset</b><span>Voxel, NFT, license, or other digital asset remains separate from the real property.</span></div>
          <div className={styles.step}><small>02</small><b>Real proceeds settle</b><span>Only completed sales/income become available cash. A price estimate is not cash.</span></div>
          <div className={styles.step}><small>03</small><b>Fund the property goal</b><span>Start at $0.01 and build toward a purchase or a provider minimum.</span></div>
          <div className={styles.step}><small>04</small><b>Acquire verified rights</b><span>Only deed/title evidence or a verified provider position changes the ownership badge.</span></div>
        </div>
        <p className={styles.disclaimer}>A digital asset can be sold and its settled proceeds can be earmarked toward a property. It should not be marketed as “buy this NFT and you own part of this building” unless the asset is actually part of a legally compliant offering whose documents create and map those rights.</p>
      </section>

      <footer className={styles.footer}>GEO · working name inside Voxel Vault · global reference geometry is not a cadastral survey · 3D reference height may be source-reported, derived, or illustrative and is labeled accordingly · investment availability and liquidity are never guaranteed.</footer>
    </div>
  </main>;
}
