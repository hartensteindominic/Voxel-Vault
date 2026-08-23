# Supplier product publishing

Voxel Vault can accept a product URL from any public HTTPS website as the source for a private draft. A URL is discovery evidence only. It does not authorize scraping, media reuse, resale, automated ordering, or NFT association.

## Activation

1. Apply `supabase/migrations/006_supplier_product_drafts.sql`.
2. Set `VAULT_ADMIN_EMAILS` to a comma-separated list of verified Supabase account emails, or set `VAULT_ADMIN_USER_IDS` to immutable Supabase user UUIDs.
3. Redeploy the application.
4. Sign in at `/admin/products`.

Never place supplier credentials in a draft. Existing Shopify and generic-provider secrets remain server-side in the environment variables documented by `docs/ONE-SKU-PILOT-RUNBOOK.md`.

## Publication contract

The qualification workflow fails closed until the product has all of the following:

- a real physical and fulfillment SKU;
- verified supplier cost, markup, inventory, shipping and returns;
- an authorized `shopify` or `generic` fulfillment adapter;
- a GLB/GLTF URI, SHA-256 hash, and model-rights evidence;
- a Base contract address, token ID, and confirmed mint transaction;
- available inventory.

The existing image-based and third-party-model catalogs remain concepts. `getSellableCatalog()` excludes them, and physical checkout returns `PRODUCT_NOT_VAULT_READY` for them.

This first contribution stops at a server-verified `ready` record. It deliberately does not expose a Publish action or route a ready record into checkout until atomic NFT reservation and the selected supplier adapter are implemented and tested.

## Supplier automation boundary

Only approved supplier adapters may inspect inventory or place an order automatically. An unsupported retail URL remains a draft until Vault establishes a lawful resale path and configures an authorized adapter. Do not add browser automation that logs into a consumer retail site, copies protected media, or submits an order through a consumer checkout.
