# Voxel Vault Legal Review Data Room

## Rule

Do not commit private legal, identity, banking, tenant, title, wallet-key, tax or property documents to this public repository.

This checklist defines the evidence categories that must exist in controlled storage before Voxel Vault can move from `regulated-launch-build` to any live investment workflow. Public code may store document names, review states, non-sensitive hashes and provider references only.

## Minimum data-room folders

| Folder | Contents | Public repo treatment |
| --- | --- | --- |
| `01_company_and_founder` | Founder/entity details, ownership, signatures, tax IDs, bad-actor questionnaires. | Keep private. Store only review state. |
| `02_offering_path` | Counsel memo, exemption decision, Form C or alternative filing plan, intermediary acceptance. | Public docs may cite the selected path after approval. |
| `03_intermediary_and_providers` | Broker-dealer/funding portal agreement, KYC/AML provider, escrow/payment provider, custody/transfer/tax providers. | Store provider names only after approved for disclosure. |
| `04_property_issuer` | LLC/entity records, operating agreement, capitalization, authority to acquire/hold property. | Store issuer ID and non-sensitive status only. |
| `05_property_title` | Deed/title evidence, title commitment/search, lien review, parcel records, insurance, property-manager agreement. | Store public parcel references and hashes only. |
| `06_investor_onboarding` | Identity/KYC rules, investor eligibility, jurisdiction rules, subscription workflow, support procedure. | Store provider state names and required next actions. |
| `07_funds_and_settlement` | Escrow flow, payment states, refund/cancellation rules, settlement webhooks, reconciliation format. | Store state machine and audit-log schema, not bank details. |
| `08_token_and_records` | Token rights memo, transfer restrictions, cap-table/transfer-agent workflow, contract audit. | Store contract addresses only after approved production deployment. |
| `09_operations_and_distributions` | Rent records, expense/reserve policy, distribution approvals, tax reporting workflow. | Store investor-safe summaries only after provider/accounting approval. |
| `10_marketing_and_disclosures` | Counsel-reviewed pages, risk disclosures, ad copy, email copy, investor education. | Commit only approved public copy. |
| `11_security_and_incidents` | Security review, access controls, incident response, pause authority, privacy review. | Commit policies and public-safe runbooks only. |

## Evidence acceptance standard

Each gate needs:

- responsible reviewer name or provider role;
- date reviewed;
- decision: `pending`, `approved`, `rejected` or `changes-requested`;
- document reference in controlled storage;
- public-safe hash or version ID when appropriate;
- next action owner;
- whether the evidence can be disclosed publicly.

## Launch gate mapping

| Launch gate | Required data-room evidence |
| --- | --- |
| `registeredIntermediaryAgreementActive` | Executed intermediary agreement and official registration verification. |
| `offeringAuthorizationApproved` | Counsel-approved offering path and required filing/disclosure plan. |
| `securitiesCounselApproved` | Written approval for structure, marketing, token rights and investor flow. |
| `titleCounselApproved` | Written approval for property/title/entity structure. |
| `issuerPropertyEntityVerified` | Entity records, authority, ownership, operating agreement and capitalization. |
| `kycAmlInvestorEligibilityConfigured` | Provider workflow for identity, sanctions, jurisdiction and investor-limit/accreditation checks. |
| `escrowSettlementConfigured` | Approved escrow/payment flow, settlement states, refunds and cancellation rules. |
| `custodyRailsConfigured` | Approved custody/wallet/securityholder record model. |
| `capTableTransferControlsConfigured` | Transfer restrictions, cap-table reconciliation and recordkeeping process. |
| `propertyAccountingConfigured` | Property operating account, rent, expenses, reserves and statement process. |
| `taxReportingConfigured` | Investor statements and required tax reporting workflow. |
| `smartContractsAudited` | Independent contract review and deployment approval. |
| `privacySecurityApproved` | Privacy, access-control and security review. |
| `incidentResponseApproved` | Pause authority, incident runbook and support escalation path. |
| `providerIntegrationVerified` | End-to-end sandbox proof using provider-authoritative states. |

## Public-safe implementation pattern

```text
private evidence document
    -> controlled storage
    -> reviewer approval record
    -> public-safe hash/reference
    -> launch gate can become externally satisfied
    -> code still remains fail-closed until production implementation constants are reviewed
```

## What must never be public

- Social Security numbers, tax IDs, passports, driver's licenses or KYC files.
- Bank account, escrow, custody or private wallet-key material.
- Unredacted title packets, closing files, insurance policies or leases.
- Tenant names, tenant financials or tenant communications.
- Private legal advice unless counsel approves disclosure.
- Unapproved marketing or investor solicitation copy.

