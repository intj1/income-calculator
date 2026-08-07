const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $1,235 — whole dollars for annual-scale figures. */
export function money(v: number): string {
  return usd0.format(Math.round(v));
}

/** $1,234.56 — cents for per-paycheck figures. */
export function moneyExact(v: number): string {
  return usd2.format(v);
}

/** 0.234 -> "23.4%" */
export function pct(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + '%';
}

/** Compact axis labels: 1500000 -> "$1.5M" */
export function moneyCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'k';
  return usd0.format(v);
}
