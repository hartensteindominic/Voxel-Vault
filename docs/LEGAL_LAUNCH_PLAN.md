# Voxel Vault Legally Live Real-Estate Investment Launch Plan

## Goal

Turn the current real-property/tokenization prototype into a U.S. investment product that can accept real investor capital for actual property offerings without pretending that an NFT is a deed or that Voxel Vault can perform regulated securities, custody or money-transmission functions without the required registrations/partners.

This document is an engineering/compliance implementation plan, not legal advice. Final offering structure, documents, marketing and launch approval must come from licensed securities and real-estate/title counsel plus the selected registered intermediary.

## Official legal-readiness sources

Use primary sources for the first pass and have counsel update the final legal matrix before launch:

- [SEC Regulation Crowdfunding](https://www.sec.gov/resources-small-businesses/exempt-offerings/regulation-crowdfunding) - online Reg CF securities offerings require an SEC-registered intermediary, investor limits, issuer disclosure and filings.
- [SEC Regulation Crowdfunding guidance for issuers](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/regulation-crowdfunding-guidance-issuers) - issuer eligibility, filing, disclosure, advertising and bad-actor requirements need review before any raise.
- [FINRA Funding Portals](https://www.finra.org/registration-exams-ce/funding-portals) - funding portal members are regulated by FINRA and are not interchangeable with an ordinary website checkout.
- [SEC digital asset investment-contract framework](https://www.sec.gov/files/dlt-framework.pdf) - tokenized rights tied to profit expectations require securities analysis.
- [FinCEN convertible virtual currency guidance](https://www.fincen.gov/system/files/2019-05/FinCEN%20CVC%20Guidance%20FINAL.pdf) - fiat, stablecoin, wallet, custody and transfer flows need Bank Secrecy Act / money-services analysis.
- [New York DFS Virtual Currency Business Activity](https://www.dfs.ny.gov/apps_and_licensing/virtual_currency_businesses) - New York-facing virtual-currency activity may need licensing or an approved exemption path.
- [IRS digital assets](https://www.irs.gov/filing/digital-assets) - digital-asset and distribution records need tax-reporting design before production.

## Shared Founder + Codex workroom

This is the working split. Codex can make the product safer, clearer and review-ready; licensed professionals and regulated providers still control the legal green lights.

| Workstream | Founder lane | Codex lane | Evidence before live |
| --- | --- | --- | --- |
| Offering path | Choose the first property/offering goal, collect business facts and approve only counsel-reviewed marketing. | Keep investing disabled, document gates, expose provider status and prevent any client-side payment from creating ownership. | Counsel memo, intermediary acceptance, approved Form C or selected filing path, marketing review record. |
| Property and issuer | Identify one real property, collect parcel/title/entity documents and confirm the operator/property manager. | Store only public hashes/references on-chain and keep private title, lease, tenant and identity documents out of public metadata. | Title commitment/search, issuer/property LLC records, insurance confirmation, property-management agreement. |
| Investor onboarding | Select the provider workflow and avoid accepting money outside the approved subscription path. | Bind wallet/account state only to provider-confirmed identity, eligibility and subscription status. | KYC/AML/sanctions configuration, investor-limit or accreditation workflow, subscription document flow, jurisdiction rules. |
| Funds, custody and settlement | Select where investor funds legally sit before closing and who controls refunds/cancellations. | Require provider-authoritative settled funds and closing allocations before minting or recording investment units. | Escrow agreement, custody/on-ramp review, settlement reconciliation, refund/cancellation procedure. |
| Token recordkeeping | Approve exactly what the token represents and whether transfers are allowed. | Keep tokens permissioned, capped and separated from the non-economic Property Passport. | Executed rights map, transfer restriction rules, cap-table reconciliation plan, audit-reviewed contracts. |
| Rent distributions | Confirm rent, expenses, reserves and distributable net income before any investor statement. | Distribute only from approved net-income statements and record-date/cap-table snapshots. | Operating account records, expense/reserve policy, approved accounting statement, tax-reporting workflow. |

## Recommended first launch path: retail Regulation Crowdfunding through a registered intermediary

For the first property, the default product path is:

```text
actual property
    -> dedicated property issuer/LLC
    -> title + lien + insurance + property-manager diligence
    -> offering documents approved for the chosen exemption
    -> SEC/FINRA-registered broker-dealer or funding portal
    -> investor education + eligibility + KYC/AML
    -> escrow/payment rail controlled by approved providers
    -> closing
    -> permissioned issuer-sponsored blockchain interest units
    -> 3D Property Passport / digital twin
    -> property operations and accounting
    -> approved net distributions
    -> optional provider-approved reinvestment instruction
```

Regulation Crowdfunding is the preferred first retail path because eligible issuers may currently raise up to $5 million in a 12-month period from accredited and non-accredited investors, subject to the rule's issuer, disclosure, intermediary and investor-limit requirements. Each Reg CF offering must be conducted exclusively through one online platform operated by an SEC/FINRA-registered broker-dealer or funding portal.

Voxel Vault should not attempt to act as an unregistered crowdfunding intermediary. A funding portal also cannot hold investor money or securities, provide investment advice/recommendations, or solicit purchases in prohibited ways. If the desired product activities exceed a funding portal's permitted activities, the implementation should use an appropriately authorized broker-dealer partner.

## Alternative offering paths

### Regulation D Rule 506(c)

Useful for accredited-investor-only offerings and general solicitation. The issuer must take reasonable steps to verify accredited status; a self-certification checkbox alone is not enough.

### Regulation A Tier 2

Potential later scaling route for retail offerings after the first property/operating system is proven. This is a heavier qualification, reporting and operational project and should not be the first engineering milestone unless counsel/intermediary selects it.

## Registered-infrastructure partner category

The production architecture must integrate a registered partner that contractually accepts the regulated functions required for the offering. Current market examples that publicly advertise relevant capabilities include broker-dealer/ATS and white-label providers such as Texture Capital, Rialto Markets and Dalmore Group. They are research candidates, not selected vendors or endorsements.

A selected partner must support, as applicable:

- issuer/offering due diligence;
- investor onboarding;
- KYC/AML and sanctions screening;
- Reg CF investment-limit or Reg D accreditation workflows;
- subscription/e-signature flow;
- escrow/payment processing or approved payment partners;
- broker-dealer/funding-portal supervision required for the chosen offering;
- books and records;
- transfer restrictions and cap-table reconciliation;
- transfer-agent integration where applicable;
- tax/reporting feeds;
- controlled secondary trading only where legally available, potentially through an ATS;
- an authorized API/embedded/white-label integration rather than credential scraping or unofficial browser automation.

## Property entity and title gate

A property cannot enter `verified-live` state until the production workflow has stored evidence of all required approvals in controlled off-chain storage and only public hashes/references on-chain:

1. real street/parcel identity confirmed;
2. recorded ownership confirmed;
3. title commitment/search completed;
4. liens, mortgages and transfer restrictions reviewed;
5. dedicated issuer/property LLC formed and in good standing;
6. deed/conveyance into the intended entity completed or counsel-approved structure documented;
7. insurance confirmed;
8. property manager/operator agreement executed;
9. property financials and reserve policy approved;
10. valuation/underwriting method documented;
11. securities counsel approves the exact token rights and offering structure;
12. registered intermediary accepts the issuer/offering.

The county/state title system remains the authoritative real-property record. Blockchain records do not replace the deed.

## Blockchain design

### Property Passport

One unique non-economic 3D Property Passport may be minted after the property record passes verification. It is the digital identity/twin of the property and contains only public metadata and cryptographic references to verified records. It must not be marketed as the deed or as a separate investment promising appreciation.

### Property Interest Token

The economic token is separate. It represents only the rights explicitly created by the issuer's executed legal documents and approved offering. It remains permissioned and capped.

Production minting rule:

```text
completed subscription
    + intermediary approval
    + cleared/settled funds
    + closing allocation
    + investor wallet/custody eligibility
    -> mint/record exact approved units
```

No employee, API request or environment variable should be able to mint investment units merely because someone paid Voxel Vault directly.

Issuer-sponsored tokenized securities may use a blockchain as part or all of the securityholder record, but the production recordkeeping model must be approved by counsel, intermediary and any transfer-agent/custody providers.

## Investor purchase flow

```text
Create account
 -> identity verification
 -> jurisdiction/eligibility
 -> required educational/risk disclosures
 -> view offering through registered intermediary flow
 -> investment limit/accreditation check
 -> subscription agreement
 -> payment to approved escrow/payment rail
 -> cancellation/closing rules applied
 -> intermediary/issuer closing approval
 -> ownership units recorded/minted
 -> 3D property appears in investor wallet
```

The app must not display an investment as owned while payment is only pending or client-reported. Server/provider-authoritative settlement state controls ownership creation.

## Rent and distribution flow

```text
tenant rent
 -> property manager / property operating account
 -> taxes + insurance + debt + repairs + management
 -> reserve contribution
 -> approved accounting statement
 -> net distributable income
 -> cap-table/record-date snapshot
 -> provider-approved distribution
 -> investor cash/stablecoin rail where legally supported
```

Gross rent is never represented as investor yield.

## Reinvestment rule

The current simulation automatically chooses the next property. Production may not do that by default.

Initial production modes:

- `cash`: distributions remain cash;
- `confirm_each`: Voxel Vault proposes eligible offerings, but the investor confirms each new investment through the registered intermediary;
- `provider_approved_instruction`: an automatic reinvestment instruction may execute only if the registered intermediary and counsel approve the exact workflow, disclosures, allocation rule, authorization, limits and offering availability.

Until that approval exists, `LIVE_AUTOMATIC_REINVESTMENT_ENABLED` must remain false.

## Secondary trading

Do not create an unrestricted peer-to-peer security-token marketplace. Any secondary trading must obey the security's transfer restrictions and use a legally supported mechanism. If an ATS is used, the broker-dealer/ATS partner controls trade eligibility and execution. Tokenization does not guarantee liquidity.

## Production launch gates

A live investment checkout is blocked unless all required gates are true in an authoritative launch record:

- securities counsel approval;
- title/property counsel approval;
- registered intermediary agreement active;
- offering exemption/qualification and filings effective/accepted as required;
- issuer/property entity verified;
- KYC/AML/investor eligibility configured;
- escrow/payment rails configured;
- transfer/cap-table process configured;
- property manager and accounting configured;
- tax reporting configured;
- smart contracts independently audited;
- incident response/pause procedures approved;
- privacy/security review completed;
- production provider integration verified end-to-end.

Environment variables alone must never satisfy this list.

## First real property milestone

The first legally live milestone is not "turn mainnet on." It is one counsel-approved property offering with one registered intermediary and a complete trace:

```text
recorded deed
 -> property issuer
 -> offering
 -> real investor subscription
 -> regulated payment/escrow
 -> closing
 -> approved tokenized ownership record
 -> actual property rent
 -> actual expenses/reserves
 -> approved net distribution
 -> investor statement
```

Only after that loop reconciles should Voxel Vault enable additional properties or any automatic reinvestment feature.
