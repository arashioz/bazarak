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
    aggregate: () => ({ toArray: async () => [{ items: stored.products || [], total: (stored.products || []).length }] }),
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

test('a price edit keeps the rest of the category, even when names match', async () => {
  const { PUT, request, stored } = databaseRoute();
  stored.products = [
    { id: 1, name: 'گلاب', price: 1000, categoryIds: ['araq'], percentages: [12], priceHistory: [] },
    { id: 2, name: 'گلاب', price: 2000, categoryIds: ['araq'], percentages: [12], priceHistory: [] },
    { id: 3, name: 'عرق نعنا', price: 3000, categoryIds: ['araq'], percentages: [12], priceHistory: [] },
  ];
  const response = await PUT(request({
    products: [{ ...stored.products[0], price: 1800, levels: [{ id: 'bulk-1', label: 'خرده', unit: 'کیلوگرم', quantity: '۱', price: 0 }] }],
    settings: stored.settings,
  }, true, 'catalog'));
  assert.equal(response.status, 200);
  assert.deepEqual(stored.products.map((product) => product.id), [1, 2, 3]);
  assert.deepEqual(stored.products.map((product) => product.categoryIds), [['araq'], ['araq'], ['araq']]);
  assert.equal(stored.products[0].price, 1800);
  const walk = (value, found) => {
    if (value === undefined) found.push(true);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, found));
    else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach((item) => walk(item, found));
  };
  const undefinedFields = [];
  walk(stored.products, undefinedFields);
  assert.deepEqual(undefinedFields, []);
});

test('clearing custom levels restores default pricing without dropping siblings', async () => {
  const { PUT, request, stored } = databaseRoute();
  stored.products = [
    { id: 1, name: 'گلاب', price: 1000, categoryIds: ['araq'], percentages: [12], levels: [{ id: 'bulk-1', label: '', price: 0 }], priceHistory: [] },
    { id: 2, name: 'عرق نعنا', price: 3000, categoryIds: ['araq'], percentages: [9], priceHistory: [] },
  ];
  const response = await PUT(request({
    products: [{ id: 1, name: 'گلاب', price: 1000, categoryIds: ['araq'], percentages: [12], levels: [] }],
    settings: stored.settings,
  }, true, 'catalog'));
  assert.equal(response.status, 200);
  assert.deepEqual(stored.products[0].levels, []);
  assert.equal(stored.products[0].priceHistory[0].pricing.levels[0].percent, 12);
  assert.equal(stored.products[1].id, 2);
  assert.deepEqual(stored.products[1].categoryIds, ['araq']);
});

test('the product list leaves price history for a later request', async () => {
  const { GET, stored } = databaseRoute();
  stored.products[0].priceHistory = [{ previousPrice: 1, price: 2, changedAt: 'old' }];
  const response = await GET({
    cookies: { get: () => ({ value: 'test-admin' }) },
    nextUrl: new URL('http://localhost/api/database?section=products&offset=0&limit=10'),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items[0].price, 12360);
  assert.equal(Object.hasOwn(data.items[0], 'priceHistory'), false);
  assert.equal(stored.products[0].priceHistory[0].changedAt, 'old');
  const histories = await GET({
    cookies: { get: () => ({ value: 'test-admin' }) },
    nextUrl: new URL('http://localhost/api/database?section=productHistories&offset=0&limit=10'),
  });
  const historyPage = await histories.json();
  assert.equal(historyPage.items[0].priceHistory[0].changedAt, 'old');
  assert.equal(historyPage.items[0].price, undefined);
});

test('bulk pricing updates only the selected products and prices each from its own cost', async () => {
  const { PUT, request, stored, writes } = databaseRoute();
  stored.products = [
    { id: 1, name: 'گلاب', price: 1000, categoryIds: ['araq'], percentages: [12], priceHistory: [] },
    { id: 2, name: 'عرق نعنا', price: 3000, categoryIds: ['araq'], percentages: [9], priceHistory: [{ previousPrice: 1, price: 2, changedAt: 'keep' }] },
  ];
  const untouched = structuredClone(stored.products[1]);
  const response = await PUT(request({
    ids: [1, 1],
    levels: [{ id: 'bulk-1', label: 'خرده', unit: 'کیلوگرم', quantity: '۱', percent: 10, price: 0, roundingMode: 'none' }],
  }, true, 'bulkLevels'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.products.map((product) => product.id), [1]);
  assert.equal(body.customers, undefined);
  assert.equal(stored.products[0].levels[0].id, '1-bulk-1');
  assert.equal(stored.products[0].levels[0].price, 1100);
  assert.equal(stored.products[0].priceHistory.length, 1);
  assert.deepEqual(stored.products[1], untouched);
  const keys = Object.keys(writes.at(-1)[1].$set);
  assert.equal(keys.includes('products'), false);
  assert.equal(keys.some((key) => key.startsWith('products.1')), false);
  assert.ok(keys.includes('products.0.levels'));
  const undefinedFields = [];
  const walk = (value) => {
    if (value === undefined) undefinedFields.push(true);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(walk);
  };
  walk(stored.products[0]);
  assert.deepEqual(undefinedFields, []);

  const both = await PUT(request({
    ids: [1, 2],
    levels: [{ id: 'bulk-2', label: 'عمده', unit: 'کیلوگرم', quantity: '۱', percent: 10, price: 0, roundingMode: 'none' }],
  }, true, 'bulkLevels'));
  assert.equal(both.status, 200);
  assert.equal(stored.products[0].levels[0].price, 1100);
  assert.equal(stored.products[1].levels[0].price, 3300);
  assert.equal((await both.json()).products.length, 2);
});

test('clearing bulk levels restores one product without rewriting the catalog', async () => {
  const { PUT, request, stored, writes } = databaseRoute();
  stored.products = [
    { id: 1, name: 'گلاب', price: 1000, categoryIds: ['araq'], percentages: [12], levels: [{ id: 'bulk-1', label: 'خرده', price: 5000 }], priceHistory: [] },
    { id: 2, name: 'عرق نعنا', price: 3000, categoryIds: ['araq'], percentages: [9], priceHistory: [] },
  ];
  const response = await PUT(request({ ids: [1], levels: null }, true, 'bulkLevels'));
  assert.equal(response.status, 200);
  assert.deepEqual(stored.products[0].levels, []);
  assert.equal(stored.products[0].priceHistory[0].pricing.levels[0].percent, 12);
  assert.equal(stored.products[1].levels, undefined);
  assert.equal(Object.keys(writes.at(-1)[1].$set).some((key) => key.startsWith('products.1')), false);
  assert.equal((await PUT(request({ ids: [], levels: [] }, true, 'bulkLevels'))).status, 400);
  assert.equal((await PUT(request({ ids: [1], levels: [null] }, true, 'bulkLevels'))).status, 400);
  assert.equal((await PUT(request({ ids: [1], levels: null }, false, 'bulkLevels'))).status, 401);
  assert.equal((await PUT(request({ ids: [99], levels: null }, true, 'bulkLevels'))).status, 404);
});
