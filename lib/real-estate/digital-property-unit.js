export const DIGITAL_PROPERTY_BASELINE_CENTS = 199;

function finitePositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function quoteDigitalPropertyUnit({
  referencePropertyValue,
  propertyValue,
  baselineCents = DIGITAL_PROPERTY_BASELINE_CENTS,
} = {}) {
  const reference = finitePositive(referencePropertyValue);
  const property = finitePositive(propertyValue);
  const baseline = finitePositive(baselineCents);

  if (!reference || !property || !baseline) {
    return {
      ready: false,
      priceCents: null,
      ratio: null,
      baselineCents: baseline || DIGITAL_PROPERTY_BASELINE_CENTS,
      reason: 'A positive reference property value and selected property value are required.',
    };
  }

  const ratio = property / reference;
  const priceCents = Math.max(1, Math.round(baseline * ratio));

  return {
    ready: true,
    priceCents,
    ratio,
    baselineCents: baseline,
    reason: null,
  };
}

export function explainDigitalPropertyQuote(quote) {
  if (!quote?.ready) return 'Pricing unavailable.';
  const ratio = Number(quote.ratio || 0);
  if (Math.abs(ratio - 1) < 0.005) return 'About the same reference value as your anchor property.';
  return `${ratio.toFixed(2)}x the reference property value.`;
}
