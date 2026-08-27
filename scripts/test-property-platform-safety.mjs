import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing required safety marker: ${text}`);
}

const status = read('app/api/property-platform/status/route.ts');
const deploy = read('scripts/deploy-property-pilot.js');
const token = read('contracts/PropertyInterestToken.sol');
const root = read('app/page.js');
const home = read('app/real-estate/page.js');
const vault = read('app/real-estate/property/[propertyId]/page.js');

requireText(status, 'productionInvestmentImplementationReady = false', 'property status route');
requireText(status, 'liveInvestmentCheckout: false', 'property status route');
requireText(status, 'mainnetPropertyTokenDeployment: false', 'property status route');
requireText(deploy, 'network.chainId !== 84532n', 'property deploy script');
requireText(deploy, 'Base Sepolia only', 'property deploy script');
requireText(token, 'mapping(address account => bool allowed) public isAllowed', 'interest token');
requireText(token, 'RecipientNotAllowed', 'interest token');
requireText(root, "import RealEstatePlatformPage from './real-estate/page'", 'root homepage');
requireText(home, 'Demo data only', 'property homepage');
requireText(home, 'Live investing is locked', 'property homepage');
requireText(home, '/real-estate/property/', 'property homepage');
requireText(vault, 'No investment checkout', 'property vault');
requireText(vault, 'No deed transfer occurs on-chain', 'property vault');
requireText(vault, 'Public hashes, private source documents', 'property vault');

console.log('Property-platform safety checks passed: the real-property experience is the homepage, live investing remains fail-closed and deployment is Base Sepolia-only.');
