"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
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
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { seedProductRows } from "../data/seedProductRows";
import inventory from "../data/inventory.json";
import CustomerDrawer from "./CustomerDrawer";

type Invoice = { price: number; registeredAt: string };
type ProductLevel = { id: string; label: string; unit: string; quantity: string; price: number; percent?: number; rounding?: number; roundingMode?: "up" | "down" | "none" };
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
  description: string;
  invoices: Invoice[];
  percentages: number[];
  rounding: number[];
  roundingEnabled: boolean[];
  fixedPrices: number[];
  categoryIds: string[];
  levels?: ProductLevel[];
};
type AppSettings = { id: "settings"; columnLabels: string[]; categories: { id: string; name: string }[]; browseMode?: "sections" | "phonebook" };
type Task = { id: number; text: string; done: boolean };
type View = "landing" | "user" | "login" | "admin" | "catalog";
type AdminTab = "products" | "tasks";

const DEFAULT_LABELS = ["سطح ۱", "سطح ۲", "سطح ۳", "سطح ۴"];
const DEFAULT_SETTINGS: AppSettings = { id: "settings", columnLabels: DEFAULT_LABELS, categories: [], browseMode: "sections" };

const now = () => new Date().toISOString();
const money = (value: number) => value.toLocaleString("fa-IR");
const latestPurchase = (product: Product) => product.invoices[0]?.price ?? product.price;
const parseAmount = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,\s]/g, "")
    .replace(/[^0-9.-]/g, "");
  return Number(normalized) || 0;
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const sale = (product: Product, index: number) => {
  if (product.fixedPrices[index] > 0) return product.fixedPrices[index];
  const exact = product.price * (1 + product.percentages[index] / 100);
  return product.roundingEnabled[index] ? Math.round(exact / product.rounding[index]) * product.rounding[index] : Number(exact.toFixed(3));
};
const levelPrice = (product: Product, level: ProductLevel) => {
  if (level.percent === undefined) return level.price;
  const exact = product.price * (Number(level.quantity) || 1) * (1 + level.percent / 100);
  const rounding = Math.max(1, level.rounding || 1);
  return level.roundingMode === "up" ? Math.ceil(exact / rounding) * rounding : level.roundingMode === "down" ? Math.floor(exact / rounding) * rounding : Math.round(exact);
};

const normalizeProductName = (value: string) =>
  value
    .trim()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");

const applyFeaturedDefaults = (products: Product[]): Product[] => {
  const createdAt = now();
  const productsByName = new Map(products.map((product) => [normalizeProductName(product.name), product]));

  // The supplied price sheet is the curated default list of featured products.
  seedProductRows.forEach((row) => {
    const key = normalizeProductName(row.name);
    const existing = productsByName.get(key);
    const featuredProduct: Product = existing
      ? {
          ...existing,
          featured: true,
        }
      : {
          id: 1_000_000_000 + row.id,
          name: row.name,
          price: row.price,
          unit: "کیلوگرم",
          stock: 0,
          active: true,
          featured: true,
          updated: createdAt,
          catalogUrl: "",
          description: "",
          invoices: row.price > 0 ? [{ price: row.price, registeredAt: createdAt }] : [],
          percentages: [row.percent, row.percent, row.percent, row.percent],
          rounding: [1000, 1000, 1000, 1000],
          roundingEnabled: [true, true, true, true],
          fixedPrices: [],
          categoryIds: [],
        };

    productsByName.set(key, featuredProduct);
  });

  return Array.from(productsByName.values());
};

const excelSeed = (): Product[] =>
  applyFeaturedDefaults(inventory.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.purchasePrice,
    unit: row.unit,
    stock: row.stock,
    active: row.active,
    featured: false,
    updated: row.updated || now(),
    catalogUrl: "",
    description: "",
    invoices: row.purchasePrice > 0 ? [{ price: row.purchasePrice, registeredAt: now() }] : [],
    percentages: [0, 0, 0, 0],
    rounding: [1000, 1000, 1000, 1000],
    roundingEnabled: [true, true, true, true],
    fixedPrices: row.priceLevels,
    categoryIds: [],
  })));

const normalizeProducts = (raw: unknown): Product[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const product = item as Partial<Product> & { invoices?: Array<number | Invoice> };
    const updated = product.updated || now();
    const price = Number(product.price || 0);
    const invoices =
      product.invoices?.map((invoice) =>
        typeof invoice === "number" ? { price: invoice, registeredAt: updated } : invoice
      ) || [];
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
      description: String(product.description || ""),
      invoices,
      percentages: product.percentages || [12, 9, 6, 0],
      rounding: product.rounding || [1000, 1000, 1000, 1000],
      roundingEnabled: product.roundingEnabled || [true, true, true, true],
      fixedPrices: product.fixedPrices || [],
      categoryIds: product.categoryIds || [],
    };
  });
};

