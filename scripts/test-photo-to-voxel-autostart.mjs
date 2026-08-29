import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');

assert.match(property, /const \[autoCreateAfterPhoto, setAutoCreateAfterPhoto\] = useState\(false\)/, 'property flow must track automatic voxel start after photo approval');
assert.match(property, /if \(!autoCreateAfterPhoto \|\| !building\?\.atlasId \|\| !activeReference \|\| !session\?\.access_token\) return;/, 'auto-start must wait for a signed-in account, property and exact selected reference');
assert.match(property, /setAutoCreateAfterPhoto\(false\);\s*void createImage\(\);/, 'automatic photo handoff must invoke voxel image generation exactly once');
assert.match(property, /setUploadedReference\(data\.reference\)[\s\S]{0,260}setAutoCreateAfterPhoto\(true\)/, 'approved uploaded photos must immediately schedule voxel generation');
assert.match(property, /setStreetPhotoChosen\(true\)[\s\S]{0,220}setAutoCreateAfterPhoto\(true\)/, 'approved street references must immediately schedule voxel generation');
assert.match(property, /Use this photo → make voxel/, 'uploaded-photo action must tell the user it starts the voxel step');
assert.match(property, /Use this street photo → make voxel/, 'street-photo action must tell the user it starts the voxel step');
assert.match(property, /Your photo is saved\. VoxelPop is processing it now/, 'the automatic transition must show a visible processing state');
assert.match(property, /The automatic image step paused\. Your photo is still saved/, 'a failed auto-start must leave a clear manual retry path instead of a dead end');

console.log('Property photo handoff regression passed: approving a photo immediately starts the signed-in voxel-image job with visible progress and a safe retry path.');
