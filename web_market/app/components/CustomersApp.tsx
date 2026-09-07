"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Download, Phone, Search, Settings2, Upload, Users, X } from "lucide-react";
import * as XLSX from "xlsx";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FollowUp = { date: string; note: string };
type Customer = { id: number; name: string; group: string; mobile: string; phone: string; description: string; active: boolean; address: string; sourceSheet?: string; sourceFile?: string; sourceRow?: number; followUps?: FollowUp[]; personCode?: number; fax?: string; paymentMethod?: string; creditAmount?: number; settlementDays?: number; profession?: string; economicOrNationalId?: string; registrationOrNationalCode?: string; birthDate?: string; marriageDate?: string };
type CustomerNote = { id: number; text: string; updatedAt: string };
type CustomerSettings = { categories: { id: string; name: string }[]; assignments: Record<number, string> };

const digits = (value: string) => value.replace(/\D/g, "");
const callNumber = (customer: Customer) => customer.mobile || customer.phone;
const customerColumns = ["نام", "گروه", "موبایل", "تلفن", "توضیحات", "فعال", "آدرس"] as const;
const asText = (value: unknown) => String(value ?? "").trim();
const asActive = (value: unknown) => !/^(false|0|خیر|غیرفعال|نه)$/i.test(asText(value));

