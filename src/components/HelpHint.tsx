import type { ReactNode } from "react";

export function HelpHint({ children, label = "Пояснение" }: { children: ReactNode; label?: string }) {
  return (
    <details className="help-hint">
      <summary aria-label={label} title={label}>?</summary>
      <div role="note">{children}</div>
    </details>
  );
}
