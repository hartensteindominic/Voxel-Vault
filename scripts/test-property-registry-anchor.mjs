import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = fs.readFileSync(new URL('../contracts/CanonicalPropertyRegistry.sol', import.meta.url), 'utf8');
assert.match(contract, /contract CanonicalPropertyRegistry is Ownable/);
assert.match(contract, /function registerIdentity\(/);
assert.match(contract, /verified: false/);
assert.match(contract, /function setVerified\(/);
assert.match(contract, /onlyOwner/);
assert.doesNotMatch(contract, /function\s+mint/i, 'Identity registry must not mint any token.');
assert.doesNotMatch(contract, /interestToken/i, 'Identity registry must not require an investment-interest token.');
assert.doesNotMatch(contract, /function\s+distribut/i, 'Identity registry must not distribute income.');

const deploy = fs.readFileSync(new URL('../scripts/deploy-canonical-property-registry.js', import.meta.url), 'utf8');
assert.match(deploy, /network\.chainId !== 84532n/);
assert.match(deploy, /Base Sepolia only/i);
assert.doesNotMatch(deploy, /registerIdentity\s*\(/, 'Deployment must not register any property automatically.');
assert.doesNotMatch(deploy, /setVerified\s*\(/, 'Deployment must not verify any property automatically.');

const migration = fs.readFileSync(new URL('../supabase/migrations/019_property_registry_anchor_audit.sql', import.meta.url), 'utf8');
assert.match(migration, /registry_chain_id = 84532/i);
assert.match(migration, /vault_property_registry_deployments/i, 'Supabase must lock the one reviewed registry deployment.');
assert.match(migration, /record_canonical_property_registry_deployment/i);
assert.match(migration, /PROPERTY_REGISTRY_DEPLOYMENT_ALREADY_LOCKED/i);
assert.match(migration, /PROPERTY_REGISTRY_DEPLOYMENT_NOT_VERIFIED/i, 'Property anchors must require a previously verified deployment.');
assert.match(migration, /vault_property_registry_anchor_events/i);
assert.match(migration, /unique \(property_identity_id, action\)/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.vault_property_registry_deployments from anon, authenticated/i);
assert.match(migration, /revoke all on table public\.vault_property_registry_anchor_events from anon, authenticated/i);
assert.match(migration, /record_property_registry_anchor/i);
assert.match(migration, /v_property_id <> \('0x' \|\| lower\(v_identity\.verified_property_fingerprint\)\)/i, 'DB anchor property ID must derive from the authoritative verified fingerprint.');
assert.match(migration, /if v_action = 'register'/i);
assert.match(migration, /registry_verified = true/i);
assert.match(migration, /PROPERTY_REGISTRY_REGISTRATION_REQUIRED/i);

const deploymentRpcSignature = 'public\\.record_canonical_property_registry_deployment\\(bigint,text,text,text,text,bigint\\)';
const anchorRpcSignature = 'public\\.record_property_registry_anchor\\(uuid,text,bigint,text,text,text,bigint,text,text,text,text\\)';
assert.match(
  migration,
  new RegExp(`revoke all on function ${deploymentRpcSignature} from public, anon, authenticated;`, 'i'),
  'Registry deployment recorder must explicitly revoke authenticated callers.'
);
assert.match(
  migration,
  new RegExp(`grant execute on function ${deploymentRpcSignature} to service_role;`, 'i'),
  'Only service_role may record the canonical registry deployment.'
);
assert.doesNotMatch(
  migration,
  new RegExp(`grant execute on function ${deploymentRpcSignature} to authenticated;`, 'i'),
  'Authenticated browser clients must never record a registry deployment.'
);
assert.match(
  migration,
  new RegExp(`revoke all on function ${anchorRpcSignature} from public, anon, authenticated;`, 'i'),
  'Property anchor recorder must explicitly revoke authenticated callers.'
);
assert.match(
  migration,
  new RegExp(`grant execute on function ${anchorRpcSignature} to service_role;`, 'i'),
  'Only service_role may reconcile property anchor transactions.'
);
assert.doesNotMatch(
  migration,
  new RegExp(`grant execute on function ${anchorRpcSignature} to authenticated;`, 'i'),
  'Authenticated browser clients must never record property anchors.'
);

const helper = fs.readFileSync(new URL('../lib/vault/canonical-property-registry.js', import.meta.url), 'utf8');
assert.match(helper, /BASE_SEPOLIA_CHAIN_ID = 84532/);
assert.match(helper, /propertyId = `0x\$\{fingerprint\}`/);
assert.match(helper, /property-claim:/);
assert.match(helper, /property-source:/);
assert.doesNotMatch(helper, /MAINNET/i, 'Canonical registry helper must not expose a mainnet path in this pilot.');

const route = fs.readFileSync(new URL('../app/api/admin/property-registry/route.ts', import.meta.url), 'utf8');
assert.match(route, /requireVoxelVaultAdmin/);
assert.match(route, /Number\(network\.chainId\) !== BASE_SEPOLIA_CHAIN_ID/);
assert.match(route, /receipt\.status !== 1/);
assert.match(route, /getAddress\(tx\.from\) !== owner/);
assert.match(route, /PropertyIdentityRegistered/);
assert.match(route, /PropertyIdentityVerificationUpdated/);
assert.match(route, /event\.args\.verified !== true/);
assert.match(route, /record_property_registry_anchor/);
assert.match(route, /passportMinted: false/);
assert.match(route, /propertyRightsCreated: false/);
assert.doesNotMatch(route, /mintVerifiedPassport\s*\(/, 'Anchor API must never mint a Property Passport.');
assert.doesNotMatch(route, /PropertyInterestToken|DistributionVault/, 'Anchor API must not touch the investment layer.');

const page = fs.readFileSync(new URL('../app/admin/property-registry/page.js', import.meta.url), 'utf8');
assert.match(page, /CHAIN_ID = '0x14a34'/);
assert.match(page, /REGISTER IDENTITY ON BASE SEPOLIA/);
assert.match(page, /VERIFY IDENTITY ON BASE SEPOLIA/);
assert.match(page, /registerIdentity\(/);
assert.match(page, /setVerified\(prepared\.anchor\.propertyId, true\)/);
assert.match(page, /Nothing has been signed yet/i);
assert.match(page, /does NOT verify the property or mint a Passport/i);
assert.match(page, /still does NOT mint a Passport/i);
assert.doesNotMatch(page, /mintVerifiedPassport\s*\(/);

console.log('Canonical property registry anchor tests passed.');
