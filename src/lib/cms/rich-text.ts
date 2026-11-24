import sanitizeHtml from "sanitize-html";

/** Preserve editorial markup, never scripts, embeds, styles or event handlers. */
export function cleanArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "sup", "sub", "ul", "ol", "li", "blockquote", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "hr", "div", "span"],
    allowedAttributes: {
      a: ["href", "title"], img: ["src", "alt", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"], td: ["colspan", "rowspan"],
      ol: ["start"], "*": ["id"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        let href = attribs.href || "";
        if (/^https?:\/\/(?:www\.)?citybond\.in(?:\/|$)/i.test(href)) {
          const u = new URL(href); href = u.pathname + u.search + u.hash;
        }
        const fixes: Record<string,string> = {
          "/blog/acp-sheet-for-main-gate": "/blog/blog-acp-sheet-for-main-gate/",
          "/blog/3d-acp-sheet-exterior-india": "/blog/blog-3d-acp-sheet-exterior-india/",
          "/acp-sheet-design-catalogue-pdf-download": "/catalogue-download",
          "/hpl-acp-sheet-series": "/hpl-sheet",
          "/clients/Metacity/index.php": "/metacity/",
          "/blog/building-facade-trends-in-india-what-architects-are-choosing-in-2026": "/blog/modern-facade-design-resource-center/",
        };
        href = fixes[href.replace(/\/$/,"")] || href;
        return { tagName, attribs: { ...attribs, href } };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}
