import fs from "node:fs";
import XLSX from "xlsx";

const workbook = XLSX.readFile("public/لیست اشخاص.xlsx");
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
const customers = rows.slice(1).flatMap((row) => {
  const id = Number(row[1]);
  const name = String(row[2] || "").trim();
  if (!id || !name) return [];
  const mobile = String(row[6] || "").replace(/\D/g, "");
  const phone = String(row[4] || "").replace(/\D/g, "");
  return [{ id, name, group: String(row[3] || "").trim(), mobile, phone, description: String(row[7] || "").trim(), active: Boolean(row[8]), address: String(row[13] || "").trim() }];
});
fs.writeFileSync("app/data/customers.json", `${JSON.stringify(customers, null, 2)}\n`);
console.log(`${customers.length} customers written`);
