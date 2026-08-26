# VoxelForge Agentic Economy Blueprint

Status: engineering blueprint only. This document does not authorize production deployment, fund movement, wallet signing, contract upgrades, or production `main` changes.

## North Star

VoxelForge becomes a permissioned machine-to-machine crafting protocol on Base: humans define goals and spending boundaries; agents discover recipes, generate verifiable previews, submit bounded intents, and execute atomic Forge transactions that either complete fully or revert fully.

The protocol monetizes real utility: crafting fees, premium recipe intelligence, optional agent/API services, and transparent marketplace royalties where supported. It must not depend on wash trading, self-dealing, fake volume, undisclosed floor-price support, or bots transacting merely to manufacture activity.

## Execution order

### Phase 1 — Atomic Forge V1

Ship one safe economic primitive before autonomous execution.

Required outcome:

1. Verify that the connected wallet owns exactly three distinct parent VoxelFlips.
2. Read and hash the canonical metadata for all three parents.
3. Produce one deterministic descendant recipe and preview.
4. Lock the preview with a `recipeHash`.
5. User approves one atomic operation.
6. The exact three parents are consumed.
7. The exact previewed descendant is minted.
8. The Forge fee is collected in the same atomic execution.
9. If any step fails, all state changes revert.

No separate three-transaction burn sequence is acceptable.

The implementation must first probe the live VoxelFlip contract and choose one of two execution paths:

- **Batch path:** if the live collection exposes an owner-callable burn and the wallet supports atomic batching through a smart-account/EIP-7702/ERC-4337 execution, batch parent burns + fee transfer + `mintWithVoucher` into one atomic execution.
- **Forge-aware contract path:** if the live collection cannot support safe atomic consumption, deploy a reviewed Forge-aware V2/coordinator architecture. Deployment always requires explicit owner-wallet approval.

Never simulate a burn by transferring assets to an inaccessible address while representing them as actually burned.

## Phase 2 — Trait DNA engine

The initial trait engine should be deterministic, inspectable, versioned, and replayable.

### Recipe inputs

- chain ID
- VoxelFlip collection address
- sorted parent token IDs
- canonical parent metadata hashes
- recipe version
- published epoch seed

### Deterministic probability bands

The seed maps into the following recipe classes:

- 60% inheritance: select parent traits directly
- 30% blend: combine compatible parent traits
- 10% mutation: select a new trait from the approved mutation registry

The percentages describe distribution across the deterministic seed space. They are not paid rerolls.

The user or agent sees the exact descendant before paying or consuming assets. The same parent set, recipe version, and epoch seed must produce the same output.

### Descendant provenance

Every descendant metadata record should include:

- `parentTokenIds`
- `parentMetadataHashes`
- `recipeVersion`
- `recipeHash`
- `epochSeed`
- selected inheritance/blend/mutation decisions
- renderer/model version
- optional proof/attestation URI

Execution must revert if the mint payload does not match the locked `recipeHash`.

## Phase 3 — Agentic API Hook

Build the protocol so humans, Coinbase AgentKit agents, ELIZA-style agents, Farcaster clients, and future A2A systems all talk to the same API surface.

Initial version is read/prepare-first. Execution remains permission gated.

### Public/read endpoints

`GET /api/forge/v1/config`

Returns chain, collection address, Forge version, fee configuration, supported wallet modes, current recipe version, proof capability, and authorization discovery.

`GET /api/forge/v1/authorization`

Returns the read-only EIP-712 ForgeIntent schema, planned EIP-7702/4337 execution model, required execution checks, and default session-policy template. It does not create a delegation or request a signature.

`POST /api/forge/v1/verify`

Input: wallet + three token IDs.

Returns canonical ownership verification, metadata hashes, parent trait summaries, and failure reasons. Never trusts client-submitted ownership.

`POST /api/forge/v1/preview`

Input: verified wallet + parent token IDs.

Returns exact deterministic descendant recipe, trait decisions, preview resources, `recipeHash`, expiry/epoch data, and estimated fee.

`POST /api/forge/v1/quote`

Returns the current execution quote, fee token options, gas estimate, quote expiry, and exact allowed transaction targets.

`GET /api/forge/v1/status/:intentId`

Returns prepared/submitted/confirmed/reverted state plus chain transaction references.

### Permissioned execution endpoints

`POST /api/forge/v1/intent`

Creates a bounded Forge intent. It never executes arbitrary wallet calls.

`POST /api/forge/v1/execute`

Available only after delegated authorization has been verified. It may execute only the exact Forge intent covered by the active permission set.

Every state-changing request must be idempotent and replay protected.

## Phase 4 — EIP-7702 + ForgeIntent authorization standard

Agents never receive a blank-check wallet permission.

### EIP-7702 facts that shape the design

