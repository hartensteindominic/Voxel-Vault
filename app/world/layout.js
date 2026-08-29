import ConsumerTopNav from '../components/ConsumerTopNav';
import './world-consumer-shell.css';

export default function WorldLayout({ children }) {
  return <><ConsumerTopNav/><div className="vv-world-route">{children}</div></>;
}
