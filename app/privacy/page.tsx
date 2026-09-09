export default function PrivacyCenter() {
  return (
    <main className="privacyPage">
      <a className="privacyBack" href="/">← Back to Galactic Trust</a>
      <section className="privacyHero">
        <span className="privacyShield">✓</span>
        <div>
          <p>SECURITY &amp; PRIVACY</p>
          <h1>Your financial life should stay private.</h1>
          <span>Galactic Trust is currently a demo banking experience. This page describes the protections built into the application today and the rules for connecting future regulated providers.</span>
        </div>
      </section>

      <section className="privacyGrid">
        <article>
          <span>01</span>
          <h2>Sensitive credentials</h2>
          <p>Galactic Trust does not ask users to put passwords, PINs, CVVs, recovery codes, private keys, or one-time authentication codes into Orbit chat.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Card information</h2>
          <p>The dashboard intentionally masks card numbers and does not expose full PAN, CVV, PIN, or equivalent sensitive authentication data.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Orbit support chat</h2>
          <p>Orbit is designed for product support and general explanations. The current application does not intentionally save chat messages to an application database.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Banking &amp; crypto providers</h2>
          <p>Real banking or crypto activity stays disabled until approved provider programs, customer authentication, required disclosures, and server-side credentials are configured.</p>
        </article>
        <article>
          <span>05</span>
          <h2>Browser protections</h2>
          <p>The production application sends restrictive security headers that limit framing, browser permissions, referrer leakage, external content, and other common web attack surfaces.</p>
        </article>
        <article>
          <span>06</span>
          <h2>Production launch</h2>
          <p>Before real customer onboarding, the final privacy notice, data retention rules, vendor disclosures, consumer rights, support procedures, and legally required notices must match the actual live program.</p>
        </article>
      </section>

      <section className="privacyCallout">
        <div><strong>Demo mode is intentional.</strong><span>No real deposits or crypto trades are represented by the demo balances and prices.</span></div>
        <a href="/">Return to dashboard</a>
      </section>
    </main>
  );
}
