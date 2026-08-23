export const MEDIA_TYPES = Object.freeze(['3d', 'image', 'video']);

export const MEDIA_LIMITS = Object.freeze({
  image: { maxBytes: 25 * 1024 * 1024, extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
  video: { maxBytes: 250 * 1024 * 1024, extensions: ['mp4', 'webm', 'mov'] },
  '3d': { maxBytes: 150 * 1024 * 1024, extensions: ['glb', 'gltf'] },
});

const extensionOf = (name = '') => name.toLowerCase().split('.').pop() || '';

export function detectMediaType(file) {
  const ext = extensionOf(file?.name);
  if (['glb', 'gltf'].includes(ext) || file?.type?.includes('gltf')) return '3d';
  if (file?.type?.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (file?.type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  return null;
}

export function validateCollectibleFile(file, expectedType = null) {
  if (!file) return { ok: false, error: 'Choose a file first.' };
  const type = expectedType || detectMediaType(file);
  if (!MEDIA_TYPES.includes(type)) return { ok: false, error: 'Unsupported media. Use an image, video, GLB, or GLTF.' };
  const rules = MEDIA_LIMITS[type];
  const extension = extensionOf(file.name);
  if (!rules.extensions.includes(extension)) return { ok: false, error: `.${extension || 'file'} is not supported for ${type}.` };
  if (file.size > rules.maxBytes) return { ok: false, error: `That ${type} file is too large. Maximum is ${Math.round(rules.maxBytes / 1024 / 1024)} MB.` };
  return { ok: true, type, extension };
}

export function createCollectibleDraft({ name = '', description = '', mediaType, assetUrl = '', traits = [], location = null }) {
  if (!MEDIA_TYPES.includes(mediaType)) throw new Error('A valid mediaType is required.');
  return {
    schema: 'voxel-vault.collectible/v1',
    mediaType,
    name: name.trim() || 'Untitled Collectible',
    description: description.trim(),
    assetUrl,
    thumbnailUrl: assetUrl,
    traits,
    discovery: { location, dropEnabled: false, huntId: null },
    provenance: { createdAt: new Date().toISOString(), source: 'voxel-vault-creator' },
    compatibility: mediaType === '3d' ? { formats: ['GLB', 'GLTF'], sandboxProfile: 'pending' } : { formats: [] },
  };
}
