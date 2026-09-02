// 纯工具函数（无 server 依赖，可安全用于 client 组件）

/** 字符串插值：template 中的 {name} 占位符替换 */
export function fmt(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`,
  );
}