EIP-7702 delegates executable account code to an EOA through a type-0x04 transaction. The delegation is persistent until the account explicitly changes or clears it; it is not merely a one-transaction temporary upgrade. The delegated code therefore has to be treated as durable account security infrastructure.

The authorization-list delegation update is processed independently from later call execution. A later execution failure must not be assumed to erase the delegation. Revocation and delegate safety are therefore first-class requirements.

EIP-7702 does not itself define a VoxelForge session-key permission system. Session keys, function scoping, rate limits, spend ceilings, expiry, and revocation must be implemented and enforced by reviewed delegated-account logic or a compatible smart-account/module architecture.

### ForgeIntent

A Forge intent must commit to at least:

- wallet/account
- collection address
- exactly three parent token IDs
- parent metadata hashes
- descendant `recipeHash`
- Forge contract/router address
- exact allowed Forge function selector
- maximum Forge fee
- allowed fee token
- maximum native call value
- maximum gas spend
- session/policy hash
- deadline
- nonce
- chain ID
- intent ID / idempotency key

Use EIP-712 typed structured signing for the ForgeIntent. The verifying router/delegate must enforce exactly the values that were signed; downstream agent text, prompts, and UI state are never authority.

Recommended authorization model:

1. Human manually signs a one-time Forge intent; or
2. Human deliberately installs/uses reviewed smart-account or EIP-7702 delegate logic and grants a restricted session permission; then
3. Agent submits only intents satisfying those limits.

### Mandatory session-policy controls

- Forge contract allowlist
- function-selector allowlist
- no arbitrary external calls
- per-Forge spend cap
- native call-value cap
- gas-cost cap
- daily/weekly spend cap
- maximum number of forges
- expiration time
- optional allowed parent rarity/classes
- optional minimum wallet balance reserve
- nonce/replay controls
- emergency revoke
- owner key remains ultimate authority

Recommended capability levels:

- **Observer:** wallet/market/recipe reads only
- **Recommender:** generates Forge intents but cannot execute
- **Delegated Forger:** can execute only policy-compliant Forge intents

There is no unrestricted autonomous mode.

## Phase 5 — Sovereign agent identity and DID layer

Agent identity is useful for reputation, auditability, and cross-app discovery, but identity must remain separate from authorization.

An agent DID/passport may bind:

- public signing/attestation key
- agent software/version identifier
- declared capabilities
- operator/owner relationship where appropriate
- attested runtime identity
- historical successful/failed Forge intents
- revocation/status information

A valid DID never grants wallet authority by itself. Wallet execution authority comes only from the active smart-account/delegate/session policy plus a valid ForgeIntent.

This separation prevents an authenticated or reputable agent from becoming automatically authorized to spend.

## Phase 6 — TEE / verifiable execution layer

TEEs can materially improve isolation of signing material, policy state, and sensitive agent execution, but they are not a substitute for contract-level authorization and should not be described as making an AI prompt-injection immune.

A hostile prompt or compromised upstream tool can still cause a model to propose unsafe actions. The security design therefore assumes agent output can be adversarial and constrains execution cryptographically.

Recommended TEE progression:

1. Keep owner keys outside the model context entirely.
2. If a service-side session key is introduced, isolate it in a hardware-backed/attested execution environment.
3. Bind attestations to exact agent/policy software measurements where useful.
4. Require the onchain delegate/router to reject any transaction outside the user-approved policy even if the TEE or model requests it.
5. Support immediate session-key and delegate revocation.

The TEE is defense in depth. The onchain permission policy is the final security boundary.

## Phase 7 — AgentKit / A2A adapter

Implement a dedicated VoxelForge AgentKit action provider after Forge V1 execution is stable.

Actions:

- `forge_verify_parents`
- `forge_preview_descendant`
- `forge_quote`
- `forge_create_intent`
- `forge_execute_intent`
- `forge_get_status`

`forge_execute_intent` must fail closed unless a current bounded authorization is present.

Start on Base Sepolia. Promote to Base mainnet only after contract tests, replay tests, spending-limit tests, wallet-revocation tests, delegation-clearing tests, delegate-upgrade tests, and atomic-revert tests pass.

A2A integrations should exchange signed/typed Forge intents and quotes, not raw private keys and not unrestricted transaction calldata.

MCP can expose tools/context for agent interoperability, but MCP messages are not authorization. x402 or similar machine-payment rails may be used for explicit API-service payments; they are separate from NFT/Forge wallet permissions.

## Phase 8 — Verifiable gene editing

Do not make the core business depend on one proof vendor.

Define a provider-neutral proof interface:

`GeneProofProvider.verify(recipeInputHash, recipeOutputHash, proof) -> bool`

Progression:

1. V1: deterministic open-source recipe engine + onchain hashes.
2. V1.5: server attestation and immutable renderer/recipe version records.
3. V2: optional TEE/verifiable-compute proof adapter.
4. V3: SPEX/ZK/other mature proof provider where technically and economically justified.

