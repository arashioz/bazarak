import { roundSalePrice, type PriceSettings } from "./pricing";

export type ProductLevel = { id: string; label: string; unit: string; quantity: string; price: number; percent?: number; rounding?: number; roundingMode?: "up" | "down" | "none" };
export type PricingLevelSnapshot = ProductLevel & { exactPrice: number; finalPrice: number; effectivePercent?: number };
export type PricingSnapshot = { basePrice: number; currency: "toman" | "rial"; priceRounding: number; levels: PricingLevelSnapshot[] };
export type PriceHistory = { previousPrice: number; price: number; changedAt: string; currency?: "toman" | "rial"; previousPricing?: PricingSnapshot; pricing?: PricingSnapshot };
type PricingProduct = { price?: number; unit?: string; levels?: ProductLevel[]; percentages?: number[]; fixedPrices?: number[]; priceHistory?: PriceHistory[] };
type Settings = PriceSettings & { columnLabels?: string[] };

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const quantityNumber = (value: unknown) => finiteNumber(String(value ?? "")
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[٬،,\s]/g, "").replace(/[^0-9.-]/g, ""), 1) || 1;

export function exactLevelPrice(basePrice: number, level: ProductLevel): number {
  return level.percent === undefined ? finiteNumber(level.price) : finiteNumber(basePrice) * quantityNumber(level.quantity) * (1 + finiteNumber(level.percent) / 100);
}

export function levelPriceForBasePrice(basePrice: number, level: ProductLevel): number {
  if (level.percent === undefined) return finiteNumber(level.price);
  const exact = exactLevelPrice(basePrice, level);
  const rounding = Math.max(1, finiteNumber(level.rounding, 1));
  return level.roundingMode === "up" ? Math.ceil(exact / rounding) * rounding : level.roundingMode === "down" ? Math.floor(exact / rounding) * rounding : Math.round(exact);
}

export function capturePricing(product: PricingProduct, settings: Settings): PricingSnapshot {
  const basePrice = finiteNumber(product.price);
  const labels = settings.columnLabels || ["سطح ۱", "سطح ۲", "سطح ۳", "سطح ۴"];
  const customLevels = (product.levels || []).filter((level) => level && typeof level === "object");
  const levels: ProductLevel[] = customLevels.length ? customLevels : labels.map((label, index) => ({
    id: `default-${index}`, label, unit: product.unit || "کیلوگرم", quantity: "۱",
    price: finiteNumber(product.fixedPrices?.[index]),
    percent: product.fixedPrices?.[index] ? undefined : finiteNumber((product.percentages || [12, 9, 6, 0])[index]),
    roundingMode: "none",
  }));
  return {
    basePrice, currency: settings.currency || "toman", priceRounding: settings.priceRounding || 0,
    levels: levels.map((level, index) => {
      const price = levelPriceForBasePrice(basePrice, level);
      const finalPrice = roundSalePrice(price, settings);
      const cost = basePrice * quantityNumber(level.quantity);
      const percent = level.percent === undefined ? undefined : finiteNumber(level.percent);
      const effectivePercent = cost > 0 ? finiteNumber(((finalPrice / cost - 1) * 100).toFixed(2)) : undefined;
      // Optional fields stay absent. MongoDB rejects documents that contain undefined.
      return { id: String(level.id || `level-${index}`), label: String(level.label || ""), unit: String(level.unit || ""), quantity: String(level.quantity || ""), ...(percent === undefined ? {} : { percent }), rounding: finiteNumber(level.rounding), roundingMode: level.roundingMode || "none", price, exactPrice: exactLevelPrice(basePrice, level), finalPrice, ...(effectivePercent === undefined ? {} : { effectivePercent }) };
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
