import styles from './orxyz.module.css';

export const metadata = {
  title: 'ORXYZ | Technology, connected.',
  description:
    'Founder-led technology sourcing, hardware coordination, and selected software referrals for businesses evaluating practical technology solutions.',
};

const contactEmail = 'connectedtechpartners@gmail.com';
const businessMail = `mailto:${contactEmail}?subject=${encodeURIComponent('ORXYZ — business technology inquiry')}`;
const providerMail = `mailto:${contactEmail}?subject=${encodeURIComponent('ORXYZ — provider partnership inquiry')}`;
const botNiraReferral = 'https://botnira.com/r/worldwide-technology-connection-b1b6d8';

const services = [
  {
    number: '01 / ROBOTICS',
    icon: 'R',
    title: 'Robotics & automation',
    body: 'Commercial service robots and automation for cleaning, delivery, repetitive tasks, and operational support.',
    tags: ['task fit', 'deployment', 'support'],
  },
  {
    number: '02 / CHARGING',
    icon: 'C',
    title: 'Phone charging',
    body: 'Managed charging and shared power-bank systems for hospitality, entertainment, retail, and high-dwell venues.',
    tags: ['venue fit', 'economics', 'service area'],
  },
  {
    number: '03 / UNATTENDED RETAIL',
    icon: 'V',
    title: 'Smart vending',
    body: 'Compact vending, smart coolers, and unattended retail concepts for staff spaces and customer environments.',
    tags: ['footprint', 'stocking', 'host terms'],
  },
  {
    number: '04 / SOFTWARE',
    icon: 'AI',
    title: 'AI & business software',
    body: 'Selected software for customer response, missed-call coverage, lead handling, workflow support, and business operations.',
    tags: ['customer response', 'workflow', 'fit'],
  },
];

const steps = [
  ['01', 'Define the need', 'Start with the task, location, footprint, budget preference, and operational constraints.'],
  ['02', 'Qualify providers', 'Check service area, equipment, support model, economics, and deployment requirements.'],
  ['03', 'Coordinate the introduction', 'When there is mutual fit and permission, connect the relevant parties and preserve the opportunity record.'],
  ['04', 'Business approves', 'The business reviews the exact provider, equipment, footprint, and written terms before commitment.'],
];

const standards = [
  ['Founder-led accountability', 'Provider relationships, commercial terms, and consequential commitments are reviewed personally.'],
  ['Permission before disclosure', 'Identifying business information is kept limited to what is appropriate for evaluation until a substantive handoff is appropriate.'],
  ['Provider responsibility stays clear', 'Pricing, contracts, installation, support, financing, and technical obligations remain provider-confirmed.'],
  ['Compensation is disclosed', 'ORXYZ may receive referral or introducer compensation when a documented provider milestone is reached.'],
  ['No inflated deployment claims', 'Evaluation, agreement, installation, and live deployment are treated as separate stages.'],
  ['Written-first coordination', 'Key terms, attribution, approvals, and next steps are documented where practical.'],
];