const mergeProducts = (base: Product[], saved: Product[]) => {
  const byName = new Map(base.map((product) => [product.name, product]));
  saved.forEach((product) => byName.set(product.name, { ...byName.get(product.name), ...product }));
  return Array.from(byName.values());
};

type ServerDatabase = { products?: unknown; settings?: AppSettings; tasks?: Task[] };

const readJsonDatabase = async () => {
  const response = await fetch("/api/database", { cache: "no-store" });
  if (!response.ok) throw new Error("database unavailable");
  return response.json() as Promise<ServerDatabase>;
};

const saveJsonSection = (section: "products" | "settings" | "tasks", data: unknown) =>
  fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, data }) })
    .catch(() => undefined);

export default function BazarekApp({ initialView }: { initialView: View }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState("name");

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const shouldShowIntro = localStorage.getItem("bazarek-intro-seen") !== "1";
      if (shouldShowIntro) {
        setShowIntro(true);
        localStorage.setItem("bazarek-intro-seen", "1");
        window.setTimeout(() => setShowIntro(false), 1800);
      }

      const database = await readJsonDatabase();
      const nextProducts = normalizeProducts(database.products);

      if (!cancelled) {
        setProducts(nextProducts);
        setSettings(database.settings || DEFAULT_SETTINGS);
        setTasks(database.tasks || []);
        setDbReady(true);
        if (initialView === "landing" && localStorage.getItem("bazarek-role") === "user") {
          setView("user");
          router.replace("/products");
        }
      }

    };

    boot().catch(() => {
      if (!cancelled) {
        setError("اتصال به دیتابیس سرور برقرار نشد.");
        setDbReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialView, router]);

  useEffect(() => {
    if (dbReady) { void saveJsonSection("products", products); }
  }, [dbReady, products]);

  useEffect(() => {
    if (dbReady) { void saveJsonSection("settings", settings); }
  }, [dbReady, settings]);

  useEffect(() => {
    if (dbReady) { void saveJsonSection("tasks", tasks); }
  }, [dbReady, tasks]);

  const navigate = (nextView: View, path: string) => {
    setError("");
    setSelected(null);
    setShowAddProduct(false);
    setView(nextView);
    router.push(path);
  };

  const filtered = useMemo(() => products.filter((product) => product.name.includes(q.trim())), [products, q]);
  const visibleProducts = useMemo(() => [...filtered.filter((product) => !categoryFilter || product.categoryIds.includes(categoryFilter))].sort((a, b) => sortMode === "price-asc" ? a.price - b.price : sortMode === "price-desc" ? b.price - a.price : sortMode === "stock-desc" ? b.stock - a.stock : a.name.localeCompare(b.name, "fa")), [filtered, categoryFilter, sortMode]);

  const add = (event: FormEvent<HTMLFormElement>) => {
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
    setProducts([
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
        description: String(form.get("description") || "").trim(),
        invoices: [{ price, registeredAt: createdAt }],
        percentages: [getNumber("p1"), getNumber("p2"), getNumber("p3")],
        rounding: [getNumber("r1"), getNumber("r2"), getNumber("r3")],
        roundingEnabled: [true, true, true],
        fixedPrices: [],
        categoryIds: [],
      },
      ...products,
    ]);
    event.currentTarget.reset();
    setError("");
    setShowAddProduct(false);
  };

  const invoice = (value: number, recordInvoice: boolean) => {
    if (!selected) return;
    if (value < 1) return;
    const registeredAt = now();
    const nextSelected = {
      ...selected,
      price: value,
      invoices: recordInvoice ? [{ price: value, registeredAt }, ...selected.invoices] : selected.invoices,
      updated: registeredAt,
    };
    setProducts(products.map((product) => (product.id === selected.id ? nextSelected : product)));
    setSelected(nextSelected);
  };

  const updateColumnLabels = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSettings({
      id: "settings",
      columnLabels: Array.from({ length: Number(form.get("labelCount")) || settings.columnLabels.length }, (_, index) => String(form.get(`label${index + 1}`) || `سطح ${index + 1}`)),
      categories: settings.categories,
      browseMode: settings.browseMode || "sections",
    });
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("task") || "").trim();
    if (!text) return;
    setTasks([{ id: Date.now(), text, done: false }, ...tasks]);
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
      rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0).forEach((row, index) => {
        const name = String(row[nameCol] || "").trim();
        const price = parseAmount(row[priceCol]);
        if (!name || price < 1) return;
        const previous = products.find((product) => product.name === name);
        const registeredAt = now();
        const percent = percentCol >= 0 ? parseAmount(row[percentCol]) : 0;
        imported.push({ ...(previous || {}), id: previous?.id ?? Date.now() + index, name, price, updated: registeredAt,
          invoices: [{ price, registeredAt }, ...(previous?.invoices || [])], percentages: previous?.percentages || [percent, percent, percent],
          unit: previous?.unit || "کیلوگرم", stock: previous?.stock || 0, active: previous?.active ?? true, rounding: previous?.rounding || [1000, 1000, 1000, 1000], roundingEnabled: previous?.roundingEnabled || [true, true, true, true], fixedPrices: previous?.fixedPrices || [], categoryIds: previous?.categoryIds || [], featured: previous?.featured ?? false, catalogUrl: previous?.catalogUrl || "", description: previous?.description || "" });
      });
      if (!imported.length) throw new Error("empty");
      const byName = new Map(products.map((product) => [product.name, product]));
      imported.forEach((product) => byName.set(product.name, product));
      setProducts(Array.from(byName.values()));
      setError(`${imported.length} محصول از فایل اکسل اضافه/به‌روزرسانی شد.`);
    } catch {
      setError("خواندن فایل اکسل ناموفق بود. ستون نام محصول و قیمت خرید را بررسی کنید.");
    }
  };
  const exportExcel = () => {
    const rows = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).map((product) => ({ "نام محصول": product.name, "واحد": product.unit, ...Object.fromEntries(settings.columnLabels.map((label, index) => [label, sale(product, index)])) }));
    const sheet = XLSX.utils.json_to_sheet(rows); sheet["!cols"] = [{ wch: 42 }, { wch: 14 }, ...settings.columnLabels.map(() => ({ wch: 16 }))];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "لیست محصولات"); XLSX.writeFile(book, "لیست محصولات بازارک.xlsx");
  };

  if (showIntro || !dbReady) return <LoadingIntro />;

  if (view === "landing") {
    return <Landing navigate={navigate} />;
  }

  if (view === "login") {
    return <Login navigate={navigate} error={error} setError={setError} />;
  }

  const isAdmin = view === "admin";
  return (
    <main className="min-h-screen bg-blush text-oxblood-dark">
      <Header q={q} setQ={setQ} navigate={navigate} />
      <CustomerDrawer />
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {view === "catalog" ? (
          <Catalog products={visibleProducts.filter((product) => product.active)} labels={settings.columnLabels} onSelect={setSelected} />
        ) : isAdmin ? (
          <Admin
            products={visibleProducts}
            labels={settings.columnLabels}
            categories={settings.categories}
            browseMode={settings.browseMode || "sections"}
            tasks={tasks}
            onSelect={setSelected}
            onToggleActive={(product) => setProducts(products.map((item) => item.id === product.id ? { ...item, active: !item.active, updated: now() } : item))}
            onToggleFeatured={(product) => setProducts(products.map((item) => item.id === product.id ? { ...item, featured: !item.featured, updated: now() } : item))}
            onOpenAdd={() => setShowAddProduct(true)}
            onImportExcel={importExcel}
            onExportExcel={exportExcel}
            onSaveLabels={updateColumnLabels}
            onCategoriesChange={(categories) => setSettings({ ...settings, categories })}
            onBrowseMode={(browseMode) => setSettings({ ...settings, browseMode })}
            onAssignCategory={(categoryId, ids) => setProducts(products.map((product) => ids.includes(product.id) ? { ...product, categoryIds: Array.from(new Set([...product.categoryIds, categoryId])) } : product))}
            onApplyLevels={(ids, levels) => setProducts(products.map((product) => ids.includes(product.id) ? { ...product, levels, updated: now() } : product))}
            onAddTask={addTask}
            onToggleTask={(id) => setTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))}
            onDeleteTask={(id) => setTasks(tasks.filter((task) => task.id !== id))}
            error={error}
          />
        ) : (
          <ProductSections products={visibleProducts.filter((product) => product.active)} labels={settings.columnLabels} mode={settings.browseMode} onSelect={setSelected} />
        )}
      </div>
      <CategoryFilter categories={settings.categories} products={products} value={categoryFilter} onChange={setCategoryFilter} sortMode={sortMode} onSort={setSortMode} />
      {showAddProduct && (
        <AddProductSheet labels={settings.columnLabels} onClose={() => setShowAddProduct(false)} onAdd={add} error={error} />
      )}
      {selected && (
        <Detail
          product={selected}
          labels={settings.columnLabels}
          categories={settings.categories}
          admin={isAdmin}
          onClose={() => setSelected(null)}
          onInvoice={invoice}
          onUpdatePricing={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextSelected = {
              ...selected,
              unit: String(form.get("unit") === "__custom__" ? form.get("unitManual") : form.get("unit") || selected.unit).trim(),
              description: String(form.get("description") || "").trim(),
              levels: (() => { try { const value = JSON.parse(String(form.get("levels") || "[]")); return Array.isArray(value) ? value : []; } catch { return selected.levels || []; } })(),
              percentages: settings.columnLabels.map((_, index) => Number(form.get(`p${index + 1}`)) || 0),
              rounding: settings.columnLabels.map((_, index) => Number(form.get(`r${index + 1}`)) || 1000),
              roundingEnabled: settings.columnLabels.map((_, index) => form.get(`round${index + 1}`) === "on"),
              categoryIds: settings.categories.filter((category) => form.get(`category-${category.id}`) === "on").map((category) => category.id),
              updated: now(),
            };
            setProducts(products.map((product) => (product.id === selected.id ? nextSelected : product)));
            setSelected(nextSelected);
          }}
        />
      )}
    </main>
  );
}

