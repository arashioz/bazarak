import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";

const database = process.env.MONGODB_DB || "bazarek";
const forceSeed = process.env.FORCE_SEED === "1";
const databasePath = path.join(process.cwd(), "app", "data", "database.json");
const client = new MongoClient(uri);

const byId = (items) => new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item]));
const mergeProducts = (seedProducts, storedProducts) => {
  const seed = byId(seedProducts);
  const stored = byId(storedProducts);
  stored.forEach((product, id) => seed.set(id, { ...product, levels: product.levels?.length ? product.levels : seed.get(id)?.levels || [] }));
  return [...seed.values()];
};
const customerKey = (customer) => String(customer.id || `${customer.sourceFile || ""}:${customer.sourceRow || ""}:${customer.mobile || customer.name}`);
const mergeCustomers = (seedCustomers, storedCustomers) => {
  const seed = new Map((Array.isArray(seedCustomers) ? seedCustomers : []).map((customer) => [customerKey(customer), customer]));
  (Array.isArray(storedCustomers) ? storedCustomers : []).forEach((customer) => {
    const key = customerKey(customer);
    const source = seed.get(key) || {};
    seed.set(key, { ...source, ...customer, followUps: customer.followUps?.length ? customer.followUps : source.followUps || [] });
  });
  return [...seed.values()];
};
const mergeCustomerSettings = (seedSettings, storedSettings) => ({
  ...seedSettings,
  ...storedSettings,
  categories: [...new Map([...(seedSettings?.categories || []), ...(storedSettings?.categories || [])].map((category) => [category.id, category])).values()],
  assignments: { ...(seedSettings?.assignments || {}), ...(storedSettings?.assignments || {}) },
});

try {
  await client.connect();
  const collection = client.db(database).collection("appState");
  const existing = await collection.findOne({ _id: "primary" }, { projection: { _id: 1 } });
  const data = JSON.parse(await fs.readFile(databasePath, "utf8"));
  if (existing?.seededFromJson && !forceSeed) {
    console.log("MongoDB is already seeded; migration skipped.");
  } else {
    const { _id, ...stored } = existing || {};
    await collection.updateOne({ _id: "primary" }, { $set: {
      ...data,
      ...stored,
      products: mergeProducts(data.products, stored.products),
      customers: mergeCustomers(data.customers, stored.customers),
      settings: stored.settings || data.settings,
      tasks: stored.tasks || data.tasks,
      customerNotes: stored.customerNotes || data.customerNotes,
      customerSettings: mergeCustomerSettings(data.customerSettings, stored.customerSettings),
      seededFromJson: true,
      migratedAt: new Date(),
    } }, { upsert: true });
    console.log(forceSeed ? "MongoDB seed was refreshed from database.json." : "All database.json data was seeded into MongoDB.");
  }
} finally {
  await client.close();
}
