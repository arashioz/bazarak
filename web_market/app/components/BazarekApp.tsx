"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  Database,
  ExternalLink,
  ListChecks,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CustomerDrawer from "./CustomerDrawer";
import { confirmDelete } from "@/app/lib/confirm-delete";
import MobileBottomNav from "./MobileBottomNav";

type Invoice = { price: number; registeredAt: string };
type PriceHistory = { previousPrice: number; price: number; changedAt: string };
type ProductLevel = { id: string; label: string; unit: string; quantity: string; price: number; percent?: number; rounding?: number; roundingMode?: "up" | "down" | "none" };
type ImportReport = { id: string; fileName: string; importedAt: string; added: number; priceChanged: number; unchanged: number };
type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  stock: number;
  active: boolean;
  featured: boolean;
  updated: string;
  catalogUrl: string;
  imageUrl: string;
  description: string;
  invoices: Invoice[];
  priceHistory: PriceHistory[];
  percentages: number[];
  rounding: number[];
  roundingEnabled: boolean[];
  fixedPrices: number[];
  categoryIds: string[];
  levels?: ProductLevel[];
};
type Currency = "toman" | "rial";
type CatalogContact = { mobile?: string; phone?: string; address?: string };
type AppSettings = { id: "settings"; columnLabels: string[]; categories: { id: string; name: string }[]; browseMode?: "sections" | "phonebook"; importReports?: ImportReport[]; currency?: Currency; catalogContact?: CatalogContact };
type Task = { id: number; text: string; done: boolean };
type View = "landing" | "user" | "login" | "admin" | "catalog";
type AdminTab = "products" | "tasks" | "reports";

const DEFAULT_LABELS = ["سطح ۱", "سطح ۲", "سطح ۳", "سطح ۴"];
const DEFAULT_SETTINGS: AppSettings = { id: "settings", columnLabels: DEFAULT_LABELS, categories: [], browseMode: "sections", currency: "toman" };

const now = () => new Date().toISOString();
const money = (value: number) => value.toLocaleString("fa-IR");
const phoneDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/\D/g, "");
const categoryId = (value: unknown) => { try { return decodeURIComponent(String(value ?? "")).trim(); } catch { return String(value ?? "").trim(); } };
const latestPurchase = (product: Product) => product.price;
const parseAmount = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,\s]/g, "")
    .replace(/[^0-9.-]/g, "");
  return Number(normalized) || 0;
};
const parsePriceAmount = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,\.\s]/g, "")
    .replace(/[^0-9-]/g, "");
  return Number(normalized) || 0;
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const dateTime = (value: string) =>
  new Date(value).toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const priceChangeTime = (change?: PriceHistory) => {
  const value = change ? Date.parse(change.changedAt) : 0;
  return Number.isFinite(value) ? value : 0;
};
const sortedPriceHistory = (history: PriceHistory[]) => [...history].sort((a, b) => priceChangeTime(b) - priceChangeTime(a));
const sale = (product: Product, index: number) => {
  if (product.fixedPrices[index] > 0) return product.fixedPrices[index];
  const exact = product.price * (1 + product.percentages[index] / 100);
  return Math.round(exact);
};
const levelPriceForBasePrice = (basePrice: number, level: ProductLevel) => {
  if (level.percent === undefined) return level.price;
  const exact = basePrice * (parseAmount(level.quantity) || 1) * (1 + level.percent / 100);
  const rounding = Math.max(1, level.rounding || 1);
  return level.roundingMode === "up" ? Math.ceil(exact / rounding) * rounding : level.roundingMode === "down" ? Math.floor(exact / rounding) * rounding : Math.round(exact);
};
const levelPrice = (_product: Product, level: ProductLevel) => level.price;
const currencyTitle = (currency: Currency = "toman") => currency === "rial" ? "ریال" : "تومان";
const convertProductCurrency = (product: Product, factor: number): Product => ({
  ...product,
  price: Math.round(product.price * factor),
  invoices: product.invoices.map((invoice) => ({ ...invoice, price: Math.round(invoice.price * factor) })),
  priceHistory: product.priceHistory.map((change) => ({ ...change, previousPrice: Math.round(change.previousPrice * factor), price: Math.round(change.price * factor) })),
  fixedPrices: product.fixedPrices.map((price) => Math.round(price * factor)),
  rounding: product.rounding.map((price) => Math.round(price * factor)),
  levels: product.levels?.map((level) => ({ ...level, price: Math.round(level.price * factor), rounding: level.rounding === undefined ? undefined : Math.round(level.rounding * factor) })),
});

const normalizeProducts = (raw: unknown): Product[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const product = item as Partial<Product> & { invoices?: Array<number | Invoice>; priceHistory?: PriceHistory[] };
    const updated = product.updated || now();
    const price = Number(product.price || 0);
    const invoices =
      product.invoices?.map((invoice) =>
        typeof invoice === "number" ? { price: invoice, registeredAt: updated } : invoice
      ) || [];
    const levels = Array.isArray(product.levels)
      ? product.levels.map((level) => level.percent === undefined ? level : { ...level, price: levelPriceForBasePrice(price, level) })
      : [];
    return {
      id: Number(product.id || Date.now()),
      name: String(product.name || "محصول"),
      price,
      unit: String(product.unit || "کیلوگرم"),
      stock: Number(product.stock || 0),
      active: product.active !== false,
      featured: Boolean(product.featured),
      updated,
      catalogUrl: String(product.catalogUrl || ""),
      imageUrl: String(product.imageUrl || ""),
      description: String(product.description || ""),
      invoices,
      priceHistory: Array.isArray(product.priceHistory) ? product.priceHistory : [],
      percentages: product.percentages || [12, 9, 6, 0],
      rounding: product.rounding || [1000, 1000, 1000, 1000],
      roundingEnabled: product.roundingEnabled || [true, true, true, true],
      fixedPrices: product.fixedPrices || [],
      categoryIds: product.categoryIds || [],
      levels,
    };
  });
};

const mergeProducts = (base: Product[], saved: Product[]) => {
  const byName = new Map(base.map((product) => [product.name, product]));
  saved.forEach((product) => byName.set(product.name, { ...byName.get(product.name), ...product }));
  return Array.from(byName.values());
};

type ServerDatabase = { products?: unknown; settings?: AppSettings; tasks?: Task[] };
type CatalogDatabase = ServerDatabase & { categoryFound?: boolean };

const recoverCategories = (settings: AppSettings, products: Product[]): AppSettings => {
  const known = new Set(settings.categories.map((category) => category.id));
  const recovered = products.flatMap((product) => product.categoryIds || []).filter((id) => !known.has(id)).map((id) => ({ id, name: id.replace(/^\d+-/, "") || "دسته‌بندی بازیابی‌شده" }));
  return recovered.length ? { ...settings, categories: [...settings.categories, ...recovered] } : settings;
};

const readMongoDatabase = async () => {
  const response = await fetch("/api/database", { cache: "no-store" });
  if (!response.ok) throw new Error("database unavailable");
  return response.json() as Promise<ServerDatabase>;
};

