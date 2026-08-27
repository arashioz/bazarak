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
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { seedProductRows } from "../data/seedProductRows";

type Invoice = { price: number; registeredAt: string };
type Product = {
  id: number;
  name: string;
  price: number;
  featured: boolean;
  updated: string;
  catalogUrl: string;
  description: string;
  invoices: Invoice[];
  percentages: [number, number, number];
  rounding: [number, number, number];
};
type AppSettings = { id: "settings"; columnLabels: [string, string, string] };
type Task = { id: number; text: string; done: boolean };
type View = "landing" | "user" | "login" | "admin" | "catalog";
type AdminTab = "products" | "tasks";

const DB_NAME = "bazarek-browser-db";
const DB_VERSION = 2;
const PRODUCT_STORE = "products";
const SETTINGS_STORE = "settings";
const TASK_STORE = "tasks";
const DEFAULT_LABELS: [string, string, string] = ["۱ تا ۲ کیلو", "۵ تا ۱۰ کیلو", "۲۰ بسته"];
const DEFAULT_SETTINGS: AppSettings = { id: "settings", columnLabels: DEFAULT_LABELS };

const now = () => new Date().toISOString();
const money = (value: number) => value.toLocaleString("fa-IR");
const latestPurchase = (product: Product) => product.invoices[0]?.price ?? product.price;
const parseAmount = (value: unknown) => Number(String(value ?? "").replace(/[٬،,\s]/g, "").replace(/[^0-9.-]/g, "")) || 0;
const date = (value: string) =>
  new Date(value).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const sale = (product: Product, index: number) =>
  Math.round((product.price * (1 + product.percentages[index] / 100)) / product.rounding[index]) *
  product.rounding[index];

const excelSeed = (): Product[] => {
  const createdAt = now();
  return seedProductRows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    featured: row.featured,
    updated: createdAt,
    catalogUrl: "",
    description: "",
    invoices: row.price > 0 ? [{ price: row.price, registeredAt: createdAt }] : [],
    percentages: [row.percent, row.percent, row.percent],
    rounding: [1000, 1000, 1000],
  }));
};

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
      featured: Boolean(product.featured),
      updated,
      catalogUrl: String(product.catalogUrl || ""),
      description: String(product.description || ""),
      invoices,
      percentages: product.percentages || [12, 9, 6],
      rounding: product.rounding || [1000, 1000, 1000],
    };
  });
};

