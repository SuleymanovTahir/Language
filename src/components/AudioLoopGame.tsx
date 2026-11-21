import { useEffect, useMemo, useRef, useState } from "react";
import { modules as allVocabModules, type VocabCard, type VocabModule } from "../lib/vocab";
import {
  speakTextAsync,
  stopAllSpeech,
  speechLocaleForCode,
  type SpeechProvider,
  readSpeechSettings,
} from "../lib/speech";
import { Icon } from "./Icon";
import { GameRatingBar } from "./GameRatingBar";

export type AudioDirection = "native_target" | "target_native" | "target_only";
export type LoopMode = "once" | "2x" | "3x" | "5x" | "infinite";

export function AudioLoopGame({
  module: initialModule,
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
  // Current active module (supports playlist switching and auto-next)
  const [currentModule, setCurrentModule] = useState<VocabModule>(initialModule);

  useEffect(() => {
    setCurrentModule(initialModule);
  }, [initialModule]);

  const cards = useMemo(
    () => currentModule.cards.filter((c) => c.word && c.translation),
    [currentModule.cards],
  );

  // Playlist Settings
  const [direction, setDirection] = useState<AudioDirection>("native_target");
  const [wordRepeats, setWordRepeats] = useState<number>(2); // 1x, 2x, 3x, 5x
  const [loopMode, setLoopMode] = useState<LoopMode>("infinite"); // once, 2x, 3x, 5x, infinite
  const [autoNextModule, setAutoNextModule] = useState(true);
  const [pausePromptSec, setPausePromptSec] = useState<number>(0.9);
  const [pauseWordSec, setPauseWordSec] = useState<number>(1.2);
  const [speed, setSpeed] = useState<number>(0.9);
  const [shuffle, setShuffle] = useState(false);
  const [forceDeviceVoice, setForceDeviceVoice] = useState(false);

  // Panels
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

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
    currentModule,
    forceDeviceVoice,
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
      currentModule,
      forceDeviceVoice,
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
    currentModule,
    forceDeviceVoice,
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
      const step = 40;
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

  const toggleDirection = () => {
    setDirection((prev) => {
      if (prev === "native_target") return "target_native";
      if (prev === "target_native") return "target_only";
      return "native_target";
    });
  };

  const cycleLoopMode = () => {
    setLoopMode((prev) => {
      if (prev === "infinite") return "once";
      if (prev === "once") return "2x";
      if (prev === "2x") return "3x";
      if (prev === "3x") return "5x";
      return "infinite";
    });
  };

  // Helper to find next module in curriculum
  const getNextModule = (modId: number): VocabModule | null => {
    const idx = allVocabModules.findIndex((m) => m.id === modId);
    if (idx >= 0 && idx < allVocabModules.length - 1) {
      return allVocabModules[idx + 1];
    }
    return allVocabModules[0] ?? null;
  };

  // MediaSession API for lock screen and bluetooth headphones
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentCard) return;

    try {
      const targetLang = currentModule.languageCode?.toUpperCase() ?? "DE";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${currentCard.word} — ${currentCard.translation}`,
        artist: `ClickLing · Повтор ${currentRepeat + 1}/${wordRepeats} (Цикл ${cycleCount})`,
        album: `${currentModule.title} [${targetLang}]`,
      });

      navigator.mediaSession.setActionHandler("play", () => startPlayback());
      navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
      navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
      navigator.mediaSession.setActionHandler("previoustrack", () => handlePrev());
    } catch {}
  }, [currentCard, currentRepeat, wordRepeats, cycleCount, currentModule.title, currentModule.languageCode]);

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
          currentModule: activeMod,
          forceDeviceVoice: forceDev,
        } = stateRef.current;

        const card = currentSeq[idx];
        if (!card) break;

        const targetText = card.word.trim();
        const nativeText = card.translation.trim();
        const targetLang = speechLocaleForCode(activeMod.languageCode ?? "de");
        const nativeLang = "ru-RU";

        // Determine First and Second speech items
        let firstText = "";
        let firstLang = "";
        let secondText = "";
        let secondLang = "";

        if (dir === "native_target") {
          // "Я - iht, Ты - Du и так далее по списку"
          firstText = nativeText;
          firstLang = nativeLang;
          secondText = targetText;
          secondLang = targetLang;
        } else if (dir === "target_native") {
          // "Iht - Я и т.д"
          firstText = targetText;
          firstLang = targetLang;
          secondText = nativeText;
          secondLang = nativeLang;
        } else {
          // target_only: "ich", "du"
          firstText = targetText;
          firstLang = targetLang;
          secondText = "";
          secondLang = "";
        }

        const speechOverride = forceDev
          ? { provider: "device" as SpeechProvider, voice: "", rate: 0.85, enabled: true }
          : undefined;

        // STEP 1: Speak prompt (First Item)
        setPhase("speaking_prompt");
        if (!isMuted && firstText) {
          await speakTextAsync(firstText, firstLang, spd < 0.85, speechOverride);
        } else if (!firstText) {
          // nothing to speak
        }
        if (isCancelled || !stateRef.current.isPlaying) break;

        // STEP 2: Pause BETWEEN first and second word (critical!)
        if (secondText) {
          setPhase("waiting_recall");
          // Always pause at least 400ms even when pPrompt is 0, so words don't overlap
          const pauseMs = Math.max(400, pPrompt * 1000);
          const ok = await sleep(pauseMs, () => isCancelled || !stateRef.current.isPlaying);
          if (!ok) break;

          // STEP 3: Speak answer (Second Item)
          setPhase("speaking_answer");
          if (!isMuted) {
            await speakTextAsync(secondText, secondLang, spd < 0.85, speechOverride);
          }
          if (isCancelled || !stateRef.current.isPlaying) break;
        }

        // STEP 4: Pause before next repetition or next word
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

          const maxCycles =
            mode === "once" ? 1 : mode === "2x" ? 2 : mode === "3x" ? 3 : mode === "5x" ? 5 : Infinity;

          if (nextCycle > maxCycles) {
            if (autoNext) {
              // Automatically switch to next module in curriculum!
              const nextMod = getNextModule(activeMod.id);
              if (nextMod && nextMod.id !== activeMod.id) {
                setCurrentModule(nextMod);
                setCurrentIndex(0);
                setCurrentRepeat(0);
                setCycleCount(1);
                continue;
              }
            }

            // Completion reached
            setIsPlaying(false);
            setPhase("idle");
            setFinished(true);
            onComplete?.({ score: currentSeq.length, total: currentSeq.length });

            if (autoNext && onNextGame) {
              onNextGame();
            }
            break;
          } else {
            // Loop current list again from first word
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
  }, [isPlaying, sequence.length, currentModule.id, onComplete, onNextGame]);

  const targetLangLabel = currentModule.languageCode?.toUpperCase() === "EN" ? "Английский" : "Немецкий";

  // Target word active highlight
  const isTargetSpeaking =
    (direction === "native_target" && phase === "speaking_answer") ||
    (direction === "target_native" && phase === "speaking_prompt") ||
    (direction === "target_only" && phase === "speaking_prompt");

  const isNativeSpeaking =
    (direction === "native_target" && phase === "speaking_prompt") ||
    (direction === "target_native" && phase === "speaking_answer");

  return (
    <div className="audio-loop-player-wrapper">
      <style>{`
        .audio-loop-player-wrapper {
          max-width: 680px;
          margin: 0 auto;
          padding: 16px;
          font-family: inherit;
        }

        /* Top Bar Buttons */
        .audio-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .audio-btn {
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: #ffffff;
          color: #1e293b;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          user-select: none;
        }

        .audio-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .audio-btn:active {
          transform: translateY(0);
        }

        .audio-btn.icon-only {
          width: 42px;
          padding: 0;
        }

        .audio-btn.active {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
        }

        .audio-btn.danger {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        .audio-back-btn {
          color: #2563eb;
          border-color: #bfdbfe;
          background: #ffffff;
        }

        .audio-back-btn:hover {
          background: #eff6ff;
          border-color: #93c5fd;
        }

        /* Main Player Card */
        .audio-main-card {
          background: linear-gradient(180deg, #0d1527 0%, #080d1a 100%);
          border: 1px solid rgba(59, 130, 246, 0.35);
          border-radius: 28px;
          padding: 32px 24px;
          text-align: center;
          box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.12);
          position: relative;
          overflow: hidden;
          color: #f8fafc;
        }

        /* Equalizer Animation */
        .audio-eq-container {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          height: 18px;
          margin-right: 6px;
        }

        .audio-eq-bar {
          width: 3px;
          border-radius: 2px;
          background: currentColor;
          height: 6px;
          transition: height 0.15s ease;
        }

        .audio-eq-bar.animating-1 { animation: eqBounce1 0.65s infinite ease-in-out; }
        .audio-eq-bar.animating-2 { animation: eqBounce2 0.55s infinite ease-in-out; }
        .audio-eq-bar.animating-3 { animation: eqBounce3 0.75s infinite ease-in-out; }
        .audio-eq-bar.animating-4 { animation: eqBounce2 0.6s infinite ease-in-out; }
        .audio-eq-bar.animating-5 { animation: eqBounce1 0.7s infinite ease-in-out; }

        @keyframes eqBounce1 {
          0%, 100% { height: 4px; }
          50% { height: 18px; }
        }
        @keyframes eqBounce2 {
          0%, 100% { height: 16px; }
          50% { height: 6px; }
        }
        @keyframes eqBounce3 {
          0%, 100% { height: 8px; }
          50% { height: 20px; }
        }

        /* Large Player Controls */
        .audio-controls-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 24px;
        }

        .audio-ctrl-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        .audio-ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.25);
          transform: scale(1.06);
        }

        .audio-ctrl-btn:active {
          transform: scale(0.96);
        }

        .audio-ctrl-btn.secondary {
          width: 52px;
          height: 52px;
        }

        .audio-ctrl-btn.aux {
          width: 42px;
          height: 42px;
          font-size: 13px;
          font-weight: 700;
        }

        .audio-ctrl-btn.aux.active {
          background: rgba(59, 130, 246, 0.25);
          border-color: #3b82f6;
          color: #60a5fa;
        }

        .audio-ctrl-btn.primary-play {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);
        }

        .audio-ctrl-btn.primary-play.is-playing {
          box-shadow: 0 0 35px rgba(59, 130, 246, 0.65), 0 8px 24px rgba(37, 99, 235, 0.45);
        }

        .audio-ctrl-btn.primary-play:hover {
          transform: scale(1.08);
          background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
        }

        /* Direction Switcher Banner (Bottom) */
        .audio-direction-bar {
          margin-top: 28px;
          display: flex;
          justify-content: center;
        }

        .audio-direction-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          border-radius: 9999px;
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #f8fafc;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
          transition: all 0.2s ease;
        }

        .audio-direction-pill:hover {
          background: rgba(51, 65, 85, 0.95);
          border-color: #60a5fa;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
        }

        .audio-direction-pill:active {
          transform: translateY(0);
        }

        .audio-flag {
          font-size: 18px;
          line-height: 1;
        }

        .audio-arrow-icon {
          color: #38bdf8;
          font-weight: 800;
          font-size: 16px;
        }

        .audio-switch-tag {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          padding: 2px 7px;
          border-radius: 6px;
          margin-left: 4px;
        }

        /* Settings Drawer Panel */
        .audio-panel-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
          color: #1e293b;
        }
      `}</style>

      {/* Top Bar Header */}
      <div className="audio-top-bar">
        {/* Back button with arrow pointing LEFT */}
        <button
          type="button"
          className="audio-btn audio-back-btn"
          onClick={() => {
            pausePlayback();
            onExit();
          }}
          aria-label="Назад к играм"
        >
          <Icon name="arrowLeft" size={18} />
          <span>Назад к играм</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Playlist / Modules Selector button */}
          <button
            type="button"
            className={`audio-btn ${playlistOpen ? "active" : ""}`}
            onClick={() => {
              setPlaylistOpen((prev) => !prev);
              setSettingsOpen(false);
            }}
            title="Выбрать список слов"
          >
            <Icon name="folder" size={16} />
            <span>Списки</span>
          </button>

          {/* Mute button */}
          {onToggleMute && (
            <button
              type="button"
              className={`audio-btn icon-only ${muted ? "danger" : ""}`}
              onClick={onToggleMute}
              title={muted ? "Включить звук" : "Выключить звук"}
              aria-label="Переключить звук"
            >
              <Icon name="volume" size={18} />
            </button>
          )}

          {/* Settings button */}
          <button
            type="button"
            className={`audio-btn ${settingsOpen ? "active" : ""}`}
            onClick={() => {
              setSettingsOpen((prev) => !prev);
              setPlaylistOpen(false);
            }}
            title="Настройки воспроизведения"
          >
            <Icon name="settings" size={16} />
            <span>Настройки</span>
          </button>
        </div>
      </div>

      {/* Playlist Selector Drawer */}
      {playlistOpen && (
        <div className="audio-panel-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="folder" size={18} /> Выберите список слов
            </h3>
            <button
              type="button"
              className="audio-btn icon-only"
              style={{ width: 28, height: 28, border: "none", background: "transparent" }}
              onClick={() => setPlaylistOpen(false)}
            >
              ✕
            </button>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {allVocabModules.map((m) => {
              const isActive = m.id === currentModule.id;
              const cardCount = m.cards.filter((c) => c.word && c.translation).length;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    stopAllSpeech();
                    setCurrentModule(m);
                    setCurrentIndex(0);
                    setCurrentRepeat(0);
                    setCycleCount(1);
                    setPlaylistOpen(false);
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: isActive ? "1.5px solid #3b82f6" : "1px solid #e2e8f0",
                    background: isActive ? "#eff6ff" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    color: isActive ? "#1d4ed8" : "#1e293b",
                    fontWeight: isActive ? 700 : 500,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 14 }}>
                    {isActive ? "▶ " : ""}
                    {m.title}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: isActive ? "#3b82f6" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#64748b",
                    }}
                  >
                    {cardCount} слов
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Panel Drawer */}
      {settingsOpen && (
        <div className="audio-panel-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="settings" size={18} /> Настройки hands-free плейлиста
            </h3>
            <button
              type="button"
              className="audio-btn icon-only"
              style={{ width: 28, height: 28, border: "none", background: "transparent" }}
              onClick={() => setSettingsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Direction */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                Порядок языков:
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`audio-btn ${direction === "native_target" ? "active" : ""}`}
                  onClick={() => setDirection("native_target")}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  🇷🇺 Русский ➔ 🇩🇪 {targetLangLabel}
                </button>
                <button
                  type="button"
                  className={`audio-btn ${direction === "target_native" ? "active" : ""}`}
                  onClick={() => setDirection("target_native")}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  🇩🇪 {targetLangLabel} ➔ 🇷🇺 Русский
                </button>
                <button
                  type="button"
                  className={`audio-btn ${direction === "target_only" ? "active" : ""}`}
                  onClick={() => setDirection("target_only")}
                  style={{ flex: 1, minWidth: 140 }}
                >
                  🇩🇪 Только {targetLangLabel}
                </button>
              </div>
            </div>

            {/* Word Repeats & Playlist Loop Mode */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                  Повторов каждого слова:
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([1, 2, 3, 5] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`audio-btn ${wordRepeats === count ? "active" : ""}`}
                      onClick={() => setWordRepeats(count)}
                      style={{ flex: 1, padding: 0 }}
                    >
                      {count}×
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                  Повтор всего списка:
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {(
                    [
                      ["infinite", "∞ Бесконечно"],
                      ["once", "1 раз"],
                      ["2x", "2 раза"],
                      ["3x", "3 раза"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`audio-btn ${loopMode === mode ? "active" : ""}`}
                      onClick={() => setLoopMode(mode as LoopMode)}
                      style={{ flex: 1, padding: "0 4px", fontSize: 12 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Auto Next Module Switcher */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: "#1e293b", display: "block" }}>
                  Автопереход к следующему списку
                </strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  По окончании списка автоматически перейти к следующей теме курса
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoNextModule}
                onChange={(e) => setAutoNextModule(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
            </div>

            {/* Pauses Configuration */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                  Пауза на перевод: {pausePromptSec} сек
                </label>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={pausePromptSec}
                  onChange={(e) => setPausePromptSec(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#3b82f6" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                  Пауза между словами: {pauseWordSec} сек
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  value={pauseWordSec}
                  onChange={(e) => setPauseWordSec(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#3b82f6" }}
                />
              </div>
            </div>

            {/* Voice Provider preference */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block" }}>
                  Использовать голос устройства для всех слов
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Бесплатно, без задержек сети. Русские слова всегда произносятся голосом устройства.
                </span>
              </div>
              <input
                type="checkbox"
                checked={forceDeviceVoice}
                onChange={(e) => setForceDeviceVoice(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Player Display Card */}
      <div className="audio-main-card">
        {/* Module Title & Progress Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "#93c5fd",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            <Icon name="headphones" size={16} />
            <span>{currentModule.title}</span>
          </div>

          <div
            style={{
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(59, 130, 246, 0.2)",
              color: "#93c5fd",
              fontWeight: 700,
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            Слово {currentIndex + 1} из {sequence.length} · Цикл {cycleCount}
            {loopMode !== "infinite" ? `/${loopMode}` : ""}
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: 6,
            borderRadius: 9999,
            background: "rgba(255, 255, 255, 0.12)",
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((currentIndex + 1) / sequence.length) * 100}%`,
              background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
              borderRadius: 9999,
              transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* Live Audio Equalizer & Phase Indicator Pill */}
        <div style={{ minHeight: 36, marginBottom: 20, display: "flex", justifyContent: "center" }}>
          {isNativeSpeaking && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                background: "rgba(59, 130, 246, 0.2)",
                color: "#93c5fd",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(59, 130, 246, 0.4)",
              }}
            >
              <div className="audio-eq-container">
                <span className="audio-eq-bar animating-1" />
                <span className="audio-eq-bar animating-2" />
                <span className="audio-eq-bar animating-3" />
                <span className="audio-eq-bar animating-4" />
                <span className="audio-eq-bar animating-5" />
              </div>
              <span>🇷🇺 Произносим: {currentCard?.translation}</span>
            </div>
          )}

          {phase === "waiting_recall" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                background: "rgba(234, 179, 8, 0.2)",
                color: "#fde047",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(234, 179, 8, 0.4)",
              }}
            >
              <span>⏳ Вспомните перевод...</span>
            </div>
          )}

          {isTargetSpeaking && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                background: "rgba(16, 185, 129, 0.2)",
                color: "#6ee7b7",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              <div className="audio-eq-container">
                <span className="audio-eq-bar animating-1" />
                <span className="audio-eq-bar animating-2" />
                <span className="audio-eq-bar animating-3" />
                <span className="audio-eq-bar animating-4" />
                <span className="audio-eq-bar animating-5" />
              </div>
              <span>🇩🇪 Ответ: {currentCard?.word}</span>
            </div>
          )}

          {phase === "waiting_next" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                background: "rgba(255, 255, 255, 0.08)",
                color: "#cbd5e1",
                fontSize: 13,
              }}
            >
              <span>Готовим следующее слово...</span>
            </div>
          )}

          {phase === "idle" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                background: "rgba(255, 255, 255, 0.06)",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              <span>Нажмите Play для воспроизведения</span>
            </div>
          )}
        </div>

        {/* Active Word & Translation Cards */}
        {currentCard ? (
          <div style={{ margin: "20px 0" }}>
            {/* Foreign / Target Word */}
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                marginBottom: 10,
                color: isTargetSpeaking ? "#67e8f9" : "#ffffff",
                letterSpacing: "-0.02em",
                textShadow: isTargetSpeaking ? "0 0 25px rgba(6, 182, 212, 0.5)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {currentCard.word}
            </div>

            {/* Translation in Russian */}
            <div
              style={{
                fontSize: 24,
                color: isNativeSpeaking ? "#93c5fd" : "#cbd5e1",
                fontWeight: 600,
                marginBottom: 16,
                textShadow: isNativeSpeaking ? "0 0 20px rgba(59, 130, 246, 0.5)" : "none",
                transition: "all 0.2s ease",
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
                  color: "#cbd5e1",
                  opacity: 0.85,
                  maxWidth: 440,
                  margin: "12px auto 0",
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
        <div
          style={{
            marginTop: 16,
            marginBottom: 20,
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          Повтор слова: <strong style={{ color: "#f8fafc" }}>{currentRepeat + 1}</strong> из{" "}
          <strong style={{ color: "#f8fafc" }}>{wordRepeats}</strong>
        </div>

        {/* Big Modern Player Controls */}
        <div className="audio-controls-row">
          {/* Shuffle Toggle */}
          <button
            type="button"
            className={`audio-ctrl-btn aux ${shuffle ? "active" : ""}`}
            onClick={() => {
              setShuffle((prev) => !prev);
              setCurrentIndex(0);
              setCurrentRepeat(0);
            }}
            title={shuffle ? "Случайный порядок включен" : "Включить случайный порядок"}
            aria-label="Случайный порядок"
          >
            <Icon name="refresh" size={17} />
          </button>

          {/* Previous Track */}
          <button
            type="button"
            className="audio-ctrl-btn secondary"
            onClick={handlePrev}
            aria-label="Предыдущее слово"
            title="Предыдущее слово"
          >
            <Icon name="arrowLeft" size={20} />
          </button>

          {/* Big Play / Pause Button with SVG */}
          <button
            type="button"
            className={`audio-ctrl-btn primary-play ${isPlaying ? "is-playing" : ""}`}
            onClick={togglePlay}
            aria-label={isPlaying ? "Пауза" : "Воспроизведение"}
            title={isPlaying ? "Пауза" : "Воспроизведение"}
          >
            {isPlaying ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            className="audio-ctrl-btn secondary"
            onClick={handleNext}
            aria-label="Следующее слово"
            title="Следующее слово"
          >
            <Icon name="arrow" size={20} />
          </button>

          {/* Repeat / Loop Mode Toggle */}
          <button
            type="button"
            className={`audio-ctrl-btn aux ${loopMode !== "once" ? "active" : ""}`}
            onClick={cycleLoopMode}
            title={`Режим цикла: ${loopMode === "infinite" ? "Бесконечно" : loopMode}`}
            aria-label="Режим цикла"
          >
            {loopMode === "infinite" ? (
              <span style={{ fontSize: 18, lineHeight: 1 }}>∞</span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700 }}>{loopMode}</span>
            )}
          </button>
        </div>

        {/* High-Contrast Direction Pill Switcher (Fixes invisible flags!) */}
        <div className="audio-direction-bar">
          <button
            type="button"
            className="audio-direction-pill"
            onClick={toggleDirection}
            title="Нажмите, чтобы переключить порядок языков"
          >
            {direction === "native_target" && (
              <>
                <span className="audio-flag">🇷🇺</span>
                <span>Русский</span>
                <span className="audio-arrow-icon">➔</span>
                <span className="audio-flag">🇩🇪</span>
                <span>{targetLangLabel}</span>
              </>
            )}
            {direction === "target_native" && (
              <>
                <span className="audio-flag">🇩🇪</span>
                <span>{targetLangLabel}</span>
                <span className="audio-arrow-icon">➔</span>
                <span className="audio-flag">🇷🇺</span>
                <span>Русский</span>
              </>
            )}
            {direction === "target_only" && (
              <>
                <span className="audio-flag">🇩🇪</span>
                <span>Только {targetLangLabel}</span>
              </>
            )}
            <span className="audio-switch-tag">⇄ Сменить</span>
          </button>
        </div>
      </div>

      {/* Finished Screen State */}
      {finished && (
        <div
          style={{
            marginTop: 20,
            padding: 24,
            borderRadius: 20,
            background: "#ffffff",
            border: "1px solid #bbf7d0",
            boxShadow: "0 10px 25px -5px rgba(34, 197, 94, 0.15)",
            textAlign: "center",
          }}
        >
          <h4 style={{ margin: "0 0 8px", color: "#16a34a", fontSize: 20, fontWeight: 700 }}>
            🎉 Список успешно пройден!
          </h4>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#475569" }}>
            Вы прослушали все {sequence.length} слов модуля «{currentModule.title}».
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              type="button"
              className="audio-btn active"
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
              <button type="button" className="audio-btn" onClick={onNextGame}>
                Следующая игра
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rating bar at the bottom */}
      <div style={{ marginTop: 24 }}>
        <GameRatingBar gameId="audioloop" moduleId={currentModule.id} />
      </div>
    </div>
  );
}
