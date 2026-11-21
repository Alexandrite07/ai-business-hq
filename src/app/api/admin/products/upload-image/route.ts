import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload must use multipart form data." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
  }
  const extension = IMAGE_TYPES.get(file.type);
  if (!extension || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Images must be JPEG, PNG, or WebP and no larger than 5 MB." },
      { status: 400 },
    );
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
  }
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) {
    console.error("Product image upload failed:", error);
    return NextResponse.json({ error: "Could not upload the product image." }, { status: 500 });
  }
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 200 });
}
