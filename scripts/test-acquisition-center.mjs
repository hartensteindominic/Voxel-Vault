import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acquisitionPolicy } from '../lib/real-estate/acquisition-engine.js';
import {
  buildAcquisitionResearchManifest,
  summarizeAcquisitionResearch,
} from '../lib/vault/acquisition-center.js';

const candidates = buildAcquisitionResearchManifest();
const summary = summarizeAcquisitionResearch(candidates);

assert.equal(candidates.length, 3, 'the spatial research demo should expose the three controlled acquisition examples');
assert.equal(candidates.every((candidate) => candidate.executionAllowed === false), true, 'no ranked candidate may become executable');
assert.equal(candidates.every((candidate) => /not an authorization to purchase/i.test(candidate.note)), true, 'every spatial candidate must preserve the research-only truth label');
assert.equal(candidates[0].status, 'review-ready', 'the fully checked low-cost demo should rank for human review');
assert.equal(candidates.some((candidate) => candidate.status === 'diligence'), true, 'incomplete diligence must remain visually distinct');
assert.equal(candidates.some((candidate) => candidate.status === 'reject'), true, 'hard-stop candidates must remain visible as rejected');

const cheapReject = candidates.find((candidate) => candidate.id === 'CANDIDATE-002');
assert.ok(cheapReject, 'the ultra-cheap distressed demo should remain in the research set');
assert.equal(cheapReject.status, 'reject', 'cheap listing price must not override title/liens/tax/habitability/insurance hard stops');
assert.ok(cheapReject.failedHardGates.length >= 5, 'the distressed demo should surface its multiple hard stops');
assert.notEqual(candidates[0].id, cheapReject.id, 'the cheapest listing must not automatically win the research ranking');

assert.equal(summary.total, 3);
assert.equal(summary.reviewEligible, 2, 'review-ready and diligence-open candidates can be eligible for human review without being executable');
assert.equal(summary.rejected, 1);
assert.equal(summary.diligenceOpen, 1);
assert.equal(summary.executable, 0);
assert.equal(summary.livePropertyExecutionReady, false);
assert.equal(acquisitionPolicy.livePropertyExecutionReady, false, 'live property execution must remain code-locked');

const page = readFileSync(new URL('../app/vault/acquisitions/page.js', import.meta.url), 'utf8');
assert.match(page, /DEMO RESEARCH/, 'spatial candidates must be visibly identified as demo research');
assert.match(page, /No “Buy Property” action exists here/, 'the execution gate must be explicit in the UI');
assert.match(page, /No unattended spending/, 'unattended spending must remain explicitly prohibited');
assert.match(page, /No deed transfer onchain/, 'the research room must not imply blockchain replaces closing/title');
assert.match(page, /Open full analysis/, 'the spatial room should link back to the detailed acquisition analysis instead of adding execution');
assert.doesNotMatch(page, /onClick=/, 'the server-rendered Acquisition Center page must not add a purchase/action click handler');
assert.doesNotMatch(page, /fetch\(/, 'the Acquisition Center page must not introduce a hidden execution API call');

const nav = readFileSync(new URL('../app/vault/VaultPortalNav.js', import.meta.url), 'utf8');
assert.match(nav, /\/vault\/acquisitions/, 'the persistent spatial navigation must expose the Acquisition Center');

console.log('Acquisition Center checks passed: ranking stays research-only, hard stops outrank cheap price, execution remains zero, and the spatial room contains no purchase/spending API path.');