export default function CustomersApp() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<Record<number, CustomerNote>>({});
  const [selected, setSelected] = useState<Customer | null>(null);
  const [customerSettings, setCustomerSettings] = useState<CustomerSettings>({ categories: [], assignments: {} });
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  useEffect(() => { fetch("/api/database", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((database) => { setCustomers(Array.isArray(database.customers) ? database.customers : []); setNotes(database.customerNotes || {}); setCustomerSettings(database.customerSettings || { categories: [], assignments: {} }); }).catch(() => undefined); }, []);
  const saveCustomerSection = async (section: "customers" | "customerNotes" | "customerSettings", data: unknown) => {
    const response = await fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, data }) });
    if (!response.ok) throw new Error("MongoDB update failed");
  };
  const saveCustomerSettings = (next: CustomerSettings) => { setCustomerSettings(next); void saveCustomerSection("customerSettings", next).catch(() => window.alert("ذخیره دسته‌بندی مشتری در MongoDB ناموفق بود.")); };
  const saveNote = (id: number, text: string) => { const next = { ...notes, [id]: { id, text, updatedAt: new Date().toISOString() } }; setNotes(next); void saveCustomerSection("customerNotes", next).catch(() => window.alert("ذخیره یادداشت مشتری در MongoDB ناموفق بود.")); };
  const list = useMemo(() => { const term = query.trim(); return customers.filter((customer) => (!term || `${customer.name} ${customer.group} ${customer.mobile} ${customer.phone}`.includes(term)) && (!categoryFilter || customerSettings.assignments[customer.id] === categoryFilter)); }, [query, categoryFilter, customerSettings]);
  const toggleSelection = (id: number) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const applyBulkCategory = () => {
    if (!selectedIds.length) return;
    const assignments = { ...customerSettings.assignments };
    selectedIds.forEach((id) => bulkCategory ? assignments[id] = bulkCategory : delete assignments[id]);
    saveCustomerSettings({ ...customerSettings, assignments });
    setSelectedIds([]);
  };
  const exportCustomers = () => {
    const rows = customers.map(({ name, group, mobile, phone, description, active, address }) => ({ "نام": name, "گروه": group, "موبایل": mobile, "تلفن": phone, "توضیحات": description, "فعال": active ? "فعال" : "غیرفعال", "آدرس": address }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...customerColumns] });
    sheet["!cols"] = [22, 18, 16, 16, 36, 10, 48].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "مشتریان");
    XLSX.writeFile(workbook, "مشتریان بازارک.xlsx");
  };
  const importCustomers = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const imported = rows.map((row, index): Customer | null => {
        const name = asText(row["نام"] ?? row["نام مشتری"]);
        if (!name) return null;
        const existing = customers.find((customer) => (asText(row["موبایل"]) && customer.mobile === asText(row["موبایل"])) || customer.name === name);
        return { id: existing?.id ?? Date.now() + index, name, group: asText(row["گروه"]), mobile: asText(row["موبایل"]), phone: asText(row["تلفن"] ?? row["شماره تماس"]), description: asText(row["توضیحات"]), active: asActive(row["فعال"]), address: asText(row["آدرس"]) };
      }).filter((customer): customer is Customer => customer !== null);
      if (!imported.length) throw new Error("empty");
      const next = new Map(customers.map((customer) => [customer.id, customer]));
      imported.forEach((customer) => {
        const existing = customers.find((item) => item.id === customer.id);
        next.set(customer.id, existing ? { ...existing, ...customer, description: customer.description || existing.description, address: customer.address || existing.address, followUps: existing.followUps || [] } : customer);
      });
      const data = [...next.values()];
      await saveCustomerSection("customers", data);
      setCustomers(data);
    } catch { window.alert("ورود اکسل یا ذخیره مشتریان در MongoDB ناموفق بود."); }
  };
  return <main className="min-h-screen bg-blush p-4 text-oxblood-dark sm:p-6"><section className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black text-oxblood"><Users /> مشتریان</h1><p className="mt-1 text-sm opacity-60">{customers.length.toLocaleString("fa-IR")} شخص</p></div><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-oxblood/20 bg-white px-4 py-2 text-sm font-bold text-oxblood"><Upload size={16}/> ورود اکسل<input type="file" accept=".xlsx,.xls" onChange={importCustomers} className="hidden"/></label><button onClick={exportCustomers} className="inline-flex items-center gap-1 rounded-lg border border-oxblood/20 bg-white px-4 py-2 text-sm font-bold text-oxblood"><Download size={16}/> خروجی اکسل</button><button onClick={() => { setBulkMode(!bulkMode); setSelectedIds([]); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${bulkMode ? "bg-oxblood text-white" : "border border-oxblood/20 bg-white text-oxblood"}`}>دسته‌بندی گروهی</button><button onClick={() => setShowSettings(true)} className="rounded-lg border border-oxblood/20 bg-white px-4 py-2 text-sm font-bold text-oxblood"><Settings2 className="inline" size={16}/> تنظیمات دسته</button><Link href="/modir/panel" className="rounded-lg border border-oxblood/20 bg-white px-4 py-2 text-sm font-bold text-oxblood">پنل مدیریت</Link></div></header><div className="mt-5"><div className="relative"><Search className="absolute right-3 top-3 text-oxblood/45" size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو نام، گروه یا شماره تماس" className="w-full rounded-lg border border-oxblood/15 bg-white py-3 pr-10 pl-3"/></div></div>{bulkMode && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-oxblood/10 bg-white p-3 shadow-sm"><b className="text-sm">{selectedIds.length.toLocaleString("fa-IR")} مشتری انتخاب شده</b><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} className="rounded-lg border border-oxblood/15 p-2 text-sm"><option value="">حذف دسته / بدون دسته</option>{customerSettings.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button disabled={!selectedIds.length} onClick={applyBulkCategory} className="rounded-lg bg-oxblood px-3 py-2 text-sm font-bold text-white disabled:opacity-40">اعمال دسته</button><button onClick={() => setSelectedIds(selectedIds.length === list.length ? [] : list.map((customer) => customer.id))} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">{selectedIds.length === list.length ? "لغو انتخاب همه" : "انتخاب همه"}</button></div>}<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((customer) => { const number = callNumber(customer); const category = customerSettings.categories.find((item) => item.id === customerSettings.assignments[customer.id]); return <article key={customer.id} className="rounded-lg border border-oxblood/10 bg-white p-4 shadow-sm">{bulkMode && <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-oxblood"><input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleSelection(customer.id)} className="h-5 w-5 accent-oxblood"/> انتخاب</label>}<button onClick={() => !bulkMode && setSelected(customer)} className="w-full text-right"><b className="block text-base">{customer.name}</b><small className="mt-1 block opacity-55">{category?.name || customer.group || "بدون گروه"}</small>{number && <strong dir="ltr" className="mt-3 block text-right text-oxblood">{number}</strong>}</button><div className="mt-3 flex gap-2"><a href={number ? `tel:${digits(number)}` : undefined} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold ${number ? "bg-oxblood text-white" : "cursor-not-allowed bg-gray-100 text-gray-400"}`}><Phone size={16}/> تماس</a><button onClick={() => setSelected(customer)} className="rounded-lg border border-oxblood/20 px-3 py-2 text-sm font-bold text-oxblood">ویرایش</button></div></article>; })}</div></section><button type="button" onClick={() => setShowCategoryFilter(true)} className="fixed bottom-5 right-5 z-20 rounded-full bg-oxblood px-5 py-3 text-sm font-bold text-white shadow-lg">{categoryFilter ? "دستهٔ انتخاب‌شده" : "فیلتر دسته‌ها"}</button>{showCategoryFilter && <CustomerCategoryFilter customers={customers} settings={customerSettings} value={categoryFilter} onChange={(value) => { setCategoryFilter(value); setShowCategoryFilter(false); }} onClose={() => setShowCategoryFilter(false)}/>} {showSettings && <CustomerCategorySettings settings={customerSettings} onClose={() => setShowSettings(false)} onSave={saveCustomerSettings}/>} {selected && <CustomerDetail customer={selected} note={notes[selected.id]?.text || ""} categories={customerSettings.categories} categoryId={customerSettings.assignments[selected.id] || ""} onCategory={(categoryId) => { const assignments = { ...customerSettings.assignments }; categoryId ? assignments[selected.id] = categoryId : delete assignments[selected.id]; saveCustomerSettings({ ...customerSettings, assignments }); }} onClose={() => setSelected(null)} onSave={saveNote}/>}</main>;
}

