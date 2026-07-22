import FigureCard from "./FigureCard.jsx";

export default function FigurePreview({ handbook, figures }) {
  return (
    <section className="figures-preview" aria-labelledby="figures-preview-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Visual reference</p><h2 id="figures-preview-heading">Figures from the handbook</h2></div>
        <a href="/figures">View all {figures.length} figures ↗</a>
      </div>
      <div className="figure-preview-grid">
        {figures.slice(0, 4).map((figure) => (
          <FigureCard key={figure.id} figure={figure} handbook={handbook} />
        ))}
      </div>
    </section>
  );
}
