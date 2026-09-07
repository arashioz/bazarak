import { NextRequest, NextResponse } from "next/server";
import { mongoDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const writableSections = new Set(["products", "settings", "tasks", "customerNotes", "customerSettings", "customers", "customerFollowUp"]);

type Database = Record<string, unknown>;
type DatabaseDocument = Database & { _id: string };

const readDatabase = async () => {
  const collection = (await mongoDatabase()).collection<DatabaseDocument>("appState");
  const stored = await collection.findOne({ _id: "primary" });
  if (stored) {
    const { _id, ...database } = stored;
    return database;
  }
  throw new Error("MongoDB data has not been initialized");
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
    if (section === "customerFollowUp") {
      const followUp = data as { customerId?: number; date?: string; note?: string };
      if (!followUp.customerId || !String(followUp.note || "").trim()) return NextResponse.json({ error: "invalid follow-up" }, { status: 400 });
      const result = await collection.updateOne(
        { _id: "primary", "customers.id": followUp.customerId },
        { $push: { "customers.$.followUps": { date: String(followUp.date || "").trim(), note: String(followUp.note).trim() } }, $set: { updatedAt: new Date() } } as never,
      );
      if (!result.matchedCount) return NextResponse.json({ error: "customer not found" }, { status: 404 });
      return NextResponse.json(await readDatabase());
    }
    await collection.updateOne({ _id: "primary" }, { $set: { [section]: data, updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json(await readDatabase());
  } catch {
    return NextResponse.json({ error: "database update failed" }, { status: 500 });
  }
}
