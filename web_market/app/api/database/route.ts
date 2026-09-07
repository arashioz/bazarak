import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mongoDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const seedDatabasePath = path.join(process.cwd(), "app", "data", "database.json");
const writableSections = new Set(["products", "settings", "tasks", "customerNotes", "customerSettings", "customers"]);

type Database = Record<string, unknown>;
type DatabaseDocument = Database & { _id: string };

const readDatabase = async () => {
  const collection = (await mongoDatabase()).collection<DatabaseDocument>("appState");
  const stored = await collection.findOne({ _id: "primary" });
  if (stored) {
    const { _id, ...database } = stored;
    return database;
  }
  const initial = JSON.parse(await readFile(seedDatabasePath, "utf8")) as Database;
  await collection.insertOne({ _id: "primary", ...initial, migratedAt: new Date() });
  return initial;
};

export async function GET() {
  try {
    return NextResponse.json(await readDatabase());
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { section, data } = await request.json();
    if (typeof section !== "string" || !writableSections.has(section)) {
      return NextResponse.json({ error: "invalid database section" }, { status: 400 });
    }
    const collection = (await mongoDatabase()).collection<DatabaseDocument>("appState");
    await collection.updateOne({ _id: "primary" }, { $set: { [section]: data, updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json(await readDatabase());
  } catch {
    return NextResponse.json({ error: "database update failed" }, { status: 500 });
  }
}
