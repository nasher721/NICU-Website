"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SourceStatus from "./SourceStatus.jsx";
import { buildContentsTree, titleWithoutPart } from "./wiki-model.js";

function ContentsBranch({ items, selectedSlug, onNavigate, depth = 0 }) {
  if (!items.length) return null;
  return (
    <ul className={`contents-level contents-level-${Math.min(depth + 1, 3)}`}>
      {items.map((item, index) => {
        const current = selectedSlug === item.slug;
        return (
          <li key={item.id}>
            <a
              className={current ? "active" : undefined}
              aria-current={current ? "page" : undefined}
              href={item.path}
              onClick={onNavigate}
            >
              {depth === 0 && <span className="section-number">{String(index + 1).padStart(2, "0")}</span>}
              <span>{titleWithoutPart(item.title)}</span>
            </a>
            <ContentsBranch items={item.children} selectedSlug={selectedSlug} onNavigate={onNavigate} depth={depth + 1} />
          </li>
        );
      })}
    </ul>
  );
}

function ContentsNav({ handbook, navigation, selectedSlug, utilityPage, onNavigate }) {
  const tree = useMemo(() => buildContentsTree(navigation.sections), [navigation.sections]);
  const homeCurrent = !selectedSlug && !utilityPage;
  return (
    <nav aria-label={`${handbook.name} handbook contents`}>
      <ul className="contents-utilities">
        <li>
          <a
            className={homeCurrent ? "active" : undefined}
            aria-current={homeCurrent ? "page" : undefined}
            href={`/${handbook.id}`}
            onClick={onNavigate}
          >
            <span aria-hidden="true">⌂</span><span>Campus overview</span>
          </a>
        </li>
        <li>
          <a
            className={utilityPage === "figures" ? "active" : undefined}
            aria-current={utilityPage === "figures" ? "page" : undefined}
            href="/figures"
            onClick={onNavigate}
          >
            <span aria-hidden="true">▧</span><span>Source figures</span>
          </a>
        </li>
      </ul>
      <ContentsBranch items={tree} selectedSlug={selectedSlug} onNavigate={onNavigate} />
    </nav>
  );
}

function CampusIdentity({ handbook }) {
  return (
    <div className="sidebar-campus" data-campus={handbook.id}>
      <span className="campus-monogram" aria-hidden="true">{handbook.shortName}</span>
      <div><strong>{handbook.name}</strong><small>Faculty orientation · 2026</small></div>
    </div>
  );
}

export default function WikiContents({ handbook, navigation, selectedSlug, utilityPage }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerId = `mobile-wiki-contents-${handbook.id}`;

  const closeDrawer = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktopQuery = window.matchMedia("(min-width: 769px)");

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onBreakpointChange = () => {
      if (desktopQuery.matches) closeDrawer(false);
    };

    document.addEventListener("keydown", onKeyDown);
    desktopQuery.addEventListener("change", onBreakpointChange);
    onBreakpointChange();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktopQuery.removeEventListener("change", onBreakpointChange);
    };
  }, [open]);

  return (
    <>
      <aside className="wiki-sidebar wiki-contents-desktop">
        <CampusIdentity handbook={handbook} />
        <ContentsNav
          handbook={handbook}
          navigation={navigation}
          selectedSlug={selectedSlug}
          utilityPage={utilityPage}
        />
        <SourceStatus handbook={handbook} status={navigation.sourceStatus} compact />
      </aside>

      <div className="wiki-contents-mobile">
        <button
          className="sidebar-toggle"
          type="button"
          aria-controls={drawerId}
          aria-expanded={open}
          ref={triggerRef}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          Browse {handbook.name} contents
        </button>
        <div
          className="wiki-drawer-backdrop"
          hidden={!open}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            className="wiki-sidebar wiki-contents-drawer"
            id={drawerId}
            role="dialog"
            aria-modal={open ? "true" : undefined}
            aria-label={`${handbook.name} handbook contents drawer`}
            ref={drawerRef}
          >
            <div className="drawer-heading">
              <CampusIdentity handbook={handbook} />
              <button className="drawer-close" type="button" ref={closeRef} onClick={() => closeDrawer()}>
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            <ContentsNav
              handbook={handbook}
              navigation={navigation}
              selectedSlug={selectedSlug}
              utilityPage={utilityPage}
              onNavigate={() => closeDrawer(false)}
            />
            <SourceStatus handbook={handbook} status={navigation.sourceStatus} compact />
          </aside>
        </div>
      </div>
    </>
  );
}