function CustomerCategoryFilter({ customers, settings, value, onChange, onClose }: { customers: Customer[]; settings: CustomerSettings; value: string; onChange: (value: string) => void; onClose: () => void }) {
  const count = (id: string) => customers.filter((customer) => settings.assignments[customer.id] === id).length;
  return <div className="fixed inset-0 z-30 flex justify-end"><button type="button" onClick={onClose} className="absolute inset-0 bg-oxblood-dark/40" aria-label="بستن فیلتر"/><section className="relative h-full w-[88vw] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl"><button type="button" onClick={onClose} className="absolute left-4 top-4 text-oxblood"><X/></button><h2 className="text-xl font-black">فیلتر دسته‌بندی مشتریان</h2><p className="mt-2 text-sm text-oxblood-dark/55">دستهٔ موردنظر را انتخاب کنید.</p><div className="mt-5 space-y-2"><button type="button" onClick={() => onChange("")} className={`flex w-full items-center justify-between rounded-xl border p-3 text-right ${!value ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>همه مشتریان</span><b>{customers.length.toLocaleString("fa-IR")}</b></button>{settings.categories.map((category) => <button type="button" key={category.id} onClick={() => onChange(category.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-right ${value === category.id ? "border-oxblood bg-blush" : "border-oxblood/10"}`}><span>{category.name}</span><b>{count(category.id).toLocaleString("fa-IR")}</b></button>)}</div></section></div>;
}

