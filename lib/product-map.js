export const APP_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V', match: ['/'] },
  { id: 'earth', href: '/vault/earth', label: 'Earth', icon: '◎', match: ['/vault/earth', '/geo'] },
  { id: 'create', href: '/studio', label: 'Create', icon: '+', match: ['/studio', '/capture'] },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇', match: ['/vault', '/purchases'] },
  { id: 'more', href: '/more', label: 'More', icon: '•••', match: ['/more', '/real-estate', '/marketplace', '/discover', '/ai-licensing', '/forge', '/admin'] },
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
    description: 'Make, capture, publish and collect 3D assets without burying the creative product inside finance tooling.',
    items: [
      { id: 'studio', href: '/studio', label: 'Voxel Studio', icon: '+', description: 'Create and prepare 3D voxel assets.', badge: 'CREATE' },
      { id: 'capture', href: '/capture', label: 'Capture', icon: '◉', description: 'Bring a real object or image into the asset workflow.', badge: 'SCAN' },
      { id: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: '▦', description: 'Browse published digital assets and server-authoritative checkout flows.', badge: 'SHOP' },
      { id: 'ai-licensing', href: '/ai-licensing', label: 'AI Licensing', icon: 'AI', description: 'Manage reviewed AI-use licensing workflows for eligible digital assets.', badge: 'LICENSE' },
    ],
  },
  {
    id: 'money',
    eyebrow: 'MONEY + OWNERSHIP',
    title: 'Invest, observe, verify',
    description: 'Keep provider-backed investments, observed income and direct-property planning clearly separated.',
    items: [
      { id: 'invest', href: '/real-estate/reits', label: 'Investments', icon: '$', description: 'Browse provider-backed real-estate securities and sandbox/live states.', badge: 'PROVIDER' },
      { id: 'income', href: '/vault/income', label: 'Income', icon: '↗', description: 'See observed provider payment history without invented yield.', badge: 'OBSERVED' },
      { id: 'acquire', href: '/real-estate/acquire', label: 'Direct ownership', icon: '⌂', description: 'Plan the normal diligence, title and closing path toward real property ownership.', badge: 'DEED PATH' },
      { id: 'verify', href: '/vault/properties/claim', label: 'Verify property', icon: '✓', description: 'Create a property passport and keep digital claims downstream of evidence.', badge: 'VERIFY' },
      { id: 'twins', href: '/vault/estates/mine', label: 'My Digital Twins', icon: '◇', description: 'See account-secured digital twins and optional wallet bindings.', badge: 'OWNED' },
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
  '/geo', '/vault', '/studio', '/capture', '/marketplace', '/discover', '/ai-licensing', '/real-estate', '/forge', '/purchases', '/more',
]);

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
