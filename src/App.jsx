"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EyeField from "./components/EyeField";
import handbookData from "./data/handbooks.json";

const SOURCE_WARNING =
  "Operational contacts, schedules, policies, and pathways can change. Confirm time-sensitive details in current Cleveland Clinic systems.";

const entryPointPatterns = [
  { label: "First shift", hint: "Set up, orient, and avoid common first-week misses", pattern: /first.shift navigation/i },
  { label: "Urgent pathways", hint: "Transfers, stroke, ECMO, and escalation", pattern: /emergency transfers/i },
  { label: "Daily workflow", hint: "Rounds, response expectations, and service rhythm", pattern: /daily workflow/i },
  { label: "Documentation", hint: "Required notes, scores, billing, and quality", pattern: /documentation.*quality/i },
  { label: "Transitions", hint: "Level of care and transfer responsibilities", pattern: /transitions of care/i },
  { label: "SmartPhrases", hint: "Assessment, transfer, and attestation templates", pattern: /smartphrase library/i },
];

const landingLinks = [
  { label: "Faculty wiki", hint: "Search both campuses", href: "#/wiki", position: "north" },
  { label: "First shift", hint: "Start ready", href: "#/wiki/akron/start-here-first-shift-navigation", position: "west" },
  { label: "Urgent pathways", hint: "Escalation and transfer", href: "#/wiki/akron/part-5-emergency-transfers-and-ecmo", position: "east" },
  { label: "Source figures", hint: "Browse handbook images", href: "#/wiki/figures", position: "south" },
];

function pointEyeAt(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent("faculty-eye-gaze", {
    detail: {
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      locked: true,
    },
  }));
}

function releaseEye() {
  window.dispatchEvent(new CustomEvent("faculty-eye-gaze", { detail: { locked: false } }));
}

function EyeOrbitNavigation() {
  return (
    <nav className="eye-orbit-nav" aria-label="Explore the faculty resource">
      {landingLinks.map((link, index) => (
        <a
          className={`eye-orbit-link orbit-${link.position}`}
          href={link.href}
          key={link.label}
          onPointerEnter={pointEyeAt}
          onPointerLeave={releaseEye}
          onFocus={pointEyeAt}
          onBlur={releaseEye}
        >
          <span className="orbit-index">0{index + 1}</span>
          <span><strong>{link.label}</strong><small>{link.hint}</small></span>
          <span className="orbit-arrow" aria-hidden="true">↗</span>
        </a>
      ))}
    </nav>
  );
}

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [parts, setParts] = useState([]);

  useEffect(() => {
    const onChange = () => setParts(read());
    onChange();
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return parts;
}

function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? "brand-compact" : ""}`} href="#/" aria-label="Cleveland Clinic, return to landing page">
      <img src="/cleveland-clinic-symbol.png" alt="" width="42" height="24" />
      <span>
        <strong>Cleveland Clinic</strong>
        <small>Neurocritical Care</small>
      </span>
    </a>
  );
}

function LandingPage() {
  const links = landingLinks.map(({ label, href }) => [label, href]);

  return (
    <>
      <a className="skip-link" href="#landing-main">Skip to main content</a>
      <main className="campaign" id="landing-main">
        <header className="site-header">
          <Brand />
          <nav className="desktop-nav" aria-label="Primary navigation">
            <ul>
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href}><span>{label}</span><span aria-hidden="true">↗</span></a>
                </li>
              ))}
            </ul>
          </nav>
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Mobile navigation">
              {links.map(([label, href]) => <a key={label} href={href}>{label} <span aria-hidden="true">↗</span></a>)}
            </nav>
          </details>
        </header>

        <section className="hero" aria-labelledby="campaign-title">
          <EyeField />
          <EyeOrbitNavigation />
          <div className="hero-copy" id="overview">
            <p className="hero-kicker">2026 Faculty Orientation Resource</p>
            <h1 id="campaign-title">
              <span>NEUROCRITICAL</span>
              <span>CARE <em>knowledge</em></span>
              <span className="bold-line">// ATLAS</span>
            </h1>
          </div>
          <div className="slide-marker" aria-label="Two campuses, one knowledge resource">(MC + AK)</div>
          <aside className="supporting-copy" aria-label="Resource introduction">
            <p>A searchable, shift-ready guide built from the Main Campus and Akron faculty orientation handbooks.</p>
            <a className="cta" href="#/wiki">
              <span>Open the faculty wiki</span>
              <span className="cta-arrow" aria-hidden="true">↗</span>
            </a>
          </aside>
          <div className="landing-proof" aria-label="Resource coverage">
            <span><strong>161</strong> sections</span>
            <span><strong>111</strong> reference tables</span>
            <span><strong>2</strong> campus sources</span>
          </div>
          <div className="scroll-indicator" aria-hidden="true"><span /></div>
        </section>
      </main>
    </>
  );
}

function campusUrl(campus, slug = "") {
  return `#/wiki/${campus}${slug ? `/${slug}` : ""}`;
}

