# Galactic Trust Business — App Store Connect 1.0

Use this as the copy/paste checklist for the first native iOS submission.

## App identity

- **App name:** Galactic Trust Business
- **Subtitle:** AI Business Finance Manager
- **Bundle ID:** `com.hartensteindominic.galactictrustbusiness`
- **Version:** 1.0.0
- **Build:** assigned by the release workflow
- **Primary category:** Finance
- **Secondary category:** Business
- **Age rating:** Complete the App Store Connect questionnaire truthfully; the app itself contains no gambling, alcohol, tobacco, sexual, violent, or user-generated social content.

## Promotional text

Know what came in, what went out, what changed, and what needs attention—without giving AI permission to move your money.

## Description

Galactic Trust Business is an AI-powered financial monitor built for business owners who want a clear picture of cash flow without a complicated accounting dashboard.

See the business at a glance:

• Track money received and money spent
• Monitor net cash flow and recorded cash balance
• See expenses grouped by business category
• Surface recurring operating costs
• Add and monitor invoices and overdue receivables
• Review six-month income vs. expense trends
• Get a simple 30-day planning forecast with Galactic Pro

ASK YOUR FINANCES

Use the AI Financial Manager to ask plain-language questions such as:

• How much revenue came in this month?
• What is my largest expense category?
• Which invoices are overdue?
• What are my recurring costs?
• How long could my current cash cover this expense pace?

Free users receive a limited monthly AI allowance. Galactic Pro unlocks unlimited AI Financial Manager questions plus advanced forecasts, reports, and alerts.

EXPLAINABLE AI

Important insights include a Show Evidence view so you can inspect the transactions behind the analysis instead of relying on an unexplained answer.

IMPORT OR ENTER DATA

Add income and expenses manually or import a CSV exported from many banks and bookkeeping tools. Common date, description, amount, debit, credit, type, and category columns are supported. New workspaces intentionally begin at $0 with no fabricated business activity.

PRIVATE BY DESIGN

Version 1.0 analyzes the financial records stored in the app on your device. It does not include an advertising SDK or cross-app tracking, and the AI Financial Manager does not have permission to send payments or move money. Galactic Pro purchases are processed by Apple through StoreKit.

Galactic Trust Business is financial-management software. It is not a bank, accounting firm, tax preparer, lender, or investment adviser. Forecasts and AI summaries are planning aids and may be incomplete when the data you enter or import is incomplete.

## Keywords

`cash flow,expenses,revenue,invoices,business finance,spending,budget,forecast,bookkeeping,AI`

## URLs

Intended production URLs:

- **Privacy Policy URL:** `https://voxelvault.io/business/privacy`
- **Support URL:** `https://voxelvault.io/business/support`

Both routes exist in the repository. Before submission, verify that both URLs respond publicly on the production domain and do not redirect to an error, login, placeholder, or staging page. The app also links to the privacy policy and support page from **More → Security & Privacy**.

## App Privacy answers for native version 1.0

The native target currently has no analytics SDK, ad SDK, cloud AI call, account system, or Galactic backend request. Imported/manual financial records remain in protected local app storage. Galactic Pro purchase and restore flows use Apple StoreKit; the developer does not receive the business financial records through that flow.

For this exact 1.0 build, review the App Privacy questionnaire against the final binary and select answers consistent with **no data collected by the developer** if the final binary remains on-device as described above. Re-evaluate before release if any analytics, cloud AI, authentication, bank connection, telemetry, or developer-operated backend is added.

Do not reuse the web banking demo's privacy answers automatically; this iOS target has a separate data flow.

## Export compliance

The project sets `ITSAppUsesNonExemptEncryption = NO` because it does not implement its own non-exempt encryption. Revisit this declaration if cryptography or networking dependencies change.

## Galactic Pro subscriptions

The native app expects these exact auto-renewable subscription product IDs:

- Monthly: `com.hartensteindominic.galactictrustbusiness.pro.monthly`
- Annual: `com.hartensteindominic.galactictrustbusiness.pro.yearly`

