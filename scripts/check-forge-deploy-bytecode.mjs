import fs from 'node:fs';
import crypto from 'node:crypto';

const artifactPath = 'artifacts/contracts/VoxelForgeRevenue.sol/VoxelForgeRevenue.json';
const chunks = [1,2,3,4].map(index => fs.readFileSync(`public/forge/bytecode-${index}.txt`, 'utf8').trim());
const browserBytecode = chunks.join('');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const compiledBytecode = String(artifact.bytecode || '');

if (!compiledBytecode.startsWith('0x')) throw new Error('Compiled VoxelForgeRevenue bytecode is missing.');
if (browserBytecode !== compiledBytecode) {
  console.error('Browser deployment bytecode does not match the compiled VoxelForgeRevenue artifact.');
  console.error('browser length:', browserBytecode.length, 'compiled length:', compiledBytecode.length);
  process.exit(1);
}

const digest = crypto.createHash('sha256').update(Buffer.from(compiledBytecode.slice(2), 'hex')).digest('hex');
console.log(`Forge deploy bytecode verified: ${compiledBytecode.length} chars, sha256:${digest}`);
