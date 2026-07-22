"use client";

import { useState } from "react";
import { groupContentBlocks } from "./wiki-model.js";

function ProseBlock({ block }) {
  return <p>{block.text}</p>;
}

function ListBlock({ block }) {
  return <ul>{block.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
}

function TableBlock({ block, label, smartPhrase }) {
  const [header = [], ...rows] = block.rows ?? [];
  const hasHeader = rows.length > 0;
  const bodyRows = hasHeader ? rows : [header];
  return (
    <div className="table-wrap" tabIndex="0" role="region" aria-label={`Scrollable table: ${label}`}>
      <table>
        {hasHeader && <thead>
          <tr>{header.map((cell, cellIndex) => <th key={`${cell}-${cellIndex}`} scope="col">{cell || "—"}</th>)}</tr>
        </thead>}
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => (
              <td key={cellIndex}>{smartPhrase ? <pre className="smartphrase-block"><code>{cell}</code></pre> : cell}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FigureBlock({ block, label, sourceLabel, sourceLocation }) {
  const [failed, setFailed] = useState(false);
  const missing = !block.src || failed;
  const caption = `${label} · Figure from the source handbook${sourceLabel ? ` · ${sourceLabel}` : ""}${sourceLocation ? ` · ${sourceLocation}` : ""}`;
  return (
    <figure className={missing ? "source-figure missing-figure" : "source-figure"}>
      {!missing
        ? <img src={block.src} alt={block.alt || `${label} — source handbook figure`} loading="lazy" onError={() => setFailed(true)} />
        : <div className="missing-figure-placeholder" role="img" aria-label={block.alt || `${label} figure unavailable`}>Source figure unavailable</div>}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function ContentBlocks({ blocks, contentType, smartPhraseContext = false, figureContext, sourceLabel, sourceLocation }) {
  const smartPhraseTable = smartPhraseContext && contentType === "reference-table";
  return groupContentBlocks(blocks).map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "paragraph") return <ProseBlock block={block} key={key} />;
    if (block.type === "list") return <ListBlock block={block} key={key} />;
    if (block.type === "table") return <TableBlock block={block} key={key} label={figureContext} smartPhrase={smartPhraseTable} />;
    if (block.type === "image") return <FigureBlock block={block} key={key} label={figureContext} sourceLabel={sourceLabel} sourceLocation={sourceLocation} />;
    return null;
  });
}
