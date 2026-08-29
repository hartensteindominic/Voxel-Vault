'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { savePropertyDraftToAccount, syncLocalPropertyDraftsToAccount } from '../../lib/property-drafts-account';

export default function PropertyDraftSyncBridge() {
  const sessionRef = useRef(null);
  const clientRef = useRef(null);

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function apply(client, nextSession) {
      sessionRef.current = nextSession || null;
      if (!nextSession?.user) return;
      try { await syncLocalPropertyDraftsToAccount(client, nextSession.user); } catch {}
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => { if (active) apply(client, next); });
      subscription = auth.data.subscription;
    }).catch(() => {});

    async function onSaved(event) {
      const draft = event?.detail;
      const session = sessionRef.current;
      const client = clientRef.current;
      if (!draft?.id || !session?.user || !client) return;
      try { await savePropertyDraftToAccount(client, session.user, draft); } catch {}
    }

    window.addEventListener('voxel-vault:property-draft-saved', onSaved);
    return () => {
      active = false;
      subscription?.unsubscribe?.();
      window.removeEventListener('voxel-vault:property-draft-saved', onSaved);
    };
  }, []);

  return null;
}
