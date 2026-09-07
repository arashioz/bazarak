import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

const root = process.cwd();
const publicDirectory = path.join(root, "public");
const databasePath = path.join(root, "app", "data", "database.json");
const sourceFile = (await fs.readdir(publicDirectory)).find((name) => name.includes("لیست مشتریان لوازم شیرینی") && /\.xlsx$/i.test(name));

if (!sourceFile) throw new Error("Confectionery customer workbook was not found in public/.");

const trim = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const latinDigits = (value) => trim(value).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const phoneNumbers = (value) => latinDigits(value).match(/(?:0?9\d{9}|0?\d{8,10})/g) || [];
const cleanedSheetName = (value) => trim(value).replace(/\s+/g, " ");
const excludedSheets = new Set(["جدول خام"]);

const workbook = XLSX.readFile(path.join(publicDirectory, sourceFile));
const importedCustomers = [];

for (const originalSheetName of workbook.SheetNames) {
  const sourceSheet = cleanedSheetName(originalSheetName);
  if (excludedSheets.has(sourceSheet)) continue;
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[originalSheetName], { header: 1, defval: "" });
  const headers = (rows[0] || []).map(trim);
  const nameIndex = headers.findIndex((header) => header.includes("نام مشتری"));
  const addressIndex = headers.findIndex((header) => header.includes("آدرس"));
  if (nameIndex < 0 || addressIndex < 0) continue;

  rows.slice(1).forEach((row, rowOffset) => {
    const name = trim(row[nameIndex]);
    const address = trim(row[addressIndex]);
    if (!name) return;
    const numbers = phoneNumbers(address);
    const mobile = numbers.find((number) => /^09\d{9}$/.test(number)) || "";
    const phone = numbers.filter((number) => number !== mobile).join("، ");
    const followUps = [];
    for (let column = 0; column < headers.length; column += 1) {
      if (!headers[column].includes("تاریخ پیگیری")) continue;
      const date = trim(row[column]);
      const note = trim(row[column + 1]);
      if (date || note) followUps.push({ date, note });
    }
    importedCustomers.push({
      id: 2_000_000_000 + importedCustomers.length + 1,
      name,
      group: `لوازم شیرینی · ${sourceSheet}`,
      sourceSheet,
      sourceRow: rowOffset + 2,
      sourceFile,
      mobile,
      phone,
      address,
      description: "",
      active: true,
      followUps,
    });
  });
}

const database = JSON.parse(await fs.readFile(databasePath, "utf8"));
const previousCustomers = Array.isArray(database.customers) ? database.customers : [];
database.customers = [...previousCustomers.filter((customer) => customer.sourceFile !== sourceFile), ...importedCustomers];
const settings = database.customerSettings || { categories: [], assignments: {} };
const categoryId = "confectionery-supplies";
database.customerSettings = {
  ...settings,
  categories: [...(settings.categories || []).filter((category) => category.id !== categoryId), { id: categoryId, name: "لوازم شیرینی" }],
  assignments: { ...(settings.assignments || {}), ...Object.fromEntries(importedCustomers.map((customer) => [customer.id, categoryId])) },
};
await fs.writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`);
console.log(JSON.stringify({ sourceFile, imported: importedCustomers.length, sheets: [...new Set(importedCustomers.map((customer) => customer.sourceSheet))] }, null, 2));
