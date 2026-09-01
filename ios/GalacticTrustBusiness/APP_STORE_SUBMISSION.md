# Galactic Trust Business — App Store Connect 1.0

Use this as the source-of-truth checklist for the first native iOS submission.

## App identity

- **App name:** Galactic Trust Business
- **Subtitle:** AI Business Finance Manager
- **Bundle ID:** `com.hartensteindominic.galactictrustbusiness`
- **Version:** 1.0
- **Build:** deterministic positive integer assigned from the `main` Git commit count by the release workflows
- **Primary category:** Finance
- **Secondary category:** Business
- **Age rating:** 4+ is consistent with the current native binary if the App Store Connect questionnaire remains truthful; the app contains no gambling, alcohol, tobacco, sexual, violent, or user-generated social content.

## Promotional text

Know what came in, what went out, what changed, and what needs attention—without giving AI permission to move your money.

## Description

Galactic Trust Business is an AI-powered financial monitor built for business owners who want a clear picture of recorded cash activity without a complicated accounting dashboard.

See the business at a glance:

• Track money received and money spent
• Monitor net cash flow and recorded cash
• Set starting cash without counting it as revenue
• See expenses grouped by business category
• Surface recurring operating costs
• Add and monitor invoices and overdue receivables
• Review six-month income vs. expense trends
• Get a rolling 30-day planning forecast with Galactic Pro

ASK YOUR FINANCES

Use the AI Financial Manager to ask plain-language questions such as:

• How much revenue came in this month?
• Why did spending change?
• Which invoices are overdue?
• What are my recurring costs?
• How long could my recorded cash cover this expense pace?

Free users receive a limited monthly AI allowance. Galactic Pro unlocks unlimited AI Financial Manager questions plus advanced forecasts, reports, and alerts.

EXPLAINABLE AI

Important insights include a Show Evidence view so you can inspect the transactions behind the analysis instead of relying on an unexplained answer. Version 1.0 deliberately distinguishes recorded cash flow from accounting profit or net income.

IMPORT OR ENTER DATA

Add income and expenses manually or import a dated CSV exported from many banks and bookkeeping tools. Common date, description, amount, debit, credit, type, and category columns are supported. The importer rejects malformed, non-finite, zero-value, and future-dated activity; preserves legitimate repeated charges; and avoids re-adding records it has already imported. New workspaces intentionally begin at $0 with no fabricated business activity.

PRIVATE BY DESIGN

Version 1.0 analyzes the financial records stored in the app on your device. It does not include an advertising SDK or cross-app tracking, and the AI Financial Manager does not have permission to send payments or move money. The local financial file uses iOS complete file protection and atomic saves. If an existing local workspace cannot be decoded, the app does not silently overwrite it; it shows an explicit recovery screen instead. Galactic Pro purchases are processed by Apple through StoreKit.

Galactic Trust Business is financial-management software. It is not a bank, accounting firm, tax preparer, lender, or investment adviser. Forecasts and AI summaries are planning aids and may be incomplete when the data you enter or import is incomplete.

## Keywords

`cash flow,expenses,revenue,invoices,business finance,spending,budget,forecast,bookkeeping,AI`

## URLs

Intended production URLs:

- **Privacy Policy URL:** `https://voxelvault.io/business/privacy`
- **Support URL:** `https://voxelvault.io/business/support`

Both routes exist in the repository. Both signed release workflows now fail before upload unless each public URL responds successfully and contains the expected Galactic Trust Business content. The app also links to the privacy policy and support page from **More → Security & Privacy**.

Do not submit if either production URL redirects to an error, login, placeholder, or staging-only page.

## App Privacy answers for native version 1.0

The native target currently has no analytics SDK, ad SDK, cloud AI call, account system, bank-data connection, or Galactic backend request. Imported/manual financial records remain in protected local app storage. Galactic Pro purchase and restore flows use Apple StoreKit; the developer does not receive the business financial records through that flow.

For this exact 1.0 build, review the App Privacy questionnaire against the final processed binary and keep answers consistent with **no data collected by the developer** if the final binary remains on-device as described above. Re-evaluate before release if any analytics, cloud AI, authentication, bank connection, telemetry, or developer-operated backend is added.

