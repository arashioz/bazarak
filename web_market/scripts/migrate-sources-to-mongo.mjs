import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const root = process.cwd();
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const databaseSource = await readJson("app/data/database.json");
const mobileSource = await readJson("app/data/mobile-services.json");
const client = new MongoClient(process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek");
const database = process.env.MONGODB_DB || "bazarek";

const text = (value) => String(value ?? "").trim();
const uniqueBy = (items, key) => [...new Map(items.filter(Boolean).map((item) => [key(item), item])).values()];
const productKey = (product) => text(product?.id) || `name:${text(product?.name)}`;
const customerKey = (customer) => {
  const id = text(customer?.id);
  if (id) return `id:${id}`;
  const sourceFile = text(customer?.sourceFile);
  const sourceRow = text(customer?.sourceRow);
  if (sourceFile || sourceRow) return `source:${sourceFile}:${sourceRow}`;
  return `person:${text(customer?.mobile)}:${text(customer?.name)}`;
};
const serviceKey = (record) => text(record?.id) || `source:${text(record?.sourceFile)}:${text(record?.sourceSheet)}:${text(record?.sourceRow)}:${text(record?.serviceType)}`;
const mergeByKey = (source, stored, key, merge = (base, current) => ({ ...base, ...current })) => {
  const merged = new Map((Array.isArray(source) ? source : []).map((item) => [key(item), item]));
  for (const item of Array.isArray(stored) ? stored : []) {
    const id = key(item);
    merged.set(id, merged.has(id) ? merge(merged.get(id), item) : item);
  }
  return [...merged.values()];
};
const mergeProduct = (source, stored) => ({
  ...source,
  ...stored,
  categoryIds: [...new Set([...(source.categoryIds || []), ...(stored.categoryIds || [])])],
  levels: stored.levels?.length ? stored.levels : source.levels || [],
  percentages: stored.percentages?.length ? stored.percentages : source.percentages || [],
  priceHistory: stored.priceHistory?.length ? stored.priceHistory : source.priceHistory || [],
  invoices: stored.invoices?.length ? stored.invoices : source.invoices || [],
});
const mergeCustomer = (source, stored) => ({ ...source, ...stored, followUps: stored.followUps?.length ? stored.followUps : source.followUps || [] });

try {
  await client.connect();
  const collection = client.db(database).collection("appState");
  const stored = await collection.findOne({ _id: "primary" }) || {};
  const sourceCustomers = [...(databaseSource.customers || []), ...(mobileSource.customers || [])];
  const sourceMobile = mobileSource.mobileServices || { records: [], serviceTypes: [], operators: [] };
  const storedMobile = stored.mobileServices || {};
  const settings = {
    ...(databaseSource.settings || {}),
    ...(stored.settings || {}),
    categories: uniqueBy([...(databaseSource.settings?.categories || []), ...(stored.settings?.categories || [])], (category) => text(category.id)),
  };
  const customerSettings = {
    ...(databaseSource.customerSettings || {}),
    ...(stored.customerSettings || {}),
    categories: uniqueBy([...(databaseSource.customerSettings?.categories || []), ...(stored.customerSettings?.categories || [])], (category) => text(category.id)),
    assignments: { ...(databaseSource.customerSettings?.assignments || {}), ...(stored.customerSettings?.assignments || {}) },
  };
  const products = mergeByKey(databaseSource.products, stored.products, productKey, mergeProduct);
  const customers = mergeByKey(sourceCustomers, stored.customers, customerKey, mergeCustomer);
  const records = mergeByKey(sourceMobile.records, storedMobile.records, serviceKey);
  const mobileServices = {
    ...sourceMobile,
    ...storedMobile,
    records,
    serviceTypes: [...new Set([...(sourceMobile.serviceTypes || []), ...(storedMobile.serviceTypes || []), ...records.map((record) => record.serviceType).filter(Boolean)])],
    operators: [...new Set([...(sourceMobile.operators || []), ...(storedMobile.operators || []), ...records.map((record) => record.operator).filter(Boolean)])],
  };
  await collection.updateOne(
    { _id: "primary" },
    { $set: {
      products, settings, customers, customerSettings, mobileServices,
      tasks: stored.tasks || databaseSource.tasks || [],
      customerNotes: stored.customerNotes || databaseSource.customerNotes || [],
      dataStore: "mongodb", migratedFromFilesAt: new Date(), updatedAt: new Date(),
    } },
    { upsert: true },
  );
  console.log(JSON.stringify({ destination: "MongoDB", products: products.length, customers: customers.length, mobileServiceRecords: records.length, note: "Existing MongoDB values took precedence over source files." }, null, 2));
} finally {
  await client.close();
}
