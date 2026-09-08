export type MobileServiceRecord = { id: number; customerId?: number; customerName: string; phone: string; address: string };
export type MobileServiceCustomer = { id: number; name: string; mobile: string; phone: string; address: string; recordCount: number };

const digits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/\D/g, "");

export function mobileServiceCustomers(records: MobileServiceRecord[]): MobileServiceCustomer[] {
  const customers = new Map<string, MobileServiceCustomer>();
  for (const record of records) {
    const key = String(record.customerId || digits(record.phone) || record.customerName);
    const current = customers.get(key);
    customers.set(key, current ? { ...current, recordCount: current.recordCount + 1 } : { id: record.customerId || record.id, name: record.customerName, mobile: record.phone, phone: record.phone, address: record.address, recordCount: 1 });
  }
  return [...customers.values()];
}

export function findMobileServiceCustomers(records: MobileServiceRecord[], query: string) {
  const normalized = query.trim(); const number = digits(normalized);
  return mobileServiceCustomers(records).filter((customer) => customer.name.includes(normalized) || (!!number && digits(customer.phone).includes(number))).slice(0, 8);
}
