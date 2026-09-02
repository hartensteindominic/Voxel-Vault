# Launch Galactic Trust Business on the App Store without owning a Mac

You do **not** need to own a Mac for this project. GitHub Actions can rent a macOS runner, build the SwiftUI target with Xcode, sign it, validate it, and upload the IPA to App Store Connect.

The repository already contains the native iOS target. The no-Mac release workflow is `.github/workflows/app-store-release.yml`.

## What still belongs to the app owner

Apple requires the app owner to have an active Apple Developer Program membership and to control the signing and App Store Connect credentials. Those secrets must never be committed to this repository.

You will need:

1. An active Apple Developer Program membership.
2. An App Store Connect app record for **Galactic Trust Business**.
3. Bundle ID: `com.hartensteindominic.galactictrustbusiness`.
4. An **Apple Distribution** certificate exported as a password-protected `.p12`.
5. An **App Store** distribution provisioning profile for the bundle ID above.
6. An App Store Connect API key (`.p8`), Key ID, and Issuer ID for automated upload.
7. Your Apple Developer Team ID.

## Step 1 — Apple Developer Program

Enrollment can be completed on the web or with Apple's Developer app on an iPhone/iPad. App Store distribution requires the paid Apple Developer Program.

If you enroll as an individual, your legal name is the seller name. If you want a company's legal entity name to appear as the seller, the Apple Developer membership must be enrolled as that organization.

## Step 2 — Create the App Store Connect app record

In App Store Connect, create the app with:

- Name: `Galactic Trust Business`
- Primary language: your preferred language
- Bundle ID: `com.hartensteindominic.galactictrustbusiness`
- SKU: any unique internal value, for example `GALACTIC-TRUST-BUSINESS-IOS`

The App Store listing copy and review checklist are already in `APP_STORE_SUBMISSION.md`.

## Step 3 — Create the Apple Distribution certificate without a Mac

You can generate the private key and certificate signing request with OpenSSL on Linux, Chromebook Linux, WSL, or another computer.

Keep the private key private.

```bash
openssl genrsa -out galactic_distribution.key 2048
openssl req -new \
  -key galactic_distribution.key \
  -out galactic_distribution.csr \
  -subj "/CN=Galactic Trust Business/emailAddress=YOUR_APPLE_ACCOUNT_EMAIL"
```

In the Apple Developer site:

1. Open **Certificates, Identifiers & Profiles**.
2. Create a new certificate.
3. Select **Apple Distribution**.
4. Upload `galactic_distribution.csr`.
5. Download the issued certificate, usually named something like `distribution.cer`.

Convert the Apple certificate and private key to a password-protected `.p12`:

```bash
openssl x509 -inform DER \
  -in distribution.cer \
  -out galactic_distribution.pem

openssl pkcs12 -export \
  -inkey galactic_distribution.key \
  -in galactic_distribution.pem \
  -out galactic_distribution.p12
```

OpenSSL will ask you to choose an export password. Save that password securely; it becomes the `APPLE_DISTRIBUTION_P12_PASSWORD` GitHub secret.

## Step 4 — Create the App Store provisioning profile

In **Certificates, Identifiers & Profiles**:

1. Make sure the App ID exists for `com.hartensteindominic.galactictrustbusiness`.
2. Create a new **App Store** distribution provisioning profile.
3. Select the Galactic Trust Business App ID.
4. Select the Apple Distribution certificate created above.
5. Download the `.mobileprovision` file.

The release workflow verifies that the profile's Team ID and application identifier match the app before it attempts an archive.

## Step 5 — Create the App Store Connect API key

In App Store Connect:

1. Open **Users and Access**.
2. Open **Integrations**.
3. Request App Store Connect API access if it is not already enabled for the account.
4. Generate a team API key with a role that is allowed to upload builds.
5. Download the `.p8` private key once and save it securely.
6. Record the **Key ID** and **Issuer ID**.

Apple only lets you download the private `.p8` key once.

## Step 6 — Convert the three files to base64

On Linux or Chromebook Linux:

```bash
base64 -w 0 galactic_distribution.p12 > distribution-p12.base64
base64 -w 0 GalacticTrustBusiness.mobileprovision > provisioning-profile.base64
base64 -w 0 AuthKey_YOURKEYID.p8 > appstore-key.base64
```

The `.base64` files are only temporary helpers. Do not commit them.

## Step 7 — Add GitHub Actions secrets

In the GitHub repository, open:

**Settings → Secrets and variables → Actions → New repository secret**

Create these secrets exactly:

| Secret | Value |
| --- | --- |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_DISTRIBUTION_P12_BASE64` | contents of `distribution-p12.base64` |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | password chosen when creating the `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | contents of `provisioning-profile.base64` |
| `APPSTORE_API_KEY_ID` | App Store Connect Key ID |
| `APPSTORE_ISSUER_ID` | App Store Connect Issuer ID |
| `APPSTORE_API_PRIVATE_KEY_BASE64` | contents of `appstore-key.base64` |

Do not send these credentials in chat and do not put them in source control.

## Step 8 — Run the cloud Mac release

After this workflow is merged to `main`:

1. Open the repository's **Actions** tab.
2. Choose **App Store Release (No Mac Required)**.
3. Choose **Run workflow**.
4. Leave **Validate and upload the signed IPA to App Store Connect** enabled.
5. Start the workflow.

GitHub will provide the Mac. The workflow will:

- use a `macos-15` runner;
- verify Xcode 16 or newer;
- generate the Xcode project and App Store icon;
- build the simulator target;
- run the unit tests;
- install the distribution certificate in a temporary keychain;
- verify and install the App Store provisioning profile;
- archive the Release build for a real iOS device;
- export a signed App Store Connect IPA;
- validate the IPA with Apple's upload service;
- upload it to App Store Connect using the API key;
- delete the temporary signing material at the end of the job.

The workflow does not print or commit the signing credentials.

## Step 9 — Finish in App Store Connect from any browser

Once Apple finishes processing the uploaded build:

1. Select it for version 1.0.
2. Add real iPhone screenshots.
3. Add the Privacy Policy and Support URLs.
4. Complete App Privacy, age rating, pricing, and availability.
5. Add the review notes from `APP_STORE_SUBMISSION.md`.
6. Submit for App Review.

## What this means

Owning a Mac is not the blocker. The blocker is only Apple's account/signing setup. Once the Apple secrets above are in GitHub, the repository can perform the Xcode build and App Store Connect upload on a hosted Mac for you.