const mergeProducts = (base: Product[], saved: Product[]) => {
  const byName = new Map(base.map((product) => [product.name, product]));
  saved.forEach((product) => byName.set(product.name, { ...byName.get(product.name), ...product }));
  return Array.from(byName.values());
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) db.createObjectStore(PRODUCT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TASK_STORE)) db.createObjectStore(TASK_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readAll = async <T,>(storeName: string) => {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const replaceAll = async <T,>(storeName: string, items: T[]) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    items.forEach((item) => store.put(item));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

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

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const shouldShowIntro = localStorage.getItem("bazarek-intro-seen") !== "1";
      if (shouldShowIntro) {
        setShowIntro(true);
        localStorage.setItem("bazarek-intro-seen", "1");
        window.setTimeout(() => setShowIntro(false), 1800);
      }

      const seeded = excelSeed();
      const dbProducts = normalizeProducts(await readAll<Product>(PRODUCT_STORE));
      const dbSettings = await readAll<AppSettings>(SETTINGS_STORE);
      const dbTasks = await readAll<Task>(TASK_STORE);
      const legacy = normalizeProducts(JSON.parse(localStorage.getItem("bazarek-products") || "[]"));
      const nextProducts = dbProducts.length ? dbProducts : mergeProducts(seeded, legacy);

      if (!cancelled) {
        setProducts(nextProducts);
        setSettings(dbSettings[0] || DEFAULT_SETTINGS);
        setTasks(dbTasks);
        setDbReady(true);
        if (initialView === "landing" && localStorage.getItem("bazarek-role") === "user") {
          setView("user");
          router.replace("/products");
        }
      }

      if (!dbProducts.length) await replaceAll(PRODUCT_STORE, nextProducts);
      if (!dbSettings.length) await replaceAll(SETTINGS_STORE, [DEFAULT_SETTINGS]);
    };

    boot().catch(() => {
      if (!cancelled) {
        setProducts(excelSeed());
        setDbReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialView, router]);

  useEffect(() => {
    if (dbReady) void replaceAll(PRODUCT_STORE, products);
  }, [dbReady, products]);

  useEffect(() => {
    if (dbReady) void replaceAll(SETTINGS_STORE, [settings]);
  }, [dbReady, settings]);

  useEffect(() => {
    if (dbReady) void replaceAll(TASK_STORE, tasks);
  }, [dbReady, tasks]);

  const navigate = (nextView: View, path: string) => {
    setError("");
    setSelected(null);
    setShowAddProduct(false);
    setView(nextView);
    router.push(path);
  };

  const filtered = useMemo(() => products.filter((product) => product.name.includes(q.trim())), [products, q]);

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
        featured: form.get("featured") === "on",
        updated: createdAt,
        catalogUrl: String(form.get("catalogUrl") || "").trim(),
        description: String(form.get("description") || "").trim(),
        invoices: [{ price, registeredAt: createdAt }],
        percentages: [getNumber("p1"), getNumber("p2"), getNumber("p3")],
        rounding: [getNumber("r1"), getNumber("r2"), getNumber("r3")],
      },
      ...products,
    ]);
    event.currentTarget.reset();
    setError("");
    setShowAddProduct(false);
  };

  const invoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const value = Number(new FormData(event.currentTarget).get("invoice"));
    if (value < 1) return;
    const registeredAt = now();
    const nextSelected = {
      ...selected,
      price: value,
      invoices: [{ price: value, registeredAt }, ...selected.invoices],
      updated: registeredAt,
    };
    setProducts(products.map((product) => (product.id === selected.id ? nextSelected : product)));
    setSelected(nextSelected);
    event.currentTarget.reset();
  };

  const updateColumnLabels = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSettings({
      id: "settings",
      columnLabels: [
        String(form.get("label1") || DEFAULT_LABELS[0]),
        String(form.get("label2") || DEFAULT_LABELS[1]),
        String(form.get("label3") || DEFAULT_LABELS[2]),
      ],
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
          rounding: previous?.rounding || [1000, 1000, 1000], featured: previous?.featured ?? false, catalogUrl: previous?.catalogUrl || "", description: previous?.description || "" });
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
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {view === "catalog" ? (
          <Catalog products={filtered} labels={settings.columnLabels} onSelect={setSelected} />
        ) : isAdmin ? (
          <Admin
            products={filtered}
            labels={settings.columnLabels}
            tasks={tasks}
            onSelect={setSelected}
            onOpenAdd={() => setShowAddProduct(true)}
            onImportExcel={importExcel}
            onSaveLabels={updateColumnLabels}
            onAddTask={addTask}
            onToggleTask={(id) => setTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))}
            error={error}
          />
        ) : (
          <ProductSections products={filtered} labels={settings.columnLabels} onSelect={setSelected} />
        )}
      </div>
      {showAddProduct && (
        <AddProductSheet labels={settings.columnLabels} onClose={() => setShowAddProduct(false)} onAdd={add} error={error} />
      )}
      {selected && (
        <Detail
          product={selected}
          labels={settings.columnLabels}
          admin={isAdmin}
          onClose={() => setSelected(null)}
          onInvoice={invoice}
        />
      )}
    </main>
  );
}

