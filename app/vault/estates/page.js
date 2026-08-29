'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIGITAL_ESTATE_ANCHOR_PRICE_CENTS,
  DIGITAL_ESTATE_DISCLOSURE,
  DIGITAL_ESTATES,
  formatRelativeEstateIndex,
  formatUsdCents,
  getDigitalEstate,
} from '../../../lib/digital-estates';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';
import EstateScene from './EstateScene';
import styles from './estate-market.module.css';

const BASE_CHAIN_ID = '0x2105';
const BASE_RPC = 'https://mainnet.base.org';
const BASE_EXPLORER = 'https://basescan.org';
const USDC_ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];

function short(value) {
  const text = String(value || '');
  return text ? text.slice(0, 7) + '…' + text.slice(-5) : '—';
}

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}

function googleReturnUrl(estateId) {
  const url = new URL('/vault/estates', window.location.origin);
  url.searchParams.set('estate', estateId);
  url.searchParams.set('auth', 'google');
  return url.toString();
}

async function ensureBase(provider) {
  let chainId = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId === BASE_CHAIN_ID) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
  } catch (error) {
    if (error?.code === 4001) throw new Error('Base network switch was cancelled.');
    if (error?.code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [BASE_RPC], blockExplorerUrls: [BASE_EXPLORER] }],
    });
  }
  chainId = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId !== BASE_CHAIN_ID) throw new Error('Switch MetaMask to Base before continuing.');
}

