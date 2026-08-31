#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required to install XcodeGen. Install Homebrew from https://brew.sh, then rerun this script."
    exit 1
  fi
  brew install xcodegen
fi

python3 scripts/generate_app_icon.py
xcodegen generate
open GalacticTrustBusiness.xcodeproj

echo "Galactic Trust Business is ready in Xcode. Set your Apple Developer Team before archiving for App Store Connect."
