"use client";

import { useEffect, useMemo, useState } from "react";
import Brand from "./Brand.jsx";
import EyeField from "./EyeField.jsx";
import HospitalChooser from "./wiki/HospitalChooser.jsx";
import { CAMPUS_PREFERENCE_KEY, DEFAULT_CAMPUS, isCampusId } from "../routing/routes.js";

const secondaryTargets = {
  "first-shift": "start-here-first-shift-navigation",
  "urgent-pathways": "part-5-emergency-transfers-and-ecmo",
};

function buildSecondaryLinks(preferredCampus) {
  const campus = isCampusId(preferredCampus) ? preferredCampus : DEFAULT_CAMPUS;
  return [
    { label: "First shift", hint: "Start-ready orientation", href: `/${campus}/${secondaryTargets["first-shift"]}` },
    { label: "Urgent pathways", hint: "Escalation and transfer", href: `/${campus}/${secondaryTargets["urgent-pathways"]}` },
    { label: "Source figures", hint: "Handbook images", href: "/figures" },
  ];
}

export default function LandingPage() {
  const [showEyeField, setShowEyeField] = useState(false);
  const [preferredCampus, setPreferredCampus] = useState(DEFAULT_CAMPUS);
  const secondaryLinks = useMemo(() => buildSecondaryLinks(preferredCampus), [preferredCampus]);

  useEffect(() => {
    setShowEyeField(true);
    try {
      const saved = window.localStorage.getItem(CAMPUS_PREFERENCE_KEY);
      if (isCampusId(saved)) setPreferredCampus(saved);
    } catch {
      // Ignore storage access failures and keep the default campus.
    }
  }, []);

  return (
    <>
      <a className="skip-link" href="#landing-main">Skip to main content</a>
      <main className="campaign" id="landing-main">
        <header className="site-header">
          <nav className="desktop-nav" aria-label="Secondary destinations">
            <ul>
              {secondaryLinks.map(({ label, href }) => (
                <li key={label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Mobile navigation">
              {secondaryLinks.map(({ label, href }) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </nav>
          </details>
        </header>

        <section className="hero" aria-labelledby="campaign-title">
          {showEyeField ? (
            <EyeField />
          ) : (
            <div className="eye-field" aria-hidden="true" data-seed="24719" data-motion="reduced" />
          )}

          <div className="hero-stage">
            <Brand hero />
            <div className="hero-copy" id="overview">
              <h1 id="campaign-title">Neurocritical care knowledge for the shift ahead</h1>
              <p className="hero-lede">
                A searchable faculty orientation atlas for Cleveland Clinic Main Campus and Akron General.
              </p>
            </div>
            <HospitalChooser />
          </div>
        </section>

        <section className="landing-secondary" aria-label="Quick destinations">
          <ul className="landing-secondary-list">
            {secondaryLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>
                  <strong>{link.label}</strong>
                  <span>{link.hint}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
