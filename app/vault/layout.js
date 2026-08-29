import ConsumerTopNav from '../components/ConsumerTopNav';
import PropertyDraftSyncBridge from './PropertyDraftSyncBridge';
import './vault-consumer-shell.css';

export const metadata = {
  title: 'My Vault | Voxel Vault',
  description: 'Organize digital creations, wallet-verified collectibles, and separately verified provider positions without mixing their legal meaning.',
};

export default function VaultLayout({ children }) {
  return <><ConsumerTopNav/><PropertyDraftSyncBridge/><div className="vv-vault-route">{children}</div></>;
}
