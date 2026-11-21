import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isAdminPasswordValid,
} from "@/lib/admin-auth";

type LoginInput = { password?: unknown };

export async function POST(request: Request) {
  let input: LoginInput;
  try {
    input = (await request.json()) as LoginInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof input.password !== "string" || !isAdminPasswordValid(input.password)) {
    return NextResponse.json({ error: "The password was not accepted." }, { status: 401 });
  }

  const session = createAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Set a strong ADMIN_PASSWORD before enabling the admin dashboard." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
