import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Connect the real node positions, including after wrapping, editing or resizing. */
export function LearningTrail({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState({ path: "", width: 1, height: 1 });

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const points = Array.from(element.querySelectorAll("[data-trail-anchor]"))
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2 - bounds.left,
            y: rect.top + rect.height / 2 - bounds.top,
          };
        });
      const path = points
        .map((point, index) => {
          if (!index) return `M ${point.x} ${point.y}`;
          const previous = points[index - 1];
          const middle = (previous.y + point.y) / 2;
          return `C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
        })
        .join(" ");
      const next = { path, width: bounds.width || 1, height: bounds.height || 1 };
      setLine((previous) =>
        previous.path === next.path &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll("[data-trail-anchor]").forEach((node) => observer.observe(node));
    measure();
    return () => {
      observer.disconnect();
    };
  }, [children]);

  return (
    <div ref={root} className={`learning-trail ${className}`}>
      <svg
        className="learning-trail-line"
        viewBox={`0 0 ${line.width} ${line.height}`}
        aria-hidden="true"
      >
        <path d={line.path} />
      </svg>
      {children}
    </div>
  );
}

export function Pagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <nav className="library-pagination" aria-label="Страницы библиотеки">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Назад
      </button>
      <div>
        {Array.from({ length: count }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            aria-label={`Страница ${number}`}
            aria-current={number === page ? "page" : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
      </div>
      <button disabled={page === count} onClick={() => onChange(page + 1)}>
        Далее
      </button>
    </nav>
  );
}
