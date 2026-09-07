import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required for migration.");

const database = process.env.MONGODB_DB || "bazarek";
const databasePath = path.join(process.cwd(), "app", "data", "database.json");
const client = new MongoClient(uri);

try {
  await client.connect();
  const collection = client.db(database).collection("appState");
  const existing = await collection.findOne({ _id: "primary" }, { projection: { _id: 1 } });
  if (existing) {
    console.log("MongoDB already contains app data; migration skipped.");
  } else {
    const data = JSON.parse(await fs.readFile(databasePath, "utf8"));
    await collection.insertOne({ _id: "primary", ...data, migratedAt: new Date() });
    console.log("database.json migrated to MongoDB.");
  }
} finally {
  await client.close();
}
