import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// 上传接口：优先 Vercel Blob（生产，需 BLOB_READ_WRITE_TOKEN）；
// 本地开发无 token 时降级写入 public/uploads（仅 dev 可用）。
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  // 类型白名单（图片 + PDF）
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }
  // 单文件上限 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // 生产（Vercel）凭据：OIDC（BLOB_STORE_ID + 运行时 VERCEL_OIDC_TOKEN）或静态读写 token
  const hasBlob = !!(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.BLOB_STORE_ID
  );
  if (hasBlob) {
    const { put } = await import("@vercel/blob");
    const ext = file.name.split(".").pop() || "bin";
    const blob = await put(`uploads/${session.user.id}/${Date.now()}-${randomId()}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: blob.url });
  }

  // 本地开发降级：写入 public/uploads
  if (process.env.NODE_ENV !== "production") {
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const name = `${Date.now()}-${randomId()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buf);
    return NextResponse.json({ url: `/uploads/${name}` });
  }

  return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
