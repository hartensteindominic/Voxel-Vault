# Galactic Trust Business — App Store Connect 1.0

Use this as the copy/paste checklist for the first native iOS submission.

## App identity

- **App name:** Galactic Trust Business
- **Subtitle:** AI Business Finance Manager
- **Bundle ID:** `com.hartensteindominic.galactictrustbusiness`
- **Version:** 1.0.0
- **Build:** 1
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
• Watch invoices and overdue receivables
• Review six-month income vs. expense trends
• Get a simple 30-day planning forecast

ASK YOUR FINANCES

Use the AI Financial Manager to ask plain-language questions such as:

• How much revenue came in this month?
• What is my largest expense category?
• Which invoices are overdue?
• What are my recurring costs?
• How long could my current cash cover this expense pace?

EXPLAINABLE AI

Important insights include a Show Evidence view so you can inspect the transactions behind the analysis instead of relying on an unexplained answer.

IMPORT OR ENTER DATA

Add income and expenses manually or import a CSV exported from many banks and bookkeeping tools. Common date, description, amount, debit, credit, type, and category columns are supported.

PRIVATE BY DESIGN

Version 1.0 analyzes the financial records stored in the app on your device. It does not include an advertising SDK or cross-app tracking, and the AI Financial Manager does not have permission to send payments or move money.

Galactic Trust Business is financial-management software. It is not a bank, accounting firm, tax preparer, lender, or investment adviser. Forecasts and AI summaries are planning aids and may be incomplete when the data you enter or import is incomplete.

## Keywords

`cash flow,expenses,revenue,invoices,business finance,spending,budget,forecast,bookkeeping,AI`

## URLs

Publish these pages from the production Galactic deployment before submitting:

- **Privacy Policy URL:** `https://<YOUR-PRODUCTION-DOMAIN>/business/privacy`
- **Support URL:** `https://<YOUR-PRODUCTION-DOMAIN>/business/support`

The Support page should include a real app-support contact method before App Review. Do not use a private/personal email unless you intentionally want it public.

## App Privacy answers for native version 1.0

The native target currently has no analytics SDK, ad SDK, cloud AI call, account system, or Galactic backend request. Its imported/manual financial records remain in protected local app storage.

For this exact 1.0 build, review the App Privacy questionnaire against the final binary and select the answers consistent with **no data collected by the developer**. Re-evaluate the answers before release if any network SDK or service is added.

Do not reuse the web banking demo's privacy answers automatically; this iOS target has a separate data flow.

## Export compliance

The project currently sets `ITSAppUsesNonExemptEncryption = NO` because it does not implement its own non-exempt encryption. Revisit this declaration if cryptography or networking dependencies change.

## App Review notes

Copy/edit this for Review Notes:

> Galactic Trust Business 1.0 is a business financial-monitoring app, not a bank or money-movement product. No login is required. The first launch includes sample business data so all dashboard, transaction, cash-flow, invoice, and AI insight screens can be reviewed immediately. Reviewers can also add manual transactions or import a CSV through the system file picker. The AI Financial Manager in this release is read-only local financial intelligence over records stored in the app; it cannot initiate payments, transfers, lending, investing, crypto activity, or bank-account changes. Tap any insight with transaction evidence to inspect the records supporting the analysis. More → Security & Privacy includes a control to clear local financial data.

## Screenshot plan

Capture current iPhone screenshots from the real native build, not the concept image. Recommended sequence:

1. **Business dashboard** — cash balance, money received/spent, AI Financial Brief
2. **AI Financial Manager** — plain-language finance question and answer
3. **Cash Flow** — six-month income vs expense chart
4. **Spending Breakdown** — expense categories and recurring-cost insight
5. **Transactions** — income/expense list and categories
6. **Invoices** — outstanding and overdue receivables

Suggested screenshot headlines for the marketing artwork (outside the device screenshot):

- Your business finances, explained
- Ask your numbers anything
- See cash flow before it becomes a problem
- Know where the money is going
- Import transactions in seconds
- Catch overdue revenue sooner

## Archive and upload

1. On a Mac, open Terminal and go to `ios/GalacticTrustBusiness`.
2. Run `bash bootstrap.sh`.
3. In Xcode select the `GalacticTrustBusiness` target → Signing & Capabilities → select your Apple Developer Team.
4. Confirm the final bundle identifier is available in your developer account.
5. Run the app on at least one recent iPhone simulator/device and review every tab.
6. Choose **Any iOS Device (arm64)** as the run destination.
7. Choose **Product → Archive**.
8. In Organizer choose **Distribute App → App Store Connect → Upload**.
9. Select the uploaded build in App Store Connect.
10. Add the final privacy URL, support URL, screenshots, privacy answers, age-rating answers, pricing/availability, and review notes.
11. Submit for review.

## Remaining account-owned items

These cannot safely live in GitHub and must be completed with the app owner's Apple account:

- Apple Developer Team / distribution signing identity
- App Store Connect app record and agreements
- Final public support contact
- Final production domain used for Support and Privacy URLs
- App Store screenshots captured from the signed/native build
- Final App Privacy, age-rating, pricing, and availability selections
