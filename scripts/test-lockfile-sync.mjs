import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const root = lock?.packages?.[''];

if (!root) throw new Error('package-lock.json is missing its root package record.');
if (lock.lockfileVersion !== 3) throw new Error(`Expected lockfileVersion 3, received ${lock.lockfileVersion}.`);
if (root.name !== pkg.name) throw new Error(`Package name mismatch: package.json=${pkg.name} package-lock.json=${root.name}.`);
if (root.version !== pkg.version || lock.version !== pkg.version) {
  throw new Error(`Package version mismatch: package.json=${pkg.version} package-lock.json=${lock.version}/${root.version}.`);
}

function stableEntries(value = {}) {
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
}

function assertMap(label, expected = {}, actual = {}) {
  const expectedEntries = stableEntries(expected);
  const actualEntries = stableEntries(actual);
  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    const expectedNames = expectedEntries.map(([name]) => name).join(', ');
    const actualNames = actualEntries.map(([name]) => name).join(', ');
    throw new Error(`${label} mismatch. package.json=[${expectedNames}] package-lock.json=[${actualNames}]`);
  }
}

assertMap('dependencies', pkg.dependencies, root.dependencies);
assertMap('devDependencies', pkg.devDependencies, root.devDependencies);
assertMap('optionalDependencies', pkg.optionalDependencies, root.optionalDependencies);

for (const name of [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]) {
  const key = `node_modules/${name}`;
  if (!lock.packages[key]) throw new Error(`Direct dependency is not locked: ${name}`);
}

console.log(`Lockfile sync passed for ${pkg.name}@${pkg.version}: ${Object.keys(pkg.dependencies || {}).length} dependencies and ${Object.keys(pkg.devDependencies || {}).length} devDependencies are locked.`);
