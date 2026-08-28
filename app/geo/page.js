'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import BuffaloCalibratedReferenceModel from './BuffaloCalibratedReferenceModel';
import styles from './page.module.css';

const STARTER_AMOUNTS = [5, 10, 25, 50];
const VIEW_MODES = [
  { id: 'orbit', label: 'Orbit', icon: '✦', hint: 'Best overall view' },
  { id: 'street', label: 'Street', icon: '⌂', hint: 'Lower angle' },
  { id: 'top', label: 'Top', icon: '◎', hint: 'Footprint view' },
];

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

function starterStateLabel(result) {
  if (!result) return 'Not checked yet';
  if (result.state === 'provider_handoff_ready') return 'Provider checkout ready';
  if (result.state === 'below_provider_minimum') return 'Building toward minimum';
  if (result.state === 'provider_minimum_unknown') return 'Minimum not verified';
  if (result.state === 'provider_requirements_pending') return 'Provider requirements pending';
  return 'Goal only · no ownership yet';
}

function humanHeight(reference) {
  const status = reference?.height?.heightStatus;
  if (status === 'source_reported') return 'Source-reported height';
  if (status === 'derived_from_levels') return 'Height estimated from reported floors';
  if (status === 'illustrative_default') return 'Illustrative height';
  return 'Height still being verified';
}

