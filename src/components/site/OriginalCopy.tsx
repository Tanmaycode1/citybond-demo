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
export function OriginalCopy({ groupFinishLists = false }: { groupFinishLists?: boolean } = {}) {
  const page = useOriginalPage();
  if (!page?.blocks.length) return null;
  const groups: OriginalBlock[][] = [];
  for (const block of page.blocks) {
    // The imported product copy references a form that is not present here.
    if ((page.route.startsWith("products/") || ["fire-retardent", "low-density-poly-ethylene"].includes(page.route)) && (
      block.text.trim() === "Have a Message For Us?" ||
      block.text.trim() === "Use this form to send your message. We will get back within 24 hours."
    )) continue;
    const isFinish = block.type === "list" && !block.ordered && block.items.length === 2;
    const prior = groups[groups.length - 1];
    if (groupFinishLists && isFinish && prior?.[0].type === "list" && !prior[0].ordered && prior[0].items.length === 2) prior.push(block);
    else groups.push([block]);
  }
  return (
    <div className="original-copy wrap" data-original-copy={page.route}>
      {groupFinishLists ? groups.map((blocks) => {
        const first = blocks[0];
        if (first.type === "heading" && /^technical specifications?$/i.test(first.text.trim())) {
          return <h2 className="product-specifications-heading" key={first.id}>{first.text}</h2>;
        }
        return first.type === "list" && !first.ordered && first.items.length === 2 ? (
          <div className="series-finish-grid" key={first.id}>
            {blocks.map(block => {
              const firstLine = block.items[0].trim();
              const name = block.items[1].trim();
              const code = firstLine.match(/^([a-z]{1,5}\s*-\s*\d+[a-z]?)(?:\s|$)/i)?.[1];
              const repeatedName = code && firstLine.slice(code.length).trim().toLowerCase() === name.toLowerCase();
              return <div className="series-finish-entry" key={block.id}>
                <strong>{repeatedName || firstLine === code ? code : firstLine}</strong>
                {name.toLowerCase() !== firstLine.toLowerCase() && <span>{name}</span>}
              </div>;
            })}
          </div>
        ) : first.type === "table" ? <ProductSpecificationTable key={first.id} block={first} title={page.title} /> : <OriginalBlocks key={first.id} blocks={blocks} title={page.title} />;
      }) : <OriginalBlocks blocks={page.blocks} title={page.title} />}
    </div>
  );
}

function ProductSpecificationTable({ block, title }: { block: OriginalBlock; title: string }) {
  const rows = block.rows;
  const application = rows[0]?.[0] === "Application" && rows[0].length === 1 && rows[1]?.length === 1 && ["Grade", "Property"].includes(rows[2]?.[0]);
  const coating = rows[0]?.[0] === "Coating" && rows[0].length === 1;
  const colour = rows[0]?.[0] === "Colour Specifications" && rows[0].length === 1;
  const panelThickness = rows[0]?.[0] === "Panel Thickness (LDPE/Mineral/Corrugated)" && rows[0].length === 1;
  const mirrorCoating = coating && rows.length === 3 && rows[1]?.length === 2 && rows[2]?.length === 2 && rows[1][1] === "Bottom Coil";
  const headerIndex = application ? 2 : colour || panelThickness ? 1 : 0;
  const headers = coating ? [] : rows[headerIndex] || [];
  const body = mirrorCoating
    ? rows[1].map((label, index) => [label, rows[2][index]])
    : rows.slice(coating ? 1 : headerIndex + 1);
  const columns = Math.max(headers.length, ...body.map(row => row.length));
  // Remove a stray closing-tag fragment from the imported Wooden Series cell.
  const cellText = (text: string) => text.replace(/\/td>$/, "");
  return <div className={`product-specification-table${application ? " has-application" : ""}${coating ? " is-coating" : ""}`}>
    {application && <div className="spec-application"><span>{rows[0][0]}:</span><strong>{rows[1][0]}</strong></div>}
    {(coating || colour || panelThickness) && <h4 className="spec-table-title">{rows[0][0]}</h4>}
    <div className="original-table" role="region" aria-label={`${title}: ${block.text || (coating ? "Coating" : colour ? "Colour Specifications" : "Technical Specifications")}`} tabIndex={0}>
      <table>
        {block.text && <caption>{block.text}</caption>}
        {headers.length > 0 && <thead><tr>{headers.map((text, i) => <th scope="col" key={i}>{cellText(text)}</th>)}</tr></thead>}
        <tbody>{body.map((row, i) => <tr key={i} className={row.length === 1 && columns > 1 ? "spec-group-row" : undefined}>
          {row.length === 1 && columns > 1 ? <th colSpan={columns}>{cellText(row[0])}</th> : row.map((text, j) => j === 0 ? <th scope="row" key={j}>{cellText(text)}</th> : <td key={j}>{cellText(text)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
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
