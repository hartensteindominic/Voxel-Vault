import BankClient from './BankClient';
import './bank.css';

export const metadata = {
  title: 'Voxel Bank Sandbox — Digital Cards',
  description: 'A sandbox banking interface for simulated balances, digital card controls, and demo transfers. No real funds move and no payment card is issued.',
};

export default function BankPage() {
  return <BankClient />;
}
