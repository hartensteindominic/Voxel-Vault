import CapitalCompoundingDemo from '../CapitalCompoundingDemo';
import styles from './compound.module.css';

const flow = [
  ['01','Capital','Profile balance is allocated only after reserve and compliance gates.'],
  ['02','Scan','Global feeds surface low-cost rentable real-world assets.'],
  ['03','Verify','Local title, ownership, tax, insurance and rental rules must pass.'],
  ['04','Acquire','Approved providers close the real-world purchase or asset contract.'],
  ['05','Collect','Rent or usage revenue enters ring-fenced operating accounts.'],
  ['06','Compound','Net cash after expenses and reserves can fund the next asset.'],
];

export const metadata = {
  title: 'Voxel Vault | Global Rent Compounding',
  description: 'A simulation-first platform for acquiring verified real-world rentable assets, collecting net cash flow and reinvesting it into additional assets.',
};

export default function GlobalAssetCompoundPage(){
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <a href="/" className={styles.brand}><span className={styles.mark}>V</span>Voxel Vault</a>
        <div className={styles.navRight}>
          <span className={styles.pill}><span className={styles.statusDot}/>SIMULATION FIRST</span>
          <a className={styles.link} href="/real-estate">Property architecture</a>
          <a className={styles.link} href="/studio">3D studio</a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Own real assets · collect real cash flow · keep compounding</p>
          <h1>Rent.<br/><em>Everything.</em></h1>
          <p className={styles.lead}>Voxel Vault is evolving into a global real-world asset operating system. Start with capital in your profile, find the lowest-cost verified income-producing assets, collect net rent or usage revenue, protect reserves and reinvest the surplus into the next asset.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#compound">Run the demo engine</a>
            <a className={styles.secondary} href="/real-estate/onboard">Add a property</a>
          </div>
        </div>
        <aside className={styles.heroPanel}>
          <small>THE COMPOUNDING FLYWHEEL</small>
          <div className={styles.bigNumber}>1 → 2 → 5 → 20</div>
          <div style={{color:'#aeb8aa',fontSize:14,lineHeight:1.55}}>Not a guaranteed return. The product goal is a disciplined acquisition loop where verified net cash flow finances additional assets.</div>
          <div className={styles.loop}>
            <div className={styles.loopRow}><span className={styles.loopNum}>1</span>Acquire the best verified affordable asset.</div>
            <div className={styles.loopRow}><span className={styles.loopNum}>2</span>Operate it and collect real rent or usage fees.</div>
            <div className={styles.loopRow}><span className={styles.loopNum}>3</span>Pay taxes, insurance, maintenance and reserves first.</div>
            <div className={styles.loopRow}><span className={styles.loopNum}>4</span>Reinvest eligible net cash into another asset.</div>
          </div>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>One operating loop</p><h2>Capital becomes productive physical assets.</h2></div>
          <p>The blockchain is the audit and ownership layer. It does not replace land registries, leases, vehicle titles, local entities, property managers, insurers or payment providers.</p>
        </div>
        <div className={styles.flowGrid}>{flow.map(([n,title,copy])=><article className={styles.flowCard} key={n}><span>{n}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section id="compound" className={styles.darkSection}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>Profile capital engine</p><h2>Don’t buy the cheapest. Buy the cheapest good asset.</h2></div>
          <p>The ranking model considers net yield, purchase price, occupancy, liquidity and operating risk, and it excludes assets that fail the legal gate. If nothing qualifies, cash stays unspent.</p>
        </div>
        <CapitalCompoundingDemo/>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>Rent pools</p><h2>Pool cash flow without mixing the underlying books.</h2></div>
          <p>Each asset keeps its own legal entity, accounts and expenses. An approved portfolio layer can aggregate only the distributable net cash after each asset closes its operating period.</p>
        </div>
        <div className={styles.poolGrid}>
          <article className={styles.poolCard}>
            <p className={styles.eyebrow}>Single-owner compound pool</p>
            <h3>Your assets feed your acquisition balance.</h3>
            <p>This is the simplest future mode: assets owned for your account send eligible net cash into a reinvestment balance. No other investor capital is mixed into the pool.</p>
            <div className={styles.waterfall}>
              <div className={styles.waterRow}><span>Gross rent / usage revenue</span><strong>100%</strong></div>
              <div className={styles.waterRow}><span>Property or asset operating costs</span><strong>paid first</strong></div>
              <div className={styles.waterRow}><span>Maintenance + tax + insurance reserves</span><strong>protected</strong></div>
              <div className={styles.waterRow}><span>Eligible net cash</span><strong>reinvest</strong></div>
            </div>
          </article>
          <article className={styles.poolCard}>
            <p className={styles.eyebrow}>Multi-investor rent pools · later</p>
            <h3>Fractional participation needs a separate regulated pathway.</h3>
            <p>If multiple people contribute money expecting rental profits from assets operated by Voxel Vault or managers, the legal analysis changes. The platform therefore keeps pooled public investing locked behind jurisdiction-specific securities, custody, KYC/AML and transfer controls.</p>
            <div className={styles.waterfall}>
              <div className={styles.waterRow}><span>Investor eligibility</span><strong>required</strong></div>
              <div className={styles.waterRow}><span>Offering / exemption structure</span><strong>required</strong></div>
              <div className={styles.waterRow}><span>Permissioned ownership ledger</span><strong>required</strong></div>
              <div className={styles.waterRow}><span>Live public pool</span><strong>locked</strong></div>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.darkSection}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>Global asset network</p><h2>Real estate first. Then anything rentable.</h2></div>
          <p>The long-term architecture uses adapters. Each partner or asset category converts its ownership, revenue, maintenance and utilization data into one standardized Voxel Vault asset record.</p>
        </div>
        <div className={styles.globalGrid}>
          <article className={styles.globalCard}><b>🏠 Real property</b><p>Homes, multifamily buildings, land, parking, storage and commercial space. Deed/title systems and local entities remain authoritative.</p></article>
          <article className={styles.globalCard}><b>🛴 Mobility fleets</b><p>Future scooter, bike or vehicle-rental partners can expose fleet ownership, utilization, maintenance and revenue through provider adapters.</p></article>
          <article className={styles.globalCard}><b>🛠 Equipment</b><p>Rentable machinery, tools and business equipment can use serial-number identity, insurance, service history and lease revenue.</p></article>
          <article className={styles.globalCard}><b>📦 Storage</b><p>Storage units, lockers and other small spaces can be treated as recurring cash-flow assets when the underlying rights are verifiable.</p></article>
          <article className={styles.globalCard}><b>🪑 Space</b><p>Rooms, desks, studios and commercial areas can connect through booking or property-management integrations where legally permitted.</p></article>
          <article className={styles.globalCard}><b>⛓ Blockchain layer</b><p>Hashes, permissioned ownership records, approved distributions and tamper-evident operating history provide a common audit rail across categories.</p></article>
        </div>
        <div className={styles.warning}><b>Worldwide does not mean unrestricted.</b> Every acquisition must pass the local jurisdiction gate for foreign ownership, title, entity structure, tax, rental use, insurance, payment/FX and management. Countries or asset classes without a verified pathway stay blocked.</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>What comes next</p><h2>Turn the simulation into one real, boring, profitable pilot.</h2></div>
          <p>The safest progression is one jurisdiction, one inexpensive asset, one verified ownership vehicle, one operator and one cash-flow ledger. Once that works end-to-end, the same adapter model can expand outward.</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.primary} href="/real-estate/onboard">Start the property intake flow</a>
          <a className={styles.secondary} href="/real-estate">View property-token architecture</a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div><strong>Voxel Vault Global Rent Engine</strong><br/>Simulation-first real-world asset compounding architecture.</div>
        <div>Live acquisitions and pooled investing disabled · no guaranteed returns · legal/title/provider approval required per jurisdiction.</div>
      </footer>
    </div>
  </main>;
}
