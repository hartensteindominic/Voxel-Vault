import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`Missing required VoxelFlip launch file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

const launchPage = read('app/voxelflip/launch/page.tsx');
const preflight = read('app/api/creator-pack/nft/preflight/route.ts');
const deployment = read('lib/voxelflip-deployment.ts');

if (!launchPage.includes('READ-ONLY LAUNCH STATUS')) failures.push('Launch page is not visibly marked read-only.');
if (!launchPage.includes('/api/creator-pack/nft/preflight')) failures.push('Launch page does not use the read-only preflight endpoint.');
if (!launchPage.includes('cannot deploy a contract, sign a transaction, or spend ETH')) failures.push('Launch page is missing the explicit no-deploy/no-sign/no-spend warning.');
if (/ContractFactory|factory\.deploy\s*\(|connectVoxelFlipWallet|eth_sendTransaction|wallet_sendTransaction|personal_sign|signTypedData|eth_signTypedData/i.test(launchPage)) failures.push('Launch page contains wallet signing or deployment capability.');
if (/VOXELFLIP_MINT_SIGNER_PRIVATE_KEY|OPENSEA_API_KEY/.test(launchPage)) failures.push('Launch page references server secret environment variable names.');

if (!/readyForContractDeployment\s*:\s*false/.test(preflight)) failures.push('Preflight does not hard-disable fresh contract deployment.');
if (!preflight.includes('collectionVerified')) failures.push('Preflight does not expose a public collection-verification result.');
if (!preflight.includes('deploymentRecordMatchesChain')) failures.push('Preflight does not compare the pinned deployment record with the live Base contract.');
if (!preflight.includes('mintSignerMatchesCollection')) failures.push('Preflight does not verify the server-derived signer against the live collection signer.');
if (!preflight.includes('baseFunding')) failures.push('Preflight does not report public Base funding status.');
if (/privateKey\s*:|seedPhrase\s*:|mnemonic\s*:|apiKey\s*:/.test(preflight)) failures.push('Preflight response appears to expose secret material.');

if (!deployment.includes('matchesVerifiedProduction')) failures.push('Deployment resolver does not gate stored metadata against reviewed production values.');
if (!deployment.includes('Ignoring untrusted VoxelFlip deployment.json')) failures.push('Deployment resolver does not fail closed on conflicting stored deployment metadata.');

if (failures.length) {
  console.error('VoxelFlip launch safety failures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('VoxelFlip launch safety passed: launch status is read-only, fresh deployment is disabled, public Base verification is required, secret material is not surfaced, and reviewed production deployment metadata remains fail-closed.');
