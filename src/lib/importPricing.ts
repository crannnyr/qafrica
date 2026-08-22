// src/lib/importPricing.ts
//
// Shared currency + markup logic for the "Import from China" section.
// Mirrored (duplicated, not imported — edge functions are standalone Deno
// files) inside supabase edge function `china-import`. If you change the
// markup table or fixed rate here, update it there too.

/** Fixed USD -> NGN rate. Not live-fetched; set explicitly per business decision. */
export const USD_TO_NGN_RATE = 1480;

/** Fallback CNY -> USD rate, used only if the live rate fetch fails. ~¥7.15 = $1 */
export const FALLBACK_CNY_TO_USD = 1 / 7.15;

export type ImportCurrency = 'ngn' | 'usd' | 'cny';

/**
 * Tiered flat-naira markup, replacing the old flat 1% multiplicative markup.
 * Applied to the converted, pre-markup NGN cost.
 */
export function getTieredMarkupNgn(baseNgn: number): number {
  if (baseNgn < 10_000) return 1_000;
  if (baseNgn < 20_000) return 1_500;
  if (baseNgn < 50_000) return 2_000;
  if (baseNgn < 100_000) return 5_000;
  if (baseNgn < 200_000) return 9_000;
  return 25_000; // stable flat add above ₦200,000
}

export interface ImportRates {
  usdToNgn: number;
  cnyToUsd: number;
}

export interface ImportPriceBreakdown {
  costNgn: number;   // pre-markup cost basis in NGN
  markupNgn: number; // tiered markup added
  priceNgn: number;  // final customer price in NGN
  priceUsd: number;  // final customer price in USD
  priceCny: number;  // final customer price in CNY
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Given an admin-entered amount in any of the three supported currencies,
 * compute the cost basis, tiered markup, and final price in all three
 * currencies — all aligned to the same fixed USD/NGN rate.
 */
export function computeImportPricing(
  input: { amount: number; currency: ImportCurrency },
  rates: ImportRates = { usdToNgn: USD_TO_NGN_RATE, cnyToUsd: FALLBACK_CNY_TO_USD }
): ImportPriceBreakdown {
  const { usdToNgn, cnyToUsd } = rates;

  let costNgn: number;
  if (input.currency === 'ngn') {
    costNgn = input.amount;
  } else if (input.currency === 'usd') {
    costNgn = input.amount * usdToNgn;
  } else {
    // cny -> usd -> ngn, so CNY stays aligned to the same fixed usdToNgn rate
    costNgn = input.amount * cnyToUsd * usdToNgn;
  }

  const markupNgn = getTieredMarkupNgn(costNgn);
  const priceNgn = costNgn + markupNgn;
  const priceUsd = priceNgn / usdToNgn;
  const priceCny = priceUsd / cnyToUsd;

  return {
    costNgn: round2(costNgn),
    markupNgn,
    priceNgn: round2(priceNgn),
    priceUsd: round2(priceUsd),
    priceCny: round2(priceCny),
  };
}

export function fmtNgn(n: number): string {
  return `₦${Math.round(n).toLocaleString()}`;
}
export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}
export function fmtCny(n: number): string {
  return `¥${n.toFixed(2)}`;
}
