'use client';

import { useEffect } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import PropertyStudioFlow from './PropertyStudioFlow';
import VoxelMakerSubscriptionGate from './VoxelMakerSubscriptionGate';

function cleanOAuthParams() {
  const url = new URL(window.location.href);
  for (const key of ['code', 'error', 'error_description']) url.searchParams.delete(key);
  const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}`;
  window.history.replaceState({}, '', next || '/property');
}

function OAuthRecovery() {
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error_description') || params.get('error');

    if (oauthError) {
      cleanOAuthParams();
      return undefined;
    }
    if (!code) return undefined;

    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data: existing } = await client.auth.getSession();
        if (!active) return;
        if (!existing?.session) await client.auth.exchangeCodeForSession(window.location.href);
        if (active) cleanOAuthParams();
      } catch {
        if (active) cleanOAuthParams();
      }
    })();

    return () => { active = false; };
  }, []);
  return null;
}

export default function PropertyJourneyPage() {
  return <>
    <OAuthRecovery/>
    <VoxelMakerSubscriptionGate>
      <PropertyStudioFlow/>
    </VoxelMakerSubscriptionGate>
  </>;
}
