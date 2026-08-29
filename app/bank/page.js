import BankClient from './BankClient';
import './bank.css';

export const metadata = {
  title: 'Vault Bank — Digital cards',
  description: 'Demo banking dashboard with balances, transfers, transaction history, and controllable digital cards.',
};

export default function BankPage() {
  return <BankClient />;
}
