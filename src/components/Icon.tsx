import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "library"
  | "path"
  | "chart"
  | "settings"
  | "spark"
  | "flame"
  | "gem"
  | "arrow"
  | "arrowLeft"
  | "clock"
  | "headphones"
  | "search"
  | "plus"
  | "more"
  | "volume"
  | "close"
  | "star"
  | "chevron"
  | "check"
  | "refresh"
  | "book"
  | "game"
  | "brain"
  | "folder"
  | "inbox"
  | "info"
  | "filter";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  library: (
    <>
      <path d="M4 5.5h16v14H4z" />
      <path d="M8 5.5V3h8v2.5M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  path: (
    <>
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M9 17c5-1 0-7 6-9" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.5 5.2L19 9l-5.5 1.8L12 16l-1.5-5.2L5 9l5.5-1.8Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />
    </>
  ),
  flame: (
    <path d="M12.4 2.7c.8 4.1-2.7 5-2.7 8.2 0 1.4.8 2.3 1.9 2.8-.2-2.4 1.8-3.5 2.6-5.3 2.1 1.8 3.3 4.1 3.3 6.5a5.5 5.5 0 0 1-11 0c0-4.2 2.5-8.9 5.9-12.2Z" />
  ),
  gem: (
    <>
      <path d="m12 21-9-10 4-6h10l4 6Z" />
      <path d="m3 11 9 3 9-3M7 5l5 9 5-9" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 14h3v6H5a1 1 0 0 1-1-1ZM20 14h-3v6h2a1 1 0 0 0 1-1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M5 10v4h4l5 4V6L9 10Z" />
      <path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 0-1.6 5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z" />
    </>
  ),
  game: (
    <>
      <path d="M6 12h4m4 0h4M12 10v4" />
      <path d="M5 7h14a3 3 0 0 1 2.8 4l-1.6 5a2 2 0 0 1-3.1 1l-2.5-1.8h-5.2L7 17a2 2 0 0 1-3.1-1l-1.6-5A3 3 0 0 1 5 7Z" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-5 2 3 3 0 0 0 0 5 3 3 0 0 0 1 5 3 3 0 0 0 5 3V5Z" />
      <path d="M15 4a3 3 0 0 1 5 2 3 3 0 0 1 0 5 3 3 0 0 1-1 5 3 3 0 0 1-5 3V5Z" />
      <path d="M9 8h-2m2 5H6m9-5h2m-2 5h3" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 9h18" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16l2 11h-6l-2 3h-4l-2-3H2Z" />
      <path d="M2 15h6m8 0h6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  filter: <path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5Z" />,
};

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
