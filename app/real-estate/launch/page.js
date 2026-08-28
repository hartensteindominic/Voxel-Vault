import {
  legalReadinessWorkstreams,
  officialRegulatoryReferences,
  partnerDiligenceChecklist,
  regulatedLaunchPacket,
  reviewReadyWorkItems,
} from '../../../lib/real-estate/legal-launch';

const gates = [
  ['01', 'Registered intermediary', 'Contract with a FINRA/SEC-registered broker-dealer or funding portal for the chosen offering path.', 'EXTERNAL'],
  ['02', 'Property + issuer', 'One actual property, dedicated issuer/property LLC, title review, insurance and property-management agreements.', 'EXTERNAL'],
  ['03', 'Offering approval', 'Securities counsel and the intermediary approve the offering documents, filings, investor eligibility and marketing flow.', 'EXTERNAL'],
  ['04', 'Investor compliance', 'Provider-backed identity, KYC/AML, sanctions and Reg CF investment-limit or Reg D accreditation checks.', 'EXTERNAL'],
  ['05', 'Escrow + settlement', 'Investor money moves through approved escrow/payment rails; client-side payment state never creates ownership.', 'EXTERNAL'],
  ['06', 'Tokenized ownership', 'Permissioned units are minted/recorded only from provider-authoritative closing allocations and executed legal rights.', 'BUILT · PILOT'],
  ['07', '3D Property Passport', 'Verified property metadata and document hashes anchor the spatial twin without pretending the NFT is the deed.', 'BUILT · PILOT'],
  ['08', 'Rent accounting', 'Actual rent, expenses, reserves and an approved net-income statement precede every investor distribution.', 'BUILT · PILOT'],
  ['09', 'Reinvestment', 'Confirm-each mode first. Automatic reinvestment requires explicit intermediary/counsel approval of the workflow.', 'LOCKED'],
  ['10', 'Secondary market', 'No unrestricted P2P trading. Any resale uses approved transfer controls and a compliant venue/ATS where available.', 'LOCKED'],
];

const paths = [
  { name: 'Reg CF · FIRST RETAIL PATH', audience: 'Accredited + non-accredited investors', limit: 'Up to $5M / 12 months per eligible issuer', note: 'Use one registered broker-dealer or funding portal for each offering. Best fit for proving the first small-property retail offering.' },
  { name: 'Reg D 506(c)', audience: 'Accredited investors only', limit: 'Private-offering exemption', note: 'Useful later for accredited capital. Accredited status requires reasonable verification; a checkbox alone is not enough.' },
  { name: 'Reg A Tier 2', audience: 'Retail + accredited', limit: 'Potential scale path', note: 'Heavier qualification/reporting project. Treat as phase two after one property and its operating/distribution loop are proven.' },
];

export const metadata = {
  title: 'Legal Launch Readiness | Voxel Vault',
  description: 'Compliance-first launch architecture for real-property offerings, tokenized ownership, regulated settlement and 3D property passports.',
};

