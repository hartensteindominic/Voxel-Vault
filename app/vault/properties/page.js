import Link from 'next/link';
import {
  buildCanonicalPropertyPassport,
  buildDigitalBuildingEdition,
  propertyPurchaseProgression,
  REAL_WORLD_VOXEL_POLICY,
} from '../../../lib/vault/property-passport.js';
import PropertyPassportCanvas from './PropertyPassportCanvas';

export const metadata = {
  title: 'Real World Voxel | Voxel Vault',
  description: 'Canonical 3D Property Passports that connect verified real-world buildings to spatial provenance without pretending an NFT is a deed.',
};

const demoPassport = buildCanonicalPropertyPassport({
  propertyKey: 'DEMO-PARCEL-001',
  title: 'Verified Home · Demonstration',
  locality: 'United States · demonstration record',
  ownerAuthorized: true,
  propertyVerified: true,
  titleVerified: true,
  entityVerified: true,
  testnetAnchored: false,
  canonicalMinted: false,
  modelVersion: 1,
  estimatedValueUsd: 425000,
  valuationSource: 'DEMONSTRATION COMPARABLE-SALES INPUT',
  valuationAsOf: 'DEMO ONLY',
});

const demoEdition = buildDigitalBuildingEdition({
  canonicalPropertyKey: demoPassport.propertyKey,
  creatorAuthorized: true,
  addressLinked: true,
  supply: 25,
  license: 'personal spatial display',
});

