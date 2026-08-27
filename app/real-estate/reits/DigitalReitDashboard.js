'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

function usd(value, digits = 2) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(number) ? number : 0);
}

function shellCard(extra = {}) {
  return {
    border: '1px solid #283126',
    background: '#0d120d',
    borderRadius: 24,
    padding: 20,
    ...extra,
  };
}

export default function DigitalReitDashboard({ snapshot }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const portfolioBySymbol = new Map((snapshot.portfolio || []).map((position) => [position.symbol, position]));
  const paidDividends = (snapshot.dividends || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  async function sandboxBuy(asset, amount) {
    if (!snapshot.sandboxTradingEnabled || busyId) return;
    const accepted = window.confirm(`Place a $${amount} Dinari SANDBOX market buy for ${asset.symbol}? This uses test funds only.`);
    if (!accepted) return;

    setBusyId(asset.id);
    setMessage('');
    try {
      const response = await fetch('/api/digital-reits/sandbox-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: asset.id, paymentAmount: amount }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Sandbox order failed.');
      const orderId = payload.order?.id || payload.order?.order_request_id || 'created';
      setMessage(`Sandbox order ${orderId} submitted. Refreshing provider balances…`);
      router.refresh();
    } catch (error) {
      setMessage(error?.message || 'Sandbox order failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div style={{display:'grid',gap:20}}>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
        <div style={shellCard()}>
          <div style={label}>PROVIDER</div>
          <div style={value}>{snapshot.provider}</div>
          <div style={sub}>{snapshot.environment.toUpperCase()}</div>
        </div>
        <div style={shellCard()}>
          <div style={label}>MATCHED REAL-ESTATE ASSETS</div>
          <div style={value}>{snapshot.catalog.length}</div>
          <div style={sub}>Confirmed by provider API</div>
        </div>
        <div style={shellCard()}>
          <div style={label}>TOKENIZED POSITIONS</div>
          <div style={value}>{snapshot.portfolio.length}</div>
          <div style={sub}>Configured account only</div>
        </div>
        <div style={shellCard()}>
          <div style={label}>DIVIDENDS OBSERVED</div>
          <div style={value}>{usd(paidDividends)}</div>
          <div style={sub}>{snapshot.dividends.length} provider payment record(s)</div>
        </div>
      </section>

      {message ? <div style={{...shellCard(),borderColor:'#637a47',color:'#d9f5b1',fontSize:13}}>{message}</div> : null}

      {!snapshot.credentialsConfigured ? (
        <section style={shellCard({padding:28})}>
          <div style={label}>CONNECTION REQUIRED</div>
          <h2 style={{fontSize:'clamp(1.8rem,4vw,3rem)',letterSpacing:'-.05em',margin:'9px 0'}}>The Digital REIT Vault is built. Dinari sandbox credentials are the missing plug.</h2>
          <p style={copy}>Once the server-side API key, secret and account ID are configured, this page stops using placeholders and pulls the live provider catalog, account positions and dividend records. Credentials never go to the browser.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:18}}>
            {snapshot.symbols.map((symbol) => <span key={symbol} style={chip}>{symbol}</span>)}
          </div>
        </section>
      ) : null}

      {snapshot.errors?.length ? (
        <section style={shellCard({borderColor:'#66403d'})}>
          <div style={label}>PROVIDER WARNINGS</div>
          {snapshot.errors.map((error) => <p key={error} style={{...copy,color:'#f0c5bd',margin:'8px 0 0'}}>{error}</p>)}
        </section>
      ) : null}

      <section>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap',marginBottom:14}}>
          <div>
            <div style={label}>DIGITAL REAL-ESTATE UNIVERSE</div>
            <h2 style={{fontSize:'clamp(2rem,5vw,3.8rem)',letterSpacing:'-.06em',margin:'5px 0 0'}}>Provider-confirmed REITs & real-estate securities.</h2>
          </div>
          <span style={snapshot.sandboxTradingEnabled ? readyPill : lockedPill}>
            {snapshot.sandboxTradingEnabled ? 'SANDBOX BUYING ENABLED' : 'BUYING LOCKED'}
          </span>
        </div>

        {snapshot.catalog.length ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(245px,1fr))',gap:12}}>
            {snapshot.catalog.map((asset) => {
              const holding = portfolioBySymbol.get(asset.symbol);
              return (
                <article key={asset.id} style={shellCard()}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}>
                    <div>
                      <div style={label}>{asset.rawType || 'TOKENIZED SECURITY'}</div>
                      <h3 style={{fontSize:30,margin:'6px 0 3px',letterSpacing:'-.04em'}}>{asset.symbol}</h3>
                    </div>
                    <span style={chip}>dSHARE</span>
                  </div>
                  <p style={{...copy,minHeight:42}}>{asset.name || asset.symbol}</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:15}}>
                    <div style={mini}><span style={label}>HELD</span><b>{holding ? Number(holding.amount).toFixed(6) : '0'}</b></div>
                    <div style={mini}><span style={label}>FRACTIONAL</span><b>{asset.isFractionable === false ? 'No' : asset.isFractionable === true ? 'Yes' : 'Provider'}</b></div>
                  </div>
                  <button
                    type="button"
                    disabled={!snapshot.sandboxTradingEnabled || Boolean(busyId)}
                    onClick={() => sandboxBuy(asset, 5)}
                    style={{...buyButton,opacity:(!snapshot.sandboxTradingEnabled || busyId) ? .42 : 1,cursor:(!snapshot.sandboxTradingEnabled || busyId) ? 'not-allowed':'pointer'}}
                  >
                    {busyId === asset.id ? 'SUBMITTING…' : 'BUY $5 · SANDBOX'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={shellCard()}>
            <p style={{...copy,margin:0}}>No configured real-estate watchlist symbols were returned by the provider. That can mean credentials are missing, the sandbox catalog differs from production, or those symbols are not currently supported. Voxel Vault does not invent availability.</p>
          </div>
        )}
      </section>

      <section style={shellCard({padding:26})}>
        <div style={label}>DIVIDEND / DISTRIBUTION LEDGER</div>
        <h2 style={{fontSize:28,letterSpacing:'-.04em',margin:'7px 0 16px'}}>Provider records, not estimated yield.</h2>
        {snapshot.dividends.length ? snapshot.dividends.slice(0, 12).map((item, index) => (
          <div key={item.id || `${item.symbol}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:12,padding:'11px 0',borderTop:'1px solid #222a21',fontSize:13,alignItems:'center'}}>
            <b>{item.symbol || 'Real-estate security'}</b>
            <span style={{color:'#9ba897'}}>{item.payableDate || item.status || 'Provider record'}</span>
            <b>{usd(item.amount)}</b>
          </div>
        )) : <p style={{...copy,margin:0}}>No real provider dividend payments are available for the configured account yet.</p>}
      </section>

      <section style={shellCard({borderColor:'#3b4933'})}>
        <div style={label}>PRODUCTION BOUNDARY</div>
        <h3 style={{fontSize:24,margin:'7px 0'}}>Sandbox can execute. Production cannot.</h3>
        <p style={{...copy,margin:0}}>The sandbox button sends a real request to Dinari's sandbox order API when explicitly enabled. The production trading implementation is still hard-disabled in code, so changing an environment variable alone cannot turn this into unattended real-money trading.</p>
      </section>
    </div>
  );
}

const label={fontSize:10,fontWeight:900,letterSpacing:'.13em',color:'#8d9a87'};
const value={fontSize:25,fontWeight:950,letterSpacing:'-.045em',marginTop:6};
const sub={fontSize:11,color:'#798474',marginTop:3};
const copy={fontSize:13,lineHeight:1.65,color:'#aab4a4'};
const chip={display:'inline-flex',alignItems:'center',border:'1px solid #354030',borderRadius:999,padding:'6px 9px',fontSize:10,fontWeight:900,letterSpacing:'.08em',color:'#cdd9c5'};
const mini={background:'#090d09',borderRadius:14,padding:11,display:'grid',gap:5};
const buyButton={width:'100%',border:0,borderRadius:14,padding:'12px 14px',marginTop:14,background:'#b8ff55',color:'#0b1109',fontSize:12,fontWeight:950,letterSpacing:'.05em'};
const readyPill={...chip,borderColor:'#5b7940',color:'#b8ff55',background:'rgba(184,255,85,.08)'};
const lockedPill={...chip,borderColor:'#654844',color:'#e9b6aa',background:'rgba(233,182,170,.06)'};