export default function DigitalEstatesPage() {
  const [selectedId, setSelectedId] = useState(DIGITAL_ESTATES[0].id);
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState([]);
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('Choose a digital property. The founder reference is a real $1.99 digital-collectible purchase when checkout is live.');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentRail, setPaymentRail] = useState('usd');
  const [acknowledged, setAcknowledged] = useState(false);
  const [secured, setSecured] = useState(null);
  const [recoveryTx, setRecoveryTx] = useState('');
  const clientRef = useRef(null);

  const selected = useMemo(() => getDigitalEstate(selectedId) || DIGITAL_ESTATES[0], [selectedId]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return DIGITAL_ESTATES;
    return DIGITAL_ESTATES.filter((item) => (item.name + ' ' + item.locationLabel + ' ' + item.architecture).toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = getDigitalEstate(params.get('estate'));
    if (requested) setSelectedId(requested.id);
    if (params.get('checkout') === 'cancelled') setStatus('Checkout cancelled. No purchase was completed.');
    try { setSaved(JSON.parse(window.localStorage.getItem('vv:saved-digital-estates') || '[]')); } catch {}

    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
      subscription = auth.data.subscription;
      if (params.get('auth') === 'google') {
        params.delete('auth');
        window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
        setStatus('Signed in. Review the digital-only rights and exact price before opening checkout.');
      }
    }).catch((error) => setStatus(errorText(error)));
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    try { setRecoveryTx(window.localStorage.getItem('vv-digital-estate-usdc:' + selected.id) || ''); } catch { setRecoveryTx(''); }
  }, [selected.id]);

  function selectEstate(id) {
    setSelectedId(id);
    setSecured(null);
    setPurchaseOpen(false);
    setAcknowledged(false);
    const url = new URL(window.location.href);
    url.searchParams.set('estate', id);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
    setStatus('Property selected. Its price is recalculated from the disclosed $1.99 founder-reference index.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleSaved(id) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { window.localStorage.setItem('vv:saved-digital-estates', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl(selected.id) } });
      if (error) throw error;
    } catch (error) {
      setStatus(errorText(error));
      setBusy('');
    }
  }

  function beginPurchase() {
    if (!session?.access_token) {
      signIn();
      return;
    }
    setAcknowledged(false);
    setPurchaseOpen(true);
    setStatus('Reviewing ' + selected.name + ' at exactly ' + formatUsdCents(selected.purchasePriceCents) + '.');
  }

  async function connectWallet() {
    const { getAddress } = await import('ethers');
    const injected = await discoverMetaMaskProvider();
    if (!injected) {
      window.location.href = getMetaMaskDeepLink(window.location.href);
      return null;
    }
    const accounts = await injected.request({ method: 'eth_requestAccounts' });
    if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
    const address = getAddress(accounts[0]);
    setWallet(address);
    return { provider: injected, wallet: address };
  }

  async function paySecurely() {
    if (!session?.access_token) { await signIn(); return; }
    if (!acknowledged) return;
    setBusy('usd');
    setSecured(null);
    try {
      setStatus('Opening a REAL ' + formatUsdCents(selected.purchasePriceCents) + ' secure checkout for a digital-only property collectible.');
      const response = await fetch('/api/digital-estates/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ estateId: selected.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout could not be created.');
      window.location.href = data.url;
    } catch (error) {
      setStatus(errorText(error));
      setBusy('');
    }
  }

  async function secureUsdcPayment(txHash, activeWallet) {
    setStatus('USDC confirmed. Verifying the exact token, sender, recipient, amount, block and reservation before ownership is secured.');
    const response = await fetch('/api/digital-estates/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ source: 'base-usdc', action: 'secure', estateId: selected.id, wallet: activeWallet, txHash }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ownershipSecured) throw new Error(data?.error || 'USDC payment could not be verified.');
    setSecured(data);
    try { window.localStorage.removeItem('vv-digital-estate-usdc:' + selected.id); } catch {}
    setRecoveryTx('');
    setStatus(selected.name + ' is purchased and secured to your Voxel Vault account. Optional NFT minting can happen later.');
  }

  async function payUsdc() {
    if (!session?.access_token) { await signIn(); return; }
    if (!acknowledged) return;
    setBusy('usdc');
    setSecured(null);
    try {
      const connected = await connectWallet();
      if (!connected) return;
      await ensureBase(connected.provider);
      const response = await fetch('/api/digital-estates/crypto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ estateId: selected.id, wallet: connected.wallet }),
      });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config?.ready) throw new Error(config?.error || 'USDC purchase could not be prepared.');

      const { BrowserProvider, Contract, formatUnits, getAddress } = await import('ethers');
      const browserProvider = new BrowserProvider(connected.provider);
      const signer = await browserProvider.getSigner(connected.wallet);
      const usdc = new Contract(config.usdcAddress, USDC_ABI, signer);
      const amount = BigInt(config.amountUsdcUnits);
      const balance = await usdc.balanceOf(connected.wallet);
      if (balance < amount) throw new Error('This purchase requires ' + formatUnits(amount, 6) + ' USDC. Wallet balance is ' + formatUnits(balance, 6) + ' USDC.');

      setStatus('REAL PAYMENT: MetaMask will request exactly ' + formatUnits(amount, 6) + ' USDC on Base. No NFT mint happens automatically.');
      const transaction = await usdc.transfer(getAddress(config.recipient), amount);
      try { window.localStorage.setItem('vv-digital-estate-usdc:' + selected.id, transaction.hash); } catch {}
      setRecoveryTx(transaction.hash);
      setStatus('USDC submitted ' + short(transaction.hash) + '. Waiting for Base confirmation…');
      const receipt = await transaction.wait();
      if (!receipt || Number(receipt.status) !== 1) throw new Error('The USDC transfer did not succeed.');
      await secureUsdcPayment(transaction.hash, connected.wallet);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function recoverUsdc() {
    if (!recoveryTx) return;
    if (!session?.access_token) { await signIn(); return; }
    setBusy('recover');
    try {
      const connected = await connectWallet();
      if (!connected) return;
      await secureUsdcPayment(recoveryTx, connected.wallet);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy('');
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/vault" className={styles.brand}><span>V</span><b>Voxel Vault</b></Link>
        <nav><Link href="/vault/estates/mine">My properties</Link><Link href="/vault/money">Money</Link></nav>
      </header>

      <section className={styles.marketHero}>
        <div className={styles.marketCopy}>
          <div className={styles.eyebrow}><i /> DIGITAL PROPERTY MARKET · OWN THE ASSET, NFT OPTIONAL</div>
          <h1>Buy a little<br/><em>piece of 3D.</em></h1>
          <p>Start with the founder reference at {formatUsdCents(DIGITAL_ESTATE_ANCHOR_PRICE_CENTS)}. Every other collectible price moves up or down from that anchor using the same public modeled-size formula.</p>
          <div className={styles.heroChips}><span>USD checkout</span><span>Base USDC</span><span>Wallet optional</span><span>No deed claim</span></div>
        </div>
        <div className={styles.searchBox}>
          <label htmlFor="estate-search">Find a digital property</label>
          <div><span>⌕</span><input id="estate-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search homes, districts, styles" /></div>
          <small>{filtered.length} unique digital properties · one account</small>
        </div>
      </section>

      <section className={styles.featured}>
        <div className={styles.sceneWrap} style={{ '--estate-accent': selected.accent }}>
          <EstateScene estate={selected} />
          <div className={styles.sceneTop}><span>{selected.pricingAnchor ? '★ $1.99 PRICING ANCHOR' : formatRelativeEstateIndex(selected.relativeIndexBps) + ' OF ANCHOR'}</span><button onClick={() => toggleSaved(selected.id)} aria-label={saved.includes(selected.id) ? 'Remove saved property' : 'Save property'}>{saved.includes(selected.id) ? '♥' : '♡'}</button></div>
          <div className={styles.sceneBottom}>DRAG TO ORBIT · PINCH TO ZOOM</div>
        </div>

        <aside className={styles.details}>
          <div className={styles.location}>{selected.locationLabel}</div>
          <h2>{selected.name}</h2>
          <p className={styles.summary}>{selected.summary}</p>
          <div className={styles.specs}>
            <div><b>{selected.beds}</b><span>BED</span></div>
            <div><b>{selected.baths}</b><span>BATH</span></div>
            <div><b>{selected.sqft.toLocaleString()}</b><span>MODELED SQ FT</span></div>
            <div><b>{selected.floors}</b><span>FLOORS</span></div>
          </div>
          <div className={styles.priceCard}>
            <div><span>DIGITAL PRICE</span><strong>{formatUsdCents(selected.purchasePriceCents)}</strong></div>
            <div className={styles.index}><span>VS. FOUNDER REFERENCE</span><b>{formatRelativeEstateIndex(selected.relativeIndexBps)}</b></div>
            <p>{selected.pricingBasis} Digital scale only—never a market appraisal.</p>
          </div>
          <button className={styles.buy} onClick={beginPurchase} disabled={Boolean(busy)}>{busy === 'signin' ? 'OPENING SIGN-IN…' : session ? 'Buy digital property · ' + formatUsdCents(selected.purchasePriceCents) : 'Sign in to buy · ' + formatUsdCents(selected.purchasePriceCents)}</button>
          <Link className={styles.moneyLink} href="/vault/money">Open USD + crypto + NFT money view →</Link>
          <div className={styles.status} role="status">{status}</div>
          {recoveryTx && session ? <button className={styles.recover} onClick={recoverUsdc} disabled={Boolean(busy)}>{busy === 'recover' ? 'VERIFYING…' : 'Recover existing USDC payment · ' + short(recoveryTx)}</button> : null}
          {secured ? <Link className={styles.secured} href="/vault/estates/mine">✓ PURCHASE SECURED · OPEN MY PROPERTIES</Link> : null}
        </aside>
      </section>

      <section className={styles.feed}>
        <div className={styles.feedTitle}><div><small>MARKETPLACE FEED</small><h2>More digital properties</h2></div><span>{saved.length} saved</span></div>
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article key={item.id} className={item.id === selected.id ? styles.activeCard : ''}>
              <button className={styles.cardSelect} onClick={() => selectEstate(item.id)}>
                <div className={styles.cardVisual} style={{ '--accent': item.accent, '--structure': item.structure, '--terrain': item.terrain }}>
                  <div className={styles.cardLand} /><div className={styles.cardHouse}><i /><i /><i /></div>
                  <span>{item.pricingAnchor ? '$1.99 ANCHOR' : formatRelativeEstateIndex(item.relativeIndexBps)}</span>
                </div>
                <div className={styles.cardBody}>
                  <small>{item.locationLabel}</small><h3>{item.name}</h3>
                  <p>{item.beds} bed · {item.baths} bath · {item.sqft.toLocaleString()} modeled sq ft</p>
                  <strong>{formatUsdCents(item.purchasePriceCents)}</strong>
                </div>
              </button>
              <button className={styles.saveCard} onClick={() => toggleSaved(item.id)} aria-label={(saved.includes(item.id) ? 'Unsave ' : 'Save ') + item.name}>{saved.includes(item.id) ? '♥ Saved' : '♡ Save'}</button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.howItWorks}>
        <div><b>1</b><span><strong>Buy with USD or USDC</strong>Your signed-in account receives the unique digital collectible first.</span></div>
        <div><b>2</b><span><strong>Keep it in Voxel Vault</strong>Explore the 3D property without needing a crypto wallet.</span></div>
        <div><b>3</b><span><strong>Mint only if you want</strong>An optional Base NFT adds wallet portability and public provenance.</span></div>
        <div><b>4</b><span><strong>Sell through a market</strong>NFT-to-cash requires a real buyer and licensed payment/off-ramp rails—never a guaranteed conversion.</span></div>
      </section>

      <footer className={styles.truth}><strong>WHAT THIS IS</strong>{DIGITAL_ESTATE_DISCLOSURE} Physical real estate, regulated investment positions, USD deposits, crypto balances and digital collectibles remain separate legal/source layers even when Voxel Vault displays them together.</footer>

      {purchaseOpen ? (
        <div className={styles.sheetBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPurchaseOpen(false); }}>
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="purchase-title">
            <button className={styles.close} onClick={() => setPurchaseOpen(false)} disabled={Boolean(busy)} aria-label="Close purchase review">×</button>
            <div className={styles.sheetBadge}>PURCHASE REVIEW · REAL PAYMENT</div>
            <h2 id="purchase-title">Buy {selected.name}</h2>
            <div className={styles.sheetPrice}>{formatUsdCents(selected.purchasePriceCents)}</div>
            <p className={styles.sheetLead}>This buys one unique <b>digital property collectible</b> secured to your Voxel Vault account. It does not buy the physical address, a deed, rent, equity, a security, or a bank balance.</p>
            <div className={styles.railTabs}>
              <button className={paymentRail === 'usd' ? styles.railActive : ''} onClick={() => setPaymentRail('usd')} disabled={Boolean(busy)}><b>USD</b><span>Secure hosted checkout</span></button>
              <button className={paymentRail === 'usdc' ? styles.railActive : ''} onClick={() => setPaymentRail('usdc')} disabled={Boolean(busy)}><b>USDC</b><span>Self-custody wallet · Base</span></button>
            </div>
            <label className={styles.ack}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={Boolean(busy)} /><span>I understand this is digital-only and the displayed price is the Voxel Vault collectible price.</span></label>
            <button className={styles.confirm} onClick={paymentRail === 'usd' ? paySecurely : payUsdc} disabled={!acknowledged || Boolean(busy)}>{busy ? 'WORKING…' : paymentRail === 'usd' ? 'Pay ' + formatUsdCents(selected.purchasePriceCents) + ' securely' : 'Pay ' + formatUsdCents(selected.purchasePriceCents) + ' in USDC'}</button>
            <small className={styles.sheetNote}>{paymentRail === 'usd' ? 'A crypto wallet is not required. Eligible checkout methods depend on the payment provider and your account.' : 'MetaMask will show the exact USDC amount and recipient before you approve. Connected wallet: ' + (wallet ? short(wallet) : 'not connected') + '.'}</small>
          </section>
        </div>
      ) : null}
    </main>
  );
}
