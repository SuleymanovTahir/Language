import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabCard, VocabModule } from "../lib/vocab";
import { speakTextAsync, stopAllSpeech, detectSpeechLanguage } from "../lib/speech";
import { Icon } from "./Icon";
import { GameRatingBar } from "./GameRatingBar";

export type AudioDirection = "native_target" | "target_native" | "target_only";
export type LoopMode = "once" | "3x" | "infinite";

export function AudioLoopGame({
  module,
  onExit,
  onRestart,
  onComplete,
  onNextGame,
  muted = false,
  onToggleMute,
}: {
  module: VocabModule;
  onExit: () => void;
  onRestart?: () => void;
  onComplete?: (summary?: { score: number; total: number; timeLabel?: string }) => void;
  onNextGame?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}) {
  const cards = useMemo(() => module.cards.filter((c) => c.word && c.translation), [module.cards]);

  // Playlist Settings
  const [direction, setDirection] = useState<AudioDirection>("native_target");
  const [wordRepeats, setWordRepeats] = useState<number>(2); // 1x, 2x, 3x
  const [loopMode, setLoopMode] = useState<LoopMode>("infinite"); // once, 3x, infinite
  const [autoNextModule, setAutoNextModule] = useState(false);
  const [pausePromptSec, setPausePromptSec] = useState<number>(1.5);
  const [pauseWordSec, setPauseWordSec] = useState<number>(1.8);
  const [speed, setSpeed] = useState<number>(0.9);
  const [shuffle, setShuffle] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Playback State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepeat, setCurrentRepeat] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cycleCount, setCycleCount] = useState(1);
  const [phase, setPhase] = useState<
    "idle" | "speaking_prompt" | "waiting_recall" | "speaking_answer" | "waiting_next"
  >("idle");

  const [finished, setFinished] = useState(false);

  // Card sequence (handles shuffle)
  const sequence = useMemo(() => {
    const list = [...cards];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list;
  }, [cards, shuffle]);

  const currentCard = sequence[currentIndex] ?? sequence[0];

  // Ref to track latest state inside loop async runner
  const stateRef = useRef({
    isPlaying,
    currentIndex,
    currentRepeat,
    cycleCount,
    direction,
    wordRepeats,
    loopMode,
    autoNextModule,
    pausePromptSec,
    pauseWordSec,
    speed,
    muted,
    sequence,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      currentIndex,
      currentRepeat,
      cycleCount,
      direction,
      wordRepeats,
      loopMode,
      autoNextModule,
      pausePromptSec,
      pauseWordSec,
      speed,
      muted,
      sequence,
    };
  }, [
    isPlaying,
    currentIndex,
    currentRepeat,
    cycleCount,
    direction,
    wordRepeats,
    loopMode,
    autoNextModule,
    pausePromptSec,
    pauseWordSec,
    speed,
    muted,
    sequence,
  ]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  // Sleep helper that can be aborted
  const sleep = (ms: number, abortCheck: () => boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      const step = 50;
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += step;
        if (abortCheck()) {
          clearInterval(interval);
          resolve(false);
        } else if (elapsed >= ms) {
          clearInterval(interval);
          resolve(true);
        }
      }, step);
    });
  };

  // Play loop runner
  const loopRunnerActive = useRef(false);

  const startPlayback = () => {
    if (finished) {
      setFinished(false);
      setCurrentIndex(0);
      setCurrentRepeat(0);
      setCycleCount(1);
    }
    setIsPlaying(true);
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    stopAllSpeech();
    setPhase("idle");
  };

  const togglePlay = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  const handleNext = () => {
    stopAllSpeech();
    setCurrentRepeat(0);
    if (currentIndex < sequence.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
      setCycleCount((c) => c + 1);
    }
  };

  const handlePrev = () => {
    stopAllSpeech();
    setCurrentRepeat(0);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(sequence.length - 1);
    }
  };

  // MediaSession API for lock screen and bluetooth headphones
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentCard) return;

    try {
      const targetLang = module.languageCode?.toUpperCase() ?? "DE";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${currentCard.word} — ${currentCard.translation}`,
        artist: `ClickLing · Повтор ${currentRepeat + 1}/${wordRepeats} (Цикл ${cycleCount})`,
        album: `${module.title} [${targetLang}]`,
      });

      navigator.mediaSession.setActionHandler("play", () => startPlayback());
      navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
      navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
      navigator.mediaSession.setActionHandler("previoustrack", () => handlePrev());
    } catch {}
  }, [currentCard, currentRepeat, wordRepeats, cycleCount, module.title, module.languageCode]);

  // Main playback loop effect
  useEffect(() => {
    if (!isPlaying || sequence.length === 0) return;
    if (loopRunnerActive.current) return;

    let isCancelled = false;
    loopRunnerActive.current = true;

    const runLoop = async () => {
      while (!isCancelled && stateRef.current.isPlaying) {
        const {
          currentIndex: idx,
          currentRepeat: rep,
          cycleCount: cycle,
          direction: dir,
          wordRepeats: totalReps,
          loopMode: mode,
          autoNextModule: autoNext,
          pausePromptSec: pPrompt,
          pauseWordSec: pWord,
          speed: spd,
          muted: isMuted,
          sequence: currentSeq,
        } = stateRef.current;

        const card = currentSeq[idx];
        if (!card) break;

        const targetText = card.word.trim();
        const nativeText = card.translation.trim();
        const targetLang = module.languageCode ?? "de";
        const nativeLang = "ru";

        // Determine First and Second speech items
        let firstText = "";
        let firstLang = "";
        let secondText = "";
        let secondLang = "";

        if (dir === "native_target") {
          firstText = nativeText;
          firstLang = nativeLang;
          secondText = targetText;
          secondLang = targetLang;
        } else if (dir === "target_native") {
          firstText = targetText;
          firstLang = targetLang;
          secondText = nativeText;
          secondLang = nativeLang;
        } else {
          // target_only
          firstText = targetText;
          firstLang = targetLang;
          secondText = "";
          secondLang = "";
        }

        // STEP 1: Speak prompt (First Item)
        setPhase("speaking_prompt");
        if (!isMuted && firstText) {
          await speakTextAsync(firstText, firstLang, spd < 0.85);
        }
        if (isCancelled || !stateRef.current.isPlaying) break;

        // STEP 2: Pause for cognitive recall (user recalls translation)
        if (secondText) {
          setPhase("waiting_recall");
          const ok = await sleep(pPrompt * 1000, () => isCancelled || !stateRef.current.isPlaying);
          if (!ok) break;

          // STEP 3: Speak answer (Second Item)
          setPhase("speaking_answer");
          if (!isMuted) {
            await speakTextAsync(secondText, secondLang, spd < 0.85);
          }
          if (isCancelled || !stateRef.current.isPlaying) break;
        }

        // STEP 4: Pause before next repeat or next card
        setPhase("waiting_next");
        const okAfter = await sleep(pWord * 1000, () => isCancelled || !stateRef.current.isPlaying);
        if (!okAfter) break;

        // Check if we need to repeat the same word
        if (rep + 1 < totalReps) {
          setCurrentRepeat((r) => r + 1);
          continue;
        }

        // Word repetitions done, advance to next word
        setCurrentRepeat(0);

        if (idx + 1 < currentSeq.length) {
          setCurrentIndex((i) => i + 1);
        } else {
          // Deck finished!
          const nextCycle = cycle + 1;
          setCycleCount(nextCycle);

          if (mode === "once" || (mode === "3x" && nextCycle > 3)) {
            // Reached completion
            setIsPlaying(false);
            setPhase("idle");
            setFinished(true);
            onComplete?.({ score: currentSeq.length, total: currentSeq.length });

            if (autoNext && onNextGame) {
              onNextGame();
            }
            break;
          } else {
            // Loop again from first word
            setCurrentIndex(0);
          }
        }
      }

      loopRunnerActive.current = false;
    };

    void runLoop();

    return () => {
      isCancelled = true;
      loopRunnerActive.current = false;
      stopAllSpeech();
    };
  }, [isPlaying, sequence.length, module.languageCode, onComplete, onNextGame]);

  const targetLangLabel = module.languageCode?.toUpperCase() === "EN" ? "Английский" : "Немецкий";

  return (
    <div
      className="audio-loop-container"
      style={{ maxWidth: 680, margin: "0 auto", padding: "16px" }}
    >
      {/* Top Bar Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="secondary-button compact"
          onClick={() => {
            pausePlayback();
            onExit();
          }}
          aria-label="Выйти"
        >
          <Icon name="arrow" size={16} /> Назад к играм
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onToggleMute && (
            <button
              type="button"
              className={`secondary-button compact ${muted ? "danger" : ""}`}
              onClick={onToggleMute}
              title={muted ? "Включить звук" : "Выключить звук"}
            >
              <Icon name="volume" size={16} />
            </button>
          )}

          <button
            type="button"
            className={`secondary-button compact ${settingsOpen ? "active" : ""}`}
            onClick={() => setSettingsOpen((prev) => !prev)}
            title="Настройки плейлиста"
          >
            <Icon name="settings" size={16} /> Настройки
          </button>
        </div>
      </div>

      {/* Settings Panel Drawer */}
      {settingsOpen && (
        <div
          style={{
            background: "var(--surface-color, #1e293b)",
            border: "1px solid var(--border-color, #334155)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="settings" size={18} /> Настройки воспроизведения
          </h3>

          {/* Direction */}
          <div>
            <label style={{ fontSize: 13, opacity: 0.8, display: "block", marginBottom: 6 }}>
              Порядок языков:
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`secondary-button compact ${direction === "native_target" ? "active" : ""}`}
                onClick={() => setDirection("native_target")}
              >
                🇷🇺 Русский ➔ 🇩🇪 {targetLangLabel}
              </button>
              <button
                type="button"
                className={`secondary-button compact ${direction === "target_native" ? "active" : ""}`}
                onClick={() => setDirection("target_native")}
              >
                🇩🇪 {targetLangLabel} ➔ 🇷🇺 Русский
              </button>
              <button
                type="button"
                className={`secondary-button compact ${direction === "target_only" ? "active" : ""}`}
                onClick={() => setDirection("target_only")}
              >
                🇩🇪 Только {targetLangLabel}
              </button>
            </div>
          </div>

          {/* Word repeats & Cycle Mode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, opacity: 0.8, display: "block", marginBottom: 6 }}>
                Повторов каждого слова:
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {([1, 2, 3] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`secondary-button compact ${wordRepeats === count ? "active" : ""}`}
                    onClick={() => setWordRepeats(count)}
                    style={{ flex: 1 }}
                  >
                    {count}×
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, opacity: 0.8, display: "block", marginBottom: 6 }}>
                Повтор всего списка:
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {(
                  [
                    ["infinite", "∞ Бесконечно"],
                    ["once", "1 раз"],
                    ["3x", "3 раза"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`secondary-button compact ${loopMode === mode ? "active" : ""}`}
                    onClick={() => setLoopMode(mode)}
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pauses */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, opacity: 0.8, display: "block", marginBottom: 6 }}>
                Пауза на размышление: {pausePromptSec} сек
              </label>
              <input
                type="range"
                min="0.8"
                max="4.0"
                step="0.2"
                value={pausePromptSec}
                onChange={(e) => setPausePromptSec(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, opacity: 0.8, display: "block", marginBottom: 6 }}>
                Пауза между словами: {pauseWordSec} сек
              </label>
              <input
                type="range"
                min="0.8"
                max="4.0"
                step="0.2"
                value={pauseWordSec}
                onChange={(e) => setPauseWordSec(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Speed & Auto Next */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={autoNextModule}
                onChange={(e) => setAutoNextModule(e.target.checked)}
              />
              Автопереход к следующему набору по завершении
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => {
                  setShuffle(e.target.checked);
                  setCurrentIndex(0);
                  setCurrentRepeat(0);
                }}
              />
              Случайный порядок
            </label>
          </div>
        </div>
      )}

      {/* Main Player Display Card */}
      <div
        style={{
          background: "var(--card-bg, #0f172a)",
          border: "2px solid var(--accent-color, #3b82f6)",
          borderRadius: 24,
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Module Title & Progress */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted, #94a3b8)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {module.title}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              fontWeight: 600,
            }}
          >
            Слово {currentIndex + 1} из {sequence.length} · Цикл {cycleCount}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "rgba(255,255,255,0.1)",
            marginBottom: 28,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((currentIndex + 1) / sequence.length) * 100}%`,
              background: "var(--accent-color, #3b82f6)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Status Indicator Pill */}
        <div style={{ minHeight: 32, marginBottom: 20, display: "flex", justifyContent: "center" }}>
          {phase === "speaking_prompt" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 20,
                background: "rgba(59, 130, 246, 0.2)",
                color: "#93c5fd",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                className="pulse-dot"
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#60a5fa" }}
              />
              🔊 Произносим: {direction === "native_target" ? "Русский" : targetLangLabel}
            </div>
          )}
          {phase === "waiting_recall" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 20,
                background: "rgba(234, 179, 8, 0.2)",
                color: "#fde047",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ⏳ Вспомните перевод...
            </div>
          )}
          {phase === "speaking_answer" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 20,
                background: "rgba(34, 197, 94, 0.2)",
                color: "#86efac",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                className="pulse-dot"
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }}
              />
              ✓ Ответ: {direction === "native_target" ? targetLangLabel : "Русский"}
            </div>
          )}
          {phase === "waiting_next" && (
            <div style={{ fontSize: 13, opacity: 0.6 }}>Готовим следующее слово...</div>
          )}
          {phase === "idle" && (
            <div style={{ fontSize: 13, opacity: 0.6 }}>
              {isPlaying ? "Воспроизведение..." : "Нажмите Плей для запуска hands-free режима"}
            </div>
          )}
        </div>

        {/* Active Word & Translation Cards */}
        {currentCard ? (
          <div style={{ margin: "24px 0" }}>
            {/* Word in Target Language */}
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                marginBottom: 12,
                color: "var(--text-color, #f8fafc)",
                letterSpacing: "-0.02em",
              }}
            >
              {currentCard.word}
            </div>

            {/* Translation */}
            <div
              style={{
                fontSize: 22,
                color: "var(--text-muted, #94a3b8)",
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              {currentCard.translation}
            </div>

            {/* Example sentence if available */}
            {currentCard.exampleSentence && (
              <div
                style={{
                  fontSize: 14,
                  fontStyle: "italic",
                  opacity: 0.75,
                  maxWidth: 440,
                  margin: "12px auto 0",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                «{currentCard.exampleSentence}»
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 40, opacity: 0.6 }}>В этом модуле нет карточек для озвучки.</div>
        )}

        {/* Repetition Indicator */}
        <div style={{ marginTop: 20, marginBottom: 24, fontSize: 13, opacity: 0.7 }}>
          Повтор слова: <strong>{currentRepeat + 1}</strong> из <strong>{wordRepeats}</strong>
        </div>

        {/* Big Player Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            marginTop: 16,
          }}
        >
          {/* Previous Track */}
          <button
            type="button"
            className="secondary-button"
            onClick={handlePrev}
            aria-label="Предыдущее слово"
            style={{ width: 52, height: 52, borderRadius: "50%", padding: 0 }}
          >
            <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
              <Icon name="arrow" size={20} />
            </span>
          </button>

          {/* Big Play / Pause Button */}
          <button
            type="button"
            className="primary-button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Пауза" : "Воспроизведение"}
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              padding: 0,
              fontSize: 24,
              boxShadow: isPlaying
                ? "0 0 25px rgba(59, 130, 246, 0.5)"
                : "0 6px 20px rgba(0,0,0,0.3)",
              transform: "scale(1)",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
            }}
          >
            {isPlaying ? (
              <span style={{ fontSize: 26, lineHeight: 1 }}>⏸</span>
            ) : (
              <span style={{ fontSize: 28, marginLeft: 4, lineHeight: 1 }}>▶</span>
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            className="secondary-button"
            onClick={handleNext}
            aria-label="Следующее слово"
            style={{ width: 52, height: 52, borderRadius: "50%", padding: 0 }}
          >
            <Icon name="arrow" size={20} />
          </button>
        </div>

        {/* Quick Mode Indicator Switcher */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            type="button"
            className="ghost-button compact"
            style={{ fontSize: 12, opacity: 0.8 }}
            onClick={() =>
              setDirection((d) => (d === "native_target" ? "target_native" : "native_target"))
            }
          >
            🔄 Направление: {direction === "native_target" ? "🇷🇺 ➔ 🇩🇪" : "🇩🇪 ➔ 🇷🇺"}
          </button>
        </div>
      </div>

      {/* Finished Screen State */}
      {finished && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 16,
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            textAlign: "center",
          }}
        >
          <h4 style={{ margin: "0 0 8px", color: "#86efac", fontSize: 18 }}>🎉 Список пройден!</h4>
          <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.8 }}>
            Вы прослушали все {sequence.length} слов модуля.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                setFinished(false);
                setCurrentIndex(0);
                setCurrentRepeat(0);
                startPlayback();
              }}
            >
              Повторить сначала
            </button>
            {onNextGame && (
              <button type="button" className="secondary-button compact" onClick={onNextGame}>
                Следующая активность
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rating bar at the bottom */}
      <div style={{ marginTop: 24 }}>
        <GameRatingBar gameId="audioloop" moduleId={module.id} />
      </div>
    </div>
  );
}