function Landing({ navigate }: { navigate: (nextView: View, path: string) => void }) {
  return (
    <main className="min-h-screen bg-blush px-4 py-10 text-oxblood-dark sm:px-6 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <p className="text-lg font-black text-oxblood">بازارک</p>
        <p className="mt-2 text-sm text-oxblood-dark/65">نسخه آسیاب صداقت</p>
        <h1 className="mt-12 text-3xl font-black leading-tight sm:mt-16 sm:text-5xl">کدام بخش را می‌خواهید؟</h1>
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
          <button onClick={() => navigate("catalog", "/catalog")}>کاتالوگ</button>
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
  admin,
  onSelect,
}: {
  products: Product[];
  labels: [string, string, string];
  admin?: boolean;
  onSelect: (product: Product) => void;
}) {
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  return (
    <>
      <h1 className="text-xl font-black sm:text-2xl">محصولات برتر</h1>
      <Grid items={featured} labels={labels} admin={admin} onSelect={onSelect} />
      <h2 className="mt-8 text-lg font-black sm:mt-10 sm:text-xl">سایر محصولات</h2>
      <Grid items={rest} labels={labels} admin={admin} onSelect={onSelect} />
    </>
  );
}

function Grid({
  items,
  labels,
  admin,
  onSelect,
}: {
  items: Product[];
  labels: [string, string, string];
  admin?: boolean;
  onSelect: (product: Product) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((product) => (
        <button
          key={product.id}
          onClick={() => onSelect(product)}
          className="min-h-36 rounded-lg border border-oxblood/10 bg-white p-3 text-right shadow-sm transition hover:border-oxblood/45 sm:p-4"
        >
          <Star size={15} className={product.featured ? "fill-oxblood text-oxblood" : "text-oxblood/20"} />
          <b className="mt-4 block text-sm font-black leading-6 sm:text-base">{product.name}</b>
          <span className="mt-1 block text-[11px] text-oxblood-dark/45">{labels[0]}</span>
          <strong className="mt-4 block text-xs font-black text-oxblood">
            آخرین خرید از فروشنده بردرا: {money(latestPurchase(product))} تومان
          </strong>
          <small className="mt-1 block text-[11px] text-oxblood-dark/45">هر ۱۰۰۰ گرم</small>
          <small className="mt-1 block text-[11px] text-oxblood-dark/45">بروزرسانی: {date(product.updated)}</small>
          {admin && <small className="mt-1 block text-[11px] text-oxblood-dark/45">{product.invoices.length} فاکتور</small>}
        </button>
      ))}
    </div>
  );
}

function Admin({
  products,
  labels,
  tasks,
  onSelect,
  onOpenAdd,
  onImportExcel,
  onSaveLabels,
  onAddTask,
  onToggleTask,
  error,
}: {
  products: Product[];
  labels: [string, string, string];
  tasks: Task[];
  onSelect: (product: Product) => void;
  onOpenAdd: () => void;
  onImportExcel: (event: FormEvent<HTMLInputElement>) => void;
  onSaveLabels: (event: FormEvent<HTMLFormElement>) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: number) => void;
  error: string;
}) {
  const [tab, setTab] = useState<AdminTab>("products");
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">پنل مهدی</h1>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-oxblood-dark/45">
            <Database size={14} />
            ذخیره در دیتابیس مرورگر
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button onClick={onOpenAdd} className="inline-flex items-center gap-2 rounded-lg bg-oxblood px-4 py-2 font-bold text-white">
          <Plus size={18} />
          افزودن محصول
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-oxblood/20 bg-white px-4 py-2 font-bold text-oxblood">
          <Upload size={18} /> آپلود اکسل
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onImportExcel} className="sr-only" />
        </label>
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
          <ColumnLabelForm labels={labels} onSave={onSaveLabels} />
          <div className="mt-6">
            <ProductSections products={products} labels={labels} admin onSelect={onSelect} />
          </div>
          <p className="mt-3 min-h-5 text-xs text-oxblood">{error}</p>
        </div>
      ) : (
        <TaskPanel tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} />
      )}
    </section>
  );
}

