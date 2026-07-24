import { formatVerificationDate } from "./wiki-model.js";

function approvalLabel(sourceStatus = {}) {
  const state = sourceStatus.approvalState;
  if (state === "quarantined") return "Quarantined";
  if (state === "approved") return "Approved";
  if (state === "draft") return "Draft";
  return "Imported";
}

export default function SourceStatus({ handbook, status, compact = false, showWarning = true }) {
  const sourceStatus = status ?? handbook.sourceStatus ?? {};
  const quarantine = sourceStatus.quarantine;
  const warningLabel = handbook.id === "main-campus" ? "Source fidelity note" : "Operational reminder";
  return (
    <section
      className={`source-status ${compact ? "source-status-compact" : ""}`}
      aria-labelledby={compact ? undefined : `source-status-${handbook.id}`}
      aria-label={compact ? `${handbook.name} source status` : undefined}
    >
      {!compact && <p className="eyebrow">Source and verification</p>}
      {!compact && <h2 id={`source-status-${handbook.id}`}>Know what this page is built from.</h2>}
      <div className="provenance-strip" aria-label={`${handbook.name} provenance`}>
        <span className="campus-monogram" aria-hidden="true">{handbook.shortName}</span>
        <span>{handbook.name}</span>
        <span>{sourceStatus.handbookYear ?? 2026} source</span>
        <span>
          Verified <time dateTime={sourceStatus.verifiedOn}>{formatVerificationDate(sourceStatus.verifiedOn)}</time>
        </span>
        <span data-approval={sourceStatus.approvalState || "imported"}>{approvalLabel(sourceStatus)}</span>
      </div>
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
      {quarantine?.active && (
        <div className="source-warning source-warning-quarantine" role="status">
          <strong>Campus quarantine active</strong>
          <p>{quarantine.reason || sourceStatus.warning}</p>
        </div>
      )}
      {showWarning && sourceStatus.warning && (
        <div className={`source-warning ${handbook.id === "main-campus" ? "source-warning-fidelity" : ""}`} role="note">
          <strong>{warningLabel}</strong>
          <p>{sourceStatus.warning}</p>
        </div>
      )}
    </section>
  );
}
