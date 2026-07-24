const hospitals = [
  {
    campus: "main-campus",
    shortName: "MC",
    name: "Main Campus",
    href: "/main-campus",
    description: "Faculty orientation, workflows, documentation, and source references for Main Campus.",
  },
  {
    campus: "akron",
    shortName: "AK",
    name: "Akron General",
    href: "/akron",
    description: "Shift-ready pathways, contacts, transitions, and source references for Akron General.",
  },
];

export default function HospitalChooser() {
  return (
    <section className="hospital-chooser" aria-labelledby="hospital-chooser-heading">
      <div className="hospital-chooser-heading">
        <p>Choose a hospital</p>
        <h2 id="hospital-chooser-heading">Open the right faculty wiki.</h2>
      </div>
      <div className="hospital-panel-list" role="list">
        {hospitals.map((hospital) => (
          <a
            className="hospital-panel hospital-card"
            data-campus={hospital.campus}
            href={hospital.href}
            key={hospital.campus}
            role="listitem"
          >
            <span className="hospital-panel-badge" aria-hidden="true">{hospital.shortName}</span>
            <span className="hospital-panel-copy">
              <strong>{hospital.name}</strong>
              <small>{hospital.description}</small>
            </span>
            <span className="hospital-panel-action">Open wiki <span aria-hidden="true">→</span></span>
          </a>
        ))}
      </div>
    </section>
  );
}