The paywall loads localized price and subscription information directly from StoreKit and includes Restore Purchases, Terms of Use, Privacy Policy, and Apple subscription-management access.

Before review, confirm both products are complete in App Store Connect, have localization and pricing, are attached to the 1.0 submission as required, and can be seen in a sandbox/TestFlight build.

## App Review notes

Copy/edit this for Review Notes:

> Galactic Trust Business 1.0 is business financial-management software, not a bank or money-movement product. No login is required. A new workspace intentionally starts at $0 with no fabricated user activity. To review a populated workspace, open More → About → Restore sample business data; this loads bundled local example records for the dashboard, transactions, cash flow, invoices, and AI insights. Reviewers can also add transactions, add and update invoice tracking records, or import a CSV through the system file picker. The AI Financial Manager is read-only local financial intelligence over records stored in the app and cannot initiate payments, transfers, lending, investing, crypto activity, or bank-account changes. Tap an insight with transaction evidence to inspect the records supporting it. Galactic Pro uses Apple StoreKit auto-renewable subscriptions. Free users receive 3 AI questions per calendar month; Pro unlocks unlimited AI questions plus the 30-day forecast, advanced reports, and advanced alerts. Purchase and Restore Purchases are available from the Galactic Pro paywall. More → Security & Privacy includes the public Privacy Policy, Support link, and a control to clear local financial data.

## Screenshot plan

Use screenshots from the real native simulator build. Do not fabricate product UI.

The GitHub workflow `.github/workflows/ios-build-now.yml` now captures:

1. **iPhone — Dashboard**
2. **iPhone — Transactions**
3. **iPhone — Cash Flow**
4. **iPhone — AI Financial Manager**
5. **iPad 13-inch — Dashboard**

The screenshot-only launch argument loads bundled sample records solely in the simulator used by the workflow. Normal customer installs still begin at $0.

Because the target supports both iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), keep a valid 13-inch iPad screenshot in App Store Connect as well as the required iPhone screenshots.

Suggested screenshot headlines for optional marketing artwork outside the captured device content:

- Your business finances, explained
- Ask your numbers anything
- See cash flow before it becomes a problem
- Know where the money is going
- Import transactions in seconds
- Catch overdue revenue sooner

## No-Mac archive and upload

The intended release path uses GitHub Actions hosted macOS rather than a local Mac.

1. Merge the final reviewed iOS changes to `main` only after the native build, unit tests, screenshot capture, and quality gate are green.
2. Confirm the required Apple signing/upload secrets exist in GitHub Actions.
3. Run the App Store release workflow on GitHub’s hosted Mac.
4. The workflow must build with Xcode 26 or newer, archive, sign, validate, and upload the `.ipa` to App Store Connect.
5. Wait for Apple to process the uploaded build, then select it under version 1.0.
6. Upload the real native iPhone and iPad screenshots.
7. Attach/review the Galactic Pro subscriptions.
8. Confirm Privacy, age rating, pricing/availability, export compliance, App Review contact information, and Review Notes.
9. Submit for App Review.

## Final pre-submit blockers

Do not press Submit for Review until all of these are true:

- native iOS workflow is green on the exact commit being submitted
- unit tests are green
- App Store screenshot artifact exists and has valid iPhone and 13-inch iPad images
- signed App Store build validates and appears in App Store Connect
- both Galactic Pro products load in sandbox/TestFlight
- Privacy Policy and Support URLs are publicly reachable
- App Privacy answers still match the final binary
- Paid Applications agreement, tax, and banking setup are complete if subscription proceeds are expected
- App Review contact information is current
- Review Notes describe the $0 first launch and sample-data path accurately

## Account-owned items

These remain tied to the app owner’s Apple account and cannot safely live in a public repository:

- Apple Developer Team / distribution signing identity
- App Store Connect agreements, tax, and banking status
- final App Store Connect subscription metadata and pricing
- final public support contact decision
- final App Privacy, age-rating, pricing, availability, and review selections