const providerChecks = [
  ['Service area & use-case fit', 'Confirm the provider actually serves the geography and business use case.'],
  ['Deployment & support', 'Clarify who supplies, installs, services, supports, bills, and owns the equipment.'],
  ['Commercial model', 'Document customer obligations, provider economics, and material referral terms.'],
  ['Lead attribution', 'Use duplicate checks and written attribution rules where they matter.'],
  ['Business approval', 'The business makes the final decision after reviewing current provider-specific terms.'],
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.topline}>
        <div className={`${styles.shell} ${styles.toplineInner}`}>
          <span className={styles.topDot} />
          Founder-led · Buffalo, New York · Independent technology sourcing & referral coordination
        </div>
      </div>

      <header className={styles.navWrap}>
        <div className={`${styles.shell} ${styles.nav}`}>
          <a className={styles.brand} href="#top" aria-label="ORXYZ home">
            <span className={styles.logoMark} aria-hidden="true" />
            ORXYZ
          </a>
          <nav className={styles.navLinks} aria-label="Primary navigation">
            <a href="#solutions">Solutions</a>
            <a href="#software">Software</a>
            <a href="#process">Process</a>
            <a href="#standards">Standards</a>
            <a href="#providers">Providers</a>
            <a href="#about">About</a>
          </nav>
          <a className={styles.navCta} href={businessMail}>
            Start an inquiry <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <div className={styles.heroCopyWrap}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              Technology coordination for businesses
            </div>
            <h1>
              Technology,
              <span>connected.</span>
            </h1>
            <p className={styles.heroCopy}>
              ORXYZ helps businesses define a technology need, compare practical hardware or software options, and move toward a provider-backed solution with clear next steps.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={businessMail}>
                Discuss a technology need <span className={styles.arrow}>↗</span>
              </a>
              <a className={styles.secondaryButton} href="#solutions">
                Explore solutions <span className={styles.arrow}>↓</span>
              </a>
            </div>
            <div className={styles.heroPoints} aria-label="ORXYZ principles">
              <span className={styles.heroPoint}>Business need first</span>
              <span className={styles.heroPoint}>Provider fit qualified</span>
              <span className={styles.heroPoint}>Referral relationships disclosed</span>
            </div>
            <p className={styles.heroNote}>
              Independent sourcing and referral coordination. ORXYZ may receive compensation from selected third-party providers. Provider-specific pricing, contracts, installation, product performance, and support remain with the applicable provider.
            </p>
          </div>

          <div className={styles.networkCard} aria-label="ORXYZ coordination model">
            <div className={styles.networkTop}>
              <div>
                <div className={styles.networkLabel}>Coordination model</div>
                <div className={styles.networkCaption}>One need. Qualified fit. Clear handoff.</div>
              </div>
              <div className={styles.networkStatus}>
                <span className={styles.statusDot} />
                written-first
              </div>
            </div>
            <div className={styles.networkStage}>
              <div className={styles.ringOne} />
              <div className={styles.ringTwo} />
              <div className={styles.ringThree} />
              <div className={`${styles.connection} ${styles.lineOne}`} />
              <div className={`${styles.connection} ${styles.lineTwo}`} />
              <div className={`${styles.connection} ${styles.lineThree}`} />
              <div className={`${styles.connection} ${styles.lineFour}`} />
              <div className={styles.core}><strong>ORXYZ</strong></div>
              <div className={`${styles.node} ${styles.nodeOne}`}><b>Business</b><span>operational need</span></div>
              <div className={`${styles.node} ${styles.nodeTwo}`}><b>Provider</b><span>qualified fit</span></div>
              <div className={`${styles.node} ${styles.nodeThree}`}><b>Terms</b><span>written clarity</span></div>
              <div className={`${styles.node} ${styles.nodeFour}`}><b>Deployment</b><span>approved path</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.trustBar} aria-label="ORXYZ focus areas">
        <div className={`${styles.shell} ${styles.trustGrid}`}>
          <div className={styles.trustLead}>Practical business technology, qualified before the handoff.</div>
          <div className={styles.trustItem}>Robotics & automation</div>
          <div className={styles.trustItem}>Charging infrastructure</div>
          <div className={styles.trustItem}>Smart unattended retail</div>
          <div className={styles.trustItem}>AI & business software</div>
        </div>
      </section>

      <section className={styles.section} id="solutions">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionKicker}>What ORXYZ coordinates</div>
              <h2>Practical technology for real operations.</h2>
            </div>
            <p>
              Start with the business problem. Then evaluate options whose service area, product capabilities, support model, and commercial structure may actually fit.
            </p>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.title}>
                <div className={styles.serviceNumber}>{service.number}</div>
                <div className={styles.serviceIcon} aria-hidden="true">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.body}</p>
                <div className={styles.qualify}>
                  {service.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} id="software">
        <div className={styles.shell}>
          <div className={styles.providerPanel}>
            <div className={styles.providerCopy}>
              <div className={styles.sectionKicker}>Featured software recommendation</div>
              <h2>Missed calls should not automatically become missed customers.</h2>
              <p>
                For service businesses that receive calls or enquiries while the team is busy, after hours, or already on another job, ORXYZ is currently testing BotNira as a practical AI receptionist option. BotNira supports phone, WhatsApp, SMS, email, and web conversations on applicable plans and offers a 5-day free trial without a credit card.
              </p>
              <div className={styles.providerDisclosure}>
                Affiliate disclosure: ORXYZ participates in BotNira&apos;s referral program and may receive 15% recurring commission on successful paid referrals for as long as the referred subscription remains active. The referral does not increase ORXYZ&apos;s control over BotNira&apos;s pricing, service, or customer relationship.
              </div>
              <a className={styles.providerButton} href={botNiraReferral} target="_blank" rel="noopener noreferrer sponsored">
                Review BotNira <span className={styles.arrow}>↗</span>
              </a>
            </div>
            <div className={styles.providerList}>
              <div className={styles.providerItem}>
                <div className={styles.providerCheck}>✓</div>
                <div><b>Best-fit starting audience</b><span>Plumbers, HVAC, electricians, auto services, clinics, salons, and other appointment or call-driven businesses.</span></div>
              </div>
              <div className={styles.providerItem}>
                <div className={styles.providerCheck}>✓</div>
                <div><b>Low-friction evaluation</b><span>Businesses can review the product and start the current 5-day trial directly without scheduling a sales call with ORXYZ.</span></div>
              </div>
              <div className={styles.providerItem}>
                <div className={styles.providerCheck}>✓</div>
                <div><b>Provider-direct relationship</b><span>BotNira controls its product, subscription, onboarding, support, pricing, and terms. ORXYZ is the referring party.</span></div>
              </div>
              <div className={styles.providerItem}>
                <div className={styles.providerCheck}>✓</div>
                <div><b>Fit before hype</b><span>ORXYZ recommends reviewing the current feature set and trial first rather than assuming an AI receptionist fits every business.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionKicker}>Who we work with</div>
              <h2>One coordination layer. Different business needs.</h2>
            </div>
            <p>
              For businesses that want a credible technology path without sorting through every manufacturer, distributor, operator, installer, and software platform on their own.
            </p>
          </div>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceCard}><b>Hospitality & entertainment</b><span>Guest charging, automation, service technology, and unattended retail.</span></div>
            <div className={styles.audienceCard}><b>Retail & customer-facing spaces</b><span>Compact technology that improves convenience without unnecessary operational burden.</span></div>
            <div className={styles.audienceCard}><b>Service businesses & operations</b><span>Customer-response software, robotics, and automation evaluated around a specific operational need.</span></div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="process">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionKicker}>The ORXYZ process</div>
              <h2>From need to a provider-backed option.</h2>
            </div>
            <p>
              Each opportunity stays structured so the business and provider know what has — and has not — been approved.
            </p>
          </div>
          <div className={styles.processGrid}>
            {steps.map(([number, title, body]) => (
              <article className={styles.processStep} key={number}>
                <div className={styles.stepNumber}>{number}<span className={styles.stepSignal} /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} id="standards">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionKicker}>ORXYZ operating standards</div>
              <h2>Credibility comes from how the work is handled.</h2>
            </div>
            <p>
              The standards used to keep introductions useful, permissioned, and commercially clear for both sides.
            </p>
          </div>
          <div className={styles.standardsGrid}>
            {standards.map(([title, body], index) => (
              <article className={styles.standardCard} key={title}>
                <div className={styles.standardNumber}>{String(index + 1).padStart(2, '0')}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="providers">
        <div className={styles.shell}>
          <div className={styles.providerPanel}>
            <div className={styles.providerCopy}>
              <div className={styles.sectionKicker}>For technology providers</div>
              <h2>Good opportunities deserve clean handoffs.</h2>
              <p>
                ORXYZ does not sell raw lead lists. The goal is to qualify a real business need, confirm fit, preserve attribution where appropriate, and coordinate a permissioned written introduction.
              </p>
              <div className={styles.providerDisclosure}>
                ORXYZ may receive referral or introducer compensation when a documented provider milestone is reached. That does not authorize ORXYZ to bind a business to provider terms.
              </div>
              <a className={styles.providerButton} href={providerMail}>Discuss provider fit <span className={styles.arrow}>↗</span></a>
            </div>
            <div className={styles.providerList}>
              {providerChecks.map(([title, body]) => (
                <div className={styles.providerItem} key={title}>
                  <div className={styles.providerCheck}>✓</div>
                  <div><b>{title}</b><span>{body}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} id="about">
        <div className={`${styles.shell} ${styles.founderGrid}`}>
          <div className={styles.founderCard}>
            <div className={styles.founderMonogram}>DH</div>
            <div className={styles.founderLabel}>Founder & operator</div>
            <b>Dominic Hartenstein</b>
            <span>ORXYZ · Buffalo, New York</span>
            <div className={styles.founderMeta}>
              <div className={styles.metaCard}><b>Approach</b><span>Written-first business coordination</span></div>
              <div className={styles.metaCard}><b>Role</b><span>Provider sourcing, qualification & handoff</span></div>
            </div>
          </div>
          <div className={styles.founderCopy}>
            <div className={styles.sectionKicker}>About ORXYZ</div>
            <h2>Independent. Founder-led. Written-first.</h2>
            <p>
              ORXYZ is an independent technology sourcing and referral coordination business. It does not claim to manufacture the products it evaluates or guarantee third-party pricing, installation, financing, revenue share, software performance, or support.
            </p>
            <p>
              Dominic personally reviews provider relationships, commercial terms, and consequential commitments. Routine research, drafting, scheduling, and administrative communication may be AI-assisted, while commercial commitments remain personally reviewed.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.contactSection} id="contact">
        <div className={`${styles.shell} ${styles.contactCard}`}>
          <div className={styles.contactRow}>
            <div className={styles.contactCopy}>
              <div className={styles.sectionKicker}>Start with the need</div>
              <h2>What is your business trying to improve?</h2>
              <p>
                Send the task, location, or technology category you are evaluating. ORXYZ can determine whether there is a practical provider or software path worth exploring.
              </p>
              <a className={styles.contactEmail} href={businessMail}>Email ORXYZ →</a>
            </div>
            <a className={styles.primaryButton} href={businessMail}>Start an inquiry <span className={styles.arrow}>↗</span></a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerGrid}`}>
          <div>
            <div className={styles.footerBrand}>ORXYZ</div>
            <div>Buffalo, New York, USA</div>
          </div>
          <div>
            ORXYZ provides independent technology sourcing, referral, introduction, and coordination services. ORXYZ may receive compensation from selected third-party providers. Availability, pricing, installation, support, financing, software performance, and revenue-share terms are determined by the applicable third-party provider and remain subject to its current terms.
          </div>
          <div>
            <div>© 2026 ORXYZ</div>
            <div className={styles.footerLinks}><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
          </div>
        </div>
      </footer>
    </main>
  );
}