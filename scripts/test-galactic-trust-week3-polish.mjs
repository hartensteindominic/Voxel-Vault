import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enhancements = await readFile(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');
const polish = await readFile(new URL('../app/bank/week3-polish.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/bank/page.js', import.meta.url), 'utf8');

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
assert.equal(enhancements.includes('real money moved'), false, 'polish code must not introduce misleading real-money success claims');

console.log('Galactic Trust Week 3 polish checks passed: action sheets support Escape, Recent Activity has demo-safe filters, and responsive typography/spacing is intentionally tightened.');