The privacy manifest declares no tracking or collected data and includes the approved UserDefaults required-reason declaration used by the app's local free-AI allowance state.

Do not reuse the web banking demo's privacy answers automatically; this iOS target has a separate data flow.

## Export compliance

The project sets `ITSAppUsesNonExemptEncryption = NO` because it does not implement its own non-exempt encryption. Revisit this declaration if cryptography or networking dependencies change.

## Galactic Pro subscriptions

The native app expects these exact auto-renewable subscription product IDs:

- Monthly: `com.hartensteindominic.galactictrustbusiness.pro.monthly`
- Annual: `com.hartensteindominic.galactictrustbusiness.pro.yearly`

The paywall loads localized price and subscription information directly from StoreKit and includes Restore Purchases, Terms of Use, Privacy Policy, and Apple subscription-management access.

Before review, confirm both products are complete in App Store Connect, have localization and pricing, have the required App Review screenshot/review information, are attached to the 1.0 submission as required, and can be purchased/restored in a sandbox or TestFlight build. The Paid Applications agreement, tax setup, and banking setup must also be complete before expecting Apple to remit subscription proceeds.

## Native data and financial-semantics audit

The current 1.0 branch is intentionally conservative:

- starting cash changes recorded cash but is not counted as revenue
- future-dated activity is not accepted as actual transaction history
- draft invoices are not counted as outstanding or overdue
- sent past-due invoices and explicitly overdue invoices are counted as overdue
- percentage trend alerts require a real prior-month baseline
- dashboard labels say **Net Cash Flow** and **Recorded Cash**, not accounting profit or a connected bank balance
- the Pro 30-day forecast uses the average daily net cash flow from up to the latest 30 calendar days of recorded activity rather than repeating an incomplete month-to-date total
- cash coverage uses an estimated rolling 30-day expense pace and is labeled as a planning estimate
- CSV imports require dates, reject malformed/non-finite/future activity, preserve legitimate repeated charges, and suppress previously imported records
- local mutations are saved atomically; a failed save rolls the in-memory mutation back
- an unreadable existing local financial file is not automatically overwritten
- restoring the bundled sample workspace replaces the workspace in one atomic save rather than clearing and rebuilding it record-by-record

## App Review notes

Copy/edit this for Review Notes:

> Galactic Trust Business 1.0 is business financial-management software, not a bank or money-movement product. No login is required. A new workspace intentionally starts at $0 with no fabricated user activity. To review a populated workspace, open More → About → Restore sample business data; after confirmation, this atomically loads bundled local example records for the dashboard, transactions, cash flow, invoices, and AI insights. Reviewers can also set Starting Cash, add transactions, add and update invoice tracking records, or import a dated CSV through the system file picker. The AI Financial Manager is read-only local financial intelligence over records stored in the app and cannot initiate payments, transfers, lending, investing, crypto activity, or bank-account changes. It distinguishes recorded cash flow from accounting profit. Tap an insight with transaction evidence to inspect the records supporting it. Galactic Pro uses Apple StoreKit auto-renewable subscriptions. Free users receive 3 AI questions per calendar month; Pro unlocks unlimited AI questions plus the rolling 30-day forecast, advanced reports, and advanced alerts. Purchase and Restore Purchases are available from the Galactic Pro paywall. More → Security & Privacy includes the public Privacy Policy, Support link, and a control to clear local financial data.

## Screenshot plan

Use screenshots from the real native simulator build. Do not fabricate product UI.

The GitHub workflow `.github/workflows/ios-build-now.yml` captures:

1. **iPhone — Dashboard**
2. **iPhone — Transactions**
3. **iPhone — Cash Flow**
4. **iPhone — AI Financial Manager**
5. **iPad 13-inch — Dashboard**

The workflow converts captures to high-quality JPEG/no-alpha files and verifies their pixel dimensions against accepted large-iPhone and 13-inch iPad App Store screenshot sizes before publishing the artifact.

The screenshot-only launch argument loads bundled sample records solely in the simulator used by the workflow. Normal customer installs still begin at $0.

