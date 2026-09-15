'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './orxyz.module.css';

const emailAddress = 'orxyzpartners@gmail.com';
const phone = '+1 716 359 3694';

const rfqText = `Product / part number:
Specification or drawing:
Quantity:
Delivery city / country:
Required-by date:
Current quote or target landed price:
Required certifications / documents:
Acceptable equivalents? Yes / No
Anything that must not change:`;

const checklistText = `ORXYZ RFQ CHECKLIST\n\n${rfqText}\n\nSend to: ${emailAddress}\nWebsite: orxyz.xyz\n`;

const process = [
  ['01', 'You send the exact requirement', 'Specification, quantity, destination, timing, and—if available—the deal you want improved.'],
  ['02', 'ORXYZ benchmarks the route', 'Price, freight, MOQ, lead time, documents, warranty, and repeat-order economics.'],
  ['03', 'You receive one clear offer', 'Commercial terms from ORXYZ, with direct fulfillment coordinated where appropriate.'],
];

const buyerChecklist = [
  'One contact for the commercial process',
  'Like-for-like cost and delivery comparison',
  'Manufacturer-direct fulfillment where appropriate',
  'Documents and compliance needs identified up front',
  'A repeatable route for the next order',
];

const supplierChecklist = [
  'Clear specification, quantity, destination, and timing',
  'Fast requests for net pricing and validity',
  'Direct or blind-shipment coordination',
  'Named-account and non-circumvention discipline',
  'Repeat-order terms captured from the first transaction',
];

const categories = [
  ['Valves & flow control', 'Industrial, sanitary, hydraulic, process, and project-specified requirements.'],
  ['Fasteners', 'Bolts, nuts, washers, nails, threaded products, and exact drawing-based items.'],
  ['Bearings & seals', 'Standard and custom bearings, housings, O-rings, washers, and molded rubber.'],
  ['MRO & components', 'Problem SKUs, spares, filters, fittings, and recurring maintenance requirements.'],
  ['Containers & equipment', 'Commercial container requirements and supplier-direct equipment sourcing.'],
  ['Recurring consumables', 'Packaging, adhesives, lubricants, protective materials, and repeat-use supplies.'],
];

const faqs = [
  ['Does ORXYZ keep inventory?', 'No. ORXYZ is a non-stocking sourcing and distribution business. Qualified suppliers can ship directly to the buyer when the transaction supports it.'],
  ['Does ORXYZ guarantee a lower price?', 'No. ORXYZ guarantees a disciplined like-for-like comparison and negotiation process. If the current deal cannot be improved compliantly, the buyer is under no obligation to purchase through ORXYZ.'],
  ['How does payment work?', 'For principal-resale orders, the buyer pays ORXYZ under the accepted commercial terms. ORXYZ places the supplier order only after the agreed buyer-payment condition is satisfied. Transaction-specific terms are confirmed in writing before payment.'],
  ['Can ORXYZ handle a full BOM?', 'Yes. A buyer can send one part, a material list, or a complete BOM. ORXYZ will structure the requirement and identify which lines are ready to quote and which need clarification.'],
  ['What happens after the first order?', 'ORXYZ records the approved specification, commercial history, delivery route, and repeat-order conditions so the next requirement can be handled faster and with less friction.'],
];

type ContactType = 'buyer' | 'supplier';

