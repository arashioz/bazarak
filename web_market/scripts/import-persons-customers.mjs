import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const root = process.cwd();
const publicDirectory = path.join(root, "public");
const sourceFile = (await fs.readdir(publicDirectory)).find((name) => name.includes("لیست اشخاص") && /\.xlsx$/i.test(name));
if (!sourceFile) throw new Error("Persons workbook was not found in public/.");

const trim = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const latinDigits = (value) => trim(value).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const phoneNumbers = (value) => latinDigits(value).match(/(?:0?9\d{9}|0?\d{8,10})/g) || [];
const asNumber = (value) => Number(latinDigits(value).replace(/,/g, "")) || 0;
const asActive = (value) => /^(1|true|فعال|بله)$/i.test(latinDigits(value));
const value = (row, key) => row[key] ?? row[key.replace(/ي/g, "ی").replace(/ك/g, "ک")] ?? "";

const workbook = XLSX.readFile(path.join(publicDirectory, sourceFile));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const importedCustomers = rows.flatMap((row, index) => {
  const name = trim(value(row, "نام شخص"));
  const personCode = asNumber(value(row, "كد شخص"));
  if (!name) return [];
  const mobileValue = latinDigits(value(row, "موبايل"));
  const phoneValue = latinDigits(value(row, "تلفن"));
  const mobile = phoneNumbers(mobileValue).find((number) => /^09\d{9}$/.test(number)) || mobileValue;
  const phone = phoneNumbers(phoneValue).join("، ") || phoneValue;
  return [{
    id: 1_000_000_000 + (personCode || index + 1),
    personCode,
    name,
    group: trim(value(row, "گروه شخص")) || "اشخاص",
    sourceFile,
    sourceSheet: workbook.SheetNames[0],
    sourceRow: index + 2,
    mobile,
    phone,
    fax: latinDigits(value(row, "فاکس")),
    address: trim(value(row, "آدرس")),
    description: trim(value(row, "توضيحات")),
    active: asActive(value(row, "فعال")),
    paymentMethod: trim(value(row, "نحوه پرداخت")),
    creditAmount: asNumber(value(row, "مبلغ اعتبار")),
    settlementDays: asNumber(value(row, "حداکثر زمان تسويه(روز)")),
    profession: trim(value(row, "صنف")),
    economicOrNationalId: trim(value(row, "شماره اقتصادي / شناسه ملي")),
    registrationOrNationalCode: trim(value(row, "شماره ثبت / کد ملي")),
    birthDate: trim(value(row, "تاريخ تولد")),
    marriageDate: trim(value(row, "تاريخ ازدواج")),
    followUps: [],
  }];
});

const uri = process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";
const client = new MongoClient(uri);
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB || "bazarek").collection("appState");
  const stored = await collection.findOne({ _id: "primary" });
  if (!stored) throw new Error("MongoDB has not been seeded yet; run the migration first.");
  const oldCustomers = Array.isArray(stored.customers) ? stored.customers : [];
  const retainedCustomers = oldCustomers.filter((customer) => customer.sourceFile !== sourceFile);
  const customerSettings = stored.customerSettings || { categories: [], assignments: {} };
  await collection.updateOne({ _id: "primary" }, { $set: {
    customers: [...retainedCustomers, ...importedCustomers],
    customerSettings: { ...customerSettings },
    updatedAt: new Date(),
  } });
  console.log(JSON.stringify({ sourceFile, imported: importedCustomers.length, active: importedCustomers.filter((customer) => customer.active).length, destination: "MongoDB" }, null, 2));
} finally {
  await client.close();
}
