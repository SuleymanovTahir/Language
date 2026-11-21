import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "./Icon";
import { speakText } from "./StudySession";
import { playFeedbackSound } from "../lib/feedbackSound";
import { stopAllSpeech } from "../lib/speech";

export type VocabWord = {
  id: number;
  word: string;
  translation: string;
  phonetic?: string;
  exampleDe?: string;
  exampleRu?: string;
};

type Props = {
  unitTitle: string;
  outcome: string;
  words: VocabWord[];
  onComplete: () => void;
};

type BatchStep =
  | { type: "intro"; wordIndex: number }
  | { type: "micro_check"; wordIndex: number }
  | { type: "interleaved_review"; currentWordIndex: number; reviewWordIndex: number }
  | { type: "pair_match"; wordIndices: number[] };

export function ProgressiveVocabTrainer({
  unitTitle,
  outcome,
  words,
  onComplete,
}: Props) {
  // Split words into micro-batches of 2 words (last batch may have 3 if 5 words total)
  const wordsLength = words.length;
  const batches: number[][] = useMemo(() => {
    if (wordsLength <= 3) return [Array.from({ length: wordsLength }, (_, i) => i)];
    const res: number[][] = [];
    for (let i = 0; i < wordsLength; i += 2) {
      if (i + 2 === wordsLength - 1) {
        // Leave 3 for last batch rather than single orphan
        res.push([i, i + 1, i + 2]);
        break;
      }
      res.push([i, Math.min(i + 1, wordsLength - 1)]);
    }
    return res;
  }, [wordsLength]);

  const [batchIdx, setBatchIdx] = useState(0);
  const [stepInBatch, setStepInBatch] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<"idle" | "correct" | "incorrect">("idle");
  const [reviewAnswer, setReviewAnswer] = useState<number | null>(null);
  const [reviewState, setReviewState] = useState<"idle" | "correct" | "incorrect">("idle");
  const [matchedInStep, setMatchedInStep] = useState<number[]>([]);
  const [selectedMatchLeft, setSelectedMatchLeft] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [knownWords, setKnownWords] = useState<Set<number>>(new Set());
  const lastSpokenKeyRef = useRef<string>("");

  const currentBatch = batches[batchIdx] ?? [];
  const prevBatchIndices = useMemo(() => {
    const list: number[] = [];
    for (let b = 0; b < batchIdx; b++) {
      list.push(...(batches[b] ?? []));
    }
    return list;
  }, [batches, batchIdx]);

  // Construct sequence of micro-steps for the current batch
  const batchSteps: BatchStep[] = useMemo(() => {
    const steps: BatchStep[] = [];
    currentBatch.forEach((wIdx) => {
      steps.push({ type: "intro", wordIndex: wIdx });
      steps.push({ type: "micro_check", wordIndex: wIdx });
    });

    if (batchIdx > 0 && prevBatchIndices.length > 0) {
      // Interleaved review: review one word from this batch and one from previous batch!
      const revIdx = prevBatchIndices[batchIdx % prevBatchIndices.length];
      const curIdx = currentBatch[0];
      steps.push({
        type: "interleaved_review",
        currentWordIndex: curIdx,
        reviewWordIndex: revIdx,
      });
    }

    // Mini 2-pair tap match to consolidate the batch
    steps.push({ type: "pair_match", wordIndices: currentBatch.slice(0, 2) });
    return steps;
  }, [currentBatch, batchIdx, prevBatchIndices]);

  const currentStep = batchSteps[stepInBatch];
  const introWordIndex = currentStep?.type === "intro" ? currentStep.wordIndex : null;

  // Auto-speak word on intro card EXACTLY ONCE per step (never loops)
  useEffect(() => {
    if (!currentStep || currentStep.type !== "intro" || introWordIndex === null) return;
    const w = words[introWordIndex];
    if (!w) return;
    const key = `${batchIdx}-${stepInBatch}-${w.word}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;
    speakText(w.word, "de-DE");
  }, [introWordIndex, batchIdx, stepInBatch, words]);

  // Clean up any ongoing speech when unmounting
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  // Total overall progress calculation
  const totalSubSteps = useMemo(() => {
    let count = 0;
    batches.forEach((b, bI) => {
      count += b.length * 2; // intro + micro_check
      if (bI > 0) count += 1; // interleaved_review
      count += 1; // pair_match
    });
    return count;
  }, [batches]);

  const currentProgressStep = useMemo(() => {
    let count = 0;
    for (let b = 0; b < batchIdx; b++) {
      count += (batches[b]?.length ?? 0) * 2;
      if (b > 0) count += 1;
      count += 1;
    }
    count += stepInBatch;
    return count;
  }, [batchIdx, stepInBatch, batches]);

  const progressPercent = Math.min(
    100,
    Math.round(((currentProgressStep + 1) / (totalSubSteps + 1)) * 100),
  );

  function advanceSubStep() {
    setSelectedAnswer(null);
    setAnswerState("idle");
    setReviewAnswer(null);
    setReviewState("idle");
    setSelectedMatchLeft(null);
    setMatchedInStep([]);

    if (stepInBatch + 1 < batchSteps.length) {
      setStepInBatch((s) => s + 1);
    } else {
      // Advance to next batch or finish
      if (batchIdx + 1 < batches.length) {
        setBatchIdx((b) => b + 1);
        setStepInBatch(0);
      } else {
        setIsFinished(true);
      }
    }
  }

  // Fast-track: "Уже знаю это слово"
  function handleMarkAsKnown(wIdx: number) {
    setKnownWords((prev) => new Set(prev).add(wIdx));
    // If next step is micro_check for this same word, skip it!
    if (
      stepInBatch + 1 < batchSteps.length &&
      batchSteps[stepInBatch + 1].type === "micro_check"
    ) {
      setStepInBatch((s) => s + 2 < batchSteps.length ? s + 2 : s + 1);
      setSelectedAnswer(null);
      setAnswerState("idle");
    } else {
      advanceSubStep();
    }
  }

  // Micro-check question choices
  const currentCheckWord =
    currentStep?.type === "micro_check"
      ? words[currentStep.wordIndex]
      : null;

  const checkChoices = useMemo(() => {
    if (!currentCheckWord) return [];
    const correct = currentCheckWord.translation;
    const others = words
      .filter((w) => w.id !== currentCheckWord.id)
      .map((w) => w.translation);
    const fallbacks = ["спасибо", "пожалуйста", "здравствуйте", "хорошо", "да"];
    const pool = others.length >= 2 ? others : [...others, ...fallbacks];
    const distractors = pool
      .filter((t) => t !== correct)
      .slice(0, 2);
    const all = [correct, ...distractors].sort((a, b) => a.localeCompare(b));
    return all;
  }, [currentCheckWord, words]);

  function handleCheckChoice(choice: string, idx: number) {
    if (!currentCheckWord || answerState !== "idle") return;
    setSelectedAnswer(idx);
    const isCorrect = choice === currentCheckWord.translation;
    if (isCorrect) {
      playFeedbackSound(true);
      setAnswerState("correct");
      setTimeout(() => {
        advanceSubStep();
      }, 750);
    } else {
      playFeedbackSound(false);
      setAnswerState("incorrect");
    }
  }

  // Review step question choices
  const reviewWord =
    currentStep?.type === "interleaved_review"
      ? words[currentStep.reviewWordIndex]
      : null;

  const reviewChoices = useMemo(() => {
    if (!reviewWord) return [];
    const correct = reviewWord.translation;
    const others = words
      .filter((w) => w.id !== reviewWord.id)
      .map((w) => w.translation);
    const pool = others.length >= 2 ? others : [...others, "нет", "привет"];
    const distractors = pool.filter((t) => t !== correct).slice(0, 2);
    return [correct, ...distractors].sort((a, b) => a.localeCompare(b));
  }, [reviewWord, words]);

  function handleReviewChoice(choice: string, idx: number) {
    if (!reviewWord || reviewState !== "idle") return;
    setReviewAnswer(idx);
    const isCorrect = choice === reviewWord.translation;
    if (isCorrect) {
      playFeedbackSound(true);
      setReviewState("correct");
      setTimeout(() => {
        advanceSubStep();
      }, 800);
    } else {
      playFeedbackSound(false);
      setReviewState("incorrect");
    }
  }

  // Pair match in batch
  const matchWords = useMemo(() => {
    if (currentStep?.type !== "pair_match") return [];
    return currentStep.wordIndices.map((idx) => words[idx]).filter(Boolean);
  }, [currentStep, words]);

  function handleLeftMatch(wIdx: number) {
    if (matchedInStep.includes(wIdx)) return;
    setSelectedMatchLeft(wIdx);
  }

  function handleRightMatch(wIdx: number) {
    if (selectedMatchLeft === null || matchedInStep.includes(wIdx)) return;
    if (selectedMatchLeft === wIdx) {
      playFeedbackSound(true);
      const nextMatched = [...matchedInStep, wIdx];
      setMatchedInStep(nextMatched);
      setSelectedMatchLeft(null);
      if (nextMatched.length >= matchWords.length) {
        setTimeout(() => {
          advanceSubStep();
        }, 650);
      }
    } else {
      playFeedbackSound(false);
      setSelectedMatchLeft(null);
    }
  }

  if (isFinished) {
    return (
      <div className="course-vocab-trainer-finished" style={{ padding: "10px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#ecfdf5",
            color: "#059669",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            marginBottom: "14px",
          }}
        >
          <Icon name="check" size={16} /> Все партии слов пройдены!
        </div>
        <h1 style={{ fontSize: "28px", margin: "0 0 10px", color: "#1e293b" }}>
          Отличный результат!
        </h1>
        <p style={{ color: "#64748b", fontSize: "15px", margin: "0 0 24px" }}>
          Вы пошагово освоили все {words.length} слов темы <b>«{unitTitle}»</b>: изучили каждое по
          отдельности, закрепили и повторили в связке.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          {words.map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
              }}
            >
              <div>
                <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>
                  {w.word}
                </strong>
                <span style={{ fontSize: "13px", color: "#64748b" }}>{w.translation}</span>
              </div>
              <button
                type="button"
                aria-label={`Прослушать ${w.word}`}
                onClick={() => speakText(w.word, "de-DE")}
                style={{
                  background: "#eff6ff",
                  color: "#2563eb",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <Icon name="volume" size={17} />
              </button>
            </div>
          ))}
        </div>

        <button
          className="primary-button"
          onClick={onComplete}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "15px",
            padding: "14px 28px",
          }}
        >
          Перейти к закреплению в мини-игре <Icon name="arrow" />
        </button>
      </div>
    );
  }

  return (
    <div className="course-progressive-vocab-trainer">
      {/* Top Trainer Progress & Micro-Batch Indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#6366f1",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Партия {batchIdx + 1} из {batches.length}
        </span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>
          {progressPercent}% освоено
        </span>
      </div>

      {/* Segmented Progress Bar */}
      <div
        style={{
          width: "100%",
          height: "8px",
          background: "#f1f5f9",
          borderRadius: "999px",
          overflow: "hidden",
          marginBottom: "24px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: "linear-gradient(90deg, #6366f1 0%, #3b82f6 100%)",
            borderRadius: "999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* STEP 1: INTRODUCE SINGLE WORD (ПО ЧУТЬ-ЧУТЬ) */}
      {currentStep?.type === "intro" && (() => {
        const wordObj = words[currentStep.wordIndex];
        if (!wordObj) return null;
        return (
          <div
            className="vocab-intro-card"
            style={{
              padding: "26px",
              background: "#ffffff",
              border: "2px solid #e0e7ff",
              borderRadius: "20px",
              boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                background: "#eef2ff",
                color: "#4f46e5",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: "16px",
              }}
            >
              Новое слово партии
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <h2
                style={{
                  fontSize: "38px",
                  fontWeight: 800,
                  margin: 0,
                  color: "#1e1b4b",
                  letterSpacing: "-0.02em",
                }}
              >
                {wordObj.word}
              </h2>
              <button
                type="button"
                aria-label={`Прослушать ${wordObj.word}`}
                onClick={() => speakText(wordObj.word, "de-DE")}
                style={{
                  background: "#e0e7ff",
                  color: "#4338ca",
                  border: "none",
                  borderRadius: "50%",
                  width: "44px",
                  height: "44px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              >
                <Icon name="volume" size={22} />
              </button>
            </div>

            {wordObj.phonetic && (
              <p style={{ color: "#818cf8", fontSize: "14px", margin: "0 0 10px" }}>
                {wordObj.phonetic}
              </p>
            )}

            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: "#475569",
                margin: "0 0 20px",
              }}
            >
              {wordObj.translation}
            </div>

            {wordObj.exampleDe && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  textAlign: "left",
                  margin: "0 auto 24px",
                  maxWidth: "520px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "15px" }}>
                    {wordObj.exampleDe}
                  </div>
                  {wordObj.exampleRu && (
                    <div style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>
                      {wordObj.exampleRu}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Прослушать пример"
                  onClick={() => speakText(wordObj.exampleDe ?? "", "de-DE")}
                  style={{
                    background: "#eff6ff",
                    color: "#2563eb",
                    border: "none",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="volume" size={17} />
                </button>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "10px",
              }}
            >
              {/* Fast-track button avoiding slow Duolingo trap */}
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleMarkAsKnown(currentStep.wordIndex)}
                style={{
                  fontSize: "14px",
                  padding: "12px 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                ⚡ Уже знаю это слово
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={advanceSubStep}
                style={{
                  fontSize: "15px",
                  padding: "12px 24px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Понятно, закрепить <Icon name="arrow" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* STEP 2: IMMEDIATE MICRO-CHECK (ЗАКРЕПИЛ) */}
      {currentStep?.type === "micro_check" && currentCheckWord && (
        <div
          className="vocab-check-card"
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              background: "#fef3c7",
              color: "#b45309",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            Проверим запоминание
          </div>

          <h3 style={{ fontSize: "20px", color: "#1e293b", margin: "0 0 12px" }}>
            Как переводится слово:
          </h3>
          <div
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#3b82f6",
              marginBottom: "24px",
            }}
          >
            {currentCheckWord.word}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "10px",
              maxWidth: "420px",
              margin: "0 auto 20px",
            }}
          >
            {checkChoices.map((choice, idx) => {
              const isSelected = selectedAnswer === idx;
              const isCorrectChoice = choice === currentCheckWord.translation;
              let bg = "#f8fafc";
              let border = "1px solid #e2e8f0";
              let color = "#1e293b";

              if (answerState === "correct" && isSelected) {
                bg = "#ecfdf5";
                border = "2px solid #10b981";
                color = "#047857";
              } else if (answerState === "incorrect") {
                if (isSelected) {
                  bg = "#fef2f2";
                  border = "2px solid #ef4444";
                  color = "#b91c1c";
                } else if (isCorrectChoice) {
                  bg = "#ecfdf5";
                  border = "2px solid #10b981";
                  color = "#047857";
                }
              }

              return (
                <button
                  key={choice}
                  type="button"
                  disabled={answerState !== "idle"}
                  onClick={() => handleCheckChoice(choice, idx)}
                  style={{
                    padding: "16px 20px",
                    borderRadius: "14px",
                    background: bg,
                    border,
                    color,
                    fontSize: "16px",
                    fontWeight: 600,
                    textAlign: "center",
                    cursor: answerState === "idle" ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {answerState === "correct" && (
            <p style={{ color: "#059669", fontWeight: 700, margin: "10px 0 0" }}>
              Верно! Слово закреплено 🎉
            </p>
          )}

          {answerState === "incorrect" && (
            <div style={{ marginTop: "14px" }}>
              <p style={{ color: "#dc2626", fontWeight: 600, margin: "0 0 10px" }}>
                Правильный перевод: <b>{currentCheckWord.translation}</b>
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={advanceSubStep}
                style={{ fontSize: "14px", padding: "10px 20px" }}
              >
                Понятно, дальше <Icon name="arrow" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: INTERLEAVED REVIEW (ПРИ ЭТОМ ИЗУЧЕННОЕ ПОВТОРЯЕТСЯ) */}
      {currentStep?.type === "interleaved_review" && reviewWord && (
        <div
          className="vocab-review-card"
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "2px solid #fed7aa",
            borderRadius: "20px",
            boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              background: "#fff7ed",
              color: "#c2410c",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            🔁 Повторение из прошлой партии
          </div>

          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 10px" }}>
            Проверим, помните ли вы слово из предыдущей партии:
          </p>
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#ea580c",
              marginBottom: "24px",
            }}
          >
            {reviewWord.word}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "10px",
              maxWidth: "420px",
              margin: "0 auto 20px",
            }}
          >
            {reviewChoices.map((choice, idx) => {
              const isSelected = reviewAnswer === idx;
              const isCorrectChoice = choice === reviewWord.translation;
              let bg = "#f8fafc";
              let border = "1px solid #e2e8f0";
              let color = "#1e293b";

              if (reviewState === "correct" && isSelected) {
                bg = "#ecfdf5";
                border = "2px solid #10b981";
                color = "#047857";
              } else if (reviewState === "incorrect") {
                if (isSelected) {
                  bg = "#fef2f2";
                  border = "2px solid #ef4444";
                  color = "#b91c1c";
                } else if (isCorrectChoice) {
                  bg = "#ecfdf5";
                  border = "2px solid #10b981";
                  color = "#047857";
                }
              }

              return (
                <button
                  key={choice}
                  type="button"
                  disabled={reviewState !== "idle"}
                  onClick={() => handleReviewChoice(choice, idx)}
                  style={{
                    padding: "16px 20px",
                    borderRadius: "14px",
                    background: bg,
                    border,
                    color,
                    fontSize: "16px",
                    fontWeight: 600,
                    textAlign: "center",
                    cursor: reviewState === "idle" ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {reviewState === "correct" && (
            <p style={{ color: "#059669", fontWeight: 700, margin: "10px 0 0" }}>
              Отлично! Память надёжно зафиксировала слово ✨
            </p>
          )}

          {reviewState === "incorrect" && (
            <div style={{ marginTop: "14px" }}>
              <p style={{ color: "#dc2626", fontWeight: 600, margin: "0 0 10px" }}>
                Правильный перевод: <b>{reviewWord.translation}</b>
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={advanceSubStep}
                style={{ fontSize: "14px", padding: "10px 20px" }}
              >
                Понятно, дальше <Icon name="arrow" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: MINI 2-PAIR MATCH TO CONSOLIDATE BATCH */}
      {currentStep?.type === "pair_match" && (
        <div
          className="vocab-mini-match-card"
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              background: "#ede9fe",
              color: "#7c3aed",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "14px",
            }}
          >
            Связка слов партии
          </div>

          <h3 style={{ fontSize: "20px", color: "#1e293b", margin: "0 0 8px" }}>
            Соедините пары слов партии
          </h3>
          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px" }}>
            Нажмите слово слева, затем его перевод справа.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            <div style={{ display: "grid", gap: "10px" }}>
              {matchWords.map((w) => {
                const isMatched = matchedInStep.includes(w.id);
                const isSelected = selectedMatchLeft === w.id;
                return (
                  <button
                    key={`l-${w.id}`}
                    type="button"
                    disabled={isMatched}
                    onClick={() => handleLeftMatch(w.id)}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: isMatched
                        ? "#ecfdf5"
                        : isSelected
                        ? "#e0e7ff"
                        : "#f8fafc",
                      border: isMatched
                        ? "2px solid #10b981"
                        : isSelected
                        ? "2px solid #6366f1"
                        : "1px solid #e2e8f0",
                      color: isMatched
                        ? "#047857"
                        : isSelected
                        ? "#4338ca"
                        : "#1e293b",
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: isMatched ? "default" : "pointer",
                      textAlign: "center",
                      opacity: isMatched ? 0.6 : 1,
                    }}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {[...matchWords].reverse().map((w) => {
                const isMatched = matchedInStep.includes(w.id);
                return (
                  <button
                    key={`r-${w.id}`}
                    type="button"
                    disabled={isMatched}
                    onClick={() => handleRightMatch(w.id)}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: isMatched ? "#ecfdf5" : "#f8fafc",
                      border: isMatched
                        ? "2px solid #10b981"
                        : "1px solid #e2e8f0",
                      color: isMatched ? "#047857" : "#1e293b",
                      fontWeight: 600,
                      fontSize: "15px",
                      cursor: isMatched ? "default" : "pointer",
                      textAlign: "center",
                      opacity: isMatched ? 0.6 : 1,
                    }}
                  >
                    {w.translation}
                  </button>
                );
              })}
            </div>
          </div>

          {matchedInStep.length >= matchWords.length && (
            <p style={{ color: "#059669", fontWeight: 700, margin: "16px 0 0" }}>
              Партия успешно закреплена! ✨
            </p>
          )}
        </div>
      )}
    </div>
  );
}
