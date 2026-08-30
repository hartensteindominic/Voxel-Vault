import Link from 'next/link';
import {
  bankingLaunchSnapshot,
  bankingRegulatoryReferences,
  galacticTrustPublicBoundary,
} from '../../../lib/banking/regulated-launch.js';
import styles from './readiness.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Regulated launch status',
  description: 'Public launch-readiness status for Galactic Trust banking features, provider controls, and consumer-protection gates.',
  alternates: { canonical: '/bank/readiness' },
};

export default function BankingReadinessPage() {
  const snapshot = bankingLaunchSnapshot(process.env);
  const readyCount = snapshot.gates.filter((gate) => gate.asserted).length;

  return (
    <main className={styles.page}>
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />
      <section className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand}><span>✦</span> Galactic Trust</Link>
          <Link href="/" className={styles.back}>← Dashboard</Link>
        </header>

        <section className={styles.hero}>
          <div>
            <span className={styles.kicker}>REGULATED LAUNCH STATUS</span>
            <h1>Real banking stays locked<br />until the real bank is ready.</h1>
            <p>{galacticTrustPublicBoundary.nonBankDisclosure}</p>
          </div>
          <div className={styles.statusCard}>
            <span className={styles.statusPill}>{snapshot.liveBankingEnabled ? 'LIVE · PROVIDER BACKED' : 'PRODUCTION GATED'}</span>
            <strong>{readyCount}/{snapshot.gates.length}</strong>
            <small>review gates asserted</small>
            <div className={styles.statusLine}><span>Real deposits</span><b>{snapshot.liveBankingEnabled ? 'Enabled' : 'Blocked'}</b></div>
            <div className={styles.statusLine}><span>Money movement</span><b>{snapshot.liveBankingEnabled ? 'Enabled' : 'Blocked'}</b></div>
            <div className={styles.statusLine}><span>Live crypto</span><b>{snapshot.liveCryptoEnabled ? 'Enabled' : 'Blocked'}</b></div>
          </div>
        </section>

        <section className={styles.boundaryGrid}>
          <article><span>01</span><h2>Nonbank clarity</h2><p>Galactic Trust does not present itself as an FDIC-insured bank. A future live program must clearly identify the actual sponsor bank and use only bank-approved deposit-insurance language.</p></article>
          <article><span>02</span><h2>Provider authority</h2><p>Authentication, UI toggles, environment flags, or founder approval cannot make banking live. The sponsor bank and production providers must approve the exact program and integration.</p></article>
          <article><span>03</span><h2>Consumer protections</h2><p>Live electronic transfers require approved disclosures, error-resolution handling, transaction records, limits, fraud controls, complaints support, and reconciliation.</p></article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.kicker}>GO-LIVE GATES</span><h2>What must be verified</h2></div><p>Green environment assertions are readiness inputs only. They do not substitute for executed agreements or written provider acceptance.</p></div>
          <div className={styles.gates}>
            {snapshot.gates.map((gate, index) => (
              <article key={gate.gate} className={gate.asserted ? styles.readyGate : styles.pendingGate}>
                <span className={styles.gateNumber}>{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{gate.label}</h3><p>{gate.authority}</p></div>
                <b>{gate.asserted ? 'ASSERTED' : 'PENDING'}</b>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.kicker}>PUBLIC BOUNDARIES</span><h2>No fake trust signals</h2></div></div>
          <div className={styles.disclosures}>
            <p><b>Bank relationship:</b> {galacticTrustPublicBoundary.liveProgramDisclosure}</p>
            <p><b>Deposit insurance:</b> {galacticTrustPublicBoundary.fdicBoundary}</p>
            <p><b>Crypto:</b> {galacticTrustPublicBoundary.cryptoBoundary}</p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.kicker}>OFFICIAL REFERENCES</span><h2>Rules the launch plan is designed around</h2></div><p>These links are for product/compliance planning and are not a substitute for legal advice or sponsor-bank approval.</p></div>
          <div className={styles.references}>
            {bankingRegulatoryReferences.map((item) => <a key={item.name} href={item.url} target="_blank" rel="noreferrer"><span>{item.agency}</span><b>{item.name}</b><i>↗</i></a>)}
          </div>
        </section>

        <footer className={styles.footer}>
          <p>Policy {snapshot.policyVersion} · Live banking implementation flag: <b>{snapshot.implementationReady ? 'ready' : 'locked'}</b></p>
          <div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/">Galactic Trust</Link></div>
        </footer>
      </section>
    </main>
  );
}
