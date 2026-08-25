# VoxelPop Google account activation

The VoxelPop UI now uses Supabase Auth for real Google OAuth and syncs My Voxels into the signed-in user's existing `vault_profiles.avatar_style.voxelpop_library` JSON field.

## Required Vercel public environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are browser-safe Supabase project values. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Required Supabase Auth configuration

1. In Supabase Dashboard -> Authentication -> Providers -> Google, enable Google.
2. Create a Web OAuth client in Google Auth Platform.
3. Put the Google Client ID and Client Secret into the Supabase Google provider settings.
4. In Google Auth Platform, use the Supabase callback URL shown by the Google provider settings as an authorized redirect URI.
5. In Supabase Authentication -> URL Configuration, set the production Site URL to `https://www.voxelvault.io` and allow `https://www.voxelvault.io/**` as a redirect URL. Add Vercel preview URLs only for preview testing.

## Verification

Open `/api/account/status` on the deployed site. It intentionally returns only booleans/status text and never returns credentials.

Expected production state:

```json
{
  "supabaseConfigured": true,
  "googleProviderEnabled": true,
  "providerCheck": "ok"
}
```

Then click `Continue with Google` under My Voxels. A successful login should return to VoxelPop, show `Google connected`, import the browser's existing paid voxels into the account, and restore those voxels after signing into the same Google account on another browser/device.
