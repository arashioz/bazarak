import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const source = JSON.parse(await fs.readFile(path.join(process.cwd(), "app", "data", "mobile-services.json"), "utf8"));
const trim = (value) => String(value ?? "").trim();
const digits = (value) => trim(value).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const uri = process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";
const client = new MongoClient(uri);
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB || "bazarek").collection("appState");
  const stored = await collection.findOne({ _id: "primary" });
  if (!stored) throw new Error("MongoDB has not been initialized. Start the application once before seeding.");
  const currentCustomers = Array.isArray(stored.customers) ? stored.customers : [];
  const additions = [];
  const findCustomer = (name, phone) => [...currentCustomers, ...additions].find((customer) => customer.name === name || (digits(phone).length >= 8 && [customer.mobile, customer.phone].some((value) => digits(value) === digits(phone))));
  for (const item of source.customers || []) if (!findCustomer(item.name, item.phone)) additions.push({ id: 4_000_000_000 + additions.length + 1, name: item.name, mobile: item.phone, phone: "", address: item.address, group: "خدمات سیار", description: "", active: true, followUps: [], sourceFile: item.sourceFile, sourceSheet: item.sourceSheet, sourceRow: item.sourceRow });
  const records = (source.mobileServices?.records || []).map((record, index) => { const customer = findCustomer(record.customerName, record.phone); return { ...record, id: 3_000_000_000 + index + 1, customerId: customer?.id }; });
  await collection.updateOne({ _id: "primary" }, { $set: { customers: [...currentCustomers, ...additions], mobileServices: { records, serviceTypes: source.mobileServices?.serviceTypes || [], operators: source.mobileServices?.operators || [] }, updatedAt: new Date() } });
  console.log(JSON.stringify({ servicesImported: records.length, customersAdded: additions.length }, null, 2));
} finally { await client.close(); }