export default function LegalLaunchPage() {
  return <main style={page}>
    <div style={shell}>
      <nav style={nav}>
        <a href="/" style={brand}>V · Voxel Vault</a>
        <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
          <span style={pill}><span style={dot}/>LEGAL LAUNCH BUILD</span>
          <a href="/real-estate/invest" style={link}>$1,000 wallet</a>
          <a href="/real-estate/onboard" style={link}>Property intake</a>
        </div>
      </nav>

      <section style={{padding:'64px 0 34px',maxWidth:980}}>
        <div style={eyebrow}>REAL PROPERTY · REGULATED OFFERING · ON-CHAIN OWNERSHIP RECORD</div>
        <h1 style={hero}>Make it<br/><span style={{color:'#b8ff55'}}>legally launchable.</span></h1>
        <p style={lead}>Voxel Vault should own the spatial product experience—not pretend to be an unlicensed broker, exchange or custodian. The first live property is designed to launch through a registered securities intermediary while Voxel Vault supplies the 3D wallet, property verification layer, permissioned blockchain contracts and reconciled distribution experience.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}>
          <a href="#gates" style={{...button,background:'#b8ff55',color:'#0a0e0a'}}>VIEW LAUNCH GATES</a>
          <a href="/real-estate/onboard" style={{...button,border:'1px solid #354234',color:'#f6f8f2'}}>START PROPERTY #0001</a>
        </div>
      </section>

      <section style={callout}>
        <div>
          <small style={small}>RECOMMENDED FIRST OFFERING PATH</small>
          <strong style={{display:'block',fontSize:'clamp(2rem,5vw,4rem)',letterSpacing:'-.055em',marginTop:6}}>Regulation Crowdfunding + registered partner</strong>
        </div>
        <p style={{margin:0,color:'#acb7a8',lineHeight:1.65,maxWidth:480}}>Designed for a retail-accessible first property. Voxel Vault does not unlock live checkout until the actual issuer, intermediary, offering, title, investor-compliance and settlement integrations exist.</p>
      </section>

      <section style={{padding:'38px 0 12px'}}>
        <div style={eyebrow}>OFFERING ARCHITECTURE</div>
        <div style={pathGrid}>{paths.map(path => <article key={path.name} style={card}>
          <div style={{fontSize:12,fontWeight:950,letterSpacing:'.1em',color:'#b8ff55'}}>{path.name}</div>
          <h2 style={{fontSize:24,letterSpacing:'-.035em',margin:'14px 0 7px'}}>{path.audience}</h2>
          <b style={{display:'block',marginBottom:10}}>{path.limit}</b>
          <p style={muted}>{path.note}</p>
        </article>)}</div>
      </section>

      <section id="gates" style={{padding:'42px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'end',flexWrap:'wrap'}}>
          <div><div style={eyebrow}>PRODUCTION GATES</div><h2 style={sectionTitle}>Code is only one part of going live.</h2></div>
          <span style={{...pill,color:'#ffca7a',borderColor:'#5d4930'}}>REAL-MONEY EXECUTION · LOCKED</span>
        </div>
        <div style={{display:'grid',gap:10,marginTop:20}}>{gates.map(([n,title,copy,status]) => <article key={n} style={gate}>
          <span style={{fontWeight:950,color:'#b8ff55'}}>{n}</span>
          <div><strong style={{fontSize:18}}>{title}</strong><p style={{...muted,marginTop:5}}>{copy}</p></div>
          <span style={{...pill,justifySelf:'end',color:status.startsWith('BUILT')?'#b8ff55':'#cad2c7'}}>{status}</span>
        </article>)}</div>
      </section>

      <section style={{padding:'42px 0'}}>
        <div style={{maxWidth:820}}>
          <div style={eyebrow}>FOUNDER + CODEX WORKROOM</div>
          <h2 style={sectionTitle}>We can build the product. The live offering needs evidence.</h2>
          <p style={{...muted,marginTop:12}}>This page separates what we can safely build in GitHub from what licensed counsel, title professionals and regulated providers must approve before any investor money, tokenized rights or distributions go live.</p>
        </div>
        <div style={workstreamGrid}>{legalReadinessWorkstreams.map(workstream => <article key={workstream.name} style={workstreamCard}>
          <div style={{fontSize:12,fontWeight:950,letterSpacing:'.11em',color:'#b8ff55'}}>WORKSTREAM</div>
          <h3 style={{fontSize:24,letterSpacing:'-.04em',margin:'10px 0 6px'}}>{workstream.name}</h3>
          <p style={{...muted,fontSize:13}}>Accountable: {workstream.accountable}</p>
          <div style={laneGrid}>
            <div><b style={laneTitle}>Founder lane</b><p style={laneCopy}>{workstream.founderLane}</p></div>
            <div><b style={laneTitle}>Codex lane</b><p style={laneCopy}>{workstream.codexLane}</p></div>
          </div>
          <div style={evidenceBox}>
            <b style={laneTitle}>Evidence before live</b>
            <ul style={list}>{workstream.evidence.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
        </article>)}</div>
      </section>

      <section style={{padding:'24px 0 42px'}}>
        <div style={eyebrow}>REGULATED LAUNCH PACKET</div>
        <h2 style={sectionTitle}>Next real-world move: pick counsel and partner.</h2>
        <div style={packetGrid}>
          <article style={packetHero}>
            <small style={small}>IMMEDIATE NEXT ACTION</small>
            <strong style={{display:'block',fontSize:26,letterSpacing:'-.035em',marginTop:8}}>{regulatedLaunchPacket.immediateNextAction}</strong>
            <div style={statusStrip}>
              <span style={{...pill,color:'#ffca7a',borderColor:'#5d4930'}}>MONEY MOVEMENT · {regulatedLaunchPacket.liveMoneyMovement.toUpperCase()}</span>
              <span style={{...pill,color:'#ffca7a',borderColor:'#5d4930'}}>OWNERSHIP MINTING · {regulatedLaunchPacket.liveOwnershipMinting.toUpperCase()}</span>
            </div>
            <p style={{...muted,fontSize:13,marginTop:13}}>Review documents: {regulatedLaunchPacket.reviewDocuments.map(doc => doc.path).join(' · ')}</p>
          </article>
          <article style={packetCard}>
            <b style={laneTitle}>Founder can do now</b>
            <ul style={list}>{regulatedLaunchPacket.founderCanDoNow.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
          <article style={packetCard}>
            <b style={laneTitle}>Codex can do now</b>
            <ul style={list}>{regulatedLaunchPacket.codexCanDoNow.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
          <article style={packetCard}>
            <b style={laneTitle}>Blocked until approved</b>
            <ul style={list}>{regulatedLaunchPacket.prohibitedUntilApproved.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        <div style={diligenceGrid}>{partnerDiligenceChecklist.map(item => <article key={item.area} style={diligenceCard}>
          <small style={small}>{item.owner}</small>
          <h3 style={{fontSize:22,letterSpacing:'-.035em',margin:'8px 0 10px'}}>{item.area}</h3>
          <ul style={list}>{item.checks.map(check => <li key={check}>{check}</li>)}</ul>
          <p style={{...muted,fontSize:13,marginTop:12}}>Evidence: {item.evidence.join(', ')}.</p>
        </article>)}</div>
      </section>

      <section style={{padding:'24px 0 42px'}}>
        <div style={eyebrow}>REVIEW-READY GITHUB QUEUE</div>
        <h2 style={sectionTitle}>The work is split into real issues.</h2>
        <div style={issueGrid}>{reviewReadyWorkItems.map(item => <a key={item.issue} href={item.url} target="_blank" rel="noreferrer" style={issueCard}>
          <small style={small}>{item.issue}</small>
          <strong style={{display:'block',fontSize:20,letterSpacing:'-.03em',margin:'7px 0 10px'}}>{item.name}</strong>
          <p style={{...muted,fontSize:13}}><b>Founder:</b> {item.firstFounderAction}</p>
          <p style={{...muted,fontSize:13,marginTop:8}}><b>Codex:</b> {item.firstCodexAction}</p>
        </a>)}</div>
      </section>

      <section style={{padding:'24px 0 42px'}}>
        <div style={eyebrow}>OFFICIAL SOURCE CHECK</div>
        <h2 style={sectionTitle}>Build around primary sources.</h2>
        <div style={referenceGrid}>{officialRegulatoryReferences.map(reference => <a key={reference.name} href={reference.url} target="_blank" rel="noreferrer" style={referenceCard}>
          <small style={small}>{reference.agency}</small>
          <strong style={{display:'block',fontSize:19,letterSpacing:'-.025em',margin:'7px 0'}}>{reference.name}</strong>
          <p style={{...muted,fontSize:13}}>{reference.productImpact}</p>
        </a>)}</div>
      </section>

      <section style={callout}>
        <div>
          <small style={small}>THE FIRST TRUE LIVE MILESTONE</small>
          <strong style={{display:'block',fontSize:27,letterSpacing:'-.035em',marginTop:7}}>One real property. One real closing. One reconciled rent distribution.</strong>
        </div>
        <p style={{margin:0,color:'#acb7a8',lineHeight:1.65,maxWidth:520}}>After that complete chain works, add more properties. Do not use a mainnet flag as a substitute for title, legal documents, regulated settlement or actual property operations.</p>
      </section>

      <footer style={{borderTop:'1px solid #20291f',marginTop:40,padding:'26px 0',fontSize:12,lineHeight:1.6,color:'#7f897b'}}>Engineering launch plan only · not legal, tax or investment advice · no live offering is available from this prototype · registered intermediary and counsel approval required before accepting investment funds.</footer>
    </div>
  </main>;
}

const page={minHeight:'100vh',background:'#070a08',color:'#f6f8f2',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'};
const shell={maxWidth:1180,margin:'0 auto',padding:'20px clamp(16px,4vw,34px) 48px'};
const nav={display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'};
const brand={color:'inherit',textDecoration:'none',fontWeight:950,letterSpacing:'-.04em',fontSize:20};
const pill={display:'inline-flex',alignItems:'center',border:'1px solid #34402f',borderRadius:999,padding:'8px 11px',fontSize:11,fontWeight:900,letterSpacing:'.08em',whiteSpace:'nowrap'};
const dot={display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#ffb552',marginRight:7};
const link={color:'#c8d0c3',textDecoration:'none',fontSize:13,fontWeight:800};
const eyebrow={fontSize:12,fontWeight:900,letterSpacing:'.15em',color:'#b8ff55'};
const hero={fontSize:'clamp(3.8rem,10vw,8.5rem)',lineHeight:.84,letterSpacing:'-.075em',margin:'15px 0 26px'};
const lead={fontSize:'clamp(1.05rem,2vw,1.28rem)',lineHeight:1.65,color:'#b8c1b4',maxWidth:860};
const button={display:'inline-block',borderRadius:14,padding:'13px 17px',textDecoration:'none',fontWeight:950,fontSize:13,letterSpacing:'.03em'};
const callout={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:24,alignItems:'center',border:'1px solid #2a3528',borderRadius:26,padding:'clamp(20px,4vw,30px)',background:'rgba(184,255,85,.045)'};
const small={fontWeight:950,letterSpacing:'.12em',color:'#8e9b88'};
const pathGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:12,marginTop:18};
const card={border:'1px solid rgba(255,255,255,.11)',borderRadius:22,padding:20,background:'rgba(255,255,255,.04)'};
const muted={color:'#97a293',lineHeight:1.6,margin:0};
const sectionTitle={fontSize:'clamp(2rem,5vw,3.7rem)',letterSpacing:'-.05em',margin:'7px 0 0'};
const gate={display:'grid',gridTemplateColumns:'36px minmax(0,1fr) auto',gap:14,alignItems:'center',border:'1px solid rgba(255,255,255,.1)',borderRadius:18,padding:'15px 16px',background:'rgba(255,255,255,.025)'};
const workstreamGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:12,marginTop:20};
const workstreamCard={border:'1px solid rgba(184,255,85,.16)',borderRadius:22,padding:20,background:'linear-gradient(145deg,rgba(184,255,85,.055),rgba(255,255,255,.025))'};
const laneGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginTop:16};
const laneTitle={display:'block',fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',color:'#dce6d7'};
const laneCopy={margin:'7px 0 0',color:'#9aa695',lineHeight:1.55,fontSize:13};
const evidenceBox={marginTop:16,padding:14,border:'1px solid rgba(255,255,255,.1)',borderRadius:16,background:'rgba(7,10,8,.45)'};
const list={margin:'9px 0 0',paddingLeft:18,color:'#aeb9aa',fontSize:13,lineHeight:1.55};
const packetGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:12,marginTop:18};
const packetHero={gridColumn:'1 / -1',border:'1px solid rgba(184,255,85,.2)',borderRadius:22,padding:'clamp(18px,3vw,24px)',background:'rgba(184,255,85,.055)'};
const statusStrip={display:'flex',gap:9,flexWrap:'wrap',marginTop:16};
const packetCard={border:'1px solid rgba(255,255,255,.11)',borderRadius:18,padding:17,background:'rgba(255,255,255,.03)'};
const diligenceGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:12,marginTop:12};
const diligenceCard={border:'1px solid rgba(255,255,255,.1)',borderRadius:18,padding:17,background:'rgba(7,10,8,.58)'};
const issueGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:12,marginTop:18};
const issueCard={display:'block',color:'inherit',textDecoration:'none',border:'1px solid rgba(184,255,85,.14)',borderRadius:18,padding:17,background:'rgba(255,255,255,.03)'};
const referenceGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,marginTop:18};
const referenceCard={display:'block',color:'inherit',textDecoration:'none',border:'1px solid rgba(255,255,255,.1)',borderRadius:18,padding:17,background:'rgba(255,255,255,.03)'};