function CustomerCategorySettings({ settings, onClose, onSave }: { settings: CustomerSettings; onClose: () => void; onSave: (settings: CustomerSettings) => void }) { const [name, setName] = useState(""); return <div className="fixed inset-0 z-20 flex items-end justify-center"><button onClick={onClose} className="absolute inset-0 bg-oxblood/40"/><section className="relative w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl"><button onClick={onClose} className="absolute left-4 top-4"><X/></button><h2 className="text-xl font-black">دسته‌بندی مشتریان</h2><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) { onSave({ ...settings, categories: [...settings.categories, { id: `${Date.now()}`, name: name.trim() }] }); setName(""); } }} className="mt-4 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام دسته جدید" className="flex-1 rounded border p-2"/><button className="rounded bg-oxblood px-4 text-white">افزودن</button></form>{settings.categories.map((category) => <div key={category.id} className="mt-2 flex justify-between rounded border p-2"><span>{category.name}</span><button onClick={() => onSave({ ...settings, categories: settings.categories.filter((item) => item.id !== category.id) })} className="text-oxblood">حذف</button></div>)}</section></div>; }

const jalaliParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { year: value("year"), month: value("month"), day: value("day") };
};
const jalaliDate = (date: Date) => { const { year, month, day } = jalaliParts(date); return `${year}/${month}/${day}`; };
const jalaliToday = () => jalaliDate(new Date());
const shiftDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };

function JalaliDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const cursorParts = jalaliParts(cursor);
  let first = new Date(cursor);
  while (jalaliParts(first).day !== "۰۱") first = shiftDays(first, -1);
  let end = new Date(first);
  while (jalaliParts(shiftDays(end, 1)).month === cursorParts.month) end = shiftDays(end, 1);
  const days = Array.from({ length: Math.round((end.getTime() - first.getTime()) / 86400000) + 1 }, (_, index) => shiftDays(first, index));
  const blanks = (first.getDay() + 1) % 7;
  const monthTitle = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" }).format(cursor);
  return <div className="relative"><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-lg border border-oxblood/15 bg-white p-2 text-sm"><span>{value || jalaliToday()}</span><CalendarDays size={17} className="text-oxblood"/></button>{open && <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-oxblood/15 bg-white p-3 shadow-xl" dir="rtl"><div className="mb-3 flex items-center justify-between"><button type="button" onClick={() => setCursor(shiftDays(cursor, -32))} className="rounded p-1 hover:bg-blush"><ChevronRight size={18}/></button><b className="text-sm">{monthTitle}</b><button type="button" onClick={() => setCursor(shiftDays(cursor, 32))} className="rounded p-1 hover:bg-blush"><ChevronLeft size={18}/></button></div><div className="grid grid-cols-7 text-center text-xs text-oxblood/60">{"ش ی د س چ پ ج".split(" ").map((day) => <span key={day} className="py-1">{day}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: blanks }).map((_, index) => <span key={`blank-${index}`}/>) }{days.map((date) => { const dateValue = jalaliDate(date); const selected = dateValue === value; const today = dateValue === jalaliToday(); return <button type="button" key={date.toISOString()} onClick={() => { onChange(dateValue); setOpen(false); }} className={`h-8 rounded-md text-xs font-bold ${selected ? "bg-oxblood text-white" : today ? "border border-oxblood text-oxblood" : "hover:bg-blush"}`}>{jalaliParts(date).day}</button>; })}</div><button type="button" onClick={() => { onChange(jalaliToday()); setCursor(new Date()); setOpen(false); }} className="mt-3 w-full rounded-lg bg-blush p-2 text-xs font-bold text-oxblood">امروز</button></div>}</div>;
}

