"use client";

import { Phone, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import customers from "../data/customers.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const phone = (value: string) => value.replace(/\D/g, "");

export default function CustomerDrawer() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => { const text = query.trim(); return text ? customers.filter((customer) => `${customer.name} ${customer.group} ${customer.mobile} ${customer.phone}`.includes(text)).slice(0, 100) : customers.slice(0, 100); }, [query]);
  return <Sheet><SheetTrigger render={<Button variant="outline" className="fixed right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-background shadow-lg" />}><Users /> مشتریان</SheetTrigger><SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:w-[420px]"><SheetHeader className="border-b"><SheetTitle>مشتریان</SheetTitle><SheetDescription>{customers.length.toLocaleString("fa-IR")} مخاطب ثبت‌شده</SheetDescription></SheetHeader><div className="border-b p-4"><div className="relative"><Search className="absolute right-3 top-2.5 text-muted-foreground" size={16}/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو نام یا شماره..." className="pr-9"/></div></div><div className="flex-1 overflow-y-auto p-3">{visible.map((customer) => { const number = customer.mobile || customer.phone; return <article key={customer.id} className="mb-2 rounded-lg border border-border p-3"><b>{customer.name}</b><small className="mt-1 block text-muted-foreground">{customer.group || "بدون گروه"}</small>{number ? <a href={`tel:${phone(number)}`} dir="ltr" className="mt-2 inline-flex items-center gap-1 text-primary"><Phone size={14}/>{number}</a> : <small className="mt-2 block text-muted-foreground">شماره‌ای ثبت نشده</small>}</article>; })}</div><div className="border-t p-3"><Link href="/customers" className="text-sm font-medium text-primary">مشاهدهٔ کامل مشتریان ←</Link></div></SheetContent></Sheet>;
}
