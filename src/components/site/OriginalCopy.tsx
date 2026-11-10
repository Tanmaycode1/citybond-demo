"use client";
import { createContext, useContext } from "react";
import type {
  OriginalBlock,
  OriginalPage,
} from "@/lib/cms/original-copy-schema";
import Link from "./SiteLink";
export const OriginalPageContext = createContext<OriginalPage | undefined>(
  undefined,
);
export const useOriginalPage = () => useContext(OriginalPageContext);
export function OriginalCopy() {
  const page = useOriginalPage();
  if (!page?.blocks.length) return null;
  return (
    <div className="original-copy wrap" data-original-copy={page.route}>
      <OriginalBlocks blocks={page.blocks} title={page.title} />
    </div>
  );
}

export function OriginalBlocks({
  blocks,
  title = "",
}: {
  blocks: OriginalBlock[];
  title?: string;
}) {
  return (
    <>
      {blocks.map((b, i) => {
        const key = `${b.id}-${i}`;
        if (b.type === "heading") {
          const Heading = b.level <= 2 ? "h2" : "h3";
          return <Heading key={key}>{b.text}</Heading>;
        }
        if (b.type === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {b.items.map((text, n) => (
                <li key={n}>{text}</li>
              ))}
            </List>
          );
        }
        if (b.type === "table")
          return (
            <div
              className="original-table"
              key={key}
              role="region"
              aria-label={b.text || title}
              tabIndex={0}
            >
              <table>
                {b.text && <caption>{b.text}</caption>}
                {b.headerRows > 0 && (
                  <thead>
                    {b.rows.slice(0, b.headerRows).map((row, n) => (
                      <tr key={n}>
                        {row.map((text, j) => (
                          <th scope="col" key={j}>
                            {text}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                )}
                <tbody>
                  {b.rows.slice(b.headerRows).map((row, n) => (
                    <tr key={n}>
                      {row.map((text, j) => (
                        <td key={j}>{text}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type === "link")
          return b.href ? (
            <p className="original-link" key={key}>
              <Link href={b.href}>
                {b.text}
                <span aria-hidden="true"> ↗</span>
              </Link>
            </p>
          ) : (
            <p key={key}>{b.text}</p>
          );
        return <p key={key}>{b.text}</p>;
      })}
    </>
  );
}
