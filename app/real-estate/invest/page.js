import PropertyTwinCanvas from '../PropertyTwinCanvas';
import AutoCompoundWallet from './AutoCompoundWallet';

export const metadata = {
  title: 'Auto-Compound Property Wallet | Voxel Vault',
  description: 'Simulation-first fractional real-estate wallet with 3D property twins, blockchain-ready ownership records and automatic modeled rent reinvestment.',
};

export default function PropertyInvestPage(){
  return <main style={{minHeight:'100vh',background:'#070a08',color:'#f6f8f2',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'}}>
    <div style={{maxWidth:1180,margin:'0 auto',padding:'20px clamp(16px,4vw,34px) 56px'}}>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <a href="/" style={{color:'inherit',textDecoration:'none',fontWeight:950,letterSpacing:'-.04em',fontSize:20}}>V · Voxel Vault</a>
        <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
          <span style={pill}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#b8ff55',marginRight:7}}/>$1,000 PILOT</span>
          <a href="/real-estate" style={link}>Property platform</a>
          <a href="/real-estate/compound" style={link}>Full-asset simulator</a>
        </div>
      </nav>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:22,alignItems:'stretch',padding:'58px 0 34px'}}>
        <div style={{alignSelf:'center'}}>
          <div style={eyebrow}>FRACTIONAL REAL ESTATE · 3D · AUTO-COMPOUND</div>
          <h1 style={{fontSize:'clamp(3.4rem,9vw,7.4rem)',lineHeight:.84,letterSpacing:'-.075em',margin:'14px 0 24px'}}>Make the first<br/><span style={{color:'#b8ff55'}}>$1,000 work.</span></h1>
          <p style={{fontSize:'clamp(1.05rem,2vw,1.28rem)',lineHeight:1.6,color:'#b8c1b4',maxWidth:720}}>Instead of pretending $1,000 can buy an entire rental property, Voxel Vault models a diversified basket of small property interests. Net rent lands in a reinvestment wallet and is automatically allocated to the next eligible share once the balance is large enough.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}>
            <a href="#wallet" style={{...cta,background:'#b8ff55',color:'#0c120b'}}>RUN $1,000 DEMO</a>
            <a href="/real-estate/onboard" style={{...cta,border:'1px solid #364033',color:'#f6f8f2'}}>ADD A PROPERTY</a>
          </div>
          <p style={{fontSize:12,lineHeight:1.55,color:'#7e897a',marginTop:16}}>Simulation only. No investment account, brokerage, marketplace or wallet signer is connected. Returns are not guaranteed and demo yields are not forecasts.</p>
        </div>

        <div style={{position:'relative',minHeight:390,border:'1px solid #273126',borderRadius:30,overflow:'hidden',background:'#0c120d'}}>
          <PropertyTwinCanvas style={{width:'100%',height:'100%'}} />
          <div style={{position:'absolute',top:16,left:16,...pill,background:'rgba(7,10,8,.78)'}}>3D PROPERTY TWIN</div>
          <div style={{position:'absolute',bottom:16,left:16,right:16,display:'flex',justifyContent:'space-between',gap:12,alignItems:'end'}}>
            <div><small style={{color:'#93a08d'}}>PORTFOLIO MODE</small><strong style={{display:'block',fontSize:20}}>Fractional property basket</strong></div>
            <span style={{...pill,background:'rgba(184,255,85,.12)',color:'#b8ff55'}}>AUTO-COMPOUND</span>
          </div>
        </div>
      </section>

      <section id="wallet" style={{scrollMarginTop:20}}><AutoCompoundWallet/></section>

      <section style={{marginTop:28,padding:'26px 0 0',borderTop:'1px solid #222b21',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:18,color:'#8e998a',fontSize:13,lineHeight:1.6}}>
        <div><b style={{color:'#eef2e9'}}>Target production architecture</b><br/>Regulated/provider-managed investment account → property-specific legal interests → blockchain audit/ownership mirror → net distributions → reinvestment wallet.</div>
        <div><b style={{color:'#eef2e9'}}>What Voxel Vault adds</b><br/>3D spatial property vaults, one portfolio view, compliance-aware ranking, transparent rent waterfalls and a configurable reinvestment policy.</div>
        <div><b style={{color:'#eef2e9'}}>What stays outside Voxel Vault</b><br/>Title recording, securities issuance, custody, KYC/AML, tax reporting and actual asset purchases remain with qualified providers unless separately licensed and approved.</div>
      </section>
    </div>
  </main>;
}

const eyebrow={fontSize:12,fontWeight:900,letterSpacing:'.15em',color:'#b8ff55'};
const pill={border:'1px solid #34402f',borderRadius:999,padding:'8px 11px',fontSize:11,fontWeight:900,letterSpacing:'.08em',whiteSpace:'nowrap'};
const link={color:'#c8d0c3',textDecoration:'none',fontSize:13,fontWeight:800};
const cta={display:'inline-block',borderRadius:14,padding:'13px 17px',textDecoration:'none',fontWeight:950,fontSize:13,letterSpacing:'.03em'};
