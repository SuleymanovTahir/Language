import { useId } from "react";
import type { IconName } from "./Icon";

/** Each achievement has its own silhouette, not just a differently coloured cup. */
export function Trophy({ kind }: { kind: IconName }) {
  const id = useId().replace(/:/g, "");
  const colors: Record<string, [string, string]> = {
    spark: ["#65baf5", "#2768cb"],
    gem: ["#ba9afa", "#7150bb"],
    flame: ["#ffca72", "#e87533"],
    book: ["#7cddc1", "#279c88"],
    check: ["#ffa7b6", "#d6567e"],
    path: ["#ffe39a", "#b58a38"],
  };
  const [light, dark] = colors[kind] ?? colors.spark;
  return (
    <svg className="trophy-art" viewBox="0 0 140 154" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2=".8" y2="1">
          <stop stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}gold`} x2="1" y2="1">
          <stop stopColor="#fff1bc" />
          <stop offset=".5" stopColor="#eec76a" />
          <stop offset="1" stopColor="#aa7428" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="142" rx="43" ry="6" fill={dark} opacity=".12" />
      <circle cx="70" cy="65" r="51" fill={light} opacity=".13" />
      {kind === "spark" && (
        <>
          <path
            d="m70 20 12 25 28 4-20 20 5 29-25-14-25 14 5-29-20-20 28-4Z"
            fill={`url(#${id})`}
            stroke="white"
            strokeWidth="3"
          />
          <path d="m65 47 7-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <path d="m53 88-8 30 25-10 25 10-8-30" fill={dark} opacity=".8" />
        </>
      )}
      {kind === "gem" && (
        <>
          <path
            d="m40 40 60 0 18 27-48 51-48-51Z"
            fill={`url(#${id})`}
            stroke="white"
            strokeWidth="3"
          />
          <path
            d="m40 40 15 27 15-27 15 27 15-27M22 67h96M55 67l15 51 15-51"
            fill="none"
            stroke="white"
            opacity=".65"
            strokeWidth="2"
          />
        </>
      )}
      {kind === "flame" && (
        <>
          <path
            d="M70 17c12 30 35 34 35 62a35 35 0 0 1-70 0c0-18 8-29 18-39-1 17 4 19 6 20 10-15 12-28 11-43Z"
            fill={`url(#${id})`}
            stroke="white"
            strokeWidth="3"
          />
          <path d="M70 65c3 17 16 22 16 33a16 16 0 0 1-32 0c0-11 11-18 16-33Z" fill="#fff0b1" />
        </>
      )}
      {kind === "book" && (
        <>
          <path
            d="M70 45c-16-13-29-16-48-11v65c20-4 32 0 48 11 16-11 28-15 48-11V34c-19-5-32-2-48 11Z"
            fill={`url(#${id})`}
            stroke="white"
            strokeWidth="3"
          />
          <path
            d="M70 45v65M33 49l25 10m-25 7 25 9m24-16 25-10M82 75l25-9"
            stroke="#e4fff7"
            strokeWidth="3"
            fill="none"
          />
          <path d="m96 26 3-10 4 10 10 4-10 4-4 10-3-10-10-4Z" fill="#efc665" />
        </>
      )}
      {kind === "check" && (
        <>
          <circle cx="70" cy="68" r="43" fill={`url(#${id})`} stroke="white" strokeWidth="3" />
          <circle cx="70" cy="68" r="29" fill="none" stroke="white" opacity=".5" strokeWidth="3" />
          <path
            d="m51 68 13 13 26-28"
            fill="none"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m42 102-6 27 21-9 13 10 4-21m6-6 16 26 4-21 15-2-15-15" fill={dark} />
        </>
      )}
      {kind === "path" && (
        <>
          <circle cx="70" cy="67" r="43" fill={`url(#${id}gold)`} stroke="white" strokeWidth="3" />
          <circle cx="70" cy="67" r="33" fill="#fff5da" />
          <path d="m83 39-7 34-23 22 10-36Z" fill={dark} />
          <path d="m83 39-20 20 13 14Z" fill="#e27652" />
          <circle cx="70" cy="67" r="5" fill="white" />
          <path d="M64 24v-9h12v9" fill="none" stroke={dark} strokeWidth="4" />
        </>
      )}
      <path d="M53 128h34l6 10H47Z" fill={`url(#${id}gold)`} />
      <path d="M56 126h28" stroke="#fff2c5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
