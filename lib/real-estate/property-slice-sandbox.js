const clean = (value) => String(value ?? '').trim();

export const DEFAULT_PROPERTY_SLICE_CENTS = 199;
export const MAX_PROPERTY_SLICE_SANDBOX_CENTS = 70_000;
export const DEFAULT_DEMO_USD_CENTS = 1_240;

function cents(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be an integer number of cents between ${min} and ${max}.`);
  }
  return number;
}

function wholeNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return number;
}

function rounded(value, digits = 8) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

export function buildPropertySliceSandbox(input = {}) {
  // amountCents is the user's benchmark/anchor test price. Example: "my property = $1.99".
  // Every selected property receives a proportional sandbox test price based on its reference value.
  // This preserves the same mathematical fraction across properties without creating any legal ownership.
  const amountCents = cents(
    clean(input.amountCents) === '' ? DEFAULT_PROPERTY_SLICE_CENTS : input.amountCents,
    'Property Slice anchor amount',
    { min: 1, max: MAX_PROPERTY_SLICE_SANDBOX_CENTS },
  );
  const propertyReferencePriceCents = cents(input.propertyReferencePriceCents, 'Selected property reference price', { min: 1 });
  const benchmarkReferencePriceCents = cents(input.benchmarkReferencePriceCents, 'Benchmark property reference price', { min: 1 });

  const relativePropertyPriceIndex = propertyReferencePriceCents / benchmarkReferencePriceCents;
  const relativeSliceWeight = benchmarkReferencePriceCents / propertyReferencePriceCents;
  const rawAdjustedTestPriceCents = amountCents * relativePropertyPriceIndex;
  if (!Number.isFinite(rawAdjustedTestPriceCents) || rawAdjustedTestPriceCents > Number.MAX_SAFE_INTEGER) {
    throw new Error('The selected property comparison is too large for the sandbox pricing model.');
  }

  const adjustedTestPriceCents = Math.max(1, Math.round(rawAdjustedTestPriceCents));
  const hypotheticalFraction = adjustedTestPriceCents / propertyReferencePriceCents;
  const hypotheticalPercent = hypotheticalFraction * 100;
  const benchmarkEquivalentCents = Math.max(1, Math.round(adjustedTestPriceCents * relativeSliceWeight));

  return {
    mode: 'sandbox_property_slice',
    sandboxOnly: true,
    amountCents,
    benchmarkAnchorAmountCents: amountCents,
    defaultAmountCents: DEFAULT_PROPERTY_SLICE_CENTS,
    adjustedTestPriceCents,
    propertyReferencePriceCents,
    benchmarkReferencePriceCents,
    hypotheticalFraction: rounded(hypotheticalFraction, 12),
    hypotheticalPercent: rounded(hypotheticalPercent, 8),
    hypotheticalPartsPerMillion: rounded(hypotheticalFraction * 1_000_000, 4),
    relativePropertyPriceIndex: rounded(relativePropertyPriceIndex, 6),
    relativeSliceWeight: rounded(relativeSliceWeight, 6),
    benchmarkEquivalentCents,
    pricingModel: {
      anchorRule: 'selected_test_price = benchmark_anchor_price × selected_reference_value ÷ benchmark_reference_value',
      benchmarkAnchorAmountCents: amountCents,
      sameProportionalSliceAcrossProperties: true,
    },
    legalEffects: {
      transfersFunds: false,
      purchasesSecurity: false,
      createsDeedOwnership: false,
      createsLlcInterest: false,
      mintsRealEstateSecurity: false,
      reservesProperty: false,
    },
    nextStep: 'Use this as the small-dollar product experience. A real purchase can replace the sandbox result only when an exact property offering, provider minimum, investor eligibility, settlement rail, and independent position verification are all live.',
    note: 'The adjusted price and percentage are mathematical comparisons only. They do not represent legal ownership, equity, rent rights, title, a security, or a claim against the property.',
  };
}

export function buildSandboxPropertyPurchase(input = {}) {
  const slice = buildPropertySliceSandbox(input);
  const demoUsdBalanceCents = cents(
    clean(input.demoUsdBalanceCents) === '' ? DEFAULT_DEMO_USD_CENTS : (input.demoUsdBalanceCents ?? DEFAULT_DEMO_USD_CENTS),
    'Demo USD balance',
    { min: 0, max: 10_000_000 },
  );
  const existingDemoUnits = wholeNumber(input.existingDemoUnits ?? 0, 'Existing demo property slices', { min: 0, max: 100_000 });

  if (slice.adjustedTestPriceCents > demoUsdBalanceCents) {
    throw new Error(`Not enough demo USD for this test buy. The sandbox price is $${(slice.adjustedTestPriceCents / 100).toFixed(2)} and the demo USD balance is $${(demoUsdBalanceCents / 100).toFixed(2)}.`);
  }

  const demoUsdAfterCents = demoUsdBalanceCents - slice.adjustedTestPriceCents;
  const demoUnitsAfter = existingDemoUnits + 1;

  return {
    mode: 'sandbox_property_slice_purchase',
    sandboxOnly: true,
    slice,
    purchase: {
      selectedName: clean(input.selectedName) || 'Selected property',
      debitDemoUsdCents: slice.adjustedTestPriceCents,
      demoUnitsAdded: 1,
      demoUnitsAfter,
      hypotheticalPercentPerUnit: slice.hypotheticalPercent,
    },
    balances: {
      demoUsdBeforeCents: demoUsdBalanceCents,
      demoUsdAfterCents,
    },
    legalEffects: {
      transfersRealFunds: false,
      createsBankDeposit: false,
      executesCryptoTrade: false,
      cashesOutNft: false,
      purchasesSecurity: false,
      createsDeedOwnership: false,
      createsLlcInterest: false,
      mintsNft: false,
      mintsRealEstateSecurity: false,
      reservesProperty: false,
    },
    note: 'This test buy only debits the on-device demo USD balance and adds a sandbox property-slice counter. It does not move money, buy a security, reserve a property, create title/equity, or mint an NFT.',
  };
}

export function buildUnifiedAssetConversionPreview(input = {}) {
  const settledUsdCents = cents(input.settledUsdCents ?? 0, 'Settled USD balance', { min: 0 });
  const estimatedCryptoValueCents = cents(input.estimatedCryptoValueCents ?? 0, 'Estimated crypto value', { min: 0 });
  const estimatedNftValueCents = cents(input.estimatedNftValueCents ?? 0, 'Estimated NFT value', { min: 0 });
  const propertyGoalCents = cents(input.propertyGoalCents ?? 0, 'Property goal balance', { min: 0 });

  const estimatedTotalCents = settledUsdCents + estimatedCryptoValueCents + estimatedNftValueCents + propertyGoalCents;

  return {
    mode: 'unified_asset_conversion_preview',
    balances: {
      settledUsdCents,
      estimatedCryptoValueCents,
      estimatedNftValueCents,
      propertyGoalCents,
      estimatedTotalCents,
    },
    spendableNowCents: settledUsdCents,
    conversionRoutes: [
      {
        from: 'nft',
        to: 'usd',
        status: 'provider_required',
        description: 'List or sell the NFT through an approved marketplace/off-ramp; only settled sale proceeds become USD.',
      },
      {
        from: 'nft',
        to: 'crypto',
        status: 'provider_required',
        description: 'A marketplace sale may settle in supported crypto when the marketplace and wallet flow permit it.',
      },
      {
        from: 'crypto',
        to: 'usd',
        status: 'provider_required',
        description: 'Use an approved exchange/off-ramp. Estimated crypto value is not a cash balance until the trade settles.',
      },
      {
        from: 'usd',
        to: 'property',
        status: 'verified_offering_required',
        description: 'USD can fund a property position only through a verified offering that accepts the amount and user.',
      },
    ],
    custody: {
      usd: 'partner_bank_or_payment_provider_required_for_live_customer_funds',
      crypto: 'prefer_user_controlled_wallet_until_licensed_custody_is_integrated',
      nft: 'user_wallet_or_verified_platform_asset_record',
      property: 'provider_and_legal_entity_records_control_real_rights',
    },
    legalEffects: {
      transfersFunds: false,
      executesTrade: false,
      cashesOutNft: false,
      cashesOutCrypto: false,
      createsDepositAccount: false,
      createsPropertyOwnership: false,
    },
    note: 'This is a unified dashboard preview, not a bank, exchange, broker, escrow service, or custody service. Only settled balances from approved live providers should become spendable.',
  };
}
