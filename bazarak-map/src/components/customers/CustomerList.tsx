"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Phone, Search } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  mobile?: string;
  phone?: string;
  group?: string;
  address?: string;
  active?: boolean;
};

type MapResponse = { customers?: Customer[] };

const CustomerList = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<"mobile-service" | "furniture">("mobile-service");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/map-data", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json() as MapResponse;
        setCustomers(Array.isArray(data.customers) ? data.customers : []);
      })
      .catch(() => setError("دریافت مشتریان از دیتابیس ناموفق بود."))
      .finally(() => setLoading(false));
  }, []);

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const isMobileService = /خدمات\s*سیار/i.test(customer.group || "");
    const matchesTab = activeTab === "mobile-service" ? isMobileService : !isMobileService;
    const haystack = `${customer.name} ${customer.mobile || customer.phone || ""} ${customer.address || ""}`;
    return matchesTab && haystack.includes(query.trim());
  }), [activeTab, customers, query]);

  if (loading) return <div className="grid h-full place-items-center text-oxblood/60"><LoaderCircle className="animate-spin" /></div>;

  return <div className="flex h-full flex-col">
    <div className="flex rounded-xl bg-blush p-1">
      <button className={`flex-1 rounded-lg py-2 text-sm font-bold ${activeTab === "mobile-service" ? "bg-white text-oxblood shadow-sm" : "text-oxblood/55"}`} onClick={() => setActiveTab("mobile-service")}>خدمات سیار</button>
      <button className={`flex-1 rounded-lg py-2 text-sm font-bold ${activeTab === "furniture" ? "bg-white text-oxblood shadow-sm" : "text-oxblood/55"}`} onClick={() => setActiveTab("furniture")}>سایر مشتریان</button>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-oxblood/12 bg-white px-3 py-2"><Search size={16} className="text-oxblood/55"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو…" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div>
    {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : <div className="mt-3 flex-1 space-y-2 overflow-y-auto">{filteredCustomers.map((customer) => <button key={customer.id} type="button" className="w-full rounded-xl border border-oxblood/10 bg-white p-3 text-right transition hover:border-oxblood/30 hover:bg-blush"><b className="block text-sm text-oxblood-dark">{customer.name}</b><span className="mt-1 flex items-center gap-1 text-xs text-oxblood/60"><Phone size={12}/>{customer.mobile || customer.phone || "بدون شماره"}</span><small className="mt-1 block truncate text-oxblood/45">{customer.address || "بدون آدرس"}</small></button>)}{!filteredCustomers.length && <p className="p-3 text-center text-sm text-oxblood/55">مشتری‌ای یافت نشد.</p>}</div>}
  </div>;
};

export default CustomerList;
