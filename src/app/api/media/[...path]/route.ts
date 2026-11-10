import { readFileObject } from "@/lib/cms/storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const name = path.join("/");
  if (!/^[a-f0-9-]+\.(jpg|png|webp|avif|pdf)$/.test(name))
    return new Response("Not found", { status: 404 });
  try {
    const file = await readFileObject("media/" + name);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.body, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(file.type === "application/pdf"
          ? { "Content-Disposition": "attachment" }
          : {}),
      },
    });
  } catch {
    return new Response("Media temporarily unavailable", { status: 503 });
  }
}
