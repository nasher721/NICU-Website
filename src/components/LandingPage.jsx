"use client";

import { useEffect, useState } from "react";
import Brand from "./Brand.jsx";
import EyeField from "./EyeField.jsx";
import HospitalChooser from "./wiki/HospitalChooser.jsx";

const landingLinks = [
  { label: "Faculty wiki", hint: "Choose a hospital", href: "/main-campus", position: "north" },
  { label: "First shift", hint: "Start ready", href: "/akron/start-here-first-shift-navigation", position: "west" },
  { label: "Urgent pathways", hint: "Escalation and transfer", href: "/akron/part-5-emergency-transfers-and-ecmo", position: "east" },
  { label: "Source figures", hint: "Browse handbook images", href: "/figures", position: "south" },
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
    <nav className="eye-orbit-nav" aria-label="Secondary navigation">
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

export default function LandingPage() {
  const [showEyeField, setShowEyeField] = useState(false);
  const links = landingLinks.map(({ label, href }) => [label, href]);

  useEffect(() => setShowEyeField(true), []);

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
          <div className="hero-copy" id="overview">
            <p className="hero-kicker">2026 Faculty Orientation Resource</p>
            <h1 id="campaign-title">
              <span>NEUROCRITICAL</span>
              <span>CARE <em>knowledge</em></span>
              <span className="bold-line">// ATLAS</span>
            </h1>
          </div>
          <HospitalChooser />
          {showEyeField ? (
            <EyeField />
          ) : (
            <div className="eye-field" aria-hidden="true" data-seed="24719" data-motion="reduced" />
          )}
          <EyeOrbitNavigation />
          <div className="slide-marker" aria-label="Two campuses, one knowledge resource">(MC + AK)</div>
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
