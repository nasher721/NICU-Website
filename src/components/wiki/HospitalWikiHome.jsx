import SourceStatus from "./SourceStatus.jsx";
import { buildContentsTree, titleWithoutPart } from "./wiki-model.js";

function ShortcutCard({ shortcut }) {
  return (
    <a className="entry-card" href={shortcut.path}>
      <span className="entry-arrow" aria-hidden="true">↗</span>
      <strong>{shortcut.label}</strong>
      <p>{shortcut.hint}</p>
    </a>
  );
}

function TopicLinks({ items }) {
  if (!items.length) return null;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.path}>{titleWithoutPart(item.title)}</a>
          <TopicLinks items={item.children} />
        </li>
      ))}
    </ul>
  );
}

export default function HospitalWikiHome({ handbook, handbooks, navigation, children }) {
  const chapters = buildContentsTree(navigation.sections);
  return (
    <main className="wiki-main wiki-home" id="wiki-content" data-campus={handbook.id}>
      <div className="wiki-breadcrumbs">
        <a href="/">Faculty wikis</a><span>/</span><span>{handbook.name}</span>
      </div>

      <section className="wiki-home-hero" aria-labelledby={`wiki-home-${handbook.id}`}>
        <div>
          <div className="campus-identity-line">
            <span className="campus-monogram" aria-hidden="true">{handbook.shortName}</span>
            <p className="eyebrow">{handbook.name} · {navigation.sourceStatus.handbookYear} faculty source</p>
          </div>
          <h1 id={`wiki-home-${handbook.id}`}>{handbook.name} faculty wiki</h1>
          <p className="wiki-lede">Find shift setup, workflow, high-stakes pathways, documentation, transitions, and source references for this hospital.</p>
          <a className="home-search-link" href={`#global-search`}>Search {handbook.name} <span aria-hidden="true">↑</span></a>
        </div>
        <div className="source-stamp" aria-label={`${handbook.name} source coverage`}>
          <span>Source coverage</span>
          <strong>{handbook.stats.sections}</strong>
          <small>handbook sections</small>
          <div><span>{handbook.stats.tables} tables</span><span>{handbook.stats.figures} figures</span></div>
        </div>
      </section>

      {handbook.id === "main-campus" && (
        <div className="integrity-banner" role="note">
          <span aria-hidden="true">!</span>
          <p><strong>Source fidelity note:</strong> {navigation.sourceStatus.warning}</p>
        </div>
      )}

      <section className="entry-section" aria-labelledby={`shortcuts-${handbook.id}`}>
        <div className="section-heading">
          <div><p className="eyebrow">Start by task</p><h2 id={`shortcuts-${handbook.id}`}>Task shortcuts</h2></div>
          <span>Reviewed links into this hospital handbook</span>
        </div>
        <div className="entry-grid">
          {navigation.shortcuts.map((shortcut) => <ShortcutCard shortcut={shortcut} key={shortcut.id} />)}
        </div>
      </section>

      <section className="topic-index" aria-labelledby={`topic-index-${handbook.id}`}>
        <div className="section-heading">
          <div><p className="eyebrow">Handbook contents</p><h2 id={`topic-index-${handbook.id}`}>Complete chapter and topic index</h2></div>
          <span>{navigation.sections.length} linked sections</span>
        </div>
        <div className="topic-index-grid">
          {chapters.map((chapter, index) => (
            <section className="topic-index-card" key={chapter.id}>
              <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
              <h3><a href={chapter.path}>{titleWithoutPart(chapter.title)}</a></h3>
              <TopicLinks items={chapter.children} />
            </section>
          ))}
        </div>
      </section>

      {children}

      <SourceStatus handbook={handbook} status={navigation.sourceStatus} />

      <section className="source-section" aria-labelledby={`other-campus-${handbook.id}`}>
        <div className="section-heading">
          <div><p className="eyebrow">Hospital sources</p><h2 id={`other-campus-${handbook.id}`}>Keep the campus visible.</h2></div>
        </div>
        <div className="source-grid">
          {handbooks.map((source) => (
            <a href={`/${source.id}`} className={source.id === handbook.id ? "active" : ""} aria-current={source.id === handbook.id ? "page" : undefined} key={source.id}>
              <span className="campus-monogram" aria-hidden="true">{source.shortName}</span>
              <div><strong>{source.name}</strong><p>{source.sourceLabel}</p><small>{source.stats.sections} sections · {source.stats.tables} tables · {source.stats.figures} figures</small></div>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
