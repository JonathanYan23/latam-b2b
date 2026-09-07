/**
 * AI 推理适配层（智能录入 / 语义搜索）
 * ---------------------------------------------------------------
 * 两种后端（任一配置即启用，同一套业务接口）：
 *   1. SiliconFlow 云 API（推荐，免部署）：
 *        SILICONFLOW_API_KEY=sk-...            （https://api.siliconflow.cn）
 *        AI_MODEL / AI_VISION_MODEL / AI_EMBED_MODEL 可覆盖默认模型
 *   2. 自托管 OpenAI 兼容推理服务（Runpod/本地 GPU/自建）：
 *        AI_INFERENCE_URL=https://...  +  AI_TOKEN=...
 *        AI_MODEL / AI_EMBED_MODEL 可覆盖
 *
 * 本层是对外唯一依赖点：未配置任何后端时全部优雅降级——
 *   aiExtractProduct / aiVisionExtract -> null（界面回退到手动填写）
 *   aiEmbedding                        -> null（搜索回退到关键词 contains）
 * 界面文案只出现「智能识别 / 自动填写 / 批量上架 / 智能搜索」，
 * 不出现 OCR / 向量 / Embedding 等技术词。
 */

export type ProductFields = {
  name?: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  publicPrice?: number;
  moq?: number;
  boxSize?: string;
  keywords?: string;
};

const SF_BASE = "https://api.siliconflow.cn/v1";
const SF_KEY = process.env.SILICONFLOW_API_KEY ?? "";
const INFERENCE_URL = process.env.AI_INFERENCE_URL ?? "";
const AI_TOKEN = process.env.AI_TOKEN ?? "";

/** 是否可用：硅基流动 Key 或 自托管推理服务 任一配置 */
export const ENABLED = Boolean(SF_KEY || INFERENCE_URL);

function base(): string {
  return SF_KEY ? SF_BASE : INFERENCE_URL;
}
function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${SF_KEY || AI_TOKEN}` };
}
function modelOf(sfModel: string, localModel: string): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return SF_KEY ? sfModel : localModel;
}
function visionModel(): string {
  if (process.env.AI_VISION_MODEL) return process.env.AI_VISION_MODEL;
  return SF_KEY ? "Qwen/Qwen3-VL-8B-Instruct" : "qwen2.5vl:7b";
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMsg =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] };

/** 通用调用：OpenAI 兼容 chat（文本或视觉 messages） */
async function chat(
  system: string,
  user: ChatMsg["content"],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  if (!ENABLED) return null;
  const url = `${base()}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        model:
          Array.isArray(user) && user.some((u) => u.type === "image_url")
            ? visionModel()
            : modelOf("deepseek-ai/DeepSeek-V3.1", "qwen2.5:7b"),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: opts?.temperature ?? 0.1,
        max_tokens: opts?.maxTokens ?? 800,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null; // 降级：调用方走手动流程
  }
}

const EXTRACT_SYSTEM =
  "你是 B2B 商品信息录入助手。从图片或文字中提取商品字段，只输出 JSON，不要任何多余文字。" +
  "可用字段: name(商品名称), brand(品牌), sku(货号), barcode(条形码,纯数字), publicPrice(单价数字)," +
  " moq(最小起订量,整数), boxSize(箱规,如 24瓶/箱), description(一句话描述), keywords(3-5个逗号分隔搜索词,覆盖中/英/西语)." +
  "规则: 只在图中或文中能明确看到的信息才填写，看不到的一律省略、绝不编造；数字保留2位小数；容量单位统一用 ml。";

function parseFields(raw: string): ProductFields | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      brand: typeof obj.brand === "string" ? obj.brand : undefined,
      sku: typeof obj.sku === "string" ? obj.sku : undefined,
      barcode:
        typeof obj.barcode === "string"
          ? obj.barcode.replace(/\D/g, "").slice(0, 14) || undefined
          : undefined,
      description:
        typeof obj.description === "string" ? obj.description : undefined,
      boxSize: typeof obj.boxSize === "string" ? obj.boxSize : undefined,
      keywords: typeof obj.keywords === "string" ? obj.keywords : undefined,
      publicPrice:
        typeof obj.publicPrice === "number" && obj.publicPrice >= 0
          ? Math.round(obj.publicPrice * 100) / 100
          : undefined,
      moq:
        Number.isInteger(obj.moq) && obj.moq >= 1 ? obj.moq : undefined,
    };
  } catch {
    return null;
  }
}

/** 图片 URL → data URL（本地推理引擎只收 base64；云端 API 亦兼容） */
async function toDataUrl(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith("data:")) return imageUrl;
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

/** 智能录入（看图直读）：商品照片/报价单截图 → 商品字段（免 OCR 中间层） */
export async function aiVisionExtract(
  imageUrl: string,
): Promise<ProductFields | null> {
  if (!ENABLED || !imageUrl) return null;
  const dataUrl = await toDataUrl(imageUrl);
  if (!dataUrl) return null;
  const raw = await chat(EXTRACT_SYSTEM, [
    {
      type: "text",
      text: "识别这张商品图/报价单，输出字段 JSON（看不到的字段省略，不要编造）。",
    },
    { type: "image_url", image_url: { url: dataUrl } },
  ]);
  if (!raw) return null;
  return parseFields(raw);
}

/** 智能录入（文本）：从（OCR 转好的）报价单文字提取商品字段（文本后端用） */
export async function aiExtractProduct(
  ocrText: string,
): Promise<ProductFields | null> {
  if (!ENABLED) return null;
  const raw = await chat(
    EXTRACT_SYSTEM,
    (ocrText || "").slice(0, 4000),
    { temperature: 0 },
  );
  if (!raw) return null;
  return parseFields(raw);
}

/**
 * 语义向量：文本 → 向量（SiliconFlow BGE-M3 1024 维 / 自托管同接口），
 * 失败返回 null（调用方回退关键词搜索）
 */
export async function aiEmbedding(text: string): Promise<number[] | null> {
  if (!ENABLED || !text.trim()) return null;
  try {
    const res = await fetch(`${base()}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        model:
          process.env.AI_EMBED_MODEL ??
          (SF_KEY ? "BAAI/bge-m3" : "bge-m3"),
        input: text.slice(0, 512),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { embedding?: number[] }[];
    };
    const emb = data.data?.[0]?.embedding;
    return emb && emb.length > 0 ? emb : null;
  } catch {
    return null;
  }
}

/** 向量相似（cosine），供替代推荐/查重复用 */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}
