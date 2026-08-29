'use client';

import { useLayoutEffect } from 'react';
import {
  deletePropertyCheckoutPhoto,
  loadPropertyCheckoutPhoto,
  savePropertyCheckoutPhoto,
} from '../../lib/property-generation-browser-store';

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return String(input?.url || '');
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function urlDraftId(value) {
  try { return new URL(value, window.location.origin).searchParams.get('draftId') || ''; } catch { return ''; }
}

export default function PropertyCheckoutPhotoBridge() {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalFetch = window.fetch;
    const nativeFetch = originalFetch.bind(window);
    let active = true;

    const initial = new URLSearchParams(window.location.search);
    const initialDraftId = initial.get('draftId') || '';
    if (initial.get('generation_checkout') === 'cancelled' && initialDraftId) {
      deletePropertyCheckoutPhoto(initialDraftId).catch(() => {});
    }

    const bridgedFetch = async (input, init = {}) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      let body = init?.body;
      let localDraftId = '';
      const isGenerationCheckout = url.includes('/api/property-generation/checkout');
      const isPaidPhotoHandoff = url.includes('/api/property-photo-upload');

      if (isGenerationCheckout && method === 'POST' && body instanceof FormData) {
        const photo = body.get('photo');
        localDraftId = String(body.get('draftId') || '').trim();
        if (photo instanceof File && localDraftId) await savePropertyCheckoutPhoto(localDraftId, photo);
      }

      if (isGenerationCheckout && method === 'DELETE') {
        localDraftId = urlDraftId(url);
        if (localDraftId) deletePropertyCheckoutPhoto(localDraftId).catch(() => {});
      }

      if (isPaidPhotoHandoff && method === 'POST' && body instanceof FormData && !body.has('photo')) {
        const params = new URLSearchParams(window.location.search);
        localDraftId = params.get('draftId') || '';
        if (localDraftId) {
          const photo = await loadPropertyCheckoutPhoto(localDraftId);
          if (photo) body.append('photo', photo, photo.name || 'property-photo');
        }
      }

      const response = await nativeFetch(input, { ...init, body });
      if (active && isPaidPhotoHandoff && method === 'POST' && response.ok && localDraftId) {
        deletePropertyCheckoutPhoto(localDraftId).catch(() => {});
      }
      return response;
    };

    window.fetch = bridgedFetch;
    return () => {
      active = false;
      if (window.fetch === bridgedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
