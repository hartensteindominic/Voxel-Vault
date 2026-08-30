import GalacticBankGate from './bank/GalacticBankGate';
import './bank/bank.css';
import './bank/galactic.css';
import './bank/galactic-trust.css';
import './bank/auth.css';

export const metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <GalacticBankGate />;
}
