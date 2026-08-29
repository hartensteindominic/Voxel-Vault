import BankClient from './bank/BankClient';
import './bank/bank.css';
import './bank/galactic.css';
import './bank/galactic-trust.css';

export const metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <BankClient />;
}
