import fs from 'node:fs';
import assert from 'node:assert/strict';

const nav = fs.readFileSync(new URL('../app/components/FinancialOSNav.js', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
const vaultLayout = fs.readFileSync(new URL('../app/vault/layout.js', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');

for (const label of ['Home', 'Explore', 'Invest', 'Vault', 'Income']) {
  assert.match(nav, new RegExp(`label: '${label}'`), `financial navigation should include ${label}`);
}

assert.match(nav, /FINANCIAL_PREFIXES/);
assert.match(nav, /\/geo/);
assert.match(nav, /\/real-estate\/reits/);
assert.match(nav, /\/vault\/income/);
assert.match(nav, /if \(!financialRoute\) return null/);
assert.match(nav, /safe-area-inset-bottom/);
assert.match(layout, /FinancialOSNav/);
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);

assert.match(home, /Explore → invest → verify → observe → own/);
assert.match(home, /Your money,/);
assert.match(home, /provider-backed investment assets/i);
assert.match(home, /observed income/i);
assert.match(home, /recorded title/i);
assert.match(home, /Provider-gated/i);
assert.match(home, /Live investing is locked/);
assert.match(home, /Demo data only/);
assert.match(home, /Direct property closes through normal title systems/);
assert.match(home, /Every number should know where it came from/);
assert.match(home, /Start with access\. Build toward ownership\./);
assert.match(home, /Fail-closed for real money/);

assert.doesNotMatch(home, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(home, /token is (?:the )?deed|blockchain deed/i);

console.log('Financial OS coherence regression tests passed');
