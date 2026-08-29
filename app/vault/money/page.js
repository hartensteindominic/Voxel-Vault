'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWalletIdentity } from '../../components/WalletIdentity';
import { formatUsdCents } from '../../../lib/digital-estates';
import { MONEY_LAYERS, MONEY_ROUTES, moneyRouteStatus } from '../../../lib/money-routes';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './money.module.css';

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = 'https://mainnet.base.org';
const USDC_ABI = ['function balanceOf(address) view returns (uint256)'];

function short(value) {
  const text = String(value || '');
  return text ? text.slice(0, 6) + '…' + text.slice(-4) : 'Not connected';
}

function userLabel(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Signed-in account');
}

function googleReturnUrl() {
  return new URL('/vault/money?auth=google', window.location.origin).toString();
}

export default function MoneyHubPage() {
  const { address, connected, connect } = useWalletIdentity();
  const [session, setSession] = useState(null);
  const [owned, setOwned] = useState([]);
  const [accountState, setAccountState] = useState('loading');
  const [cryptoState, setCryptoState] = useState({ mode: 'idle', eth: null, usdc: null, error: '' });
  const [message, setMessage] = useState('Loading each money layer from its own source…');
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  const digitalCatalogTotal = useMemo(() => owned.reduce((sum, item) => sum + Number(item?.estate?.purchasePriceCents || 0), 0), [owned]);

  async function loadOwned(accessToken) {
    if (!accessToken) { setOwned([]); return; }
    const response = await fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: 'Bearer ' + accessToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Digital properties could not be loaded.');
    setOwned(Array.isArray(data.owned) ? data.owned : []);
  }

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function applySession(next) {
      if (!active) return;
      setSession(next);
      if (!next?.access_token) {
        setOwned([]);
        setAccountState('signed-out');
        setMessage('Sign in to load account-secured digital properties. Wallet balances remain optional and separate.');
        return;
      }
      setAccountState('loading');
      try {
        await loadOwned(next.access_token);
        if (active) {
          setAccountState('ready');
          setMessage('Money layers loaded. Voxel Vault keeps cash, crypto, collectibles and legal property interests separate even on one screen.');
        }
      } catch (error) {
        if (active) {
          setAccountState('error');
          setMessage(error instanceof Error ? error.message : 'Account assets could not be loaded.');
        }
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await applySession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => { applySession(next); });
      subscription = auth.data.subscription;
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'google') window.history.replaceState({}, '', '/vault/money');
    }).catch((error) => {
      if (active) {
        setAccountState('error');
        setMessage(error instanceof Error ? error.message : 'Account sign-in is unavailable.');
      }
    });

    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!address) {
      setCryptoState({ mode: 'idle', eth: null, usdc: null, error: '' });
      return;
    }
    let active = true;
    setCryptoState({ mode: 'loading', eth: null, usdc: null, error: '' });
    import('ethers').then(async ({ Contract, JsonRpcProvider, formatEther, formatUnits, getAddress }) => {
      const provider = new JsonRpcProvider(BASE_RPC, 8453, { staticNetwork: true });
      try {
        const checksum = getAddress(address);
        const usdc = new Contract(BASE_USDC, USDC_ABI, provider);
        const [ethBalance, usdcBalance] = await Promise.all([provider.getBalance(checksum), usdc.balanceOf(checksum)]);
        if (active) setCryptoState({ mode: 'ready', eth: formatEther(ethBalance), usdc: formatUnits(usdcBalance, 6), error: '' });
      } catch (error) {
        if (active) setCryptoState({ mode: 'error', eth: null, usdc: null, error: error instanceof Error ? error.message : 'Base wallet balances could not be read.' });
      } finally {
        provider.destroy();
      }
    }).catch(() => {
      if (active) setCryptoState({ mode: 'error', eth: null, usdc: null, error: 'Wallet balance tools could not load.' });
    });
    return () => { active = false; };
  }, [address]);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start sign-in.');
      setBusy('');
    }
  }

  async function connectCrypto() {
    setBusy('wallet');
    try {
      await connect();
      setMessage('Wallet connected for read-only Base balance display. Voxel Vault did not receive custody or transaction permission.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wallet could not connect.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/vault" className={styles.brand}><span>V</span><b>Voxel Vault</b></Link>
        <nav><Link href="/vault/estates">Digital properties</Link><Link href="/vault/estates/mine">My properties</Link></nav>
      </header>

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><i /> MONEY HUB · ONE VIEW, THREE SEPARATE SYSTEMS</div>
          <h1>Cash. Crypto.<br/><em>Property + NFTs.</em></h1>
          <p>See them together without pretending they are the same balance. Cash needs a regulated partner, crypto stays in your wallet, and digital property stays account-owned with optional NFT portability.</p>
        </div>
        <div className={styles.accountCard}>
          <span>VOXEL VAULT ACCOUNT</span>
          <strong>{session?.user ? userLabel(session.user) : 'Not signed in'}</strong>
          <p>{session?.user ? owned.length + ' account-secured digital ' + (owned.length === 1 ? 'property' : 'properties') : 'Sign in to load account-secured property assets.'}</p>
          {!session?.user ? <button onClick={signIn} disabled={Boolean(busy)}>{busy === 'signin' ? 'OPENING…' : 'Sign in with Google'}</button> : <div className={styles.verified}>✓ ACCOUNT SESSION VERIFIED</div>}
        </div>
      </section>

      <div className={styles.message} role="status">{message}</div>

      <section className={styles.layers}>
        <article className={[styles.layer, styles.cash].join(' ')}>
          <div className={styles.layerTop}><span>$</span><b>PARTNER REQUIRED</b></div>
          <small>CASH · USD ACCOUNT</small>
          <h2>—</h2><p className={styles.balanceLabel}>No bank balance connected</p>
          <div className={styles.layerFacts}>
            <div><span>DIGITAL PROPERTY CATALOG TOTAL</span><b>{accountState === 'ready' ? formatUsdCents(digitalCatalogTotal) : '—'}</b></div>
            <p>This total is the current catalog price of your owned digital collectibles—not cash, market value, an account balance, or money available to withdraw.</p>
          </div>
          <Link href="/vault/estates">Buy the $1.99 reference property</Link>
          <footer>Voxel Vault is not the bank and does not hold customer USD. A real USD balance will appear only through an approved regulated provider.</footer>
        </article>

        <article className={[styles.layer, styles.crypto].join(' ')}>
          <div className={styles.layerTop}><span>◆</span><b>SELF-CUSTODY</b></div>
          <small>CRYPTO · BASE WALLET</small>
          <h2>{connected ? short(address) : '—'}</h2><p className={styles.balanceLabel}>{connected ? 'Read-only wallet view' : 'Wallet not connected'}</p>
          <div className={styles.cryptoBalances}>
            <div><span>ETH</span><b>{cryptoState.mode === 'loading' ? '…' : cryptoState.eth === null ? '—' : Number(cryptoState.eth).toLocaleString('en-US', { maximumFractionDigits: 6 })}</b></div>
            <div><span>USDC</span><b>{cryptoState.mode === 'loading' ? '…' : cryptoState.usdc === null ? '—' : Number(cryptoState.usdc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          </div>
          {cryptoState.error ? <div className={styles.error}>{cryptoState.error}</div> : null}
          <button onClick={connectCrypto} disabled={Boolean(busy)}>{busy === 'wallet' ? 'CONNECTING…' : connected ? 'Refresh wallet permission' : 'Connect MetaMask'}</button>
          <footer>Balances are read from Base for the connected address. Voxel Vault never asks for a seed phrase and cannot move funds without a separate wallet approval.</footer>
        </article>

        <article className={[styles.layer, styles.property].join(' ')}>
          <div className={styles.layerTop}><span>⌂</span><b>ACCOUNT / CHAIN</b></div>
          <small>PROPERTY + NFT VAULT</small>
          <h2>{accountState === 'ready' ? owned.length : '—'}</h2><p className={styles.balanceLabel}>Account-secured digital properties</p>
          <div className={styles.propertyStack}>
            <div><span>DIGITAL ONLY</span><b>{owned.length}</b></div>
            <div><span>OPTIONAL NFT ACTIVE</span><b>{owned.filter((item) => item.minted === true).length}</b></div>
            <div><span>DIRECT DEED CLAIMS</span><b>0</b></div>
          </div>
          <Link href="/vault/estates/mine">Open My Digital Properties</Link>
          <footer>Digital collectibles, NFTs, provider securities and direct property interests have different rights. The interface never turns one into another by changing its label.</footer>
        </article>
      </section>

      <section className={styles.noTotal}><span>≠</span><div><strong>No fake “total balance.”</strong><p>ETH, USDC, a $1.99 collectible, an NFT listing, a security position and a deed-backed interest cannot be safely summed without current price sources, liquidity, legal rights and provider records.</p></div></section>

      <section className={styles.convert}>
        <div className={styles.sectionTitle}><div><small>MAKE NFTS USEFUL</small><h2>Move value—with the real route shown.</h2></div><p>An NFT does not become cash because a button says “convert.” The route below shows the buyer, market or regulated provider that must actually exist.</p></div>
        <div className={styles.routeGrid}>
          {MONEY_ROUTES.map((route) => (
            <article key={route.id}>
              <div className={styles.routeTop}><span className={route.live ? styles.live : styles.locked}>{moneyRouteStatus(route)}</span><b>{route.from} <i>→</i> {route.to}</b></div>
              <p>{route.description}</p><Link href={route.href} aria-disabled={!route.live && route.id === 'usdc-to-usd'}>{route.action} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.architecture}>
        <div className={styles.sectionTitle}><div><small>HOW THE ALL-IN-ONE PRODUCT STAYS LEGIT</small><h2>One identity. Separate ledgers.</h2></div></div>
        <div className={styles.archGrid}>
          {MONEY_LAYERS.map((layer, index) => <article key={layer.id}><span>0{index + 1}</span><small>{layer.truthLabel}</small><h3>{layer.title}</h3><p>{layer.description}</p></article>)}
        </div>
      </section>

      <footer className={styles.truth}><strong>PRODUCT BOUNDARY</strong>Voxel Vault can be the interface that brings property, USD-provider accounts, self-custody crypto and NFTs together. It is not itself a chartered bank, exchange, broker-dealer, money transmitter, custodian or guaranteed buyer. Live USD custody, crypto conversion, property securities and cash-out routes remain disabled until the appropriate regulated provider and legal configuration are verified.</footer>
    </main>
  );
}
