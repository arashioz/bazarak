import { roundSalePrice, type PriceSettings } from "./pricing";

export type ProductLevel = { id: string; label: string; unit: string; quantity: string; price: number; percent?: number; rounding?: number; roundingMode?: "up" | "down" | "none" };
export type PricingLevelSnapshot = ProductLevel & { exactPrice: number; finalPrice: number; effectivePercent?: number };
export type PricingSnapshot = { basePrice: number; currency: "toman" | "rial"; priceRounding: number; levels: PricingLevelSnapshot[] };
export type PriceHistory = { previousPrice: number; price: number; changedAt: string; currency?: "toman" | "rial"; previousPricing?: PricingSnapshot; pricing?: PricingSnapshot };
type PricingProduct = { price?: number; unit?: string; levels?: ProductLevel[]; percentages?: number[]; fixedPrices?: number[]; priceHistory?: PriceHistory[] };
type Settings = PriceSettings & { columnLabels?: string[] };

const quantityNumber = (value: string) => Number(String(value)
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[٬،,\s]/g, "").replace(/[^0-9.-]/g, "")) || 1;

export function exactLevelPrice(basePrice: number, level: ProductLevel): number {
  return level.percent === undefined ? level.price : basePrice * quantityNumber(level.quantity) * (1 + level.percent / 100);
}

export function levelPriceForBasePrice(basePrice: number, level: ProductLevel): number {
  if (level.percent === undefined) return level.price;
  const exact = exactLevelPrice(basePrice, level);
  const rounding = Math.max(1, level.rounding || 1);
  return level.roundingMode === "up" ? Math.ceil(exact / rounding) * rounding : level.roundingMode === "down" ? Math.floor(exact / rounding) * rounding : Math.round(exact);
}

export function capturePricing(product: PricingProduct, settings: Settings): PricingSnapshot {
  const basePrice = Number(product.price || 0);
  const labels = settings.columnLabels || ["سطح ۱", "سطح ۲", "سطح ۳", "سطح ۴"];
  const levels: ProductLevel[] = product.levels?.length ? product.levels : labels.map((label, index) => ({
    id: `default-${index}`, label, unit: product.unit || "کیلوگرم", quantity: "۱",
    price: product.fixedPrices?.[index] || 0,
    percent: product.fixedPrices?.[index] ? undefined : (product.percentages || [12, 9, 6, 0])[index] ?? 0,
    roundingMode: "none",
  }));
  return {
    basePrice, currency: settings.currency || "toman", priceRounding: settings.priceRounding || 0,
    levels: levels.map((level) => {
      const price = levelPriceForBasePrice(basePrice, level);
      const finalPrice = roundSalePrice(price, settings);
      const cost = basePrice * quantityNumber(level.quantity);
      return { id: level.id, label: level.label, unit: level.unit, quantity: level.quantity, percent: level.percent, rounding: level.rounding || 0, roundingMode: level.roundingMode || "none", price, exactPrice: exactLevelPrice(basePrice, level), finalPrice,
        effectivePercent: cost > 0 ? Number(((finalPrice / cost - 1) * 100).toFixed(2)) : undefined };
    }),
  };
}

// Snapshots are immutable: old percentages and rounded amounts must never be
// recomputed with today's settings. Legacy entries retain only what is known.
export function recordPricingChange(previous: PricingProduct, next: PricingProduct, before: Settings, after: Settings, changedAt: string): PriceHistory[] {
  const previousPricing = capturePricing(previous, before);
  const pricing = capturePricing(next, after);
  const history = (previous.priceHistory || []).map((entry) => ({ ...entry, currency: entry.currency || before.currency || "toman" }));
  if (JSON.stringify(previousPricing) === JSON.stringify(pricing)) return history;
  return [{ previousPrice: previousPricing.basePrice, price: pricing.basePrice, changedAt,
    currency: previousPricing.currency, previousPricing, pricing }, ...history];
}
