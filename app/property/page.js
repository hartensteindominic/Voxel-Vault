'use client';

import { useEffect } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import PropertyJourneyExact from './PropertyJourneyExact';
import './simple-flow.css';

const DEMO_PURCHASE_KEY = 'voxel-vault:property-slice-purchases';
const DRAFT_PREFIX = 'voxel-vault:property-draft:';

function requestedPropertyLabel(propertyId) {
  if (!propertyId || typeof window === 'undefined') return '';
  try {
    const draft = JSON.parse(window.localStorage.getItem(`${DRAFT_PREFIX}${encodeURIComponent(propertyId)}`) || 'null');
    if (draft?.label) return String(draft.label);
  } catch {}
  if (propertyId.startsWith('demo-slice:')) {
    try {
      const demo = JSON.parse(window.localStorage.getItem(DEMO_PURCHASE_KEY) || 'null');
      return String(demo?.lastPurchase?.selectedName || '');
    } catch {}
  }
  return '';
}

function OAuthRecovery() {
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error_description') || params.get('error');

    if (oauthError) {
      window.history.replaceState({}, '', '/property');
      return undefined;
    }
    if (!code) return undefined;

    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data: existing } = await client.auth.getSession();
        if (!active) return;
        if (!existing?.session) {
          await client.auth.exchangeCodeForSession(window.location.href);
        }
        if (active) window.history.replaceState({}, '', '/property');
      } catch {
        if (active) window.history.replaceState({}, '', '/property');
      }
    })();

    return () => { active = false; };
  }, []);
  return null;
}

function VaultPropertyHandoff() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'properties') return undefined;
    const propertyId = String(params.get('property') || '');
    const label = requestedPropertyLabel(propertyId);
    let finished = false;

    const openRequestedProperty = () => {
      if (finished) return true;
      const buttons = Array.from(document.querySelectorAll('button'));
      const propertiesTab = buttons.find((button) => button.textContent?.trim() === 'My Properties');
      if (propertiesTab) propertiesTab.click();
      if (!propertyId) {
        if (propertiesTab) {
          finished = true;
          window.history.replaceState({}, '', '/property');
          return true;
        }
        return false;
      }
      if (!label) return false;
      const choice = Array.from(document.querySelectorAll('button')).find((button) => {
        const text = String(button.textContent || '');
        return text.includes(label) && (text.includes('USE') || text.includes('DEMO'));
      });
      if (!choice) return false;
      finished = true;
      choice.click();
      window.history.replaceState({}, '', '/property');
      return true;
    };

    if (openRequestedProperty()) return undefined;
    const observer = new MutationObserver(() => {
      if (openRequestedProperty()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 12000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);
  return null;
}

export default function PropertyJourneyPage() {
  return <>
    <OAuthRecovery/>
    <ProductTopNav/>
    <div id="voxelpop-journey"><VaultPropertyHandoff/><PropertyJourneyExact/></div>
  </>;
}
