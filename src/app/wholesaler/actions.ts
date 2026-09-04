"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {dictForLocale, getActionLocale} from "@/i18n";
import { fmt } from "@/i18n/utils";

const productSchema = z.object({
  name: z.string().min(2, "name"),
  sku: z.string().min(1, "sku"),
  description: z.string().optional().default(""),
  categoryId: z.string().optional(),
  imageUrl: z.string().optional(),
  publicPrice: z.coerce.number().min(0),
  moq: z.coerce.number().int().min(1).default(1),
  stock: z.coerce.number().int().min(0).default(0),
  sellingMode: z.enum(["PUBLIC", "CUSTOMER_ONLY", "BOTH"]),
});

export type ProductFormState = { error?: string } | undefined;

/** 新增商品（含主仓库库存） */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    publicPrice: formData.get("publicPrice") || 0,
    moq: formData.get("moq") || 1,
    stock: formData.get("stock") || 0,
    sellingMode: formData.get("sellingMode") || "BOTH",
  });
  if (!parsed.success) {
    const code = parsed.error.errors[0]?.message;
    return { error: code === "name" ? t.productForm.errName : t.productForm.errSku };
  }

  const { name, sku, description, categoryId, imageUrl, publicPrice, moq, stock, sellingMode } =
    parsed.data;

  const dup = await db.product.findUnique({
    where: { wholesalerId_sku: { wholesalerId, sku: sku.trim() } },
  });
  if (dup) return { error: fmt(t.productForm.errSkuExists, { sku }) };

  try {
    const product = await db.product.create({
      data: {
        wholesalerId,
        categoryId: categoryId || null,
        name,
        description: description || null,
        sku: sku.trim(),
        images: JSON.stringify(imageUrl ? [imageUrl] : []),
        sellingMode,
        publicPrice,
        moq,
      },
    });

    // 主仓库库存（取第一个仓库，没有则创建默认仓库）
    const warehouse = await db.warehouse.findFirst({
      where: { wholesalerId },
      orderBy: { createdAt: "asc" },
    });
    const targetWarehouse =
      warehouse ??
      (await db.warehouse.create({
        data: {
          wholesalerId,
          name: "Main Warehouse",
        },
      }));

    await db.inventory.create({
      data: {
        productId: product.id,
        warehouseId: targetWarehouse.id,
        stock,
      },
    });
  } catch (e) {
    console.error("create product error", e);
    return { error: t.productForm.errCreate };
  }

  revalidatePath("/wholesaler/products");
  redirect("/wholesaler/products");
}

/** 更新商品 */
export async function updateProductAction(
  productId: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || product.wholesalerId !== wholesalerId)
    return { error: t.productForm.errNotFound };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    publicPrice: formData.get("publicPrice") || 0,
    moq: formData.get("moq") || 1,
    stock: formData.get("stock") || 0,
    sellingMode: formData.get("sellingMode") || "BOTH",
  });
  if (!parsed.success) {
    const code = parsed.error.errors[0]?.message;
    return { error: code === "name" ? t.productForm.errName : t.productForm.errSku };
  }

  const { name, sku, description, categoryId, imageUrl, publicPrice, moq, stock, sellingMode } =
    parsed.data;

  const dup = await db.product.findFirst({
    where: { wholesalerId, sku: sku.trim(), id: { not: productId } },
  });
  if (dup) return { error: fmt(t.productForm.errSkuExists, { sku }) };

  await db.product.update({
    where: { id: productId },
    data: {
      name,
      sku: sku.trim(),
      description: description || null,
      categoryId: categoryId || null,
      images: JSON.stringify(imageUrl ? [imageUrl] : []),
      sellingMode,
      publicPrice,
      moq,
    },
  });

  // 更新主仓库库存
  const inventory = await db.inventory.findFirst({
    where: { productId },
    orderBy: { updatedAt: "desc" },
  });
  if (inventory) {
    await db.inventory.update({
      where: { id: inventory.id },
      data: { stock },
    });
  }

  revalidatePath("/wholesaler/products");
  revalidatePath(`/wholesaler/products/${productId}`);
  return undefined;
}

