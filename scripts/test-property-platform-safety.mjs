import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing required safety marker: ${text}`);
}

const status = read('app/api/property-platform/status/route.ts');
const launch = read('lib/real-estate/legal-launch.js');
const launchPage = read('app/real-estate/launch/page.js');
const deploy = read('scripts/deploy-property-pilot.js');
const token = read('contracts/PropertyInterestToken.sol');
const passport = read('contracts/PropertyPassport.sol');
const distribution = read('contracts/PropertyDistributionVault.sol');
const root = read('app/page.js');
const home = read('app/real-estate/page.js');
const vault = read('app/real-estate/property/[propertyId]/page.js');
const invest = read('app/real-estate/invest/page.js');
const wallet = read('app/real-estate/invest/AutoCompoundWallet.js');

requireText(launch, 'LIVE_INVESTMENT_IMPLEMENTATION_READY = false', 'legal launch engine');
requireText(launch, 'LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY = false', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_OFFERING_AUTHORIZED', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED', 'legal launch engine');
requireText(launch, 'Regulation Crowdfunding through a registered intermediary', 'legal launch engine');
requireText(status, 'liveInvestmentCheckout: false', 'property status route');
requireText(status, 'liveAutomaticReinvestment: false', 'property status route');
requireText(status, 'mainnetPropertyTokenDeployment: false', 'property status route');
requireText(status, 'evaluateLegalLaunch(process.env)', 'property status route');
requireText(deploy, 'network.chainId !== 84532n', 'property deploy script');
requireText(deploy, 'Base Sepolia only', 'property deploy script');
requireText(deploy, 'PROPERTY_PASSPORT_ADDRESS', 'property deploy script');
requireText(deploy, 'Property Passport is NOT minted at deployment', 'property deploy script');
requireText(token, 'mapping(address account => bool allowed) public isAllowed', 'interest token');
requireText(token, 'RecipientNotAllowed', 'interest token');
requireText(passport, 'NOT the deed and NOT the investment security', 'property passport');
requireText(passport, 'PropertyNotVerified', 'property passport');
requireText(passport, 'PassportNonTransferable', 'property passport');
requireText(passport, 'propertyRegistry.getProperty(propertyId)', 'property passport');
requireText(distribution, 'ClaimantNotAllowed', 'distribution vault');
requireText(distribution, 'interestToken.isAllowed(msg.sender)', 'distribution vault');
requireText(distribution, 'InvalidStatementHash', 'distribution vault');
requireText(root, "import RealEstatePlatformPage from './real-estate/page'", 'root homepage');
requireText(home, 'Demo data only', 'property homepage');
requireText(home, 'Live investing is locked', 'property homepage');
requireText(home, '/real-estate/property/', 'property homepage');
requireText(vault, 'No investment checkout', 'property vault');
requireText(vault, 'No deed transfer occurs on-chain', 'property vault');
requireText(vault, 'Public hashes, private source documents', 'property vault');
requireText(invest, '/real-estate/launch', 'investment wallet page');
requireText(invest, 'registered intermediary', 'investment wallet page');
requireText(wallet, 'LIVE INVEST · LOCKED', 'auto-compound wallet');
requireText(wallet, 'LIVE AUTO-REINVEST · LOCKED', 'auto-compound wallet');
requireText(wallet, 'Confirm each', 'auto-compound wallet');
requireText(launchPage, 'Regulation Crowdfunding + registered partner', 'legal launch page');
requireText(launchPage, 'REAL-MONEY EXECUTION · LOCKED', 'legal launch page');
requireText(launchPage, 'One real property. One real closing. One reconciled rent distribution.', 'legal launch page');

console.log('Property-platform safety checks passed: regulated launch gates are explicit, the verified Property Passport cannot be used as a transferable deed proxy, live investing and auto-reinvestment remain fail-closed, distribution claims remain permissioned, and property deployment is Base Sepolia-only.');
