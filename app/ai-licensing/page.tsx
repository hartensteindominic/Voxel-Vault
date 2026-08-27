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

export default async function AiLicensingPage() {
  const x402 = x402RuntimeStatus();
  const priceAtomic = aiLicensePriceAtomic();
  let catalog: Awaited<ReturnType<typeof listLicensableAssets>> | null = null;
  let catalogError = '';
  try {
    catalog = await listLicensableAssets(24);
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'Catalog is temporarily unavailable.';
  }

  return <main style={{minHeight:'100vh',background:'#070907',color:'#f5f7ef',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'}}>
    <nav style={{maxWidth:1060,margin:'0 auto',padding:'20px 20px 0',display:'flex',justifyContent:'space-between',gap:16,alignItems:'center'}}>
      <a href="/studio" style={{color:'#f5f7ef',textDecoration:'none',fontWeight:950,letterSpacing:'-.03em'}}>Voxel Vault</a>
      <span style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#b6ff22'}}>AI LICENSING · BASE</span>
    </nav>

    <section style={{maxWidth:1060,margin:'0 auto',padding:'58px 20px 28px'}}>
      <div style={{fontSize:12,fontWeight:900,letterSpacing:'.16em',color:'#b6ff22'}}>NFT → MACHINE-CALLABLE RIGHTS</div>
      <h1 style={{fontSize:'clamp(3rem,9vw,6.7rem)',lineHeight:.88,letterSpacing:'-.065em',margin:'14px 0 24px',maxWidth:940}}>Your NFT can earn<br/><span style={{color:'#b6ff22'}}>per machine use.</span></h1>
      <p style={{fontSize:'clamp(1.05rem,2.2vw,1.35rem)',lineHeight:1.55,color:'#bbc2b7',maxWidth:760,margin:0}}>AI agents and applications can discover a VoxelFlip asset, pay a tiny Base USDC fee through x402, and receive one machine-use license receipt. A new payment is required for every additional licensed use.</p>
    </section>

    <section style={{maxWidth:1060,margin:'0 auto',padding:'0 20px 28px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <div style={{border:'1px solid #30392d',borderRadius:20,padding:20,background:'#111510'}}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>MACHINE PAYMENTS</small><div style={{fontSize:27,fontWeight:950,marginTop:7,color:x402.configured?'#b6ff22':'#ffca6a'}}>{x402.configured?'LIVE':'NEEDS CONFIG'}</div><p style={{fontSize:13,color:'#9da698',lineHeight:1.45,margin:'7px 0 0'}}>{x402.configured?'Receiver + facilitator are configured for Base.':'Code is live, but x402 receiver/facilitator credentials still need production configuration.'}</p></div>
      <div style={{border:'1px solid #30392d',borderRadius:20,padding:20,background:'#111510'}}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>PRICE / LICENSED USE</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>${usdcPrice(priceAtomic)} USDC</div><p style={{fontSize:13,color:'#9da698',lineHeight:1.45,margin:'7px 0 0'}}>{priceAtomic} atomic USDC · Base mainnet · one machine-use unit.</p></div>
      <div style={{border:'1px solid #30392d',borderRadius:20,padding:20,background:'#111510'}}><small style={{color:'#8f998b',fontWeight:900,letterSpacing:'.1em'}}>LICENSABLE NOW</small><div style={{fontSize:27,fontWeight:950,marginTop:7}}>{catalog?.assets.length ?? '—'} NFTs</div><p style={{fontSize:13,color:'#9da698',lineHeight:1.45,margin:'7px 0 0'}}>Only assets still owned by the configured licensor wallet are offered.</p></div>
    </section>

    <section style={{maxWidth:1060,margin:'0 auto',padding:'18px 20px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap',marginBottom:14}}><div><div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#8f998b'}}>PUBLIC MACHINE CATALOG</div><h2 style={{fontSize:'clamp(2rem,5vw,3.4rem)',letterSpacing:'-.045em',margin:'7px 0 0'}}>Available VoxelFlip rights</h2></div><a href="/api/licenses/catalog" target="_blank" rel="noreferrer" style={{color:'#0b0d0b',background:'#b6ff22',padding:'11px 15px',borderRadius:12,textDecoration:'none',fontWeight:950}}>OPEN JSON CATALOG ↗</a></div>
      {catalogError&&<div style={{border:'1px solid #714a27',background:'#21170f',color:'#ffd7a4',padding:16,borderRadius:16}}>{catalogError}</div>}
      {!catalogError&&catalog?.assets.length===0&&<div style={{border:'1px dashed #384235',background:'#10140f',padding:24,borderRadius:18,color:'#aab3a6'}}>No currently owned VoxelFlip NFTs were discovered for the configured licensor wallet. Mint/hold an eligible VoxelFlip NFT in that wallet, then it will become available automatically.</div>}
      {catalog&&catalog.assets.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>{catalog.assets.map(asset=><article key={asset.tokenId} style={{border:'1px solid #30392d',borderRadius:20,padding:18,background:'#10140f'}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#b6ff22'}}>BASE · TOKEN #{asset.tokenId}</div><h3 style={{fontSize:20,margin:'8px 0 14px'}}>{asset.displayName}</h3><div style={{fontSize:13,color:'#9da698',lineHeight:1.6}}>Owner verified: {short(asset.owner)}<br/>Contract: {short(asset.contract)}<br/>License: one machine-use unit</div><code style={{display:'block',fontSize:11,wordBreak:'break-all',background:'#080a08',border:'1px solid #252b23',padding:10,borderRadius:10,marginTop:13,color:'#aeb6aa'}}>{asset.tokenURI}</code></article>)}</div>}
    </section>

    <section style={{maxWidth:1060,margin:'0 auto',padding:'28px 20px 70px'}}>
      <div style={{border:'1px solid #3d4939',borderRadius:24,padding:'clamp(20px,4vw,34px)',background:'#111610'}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'.14em',color:'#b6ff22'}}>FOR AI AGENTS / DEVELOPERS</div>
        <h2 style={{fontSize:'clamp(2rem,5vw,3.5rem)',letterSpacing:'-.045em',margin:'9px 0 12px'}}>Pay. Get a license receipt. Use it once.</h2>
        <p style={{color:'#aab3a6',lineHeight:1.55,maxWidth:760}}>POST a token ID to <code>/api/licenses/use</code>. Without a payment, the endpoint returns the standard x402 HTTP 402 challenge. After verification + settlement, it returns the machine-use license plus the Base payment transaction proof.</p>
        <pre style={{overflowX:'auto',fontSize:12,lineHeight:1.55,background:'#070907',padding:16,borderRadius:14,border:'1px solid #293126',color:'#d7ddd3'}}>{`POST /api/licenses/use\nContent-Type: application/json\n\n{\n  "tokenId": "1",\n  "clientId": "my-agent",\n  "useCase": "render this asset in one generated scene"\n}`}</pre>
        <div style={{fontSize:12,color:'#808a7c',lineHeight:1.55,marginTop:12}}>The NFT itself is not sold or transferred. Model training is not included in this V1 license. Rights are limited to rights actually controlled by the configured licensor; NFT ownership alone does not prove copyright ownership.</div>
      </div>
    </section>
  </main>;
}
