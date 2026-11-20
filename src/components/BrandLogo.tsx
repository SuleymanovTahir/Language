import pandaLogo from "../assets/lingclick-panda.png";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? "compact" : ""}`}>
      <span className="brand-logo-mark">
        <img src={pandaLogo} alt="" aria-hidden="true" />
      </span>
      <strong>
        Ling<span>Click</span>
      </strong>
    </span>
  );
}
