import BankClient from './BankClient';
import './bank.css';
import './bank-expanded.css';

export const metadata = {
  title: 'Voxel Bank Sandbox — Digital Banking',
  description: 'A full sandbox banking interface for simulated accounts, digital card controls, bills, goals, security, activity, and demo transfers. No real funds move and no payment card is issued.',
};

export default function BankPage() {
  return <BankClient />;
}
