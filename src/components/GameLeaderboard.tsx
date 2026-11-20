import { useEffect, useState } from "react";

type LeaderboardEntry = {
  id: string;
  user_name: string;
  user_email: string;
  score: number;
  total: number;
  time_seconds: number;
  time_label: string;
  created_at: string;
};

function formatPlayerName(name: string, email: string) {
  if (name && name !== "Пользователь" && name !== "Гость" && name !== "Игрок") {
    return name;
  }
  if (email.endsWith("@clickling.local")) {
    return email.replace("@clickling.local", "");
  }
  return email.split("@")[0] || "Игрок";
}

export function GameLeaderboard({
  gameId,
  moduleId,
  score,
  total,
  timeSeconds = 15,
  timeLabel = "0:15",
}: {
  gameId: string;
  moduleId: number;
  score: number;
  total: number;
  timeSeconds?: number;
  timeLabel?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        moduleId,
        score,
        total,
        timeSeconds,
        timeLabel,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setTop(data.top || []);
        setUserRank(data.userRank || 1);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [gameId, moduleId, score, total, timeSeconds, timeLabel]);

  return (
    <div className="game-leaderboard-container">
      <div className="leaderboard-header">
        <span className="leaderboard-icon">🏆</span>
        <div>
          <h3>Рейтинг раунда (как в Wordall)</h3>
          <p>
            Места распределяются по количеству баллов, а при равенстве — по скорости ответа.
          </p>
        </div>
      </div>

      {userRank && (
        <div className={`user-rank-highlight ${userRank <= 3 ? `top-${userRank}` : ""}`}>
          <span className="rank-badge">
            {userRank === 1
              ? "🥇 #1 место"
              : userRank === 2
                ? "🥈 #2 место"
                : userRank === 3
                  ? "🥉 #3 место"
                  : `#${userRank} место`}
          </span>
          <span className="rank-stats">
            Ваш результат: <b>{score}/{total}</b> за <b>{timeLabel}</b>
          </span>
        </div>
      )}

      {loading ? (
        <p className="leaderboard-loading">Загрузка таблицы лидеров…</p>
      ) : top.length === 0 ? (
        <p className="leaderboard-empty">Вы первый, кто завершил этот раунд!</p>
      ) : (
        <div className="leaderboard-table">
          <div className="leaderboard-row head">
            <span className="col-rank">#</span>
            <span className="col-name">Игрок</span>
            <span className="col-score">Баллы</span>
            <span className="col-time">Время</span>
          </div>

          {top.map((entry, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`;
            const isTop3 = rank <= 3;
            return (
              <div
                key={entry.id || `${entry.user_email}-${index}`}
                className={`leaderboard-row ${isTop3 ? `rank-${rank}` : ""}`}
              >
                <span className="col-rank">{medal}</span>
                <span className="col-name">
                  <strong>{formatPlayerName(entry.user_name, entry.user_email)}</strong>
                </span>
                <span className="col-score">
                  <span className="score-pill">
                    {entry.score}/{entry.total}
                  </span>
                </span>
                <span className="col-time">⏱️ {entry.time_label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
