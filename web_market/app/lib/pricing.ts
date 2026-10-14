export type PriceRounding = 0 | 100 | 1000;
export type PriceSettings = { currency?: "toman" | "rial"; priceRounding?: PriceRounding };

// Store the step in toman so changing currency preserves its value.
export function roundSalePrice(value: number, settings: PriceSettings): number {
  const step = settings.priceRounding ?? 0;
  if (!step) return value;
  const currencyStep = step * (settings.currency === "rial" ? 10 : 1);
  return Math.round(value / currencyStep) * currencyStep;
}
