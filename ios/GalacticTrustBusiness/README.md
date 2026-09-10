# Galactic Trust Business for iOS

A native SwiftUI business-finance monitor based on the Galactic Trust visual system. This target is intentionally separate from the consumer-banking web demo.

## What ships in 1.0

- Business dashboard with cash balance, money received, money spent, net cash flow, receivables, and recent activity.
- Explainable financial insights with transaction evidence.
- Read-only AI Financial Manager for questions about revenue, spending, invoices, recurring costs, balance, and runway.
- Manual income/expense entry.
- CSV import from common bank and bookkeeping exports.
- Expense categorization and recurring-cost detection.
- Cash-flow charts and a simple 30-day planning forecast.
- Invoice/receivables monitoring.
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

The first launch contains sample business data so every dashboard and AI screen can be reviewed immediately. The user can replace it with manual records or imported CSV data.

## App Store archive

Before archiving, set your Apple Developer Team under **Signing & Capabilities**. Xcode will manage the provisioning profile when Automatic Signing is enabled.

Then:

1. Set the run destination to **Any iOS Device (arm64)**.
2. Choose **Product → Archive**.
3. In Organizer choose **Distribute App → App Store Connect → Upload**.
4. Complete the App Store Connect listing using `APP_STORE_SUBMISSION.md` in this folder.

The repository cannot create a signed App Store archive without the Apple Developer account/team certificate and App Store Connect access. Those credentials should stay in Xcode/App Store Connect and must not be committed to GitHub.

## CSV format

The importer accepts typical headers such as:

```csv
Date,Description,Amount
08/31/2026,Client Payment,4500.00
08/30/2026,AWS,-638.25
```

It also accepts separate `Debit` and `Credit` columns. Quoted CSV fields and common date formats are supported.

## Privacy posture for 1.0

This target does not make network requests. Business records are saved in the application container with iOS complete file protection. The AI manager in 1.0 is explainable local financial intelligence over the user's stored records; it does not transmit financial data to a cloud model. If a cloud AI or bank-data integration is added later, update the privacy manifest, privacy policy, App Store privacy answers, disclosures, and security review before release.

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
```
