import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const source = path.resolve("public/inventory گزارش.xlsx");
const destination = path.resolve("app/data/inventory.json");
const workbook = XLSX.readFile(source);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

const products = rows.slice(1).flatMap((row) => {
  const id = Number(row[1]);
  const name = String(row[2] || "").trim();
  if (!Number.isSafeInteger(id) || !name) return [];

  return [{
    id,
    name,
    unit: String(row[3] || "").trim() || "عدد",
    stock: Number(row[4]) || 0,
    purchasePrice: Number(row[6]) || 0,
    priceLevels: [9, 11, 13, 15].map((index) => Number(row[index]) || 0),
    updated: String(row[19] || "").trim(),
    active: Boolean(row[20]),
  }];
});

fs.writeFileSync(destination, `${JSON.stringify(products, null, 2)}\n`);
console.log(`${products.length} products written to ${destination}`);
