/**
 * 数据与内容智能标准化（后台静默运行）
 * - 单位写法统一：500毫升/0.5L → 500ml；1箱24瓶 → 24瓶/箱
 * - 价格/数字格式统一（保留 2 位小数展示）
 * - 商品名称文本相似度（商家内部疑似查重）
 * - 异常检测：价格异常 / 必填缺失 / 条码格式
 * 原则：不修改原始输入语义，仅统一存储与展示格式；只提示、不阻断、不做一键按钮。
 */

/** 单位/容量归一：500毫升|500 ml|500ml|0.5L → 500ml */
const UNIT_PATTERNS: [RegExp, string][] = [
  [/毫升/g, "ml"],
  [/\b0\.5\s*l\b/gi, "500ml"],
  [/\b0\.25\s*l\b/gi, "250ml"],
  [/\b1\s*l\b/gi, "1000ml"],
  [/\b(\d+(?:\.\d+)?)\s*ml\b/gi, "$1ml"],
  [/\b(\d+(?:\.\d+)?)\s*l\b/gi, "1000ml"],
];

/** 归一化商品描述/箱规文本（eg "24瓶/箱" 保持，容量统一为 ml） */
export function normalizeSpecText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  for (const [re, to] of UNIT_PATTERNS) s = s.replace(re, to);
  return s;
}

/** 归一化条码（仅保留数字，最长 14 位；空返回 null） */
export function normalizeBarcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "").slice(0, 14);
  return digits.length >= 8 ? digits : null;
}

/** 数字价格规范化（2 位小数；负值/非数字返回 null） */
export function normalizePrice(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v) || v < 0) return null;
  return Math.round(v * 100) / 100;
}

export interface ProdTextFields {
  name?: string | null;
  description?: string | null;
  boxSize?: string | null;
  barcode?: string | null;
}

/** 创建/更新时统一执行（后台静默）：容量单位统一 + 条码清洗 */
export function normalizeProductFields(f: ProdTextFields): ProdTextFields {
  return {
    name: f.name?.trim() || null,
    description: normalizeSpecText(f.description),
    boxSize: normalizeSpecText(f.boxSize),
    barcode: normalizeBarcode(f.barcode),
  };
}

/* ---------------- 文本相似度（疑似重复提示，仅同商家内） ---------------- */

/** 归一化名称用于比较：小写、去标点与空格、数字归一化(500ml/0.5L) */
export function fuzzyKey(name: string): string {
  return normalizeSpecText(name.toLowerCase().replace(/[^\p{L}\p{N}\s%]/gu, "")) ?? "";
}

/** 二元组 Dice 相似度 [0..1] */
export function similarity(a: string, b: string): number {
  const ka = fuzzyKey(a);
  const kb = fuzzyKey(b);
  if (!ka.length || !kb.length) return 0;
  if (ka === kb) return 1;
  const pairs = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = pairs(ka);
  const B = pairs(kb);
  let inter = 0;
  for (const p of A) if (B.has(p)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** 条码完全相同 或 名称相似度 ≥0.85 → 疑似重复 */
export function isLikelyDuplicate(
  name: string,
  barcode: string | null | undefined,
  existing: { name: string; barcode?: string | null },
): boolean {
  if (barcode && existing.barcode && barcode === existing.barcode) return true;
  return similarity(name, existing.name) >= 0.85;
}

/* ---------------- 异常检测（行内 ⚠ 提示，不阻断） ---------------- */

export interface ProductIssue {
  code: string;
  text: string;
}

const BARCODE_RE = /^\d{8,14}$/;

export function detectProductIssues(input: {
  name?: string | null;
  publicPrice?: number | null;
  moq?: number | null;
  barcode?: string | null;
  boxSize?: string | null;
  peerPrices?: number[];
}): ProductIssue[] {
  const issues: ProductIssue[] = [];
  if (!input.name || input.name.trim().length < 2)
    issues.push({ code: "missing", text: "必填字段缺失：请填写商品名称" });
  if (input.barcode && !BARCODE_RE.test(input.barcode))
    issues.push({ code: "barcode", text: "条形码格式异常（应为 8–14 位数字）" });
  const p = input.publicPrice;
  const peers = (input.peerPrices ?? []).filter((x) => x != null && x > 0);
  if (p != null && p > 0 && peers.length >= 3) {
    const sorted = [...peers].sort((x, y) => x - y);
    const mid = sorted[Math.floor(sorted.length / 2)];
    if (mid > 0 && (p > mid * 10 || p < mid / 10))
      issues.push({ code: "price", text: "价格偏离同类商品中位数较大，请核对" });
  }
  if (input.moq != null && input.moq < 1)
    issues.push({ code: "moq", text: "起订量需 ≥1" });
  return issues;
}
