"use client";

import { Phone, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

const phone = (value: string) => value.replace(/\D/g, "");
type Customer = { id: number; name: string; group?: string; mobile?: string; phone?: string };
type CustomerSettings = { categories?: Array<{ id: string; name: string }>; assignments?: Record<string, string> };

export default function CustomerDrawer() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSettings, setCustomerSettings] = useState<CustomerSettings>({});
  const [categoryFilter, setCategoryFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadCustomers = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const response = await fetch("/api/database", { cache: "no-store" });
      if (!response.ok) throw new Error("database request failed");
      const database = await response.json();
      setCustomers(Array.isArray(database.customers) ? database.customers : []);
      setCustomerSettings(database.customerSettings || {});
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadCustomers(); }, [loadCustomers]);
  const visible = useMemo(() => {
    const text = query.trim();
    const matches = customers.filter((customer) =>
      (!text || `${customer.name} ${customer.group || ""} ${customer.mobile || ""} ${customer.phone || ""}`.includes(text)) &&
      (!categoryFilter || customerSettings.assignments?.[customer.id] === categoryFilter),
    );
    return matches.slice(0, 100);
  }, [customers, query, categoryFilter, customerSettings.assignments]);
  return <>
    <button type="button" onClick={() => { setOpen(true); void loadCustomers(); }} className="fixed left-4 top-[calc(50%-3.5rem)] z-10 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-oxblood shadow-xl ring-1 ring-oxblood/15 transition hover:bg-blush"><Users size={18} /> مشتریان</button>
    {open && <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-oxblood-dark/40" aria-label="بستن پنل مشتریان" />
      <aside className="relative flex h-full w-[92vw] max-w-[420px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="border-b p-4"><button type="button" onClick={() => setOpen(false)} className="absolute left-4 top-4 text-oxblood" aria-label="بستن"><X /></button><h2 className="font-black">مشتریان</h2><p className="mt-1 text-sm text-oxblood-dark/55">{customers.length.toLocaleString("fa-IR")} مخاطب ثبت‌شده</p></header>
        <div className="border-b p-4"><div className="mb-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategoryFilter("")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${!categoryFilter ? "bg-oxblood text-white" : "bg-blush text-oxblood"}`}>همه</button>{(customerSettings.categories || []).map((category) => <button type="button" key={category.id} onClick={() => setCategoryFilter(category.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${categoryFilter === category.id ? "bg-oxblood text-white" : "bg-blush text-oxblood"}`}>{category.name}</button>)}</div><div className="relative"><Search className="absolute right-3 top-2.5 text-oxblood/45" size={16}/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو نام یا شماره..." className="pr-9"/></div></div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading && <div className="space-y-3" aria-live="polite"><div className="rounded-xl bg-blush p-4 text-center text-sm font-bold text-oxblood"><span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-oxblood/20 border-t-oxblood align-[-3px]"/>در حال دریافت مشتریان…</div>{Array.from({ length: 5 }).map((_, index) => <div key={index} className="animate-pulse rounded-xl border border-oxblood/10 bg-white p-3"><div className="h-4 w-2/5 rounded bg-oxblood/10"/><div className="mt-3 h-3 w-3/5 rounded bg-oxblood/10"/><div className="mt-3 h-3 w-1/3 rounded bg-oxblood/10"/></div>)}</div>}
          {!loading && failed && <button type="button" onClick={() => void loadCustomers()} className="w-full rounded-lg bg-blush p-4 text-sm font-bold text-oxblood">دریافت مشتریان ناموفق بود؛ برای تلاش مجدد بزنید.</button>}
          {!loading && !failed && !visible.length && <p className="rounded-lg bg-blush p-4 text-center text-sm text-oxblood-dark/55">مشتری‌ای برای نمایش نیست.</p>}
          {!loading && !failed && visible.map((customer) => { const number = customer.mobile || customer.phone || ""; return <article key={customer.id} className="mb-2 rounded-lg border border-oxblood/10 p-3"><b>{customer.name}</b><small className="mt-1 block text-oxblood-dark/55">{customer.group || "بدون گروه"}</small>{number ? <a href={`tel:${phone(number)}`} dir="ltr" className="mt-2 inline-flex items-center gap-1 text-oxblood"><Phone size={14}/>{number}</a> : <small className="mt-2 block text-oxblood-dark/45">شماره‌ای ثبت نشده</small>}</article>; })}
        </div>
        <footer className="border-t p-3"><Link href="/customers" className="text-sm font-bold text-oxblood">مشاهدهٔ کامل مشتریان ←</Link></footer>
      </aside>
    </div>}
  </>;
}
