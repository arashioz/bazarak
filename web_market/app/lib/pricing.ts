export type PriceRounding = 0 | 100 | 1000;
export type PriceSettings = { currency?: "toman" | "rial"; priceRounding?: PriceRounding };

// Store the step in toman so changing currency preserves its value.
const finiteNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function roundSalePrice(value: number, settings: PriceSettings): number {
  const amount = finiteNumber(value);
  const step = settings.priceRounding ?? 0;
  if (!step) return amount;
  const currencyStep = step * (settings.currency === "rial" ? 10 : 1);
  return Math.round(amount / currencyStep) * currencyStep;
}
