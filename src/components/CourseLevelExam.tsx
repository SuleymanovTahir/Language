import { useState, useMemo } from "react";
import { type CourseLevel } from "../data/germanCourse";
import { getLevelExam, getNextLevel, type LevelExamQuestion } from "../data/levelExams";
import { speakText } from "./StudySession";
import { Icon } from "./Icon";

export type LevelExamResult = {
  passed: boolean;
  score: number;
  total: number;
  percent: number;
  completedAt: string;
};

export function getStoredExamResult(level: CourseLevel): LevelExamResult | null {
  try {
    const raw = localStorage.getItem("clickling-level-exam-results");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[level] ?? null;
  } catch {
    return null;
  }
}

export function saveExamResult(level: CourseLevel, result: LevelExamResult) {
  try {
    const raw = localStorage.getItem("clickling-level-exam-results");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[level] = result;
    localStorage.setItem("clickling-level-exam-results", JSON.stringify(parsed));
  } catch {}
}

export function CourseLevelExam({
  level,
  onClose,
  onComplete,
  onNextLevel,
}: {
  level: CourseLevel;
  onClose: () => void;
  onComplete?: (result: LevelExamResult) => void;
  onNextLevel?: (nextLevel: CourseLevel) => void;
}) {
  const exam = useMemo(() => getLevelExam(level), [level]);
  const nextLevel = useMemo(() => getNextLevel(level), [level]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [answersHistory, setAnswersHistory] = useState<
    Array<{
      question: LevelExamQuestion;
      chosen: number;
      isCorrect: boolean;
    }>
  >([]);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = exam.questions[currentIndex];
  const progressPercent = Math.round(((currentIndex + (revealed ? 1 : 0)) / exam.questions.length) * 100);

  const handleSelectChoice = (index: number) => {
    if (revealed) return;
    setSelectedChoice(index);
  };

  const handleCheckAnswer = () => {
    if (selectedChoice === null || revealed) return;
    setRevealed(true);
    const isCorrect = selectedChoice === currentQ.answer;
    if (isCorrect) {
      setScore((s) => s + 1);
    }
    setAnswersHistory((prev) => [
      ...prev,
      {
        question: currentQ,
        chosen: selectedChoice,
        isCorrect,
      },
    ]);
  };

  const handleNextQuestion = () => {
    if (currentIndex < exam.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedChoice(null);
      setRevealed(false);
    } else {
      // Finished!
      const finalScore = score;
      const total = exam.questions.length;
      const percent = Math.round((finalScore / total) * 100);
      const passed = percent >= exam.passingScorePercent;
      const result: LevelExamResult = {
        passed,
        score: finalScore,
        total,
        percent,
        completedAt: new Date().toISOString(),
      };
      saveExamResult(level, result);
      onComplete?.(result);
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedChoice(null);
    setRevealed(false);
    setScore(0);
    setAnswersHistory([]);
    setIsFinished(false);
  };

  const finalPercent = Math.round((score / exam.questions.length) * 100);
  const isPassed = finalPercent >= exam.passingScorePercent;

  return (
    <main className="course-lesson" style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      {/* Header bar */}
      <header className="course-lesson-header" style={{ marginBottom: "20px" }}>
        <button
          className="ghost-button icon-button"
          onClick={onClose}
          aria-label="Закрыть экзамен"
        >
          <Icon name="close" />
        </button>
        <div style={{ flex: 1, margin: "0 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "#2563eb",
              }}
            >
              🏆 Итоговый экзамен · Уровень {level}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>
              {isFinished ? "Экзамен завершён" : `Вопрос ${currentIndex + 1} из ${exam.questions.length}`}
            </span>
          </div>
          <div
            style={{
              height: "8px",
              background: "#e2e8f0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: isFinished ? "100%" : `${progressPercent}%`,
                background: isFinished && isPassed ? "#16a34a" : "linear-gradient(90deg, #3b82f6, #6366f1)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "#16a34a",
            background: "#f0fdf4",
            padding: "4px 10px",
            borderRadius: "12px",
            border: "1px solid #bbf7d0",
          }}
        >
          {score} верных
        </span>
      </header>

      {/* Main content */}
      {!isFinished ? (
        <section
          className="course-lesson-card"
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px 28px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Topic Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #dbeafe",
              }}
            >
              ТАКТИКА: {currentQ.topic}
            </span>

            {currentQ.germanAudio && (
              <button
                type="button"
                onClick={() => speakText(currentQ.germanAudio!, "de-DE")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                <Icon name="volume" /> Прослушать аудио
              </button>
            )}
          </div>

          {/* Question Text */}
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              lineHeight: 1.4,
              color: "#0f172a",
              marginBottom: "20px",
            }}
          >
            {currentQ.question}
          </h2>

          {/* Choices list */}
          <div className="course-choice-list" style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedChoice === idx;
              const isRight = revealed && idx === currentQ.answer;
              const isWrong = revealed && isSelected && idx !== currentQ.answer;

              return (
                <button
                  type="button"
                  key={option}
                  disabled={revealed}
                  className={`${isSelected ? "selected" : ""} ${isRight ? "right-answer" : ""} ${isWrong ? "wrong-answer" : ""}`}
                  onClick={() => handleSelectChoice(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    textAlign: "left",
                    fontSize: "15px",
                    fontWeight: 500,
                    cursor: revealed ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <kbd
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </kbd>
                  <span style={{ flex: 1 }}>{option}</span>
                  {isRight && <Icon name="check" size={20} />}
                </button>
              );
            })}
          </div>

          {/* Explanation box after check */}
          {revealed && (
            <div
              style={{
                marginBottom: "24px",
                padding: "14px 18px",
                borderRadius: "12px",
                background: selectedChoice === currentQ.answer ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${selectedChoice === currentQ.answer ? "#86efac" : "#fca5a5"}`,
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: "15px",
                  color: selectedChoice === currentQ.answer ? "#15803d" : "#b91c1c",
                  marginBottom: "4px",
                }}
              >
                {selectedChoice === currentQ.answer ? "Верно!" : "Неверный ответ"}
              </strong>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: "#334155" }}>
                {currentQ.explanation}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            {!revealed ? (
              <button
                type="button"
                className="primary-button"
                disabled={selectedChoice === null}
                onClick={handleCheckAnswer}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                Проверить ответ <Icon name="check" />
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={handleNextQuestion}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                {currentIndex < exam.questions.length - 1 ? (
                  <>
                    Следующий вопрос <Icon name="arrow" />
                  </>
                ) : (
                  <>
                    Посмотреть результат экзамена <Icon name="spark" />
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      ) : (
        /* Summary / Certificate Screen */
        <section
          className="course-lesson-card"
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          {/* Trophy / Status Icon */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              margin: "0 auto 20px",
              display: "grid",
              placeItems: "center",
              fontSize: "40px",
              background: isPassed ? "linear-gradient(135deg, #fef08a, #facc15)" : "#f1f5f9",
              boxShadow: isPassed ? "0 8px 24px rgba(234, 179, 8, 0.4)" : "none",
            }}
          >
            {isPassed ? "🏆" : "📝"}
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: isPassed ? "#dcfce7" : "#fee2e2",
              color: isPassed ? "#15803d" : "#b91c1c",
              marginBottom: "12px",
            }}
          >
            {isPassed ? "ЭКЗАМЕН СДАН УСПЕШНО" : "ТРЕБУЕТСЯ ПОВТОРЕНИЕ"}
          </span>

          <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 10px", color: "#0f172a" }}>
            {isPassed ? `Поздравляем! Уровень ${level} освоен!` : `Результат экзамена: ${finalPercent}%`}
          </h1>

          <p style={{ fontSize: "16px", color: "#475569", maxWidth: "540px", margin: "0 auto 24px" }}>
            {isPassed
              ? `Вы успешно подтвердили владение языком на уровне ${level} по шкале CEFR, ответив верно на ${score} из ${exam.questions.length} вопросов (${finalPercent}%).`
              : `Вы набрали ${score} из ${exam.questions.length} (${finalPercent}%). Для сертификата уровня ${level} необходимо набрать от ${exam.passingScorePercent}%. Рекомендуем повторить проблемные темы и сдать экзамен снова.`}
          </p>

          {/* Certificate Badge Card */}
          {isPassed && (
            <div
              style={{
                maxWidth: "480px",
                margin: "0 auto 28px",
                padding: "20px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #f8fafc, #eff6ff)",
                border: "2px dashed #93c5fd",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: "36px" }}>🥇</div>
              <div>
                <strong style={{ display: "block", fontSize: "15px", color: "#1e3a8a" }}>
                  Сертификат подтверждения: Deutsch {level}
                </strong>
                <small style={{ color: "#64748b" }}>
                  Балл: {finalPercent}% · Дата сдачи: {new Date().toLocaleDateString("ru-RU")}
                </small>
              </div>
            </div>
          )}

          {/* Mistake analysis if any */}
          {answersHistory.some((a) => !a.isCorrect) && (
            <div style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto 28px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "#334155" }}>
                Темы, где были допущены ошибки ({answersHistory.filter((a) => !a.isCorrect).length}):
              </h3>
              <div style={{ display: "grid", gap: "8px" }}>
                {answersHistory
                  .filter((a) => !a.isCorrect)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        background: "#fef2f2",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                        fontSize: "13px",
                      }}
                    >
                      <strong style={{ color: "#991b1b" }}>{item.question.topic}: </strong>
                      <span style={{ color: "#334155" }}>{item.question.question}</span>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#15803d" }}>
                        Правильный ответ: {item.question.options[item.question.answer]}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            {isPassed && nextLevel && onNextLevel && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onNextLevel(nextLevel)}
                style={{ padding: "12px 28px", fontSize: "15px" }}
              >
                Перейти к уровню {nextLevel} <Icon name="arrow" />
              </button>
            )}

            <button
              type="button"
              className={isPassed ? "secondary-button" : "primary-button"}
              onClick={handleRestart}
              style={{ padding: "12px 24px", fontSize: "15px" }}
            >
              <Icon name="refresh" /> {isPassed ? "Пройти повторно" : "Попробовать снова"}
            </button>

            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              style={{ padding: "12px 20px", fontSize: "15px" }}
            >
              Вернуться к курсу
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
