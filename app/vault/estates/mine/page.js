'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getAddress } from 'ethers';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../../lib/wallet-connect';
import { mintVoxelFlip } from '../../../../lib/voxelflip';
import { formatUsdCents } from '../../../../lib/digital-estates';

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : 'Not bound yet';
}
function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}

export default function MyDigitalEstatesPage() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Loading your secured Digital Twins…');
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  async function loadOwned(accessToken) {
    if (!accessToken) return;
    const response = await fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Could not load your Digital Twins.');
    setItems(Array.isArray(data.owned) ? data.owned : []);
    setStatus(data.count ? `${data.count} secured Digital Twin${data.count === 1 ? '' : 's'} in your Vault.` : 'No secured Digital Twins yet.');
  }

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      const next = data.session || null;
      setSession(next);
      if (next?.access_token) await loadOwned(next.access_token);
      else setStatus('Sign in to see Digital Twins you have purchased.');
      const auth = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession?.access_token) await loadOwned(nextSession.access_token);
        else { setItems([]); setStatus('Sign in to see Digital Twins you have purchased.'); }
      });
      subscription = auth.data.subscription;
    }).catch((error) => setStatus(errorText(error)));
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault/estates/mine', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) { setStatus(errorText(error)); setBusy(''); }
  }

  async function mintLater(item) {
    if (!session?.access_token) { await signIn(); return; }
    setBusy(item.estate.id);
    try {
      const injected = await discoverMetaMaskProvider();
      if (!injected) { window.location.href = getMetaMaskDeepLink(window.location.href); return; }
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      const wallet = getAddress(accounts[0]);
      if (item.wallet && wallet.toLowerCase() !== String(item.wallet).toLowerCase()) throw new Error(`This purchase is already bound to ${short(item.wallet)}.`);

      setStatus(item.wallet
        ? `Preparing the optional Base backup for ${item.estate.name}… Your purchase is already secured.`
        : `Binding ${short(wallet)} as the permanent mint wallet for ${item.estate.name}… The purchase is already secured to your account.`);
      const response = await fetch('/api/digital-estates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ source: 'owned', action: 'mint', estateId: item.estate.id, wallet }),
      });
      const claim = await response.json().catch(() => ({}));
      if (!response.ok || !claim?.ready) throw new Error(claim?.error || 'Optional mint could not be prepared.');

      setStatus('Ownership is already secured. MetaMask will now open only the optional NFT mint transaction.');
      const minted = await mintVoxelFlip({ metadataUrl: claim.metadataUrl, voucherId: claim.voucherId, signature: claim.signature });
      window.localStorage.setItem(`vv-digital-estate-mint:${item.estate.id}`, JSON.stringify(minted));
      window.dispatchEvent(new CustomEvent('voxel-vault:transaction-confirmed', { detail: minted }));
      setStatus(`${item.estate.name} is now onchain in ${short(wallet)}. Minting added public blockchain provenance and wallet visibility; it did not transfer physical-property rights or guarantee higher market value.`);
      await loadOwned(session.access_token);
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(''); }
  }

  return (
    <main className="page">
      <header>
        <div><Link href="/vault/earth">← EARTH PROPERTIES</Link><span>MY DIGITAL TWINS</span></div>
        <Link className="test" href="/vault/test-land">SAFE TESTNET LAND ↗</Link>
      </header>
      <section className="hero">
        <div className="eyebrow"><i /> PURCHASE FIRST · BLOCKCHAIN BACKUP WHEN YOU WANT</div>
        <h1>Your twins.<br/><em>Minting is encouraged.</em></h1>
        <p>Secure checkout locks a Digital Twin to your Voxel Vault account first. A wallet is not required to buy. If you choose the blockchain backup later, the first wallet you approve becomes the permanent mint wallet for that purchase.</p>
      </section>

      <div className="status">{status}</div>
      {!session ? <button className="signin" onClick={signIn} disabled={Boolean(busy)}>SIGN IN TO MY VAULT</button> : null}

      <section className="grid">
        {items.map((item) => <article key={item.estate.id}>
          <div className="visual" style={{'--accent': item.estate.accent}}>
            <div className="land"/><div className="house"><b/><b/><b/></div><span>{item.minted === true ? 'ONCHAIN' : 'SECURED'}</span>
          </div>
          <div className="body">
            <small>{item.estate.locationLabel}</small>
            <h2>{item.estate.name}</h2>
            <div className="price">{formatUsdCents(item.estate.purchasePriceCents)}</div>
            <dl>
              <div><dt>STATUS</dt><dd>{item.minted === true ? 'Owned · Minted' : item.minted === false ? 'Owned · Not minted' : 'Owned · Chain status unavailable'}</dd></div>
              <div><dt>MINT WALLET</dt><dd>{short(item.wallet)}</dd></div>
              <div><dt>PAYMENT</dt><dd>{item.paymentSource === 'base-usdc' ? 'Base USDC' : 'Secure checkout'}</dd></div>
            </dl>
            {item.minted === true
              ? <div className="minted">✓ BLOCKCHAIN BACKUP ACTIVE</div>
              : <button className="mint" onClick={() => mintLater(item)} disabled={Boolean(busy)}>{busy === item.estate.id ? 'PREPARING…' : item.wallet ? 'MINT TO BASE · ENCOURAGED BACKUP' : 'CONNECT WALLET + MINT · ENCOURAGED'}</button>}
            <p className="note">Your account purchase remains secured whether you mint now, later, or never.</p>
          </div>
        </article>)}
      </section>

      <div className="truth"><strong>DIGITAL BACKUP, NOT THE DEED</strong> Minting adds public blockchain provenance and wallet portability. It does not itself transfer physical title, create rent entitlement, or guarantee appreciation.</div>
      <style jsx>{`
        :global(body){margin:0;background:#06070a;color:#f5f6f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:22px clamp(18px,4vw,60px) 90px;background:radial-gradient(circle at 72% 10%,rgba(115,93,255,.15),transparent 28%),#06070a}header{display:flex;justify-content:space-between;align-items:center;gap:16px}header div{display:flex;gap:18px;align-items:center}header a{color:#7f8797;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:.12em}header span{font-size:9px;font-weight:950;letter-spacing:.16em}.test{border:1px solid rgba(255,255,255,.1);padding:10px 12px;border-radius:12px}.hero{max-width:900px;margin:90px 0 42px}.eyebrow{font-size:9px;letter-spacing:.17em;color:#8d96a8;font-weight:900}.eyebrow i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#79efbc;margin-right:8px;box-shadow:0 0 18px #79efbc}.hero h1{font-size:clamp(52px,8vw,105px);letter-spacing:-.065em;line-height:.88;margin:17px 0 22px}.hero h1 em{font-style:normal;color:#767e90}.hero p{max-width:720px;color:#8a93a5;font-size:13px;line-height:1.75}.status{max-width:850px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:14px;color:#9ba4b5;font-size:11px;margin-bottom:18px}.signin,.mint{border:0;border-radius:13px;background:#fff;color:#07080b;padding:14px 16px;font-size:9px;font-weight:950;letter-spacing:.1em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:28px}.grid article{border:1px solid rgba(255,255,255,.09);border-radius:24px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.015))}.visual{height:190px;position:relative;overflow:hidden;background:radial-gradient(circle at 55% 35%,color-mix(in srgb,var(--accent) 32%, transparent),transparent 36%),linear-gradient(#11151c,#080a0e)}.land{position:absolute;left:10%;right:10%;bottom:18%;height:25%;background:#202b25;transform:perspective(300px) rotateX(58deg);border-radius:10px}.house{position:absolute;left:24%;right:24%;bottom:29%;height:39%;background:#d9d4ca;border-radius:3px;box-shadow:0 20px 45px rgba(0,0,0,.4)}.house:before{content:'';position:absolute;left:-8%;right:-8%;height:12%;top:-7%;background:#343842}.house b{position:absolute;background:var(--accent);opacity:.8;bottom:16%;width:18%;height:35%}.house b:nth-child(1){left:12%}.house b:nth-child(2){left:41%}.house b:nth-child(3){right:12%}.visual span{position:absolute;top:14px;left:14px;font-size:8px;font-weight:950;letter-spacing:.12em;background:rgba(4,7,9,.7);border:1px solid rgba(255,255,255,.1);padding:7px 9px;border-radius:999px}.body{padding:20px}.body small{color:#788194;font-size:8px;letter-spacing:.13em;font-weight:900}.body h2{font-size:24px;letter-spacing:-.04em;margin:6px 0}.price{font-size:28px;font-weight:900;letter-spacing:-.04em;margin-bottom:16px}dl{display:grid;gap:8px;margin:0 0 16px}dl div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px}dt{font-size:7px;color:#687183;font-weight:900;letter-spacing:.12em}dd{margin:0;font-size:9px;color:#a3aaba;text-align:right}.mint{width:100%;background:#6656df;color:#fff}.minted{padding:13px;border-radius:12px;background:rgba(121,239,188,.08);border:1px solid rgba(121,239,188,.18);color:#79efbc;text-align:center;font-size:8px;font-weight:950;letter-spacing:.1em}.note{font-size:8px;color:#666f80;line-height:1.5;margin:10px 0 0}.truth{margin-top:35px;max-width:950px;color:#697284;font-size:9px;line-height:1.6;border-top:1px solid rgba(255,255,255,.07);padding-top:20px}.truth strong{display:block;color:#9aa3b4;letter-spacing:.14em;font-size:8px;margin-bottom:5px}@media(max-width:620px){.page{padding:18px 14px 80px}.hero{margin-top:58px}header span{display:none}.hero h1{font-size:54px}.grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
