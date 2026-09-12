import { NextRequest, NextResponse } from "next/server";
import { mongoDatabase } from "@/lib/mongodb";
import { ADMIN_COOKIE, isValidAdminToken } from "@/app/lib/auth";

export const runtime = "nodejs";

const writableSections = new Set(["products", "settings", "catalog", "productCategory", "tasks", "customerNotes", "customerSettings", "customers", "customerUpsert", "customerDelete", "customerFollowUp", "productDelete", "mobileServices"]);

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

export async function GET(request: NextRequest) {
  try {
    // The catalog has its own public, read-only endpoint. All database data is
    // reserved for an authenticated manager session.
    if (!isValidAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await readDatabase());
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isValidAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
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
    // Customer changes are single-record mutations. This avoids an open tab
    // replacing the whole customer list with the stale copy it loaded earlier.
    if (section === "customerUpsert") {
      const customer = data as { id?: number };
      if (!Number.isFinite(customer?.id)) return NextResponse.json({ error: "invalid customer" }, { status: 400 });
      const result = await collection.updateOne(
        { _id: "primary", "customers.id": customer.id },
        { $set: { "customers.$": customer, updatedAt: new Date() } } as never,
      );
      if (!result.matchedCount) await collection.updateOne({ _id: "primary" }, { $push: { customers: customer }, $set: { updatedAt: new Date() } } as never, { upsert: true });
      return NextResponse.json(await readDatabase());
    }
    if (section === "customerDelete") {
      const customer = data as { id?: number };
      if (!Number.isFinite(customer?.id)) return NextResponse.json({ error: "invalid customer" }, { status: 400 });
      await collection.updateOne({ _id: "primary" }, { $pull: { customers: { id: customer.id } }, $set: { updatedAt: new Date() } } as never);
      return NextResponse.json(await readDatabase());
    }
    if (section === "productDelete") {
      const product = data as { id?: number; password?: string };
      if (!Number.isFinite(product?.id) || String(product.password || "") !== "7755") {
        return NextResponse.json({ error: "invalid product deletion request" }, { status: 403 });
      }
      const result = await collection.updateOne(
        { _id: "primary" },
        { $pull: { products: { id: product.id } }, $set: { updatedAt: new Date() } } as never,
      );
      if (!result.matchedCount) return NextResponse.json({ error: "product not found" }, { status: 404 });
      return NextResponse.json(await readDatabase());
    }
    // Category membership is changed independently of the full catalog. This
    // makes removing a checked category explicit instead of having it restored
    // by the catalog merge that protects data from stale browser tabs.
    if (section === "productCategory") {
      const change = data as { productId?: number; categoryId?: string; assigned?: boolean };
      if (!Number.isFinite(change?.productId) || !String(change.categoryId || "").trim() || typeof change.assigned !== "boolean") {
        return NextResponse.json({ error: "invalid product category change" }, { status: 400 });
      }
      const categoryId = String(change.categoryId).trim();
      const result = await collection.updateOne(
        { _id: "primary", "products.id": change.productId },
        {
          [change.assigned ? "$addToSet" : "$pull"]: { "products.$.categoryIds": categoryId },
          $set: { "products.$.updated": new Date().toISOString(), updatedAt: new Date() },
        } as never,
      );
      if (!result.matchedCount) return NextResponse.json({ error: "product not found" }, { status: 404 });
      return NextResponse.json(await readDatabase());
    }
    // Bulk imports may still send an array. Merge it with the server copy so a
    // stale browser tab can add/update imported customers but never erase ones
    // created elsewhere.
    if (section === "customers") {
      if (!Array.isArray(data)) return NextResponse.json({ error: "invalid customers" }, { status: 400 });
      const current = await collection.findOne({ _id: "primary" }, { projection: { customers: 1 } });
      const merged = new Map<number, unknown>();
      for (const customer of Array.isArray(current?.customers) ? current.customers : []) {
        const id = Number((customer as { id?: unknown }).id);
        if (Number.isFinite(id)) merged.set(id, customer);
      }
      for (const customer of data) {
        const id = Number((customer as { id?: unknown }).id);
        if (Number.isFinite(id)) merged.set(id, customer);
      }
      await collection.updateOne({ _id: "primary" }, { $set: { customers: [...merged.values()], updatedAt: new Date() } }, { upsert: true });
      return NextResponse.json(await readDatabase());
    }
    // Categories live in settings while product membership lives in categoryIds.
    // Persist them together so a later product update cannot overwrite the
    // category list (or leave it out of sync with product assignments).
    if (section === "catalog") {
      const catalog = data as { products?: unknown; settings?: unknown };
      if (!Array.isArray(catalog.products) || !catalog.settings || typeof catalog.settings !== "object") {
        return NextResponse.json({ error: "invalid catalog" }, { status: 400 });
      }
      const current = await collection.findOne({ _id: "primary" }, { projection: { products: 1, settings: 1 } });
      const previous = new Map<string, Record<string, unknown>>();
      for (const product of Array.isArray(current?.products) ? current.products : []) {
        const item = product as Record<string, unknown>;
        previous.set(`id:${String(item.id ?? "")}`, item);
        previous.set(`name:${String(item.name ?? "").trim()}`, item);
      }
      const protectedProducts = catalog.products.map((product) => {
        const item = product as Record<string, unknown>;
        const old = previous.get(`id:${String(item.id ?? "")}`) || previous.get(`name:${String(item.name ?? "").trim()}`);
        const oldCategories = Array.isArray(old?.categoryIds) ? old.categoryIds : [];
        const nextCategories = Array.isArray(item.categoryIds) ? item.categoryIds : [];
        // Imports and stale browser tabs may contain only price/name fields.
        // Keep product metadata that they do not explicitly provide.
        return {
          ...old,
          ...item,
          unit: String(item.unit || old?.unit || "کیلوگرم"),
          description: String(item.description || old?.description || ""),
          categoryIds: [...new Set([...oldCategories, ...nextCategories])],
          levels: Array.isArray(item.levels) && item.levels.length ? item.levels : old?.levels || [],
          percentages: Array.isArray(item.percentages) && item.percentages.length ? item.percentages : old?.percentages || [],
          rounding: Array.isArray(item.rounding) && item.rounding.length ? item.rounding : old?.rounding || [],
          roundingEnabled: Array.isArray(item.roundingEnabled) && item.roundingEnabled.length ? item.roundingEnabled : old?.roundingEnabled || [],
          fixedPrices: Array.isArray(item.fixedPrices) && item.fixedPrices.length ? item.fixedPrices : old?.fixedPrices || [],
          invoices: Array.isArray(item.invoices) && item.invoices.length ? item.invoices : old?.invoices || [],
          priceHistory: Array.isArray(item.priceHistory) && item.priceHistory.length ? item.priceHistory : old?.priceHistory || [],
        };
      });
      const incomingSettings = catalog.settings as Record<string, unknown>;
      const oldSettings = (current?.settings || {}) as Record<string, unknown>;
      const oldCategories = Array.isArray(oldSettings.categories) ? oldSettings.categories : [];
      const nextCategories = Array.isArray(incomingSettings.categories) ? incomingSettings.categories : [];
      const protectedSettings = { ...oldSettings, ...incomingSettings, categories: [...new Map([...oldCategories, ...nextCategories].map((category) => [String((category as { id?: unknown }).id ?? ""), category])).values()] };
      await collection.updateOne(
        { _id: "primary" },
        { $set: { products: protectedProducts, settings: protectedSettings, updatedAt: new Date() } },
        { upsert: true },
      );
      return NextResponse.json(await readDatabase());
    }
    await collection.updateOne({ _id: "primary" }, { $set: { [section]: data, updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json(await readDatabase());
  } catch {
    return NextResponse.json({ error: "database update failed" }, { status: 500 });
  }
}
