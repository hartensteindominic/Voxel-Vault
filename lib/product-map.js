export const SIMPLE_PROPERTY_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V' },
  { id: 'add', href: '/property', label: 'Add', icon: '+' },
  { id: 'slice', href: '/geo/slice', label: '$1.99', icon: '¢' },
  { id: 'vault', href: '/vault/property-drafts', label: 'Vault', icon: '◇' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
]);

export const APP_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V', match: ['/'] },
  { id: 'earth', href: '/vault/earth', label: 'Earth', icon: '◎', match: ['/vault/earth', '/geo'] },
  { id: 'create', href: '/studio', label: 'Create', icon: '+', match: ['/studio', '/capture', '/receipt', '/avatar'] },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇', match: ['/vault', '/purchases', '/room', '/trade', '/asset'] },
  { id: 'more', href: '/more', label: 'More', icon: '•••', match: ['/more', '/real-estate', '/marketplace', '/discover', '/ai', '/ai-licensing', '/hunt', '/forge', '/admin'] },
]);

export const APP_SECTIONS = Object.freeze([
  {
    id: 'explore',
    eyebrow: 'EXPLORE THE WORLD',
    title: 'Places + property',
    description: 'Move from the planet to a real address without mixing map evidence with legal ownership.',
    items: [
      { id: 'earth', href: '/vault/earth', label: 'World Atlas', icon: '◎', description: 'Explore worldwide source-backed buildings, open street imagery and selected Meshy reconstructions.', badge: 'WORLD' },
      { id: 'geo', href: '/geo', label: 'GEO', icon: '⌖', description: 'Inspect one real place deeply with parcel, building and evidence context.', badge: 'PROPERTY' },
      { id: 'discover', href: '/discover', label: 'Discover', icon: '✦', description: 'Browse the broader Voxel Vault experience from one discovery surface.', badge: 'BROWSE' },
    ],
  },
  {
    id: 'create',
    eyebrow: 'CREATE + COLLECT',
    title: '3D assets',
    description: 'Make, capture, verify, publish, collect and exchange 3D assets without burying the creative product inside finance tooling.',
    items: [
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare 3D voxel assets.', badge: 'CREATE' },
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into the asset workflow.', badge: 'SCAN' },
      { id: 'receipt', href: '/receipt', label: 'Receipt Scan', icon: '▣', description: 'Verify an eligible purchase before an optional collectible workflow.', badge: 'VERIFY' },
      { id: 'avatar', href: '/avatar', label: 'Avatar Studio', icon: '◌', description: 'Build the personal spatial identity layer with privacy-first likeness controls.', badge: 'AVATAR' },
      { id: 'room', href: '/room', label: 'My Room', icon: '◇', description: 'Arrange confirmed digital collectibles in a personal spatial room.', badge: 'COLLECT' },
      { id: 'trade', href: '/trade', label: 'Tap-to-Trade', icon: '⇄', description: 'Open the explicit user-driven collectible trade workflow.', badge: 'TRADE' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse published digital assets and server-authoritative checkout flows.', badge: 'SHOP' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing workflows for eligible digital assets.', badge: 'LICENSE' },
    ],
  },
  {
    id: 'money',
    eyebrow: 'MONEY + OWNERSHIP',
    title: 'Invest, rent, own, verify',
    description: 'Keep sandbox property comparisons, rentals, provider-backed investments, observed income and direct-property ownership clearly separated.',
    items: [
      { id: 'property-slice', href: '/geo/slice', label: '$1.99 Property Slice', icon: '¢', description: 'Test tiny relative property prices and preview Property + USD + Crypto + NFT paths without moving real money or creating property rights.', badge: 'SANDBOX' },
      { id: 'rentals', href: '/vault/rentals', label: 'Rented home', icon: '⌂', description: 'See a verified lease, monthly payment status and the renter-only minted-voxel layer.', badge: 'LEASE' },
      { id: 'invest', href: '/real-estate/reits', label: 'Investments', icon: '$', description: 'Browse provider-backed real-estate securities and sandbox/live states.', badge: 'PROVIDER' },
      { id: 'income', href: '/vault/income', label: 'Income', icon: '↗', description: 'See observed provider payment history without invented yield.', badge: 'OBSERVED' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct ownership', icon: '⌂', description: 'Plan the normal diligence, title and closing path toward real property ownership.', badge: 'DEED PATH' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify property', icon: '✓', description: 'Create a property passport and keep digital claims downstream of evidence.', badge: 'VERIFY' },
      { id: 'twins', href: '/vault/estates/mine', label: 'My Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings.', badge: 'OWNED' },
    ],
  },
  {
    id: 'intelligence',
    eyebrow: 'INTELLIGENCE + EXPERIENCES',
    title: 'AI + playful layers',
    description: 'Research, explain and interact with the collection without crowding the main asset and property flows.',
    items: [
      { id: 'vault-ai', href: '/ai', label: 'Vault AI', icon: '✦', description: 'Research products, sources, provenance and collection context.', badge: 'AI' },
      { id: 'hunt', href: '/hunt', label: 'Scavenger Hunts', icon: '⌁', description: 'Open the multi-stop 3D NFT hunt experience as an optional playful layer.', badge: 'EXPERIENCE' },
    ],
  },
  {
    id: 'advanced',
    eyebrow: 'ADVANCED TOOLS',
    title: 'Operator + blockchain',
    description: 'Power tools stay available without becoming the first thing a normal user has to understand.',
    items: [
      { id: 'forge', href: '/forge/mainnet', label: 'Voxel Forge', icon: '⚒', description: 'Open the reviewed Forge workflow and explicit wallet-signing path.', badge: 'ADVANCED' },
      { id: 'integrations', href: '/admin/integrations', label: 'Integrations', icon: '≋', description: 'Owner-only status center for APIs, providers, infrastructure and launch gates.', badge: 'OWNER' },
      { id: 'reits-admin', href: '/admin/digital-reits', label: 'REIT provider admin', icon: 'R', description: 'Owner tools for provider onboarding and controlled investment configuration.', badge: 'OWNER' },
      { id: 'claims-admin', href: '/admin/property-claims', label: 'Property claims admin', icon: 'P', description: 'Review property evidence and claim workflows without weakening title boundaries.', badge: 'OWNER' },
    ],
  },
]);

