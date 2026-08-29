import PropertyDraftSyncBridge from './PropertyDraftSyncBridge';

export const metadata = {
  title: 'My Vault | Voxel Vault',
  description: 'Organize digital creations, wallet-verified collectibles, and separately verified provider positions without mixing their legal meaning.',
};

export default function VaultLayout({ children }) {
  return <><PropertyDraftSyncBridge />{children}</>;
}