function CustomerDetail({ customer, note, categories, categoryId, onCategory, onClose, onSave }: { customer: Customer; note: string; categories: CustomerSettings["categories"]; categoryId: string; onCategory: (id: string) => void; onClose: () => void; onSave: (id: number, text: string) => void }) {
  const [text, setText] = useState(note);
  const [followUps, setFollowUps] = useState(customer.followUps || []);
  const [followUpDate, setFollowUpDate] = useState(jalaliToday);
  const [followUpNote, setFollowUpNote] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const number = callNumber(customer);
  const addFollowUp = async () => {
    if (!followUpNote.trim() || savingFollowUp) return;
    setSavingFollowUp(true);
    try {
      const response = await fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "customerFollowUp", data: { customerId: customer.id, date: followUpDate, note: followUpNote.trim() } }) });
      if (!response.ok) throw new Error("save failed");
      setFollowUps([...followUps, { date: followUpDate, note: followUpNote.trim() }]);
      setFollowUpDate(jalaliToday());
      setFollowUpNote("");
    } catch { window.alert("ذخیره پیگیری در MongoDB ناموفق بود."); } finally { setSavingFollowUp(false); }
  };
  return <div className="fixed inset-0 z-20 flex items-end justify-center"><button onClick={onClose} className="absolute inset-0 bg-oxblood/40"/><section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl"><button onClick={onClose} className="absolute left-4 top-4 text-oxblood"><X/></button><span className="inline-flex rounded-full bg-blush px-3 py-1 text-xs font-bold text-oxblood">{customer.sourceSheet ? `لوازم شیرینی · ${customer.sourceSheet}` : customer.group}</span><h2 className="mt-3 text-xl font-black">{customer.name}</h2>{customer.address && <p className="mt-3 rounded-xl bg-blush p-3 text-sm leading-7 text-oxblood-dark/70">{customer.address}</p>}<div className="mt-3 flex flex-wrap gap-2">{[customer.mobile, customer.phone].filter(Boolean).map((item) => <a key={item} href={`tel:${digits(item)}`} dir="ltr" className="inline-flex items-center gap-2 rounded-lg bg-oxblood px-4 py-2 font-bold text-white"><Phone size={17}/> {item}</a>)}</div><section className="mt-6"><div className="flex items-center justify-between"><h3 className="font-black">سابقهٔ پیگیری</h3><span className="rounded-full bg-blush px-2 py-1 text-xs text-oxblood">{followUps.length.toLocaleString("fa-IR")} پیگیری</span></div><div className="mt-3 rounded-xl border border-oxblood/10 bg-blush p-3"><JalaliDatePicker value={followUpDate} onChange={setFollowUpDate}/><textarea value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} rows={3} placeholder="شرح پیگیری جدید..." className="mt-2 w-full rounded-lg border border-oxblood/15 bg-white p-2 text-sm"/><button type="button" disabled={!followUpNote.trim() || savingFollowUp} onClick={addFollowUp} className="mt-2 w-full rounded-lg bg-oxblood p-2 text-sm font-bold text-white disabled:opacity-40">{savingFollowUp ? "در حال ذخیره..." : "افزودن سابقه پیگیری"}</button></div>{followUps.length > 0 && <div className="mt-3 space-y-3 border-r-2 border-oxblood/15 pr-4">{followUps.map((followUp, index) => <article key={`${followUp.date}-${index}`} className="relative rounded-xl border border-oxblood/10 bg-white p-3 shadow-sm before:absolute before:-right-[22px] before:top-4 before:h-3 before:w-3 before:rounded-full before:bg-oxblood"><b className="text-xs text-oxblood">{followUp.date || "بدون تاریخ"}</b><p className="mt-2 text-sm leading-7 text-oxblood-dark/70">{followUp.note || "بدون شرح"}</p></article>)}</div>}</section><label className="mt-6 block text-sm font-bold">دسته مشتری<select value={categoryId} onChange={(event) => onCategory(event.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="">بدون دسته</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="mt-5 block text-sm font-bold">یادداشت داخلی<textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="مثلاً زمان مناسب تماس یا توضیح سفارش..." className="mt-2 w-full rounded-lg border border-oxblood/15 p-3 font-normal"/></label><button onClick={() => { onSave(customer.id, text.trim()); onClose(); }} className="mt-3 w-full rounded-lg bg-oxblood p-3 font-bold text-white">ذخیره یادداشت</button></section></div>;
}
