import BankClient from './BankClient';
import './bank.css';

export const metadata = {
  title: 'Galactic Trust — Digital banking',
  description: 'Galactic Trust is the Voxel Vault banking prototype with digital cards, balances, transfers, transaction history, and card controls.',
};

export default function BankPage() {
  return <BankClient />;
}
