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
  const [status, setStatus] = useState('Loading the properties you bought…');
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  async function loadOwned(accessToken) {
    if (!accessToken) return;
    const response = await fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Could not load your Digital Twins.');
    setItems(Array.isArray(data.owned) ? data.owned : []);
    setStatus(data.count
      ? `${data.count} purchased Digital Twin${data.count === 1 ? '' : 's'} ready for you.`
      : 'No purchased Digital Twins are secured to this account yet.');
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
      else setStatus('Sign in to see the Digital Twins you bought.');
      const auth = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession?.access_token) await loadOwned(nextSession.access_token);
        else { setItems([]); setStatus('Sign in to see the Digital Twins you bought.'); }
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

      setStatus('Your purchase is already secured. MetaMask is opening only the optional NFT mint transaction.');
      const minted = await mintVoxelFlip({ metadataUrl: claim.metadataUrl, voucherId: claim.voucherId, signature: claim.signature });
      window.localStorage.setItem(`vv-digital-estate-mint:${item.estate.id}`, JSON.stringify(minted));
      window.dispatchEvent(new CustomEvent('voxel-vault:transaction-confirmed', { detail: minted }));
      setStatus(`${item.estate.name} is now onchain in ${short(wallet)}. Minting added public provenance; it did not transfer physical-property rights or guarantee higher value.`);
      await loadOwned(session.access_token);
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(''); }
  }

  return <main className="page">
    <section className="shell">
      <header>
        <Link className="brand" href="/vault"><span>V</span> Voxel Vault</Link>
        <nav><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/more">More</Link></nav>
      </header>

      <section className="hero">
        <small>BOUGHT · THEN CREATE</small>
        <h1>The ones you bought.<br/><em>Make them into voxels.</em></h1>
        <p>Your secured Digital Estate purchase is the starting point—not a dead end. Open it, create an interactive 3D voxel from the purchased design, save that creation to your Vault, and mint only if you want the optional blockchain backup.</p>
        <div className="flow"><span>✓ BOUGHT</span><i>→</i><span>3D VOXEL</span><i>→</i><span>SAVE TO VAULT</span><i>→</i><span>MINT · OPTIONAL</span></div>
      </section>

      <div className="status" role="status">{status}</div>
      {!session ? <button className="signin" onClick={signIn} disabled={Boolean(busy)}>{busy === 'signin' ? 'OPENING SIGN-IN…' : 'SIGN IN TO MY BOUGHT PROPERTIES'}</button> : null}

      {session && !items.length ? <section className="empty"><b>No bought properties here yet.</b><span>When a Digital Estate purchase is secured to this account, it will show up here with a 3D voxel button.</span><Link href="/vault/earth">Explore properties</Link></section> : null}

      <section className="grid">
        {items.map((item) => <article key={item.estate.id}>
          <div className="visual" style={{'--accent': item.estate.accent, '--terrain': item.estate.terrain, '--structure': item.estate.structure, '--roof': item.estate.roof}}>
            <div className="land"/><div className="house"><b/><b/><b/></div><span>{item.minted === true ? 'BOUGHT · ONCHAIN' : 'BOUGHT · SECURED'}</span>
          </div>
          <div className="body">
            <small>{item.estate.locationLabel}</small>
            <h2>{item.estate.name}</h2>
            <p className="summary">{item.estate.summary}</p>
            <div className="price">{formatUsdCents(item.estate.purchasePriceCents)} <span>digital purchase</span></div>
            <Link className="create" href={`/vault/estates/mine/${encodeURIComponent(item.estate.id)}/voxel`}>CREATE MY 3D VOXEL →</Link>
            <div className="included">✓ Included with the secured purchase · no second creation charge</div>
            <dl>
              <div><dt>PURCHASE</dt><dd>Secured to this account</dd></div>
              <div><dt>VOXEL</dt><dd>Ready to create</dd></div>
              <div><dt>MINT WALLET</dt><dd>{short(item.wallet)}</dd></div>
            </dl>
            {item.minted === true
              ? <div className="minted">✓ OPTIONAL BLOCKCHAIN BACKUP ACTIVE</div>
              : <button className="mint" onClick={() => mintLater(item)} disabled={Boolean(busy)}>{busy === item.estate.id ? 'PREPARING…' : item.wallet ? 'MINT TO BASE · ENCOURAGED BACKUP' : 'CONNECT WALLET + MINT · ENCOURAGED'}</button>}
            <p className="note">Minting is optional. Creating and saving the voxel does not require a wallet.</p>
          </div>
        </article>)}
      </section>

      <div className="truth"><strong>DIGITAL PURCHASE ≠ PHYSICAL DEED</strong> The voxel is a digital creation derived from the Digital Estate design you purchased. Neither the purchase, voxel nor NFT itself transfers physical title, rent, occupancy, fractional ownership, or guaranteed appreciation.</div>
    </section>
    <style jsx>{`
      :global(body){margin:0;background:#fff9ef;color:#251d2a;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px 12px calc(100px + env(safe-area-inset-bottom));background:radial-gradient(circle at 5% 20%,#eaffad 0,transparent 25%),radial-gradient(circle at 94% 4%,#ede3ff 0,transparent 28%),#fff9ef}.shell{width:min(1040px,100%);margin:auto}header{min-height:58px;display:flex;justify-content:space-between;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:9px;color:#251d2a;text-decoration:none;font-size:12px;font-weight:1000}.brand span{width:36px;height:36px;border-radius:12px;background:#7138f5;color:#fff;display:grid;place-items:center;box-shadow:0 5px 0 #4e20be}nav{display:flex;gap:6px}nav a{min-height:40px;padding:0 12px;display:flex;align-items:center;border:1px solid #e0d8e4;border-radius:999px;background:#ffffffc7;color:#665d69;text-decoration:none;font-size:10px;font-weight:900}.hero{padding:50px 0 25px;max-width:880px}.hero small{color:#7041ed;font-size:10px;font-weight:1000;letter-spacing:.14em}.hero h1{font-size:clamp(50px,8vw,82px);line-height:.88;letter-spacing:-.065em;margin:12px 0 18px}.hero h1 em{font-style:normal;color:#7653d9}.hero p{max-width:760px;margin:0;color:#746b78;font-size:14px;line-height:1.7}.flow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:18px}.flow span{padding:8px 10px;border-radius:999px;background:#fff;border:1px solid #e1d9e5;color:#605765;font-size:8px;font-weight:950;letter-spacing:.06em}.flow span:first-child{background:#e9ffc0;border-color:#cee991;color:#3f571c}.flow i{font-style:normal;color:#a79eaa}.status{max-width:850px;padding:13px 15px;border:1px solid #e1dae5;background:#ffffffb8;border-radius:15px;color:#746a77;font-size:11px;margin:0 0 15px}.signin{min-height:48px;border:0;border-radius:15px;background:#7138f5;color:#fff;padding:0 17px;font-size:10px;font-weight:1000;box-shadow:0 6px 0 #4e20be}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-top:24px}.grid article{overflow:hidden;border:1px solid #e1dae6;border-radius:28px;background:#ffffffdc;box-shadow:0 18px 50px #5b3b8d0b}.visual{height:210px;position:relative;overflow:hidden;background:linear-gradient(#f2eaff,#fff5e8)}.land{position:absolute;left:8%;right:8%;bottom:10%;height:35%;background:var(--terrain);transform:perspective(360px) rotateX(60deg);border-radius:18px}.house{position:absolute;left:23%;right:23%;bottom:28%;height:42%;background:var(--structure);border-radius:7px;box-shadow:0 18px 36px #2a1e3022}.house:before{content:'';position:absolute;left:-8%;right:-8%;height:14%;top:-7%;background:var(--roof);border-radius:4px}.house b{position:absolute;background:var(--accent);bottom:18%;width:18%;height:35%;border-radius:2px}.house b:nth-child(1){left:12%}.house b:nth-child(2){left:41%}.house b:nth-child(3){right:12%}.visual span{position:absolute;top:13px;left:13px;padding:8px 10px;border-radius:999px;background:#e8ffb7;color:#3f571c;font-size:8px;font-weight:1000;letter-spacing:.07em}.body{padding:20px}.body small{color:#8665d7;font-size:8px;letter-spacing:.1em;font-weight:950;text-transform:uppercase}.body h2{font-size:27px;letter-spacing:-.045em;margin:6px 0 7px}.summary{margin:0;color:#7a707c;font-size:11px;line-height:1.55;min-height:50px}.price{font-size:22px;font-weight:1000;letter-spacing:-.03em;margin:16px 0}.price span{font-size:8px;color:#9c929e;letter-spacing:.06em;text-transform:uppercase}.create{min-height:52px;display:grid;place-items:center;border-radius:16px;background:#7138f5;color:#fff;text-decoration:none;font-size:11px;font-weight:1000;box-shadow:0 6px 0 #4e20be}.included{margin-top:10px;padding:9px 10px;border-radius:12px;background:#f1ffdb;color:#617443;font-size:9px;font-weight:800}.body dl{display:grid;gap:7px;margin:17px 0}.body dl div{display:flex;justify-content:space-between;gap:12px;padding-top:8px;border-top:1px solid #eee8ef}.body dt{font-size:7px;color:#a096a2;font-weight:950;letter-spacing:.08em}.body dd{margin:0;font-size:9px;color:#665c69;text-align:right;font-weight:800}.mint{width:100%;min-height:45px;border:1px solid #ded6e2;border-radius:14px;background:#fff;color:#615668;font-size:9px;font-weight:950}.minted{padding:13px;border-radius:14px;background:#e9ffc0;color:#466023;text-align:center;font-size:8px;font-weight:1000;letter-spacing:.08em}.note{font-size:9px;color:#938a95;line-height:1.5;margin:10px 0 0}.empty{max-width:650px;margin:24px 0;padding:28px;border:1px dashed #d9d0df;border-radius:25px;background:#ffffffc7;display:grid;gap:8px}.empty b{font-size:21px}.empty span{font-size:12px;color:#7b727f;line-height:1.6}.empty a{width:max-content;margin-top:4px;color:#6a3ee0;font-size:11px;font-weight:950;text-decoration:none}.truth{margin-top:26px;padding-top:17px;border-top:1px solid #e5dde7;max-width:900px;color:#8b818e;font-size:10px;line-height:1.6}.truth strong{display:block;color:#625865;letter-spacing:.1em;font-size:8px;margin-bottom:5px}@media(max-width:620px){.page{padding-left:9px;padding-right:9px}.hero{padding-top:35px}.hero h1{font-size:52px}.grid{grid-template-columns:1fr}.visual{height:200px}nav a:nth-child(2){display:none}}
    `}</style>
  </main>;
}
