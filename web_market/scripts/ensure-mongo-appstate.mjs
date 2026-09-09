import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek");
const database = process.env.MONGODB_DB || "bazarek";

const emptyState = {
  products: [],
  settings: { id: "settings", columnLabels: ["سطح ۱", "سطح ۲", "سطح ۳", "سطح ۴"], categories: [], browseMode: "sections" },
  tasks: [],
  customerNotes: [],
  customerSettings: { categories: [], assignments: {} },
  customers: [],
  mobileServices: { records: [], serviceTypes: [], operators: [] },
};

try {
  await client.connect();
  const result = await client.db(database).collection("appState").updateOne(
    { _id: "primary" },
    { $setOnInsert: { ...emptyState, createdAt: new Date(), dataStore: "mongodb" } },
    { upsert: true },
  );
  console.log(result.upsertedCount ? "Created empty MongoDB app state." : "MongoDB app state already exists.");
} finally {
  await client.close();
}
