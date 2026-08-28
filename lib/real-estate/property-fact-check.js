const clean = (value) => String(value ?? '').trim();

export const PROPERTY_FACT_SOURCE_KINDS = Object.freeze({
  TITLE: 'title_record',
  JURISDICTION_GIS: 'jurisdiction_gis',
  TAX_ASSESSOR: 'tax_assessor',
  LICENSED_LISTING: 'licensed_listing',
  GLOBAL_MAP: 'global_map',
  PROVIDER_POSITION: 'provider_position',
  USER: 'user_supplied',
});

export const PROPERTY_FACT_STATUSES = Object.freeze({
  VERIFIED_AUTHORITATIVE: 'verified_authoritative',
  SOURCE_REPORTED: 'source_reported',
  REFERENCE_ONLY: 'reference_only',
  CONFLICT: 'conflict',
  MISSING: 'missing',
});

const FIELD_RULES = Object.freeze({
  parcel_id: [PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, PROPERTY_FACT_SOURCE_KINDS.TAX_ASSESSOR],
  parcel_boundary: [PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS],
  assessed_value: [PROPERTY_FACT_SOURCE_KINDS.TAX_ASSESSOR, PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS],
  title_owner: [PROPERTY_FACT_SOURCE_KINDS.TITLE],
  title_record: [PROPERTY_FACT_SOURCE_KINDS.TITLE],
  fractional_position: [PROPERTY_FACT_SOURCE_KINDS.PROVIDER_POSITION],
});

function stableValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value).trim();
}

function normalizedFact(input = {}) {
  const field = clean(input.field).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 80);
  const sourceKind = clean(input.sourceKind).toLowerCase();
  if (!field) throw new Error('Each fact requires a field name.');
  if (!Object.values(PROPERTY_FACT_SOURCE_KINDS).includes(sourceKind)) throw new Error(`Unsupported property fact source kind: ${sourceKind || 'missing'}.`);
  return {
    field,
    label: clean(input.label).slice(0, 120) || field.replace(/_/g, ' '),
    value: input.value ?? null,
    valueKey: stableValue(input.value),
    sourceKind,
    authority: clean(input.authority).slice(0, 180),
    recordId: clean(input.recordId).slice(0, 220),
    observedAt: clean(input.observedAt).slice(0, 80),
    sourceUrl: clean(input.sourceUrl).slice(0, 600),
    note: clean(input.note).slice(0, 500),
  };
}

function baseStatus(fact) {
  if (!fact.valueKey) return PROPERTY_FACT_STATUSES.MISSING;
  const authoritativeKinds = FIELD_RULES[fact.field] || [];
  if (authoritativeKinds.includes(fact.sourceKind) && fact.authority && fact.recordId && fact.observedAt) {
    return PROPERTY_FACT_STATUSES.VERIFIED_AUTHORITATIVE;
  }
  if ([
    PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS,
    PROPERTY_FACT_SOURCE_KINDS.TAX_ASSESSOR,
    PROPERTY_FACT_SOURCE_KINDS.LICENSED_LISTING,
    PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP,
    PROPERTY_FACT_SOURCE_KINDS.PROVIDER_POSITION,
    PROPERTY_FACT_SOURCE_KINDS.TITLE,
  ].includes(fact.sourceKind) && fact.authority) return PROPERTY_FACT_STATUSES.SOURCE_REPORTED;
  return PROPERTY_FACT_STATUSES.REFERENCE_ONLY;
}

export function factCheckProperty(input = {}) {
  const facts = (Array.isArray(input.facts) ? input.facts : []).slice(0, 120).map(normalizedFact);
  const groups = new Map();
  for (const fact of facts) {
    if (!groups.has(fact.field)) groups.set(fact.field, []);
    groups.get(fact.field).push(fact);
  }

  const results = [];
  for (const [field, entries] of groups) {
    const nonEmpty = entries.filter((entry) => entry.valueKey);
    const distinctValues = new Set(nonEmpty.map((entry) => entry.valueKey));
    const hasConflict = distinctValues.size > 1;
    for (const entry of entries) {
      results.push({
        ...entry,
        status: hasConflict ? PROPERTY_FACT_STATUSES.CONFLICT : baseStatus(entry),
      });
    }
  }

  const counts = Object.values(PROPERTY_FACT_STATUSES).reduce((acc, status) => {
    acc[status] = results.filter((row) => row.status === status).length;
    return acc;
  }, {});

  const warnings = [];
  if (results.some((row) => row.field === 'asking_price')) warnings.push('Asking/list price is a seller or listing-source fact, not a verified market value or guaranteed resale value.');
  if (results.some((row) => row.field === 'assessed_value')) warnings.push('Tax assessment is not treated as current market value.');
  if (results.some((row) => row.sourceKind === PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP)) warnings.push('Global-map building geometry is reference evidence; it is not a cadastral parcel boundary or title record.');
  if (results.some((row) => row.sourceKind === PROPERTY_FACT_SOURCE_KINDS.USER)) warnings.push('User-supplied facts are evidence leads only and cannot verify themselves.');

  return {
    propertyId: clean(input.propertyId).slice(0, 180),
    checkedAt: new Date().toISOString(),
    facts: results,
    counts,
    hasConflict: counts[PROPERTY_FACT_STATUSES.CONFLICT] > 0,
    authoritativeFactCount: counts[PROPERTY_FACT_STATUSES.VERIFIED_AUTHORITATIVE],
    sourceReportedFactCount: counts[PROPERTY_FACT_STATUSES.SOURCE_REPORTED],
    verdict: counts[PROPERTY_FACT_STATUSES.CONFLICT] > 0
      ? 'CONFLICT FOUND · REVIEW SOURCES'
      : counts[PROPERTY_FACT_STATUSES.VERIFIED_AUTHORITATIVE] > 0
        ? 'AUTHORITATIVE FACTS FOUND · RIGHTS STILL SEPARATE'
        : 'REFERENCE / SOURCE-REPORTED FACTS ONLY',
    legalEffects: {
      verifiesDeedOwnership: false,
      transfersTitle: false,
      createsInvestmentRights: false,
      guaranteesValueOrIncome: false,
    },
    warnings,
  };
}
