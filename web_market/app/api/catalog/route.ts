import { NextRequest, NextResponse } from "next/server";
import { mongoDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type StoredProduct = Record<string, unknown> & { categoryIds?: unknown; active?: unknown };
type StoredSettings = Record<string, unknown> & { categories?: unknown[] };
type CatalogDocument = Record<string, unknown> & { _id: string };

export async function GET(request: NextRequest) {
  try {
    const requestedCategoryId = request.nextUrl.searchParams.get("category")?.trim() || "";
    const database = await (await mongoDatabase()).collection<CatalogDocument>("appState").findOne(
      { _id: "primary" },
      { projection: { products: 1, settings: 1 } },
    );
    const settings = (database?.settings || {}) as StoredSettings;
    const categories = Array.isArray(settings.categories) ? settings.categories : [];
    const categoryExists = !requestedCategoryId || categories.some((category) => String((category as { id?: unknown }).id || "") === requestedCategoryId);
    const products = (Array.isArray(database?.products) ? database.products : [])
      .filter((item) => {
        const product = item as StoredProduct;
        return product.active !== false && (!requestedCategoryId || (Array.isArray(product.categoryIds) && product.categoryIds.map(String).includes(requestedCategoryId)));
      })
      .map((item) => {
        const product = item as StoredProduct;
        // Keep the public endpoint limited to fields displayed in the catalog.
        const { invoices, priceHistory, ...publicProduct } = product;
        return publicProduct;
      });

    return NextResponse.json({
      products: categoryExists ? products : [],
      settings: {
        id: "settings",
        columnLabels: Array.isArray(settings.columnLabels) ? settings.columnLabels : [],
        categories,
        catalogContact: settings.catalogContact || {},
        currency: settings.currency || "toman",
      },
      categoryFound: categoryExists,
    });
  } catch {
    return NextResponse.json({ error: "catalog unavailable" }, { status: 500 });
  }
}