Because the target supports both iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), keep a valid 13-inch iPad screenshot in App Store Connect as well as the required iPhone screenshots.

Suggested screenshot headlines for optional marketing artwork outside the captured device content:

- Your business finances, explained
- Ask your numbers anything
- See cash flow before it becomes a problem
- Know where the money is going
- Import transactions in seconds
- Catch overdue revenue sooner

## No-Mac build, signing, and upload

The intended release path uses GitHub Actions hosted macOS rather than requiring a local Mac.

### Preferred: App Store Connect API key / Xcode cloud signing

Workflow: **App Store Release (No Mac Required)**

Required GitHub Actions secrets:

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`

The workflow:

1. can upload only from `main`
2. uses the full Git history to assign a deterministic `CFBundleVersion` from the `main` commit count
3. verifies Xcode 26 or newer
4. verifies the public Privacy Policy and Support routes
5. builds and runs the native unit tests
6. writes the `.p8` only to the temporary runner
7. creates the release archive
8. uses Xcode/App Store Connect authentication and cloud-managed distribution signing to export/upload
9. deletes the temporary API-key file

The Team API key must have sufficient App Store Connect permissions for the upload and cloud-managed distribution signing path.

### Fallback: persistent P12 + App Store profile

Workflow: **App Store Release (No p8 Fallback)**

Required secrets:

- `APPLE_TEAM_ID`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_DISTRIBUTION_P12_BASE64`
- `APPLE_DISTRIBUTION_P12_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`

The fallback is also `main`-only and uses the same deterministic build-number strategy. It validates that the P12 installs a usable Apple Distribution identity and that the provisioning profile matches the team and bundle ID, is not a development/ad-hoc profile, and is not expired. Wrapped or single-line base64 secrets are both accepted. Temporary certificate/profile/keychain material is deleted at the end of the run.

The legacy Fastlane lane that created ephemeral distribution certificates on clean CI runners is intentionally disabled so repeated releases cannot consume Apple Distribution certificate slots.

## Final release sequence

1. Finish this PR review and stop changing the candidate.
2. Require green results on the exact PR head for:
   - Galactic Trust quality gate
   - Galactic Trust Business iOS
   - iOS Build Now (No Signing)
3. Inspect the fresh exact-head screenshot artifact visually.
4. Squash-merge the reviewed PR into `main`.
5. Confirm Galactic Pro products are complete and sandbox-visible.
6. Confirm the required signing/upload secrets are present in GitHub Actions.
7. Run the preferred App Store release workflow on `main`.
8. If the API-key cloud-signing route is unavailable because of Apple account permissions, use the hardened no-p8 fallback with the persistent distribution P12/profile.
9. Wait for Apple to process the uploaded build, then select it under version 1.0.
10. Upload the fresh native iPhone and iPad screenshots.
11. Attach/review the Galactic Pro subscriptions.
12. Reconfirm Privacy, age rating, pricing/availability, export compliance, App Review contact information, and Review Notes against the processed binary.
13. Submit for App Review.

## Final pre-submit blockers

Do not press Submit for Review until all of these are true:

- native iOS workflow is green on the exact release-candidate commit
- unit tests are green
- App Store screenshot artifact exists and the screenshots have been visually reviewed
- signed App Store build validates and appears in App Store Connect under version 1.0
- both Galactic Pro products load and purchase/restore correctly in sandbox or TestFlight
- Privacy Policy and Support URLs are publicly reachable
- App Privacy answers still match the final binary
- Paid Applications agreement, tax, and banking setup are complete if subscription proceeds are expected
- App Review contact information is current
- Review Notes describe the $0 first launch, Starting Cash, local AI, and sample-data path accurately
- no new SDK, backend, analytics, bank connection, or cloud AI change has been added after the privacy review

## Account-owned items

These remain tied to the app owner's Apple account and cannot safely live in a public repository:

- Apple Developer Team and distribution signing authority
- App Store Connect API private key or distribution private key
- App Store Connect agreements, tax, and banking status
- final subscription metadata, localization, App Review screenshot/review information, and pricing
- final public support-contact decision
- final App Privacy, age-rating, pricing, availability, and review selections
