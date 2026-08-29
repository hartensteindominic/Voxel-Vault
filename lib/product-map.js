export const SIMPLE_PROPERTY_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: '⌂' },
  { id: 'add', href: '/property', label: 'Create', icon: '+' },
  { id: 'slice', href: '/geo/slice', label: '$1.99', icon: '¢' },
  { id: 'vault', href: '/vault/property-drafts', label: 'Vault', icon: '◇' },
  { id: 'rented', href: '/vault/rentals', label: 'Rented', icon: '⌂' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
]);

export const APP_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: '⌂', match: ['/'] },
  { id: 'earth', href: '/vault/earth', label: 'Explore', icon: '◎', match: ['/vault/earth', '/geo'] },
  { id: 'create', href: '/studio', label: 'Create', icon: '+', match: ['/studio', '/capture', '/receipt', '/avatar'] },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇', match: ['/vault', '/purchases', '/room', '/trade', '/asset'] },
  { id: 'more', href: '/more', label: 'More', icon: '•••', match: ['/more', '/real-estate', '/marketplace', '/discover', '/ai', '/ai-licensing', '/hunt', '/forge', '/admin'] },
]);

export const APP_SECTIONS = Object.freeze([
  {
    id: 'explore',
    eyebrow: 'EXPLORE',
    title: 'Places + property',
    description: 'Explore real places first. Keep map evidence, 3D appearance and legal ownership clearly separated.',
    items: [
      { id: 'earth', href: '/vault/earth', label: 'World Atlas', icon: '◎', description: 'Explore worldwide source-backed buildings, open street imagery and selected 3D reconstructions.', badge: 'WORLD' },
      { id: 'geo', href: '/geo', label: 'GEO', icon: '⌖', description: 'Inspect one real place with parcel, building and evidence context.', badge: 'PROPERTY' },
      { id: 'discover', href: '/discover', label: 'Discover', icon: '✦', description: 'Browse the wider Voxel Vault experience.', badge: 'BROWSE' },
    ],
  },
  {
    id: 'create',
    eyebrow: 'CREATE + COLLECT',
    title: '3D assets',
    description: 'Make, capture, verify, publish and collect without burying the creative product inside finance tooling.',
    items: [
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare 3D voxel assets.', badge: 'CREATE' },
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into the asset workflow.', badge: 'SCAN' },
      { id: 'receipt', href: '/receipt', label: 'Receipt Scan', icon: '▣', description: 'Verify an eligible purchase before an optional collectible workflow.', badge: 'VERIFY' },
      { id: 'avatar', href: '/avatar', label: 'Avatar Studio', icon: '◌', description: 'Build a privacy-first spatial identity.', badge: 'AVATAR' },
      { id: 'room', href: '/room', label: 'My Room', icon: '◇', description: 'Arrange confirmed digital collectibles in a personal spatial room.', badge: 'COLLECT' },
      { id: 'trade', href: '/trade', label: 'Tap-to-Trade', icon: '⇄', description: 'Open the explicit collectible trade workflow.', badge: 'TRADE' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse published digital assets and server-authoritative checkout flows.', badge: 'SHOP' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing workflows for eligible assets.', badge: 'LICENSE' },
    ],
  },
  {
    id: 'money',
    eyebrow: 'MONEY + OWNERSHIP',
    title: 'Property + money',
    description: 'Keep sandbox comparisons, rentals, provider-backed investments, observed income and direct ownership clearly separated.',
    items: [
      { id: 'property-slice', href: '/geo/slice', label: '$1.99 Property Slice', icon: '¢', description: 'Test tiny relative property prices and preview Property + USD + Crypto + NFT paths without moving real money.', badge: 'SANDBOX' },
      { id: 'rentals', href: '/vault/rentals', label: 'Rented home', icon: '⌂', description: 'See verified lease and monthly payment status.', badge: 'LEASE' },
      { id: 'invest', href: '/real-estate/reits', label: 'Investments', icon: '$', description: 'Browse provider-backed real-estate securities and sandbox/live states.', badge: 'PROVIDER' },
      { id: 'income', href: '/vault/income', label: 'Income', icon: '↗', description: 'See observed provider payment history without invented yield.', badge: 'OBSERVED' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct ownership', icon: '⌂', description: 'Plan diligence, title and closing toward real property ownership.', badge: 'DEED PATH' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify property', icon: '✓', description: 'Create a property passport and keep digital claims downstream of evidence.', badge: 'VERIFY' },
      { id: 'twins', href: '/vault/estates/mine', label: 'My Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings.', badge: 'OWNED' },
    ],
  },
  {
    id: 'intelligence',
    eyebrow: 'AI + EXPERIENCES',
    title: 'Explore more',
    description: 'Research and playful layers stay available without crowding the main asset and property flows.',
    items: [
      { id: 'vault-ai', href: '/ai', label: 'Vault AI', icon: '✦', description: 'Research products, sources, provenance and collection context.', badge: 'AI' },
      { id: 'hunt', href: '/hunt', label: 'Scavenger Hunts', icon: '⌁', description: 'Open the multi-stop 3D NFT hunt experience.', badge: 'EXPERIENCE' },
    ],
  },
  {
    id: 'advanced',
    eyebrow: 'ADVANCED',
    title: 'Operator + blockchain',
    description: 'Power tools remain reachable without becoming the first thing a normal user has to understand.',
    items: [
      { id: 'forge', href: '/forge/mainnet', label: 'Voxel Forge', icon: '⚒', description: 'Open the reviewed Forge workflow and explicit wallet-signing path.', badge: 'ADVANCED' },
      { id: 'integrations', href: '/admin/integrations', label: 'Integrations', icon: '≋', description: 'Owner-only status center for APIs, providers and launch gates.', badge: 'OWNER' },
      { id: 'reits-admin', href: '/admin/digital-reits', label: 'REIT provider admin', icon: 'R', description: 'Owner tools for provider onboarding and controlled investment configuration.', badge: 'OWNER' },
      { id: 'claims-admin', href: '/admin/property-claims', label: 'Property claims admin', icon: 'P', description: 'Review property evidence and claim workflows.', badge: 'OWNER' },
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
  if (path === '/vault/property-drafts' || path.startsWith('/vault/property-drafts/')) return SIMPLE_PROPERTY_DOCK[3];
  if (path === '/vault/rentals' || path.startsWith('/vault/rentals/')) return SIMPLE_PROPERTY_DOCK[4];
  if (path === '/world' || path.startsWith('/world/')) return SIMPLE_PROPERTY_DOCK[5];
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
