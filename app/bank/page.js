import BankClient from './BankClient';
import './bank.css';
import './galactic.css';
import './galactic-trust.css';

export const metadata = {
  title: 'Dashboard',
  description: 'Galactic Trust digital banking dashboard with balances, digital cards, transfers, activity, and account controls. This build remains simulated until regulated provider rails are connected.',
  alternates: { canonical: '/bank' },
};

export default function BankPage() {
  return <BankClient />;
}
