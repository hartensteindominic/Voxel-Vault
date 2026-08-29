export const MONEY_LAYERS = Object.freeze([
  {
    id: 'usd',
    label: 'Cash',
    title: 'USD account',
    custody: 'regulated-partner-required',
    truthLabel: 'PARTNER REQUIRED',
    description: 'A future regulated bank or payments partner can supply USD account, deposit and payout capabilities. Voxel Vault does not hold customer dollars itself.',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    title: 'Self-custody wallet',
    custody: 'user-controlled-wallet',
    truthLabel: 'WALLET-REPORTED',
    description: 'Read ETH and USDC from the connected wallet. Voxel Vault does not request a seed phrase or take custody of wallet funds.',
  },
  {
    id: 'property',
    label: 'Property + NFTs',
    title: 'Digital property vault',
    custody: 'account-first-optional-chain',
    truthLabel: 'ACCOUNT / CHAIN VERIFIED',
    description: 'Show paid digital property collectibles, optional NFT records and provider-verified investment positions without calling any of them a deed unless legal title evidence exists.',
  },
]);

export const MONEY_ROUTES = Object.freeze([
  {
    id: 'usd-to-digital-property',
    from: 'USD',
    to: 'Digital property',
    state: 'available-through-checkout',
    live: true,
    guarantee: false,
    href: '/vault/estates',
    action: 'Buy the $1.99 reference',
    description: 'A server-authoritative hosted checkout can buy the digital collectible. It creates no physical-property or investment rights.',
  },
  {
    id: 'digital-property-to-nft',
    from: 'Digital property',
    to: 'NFT',
    state: 'owner-optional-mint',
    live: true,
    guarantee: false,
    href: '/vault/estates/mine',
    action: 'Mint an owned property',
    description: 'A paid account-owned collectible can receive an optional Base NFT backup. Minting does not create value, liquidity, title or rent rights.',
  },
  {
    id: 'nft-to-usdc',
    from: 'NFT',
    to: 'USDC',
    state: 'market-sale-required',
    live: false,
    guarantee: false,
    href: '/marketplace',
    action: 'Prepare a market listing',
    description: 'Cash-out requires a willing buyer, a valid listing and settled payment. Voxel Vault cannot promise an instant buyer or a floor price.',
  },
  {
    id: 'usdc-to-usd',
    from: 'USDC',
    to: 'USD',
    state: 'regulated-offramp-required',
    live: false,
    guarantee: false,
    href: '/vault/money',
    action: 'Off-ramp partner required',
    description: 'Converting customer crypto to dollars requires an approved exchange/off-ramp and identity/compliance controls. Voxel Vault does not perform this exchange itself.',
  },
  {
    id: 'property-security-to-cash',
    from: 'Property investment',
    to: 'USD',
    state: 'regulated-market-required',
    live: false,
    guarantee: false,
    href: '/real-estate/reits',
    action: 'Open regulated pilot',
    description: 'A real property/security position can be sold or redeemed only through its approved issuer, provider and market rules. An NFT wrapper cannot bypass them.',
  },
]);

export function getMoneyRoute(id) {
  const normalized = String(id || '').trim().toLowerCase();
  return MONEY_ROUTES.find((route) => route.id === normalized) || null;
}

export function moneyRouteStatus(route) {
  if (!route) return 'UNKNOWN';
  return route.live ? 'AVAILABLE WITH REVIEW' : 'PARTNER / MARKET REQUIRED';
}
