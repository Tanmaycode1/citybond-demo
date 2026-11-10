import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  allowAttempt,
  assertOrigin,
  clientIp,
  isEditor,
  passwordMatches,
  signSession,
  SESSION_COOKIE,
} from "@/lib/cms/auth";
import {
  getEditorState,
  publishDraft,
  revisions,
  saveDraft,
} from "@/lib/cms/content";
import {
  ConflictError,
  listObjects,
  readObject,
  readFileObject,
  storageReady,
} from "@/lib/cms/storage";
import { uploadFile } from "@/lib/cms/uploads";
import { importOriginalCopy } from "@/lib/cms/original-copy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(request: Request) {
  const value = await request.text();
  if (value.length > 1_500_000) throw new Error("Content is too large");
  return JSON.parse(value);
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (!(await isEditor()))
      return json({ error: "Sign in to continue." }, 401);
    if (action === "content")
      return json({
        ...(await getEditorState()),
        storageReady: storageReady(),
      });
    if (action === "revisions") return json({ revisions: await revisions() });
    if (action === "enquiries") {
      const items = (await listObjects("enquiries/"))
        .sort((a, b) => b.key.localeCompare(a.key))
        .slice(0, 100);
      const enquiries = await Promise.all(
        items.map(async (item) => (await readObject(item.key))?.data),
      );
      return json({ enquiries: enquiries.filter(Boolean) });
    }
    if (action === "attachment") {
      const key = new URL(request.url).searchParams.get("key") || "";
      if (!/^attachments\/[a-f0-9-]+\.(jpg|png|webp|avif|pdf)$/.test(key))
        return json({ error: "Not found" }, 404);
      const file = await readFileObject(key);
      if (!file) return json({ error: "Not found" }, 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": file.type,
          "Content-Disposition": "attachment",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("Editor read failed", e instanceof Error ? e.name : "Error");
    return json({ error: "Unable to load content. Please retry." }, 503);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    assertOrigin(request);
    const { action } = await params;
    if (action === "login") {
      const hash = process.env.CMS_PASSWORD_HASH;
      const secret = process.env.CMS_SESSION_SECRET;
      if (!hash || !secret || secret.length < 32)
        return json({ error: "Editor access has not been configured." }, 503);
      if (!(await allowAttempt("login", clientIp(request), 8, 15 * 60 * 1000)))
        return json(
          { error: "Too many attempts. Please try again in 15 minutes." },
          429,
        );
      const data = await body(request);
      if (
        typeof data.password !== "string" ||
        !passwordMatches(data.password, hash)
      )
        return json({ error: "That password is incorrect." }, 401);
      (await cookies()).set(SESSION_COOKIE, signSession(secret), {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60,
      });
      return json({ ok: true });
    }
    if (!(await isEditor()))
      return json({ error: "Sign in to continue." }, 401);
    if (action === "logout") {
      (await cookies()).set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return json({ ok: true });
    }
    if (action === "upload") {
      if (Number(request.headers.get("content-length")) > 3_700_000)
        return json({ error: "Choose a file smaller than 3.5 MB." }, 413);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return json({ error: "Choose a file." }, 400);
      return json({ url: await uploadFile(file, "media") });
    }
    const data = await body(request);
    if (action === "import-original") {
      const state = await getEditorState();
      if (data.draftEtag !== state.draftEtag) throw new ConflictError();
      const imported = importOriginalCopy(state.content);
      return json({
        ...(await saveDraft(imported.content, state.draftEtag)),
        pages: imported.pages,
        sourceUrls: imported.sourceUrls,
      });
    }
    if (action === "save") {
      if (
        data.draftEtag !== null &&
        (typeof data.draftEtag !== "string" || !data.draftEtag)
      )
        return json({ error: "Missing revision identifier." }, 400);
      return json(await saveDraft(data.content, data.draftEtag));
    }
    if (action === "publish") {
      if (
        typeof data.draftEtag !== "string" ||
        !data.draftEtag ||
        !(
          data.publishedEtag === null ||
          (typeof data.publishedEtag === "string" && !!data.publishedEtag)
        )
      )
        return json({ error: "Save a draft before publishing." }, 400);
      return json(await publishDraft(data.draftEtag, data.publishedEtag));
    }
    if (action === "restore") {
      if (
        typeof data.key !== "string" ||
        !/^revisions\/[a-zA-Z0-9_.-]+\.json$/.test(data.key)
      )
        return json({ error: "Invalid revision." }, 400);
      if (
        data.draftEtag !== null &&
        (typeof data.draftEtag !== "string" || !data.draftEtag)
      )
        return json({ error: "Missing revision identifier." }, 400);
      const revision = await readObject<{ content: unknown }>(data.key);
      if (!revision) return json({ error: "Revision not found." }, 404);
      return json(await saveDraft(revision.data.content, data.draftEtag));
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof ConflictError) return json({ error: e.message }, 409);
    if (e instanceof Error && e.message === "Invalid request origin")
      return json({ error: "Invalid request origin." }, 403);
    if (e && typeof e === "object" && "issues" in e)
      return json(
        { error: "Check the content fields.", issues: e.issues },
        400,
      );
    console.error("Editor write failed", e instanceof Error ? e.name : "Error");
    return json(
      {
        error:
          e instanceof Error &&
          /Choose|Use a|Duplicate|Unknown product|too large|Required|Reserved/.test(
            e.message,
          )
            ? e.message
            : "Unable to save. Please retry; your edits remain in the editor.",
      },
      400,
    );
  }
}
