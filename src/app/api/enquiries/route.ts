import { enquirySchema } from "@/lib/cms/schema";
import { allowAttempt, assertOrigin, clientIp } from "@/lib/cms/auth";
import { writeObject } from "@/lib/cms/storage";
import { uploadFile } from "@/lib/cms/uploads";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 3_700_000)
      return Response.json(
        { error: "Choose an image smaller than 3.5 MB." },
        { status: 413 },
      );
    const form = await request.formData();
    const input = JSON.parse(String(form.get("data") || "{}"));
    if (input.website) return Response.json({ ok: true });
    const data = enquirySchema.parse(input);
    if (!(await allowAttempt("enquiry", clientIp(request), 5, 60 * 60 * 1000)))
      return Response.json(
        {
          error:
            "You have sent several enquiries. Please contact the team directly or try again later.",
        },
        { status: 429 },
      );
    let attachment = "";
    const file = form.get("file");
    if (file instanceof File && file.size)
      attachment = await uploadFile(
        file,
        "attachments",
        data.type === "career",
      );
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await writeObject(
      `enquiries/${createdAt.replaceAll(":", "-")}-${id}.json`,
      { ...data, website: undefined, id, createdAt, attachment, status: "new" },
      null,
    );
    return Response.json({ ok: true, reference: id.slice(0, 8) });
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid request origin")
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    if (e && typeof e === "object" && "issues" in e)
      return Response.json(
        { error: "Please check your name, email, phone, city and consent." },
        { status: 400 },
      );
    console.error("Enquiry failed", e instanceof Error ? e.name : "Error");
    return Response.json(
      {
        error:
          e instanceof Error && /Choose|Use a/.test(e.message)
            ? e.message
            : "Your enquiry could not be saved. Please retry or contact CityBond directly.",
      },
      { status: 503 },
    );
  }
}
