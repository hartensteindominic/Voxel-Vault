'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const CARDS = [
  { id: 'orbit', name: 'Orbit', subtitle: 'Everyday digital card', accent: 'from-[#1a4b3b] to-[#08130f]', status: 'Preview', limit: '$0 live spend' },
  { id: 'nova', name: 'Nova', subtitle: 'Subscriptions + online', accent: 'from-[#40255f] to-[#0d0913]', status: 'Preview', limit: '$0 live spend' },
  { id: 'lunar', name: 'Lunar', subtitle: 'Travel + one-time purchases', accent: 'from-[#183d59] to-[#071019]', status: 'Preview', limit: '$0 live spend' },
];

export default function GalacticCardsPage() {
  const [activeId, setActiveId] = useState('orbit');
  const active = useMemo(() => CARDS.find((card) => card.id === activeId) || CARDS[0], [activeId]);

  return (
    <main className="min-h-screen bg-[#07110f] text-white px-4 pb-24 pt-5 md:px-8">
      <section className="max-w-6xl mx-auto">
        <nav className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/bank" className="text-white no-underline font-black tracking-[-.03em]">← Galactic Trust</Link>
          <div className="flex gap-2 text-xs">
            <Link href="/bank" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">Overview</Link>
            <Link href="/bank/security" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">Security</Link>
          </div>
        </nav>

        <header className="pt-16 pb-8 max-w-4xl">
          <div className="text-[10px] tracking-[.2em] font-black text-[#b8ffdf]/55">GALACTIC CARDS</div>
          <h1 className="text-5xl md:text-8xl font-black tracking-[-.07em] leading-[.86] mt-3">Digital cards,<br/><span className="text-[#b8ffdf]">built for control.</span></h1>
          <p className="mt-6 text-white/48 leading-7 max-w-2xl">Create and organize card profiles now. Issuance, card numbers, wallets and real spending stay disabled until Galactic Trust is connected to an approved card issuer and money-movement provider.</p>
        </header>

        <section className="grid lg:grid-cols-[.8fr_1.2fr] gap-4">
          <div className="grid gap-3">
            {CARDS.map((card) => (
              <button key={card.id} onClick={() => setActiveId(card.id)} className={`text-left rounded-[26px] border p-5 transition ${activeId === card.id ? 'border-[#b8ffdf]/30 bg-[#b8ffdf]/[.06]' : 'border-white/10 bg-white/[.03]'}`}>
                <div className="text-lg font-black">{card.name}</div>
                <div className="text-xs text-white/40 mt-1">{card.subtitle}</div>
                <div className="flex gap-2 mt-4"><span className="rounded-full border border-white/10 px-3 py-1 text-[9px] font-black text-white/45">{card.status}</span><span className="rounded-full border border-white/10 px-3 py-1 text-[9px] font-black text-white/45">{card.limit}</span></div>
              </button>
            ))}
          </div>

          <article className="rounded-[34px] border border-white/10 bg-white/[.035] p-5 md:p-7">
            <div className={`rounded-[30px] bg-gradient-to-br ${active.accent} aspect-[1.58/1] p-6 md:p-8 flex flex-col justify-between shadow-[0_35px_90px_rgba(0,0,0,.34)] border border-white/10`}>
              <div className="flex justify-between gap-4 items-start"><div><div className="text-xs font-black tracking-[.18em]">GALACTIC TRUST</div><div className="text-[10px] text-white/40 mt-1">{active.subtitle}</div></div><div className="text-xs font-black">{active.name}</div></div>
              <div>
                <div className="text-2xl md:text-3xl tracking-[.22em] font-black">•••• •••• •••• ••••</div>
                <div className="grid grid-cols-2 gap-3 mt-6 text-[10px] text-white/40"><span>CARDHOLDER<br/><b className="text-white/75">VOXEL MEMBER</b></span><span>STATUS<br/><b className="text-white/75">NOT ISSUED</b></span></div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              {['Freeze card', 'Replace card', 'Spending limits', 'Merchant controls'].map((label) => <button key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left"><span className="font-black">{label}</span><span className="block text-[10px] text-white/35 mt-1">Available after issuer connection</span></button>)}
            </div>
          </article>
        </section>

        <section className="rounded-[30px] border border-amber-200/15 bg-amber-200/[.04] p-6 mt-4 text-sm leading-6 text-amber-50/65">Card profiles are UI-only right now. Galactic Trust does not expose fake PANs, CVVs, balances, approvals, or successful charges. Those become real only through an approved issuer/processor integration.</section>
      </section>
    </main>
  );
}