export const APP_USER_PREFIXES = Object.freeze([
  '/property', '/world', '/geo', '/vault', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/asset', '/marketplace', '/discover', '/ai', '/ai-licensing', '/hunt', '/real-estate', '/forge', '/purchases', '/more', '/admin',
]);

export function isSimplePropertyRoute(pathname = '/') {
  const path = String(pathname || '/');
  return path === '/'
    || path === '/property' || path.startsWith('/property/')
    || path === '/geo/slice' || path.startsWith('/geo/slice/')
    || path === '/world' || path.startsWith('/world/')
    || path === '/vault/property-drafts' || path.startsWith('/vault/property-drafts/')
    || path === '/vault/rentals' || path.startsWith('/vault/rentals/');
}

export function simplePropertyDockItemForPath(pathname = '/') {
  const path = String(pathname || '/');
  if (path === '/property' || path.startsWith('/property/')) return SIMPLE_PROPERTY_DOCK[1];
  if (path === '/geo/slice' || path.startsWith('/geo/slice/')) return SIMPLE_PROPERTY_DOCK[2];
  if (path === '/vault/property-drafts' || path.startsWith('/vault/property-drafts/') || path === '/vault/rentals' || path.startsWith('/vault/rentals/')) return SIMPLE_PROPERTY_DOCK[3];
  if (path === '/world' || path.startsWith('/world/')) return SIMPLE_PROPERTY_DOCK[4];
  return SIMPLE_PROPERTY_DOCK[0];
}

export function dockItemForPath(pathname = '/') {
  const path = String(pathname || '/');
  if (path === '/') return APP_DOCK[0];
  const exact = APP_DOCK.find((item) => item.match.some((prefix) => prefix !== '/' && (path === prefix || path.startsWith(`${prefix}/`))));
  return exact || APP_DOCK[4];
}

export function isOrganizedUserRoute(pathname = '/') {
  const path = String(pathname || '/');
  return path === '/' || APP_USER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
