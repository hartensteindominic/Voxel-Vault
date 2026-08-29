import ProductTopNav from '../../components/ProductTopNav';
import BankNav from '../BankNav';
import styles from '../section.module.css';

const bills=[['Cloud Compute','$32.00','Sep 2'],['Property Tools','$18.99','Sep 5'],['Voxel Storage','$9.00','Sep 11'],['Creator Suite','$24.00','Sep 18']];
export default function BillsPage(){return <main className={styles.page}><ProductTopNav/><div className={styles.shell}><BankNav/>
<section className={styles.hero}><span className={styles.eyebrow}>BILLS · SANDBOX</span><h1>See what is coming before it hits.</h1><p>A clean command center for recurring expenses, subscriptions and future bill-pay automation.</p></section>
<section className={styles.grid}>
<article className={`${styles.panel} ${styles.big}`}><h2>Upcoming demo bills</h2>{bills.map(([name,amount,date])=><div className={styles.row} key={name}><div><strong>{name}</strong><span>Due {date}</span></div><b>{amount}</b></div>)}</article>
<article className={`${styles.panel} ${styles.coral}`}><span className={styles.eyebrow}>NEXT 30 DAYS</span><div className={styles.metric}>$83.99</div><p>Four recurring demo charges detected.</p></article>
<article className={`${styles.panel} ${styles.lime}`}><h2>Autopay</h2><p>Prototype status for bills that could later be routed through verified payment rails.</p><div className={styles.row}><div><strong>Autopay coverage</strong><span>Sandbox</span></div><span className={styles.pill}>3 OF 4</span></div></article>
<article className={`${styles.panel} ${styles.purple}`}><h2>Subscription radar</h2><p>Surface repeating charges, price changes and forgotten subscriptions in one place.</p><div className={styles.row}><div><strong>Potential save</strong><span>Demo insight</span></div><b>$18.99/mo</b></div></article>
<article className={`${styles.panel} ${styles.dark}`}><h2>Bill pay provider</h2><p>Real bill payment requires verified payees, payment rails, authorization controls and provider-confirmed settlement.</p></article>
</section><div className={styles.footer}>Bills and amounts shown are fictional examples. Galactic Trust is not currently sending payments.</div></div></main>}