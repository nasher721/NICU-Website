"use client";

import { useMemo, useState } from "react";
import FigureCard from "./FigureCard.jsx";

export default function FiguresPage({ handbooks, figureIndexes }) {
  const [campus, setCampus] = useState("all");
  const figures = useMemo(
    () => figureIndexes.flatMap((index) => {
      const handbook = handbooks.find((item) => item.id === index.campus);
      return index.figures.map((figure) => ({ figure, handbook }));
    }),
    [figureIndexes, handbooks],
  );
  const visibleFigures = campus === "all"
    ? figures
    : figures.filter(({ handbook }) => handbook.id === campus);

  return (
    <main className="wiki-main figures-page" id="wiki-content">
      <div className="wiki-breadcrumbs"><a href="/main-campus">Faculty Wiki</a><span>/</span><span>Source figures</span></div>
      <header className="figures-header">
        <div>
          <p className="eyebrow">Visual source library</p>
          <h1>Figures from both faculty handbooks.</h1>
          <p className="wiki-lede">Every embedded source image is presented here with its source location and linked back to the handbook section where it appears.</p>
        </div>
        <div className="figure-count"><strong>{visibleFigures.length}</strong><span>figures shown</span></div>
      </header>
      <div className="figure-filters" aria-label="Filter figures by campus">
        <button className={campus === "all" ? "active" : ""} type="button" onClick={() => setCampus("all")}>All campuses <span>{figures.length}</span></button>
        {handbooks.map((handbook) => (
          <button className={campus === handbook.id ? "active" : ""} type="button" onClick={() => setCampus(handbook.id)} key={handbook.id}>
            {handbook.name} <span>{figureIndexes.find((index) => index.campus === handbook.id)?.figures.length ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="figure-library-grid">
        {visibleFigures.map(({ figure, handbook }, index) => (
          <FigureCard key={figure.id} figure={figure} handbook={handbook} eager={index < 3} />
        ))}
      </div>
    </main>
  );
}
