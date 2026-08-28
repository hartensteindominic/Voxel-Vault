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
  return text ? `${text.slice(0, 8)}…${text.slice(-6)}` : '—';
}
function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}
function googleReturnUrl(sessionId) {
  const url = new URL('/vault/estates/success', window.location.origin);
  url.searchParams.set('session_id', sessionId);
  url.searchParams.set('auth', 'google');
  return url.toString();
}

export default function DigitalEstateSuccessPage() {
  const [sessionId, setSessionId] = useState('');
  const [accountSession, setAccountSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Confirming your Voxel Vault account…');
  const [estate, setEstate] = useState(null);
  const [mint, setMint] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('session_id') || '';
    setSessionId(id);
    if (!id.startsWith('cs_')) {
      setMessage('This page is missing a valid Checkout Session. Return to Digital Estates and open the paid checkout return link.');
    }

    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setMessage(error.message);
      } else {
        setAccountSession(data.session);
        setAuthState(data.session?.user ? 'signed-in' : 'signed-out');
        setMessage(data.session?.user ? 'Payment returned to Voxel Vault. Connect the wallet you bound before checkout to verify and mint.' : 'Sign in with the same Voxel Vault account used for checkout.');
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setAccountSession(next);
        setAuthState(next?.user ? 'signed-in' : 'signed-out');
      });
      subscription = auth.data.subscription;
      if (params.get('auth') === 'google') {
        params.delete('auth');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }).catch((error) => {
      setAuthState('error');
      setMessage(errorText(error));
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    if (!sessionId) return;
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl(sessionId) } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(errorText(error));
    }
  }

  async function verifyAndMint() {
    if (!accountSession?.access_token) { await signIn(); return; }
    if (!sessionId.startsWith('cs_')) return;
    setBusy('claim');
    try {
      const injected = await discoverMetaMaskProvider();
      if (!injected) {
        window.location.href = getMetaMaskDeepLink(window.location.href);
        return;
      }
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      const address = getAddress(accounts[0]);
      setWallet(address);
      setMessage('Re-reading the paid Checkout Session from Stripe and matching it to your account, estate, amount, and wallet…');

      const response = await fetch('/api/digital-estates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountSession.access_token}` },
        body: JSON.stringify({ source: 'stripe', sessionId, wallet: address }),
      });
      const claim = await response.json().catch(() => ({}));
      if (!response.ok || !claim?.ready) throw new Error(claim?.error || 'The paid estate could not be verified for minting.');
      setEstate(claim.estate);

      setMessage('Payment verified. MetaMask will now open one Base transaction for the unique estate NFT mint. Review the network and gas before approving.');
      const minted = await mintVoxelFlip({ metadataUrl: claim.metadataUrl, voucherId: claim.voucherId, signature: claim.signature });
      setMint(minted);
      window.localStorage.setItem(`vv-digital-estate-mint:${claim.estate.id}`, JSON.stringify(minted));
      window.dispatchEvent(new CustomEvent('voxel-vault:transaction-confirmed', { detail: minted }));
      setMessage(`${claim.estate.name} is now minted to ${short(address)} on Base. The asset is digital-only; no deed or physical-property rights were created.`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="page">
      <section className="card">
        <Link href="/vault/estates" className="back">← DIGITAL ESTATES</Link>
        <div className="badge"><span /> VERIFIED PURCHASE CLAIM</div>
        <h1>{mint ? 'Estate secured.' : 'Finish your estate.'}</h1>
        <p className="lead">Your payment and your NFT mint are intentionally separate. Voxel Vault re-verifies the payment server-side before it will create the one-use onchain voucher.</p>

        {estate ? <div className="estate">
          <div><small>DIGITAL ESTATE</small><strong>{estate.name}</strong></div>
          <div><small>PAID LIST PRICE</small><strong>{formatUsdCents(estate.purchasePriceCents)}</strong></div>
          <div><small>BOUND WALLET</small><strong>{short(wallet)}</strong></div>
        </div> : null}

        <div className="message">{message}</div>
        {authState === 'signed-out' ? <button className="primary" onClick={signIn} disabled={Boolean(busy)}>SIGN IN TO CONTINUE</button> : null}
        {authState === 'signed-in' && !mint ? <button className="primary" onClick={verifyAndMint} disabled={Boolean(busy) || !sessionId.startsWith('cs_')}>{busy === 'claim' ? 'VERIFYING PAYMENT…' : 'VERIFY PAYMENT + MINT ON BASE'}</button> : null}
        {mint?.explorerUrl ? <a className="primary link" href={mint.explorerUrl} target="_blank" rel="noreferrer">VIEW BASE TRANSACTION ↗</a> : null}
        {mint ? <Link className="secondary" href="/vault">OPEN MY 3D VAULT</Link> : null}

        <div className="truth"><strong>DIGITAL-ONLY OWNERSHIP</strong>This NFT does not include physical land, a deed, rent, tenancy, a security, an appraisal, or an investment interest. The real-world reference price is creative model pricing only.</div>
      </section>
      <style jsx>{`
        :global(body){margin:0;background:#05060a;color:#f7f8fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 50% 15%,rgba(101,85,223,.2),transparent 35%),#05060a}.card{width:min(720px,100%);box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:32px;padding:44px;background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.018));box-shadow:0 35px 100px rgba(0,0,0,.38)}.back{color:#858da0;text-decoration:none;font-size:9px;letter-spacing:.14em;font-weight:900}.badge{margin-top:56px;color:#8f98aa;font-size:9px;letter-spacing:.18em;font-weight:900;display:flex;align-items:center;gap:9px}.badge span{width:7px;height:7px;border-radius:50%;background:#79efbc;box-shadow:0 0 18px #79efbc}.card h1{font-size:clamp(50px,8vw,78px);line-height:.9;letter-spacing:-.065em;margin:16px 0 22px}.lead{font-size:14px;line-height:1.7;color:#8d96a8;max-width:590px}.estate{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px;margin:28px 0}.estate>div{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:14px;padding:14px}.estate small{display:block;font-size:7px;letter-spacing:.13em;color:#687184;font-weight:900}.estate strong{display:block;margin-top:6px;font-size:12px}.message{margin:18px 0;padding:15px 16px;border-radius:15px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);color:#949cad;font-size:11px;line-height:1.6}.primary,.secondary{width:100%;box-sizing:border-box;display:block;border:0;border-radius:15px;padding:16px 18px;text-align:center;text-decoration:none;font-size:10px;font-weight:950;letter-spacing:.08em;margin-top:8px}.primary{background:white;color:#07080c}.primary:disabled{opacity:.4}.primary.link{background:#6656df;color:white}.secondary{border:1px solid rgba(255,255,255,.11);color:white;background:transparent}.truth{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.07);color:#687183;font-size:9px;line-height:1.55}.truth strong{display:block;color:#9ca4b4;font-size:8px;letter-spacing:.14em;margin-bottom:5px}@media(max-width:620px){.page{padding:14px}.card{padding:28px 20px;border-radius:24px}.badge{margin-top:42px}.estate{grid-template-columns:1fr}.card h1{font-size:52px}}
      `}</style>
    </main>
  );
}
