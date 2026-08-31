import { bankingStatus } from './banking';
import { cryptoStatus } from './crypto';

export type AssistantReply = {
  message: string;
  suggestions: string[];
};

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function answerGalacticQuestion(input: string): AssistantReply {
  const text = input.trim().toLowerCase().slice(0, 500);
  const banking = bankingStatus();
  const crypto = cryptoStatus();
  const demoNotice = banking.mode === 'demo'
    ? 'Galactic Trust is currently in demo banking mode, so no real deposits or money movement occur yet.'
    : banking.disclosure;

  if (!text) {
    return {
      message: 'Ask me about transfers, cards, crypto, security, privacy, rewards, or how Galactic Trust works.',
      suggestions: ['How do transfers work?', 'Is my data private?', 'How does crypto work?']
    };
  }

  if (includesAny(text, ['hello', 'hi ', 'hey', 'good morning', 'good evening'])) {
    return {
      message: `Hi! I’m Orbit, the Galactic Trust support assistant. ${demoNotice}`,
      suggestions: ['Transfer money', 'Crypto', 'Security & privacy']
    };
  }

  if (includesAny(text, ['transfer', 'send money', 'send cash'])) {
    return {
      message: banking.mode === 'demo'
        ? 'Tap Transfer on the dashboard, enter a recipient and amount, then choose Simulate Transfer. Demo transfers never move real money.'
        : 'Tap Transfer, enter the recipient and amount, then review the transfer before submission. Live availability and limits depend on your approved banking program and account eligibility.',
      suggestions: ['Add money', 'Freeze my card', 'Is this secure?']
    };
  }

  if (includesAny(text, ['add money', 'deposit', 'fund account', 'direct deposit', 'ach'])) {
    return {
      message: banking.mode === 'demo'
        ? 'The Add Money panel previews bank transfer, debit-card funding, and direct deposit. They stay simulated until a regulated banking partner is connected.'
        : 'Open Add Money to see the funding methods enabled for your account. Availability is controlled by the banking partner and your eligibility.',
      suggestions: ['How do transfers work?', 'Security & privacy', 'Cards']
    };
  }

  if (includesAny(text, ['freeze', 'lost card', 'stolen card', 'card stolen', 'lock card'])) {
    return {
      message: banking.mode === 'demo'
        ? 'Use Freeze Card on the dashboard to simulate locking the Nebula Blue card. No real card is affected in demo mode.'
        : 'Use Freeze Card immediately if your card is lost or stolen. For suspected fraud, also contact the support channel shown in your account.',
      suggestions: ['View card', 'Security protections', 'Contact support']
    };
  }

  if (includesAny(text, ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'usdc', 'buy coin', 'sell coin'])) {
    return {
      message: crypto.mode === 'demo'
        ? 'The Crypto panel lets you simulate buying and selling BTC, ETH, and USDC using clearly labeled demo prices. No real crypto is purchased or sold until an approved provider is connected and live trading is explicitly enabled.'
        : `${crypto.disclosure} Crypto can lose value, and Galactic Trust does not provide personalized investment advice in chat.`,
      suggestions: ['Buy crypto', 'Sell crypto', 'Crypto risks']
    };
  }

  if (includesAny(text, ['safe', 'secure', 'security', 'protect', 'fraud', '2fa', 'two factor'])) {
    return {
      message: 'Galactic Trust uses server-only secrets, signed live-banking sessions, same-origin request checks, masked card details, explicit live-write switches, idempotency protection for money movement, and restrictive browser security headers. Never share passwords, PINs, CVVs, recovery codes, or one-time codes in chat.',
      suggestions: ['Privacy', 'Freeze my card', 'What should I never share?']
    };
  }

  if (includesAny(text, ['privacy', 'data', 'tracking', 'chat history', 'store my'])) {
    return {
      message: 'Orbit is designed for support questions and does not need your password, PIN, CVV, recovery code, or full account number. This chat feature does not intentionally persist messages in the app database. Avoid entering sensitive financial or authentication information here.',
      suggestions: ['Security protections', 'What should I never share?', 'Close chat']
    };
  }

  if (includesAny(text, ['fdic', 'insured', 'bank insured', 'deposit insurance'])) {
    return {
      message: banking.mode === 'demo'
        ? 'Galactic Trust is not presenting the demo balances as insured deposits. Any future deposit-insurance language must identify the actual approved partner bank and match the real program terms.'
        : banking.disclosure,
      suggestions: ['How Galactic Trust works', 'Privacy', 'Security']
    };
  }

  if (includesAny(text, ['fee', 'fees', 'cost', 'price'])) {
    return {
      message: 'The dashboard does not currently represent live consumer banking fees. Any future transfer, account, crypto, or membership fee must be shown clearly before the user confirms a transaction or enrolls.',
      suggestions: ['Crypto', 'Transfers', 'Rewards']
    };
  }

  if (includesAny(text, ['reward', 'stars', 'cashback'])) {
    return {
      message: 'The rewards section is currently part of the product experience. Live reward earning, redemption rules, and merchant offers must come from the approved rewards program before launch.',
      suggestions: ['Cards', 'Crypto', 'Security']
    };
  }

  if (includesAny(text, ['balance', 'account number', 'routing number', 'cvv', 'pin', 'password', 'one time code', 'otp'])) {
    return {
      message: 'For your security, I won’t ask for or reveal passwords, PINs, CVVs, recovery codes, one-time codes, or full account/card numbers in chat. Use the protected account screens for sensitive account details.',
      suggestions: ['Security protections', 'Privacy', 'Freeze my card']
    };
  }

  if (includesAny(text, ['investment advice', 'what should i buy', 'should i buy', 'will bitcoin', 'guaranteed profit'])) {
    return {
      message: 'I can explain how the Galactic crypto feature works, but I can’t promise returns or give personalized investment recommendations. Crypto prices can move sharply and losses are possible.',
      suggestions: ['How crypto works', 'Crypto risks', 'Security']
    };
  }

  if (includesAny(text, ['human', 'agent', 'support', 'help center', 'contact'])) {
    return {
      message: 'For account-specific issues, fraud reports, identity verification, or disputes, use the Help Center or the verified support contact shown inside your authenticated account. Never trust support requests asking for your PIN, CVV, password, or one-time code.',
      suggestions: ['Security protections', 'Freeze my card', 'Privacy']
    };
  }

  return {
    message: `I can help with Galactic Trust transfers, cards, crypto, rewards, security, privacy, and product status. ${demoNotice}`,
    suggestions: ['How do transfers work?', 'How does crypto work?', 'Is my data private?']
  };
}
