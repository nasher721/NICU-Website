"use client";

import ContentBlocks from "./ContentBlocks.jsx";
import SourceStatus from "./SourceStatus.jsx";
import { getAncestors, getArticleSections, titleWithoutPart } from "./wiki-model.js";

export default function ArticlePage({ handbook, navigation, section }) {
  const sections = getArticleSections(handbook, section);
  const ancestors = getAncestors(handbook, section);
  const smartPhraseContext = section.contentType === "smartphrase" || ancestors.some((item) => item.contentType === "smartphrase");
  const warningLabel = handbook.id === "main-campus" ? "Source fidelity note" : "Operational reminder";

  return (
    <main className="wiki-main article-layout" id="wiki-content" data-campus={handbook.id}>
      <article className="wiki-article">
        <div className="wiki-breadcrumbs">
          <a href="/">Faculty wikis</a><span>/</span><a href={`/${handbook.id}`}>{handbook.name}</a>
          {ancestors.map((ancestor) => (
            <span key={ancestor.id}>/ <a href={ancestor.path}>{titleWithoutPart(ancestor.title)}</a></span>
          ))}
          <span>/</span><span aria-current="page">{titleWithoutPart(section.title)}</span>
        </div>

        <header className="article-header">
          <div className="campus-identity-line">
            <span className="campus-monogram" aria-hidden="true">{handbook.shortName}</span>
            <p className="eyebrow">{handbook.name} · {section.contentType.replace("-", " ")}</p>
          </div>
          <h1>{titleWithoutPart(section.title)}</h1>
          <div className="article-meta">
            <span>{navigation.sourceStatus.handbookYear} orientation source</span>
            <span>{sections.length} section{sections.length === 1 ? "" : "s"}</span>
            <span>Source section {section.source.sectionOrder + 1}</span>
            <button type="button" onClick={() => window.print()}>Print article</button>
          </div>
        </header>

        <div className={`clinical-disclaimer ${handbook.id === "main-campus" ? "clinical-disclaimer-fidelity" : ""}`} role="note">
          <strong>{warningLabel}:</strong> {navigation.sourceStatus.warning}
        </div>

        <div className="article-content">
          {sections.map((articleSection, index) => {
            const Heading = articleSection.level === 2 ? "h2" : "h3";
            return (
              <section id={articleSection.slug} key={articleSection.id} className={`article-section level-${articleSection.level}`}>
                {index > 0 && <Heading>{titleWithoutPart(articleSection.title)}</Heading>}
                <ContentBlocks
                  blocks={articleSection.blocks}
                  contentType={articleSection.contentType}
                  smartPhraseContext={smartPhraseContext}
                  figureContext={`${handbook.name}: ${titleWithoutPart(articleSection.title)}`}
                  sourceLabel={handbook.sourceLabel}
                  sourceLocation={articleSection.source.headingKey}
                />
              </section>
            );
          })}
        </div>

        <SourceStatus handbook={handbook} status={navigation.sourceStatus} showWarning={false} />

        <footer className="article-footer">
          <p>Source: <strong>{handbook.sourceLabel}</strong> · {handbook.sourceFile}</p>
          <a href={`/${handbook.id}`}>Back to {handbook.name} overview</a>
        </footer>
      </article>

      <aside className="article-toc" aria-label="On this page">
        <strong>On this page</strong>
        <nav>
          {sections.slice(1).map((item) => (
            <a key={item.id} className={`toc-level-${item.level}`} href={`#${item.slug}`}>
              {titleWithoutPart(item.title)}
            </a>
          ))}
        </nav>
        <div className="toc-source">
          <span aria-hidden="true">{handbook.shortName}</span>
          <p>Extracted from the supplied {navigation.sourceStatus.handbookYear} faculty handbook.</p>
        </div>
      </aside>
    </main>
  );
}
