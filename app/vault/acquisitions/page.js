import Link from 'next/link';
import { acquisitionPolicy } from '../../../lib/real-estate/acquisition-engine.js';
import {
  buildAcquisitionResearchManifest,
  summarizeAcquisitionResearch,
} from '../../../lib/vault/acquisition-center.js';
import AcquisitionCenterCanvas from './AcquisitionCenterCanvas';

export const metadata = {
  title: 'Acquisition Center | Voxel Vault',
  description: 'Spatial research and diligence view for analysis-only property candidates inside Voxel Vault.',
};

function usd(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function pct(value) {
  const rate = Number(value || 0);
  return `${(Number.isFinite(rate) ? rate : 0) * 100 < 0 ? '-' : ''}${Math.abs((Number.isFinite(rate) ? rate : 0) * 100).toFixed(1)}%`;
}

export default function AcquisitionCenterPage() {
  const candidates = buildAcquisitionResearchManifest();
  const summary = summarizeAcquisitionResearch(candidates);

  return (
    <main className="min-h-screen bg-[#070806] text-white px-4 py-5 md:px-8 md:py-8">
      <section className="max-w-7xl mx-auto">
        <nav className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/vault" className="flex items-center gap-2 no-underline text-white font-black tracking-[-.03em]">
            <span className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center">V</span>
            Voxel Vault
          </Link>
          <div className="flex gap-2 flex-wrap text-xs">
            <Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">My Vault</Link>
            <Link href="/vault/income" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Income Center</Link>
            <Link href="/real-estate/acquire" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Full acquisition analysis</Link>
          </div>
        </nav>

        <header className="pt-16 pb-9 md:pt-24 md:pb-12 max-w-5xl">
          <div className="text-[10px] tracking-[.28em] font-black text-white/40">MY VAULT · ACQUISITION CENTER · DEMO RESEARCH</div>
          <h1 className="text-5xl md:text-8xl font-black tracking-[-.075em] leading-[.86] mt-4">See why a property<br /><span className="text-[#cde8a7]">passes or gets blocked.</span></h1>
          <p className="text-base md:text-lg text-white/55 leading-7 max-w-3xl mt-7">
            This room visualizes the existing acquisition engine’s demo economics and diligence gates. It can rank research candidates, but it cannot authorize a purchase, move money, transfer a deed, or turn a cheap listing into an investable asset.
          </p>
          <div className="flex gap-2 flex-wrap mt-7 text-[10px] font-black tracking-[.1em]">
            <span className="rounded-full border border-lime-200/15 bg-lime-200/[.05] px-4 py-2 text-lime-100/70">RESEARCH</span>
            <span className="rounded-full border border-lime-200/15 bg-lime-200/[.05] px-4 py-2 text-lime-100/70">SIMULATION</span>
            <span className="rounded-full border border-lime-200/15 bg-lime-200/[.05] px-4 py-2 text-lime-100/70">DILIGENCE</span>
            <span className="rounded-full border border-red-200/15 bg-red-200/[.05] px-4 py-2 text-red-100/70">NO PROPERTY EXECUTION</span>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat label="DEMO CANDIDATES" value={summary.total} note="Research examples only" />
          <Stat label="HUMAN REVIEW ELIGIBLE" value={summary.reviewEligible} note="Not approved to buy" />
          <Stat label="HARD-STOP REJECTS" value={summary.rejected} note="Blocked by diligence/economics" />
          <Stat label="EXECUTABLE" value={summary.executable} note="Code-locked at zero" />
        </section>

        <AcquisitionCenterCanvas candidates={candidates} />

        <section className="mt-5 grid md:grid-cols-3 gap-3">
          <TruthCard title="Rank is not authorization" copy="A high score only organizes research. The engine returns executable: false for every candidate." />
          <TruthCard title="Hard stops outrank price" copy="Broken title, liens, taxes, habitability, rental legality or insurance can block an ultra-cheap property regardless of modeled yield." />
          <TruthCard title="Closing stays off-chain" copy="Any future winning candidate still requires real diligence, entity approval, escrow/title/attorneys and a normally recorded deed before a Property Passport is linked." />
        </section>

        <section className="mt-20">
          <SectionHeading eyebrow="RESEARCH BOARD" title="Every candidate carries its reasons." copy="The spatial scene is backed by the same acquisition-engine scoring logic. These are demonstration inputs, not live listings, appraisals, offers or recommendations." />

          <div className="grid lg:grid-cols-3 gap-4">
            {candidates.map((candidate) => (
              <article key={candidate.id} className={`rounded-[28px] border p-5 md:p-6 ${candidate.status === 'reject' ? 'border-red-300/15 bg-red-300/[.035]' : candidate.status === 'review-ready' ? 'border-emerald-200/15 bg-emerald-200/[.035]' : 'border-amber-200/15 bg-amber-200/[.035]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[9px] tracking-[.15em] font-black text-white/40">{candidate.truthLabel}</div>
                    <h2 className="text-2xl font-black tracking-[-.045em] mt-2">#{candidate.rank} · {candidate.title}</h2>
                    <p className="text-xs text-white/40 mt-1">{candidate.location}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black">{candidate.score}/100</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <Metric label="DEMO LISTING" value={usd(candidate.economics.purchasePrice)} />
                  <Metric label="DEMO ALL-IN" value={usd(candidate.economics.totalBasis)} />
                  <Metric label="MODELED RENT" value={`${usd(candidate.economics.monthlyRent)}/mo`} />
                  <Metric label="MODELED NET" value={`${usd(candidate.economics.monthlyNet)}/mo`} />
                  <Metric label="MODELED NET YIELD" value={pct(candidate.economics.modeledNetYield)} />
                  <Metric label="EXECUTION" value="LOCKED" />
                </div>

                {candidate.failedHardGates.length ? (
                  <div className="mt-5 rounded-2xl border border-red-200/15 bg-black/20 p-4">
                    <div className="text-[9px] tracking-[.14em] font-black text-red-100/60">HARD STOPS</div>
                    <ul className="mt-2 grid gap-1 text-xs leading-5 text-white/55">
                      {candidate.failedHardGates.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                ) : null}

                {candidate.warnings.length ? (
                  <div className="mt-3 rounded-2xl border border-amber-200/12 bg-black/15 p-4">
                    <div className="text-[9px] tracking-[.14em] font-black text-amber-100/60">STILL VERIFY</div>
                    <ul className="mt-2 grid gap-1 text-xs leading-5 text-white/55">
                      {candidate.warnings.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                ) : null}

                {!candidate.failedHardGates.length && !candidate.warnings.length ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200/12 bg-black/15 p-4 text-xs leading-5 text-emerald-100/65">
                    Demo inputs cleared the current research checks. This means eligible for human review—not approved for acquisition.
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid lg:grid-cols-[1.05fr_.95fr] gap-4">
          <article className="rounded-[30px] border border-white/10 bg-white/[.025] p-7 md:p-9">
            <div className="text-[10px] tracking-[.17em] font-black text-white/35">HOW A RESEARCH CANDIDATE GRADUATES</div>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">Analysis first. Legal closing much later.</h2>
            <div className="grid gap-2 mt-7 text-sm">
              {[
                ['1', 'Research rank', 'Modeled all-in basis, rent, expenses and diligence data organize the queue.'],
                ['2', 'Independent diligence', 'Title, liens, taxes, inspection, rental legality, insurance and operating assumptions must be verified.'],
                ['3', 'Human/legal approval', 'A real buyer/entity approves a real transaction under the applicable legal and financing structure.'],
                ['4', 'Closing + recorded deed', 'Escrow/title/attorneys settle the transaction and the land-record system records ownership.'],
                ['5', 'Property Passport', 'Only after closing can the verified property identity, 3D twin and approved records be linked into Voxel Vault.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="grid grid-cols-[38px_1fr] gap-3 rounded-2xl border border-white/8 bg-black/15 p-4">
                  <span className="w-9 h-9 rounded-full border border-white/10 grid place-items-center font-black text-white/55">{number}</span>
                  <div><b>{title}</b><p className="text-xs leading-5 text-white/45 mt-1">{copy}</p></div>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-[30px] border border-red-200/15 bg-red-200/[.035] p-7 md:p-9">
            <div className="text-[10px] tracking-[.17em] font-black text-red-100/55">EXECUTION GATE · LOCKED</div>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">No “Buy Property” action exists here.</h2>
            <p className="text-sm leading-6 text-white/50 mt-4">The acquisition policy currently reports live property execution as <b>{String(acquisitionPolicy.livePropertyExecutionReady)}</b>. This page cannot spend money, submit an offer, sign a contract, move escrow funds or change title.</p>
            <div className="grid gap-2 mt-6 text-xs">
              {['No unattended spending','No deed transfer onchain','No simulated candidate treated as a live listing','No score treated as investment advice','No property token issued from research data'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/15 p-3 text-white/55">🔒 {item}</div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mt-6">
              <Link href="/real-estate/acquire" className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black no-underline">Open full analysis</Link>
              <Link href="/real-estate/launch" className="rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/70 no-underline">View launch gates</Link>
            </div>
          </aside>
        </section>

        <footer className="border-t border-white/10 mt-16 pt-7 pb-8 flex justify-between gap-6 flex-wrap text-[11px] leading-5 text-white/35">
          <div><b className="text-white/60">Voxel Vault · Acquisition Center</b><br />Spatial research and diligence—not property execution.</div>
          <div className="max-w-xl">Demo candidates only · modeled economics are not projections or recommendations · live property acquisition remains code-locked and requires a real legal/title/closing workflow.</div>
        </footer>
      </section>
    </main>
  );
}

function Stat({ label, value, note }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4 md:p-5"><div className="text-[9px] tracking-[.15em] font-black text-white/35">{label}</div><div className="text-2xl md:text-3xl font-black tracking-[-.045em] mt-2">{value}</div><div className="text-[10px] text-white/35 mt-1">{note}</div></div>;
}

function TruthCard({ title, copy }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm font-black">{title}</div><p className="text-xs leading-5 text-white/45 mt-2">{copy}</p></article>;
}

function Metric({ label, value }) {
  return <div className="rounded-2xl bg-black/20 p-3"><div className="text-[8px] tracking-[.12em] font-black text-white/30">{label}</div><div className="text-sm font-black mt-1">{value}</div></div>;
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="grid lg:grid-cols-[1fr_.8fr] gap-5 items-end mb-7"><div><div className="text-[10px] tracking-[.18em] font-black text-white/35">{eyebrow}</div><h2 className="text-4xl md:text-6xl font-black tracking-[-.065em] leading-[.92] mt-3">{title}</h2></div><p className="text-sm leading-6 text-white/45 lg:pb-1">{copy}</p></div>;
}
