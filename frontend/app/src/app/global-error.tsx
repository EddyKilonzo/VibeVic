"use client";

import { useEffect } from "react";

/**
 * The last resort: the root layout itself failed, so there is no shell, no
 * providers, and no design tokens to rely on. Everything here is inline and
 * dependency-free on purpose — a fallback that can also fail is not a fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fbfbfa",
          color: "#12161f",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>The site failed to load.</h1>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#5a6270" }}>
            This is an error in the application shell rather than in any one page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              fontSize: 14,
              borderRadius: 6,
              border: "1px solid #0e47a1",
              background: "#0e47a1",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