/** 快速更新库存（列表页） */
export async function updateStockAction(
  productId: string,
  stock: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || product.wholesalerId !== wholesalerId)
    return { ok: false, error: t.productForm.errNotFound };

  const inventory = await db.inventory.findFirst({
    where: { productId },
    orderBy: { updatedAt: "desc" },
  });
  if (!inventory) return { ok: false, error: t.productForm.errNotFound };

  await db.inventory.update({
    where: { id: inventory.id },
    data: { stock: Math.max(0, Math.floor(stock)) },
  });
  revalidatePath("/wholesaler/products");
  return { ok: true };
}

/** 批量导入 CSV（PRD 20 节：第一版优先 CSV） */
export async function importProductsAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: t.wsProducts.csvErrNoFile };

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: t.wsProducts.csvErrFormat };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const nameIdx = idx("name");
  const skuIdx = idx("sku");
  if (nameIdx === -1 || skuIdx === -1)
    return { error: t.wsProducts.csvErrColumns };

  const priceIdx = idx("price") >= 0 ? idx("price") : idx("publicprice");
  const moqIdx = idx("moq");
  const stockIdx = idx("stock");
  const imgIdx = idx("imageurl") >= 0 ? idx("imageurl") : idx("image");
  const modeIdx = idx("sellingmode");
  const descIdx = idx("description");

  const warehouse =
    (await db.warehouse.findFirst({
      where: { wholesalerId },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.warehouse.create({
      data: { wholesalerId, name: "Main Warehouse" },
    }));

  let created = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const name = row[nameIdx]?.trim();
    const sku = row[skuIdx]?.trim();
    if (!name || !sku) {
      skipped++;
      continue;
    }

    const dup = await db.product.findUnique({
      where: { wholesalerId_sku: { wholesalerId, sku } },
    });
    if (dup) {
      skipped++;
      continue;
    }

    const price = priceIdx >= 0 ? parseFloat(row[priceIdx]) : 0;
    const moq = moqIdx >= 0 ? parseInt(row[moqIdx]) || 1 : 1;
    const stock = stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0;
    const imageUrl = imgIdx >= 0 ? row[imgIdx]?.trim() : "";
    const rawMode = modeIdx >= 0 ? row[modeIdx]?.trim().toUpperCase() : "";
    const sellingMode =
      rawMode === "PUBLIC" || rawMode === "CUSTOMER_ONLY" || rawMode === "BOTH"
        ? rawMode
        : "BOTH";
    const description = descIdx >= 0 ? row[descIdx]?.trim() : "";

    const product = await db.product.create({
      data: {
        wholesalerId,
        name,
        sku,
        description: description || null,
        images: JSON.stringify(imageUrl ? [imageUrl] : []),
        sellingMode,
        publicPrice: Number.isFinite(price) && price > 0 ? price : null,
        moq,
      },
    });
    await db.inventory.create({
      data: { productId: product.id, warehouseId: warehouse.id, stock },
    });
    created++;
  }

  if (created === 0) return { error: t.wsProducts.csvErrEmpty };

  revalidatePath("/wholesaler/products");
  return undefined;
}

/** 删除商品：无订单/客户价引用 → 物理删除；被引用 → 软删除（active=false，历史保留） */
export async function deleteProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const product = await db.product.findFirst({
    where: { id: productId, wholesalerId },
  });
  if (!product) return { ok: false, error: t.wsProducts.deleteNotFound ?? "Not found" };

  const [refOrders, refPrices] = await Promise.all([
    db.orderItem.count({ where: { productId } }),
    db.customerPrice.count({ where: { productId } }),
  ]);

  if (refOrders > 0 || refPrices > 0) {
    // 被业务引用：停用并隐藏（不破坏订单/报价历史）
    await db.product.update({
      where: { id: productId },
      data: { active: false },
    });
  } else {
    await db.inventory.deleteMany({ where: { productId } });
    await db.product.delete({ where: { id: productId } });
  }

  revalidatePath("/wholesaler/products");
  return { ok: true };
}

/** 极简 CSV 解析（支持双引号包裹字段） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}
