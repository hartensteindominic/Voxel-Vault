# Voxel Vault Regulated Launch Packet

## Purpose

This packet prepares Voxel Vault for review by securities counsel, real-estate/title counsel, an SEC/FINRA-registered intermediary, KYC/AML providers, escrow/payment providers, custody/transfer providers and tax/accounting reviewers.

It is not legal, tax or investment advice. It does not authorize live investing. Production remains fail-closed until the selected professionals and providers approve the offering path, property evidence, settlement flow, token rights and investor disclosures.

## Current product posture

Voxel Vault is a spatial real-asset product prototype with:

- 3D property discovery and Property Passport UI;
- sandbox-only tokenized real-estate experiments;
- permissioned property-interest contract patterns;
- regulated launch gates;
- provider-readiness status APIs;
- documentation that separates the blockchain record from the actual deed/title system.

Voxel Vault is not currently:

- a registered broker-dealer;
- a registered funding portal;
- an exchange, ATS, transfer agent, custodian or bank;
- a title company;
- a live real-estate investment platform;
- a live automatic reinvestment service.

## Recommended first review question

Can the first property launch through Regulation Crowdfunding with a registered broker-dealer or funding portal while Voxel Vault remains the 3D product, wallet visualization, evidence dashboard and token-recording layer?

The SEC states that Regulation Crowdfunding transactions must occur online through an SEC-registered intermediary, either a broker-dealer or funding portal, and that eligible issuers may raise up to $5 million in a 12-month period subject to issuer, disclosure, investor-limit and resale rules: [SEC Regulation Crowdfunding](https://www.sec.gov/resources-small-businesses/exempt-offerings/regulation-crowdfunding).

FINRA says crowdfunding intermediaries must register with the SEC as a broker or funding portal and become a FINRA member. FINRA also publishes a regulated funding portal list for diligence: [FINRA Funding Portals We Regulate](https://www.finra.org/about/entities-we-regulate/funding-portals-we-regulate).

## Non-negotiable launch locks

The following remain blocked until the required authorities approve them:

- direct investor payments into Voxel Vault-controlled accounts;
- live investment checkout;
- automatic real-property acquisition;
- mainnet property-interest token issuance;
- unrestricted peer-to-peer resale of property-interest tokens;
- automatic reinvestment of rent/distribution proceeds;
- marketing that describes a token, NFT or Property Passport as a deed.

Environment variables, admin toggles, screenshots or founder approval do not satisfy legal authority by themselves.

## Partner diligence questions

| Area | Question | Needed evidence |
| --- | --- | --- |
| Registration | Are you currently SEC/FINRA registered for the exact role Voxel Vault needs? | Official registration link, SEC file number if applicable, written scope. |
| Offering path | Should property #0001 use Reg CF, Reg D, Reg A or another path? | Counsel memo, intermediary acceptance, filing plan. |
| Investor onboarding | Who controls identity, KYC/AML, sanctions, investor-limit, accreditation and jurisdiction checks? | Provider workflow, API docs, sandbox results, privacy/security approval. |
| Funds and escrow | Who legally holds investor funds before closing and who controls refunds/cancellations? | Escrow/payment agreement, settlement states, webhook spec. |
| Token rights | What exactly does the token represent and what does it not represent? | Rights memo, subscription/operating agreement map, transfer restrictions. |
| Recordkeeping | Who is the authoritative securityholder record keeper? | Cap-table/transfer-agent process, reconciliation spec. |
| Distributions | How are rent, expenses, reserves, taxes and distributable net income approved? | Property accounting policy, distribution statement, tax workflow. |
| Secondary transfers | Are any transfers or secondary trading permitted? | Transfer-control rules, ATS/broker-dealer approval if applicable. |

## What Codex should build only after partner selection

- Provider-specific onboarding state machine.
- Provider-specific payment and escrow webhooks.
- Provider-specific subscription status reconciliation.
- Provider-specific investment unit mint/record instructions.
- Provider-specific investor statement and tax document delivery.
- Provider-approved reinvestment authorization flow.

## First outreach note

Subject: Review request for first tokenized real-estate offering platform

Hello,

I am building Voxel Vault, a spatial real-asset platform that lets users explore property opportunities through a 3D vault experience. The app is intentionally fail-closed today: it does not accept investor funds, does not issue live property-interest tokens and does not present a Property Passport as a deed.

I am looking for securities counsel and/or an SEC/FINRA-registered intermediary to review whether our first property can launch through a compliant retail-accessible structure, likely Regulation Crowdfunding if appropriate. Voxel Vault would remain the product interface, evidence dashboard, wallet visualization and blockchain-recording layer, while the regulated intermediary and approved providers would control the offering, investor eligibility, escrow/payment flow, subscriptions and required records.

Could you review whether this structure is workable and tell me what evidence, provider roles, disclosures and integration requirements you would need before any live investment feature is built?

Thank you,
Dominic

## GitHub work queue

- [#339 Offering path + intermediary](https://github.com/hartensteindominic/Voxel-Vault/issues/339)
- [#340 Property issuer + title evidence](https://github.com/hartensteindominic/Voxel-Vault/issues/340)
- [#341 Investor onboarding + eligibility](https://github.com/hartensteindominic/Voxel-Vault/issues/341)
- [#342 Funds, escrow, custody + settlement](https://github.com/hartensteindominic/Voxel-Vault/issues/342)
- [#343 Token recordkeeping + transfer controls](https://github.com/hartensteindominic/Voxel-Vault/issues/343)
- [#344 Rent distributions + reinvestment rules](https://github.com/hartensteindominic/Voxel-Vault/issues/344)

