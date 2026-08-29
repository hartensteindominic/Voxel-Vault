export const SIMPLE_PROPERTY_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V' },
  { id: 'create', href: '/property', label: 'Create', icon: '+' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇' },
  { id: 'more', href: '/more', label: 'More', icon: '•••' },
]);

export const APP_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V', match: ['/'] },
  { id: 'create', href: '/property', label: 'Create', icon: '+', match: ['/property', '/studio', '/capture', '/receipt', '/avatar'] },
  { id: 'world', href: '/world', label: 'World', icon: '◎', match: ['/world', '/vault/earth', '/geo'] },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇', match: ['/vault', '/purchases', '/room', '/trade', '/asset'] },
  { id: 'more', href: '/more', label: 'More', icon: '•••', match: ['/more', '/real-estate', '/marketplace', '/discover', '/ai', '/ai-licensing', '/hunt', '/forge', '/admin'] },
]);

export const APP_SECTIONS = Object.freeze([
  {
    id: 'explore', eyebrow: 'WORLD + PLACES', title: 'Explore real places',
    description: 'Map and 3D evidence live here. Map geometry is never treated as legal ownership.',
    items: [
      { id: 'earth', href: '/vault/earth', label: 'World Atlas', icon: '◎', description: 'Explore source-backed buildings and open street context around the world.', badge: 'MAP' },
      { id: 'geo', href: '/geo', label: 'Property details', icon: '⌖', description: 'Inspect one place with parcel, building and evidence context.', badge: 'EVIDENCE' },
      { id: 'discover', href: '/discover', label: 'Discover', icon: '✦', description: 'Browse public Voxel Vault experiences and digital assets.', badge: 'BROWSE' },
    ],
  },
  {
    id: 'create', eyebrow: 'CREATE + COLLECT', title: 'Digital assets',
    description: 'Create and organize digital assets first. Wallets and minting stay optional.',
    items: [
      { id: 'property', href: '/property', label: 'VoxelPop Property', icon: '+', description: 'Photo → local voxel preview → source-backed mapped 3D → World.', badge: 'CREATE' },
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare other 3D voxel assets.', badge: 'CREATE' },
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into an asset workflow.', badge: 'SCAN' },
      { id: 'receipt', href: '/receipt', label: 'Receipt Scan', icon: '▣', description: 'Verify an eligible purchase before an optional collectible workflow.', badge: 'VERIFY' },
      { id: 'avatar', href: '/avatar', label: 'Avatar Studio', icon: '◌', description: 'Build a personal spatial identity with privacy-first likeness controls.', badge: 'AVATAR' },
      { id: 'room', href: '/room', label: 'My Room', icon: '◇', description: 'Arrange confirmed digital collectibles in a personal spatial room.', badge: 'COLLECT' },
      { id: 'trade', href: '/trade', label: 'Tap-to-Trade', icon: '⇄', description: 'Open an explicit user-driven collectible trade workflow.', badge: 'TRADE' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse published digital assets and explicit checkout flows.', badge: 'SHOP' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing for eligible digital assets.', badge: 'LICENSE' },
    ],
  },
  {
    id: 'property-money', eyebrow: 'OPTIONAL PROPERTY + MONEY TOOLS', title: 'Sandbox, providers + verification',
    description: 'These tools stay separate because a demo, financial position, lease, deed and NFT are not the same thing.',
    items: [
      { id: 'property-slice', href: '/geo/slice', label: '$1.99 Property Sandbox', icon: '¢', description: 'Compare tiny hypothetical property slices with demo balances only. No real funds or property rights move.', badge: 'SANDBOX' },
      { id: 'rentals', href: '/vault/rentals', label: 'Rented', icon: '⌂', description: 'View verified lease and payment records when evidence exists.', badge: 'LEASE' },
      { id: 'invest', href: '/real-estate/reits', label: 'Provider investments', icon: '$', description: 'Browse provider-backed real-estate securities with sandbox/live status shown explicitly.', badge: 'PROVIDER' },
      { id: 'income', href: '/vault/income', label: 'Observed income', icon: '↗', description: 'See provider-observed payment history without invented yield.', badge: 'OBSERVED' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct ownership path', icon: '⌂', description: 'Plan normal diligence, title and closing toward actual real-property ownership.', badge: 'DEED PATH' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify property', icon: '✓', description: 'Create a Property Passport downstream of evidence; it is not a deed.', badge: 'VERIFY' },
      { id: 'twins', href: '/vault/estates/mine', label: 'Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings.', badge: 'DIGITAL' },
    ],
  },
  {
    id: 'intelligence', eyebrow: 'OPTIONAL EXPERIENCES', title: 'AI + playful tools',
    description: 'Useful extras stay available without crowding the core Create → World → Vault flow.',
    items: [
      { id: 'vault-ai', href: '/ai', label: 'Vault AI', icon: '✦', description: 'Research products, sources, provenance and collection context.', badge: 'AI' },
      { id: 'hunt', href: '/hunt', label: 'Scavenger Hunts', icon: '⌁', description: 'Open the optional multi-stop 3D collectible hunt experience.', badge: 'EXPERIENCE' },
    ],
  },
  {
    id: 'advanced', eyebrow: 'OWNER + ADVANCED', title: 'Infrastructure + blockchain',
    description: 'Power tools stay out of the normal customer journey.',
    items: [
      { id: 'forge', href: '/forge/mainnet', label: 'Voxel Forge', icon: '⚒', description: 'Open the reviewed Forge workflow and explicit wallet-signing path.', badge: 'ADVANCED' },
      { id: 'integrations', href: '/admin/integrations', label: 'Integrations', icon: '≋', description: 'Owner-only provider and infrastructure readiness center.', badge: 'OWNER' },
      { id: 'reits-admin', href: '/admin/digital-reits', label: 'Investment provider admin', icon: 'R', description: 'Owner tools for provider onboarding and controlled configuration.', badge: 'OWNER' },
      { id: 'claims-admin', href: '/admin/property-claims', label: 'Property claims admin', icon: 'P', description: 'Review property evidence without weakening title boundaries.', badge: 'OWNER' },
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
  if (path === '/world' || path.startsWith('/world/') || path === '/geo/slice' || path.startsWith('/geo/slice/')) return SIMPLE_PROPERTY_DOCK[2];
  if (path === '/vault' || path.startsWith('/vault/')) return SIMPLE_PROPERTY_DOCK[3];
  if (path === '/more' || path.startsWith('/more/')) return SIMPLE_PROPERTY_DOCK[4];
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
