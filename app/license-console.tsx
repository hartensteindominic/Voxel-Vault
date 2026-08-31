'use client';

import { useEffect, useMemo, useState } from 'react';

type CatalogAsset = {
  tokenId: string;
  displayName: string;
  tokenURI: string;
  owner: string;
  contract: string;
};

type CatalogResponse = {
  assets?: CatalogAsset[];
  paidEndpoint?: string;
  price?: string;
  error?: string;
};

type HealthResponse = {
  status?: string;
  x402?: {
    configured?: boolean;
    payTo?: string;
    facilitator?: string;
    network?: string;
  };
};

type LicenseConsoleProps = {
  price: string;
  payTo: string;
  payNowUri: string;
  walletLink: string;
};

function shortAddress(value = '') {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value || 'not set';
}

export function LicenseConsole({ price, payTo, payNowUri, walletLink }: LicenseConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [tokenId, setTokenId] = useState('1');
  const [clientId, setClientId] = useState('demo-agent');
  const [useCase, setUseCase] = useState('render this voxel in one generated scene');
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [catalogResponse, healthResponse] = await Promise.all([
        fetch('/api/licenses/catalog', { cache: 'no-store' }).then(response => response.json()),
        fetch('/api/agent/health', { cache: 'no-store' }).then(response => response.json())
      ]);
      setCatalog(catalogResponse);
      setHealth(healthResponse);
      if (catalogResponse?.assets?.[0]?.tokenId) {
        setTokenId(catalogResponse.assets[0].tokenId);
      }
    } catch (error) {
      setCatalog({ error: error instanceof Error ? error.message : 'Catalog unavailable' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const endpoint = useMemo(() => {
    if (typeof window === 'undefined') return '/api/licenses/use';
    return `${window.location.origin}/api/licenses/use`;
  }, []);

  async function requestChallenge() {
    setLoading(true);
    setChallenge('');
    try {
      const response = await fetch('/api/licenses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, clientId, useCase })
      });
      const paymentHeader =
        response.headers.get('PAYMENT-REQUIRED') ||
        response.headers.get('X-PAYMENT-REQUIRED') ||
        '';
      const data = await response.json().catch(() => ({}));
      setChallenge(JSON.stringify({
        status: response.status,
        paymentRequiredHeader: paymentHeader || 'returned by x402-compatible clients',
        body: data
      }, null, 2));
    } catch (error) {
      setChallenge(error instanceof Error ? error.message : 'Challenge request failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyEndpoint() {
    await navigator.clipboard?.writeText(endpoint).catch(() => undefined);
  }

  return (
    <section className="console">
      <div className="consoleHeader">
        <div>
          <p className="eyebrow">Live licensing console</p>
          <h2>Money route: /api/licenses/use</h2>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <div className="consoleGrid">
        <div className="controlPanel">
          <div className="walletBox">
            <span>Money goes straight to MetaMask</span>
            <code>{payTo}</code>
            <div className="buttonRow compact">
              <a className="payButton" href={payNowUri}>Pay {price} USDC</a>
              <a className="darkButton" href={walletLink}>Open wallet</a>
            </div>
          </div>
          <label>
            Token ID
            <input value={tokenId} onChange={event => setTokenId(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            Client ID
            <input value={clientId} onChange={event => setClientId(event.target.value)} />
          </label>
          <label>
            One-use description
            <textarea value={useCase} onChange={event => setUseCase(event.target.value)} />
          </label>
          <div className="buttonRow">
            <button className="darkButton" type="button" onClick={copyEndpoint}>Copy endpoint</button>
            <button className="payButton" type="button" onClick={requestChallenge} disabled={loading}>Get x402 challenge</button>
          </div>
        </div>

        <div className="readout">
          <div className="miniStats">
            <span>API status: <b>{health?.status || 'checking'}</b></span>
            <span>Receiver: <b>{shortAddress(health?.x402?.payTo)}</b></span>
            <span>Facilitator: <b>{health?.x402?.facilitator || 'checking'}</b></span>
          </div>
          <pre>{challenge || 'Press "Get x402 challenge" to see the HTTP 402 payment request an agent receives before it pays.'}</pre>
        </div>
      </div>

      <div className="catalogStrip">
        {catalog?.error && <p className="warning">{catalog.error}</p>}
        {!catalog?.error && (catalog?.assets || []).length === 0 && (
          <p className="warning">No eligible VoxelFlip tokens were found for the licensor wallet yet. Set LICENSE_TOKEN_IDS if you know the token IDs and want faster discovery.</p>
        )}
        {(catalog?.assets || []).slice(0, 6).map(asset => (
          <button key={asset.tokenId} type="button" onClick={() => setTokenId(asset.tokenId)}>
            <b>#{asset.tokenId}</b>
            <span>{asset.displayName}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
