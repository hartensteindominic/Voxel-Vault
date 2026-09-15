// @ts-nocheck

export function enhanceOrxyz() {
  const root = document.querySelector('[data-orxyz-root]');
  if (!root || root.dataset.enhanced === 'true') return;
  root.dataset.enhanced = 'true';

  const emailAddress = 'orxyzpartners@gmail.com';
  const rfqText = document.getElementById('rfqText').textContent.trim();
  const checklistText = `ORXYZ RFQ CHECKLIST\n\n${rfqText}\n\nSend to: ${emailAddress}\nWebsite: orxyz.xyz\n`;
  const copyStatus = document.querySelector('[data-copy-status]');
  const downloadMessage = document.querySelector('[data-download-message]');
  const copyChecklistButton = document.querySelector('[data-copy-checklist]');
  const modal = document.querySelector('[data-contact-modal]');
  const panel = modal.querySelector('.contact-panel');
  const modalTitle = modal.querySelector('#contactTitle');
  const modalIntro = modal.querySelector('[data-contact-intro]');
  const modalMessage = modal.querySelector('[data-contact-message]');
  const modalStatus = modal.querySelector('[data-modal-status]');
  const mailLink = modal.querySelector('[data-open-mail]');
  let previousFocus = null;

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
  };

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Copy command was unavailable');
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        fallbackCopy(text);
        return;
      }
    }
    fallbackCopy(text);
  }

  function showTemporaryStatus(element, message) {
    element.textContent = message;
    window.clearTimeout(element._clearTimer);
    element._clearTimer = window.setTimeout(() => {
      element.textContent = '';
    }, 3200);
  }

  async function copyBrief() {
    try {
      await copyText(rfqText);
      showTemporaryStatus(copyStatus, 'RFQ brief copied.');
    } catch {
      showTemporaryStatus(copyStatus, 'Copy is unavailable here. Select the brief above to copy it.');
    }
  }

  function downloadChecklist() {
    try {
      const blob = new Blob([checklistText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ORXYZ-RFQ-checklist.txt';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      downloadMessage.textContent = 'Checklist download started.';
    } catch {
      downloadMessage.textContent = 'Download is unavailable in this browser.';
    }
    copyChecklistButton.hidden = false;
  }

  async function copyChecklist() {
    try {
      await copyText(checklistText);
      downloadMessage.textContent = 'Checklist copied.';
      copyChecklistButton.hidden = true;
    } catch {
      downloadMessage.textContent = 'Copy is unavailable here. Use the copy-ready brief below.';
    }
  }

  function openContact(type) {
    const option = contactOptions[type] || contactOptions.buyer;
    previousFocus = document.activeElement;
    modalTitle.textContent = option.title;
    modalIntro.textContent = option.intro;
    modalMessage.value = option.message;
    modalStatus.textContent = '';
    mailLink.href = `mailto:${emailAddress}?subject=${encodeURIComponent(option.subject)}&body=${encodeURIComponent(option.message)}`;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => panel.focus());
  }

  function closeContact() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  document.querySelector('[data-copy]').addEventListener('click', copyBrief);
  document.querySelector('[data-download]').addEventListener('click', downloadChecklist);
  copyChecklistButton.addEventListener('click', copyChecklist);

  document.querySelectorAll('[data-contact]').forEach((button) => {
    button.addEventListener('click', () => openContact(button.dataset.contact));
  });
  modal.querySelectorAll('[data-modal-close]').forEach((control) => control.addEventListener('click', closeContact));
  modal.querySelector('[data-copy-email]').addEventListener('click', async () => {
    try {
      await copyText(emailAddress);
      showTemporaryStatus(modalStatus, 'Email address copied.');
    } catch {
      showTemporaryStatus(modalStatus, 'Copy is unavailable. Select the email address above.');
    }
  });
  modal.querySelector('[data-copy-message]').addEventListener('click', async () => {
    try {
      await copyText(modalMessage.value);
      showTemporaryStatus(modalStatus, 'Message copied.');
    } catch {
      modalMessage.focus();
      modalMessage.select();
      showTemporaryStatus(modalStatus, 'Message selected. Use your device copy command.');
    }
  });
  modal.querySelector('[data-copy-all]').addEventListener('click', async () => {
    try {
      await copyText(`To: ${emailAddress}\n\n${modalMessage.value}`);
      showTemporaryStatus(modalStatus, 'Email address and message copied.');
    } catch {
      modalMessage.focus();
      modalMessage.select();
      showTemporaryStatus(modalStatus, 'Message selected. Use your device copy command, then send it to the address above.');
    }
  });
  mailLink.addEventListener('click', () => {
    showTemporaryStatus(modalStatus, 'If no email app opens, use the copy buttons instead.');
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeContact();
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button, a[href], textarea')].filter((item) => !item.hidden);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
