import BankClient from './BankClient';
import './bank.css';

export const metadata = {
  title: 'Galactic Trust — Digital Banking',
  description: 'A premium prototype banking experience with accounts, transfers, activity, and controllable digital cards.',
};

export default function BankPage() {
  return <BankClient />;
}
