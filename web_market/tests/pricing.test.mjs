import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { roundSalePrice } = loadSource('app/lib/pricing.ts');

test('rounding is optional and preserves existing exact prices', () => {
  for (const value of [0, 12360, 12360.5]) {
    assert.equal(roundSalePrice(value, {}), value);
    assert.equal(roundSalePrice(value, { priceRounding: 0 }), value);
  }
});

test('100 and 1000 toman steps round down, up, and at the halfway boundary', () => {
  for (const [step, input, expected] of [
    [100, 12349, 12300], [100, 12350, 12400], [100, 12360, 12400],
    [1000, 12499, 12000], [1000, 12500, 13000], [1000, 12600, 13000],
    [1000, 13000, 13000], [100, 0, 0],
  ]) assert.equal(roundSalePrice(input, { priceRounding: step }), expected);
});

test('toman and rial representations produce equivalent amounts', () => {
  for (const priceRounding of [100, 1000]) {
    for (const value of [0, 12349, 12350, 12360, 12500, 9999999]) {
      const toman = roundSalePrice(value, { currency: 'toman', priceRounding });
      const rial = roundSalePrice(value * 10, { currency: 'rial', priceRounding });
      assert.equal(rial, toman * 10);
    }
  }
});
