import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  TEST_LAND_CREATION_BYTECODE_CHARS,
  TEST_LAND_CREATION_BYTECODE_BYTES,
  TEST_LAND_CREATION_SHA256,
  TEST_LAND_BYTECODE_PARTS,
} from '../lib/test-land-deploy.js';

const bytecode = TEST_LAND_BYTECODE_PARTS
  .map(path => fs.readFileSync(new URL(`../public${path}`, import.meta.url), 'utf8').trim())
  .join('');

assert.ok(bytecode.startsWith('0x'), 'Test Land creation bytecode must start with 0x.');
assert.equal(bytecode.length, TEST_LAND_CREATION_BYTECODE_CHARS, 'Pinned Test Land bytecode character length changed.');
const bytes = Buffer.from(bytecode.slice(2), 'hex');
assert.equal(bytes.length, TEST_LAND_CREATION_BYTECODE_BYTES, 'Pinned Test Land bytecode byte length changed.');
assert.equal(
  `0x${crypto.createHash('sha256').update(bytes).digest('hex')}`,
  TEST_LAND_CREATION_SHA256,
  'Pinned Test Land bytecode no longer matches the exact CI-compiled artifact.',
);
assert.equal(bytes.toString('hex'), bytecode.slice(2).toLowerCase(), 'Pinned Test Land bytecode contains invalid hex.');

console.log(`Test Land deploy bytecode verified: ${bytes.length} bytes, ${TEST_LAND_CREATION_SHA256}`);
