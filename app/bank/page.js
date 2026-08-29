import BankClient from './BankClient';
import './bank.css';
import './bank-expanded.css';
import './galactic-trust.css';

export const metadata = {
  title: 'Galactic Trust Sandbox — Digital Banking',
  description: 'A futuristic Galactic Trust banking sandbox for simulated accounts, digital card controls, bills, goals, security, activity, and demo transfers. No real funds move and no payment card is issued.',
};

export default function BankPage() {
  return <BankClient />;
}