The proof layer certifies execution integrity. It does not claim that rarity guarantees profit, future price, or investment returns.

## Phase 9 — Social-native Forge

Prioritize Farcaster Mini Apps for transaction-capable social onboarding.

Flow:

1. User sees a descendant in-feed.
2. Opens `Forge yours` mini app.
3. Wallet/session is available in the social client.
4. App verifies owned parent ingredients.
5. User sees exact preview and cost.
6. User approves or uses an already-bounded Forge permission.
7. Result posts an animated/3D descendant card back to the social graph.

X and other social networks can act as discovery/command surfaces, but execution should deep-link into a wallet-capable signed session unless the platform exposes an equivalently secure transaction interface.

## Phase 10 — Machine-economy monetization

Revenue should come from useful actions, not churn.

### Core revenue

- Forge execution fee
- evolution/upgrade fee
- premium recipe packs
- limited recipe seasons
- optional secondary royalties where marketplace enforcement permits

### Agent-native revenue

- free basic verification/preview tier
- premium recipe optimizer
- batch wallet analysis
- premium rarity/provenance analytics
- optional x402/USDC pay-per-call API endpoints for external agents
- enterprise/partner API plans

For machine-to-machine commerce, prefer stable, explicit accounting. A future Forge router may use USDC as the canonical machine fee while human UI can still quote equivalent ETH when appropriate.

Do not create transactions whose primary purpose is to inflate transaction count, volume, floor price, or protocol-fee statistics.

## Treasury architecture

Protocol revenue can be routed transparently to configurable recipients such as:

- protocol treasury
- operations/security reserve
- gas sponsorship/paymaster budget
- creator/community rewards
- ecosystem grants

Do not hard-code an immutable 80/20 split into the first Forge contract. Use a reviewed fee router/configuration with limits and governance/owner controls so economics can evolve without replacing the Forge primitive.

Any future protocol-owned liquidity or asset purchases must be publicly disclosed and economically justified. They must not be designed or marketed as an automatic mechanism to manufacture a higher floor price or artificial trading activity.

## Cross-chain expansion

Cross-chain splicing is a later interoperability layer, not a V1 requirement.

Never attempt to make one atomic transaction synchronously mutate NFT state on unrelated chains without a verified messaging/settlement design. Cross-chain Forge should use explicit lock/burn/mint or canonical messaging semantics, finality rules, replay domains, timeouts, and failure recovery.

The first production Forge stays on Base. Cross-chain adapters can be added only after the Base invariant is stable and audited.

## Security invariants

The following are non-negotiable:

1. No production private key is ever exposed to the browser, agent prompt, model, MCP message, DID document, or API response.
2. No external agent can request arbitrary contract calls through VoxelForge.
3. Ownership is verified onchain immediately before intent execution.
4. Parent token set and `recipeHash` are immutable once authorized.
5. Fee, call-value, and gas maxima are signed/permissioned before execution.
6. Nonces and intent IDs prevent replay and duplicate Forge execution.
7. The operation is atomic: fee + consume parents + mint descendant all succeed or all revert.
8. A revoked/expired session cannot execute.
9. Human owners can always revoke delegated agent authority and clear/replace delegated code.
10. Automated listing/trading, if ever added, is a separate permission scope from forging.
11. DID identity never substitutes for wallet authorization.
12. TEE attestation never substitutes for onchain policy validation.
13. A reverted call is never assumed to have removed a previously installed EIP-7702 delegation.

## Immediate developer backlog

P0 — finish Forge V1 atomicity probe and choose batch-vs-V2 contract path.

P0 — implement `recipeHash`, deterministic DNA engine, and preview locking.

P0 — build contract/unit tests for ownership, duplicate parents, replay, fee bounds, and atomic revert.

P1 — maintain `/api/forge/v1/config`, `/verify`, `/preview`, `/quote`, and `/authorization` as the first agent-compatible read surface.

P1 — implement EIP-712 `ForgeIntent` construction/validation and idempotent intent persistence.

P1 — design reviewed delegate/router contract with explicit EIP-7702 persistence/revocation semantics.

P1 — add Base Sepolia execution harness.

P2 — implement bounded delegated execution using the reviewed delegate/session-permission architecture.

P2 — build Coinbase AgentKit action provider.

P2 — build Farcaster Mini App.

P3 — add DID/reputation registry only where it improves cross-agent trust and auditability.

P3 — add provider-neutral TEE/verifiable-compute proof adapter.

P3 — add x402/premium agent analytics once genuine external demand exists.

P4 — evaluate cross-chain adapters only after Base Forge is stable.

## Definition of the future product

VoxelForge is not an NFT trading bot.

It is a programmable digital-asset transformation protocol where humans and AI agents can discover, verify, craft, prove, and distribute descendants under explicit cryptographic spending rules.

The compounding advantage should come from better utility, provenance, distribution, automation, and recurring real fees — not manufactured market activity.
