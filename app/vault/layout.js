import VaultPortalNav from './VaultPortalNav';

export const metadata = {
  title: 'My Vault | Voxel Vault',
  description: 'Spatial creator assets, verified wallet collectibles, user-bound provider positions and observed income inside Voxel Vault.',
};

export default function VaultLayout({ children }) {
  return (
    <>
      {children}
      <VaultPortalNav />
    </>
  );
}