function CategoryFilter({ categories, products, value, onChange, sortMode, onSort }: { categories: { id: string; name: string }[]; products: Product[]; value: string | null; onChange: (value: string | null) => void; sortMode: string; onSort: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-oxblood px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-oxblood-dark">فیلتر و دسته‌بندی</button>{open && <div className="fixed inset-0 z-30 flex items-center justify-end"><button onClick={() => setOpen(false)} className="absolute inset-0 bg-oxblood-dark/40" aria-label="بستن"/><section className="relative h-full w-[92vw] max-w-md overflow-y-auto bg-white p-5 shadow-2xl"><h2 className="text-lg font-black">فیلتر و مرتب‌سازی</h2><select value={sortMode} onChange={(event) => onSort(event.target.value)} className="mt-4 w-full rounded-lg border border-oxblood/15 p-3"><option value="name">نام محصول</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="stock-desc">بیشترین موجودی</option></select><p className="mt-4 text-xs text-oxblood-dark/55">دسته‌بندی موردنظر را انتخاب کنید.</p><div className="mt-2 space-y-2"><button onClick={() => { onChange(null); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg border p-3 text-right ${!value ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>همه محصولات</span><b>{products.filter((product) => product.active).length}</b></button>{categories.map((category) => { const count = products.filter((product) => product.active && product.categoryIds.includes(category.id)).length; return <button key={category.id} onClick={() => { onChange(category.id); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg border p-3 text-right ${value === category.id ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>{category.name}</span><b>{count} محصول</b></button>; })}</div></section></div>}</>;
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
        onSubmit={(event) => {
          event.preventDefault();
          if (new FormData(event.currentTarget).get("password") === "Admin1405!") {
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
}: {
  q: string;
  setQ: (value: string) => void;
  navigate: (nextView: View, path: string) => void;
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
          <Link href="/customers" className="rounded-lg px-2 py-1 hover:bg-blush">مشتریان</Link>
          <button onClick={() => navigate("catalog", "/catalog")}>کاتالوگ</button>
          <button onClick={() => navigate("login", "/modir/login")}>ورود مدیر</button>
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
  onToggleActive,
  onToggleFeatured,
  selectedIds,
  onToggleSelect,
}: {
  products: Product[];
  labels: string[];
  mode?: "sections" | "phonebook";
  admin?: boolean;
  onSelect: (product: Product) => void;
  onToggleActive?: (product: Product) => void;
  onToggleFeatured?: (product: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
}) {
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  const letters = Array.from(new Set(products.map((product) => product.name.trim().charAt(0)))).filter(Boolean).sort((a, b) => a.localeCompare(b, "fa"));
  if (mode === "phonebook") {
    return <><h1 className="text-xl font-black sm:text-2xl">دفترچه محصولات</h1>{featured.length > 0 && <section className="mt-6"><h2 className="text-lg font-black text-oxblood">محصولات برتر</h2><Grid items={featured} labels={labels} admin={admin} onSelect={onSelect} onToggleActive={onToggleActive} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} /></section>}{letters.map((letter) => { const items = products.filter((product) => !product.featured && product.name.trim().startsWith(letter)); return items.length ? <section key={letter} className="mt-8"><h2 className="border-b border-oxblood/15 pb-2 text-2xl font-black text-oxblood">{letter}</h2><Grid items={items} labels={labels} admin={admin} onSelect={onSelect} onToggleActive={onToggleActive} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} /></section> : null; })}</>;
  }
  return (
    <>
      <h1 className="text-xl font-black sm:text-2xl">محصولات برتر</h1>
      <Grid items={featured} labels={labels} admin={admin} onSelect={onSelect} onToggleActive={onToggleActive} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
      <h2 className="mt-8 text-lg font-black sm:mt-10 sm:text-xl">سایر محصولات</h2>
      <Grid items={rest} labels={labels} admin={admin} onSelect={onSelect} onToggleActive={onToggleActive} onToggleFeatured={onToggleFeatured} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
    </>
  );
}

function Grid({
  items,
  labels,
  admin,
  onSelect,
  onToggleActive,
  onToggleFeatured,
  selectedIds,
  onToggleSelect,
}: {
  items: Product[];
  labels: string[];
  admin?: boolean;
  onSelect: (product: Product) => void;
  onToggleActive?: (product: Product) => void;
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
          <div className="flex items-start justify-between gap-2">{admin ? <button type="button" onClick={() => onToggleFeatured?.(product)} className="rounded-full p-1 hover:bg-amber-50" aria-label={product.featured ? "حذف از محصولات برتر" : "افزودن به محصولات برتر"}><Star size={18} className={product.featured ? "fill-amber-400 text-amber-400" : "text-oxblood/30"} /></button> : <Star size={15} className={product.featured ? "fill-amber-400 text-amber-400" : "text-oxblood/20"} />}{admin && <div className="flex gap-2">{onToggleSelect && <input type="checkbox" checked={selectedIds?.includes(product.id) || false} onChange={() => onToggleSelect(product.id)} className="h-5 w-5 accent-oxblood" aria-label={`انتخاب ${product.name}`} />}<button type="button" onClick={() => onToggleActive?.(product)} className={`relative h-6 w-11 rounded-full transition ${product.active ? "bg-oxblood" : "bg-oxblood/20"}`} aria-label={product.active ? "غیرفعال کردن محصول" : "فعال کردن محصول"}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${product.active ? "left-1" : "left-6"}`} /></button></div>}</div>
          <button onClick={() => onSelect(product)} className="w-full text-right">
          <b className="mt-4 block text-sm font-black leading-6 sm:text-base">{product.name}</b>
          <span className="mt-1 block text-[11px] text-oxblood-dark/45">{labels[0]}</span>
          {admin && <strong className="mt-4 block text-[11px] font-black text-oxblood">آخرین خرید: {money(latestPurchase(product))} تومان</strong>}
          <small className="mt-1 block text-[11px] text-oxblood-dark/45">هر ۱۰۰۰ گرم</small>
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
  tasks,
  onSelect,
  onToggleActive,
  onToggleFeatured,
  onOpenAdd,
  onImportExcel,
  onExportExcel,
  onSaveLabels,
  onCategoriesChange,
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
  tasks: Task[];
  onSelect: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onToggleFeatured: (product: Product) => void;
  onOpenAdd: () => void;
  onImportExcel: (event: FormEvent<HTMLInputElement>) => void;
  onExportExcel: () => void;
  onSaveLabels: (event: FormEvent<HTMLFormElement>) => void;
  onCategoriesChange: (categories: { id: string; name: string }[]) => void;
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
            ذخیره در دیتابیس مرورگر
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button onClick={onOpenAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-oxblood px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-oxblood-dark focus:outline-none focus:ring-2 focus:ring-oxblood/30">
          <Plus size={18} />
          افزودن محصول
        </button>
        <button onClick={() => { setSelectingForCategory(!selectingForCategory); if (selectingForCategory) setSelectedIds([]); }} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${selectingForCategory ? "bg-oxblood text-white shadow-sm" : "border border-oxblood/15 bg-blush text-oxblood hover:border-oxblood/40 hover:bg-white"}`}>ویرایش گروهی</button>
        <button onClick={() => setShowSettings(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-oxblood/15 bg-blush px-4 py-2.5 text-sm font-bold text-oxblood transition hover:border-oxblood/40 hover:bg-white">
          <Settings2 size={18} /> تنظیمات
        </button>
        </div>
      </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-white p-1 shadow-sm sm:w-80">
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
      </div>

      {tab === "products" ? (
        <div className="mt-5">
          {selectingForCategory && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-oxblood/10 bg-white p-3 shadow-sm"><b className="text-sm">مرحله ۱ · {selectedIds.length} محصول انتخاب شده</b><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} className="rounded-lg border border-oxblood/15 p-2 text-sm"><option value="">دستهٔ موردنظر را انتخاب کنید</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button disabled={!bulkCategory || !selectedIds.length} onClick={() => { onAssignCategory(bulkCategory, selectedIds); setBulkCategory(""); }} className="rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white disabled:opacity-40">ثبت دسته برای انتخاب‌ها</button><button disabled={!selectedIds.length} onClick={() => setShowBulkPricing(true)} className="rounded-lg bg-oxblood-dark px-3 py-2 text-sm font-bold text-white disabled:opacity-40">مرحله ۲: قیمت‌گذاری</button><button onClick={() => setSelectedIds(selectedIds.length === products.length ? [] : products.map((product) => product.id))} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">{selectedIds.length === products.length ? "لغو انتخاب همه" : "انتخاب همه"}</button></div>}
          <div className="mt-6">
            <ProductSections products={products} labels={labels} mode={browseMode} admin onSelect={onSelect} onToggleActive={onToggleActive} onToggleFeatured={onToggleFeatured} selectedIds={selectingForCategory ? selectedIds : []} onToggleSelect={selectingForCategory ? toggleSelection : undefined} />
          </div>
          <p className="mt-3 min-h-5 text-xs text-oxblood">{error}</p>
        </div>
      ) : (
        <TaskPanel tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} />
      )}
      {showSettings && (
        <div className="fixed inset-0 z-20 flex items-end justify-center">
          <div onClick={() => setShowSettings(false)} className="absolute inset-0 bg-oxblood-dark/45" />
          <section className="relative w-full rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:p-6">
            <button onClick={() => setShowSettings(false)} className="absolute left-4 top-4 text-oxblood/65" aria-label="بستن"><X /></button>
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-oxblood/20" />
            <h2 className="flex items-center gap-2 text-xl font-black"><Settings2 size={20} /> تنظیمات ستون‌ها</h2>
            <p className="mt-2 text-sm text-oxblood-dark/55">نام سه ستون قیمت را تغییر دهید.</p>
            <div className="mt-4">
              <section className="mb-4 rounded-lg border border-oxblood/10 bg-blush p-4"><h3 className="font-black">فایل‌های اکسل</h3><p className="mt-1 text-xs text-oxblood-dark/55">ورود اطلاعات جدید یا دریافت فهرست قیمت‌ها.</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-oxblood/20 bg-white px-3 py-2 text-sm font-bold text-oxblood"><Upload size={16} /> آپلود اکسل<input type="file" accept=".xlsx,.xls,.csv" onChange={onImportExcel} className="sr-only" /></label><button onClick={onExportExcel} className="rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white">خروجی اکسل</button></div></section>
              <DisplayModeForm mode={browseMode} onChange={onBrowseMode} />
              <CategoryForm categories={categories} onChange={onCategoriesChange} />
            </div>
          </section>
        </div>
      )}
      {showBulkPricing && <BulkPricingSheet count={selectedIds.length} onClose={() => setShowBulkPricing(false)} onApply={(levels) => { onApplyLevels(selectedIds, levels); setShowBulkPricing(false); setSelectedIds([]); setSelectingForCategory(false); }} />}
    </section>
  );
}

function CategoryForm({ categories, onChange }: { categories: { id: string; name: string }[]; onChange: (categories: { id: string; name: string }[]) => void }) {
  const [name, setName] = useState("");
  return <section className="mt-4 rounded-lg border border-oxblood/10 p-4"><h3 className="font-black">دسته‌بندی محصولات</h3><form onSubmit={(event) => { event.preventDefault(); const value = name.trim(); if (!value) return; onChange([...categories, { id: `${Date.now()}-${value}`, name: value }]); setName(""); }} className="mt-3 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام دسته" className="min-w-0 flex-1 rounded border border-oxblood/15 p-2"/><button className="rounded bg-oxblood px-3 text-sm font-bold text-white">افزودن</button></form><div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <span key={category.id} className="rounded-full bg-blush px-3 py-1 text-sm">{category.name}<button type="button" onClick={() => onChange(categories.filter((item) => item.id !== category.id))} className="mr-2 text-oxblood">×</button></span>)}</div></section>;
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
            <button type="button" onClick={() => onDeleteTask(task.id)} className="rounded-md p-2 text-oxblood/55 hover:bg-blush hover:text-oxblood" aria-label="حذف تسک">
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
  onClose,
  onAdd,
  error,
}: {
  labels: string[];
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
            توضیحات محصول
            <textarea name="description" rows={3} className="mt-2 w-full rounded-lg border border-oxblood/15 p-2" />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-bold">
          <input name="featured" type="checkbox" className="accent-oxblood" />
          محصول برتر
        </label>
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
  onSelect,
}: {
  products: Product[];
  labels: string[];
  onSelect: (product: Product) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-oxblood">کاتالوگ بازارک</h1>
          <p className="mt-1 text-sm text-oxblood-dark/55">نسخه آسیاب صداقت، {products.length} محصول</p>
        </div>
        <Link href="/catalog" className="inline-flex items-center gap-2 rounded-lg border border-oxblood/15 px-4 py-2 text-sm font-bold text-oxblood">
          لینک کاتالوگ
          <ExternalLink size={15} />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            className="rounded-lg border border-oxblood/10 bg-white p-4 text-right shadow-sm transition hover:border-oxblood/45"
          >
            <b className="block text-lg font-black">{product.name}</b>
            {product.description && <p className="mt-2 text-sm text-oxblood-dark/55">{product.description}</p>}
            <p className="mt-3 text-xs font-bold text-oxblood">آخرین خرید: {money(latestPurchase(product))} تومان</p>
            <p className="mt-1 text-[10px] text-oxblood-dark/45">هر ۱۰۰۰ گرم</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {(product.levels?.length ? product.levels : labels.map((label, index) => ({ id: `default-${index}`, label, unit: product.unit, quantity: "۱", price: sale(product, index) }))).map((level) => (
                <span key={level.id} className="rounded-lg bg-blush p-2"><span className="block text-oxblood-dark/45">{level.label}</span><b className="mt-1 block text-oxblood">{money(levelPrice(product, level))}</b><small className="mt-1 block text-[10px] text-oxblood-dark/45">{level.quantity} {level.unit}</small></span>
              ))}
            </div>
          </button>
        ))}
      </div>
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
  onUpdatePricing,
}: {
  product: Product;
  labels: string[];
  categories: { id: string; name: string }[];
  admin: boolean;
  onClose: () => void;
  onInvoice: (value: number, recordInvoice: boolean) => void;
  onUpdatePricing: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [purchaseValue, setPurchaseValue] = useState(0);
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const units = ["بسته", "عدد", "مثقال", "لیتر", "کارتن", "گرم", "کیلوگرم"];
  const [customUnit, setCustomUnit] = useState(!units.includes(product.unit));
  const [levels, setLevels] = useState<ProductLevel[]>(product.levels?.length ? product.levels : labels.map((label, index) => ({ id: `default-${index}`, label, unit: product.unit, quantity: "۱", price: sale(product, index) })));
  const levelBasePrice = (level: ProductLevel) => latestPurchase(product) * (parseAmount(level.quantity) || 1);
  const updateLevelPercent = (index: number, percent: number | undefined) => {
    setLevels(levels.map((level, levelIndex) => levelIndex === index
      ? { ...level, percent, price: percent === undefined ? 0 : Math.round(levelBasePrice(level) * (1 + percent / 100)) }
      : level));
  };
  const updateLevelPrice = (index: number, price: number) => {
    setLevels(levels.map((level, levelIndex) => levelIndex === index
      ? { ...level, price, percent: levelBasePrice(level) > 0 ? Number((((price / levelBasePrice(level)) - 1) * 100).toFixed(2)) : undefined }
      : level));
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
        {product.description && <p className="mt-3 rounded-lg bg-blush p-3 text-sm text-oxblood-dark/65">{product.description}</p>}
        {admin && <p className="mt-3 text-sm text-oxblood-dark/55">آخرین خرید از فروشنده: {money(latestPurchase(product))} تومان</p>}
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
            <div key={level.id} className="rounded-lg border border-oxblood/10 bg-blush p-3 text-center"><b className="block text-sm">{level.label}</b><strong className="mt-3 block text-lg font-black text-oxblood">{money(levelPrice(product, level))}</strong><small>{level.quantity} {level.unit}</small></div>
          ))}
        </div>
        {admin && (
          <>
            <form onSubmit={(event) => { event.preventDefault(); const value = parseAmount(new FormData(event.currentTarget).get("invoice")); if (value) { setPurchaseValue(value); setConfirmPurchase(true); } }} className="mt-5 rounded-lg border border-oxblood/10 bg-white p-3 shadow-sm sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-2">
              <label className="block text-xs font-bold">ثبت قیمت خرید جدید
                <input required name="invoice" type="text" inputMode="numeric" placeholder="قیمت فاکتور خرید جدید" onChange={(event) => { const value = parseAmount(event.currentTarget.value); event.currentTarget.value = value ? money(value) : ""; }} className="mt-1 w-full rounded-lg border border-oxblood/15 p-2" />
              </label>
              <button className="mt-2 rounded-lg bg-oxblood px-4 py-2 font-bold text-white sm:mt-0">ثبت قیمت خرید</button>
            </form>
            <form onSubmit={onUpdatePricing} className="mt-5 rounded-lg border border-oxblood/10 bg-blush p-3">
              <h3 className="font-black">ویرایش مشخصات و قیمت‌گذاری محصول</h3>
            <div className="mt-3"><label className="text-xs">واحد اندازه‌گیری<select name="unit" value={customUnit ? "__custom__" : product.unit} onChange={(event) => setCustomUnit(event.target.value === "__custom__")} className="mt-1 w-full rounded border border-oxblood/15 bg-white p-2">{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}<option value="__custom__">دستی ›</option></select>{customUnit && <input name="unitManual" defaultValue={units.includes(product.unit) ? "" : product.unit} placeholder="واحد را بنویسید" className="mt-2 w-full rounded border border-oxblood/15 p-2" />}</label></div>
              <label className="mt-3 block text-xs">توضیحات محصول<textarea name="description" defaultValue={product.description} rows={3} placeholder="توضیحات، نکات خرید یا مشخصات محصول..." className="mt-1 w-full rounded border border-oxblood/15 bg-white p-2" /></label>
              <input type="hidden" name="levels" value={JSON.stringify(levels)} />
              <div className="mt-4 rounded-lg border border-oxblood/10 bg-white p-3">
                <div className="flex items-center justify-between"><h4 className="font-black">سطح‌های اختصاصی این محصول</h4><button type="button" onClick={() => setLevels([...levels, { id: `${Date.now()}-${levels.length}`, label: "", unit: "", quantity: "", price: 0, roundingMode: "none" }])} className="rounded-lg border border-oxblood/20 px-3 py-1.5 text-xs font-bold text-oxblood">+ افزودن سطح</button></div>
                <p className="mt-2 text-xs text-oxblood-dark/55">درصد یا قیمت فروش را وارد کنید؛ فیلد مقابل همان لحظه محاسبه می‌شود.</p>
                <div className="mt-3 space-y-2">{levels.map((level, index) => <div key={level.id} className="grid gap-2 rounded-lg bg-blush p-2 sm:grid-cols-8">
                  <input value={level.label} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="نام سطح" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <input value={level.quantity} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} placeholder="مقدار" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <select value={level.unit} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item))} className="rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="" disabled>واحد</option>{units.map((unit) => <option key={unit}>{unit}</option>)}</select>
                  <input value={level.percent ?? ""} onChange={(event) => updateLevelPercent(index, event.target.value === "" ? undefined : Number(event.target.value))} placeholder="درصد سود" type="number" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <input value={level.price || ""} onChange={(event) => updateLevelPrice(index, parseAmount(event.target.value))} placeholder="قیمت فروش" type="text" inputMode="numeric" className="rounded border border-oxblood/15 bg-white p-2 text-xs font-bold text-oxblood" />
                  <input value={level.rounding ?? ""} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, rounding: event.target.value === "" ? undefined : Number(event.target.value) } : item))} placeholder="مبلغ رند" type="number" className="rounded border border-oxblood/15 p-2 text-xs" />
                  <select value={level.roundingMode || "none"} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, roundingMode: event.target.value as ProductLevel["roundingMode"] } : item))} className="rounded border border-oxblood/15 bg-white p-2 text-xs"><option value="none">بدون رند</option><option value="up">رند بالا</option><option value="down">رند پایین</option></select>
                  <button type="button" onClick={() => setLevels(levels.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-oxblood/15 text-xs text-oxblood">حذف</button>
                </div>)}</div>
              </div>
              {!!categories.length && <div className="mt-4 flex flex-wrap gap-2"><span className="w-full text-sm font-black">دسته‌بندی محصول</span>{categories.map((category) => <label key={category.id} className="rounded-lg border border-oxblood/15 px-3 py-2 text-sm"><input name={`category-${category.id}`} type="checkbox" defaultChecked={product.categoryIds.includes(category.id)} className="ml-2 accent-oxblood" />{category.name}</label>)}</div>}
              <button className="mt-3 rounded-lg bg-oxblood px-4 py-2 text-sm font-bold text-white">ذخیره قیمت‌گذاری</button>
            </form>
            {confirmPurchase && <div className="fixed inset-0 z-30 grid place-items-center bg-oxblood-dark/45 p-4"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-black">نوع ثبت قیمت خرید</h3><p className="mt-2 text-sm text-oxblood-dark/60">{money(purchaseValue)} تومان را چگونه ثبت کنیم؟</p><button onClick={() => { onInvoice(purchaseValue, false); setConfirmPurchase(false); }} className="mt-4 w-full rounded-lg border border-oxblood/25 p-3 font-bold text-oxblood">فقط به‌روزرسانی قیمت</button><button onClick={() => { onInvoice(purchaseValue, true); setConfirmPurchase(false); }} className="mt-2 w-full rounded-lg bg-oxblood p-3 font-bold text-white">ثبت به‌عنوان فاکتور جدید</button><button onClick={() => setConfirmPurchase(false)} className="mt-3 w-full text-sm text-oxblood-dark/55">انصراف</button></section></div>}
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
          </>
        )}
      </section>
    </div>
  );
}