const readCatalog = async (categoryId: string | null) => {
  const query = categoryId ? `?category=${encodeURIComponent(categoryId)}` : "";
  const response = await fetch(`/api/catalog${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("catalog unavailable");
  return response.json() as Promise<CatalogDatabase>;
};

let databaseWriteQueue = Promise.resolve();
const saveMongoSection = (section: "products" | "settings" | "catalog" | "productCategory" | "tasks", data: unknown) => {
  databaseWriteQueue = databaseWriteQueue.catch(() => undefined).then(async () => {
    const response = await fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, data }) });
    if (!response.ok) throw new Error("database update failed");
  });
  return databaseWriteQueue;
};

export default function BazarekApp({ initialView }: { initialView: View }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [view, setView] = useState<View>(initialView);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const productsRef = useRef<Product[]>([]);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [databaseLoaded, setDatabaseLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState("name");
  const saveCatalog = (nextProducts: Product[], nextSettings: AppSettings) => {
    productsRef.current = nextProducts;
    settingsRef.current = nextSettings;
    return saveMongoSection("catalog", { products: nextProducts, settings: nextSettings });
  };
  const saveProducts = (next: Product[]) => {
    setProducts(next);
    return saveCatalog(next, settingsRef.current).then(() => true).catch(() => { setError("ذخیره محصولات و دسته‌بندی‌ها در MongoDB ناموفق بود؛ اتصال سرور را بررسی کنید."); return false; });
  };
  const saveProductCategory = (productId: number, categoryId: string, assigned: boolean) =>
    saveMongoSection("productCategory", { productId, categoryId, assigned });
  const saveSettings = (next: AppSettings) => { setSettings(next); void saveCatalog(productsRef.current, next).catch(() => setError("ذخیره دسته‌بندی‌ها در MongoDB ناموفق بود.")); };
  const saveTasks = (next: Task[]) => { setTasks(next); void saveMongoSection("tasks", next).catch(() => setError("ذخیره تسک در MongoDB ناموفق بود.")); };
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // The login screen must stay available before a manager token exists.
      if (initialView === "login") {
        setDatabaseLoaded(true);
        return;
      }
      const shouldShowIntro = localStorage.getItem("bazarek-intro-seen") !== "1";
      if (shouldShowIntro) {
        setShowIntro(true);
        localStorage.setItem("bazarek-intro-seen", "1");
        window.setTimeout(() => setShowIntro(false), 1800);
      }

      const database = initialView === "catalog"
        ? await readCatalog(searchParams.get("category"))
        : await readMongoDatabase();
      const nextProducts = normalizeProducts(database.products);

      if (!cancelled) {
        const nextSettings = recoverCategories(database.settings || DEFAULT_SETTINGS, nextProducts);
        productsRef.current = nextProducts;
        settingsRef.current = nextSettings;
        setProducts(nextProducts);
        setSettings(nextSettings);
        if (initialView !== "catalog" && nextSettings !== database.settings) void saveCatalog(nextProducts, nextSettings);
        setTasks(database.tasks || []);
        setDatabaseLoaded(true);
        if (initialView === "landing" && localStorage.getItem("bazarek-role") === "user") {
          setView("user");
          router.replace("/products");
        }
      }

    };

    boot().catch(() => {
      if (!cancelled) {
        setError("اتصال به دیتابیس سرور برقرار نشد.");
        setDatabaseLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialView, router, searchParams]);

  const navigate = (nextView: View, path: string) => {
    setError("");
    setSelected(null);
    setShowAddProduct(false);
    setView(nextView);
    router.push(path);
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    navigate("login", "/modir/login");
  };

  const filtered = useMemo(() => products.filter((product) => product.name.includes(q.trim())), [products, q]);
  const visibleProducts = useMemo(() => [...filtered.filter((product) => !categoryFilter || product.categoryIds.includes(categoryFilter))].sort((a, b) => sortMode === "price-asc" ? a.price - b.price : sortMode === "price-desc" ? b.price - a.price : sortMode === "stock-desc" ? b.stock - a.stock : a.name.localeCompare(b.name, "fa")), [filtered, categoryFilter, sortMode]);
  const catalogCategoryId = categoryId(searchParams.get("category") || (pathname.startsWith("/catalog/") ? pathname.slice("/catalog/".length) : "")) || null;
  const catalogCategory = settings.categories.find((category) => categoryId(category.id) === catalogCategoryId);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const price = Number(form.get("price"));
    if (name.length < 2 || price < 1) {
      setError("نام و قیمت معتبر وارد کنید.");
      return;
    }

    const createdAt = now();
    const getNumber = (key: string) => Number(form.get(key));
    const saved = await saveProducts([
      {
        id: Date.now(),
        name,
        price,
        unit: "کیلوگرم",
        stock: 0,
        active: true,
        featured: form.get("featured") === "on",
        updated: createdAt,
        catalogUrl: String(form.get("catalogUrl") || "").trim(),
        imageUrl: String(form.get("imageUrl") || "").trim(),
        description: String(form.get("description") || "").trim(),
        invoices: [{ price, registeredAt: createdAt }],
        priceHistory: [],
        percentages: [getNumber("p1"), getNumber("p2"), getNumber("p3")],
        rounding: [getNumber("r1"), getNumber("r2"), getNumber("r3")],
        roundingEnabled: [true, true, true],
        fixedPrices: [],
        categoryIds: form.getAll("categoryIds").map(String),
      },
      ...products,
    ]);
    if (!saved) return;
    event.currentTarget.reset();
    setError("");
    setShowAddProduct(false);
  };

  const invoice = async (value: number, recordInvoice: boolean) => {
    if (!selected) return;
    if (value < 1) return;
    const registeredAt = now();
    const nextSelected = {
      ...selected,
      price: value,
      levels: selected.levels?.map((level) => level.percent === undefined ? level : { ...level, price: levelPriceForBasePrice(value, level) }),
      invoices: recordInvoice ? [{ price: value, registeredAt }, ...selected.invoices] : selected.invoices,
      priceHistory: selected.price === value ? selected.priceHistory : [{ previousPrice: selected.price, price: value, changedAt: registeredAt }, ...selected.priceHistory],
      updated: registeredAt,
    };
    setSelected(nextSelected);
    const saved = await saveProducts(products.map((product) => (product.id === selected.id ? nextSelected : product)));
    if (saved) showNotice(recordInvoice ? "قیمت خرید و فاکتور جدید با موفقیت ذخیره شد." : "قیمت خرید با موفقیت به‌روزرسانی شد.");
  };

  const updateColumnLabels = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveSettings({
      id: "settings",
      columnLabels: Array.from({ length: Number(form.get("labelCount")) || settings.columnLabels.length }, (_, index) => String(form.get(`label${index + 1}`) || `سطح ${index + 1}`)),
      categories: settings.categories,
      browseMode: settings.browseMode || "sections", importReports: settings.importReports || [], currency: settings.currency || "toman",
    });
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("task") || "").trim();
    if (!text) return;
    saveTasks([{ id: Date.now(), text, done: false }, ...tasks]);
    event.currentTarget.reset();
  };

  const importExcel = async (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
      const headerIndex = rows.findIndex((row) => row.some((cell) => /نام|محصول/.test(String(cell))));
      const headers = (rows[headerIndex >= 0 ? headerIndex : 0] || []).map((cell) => String(cell));
      const nameCol = Math.max(0, headers.findIndex((header) => /نام|محصول/.test(header)));
      const purchaseCol = headers.findIndex((header) => /قیمت\s*خرید|خرید|عمده/.test(header));
      const priceCol = purchaseCol >= 0 ? purchaseCol : 2;
      const percentCol = headers.findIndex((header) => /درصد|%/.test(header));
      const imported: Product[] = [];
      let added = 0;
      let priceChanged = 0;
      let unchanged = 0;
      rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0).forEach((row, index) => {
        const name = String(row[nameCol] || "").trim();
        const price = parsePriceAmount(row[priceCol]);
        if (!name || price < 1) return;
        const previous = products.find((product) => product.name === name);
        const registeredAt = now();
        const percent = percentCol >= 0 ? parseAmount(row[percentCol]) : 0;
        if (!previous) added += 1;
        else if (previous.price !== price) priceChanged += 1;
        else unchanged += 1;
        const hasPriceChange = Boolean(previous && previous.price !== price);
        imported.push({ ...(previous || {}), id: previous?.id ?? Date.now() + index, name, price, updated: hasPriceChange || !previous ? registeredAt : previous.updated,
          invoices: !previous || hasPriceChange ? [{ price, registeredAt }, ...(previous?.invoices || [])] : previous.invoices, priceHistory: hasPriceChange ? [{ previousPrice: previous!.price, price, changedAt: registeredAt }, ...previous!.priceHistory] : previous?.priceHistory || [], percentages: previous?.percentages || [percent, percent, percent],
          unit: previous?.unit || "کیلوگرم", stock: previous?.stock || 0, active: previous?.active ?? true, rounding: previous?.rounding || [1000, 1000, 1000, 1000], roundingEnabled: previous?.roundingEnabled || [true, true, true, true], fixedPrices: previous?.fixedPrices || [], categoryIds: previous?.categoryIds || [], featured: previous?.featured ?? false, catalogUrl: previous?.catalogUrl || "", imageUrl: previous?.imageUrl || "", description: previous?.description || "" });
      });
      if (!imported.length) throw new Error("empty");
      const byName = new Map(products.map((product) => [product.name, product]));
      imported.forEach((product) => byName.set(product.name, product));
      const saved = await saveProducts(Array.from(byName.values()));
      if (!saved) return;
      const report: ImportReport = { id: `${Date.now()}`, fileName: file.name, importedAt: now(), added, priceChanged, unchanged };
      saveSettings({ ...settings, importReports: [report, ...(settings.importReports || [])].slice(0, 30) });
      setError(`${added} محصول جدید، ${priceChanged} تغییر قیمت و ${unchanged} مورد بدون تغییر ثبت شد.`);
    } catch {
      setError("خواندن فایل اکسل ناموفق بود. ستون نام محصول و قیمت خرید را بررسی کنید.");
    }
  };
  const exportExcel = () => {
    const exportLabels = Array.from({ length: Math.max(settings.columnLabels.length, ...products.map((product) => product.levels?.length || 0)) }, (_, index) => settings.columnLabels[index] || products.find((product) => product.levels?.[index]?.label)?.levels?.[index]?.label || `سطح ${index + 1}`);
    const rows = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).map((product) => {
      const lastChange = sortedPriceHistory(product.priceHistory)[0];
      return {
        "نام محصول": product.name,
        "قیمت خرید فعلی": product.price,
        "فعال": product.active ? "فعال" : "غیرفعال",
        "محصول برتر": product.featured ? "بله" : "خیر",
        "آخرین تغییر قیمت": lastChange ? lastChange.price : "",
        "قیمت قبل از آخرین تغییر": lastChange ? lastChange.previousPrice : "",
        "تاریخ آخرین تغییر": lastChange ? dateTime(lastChange.changedAt) : "",
        "تعداد تغییر قیمت": product.priceHistory.length,
        "تاریخچه تغییر قیمت": sortedPriceHistory(product.priceHistory).map((change) => `${money(change.previousPrice)} ← ${money(change.price)} | ${dateTime(change.changedAt)}`).join("\n"),
        ...Object.fromEntries(exportLabels.map((label, index) => [label, product.levels?.[index]?.price ?? sale(product, index)])),
      };
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 60 }, ...exportLabels.map(() => ({ wch: 16 }))];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "محصولات و تغییر قیمت"); XLSX.writeFile(book, "گزارش محصولات بازارک.xlsx");
  };
  const exportCategoryExcel = (category: { id: string; name: string }) => {
    const categoryProducts = products.filter((product) => product.categoryIds.includes(category.id)); const exportLabels = Array.from({ length: Math.max(settings.columnLabels.length, ...categoryProducts.map((product) => product.levels?.length || 0)) }, (_, index) => settings.columnLabels[index] || categoryProducts.find((product) => product.levels?.[index]?.label)?.levels?.[index]?.label || `سطح ${index + 1}`); const rows = categoryProducts.map((product) => ({ "نام محصول": product.name, "قیمت خرید فعلی": product.price, "فعال": product.active ? "فعال" : "غیرفعال", "توضیحات": product.description, ...Object.fromEntries(exportLabels.map((label, index) => [label, product.levels?.[index]?.price ?? sale(product, index)])) }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 12 }, { wch: 40 }, ...exportLabels.map(() => ({ wch: 16 }))];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, category.name.slice(0, 31) || "دسته"); XLSX.writeFile(book, `دسته ${category.name}.xlsx`);
  };
  const changeCurrency = async (nextCurrency: Currency) => {
    const currentCurrency = settings.currency || "toman";
    if (nextCurrency === currentCurrency) return;
    const factor = nextCurrency === "rial" ? 10 : 0.1;
    const nextProducts = products.map((product) => convertProductCurrency(product, factor));
    const saved = await saveProducts(nextProducts);
    if (!saved) return;
    saveSettings({ ...settings, currency: nextCurrency });
    showNotice(`همهٔ مبالغ به ${currencyTitle(nextCurrency)} تبدیل شد.`);
  };

  if (showIntro || !databaseLoaded) return <LoadingIntro />;

  if (view === "landing") {
    return <Landing navigate={navigate} />;
  }

  if (view === "login") {
    return <Login navigate={navigate} error={error} setError={setError} />;
  }

  const isAdmin = view === "admin";
  return (
    <main className={`min-h-screen bg-blush text-oxblood-dark ${isAdmin ? "pb-20 sm:pb-0" : ""}`}>
      {view !== "catalog" && <Header q={q} setQ={setQ} navigate={navigate} admin={isAdmin} onLogout={logout} />}
      {isAdmin && <CustomerDrawer />}
      {notice && <div role="status" className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>}
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {view === "catalog" ? (
          <Catalog products={products} labels={settings.columnLabels} categories={settings.categories} selectedCategoryId={catalogCategoryId} contact={settings.catalogContact || {}} onSelect={setSelected} />
        ) : isAdmin ? (
          <Admin
            products={visibleProducts}
            labels={settings.columnLabels}
            categories={settings.categories}
            browseMode={settings.browseMode || "sections"}
            importReports={settings.importReports || []}
            tasks={tasks}
            onSelect={setSelected}
            onToggleFeatured={(product) => saveProducts(products.map((item) => item.id === product.id ? { ...item, featured: !item.featured, updated: now() } : item))}
            onOpenAdd={() => setShowAddProduct(true)}
            onImportExcel={importExcel}
            onExportExcel={exportExcel}
            onExportCategoryExcel={exportCategoryExcel}
            currency={settings.currency || "toman"}
            onChangeCurrency={changeCurrency}
            onSaveLabels={updateColumnLabels}
            onCategoriesChange={(categories) => saveSettings({ ...settings, categories })}
            catalogContact={settings.catalogContact || {}}
            onCatalogContactChange={(catalogContact) => saveSettings({ ...settings, catalogContact })}
            onBrowseMode={(browseMode) => saveSettings({ ...settings, browseMode })}
            onAssignCategory={(categoryId, ids) => saveProducts(products.map((product) => ids.includes(product.id) ? { ...product, categoryIds: Array.from(new Set([...product.categoryIds, categoryId])) } : product))}
            onApplyLevels={(ids, levels) => saveProducts(products.map((product) => ids.includes(product.id) ? { ...product, levels: levels.map((level) => level.percent === undefined ? level : { ...level, price: levelPriceForBasePrice(product.price, level) }), updated: now() } : product))}
            onAddTask={addTask}
            onToggleTask={(id) => saveTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))}
            onDeleteTask={(id) => saveTasks(tasks.filter((task) => task.id !== id))}
            error={error}
          />
        ) : (
          <ProductSections products={visibleProducts.filter((product) => product.active)} labels={settings.columnLabels} mode={settings.browseMode} onSelect={setSelected} />
        )}
      </div>
      {view !== "catalog" && <CategoryFilter categories={settings.categories} products={products} value={categoryFilter} onChange={setCategoryFilter} sortMode={sortMode} onSort={setSortMode} />}
      {showAddProduct && (
        <AddProductSheet labels={settings.columnLabels} categories={settings.categories} onClose={() => setShowAddProduct(false)} onAdd={add} error={error} />
      )}
      {selected && (
        <Detail
          key={selected.id}
          product={selected}
          labels={settings.columnLabels}
          categories={settings.categories}
          admin={isAdmin}
          onClose={() => setSelected(null)}
          onInvoice={invoice}
          onToggleActive={() => {
            const nextSelected = { ...selected, active: !selected.active, updated: now() };
            saveProducts(products.map((product) => product.id === selected.id ? nextSelected : product));
            setSelected(nextSelected);
          }}
          onCategoryChange={async (categoryId, checked) => {
            const categoryIds = checked ? Array.from(new Set([...selected.categoryIds, categoryId])) : selected.categoryIds.filter((id) => id !== categoryId);
            const nextSelected = { ...selected, categoryIds, updated: now() };
            try {
              await saveProductCategory(selected.id, categoryId, checked);
              setProducts(products.map((product) => product.id === selected.id ? nextSelected : product));
              productsRef.current = products.map((product) => product.id === selected.id ? nextSelected : product);
              setSelected(nextSelected);
              showNotice(checked ? "محصول در دسته ثبت شد." : "محصول از دسته خارج شد.");
            } catch {
              setError("تغییر دسته‌بندی محصول در MongoDB ناموفق بود؛ اتصال سرور را بررسی کنید.");
            }
          }}
          onUpdatePricing={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const levels = (() => { try { const value = JSON.parse(String(form.get("levels") || "[]")); return Array.isArray(value) ? value.map((level) => level.percent === undefined ? level : { ...level, price: levelPriceForBasePrice(selected.price, level) }) : []; } catch { return selected.levels || []; } })();
            const nextSelected = {
              ...selected,
              name: String(form.get("name") || selected.name).trim(),
              unit: String(form.get("unit") === "__custom__" ? form.get("unitManual") : form.get("unit") || selected.unit).trim(),
              description: String(form.get("description") || "").trim(),
              imageUrl: String(form.get("imageUrl") || "").trim(),
              levels,
              percentages: settings.columnLabels.map((_, index) => Number(levels[index]?.percent ?? selected.percentages[index] ?? 0)),
              rounding: selected.rounding,
              roundingEnabled: selected.roundingEnabled,
              categoryIds: settings.categories.filter((category) => form.get(`category-${category.id}`) === "on").map((category) => category.id),
              updated: now(),
            };
            const saved = await saveProducts(products.map((product) => (product.id === selected.id ? nextSelected : product)));
            if (saved) showNotice("قیمت‌گذاری و سطح‌های محصول با موفقیت ذخیره شد.");
            setSelected(nextSelected);
          }}
          onDelete={async () => {
            if (!confirmDelete(`محصول «${selected.name}»`)) return;
            const password = window.prompt("رمز حذف محصول را وارد کنید");
            if (password !== "7755") { setError("رمز حذف محصول صحیح نیست."); return; }
            const response = await fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "productDelete", data: { id: selected.id, password } }) });
            if (!response.ok) { setError("حذف محصول از MongoDB ناموفق بود."); return; }
            setProducts((current) => current.filter((product) => product.id !== selected.id));
            setSelected(null);
            showNotice("محصول از دیتابیس حذف شد.");
          }}
        />
      )}
      {isAdmin && <MobileBottomNav />}
    </main>
  );
}

function CategoryFilter({ categories, products, value, onChange, sortMode, onSort }: { categories: { id: string; name: string }[]; products: Product[]; value: string | null; onChange: (value: string | null) => void; sortMode: string; onSort: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="fixed left-4 top-[calc(50%+1rem)] z-10 rounded-full bg-oxblood px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-oxblood-dark">فیلتر دسته‌ها</button>{open && <div className="fixed inset-0 z-40 flex justify-end"><button onClick={() => setOpen(false)} className="absolute inset-0 bg-oxblood-dark/40" aria-label="بستن"/><section className="relative h-full w-[92vw] max-w-md overflow-y-auto bg-white p-5 shadow-2xl animate-in slide-in-from-right duration-200"><h2 className="text-lg font-black">فیلتر و مرتب‌سازی</h2><select value={sortMode} onChange={(event) => onSort(event.target.value)} className="mt-4 w-full rounded-lg border border-oxblood/15 p-3"><option value="name">نام محصول</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="stock-desc">بیشترین موجودی</option></select><p className="mt-4 text-xs text-oxblood-dark/55">دسته‌بندی موردنظر را انتخاب کنید.</p><div className="mt-2 space-y-2"><button onClick={() => { onChange(null); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg border p-3 text-right ${!value ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>همه محصولات</span><b>{products.filter((product) => product.active).length}</b></button>{categories.map((category) => { const count = products.filter((product) => product.active && product.categoryIds.includes(category.id)).length; return <button key={category.id} onClick={() => { onChange(category.id); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg border p-3 text-right ${value === category.id ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>{category.name}</span><b>{count} محصول</b></button>; })}</div></section></div>}</>;
}

function Landing({ navigate }: { navigate: (nextView: View, path: string) => void }) {
  return (
    <main className="min-h-screen bg-blush px-4 py-10 text-oxblood-dark sm:px-6 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <p className="text-lg font-black text-oxblood">بازارک</p>
        <p className="mt-2 text-sm text-oxblood-dark/65">نسخه آسیاب صداقت</p>
        <h1 className="mt-12 text-2xl font-black leading-tight sm:mt-16 sm:text-4xl">کدام بخش را می‌خواهید؟</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          <button
            onClick={() => {
              localStorage.setItem("bazarek-role", "user");
              navigate("user", "/products");
            }}
            className="rounded-lg border border-oxblood/15 bg-white p-5 text-right shadow-sm transition hover:border-oxblood/45 sm:p-7"
          >
            <Search className="mb-7 text-oxblood" />
            <b className="block text-xl sm:text-2xl">کاربر هستم</b>
            <span className="mt-2 block text-sm text-oxblood-dark/60">جستجو و مشاهده قیمت محصولات</span>
          </button>
          <button
            onClick={() => navigate("catalog", "/catalog")}
            className="rounded-lg border border-oxblood/15 bg-white p-5 text-right shadow-sm transition hover:border-oxblood/45 sm:p-7"
          >
            <BookOpen className="mb-7 text-oxblood" />
            <b className="block text-xl sm:text-2xl">کاتالوگ</b>
            <span className="mt-2 block text-sm text-oxblood-dark/60">کاتالوگ کامل محصولات</span>
          </button>
          <button
            onClick={() => navigate("login", "/modir/login")}
            className="rounded-lg bg-oxblood p-5 text-right text-white shadow-sm transition hover:bg-oxblood-dark sm:p-7"
          >
            <ShieldCheck className="mb-7 text-white" />
            <b className="block text-xl sm:text-2xl">مدیر هستم</b>
            <span className="mt-2 block text-sm text-white/75">مدیریت مهدی</span>
          </button>
        </div>
      </div>
    </main>
  );
}

function Login({
  navigate,
  error,
  setError,
}: {
  navigate: (nextView: View, path: string) => void;
  error: string;
  setError: (error: string) => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-blush p-4 text-oxblood-dark">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: new FormData(event.currentTarget).get("password") }),
          });
          if (response.ok) {
            navigate("admin", "/modir/panel");
          } else {
            setError("رمز مدیر درست نیست.");
          }
        }}
        className="w-full max-w-sm rounded-lg border border-oxblood/15 bg-white p-6 shadow-sm sm:p-7"
      >
        <button type="button" onClick={() => navigate("landing", "/")} className="mb-6 text-oxblood/65">
          <ArrowRight size={18} />
        </button>
        <h1 className="text-2xl font-black">ورود مدیر</h1>
        <p className="mt-2 text-sm text-oxblood-dark/55">مهدی، رمز مدیریت را وارد کنید.</p>
        <input name="password" type="password" className="mt-6 w-full rounded-lg border border-oxblood/15 p-3" />
        <p className="mt-2 min-h-5 text-xs text-oxblood">{error}</p>
        <button className="mt-3 w-full rounded-lg bg-oxblood p-3 font-bold text-white">ورود</button>
      </form>
    </main>
  );
}

function Header({
  q,
  setQ,
  navigate,
  admin,
  onLogout,
}: {
  q: string;
  setQ: (value: string) => void;
  navigate: (nextView: View, path: string) => void;
  admin: boolean;
  onLogout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-oxblood/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <b className="text-xl font-black text-oxblood">بازارک</b>
          <span className="mr-2 text-xs text-oxblood-dark/45">نسخه آسیاب صداقت</span>
        </div>
        <div className="relative w-full sm:mr-auto sm:max-w-md">
          <Search className="absolute right-3 top-3 text-oxblood/45" size={18} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="جستجو در محصولات..."
            className="w-full rounded-lg border border-oxblood/10 bg-blush py-2 pr-10 pl-3 text-oxblood-dark"
          />
        </div>
        <div className="flex gap-3 text-sm font-bold text-oxblood">
          {admin && <><Link href="/customers" className="rounded-lg px-2 py-1 hover:bg-blush">مشتریان</Link><Link href="/mobile-services" className="rounded-lg px-2 py-1 hover:bg-blush">خدمات سیار</Link></>}
          <button onClick={() => navigate("catalog", "/catalog")}>کاتالوگ</button>
          {admin ? <button onClick={() => void onLogout()}>خروج مدیر</button> : <button onClick={() => navigate("login", "/modir/login")}>ورود مدیر</button>}
          <button onClick={() => navigate("landing", "/")}>تغییر نقش</button>
        </div>
      </div>
    </header>
  );
}

function LoadingIntro() {
  return (
    <main className="fixed inset-0 z-50 grid place-items-center bg-oxblood text-white">
      <div className="relative grid place-items-center">
        <div className="bazarek-loader-ring" />
        <div className="bazarek-loader-core">
          <Sparkles size={26} />
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-4xl font-black">بازارک</h1>
          <p className="mt-2 text-sm text-white/75">نسخه آسیاب صداقت</p>
        </div>
      </div>
    </main>
  );
}

function ProductSections({
  products,
  labels,
  mode = "sections",
  admin,
  onSelect,
  onToggleFeatured,
  selectedIds,
  onToggleSelect,
}: {
  products: Product[];
  labels: string[];
  mode?: "sections" | "phonebook";
  admin?: boolean;
  onSelect: (product: Product) => void;
  onToggleFeatured?: (product: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
}) {
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  const letters = Array.from(new Set(products.map((product) => product.name.trim().charAt(0)))).filter(Boolean).sort((a, b) => a.localeCompare(b, "fa"));
  if (mode === "phonebook") {
    return <><h1 className="text-xl font-black sm:text-2xl">دفترچه محصولات</h1>{featured.length > 0 && <section className="mt-6"><h2 className="text-lg font-black text-oxblood">محصولات برتر</h2><Grid items={featured} labels={labels} admin={admin} onSelect={onSelect} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} /></section>}{letters.map((letter) => { const items = products.filter((product) => !product.featured && product.name.trim().startsWith(letter)); return items.length ? <section key={letter} className="mt-8"><h2 className="border-b border-oxblood/15 pb-2 text-2xl font-black text-oxblood">{letter}</h2><Grid items={items} labels={labels} admin={admin} onSelect={onSelect} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} /></section> : null; })}</>;
  }
  return (
    <>
      <h1 className="text-xl font-black sm:text-2xl">محصولات برتر</h1>
      <Grid items={featured} labels={labels} admin={admin} onSelect={onSelect} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
      <h2 className="mt-8 text-lg font-black sm:mt-10 sm:text-xl">سایر محصولات</h2>
      <Grid items={rest} labels={labels} admin={admin} onSelect={onSelect} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
    </>
  );
}

function Grid({
  items,
  labels,
  admin,
  onSelect,
  onToggleFeatured,
  selectedIds,
  onToggleSelect,
}: {
  items: Product[];
  labels: string[];
  admin?: boolean;
  onSelect: (product: Product) => void;
  onToggleFeatured?: (product: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((product) => (
        <div
          key={product.id}
          className="min-h-36 rounded-lg border border-oxblood/10 bg-white p-3 text-right shadow-sm transition hover:border-oxblood/45 sm:p-4"
        >
          <div className="flex items-start justify-between gap-2">{admin ? <button type="button" onClick={() => onToggleFeatured?.(product)} className="rounded-full p-1 hover:bg-amber-50" aria-label={product.featured ? "حذف از محصولات برتر" : "افزودن به محصولات برتر"}><Star size={18} className={product.featured ? "fill-amber-400 text-amber-400" : "text-oxblood/30"} /></button> : <Star size={15} className={product.featured ? "fill-amber-400 text-amber-400" : "text-oxblood/20"} />}{admin && onToggleSelect && <input type="checkbox" checked={selectedIds?.includes(product.id) || false} onChange={() => onToggleSelect(product.id)} className="h-5 w-5 accent-oxblood" aria-label={`انتخاب ${product.name}`} />}</div>
          <button onClick={() => onSelect(product)} className="w-full text-right">
          <b className="mt-4 block text-sm font-black leading-6 sm:text-base">{product.name}</b>
          {product.description && <small className="mt-1 block line-clamp-2 text-[11px] leading-5 text-oxblood-dark/55">{product.description}</small>}
          <span className="mt-1 block text-[11px] text-oxblood-dark/45">{labels[0]}</span>
          {admin && <strong className="mt-4 block text-[11px] font-black text-oxblood">آخرین خرید: {money(latestPurchase(product))}</strong>}
          <small className="mt-1 block text-[11px] text-oxblood-dark/45">تاریخ آخرین خرید: {product.invoices[0] ? date(product.invoices[0].registeredAt) : "ثبت نشده"}</small>
          {admin && <small className="mt-1 block text-[11px] text-oxblood-dark/45">تغییر قیمت: {date(product.updated)}</small>}
          {admin && <small className="mt-1 block text-[11px] text-oxblood-dark/45">{product.invoices.length} فاکتور</small>}
          </button>
          {admin && <button type="button" onClick={() => onSelect(product)} className="mt-3 w-full rounded-lg border border-oxblood/20 py-1.5 text-xs font-bold text-oxblood">ویرایش محصول</button>}
        </div>
      ))}
    </div>
  );
}

function Admin({
  products,
  labels,
  categories,
  browseMode,
  importReports,
  tasks,
  onSelect,
  onToggleFeatured,
  onOpenAdd,
  onImportExcel,
  onExportExcel,
  onExportCategoryExcel,
  currency,
  onChangeCurrency,
  onSaveLabels,
  onCategoriesChange,
  catalogContact,
  onCatalogContactChange,
  onBrowseMode,
  onAssignCategory,
  onApplyLevels,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  error,
}: {
  products: Product[];
  labels: string[];
  categories: { id: string; name: string }[];
  browseMode: "sections" | "phonebook";
  importReports: ImportReport[];
  tasks: Task[];
  onSelect: (product: Product) => void;
  onToggleFeatured: (product: Product) => void;
  onOpenAdd: () => void;
  onImportExcel: (event: FormEvent<HTMLInputElement>) => void;
  onExportExcel: () => void;
  onExportCategoryExcel: (category: { id: string; name: string }) => void;
  currency: Currency;
  onChangeCurrency: (currency: Currency) => void;
  onSaveLabels: (event: FormEvent<HTMLFormElement>) => void;
  onCategoriesChange: (categories: { id: string; name: string }[]) => void;
  catalogContact: CatalogContact;
  onCatalogContactChange: (contact: CatalogContact) => void;
  onBrowseMode: (mode: "sections" | "phonebook") => void;
  onAssignCategory: (categoryId: string, ids: number[]) => void;
  onApplyLevels: (ids: number[], levels: ProductLevel[]) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  error: string;
}) {
  const [tab, setTab] = useState<AdminTab>("products");
  const [showSettings, setShowSettings] = useState(false);
  const [selectingForCategory, setSelectingForCategory] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkPricing, setShowBulkPricing] = useState(false);
  const toggleSelection = (id: number) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  return (
    <section>
      <div className="rounded-2xl border border-oxblood/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black">پنل مهدی</h1>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-oxblood-dark/45">
            <Database size={14} />
            ذخیره در MongoDB سرور
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button onClick={onOpenAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-oxblood px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-oxblood-dark focus:outline-none focus:ring-2 focus:ring-oxblood/30">
          <Plus size={18} />
          افزودن محصول
        </button>
        <button onClick={() => { setSelectingForCategory(!selectingForCategory); if (selectingForCategory) setSelectedIds([]); }} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${selectingForCategory ? "bg-oxblood text-white shadow-sm" : "border border-oxblood/15 bg-blush text-oxblood hover:border-oxblood/40 hover:bg-white"}`}>ویرایش گروهی</button>
        <button onClick={() => setShowSettings(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-oxblood/15 bg-blush px-4 py-2.5 text-sm font-bold text-oxblood transition hover:border-oxblood/40 hover:bg-white">
          <Settings2 size={18} /> تنظیمات و دسته‌بندی
        </button>
        </div>
      </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-white p-1 shadow-sm sm:w-96">
        <button
          onClick={() => setTab("products")}
          className={`rounded-md px-3 py-2 text-sm font-bold ${tab === "products" ? "bg-oxblood text-white" : "text-oxblood"}`}
        >
          محصولات
        </button>
        <button
          onClick={() => setTab("tasks")}
          className={`rounded-md px-3 py-2 text-sm font-bold ${tab === "tasks" ? "bg-oxblood text-white" : "text-oxblood"}`}
        >
          تسک‌ها
        </button>
        <button onClick={() => setTab("reports")} className={`rounded-md px-3 py-2 text-sm font-bold ${tab === "reports" ? "bg-oxblood text-white" : "text-oxblood"}`}>گزارشات</button>
      </div>

      {tab === "products" ? (
        <div className="mt-5">
          {selectingForCategory && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-oxblood/10 bg-white p-3 shadow-sm"><b className="text-sm">مرحله ۱ · {selectedIds.length} محصول انتخاب شده</b><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} className="rounded-lg border border-oxblood/15 p-2 text-sm"><option value="">دستهٔ موردنظر را انتخاب کنید</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button disabled={!bulkCategory || !selectedIds.length} onClick={() => { onAssignCategory(bulkCategory, selectedIds); setBulkCategory(""); }} className="rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white disabled:opacity-40">ثبت دسته برای انتخاب‌ها</button><button disabled={!selectedIds.length} onClick={() => setShowBulkPricing(true)} className="rounded-lg bg-oxblood-dark px-3 py-2 text-sm font-bold text-white disabled:opacity-40">مرحله ۲: قیمت‌گذاری</button><button onClick={() => setSelectedIds(selectedIds.length === products.length ? [] : products.map((product) => product.id))} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">{selectedIds.length === products.length ? "لغو انتخاب همه" : "انتخاب همه"}</button></div>}
          <div className="mt-6">
            <ProductSections products={products} labels={labels} mode={browseMode} admin onSelect={onSelect} onToggleFeatured={onToggleFeatured} selectedIds={selectingForCategory ? selectedIds : []} onToggleSelect={selectingForCategory ? toggleSelection : undefined} />
          </div>
          <p className="mt-3 min-h-5 text-xs text-oxblood">{error}</p>
        </div>
      ) : tab === "tasks" ? (
        <TaskPanel tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} />
      ) : (
        <ReportsPanel products={products} categories={categories} importReports={importReports} onSelect={onSelect} onExportCategory={onExportCategoryExcel} currency={currency}/>
      )}
      {showSettings && (
        <div className="fixed inset-0 z-50">
          <div onClick={() => setShowSettings(false)} className="absolute inset-0 bg-oxblood-dark/45" />
          <section className="relative h-full w-full overflow-y-auto bg-white p-5 shadow-2xl sm:p-8">
            <button onClick={() => setShowSettings(false)} className="absolute left-4 top-4 text-oxblood/65" aria-label="بستن"><X /></button>
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-oxblood/20" />
            <h2 className="flex items-center gap-2 text-xl font-black"><Settings2 size={20} /> تنظیمات ستون‌ها</h2>
            <p className="mt-2 text-sm text-oxblood-dark/55">نام سه ستون قیمت را تغییر دهید.</p>
            <div className="mt-4">
              <section className="mb-4 rounded-lg border border-oxblood/10 bg-blush p-4"><h3 className="font-black">واحد پول</h3><p className="mt-1 text-xs text-oxblood-dark/55">با تغییر واحد، همهٔ قیمت‌ها، فاکتورها، قیمت‌های سطحی و تاریخچه‌ها هم‌زمان تبدیل می‌شوند.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => onChangeCurrency("toman")} className={`rounded-lg px-3 py-2 text-sm font-bold ${currency === "toman" ? "bg-oxblood text-white" : "border border-oxblood/20 bg-white text-oxblood"}`}>تومان</button><button type="button" onClick={() => onChangeCurrency("rial")} className={`rounded-lg px-3 py-2 text-sm font-bold ${currency === "rial" ? "bg-oxblood text-white" : "border border-oxblood/20 bg-white text-oxblood"}`}>ریال</button></div></section>
              <section className="mb-4 rounded-lg border border-oxblood/10 bg-blush p-4"><h3 className="font-black">فایل‌های اکسل</h3><p className="mt-1 text-xs text-oxblood-dark/55">ورود اطلاعات جدید یا دریافت فهرست قیمت‌ها.</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-oxblood/20 bg-white px-3 py-2 text-sm font-bold text-oxblood"><Upload size={16} /> آپلود اکسل<input type="file" accept=".xlsx,.xls,.csv" onChange={onImportExcel} className="sr-only" /></label><button onClick={onExportExcel} className="rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white">خروجی اکسل</button></div></section>
              <DisplayModeForm mode={browseMode} onChange={onBrowseMode} />
              <CategoryForm categories={categories} onChange={onCategoriesChange} />
              <CatalogSettingsForm contact={catalogContact} categories={categories} onSave={onCatalogContactChange} />
            </div>
          </section>
        </div>
      )}
      {showBulkPricing && <BulkPricingSheet count={selectedIds.length} onClose={() => setShowBulkPricing(false)} onApply={(levels) => { onApplyLevels(selectedIds, levels); setShowBulkPricing(false); setSelectedIds([]); setSelectingForCategory(false); }} />}
    </section>
  );
}

