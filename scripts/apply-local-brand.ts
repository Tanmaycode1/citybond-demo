// One-time local review migration. Never publishes unrelated draft edits.
import { randomUUID } from "node:crypto";
import { readObject, writeObject } from "../src/lib/cms/storage";
import { validateContent } from "../src/lib/cms/schema";
import type { SiteContent } from "../src/lib/cms/schema";
if (
  process.env.VERCEL ||
  process.env.BLOB_STORE_ID ||
  process.env.BLOB_READ_WRITE_TOKEN
) {
  throw new Error("This review migration is local only.");
}
async function main() {
  const branding = {
    logo: "/citybond/brand-wordmark.svg",
    footerLogo: "/citybond/brand-lockup.svg",
    tagline: "Bonded by Trust",
  };
  type Revision = { content: SiteContent; updatedAt: string };
  const head = await readObject<{ revision: string; updatedAt: string }>(
    "content/published.json",
  );
  if (head) {
    const current = await readObject<Revision>(head.data.revision);
    if (!current) throw new Error("Published content missing");
    const content = validateContent(current.data.content);
    Object.assign(content.site, branding);
    const updatedAt = new Date().toISOString();
    const revision = `revisions/${updatedAt.replaceAll(":", "-")}-${randomUUID()}.json`;
    await writeObject(revision, { content, updatedAt }, null);
    await writeObject(
      "content/published.json",
      { revision, updatedAt },
      head.etag,
    );
  }
  const draft = await readObject<Revision>("content/draft.json");
  if (draft) {
    const content = validateContent(draft.data.content);
    Object.assign(content.site, branding);
    await writeObject(
      "content/draft.json",
      { content, updatedAt: new Date().toISOString() },
      draft.etag,
    );
  }
  console.log(
    "Local published and draft branding updated; other content retained.",
  );
}
main();
