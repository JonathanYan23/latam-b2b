const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
async function count(label, fn) {
  try { const n = await fn(); console.log(`${label}: ${n}`); }
  catch (e) { console.log(`${label}: ERR ${String(e.message).split("\n")[0]}`); }
}
async function main() {
  await count("users", () => db.user.count());
  await count("wholesalers", () => db.wholesaler.count());
  await count("retailers", () => db.retailer.count());
  await count("products", () => db.product.count());
  await count("categories", () => db.category.count());
  await count("orders", () => db.order.count());
  await count("invoices", () => db.invoice.count());
  await count("payments", () => db.payment.count());
  await count("customerRelationships", () => db.customerRelationship.count());
}
main().finally(() => db.$disconnect());