function ReportsPanel({ products, categories, importReports, onSelect, onExportCategory, currency }: { products: Product[]; categories: { id: string; name: string }[]; importReports: ImportReport[]; onSelect: (product: Product) => void; onExportCategory: (category: { id: string; name: string }) => void; currency: Currency }) {
  const productsByLatestChange = [...products].sort((a, b) => priceChangeTime(sortedPriceHistory(b.priceHistory)[0]) - priceChangeTime(sortedPriceHistory(a.priceHistory)[0]));
  return <div className="mt-5 space-y-5"><section className="rounded-xl border border-oxblood/10 bg-white p-4"><h2 className="font-black">گزارش دسته‌بندی‌ها</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => { const items = products.filter((product) => product.categoryIds.includes(category.id)); return <article key={category.id} className="rounded-lg bg-blush p-3"><b>{category.name}</b><span className="mt-2 block text-sm">{items.length.toLocaleString("fa-IR")} محصول</span><small className="mt-1 block text-oxblood-dark/55">{items.filter((item) => item.active).length.toLocaleString("fa-IR")} فعال</small><button type="button" onClick={() => onExportCategory(category)} className="mt-3 rounded-lg border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood">خروجی اکسل این دسته</button></article>; })}</div>{!categories.length && <p className="mt-3 text-sm text-oxblood-dark/55">هنوز دسته‌ای برای محصولات ساخته نشده است.</p>}</section><section className="rounded-xl border border-oxblood/10 bg-white p-4"><h2 className="font-black">گزارش هر محصول</h2><div className="mt-3 space-y-2">{productsByLatestChange.map((product) => { const latestChange = sortedPriceHistory(product.priceHistory)[0]; return <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-blush p-3"><div><b>{product.name}</b><small className="mt-1 block text-xs text-oxblood-dark/55">قیمت فعلی: {money(product.price)} {currencyTitle(currency)} · {product.priceHistory.length.toLocaleString("fa-IR")} تغییر قیمت</small><small className="mt-1 block text-xs text-oxblood-dark/45">{latestChange ? `آخرین تغییر: ${dateTime(latestChange.changedAt)}` : "بدون تغییر قیمت"}</small></div><button type="button" onClick={() => onSelect(product)} className="shrink-0 rounded-lg border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood">گزارش محصول</button></div>; })}</div></section><section className="rounded-xl border border-oxblood/10 bg-white p-4"><h2 className="font-black">گزارش ورود فایل‌ها</h2>{importReports.length ? <div className="mt-3 space-y-2">{importReports.map((report) => <article key={report.id} className="rounded-lg bg-blush p-3"><b className="block break-all text-sm">{report.fileName}</b><small className="mt-1 block text-xs text-oxblood-dark/55">{dateTime(report.importedAt)}</small><div className="mt-2 flex flex-wrap gap-2 text-xs"><span>جدید: {report.added.toLocaleString("fa-IR")}</span><span>تغییر قیمت: {report.priceChanged.toLocaleString("fa-IR")}</span><span>بدون تغییر: {report.unchanged.toLocaleString("fa-IR")}</span></div></article>)}</div> : <p className="mt-3 text-sm text-oxblood-dark/55">هنوز گزارشی از ورود اکسل محصولات ثبت نشده است.</p>}</section></div>;
}

function CategoryForm({ categories, onChange }: { categories: { id: string; name: string }[]; onChange: (categories: { id: string; name: string }[]) => void }) {
  const [name, setName] = useState(""); const [editingId, setEditingId] = useState(""); const [editingName, setEditingName] = useState("");
  const saveName = () => { const value = editingName.trim(); if (!value) return; onChange(categories.map((category) => category.id === editingId ? { ...category, name: value } : category)); setEditingId(""); };
  return <section className="mt-4 rounded-lg border border-oxblood/10 p-4"><h3 className="font-black">دسته‌بندی محصولات</h3><form onSubmit={(event) => { event.preventDefault(); const value = name.trim(); if (!value) return; onChange([...categories, { id: `${Date.now()}-${value}`, name: value }]); setName(""); }} className="mt-3 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام دسته" className="min-w-0 flex-1 rounded border border-oxblood/15 p-2"/><button className="rounded bg-oxblood px-3 text-sm font-bold text-white">افزودن</button></form><div className="mt-3 space-y-2">{categories.map((category) => editingId === category.id ? <div key={category.id} className="flex gap-2"><input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 flex-1 rounded border border-oxblood/15 p-2"/><button type="button" onClick={saveName} className="rounded bg-oxblood px-3 text-sm font-bold text-white">ذخیره</button><button type="button" onClick={() => setEditingId("")} className="rounded border px-3 text-sm">لغو</button></div> : <div key={category.id} className="flex items-center justify-between rounded-lg bg-blush px-3 py-2"><span>{category.name}</span><span className="flex gap-3"><button type="button" onClick={() => { setEditingId(category.id); setEditingName(category.name); }} className="text-sm font-bold text-oxblood">ویرایش</button><button type="button" onClick={() => { if (confirmDelete(`دسته «${category.name}»`)) onChange(categories.filter((item) => item.id !== category.id)); }} className="text-sm font-bold text-red-700">حذف</button></span></div>)}</div></section>;
}

function CatalogSettingsForm({ contact, categories, onSave }: { contact: CatalogContact; categories: { id: string; name: string }[]; onSave: (contact: CatalogContact) => void }) {
  const [mobile, setMobile] = useState(contact.mobile || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [address, setAddress] = useState(contact.address || "");
  const [copied, setCopied] = useState("");
  const catalogPath = (id?: string) => id ? `/catalog?category=${encodeURIComponent(id)}` : "/catalog";
  const copyLink = async (id?: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${catalogPath(id)}`);
    setCopied(id || "all");
    window.setTimeout(() => setCopied(""), 1800);
  };
  return <section className="mt-4 rounded-lg border border-oxblood/10 p-4"><h3 className="font-black">تنظیمات کاتالوگ</h3><p className="mt-1 text-xs text-oxblood-dark/55">این اطلاعات در کاتالوگ کلی و تمام لینک‌های دسته‌بندی نمایش داده می‌شود.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold">شماره تماس همراه<input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" className="mt-1 w-full rounded border border-oxblood/15 p-2 font-normal"/></label><label className="text-xs font-bold">شماره ثابت<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" className="mt-1 w-full rounded border border-oxblood/15 p-2 font-normal"/></label><label className="text-xs font-bold sm:col-span-2">آدرس<textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} className="mt-1 w-full rounded border border-oxblood/15 p-2 font-normal"/></label></div><button type="button" onClick={() => onSave({ mobile: mobile.trim(), phone: phone.trim(), address: address.trim() })} className="mt-3 rounded bg-oxblood px-3 py-2 text-sm font-bold text-white">ذخیره تنظیمات کاتالوگ</button><div className="mt-5 border-t border-oxblood/10 pt-4"><b className="text-sm">لینک‌های قابل ارسال</b><div className="mt-2 space-y-2"><div className="flex flex-wrap gap-2"><Link href={catalogPath()} target="_blank" className="rounded border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood">کاتالوگ کلی</Link><button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1 rounded border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood"><Copy size={14}/>{copied === "all" ? "کپی شد" : "کپی لینک"}</button></div>{categories.map((category) => <div key={category.id} className="flex flex-wrap gap-2"><Link href={catalogPath(category.id)} target="_blank" className="rounded border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood">کاتالوگ {category.name}</Link><button type="button" onClick={() => void copyLink(category.id)} className="inline-flex items-center gap-1 rounded border border-oxblood/20 bg-white px-3 py-2 text-xs font-bold text-oxblood"><Copy size={14}/>{copied === category.id ? "کپی شد" : "کپی لینک"}</button></div>)}</div></div></section>;
}

function DisplayModeForm({ mode, onChange }: { mode: "sections" | "phonebook"; onChange: (mode: "sections" | "phonebook") => void }) {
  return <section className="mt-4 rounded-lg border border-oxblood/10 p-4"><h3 className="font-black">نحوه نمایش محصولات</h3><p className="mt-1 text-xs text-oxblood-dark/55">حالت دفترچه‌ای محصولات را براساس حروف الفبا صفحه‌بندی می‌کند.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onChange("phonebook")} className={`rounded-lg p-2 text-sm font-bold ${mode === "phonebook" ? "bg-oxblood text-white" : "bg-blush text-oxblood"}`}>دفترچه‌ای (حروف)</button><button type="button" onClick={() => onChange("sections")} className={`rounded-lg p-2 text-sm font-bold ${mode === "sections" ? "bg-oxblood text-white" : "bg-blush text-oxblood"}`}>بخش‌بندی معمولی</button></div></section>;
}

function BulkPricingSheet({ count, onClose, onApply }: { count: number; onClose: () => void; onApply: (levels: ProductLevel[]) => void }) {
  const units = ["بسته", "عدد", "مثقال", "لیتر", "کارتن", "گرم", "کیلوگرم"];
  const [levels, setLevels] = useState<ProductLevel[]>([{ id: "bulk-1", label: "", unit: "", quantity: "", price: 0, roundingMode: "none" }]);
  const update = (index: number, patch: Partial<ProductLevel>) => setLevels(levels.map((level, itemIndex) => itemIndex === index ? { ...level, ...patch } : level));
  return <div className="fixed inset-0 z-30 flex items-end justify-center"><button onClick={onClose} className="absolute inset-0 bg-oxblood-dark/45" aria-label="بستن"/><section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-5xl sm:p-8"><button onClick={onClose} className="absolute left-5 top-5 text-oxblood"><X/></button><h2 className="text-2xl font-black">مرحله ۲ · قیمت‌گذاری گروهی</h2><p className="mt-2 text-sm text-oxblood-dark/60">سطح‌های زیر روی {count.toLocaleString("fa-IR")} محصول انتخاب‌شده اعمال می‌شوند.</p><div className="mt-5 rounded-lg border border-oxblood/10 bg-white p-3"><div className="flex items-center justify-between"><h4 className="font-black">سطح‌های قیمت‌گذاری</h4><button type="button" onClick={() => setLevels([...levels, { id: `bulk-${Date.now()}`, label: "", unit: "", quantity: "", price: 0, roundingMode: "none" }])} className="rounded-lg border border-oxblood/20 px-3 py-1.5 text-xs font-bold text-oxblood">+ افزودن سطح</button></div><p className="mt-2 text-xs text-oxblood-dark/55">درصد سود برای هر محصول از قیمت خرید خودش محاسبه می‌شود. وارد کردن قیمت فروش، آن را به‌صورت قیمت ثابت برای همهٔ محصولات اعمال می‌کند.</p><div className="mt-3 space-y-2">{levels.map((level, index) => <div key={level.id} className="grid gap-2 rounded-lg bg-blush p-2 sm:grid-cols-8"><input value={level.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="نام سطح" className="rounded border border-oxblood/15 p-2 text-xs"/><input value={level.quantity} onChange={(event) => update(index, { quantity: event.target.value })} placeholder="مقدار" className="rounded border border-oxblood/15 p-2 text-xs"/><select value={level.unit} onChange={(event) => update(index, { unit: event.target.value })} className="rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="" disabled>واحد</option>{units.map((unit) => <option key={unit}>{unit}</option>)}</select><input value={level.percent ?? ""} onChange={(event) => update(index, { percent: event.target.value === "" ? undefined : Number(event.target.value), price: 0 })} placeholder="درصد سود" type="number" className="rounded border border-oxblood/15 p-2 text-xs"/><input value={level.price || ""} onChange={(event) => update(index, { price: parseAmount(event.target.value), percent: undefined })} placeholder="قیمت فروش" type="text" inputMode="numeric" className="rounded border border-oxblood/15 bg-white p-2 text-xs font-bold text-oxblood"/><input value={level.rounding ?? ""} onChange={(event) => update(index, { rounding: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="مبلغ رند" type="number" className="rounded border border-oxblood/15 p-2 text-xs"/><select value={level.roundingMode || "none"} onChange={(event) => update(index, { roundingMode: event.target.value as ProductLevel["roundingMode"] })} className="rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="none">بدون رند</option><option value="up">رند بالا</option><option value="down">رند پایین</option></select><button type="button" onClick={() => setLevels(levels.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-oxblood/15 text-xs text-oxblood">حذف</button></div>)}</div></div><div className="mt-4 flex flex-wrap gap-2"><button disabled={!levels.length} onClick={() => onApply(levels)} className="rounded-lg bg-oxblood px-5 py-2 font-bold text-white disabled:opacity-40">اعمال روی محصولات انتخاب‌شده</button></div></section></div>;
}

function ColumnLabelForm({
  labels,
  onSave,
}: {
  labels: string[];
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [count, setCount] = useState(labels.length);
  return (
    <form onSubmit={onSave} className="rounded-lg border border-oxblood/10 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-black">
        <Settings2 size={18} />
        نام ستون‌های قیمت
      </h2>
      <input type="hidden" name="labelCount" value={count} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: count }, (_, index) => (
          <input
            key={index}
            name={`label${index + 1}`}
            defaultValue={labels[index] || `سطح ${index + 1}`}
            className="rounded-lg border border-oxblood/15 p-2 text-sm"
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCount(count + 1)} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">+ سطح</button>
        {count > 1 && <button type="button" onClick={() => setCount(count - 1)} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">− سطح</button>}
        <button className="rounded-lg bg-oxblood px-4 py-2 text-sm font-bold text-white">ذخیره</button>
      </div>
    </form>
  );
}

function TaskPanel({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: {
  tasks: Task[];
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-oxblood/10 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <ListChecks size={20} />
        تسک‌های مهدی
      </h2>
      <form onSubmit={onAddTask} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input name="task" placeholder="تسک جدید..." className="rounded-lg border border-oxblood/15 p-3" />
        <button className="rounded-lg bg-oxblood px-4 py-3 font-bold text-white">ثبت تسک</button>
      </form>
      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex w-full items-center gap-3 rounded-lg border border-oxblood/10 p-3 text-right"
          >
            <button type="button" onClick={() => onToggleTask(task.id)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
              <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                task.done ? "border-oxblood bg-oxblood text-white" : "border-oxblood/20 text-transparent"
              }`}
              >
                <Check size={15} />
              </span>
              <span className={task.done ? "text-oxblood-dark/40 line-through" : ""}>{task.text}</span>
            </button>
            <button type="button" onClick={() => { if (confirmDelete(`تسک «${task.text}»`)) onDeleteTask(task.id); }} className="rounded-md p-2 text-oxblood/55 hover:bg-blush hover:text-oxblood" aria-label="حذف تسک">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {!tasks.length && <p className="text-sm text-oxblood-dark/45">هنوز تسکی ثبت نشده.</p>}
      </div>
    </div>
  );
}

function AddProductSheet({
  labels,
  categories,
  onClose,
  onAdd,
  error,
}: {
  labels: string[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-oxblood-dark/45" />
      <form
        onSubmit={onAdd}
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:p-6"
      >
        <button type="button" onClick={onClose} className="absolute left-4 top-4 text-oxblood/65" aria-label="بستن">
          <X />
        </button>
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-oxblood/20" />
        <PackagePlus className="text-oxblood" />
        <h1 className="mt-4 text-xl font-black">افزودن محصول</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            نام محصول
            <input required name="name" className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
          <label className="block text-sm font-bold">
            قیمت اولین فاکتور خرید
            <input required name="price" type="number" className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
          <label className="block text-sm font-bold sm:col-span-2">
            لینک کاتالوگ محصول
            <input name="catalogUrl" type="url" className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
          <label className="block text-sm font-bold sm:col-span-2">
            لینک تصویر محصول
            <input name="imageUrl" type="url" placeholder="https://..." className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
          <label className="block text-sm font-bold sm:col-span-2">
            توضیحات محصول
            <textarea name="description" rows={3} className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-bold">
          <input name="featured" type="checkbox" className="accent-oxblood" />
          محصول برتر
        </label>
        {!!categories.length && <fieldset className="mt-4 rounded-lg border border-oxblood/10 p-3"><legend className="px-1 text-sm font-bold">دسته‌بندی محصول</legend><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => <label key={category.id} className="rounded-lg border border-oxblood/15 px-3 py-2 text-sm"><input name="categoryIds" value={category.id} type="checkbox" className="ml-2 accent-oxblood"/>{category.name}</label>)}</div></fieldset>}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {labels.map((label, index) => (
            <div key={label} className="rounded-lg border border-oxblood/10 p-2 text-xs">
              <b>{label}</b>
              <input
                name={"p" + (index + 1)}
                defaultValue={[12, 9, 6, 0][index]}
                type="number"
                className="mt-2 w-full rounded border border-oxblood/15 p-1"
              />
              <input
                name={"r" + (index + 1)}
                defaultValue="1000"
                type="number"
                className="mt-2 w-full rounded border border-oxblood/15 p-1"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 min-h-5 text-xs text-oxblood">{error}</p>
        <button className="mt-3 w-full rounded-lg bg-oxblood p-3 font-bold text-white">ثبت محصول</button>
      </form>
    </div>
  );
}

function Catalog({
  products,
  labels,
  categories,
  selectedCategoryId,
  contact,
  onSelect,
}: {
  products: Product[];
  labels: string[];
  categories: { id: string; name: string }[];
  selectedCategoryId: string | null;
  contact: CatalogContact;
  onSelect: (product: Product) => void;
}) {
  const selectedCategory = categories.find((category) => categoryId(category.id) === selectedCategoryId);
  return (
    <section className="catalog-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-oxblood">{selectedCategory ? `کاتالوگ ${selectedCategory.name}` : "کاتالوگ بازارک"}</h1>
          <p className="mt-1 text-sm text-oxblood-dark/55">نسخه آسیاب صداقت، {products.length} محصول</p>
        </div>
      </div>
      {!selectedCategoryId && !!categories.length && <div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <Link key={category.id} href={`/catalog?category=${encodeURIComponent(category.id)}`} className="rounded-lg border border-oxblood/15 px-3 py-2 text-sm font-bold text-oxblood">کاتالوگ {category.name}</Link>)}</div>}
      {selectedCategory && <p className="mt-3 text-xs text-oxblood-dark/55">این لینک فقط محصولات دسته «{selectedCategory.name}» را نشان می‌دهد و قابل ارسال است.</p>}
      {(contact.mobile || contact.phone || contact.address) && <section className="mt-5 rounded-xl border border-oxblood/10 bg-white p-4 text-sm"><h2 className="font-black text-oxblood">اطلاعات تماس</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-oxblood-dark/70">{contact.mobile && <a dir="ltr" href={`tel:${phoneDigits(contact.mobile)}`}>همراه: {contact.mobile}</a>}{contact.phone && <a dir="ltr" href={`tel:${phoneDigits(contact.phone)}`}>ثابت: {contact.phone}</a>}{contact.address && <span>آدرس: {contact.address}</span>}</div></section>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            className="flex gap-3 rounded-lg border border-oxblood/10 bg-white p-4 text-right shadow-sm transition hover:border-oxblood/45"
          >
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-blush text-xs text-oxblood-dark/45">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <span>تصویر محصول</span>}</div>
            <div className="min-w-0 flex-1"><b className="block text-lg font-black">{product.name}</b>
              {product.description && <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-oxblood-dark">{product.description}</p>}
              <p className="mt-3 text-xs font-bold text-oxblood">آخرین خرید: {money(latestPurchase(product))}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {(product.levels?.length ? product.levels : labels.map((label, index) => ({ id: `default-${index}`, label, unit: product.unit, quantity: "۱", price: sale(product, index) }))).map((level) => (
                  <span key={level.id} className="rounded-lg bg-blush p-2"><span className="block text-oxblood-dark/45">{level.label}</span><b className="mt-1 block text-oxblood">{money(levelPrice(product, level))}</b></span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
      {selectedCategoryId && !products.length && <p className="mt-6 rounded-xl border border-oxblood/10 bg-white p-4 text-sm text-oxblood-dark/55">برای این دسته هنوز محصول فعالی ثبت نشده است. در پنل محصول، تیک دسته‌بندی را بررسی کنید.</p>}
    </section>
  );
}

function Detail({
  product,
  labels,
  categories,
  admin,
  onClose,
  onInvoice,
  onToggleActive,
  onCategoryChange,
  onUpdatePricing,
  onDelete,
}: {
  product: Product;
  labels: string[];
  categories: { id: string; name: string }[];
  admin: boolean;
  onClose: () => void;
  onInvoice: (value: number, recordInvoice: boolean) => Promise<void>;
  onToggleActive: () => void;
  onCategoryChange: (categoryId: string, checked: boolean) => Promise<void>;
  onUpdatePricing: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [purchaseValue, setPurchaseValue] = useState(0);
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const units = ["بسته", "عدد", "مثقال", "لیتر", "کارتن", "گرم", "کیلوگرم"];
  const [customUnit, setCustomUnit] = useState(!units.includes(product.unit));
  const [selectedUnit, setSelectedUnit] = useState(units.includes(product.unit) ? product.unit : "__custom__");
  const [levels, setLevels] = useState<ProductLevel[]>(product.levels?.length ? product.levels : labels.map((label, index) => ({ id: `default-${index}`, label, unit: product.unit, quantity: "۱", price: sale(product, index) })));
  useEffect(() => {
    setLevels((current) => current.map((level) => level.percent === undefined ? level : { ...level, price: levelPriceForBasePrice(product.price, level) }));
  }, [product.price]);
  const levelBasePrice = (level: ProductLevel) => latestPurchase(product) * (parseAmount(level.quantity) || 1);
  const updateLevelPercent = (index: number, percent: number | undefined) => {
    setLevels(levels.map((level, levelIndex) => levelIndex === index
      ? { ...level, percent, price: percent === undefined ? 0 : levelPriceForBasePrice(latestPurchase(product), { ...level, percent }) }
      : level));
  };
  const updateLevelPrice = (index: number, price: number) => {
    setLevels(levels.map((level, levelIndex) => levelIndex === index
      ? { ...level, price, percent: levelBasePrice(level) > 0 ? Number((((price / levelBasePrice(level)) - 1) * 100).toFixed(2)) : undefined }
      : level));
  };
  const savePurchase = async (recordInvoice: boolean) => {
    if (savingPurchase) return;
    setSavingPurchase(true);
    try { await onInvoice(purchaseValue, recordInvoice); setConfirmPurchase(false); } finally { setSavingPurchase(false); }
  };
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-oxblood-dark/45" />
      <section className="relative max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-7xl sm:p-8">
        <button onClick={onClose} className="absolute left-4 top-4 text-oxblood/65" aria-label="بستن">
          <X />
        </button>
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-oxblood/20" />
        <h2 className="text-2xl font-black">{product.name}</h2>
        {product.description && <p className="mt-2 text-xs leading-6 text-oxblood-dark/60">{product.description}</p>}
        {admin && <p className="mt-3 text-sm text-oxblood-dark/55">آخرین خرید از فروشنده: {money(latestPurchase(product))}</p>}
        <p className="mt-1 flex items-center gap-2 text-xs text-oxblood-dark/45">
          <CalendarDays size={14} />
          تاریخ ثبت تغییر قیمت: {date(product.updated)}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-oxblood-dark/45"><CalendarDays size={14} />تاریخ ثبت آخرین فاکتور: {product.invoices[0] ? date(product.invoices[0].registeredAt) : "ثبت نشده"}</p>
        {product.catalogUrl && (
          <a
            href={product.catalogUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-oxblood/15 px-3 py-2 text-sm font-bold text-oxblood"
          >
            <BookOpen size={16} />
            کاتالوگ محصول
            <ExternalLink size={14} />
          </a>
        )}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {(product.levels?.length ? product.levels : labels.map((label, index) => ({ id: `default-${index}`, label, unit: product.unit, quantity: "۱", price: sale(product, index) }))).map((level) => (
            <div key={level.id} className="rounded-lg border border-oxblood/10 bg-blush p-3 text-center"><b className="block text-sm">{level.label}</b><strong className="mt-3 block text-lg font-black text-oxblood">{money(levelPrice(product, level))}</strong></div>
          ))}
        </div>
        {admin && (
          <>
            <button type="button" onClick={onToggleActive} className={`mt-4 rounded-lg px-4 py-2 text-sm font-bold ${product.active ? "bg-oxblood text-white" : "border border-oxblood/25 text-oxblood"}`}>{product.active ? "محصول فعال است · غیرفعال کردن" : "محصول غیرفعال است · فعال کردن"}</button>
            <form onSubmit={(event) => { event.preventDefault(); const value = parsePriceAmount(new FormData(event.currentTarget).get("invoice")); if (value) { setPurchaseValue(value); setConfirmPurchase(true); } }} className="mt-5 rounded-lg border border-oxblood/10 bg-white p-3 shadow-sm sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-2">
              <label className="block text-xs font-bold">ثبت قیمت خرید جدید
                <input required name="invoice" type="text" inputMode="numeric" placeholder="قیمت فاکتور خرید جدید" onChange={(event) => { const value = parsePriceAmount(event.currentTarget.value); event.currentTarget.value = value ? money(value) : ""; }} className="mt-1 w-full rounded-lg border border-oxblood/15 p-2" />
              </label>
              <button type="submit" disabled={savingPurchase} className="mt-2 rounded-lg bg-oxblood px-4 py-2 font-bold text-white disabled:opacity-50 sm:mt-0">{savingPurchase ? "در حال ذخیره..." : "ثبت قیمت خرید"}</button>
            </form>
            <form onSubmit={(event) => { event.preventDefault(); if (savingPricing) return; setSavingPricing(true); void onUpdatePricing(event).finally(() => setSavingPricing(false)); }} className="mt-5 rounded-lg border border-oxblood/10 bg-blush p-3">
              <h3 className="font-black">ویرایش مشخصات و قیمت‌گذاری محصول</h3>
              <label className="mt-3 block text-xs">نام محصول<input required name="name" defaultValue={product.name} className="mt-1 w-full rounded border border-oxblood/15 bg-white p-2 font-bold" /></label>
            <fieldset className="mt-3"><legend className="text-xs">واحد اندازه‌گیری</legend><input type="hidden" name="unit" value={selectedUnit} /><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{units.map((unit) => <button key={unit} type="button" onClick={() => { setSelectedUnit(unit); setCustomUnit(false); }} className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${selectedUnit === unit ? "border-oxblood bg-oxblood text-white" : "border-oxblood/15 bg-white text-oxblood"}`}>{unit}</button>)}<button type="button" onClick={() => { setSelectedUnit("__custom__"); setCustomUnit(true); }} className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${customUnit ? "border-oxblood bg-oxblood text-white" : "border-oxblood/15 bg-white text-oxblood"}`}>واحد دستی</button></div>{customUnit && <input name="unitManual" defaultValue={units.includes(product.unit) ? "" : product.unit} placeholder="واحد را بنویسید" className="mt-2 w-full rounded border border-oxblood/15 p-2" />}</fieldset>
              <label className="mt-3 block text-xs">توضیحات محصول<textarea name="description" defaultValue={product.description} rows={3} placeholder="توضیحات، نکات خرید یا مشخصات محصول..." className="mt-1 w-full rounded border border-oxblood/15 bg-white p-2" /></label>
              <label className="mt-3 block text-xs">لینک تصویر محصول<input name="imageUrl" type="url" defaultValue={product.imageUrl} placeholder="https://..." className="mt-1 w-full rounded border border-oxblood/15 bg-white p-2" /></label>
              <input type="hidden" name="levels" value={JSON.stringify(levels)} />
              <div className="mt-4 rounded-lg border border-oxblood/10 bg-white p-3">
                <div className="flex items-center justify-between"><h4 className="font-black">سطح‌های اختصاصی این محصول</h4><button type="button" onClick={() => setLevels([...levels, { id: `${Date.now()}-${levels.length}`, label: "", unit: "", quantity: "", price: 0, roundingMode: "none" }])} className="rounded-lg border border-oxblood/20 px-3 py-1.5 text-xs font-bold text-oxblood">+ افزودن سطح</button></div>
                <p className="mt-2 text-xs text-oxblood-dark/55">درصد یا قیمت فروش را وارد کنید؛ فیلد مقابل همان لحظه محاسبه می‌شود.</p>
                <div className="mt-3 space-y-2">{levels.map((level, index) => <div key={level.id} className="grid gap-2 rounded-lg bg-blush p-2 sm:grid-cols-8">
                  <input value={level.label} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="نام سطح" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <input value={level.quantity} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} placeholder="مقدار" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <select value={level.unit} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item))} className="rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="" disabled>واحد</option>{units.map((unit) => <option key={unit}>{unit}</option>)}</select>
                  <input value={level.percent ?? ""} onChange={(event) => updateLevelPercent(index, event.target.value === "" ? undefined : parseAmount(event.target.value))} placeholder="درصد سود" type="text" inputMode="decimal" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <input value={level.price || ""} onChange={(event) => updateLevelPrice(index, parsePriceAmount(event.target.value))} placeholder="قیمت فروش" type="text" inputMode="numeric" className="rounded border border-oxblood/15 bg-white p-2 text-xs font-bold text-oxblood" />
                  <input value={level.rounding ?? ""} onChange={(event) => setLevels(levels.map((item, itemIndex) => { if (itemIndex !== index) return item; const rounding = event.target.value === "" ? undefined : parseAmount(event.target.value); const next = { ...item, rounding }; return next.percent === undefined ? next : { ...next, price: levelPriceForBasePrice(product.price, next) }; }))} placeholder="گام رند (مثلاً ۱۰۰۰۰ ریال)" type="text" inputMode="numeric" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <div><select value={level.roundingMode || "none"} onChange={(event) => setLevels(levels.map((item, itemIndex) => { if (itemIndex !== index) return item; const next = { ...item, roundingMode: event.target.value as ProductLevel["roundingMode"] }; return next.percent === undefined ? next : { ...next, price: levelPriceForBasePrice(product.price, next) }; }))} className="w-full rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="none">بدون رند</option><option value="up">رند بالا</option><option value="down">رند پایین</option></select><output className="mt-1 block text-center text-[10px] font-bold text-emerald-700">قیمت زنده: {money(level.price)}</output></div>
                  <button type="button" onClick={() => setLevels(levels.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-oxblood/15 text-xs text-oxblood">حذف</button>
                </div>)}</div>
              </div>
              {!!categories.length && <div className="mt-4 flex flex-wrap gap-2"><span className="w-full text-sm font-black">دسته‌بندی محصول</span>{categories.map((category) => <label key={category.id} className="rounded-lg border border-oxblood/15 px-3 py-2 text-sm"><input name={`category-${category.id}`} type="checkbox" checked={product.categoryIds.includes(category.id)} onChange={(event) => { void onCategoryChange(category.id, event.target.checked); }} className="ml-2 accent-oxblood" />{category.name}</label>)}</div>}
              <button type="submit" disabled={savingPricing} className="mt-3 rounded-lg bg-oxblood px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingPricing ? "در حال ذخیره..." : "ثبت اطلاعات"}</button>
              <button type="button" onClick={() => void onDelete()} className="mt-3 mr-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700">حذف محصول</button>
            </form>
            {confirmPurchase && <div className="fixed inset-0 z-30 grid place-items-center bg-oxblood-dark/45 p-4"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-black">نوع ثبت قیمت خرید</h3><p className="mt-2 text-sm text-oxblood-dark/60">{money(purchaseValue)} را چگونه ثبت کنیم؟</p><button type="button" disabled={savingPurchase} onClick={() => { void savePurchase(false); }} className="mt-4 w-full rounded-lg border border-oxblood/25 p-3 font-bold text-oxblood disabled:opacity-50">{savingPurchase ? "در حال ذخیره..." : "فقط به‌روزرسانی قیمت"}</button><button type="button" disabled={savingPurchase} onClick={() => { void savePurchase(true); }} className="mt-2 w-full rounded-lg bg-oxblood p-3 font-bold text-white disabled:opacity-50">{savingPurchase ? "در حال ذخیره..." : "ثبت به‌عنوان فاکتور جدید"}</button><button type="button" disabled={savingPurchase} onClick={() => setConfirmPurchase(false)} className="mt-3 w-full text-sm text-oxblood-dark/55 disabled:opacity-50">انصراف</button></section></div>}
            <h3 className="mt-5 flex items-center gap-2 font-black">
              <ReceiptText size={18} />
              فاکتورهای خرید
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {product.invoices.map((invoice, index) => (
                <li key={index} className="rounded-lg border border-oxblood/10 p-3">
                  <span className="font-black text-oxblood">{money(invoice.price)} تومان</span>
                  <span className="mt-1 block text-xs text-oxblood-dark/45">
                    تاریخ ثبت فاکتور: {date(invoice.registeredAt)}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 flex items-center gap-2 font-black">
              <CalendarDays size={18} />
              تاریخچه تغییر قیمت
            </h3>
            {product.priceHistory.length ? <ul className="mt-3 space-y-2 text-sm">
              {sortedPriceHistory(product.priceHistory).map((change, index) => (
                <li key={`${change.changedAt}-${index}`} className="rounded-lg border border-oxblood/10 p-3">
                  <span className="font-black text-oxblood">{money(change.previousPrice)} ← {money(change.price)} تومان</span>
                  <span className="mt-1 block text-xs text-oxblood-dark/45">{dateTime(change.changedAt)}</span>
                </li>
              ))}
            </ul> : <p className="mt-2 text-xs text-oxblood-dark/45">هنوز تغییری برای قیمت این محصول ثبت نشده است.</p>}
          </>
        )}
      </section>
    </div>
  );
}
