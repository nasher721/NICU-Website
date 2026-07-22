import { formatVerificationDate } from "./wiki-model.js";

export default function SourceStatus({ handbook, status, compact = false, showWarning = true }) {
  const sourceStatus = status ?? handbook.sourceStatus ?? {};
  return (
    <section
      className={`source-status ${compact ? "source-status-compact" : ""}`}
      aria-labelledby={compact ? undefined : `source-status-${handbook.id}`}
      aria-label={compact ? `${handbook.name} source status` : undefined}
    >
      {!compact && <p className="eyebrow">Source and verification</p>}
      {!compact && <h2 id={`source-status-${handbook.id}`}>Know what this page is built from.</h2>}
      <dl>
        <div>
          <dt>Campus source</dt>
          <dd>{handbook.sourceLabel}</dd>
        </div>
        <div>
          <dt>Handbook year</dt>
          <dd>{sourceStatus.handbookYear ?? 2026}</dd>
        </div>
        <div>
          <dt>Source imported</dt>
          <dd><time dateTime={sourceStatus.verifiedOn}>{formatVerificationDate(sourceStatus.verifiedOn)}</time></dd>
        </div>
        <div>
          <dt>Clinical review</dt>
          <dd>Named human review required</dd>
        </div>
      </dl>
      <p className="source-review-status">{sourceStatus.reviewStatus}</p>
      {showWarning && sourceStatus.warning && (
        <div className={`source-warning ${handbook.id === "main-campus" ? "source-warning-fidelity" : ""}`} role="note">
          <strong>{handbook.id === "main-campus" ? "Source fidelity note" : "Operational reminder"}</strong>
          <p>{sourceStatus.warning}</p>
        </div>
      )}
    </section>
  );
}
