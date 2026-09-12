import { NextRequest, NextResponse } from "next/server";
import { mapDatabase, type AppState } from "../../../lib/database";
import { getMapRole, isValidMapToken, MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE } from "../../../lib/map-auth";

export const runtime = "nodejs";

const mapRole = (request: NextRequest) => {
  const token = request.cookies.get(MAP_ADMIN_COOKIE)?.value || request.cookies.get(MAP_DRIVER_COOKIE)?.value;
  return isValidMapToken(token) ? getMapRole(token) : null;
};

export async function GET(request: NextRequest) {
  if (!mapRole(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const state = await (await mapDatabase()).collection<AppState>("appState").findOne(
      { _id: "primary" },
      { projection: { customers: 1, mobileServices: 1 } },
    );
    return NextResponse.json({ customers: Array.isArray(state?.customers) ? state.customers : [], mobileServices: state?.mobileServices || { records: [], serviceTypes: [], operators: [] } });
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (mapRole(request) !== "admin") return NextResponse.json({ error: "admin access required" }, { status: 403 });
  try {
    const body = await request.json() as { section?: "customer" | "mobileServices"; data?: Record<string, unknown> };
    const collection = (await mapDatabase()).collection<AppState>("appState");
    if (body.section === "customer" && Number.isFinite(Number(body.data?.id))) {
      const id = Number(body.data?.id);
      const result = await collection.updateOne({ _id: "primary", "customers.id": id }, { $set: { "customers.$": body.data, updatedAt: new Date() } } as never);
      if (!result.matchedCount) await collection.updateOne({ _id: "primary" }, { $push: { customers: body.data }, $set: { updatedAt: new Date() } } as never, { upsert: true });
    } else if (body.section === "mobileServices" && body.data) {
      await collection.updateOne({ _id: "primary" }, { $set: { mobileServices: body.data, updatedAt: new Date() } }, { upsert: true });
    } else {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "database update failed" }, { status: 500 });
  }
}
