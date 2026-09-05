import { NextRequest, NextResponse } from "next/server";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import customers from "../../data/customers.json";
import { seedProductRows } from "../../data/seedProductRows";

export const runtime = "nodejs";

const databasePath = path.join(process.cwd(), "app", "data", "database.json");
const writableSections = new Set(["products", "settings", "tasks", "customerNotes", "customerSettings", "customers"]);
let writeQueue = Promise.resolve();

type Database = Record<string, unknown> & {
  products?: Array<Record<string, unknown>>;
  customers?: typeof customers;
  featuredDefaultsApplied?: boolean;
};

const normalizeName = (value: string) => value.trim().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ");

const applyDefaults = (database: Database) => {
  let changed = false;
  if (!Array.isArray(database.customers)) {
    database.customers = customers;
    changed = true;
  }
  if (!database.featuredDefaultsApplied && Array.isArray(database.products)) {
    const byName = new Map(database.products.map((product) => [normalizeName(String(product.name || "")), product]));
    seedProductRows.forEach((seed) => {
      const key = normalizeName(seed.name);
      const existing = byName.get(key);
      if (existing) {
        existing.featured = true;
      } else {
        byName.set(key, {
          id: 1_000_000_000 + seed.id,
          name: seed.name,
          price: seed.price,
          unit: "کیلوگرم",
          stock: 0,
          active: true,
          featured: true,
          updated: new Date().toISOString(),
          catalogUrl: "",
          description: "",
          invoices: seed.price > 0 ? [{ price: seed.price, registeredAt: new Date().toISOString() }] : [],
          percentages: [seed.percent, seed.percent, seed.percent, seed.percent],
          rounding: [1000, 1000, 1000, 1000],
          roundingEnabled: [true, true, true, true],
          fixedPrices: [],
          categoryIds: [],
        });
      }
    });
    database.products = Array.from(byName.values());
    database.featuredDefaultsApplied = true;
    changed = true;
  }
  return changed;
};

const readDatabase = async () => {
  const database = JSON.parse(await readFile(databasePath, "utf8")) as Database;
  const changed = applyDefaults(database);
  if (changed) await writeDatabase(database);
  return database;
};

const writeDatabase = async (database: Database) => {
  const temporaryPath = `${databasePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`);
  await rename(temporaryPath, databasePath);
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
    let result: Database | undefined;
    writeQueue = writeQueue.then(async () => {
      const database = await readDatabase();
      database[section] = data;
      await writeDatabase(database);
      result = database;
    });
    await writeQueue;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "database update failed" }, { status: 500 });
  }
}
