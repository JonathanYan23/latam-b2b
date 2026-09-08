import { NextResponse } from "next/server";
import { requireRole } from "@/lib/require";
import { aiVisionExtract, aiExtractProduct, ENABLED } from "@/lib/ai";

// POST /api/ai/extract  { url: string, kind?: "image" | "pdf" | "excel" }
// 批发商上传文件后，AI 提取商品字段（名称/货号/条码/价格/MOQ/箱规…）：
//   image → 视觉模型看图直读；pdf/excel → 文本解析后文本模型结构化
// 未配置 AI 后端 → { ok:false, disabled:true }（前端静默跳过，走手动填写）
export async function POST(request: Request): Promise<NextResponse> {
  await requireRole("WHOLESALER");
  if (!ENABLED) {
    return NextResponse.json({ ok: false, disabled: true });
  }
  try {
    const body = (await request.json()) as {
      url?: string;
      kind?: string;
    };
    let url = (body?.url ?? "").trim();
    if (!url) return NextResponse.json({ ok: false, error: "no_url" });
    // 本地开发上传返回相对路径（/uploads/..）→ 转绝对地址供拉取
    if (url.startsWith("/")) {
      url = new URL(url, request.url).toString();
    }
    const kind = (body?.kind ?? "").toLowerCase();
    const ext = url.split(".").pop()?.toLowerCase() ?? "";

    // PDF / Excel：下载原文件 → 文本解析 → 文本模型结构化
    if (kind === "pdf" || kind === "excel" || ["pdf", "xls", "xlsx"].includes(ext)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return NextResponse.json({ ok: false, error: "fetch_failed" });
      const buf = Buffer.from(await res.arrayBuffer());
      let text = "";
      if (kind === "pdf" || ext === "pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buf);
        text = (parsed?.text ?? "").slice(0, 6000);
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "buffer" });
        const rows: string[] = [];
        for (const name of wb.SheetNames.slice(0, 3)) {
          const lines = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
            header: 1,
            raw: false,
            defval: "",
          }) as string[][];
          for (const line of lines.slice(0, 60)) {
            const cell = line
              .map((c) => String(c ?? "").trim())
              .filter(Boolean)
              .join(" | ");
            if (cell) rows.push(cell);
          }
        }
        text = rows.join("\n").slice(0, 6000);
      }
      if (!text.trim()) return NextResponse.json({ ok: false, error: "empty_doc" });
      const fields = await aiExtractProduct(text);
      if (!fields) return NextResponse.json({ ok: false, error: "ai_failed" });
      return NextResponse.json({ ok: true, fields, from: "text" });
    }

    // 图片 / 其他：视觉直读
    const fields = await aiVisionExtract(url);
    if (!fields) {
      return NextResponse.json({ ok: false, error: "ai_failed" });
    }
    return NextResponse.json({ ok: true, fields, from: "image" });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "bad_request",
      detail: e instanceof Error ? e.message.slice(0, 120) : undefined,
    });
  }
}
