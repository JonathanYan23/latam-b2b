import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Latam B2B…");
  const baseOnly = process.env.SEED_MODE === "base";
  if (baseOnly) console.log("   SEED_MODE=base — 仅基础字典 + Admin（不建演示数据）");

  // ---------- 地域：多米尼加（首个市场，PRD 33-35 节：国家不写死） ----------
  const doCountry = await db.country.upsert({
    where: { code: "DO" },
    update: {},
    create: {
      code: "DO",
      name: "Dominican Republic",
      nameEs: "República Dominicana",
      currency: "DOP",
    },
  });

  const paCountry = await db.country.upsert({
    where: { code: "PA" },
    update: {},
    create: {
      code: "PA",
      name: "Panama",
      nameEs: "Panamá",
      currency: "PAB",
    },
  });

  await db.country.upsert({
    where: { code: "CO" },
    update: {},
    create: { code: "CO", name: "Colombia", nameEs: "Colombia", currency: "COP" },
  });

  // ---------- 拉美主要市场扩展（注册时选择国家 → 自动带该国货币） ----------
  const latamCountries: Array<{
    code: string;
    name: string;
    nameEs: string;
    currency: string;
  }> = [
    { code: "MX", name: "Mexico", nameEs: "México", currency: "MXN" },
    { code: "BR", name: "Brazil", nameEs: "Brasil", currency: "BRL" },
    { code: "AR", name: "Argentina", nameEs: "Argentina", currency: "ARS" },
    { code: "CL", name: "Chile", nameEs: "Chile", currency: "CLP" },
    { code: "PE", name: "Peru", nameEs: "Perú", currency: "PEN" },
    { code: "EC", name: "Ecuador", nameEs: "Ecuador", currency: "USD" },
    { code: "VE", name: "Venezuela", nameEs: "Venezuela", currency: "VES" },
    { code: "CR", name: "Costa Rica", nameEs: "Costa Rica", currency: "CRC" },
    { code: "GT", name: "Guatemala", nameEs: "Guatemala", currency: "GTQ" },
    { code: "UY", name: "Uruguay", nameEs: "Uruguay", currency: "UYU" },
    { code: "PY", name: "Paraguay", nameEs: "Paraguay", currency: "PYG" },
    { code: "BO", name: "Bolivia", nameEs: "Bolivia", currency: "BOB" },
  ];
  for (const c of latamCountries) {
    await db.country.upsert({
      where: { code: c.code },
      update: { name: c.name, nameEs: c.nameEs, currency: c.currency },
      create: c,
    });
  }

  const doRegion = await db.region.upsert({
    where: { id: "seed-do-region" },
    update: {},
    create: {
      id: "seed-do-region",
      countryId: doCountry.id,
      name: "Distrito Nacional",
      nameEs: "Distrito Nacional",
    },
  });

  const santoDomingo = await db.city.upsert({
    where: { id: "seed-do-sd" },
    update: {},
    create: {
      id: "seed-do-sd",
      regionId: doRegion.id,
      name: "Santo Domingo",
      nameEs: "Santo Domingo",
    },
  });

  const panamaCity = await db.city.upsert({
    where: { id: "seed-pa-city" },
    update: {},
    create: {
      id: "seed-pa-city",
      regionId: (
        await db.region.upsert({
          where: { id: "seed-pa-region" },
          update: {},
          create: {
            id: "seed-pa-region",
            countryId: paCountry.id,
            name: "Panamá Province",
            nameEs: "Provincia de Panamá",
          },
        })
      ).id,
      name: "Panama City",
      nameEs: "Ciudad de Panamá",
    },
  });

  // ---------- 分类（PRD 31 节示例品类） ----------
  const cats: Record<string, string> = {};
  for (const [name, slug, nameEs, nameZh] of [
    ["Electronics", "electronics", "Electrónica", "电子"],
    ["Home & Living", "home-living", "Hogar", "家居生活"],
    ["Beauty", "beauty", "Belleza", "美容个护"],
    ["Toys", "toys", "Juguetes", "玩具"],
    ["Fashion", "fashion", "Moda", "服装时尚"],
    ["Sports & Outdoors", "sports", "Deportes", "运动户外"],
    ["Automotive", "automotive", "Automotriz", "汽车用品"],
    ["Food & Beverage", "food", "Alimentos", "食品饮料"],
    ["Office & School", "office", "Oficina", "办公文具"],
    ["Baby & Kids", "baby", "Bebé", "母婴用品"],
    ["General Merchandise", "general", "Mercancía General", "日用百货"],
  ] as const) {
    const c = await db.category.upsert({
      where: { slug },
      update: { nameEs, nameZh },
      create: { name, slug, nameEs, nameZh },
    });
    cats[slug] = c.id;
  }

  // ---------- 平台管理员（生产首装必需：注册入口不开放 ADMIN） ----------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@latam.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (baseOnly ? "" : "admin123");
  if (baseOnly && !process.env.SEED_ADMIN_PASSWORD) {
    console.warn("   ⚠ SEED_MODE=base 但未设 SEED_ADMIN_PASSWORD，跳过 Admin 创建。");
  } else {
    const admin = await db.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: "Platform Admin",
        passwordHash: hashPassword(adminPassword),
        role: UserRole.ADMIN,
      },
    });
    if (baseOnly) console.log(`   Admin 就绪: ${adminEmail}（密码来自 SEED_ADMIN_PASSWORD）`);
  }

  // ============ 演示数据（SEED_MODE=base 时跳过） ============
  if (!baseOnly) {
  // 批发商：Caribbean Wholesale（圣多明各）
  const wsBusiness = await db.business.upsert({
    where: { id: "seed-ws-business" },
    update: {},
    create: {
      id: "seed-ws-business",
      legalName: "Caribbean Wholesale SRL",
      tradeName: "Caribbean Wholesale",
      taxId: "RNC-131234567",
      cityId: santoDomingo.id,
      countryId: doCountry.id,
      phone: "+1 809 555 0142",
    },
  });

  const ws = await db.wholesaler.upsert({
    where: { id: "seed-ws" },
    update: {},
    create: { id: "seed-ws", businessId: wsBusiness.id },
  });

  await db.user.upsert({
    where: { email: "wholesale@latam.com" },
    update: { currency: doCountry.currency },
    create: {
      email: "wholesale@latam.com",
      name: "Carlos Mendez",
      passwordHash: hashPassword("wholesale123"),
      role: UserRole.WHOLESALER,
      currency: doCountry.currency,
      wholesalerId: ws.id,
    },
  });

  // 零售商：Mi Tienda SRL（巴拿马城）
  const rtBusiness = await db.business.upsert({
    where: { id: "seed-rt-business" },
    update: {},
    create: {
      id: "seed-rt-business",
      legalName: "Mi Tienda SRL",
      tradeName: "Mi Tienda",
      taxId: "RUC-8-123-456",
      cityId: panamaCity.id,
      countryId: paCountry.id,
      phone: "+507 6 555 0198",
    },
  });

  const rt = await db.retailer.upsert({
    where: { id: "seed-rt" },
    update: {},
    create: { id: "seed-rt", businessId: rtBusiness.id },
  });

  await db.user.upsert({
    where: { email: "retailer@latam.com" },
    update: { currency: paCountry.currency },
    create: {
      email: "retailer@latam.com",
      name: "Maria Rodriguez",
      passwordHash: hashPassword("retailer123"),
      role: UserRole.RETAILER,
      currency: paCountry.currency,
      retailerId: rt.id,
    },
  });

  // 仓库
  const wh = await db.warehouse.upsert({
    where: { id: "seed-wh" },
    update: {},
    create: {
      id: "seed-wh",
      wholesalerId: ws.id,
      name: "Main Warehouse — Santo Domingo",
      cityId: santoDomingo.id,
    },
  });

  // 商品（公开 + 客户价演示）
  const products = [
    {
      key: "seed-p1",
      name: "Wireless Earbuds Pro",
      sku: "ELEC-EAR-001",
      cat: "electronics",
      price: 24.5,
      moq: 10,
      stock: 480,
      img: "/images/earbuds.svg",
      desc: "Bluetooth 5.3 wireless earbuds with charging case. Retail-ready packaging.",
      kw: "earbuds,wireless,bluetooth,audifonos,auriculares,无线耳机,耳机,蓝牙",
    },
    {
      key: "seed-p2",
      name: "Stainless Water Bottle 750ml",
      sku: "HOME-BOT-002",
      cat: "home-living",
      price: 8.2,
      moq: 24,
      stock: 1200,
      img: "/images/bottle.svg",
      desc: "Double-wall insulated bottle. 6 colors available.",
      kw: "bottle,water,thermo,stainless,insulated,termo,水瓶,保温杯,水壶",
    },
    {
      key: "seed-p3",
      name: "LED Strip Light 5m",
      sku: "ELEC-LED-003",
      cat: "electronics",
      price: 12.9,
      moq: 20,
      stock: 350,
      img: "/images/led.svg",
      desc: "RGB smart LED strip with app control and remote.",
      kw: "led,strip,light,lighting,tira,luces,灯带,氛围灯,灯条",
    },
    {
      key: "seed-p4",
      name: "Ceramic Mug Set (4 pcs)",
      sku: "HOME-MUG-004",
      cat: "home-living",
      price: 14.0,
      moq: 12,
      stock: 0,
      img: "/images/mug.svg",
      desc: "Matte finish ceramic mug set, dishwasher safe.",
      kw: "mug,cup,ceramic,taza,tazas,马克杯,杯子,咖啡杯",
    },
    {
      key: "seed-p5",
      name: "Kids Building Blocks 300pcs",
      sku: "TOYS-BLK-005",
      cat: "toys",
      price: 16.75,
      moq: 8,
      stock: 640,
      img: "/images/blocks.svg",
      desc: "Educational building blocks set, non-toxic ABS plastic.",
      kw: "blocks,toys,building,kids,constructor,积木,玩具,拼插",
    },
  ];

  for (const p of products) {
    await db.product.upsert({
      where: { id: p.key },
      update: { name: p.name, keywords: p.kw },
      create: {
        id: p.key,
        wholesalerId: ws.id,
        categoryId: cats[p.cat],
        name: p.name,
        description: p.desc,
        keywords: p.kw,
        sku: p.sku,
        images: JSON.stringify([p.img]),
        sellingMode: "BOTH",
        publicPrice: p.price,
        moq: p.moq,
      },
    });
    await db.inventory.upsert({
      where: { id: `${p.key}-inv` },
      update: { stock: p.stock },
      create: {
        id: `${p.key}-inv`,
        productId: p.key,
        warehouseId: wh.id,
        stock: p.stock,
        lowStockAt: 20,
      },
    });
  }

  // 客户关系：Mi Tienda → Caribbean Wholesale（已批准 + 专属价）
  const rel = await db.customerRelationship.upsert({
    where: { id: "seed-rel-1" },
    update: {},
    create: {
      id: "seed-rel-1",
      wholesalerId: ws.id,
      retailerId: rt.id,
      status: "APPROVED",
      tier: "STANDARD",
      paymentTerms: "NET30",
      creditLimit: 5000,
      requestedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  // 专属价示例：Wireless Earbuds Pro 公开 $24.50 → 客户 $21.00
  await db.customerPrice.upsert({
    where: { id: "seed-cp-1" },
    update: {},
    create: {
      id: "seed-cp-1",
      productId: "seed-p1",
      relationshipId: rel.id,
      price: 21.0,
      moq: 10,
    },
  });

  }

  console.log("✅ Seed complete.");
  if (baseOnly) {
    console.log("   运行模式: base（基础字典 + Admin）");
  } else {
    console.log("   Demo accounts:");
    console.log("   - admin@latam.com / admin123");
    console.log("   - wholesale@latam.com / wholesale123");
    console.log("   - retailer@latam.com / retailer123");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
