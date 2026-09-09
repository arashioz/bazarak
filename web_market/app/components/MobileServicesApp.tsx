"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  LoaderCircle,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import {
  displayJalaliDate,
  findMobileServiceCustomers,
} from "@/lib/mobile-service-customers";

type Customer = {
  id: number;
  name: string;
  mobile: string;
  phone: string;
  address: string;
  group: string;
  description: string;
  active: boolean;
};
type Record = {
  id: number;
  date: string;
  customerId?: number;
  customerName: string;
  phone: string;
  address: string;
  serviceType: string;
  operator: string;
  quantity: number;
  paymentStatus: "settled" | "unsettled";
  updatedAt?: string;
};
type Data = { records: Record[]; serviceTypes: string[]; operators: string[] };
const empty: Data = { records: [], serviceTypes: [], operators: [] };
const pageSize = 40;
const digits = (v: string) =>
  v
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
const jalali = () =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/٫/g, "/");
const customerKey = (record: Pick<Record, "customerName" | "phone">) => digits(record.phone) || record.customerName.trim().toLocaleLowerCase("fa");
const updatedLabel = (value?: string) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";
const isFresh = (value?: string) => !!value && Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;

export default function MobileServicesApp() {
  const [data, setData] = useState<Data>(empty),
    [customers, setCustomers] = useState<Customer[]>([]),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState(""),
    [type, setType] = useState(""),
    [operator, setOperator] = useState(""),
    [quantity, setQuantity] = useState(""),
    [payment, setPayment] = useState<Record["paymentStatus"]>("unsettled"),
    [date, setDate] = useState(jalali()),
    [q, setQ] = useState(""),
    [limit, setLimit] = useState(pageSize),
    [selected, setSelected] = useState<Record | null>(null),
    [unpaidOpen, setUnpaidOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch("/api/database", { cache: "no-store" })
      .then((r) => r.json())
      .then((db) => {
        setData(db.mobileServices || empty);
        setCustomers(db.customers || []);
      });
  }, []);
  const save = async (next: Data) => {
    setData(next);
    await fetch("/api/database", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "mobileServices", data: next }),
    });
  };
  const matches = useMemo(
    () => findMobileServiceCustomers(data.records, name),
    [data.records, name],
  );
  const allRows = useMemo(
    () =>
      Array.from(
        data.records
          .filter((r) =>
            `${r.customerName} ${r.phone} ${r.serviceType} ${r.operator}`.includes(
              q,
            ),
          )
          .reduce((m, r) => {
            const key = customerKey(r),
              old = m.get(key);
            m.set(
              key,
              !old || r.date > old.date
                ? { ...r, count: (old?.count || 0) + 1 }
                : { ...old, count: old.count + 1 },
            );
            return m;
          }, new Map<string, Record & { count: number }>())
          .values(),
      ).sort((a, b) => b.date.localeCompare(a.date, "fa")),
    [data.records, q],
  );
  const rows = allRows.slice(0, limit),
    unpaid = data.records.filter((r) => r.paymentStatus === "unsettled");
  useEffect(() => setLimit(pageSize), [q]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || rows.length >= allRows.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting)
          setLimit((n) => Math.min(n + pageSize, allRows.length));
      },
      { rootMargin: "360px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rows.length, allRows.length]);
  const choose = (c: {
    name: string;
    mobile: string;
    phone: string;
    address: string;
  }) => {
    setName(c.name);
    setPhone(c.mobile || c.phone);
    setAddress(c.address);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim() || quantity === "") return;
    let c = customers.find(
      (x) =>
        x.name === name.trim() ||
        (!!phone && digits(x.mobile || x.phone) === digits(phone)),
    );
    if (!c) {
      c = {
        id: Date.now(),
        name: name.trim(),
        mobile: phone.trim(),
        phone: "",
        address: address.trim(),
        group: "خدمات سیار",
        description: "",
        active: true,
      };
      await fetch("/api/database", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "customerUpsert", data: c }),
      });
      setCustomers((cs) => [...cs, c!]);
    }
    const next = {
      records: [
        {
          id: Date.now(),
          date,
          customerId: c.id,
          customerName: c.name,
          phone: phone.trim() || c.mobile || c.phone,
          address: address.trim() || c.address,
          serviceType: type.trim(),
          operator: operator.trim(),
          quantity: Number(quantity),
          paymentStatus: payment,
          updatedAt: new Date().toISOString(),
        },
        ...data.records,
      ],
      serviceTypes: data.serviceTypes.includes(type.trim())
        ? data.serviceTypes
        : [...data.serviceTypes, type.trim()],
      operators:
        !operator.trim() || data.operators.includes(operator.trim())
          ? data.operators
          : [...data.operators, operator.trim()],
    };
    await save(next);
    setName("");
    setPhone("");
    setAddress("");
    setType("");
    setOperator("");
    setQuantity("");
  };
  const remove = async (id: number) => {
    if (window.confirm("این سابقه حذف شود؟"))
      await save({ ...data, records: data.records.filter((r) => r.id !== id) });
  };
  const setPaymentStatus = async (id: number, paymentStatus: Record["paymentStatus"]) => {
    await save({
      ...data,
      records: data.records.map((r) =>
        r.id === id
          ? { ...r, paymentStatus, updatedAt: new Date().toISOString() }
          : r,
      ),
    });
  };
  const updateCustomer = async (
    record: Record,
    values: { name: string; phone: string; address: string },
  ) => {
    const current = customers.find((c) => c.id === record.customerId) || {
      id: record.customerId || Date.now(),
      name: record.customerName,
      mobile: record.phone,
      phone: "",
      address: record.address,
      group: "خدمات سیار",
      description: "",
      active: true,
    };
    const customer = {
      ...current,
      name: values.name.trim(),
      mobile: values.phone.trim(),
      phone: "",
      address: values.address.trim(),
      group: "خدمات سیار",
    };
    await fetch("/api/database", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "customerUpsert", data: customer }),
    });
    setCustomers((list) =>
      list.some((c) => c.id === customer.id)
        ? list.map((c) => (c.id === customer.id ? customer : c))
        : [...list, customer],
    );
    const records = data.records.map((r) =>
      r.customerId === record.customerId ||
      (r.customerName === record.customerName && r.phone === record.phone)
        ? {
            ...r,
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.mobile,
            address: customer.address,
            updatedAt: new Date().toISOString(),
          }
        : r,
    );
    await save({ ...data, records });
    setSelected({
      ...record,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.mobile,
      address: customer.address,
    });
  };
  return (
    <main className="min-h-screen bg-blush p-4 text-oxblood-dark sm:p-6">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-oxblood">
              <Truck /> خدمات سیار
            </h1>
            <p className="mt-1 text-sm text-oxblood/60">
              ثبت خدمت، پیگیری مشتری و وضعیت تسویه در یک نما
            </p>
          </div>
          <nav className="flex gap-2">
            <Link
              href="/mobile-services/settings"
              className="rounded-lg border border-oxblood/15 bg-white px-3 py-2 text-sm font-bold"
            >
              تنظیمات
            </Link>
            <Link
              href="/modir/panel"
              className="rounded-lg border border-oxblood/15 bg-white px-3 py-2 text-sm font-bold"
            >
              پنل مدیریت
            </Link>
          </nav>
        </header>
        {unpaid.length > 0 && (
          <button
            type="button"
            onClick={() => setUnpaidOpen(true)}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-right text-amber-950 shadow-sm"
          >
            <span className="flex items-center gap-2 font-bold">
              <AlertCircle size={20} />
              {unpaid.length.toLocaleString("fa-IR")} خدمت تسویه‌نشده
            </span>
            <span className="text-sm">مشاهده و پیگیری ←</span>
          </button>
        )}
        <form onSubmit={submit} className="mt-4 rounded-2xl bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-blush text-oxblood">
              <Plus size={18} />
            </span>
            <h2 className="font-black">ثبت خدمت جدید</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              مشتری یا شماره
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام مشتری"
                className="mt-1 w-full"
              />
            </label>
            <label>
              شماره تماس
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                className="mt-1 w-full"
              />
            </label>
            <label>
              نوع خدمات
              <input
                required
                list="types"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full"
              />
              <datalist id="types">
                {data.serviceTypes.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
            <label>
              اپراتور
              <input
                list="operators"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="mt-1 w-full"
              />
              <datalist id="operators">
                {data.operators.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
            <label>
              مقدار کالا
              <input
                required
                type="number"
                min="0"
                step=".01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label>
              وضعیت پرداخت
              <select
                value={payment}
                onChange={(e) =>
                  setPayment(e.target.value as Record["paymentStatus"])
                }
                className="mt-1 w-full"
              >
                <option value="settled">تسویه شده</option>
                <option value="unsettled">تسویه نشده</option>
              </select>
            </label>
            <label>
              تاریخ
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label>
              آدرس
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
          </div>
          {name.trim() && matches.length > 0 && (
            <div className="mt-3 rounded-xl border border-oxblood/10 bg-blush p-2">
              <p className="px-2 text-xs text-oxblood/60">مشتریان ثبت‌شده</p>
              {matches.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => choose(c)}
                  className="block w-full rounded-lg px-2 py-2 text-right text-sm hover:bg-white"
                >
                  {c.name}
                  <span className="mr-2 text-oxblood/55">
                    — {c.mobile || c.phone}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-oxblood px-4 py-2.5 font-bold text-white">
            <Plus size={18} /> ثبت خدمت
          </button>
        </form>
        <section className="mt-5 rounded-2xl bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black">سوابق مشتریان</h2>
              <p className="mt-1 text-xs text-oxblood/55">
                با رسیدن به انتهای فهرست، موارد بعدی خودکار بارگذاری می‌شوند.
              </p>
            </div>
            <div className="relative">
              <Search
                className="absolute right-3 top-2.5 text-oxblood/45"
                size={16}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجوی نام، شماره، خدمت..."
                className="w-64 max-w-full py-2 pr-9"
              />
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead className="text-sm text-oxblood/60">
                <tr>
                  <th>تاریخ</th>
                  <th>مشتری</th>
                  <th>نوع خدمت</th>
                  <th>مقدار</th>
                  <th>اپراتور</th>
                  <th>پرداخت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={isFresh(r.updatedAt) ? "bg-emerald-50/70" : undefined}>
                    <td>{displayJalaliDate(r.date)}{r.updatedAt && <small className="mt-1 block text-[10px] text-emerald-700">به‌روزرسانی: {updatedLabel(r.updatedAt)}</small>}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="font-bold text-oxblood underline underline-offset-4"
                      >
                        {r.customerName}
                        {r.count > 1 && (
                          <small className="mr-2 rounded-full bg-white px-2 py-1 no-underline">
                            {r.count} سابقه
                          </small>
                        )}
                      </button>
                    </td>
                    <td>{r.serviceType}</td>
                    <td>{r.quantity}</td>
                    <td>{r.operator || "—"}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${r.paymentStatus === "settled" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
                      >
                        {r.paymentStatus === "settled"
                          ? "تسویه شده"
                          : "تسویه نشده"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-sm text-oxblood/70 hover:text-oxblood"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="py-10 text-center text-oxblood/55">
              سابقه‌ای پیدا نشد.
            </p>
          )}
          {rows.length < allRows.length && (
            <div
              ref={sentinel}
              className="flex justify-center py-6 text-sm text-oxblood/60"
            >
              <LoaderCircle className="ml-2 animate-spin" size={17} />
              در حال بارگذاری سوابق بیشتر…
            </div>
          )}
        </section>
        {selected && (
          <CustomerHistory
            record={selected}
            records={data.records}
            onClose={() => setSelected(null)}
            onSetPaymentStatus={setPaymentStatus}
            onRemove={remove}
            onUpdate={updateCustomer}
          />
        )}{" "}
        {unpaidOpen && (
          <UnpaidDialog
            records={unpaid}
            onClose={() => setUnpaidOpen(false)}
            onSelect={(r) => {
              setSelected(r);
              setUnpaidOpen(false);
            }}
          />
        )}
      </section>
    </main>
  );
}
function CustomerHistory({
  record,
  records,
  onClose,
  onSetPaymentStatus,
  onRemove,
  onUpdate,
}: {
  record: Record;
  records: Record[];
  onClose: () => void;
  onSetPaymentStatus: (id: number, paymentStatus: Record["paymentStatus"]) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onUpdate: (
    record: Record,
    values: { name: string; phone: string; address: string },
  ) => Promise<void>;
}) {
  const [name, setName] = useState(record.customerName),
    [phone, setPhone] = useState(record.phone),
    [address, setAddress] = useState(record.address),
    [saving, setSaving] = useState(false);
  const history = records
    .filter(
      (x) =>
        x.customerId === record.customerId ||
        (x.customerName === record.customerName && x.phone === record.phone),
    )
    .sort((a, b) => b.date.localeCompare(a.date, "fa"));
  const update = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdate(record, { name, phone, address });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-oxblood-dark/45 p-4 sm:place-items-center">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="float-left rounded-full p-1 hover:bg-blush"
        >
          <X />
        </button>
        <h2 className="text-xl font-black">{record.customerName}</h2>
        <form
          onSubmit={update}
          className="mt-4 rounded-xl border border-oxblood/10 bg-blush p-3"
        >
          <h3 className="font-black">ویرایش مشتری خدمات سیار</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold">
              نام
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border p-2 font-normal"
              />
            </label>
            <label className="text-xs font-bold">
              شماره تماس
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                className="mt-1 w-full rounded-lg border p-2 font-normal"
              />
            </label>
            <label className="text-xs font-bold sm:col-span-2">
              آدرس
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border p-2 font-normal"
              />
            </label>
          </div>
          <button
            disabled={saving}
            className="mt-3 rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره اطلاعات"}
          </button>
        </form>
        <h3 className="mt-6 font-black">تاریخچه خدمات</h3>
        <div className="mt-3 space-y-2">
          {history.map((x) => (
            <article key={x.id} className="rounded-xl bg-blush p-3">
              <div className="flex justify-between gap-3">
                <b>
                  {displayJalaliDate(x.date)} · {x.serviceType}
                </b>
                <span
                  className={
                    x.paymentStatus === "settled"
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                >
                  {x.paymentStatus === "settled" ? "تسویه شده" : "تسویه نشده"}
                </span>
              </div>
              <p className="mt-1 text-sm text-oxblood/70">
                {x.quantity} کیلو · {x.operator || "بدون اپراتور"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void onSetPaymentStatus(x.id, x.paymentStatus === "settled" ? "unsettled" : "settled")} className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${x.paymentStatus === "settled" ? "bg-amber-700" : "bg-emerald-700"}`}>
                  {x.paymentStatus === "settled" ? "ثبت «تسویه نشده»" : "ثبت «تسویه شد»"}
                </button>
                <button type="button" onClick={() => void onRemove(x.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">حذف این سابقه</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
function UnpaidDialog({
  records,
  onClose,
  onSelect,
}: {
  records: Record[];
  onClose: () => void;
  onSelect: (r: Record) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-oxblood-dark/45 p-4 sm:place-items-center">
      <section className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="float-left rounded-full p-1 hover:bg-blush"
        >
          <X />
        </button>
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle />
          <h2 className="text-xl font-black">تسویه‌نشده‌ها</h2>
        </div>
        <p className="mt-2 text-sm text-oxblood/60">
          روی هر مورد بزنید تا سابقهٔ مشتری را ببینید.
        </p>
        <div className="mt-4 space-y-2">
          {[...records]
            .sort((a, b) => b.date.localeCompare(a.date, "fa"))
            .map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => onSelect(r)}
                className="flex w-full items-center justify-between rounded-xl border border-amber-100 p-3 text-right hover:bg-amber-50"
              >
                <span>
                  <b className="block">{r.customerName}</b>
                  <small className="text-oxblood/60">
                    {displayJalaliDate(r.date)} · {r.serviceType} · {r.quantity}{" "}
                    کیلو
                  </small>
                </span>
                <ChevronLeft className="text-amber-700" />
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-oxblood py-2.5 font-bold text-white"
        >
          بستن
        </button>
      </section>
    </div>
  );
}