export default function GeoPage() {
  const [form, setForm] = useState({ address: '1047 Kensington Avenue, Buffalo, NY 14215', latitude: '', longitude: '', countryCode: 'US', subdivisionCode: 'NY', countyCode: 'ERIE', pin: '', sbl: '90.32-8-4' });
  const [result, setResult] = useState(null);
  const [buffaloReference, setBuffaloReference] = useState(null);
  const [message, setMessage] = useState('1047 Kensington is loaded as the GEO calibration property. Tap See in 3D to resolve its current sources.');
  const [busy, setBusy] = useState(false);
  const [factBusy, setFactBusy] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [goal, setGoal] = useState({ targetDollars: '100000', savedDollars: '0', contributionDollars: '10' });
  const [goalResult, setGoalResult] = useState(null);
  const [starterAmount, setStarterAmount] = useState('10');
  const [starterBusy, setStarterBusy] = useState(false);
  const [starterResult, setStarterResult] = useState(null);
  const [cash, setCash] = useState({ settledDollars: '0', pendingDollars: '0', projectedDollars: '0', requestedDollars: '0' });
  const [cashResult, setCashResult] = useState(null);
  const [viewMode, setViewMode] = useState('orbit');
  const [resetKey, setResetKey] = useState(0);

  const reference = result?.globalReference || null;
  const authoritativeTwin = result?.authoritativeEvidence?.twin || null;
  const hasRenderableBuilding = Boolean(reference?.found || authoritativeTwin?.structure?.buildingGeometry);
  const factReport = result?.factCheck || null;
  const readiness = result?.readiness || null;
  const offering = result?.investmentOffering || null;
  const factRows = useMemo(() => Array.isArray(factReport?.facts) ? factReport.facts.slice(0, 10) : [], [factReport]);
  const activeView = VIEW_MODES.find((mode) => mode.id === viewMode) || VIEW_MODES[0];

  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function intake(event) {
    event?.preventDefault?.();
    setBusy(true);
    setStarterResult(null);
    setBuffaloReference(null);
    setMessage('Finding the place and checking its sources…');
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      };
      const response = await fetch('/api/geo/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'GEO intake failed.');

      let cityCalibration = null;
      const countyRecord = data.authoritativeEvidence?.countyRecord || null;
      const isBuffaloParcel = String(countyRecord?.municipality || '').toUpperCase().includes('BUFFALO');
      if (isBuffaloParcel && (countyRecord?.sbl || countyRecord?.pin || form.sbl || form.pin)) {
        try {
          const cityResponse = await fetch('/api/geo/buffalo-reference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sbl: countyRecord?.sbl || form.sbl, pin: countyRecord?.pin || form.pin }),
          });
          const cityData = await cityResponse.json().catch(() => ({}));
          if (cityResponse.ok && cityData?.ok && cityData?.result?.found) cityCalibration = cityData.result;
        } catch {
          cityCalibration = null;
        }
      }

      setBuffaloReference(cityCalibration);
      setResult(data);
      setViewMode('orbit');
      setResetKey((value) => value + 1);
      setMessage(data.authoritativeEvidence?.twin?.structure?.buildingGeometry
        ? cityCalibration?.found
          ? 'Found it ✦ Erie parcel-linked building geometry plus current Buffalo assessment calibration loaded. Story count and material class improve the render without pretending they are a measured architectural survey.'
          : 'Found it ✦ Parcel-linked building geometry plus neighborhood context loaded. Height stays separate until it is source-backed or measured.'
        : data.authoritativeEvidence
          ? 'Found the parcel ✦ Local evidence loaded, but a parcel-linked building footprint is not verified yet.'
          : data.globalReference?.found
            ? 'Found it ✦ A source-backed 3D building reference is ready. Local parcel verification is still pending or unavailable here.'
            : 'Place found, but no source building footprint was returned. GEO left it empty instead of making one up.');
    } catch (error) {
      setResult(null);
      setBuffaloReference(null);
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
      setMessage(`Fact Check finished ✦ ${data.report.verdict}`);
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

  async function checkStarterInvestment() {
    setStarterBusy(true);
    try {
      const toCents = (value) => Math.round(Number(value || 0) * 100);
      const response = await fetch('/api/geo/ownership-goal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'starter_investment',
          amountCents: toCents(starterAmount),
          providerMinimumCents: Number.isFinite(Number(offering?.minimumCents)) ? Number(offering.minimumCents) : 0,
          providerOfferingVerified: offering?.verified === true,
          providerExecutionReady: offering?.executionReady === true,
          userEligible: offering?.userEligible === true,
          userAuthorizedPurchase: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Starter investment check failed.');
      setStarterResult(data.result);
      setMessage(data.result.canOpenProviderCheckout
        ? 'This amount fits the attached verified offering. Checkout can be next; ownership still needs position verification.'
        : data.result.nextStep);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Starter investment check failed.'); }
    finally { setStarterBusy(false); }
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
        <Link className={styles.brand} href="/geo"><span className={styles.brandOrb}>✦</span> GEO</Link>
        <div className={styles.navLinks}><Link href="/vault/earth">Explore</Link><Link href="/vault">My Vault</Link><Link href="/real-estate/property/erie-618-main">Evidence demo</Link></div>
      </nav>

      <section className={styles.hero}>
        <article className={styles.heroCopy}>
          <div className={styles.kicker}>A little world for real places</div>
          <h1>Find a place.<br/><em>See what’s real.</em></h1>
          <p className={styles.lead}>Search an address and GEO builds a source-backed 3D view around it. Then you can check the facts, save toward it, or see whether a real investment offering exists.</p>

          <form onSubmit={intake} className={styles.heroSearch}>
            <div className={styles.heroSearchInput}><span>⌕</span><input aria-label="Property address" value={form.address} onChange={(e) => change('address', e.target.value)} placeholder="Search an address…" /></div>
            <button className={styles.searchButton} disabled={busy}>{busy ? 'Finding it…' : 'See in 3D'}</button>
          </form>

          <div className={styles.miniSteps}>
            <div><span>1</span><b>Search</b><small>any address</small></div>
            <div><span>2</span><b>Explore</b><small>the 3D world</small></div>
            <div><span>3</span><b>Check</b><small>facts & rights</small></div>
          </div>

          <details className={styles.advanced}>
            <summary>Advanced parcel details</summary>
            <div className={styles.formGrid}>
              <div className={styles.field}><label>Latitude</label><input inputMode="decimal" value={form.latitude} onChange={(e)=>change('latitude',e.target.value)} placeholder="optional"/></div>
              <div className={styles.field}><label>Longitude</label><input inputMode="decimal" value={form.longitude} onChange={(e)=>change('longitude',e.target.value)} placeholder="optional"/></div>
              <div className={styles.field}><label>Country</label><input value={form.countryCode} onChange={(e)=>change('countryCode',e.target.value)} placeholder="US"/></div>
              <div className={styles.field}><label>State / region</label><input value={form.subdivisionCode} onChange={(e)=>change('subdivisionCode',e.target.value)} placeholder="NY"/></div>
              <div className={styles.field}><label>County / jurisdiction</label><input value={form.countyCode} onChange={(e)=>change('countyCode',e.target.value)} placeholder="ERIE"/></div>
              <div className={styles.field}><label>SBL</label><input value={form.sbl} onChange={(e)=>change('sbl',e.target.value)} placeholder="if known"/></div>
              <div className={`${styles.field} ${styles.fieldWide}`}><label>Parcel PIN</label><input value={form.pin} onChange={(e)=>change('pin',e.target.value)} placeholder="if known"/></div>
            </div>
          </details>

          <div className={`${styles.status} ${message.toLowerCase().includes('failed') ? styles.error : ''}`}>{message}</div>
        </article>

        <aside className={styles.modelCard} aria-label="GEO 3D property viewer">
          <BuffaloCalibratedReferenceModel reference={reference} authoritativeTwin={authoritativeTwin} buffaloReference={buffaloReference} addressLabel={form.address} viewMode={viewMode} resetKey={resetKey}/>
          <div className={styles.modelTopRow}>
            <div className={styles.modelTopBadge}>{buffaloReference?.found ? '✦ Parcel + Buffalo calibration' : authoritativeTwin?.structure?.buildingGeometry ? '✦ Parcel-linked building' : reference?.found ? '✦ Source-backed geometry' : '✦ 3D preview'}</div>
            <button className={styles.resetView} onClick={() => setResetKey((value) => value + 1)} type="button" aria-label="Reset 3D view" title="Reset view">↺</button>
          </div>
          <div className={styles.viewControls} role="group" aria-label="3D camera view">
            {VIEW_MODES.map((mode) => <button key={mode.id} type="button" aria-pressed={viewMode === mode.id} title={mode.hint} className={`${styles.viewButton} ${viewMode === mode.id ? styles.viewButtonActive : ''}`} onClick={() => setViewMode(mode.id)}><span>{mode.icon}</span>{mode.label}</button>)}
          </div>
          <div className={styles.modelMeta}>
            <div className={styles.modelIdentity}><small>{hasRenderableBuilding ? 'Selected property' : 'Search to begin'}</small><strong>{reference?.tags?.name || form.address || 'Search a property'}</strong></div>
            <div className={styles.modelContext}>
              <span>{hasRenderableBuilding ? buffaloReference?.found ? `${buffaloReference.stories || '?'} stories · ${buffaloReference.exteriorWallDescription || buffaloReference.buildingStyleDescription || 'Buffalo assessment calibrated'}` : authoritativeTwin?.structure?.buildingGeometry && !reference?.measuredHeight?.verifiedMeasuredHeight ? 'Parcel footprint · height not yet measured' : humanHeight(reference) : activeView.hint}</span>
              <span className={styles.gestureHint}>{hasRenderableBuilding ? 'Drag to orbit · pinch to zoom' : 'Orbit, Street and Top keep the scene easy to inspect.'}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.truthStrip}>
        <div><span className={styles.truthIcon}>⌂</span><p><b>3D</b><small>{readiness?.threeD?.label || 'Waiting for a place'}</small></p></div>
        <div><span className={styles.truthIcon}>✓</span><p><b>Facts</b><small>{factReport?.verdict || 'Ready to check sources'}</small></p></div>
        <div><span className={styles.truthIcon}>$</span><p><b>Investing</b><small>{readiness?.investment?.label || 'Only through a verified offering'}</small></p></div>
      </section>

      <section className={styles.grid}>
        <article className={`${styles.panel} ${styles.friendlyPanel}`}>
          <div className={styles.cardIcon}>✓</div>
          <div className={styles.kicker}>Fact Check</div><h2>What do we actually know?</h2>
          <p>Every property fact keeps its source. A map shape, tax assessment, listing price and legal ownership are not treated as the same thing.</p>
          <div className={styles.metrics}>
            <div className={styles.metric}><small>Verified source</small><strong>{factReport?.authoritativeFactCount ?? 0}</strong></div>
            <div className={styles.metric}><small>Source reported</small><strong>{factReport?.sourceReportedFactCount ?? 0}</strong></div>
            <div className={styles.metric}><small>Needs review</small><strong>{factReport?.hasConflict ? 'Yes' : 'No'}</strong></div>
          </div>
          <div className={styles.factRows}>{factRows.length ? factRows.map((fact,index)=><div className={styles.fact} key={`${fact.field}-${index}`}><b>{fact.label}</b><span className={statusClass(fact.status)}>{fact.status.replaceAll('_',' ')}</span></div>) : <div className={styles.emptyState}>Search a place and its source cards will show up here.</div>}</div>
          <div className={styles.actions}><button className={styles.secondary} onClick={factCheck} disabled={!factRows.length||factBusy}>{factBusy?'Checking…':'Run Fact Check'}</button>{reference?.source?.sourceUrl ? <a className={styles.sourceLink} href={reference.source.sourceUrl} target="_blank" rel="noreferrer">View map source ↗</a> : null}</div>
        </article>

        <article className={`${styles.panel} ${styles.friendlyPanel}`}>
          <div className={styles.cardIcon}>$</div>
          <div className={styles.kicker}>Start small</div><h2>Pick an amount that feels comfortable.</h2>
          <p>GEO first checks whether this property has a verified offering and whether that offering actually supports your amount. If not, it simply stays a goal.</p>
          <div className={styles.presetRow}>
            {STARTER_AMOUNTS.map((amount)=><button key={amount} type="button" className={`${styles.preset} ${Number(starterAmount)===amount ? styles.presetActive : ''}`} onClick={()=>setStarterAmount(String(amount))}>${amount}</button>)}
          </div>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>Or enter your own amount</label><input inputMode="decimal" value={starterAmount} onChange={(e)=>setStarterAmount(e.target.value)} placeholder="10"/></div>
          </div>
          <button className={`${styles.button} ${styles.fullButton}`} onClick={checkStarterInvestment} disabled={starterBusy}>{starterBusy?'Checking offering…':`Check $${starterAmount || '0'}`}</button>
          <div className={styles.investmentState}>
            <small>Right now</small><strong>{starterStateLabel(starterResult)}</strong>
            <span>{starterResult?.providerMinimumKnown ? `Verified provider minimum: ${dollars(starterResult.providerMinimumCents)}. ` : ''}{starterResult?.nextStep || 'No verified offering is attached yet, so no money moves and no ownership is created.'}</span>
          </div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={`${styles.panel} ${styles.friendlyPanel}`}>
          <div className={styles.cardIcon}>♡</div>
          <div className={styles.kicker}>Property goal</div><h2>Save toward a place you like.</h2>
          <p>This is a savings-style goal inside GEO. It can track progress without pretending that saving money already bought a share.</p>
          <form onSubmit={calculateGoal} className={styles.formGrid}>
            <div className={styles.field}><label>Property target $</label><input inputMode="decimal" value={goal.targetDollars} onChange={(e)=>setGoal({...goal,targetDollars:e.target.value})}/></div>
            <div className={styles.field}><label>Already saved $</label><input inputMode="decimal" value={goal.savedDollars} onChange={(e)=>setGoal({...goal,savedDollars:e.target.value})}/></div>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>Add to goal $</label><input inputMode="decimal" value={goal.contributionDollars} onChange={(e)=>setGoal({...goal,contributionDollars:e.target.value})}/></div>
            <button className={`${styles.button} ${styles.fieldWide}`} disabled={goalBusy}>{goalBusy?'Updating…':'Update my goal'}</button>
          </form>
          {goalResult ? <div className={styles.goalResult}><strong>{dollars(goalResult.nextSavedCents)} saved toward {dollars(goalResult.targetPropertyPriceCents)}</strong><p>{goalResult.progressPercent.toFixed(4)}% complete · {dollars(goalResult.remainingCents)} to go. This goal does not create ownership.</p><div className={styles.goalBar}><div className={styles.goalFill} style={{width:`${Math.max(.2,Math.min(100,goalResult.progressPercent))}%`}}/></div></div> : null}
        </article>

        <article className={`${styles.panel} ${styles.friendlyPanel}`}>
          <div className={styles.cardIcon}>↗</div>
          <div className={styles.kicker}>Money controls</div><h2>Only use money that really settled.</h2>
          <p>Projected rent or paper gains stay separate. GEO only unlocks withdrawal or reinvestment when a real provider confirms settled money and the rail is ready.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}><label>Settled $</label><input inputMode="decimal" value={cash.settledDollars} onChange={(e)=>setCash({...cash,settledDollars:e.target.value})}/></div>
            <div className={styles.field}><label>Pending $</label><input inputMode="decimal" value={cash.pendingDollars} onChange={(e)=>setCash({...cash,pendingDollars:e.target.value})}/></div>
            <div className={styles.field}><label>Projected $</label><input inputMode="decimal" value={cash.projectedDollars} onChange={(e)=>setCash({...cash,projectedDollars:e.target.value})}/></div>
            <div className={styles.field}><label>Amount to use $</label><input inputMode="decimal" value={cash.requestedDollars} onChange={(e)=>setCash({...cash,requestedDollars:e.target.value})}/></div>
          </div>
          <div className={styles.twoActions}><button className={styles.secondary} onClick={()=>cashAction('withdraw')}>Can I withdraw?</button><button className={styles.secondary} onClick={()=>cashAction('reinvest')}>Can I reinvest?</button></div>
          {cashResult ? <div className={styles.status}><b>{cashResult.canExecute?'Ready':'Locked'}</b> · available now {dollars(cashResult.availableNowCents)}. {cashResult.blockers?.join(' · ') || cashResult.note}</div> : null}
        </article>
      </section>

      <section className={`${styles.panel} ${styles.journey}`}>
        <div className={styles.cardIcon}>✦</div>
        <div className={styles.kicker}>The simple version</div><h2>How GEO gets from “interesting place” to “real ownership.”</h2>
        <div className={styles.flow}>
          <div className={styles.step}><small>01</small><b>Explore</b><span>See the source-backed 3D place and its facts.</span></div>
          <div className={styles.step}><small>02</small><b>Start small</b><span>Pick an amount or build a goal without pretending it bought a share.</span></div>
          <div className={styles.step}><small>03</small><b>Use a real offering</b><span>Only continue when provider, minimum and eligibility checks pass.</span></div>
          <div className={styles.step}><small>04</small><b>Verify ownership</b><span>The badge changes only after the legal position is independently verified.</span></div>
        </div>
        <p className={styles.disclaimer}><b>Why GEO is careful:</b> a beautiful 3D model, an NFT, a map polygon or a checkout screen cannot replace a deed or create legal property rights by themselves.</p>
      </section>

      <footer className={styles.footer}>GEO is a working name inside Voxel Vault. Global map geometry is reference data, not a cadastral survey. Buffalo assessment characteristics may calibrate rendering but are not a current architectural survey. Investment availability, minimums, income and liquidity depend on the actual legal offering and provider.</footer>
    </div>
  </main>;
}
