// 生成 PostgreSQL 生产 schema：读 schema.prisma（唯一源），
// 仅把 datasource provider 改为 postgresql，输出 schema.postgres.prisma
// 这样模型定义永远只有一份，不会两处漂移。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "prisma", "schema.prisma");
const out = path.join(root, "prisma", "schema.postgres.prisma");

const s = fs.readFileSync(src, "utf8");
const replaced = s.replace(
  'provider = "sqlite"',
  'provider = "postgresql"',
);

if (!replaced.includes('provider = "postgresql"')) {
  console.error("ERROR: could not locate sqlite provider line.");
  process.exit(1);
}

fs.writeFileSync(out, replaced, "utf8");
console.log("generated prisma/schema.postgres.prisma");
