export const PRODUCT_STATUS = Object.freeze({
  liveDigital: {
    label: 'LIVE DIGITAL',
    description: 'Works now for digital/map-backed features. It does not create real-property rights.',
  },
  demo: {
    label: 'DEMO',
    description: 'Sandbox only. No real money, security purchase, or property rights move.',
  },
  partner: {
    label: 'PARTNER REQUIRED',
    description: 'Only becomes live through an approved provider, eligibility checks, settlement, and verification.',
  },
  title: {
    label: 'TITLE REQUIRED',
    description: 'Real-property ownership only changes through the normal legal closing and recorded-title process.',
  },
});

export const SIMPLE_PROPERTY_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: '⌂' },
  { id: 'add', href: '/property', label: 'Create', icon: '+' },
  { id: 'slice', href: '/geo/slice', label: '$1.99', icon: '¢' },
  { id: 'vault', href: '/vault/property-drafts', label: 'Vault', icon: '◇' },
  { id: 'rented', href: '/vault/rentals', label: 'Rented', icon: 'R' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
]);

export const APP_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: '⌂', match: ['/'] },
  { id: 'earth', href: '/vault/earth', label: 'World', icon: '◎', match: ['/vault/earth', '/geo'] },
  { id: 'create', href: '/studio', label: 'Create', icon: '+', match: ['/studio', '/capture', '/receipt', '/avatar'] },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇', match: ['/vault', '/purchases', '/room', '/trade', '/asset'] },
  { id: 'more', href: '/more', label: 'More', icon: '•••', match: ['/more', '/real-estate', '/marketplace', '/discover', '/ai', '/ai-licensing', '/hunt', '/forge', '/admin'] },
]);

export const APP_SECTIONS = Object.freeze([
  {
    id: 'places',
    eyebrow: 'PLACES',
    title: 'Explore real places',
    description: 'Map and 3D evidence can describe a place. They do not prove ownership.',
    items: [
      { id: 'earth', href: '/vault/earth', label: 'World', icon: '◎', description: 'Explore source-backed places and mapped 3D context.', badge: 'LIVE' },
      { id: 'geo', href: '/geo', label: 'Property Map', icon: '⌖', description: 'Inspect one address with map, parcel, building, and evidence context.', badge: 'LIVE' },
      { id: 'discover', href: '/discover', label: 'Discover', icon: '✦', description: 'Browse other public Voxel Vault experiences.', badge: 'MORE' },
    ],
  },
  {
    id: 'digital',
    eyebrow: 'DIGITAL',
    title: 'Create + collect',
    description: 'Digital voxels and collectibles are the live product. Minting stays optional.',
    items: [
      { id: 'property', href: '/property', label: 'VoxelPop Property', icon: '+', description: 'Photo → local voxel preview → source-backed 3D map → optional digital collectible.', badge: 'LIVE' },
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare other 3D voxel assets.', badge: 'LIVE' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse digital assets and explicit checkout flows.', badge: 'DIGITAL' },
      { id: 'room', href: '/room', label: 'My Room', icon: '◇', description: 'Arrange confirmed digital collectibles in a personal spatial room.', badge: 'DIGITAL' },
      { id: 'trade', href: '/trade', label: 'Tap-to-Trade', icon: '⇄', description: 'Open the explicit collectible trade workflow.', badge: 'DIGITAL' },
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into a digital-asset workflow.', badge: 'TOOL' },
      { id: 'receipt', href: '/receipt', label: 'Receipt Scan', icon: '▣', description: 'Verify an eligible purchase before an optional collectible workflow.', badge: 'TOOL' },
      { id: 'avatar', href: '/avatar', label: 'Avatar Studio', icon: '◌', description: 'Create a privacy-first spatial identity.', badge: 'TOOL' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing for eligible digital assets.', badge: 'TOOL' },
    ],
  },
  {
    id: 'property-money',
    eyebrow: 'PROPERTY + MONEY',
    title: 'Know what is real',
    description: 'Demo math, provider-backed investments, and recorded property ownership stay separate.',
    items: [
      { id: 'property-slice', href: '/geo/slice', label: '$1.99 Property Demo', icon: '¢', description: 'Test proportional property math with fake demo USD. No real money or ownership.', badge: 'DEMO' },
      { id: 'rentals', href: '/vault/rentals', label: 'Rented Home', icon: 'R', description: 'See verified lease records and renter-only digital layers where available.', badge: 'VERIFIED' },
      { id: 'invest', href: '/real-estate/reits', label: 'Property Investments', icon: '$', description: 'Provider-backed real-estate securities. Live execution stays provider- and eligibility-gated.', badge: 'PARTNER' },
      { id: 'income', href: '/vault/income', label: 'Income', icon: '↗', description: 'See observed provider payment records without invented yield.', badge: 'PROVIDER' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct Ownership', icon: '⌂', description: 'Plan diligence, closing, and recorded title for real property.', badge: 'TITLE' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify Property', icon: '✓', description: 'Attach evidence to a property record without turning a digital claim into a deed.', badge: 'EVIDENCE' },
      { id: 'twins', href: '/vault/estates/mine', label: 'My Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings.', badge: 'DIGITAL' },
    ],
  },
  {
    id: 'more-tools',
    eyebrow: 'MORE TOOLS',
    title: 'Optional + advanced',
    description: 'Useful extras stay available without crowding the main product.',
    items: [
      { id: 'vault-ai', href: '/ai', label: 'Vault AI', icon: '✦', description: 'Research products, sources, provenance, and collection context.', badge: 'AI' },
      { id: 'hunt', href: '/hunt', label: 'Scavenger Hunts', icon: '⌁', description: 'Open the optional multi-stop 3D collectible experience.', badge: 'PLAY' },
      { id: 'forge', href: '/forge/mainnet', label: 'Voxel Forge', icon: '⚒', description: 'Open the reviewed blockchain workflow with explicit wallet signing.', badge: 'ADVANCED' },
      { id: 'integrations', href: '/admin/integrations', label: 'Integrations', icon: '≋', description: 'Owner-only provider and launch-readiness status.', badge: 'OWNER' },
      { id: 'reits-admin', href: '/admin/digital-reits', label: 'Investment Admin', icon: 'R', description: 'Owner tools for provider onboarding and controlled configuration.', badge: 'OWNER' },
      { id: 'claims-admin', href: '/admin/property-claims', label: 'Property Claims Admin', icon: 'P', description: 'Review property evidence and claim workflows.', badge: 'OWNER' },
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