function usd(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function PropertyPassportPage() {
  const progression = propertyPurchaseProgression();

  return (
    <main className="min-h-screen bg-[#050706] px-4 py-5 text-white md:px-8 md:py-8">
      <section className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/vault" className="flex items-center gap-2 font-black tracking-[-.03em] text-white no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black">V</span>
            Voxel Vault
          </Link>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-white/70 no-underline">My Vault</Link>
            <Link href="/vault/acquisitions" className="rounded-full border border-white/10 px-4 py-2 text-white/70 no-underline">Acquisition Center</Link>
            <Link href="/vault/income" className="rounded-full border border-white/10 px-4 py-2 text-white/70 no-underline">Income Center</Link>
          </div>
        </nav>

        <header className="max-w-6xl pb-12 pt-16 md:pb-14 md:pt-24">
          <div className="text-[10px] font-black tracking-[.28em] text-emerald-100/45">REAL WORLD VOXEL · PROPERTY PASSPORT</div>
          <h1 className="mt-4 text-5xl font-black leading-[.84] tracking-[-.075em] md:text-8xl">
            The metaverse,<br /><span className="text-[#9ff5df]">attached to Earth.</span>
          </h1>
          <p className="mt-7 max-w-4xl text-base leading-7 text-white/55 md:text-lg">
            Every verified real building can have one canonical Voxel Vault Property Passport: a premium 3D identity, provenance record and spatial doorway into its real-world evidence. The canonical twin is unique. The deed stays in the normal land-title system.
          </p>
          <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-black tracking-[.1em]">
            <span className="rounded-full border border-emerald-100/15 bg-emerald-100/[.05] px-4 py-2 text-emerald-100/75">1 CANONICAL TWIN / PROPERTY</span>
            <span className="rounded-full border border-emerald-100/15 bg-emerald-100/[.05] px-4 py-2 text-emerald-100/75">VERSIONED 3D MODEL</span>
            <span className="rounded-full border border-emerald-100/15 bg-emerald-100/[.05] px-4 py-2 text-emerald-100/75">PREMIUM FROM {usd(REAL_WORLD_VOXEL_POLICY.premiumCanonicalTwinStartingPriceUsd)}</span>
            <span className="rounded-full border border-amber-100/15 bg-amber-100/[.05] px-4 py-2 text-amber-100/75">PROPERTY RIGHTS FAIL-CLOSED</span>
          </div>
        </header>

        <PropertyPassportCanvas passport={demoPassport} />

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat label="CANONICAL SUPPLY" value="1" note="One verified identity for this property" />
          <Stat label="DEMO REAL-WORLD VALUE" value={usd(demoPassport.market.estimatedValueUsd)} note="Separate from NFT/collectible value" />
          <Stat label="VERIFIED TWIN START" value={usd(demoPassport.pricing.canonicalTwinStartingPriceUsd)} note="Premium creation + verification layer" />
          <Stat label="REAL PURCHASE" value="LOCKED" note="Requires normal contract + closing" />
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="THE PRODUCT RULE"
            title="One Earth property. Three separate value layers."
            copy="This separation is what lets Voxel Vault feel like a real-world Sandbox without misleading users about what a token actually owns."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <LayerCard
              number="01"
              title="Real property"
              badge="USD · LEGAL CLOSING"
              price={usd(demoPassport.market.estimatedValueUsd)}
              copy="The land and building. Value comes from real listing data, comparable sales, appraisal/diligence and the negotiated transaction—not from an NFT floor price."
              rights="Deed/title and actual rental economics only follow the real legal ownership structure."
            />
            <LayerCard
              number="02"
              title="Canonical Voxel Twin"
              badge="VERIFIED · UNIQUE"
              price={`from ${usd(demoPassport.pricing.canonicalTwinStartingPriceUsd)}`}
              copy="The one official 3D Property Passport identity for a verified building. Renovations create versioned model updates instead of duplicate canonical mints."
              rights="Provenance and spatial identity. It is not the deed and does not automatically carry rent."
            />
            <LayerCard
              number="03"
              title="Digital building editions"
              badge="COLLECT · DISPLAY · RENT DIGITALLY"
              price="market-priced"
              copy={`Authorized creators can release limited digital editions. This demo edition has supply ${demoEdition.supply} and a ${demoEdition.license} license.`}
              rights="Collectible/license rights only. Digital rental can be supported separately from actual property rent."
            />
          </div>
        </section>

        <section className="mt-20 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <article className="rounded-[32px] border border-emerald-100/12 bg-emerald-100/[.025] p-7 md:p-9">
            <div className="text-[10px] font-black tracking-[.17em] text-emerald-100/45">CAN I MINT MY FRIEND&apos;S HOUSE?</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-.055em] md:text-5xl">Yes as art. Not as the official property.</h2>
            <p className="mt-4 text-sm leading-6 text-white/50">
              Anyone may build a stylized voxel house from their own creative input, but it stays an unverified digital building. To connect a model to a real address/property identity and call it the canonical twin, Voxel Vault requires authorization from the property owner or authorized controller plus property verification.
            </p>
            <div className="mt-7 grid gap-2 text-xs">
              <Rule ok title="Unverified creative house" copy="Mintable as a normal digital collectible, without claiming it is the property, deed or official twin." />
              <Rule ok title="Owner-authorized limited editions" copy="May link to the canonical Property Passport and be sold or digitally rented under explicit license terms." />
              <Rule title="Fake official twin" copy="Blocked. A second address-linked canonical mint cannot impersonate the verified property identity." />
              <Rule title="Rent claim without legal rights" copy="Blocked. Owning a house collectible does not entitle the holder to a tenant&apos;s real USD rent." />
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100/12 bg-amber-100/[.025] p-7 md:p-9">
            <div className="text-[10px] font-black tracking-[.17em] text-amber-100/45">TWO KINDS OF RENT</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-.055em] md:text-5xl">Digital rent and real rent never get mixed.</h2>
            <div className="mt-7 grid gap-3">
              <RentCard title="Digital building rental" status="DESIGNABLE" copy="A collectible owner can grant temporary display/use access to a 3D building in Voxel spaces, games, galleries or virtual neighborhoods. Smart contracts can time-limit the license." />
              <RentCard title="Actual property rental" status="LEGAL RIGHTS REQUIRED" copy="A tenant pays real rent under a real lease. Only the legally entitled property owner/entity or approved economic-interest structure can receive that income after expenses, reserves and accounting." />
            </div>
          </article>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="BUY WITH USD"
            title="The real building can eventually be bought here too—through a real closing rail."
            copy="Voxel Vault can make the experience spatial and blockchain-aware while the actual transfer still uses contracts, escrow/title/attorneys and the recorded deed."
          />
          <div className="grid gap-2">
            {progression.map((step, index) => (
              <div key={step} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xs font-black text-white/55">{index + 1}</span>
                <div>
                  <div className="text-sm font-black capitalize">{step}</div>
                  {index === 4 ? <p className="mt-1 text-xs leading-5 text-white/38">This is the moment real-world legal ownership changes. The blockchain does not replace the land-title system.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(159,245,223,.08),rgba(255,255,255,.02),rgba(228,189,119,.05))] p-7 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_.8fr] lg:items-end">
            <div>
              <div className="text-[10px] font-black tracking-[.19em] text-white/35">PREMIUM POSITIONING</div>
              <h2 className="mt-3 text-4xl font-black leading-[.92] tracking-[-.065em] md:text-6xl">We do not race to the cheapest mint.</h2>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-white/48">
                The verified real-world product starts premium because it includes identity, verification, provenance, versioned 3D modeling and a durable place inside the Voxel Vault world. The price is for the digital product and verification service; it is never presented as buying the underlying house.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <PriceCard label="CANONICAL VERIFIED TWIN" value={`from ${usd(REAL_WORLD_VOXEL_POLICY.premiumCanonicalTwinStartingPriceUsd)}`} note="one official property identity" />
              <PriceCard label="VERIFIED MODEL REFRESH" value={usd(REAL_WORLD_VOXEL_POLICY.verifiedTwinRefreshPriceUsd)} note="renovation/rescan version update" />
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap justify-between gap-6 border-t border-white/10 pb-8 pt-7 text-[11px] leading-5 text-white/35">
          <div><b className="text-white/60">Voxel Vault · Real World Voxel</b><br />Canonical 3D identity + real-world provenance.</div>
          <div className="max-w-2xl">Demonstration property and valuation only. Property Passport ≠ deed. Collectible NFT ≠ property interest. Actual property purchases and rent rights remain locked until real legal, title, custody, accounting and compliance rails exist.</div>
        </footer>
      </section>
    </main>
  );
}