function titleWithoutPart(title) {
  return title
    .replace(/^KEEP THIS PAGE HANDY\s*·\s*/i, "")
    .replace(/^PART \d+\s*·\s*/i, "")
    .replace(/^APPENDIX [A-Z]\s*·\s*/i, "");
}

function getAncestors(handbook, section) {
  const ancestors = [];
  let cursor = section;
  while (cursor?.parent) {
    cursor = handbook.sections.find((item) => item.slug === cursor.parent);
    if (cursor) ancestors.unshift(cursor);
  }
  return ancestors;
}

function getArticleSections(handbook, selected) {
  const start = selected.order;
  const results = [selected];
  for (let index = start + 1; index < handbook.sections.length; index += 1) {
    const candidate = handbook.sections[index];
    if (candidate.level <= selected.level) break;
    results.push(candidate);
  }
  return results;
}

function groupBlocks(blocks) {
  const grouped = [];
  for (const block of blocks) {
    if (block.type === "list-item") {
      const previous = grouped[grouped.length - 1];
      if (previous?.type === "list") previous.items.push(block.text);
      else grouped.push({ type: "list", items: [block.text] });
    } else grouped.push(block);
  }
  return grouped;
}

function ContentBlocks({ blocks, figureContext }) {
  return groupBlocks(blocks).map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "paragraph") return <p key={key}>{block.text}</p>;
    if (block.type === "list") return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    if (block.type === "image") {
      return (
        <figure key={key} className="source-figure">
          <img src={block.src} alt={`${figureContext} — source handbook figure`} loading="lazy" />
          <figcaption>{figureContext} · Figure from the source handbook</figcaption>
        </figure>
      );
    }
    if (block.type === "table") {
      const [header, ...rows] = block.rows;
      return (
        <div className="table-wrap" key={key} tabIndex="0" aria-label="Scrollable reference table">
          <table>
            <thead><tr>{header.map((cell, cellIndex) => <th key={`${cell}-${cellIndex}`} scope="col">{cell || "—"}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return null;
  });
}

function SearchBox({ handbooks, onNavigate }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (normalized.length < 2) return [];
    return handbooks
      .flatMap((handbook) => handbook.sections.map((section) => ({ handbook, section })))
      .filter(({ section }) => section.searchText.includes(normalized))
      .sort((a, b) => {
        const aTitle = a.section.title.toLowerCase().includes(normalized) ? 0 : 1;
        const bTitle = b.section.title.toLowerCase().includes(normalized) ? 0 : 1;
        return aTitle - bTitle || a.section.order - b.section.order;
      })
      .slice(0, 10);
  }, [handbooks, normalized]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const choose = (handbook, section) => {
    setQuery("");
    onNavigate(handbook.id, section.slug);
  };

  return (
    <div className="wiki-search">
      <span className="search-mark" aria-hidden="true">⌕</span>
      <label className="sr-only" htmlFor="global-search">Search both handbooks</label>
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        placeholder="Search pathways, contacts, SmartPhrases…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      <kbd>/</kbd>
      {normalized.length >= 2 && (
        <div className="search-results" role="listbox" aria-label="Search results">
          <div className="search-summary">{results.length ? `Top ${results.length} matches` : "No matches found"}</div>
          {results.map(({ handbook, section }) => (
            <button key={`${handbook.id}-${section.slug}`} type="button" onClick={() => choose(handbook, section)}>
              <span>{section.title}</span>
              <small>{handbook.shortName} · {titleWithoutPart(getAncestors(handbook, section)[0]?.title || "Overview")}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WikiHeader({ handbooks, activeCampus, onCampusChange, onNavigate }) {
  return (
    <header className="wiki-header">
      <div className="wiki-branding">
        <Brand compact />
        <a className="wiki-title" href="#/wiki">
          <span>Faculty Wiki</span>
          <small>Orientation · 2026</small>
        </a>
      </div>
      <SearchBox handbooks={handbooks} onNavigate={onNavigate} />
      <label className="campus-picker">
        <span>Campus</span>
        <select value={activeCampus} onChange={(event) => onCampusChange(event.target.value)}>
          {handbooks.map((handbook) => <option key={handbook.id} value={handbook.id}>{handbook.name}</option>)}
        </select>
      </label>
    </header>
  );
}

function WikiSidebar({ handbook, selectedSlug, utilityPage, onNavigate }) {
  const topSections = handbook.sections.filter((section) => section.level === 1);
  return (
    <aside className="wiki-sidebar">
      <div className="sidebar-campus">
        <span className="campus-monogram">{handbook.shortName}</span>
        <div><strong>{handbook.name}</strong><small>Faculty orientation</small></div>
      </div>
      <nav aria-label={`${handbook.name} handbook sections`}>
        <a className={!selectedSlug ? "active" : ""} href={campusUrl(handbook.id)}>
          <span aria-hidden="true">⌂</span> Campus overview
        </a>
        <a className={utilityPage === "figures" ? "active" : ""} href="#/wiki/figures">
          <span aria-hidden="true">▧</span> Source figures
        </a>
        {topSections.map((section, index) => (
          <a
            className={selectedSlug === section.slug ? "active" : ""}
            href={campusUrl(handbook.id, section.slug)}
            key={section.slug}
            onClick={() => onNavigate?.()}
          >
            <span className="section-number">{String(index + 1).padStart(2, "0")}</span>
            {titleWithoutPart(section.title)}
          </a>
        ))}
      </nav>
      <div className="sidebar-note">
        <strong>Point-of-care reminder</strong>
        <p>{SOURCE_WARNING}</p>
      </div>
    </aside>
  );
}

function EntryCard({ item, handbook }) {
  const section = handbook.sections.find((candidate) => item.pattern.test(candidate.title));
  if (!section) return null;
  return (
    <a className="entry-card" href={campusUrl(handbook.id, section.slug)}>
      <span className="entry-arrow" aria-hidden="true">↗</span>
      <strong>{item.label}</strong>
      <p>{item.hint}</p>
    </a>
  );
}

function getFigures(handbooks) {
  return handbooks.flatMap((handbook) => {
    let figureIndex = 0;
    return handbook.sections.flatMap((section) =>
      section.blocks
        .filter((block) => block.type === "image")
        .map((block) => ({ handbook, section, block, index: figureIndex++ })),
    );
  });
}

function FigureCard({ figure, eager = false }) {
  const title = titleWithoutPart(figure.section.title);
  return (
    <a className="figure-card" href={campusUrl(figure.handbook.id, figure.section.slug)}>
      <figure>
        <div className="figure-image-wrap">
          <img
            src={figure.block.src}
            alt={`${figure.handbook.name}: ${title} — source handbook figure`}
            loading={eager ? "eager" : "lazy"}
          />
        </div>
        <figcaption>
          <span>{figure.handbook.shortName} · Figure {figure.index + 1}</span>
          <strong>{title}</strong>
          <small>Open the source section <span aria-hidden="true">↗</span></small>
        </figcaption>
      </figure>
    </a>
  );
}

function FigurePreview({ handbook }) {
  const figures = getFigures([handbook]);
  return (
    <section className="figures-preview" aria-labelledby="figures-preview-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Visual reference</p><h2 id="figures-preview-heading">Figures from the handbook</h2></div>
        <a href="#/wiki/figures">View all {figures.length} figures ↗</a>
      </div>
      <div className="figure-preview-grid">
        {figures.slice(0, 4).map((figure, index) => <FigureCard key={`${figure.handbook.id}-${figure.section.slug}-${index}`} figure={figure} />)}
      </div>
    </section>
  );
}

function WikiHome({ handbook, handbooks }) {
  const topSections = handbook.sections.filter((section) => section.level === 1);
  return (
    <main className="wiki-main wiki-home" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href="#/wiki">Faculty Wiki</a><span>/</span><span>{handbook.name}</span></div>
      <section className="wiki-home-hero">
        <div>
          <p className="eyebrow">{handbook.name} · 2026 source</p>
          <h1>Find the answer before the next decision.</h1>
          <p className="wiki-lede">A practical faculty reference for first-shift setup, clinical workflow, high-stakes pathways, documentation, and transitions of care.</p>
        </div>
        <div className="source-stamp">
          <span>Source coverage</span>
          <strong>{handbook.stats.sections}</strong>
          <small>searchable sections</small>
          <div><span>{handbook.stats.tables} tables</span><span>{handbook.stats.figures} figures</span></div>
        </div>
      </section>

      {handbook.id === "main-campus" && (
        <div className="integrity-banner" role="note">
          <span aria-hidden="true">!</span>
          <p><strong>Source fidelity note:</strong> the supplied Main Campus document contains Akron General labels and pathways. They are preserved as written and should be verified before campus-specific use.</p>
        </div>
      )}

      <section className="entry-section" aria-labelledby="start-heading">
        <div className="section-heading"><div><p className="eyebrow">Start by task</p><h2 id="start-heading">Shift-ready entry points</h2></div><span>Choose what you need now</span></div>
        <div className="entry-grid">{entryPointPatterns.map((item) => <EntryCard key={item.label} item={item} handbook={handbook} />)}</div>
      </section>

      <section className="browse-section" aria-labelledby="browse-heading">
        <div className="section-heading"><div><p className="eyebrow">Handbook atlas</p><h2 id="browse-heading">Browse all major topics</h2></div><span>{topSections.length} chapters</span></div>
        <div className="chapter-list">
          {topSections.map((section, index) => {
            const children = handbook.sections.filter((candidate) => candidate.parent === section.slug);
            return (
              <a href={campusUrl(handbook.id, section.slug)} key={section.slug}>
                <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{titleWithoutPart(section.title)}</strong><small>{children.slice(0, 3).map((child) => child.title).join(" · ")}</small></div>
                <span className="chapter-count">{children.length} topics</span>
              </a>
            );
          })}
        </div>
      </section>

      <FigurePreview handbook={handbook} />

      <section className="source-section" id="sources" aria-labelledby="source-heading">
        <div className="section-heading"><div><p className="eyebrow">Source library</p><h2 id="source-heading">Two handbooks, one search</h2></div></div>
        <div className="source-grid">
          {handbooks.map((source) => (
            <a href={campusUrl(source.id)} className={source.id === handbook.id ? "active" : ""} key={source.id}>
              <span className="campus-monogram">{source.shortName}</span>
              <div><strong>{source.name}</strong><p>{source.sourceLabel}</p><small>{source.stats.sections} sections · {source.stats.tables} tables · {source.stats.figures} figures</small></div>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <p className="source-caution">{SOURCE_WARNING}</p>
      </section>
    </main>
  );
}

function ArticlePage({ handbook, section }) {
  const sections = getArticleSections(handbook, section);
  const ancestors = getAncestors(handbook, section);
  return (
    <main className="wiki-main article-layout" id="wiki-content">
      <article className="wiki-article">
        <div className="wiki-breadcrumbs">
          <a href="#/wiki">Faculty Wiki</a><span>/</span><a href={campusUrl(handbook.id)}>{handbook.name}</a>
          {ancestors.map((ancestor) => <span key={ancestor.slug}>/ <a href={campusUrl(handbook.id, ancestor.slug)}>{titleWithoutPart(ancestor.title)}</a></span>)}
        </div>
        <header className="article-header">
          <p className="eyebrow">{handbook.name} handbook</p>
          <h1>{titleWithoutPart(section.title)}</h1>
          <div className="article-meta">
            <span>2026 orientation source</span><span>{sections.length} section{sections.length === 1 ? "" : "s"}</span><button type="button" onClick={() => window.print()}>Print article</button>
          </div>
        </header>
        <div className="clinical-disclaimer"><strong>Clinical reference:</strong> {SOURCE_WARNING}</div>
        <div className="article-content">
          {sections.map((articleSection, index) => {
            const Heading = index === 0 ? "div" : articleSection.level === 2 ? "h2" : "h3";
            return (
              <section id={articleSection.slug} key={articleSection.slug} className={`article-section level-${articleSection.level}`}>
                {index > 0 && <Heading>{titleWithoutPart(articleSection.title)}</Heading>}
                <ContentBlocks blocks={articleSection.blocks} figureContext={`${handbook.name}: ${titleWithoutPart(articleSection.title)}`} />
              </section>
            );
          })}
        </div>
        <footer className="article-footer">
          <p>Source: <strong>{handbook.sourceLabel}</strong></p>
          <a href={campusUrl(handbook.id)}>Back to {handbook.name} overview</a>
        </footer>
      </article>
      <aside className="article-toc" aria-label="On this page">
        <strong>On this page</strong>
        <nav>{sections.slice(1).map((item) => (
          <a
            key={item.slug}
            className={`toc-level-${item.level}`}
            href={campusUrl(handbook.id, section.slug)}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(item.slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {titleWithoutPart(item.title)}
          </a>
        ))}</nav>
        <div className="toc-source"><span>{handbook.shortName}</span><p>Extracted from the supplied 2026 faculty handbook.</p></div>
      </aside>
    </main>
  );
}

function SourcesPage({ handbooks }) {
  return (
    <main className="wiki-main sources-page" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href="#/wiki">Faculty Wiki</a><span>/</span><span>Sources</span></div>
      <p className="eyebrow">Source library</p>
      <h1>About this faculty wiki</h1>
      <p className="wiki-lede">This site converts the supplied 2026 Word handbooks into a searchable, cross-campus reference while preserving the source language, tables, and figures.</p>
      <div className="source-grid expanded">
        {handbooks.map((source) => (
          <a href={campusUrl(source.id)} key={source.id}>
            <span className="campus-monogram">{source.shortName}</span>
            <div><strong>{source.sourceLabel}</strong><p>{source.sourceFile}</p><small>{source.stats.sections} sections · {source.stats.tables} tables · {source.stats.figures} figures</small></div>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      <a className="source-figures-link" href="#/wiki/figures">Browse every source figure <span aria-hidden="true">↗</span></a>
      <section className="editorial-policy">
        <h2>How to use it</h2>
        <div><strong>Search broadly</strong><p>The search bar checks headings, prose, lists, and reference tables across both campuses.</p></div>
        <div><strong>Check the campus</strong><p>Every article identifies its source campus. The Main Campus file contains some Akron General language, which is flagged rather than silently rewritten.</p></div>
        <div><strong>Verify live operations</strong><p>{SOURCE_WARNING}</p></div>
      </section>
    </main>
  );
}

function FiguresPage({ handbooks }) {
  const [campus, setCampus] = useState("all");
  const figures = getFigures(handbooks);
  const visibleFigures = campus === "all" ? figures : figures.filter((figure) => figure.handbook.id === campus);

  return (
    <main className="wiki-main figures-page" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href="#/wiki">Faculty Wiki</a><span>/</span><span>Source figures</span></div>
      <header className="figures-header">
        <div>
          <p className="eyebrow">Visual source library</p>
          <h1>Figures from both faculty handbooks.</h1>
          <p className="wiki-lede">Every embedded source image is presented here and linked back to the handbook section where it appears.</p>
        </div>
        <div className="figure-count"><strong>{visibleFigures.length}</strong><span>figures shown</span></div>
      </header>
      <div className="figure-filters" aria-label="Filter figures by campus">
        <button className={campus === "all" ? "active" : ""} type="button" onClick={() => setCampus("all")}>All campuses <span>{figures.length}</span></button>
        {handbooks.map((handbook) => (
          <button className={campus === handbook.id ? "active" : ""} type="button" onClick={() => setCampus(handbook.id)} key={handbook.id}>
            {handbook.name} <span>{getFigures([handbook]).length}</span>
          </button>
        ))}
      </div>
      <div className="figure-library-grid">
        {visibleFigures.map((figure, index) => <FigureCard key={`${figure.handbook.id}-${figure.section.slug}-${index}`} figure={figure} eager={index < 3} />)}
      </div>
    </main>
  );
}

function WikiApp({ route }) {
  const handbooks = handbookData.handbooks;
  const requestedCampus = route[1];
  const activeCampus = handbooks.some((item) => item.id === requestedCampus) ? requestedCampus : "main-campus";
  const handbook = handbooks.find((item) => item.id === activeCampus);
  const slug = route[2];
  const selected = handbook.sections.find((section) => section.slug === slug);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (campus, nextSlug = "") => {
    window.location.hash = `/wiki/${campus}${nextSlug ? `/${nextSlug}` : ""}`;
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useEffect(() => {
    document.title = selected ? `${titleWithoutPart(selected.title)} | Faculty Wiki` : "Neurocritical Care Faculty Wiki";
  }, [selected]);

  return (
    <div className="wiki-shell">
      <a className="skip-link wiki-skip" href="#wiki-content">Skip to article</a>
      <WikiHeader handbooks={handbooks} activeCampus={activeCampus} onCampusChange={navigate} onNavigate={navigate} />
      <button className="sidebar-toggle" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-expanded={sidebarOpen}>
        <span aria-hidden="true">☰</span> Browse handbook
      </button>
      <div className="wiki-body">
        <div className={`sidebar-wrap ${sidebarOpen ? "open" : ""}`}><WikiSidebar handbook={handbook} selectedSlug={selected?.slug} utilityPage={route[1]} onNavigate={() => setSidebarOpen(false)} /></div>
        {route[1] === "sources" ? <SourcesPage handbooks={handbooks} /> : route[1] === "figures" ? <FiguresPage handbooks={handbooks} /> : selected ? <ArticlePage handbook={handbook} section={selected} /> : <WikiHome handbook={handbook} handbooks={handbooks} />}
      </div>
      <footer className="wiki-footer"><span>Neurocritical Care Faculty Wiki</span><span>Built from supplied 2026 orientation sources</span><a href="#/">Return to landing page</a></footer>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  useEffect(() => {
    const socialImage = document.querySelector('meta[property="og:image"]');
    if (socialImage) socialImage.setAttribute("content", new URL("/og.png", window.location.origin).href);
    const socialUrl = document.querySelector('meta[property="og:url"]');
    if (socialUrl) socialUrl.setAttribute("content", window.location.href);
  }, [route]);
  return route[0] === "wiki" ? <WikiApp route={route} /> : <LandingPage />;
}
