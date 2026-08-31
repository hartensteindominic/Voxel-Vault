import { BankingActions } from './banking-actions';
import { CryptoTrading } from './crypto-trading';
import { GalacticChat } from './galactic-chat';

const navItems = [
  ['⌂', 'Dashboard', '#dashboard'],
  ['✦', 'Business AI', '/business'],
  ['▣', 'Accounts', '#accounts'],
  ['⇄', 'Transfer', '#transfer'],
  ['✣', 'Add Money', '#add-money'],
  ['▤', 'Cards', '#cards'],
  ['▧', 'Pay Bills', '#pay-bills'],
  ['▥', 'Investments', '#investments'],
  ['◇', 'Goals', '#goals'],
  ['✿', 'Rewards', '#rewards'],
];

const activity = [
  { icon: 'a', name: 'Amazon.com', category: 'Shopping', amount: '−$89.32', date: 'Today', tone: 'dark' },
  { icon: '●', name: 'Spotify Premium', category: 'Entertainment', amount: '−$11.99', date: 'May 18', tone: 'green' },
  { icon: '↓', name: 'Transfer from Alex', category: 'Incoming Transfer', amount: '+$200.00', date: 'May 18', tone: 'purple', positive: true },
  { icon: '☕', name: 'Star Coffee', category: 'Food & Drinks', amount: '−$6.45', date: 'May 17', tone: 'sage' },
  { icon: '▰', name: 'Payroll Direct Deposit', category: 'Income', amount: '+$2,850.00', date: 'May 15', tone: 'blue', positive: true },
];

function PlanetLogo() {
  return (
    <span className="planetLogo" aria-hidden="true">
      <span className="planetBody" />
      <span className="planetRing" />
      <span className="planetStar">★</span>
    </span>
  );
}

function Sparkline({ variant }: { variant: 'blue' | 'teal' }) {
  const path = variant === 'blue'
    ? 'M2 34 C18 27, 24 39, 40 31 S62 32, 78 24 S98 30, 114 20 S134 14, 148 26 S165 9, 181 12 S199 6, 216 0'
    : 'M2 35 C16 32, 26 39, 42 33 S64 36, 78 30 S96 33, 111 22 S126 27, 142 18 S157 23, 171 12 S188 5, 201 17 S212 10, 220 4';
  return (
    <svg className={`sparkline ${variant}`} viewBox="0 0 222 40" role="img" aria-label="Account balance trend">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function BankCard({ pink = false }: { pink?: boolean }) {
  return (
    <article className={`bankCard ${pink ? 'pink' : 'blue'}`}>
      <div className="cardTopline"><span>★ GALACTIC TRUST</span><span className="contactless">)))</span></div>
      <div className="cardPlanet" aria-hidden="true"><span /></div>
      <div className="cardName">{pink ? 'Cosmic Pink' : 'Nebula Blue'}</div>
      <div className="cardNumber">•••• {pink ? '8756' : '4532'}</div>
      <div className="cardFooter"><span>DEBIT CARD</span>{pink ? <span className="mastercard"><i /><i /></span> : <strong>VISA</strong>}</div>
    </article>
  );
}

