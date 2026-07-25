// Converts ad-spend currencies to INR so blended totals across clients are
// real numbers instead of the "mixed currency" placeholder the live views
// show today. Rates are approximate and meant for pacing/reporting, not
// billing reconciliation — nothing here writes to any ad platform.
//
// Override any rate without a deploy: set FX_RATES_JSON in Vercel env, e.g.
//   {"THB": 2.55, "NZD": 51.0, "USD": 87.0, "AUD": 57.0}
// Values are "1 unit of currency = N INR".

const DEFAULT_RATES_TO_INR = {
  INR: 1,
  THB: 2.5,
  NZD: 51.0,
  USD: 87.0,
  AUD: 57.0,
  GBP: 110.0,
  EUR: 94.0,
}

export function getFxRates() {
  if (process.env.FX_RATES_JSON) {
    try {
      return { ...DEFAULT_RATES_TO_INR, ...JSON.parse(process.env.FX_RATES_JSON) }
    } catch {
      // fall through to defaults if the env var is malformed
    }
  }
  return { ...DEFAULT_RATES_TO_INR }
}

export function toINR(amount, currency, rates = getFxRates()) {
  if (amount == null || isNaN(amount)) return 0
  const rate = rates[currency?.toUpperCase()] ?? null
  if (rate == null) return null // unknown currency — caller should flag, not silently misreport
  return Number(amount) * rate
}
