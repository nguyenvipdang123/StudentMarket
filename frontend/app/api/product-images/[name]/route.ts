import { productImageMime, productImageName } from "@/lib/product-images";
import { readMedia, MediaStorageError } from "@/lib/media-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!productImageName.test(name)) return new Response(null, { status: 404 });
  try {
    const bytes = await readMedia("products", name);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": productImageMime(name),
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return new Response(null, { status: error instanceof MediaStorageError ? error.status : 503, headers: { "Cache-Control": "no-store" } }); }
}