function Stat({ label, value, note }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4 md:p-5"><div className="text-[9px] font-black tracking-[.15em] text-white/35">{label}</div><div className="mt-2 text-2xl font-black tracking-[-.045em] md:text-3xl">{value}</div><div className="mt-1 text-[10px] text-white/35">{note}</div></div>;
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="mb-7 grid items-end gap-5 lg:grid-cols-[1fr_.8fr]"><div><div className="text-[10px] font-black tracking-[.18em] text-white/35">{eyebrow}</div><h2 className="mt-3 text-4xl font-black leading-[.92] tracking-[-.065em] md:text-6xl">{title}</h2></div><p className="text-sm leading-6 text-white/45 lg:pb-1">{copy}</p></div>;
}

function LayerCard({ number, title, badge, price, copy, rights }) {
  return <article className="rounded-[30px] border border-white/10 bg-white/[.025] p-6"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-white/25">{number}</span><span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black tracking-[.11em] text-white/45">{badge}</span></div><h3 className="mt-7 text-3xl font-black tracking-[-.05em]">{title}</h3><div className="mt-2 text-xl font-black text-[#9ff5df]">{price}</div><p className="mt-4 text-sm leading-6 text-white/48">{copy}</p><div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-4 text-xs leading-5 text-white/42">{rights}</div></article>;
}

function Rule({ ok = false, title, copy }) {
  return <div className="grid grid-cols-[28px_1fr] gap-3 rounded-2xl border border-white/8 bg-black/15 p-4"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${ok ? 'bg-emerald-200/10 text-emerald-100' : 'bg-red-200/10 text-red-100'}`}>{ok ? '✓' : '×'}</span><div><b>{title}</b><p className="mt-1 text-[11px] leading-5 text-white/40">{copy}</p></div></div>;
}

function RentCard({ title, status, copy }) {
  return <div className="rounded-2xl border border-white/8 bg-black/15 p-5"><div className="text-[9px] font-black tracking-[.13em] text-amber-100/45">{status}</div><div className="mt-1 text-lg font-black">{title}</div><p className="mt-2 text-xs leading-5 text-white/42">{copy}</p></div>;
}

function PriceCard({ label, value, note }) {
  return <div className="rounded-3xl border border-white/10 bg-black/20 p-5"><div className="text-[8px] font-black tracking-[.13em] text-white/35">{label}</div><div className="mt-2 text-2xl font-black tracking-[-.04em]">{value}</div><div className="mt-1 text-[10px] text-white/32">{note}</div></div>;
}
