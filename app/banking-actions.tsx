'use client';

import { FormEvent, useEffect, useState } from 'react';

type BankingMode = 'demo' | 'partner';
type Action = 'transfer' | 'funding' | 'card' | null;

type StatusResponse = {
  ok: boolean;
  mode: BankingMode;
  providerName: string | null;
  partnerBankName: string | null;
  liveWritesEnabled: boolean;
  disclosure: string;
  warning?: string;
};

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `galactic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BankingActions() {
  const [status, setStatus] = useState<StatusResponse>({
    ok: true,
    mode: 'demo',
    providerName: null,
    partnerBankName: null,
    liveWritesEnabled: false,
    disclosure: 'Demo mode. No real deposits are held and no real money is moved.'
  });
  const [action, setAction] = useState<Action>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/banking/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) setStatus(data);
      })
      .catch(() => {
        setMessage('Banking status is temporarily unavailable.');
      });
  }, []);

  async function sendTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/banking/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': newIdempotencyKey()
        },
        body: JSON.stringify({
          fromAccountId: 'demo-checking-4532',
          recipient,
          amount: Number(amount),
          memo: 'Galactic Trust transfer'
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Transfer could not be created.');
      setMessage(data.transfer.message || 'Transfer submitted.');
      setRecipient('');
      setAmount('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transfer could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    setBusy(true);
    setMessage('');
    const nextFrozen = !frozen;

    try {
      const response = await fetch('/api/banking/cards/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: 'demo-card-4532', frozen: nextFrozen })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Card status could not be changed.');
      setFrozen(nextFrozen);
      setMessage(data.card.message || `Card ${nextFrozen ? 'frozen' : 'unfrozen'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Card status could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bankingControls" id="transfer" aria-label="Banking controls">
      <div className={`bankingModeBanner ${status.mode}`}>
        <span className="bankingModeDot" />
        <b>{status.mode === 'demo' ? 'Demo Banking' : 'Partner Banking'}</b>
        <span>{status.disclosure}</span>
      </div>

      <div className="quickActions">
        <button type="button" onClick={() => setAction(action === 'transfer' ? null : 'transfer')}>
          <span className="quickIcon send">➤</span><span><b>Transfer</b><small>Send money</small></span>
        </button>
        <button type="button" onClick={() => setAction(action === 'funding' ? null : 'funding')}>
          <span className="quickIcon add">＋</span><span><b>Add Money</b><small>Deposit funds</small></span>
        </button>
        <button type="button" onClick={toggleFreeze} disabled={busy}>
          <span className="quickIcon freeze">❄</span><span><b>{frozen ? 'Unfreeze Card' : 'Freeze Card'}</b><small>{frozen ? 'Resume card use' : 'Temporarily lock'}</small></span>
        </button>
        <button type="button" onClick={() => setAction(action === 'card' ? null : 'card')}>
          <span className="quickIcon card">▣</span><span><b>View Card</b><small>See safe card details</small></span>
        </button>
      </div>

      {action && (
        <div className="bankingActionSheet">
          {action === 'transfer' && (
            <form onSubmit={sendTransfer}>
              <div className="bankingSheetHeader">
                <div><small>Money movement</small><h3>Send a transfer</h3></div>
                <button type="button" className="sheetClose" onClick={() => setAction(null)}>×</button>
              </div>
              <label>
                Recipient
                <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Name or account alias" required />
              </label>
              <label>
                Amount
                <div className="moneyInput"><span>$</span><input type="number" min="0.01" max="10000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div>
              </label>
              <button className="bankingPrimary" type="submit" disabled={busy}>{busy ? 'Working…' : status.mode === 'demo' ? 'Simulate Transfer' : 'Submit Securely'}</button>
              <p className="bankingFinePrint">{status.mode === 'demo' ? 'Demo transfers never move real money.' : status.liveWritesEnabled ? 'Live transfers require a verified customer session and are sent through the configured banking partner gateway.' : 'Partner mode is configured, but live money movement remains disabled until the approved program is explicitly enabled.'}</p>
            </form>
          )}

          {action === 'funding' && (
            <div>
              <div className="bankingSheetHeader">
                <div><small>Funding</small><h3>Add money</h3></div>
                <button type="button" className="sheetClose" onClick={() => setAction(null)}>×</button>
              </div>
              <div className="fundingOptions">
                <button type="button"><span>🏦</span><b>Bank transfer</b><small>ACH funding through a banking partner</small></button>
                <button type="button"><span>💳</span><b>Debit card</b><small>Card funding through an approved processor</small></button>
                <button type="button"><span>↗</span><b>Direct deposit</b><small>Available after real account issuance</small></button>
              </div>
              <p className="bankingFinePrint">{status.mode === 'demo' ? 'These funding methods are previews only until a regulated banking partner is connected.' : 'Funding availability is controlled by the configured banking partner and customer eligibility.'}</p>
            </div>
          )}

          {action === 'card' && (
            <div>
              <div className="bankingSheetHeader">
                <div><small>Card security</small><h3>Nebula Blue</h3></div>
                <button type="button" className="sheetClose" onClick={() => setAction(null)}>×</button>
              </div>
              <div className="safeCardDetails">
                <span>Card number</span><strong>•••• •••• •••• 4532</strong>
                <span>Status</span><strong>{frozen ? 'Frozen' : 'Active'}</strong>
                <span>Network</span><strong>Visa</strong>
              </div>
              <p className="bankingFinePrint">Full PAN, CVV, PIN, and sensitive authentication data are intentionally never exposed by this prototype.</p>
            </div>
          )}
        </div>
      )}

      {message && <div className="bankingToast" role="status">{message}</div>}
    </section>
  );
}
