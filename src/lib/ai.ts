/**
 * AI 推理适配层（智能录入 / 语义搜索）
 * ---------------------------------------------------------------
 * 部署模型：完全开源、可本地部署、无 API 调用费（Phase 1 选型）：
 *   - OCR 字段识别  : PaddleOCR（图片/PDF/截图上的文字与数字）
 *   - 属性提取/分类 : Qwen2.5-7B-Instruct（4-bit 量化，CPU 可推理）
 *   - 语义向量      : BGE-M3 → 1024 维 → Neon pgvector (cosine < 0.35)
 * 推理服务位置：独立服务（Runpod / 本地 GPU / 自建），Vercel 仅作为网关。
 *
 * 本层是对外唯一依赖点：未配置推理服务时全部优雅降级——
 *   aiExtractProduct -> null（界面回退到手动填写）
 *   aiEmbedding     -> null（搜索回退到关键词 contains）
 * 界面文案只出现「智能识别 / 自动填写 / 批量上架 / 智能搜索」，
 * 不出现 OCR / 向量 / Embedding 等技术词。
 */

const INFERENCE_URL = process.env.AI_INFERENCE_URL ?? ""; // 例 https://your-worker.example.com
const AI_TOKEN = process.env.AI_TOKEN ?? "";

export const ENABLED = Boolean(INFERENCE_URL);

/** 通用调用：OpenAI 兼容 chat 接口（Qwen2.5/Llama3 服务常见格式） */
async function chat(
  system: string,
  user: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  if (!ENABLED) return null;
  try {
    const res = await fetch(`${INFERENCE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AI_TOKEN ? { Authorization: `Bearer ${AI_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "qwen2.5-7b-instruct",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: opts?.temperature ?? 0.1,
        max_tokens: opts?.maxTokens ?? 512,
      }),
      signal: AbortSignal.timeout(20_000),
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

/**
 * 智能录入：从（OCR 服务转好的）文字提取商品字段
 * @param ocrText 上传图片/报价单/截图的 OCR 文本（结构化行）
 * @returns 商品字段 JSON（字段缺失由调用方标「待补充」），失败返回 null
 */
export async function aiExtractProduct(ocrText: string): Promise<{
  name?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  publicPrice?: number;
  moq?: number;
  boxSize?: string;
  keywords?: string;
} | null> {
  if (!ENABLED) return null;
  const system =
    "你是商品信息录入助手。从给定文本提取字段，只输出 JSON，不要多余文字。" +
    "字段: name(名称), sku(货号), barcode(条形码), publicPrice(数字), moq(最小起订量,整数), " +
    "boxSize(箱规,如 24瓶/箱), description(描述), keywords(逗号分隔搜索词)。数字保留2位小数。单位统一 ml。缺失字段省略。";
  const raw = await chat(system, ocrText.slice(0, 4000));
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      sku: typeof obj.sku === "string" ? obj.sku : undefined,
      barcode: typeof obj.barcode === "string" ? obj.barcode.replace(/\D/g, "").slice(0, 14) || undefined : undefined,
      description: typeof obj.description === "string" ? obj.description : undefined,
      boxSize: typeof obj.boxSize === "string" ? obj.boxSize : undefined,
      keywords: typeof obj.keywords === "string" ? obj.keywords : undefined,
      publicPrice: typeof obj.publicPrice === "number" && obj.publicPrice >= 0 ? Math.round(obj.publicPrice * 100) / 100 : undefined,
      moq: Number.isInteger(obj.moq) && obj.moq >= 1 ? obj.moq : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 语义向量：文本 → 1024 维数组（BGE-M3），失败返回 null（走关键词搜索）
 */
export async function aiEmbedding(text: string): Promise<number[] | null> {
  if (!ENABLED || !text.trim()) return null;
  try {
    const res = await fetch(`${INFERENCE_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AI_TOKEN ? { Authorization: `Bearer ${AI_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.AI_EMBED_MODEL ?? "bge-m3",
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

/** 向量相似（cosine），供商家内部查重与替代推荐复用 */
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
