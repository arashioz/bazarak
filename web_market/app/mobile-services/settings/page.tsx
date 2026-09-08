"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Data = { records: unknown[]; serviceTypes: string[]; operators: string[] };
export default function MobileServicesSettingsPage() {
  const [data, setData] = useState<Data>({ records: [], serviceTypes: [], operators: [] });
  const [service, setService] = useState(""); const [operator, setOperator] = useState("");
  useEffect(() => { fetch("/api/database").then((r) => r.json()).then((db) => setData(db.mobileServices || { records: [], serviceTypes: [], operators: [] })); }, []);
  const save = async (next: Data) => { setData(next); await fetch("/api/database", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "mobileServices", data: next }) }); };
  const add = (event: FormEvent, kind: "service" | "operator") => { event.preventDefault(); const value = (kind === "service" ? service : operator).trim(); if (!value) return; const key = kind === "service" ? "serviceTypes" : "operators"; if (!data[key].includes(value)) void save({ ...data, [key]: [...data[key], value] }); kind === "service" ? setService("") : setOperator(""); };
  const List = ({ title, kind }: { title: string; kind: "serviceTypes" | "operators" }) => <section className="rounded-2xl border border-oxblood/10 bg-white p-5 shadow-sm"><h2 className="font-black">{title}</h2><form onSubmit={(e) => add(e, kind === "serviceTypes" ? "service" : "operator")} className="mt-4 flex gap-2"><input value={kind === "serviceTypes" ? service : operator} onChange={(e) => kind === "serviceTypes" ? setService(e.target.value) : setOperator(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-oxblood/15 p-2"/><button className="rounded-lg bg-oxblood px-4 text-white">افزودن</button></form><div className="mt-4 flex flex-wrap gap-2">{data[kind].map((item) => <span key={item} className="rounded-full bg-blush px-3 py-2 text-sm">{item}<button onClick={() => void save({ ...data, [kind]: data[kind].filter((value) => value !== item) })} className="mr-2 text-oxblood">×</button></span>)}</div></section>;
  return <main className="min-h-screen bg-blush p-5 text-oxblood-dark"><section className="mx-auto max-w-3xl"><header className="flex items-center justify-between"><h1 className="text-2xl font-black text-oxblood">تنظیمات خدمات سیار</h1><Link href="/mobile-services" className="rounded-lg border border-oxblood/20 bg-white px-4 py-2">بازگشت</Link></header><div className="mt-6 grid gap-4 sm:grid-cols-2"><List title="نوع خدمات" kind="serviceTypes"/><List title="اپراتور دستگاه" kind="operators"/></div></section></main>;
}
