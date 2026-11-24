import { enquirySchema } from "@/lib/cms/schema";
import { allowAttempt, assertOrigin, clientIp } from "@/lib/cms/auth";
import { writeObject } from "@/lib/cms/storage";
import { uploadFile } from "@/lib/cms/uploads";
import { randomUUID } from "node:crypto";
import { getPublicContent } from "@/lib/cms/content";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 3_700_000)
      return Response.json(
        { error: "Choose an image smaller than 3.5 MB." },
        { status: 413 },
      );
    let form: FormData;
    let input;
    try {
      form = await request.formData();
      input = JSON.parse(String(form.get("data") || "{}"));
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid form");
    } catch {
      return Response.json({ error: "Please submit a valid enquiry form." }, { status: 400 });
    }
    if (input.website) return Response.json({ ok: true });
    const data = enquirySchema.parse(input);
    const content = await getPublicContent();
    if (data.type !== "career" && !content.roles.some(role => role.label === data.role))
      return Response.json({ error: "Choose your role.", fields: { role: "Choose a role from the list." } }, { status: 400 });
    if (data.product && !content.products.some(product => product.slug === data.product))
      return Response.json({ error: "Choose a collection from the list.", fields: { product: "Choose a collection from the list." } }, { status: 400 });
    const file = form.get("file");
    if (data.type === "visualiser" && (!(file instanceof File) || !file.size))
      return Response.json({ error: "Upload a photo of your building.", fields: { attachment: "Choose a building photo." } }, { status: 400 });
    if (!(await allowAttempt("enquiry", clientIp(request), 5, 60 * 60 * 1000)))
      return Response.json(
        {
          error:
            "You have sent several enquiries. Please contact the team directly or try again later.",
        },
        { status: 429 },
      );
    let attachment = "";
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
      { ...data, website: undefined, id, reference: id.slice(0, 8), createdAt, attachment, status: "new" },
      null,
    );
    return Response.json({ ok: true, reference: id.slice(0, 8) });
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid request origin")
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    if (e && typeof e === "object" && "issues" in e) {
      const messages: Record<string, string> = {
        name: "Enter your full name (2–120 characters).", email: "Enter a valid email address.",
        phone: "Enter a valid phone number with at least 7 digits.", city: "Enter your city (2–160 characters).",
        role: "Choose your role.", consent: "Please agree to the privacy notice to continue.",
        message: "Keep your message under 4,000 characters.",
      };
      const fields = Object.fromEntries((e.issues as { path: PropertyKey[] }[]).map(issue => {
        const key = String(issue.path[0]);
        return [key, messages[key] || "Please check this field."];
      }));
      return Response.json(
        { error: "Please check the highlighted fields.", fields },
        { status: 400 },
      );
    }
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
