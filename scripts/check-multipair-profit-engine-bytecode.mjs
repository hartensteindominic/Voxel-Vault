import fs from 'node:fs';
import crypto from 'node:crypto';

const artifactPath = 'artifacts/contracts/BaseMultiArbExecutor.sol/BaseMultiArbExecutor.json';
const bytecodePath = 'public/profit-engine/multi-executor-bytecode.txt';
const hashPath = 'public/profit-engine/multi-executor-bytecode.sha256.txt';

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const compiled = String(artifact.bytecode || '').trim();
const pinned = fs.readFileSync(bytecodePath, 'utf8').trim();
const pinnedHash = fs.readFileSync(hashPath, 'utf8').trim().toLowerCase();

if (!/^0x[0-9a-fA-F]+$/.test(compiled) || compiled.length < 1000) {
  throw new Error('Compiled BaseMultiArbExecutor creation bytecode is invalid.');
}
if (compiled !== pinned) {
  throw new Error('Pinned V6 multi-pair executor bytecode does not match the reviewed Solidity source.');
}

const actualHash = crypto.createHash('sha256').update(compiled).digest('hex');
if (actualHash !== pinnedHash) {
  throw new Error(`V6 multi-pair executor bytecode SHA-256 mismatch: expected ${pinnedHash}, got ${actualHash}`);
}

console.log(`V6 multi-pair executor bytecode integrity OK: ${compiled.length} chars, sha256 ${actualHash}`);
