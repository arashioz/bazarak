import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const sourcePath = path.join(process.cwd(), "app", "data", "database.json");
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const uri = process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";
const database = process.env.MONGODB_DB || "bazarek";
const keyFor = (product) => String(product?.id || `name:${String(product?.name || "").trim()}`);

const client = new MongoClient(uri);
try {
  await client.connect();
  const collection = client.db(database).collection("appState");
  const current = await collection.findOne({ _id: "primary" }) || {};
  const products = new Map((current.products || []).map((product) => [keyFor(product), product]));

  for (const product of source.products || []) {
    const key = keyFor(product);
    // Source data provides the catalog; values already changed in MongoDB take
    // precedence so re-running this command does not discard server changes.
    products.set(key, { ...product, ...(products.get(key) || {}) });
  }

  await collection.updateOne(
    { _id: "primary" },
    { $set: { products: [...products.values()], dataStore: "mongodb", updatedAt: new Date() } },
    { upsert: true },
  );
  console.log(JSON.stringify({ imported: (source.products || []).length, totalProducts: products.size, destination: database }, null, 2));
} finally {
  await client.close();
}
