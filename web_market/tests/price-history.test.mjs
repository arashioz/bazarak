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

test('opening a product still prices when labels, levels, or history are damaged', () => {
  const pricing = capturePricing({ price: '15000', percentages: 'bad', fixedPrices: null, levels: [null, { id: 'ok', label: 'خرده', quantity: '۱', unit: 'عدد', percent: 12, price: 1 }], priceHistory: [null, { previousPrice: 1, price: 2 }] }, { columnLabels: 'خرده', currency: 'toman', priceRounding: 1000 });
  assert.equal(pricing.levels[0].label, 'خرده');
  assert.equal(pricing.levels[0].finalPrice, 17000);
  const history = recordPricingChange({ price: 1000, priceHistory: [null, { previousPrice: 1, price: 2, changedAt: 'old' }] }, { price: 1200, priceHistory: [null] }, settings, settings, 'now');
  assert.equal(history[1].changedAt, 'old');
  assert.equal(history.some((entry) => entry == null), false);
});

test('snapshots saved after a price edit contain no undefined fields', () => {
  const fixed = capturePricing({ price: 0, levels: [
    { id: 'fixed', label: 'ثابت', quantity: '', unit: 'عدد', price: 0 },
  ] }, settings);
  const walk = (value, path, found) => {
    if (value === undefined) found.push(path);
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`, found));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`, found));
  };
  const found = [];
  walk(fixed, 'fixed', found);
  walk(recordPricingChange(product, { ...product, price: 15000 }, settings, settings, 'now'), 'history', found);
  assert.deepEqual(found, []);
  assert.equal(fixed.levels[0].percent, undefined);
  assert.equal(fixed.levels[0].finalPrice, 0);
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
