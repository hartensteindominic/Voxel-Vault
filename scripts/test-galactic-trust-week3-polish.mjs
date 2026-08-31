import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enhancements = await readFile(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');
const polish = await readFile(new URL('../app/bank/week3-polish.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/bank/page.js', import.meta.url), 'utf8');
const bankClient = await readFile(new URL('../app/bank/BankClient.js', import.meta.url), 'utf8');
const cryptoPractice = await readFile(new URL('../app/bank/GalacticCryptoPractice.js', import.meta.url), 'utf8');
const a11y = await readFile(new URL('../app/bank/a11y.css', import.meta.url), 'utf8');

assert.match(enhancements, /event\.key === 'Escape'/, 'dashboard keyboard handling must include Escape');
assert.match(enhancements, /\.gt-action-sheet \.gt-sheet-header > button/, 'Escape must close the existing transfer/add-money action sheet through its close control');
assert.match(enhancements, /const activityFilters = \['All', 'Transfers', 'Cards', 'Crypto'\]/, 'Recent Activity must expose the requested four demo filters');
assert.match(enhancements, /aria-pressed=\{filter === item\}/, 'activity filter buttons must expose selected state to assistive technology');
assert.match(enhancements, /MutationObserver\(apply\)/, 'activity filtering must stay in sync when demo/sandbox rows change');
assert.match(enhancements, /No \{filter\.toLowerCase\(\)\} activity in this demo view yet\./, 'filtered empty states must remain explicitly demo-scoped');
assert.match(polish, /\.gt-activity-filter button\.active/, 'activity filters must use the existing Galactic visual language');
assert.match(polish, /@media\(max-width:620px\)/, 'mobile typography and spacing polish must include a phone breakpoint');
assert.match(polish, /env\(safe-area-inset-bottom\)/, 'mobile spacing must respect device safe areas');
assert.match(polish, /\.gt-dashboard-header h1\{font-size:23px/, 'mobile heading typography must be intentionally tightened');
assert.match(page, /import '\.\/week3-polish\.css'/, 'the dashboard must load the Week 3 polish styles');

assert.match(bankClient, /const transferReady = Boolean\(/, 'transfer form must derive a ready state before enabling submission');
assert.match(bankClient, /transferAmount <= checking/, 'transfer ready state must reject amounts above the currently loaded checking balance');
assert.match(bankClient, /disabled=\{sandboxBusy \|\| !transferReady\}/, 'transfer submit must stay disabled while invalid or while a sandbox request is running');
assert.match(bankClient, /aria-busy=\{sandboxBusy\}/, 'sandbox primary actions must expose their busy state');
assert.match(bankClient, /aria-pressed=\{blueFrozen\}/, 'quick freeze control must expose its current demo frozen state');
assert.match(bankClient, /aria-pressed=\{frozen\}/, 'card freeze controls must expose their current demo frozen state');
assert.match(bankClient, /const cryptoTradeReady = Boolean\(/, 'dashboard demo crypto must derive whether a simulated order is possible');
assert.match(bankClient, /disabled=\{!cryptoTradeReady\}/, 'dashboard demo crypto submit must be disabled for invalid or impossible simulated trades');

assert.match(cryptoPractice, /const practiceTradeReady = Boolean\(/, 'isolated crypto practice must derive a valid trade state');
assert.match(cryptoPractice, /side === 'buy' \? usd <= practiceCash : estimatedUnits <= active\.holding/, 'practice trade readiness must respect both demo cash and demo holdings');
assert.match(cryptoPractice, /disabled=\{!practiceTradeReady\}/, 'practice crypto submit must disable impossible simulated trades');
assert.match(cryptoPractice, /aria-pressed=\{side === 'buy'\}/, 'practice buy/sell toggle must expose pressed state');

assert.match(a11y, /button:disabled[^]*opacity: 0\.58/, 'disabled actions must have a visible shared disabled state');
assert.match(a11y, /button\[aria-busy="true"\][^]*cursor: progress/, 'busy sandbox actions must have a consistent progress affordance');
assert.equal(enhancements.includes('real money moved'), false, 'polish code must not introduce misleading real-money success claims');
assert.equal(bankClient.includes('real money was transferred'), false, 'action-state polish must not introduce live-money claims');

console.log('Galactic Trust Week 3 polish checks passed: action sheets support Escape, Recent Activity has demo-safe filters, responsive typography is tightened, and primary transfer/funding/freeze/crypto controls expose honest disabled, busy, or pressed states.');
