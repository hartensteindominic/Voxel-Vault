import BankDashboard from './BankDashboard';

export const metadata = {
  title: 'Voxel Bank | Digital Card Demo',
  description: 'An interactive Voxel Bank prototype for balances, digital cards, transfers, spend controls, and activity. Demo only: no real funds or cards.',
};

export default function BankPage() {
  return <BankDashboard />;
}
