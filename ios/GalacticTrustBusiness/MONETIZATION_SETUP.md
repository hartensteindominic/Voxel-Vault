# Galactic Trust Business — Monetization Setup

The native app now contains StoreKit 2 subscription purchase, restore, entitlement, and paywall code. Revenue does **not** begin until the matching auto-renewable subscriptions are created in App Store Connect and approved by Apple.

## Subscription group

Create one auto-renewable subscription group:

- **Reference name:** `Galactic Pro`

## Products

Create these two auto-renewable subscriptions exactly as written so they match the IDs compiled into the app.

### Galactic Pro Monthly

- **Reference name:** `Galactic Pro Monthly`
- **Product ID:** `com.hartensteindominic.galactictrustbusiness.pro.monthly`
- **Duration:** 1 Month
- **Suggested US price:** $9.99 USD
- **Display name:** `Galactic Pro Monthly`
- **Description:** `Unlimited AI financial analysis, advanced forecasts, reports, and business alerts.`

### Galactic Pro Annual

- **Reference name:** `Galactic Pro Annual`
- **Product ID:** `com.hartensteindominic.galactictrustbusiness.pro.yearly`
- **Duration:** 1 Year
- **Suggested US price:** $79.99 USD
- **Display name:** `Galactic Pro Annual`
- **Description:** `A full year of unlimited AI financial analysis, advanced forecasts, reports, and business alerts.`

The app reads localized pricing directly from StoreKit, so the UI does not hard-code dollar amounts.

## Free vs Pro

Free users keep the core business-finance utility:

- dashboard and $0-first workspace
- manual transactions and CSV import
- transaction search and categories
- invoices and receivables monitoring
- current cash-flow view
- 3 AI Financial Manager questions per calendar month

Galactic Pro unlocks:

- unlimited AI Financial Manager questions
- 30-day cash-flow forecast and runway analysis
- advanced alerts center
- six-month advanced reports

## App Store Connect checklist

1. Open **My Apps → Galactic Trust Business → Subscriptions**.
2. Create the `Galactic Pro` subscription group.
3. Add the monthly product with the exact monthly Product ID above.
4. Add the annual product with the exact annual Product ID above.
5. Add English (U.S.) localization to each product.
6. Choose the desired price points. The suggested launch prices are $9.99/month and $79.99/year.
7. Complete the subscription review information Apple requests.
8. Confirm the Paid Applications agreement, tax, and banking information are active in App Store Connect. Apple cannot remit proceeds until those account requirements are complete.
9. Attach the subscriptions to the first app version submission when App Store Connect prompts for In-App Purchases / Subscriptions.
10. Test purchases with StoreKit sandbox/TestFlight before submission.

## Product IDs in source

The IDs live in `GalacticTrustBusiness/SubscriptionManager.swift`. If App Store Connect products are created with different IDs, StoreKit will return no products and the paywall cannot sell subscriptions.

## Revenue accounting

The dashboard's `Total Revenue` is the app user's business revenue. It is unrelated to developer subscription proceeds. Developer proceeds are handled by Apple through App Store Connect financial reports and payments, net of applicable commission, taxes, refunds, and adjustments.
