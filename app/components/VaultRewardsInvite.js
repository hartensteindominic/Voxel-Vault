'use client';

import { useEffect, useState } from 'react';

export default function VaultRewardsInvite() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('VAULT-FRIEND');

  useEffect(() => {
    const saved = window.localStorage.getItem('vv-referral-code');
    if (saved) {
      setCode(saved);
      return;
    }

    const generated = `VAULT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    window.localStorage.setItem('vv-referral-code', generated);
    setCode(generated);
  }, []);

  const copy = async () => {
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return <section className="vv3-rewards" aria-labelledby="rewards-title">
    <div className="vv3-rewardsIcon" aria-hidden="true">✦</div>
    <div className="vv3-rewardsCopy">
      <div className="vv3-sectionLabel"><span>02</span> VAULT REWARDS</div>
      <h2 id="rewards-title">Bring friends.<br/><em>Earn Vault credit.</em></h2>
      <p>Share your personal Vault link and build a reward balance when eligible purchases are verified. Rewards are funded from Voxel Vault's configured margin, not by inventing money at checkout.</p>
      {expanded && <div className="vv3-rewardsFine">Rewards are subject to eligibility, verified payment, fraud checks and the published rewards terms. Cash payouts should only be enabled after a real payout provider and compliance rules are configured.</div>}
    </div>
    <div className="vv3-rewardsAction">
      <span className="vv3-refCode">{code}</span>
      <button type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy invite link'}</button>
      <button type="button" className="vv3-rewardsMore" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide details' : 'How it works'}</button>
    </div>
  </section>;
}
