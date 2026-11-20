import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabCard, VocabModule } from "../lib/vocab";
import {
  type SentenceDifficulty,
  type SentenceTile,
  getSentenceChallengesForModule,
  prepareSentenceRound,
} from "../lib/sentenceBank";
import { playFeedbackSound } from "../lib/feedbackSound";
import { speakText } from "../lib/speech";
import { Icon } from "./Icon";

export function SentenceOrderGame({
  module,
  onExit,
  onRestart,
  onAnswer,
  onComplete,
  onNextGame,
  muted,
  onToggleMute,
}: {
  module: VocabModule;
  onExit: () => void;
  onRestart?: () => void;
  onAnswer?: (
    card: VocabCard,
    correct: boolean,
    confusedWith?: string,
    telemetry?: {
      attemptCount: number;
      firstTryCorrect: boolean;
      hintUsed: boolean;
      durationMs: number;
    },
  ) => void;
  onComplete?: (summary?: { score: number; total: number; timeLabel?: string }) => void;
  onNextGame?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}) {
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>("easy");
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const draggedTileId = useRef<string | null>(null);
  const roundStartedAt = useRef(Date.now());
  const attemptsRef = useRef<Record<number, number>>({});

  // Challenges for selected module and difficulty
  const challenges = useMemo(
    () => getSentenceChallengesForModule(module, difficulty),
    [module.id, difficulty],
  );

  const rounds = useMemo(() => {
    const list = challenges.length > 0 ? challenges : [];
    // Take up to 7 challenges per session
    return list.slice(0, Math.min(7, list.length));
  }, [challenges]);

  const currentChallenge = rounds[roundIndex];
  const isDone = roundIndex >= rounds.length;

  // Prepare round with exactly 50/50 ratio (50% correct sentence words, 50% distractors)
  const preparedRound = useMemo(() => {
    if (!currentChallenge) return null;
    return prepareSentenceRound(currentChallenge, module.cards);
  }, [currentChallenge, module.cards, module.id]);

  // Timer
  useEffect(() => {
    if (isDone) return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isDone]);

  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  // Reset when difficulty changes
  const switchDifficulty = (newDiff: SentenceDifficulty) => {
    setDifficulty(newDiff);
    setRoundIndex(0);
    setScore(0);
    setMistakes(0);
    setFeedback(null);
    setPlacedTileIds([]);
    setShowHint(false);
    roundStartedAt.current = Date.now();
  };

  // Reset state for new round
  useEffect(() => {
    setPlacedTileIds([]);
    setFeedback(null);
    setShowHint(false);
    roundStartedAt.current = Date.now();
  }, [roundIndex, difficulty]);

  // Audio pronunciation
  const playTargetSentenceAudio = () => {
    if (muted || !currentChallenge) return;
    const fullText = currentChallenge.targetWords.join(" ");
    speakText(fullText, module.languageCode);
  };

  if (isDone || !preparedRound) {
    const total = rounds.length;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="game-shell">
        <header className="game-topbar">
          <button className="secondary-button compact" onClick={onExit}>
            <Icon name="arrowLeft" /> Назад к играм
          </button>
          <span>Сборка предложений · Результат</span>
          <span />
        </header>

        <div className="game-result">
          <span className="result-medal">{accuracy >= 70 ? "🏆" : "★"}</span>
          <p className="eyebrow">
            СЛОЖНОСТЬ:{" "}
            {difficulty === "easy" ? "ЛЕГКИЙ" : difficulty === "medium" ? "СРЕДНИЙ" : "СЛОЖНЫЙ"}
          </p>
          <h1>
            {score} из {total} предложений собрано верно
          </h1>
          <p>
            Точность: {accuracy}% · Ошибок: {mistakes} · Время: {timeLabel}.
          </p>

          <div className="result-difficulty-selector">
            <p>Хотите попробовать другой уровень сложности?</p>
            <div className="sentence-diff-pills">
              <button
                className={`diff-pill ${difficulty === "easy" ? "active" : ""}`}
                onClick={() => switchDifficulty("easy")}
              >
                🌱 Легкий (3–4 слова)
              </button>
              <button
                className={`diff-pill ${difficulty === "medium" ? "active" : ""}`}
                onClick={() => switchDifficulty("medium")}
              >
                ⚡ Средний (4–6 слов)
              </button>
              <button
                className={`diff-pill ${difficulty === "hard" ? "active" : ""}`}
                onClick={() => switchDifficulty("hard")}
              >
                🔥 Сложный (6–8 слов)
              </button>
            </div>
          </div>

          <div className="game-result-actions" style={{ marginTop: 24 }}>
            <button
              className="primary-button"
              onClick={() => {
                setRoundIndex(0);
                setScore(0);
                setMistakes(0);
                setFeedback(null);
                setPlacedTileIds([]);
                setElapsed(0);
                onRestart?.();
              }}
            >
              Сыграть снова
            </button>
            {onNextGame && (
              <button className="secondary-button" onClick={onNextGame}>
                Следующая игра
              </button>
            )}
            <button className="secondary-button" onClick={onExit}>
              К выбору игр
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { challenge, tiles, correctCount, distractorCount } = preparedRound;

  // Map tile id to tile object
  const tileMap = new Map<string, SentenceTile>();
  tiles.forEach((t) => tileMap.set(t.id, t));

  const placedTiles = placedTileIds.map((id) => tileMap.get(id)!).filter(Boolean);
  const remainingTiles = tiles.filter((t) => !placedTileIds.includes(t.id));

  // Placement handlers
  const addTileToSentence = (tileId: string) => {
    if (feedback === "correct") return;
    setPlacedTileIds((prev) => [...prev, tileId]);
  };

  const removeTileFromSentence = (tileId: string) => {
    if (feedback === "correct") return;
    setPlacedTileIds((prev) => prev.filter((id) => id !== tileId));
  };

  const reorderTileInSentence = (dragId: string, targetId: string) => {
    if (feedback === "correct" || dragId === targetId) return;
    setPlacedTileIds((prev) => {
      const copy = prev.filter((id) => id !== dragId);
      const targetIdx = copy.indexOf(targetId);
      if (targetIdx === -1) {
        copy.push(dragId);
      } else {
        copy.splice(targetIdx, 0, dragId);
      }
      return copy;
    });
  };

  const clearSentence = () => {
    if (feedback === "correct") return;
    setPlacedTileIds([]);
  };

  // Check the answer
  const checkAnswer = () => {
    if (placedTiles.length === 0 || feedback) return;

    const currentAttempt = (attemptsRef.current[roundIndex] ?? 0) + 1;
    attemptsRef.current[roundIndex] = currentAttempt;

    // The user's assembled sentence tokens
    const assembledClean = placedTiles.map((t) =>
      t.text.replace(/[.,!?;:]+$/u, "").trim().toLowerCase(),
    );
    const expectedClean = challenge.targetWords.map((w) =>
      w.replace(/[.,!?;:]+$/u, "").trim().toLowerCase(),
    );

    const isCorrect =
      assembledClean.length === expectedClean.length &&
      assembledClean.every((token, idx) => token === expectedClean[idx]);

    if (!muted) {
      playFeedbackSound(isCorrect);
    }

    if (isCorrect) {
      setFeedback("correct");
      if (currentAttempt === 1) {
        setScore((v) => v + 1);
      }
      // Speak target sentence
      playTargetSentenceAudio();
      // Notify parent telemetry if card available
      if (module.cards[0] && onAnswer) {
        onAnswer(module.cards[0], true, undefined, {
          attemptCount: currentAttempt,
          firstTryCorrect: currentAttempt === 1,
          hintUsed: showHint,
          durationMs: Date.now() - roundStartedAt.current,
        });
      }
    } else {
      setFeedback("wrong");
      setMistakes((v) => v + 1);
      if (module.cards[0] && onAnswer) {
        onAnswer(module.cards[0], false, undefined, {
          attemptCount: currentAttempt,
          firstTryCorrect: false,
          hintUsed: showHint,
          durationMs: Date.now() - roundStartedAt.current,
        });
      }
    }
  };

  const nextRound = () => {
    setRoundIndex((v) => v + 1);
  };

  return (
    <div className="game-shell sentence-builder-game">
      {/* Top Header */}
      <header className="game-topbar">
        <button className="secondary-button compact" onClick={onExit}>
          <Icon name="arrowLeft" /> Выход
        </button>

        {/* Difficulty switcher tabs */}
        <div className="sentence-diff-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={difficulty === "easy"}
            className={`diff-tab ${difficulty === "easy" ? "active" : ""}`}
            onClick={() => switchDifficulty("easy")}
          >
            Легкий (3–4)
          </button>
          <button
            role="tab"
            aria-selected={difficulty === "medium"}
            className={`diff-tab ${difficulty === "medium" ? "active" : ""}`}
            onClick={() => switchDifficulty("medium")}
          >
            Средний (4–6)
          </button>
          <button
            role="tab"
            aria-selected={difficulty === "hard"}
            className={`diff-tab ${difficulty === "hard" ? "active" : ""}`}
            onClick={() => switchDifficulty("hard")}
          >
            Сложный (6–8)
          </button>
        </div>

        <div className="topbar-right-controls" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="game-round-pill">
            {roundIndex + 1} / {rounds.length}
          </span>
          <span className="game-timer-pill">⏱️ {timeLabel}</span>
          {onToggleMute && (
            <button
              className="game-mute-btn"
              onClick={onToggleMute}
              title={muted ? "Включить звук" : "Выключить звук"}
              aria-label={muted ? "Включить звук" : "Выключить звук"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          )}
        </div>
      </header>

      {/* Main Game Card */}
      <div className="sentence-builder-card">
        {/* Kicker badge with 50/50 distractor indicator */}
        <div className="sentence-header-row">
          <p className="question-kicker">
            Соберите предложение · {module.languageName}
          </p>
          <span className="distractor-ratio-badge" title="Ровно 50% слов из предложения, 50% лишних">
            ⚖️ 50/50: {correctCount} верных · {distractorCount} лишних
          </span>
        </div>

        {/* Russian prompt sentence */}
        <div className="sentence-prompt-container">
          <span className="sentence-lang-flag">🇷🇺</span>
          <h1 className="sentence-russian-prompt">{challenge.russian}</h1>
        </div>

        {/* Assembled sentence drop zone */}
        <div
          className={`sentence-assembly-area ${feedback ? feedback : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedTileId.current) {
              addTileToSentence(draggedTileId.current);
              draggedTileId.current = null;
            }
          }}
        >
          <span className="assembly-label">Ваше предложение:</span>

          {placedTiles.length === 0 ? (
            <p className="assembly-placeholder">
              Нажимайте на карточки слов внизу или перетаскивайте их сюда в правильном порядке.
            </p>
          ) : (
            <div className="assembly-tiles-flow">
              {placedTiles.map((tile, position) => (
                <button
                  key={`placed-${tile.id}`}
                  type="button"
                  draggable={feedback !== "correct"}
                  className={`word-tile placed ${feedback === "correct" ? "correct" : ""} ${
                    feedback === "wrong" && tile.isDistractor ? "wrong-distractor" : ""
                  }`}
                  onClick={() => removeTileFromSentence(tile.id)}
                  onDragStart={() => {
                    draggedTileId.current = tile.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (draggedTileId.current) {
                      reorderTileInSentence(draggedTileId.current, tile.id);
                      draggedTileId.current = null;
                    }
                  }}
                  title="Нажмите, чтобы убрать слово обратно"
                >
                  <span className="word-tile-num">{position + 1}</span>
                  <span className="word-tile-text">{tile.text}</span>
                  {feedback !== "correct" && <span className="word-tile-remove">×</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Word Bank / Distractor Pool */}
        <div className="sentence-word-bank">
          <div className="bank-header">
            <span>Доступные слова (верные + лишние):</span>
            {placedTiles.length > 0 && feedback !== "correct" && (
              <button
                type="button"
                className="bank-clear-btn"
                onClick={clearSentence}
                title="Очистить составленное предложение"
              >
                Вернуть все слова
              </button>
            )}
          </div>

          <div className="bank-tiles-grid">
            {remainingTiles.map((tile) => (
              <button
                key={`bank-${tile.id}`}
                type="button"
                draggable={feedback !== "correct"}
                disabled={feedback === "correct"}
                className="word-tile bank"
                onClick={() => addTileToSentence(tile.id)}
                onDragStart={() => {
                  draggedTileId.current = tile.id;
                }}
                onDragEnd={() => {
                  draggedTileId.current = null;
                }}
              >
                {tile.text}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions and Feedback Bar */}
        <div className="sentence-bottom-bar">
          {!feedback ? (
            <div className="sentence-action-buttons">
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setShowHint((v) => !v)}
              >
                💡 {showHint ? "Скрыть подсказку" : "Подсказка"}
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={placedTiles.length === 0}
                onClick={checkAnswer}
              >
                Проверить ответ <Icon name="check" size={16} />
              </button>
            </div>
          ) : (
            <div className={`sentence-feedback-panel ${feedback}`}>
              <div className="feedback-message">
                {feedback === "correct" ? (
                  <>
                    <strong className="correct-title">✨ Отлично! Предложение собрано верно!</strong>
                    <div className="feedback-pronounce-row">
                      <span className="feedback-german-text">
                        {challenge.targetWords.join(" ")}
                      </span>
                      <button
                        type="button"
                        className="feedback-audio-btn"
                        onClick={playTargetSentenceAudio}
                        title="Прослушать произношение"
                      >
                        🔊 Послушать
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong className="wrong-title">❌ Не совсем так</strong>
                    <p className="wrong-explanation">
                      Правильный порядок слов:{" "}
                      <b>{challenge.targetWords.join(" ")}</b>
                    </p>
                    {placedTiles.some((t) => t.isDistractor) && (
                      <p className="distractor-warning">
                        ⚠️ В вашем варианте были использованы лишние слова (дистракторы)!
                      </p>
                    )}
                  </>
                )}

                {challenge.explanation && (
                  <p className="grammar-note">
                    ℹ️ <em>{challenge.explanation}</em>
                  </p>
                )}
              </div>

              <div className="feedback-actions">
                {feedback === "wrong" && (
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => {
                      setFeedback(null);
                      setPlacedTileIds([]);
                    }}
                  >
                    Попробовать ещё раз
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  autoFocus
                  onClick={nextRound}
                >
                  {roundIndex + 1 < rounds.length ? "Следующее предложение" : "Завершить игру"}{" "}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          )}

          {showHint && !feedback && (
            <div className="sentence-hint-card">
              <p>
                💡 Первое слово: <strong>«{challenge.targetWords[0]}»</strong> · Всего в предложении:{" "}
                <strong>{challenge.targetWords.length}</strong> слов.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
