"use client";

/**
 * 根级致命错误兜底（替代根布局，故不依赖 globals.css / I18nProvider）。
 * 采用内联样式 + 中英西三语并列，确保任何情况下都能给出可读提示。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f7",
          color: "#1d1d1f",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto",
              borderRadius: "50%",
              background: "rgba(255,59,48,.12)",
              display: "grid",
              placeItems: "center",
              fontSize: 26,
            }}
            aria-hidden
          >
            ⚠️
          </div>
          <h1
            style={{
              marginTop: 20,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong · 页面出错了 · Algo salió mal
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.65,
              color: "#6e6e73",
            }}
          >
            An unexpected problem occurred. Please reload the page.
            <br />
            页面遇到意外问题，请重新加载。
            <br />
            Ocurrió un problema inesperado. Recarga la página.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#aeaeb2",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Ref {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: "0 22px",
              border: 0,
              borderRadius: 999,
              background: "#0071e3",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry · 重试 · Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
