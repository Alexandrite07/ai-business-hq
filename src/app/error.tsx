"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty-state" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Error
      </p>
      <h1 style={{ marginTop: "0.5rem", fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        We hit a snag on your last request.
      </h1>
      <p style={{ maxWidth: "38rem", margin: "1rem auto 0", color: "#475467" }}>
        {error.message || "Please try again in a moment."}
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: "999px",
            background: "#18181b",
            color: "#fff",
            padding: "0.8rem 1.2rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            background: "transparent",
            border: "1px solid #d0d5dd",
            color: "#1d2939",
            padding: "0.8rem 1.2rem",
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
