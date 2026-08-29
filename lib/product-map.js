export const SIMPLE_PROPERTY_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V' },
  { id: 'create', href: '/property', label: 'Create', icon: '+' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
  { id: 'vault', href: '/vault/property-drafts', label: 'Vault', icon: '◇' },
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
    id: 'property',
    eyebrow: 'PROPERTY + WORLD',
    title: 'Create and explore real places',
    description: 'Digital voxels and source-backed map evidence stay useful without being confused with deed ownership.',
    items: [
      { id: 'property-maker', href: '/property', label: 'Property Creator', icon: '+', description: 'Make an on-device VoxelPop preview, match the address, and explore source-backed 3D map geometry.', badge: 'LIVE' },
      { id: 'world', href: '/world', label: 'My World', icon: '◎', description: 'See your saved digital property voxels in their mapped locations.', badge: 'LIVE' },
      { id: 'earth', href: '/vault/earth', label: 'World Atlas', icon: '◎', description: 'Explore source-backed buildings, terrain and open street context worldwide.', badge: 'MAP DATA' },
      { id: 'geo', href: '/geo', label: 'Property Evidence', icon: '⌖', description: 'Inspect one real place deeply with parcel, building and source context.', badge: 'EVIDENCE' },
    ],
  },
  {
    id: 'digital',
    eyebrow: 'DIGITAL ASSETS',
    title: 'Create, collect and manage',
    description: 'Creative and collectible tools stay separate from real-property ownership and regulated financial products.',
    items: [
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare 3D voxel assets.', badge: 'CREATE' },
      { id: 'vault', href: '/vault', label: 'My Vault', icon: '◇', description: 'Keep saved creations, purchases and optional wallet-linked assets together.', badge: 'LIVE' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse published digital assets and supported checkout flows.', badge: 'DIGITAL' },
      { id: 'trade', href: '/trade', label: 'Tap-to-Trade', icon: '⇄', description: 'Open an explicit user-driven collectible trade workflow.', badge: 'DIGITAL' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing workflows for eligible digital assets.', badge: 'REVIEWED' },
    ],
  },
  {
    id: 'regulated',
    eyebrow: 'SANDBOX + VERIFIED RIGHTS',
    title: 'Money and property rights',
    description: 'These features stay explicitly sandboxed, observational, or provider-gated until the required legal and financial rails are verified.',
    items: [
      { id: 'property-slice', href: '/geo/slice', label: '$1.99 Property Slice', icon: '¢', description: 'Compare tiny relative property amounts without moving money or creating ownership rights.', badge: 'SANDBOX' },
      { id: 'rentals', href: '/vault/rentals', label: 'Rental Records', icon: '⌂', description: 'View verified lease/payment information when a real source supports it.', badge: 'VERIFY FIRST' },
      { id: 'invest', href: '/real-estate/reits', label: 'Real-Estate Investments', icon: '$', description: 'Provider-backed securities area. Live investing remains locked until an approved offering and intermediary are active.', badge: 'PROVIDER-GATED' },
      { id: 'income', href: '/vault/income', label: 'Income Records', icon: '↗', description: 'Show observed provider payment history only; never invent yield or future returns.', badge: 'OBSERVED ONLY' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct Ownership Path', icon: '⌂', description: 'Plan normal diligence, title and closing steps toward real property ownership.', badge: 'PLANNING' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify Property', icon: '✓', description: 'Build an evidence-backed property identity before any optional downstream minting or legal-right claim.', badge: 'VERIFY' },
      { id: 'twins', href: '/vault/estates/mine', label: 'My Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings. Digital possession is not deed ownership.', badge: 'DIGITAL' },
    ],
  },
  {
    id: 'advanced',
    eyebrow: 'ADVANCED',
    title: 'Optional tools + owner controls',
    description: 'Power tools remain available without cluttering the normal Create → World → Vault experience.',
    items: [
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into the asset workflow.', badge: 'TOOL' },
      { id: 'receipt', href: '/receipt', label: 'Receipt Scan', icon: '▣', description: 'Verify an eligible purchase before an optional collectible workflow.', badge: 'VERIFY' },
      { id: 'avatar', href: '/avatar', label: 'Avatar Studio', icon: '◌', description: 'Build a personal spatial identity layer with privacy-first likeness controls.', badge: 'OPTIONAL' },
      { id: 'room', href: '/room', label: 'My Room', icon: '◇', description: 'Arrange confirmed digital collectibles in a personal spatial room.', badge: 'OPTIONAL' },
      { id: 'vault-ai', href: '/ai', label: 'Vault AI', icon: '✦', description: 'Research products, sources, provenance and collection context.', badge: 'AI' },
      { id: 'hunt', href: '/hunt', label: 'Scavenger Hunts', icon: '⌁', description: 'Open the multi-stop 3D collectible hunt experience.', badge: 'OPTIONAL' },
      { id: 'forge', href: '/forge/mainnet', label: 'Voxel Forge', icon: '⚒', description: 'Open the reviewed advanced wallet-signing workflow.', badge: 'ADVANCED' },
      { id: 'integrations', href: '/admin/integrations', label: 'Integrations', icon: '≋', description: 'Owner-only status center for providers, infrastructure and launch gates.', badge: 'OWNER' },
      { id: 'reits-admin', href: '/admin/digital-reits', label: 'Investment Provider Admin', icon: 'R', description: 'Owner tools for provider onboarding and controlled investment configuration.', badge: 'OWNER' },
      { id: 'claims-admin', href: '/admin/property-claims', label: 'Property Claims Admin', icon: 'P', description: 'Review property evidence and claim workflows without weakening title boundaries.', badge: 'OWNER' },
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
    || path === '/world' || path.startsWith('/world/')
    || path === '/vault/property-drafts' || path.startsWith('/vault/property-drafts/');
}

export function simplePropertyDockItemForPath(pathname = '/') {
  const path = String(pathname || '/');
  if (path === '/property' || path.startsWith('/property/')) return SIMPLE_PROPERTY_DOCK[1];
  if (path === '/world' || path.startsWith('/world/')) return SIMPLE_PROPERTY_DOCK[2];
  if (path === '/vault/property-drafts' || path.startsWith('/vault/property-drafts/')) return SIMPLE_PROPERTY_DOCK[3];
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
