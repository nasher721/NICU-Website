export default function Brand({ compact = false, hero = false }) {
  const className = [
    "brand",
    compact ? "brand-compact" : "",
    hero ? "brand-hero" : "",
  ].filter(Boolean).join(" ");

  return (
    <a className={className} href="/" aria-label="Cleveland Clinic, return to landing page">
      <img src="/cleveland-clinic-symbol.png" alt="" width="42" height="24" />
      <span>
        <strong>Cleveland Clinic</strong>
        <small>Neurocritical Care</small>
      </span>
    </a>
  );
}
