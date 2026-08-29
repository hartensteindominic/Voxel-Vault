import { Buffer } from 'node:buffer';

function pad4(value: number) {
  return (value + 3) & ~3;
}

function floats(values: number[]) {
  const out = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => out.writeFloatLE(value, index * 4));
  return out;
}

function uint16(values: number[]) {
  const out = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => out.writeUInt16LE(value, index * 2));
  return out;
}

function imageMime(bytes: Buffer, supplied: string) {
  const type = String(supplied || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/png' || type === 'image/jpeg') return type;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return '';
}

function padded(buffer: Buffer, fill = 0) {
  const length = pad4(buffer.length);
  if (length === buffer.length) return buffer;
  const out = Buffer.alloc(length, fill);
  buffer.copy(out);
  return out;
}

/**
 * Build a tiny self-contained GLB used only when the premium 3D provider has no
 * credits left after the VoxelPop image already exists. The result is a shallow
 * rotatable display block, not a reconstructed building mesh.
 */
export function buildLocalPreviewGlb(imageBytesRaw: Buffer | Uint8Array, suppliedMimeType = '') {
  const imageBytes = Buffer.from(imageBytesRaw);
  const mimeType = imageMime(imageBytes, suppliedMimeType);

  // 24 vertices (4 per face) let each face have stable normals/UVs.
  const p = [
    -1,-1,.12, 1,-1,.12, 1,1,.12, -1,1,.12,
    1,-1,-.12, -1,-1,-.12, -1,1,-.12, 1,1,-.12,
    1,-1,.12, 1,-1,-.12, 1,1,-.12, 1,1,.12,
    -1,-1,-.12, -1,-1,.12, -1,1,.12, -1,1,-.12,
    -1,1,.12, 1,1,.12, 1,1,-.12, -1,1,-.12,
    -1,-1,-.12, 1,-1,-.12, 1,-1,.12, -1,-1,.12,
  ];
  const n = [
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  ];
  const uv: number[] = [];
  for (let face = 0; face < 6; face += 1) uv.push(0,0, 1,0, 1,1, 0,1);
  const indices: number[] = [];
  for (let face = 0; face < 6; face += 1) {
    const base = face * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const positionBytes = floats(p);
  const normalBytes = floats(n);
  const uvBytes = floats(uv);
  const indexBytes = uint16(indices);
  const positionOffset = 0;
  const normalOffset = positionOffset + positionBytes.length;
  const uvOffset = normalOffset + normalBytes.length;
  const indexOffset = uvOffset + uvBytes.length;
  const imageOffset = pad4(indexOffset + indexBytes.length);
  const imagePadded = mimeType ? padded(imageBytes) : Buffer.alloc(0);
  const binaryLength = imageOffset + imagePadded.length;
  const binary = Buffer.alloc(binaryLength);
  positionBytes.copy(binary, positionOffset);
  normalBytes.copy(binary, normalOffset);
  uvBytes.copy(binary, uvOffset);
  indexBytes.copy(binary, indexOffset);
  if (imagePadded.length) imagePadded.copy(binary, imageOffset);

  const bufferViews: any[] = [
    { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.length, target: 34962 },
    { buffer: 0, byteOffset: normalOffset, byteLength: normalBytes.length, target: 34962 },
    { buffer: 0, byteOffset: uvOffset, byteLength: uvBytes.length, target: 34962 },
    { buffer: 0, byteOffset: indexOffset, byteLength: indexBytes.length, target: 34963 },
  ];
  if (mimeType) bufferViews.push({ buffer: 0, byteOffset: imageOffset, byteLength: imageBytes.length });

  const material: any = {
    pbrMetallicRoughness: {
      baseColorFactor: mimeType ? [1, 1, 1, 1] : [0.48, 0.82, 0.68, 1],
      metallicFactor: 0,
      roughnessFactor: 0.82,
    },
    doubleSided: true,
  };
  const gltf: any = {
    asset: { version: '2.0', generator: 'Voxel Vault local no-credit preview' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'VoxelPop preview card' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [material],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-1,-1,-.12], max: [1,1,.12] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews,
    buffers: [{ byteLength: binaryLength }],
  };
  if (mimeType) {
    gltf.images = [{ bufferView: 4, mimeType }];
    gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    gltf.textures = [{ sampler: 0, source: 0 }];
    material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  }

  const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8');
  const json = padded(jsonRaw, 0x20);
  const bin = padded(binary, 0);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(0x46546c67, 0); // glTF
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);
  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  json.copy(out, 20);
  const binHeader = 20 + json.length;
  out.writeUInt32LE(bin.length, binHeader);
  out.writeUInt32LE(0x004e4942, binHeader + 4); // BIN
  bin.copy(out, binHeader + 8);
  return out;
}
