export function normalizeOrbitQuestion(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function money(value) {
  const number = Number(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(number) ? number : 0);
}

function recentSummary(transactions) {
  const items = Array.isArray(transactions) ? transactions.slice(0, 3) : [];
  if (!items.length) return 'There are no recent transactions to summarize yet.';
  return items.map((item) => {
    const amount = Number(item?.amount || 0);
    const direction = amount >= 0 ? 'in' : 'out';
    return `${String(item?.name || item?.category || 'Activity').slice(0, 48)}: ${money(Math.abs(amount))} ${direction}`;
  }).join('; ');
}

export function buildOrbitResponse(rawMessage, context = {}) {
  const message = normalizeOrbitQuestion(rawMessage);
  const q = message.toLowerCase();
  const sandboxConnected = Boolean(context.sandboxConnected);
  const checking = Number(context.checking || 0);
  const savings = Number(context.savings || 0);
  const total = checking + savings;
  const transactions = Array.isArray(context.transactions) ? context.transactions : [];
  const spending = transactions.filter((item) => Number(item?.amount) < 0).reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const blueFrozen = Boolean(context.blueFrozen);
  const pinkFrozen = Boolean(context.pinkFrozen);
  const accountLabel = String(context.accountLabel || '').trim();

  if (!message) return { intent: 'empty', text: '' };

  if (/(password|passcode|pin|cvv|cvc|one.?time|otp|verification code|recovery|seed phrase|private key|api key|secret key)/i.test(q)) {
    return {
      intent: 'sensitive-data',
      text: 'Please do not share passwords, PINs, CVVs, one-time codes, recovery phrases, private keys, or API keys here. Orbit never needs those secrets. If you are trying to fix access, I can walk you through the safe account or sandbox steps instead.',
    };
  }

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(q)) {
    return {
      intent: 'greeting',
      text: `Hi${accountLabel ? ` ${accountLabel.split('@')[0]}` : ''} 👋 I’m Orbit. I can explain your balance, recent activity, transfers, cards, security, crypto, rewards, and whether you’re looking at demo data or Increase sandbox data.`,
    };
  }

  if (/(thank you|thanks|thx|appreciate it)/.test(q)) {
    return { intent: 'thanks', text: 'You got it ✨ If you want, ask me what to do next and I’ll point you to the right Galactic Trust control.' };
  }

  if (/(what can you do|what do you do|help me|help$|how can you help)/.test(q)) {
    return {
      intent: 'capabilities',
      text: 'I can explain balances and recent activity, show you how to test transfers or add money, explain card controls, clarify demo vs. Increase sandbox vs. production, cover security/privacy, and answer questions about the demo crypto and rewards sections. I won’t ask for secret credentials or pretend a test transaction is real money.',
    };
  }

  if (/(balance|how much money|how much do i have|money do i have|account total|available funds)/.test(q)) {
    return {
      intent: 'balance',
      text: sandboxConnected
        ? `Your connected Increase sandbox accounts currently show ${money(total)} total: ${money(checking)} in the primary sandbox account and ${money(savings)} in the second account if one is available. This is provider-backed test data using pretend money, not a real customer deposit.`
        : `Your dashboard currently shows ${money(total)} in simulated balances: ${money(checking)} checking and ${money(savings)} savings. Those numbers are demo data and are not real deposits.`,
    };
  }

  if (/(recent|transaction|activity|purchase|payment history|what did i spend)/.test(q)) {
    return {
      intent: 'activity',
      text: `${sandboxConnected ? 'Your recent Increase sandbox activity' : 'Your recent demo activity'} includes: ${recentSummary(transactions)}. ${sandboxConnected ? 'These entries come from the sandbox provider and use pretend money.' : 'These entries are simulated.'}`,
    };
  }

  if (/(spend|spending|spent|budget|expenses)/.test(q)) {
    return {
      intent: 'spending',
      text: `Based on the activity currently loaded in the dashboard, outgoing activity totals about ${money(spending)}. ${sandboxConnected ? 'That is calculated from Increase sandbox transactions only.' : 'That is calculated from the current demo transaction list.'}`,
    };
  }

  if (/(transfer|send money|send cash|ach|recipient|pay someone)/.test(q)) {
    return {
      intent: 'transfer',
      text: sandboxConnected
        ? 'Use Transfer in the sidebar or Quick Actions. Owner testing currently sends an Increase sandbox ACH using fixed test banking coordinates, so no real recipient bank account is used. Sandbox sends are capped at $1,000 and use pretend money only.'
        : 'Use Transfer in the sidebar or Quick Actions, enter a recipient name and amount, then confirm the simulation. In demo mode the dashboard updates locally and no real money moves.',
    };
  }

  if (/(add money|deposit|fund|funding|top up|put money|direct deposit)/.test(q)) {
    return {
      intent: 'funding',
      text: sandboxConnected
        ? 'Open Add Money and choose Increase sandbox ACH. The current test flow simulates a $500 inbound ACH into the sandbox account. Debit-card and direct-deposit funding are not wired to the sandbox yet, and no real money is involved.'
        : 'Open Add Money to simulate funding the demo account. The current demo buttons can add test funds locally; they do not charge a card, debit a bank, or create a real deposit.',
    };
  }

  if (/(card|freeze|unfreeze|locked|lock card|debit card)/.test(q)) {
    return {
      intent: 'cards',
      text: `The displayed Galactic cards are still demo cards. Nebula Blue is ${blueFrozen ? 'currently frozen' : 'currently active in the demo UI'}, and Cosmic Pink is ${pinkFrozen ? 'currently frozen' : 'currently active in the demo UI'}. You can use Freeze Card or the card controls to change the demo state instantly. No production card is being issued or controlled yet.`,
    };
  }

  if (/(crypto|bitcoin|btc|ethereum|eth|usdc|buy crypto|sell crypto)/.test(q)) {
    return {
      intent: 'crypto',
      text: 'The Crypto section is a practice experience for BTC, ETH, and USDC. Buys and sells only change demo holdings in the interface; no real cryptocurrency is purchased, sold, custodied, or transferred. Crypto production access stays separately locked from banking.',
    };
  }

  if (/(reward|rewards|star|stars|points|cash back|cashback)/.test(q)) {
    return {
      intent: 'rewards',
      text: 'Galactic Stars are currently demo rewards. The interface shows 2,450 stars so you can preview the experience, but they do not have cash value and are not yet tied to a live rewards program.',
    };
  }

  if (/(fee|fees|cost|price|charge|monthly fee|subscription)/.test(q)) {
    return {
      intent: 'fees',
      text: 'Galactic Trust is not charging real banking or crypto fees in the current demo/sandbox build. If a live program launches later, any fees would need to come from the approved provider program and be clearly disclosed before a user confirms an action.',
    };
  }

  if (/(fdic|insured|insurance|bank|real bank|sponsor bank|deposit insurance)/.test(q)) {
    return {
      intent: 'bank-status',
      text: 'Galactic Trust is a financial technology product, not a bank, and Galactic Trust itself is not an FDIC-insured institution. The current experience is demo/sandbox only. A future live program would need an approved sponsor-bank relationship and bank-approved disclosures before any deposit-insurance language could apply.',
    };
  }

  if (/(real money|real|live|production|demo|sandbox|increase)/.test(q)) {
    return {
      intent: 'environment',
      text: sandboxConnected
        ? 'You are looking at an Increase sandbox-connected experience. The balances and ACH events can come from the provider sandbox, but the money is pretend. Production customer deposits and real money movement remain hard-locked.'
        : 'You are looking at Galactic Trust demo mode. The website is live, but the balances, cards, transfers, rewards, and crypto are simulated. Real banking stays locked until an approved sponsor-bank/provider program is actually live.',
    };
  }

  if (/(privacy|private|data|track|tracking|information|personal info)/.test(q)) {
    return {
      intent: 'privacy',
      text: 'The current design keeps provider secrets server-side, masks card information, and does not ask Orbit for passwords, PINs, CVVs, or one-time codes. Future identity/KYC data is intended to use provider-hosted or tokenized flows rather than exposing sensitive documents to the browser whenever possible.',
    };
  }

  if (/(secure|security|safe|fraud|scam|hacked|hack|protect|protection)/.test(q)) {
    return {
      intent: 'security',
      text: 'Key protections include authenticated sessions, masked card details, server-side provider credentials, no-store financial endpoints, sandbox-only provider routing for current tests, and fail-closed production money switches. If you suspect account compromise, sign out and do not share codes or credentials in Orbit.',
    };
  }

  if (/(sign in|login|log in|sign out|logout|google|email link|magic link)/.test(q)) {
    return {
      intent: 'auth',
      text: 'You can sign in with Google or a secure email sign-in link. Log Out in the sidebar ends the authenticated Galactic Trust session. Orbit will never ask you to send back a password or one-time sign-in code.',
    };
  }

  if (/(not working|doesn't work|does not work|error|failed|failure|stuck|broken|problem)/.test(q)) {
    return {
      intent: 'troubleshooting',
      text: sandboxConnected
        ? 'If a sandbox action fails, first confirm you are signed in with the authorized account and that the Increase sandbox is connected. Then retry once. Do not paste the sandbox API key into Orbit, screenshots, or GitHub. If it still fails, the owner integration status is the right place to check provider connectivity.'
        : 'If something is stuck, refresh once and confirm you are signed in. Demo actions should work without bank credentials. If you are trying to use Increase sandbox features, the sandbox must be enabled server-side and available to the authorized owner account.',
    };
  }

  if (/(atm|withdraw|cash withdrawal|cash deposit|check deposit|mobile check|wire transfer|wire)/.test(q)) {
    return {
      intent: 'unsupported-banking',
      text: 'That feature is not live in Galactic Trust yet. The current banking test surface focuses on balances, recent sandbox activity, simulated inbound ACH, and simulated outbound ACH. I won’t imply ATM, cash, checks, or production wire capabilities that are not actually connected.',
    };
  }

  return {
    intent: 'fallback',
    text: `I’m not fully sure what you mean yet. Try asking something like “What’s my balance?”, “How do I test a transfer?”, “Is this real money?”, “Is Galactic Trust a bank?”, “Is my card frozen?”, or “Show me my recent activity.” I’ll answer using the current ${sandboxConnected ? 'Increase sandbox' : 'demo'} state without asking for sensitive credentials.`,
  };
}
