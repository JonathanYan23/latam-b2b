// 本地类型兜底：生产环境由 Vercel 构建时安装真实的 @vercel/blob 包。
// 本地开发（无 Blob 凭据）走上传降级分支，不会调用 SDK。
declare module "@vercel/blob" {
  export interface PutOptions {
    access?: "public" | "private";
    addRandomSuffix?: boolean;
    contentType?: string;
    token?: string;
  }
  export function put(
    pathname: string,
    body: Blob | Buffer | File | string,
    options?: PutOptions,
  ): Promise<{ url: string; pathname: string; contentType: string; contentDisposition: string }>;
  export function del(url: string): Promise<void>;
}
