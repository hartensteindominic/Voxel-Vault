'use client';

import Link from 'next/link';
import { useState } from 'react';

const rows = [
  ['Identity', 'Voxel Vault sign-in', 'Connected'],
  ['Provider binding', 'Financial account isolation', 'Required'],
  ['Money movement', 'Deposits, transfers, withdrawals', 'Locked'],
  ['Card spending', 'Issuer-backed authorization', 'Locked'],
];

export default function GalacticSecurityPage() {
  const [notice, setNotice] = useState('');
  return (
    <main className="min-h-screen bg-[#07110f] text-white px-4 pb-24 pt-5 md:px-8">
      <section className="max-w-6xl mx-auto">
        <nav className="flex items-center justify-between gap-3 flex-wrap"><Link href="/bank" className="text-white no-underline font-black">← Galactic Trust</Link><Link href="/bank/cards" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 no-underline">Digital cards</Link></nav>
        <header className="pt-16 pb-8"><div className="text-[10px] tracking-[.2em] font-black text-[#b8ffdf]/55">SECURITY CENTER</div><h1 className="text-5xl md:text-8xl font-black tracking-[-.07em] leading-[.86] mt-3">Know what is<br/><span className="text-[#b8ffdf]">actually connected.</span></h1><p className="mt-6 text-white/48 leading-7 max-w-2xl">A transparent control center separating identity, provider data, and features that are still locked.</p></header>
        {notice ? <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 mb-4 text-sm text-white/60">{notice}</div> : null}
        <section className="rounded-[32px] border border-white/10 bg-white/[.035] overflow-hidden">
          {rows.map(([title, description, status], index) => <div key={title} className={`grid md:grid-cols-[.7fr_1.3fr_auto] gap-3 p-5 md:p-6 items-center ${index ? 'border-t border-white/10' : ''}`}><div className="font-black">{title}</div><div className="text-sm text-white/40">{description}</div><span className={`justify-self-start md:justify-self-end rounded-full border px-3 py-1 text-[9px] font-black tracking-[.1em] ${status === 'Connected' ? 'border-emerald-200/20 text-emerald-100 bg-emerald-200/[.06]' : 'border-white/10 text-white/45'}`}>{status.toUpperCase()}</span></div>)}
        </section>
        <section className="grid md:grid-cols-3 gap-3 mt-4">
          {[['Session control','Sign out from the main Galactic Trust page to hide private provider data.'],['Data boundary','Provider data is requested only after authenticated access and an explicit per-user binding.'],['No pretend approvals','Locked financial actions never display a fake success state.']].map(([title, body]) => <article key={title} className="rounded-[26px] border border-white/10 bg-white/[.03] p-5"><h2 className="font-black text-xl">{title}</h2><p className="text-xs leading-5 text-white/40 mt-2">{body}</p></article>)}
        </section>
        <button onClick={() => setNotice('Security review recorded locally for this view. No financial account settings were changed.')} className="mt-5 rounded-full bg-[#b8ffdf] text-[#07110f] px-6 py-3 text-xs font-black">REVIEW SECURITY STATE</button>
      </section>
    </main>
  );
}
