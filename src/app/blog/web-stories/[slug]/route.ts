import { getEditorState, getPublicContent } from "@/lib/cms/content";
import { isEditor } from "@/lib/cms/auth";
import { renderWebStory } from "@/lib/blog-story";
export const dynamic = "force-dynamic";
export async function GET(request: Request, {params}: {params:Promise<{slug:string}>}) {
  const {slug} = await params;
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (preview && !(await isEditor())) return new Response("Not found",{status:404});
  const c = preview ? (await getEditorState()).content : await getPublicContent();
  const post = c.blogs.find(p => p.kind === "story" && p.slug === slug && (preview || p.status === "published"));
  if (!post) return new Response("Not found",{status:404});
  const noindex = preview || process.env.SITE_INDEXABLE === "false" || (!!process.env.VERCEL && process.env.SITE_INDEXABLE !== "true");
  return new Response(renderWebStory(post,c.site,process.env.SITE_URL || "https://citybond.in",noindex,new URL(request.url).origin),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",...(noindex ? {"X-Robots-Tag":"noindex,nofollow"} : {})}});
}
