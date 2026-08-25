'use client';

import { Wallet } from 'ethers';
import { useState } from 'react';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: '#f6f7fb',
  padding: '28px 18px 60px',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const cardStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  background: '#151922',
  border: '1px solid #2b3240',
  borderRadius: 20,
  padding: 22,
  boxShadow: '0 18px 60px rgba(0,0,0,.28)',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  borderRadius: 14,
  padding: '15px 18px',
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  marginTop: 10,
};

export default function VoxelFlipSignerSetup() {
  const [privateKey, setPrivateKey] = useState('');
  const [address, setAddress] = useState('');
  const [copied, setCopied] = useState(false);

  function generateSigner() {
    const wallet = Wallet.createRandom();
    setPrivateKey(wallet.privateKey);
    setAddress(wallet.address);
    setCopied(false);
  }

  async function copyPrivateKey() {
    if (!privateKey) return;
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
  }

  function clearSigner() {
    setPrivateKey('');
    setAddress('');
    setCopied(false);
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={{ letterSpacing: 1.4, fontSize: 12, opacity: 0.7, marginTop: 0 }}>VOXELFLIP · LOCAL SIGNER SETUP</p>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: '8px 0 12px' }}>Create the mint signer on your iPhone.</h1>
        <p style={{ opacity: 0.82, lineHeight: 1.55 }}>
          This creates a brand-new empty Ethereum-compatible signer <b>only inside this browser tab</b>. This page does not send or store the generated private key. Do not use your main wallet, recovery phrase, or a funded account.
        </p>

        <div style={{ background: '#201b13', border: '1px solid #5a4320', borderRadius: 14, padding: 14, margin: '18px 0' }}>
          <b>Important</b>
          <p style={{ margin: '6px 0 0', opacity: 0.9, lineHeight: 1.45 }}>
            Never paste the private key into chat. Paste it only into the Vercel value for <code>VOXELFLIP_MINT_SIGNER_PRIVATE_KEY</code>. The signer needs no ETH. Your owner wallet still controls the collection and pays deployment gas.
          </p>
        </div>

        {!privateKey ? (
          <button style={{ ...buttonStyle, background: '#f6f7fb', color: '#0b0d12' }} onClick={generateSigner}>
            Generate dedicated VoxelFlip signer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>SIGNER PUBLIC ADDRESS</div>
              <div style={{ wordBreak: 'break-all', background: '#0f1218', borderRadius: 12, padding: 12, fontFamily: 'monospace', fontSize: 13 }}>{address}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>PRIVATE KEY · KEEP SECRET</div>
              <div style={{ wordBreak: 'break-all', background: '#0f1218', borderRadius: 12, padding: 12, fontFamily: 'monospace', fontSize: 13 }}>{privateKey}</div>
            </div>
            <button style={{ ...buttonStyle, background: '#f6f7fb', color: '#0b0d12' }} onClick={copyPrivateKey}>
              {copied ? 'Copied full private key ✓' : 'Copy full private key'}
            </button>
            <button style={{ ...buttonStyle, background: '#252b36', color: '#f6f7fb' }} onClick={clearSigner}>
              Erase from this screen
            </button>
          </>
        )}

        <div style={{ marginTop: 24, borderTop: '1px solid #2b3240', paddingTop: 18, lineHeight: 1.55 }}>
          <b>Then in Vercel:</b>
          <ol style={{ paddingLeft: 22, marginBottom: 0 }}>
            <li>Edit <code>VOXELFLIP_MINT_SIGNER_PRIVATE_KEY</code>.</li>
            <li>Paste the copied full key as the value. Do not add quotes or the variable name.</li>
            <li>Make sure <b>Preview</b> is enabled for the experimental branch.</li>
            <li>Save and redeploy the Preview.</li>
            <li>Refresh <a style={{ color: '#c8d6ff' }} href="/api/creator-pack/nft/preflight">VoxelFlip preflight</a>. You want <code>mintSignerValid: true</code> and <code>readyForContractDeployment: true</code>.</li>
          </ol>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>
          If this signer is ever exposed, generate a new dedicated signer and rotate it before minting. Never fund the signer account.
        </p>
      </section>
    </main>
  );
}
