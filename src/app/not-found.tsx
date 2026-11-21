import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="empty-state" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <p className="eyebrow" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
        404
      </p>
      <h1 style={{ marginTop: "0.5rem", fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        We couldn’t find that page.
      </h1>
      <p style={{ maxWidth: "38rem", margin: "1rem auto 0", color: "#475467" }}>
        The item you were looking for may have moved, sold out, or never existed.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          marginTop: "1.5rem",
          padding: "0.8rem 1.2rem",
          borderRadius: "999px",
          background: "#18181b",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Return to Sunday Rituals
      </Link>
    </section>
  );
}
