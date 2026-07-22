"use client";

import { useState } from "react";
import { titleWithoutPart } from "./wiki-model.js";

export default function FigureCard({ figure, handbook, eager = false }) {
  const [failed, setFailed] = useState(false);
  const title = titleWithoutPart(figure.sectionTitle);
  return (
    <a className="figure-card" href={figure.path}>
      <figure>
        <div className="figure-image-wrap">
          {!failed && figure.src
            ? (
              <img
                src={figure.src}
                alt={figure.alt || `${handbook.name}: ${title} — source handbook figure`}
                loading={eager ? "eager" : "lazy"}
                onError={() => setFailed(true)}
              />
            )
            : (
              <div
                className="missing-figure-placeholder"
                role="img"
                aria-label={figure.alt || `${handbook.name}: ${title} figure unavailable`}
              >
                Source figure unavailable
              </div>
            )}
        </div>
        <figcaption>
          <span>{handbook.shortName} · Source figure</span>
          <strong>{title}</strong>
          <small>{figure.sourceLocation} · Open the source section <span aria-hidden="true">↗</span></small>
        </figcaption>
      </figure>
    </a>
  );
}
