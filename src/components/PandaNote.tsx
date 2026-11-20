import type { ReactNode } from "react";

export function PandaNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <aside className="panda-note">
      <img src="/clickling-panda.png" alt="Панда — ваш помощник в изучении языка" />
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      <span className="panda-note-spark" aria-hidden="true">
        ✦
      </span>
    </aside>
  );
}
