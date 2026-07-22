"use client";

import { useEffect } from "react";
import { CAMPUS_PREFERENCE_KEY, DEFAULT_CAMPUS, legacyHashDestination } from "./legacy-hash.js";

export default function LegacyHashRedirect() {
  useEffect(() => {
    if (!window.location.hash) return;
    let preferredCampus = DEFAULT_CAMPUS;
    try {
      preferredCampus = window.localStorage.getItem(CAMPUS_PREFERENCE_KEY) || DEFAULT_CAMPUS;
    } catch {
      // Storage can be unavailable; the deterministic default remains safe.
    }
    const destination = legacyHashDestination(
      window.location.pathname,
      window.location.hash,
      preferredCampus,
    );
    if (!destination) return;
    const query = window.location.search;
    window.location.replace(`${destination}${query}`);
  }, []);

  return null;
}
