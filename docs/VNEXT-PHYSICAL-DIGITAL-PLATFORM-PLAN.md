# Voxel Vault physical-digital platform plan

## Product promise

Every supported physical product can have a source-verified digital twin with a durable identity. A user can inspect that twin, prove ownership, place it in a private room or public world, equip compatible wearables on a personal avatar, and initiate a trade from a nearby phone without giving the app custody of wallet secrets.

## Trust boundaries

- A product page is not proof of fulfillment. Checkout stays disabled until supplier, SKU, cost, inventory, shipping, returns, and webhook verification are connected.
- A 3D model is not ownership. Ownership is derived from the configured chain and contract.
- A nearby link or NFC tag is not a transfer. It only opens an expiring trade intent; each wallet reviews and signs its own action.
- AI can research, organize, recommend, generate drafts, and validate assets. It cannot mint, spend, transfer, publish precise location, or change identity without confirmation.
- Face and body data must be opt-in, encrypted, deletable, and isolated from wallet authorization.

## Architecture

1. **Product identity:** supplier/SKU record, merchant verification, order and return state.
2. **Twin pipeline:** source images or scans, AI-assisted asset plan, GLB validation, optimization, provenance, wearable attachment metadata.
3. **Ownership:** ERC-721/1155 identity, chain-confirmed owner, receipts, royalty signaling, transfer history.
4. **World:** MapLibre/MapTiler globe and street modes, coarse public placement, private precise coordinates, anti-spoof claim validation.
5. **Room:** lightweight Three.js scene, owned-object placement, saved layouts, WebXR/AR adapters.
6. **Avatar:** private profile, interoperable skeleton, wearable slots, fit rules, wallet-gated inventory.
7. **Nearby trade:** signed expiring offer, system nearby share on iOS, Web NFC tag writing where supported, recipient review, wallet settlement, replay protection.
8. **AI:** server-only provider router, retrieval over owned objects and provenance, moderation, prompt-injection defenses, budgets, audit trail.

## Delivery stages

### Stage 1 — coherent demonstrator

- Mobile catalog reflow and safe-area navigation.
- Core World, Shop, Avatar, Room, Trade, and AI entry points.
- Interactive local avatar configurator.
- Honest nearby-share and NFC capability path.
- Existing release suite and production build stay green.

### Stage 2 — verified commerce vertical slice

- Connect one real supplier and SKU with test fulfillment.
- Issue a digital twin only from a verified paid order event.
- Model returns, refunds, chargebacks, replacement shipments, and NFT status.
- Prove purchase -> twin -> vault -> room -> world -> trade end to end on testnet.

### Stage 3 — world and avatar platform

- Replace flat map fallback with a token-configured globe/street renderer.
- Add private/public placement controls and location fuzzing.
- Define a glTF-compatible avatar skeleton and wearable attachment schema.
- Add asset fit validation, LODs, mobile performance budgets, and accessibility fallbacks.

### Stage 4 — hardened wallet and AI

- Independent smart-contract audit before mainnet value.
- Nonce, expiry, chain ID, contract, token, recipient, and intent-domain binding for trades.
- Rate limits, abuse detection, observability, AI evals, cost ceilings, and incident controls.
- Privacy export/deletion, data retention, supplier terms, and regional compliance review.

## Feature backlog for review

- Private friend worlds and collaborative rooms.
- AR try-on and room-scale product preview.
- Repair, resale, authenticity, and warranty history attached to the product passport.
- Creator royalties and verified limited-edition drops.
- Gifting with delayed claim and recovery-safe expiry.
- Event check-ins and scavenger hunts using privacy-preserving proximity proofs.
- AI stylist, room curator, collection appraiser, and provenance explainer.
- Family vaults, delegated viewing, and guardian recovery without shared seed phrases.
- Cross-game/export adapters with explicit compatibility status instead of unsupported claims.

## Release gate

Production-ready means the full vertical slice passes mobile, accessibility, wallet rejection, replay, location privacy, supplier failure, refund, asset validation, AI safety, and chain-confirmation tests. Mainnet deployment remains blocked until an independent contract review and an explicit funding decision.
