import styles from './orxyz.module.css';

export const metadata = {
  title: 'ORXYZ | Technology, connected.',
  description:
    'ORXYZ helps businesses evaluate practical technology solutions across robotics, automation, phone charging, smart unattended retail, and AI business tools.',
};

const contactEmail = 'connectedtechpartners@gmail.com';
const businessMail = `mailto:${contactEmail}?subject=${encodeURIComponent('ORXYZ — business technology inquiry')}`;
const providerMail = `mailto:${contactEmail}?subject=${encodeURIComponent('ORXYZ — provider partnership inquiry')}`;

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
    title: 'AI business tools',
    body: 'Selected software and AI tools for customer response, lead handling, workflow support, and business operations.',
    tags: ['workflow', 'integration', 'fit'],
  },
];

const steps = [
  {
    number: '01',
    title: 'Define the need',
    body: 'We start with the task, location, footprint, budget preference, and operational constraints.',
  },
  {
    number: '02',
    title: 'Qualify providers',
    body: 'We check service area, equipment, support model, economics, and deployment requirements.',
  },
  {
    number: '03',
    title: 'Coordinate the introduction',
    body: 'When there is mutual fit and permission, we connect the relevant parties and preserve the opportunity record.',
  },
  {
    number: '04',
    title: 'Business approves',
    body: 'The business reviews the exact provider, equipment, footprint, and written terms before commitment.',
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.topline}>
        <div className={`${styles.shell} ${styles.toplineInner}`}>
          <span className={styles.topDot} />
          Buffalo, New York · Independent technology sourcing & coordination
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
            <a href="#process">Process</a>
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
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              Technology coordination for businesses
            </div>
            <h1>
              Technology,
              <span>connected.</span>
            </h1>
            <p className={styles.heroCopy}>
              ORXYZ helps businesses identify practical technology opportunities, qualify suitable providers,
              and coordinate a clear path from evaluation to deployment.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={businessMail}>
                Discuss a technology need <span className={styles.arrow}>↗</span>
              </a>
              <a className={styles.secondaryButton} href="#process">
                See how it works <span className={styles.arrow}>↓</span>
              </a>
            </div>
            <div className={styles.heroPoints} aria-label="ORXYZ principles">
              <span className={styles.heroPoint}>Business need first</span>
              <span className={styles.heroPoint}>Provider fit qualified</span>
              <span className={styles.heroPoint}>Written terms before commitment</span>
            </div>
          </div>

          <div className={styles.networkCard} aria-label="ORXYZ technology network illustration">
            <div className={styles.networkTop}>
              <div className={styles.networkLabel}>Technology network</div>
              <div className={styles.networkStatus}>
                <span className={styles.statusDot} />
                evaluating opportunities
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
          <div className={styles.trustLead}>Focused on practical business technology — without pretending every opportunity is already a deal.</div>
          <div className={styles.trustItem}>Robotics & automation</div>
          <div className={styles.trustItem}>Charging infrastructure</div>
          <div className={styles.trustItem}>Smart unattended retail</div>
          <div className={styles.trustItem}>AI business tools</div>
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
              We focus on the business problem first. Then we identify providers whose service area, equipment,
              support model, and commercial structure may fit the opportunity.
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

      <section className={`${styles.section} ${styles.sectionMuted}`}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionKicker}>Who we work with</div>
              <h2>One coordination layer. Different business needs.</h2>
            </div>
            <p>
              ORXYZ is designed for businesses that want to evaluate technology without sorting through every manufacturer,
              distributor, operator, installer, and commercial model on their own.
            </p>
          </div>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceCard}><b>Hospitality & entertainment</b><span>Guest charging, automation, service technology, and unattended retail.</span></div>
            <div className={styles.audienceCard}><b>Retail & customer-facing spaces</b><span>Compact technology that improves convenience without adding unnecessary operational burden.</span></div>
            <div className={styles.audienceCard}><b>Operations & facilities</b><span>Robotics and automation evaluated around a specific repetitive task or service requirement.</span></div>
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
              We keep each opportunity structured so the business and provider know exactly what has — and has not — been approved.
            </p>
          </div>
          <div className={styles.processGrid}>
            {steps.map((step) => (
              <article className={styles.processStep} key={step.number}>
                <div className={styles.stepNumber}>{step.number}<span className={styles.stepSignal} /></div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} id="providers">
        <div className={styles.shell}>
          <div className={styles.providerPanel}>
            <div className={styles.providerCopy}>
              <div className={styles.sectionKicker}>For technology providers</div>
              <h2>Good opportunities deserve clean handoffs.</h2>
              <p>
                ORXYZ can qualify potential business opportunities, confirm basic fit before disclosure when appropriate,
                preserve referral attribution, and coordinate written introductions when there is genuine mutual interest.
              </p>
              <a className={styles.providerButton} href={providerMail}>Discuss provider fit <span className={styles.arrow}>↗</span></a>
            </div>
            <div className={styles.providerList}>
              <div className={styles.providerItem}><div className={styles.providerCheck}>✓</div><div><b>Qualified context</b><span>Use case, location, constraints, and what the business is actually evaluating.</span></div></div>
              <div className={styles.providerItem}><div className={styles.providerCheck}>✓</div><div><b>Attribution clarity</b><span>Written records around the originating opportunity and commercial handoff.</span></div></div>
              <div className={styles.providerItem}><div className={styles.providerCheck}>✓</div><div><b>No inflated claims</b><span>Interest, evaluation, installation, and earned compensation are treated as different stages.</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="about">
        <div className={`${styles.shell} ${styles.founderGrid}`}>
          <div className={styles.founderCard}>
            <div className={styles.founderMonogram}>DH</div>
            <b>Dominic Hartenstein</b>
            <span>Founder · ORXYZ</span>
            <div className={styles.founderMeta}>
              <div className={styles.metaCard}><b>Based in</b><span>Buffalo, New York</span></div>
              <div className={styles.metaCard}><b>Communication</b><span>Written-first business coordination</span></div>
            </div>
          </div>
          <div className={styles.founderCopy}>
            <div className={styles.sectionKicker}>About ORXYZ</div>
            <h2>Independent by design. Precise by necessity.</h2>
            <p>
              ORXYZ is an independent technology sourcing and coordination business. We do not claim to manufacture the products
              we evaluate, and we do not present third-party pricing, installation, financing, revenue share, or support as guaranteed
              unless the applicable provider has confirmed those terms.
            </p>
            <p>
              The goal is simple: understand what a business needs, find a credible path, and make the introduction clearer for everyone involved.
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
                Send ORXYZ the task, location, or technology category you are evaluating. We can determine whether there is a practical provider path worth exploring.
              </p>
              <a className={styles.contactEmail} href={businessMail}>Email ORXYZ →</a>
            </div>
            <a className={styles.primaryButton} href={businessMail}>Start an inquiry <span className={styles.arrow}>↗</span></a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerGrid}`}>
          <div><div className={styles.footerBrand}>ORXYZ</div><div>Buffalo, New York, USA</div></div>
          <div>
            ORXYZ provides independent technology sourcing, introduction, and coordination services. Availability, pricing,
            installation, support, financing, and revenue-share terms are determined by the applicable third-party provider and remain subject to written approval.
          </div>
          <div>© 2026 ORXYZ</div>
        </div>
      </footer>
    </main>
  );
}
