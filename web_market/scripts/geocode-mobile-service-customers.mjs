import path from "node:path";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const source = process.env.MOBILE_SERVICE_XLSX || path.resolve("public/لیست مشتریان خدمات سیار جامع.xlsx");
const city = process.env.GEOCODE_CITY || "سبزوار، خراسان رضوی، ایران";
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Math.max(1, Number(process.argv[limitIndex + 1]) || 1) : Infinity;
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value) => clean(value).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const keyFor = (name, phone) => digits(phone).length >= 8 ? `phone:${digits(phone)}` : `name:${clean(name)}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const workbook = XLSX.readFile(source);
const addresses = new Map();
for (const sheetName of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
  const headers = (rows[0] || []).map(clean);
  const nameColumn = headers.findIndex((header) => /نام.*(خانوادگی|مشتری|فروشگاه)/.test(header));
  const phoneColumn = headers.findIndex((header) => /تلفن/.test(header));
  const addressColumn = headers.findIndex((header) => /آدرس/.test(header));
  if (nameColumn < 0 || addressColumn < 0) continue;
  for (const row of rows.slice(1)) {
    const name = clean(row[nameColumn]);
    const address = clean(row[addressColumn]);
    if (!name || !address) continue;
    const entry = { name, phone: clean(row[phoneColumn]), address };
    addresses.set(keyFor(entry.name, entry.phone), entry);
  }
}

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek");
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB || "bazarek").collection("appState");
  const state = await collection.findOne({ _id: "primary" });
  if (!state || !Array.isArray(state.customers)) throw new Error("appState.primary with customers is required.");
  let matched = 0, located = 0, failed = 0, skipped = 0, attempted = 0;
  const customers = [];
  for (const customer of state.customers) {
    const sourceAddress = addresses.get(keyFor(customer.name, customer.mobile || customer.phone));
    if (!sourceAddress) { customers.push(customer); continue; }
    matched += 1;
    const next = { ...customer, address: customer.address || sourceAddress.address };
    if (customer.location?.lat && customer.location?.lng && !force) { skipped += 1; customers.push(next); continue; }
    if (attempted >= limit) { customers.push(next); continue; }
    attempted += 1;
    const query = `${sourceAddress.address}، ${city}`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=fa&q=${encodeURIComponent(query)}`, { headers: { "user-agent": "BazarekMap/1.0 (address-geocoding)" } });
      const result = await response.json();
      const point = Array.isArray(result) ? result[0] : null;
      if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) { failed += 1; customers.push(next); continue; }
      located += 1;
      customers.push({ ...next, location: { lat: Number(point.lat), lng: Number(point.lon), source: "nominatim", geocodedAt: new Date().toISOString(), address: sourceAddress.address } });
    } catch { failed += 1; customers.push(next); }
    finally { await pause(1100); }
  }
  if (!dryRun) await collection.updateOne({ _id: "primary" }, { $set: { customers, updatedAt: new Date() } });
  console.log(JSON.stringify({ source, city, spreadsheetAddresses: addresses.size, customersMatched: matched, geocoded: located, failed, skipped, dryRun }, null, 2));
} finally {
  await client.close();
}
