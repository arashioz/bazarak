import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const filePath = path.join(process.cwd(), "app", "data", "database.json");
const empty = { products: [], settings: null, tasks: [], customerNotes: {}, customerSettings: { categories: [], assignments: {} } };

async function readDatabase() {
  try { return { ...empty, ...JSON.parse(await fs.readFile(filePath, "utf8")) }; }
  catch { return empty; }
}

export async function GET() { return NextResponse.json(await readDatabase()); }

export async function PUT(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { section?: keyof typeof empty; data?: unknown } | null;
  if (!payload?.section || !(payload.section in empty)) return NextResponse.json({ error: "invalid section" }, { status: 400 });
  const database = await readDatabase();
  database[payload.section] = payload.data as never;
  await fs.writeFile(filePath, `${JSON.stringify(database, null, 2)}\n`);
  return NextResponse.json({ ok: true });
}
