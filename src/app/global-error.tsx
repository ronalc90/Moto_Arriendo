"use client";

/** Last-resort error page (replaces the root layout when it fails). */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-CO">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d2025",
          color: "#f5f4ef",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <title>Error · Moto Arriendo</title>
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Algo salió mal</h1>
          <p style={{ color: "#c3c6cc", margin: "0 0 20px" }}>Intenta de nuevo en unos segundos.</p>
          <button
            onClick={() => retry()}
            style={{
              background: "#ffc21a",
              color: "#16181b",
              border: 0,
              borderRadius: 16,
              padding: "12px 20px",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
