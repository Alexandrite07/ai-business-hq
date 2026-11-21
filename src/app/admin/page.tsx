import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { AdminDashboard } from "@/app/components/admin-dashboard";
import { AdminLogin } from "@/app/components/admin-login";
import { ADMIN_SESSION_COOKIE, isAdminSessionValid } from "@/lib/admin-auth";

async function AdminGate() {
  await connection();
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(session) ? <AdminDashboard /> : <AdminLogin />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="storefront-loading">Opening your dashboard…</div>}>
      <AdminGate />
    </Suspense>
  );
}