function ColumnLabelForm({
  labels,
  onSave,
}: {
  labels: [string, string, string];
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSave} className="rounded-lg border border-oxblood/10 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-black">
        <Settings2 size={18} />
        نام ستون‌های قیمت
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {labels.map((label, index) => (
          <input
            key={index}
            name={`label${index + 1}`}
            defaultValue={label}
            className="rounded-lg border border-oxblood/15 p-2 text-sm"
          />
        ))}
        <button className="rounded-lg bg-oxblood px-4 py-2 text-sm font-bold text-white">ذخیره</button>
      </div>
    </form>
  );
}

function TaskPanel({
  tasks,
  onAddTask,
  onToggleTask,
}: {
  tasks: Task[];
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: number) => void;
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
          <button
            key={task.id}
            onClick={() => onToggleTask(task.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-oxblood/10 p-3 text-right"
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                task.done ? "border-oxblood bg-oxblood text-white" : "border-oxblood/20 text-transparent"
              }`}
            >
              <Check size={15} />
            </span>
            <span className={task.done ? "text-oxblood-dark/40 line-through" : ""}>{task.text}</span>
          </button>
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
  labels: [string, string, string];
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
                defaultValue={[12, 9, 6][index]}
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
  labels: [string, string, string];
  onSelect: (product: Product) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-oxblood">کاتالوگ بازارک</h1>
          <p className="mt-1 text-sm text-oxblood-dark/55">نسخه آسیاب صداقت، {products.length} محصول</p>
        </div>
        <a href="/catalog" className="inline-flex items-center gap-2 rounded-lg border border-oxblood/15 px-4 py-2 text-sm font-bold text-oxblood">
          لینک کاتالوگ
          <ExternalLink size={15} />
        </a>
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
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {labels.map((label, index) => (
                <span key={label} className="rounded-lg bg-blush p-2">
                  <span className="block text-oxblood-dark/45">{label}</span>
                  <b className="mt-1 block text-oxblood">{money(sale(product, index))}</b>
                  <small className="mt-1 block text-[10px] text-oxblood-dark/45">هر ۱۰۰۰ گرم</small>
                </span>
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
  admin,
  onClose,
  onInvoice,
}: {
  product: Product;
  labels: [string, string, string];
  admin: boolean;
  onClose: () => void;
  onInvoice: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-oxblood-dark/45" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:p-6">
        <button onClick={onClose} className="absolute left-4 top-4 text-oxblood/65" aria-label="بستن">
          <X />
        </button>
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-oxblood/20" />
        <h2 className="text-2xl font-black">{product.name}</h2>
        {product.description && <p className="mt-3 rounded-lg bg-blush p-3 text-sm text-oxblood-dark/65">{product.description}</p>}
        <p className="mt-3 text-sm text-oxblood-dark/55">
          آخرین خرید از فروشنده بردرا: {money(latestPurchase(product))} تومان
        </p>
        <p className="mt-1 text-xs text-oxblood-dark/45">هر ۱۰۰۰ گرم</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-oxblood-dark/45">
          <CalendarDays size={14} />
          تاریخ بروزرسانی: {date(product.updated)}
        </p>
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
          {labels.map((label, index) => (
            <div key={label} className="rounded-lg border border-oxblood/10 bg-blush p-3 text-center">
              <b className="block text-sm">{label}</b>
              <strong className="mt-3 block text-lg font-black text-oxblood">{money(sale(product, index))}</strong>
              <small>تومان · هر ۱۰۰۰ گرم</small>
            </div>
          ))}
        </div>
        {admin && (
          <>
            <form onSubmit={onInvoice} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                required
                name="invoice"
                type="number"
                placeholder="قیمت فاکتور خرید جدید"
                className="rounded-lg border border-oxblood/15 p-2"
              />
              <button className="rounded-lg bg-oxblood px-4 py-2 font-bold text-white">ثبت فاکتور</button>
            </form>
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
