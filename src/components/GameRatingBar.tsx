import { useEffect, useState } from "react";
import { readProfileItem, writeProfileItem } from "../lib/profileStorage";

export function GameRatingBar({
  gameId,
  moduleId,
  inResult = false,
}: {
  gameId: string;
  moduleId: number;
  inResult?: boolean;
}) {
  const cacheKey = `clickling_rating_${gameId}_${moduleId}`;
  const [rating, setRating] = useState<number>(() => {
    const saved = readProfileItem(cacheKey);
    return saved ? Number(saved) : 0;
  });
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [savedMessage, setSavedMessage] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fetch initial rating from server if available
  useEffect(() => {
    let alive = true;
    fetch(`/api/game-ratings?gameId=${encodeURIComponent(gameId)}&moduleId=${moduleId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        if (data.userRating && data.userRating > 0) {
          setRating(data.userRating);
          writeProfileItem(cacheKey, String(data.userRating));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gameId, moduleId, cacheKey]);

  const handleRate = async (value: number) => {
    if (busy) return;
    setRating(value);
    setHoverRating(0);
    setBusy(true);
    setSavedMessage(true);
    writeProfileItem(cacheKey, String(value));

    try {
      await fetch("/api/game-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, moduleId, rating: value }),
      });
    } catch {
      // offline fallback
    } finally {
      setBusy(false);
      window.setTimeout(() => setSavedMessage(false), 2500);
    }
  };

  const activeStars = hoverRating > 0 ? hoverRating : rating;

  return (
    <div
      className={`game-inline-rating-bar ${inResult ? "result-mode" : "edge-mode"}`}
      aria-label="Оцените игру"
    >
      <div className="rating-bar-content">
        <span className="rating-bar-label">{rating > 0 ? "Ваша оценка:" : "Оценить игру:"}</span>

        <div className="rating-stars-row" role="radiogroup" aria-label="Оценка от 1 до 5 звёзд">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              className={`rating-star-btn ${activeStars >= star ? "active" : ""}`}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => handleRate(star)}
              title={`Поставить ${star} из 5`}
            >
              ★
            </button>
          ))}
        </div>

        {rating > 0 && (
          <span className="rating-feedback-note">
            {rating}/5 {savedMessage ? "✨" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
