import { aiLicensePriceAtomic } from '../../lib/ai-licensing';
import { BASE_USDC, x402RuntimeStatus } from '../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function usdcPrice(atomic: string) {
  const value = Number(atomic) / 1_000_000;
  return Number.isFinite(value) ? value.toFixed(value < 0.01 ? 4 : 2) : '0.01';
}

function short(value: string) {
  return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—';
}

export default function PayPage() {
  const x402 = x402RuntimeStatus();
  const amountAtomic = aiLicensePriceAtomic();
  const price = usdcPrice(amountAtomic);
  const receiver = x402.payTo;
  const paymentUri = `ethereum:${BASE_USDC}@8453/transfer?address=${receiver}&uint256=${amountAtomic}`;
  const metamaskLink = `https://metamask.app.link/send/${receiver}@8453`;

  return <main style={{minHeight:'100vh',background:'#070907',color:'#f5f7ef',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <section style={{width:'100%',maxWidth:760,border:'1px solid #30392d',borderRadius:28,padding:'clamp(22px,5vw,44px)',background:'linear-gradient(135deg,#111610,#0b0f0b 58%,#17210f)',boxShadow:'0 30px 80px rgba(0,0,0,.35)'}}>
      <a href="/ai-licensing" style={{color:'#b6ff22',textDecoration:'none',fontSize:12,fontWeight:900,letterSpacing:'.14em'}}>← VOXEL VAULT AI LICENSING</a>
      <h1 style={{fontSize:'clamp(2.4rem,8vw,5rem)',lineHeight:.9,letterSpacing:'-.065em',margin:'18px 0 18px'}}>Send a Base USDC test payment.</h1>
      <p style={{fontSize:'clamp(1.02rem,2.4vw,1.25rem)',lineHeight:1.55,color:'#aab3a6',margin:0,maxWidth:650}}>This is the fastest human-friendly payment link for Voxel Vault. It points to the same Base receiver used by the x402 licensing system.</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:24}}>
        <div style={{border:'1px solid #30392d',borderRadius:18,padding:16,background:'#0b0f0b'}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#8f998b'}}>AMOUNT</div><div style={{fontSize:28,fontWeight:950,marginTop:6}}>${price} USDC</div><div style={{fontSize:12,color:'#8f998b',marginTop:4}}>{amountAtomic} atomic USDC</div></div>
        <div style={{border:'1px solid #30392d',borderRadius:18,padding:16,background:'#0b0f0b'}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#8f998b'}}>NETWORK</div><div style={{fontSize:28,fontWeight:950,marginTop:6}}>Base</div><div style={{fontSize:12,color:'#8f998b',marginTop:4}}>Chain ID 8453</div></div>
        <div style={{border:'1px solid #30392d',borderRadius:18,padding:16,background:'#0b0f0b'}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#8f998b'}}>RECEIVER</div><div style={{fontSize:20,fontWeight:950,marginTop:9}}>{short(receiver)}</div><div style={{fontSize:12,color:'#8f998b',marginTop:4}}>MetaMask/Base wallet</div></div>
      </div>

      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:26}}>
        <a href={paymentUri} style={{color:'#0b0d0b',background:'#b6ff22',padding:'14px 18px',borderRadius:14,textDecoration:'none',fontWeight:950}}>PAY ${price} USDC</a>
        <a href={metamaskLink} target="_blank" rel="noreferrer" style={{color:'#f5f7ef',border:'1px solid #3d4939',padding:'14px 18px',borderRadius:14,textDecoration:'none',fontWeight:900}}>OPEN METAMASK</a>
        <a href="/api/paylink" target="_blank" rel="noreferrer" style={{color:'#f5f7ef',border:'1px solid #3d4939',padding:'14px 18px',borderRadius:14,textDecoration:'none',fontWeight:900}}>VIEW PAYLINK JSON</a>
      </div>

      <div style={{marginTop:24,borderTop:'1px solid #273024',paddingTop:18,fontSize:13,lineHeight:1.6,color:'#8f998b'}}>
        Direct wallet payments are for human test/support payments and do not automatically issue a one-use license receipt. AI agents and apps should use <a href="/api/licenses/use" style={{color:'#b6ff22'}}>the x402 paid endpoint</a> to receive a machine-use license receipt after payment settlement.
      </div>
    </section>
  </main>;
}
