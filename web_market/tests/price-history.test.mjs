import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
export const historyModule = loadSource('app/lib/price-history.ts', { './pricing': loadSource('app/lib/pricing.ts') });
const { capturePricing, recordPricingChange } = historyModule;
const settings = { currency: 'toman', priceRounding: 100, columnLabels: ['خرده'] };
const product = { price: 12360, percentages: [12], priceHistory: [], unit: 'کیلوگرم' };

test('history preserves the previous margin and rounded amount after later edits', () => {
  const next = { ...product, price: 15000, percentages: [20] };
  const history = recordPricingChange(product, next, settings, { ...settings, priceRounding: 1000 }, '2026-10-14');
  assert.equal(history[0].previousPricing.levels[0].percent, 12);
  assert.equal(history[0].previousPricing.levels[0].finalPrice, 13800);
  assert.equal(history[0].previousPricing.levels[0].effectivePercent, 11.65);
  assert.equal(history[0].pricing.levels[0].percent, 20);
  assert.equal(history[0].pricing.levels[0].finalPrice, 18000);
  const previousSnapshot = JSON.stringify(history[0]);
  next.percentages[0] = 50;
  settings.priceRounding = 1000;
  assert.equal(JSON.stringify(history[0]), previousSnapshot);
  settings.priceRounding = 100;
});

test('records percentage and rounding changes even if purchase price is unchanged', () => {
  assert.equal(recordPricingChange(product, { ...product, percentages: [15] }, settings, settings, 'now').length, 1);
  assert.equal(recordPricingChange(product, product, settings, { ...settings, priceRounding: 1000 }, 'now').length, 1);
  assert.equal(recordPricingChange(product, product, settings, settings, 'now').length, 0);
});

test('captures local rounding, Persian quantities, fixed prices and rial currency', () => {
  const pricing = capturePricing({ price: 10010, levels: [
    { id: 'a', label: 'دو کیلو', unit: 'کیلو', quantity: '۲', percent: 12, rounding: 100, roundingMode: 'up', price: 0 },
    { id: 'b', label: 'ثابت', quantity: '۱', unit: 'عدد', price: 15340 },
  ] }, { currency: 'rial', priceRounding: 100 });
  assert.equal(pricing.levels[0].price, 22500);
  assert.equal(pricing.levels[0].finalPrice, 23000);
  assert.equal(pricing.levels[0].percent, 12);
  assert.equal(pricing.levels[0].roundingMode, 'up');
  assert.equal(pricing.levels[1].finalPrice, 15000);
  assert.equal(pricing.levels[1].percent, undefined);
});

test('legacy history stays unknown and currency changes preserve historical units', () => {
  const legacy = { previousPrice: 10000, price: 12360, changedAt: 'old' };
  const history = recordPricingChange({ ...product, priceHistory: [legacy] }, { ...product, price: 123600 }, settings, { ...settings, currency: 'rial' }, 'now');
  assert.equal(history[0].previousPricing.currency, 'toman');
  assert.equal(history[0].pricing.currency, 'rial');
  assert.equal(history[1].previousPrice, 10000);
  assert.equal(history[1].currency, 'toman');
  assert.equal(history[1].previousPricing, undefined);
  assert.equal(legacy.currency, undefined);
});
