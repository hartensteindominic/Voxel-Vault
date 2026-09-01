# Galactic Trust Business for iOS

A native SwiftUI business-finance monitor based on the Galactic Trust visual system. This target is intentionally separate from the consumer-banking web demo.

## What ships in 1.0

- Business dashboard with cash balance, money received, money spent, net cash flow, receivables, and recent activity.
- New businesses start at a clean $0 workspace with no fake transactions or invoices.
- Explainable financial insights with transaction evidence.
- Read-only AI Financial Manager for questions about revenue, spending, invoices, recurring costs, balance, and runway.
- Three free AI finance questions per calendar month; Galactic Pro unlocks unlimited AI questions.
- Manual income/expense entry.
- CSV import from common bank and bookkeeping exports.
- Expense categorization and recurring-cost detection.
- Cash-flow charts; Galactic Pro unlocks the 30-day planning forecast and runway analysis.
- Invoice/receivables monitoring.
- Galactic Pro StoreKit subscriptions with purchase, restore, and entitlement handling.
- Protected local persistence using iOS complete file protection.
- No money movement, card controls, lending, crypto trading, or bank-account custody in this target.
- No advertising SDK or cross-app tracking.

## First build on a Mac

From this directory:

```bash
bash bootstrap.sh
```

That command generates the 1024x1024 App Store icon and the Xcode project, then opens Xcode.

If XcodeGen is not already installed, the bootstrap script installs it with Homebrew. You can also run the steps manually:

```bash
brew install xcodegen
python3 scripts/generate_app_icon.py
xcodegen generate
open GalacticTrustBusiness.xcodeproj
```

## Run

1. In Xcode, choose the **GalacticTrustBusiness** scheme.
2. Choose an iPhone simulator or a connected iPhone.
3. Press Run.

A new installation starts at $0. For demos and App Review preparation, **More → About → Restore sample business data** can load the bundled sample workspace.

## App Store archive

Before archiving, set your Apple Developer Team under **Signing & Capabilities**. Xcode will manage the provisioning profile when Automatic Signing is enabled.

Then:

1. Set the run destination to **Any iOS Device (arm64)**.
2. Choose **Product → Archive**.
3. In Organizer choose **Distribute App → App Store Connect → Upload**.
4. Complete the App Store Connect listing using `APP_STORE_SUBMISSION.md` in this folder.
5. Create the matching Galactic Pro auto-renewable subscriptions using `MONETIZATION_SETUP.md` before expecting the paywall to sell products.

The repository cannot create Apple account records such as subscription products, banking agreements, tax forms, or signed distribution credentials by itself. Those account-owned items must be completed in App Store Connect and should never be committed to GitHub.

## CSV format

The importer accepts typical headers such as:

```csv
Date,Description,Amount
08/31/2026,Client Payment,4500.00
08/30/2026,AWS,-638.25
```

It also accepts separate `Debit` and `Credit` columns. Quoted CSV fields and common date formats are supported.

## Privacy posture for 1.0

Business financial records are saved in the application container with iOS complete file protection. The AI manager in 1.0 is explainable local financial intelligence over the user's stored records; it does not transmit business financial records to a cloud model or Galactic server. The app uses Apple's StoreKit framework to load subscription products and verify Apple-provided subscription entitlements. It does not include a Galactic analytics SDK, ad SDK, or cross-app tracking. Re-check App Store privacy answers against the final binary whenever networking, cloud AI, bank-data integrations, analytics, or other third-party SDKs are added.

## Architecture

```text
SwiftUI UI
   ↓
FinancialStore
   ├─ local protected JSON vault
   ├─ cash-flow calculations
   ├─ insight engine
   └─ explainable Q&A

CSV file → CSVImportService → normalized transactions → FinancialStore

StoreKit 2 → SubscriptionManager → Pro entitlement → premium feature gates
```
