export const BUFFALO_PRESERVATION_READY_SURVEY_URL = 'https://www.buffalony.gov/DocumentCenter/View/9463/PreservationReadySurvey';

export const FIRST_REAL_BUFFALO_PRESERVATION_RECORD = Object.freeze({
  sbl: '111.38-3-8',
  address: '618 MAIN ST',
  alternativeAddress: '620 Main',
  propertyName: 'DICKINSON JEWELRY/MARTIN JACOBI BLDG',
  propertyDescription: 'Office bldg.',
  yearBuilt: 1919,
  architect: 'Esenwein & Johnson',
  style: 'Neoclassical',
  historicDistrictName: 'Theatre Local H.D.',
  surveyRecommendation: 'Cert Local HD (contrib.)',
  source: Object.freeze({
    authority: 'City of Buffalo Preservation Board / Preservation Ready Survey',
    sourceUrl: BUFFALO_PRESERVATION_READY_SURVEY_URL,
    evidenceKind: 'official_published_historic_inventory',
    observedAt: '2026-08-28',
  }),
  verificationEffects: Object.freeze({
    confirmsParcelSblCrossReference: true,
    confirmsHistoricBuildingIdentity: true,
    confirmsCurrentBuildingFootprint: false,
    confirmsCurrentBuildingHeight: false,
    confirmsCurrentCondition: false,
    establishesDeedOwnership: false,
    establishesTitle: false,
    createsInvestmentRights: false,
    createsBlockchainRights: false,
  }),
});

export function validateFirstRealBuffaloPreservationRecord(record = FIRST_REAL_BUFFALO_PRESERVATION_RECORD) {
  if (record.sbl !== '111.38-3-8') throw new Error('Buffalo preservation record SBL must remain 111.38-3-8.');
  if (record.address !== '618 MAIN ST') throw new Error('Buffalo preservation record address must remain 618 MAIN ST.');
  if (record.alternativeAddress !== '620 Main') throw new Error('Buffalo preservation record must preserve the 620 Main alternative address.');
  if (record.yearBuilt !== 1919) throw new Error('Buffalo preservation record year must remain the City survey value 1919.');
  if (record.propertyDescription !== 'Office bldg.') throw new Error('Buffalo preservation record use must remain the City survey value.');
  if (!record.source?.sourceUrl?.startsWith('https://www.buffalony.gov/')) throw new Error('Buffalo preservation evidence must retain the official City source URL.');
  if (record.verificationEffects?.confirmsCurrentBuildingFootprint !== false) throw new Error('Historic inventory must not self-verify a current footprint.');
  if (record.verificationEffects?.confirmsCurrentBuildingHeight !== false) throw new Error('Historic inventory must not self-verify current height.');
  if (record.verificationEffects?.establishesDeedOwnership !== false) throw new Error('Historic inventory must not establish deed ownership.');
  if (record.verificationEffects?.establishesTitle !== false) throw new Error('Historic inventory must not establish title.');
  return record;
}