const contactOptions = {
  buyer: {
    title: 'Start an RFQ',
    subject: 'RFQ for ORXYZ',
    intro: 'Copy the brief, add your details, and send it to ORXYZ. You can also try opening your email app.',
    message: rfqText,
  },
  supplier: {
    title: 'Introduce your product line',
    subject: 'Manufacturer introduction for ORXYZ',
    intro: 'Copy the introduction, add your company details, and send it to ORXYZ. You can also try opening your email app.',
    message: `Company:\nProduct categories:\nCertifications:\nExport markets:\nTypical MOQ:\nStandard lead time:\nIncoterms supported:\nWebsite:`,
  },
} as const;

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export default function Home() {
  const [copyStatus, setCopyStatus] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [modalStatus, setModalStatus] = useState('');

  const contact = contactType ? contactOptions[contactType] : null;
  const mailHref = useMemo(() => {
    if (!contact) return `mailto:${emailAddress}`;
    return `mailto:${emailAddress}?subject=${encodeURIComponent(contact.subject)}&body=${encodeURIComponent(contact.message)}`;
  }, [contact]);

  useEffect(() => {
    if (!contactType) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContactType(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [contactType]);

  const temporary = (setter: (value: string) => void, value: string) => {
    setter(value);
    window.setTimeout(() => setter(''), 3200);
  };

  const handleCopyBrief = async () => {
    try {
      await copyText(rfqText);
      temporary(setCopyStatus, 'RFQ brief copied.');
    } catch {
      temporary(setCopyStatus, 'Copy is unavailable here. Select the brief above to copy it.');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([checklistText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ORXYZ-RFQ-checklist.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDownloadStatus('Checklist download started.');
    } catch {
      setDownloadStatus('Download is unavailable in this browser.');
    }
  };

  const openContact = (type: ContactType) => {
    setModalStatus('');
    setContactType(type);
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <p className={styles.label}>Industrial procurement, simplified</p>
            <h1>Send the requirement.<br /><span>Get one clear offer.</span></h1>
            <p className={styles.lead}>ORXYZ turns a BOM, drawing, current quote, or problem SKU into a manufacturer-direct commercial offer—benchmarked across price, freight, lead time, documentation, and repeat-order terms.</p>
            <div className={styles.heroActions}>
              <button className={styles.button} type="button" onClick={() => openContact('buyer')}>Email an RFQ <span className={styles.arrow}>→</span></button>
              <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={handleDownload}>Download the checklist</button>
              <div className={styles.actionStatus} aria-live="polite">
                <span>{downloadStatus}</span>
                {downloadStatus && <button className={styles.inlineAction} type="button" onClick={async () => {
                  try { await copyText(checklistText); setDownloadStatus('Checklist copied.'); }
                  catch { setDownloadStatus('Copy is unavailable here. Use the copy-ready brief below.'); }
                }}>Copy it instead</button>}
              </div>
            </div>
          </div>
          <aside className={styles.processCard} aria-label="How ORXYZ works">
            <p className={styles.label}>One commercial path</p>
            <ol className={styles.processList}>
              {process.map(([step, title, body]) => (
                <li key={step}><span className={styles.step}>{step}</span><div><strong>{title}</strong><span>{body}</span></div></li>
              ))}
            </ol>
          </aside>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.promise}>
            <div className={styles.promiseCopy}>
              <p className={styles.label}>The Beat-the-Quote Promise</p>
              <blockquote>Before you place the order, give ORXYZ one chance to improve the deal.</blockquote>
              <p>Send the exact specification, quantity, destination, and your current supplier quote or target landed price. ORXYZ will benchmark and negotiate qualified like-for-like routes. If we cannot produce a better compliant offer, you are under no obligation to buy through ORXYZ.</p>
            </div>
            <div className={styles.promiseSide}>
              <strong>More than price.</strong>
              <p>We can improve freight, MOQ, lead time, documentation, payment structure, warranty, or repeat-order pricing—even when the unit price is already sharp.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="ways-to-work">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div><p className={styles.label}>Two ways to work together</p><h2>Less friction on both sides.</h2></div>
            <p className={styles.sectionIntro}>Buyers get a single accountable commercial contact. Qualified manufacturers get exact, funded demand—not vague fishing expeditions.</p>
          </div>
          <div className={styles.tracks}>
            <article className={`${styles.track} ${styles.buyer}`}>
              <p className={styles.label}>For buyers</p>
              <h3>Send one complete request.</h3>
              <p>One SKU or a full BOM. ORXYZ structures the requirement, compares the real commercial levers, and returns a clear offer.</p>
              <ul className={styles.checklist}>{buyerChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
              <button className={styles.button} type="button" onClick={() => openContact('buyer')}>Send a requirement <span className={styles.arrow}>→</span></button>
            </article>
            <article className={`${styles.track} ${styles.supplier}`}>
              <p className={styles.label}>For manufacturers</p>
              <h3>Receive executable demand.</h3>
              <p>ORXYZ brings exact requirements and places supply-side work only when the buyer has accepted the commercial path and the payment gate is satisfied.</p>
              <ul className={styles.checklist}>{supplierChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
              <button className={styles.button} type="button" onClick={() => openContact('supplier')}>Introduce your product line <span className={styles.arrow}>→</span></button>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.section} id="rfq-brief">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div><p className={styles.label}>The fastest route to a quote</p><h2>Send the six facts that matter.</h2></div>
            <p className={styles.sectionIntro}>Complete information shortens the cycle. Paste this brief into an email, attach the drawing or BOM, and ORXYZ can start with the right commercial question.</p>
          </div>
          <div className={styles.rfqLayout}>
            <article className={styles.brief}>
              <h3>What to include</h3>
              <p>A useful request does not need to be polished. It does need to be exact.</p>
              <ol>
                <li>Product, part number, or description</li><li>Specification, drawing, or acceptable equivalent rule</li><li>Quantity and expected reorder cadence</li><li>Delivery city and country</li><li>Required-by date</li><li>Current quote, target landed price, or the commercial problem to improve</li>
              </ol>
            </article>
            <article className={styles.templateBox}>
              <div className={styles.templateHead}><strong>Copy-ready RFQ brief</strong><button className={`${styles.button} ${styles.secondary} ${styles.small}`} type="button" onClick={handleCopyBrief}>Copy brief</button></div>
              <pre>{rfqText}</pre>
              <div className={styles.status} aria-live="polite">{copyStatus}</div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div><p className={styles.label}>Current sourcing scope</p><h2>Built for practical industrial demand.</h2></div>
            <p className={styles.sectionIntro}>ORXYZ is category-flexible, but strongest where exact specifications, recurring consumption, and supplier-direct fulfillment create measurable commercial value.</p>
          </div>
          <div className={styles.categories}>{categories.map(([title, body]) => <div className={styles.category} key={title}><b>{title}</b><span>{body}</span></div>)}</div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div><p className={styles.label}>Common questions</p><h2>Clear before the first order.</h2></div>
            <div className={styles.faq}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
          </div>
        </div>
      </section>

      <footer className={styles.closing}>
        <div className={`${styles.wrap} ${styles.closingGrid}`}>
          <div><p className={styles.label}>Ready when the requirement is real</p><h2>Send the BOM. Keep your current supplier if ORXYZ cannot improve the deal.</h2><p>No vague discovery call is required. Start with the product, quantity, destination, and commercial target.</p></div>
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={() => openContact('buyer')}>Start an RFQ <span className={styles.arrow}>→</span></button>
            <a className={`${styles.button} ${styles.secondary}`} href="https://orxyz.xyz" target="_blank" rel="noopener noreferrer">Visit ORXYZ.xyz</a>
            <div className={styles.contactLine}>{emailAddress} · {phone}</div>
          </div>
        </div>
      </footer>

      {contact && (
        <div className={styles.contactModal} role="presentation">
          <button className={styles.modalBackdrop} aria-label="Close contact options" onClick={() => setContactType(null)} />
          <section className={styles.contactPanel} role="dialog" aria-modal="true" aria-labelledby="contactTitle">
            <button className={styles.modalClose} type="button" onClick={() => setContactType(null)} aria-label="Close contact options">×</button>
            <p className={styles.label}>Written inquiries</p>
            <h2 id="contactTitle">{contact.title}</h2>
            <p>{contact.intro}</p>
            <div className={styles.contactEmail}><strong>{emailAddress}</strong><button className={`${styles.button} ${styles.secondary} ${styles.small}`} type="button" onClick={async () => {
              try { await copyText(emailAddress); temporary(setModalStatus, 'Email address copied.'); }
              catch { temporary(setModalStatus, 'Copy is unavailable. Select the email address above.'); }
            }}>Copy email</button></div>
            <textarea className={styles.contactMessage} readOnly value={contact.message} aria-label="Copy-ready email message" />
            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={async () => {
                try { await copyText(contact.message); temporary(setModalStatus, 'Message copied.'); }
                catch { temporary(setModalStatus, 'Copy is unavailable. Select the message to copy it.'); }
              }}>Copy message</button>
              <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={async () => {
                try { await copyText(`To: ${emailAddress}\n\n${contact.message}`); temporary(setModalStatus, 'Email address and message copied.'); }
                catch { temporary(setModalStatus, 'Copy is unavailable. Send the message to the address above.'); }
              }}>Copy email + message</button>
              <a className={`${styles.button} ${styles.secondary}`} href={mailHref} onClick={() => temporary(setModalStatus, 'If no email app opens, use the copy buttons instead.')}>Open email app</a>
            </div>
            <div className={styles.modalStatus} aria-live="polite">{modalStatus}</div>
          </section>
        </div>
      )}
    </main>
  );
}
