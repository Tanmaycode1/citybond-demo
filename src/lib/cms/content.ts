import { cache } from "react";
import seed from "@/data/site.json";
import { validateContent, type SiteContent } from "./schema";
import { readObject, writeObject, listObjects, ConflictError } from "./storage";
import { randomUUID } from "node:crypto";
type Draft = { content: SiteContent; updatedAt: string };
type Head = { revision: string; updatedAt: string };
export const getPublicContent = cache(async () => {
  const head = await readObject<Head>("content/published.json");
  if (!head) return validateContent(seed);
  const rev = await readObject<Draft>(head.data.revision);
  if (!rev) throw new Error("Published revision unavailable");
  return validateContent(rev.data.content);
});
export async function getEditorState() {
  const [draft, head] = await Promise.all([
    readObject<Draft>("content/draft.json"),
    readObject<Head>("content/published.json"),
  ]);
  const content = validateContent(
    draft?.data.content ?? (await getPublicContent()),
  );
  return {
    content,
    draftEtag: draft?.etag ?? null,
    publishedEtag: head?.etag ?? null,
    updatedAt: draft?.data.updatedAt ?? null,
    publishedAt: head?.data.updatedAt ?? null,
  };
}
export async function saveDraft(input: unknown, expected: string | null) {
  const content = validateContent(input);
  const updatedAt = new Date().toISOString();
  const draftEtag = await writeObject(
    "content/draft.json",
    { content, updatedAt },
    expected,
  );
  return { draftEtag, updatedAt };
}
export async function publishDraft(
  draftEtag: string,
  publishedEtag: string | null,
) {
  const draft = await readObject<Draft>("content/draft.json");
  if (!draft || draft.etag !== draftEtag) throw new ConflictError();
  const content = validateContent(draft.data.content);
  const updatedAt = new Date().toISOString();
  const revision = `revisions/${updatedAt.replaceAll(":", "-")}-${randomUUID()}.json`;
  await writeObject(revision, { content, updatedAt }, null);
  const etag = await writeObject(
    "content/published.json",
    { revision, updatedAt },
    publishedEtag,
  );
  return { publishedEtag: etag, publishedAt: updatedAt };
}
export async function revisions() {
  return (await listObjects("revisions/"))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 20);
}
