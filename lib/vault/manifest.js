function clean(value) {
  return String(value ?? '').trim();
}

function positive(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function buildVaultManifest({
  creations = [],
  collectibles = [],
  reitPositions = [],
  creatorSource = 'browser-library',
  walletAddress = '',
  provider = 'Dinari',
  providerEnvironment = 'sandbox',
} = {}) {
  const creatorEntries = (Array.isArray(creations) ? creations : [])
    .filter((item) => clean(item?.sessionId) && clean(item?.image))
    .map((item) => {
      const minted = Boolean(item?.mint?.tokenId !== undefined && item?.mint?.tokenId !== null && clean(item?.mint?.tokenId));
      const meshReady = clean(item?.meshStatus).toLowerCase() === 'ready';
      return {
        id: `creation:${item.sessionId}`,
        sourceId: clean(item.sessionId),
        kind: 'creation',
        zone: 'creator',
        title: clean(item.name || 'Voxel creation').replaceAll('-', ' '),
        image: clean(item.image),
        amount: 1,
        status: minted ? 'minted' : meshReady ? '3d-ready' : 'paid',
        truthLabel: minted ? 'MINTED CREATION' : meshReady ? '3D CREATION' : 'PAID CREATION',
        sourceLabel: creatorSource === 'google-synced' ? 'GOOGLE-SYNCED LIBRARY' : 'BROWSER LIBRARY',
        href: minted
          ? `/voxelflip/mint?session_id=${encodeURIComponent(item.sessionId)}`
          : `/pack/success?session_id=${encodeURIComponent(item.sessionId)}`,
        note: minted
          ? 'This creator asset has a recorded mint state in Voxel Vault.'
          : 'This is a creator-library asset. It is not a real-property interest.',
      };
    });

  const wallet = clean(walletAddress);
  const collectibleEntries = (Array.isArray(collectibles) ? collectibles : [])
    .filter((item) => clean(item?.tokenId))
    .map((item) => {
      const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
      const image = clean(metadata.image || metadata.image_url || metadata.imageUrl);
      return {
        id: `collectible:${item.tokenId}`,
        sourceId: clean(item.tokenId),
        kind: 'collectible',
        zone: 'wallet',
        title: clean(metadata.name || `Voxel #${item.tokenId}`),
        image,
        amount: 1,
        status: 'on-chain-owner-verified',
        truthLabel: 'ON-CHAIN OWNER VERIFIED',
        sourceLabel: wallet ? `WALLET ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'CONNECTED WALLET',
        href: `/room?tokenId=${encodeURIComponent(item.tokenId)}`,
        note: 'Ownership was checked with ownerOf on the configured Voxel NFT contract. This does not make the token a property deed.',
      };
    });

  const reitEntries = (Array.isArray(reitPositions) ? reitPositions : [])
    .map((position) => ({ ...position, normalizedAmount: positive(position?.amount) }))
    .filter((position) => position.normalizedAmount > 0)
    .map((position, index) => ({
      id: `reit:${clean(position.stockId || position.symbol || index)}`,
      sourceId: clean(position.stockId || position.symbol || index),
      kind: 'digital-reit',
      zone: 'reit',
      title: clean(position.symbol || 'Digital REIT position').toUpperCase(),
      subtitle: clean(position.name || ''),
      image: '',
      amount: position.normalizedAmount,
      status: 'provider-reported',
      truthLabel: 'PROVIDER POSITION REPORTED',
      sourceLabel: `${clean(provider || 'PROVIDER').toUpperCase()} ${clean(providerEnvironment || 'sandbox').toUpperCase()} ACCOUNT`,
      href: '/real-estate/reits',
      note: 'This is a security position reported by the configured provider account. It is not a deed or direct ownership of a specific property.',
    }));

  return [...creatorEntries, ...collectibleEntries, ...reitEntries];
}

export function summarizeVaultManifest(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    total: list.length,
    creations: list.filter((item) => item.kind === 'creation').length,
    collectibles: list.filter((item) => item.kind === 'collectible').length,
    digitalReits: list.filter((item) => item.kind === 'digital-reit').length,
  };
}
