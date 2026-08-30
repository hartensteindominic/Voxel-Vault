import GalacticBankGate from './GalacticBankGate';
import GalacticIncreaseSandboxRecovery from './GalacticIncreaseSandboxRecovery';
import './bank.css';
import './galactic.css';
import './galactic-trust.css';
import './auth.css';
import './enhancements.css';

export const metadata = {
  title: 'Dashboard',
  description: 'Galactic Trust financial-app dashboard with simulated balances, cards, transfers, activity, and account controls. Galactic Trust is not a bank; live banking remains production-gated until an approved sponsor-bank program is active.',
  alternates: { canonical: '/bank' },
};

export default function BankPage() {
  return (
    <>
      <GalacticBankGate />
      <GalacticIncreaseSandboxRecovery />
    </>
  );
}
