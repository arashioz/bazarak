import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

function backButton(pathname, query = '') {
  const destinations = [];
  const { default: PageBackButton } = loadSource('app/components/PageBackButton.tsx', {
    'next/navigation': {
      usePathname: () => pathname,
      useSearchParams: () => new URLSearchParams(query),
      useRouter: () => ({ push: (path) => destinations.push(path) }),
    },
  });
  return { element: PageBackButton(), destinations };
}

test('main pages hide the back control with or without a trailing slash', () => {
  for (const path of ['/', '/products', '/customers', '/catalog', '/mobile-services', '/modir/panel', '/modir/login']) {
    assert.equal(backButton(path).element, null);
    if (path !== '/') assert.equal(backButton(`${path}/`).element, null);
  }
});

test('child pages return to their own parent even when opened directly', () => {
  for (const [path, query, parent] of [
    ['/customers/add/', '', '/customers'],
    ['/mobile-services/settings/', '', '/mobile-services'],
    ['/catalog/spices/', '', '/catalog'],
    ['/catalog/', 'category=spices', '/catalog'],
  ]) {
    const { element, destinations } = backButton(path, query);
    assert.ok(element);
    element.props.onClick();
    assert.deepEqual(destinations, [parent]);
  }
});

test('customer entry ignores a stale user role and fetches only the customer directory', async () => {
  const effects = [];
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('Legacy role must not control routing'); } };
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ({ customers: [], customerNotes: {}, customerSettings: { categories: [], assignments: {} } }) };
  };
  try {
    const { default: CustomersApp } = loadSource('app/components/CustomersApp.tsx', {
      react: {
        useState: (value) => [value, () => {}],
        useEffect: (effect) => effects.push(effect),
        useMemo: (compute) => compute(),
      },
      '@/app/lib/confirm-delete': { confirmDelete: () => false },
      './MobileBottomNav': { default: () => null },
    });
    CustomersApp();
    for (const effect of effects) effect();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(requests, ['/api/database?section=customerDirectory']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
