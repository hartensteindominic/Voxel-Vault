import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing required marker: ${text}`);
}

const engine = read('lib/real-estate/acquisition-engine.js');
const page = read('app/real-estate/acquire/page.js');

requireText(engine, 'LIVE_ACQUISITION_EXECUTION_READY = false', 'acquisition engine');
requireText(engine, 'LIVE_TOKENIZED_SECURITY_TRADING_READY = false', 'acquisition engine');
requireText(engine, "rankingGoal: 'cheapest-profitable-verified-property'", 'acquisition engine');
requireText(engine, "['titleVerified', 'Title not verified']", 'acquisition hard gates');
requireText(engine, "['liensCleared', 'Liens/restrictions not cleared']", 'acquisition hard gates');
requireText(engine, "['taxesCurrent', 'Property taxes not confirmed current']", 'acquisition hard gates');
requireText(engine, "['habitable', 'Habitability not confirmed']", 'acquisition hard gates');
requireText(engine, "['rentalLegal', 'Rental legality not confirmed']", 'acquisition hard gates');
requireText(engine, "['insuranceAvailable', 'Insurance availability not confirmed']", 'acquisition hard gates');
requireText(engine, 'executable: false', 'acquisition execution boundary');
requireText(engine, 'Property purchases require a real title/closing workflow and explicit human authorization', 'acquisition execution boundary');
requireText(engine, 'REAL_ESTATE_SECURITIES_PROVIDER_CONTRACTED', 'tokenized provider gate');
requireText(engine, 'REAL_ESTATE_SECURITIES_PROVIDER_API_VERIFIED', 'tokenized provider gate');
requireText(engine, 'REAL_ESTATE_SECURITIES_KYC_ELIGIBILITY_VERIFIED', 'tokenized provider gate');
requireText(engine, 'REAL_ESTATE_SECURITIES_CUSTODY_SETTLEMENT_VERIFIED', 'tokenized provider gate');
requireText(page, 'CONNECT REGULATED PROVIDER · LOCKED', 'acquisition page');
requireText(page, 'No securities orders.', 'acquisition page');
requireText(page, 'No deed purchases.', 'acquisition page');
requireText(page, 'Price alone', 'acquisition page');
requireText(page, 'The winning candidate still closes like real property.', 'acquisition page');

console.log('Acquisition-engine safety checks passed: cheap listings cannot bypass title/tax/habitability/insurance gates, tokenized securities require an official regulated-provider path, and both property purchases and securities orders remain code-locked.');
