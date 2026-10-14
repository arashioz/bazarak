import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

function databaseRoute() {
  const writes = [];
  const stored = { settings: { currency: 'toman', priceRounding: 0, columnLabels: ['خرده'] }, customers: [{ id: 1, name: 'مشتری آزمایشی' }], customerSettings: { categories: [] }, customerNotes: {}, products: [{ id: 2, price: 12360, percentages: [12], priceHistory: [] }], tasks: [{ id: 3 }] };
  const collection = {
    updateOne: async (...args) => {
      writes.push(args);
      for (const [key, value] of Object.entries(args[1].$set)) {
        const parts = key.split('.');
        let target = stored;
        for (const part of parts.slice(0, -1)) target = target[part];
        target[parts.at(-1)] = value;
      }
      return { matchedCount: 1 };
    },
    findOne: async (_filter, options) => options?.projection ? Object.fromEntries(Object.entries(stored).filter(([key]) => options.projection[key] === 1)) : { _id: 'primary', ...stored },
  };
  const route = loadSource('app/api/database/route.ts', {
    '@/app/lib/price-history': loadSource('app/lib/price-history.ts', { './pricing': loadSource('app/lib/pricing.ts') }),
    '@/lib/mongodb': { mongoDatabase: async () => ({ collection: () => collection }) },
    '@/app/lib/auth': { ADMIN_COOKIE: 'session', isValidAdminToken: (token) => token === 'test-admin' },
  });
  const request = (data, authenticated = true, section = 'priceRounding') => ({
    cookies: { get: () => authenticated ? { value: 'test-admin' } : undefined },
    json: async () => ({ section, data }),
    nextUrl: new URL('http://localhost/api/database?section=customerDirectory'),
  });
  return { ...route, writes, request, stored };
}

test('rounding snapshots preserve purchase prices and unrelated settings', async () => {
  const { PUT, writes, request } = databaseRoute();
  for (const step of [0, 100, 1000]) {
    const response = await PUT(request(step));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.settings.priceRounding, step);
    assert.equal(result.settings.currency, 'toman');
    assert.equal(result.products[0].price, 12360);
    if (step) assert.equal(result.products[0].priceHistory[0].pricing.priceRounding, step);
    assert.equal(writes.at(-1)[1].$set['settings.priceRounding'], step);
    assert.deepEqual(Object.keys(writes.at(-1)[1].$set).sort(), ['products.0.priceHistory', 'settings.priceRounding', 'updatedAt']);
  }
});

test('invalid rounding choices and unauthenticated writes are rejected', async () => {
  const { PUT, writes, request } = databaseRoute();
  for (const step of [-100, 1, 500, 100.5, '100', null]) assert.equal((await PUT(request(step))).status, 400);
  assert.equal((await PUT(request(100, false))).status, 401);
  assert.equal(writes.length, 0);
});

test('customer loading returns only customer data and requires authentication', async () => {
  const { GET, request } = databaseRoute();
  const response = await GET(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.customers[0].name, 'مشتری آزمایشی');
  assert.deepEqual(Object.keys(data).sort(), ['customerNotes', 'customerSettings', 'customers']);
  assert.equal((await GET(request(undefined, false))).status, 401);
});


test('catalog edits capture previous pricing on the server and preserve legacy history', async () => {
  const { PUT, request, stored } = databaseRoute();
  stored.products[0].priceHistory = [{ previousPrice: 10000, price: 12360, changedAt: 'old' }];
  const response = await PUT(request({ products: [{ ...stored.products[0], percentages: [20] }], settings: stored.settings }, true, 'catalog'));
  assert.equal(response.status, 200);
  const entry = stored.products[0].priceHistory[0];
  assert.equal(entry.previousPricing.levels[0].percent, 12);
  assert.equal(entry.pricing.levels[0].percent, 20);
  assert.equal(stored.products[0].priceHistory[1].previousPricing, undefined);
  await PUT(request({ products: [{ ...stored.products[0], name: 'نام جدید' }], settings: stored.settings }, true, 'catalog'));
  assert.equal(stored.products[0].priceHistory.length, 2);
});
