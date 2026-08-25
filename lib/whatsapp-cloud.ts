import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeControlPhone } from './voxelflip-control-actions';

const HTTP_TIMEOUT_MS = 10_000;

export function whatsappCloudConfig() {
  return {
    graphVersion: String(process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0').trim(),
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    appSecret: String(process.env.WHATSAPP_APP_SECRET || '').trim(),
    verifyToken: String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim(),
    approverNumber: normalizeControlPhone(process.env.WHATSAPP_APPROVER_NUMBER),
    revenueTemplate: String(process.env.WHATSAPP_REVENUE_TEMPLATE_NAME || '').trim(),
    approvalTemplate: String(process.env.WHATSAPP_APPROVAL_TEMPLATE_NAME || '').trim(),
    language: String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US').trim() || 'en_US',
  };
}

export function whatsappCloudReadiness() {
  const config = whatsappCloudConfig();
  return {
    graphVersion: config.graphVersion,
    phoneNumberId: Boolean(config.phoneNumberId),
    accessToken: Boolean(config.accessToken),
    appSecret: Boolean(config.appSecret),
    verifyToken: Boolean(config.verifyToken),
    approverNumber: Boolean(config.approverNumber),
    revenueTemplate: Boolean(config.revenueTemplate),
    approvalTemplate: Boolean(config.approvalTemplate),
    outboundReady: Boolean(config.phoneNumberId && config.accessToken && config.approverNumber),
    webhookReady: Boolean(config.appSecret && config.verifyToken && config.approverNumber),
  };
}

export function whatsappWebhookSignatureValid(rawBody: string, header: string | null) {
  const { appSecret } = whatsappCloudConfig();
  if (!appSecret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function whatsappSenderAuthorized(sender: string) {
  const configured = whatsappCloudConfig().approverNumber;
  const actual = normalizeControlPhone(sender);
  return Boolean(configured && actual && configured === actual);
}

async function postMessage(body: any) {
  const config = whatsappCloudConfig();
  if (!config.phoneNumberId || !config.accessToken) throw new Error('WhatsApp Cloud API sender credentials are not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload?.error?.message || payload?.error || `WhatsApp Cloud API ${response.status}`));
    return {
      messageId: String(payload?.messages?.[0]?.id || ''),
      payload,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('WhatsApp Cloud API request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendWhatsAppTemplate(input: {
  to?: string;
  name: string;
  bodyParameters?: string[];
  quickReplyPayloads?: string[];
}) {
  const config = whatsappCloudConfig();
  const to = normalizeControlPhone(input.to || config.approverNumber);
  if (!to) throw new Error('WhatsApp approver number is not configured.');
  if (!input.name.trim()) throw new Error('WhatsApp template name is not configured.');
  const components: any[] = [];
  if (input.bodyParameters?.length) {
    components.push({
      type: 'body',
      parameters: input.bodyParameters.map(text => ({ type: 'text', text: String(text).slice(0, 1000) })),
    });
  }
  for (const [index, payload] of (input.quickReplyPayloads || []).entries()) {
    components.push({
      type: 'button',
      sub_type: 'quick_reply',
      index: String(index),
      parameters: [{ type: 'payload', payload: String(payload).slice(0, 256) }],
    });
  }
  return postMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: input.name.trim(),
      language: { code: config.language },
      ...(components.length ? { components } : {}),
    },
  });
}

export async function sendWhatsAppText(to: string, text: string) {
  const recipient = normalizeControlPhone(to);
  if (!recipient) throw new Error('WhatsApp recipient is invalid.');
  return postMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { body: String(text).slice(0, 4000), preview_url: false },
  });
}

export async function sendRevenueStartedWhatsApp(realizedProfitEth: number) {
  const config = whatsappCloudConfig();
  if (!config.revenueTemplate) throw new Error('WHATSAPP_REVENUE_TEMPLATE_NAME is not configured.');
  return sendWhatsAppTemplate({
    name: config.revenueTemplate,
    bodyParameters: [Number(realizedProfitEth).toFixed(6)],
  });
}

export async function sendApprovalWhatsApp(input: {
  actionId: string;
  actionLabel: string;
  limitEth: number;
  riskLabel?: string;
}) {
  const config = whatsappCloudConfig();
  if (!config.approvalTemplate) throw new Error('WHATSAPP_APPROVAL_TEMPLATE_NAME is not configured.');
  return sendWhatsAppTemplate({
    name: config.approvalTemplate,
    bodyParameters: [input.actionLabel.slice(0, 100), Number(input.limitEth).toFixed(6), String(input.riskLabel || 'CONTROLLED').slice(0, 100)],
    quickReplyPayloads: [`approve:${input.actionId}`, `skip:${input.actionId}`],
  });
}
