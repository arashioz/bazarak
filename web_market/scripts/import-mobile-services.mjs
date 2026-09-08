import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const publicDirectory = path.join(process.cwd(), "public");
const sourceFiles = (await fs.readdir(publicDirectory)).filter((name) => /لیست.*مشتریان.*خدمات.*سیار/i.test(name) && /\.xlsx$/i.test(name));
const trim = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value) => trim(value).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const number = (value) => Number(String(value ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9.]/g, "")) || 0;
const cell = (row, index) => trim(row[index]);
const findColumn = (headers, matcher) => headers.findIndex((header) => matcher.test(header));
const temporaryFile = path.join("/private/tmp", `mobile-services-${Date.now()}.xlsx`);

const readWorkbook = async (sourceFile) => {
  const fullPath = path.join(publicDirectory, sourceFile);
  try { return XLSX.readFile(fullPath); } catch (error) {
    if (!/password-protected/i.test(String(error.message))) throw error;
    const python = "import sys, msoffcrypto; f=open(sys.argv[1],'rb'); o=msoffcrypto.OfficeFile(f); o.load_key(password=sys.argv[2]); out=open(sys.argv[3],'wb'); o.decrypt(out); out.close()";
    execFileSync("python3", ["-c", python, fullPath, process.env.MOBILE_XLSX_PASSWORD || "7755", temporaryFile], { env: { ...process.env, PYTHONPATH: "/private/tmp/manti_msoffcrypto" } });
    return XLSX.readFile(temporaryFile);
  }
};

const records = [];
const directoryCustomers = [];
for (const sourceFile of sourceFiles) {
  const workbook = await readWorkbook(sourceFile);
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const headers = (rows[0] || []).map(trim);
    const nameIndex = findColumn(headers, /نام.*(خانوادگی|مشتری|فروشگاه)/);
    const phoneIndex = findColumn(headers, /تلفن/);
    const addressIndex = findColumn(headers, /آدرس/);
    const serviceIndexes = headers.map((header, index) => /^نوع خدم/.test(header) ? index : -1).filter((index) => index >= 0);
    const quantityIndex = findColumn(headers, /مقدار.*کالا/);
    const paymentIndex = findColumn(headers, /وضعیت.*پرداخت|وضعیتپرداخت/);
    const operatorIndex = findColumn(headers, /اپراتور/);
    const dateIndex = findColumn(headers, /^تاریخ/);
    if (nameIndex < 0) continue;
    rows.slice(1).forEach((row, index) => {
      const customerName = cell(row, nameIndex);
      if (!customerName || /^؟+$/.test(customerName)) return;
      directoryCustomers.push({ name: customerName, phone: cell(row, phoneIndex), address: cell(row, addressIndex), sourceFile, sourceSheet: sheetName, sourceRow: index + 2 });
      const payment = cell(row, paymentIndex);
      serviceIndexes.forEach((serviceIndex) => { const serviceType = cell(row, serviceIndex); if (!serviceType) return; records.push({ id: 3_000_000_000 + records.length + 1, date: cell(row, serviceIndex === serviceIndexes[0] ? dateIndex : serviceIndex + 1), customerName, phone: cell(row, phoneIndex), address: cell(row, addressIndex), serviceType, quantity: number(row[quantityIndex]), paymentStatus: payment ? (/تسویه شده|تسویه شد/i.test(payment) ? "settled" : "unsettled") : "settled", operator: cell(row, operatorIndex), sourceFile, sourceSheet: sheetName, sourceRow: index + 2 }); });
    });
  }
}
await fs.rm(temporaryFile, { force: true });
if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ files: sourceFiles, servicesParsed: records.length, customersParsed: directoryCustomers.length }, null, 2));
  process.exit(0);
}
const uri = process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";
const client = new MongoClient(uri);
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB || "bazarek").collection("appState");
  const stored = await collection.findOne({ _id: "primary" });
  if (!stored) throw new Error("MongoDB has not been initialized.");
  const customers = Array.isArray(stored.customers) ? stored.customers : [];
  const additions = [];
  const findCustomer = (name, phone) => [...customers, ...additions].find((customer) => customer.name === name || (digits(phone).length >= 8 && [customer.mobile, customer.phone].some((value) => digits(value) === digits(phone))));
  for (const sourceCustomer of directoryCustomers) {
    if (findCustomer(sourceCustomer.name, sourceCustomer.phone)) continue;
    additions.push({ id: 4_000_000_000 + additions.length + 1, name: sourceCustomer.name, mobile: sourceCustomer.phone, phone: "", address: sourceCustomer.address, group: "خدمات سیار", description: "", active: true, followUps: [], sourceFile: sourceCustomer.sourceFile, sourceSheet: sourceCustomer.sourceSheet, sourceRow: sourceCustomer.sourceRow });
  }
  for (const record of records) {
    const existing = findCustomer(record.customerName, record.phone);
    if (existing) record.customerId = existing.id;
    else { const customer = { id: 4_000_000_000 + additions.length + 1, name: record.customerName, mobile: record.phone, phone: "", address: record.address, group: "خدمات سیار", description: "", active: true, followUps: [] }; additions.push(customer); record.customerId = customer.id; }
  }
  const oldMobile = stored.mobileServices || {};
  await collection.updateOne({ _id: "primary" }, { $set: { mobileServices: { records, serviceTypes: [...new Set(records.map((r) => r.serviceType).filter(Boolean))], operators: [...new Set(records.map((r) => r.operator).filter(Boolean))] }, customers: [...customers, ...additions], updatedAt: new Date() } });
  console.log(JSON.stringify({ files: sourceFiles, servicesImported: records.length, customersAdded: additions.length, previousRecords: Array.isArray(oldMobile.records) ? oldMobile.records.length : 0 }, null, 2));
} finally { await client.close(); }
