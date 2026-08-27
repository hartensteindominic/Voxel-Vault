import { aiLicensePriceAtomic, listLicensableAssets } from '../../lib/ai-licensing';
import { x402RuntimeStatus } from '../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function usdcPrice(atomic: string) {
  const value = Number(atomic) / 1_000_000;
  return Number.isFinite(value) ? value.toFixed(value < 0.01 ? 4 : 2) : '0.01';
}

function short(value: string) {
  return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : '—';
}

const cardStyle = {
  border: '1px solid #30392d',
  borderRadius: 22,
  padding: 20,
  background: 'linear-gradient(180deg,#121811,#0c100c)',
} as const;

const mutedText = {
  color: '#aab3a6',
  lineHeight: 1.55,
} as const;

export default async function AiLicensingPage() {
  const x402 = x402RuntimeStatus();
  const priceAtomic = aiLicensePriceAtomic();
  const price = usdcPrice(priceAtomic);
  let catalog: Awaited<ReturnType<typeof listLicensableAssets>> | null = null;
  let catalogError = '';
  try {
    catalog = await listLicensableAssets(24);
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'Catalog is temporarily unavailable.';
  }

  const statusLabel = x402.configured?'LIVE':'NEEDS CONFIG';
  const liveCopy = `Voxel Vault AI Licensing is live on Base. AI agents, tools, and games can discover NFT-linked 3D voxel assets and pay per machine-use with x402 USDC. Catalog: https://www.voxelvault.io/api/licenses/catalog Public page: https://www.voxelvault.io/ai-licensing Human test payment: https://www.voxelvault.io/pay`;

  return <main style={{minHeight:'100vh',background:'#070907',color:'#f5f7ef',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'}}>
    <nav style={{maxWidth:1120,margin:'0 auto',padding:'20px 20px 0',display:'flex',justifyContent:'space-between',gap:16,alignItems:'center'}}>
      <a href="/studio" style={{color:'#f5f7ef',textDecoration:'none',fontWeight:950,letterSpacing:'-.03em'}}>Voxel Vault</a>
      <span style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#b6ff22'}}>AI LICENSING · BASE · X402</span>
    </nav>

    <section style={{maxWidth:1120,margin:'0 auto',padding:'58px 20px 28px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:22,alignItems:'stretch'}}>
      <div>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'.16em',color:'#b6ff22'}}>LIVE MACHINE-CALLABLE ASSET LICENSING</div>
        <h1 style={{fontSize:'clamp(3rem,8vw,6.9rem)',lineHeight:.86,letterSpacing:'-.07em',margin:'14px 0 24px',maxWidth:980}}>Your NFT can earn<br/><span style={{color:'#b6ff22'}}>when AI uses it.</span></h1>
        <p style={{fontSize:'clamp(1.08rem,2.2vw,1.38rem)',...mutedText,maxWidth:790,margin:0}}>Voxel Vault turns eligible VoxelFlip NFTs into paid machine-use assets. AI agents and apps discover the catalog, pay a small Base USDC fee through x402, and receive a one-use license receipt.</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:24}}>
          <a href="/api/licenses/catalog" target="_blank" rel="noreferrer" style={{color:'#0b0d0b',background:'#b6ff22',padding:'13px 17px',borderRadius:14,textDecoration:'none',fontWeight:950}}>OPEN FREE CATALOG ↗</a>
          <a href="/pay" style={{color:'#0b0d0b',background:'#f5f7ef',padding:'13px 17px',borderRadius:14,textDecoration:'none',fontWeight:950}}>HUMAN TEST PAYMENT</a>
          <a href="#developer-test" style={{color:'#f5f7ef',border:'1px solid #3d4939',padding:'13px 17px',borderRadius:14,textDecoration:'none',fontWeight:900}}>HOW BUILDERS PAY</a>
        </div>
      </div>
      <aside style={{...cardStyle,display:'flex',flexDirection:'column',justifyContent:'space-between',gap:18}}>
        <div>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#8f998b'}}>PAYMENT STATUS</div>
          <div style={{fontSize:42,fontWeight:950,letterSpacing:'-.04em',marginTop:8,color:x402.configured?'#b6ff22':'#ffca6a'}}>{statusLabel}</div>
          <p style={{fontSize:14,...mutedText,margin:'8px 0 0'}}>{x402.configured?'Ready for paid x402 license tests on Base.':'Receiver or facilitator configuration is still missing in production.'}</p>
        </div>
        <div style={{borderTop:'1px solid #283025',paddingTop:16,fontSize:13,color:'#9da698',lineHeight:1.65}}>
          Receiver: {short(x402.payTo)}<br/>
          Network: Base mainnet<br/>
          Settlement asset: USDC
        </div>
      </aside>
    </section>

    <section style={{maxWidth:1120,margin:'0 auto',padding:'0 20px 28px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <div style={cardStyle}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>MACHINE PAYMENTS</small><div style={{fontSize:27,fontWeight:950,marginTop:7,color:x402.configured?'#b6ff22':'#ffca6a'}}>{x402.configured?'LIVE':'NEEDS CONFIG'}</div><p style={{fontSize:13,...mutedText,margin:'7px 0 0'}}>{x402.configured?'Receiver + facilitator are configured for Base.':'Code is live, but x402 receiver/facilitator credentials still need production configuration.'}</p></div>
      <div style={cardStyle}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>PRICE / LICENSED USE</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>${price} USDC</div><p style={{fontSize:13,...mutedText,margin:'7px 0 0'}}>{priceAtomic} atomic USDC · Base mainnet · one machine-use unit.</p></div>
      <div style={cardStyle}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>HUMAN PAYLINK</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>Ready</div><p style={{fontSize:13,...mutedText,margin:'7px 0 0'}}><a href="/pay" style={{color:'#b6ff22',fontWeight:900}}>Open /pay</a> for a direct Base USDC test payment prompt.</p></div>
      <div style={cardStyle}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>LICENSABLE NOW</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>{catalog?.assets.length ?? '—'} NFTs</div><p style={{fontSize:13,...mutedText,margin:'7px 0 0'}}>Only assets still owned by the configured licensor wallet are offered.</p></div>
      <div style={cardStyle}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>WHAT BUYERS GET</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>Receipt</div><p style={{fontSize:13,...mutedText,margin:'7px 0 0'}}>Every x402 paid request returns a machine-readable one-use license receipt and payment proof.</p></div>
    </section>

    <section style={{maxWidth:1120,margin:'0 auto',padding:'18px 20px 30px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
      <div style={cardStyle}><div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#b6ff22'}}>1 · DISCOVER</div><h3 style={{fontSize:24,letterSpacing:'-.03em',margin:'9px 0'}}>Agents read the catalog</h3><p style={{fontSize:14,...mutedText}}>The free JSON catalog exposes eligible assets and the paid endpoint, so builders can integrate without asking for access first.</p></div>
      <div style={cardStyle}><div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#b6ff22'}}>2 · PAY</div><h3 style={{fontSize:24,letterSpacing:'-.03em',margin:'9px 0'}}>x402 handles Base USDC</h3><p style={{fontSize:14,...mutedText}}>The paid endpoint returns an HTTP 402 challenge. A compatible agent pays, then the app verifies and settles the payment.</p></div>
      <div style={cardStyle}><div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#b6ff22'}}>3 · LICENSE</div><h3 style={{fontSize:24,letterSpacing:'-.03em',margin:'9px 0'}}>One use, one receipt</h3><p style={{fontSize:14,...mutedText}}>After payment, the app returns a receipt for one machine-use unit. Additional uses require additional payments.</p></div>
    </section>

    <section style={{maxWidth:1120,margin:'0 auto',padding:'18px 20px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap',marginBottom:14}}><div><div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#8f998b'}}>PUBLIC MACHINE CATALOG</div><h2 style={{fontSize:'clamp(2rem,5vw,3.4rem)',letterSpacing:'-.045em',margin:'7px 0 0'}}>Available VoxelFlip rights</h2></div><a href="/api/licenses/catalog" target="_blank" rel="noreferrer" style={{color:'#0b0d0b',background:'#b6ff22',padding:'11px 15px',borderRadius:12,textDecoration:'none',fontWeight:950}}>OPEN JSON CATALOG ↗</a></div>
      {catalogError&&<div style={{border:'1px solid #714a27',background:'#21170f',color:'#ffd7a4',padding:16,borderRadius:16}}>{catalogError}</div>}
      {!catalogError&&catalog?.assets.length===0&&<div style={{border:'1px dashed #384235',background:'#10140f',padding:24,borderRadius:18,color:'#aab3a6'}}>No currently owned VoxelFlip NFTs were discovered for the configured licensor wallet. Mint/hold an eligible VoxelFlip NFT in that wallet, then it will become available automatically.</div>}
      {catalog&&catalog.assets.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>{catalog.assets.map(asset=><article key={asset.tokenId} style={cardStyle}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#b6ff22'}}>BASE · TOKEN #{asset.tokenId}</div><h3 style={{fontSize:20,margin:'8px 0 14px'}}>{asset.displayName}</h3><div style={{fontSize:13,color:'#9da698',lineHeight:1.6}}>Owner verified: {short(asset.owner)}<br/>Contract: {short(asset.contract)}<br/>License: one machine-use unit</div><code style={{display:'block',fontSize:11,wordBreak:'break-all',background:'#080a08',border:'1px solid #252b23',padding:10,borderRadius:10,marginTop:13,color:'#aeb6aa'}}>{asset.tokenURI}</code></article>)}</div>}
    </section>

    <section id="developer-test" style={{maxWidth:1120,margin:'0 auto',padding:'28px 20px 32px'}}>
      <div style={{border:'1px solid #3d4939',borderRadius:26,padding:'clamp(20px,4vw,34px)',background:'linear-gradient(135deg,#111610,#0b0f0b 58%,#17210f)'}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#b6ff22'}}>FOR AI AGENTS / DEVELOPERS</div>
        <h2 style={{fontSize:'clamp(2rem,5vw,3.5rem)',letterSpacing:'-.045em',margin:'9px 0 12px'}}>Test the paid endpoint in minutes.</h2>
        <p style={{color:'#aab3a6',lineHeight:1.55,maxWidth:790}}>POST a token ID to <code>/api/licenses/use</code>. Without a payment, the endpoint returns the standard x402 HTTP 402 challenge. After verification + settlement, it returns the machine-use license plus the Base payment transaction proof.</p>
        <pre style={{overflowX:'auto',fontSize:12,lineHeight:1.55,background:'#070907',padding:16,borderRadius:14,border:'1px solid #293126',color:'#d7ddd3'}}>{`POST /api/licenses/use\nContent-Type: application/json\n\n{\n  "tokenId": "1",\n  "clientId": "my-agent",\n  "useCase": "render this asset in one generated scene"\n}`}</pre>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:16}}>
          <a href="/api/licenses/catalog" target="_blank" rel="noreferrer" style={{color:'#0b0d0b',background:'#b6ff22',padding:'12px 15px',borderRadius:12,textDecoration:'none',fontWeight:950}}>OPEN CATALOG</a>
          <a href="/api/licenses/use" target="_blank" rel="noreferrer" style={{color:'#f5f7ef',border:'1px solid #3d4939',padding:'12px 15px',borderRadius:12,textDecoration:'none',fontWeight:900}}>VIEW PAID ENDPOINT</a>
          <a href="/pay" style={{color:'#f5f7ef',border:'1px solid #3d4939',padding:'12px 15px',borderRadius:12,textDecoration:'none',fontWeight:900}}>HUMAN PAYLINK</a>
        </div>
      </div>
    </section>

    <section style={{maxWidth:1120,margin:'0 auto',padding:'0 20px 70px'}}>
      <div style={{...cardStyle,padding:'clamp(20px,4vw,30px)'}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#8f998b'}}>COPY-PASTE BRAND LAUNCH BLURB</div>
        <h2 style={{fontSize:'clamp(1.8rem,4vw,2.8rem)',letterSpacing:'-.04em',margin:'8px 0 12px'}}>Share as Voxel Vault, not personally.</h2>
        <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.6,background:'#070907',padding:16,borderRadius:14,border:'1px solid #293126',color:'#d7ddd3'}}>{liveCopy}</pre>
        <div style={{fontSize:12,color:'#808a7c',lineHeight:1.55,marginTop:14}}>The NFT itself is not sold or transferred. Direct wallet payments do not automatically issue license receipts. Model training is not included in this V1 license. Rights are limited to rights actually controlled by the configured licensor; NFT ownership alone does not prove copyright ownership.</div>
      </div>
    </section>
  </main>;
}
