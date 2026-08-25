'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './VoxelPopHelpWidget.module.css';

const quickQuestions = [
  'What do I get for $1.99?',
  'What is a GLB?',
  'How does VoxelPop work?',
  'Can I use it for my business or game?',
  'I need multiple assets',
  'What if something goes wrong?'
];

const answers = {
  'What do I get for $1.99?': 'One custom 3D voxel asset after payment, including a downloadable GLB model and the source image. There is no subscription.',
  'What is a GLB?': 'A GLB is a compact 3D file format that can contain the model, materials, and related 3D data in one file. It works with many 3D tools and engines, though compatibility can vary by app.',
  'How does VoxelPop work?': 'Describe what you want, make the one-time $1.99 payment, generate the source image, build the 3D mesh, then download the GLB.',
  'Can I use it for my business or game?': 'VoxelPop gives you the downloadable asset, but commercial, licensing, refund, and ownership questions can depend on the current terms and your specific use. This helper will not invent legal or policy promises. Please verify the applicable terms before production use.',
  'I need multiple assets': 'You can create assets one at a time at $1.99 each. If you need a larger project, special licensing, or a custom business arrangement, please contact VoxelPop directly before relying on special terms.',
  'What if something goes wrong?': 'If checkout, generation, or meshing fails, keep your payment receipt or checkout information and avoid paying again until you are sure the first purchase did not complete. Policy, refund, or account-specific questions should be handled directly by VoxelPop.'
};

function answerForQuestion(question) {
  const q = question.toLowerCase();
  if (/\b(price|cost|1\.99|pay|payment|subscription)\b/.test(q)) return answers['What do I get for $1.99?'];
  if (/\b(glb|file|format|download)\b/.test(q)) return answers['What is a GLB?'];
  if (/\b(how|work|generate|mesh|3d)\b/.test(q)) return answers['How does VoxelPop work?'];
  if (/\b(business|commercial|license|licensing|game|ownership|rights|copyright)\b/.test(q)) return answers['Can I use it for my business or game?'];
  if (/\b(multiple|bulk|many|pack|project|assets)\b/.test(q)) return answers['I need multiple assets'];
  if (/\b(error|failed|fail|refund|problem|issue|charged|checkout|support|help)\b/.test(q)) return answers['What if something goes wrong?'];
  return 'I can help with pricing, what you receive, GLB files, how generation works, business-use questions, multiple assets, and troubleshooting. For licensing, refunds, ownership, or special business terms, I will not guess — please verify those directly with VoxelPop.';
}

export default function VoxelPopHelpWidget() {
  const pathname = usePathname();
  const isVoxelPopRoute = pathname === '/' || pathname?.startsWith('/studio') || pathname?.startsWith('/pack');
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can answer quick VoxelPop questions before or after you create an asset.' }
  ]);

  const placeholder = useMemo(() => 'Ask about price, GLB, business use…', []);
  if (!isVoxelPopRoute) return null;

  function ask(text) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setMessages(current => [
      ...current,
      { role: 'user', text: cleaned },
      { role: 'assistant', text: answers[cleaned] || answerForQuestion(cleaned) }
    ]);
    setQuestion('');
  }

  function submit(event) {
    event.preventDefault();
    ask(question);
  }

  return (
    <div className={styles.shell}>
      {open && (
        <section className={styles.panel} aria-label="VoxelPop help">
          <header className={styles.header}>
            <div>
              <span className={styles.spark}>✦</span>
              <div>
                <strong>VoxelPop Help</strong>
                <small>Quick answers, no guessing</small>
              </div>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close VoxelPop help">×</button>
          </header>

          <div className={styles.messages} aria-live="polite">
            {messages.map((message, index) => (
              <p key={`${message.role}-${index}`} className={message.role === 'user' ? styles.user : styles.assistant}>
                {message.text}
              </p>
            ))}
          </div>

          <div className={styles.quick}>
            {quickQuestions.map(item => (
              <button type="button" key={item} onClick={() => ask(item)}>{item}</button>
            ))}
          </div>

          <form className={styles.form} onSubmit={submit}>
            <input
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder={placeholder}
              maxLength={220}
              aria-label="Ask a VoxelPop question"
            />
            <button type="submit" disabled={!question.trim()} aria-label="Send question">→</button>
          </form>

          <p className={styles.disclaimer}>For legal, licensing, refund, ownership, or special business terms, please verify directly with VoxelPop.</p>
        </section>
      )}

      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close VoxelPop help' : 'Open VoxelPop help'}
      >
        <span>✦</span>
        <b>{open ? 'Close' : 'Questions?'}</b>
      </button>
    </div>
  );
}