export default function Home() {
  return (
    <main className="bankApp">
      <aside className="sidebar">
        <div className="brandLockup"><PlanetLogo /><span>Galactic<br />Trust</span></div>

        <nav className="sideNav" aria-label="Primary navigation">
          {navItems.map(([icon, label, href], index) => (
            <a key={label} href={href} className={index === 0 ? 'active' : ''}>
              <span className="navIcon">{icon}</span><span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebarSpacer" />
        <div className="sideUtilities">
          <a href="#security"><span className="navIcon">⚙</span><span>Settings</span></a>
          <a href="#help"><span className="navIcon">?</span><span>Help Center</span></a>
          <div className="sideRule" />
          <a href="#logout"><span className="navIcon">↪</span><span>Log Out</span></a>
        </div>

        <div className="astronaut" aria-hidden="true">🧑‍🚀</div>
        <section className="rewardsCard">
          <strong>Galactic rewards<br />are waiting! ✨</strong>
          <p>You have <b>2,450</b> stars</p>
          <button type="button">Explore Rewards</button>
        </section>
      </aside>

      <section className="dashboard" id="dashboard">
        <header className="dashboardHeader">
          <div>
            <h1>Welcome back, Nova! <span>👋</span></h1>
            <p>Here&apos;s what&apos;s happening in your galaxy.</p>
          </div>
          <div className="headerTools">
            <label className="searchBox">
              <span className="srOnly">Search</span>
              <input placeholder="Search anything..." />
              <span>⌕</span>
            </label>
            <button className="iconButton notification" type="button" aria-label="Notifications">♧<i>3</i></button>
            <button className="profileButton" type="button"><span className="avatar">◈</span><b>Nova Star</b><span>⌄</span></button>
          </div>
        </header>

        <div className="contentGrid">
          <section className="mainColumn">
            <article className="balanceHero">
              <div className="balanceCopy">
                <div className="balanceLabel">Total Balance <span>◉</span></div>
                <div className="balanceAmount">$24,350.72</div>
                <div className="balanceGrowth">↑ <b>12.4%</b> <span>vs last month</span></div>
              </div>
              <div className="heroStars">✦</div>
              <div className="heroPlanet big"><span /></div>
              <div className="heroPlanet small"><span /></div>
              <div className="heroHorizon" />
            </article>

            <BankingActions />

            <div className="accountGrid" id="accounts">
              <article className="accountCard">
                <div className="accountTitle"><span className="accountIcon blue">▤</span><span>Checking Account<strong>$15,230.45</strong><small>•••• 4532</small></span><button type="button">›</button></div>
                <Sparkline variant="blue" />
              </article>
              <article className="accountCard">
                <div className="accountTitle"><span className="accountIcon teal">▣</span><span>Savings Account<strong>$9,120.27</strong><small>•••• 8756</small></span><button type="button">›</button></div>
                <Sparkline variant="teal" />
              </article>
            </div>

            <section className="activityCard">
              <div className="sectionHeading"><h2>Recent Activity</h2><a href="#activity">View All</a></div>
              <div className="activityList" id="activity">
                {activity.map((item) => (
                  <div className="activityRow" key={item.name}>
                    <span className={`merchantIcon ${item.tone}`}>{item.icon}</span>
                    <span className="activityMeta"><b>{item.name}</b><small>{item.category}</small></span>
                    <span className={`activityAmount ${item.positive ? 'positive' : ''}`}><b>{item.amount}</b><small>{item.date}</small></span>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="rightColumn">
            <section className="cardsPanel" id="cards">
              <div className="sectionHeading"><h2>My Cards</h2><a href="#cards">View All</a></div>
              <BankCard />
              <BankCard pink />
            </section>

            <section className="insightsPanel" id="insights">
              <div className="sectionHeading"><h2>Spending Insights</h2><button type="button">This Month⌄</button></div>
              <div className="insightsTotal"><strong>$1,586.34</strong><span>Total Spent <i>↓ 8.7% vs last month</i></span></div>
              <div className="insightsBody">
                <div className="legend">
                  <div><span className="dot purple" />Shopping <b>$623.10&nbsp;&nbsp; 39%</b></div>
                  <div><span className="dot green" />Food &amp; Drinks <b>$312.45&nbsp;&nbsp; 20%</b></div>
                  <div><span className="dot teal" />Transport <b>$210.75&nbsp;&nbsp; 13%</b></div>
                  <div><span className="dot coral" />Entertainment <b>$198.50&nbsp;&nbsp; 12%</b></div>
                  <div><span className="dot blue" />Bills &amp; Utilities <b>$241.54&nbsp;&nbsp; 16%</b></div>
                </div>
                <div className="donut" aria-label="Spending breakdown chart"><span>•ᴗ•</span></div>
              </div>
              <button className="breakdownButton" type="button"><span>▥</span> See Full Breakdown <b>›</b></button>
            </section>

            <CryptoTrading />

            <section className="securityPanel" id="security">
              <div className="sectionHeading">
                <div><h2>Security &amp; Privacy</h2><small>Protection built in</small></div>
                <span className="shieldBadge">✓</span>
              </div>
              <div className="securityList">
                <div><span className="securityIcon">⌁</span><span><b>Protected sessions</b><small>Signed live-banking authentication and short-lived requests.</small></span></div>
                <div><span className="securityIcon">▣</span><span><b>Masked card data</b><small>Full card number, CVV and PIN are never shown in this dashboard.</small></span></div>
                <div><span className="securityIcon">◎</span><span><b>Privacy-minded chat</b><small>Orbit never asks for passwords, PINs, CVVs or one-time codes.</small></span></div>
                <div><span className="securityIcon">◈</span><span><b>Live-money guard</b><small>Real banking and crypto remain off until approved providers are configured.</small></span></div>
              </div>
              <a className="privacyCenterLink" href="/privacy">Open Privacy Center <span>›</span></a>
              <p className="securityFootnote">Demo balances and trades are simulated. Real product disclosures must match the approved partner programs before launch.</p>
            </section>
          </aside>
        </div>
      </section>

      <GalacticChat />
    </main>
  );
}
