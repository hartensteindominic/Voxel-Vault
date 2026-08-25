'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

export default function StudioLayout({ children }) {
  const [finishing, setFinishing] = useState(false);
  const [callbackError, setCallbackError] = useState('');

  useEffect(() => {
    let active = true;

    async function finishGoogleSignIn() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const authReturn = url.searchParams.get('auth') === 'google';
      const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      if (providerError) {
        setCallbackError(`Google sign-in returned an error: ${providerError}`);
        return;
      }

      if (!code && !accessToken && !authReturn) return;

      setFinishing(true);
      setCallbackError('');

      try {
        const client = await getSupabaseBrowserAsync();
        let session = null;

        if (code) {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data?.session || null;
        } else if (accessToken && refreshToken) {
          const { data, error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          session = data?.session || null;
        } else {
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          session = data?.session || null;
        }

        if (!session?.user) {
          throw new Error('Google returned to VoxelPop, but no Supabase session was created.');
        }

        window.location.replace(`${window.location.origin}/studio#my-voxels`);
      } catch (error) {
        if (!active) return;
        setFinishing(false);
        setCallbackError(error instanceof Error ? error.message : 'Could not finish Google sign-in.');
      }
    }

    finishGoogleSignIn();
    return () => {
      active = false;
    };
  }, []);

  return <>
    {(finishing || callbackError) && <div style={{position:'fixed',zIndex:9999,left:12,right:12,top:12,maxWidth:720,margin:'0 auto',padding:'13px 15px',borderRadius:14,background:callbackError?'#fff7ed':'#eff6ff',border:`1px solid ${callbackError?'#fdba74':'#bfdbfe'}`,boxShadow:'0 12px 35px rgba(15,23,42,.18)',fontFamily:'system-ui,-apple-system,sans-serif',fontSize:14,fontWeight:750,color:callbackError?'#9a3412':'#1e3a8a'}} role="status">
      {callbackError || 'Finishing Google sign-in…'}
    </div>}
    {children}
  </>;
}
