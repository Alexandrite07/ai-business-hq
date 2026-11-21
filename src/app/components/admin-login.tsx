"use client";

import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      window.location.reload();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-login-wrap">
      <div className="admin-login-card">
        <span className="admin-login-icon">
          <Sparkles aria-hidden="true" size={19} />
        </span>
        <span className="eyebrow">SUNDAY RITUALS / TEAM</span>
        <h1>A little behind the scenes.</h1>
        <p>Sign in to manage orders, shipping updates, and your product collection.</p>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-password">Admin password</label>
          <div className="password-field">
            <LockKeyhole aria-hidden="true" size={16} />
            <input
              autoComplete="current-password"
              id="admin-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </div>
          {error && (
            <p aria-live="assertive" className="admin-form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-dark admin-submit" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Open dashboard"}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </form>
        {process.env.NODE_ENV !== "production" && (
          <p className="admin-login-hint">
            Local preview password: <code>changeme123</code>. Change it in <code>.env.local</code>{" "}
            before deployment.
          </p>
        )}
      </div>
    </section>
  );
}
