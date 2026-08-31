import { BusinessMonitorV2 } from './business/monitor-v2';

export const metadata = {
  title: 'Galactic Trust Business | AI Financial Monitor',
  description: 'AI-powered business finance monitoring for cash flow, revenue, expenses, recurring costs, forecasts, financial health, scenarios, and decision support.',
};

export default function Home() {
  return <BusinessMonitorV2 />;
}
