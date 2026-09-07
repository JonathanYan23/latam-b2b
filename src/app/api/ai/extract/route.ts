import { NextResponse } from "next/server";
import { requireRole } from "@/lib/require";
import { aiVisionExtract, ENABLED } from "@/lib/ai";

// POST /api/ai/extract  { url: string }
// 批发商上传商品图后，AI 看图直读商品字段（名称/货号/条码/价格/MOQ/箱规…）
// 未配置 AI 后端 → { ok:false, disabled:true }（前端静默跳过，走手动填写）
export async function POST(request: Request): Promise<NextResponse> {
  await requireRole("WHOLESALER");
  if (!ENABLED) {
    return NextResponse.json({ ok: false, disabled: true });
  }
  try {
    const body = (await request.json()) as { url?: string };
    let url = (body?.url ?? "").trim();
    if (!url) return NextResponse.json({ ok: false, error: "no_url" });
    // 本地开发上传返回相对路径（/uploads/..）→ 转绝对地址供 AI 拉取
    if (url.startsWith("/")) {
      url = new URL(url, request.url).toString();
    }

    const fields = await aiVisionExtract(url);
    if (!fields) {
      return NextResponse.json({ ok: false, error: "ai_failed" });
    }
    return NextResponse.json({ ok: true, fields });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" });
  }
}
