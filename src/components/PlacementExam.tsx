import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";
import { speakText } from "./StudySession";
import { readProfileItem, removeProfileItem, writeProfileItem } from "../lib/profileStorage";
import {
  PLACEMENT_LEVELS,
  PLACEMENT_QUESTIONS,
  type PlacementLevel,
  type PlacementQuestion,
  type PlacementSection,
} from "../data/placementExam";

export type SelfLevel = "zero" | "unsure" | PlacementLevel;
export type SelfSkillRating = "Слабо" | "Средне" | "Хорошо" | "Отлично";
export type SelfSkillRatings = Partial<
  Record<"Лексика" | "Грамматика" | "Чтение" | "Аудирование" | "Письмо", SelfSkillRating>
>;

export type PlacementAnswer = {
  id: string;
  level: PlacementLevel;
  section: PlacementSection;
  topic: string;
  answer: string;
  correctAnswer: string;
  score: number;
  status: "correct" | "wrong" | "skipped" | "partial";
  elapsedMs: number;
  feedback?: { weakTopic: string; excerpt: string; correction: string; rule: string };
};
export type PlacementLevelResult = {
  level: PlacementLevel;
  score: number;
  total: 20;
  status: "passed" | "borderline" | "failed" | "incomplete";
  sections: Partial<Record<PlacementSection, { score: number; total: number }>>;
  earlyStop?: boolean;
};
export type PlacementWeakTopic = {
  topic: string;
  wrong: number;
  total: number;
  example: string;
  rule: string;
  game: string;
};
export type PlacementReport = {
  selfLevel: SelfLevel;
  level: PlacementLevel;
  progressPercent: number;
  levels: PlacementLevelResult[];
  answers: PlacementAnswer[];
  weakTopics: PlacementWeakTopic[];
  skills: {
    skill: PlacementSection;
    title: string;
    percent: number;
    rating: string;
    self?: SelfSkillRating;
  }[];
  reliability: "reliable" | "approximate";
  writingAutoGraded: boolean;
  comparison: string;
  completedAt: string;
};

type ExamSession = {
  selfLevel: SelfLevel;
  selfSkills: SelfSkillRatings;
  startLevel: PlacementLevel;
  currentLevel: PlacementLevel;
  answers: PlacementAnswer[];
  levels: PlacementLevelResult[];
  drafts: Record<string, string>;
  audioPlays: Record<string, number>;
  dontKnowStreak: number;
  maxDontKnowStreak: number;
  startedAt: number;
  readingListeningTooFast: boolean;
  writingAutoGraded: boolean;
};

const SESSION_KEY = "linguaplay-placement-session";
const levelIndex = (level: PlacementLevel) => PLACEMENT_LEVELS.indexOf(level);
const sectionTitles: Record<PlacementSection, string> = {
  vocabulary: "Лексика",
  grammar: "Грамматика",
  reading: "Чтение",
  listening: "Аудирование",
  writing: "Письмо",
};
const skillOrder: PlacementSection[] = ["vocabulary", "grammar", "reading", "listening", "writing"];
const skillRating = (percent: number) =>
  percent < 40
    ? "Нужно подтянуть"
    : percent < 65
      ? "Начальный уровень"
      : percent < 85
        ? "Уверенно"
        : "Сильная сторона";
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[.,!?;:„“"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
const formatScore = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function makeSession(selfLevel: SelfLevel, selfSkills: SelfSkillRatings): ExamSession {
  const startIndex =
    selfLevel === "zero" || selfLevel === "unsure" ? 0 : Math.max(0, levelIndex(selfLevel) - 1);
  const startLevel = PLACEMENT_LEVELS[startIndex];
  return {
    selfLevel,
    selfSkills,
    startLevel,
    currentLevel: startLevel,
    answers: [],
    levels: [],
    drafts: {},
    audioPlays: {},
    dontKnowStreak: 0,
    maxDontKnowStreak: 0,
    startedAt: Date.now(),
    readingListeningTooFast: false,
    writingAutoGraded: true,
  };
}

function levelStatus(
  score: number,
  sections: PlacementLevelResult["sections"],
): PlacementLevelResult["status"] {
  const listeningReadingGrammar = (["grammar", "reading", "listening"] as PlacementSection[]).some(
    (section) => {
      const result = sections[section];
      return Boolean(result && result.score / Math.max(1, result.total) < 0.5);
    },
  );
  if (score >= 14 && !listeningReadingGrammar) return "passed";
  if (score >= 11) return "borderline";
  return "failed";
}

function summarizeLevel(
  session: ExamSession,
  level: PlacementLevel,
  earlyStop = false,
): PlacementLevelResult {
  const answers = session.answers.filter((answer) => answer.level === level);
  const sections: PlacementLevelResult["sections"] = {};
  for (const section of skillOrder) {
    const results = answers.filter((answer) => answer.section === section);
    if (results.length)
      sections[section] = {
        score: results.reduce((sum, answer) => sum + answer.score, 0),
        total: section === "writing" ? 2 : results.length,
      };
  }
  const score = answers.reduce((sum, answer) => sum + answer.score, 0);
  return {
    level,
    score,
    total: 20,
    status: earlyStop ? "failed" : levelStatus(score, sections),
    sections,
    earlyStop,
  };
}

function makeReport(session: ExamSession, incomplete = false): PlacementReport {
  const levelResults = [...session.levels];
  if (incomplete) {
    const current = session.answers.filter((answer) => answer.level === session.currentLevel);
    if (current.length && !levelResults.some((result) => result.level === session.currentLevel)) {
      levelResults.push({ ...summarizeLevel(session, session.currentLevel), status: "incomplete" });
    }
  }
  const passed = levelResults.filter(
    (item) => item.status === "passed" || item.status === "borderline",
  );
  const topPassed = passed.sort((a, b) => levelIndex(b.level) - levelIndex(a.level))[0];
  const level = topPassed?.level ?? "A1";
  const firstUnpassed = levelResults.find(
    (item) => item.status === "failed" || item.status === "incomplete",
  );
  const progressPercent = firstUnpassed ? Math.round((firstUnpassed.score / 20) * 100) : 0;
  const weights: Record<PlacementLevel, number> = { A1: 1, A2: 1.5, B1: 2, B2: 2.5, C1: 3 };
  const skills = skillOrder.map((section) => {
    const answers = session.answers.filter((answer) => answer.section === section);
    const totalWeight = answers.reduce((sum, answer) => sum + weights[answer.level], 0);
    const earnedWeight = answers.reduce(
      (sum, answer) => sum + weights[answer.level] * answer.score,
      0,
    );
    const percent = totalWeight ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    return {
      skill: section,
      title: sectionTitles[section],
      percent,
      rating: totalWeight ? skillRating(percent) : "Не проверено",
      self: session.selfSkills[sectionTitles[section] as keyof SelfSkillRatings],
    };
  });
  const byTopic = new Map<string, PlacementAnswer[]>();
  for (const answer of session.answers) {
    if (answer.status === "wrong" || answer.status === "skipped" || answer.status === "partial") {
      const key = answer.feedback?.weakTopic || answer.topic;
      byTopic.set(key, [...(byTopic.get(key) ?? []), answer]);
    }
  }
  const gameForTopic = (topic: string, section: PlacementSection) => {
    const label = topic.toLocaleLowerCase();
    if (section === "listening" || /слух|произнош|фонет/.test(label)) return "Фонетический тир";
    if (/артик|род/.test(label)) return "Артикли";
    if (/порядок слов|word order/.test(label)) return "Собери предложение";
    if (/лекс|слова/.test(label) || section === "vocabulary") return "Пары слов";
    return "Блиц-тест";
  };
  const weakTopics = [...byTopic.entries()]
    .map(([topic, answers]) => {
      const question = PLACEMENT_QUESTIONS.find((item) => item.id === answers[0].id);
      const first = answers[0];
      const total = session.answers.filter(
        (answer) => (answer.feedback?.weakTopic || answer.topic) === topic,
      ).length;
      return {
        topic,
        wrong: answers.length,
        total,
        example:
          first.feedback?.excerpt ||
          `Ваш ответ: ${first.answer || "Не знаю"} · верно: ${first.correctAnswer || "проверьте пример"}`,
        rule:
          first.feedback?.rule ||
          (question?.correction
            ? `Верная форма: ${question.correction}`
            : `Повторите тему «${topic}» на коротких заданиях.`),
        game: gameForTopic(topic, first.section),
      };
    })
    .filter((topic) => topic.wrong >= 2 || (topic.total >= 2 && topic.wrong / topic.total >= 0.66))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5);
  const selfNumeric =
    session.selfLevel === "zero"
      ? 0
      : session.selfLevel === "unsure"
        ? null
        : levelIndex(session.selfLevel as PlacementLevel) + 1;
  const realNumeric = levelIndex(level) + 1;
  const delta = selfNumeric === null ? null : realNumeric - selfNumeric;
  const comparison =
    delta === null
      ? "Тест подобрал уровень по вашим ответам."
      : delta === 0
        ? "Вы оценили свой уровень точно."
        : delta < 0
          ? delta === -1
            ? "Результат немного ниже вашей оценки — это обычная часть обучения."
            : "Нашли темы, которые стоит укрепить перед выбранным уровнем."
          : delta === 1
            ? "Вы знаете больше, чем думали."
            : "Вы заметно недооценивали свой уровень.";
  const readListen = session.answers.filter(
    (answer) => answer.section === "reading" || answer.section === "listening",
  );
  const skipped = session.answers.filter((answer) => answer.status === "skipped").length;
  const reliable =
    skipped <= session.answers.length * 0.2 &&
    session.maxDontKnowStreak < 3 &&
    !session.readingListeningTooFast &&
    session.writingAutoGraded;
  return {
    selfLevel: session.selfLevel,
    level,
    progressPercent,
    levels: levelResults,
    answers: session.answers,
    weakTopics,
    skills,
    reliability: reliable && readListen.length ? "reliable" : "approximate",
    writingAutoGraded: session.writingAutoGraded,
    comparison,
    completedAt: new Date().toISOString(),
  };
}

function sentenceCount(value: string) {
  return value.split(/[.!?]+/).filter((part) => part.trim()).length;
}

function shuffledIndices(length: number, seed: string) {
  const indices = Array.from({ length }, (_, index) => index);
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  for (let index = indices.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const other = hash % (index + 1);
    [indices[index], indices[other]] = [indices[other], indices[index]];
  }
  return indices;
}

function ResultScreen({
  report,
  onUseLevel,
  onRetry,
  onClose,
}: {
  report: PlacementReport;
  onUseLevel: (report: PlacementReport) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [showAnswers, setShowAnswers] = useState(false);
  return (
    <div className="modal-backdrop onboarding-backdrop placement-backdrop">
      <section
        className="dialog-card onboarding-card placement-result"
        role="dialog"
        aria-modal="true"
        aria-labelledby="placement-result-title"
      >
        <div className="onboarding-brand">
          <BrandLogo compact />
          <button className="dialog-close" aria-label="Закрыть результат" onClick={onClose}>
            Позже
          </button>
        </div>
        <div className="onboarding-progress">
          <i style={{ width: "100%" }} />
        </div>
        <div className="onboarding-content placement-result-content">
          <p className="eyebrow">ВХОДНОЙ ТЕСТ · РЕЗУЛЬТАТ</p>
          <h2 id="placement-result-title">Ваш уровень — {report.level}</h2>
          <p>{report.comparison}</p>
          <div className="placement-score-card">
            <strong>{report.level}</strong>
            <span>
              {formatScore(report.levels.reduce((sum, item) => sum + item.score, 0))} балла ·{" "}
              {report.levels.length} уровней проверено
            </span>
            <small>
              {report.reliability === "reliable"
                ? "Оценка достаточно надёжная"
                : "Предварительная оценка: тест остановлен рано или письмо не удалось проверить автоматически"}
            </small>
          </div>
          <div className="placement-level-list">
            {report.levels.map((item) => (
              <div key={item.level}>
                <b>{item.level}</b>
                <span>{formatScore(item.score)} / 20</span>
                <strong className={`level-status ${item.status}`}>
                  {item.status === "passed"
                    ? "Пройден"
                    : item.status === "borderline"
                      ? "Нестабильно"
                      : item.status === "incomplete"
                        ? "Прерван"
                        : "Нужно повторить"}
                </strong>
              </div>
            ))}
          </div>
          <h3>Навыки</h3>
          <div className="placement-skill-results">
            {report.skills.map((skill) => (
              <div key={skill.skill}>
                <span>{skill.title}</span>
                <strong>{skill.rating}</strong>
                <i>
                  <b style={{ width: `${skill.percent}%` }} />
                </i>
              </div>
            ))}
          </div>
          {report.weakTopics.length > 0 && (
            <>
              <h3>Над чем поработать</h3>
              <div className="placement-weak-list">
                {report.weakTopics.map((topic) => (
                  <article key={topic.topic}>
                    <strong>{topic.topic}</strong>
                    <small>
                      {topic.wrong} ответов стоит повторить · {topic.game}
                    </small>
                    <p>{topic.rule}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          <button
            className="secondary-button placement-review-toggle"
            onClick={() => setShowAnswers((value) => !value)}
          >
            {showAnswers ? "Скрыть ответы" : "Посмотреть ответы"}
          </button>
          {showAnswers && (
            <div className="placement-answer-review">
              {report.answers.map((answer) => (
                <article key={answer.id}>
                  <small>
                    {answer.level} · {sectionTitles[answer.section]}
                  </small>
                  <strong>
                    {PLACEMENT_QUESTIONS.find((item) => item.id === answer.id)?.question}
                  </strong>
                  <span>
                    Вы ответили: {answer.answer || "Не знаю"} · верно:{" "}
                    {answer.correctAnswer || "письменное задание"}
                  </span>
                  {answer.feedback?.correction && <p>{answer.feedback.correction}</p>}
                </article>
              ))}
            </div>
          )}
          <div className="dialog-actions">
            <button className="secondary-button" onClick={onRetry}>
              Пройти заново
            </button>
            <button className="primary-button" onClick={() => onUseLevel(report)}>
              Начать курс {report.level} <Icon name="arrow" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PlacementExam({
  selfLevel,
  selfSkills,
  onUseLevel,
  onClose,
}: {
  selfLevel: SelfLevel;
  selfSkills: SelfSkillRatings;
  onUseLevel: (report: PlacementReport) => void;
  onClose: () => void;
}) {
  const [savedSession] = useState(() => {
    try {
      const raw = readProfileItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as ExamSession) : null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<ExamSession>(() =>
    savedSession && savedSession.selfLevel === selfLevel
      ? savedSession
      : makeSession(selfLevel, selfSkills),
  );
  const [resumeChoice, setResumeChoice] = useState(
    Boolean(savedSession && savedSession.selfLevel === selfLevel),
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [stopPrompt, setStopPrompt] = useState(false);
  const [report, setReport] = useState<PlacementReport | null>(null);
  const [alert, setAlert] = useState("");
  const questionStarted = useRef(Date.now());
  const currentLevelAnswers = session.answers.filter(
    (answer) => answer.level === session.currentLevel,
  );
  const question = PLACEMENT_QUESTIONS.filter((item) => item.level === session.currentLevel)[
    currentLevelAnswers.length
  ];
  const questionNumber = currentLevelAnswers.length + 1;
  const orderedTokens = useMemo(
    () =>
      question?.type === "build" ? shuffledIndices(question.tokens?.length ?? 0, question.id) : [],
    [question?.id],
  );
  const selectedTokenIndexes = useMemo(
    () => (session.drafts[question?.id ?? ""] ?? "").split(",").filter(Boolean).map(Number),
    [session.drafts, question?.id],
  );

  useEffect(() => {
    questionStarted.current = Date.now();
    setDraft(session.drafts[question?.id ?? ""] ?? "");
  }, [question?.id]);

  const persist = (next: ExamSession) => {
    setSession(next);
    writeProfileItem(SESSION_KEY, JSON.stringify(next));
  };
  const restart = () => {
    const fresh = makeSession(selfLevel, selfSkills);
    persist(fresh);
    setResumeChoice(false);
    setReport(null);
    setAlert("");
  };
  const pause = () => {
    setResumeChoice(false);
    onClose();
  };

  const finishSession = (next: ExamSession, incomplete = false) => {
    const finalReport = makeReport(next, incomplete);
    setSession(next);
    setReport(finalReport);
    setStopPrompt(false);
    removeProfileItem(SESSION_KEY);
  };

  const continueAfterLevel = (next: ExamSession, levelResult: PlacementLevelResult) => {
    const updated = {
      ...next,
      levels: [...next.levels.filter((item) => item.level !== levelResult.level), levelResult],
    };
    const curIndex = levelIndex(levelResult.level);
    const stopAtSelfZero = updated.selfLevel === "zero";
    const finishedSafetyLevel =
      curIndex < levelIndex(updated.startLevel) &&
      updated.levels.some((item) => item.level === updated.startLevel && item.status === "failed");
    if (finishedSafetyLevel) {
      finishSession(updated);
      return;
    }
    if (stopAtSelfZero || curIndex === PLACEMENT_LEVELS.length - 1) {
      finishSession(updated);
      return;
    }
    if (levelResult.status === "passed" || levelResult.status === "borderline") {
      const nextLevel = PLACEMENT_LEVELS[curIndex + 1];
      persist({ ...updated, currentLevel: nextLevel, dontKnowStreak: 0 });
      setBusy(false);
      return;
    }
    const testedLower = updated.levels.some((item) => levelIndex(item.level) < curIndex);
    const canCheckOneLevelLower =
      levelResult.level === updated.startLevel && curIndex > 0 && !testedLower;
    if (canCheckOneLevelLower) {
      persist({ ...updated, currentLevel: PLACEMENT_LEVELS[curIndex - 1], dontKnowStreak: 0 });
      setBusy(false);
      return;
    }
    finishSession(updated);
  };

  const submitAnswer = async (value: string | null) => {
    if (!question || busy) return;
    let score = 0;
    let status: PlacementAnswer["status"] = "wrong";
    let savedValue = value ?? "";
    let correctAnswer = question.correct ?? "";
    let feedback: PlacementAnswer["feedback"];
    let writingAutoGraded = session.writingAutoGraded;
    const elapsedMs = Date.now() - questionStarted.current;
    const skipped = value === null;
    if (skipped) status = "skipped";
    else if (question.type === "write") {
      const answerText = value.trim();
      const validContent =
        !/[\u0400-\u04ff]/.test(answerText) &&
        sentenceCount(answerText) >= (question.minSentences ?? 2) &&
        answerText.split(/\s+/).filter(Boolean).length >= (question.minSentences ?? 2) * 4;
      savedValue = answerText;
      if (!validContent) {
        status = "skipped";
        savedValue = answerText || "";
        setAlert(
          "Нужно написать несколько полных предложений по-немецки. Попробуйте ещё раз или нажмите «Не знаю».",
        );
        return;
      }
      status = "partial";
      score = 0.5;
      setBusy(true);
      try {
        const response = await fetch("/api/grade-placement-writing", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: `${session.startedAt}:${question.id}`,
            essays: [
              {
                id: question.id,
                level: question.level,
                prompt: question.question,
                answer: answerText,
              },
            ],
          }),
        });
        if (!response.ok) throw new Error("Gemini assessment unavailable");
        const result = (await response.json()) as {
          items?: {
            id: string;
            task_completion: number;
            grammar: number;
            vocabulary: number;
            cohesion: number;
            weak_topic: string;
            excerpt: string;
            correction: string;
            rule: string;
          }[];
        };
        const graded = result.items?.find((item) => item.id === question.id);
        if (!graded) throw new Error("No writing score returned");
        const total = graded.task_completion + graded.grammar + graded.vocabulary + graded.cohesion;
        score = total >= 7 ? 1 : total >= 5 ? 0.5 : 0;
        status = score === 1 ? "correct" : score === 0.5 ? "partial" : "wrong";
        feedback = {
          weakTopic:
            graded.weak_topic && !/^(none|нет|n\/?a)$/i.test(graded.weak_topic.trim())
              ? graded.weak_topic
              : question.topic,
          excerpt: graded.excerpt || "",
          correction: graded.correction || "",
          rule: graded.rule || "",
        };
      } catch {
        score = 0.5;
        status = "partial";
        writingAutoGraded = false;
        feedback = {
          weakTopic: "Письменная речь",
          excerpt: "Ответ принят",
          correction: "",
          rule: "Засчитан объём текста; автоматическая проверка грамматики сейчас недоступна.",
        };
      }
      setBusy(false);
    } else if (question.type === "build") {
      correctAnswer = question.correct ?? "";
      const built = savedValue
        .split(",")
        .map(Number)
        .map((index) => question.tokens?.[index] ?? "")
        .filter(Boolean)
        .join(" ");
      savedValue = built;
      if (
        normalize(built).replace(/[.!?]+$/, "") === normalize(correctAnswer).replace(/[.!?]+$/, "")
      ) {
        score = 1;
        status = "correct";
      }
    } else if (normalize(value ?? "") === normalize(question.correct ?? "")) {
      score = 1;
      status = "correct";
    }

    const answer: PlacementAnswer = {
      id: question.id,
      level: question.level,
      section: question.section,
      topic: question.topic,
      answer: savedValue,
      correctAnswer,
      score,
      status,
      elapsedMs,
      feedback,
    };
    const nextAnswers = [...session.answers, answer];
    const streak = skipped ? session.dontKnowStreak + 1 : 0;
    const nextSession: ExamSession = {
      ...session,
      answers: nextAnswers,
      drafts: { ...session.drafts, [question.id]: savedValue },
      dontKnowStreak: streak,
      maxDontKnowStreak: Math.max(session.maxDontKnowStreak, streak),
      readingListeningTooFast:
        session.readingListeningTooFast ||
        ((question.section === "reading" || question.section === "listening") && elapsedMs < 2000),
      writingAutoGraded,
    };
    setAlert("");
    if (streak >= 3) {
      persist(nextSession);
      setStopPrompt(true);
      return;
    }
    const levelCount = nextAnswers.filter((item) => item.level === question.level).length;
    const levelPoints = nextAnswers
      .filter((item) => item.level === question.level)
      .reduce((sum, item) => sum + item.score, 0);
    if (levelCount === 10 && levelPoints <= 3) {
      const result = {
        ...summarizeLevel(nextSession, question.level, true),
        status: "failed" as const,
      };
      continueAfterLevel(nextSession, result);
      return;
    }
    if (levelCount >= 20 || nextAnswers.length >= 100) {
      const result = summarizeLevel(nextSession, question.level);
      continueAfterLevel(nextSession, result);
      return;
    }
    persist(nextSession);
  };

  if (report)
    return (
      <ResultScreen report={report} onUseLevel={onUseLevel} onRetry={restart} onClose={pause} />
    );
  if (resumeChoice)
    return (
      <div className="modal-backdrop onboarding-backdrop placement-backdrop">
        <section className="dialog-card placement-resume" role="dialog" aria-modal="true">
          <p className="eyebrow">ВХОДНОЙ ТЕСТ</p>
          <h2>Продолжить тест?</h2>
          <p>
            Ответы сохранены: {session.answers.length} заданий · {session.currentLevel}.
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={restart}>
              Начать заново
            </button>
            <button className="primary-button" onClick={() => setResumeChoice(false)}>
              Продолжить
            </button>
          </div>
        </section>
      </div>
    );
  if (!question) return null;

  const currentSkillQuestionNumber =
    PLACEMENT_QUESTIONS.filter(
      (item) => item.level === question.level && item.section === question.section,
    ).findIndex((item) => item.id === question.id) + 1;
  const sectionLength = PLACEMENT_QUESTIONS.filter(
    (item) => item.level === question.level && item.section === question.section,
  ).length;
  const selection = question.type === "build" ? "" : draft;
  const audioCount = session.audioPlays[question.id] ?? 0;
  const readLabel = question.section === "reading" ? "Текст" : "Аудио";
  const startAudio = () => {
    if (!question.source || audioCount >= 2) return;
    const played = speakText(question.source, "de-DE");
    if (!played) {
      setAlert("Не удалось включить звук. Можно нажать «Не знаю» для этого вопроса.");
      return;
    }
    const next = {
      ...session,
      audioPlays: { ...session.audioPlays, [question.id]: audioCount + 1 },
    };
    persist(next);
  };
  const setTokenSelection = (indices: number[]) => {
    const value = indices.join(",");
    setDraft(value);
    const next = { ...session, drafts: { ...session.drafts, [question.id]: value } };
    persist(next);
  };
  const optionSelect = (option: string) => {
    setDraft(option);
    persist({ ...session, drafts: { ...session.drafts, [question.id]: option } });
  };
  const sectionAnswers = PLACEMENT_QUESTIONS.filter(
    (item) => item.level === session.currentLevel && item.section === question.section,
  ).length;
  const sectionAnswered = currentLevelAnswers.filter(
    (item) => item.section === question.section,
  ).length;

  return (
    <div className="modal-backdrop onboarding-backdrop placement-backdrop">
      <section
        className="dialog-card onboarding-card placement-player"
        role="dialog"
        aria-modal="true"
        aria-labelledby="placement-question-title"
      >
        <div className="onboarding-brand">
          <BrandLogo compact />
          <button className="dialog-close" onClick={pause}>
            Позже
          </button>
        </div>
        <div className="onboarding-progress">
          <i style={{ width: `${Math.min(100, (currentLevelAnswers.length / 20) * 100)}%` }} />
        </div>
        <div className="placement-test-top">
          <span>
            {question.level} · {questionNumber}/20
          </span>
          <span>
            {session.levels.length ? `${session.levels.length} уровней · ` : ""}
            {session.answers.length} ответов
          </span>
          <button className="placement-pause" onClick={pause}>
            Сохранить и выйти
          </button>
        </div>
        <div className="placement-test-content">
          <p className="eyebrow">
            {sectionTitles[question.section].toLocaleUpperCase()} · {currentSkillQuestionNumber}/
            {sectionLength}
          </p>
          <h2 id="placement-question-title">{question.question}</h2>
          {question.section === "reading" && question.source && (
            <div className="placement-source-text">
              <small>{readLabel}</small>
              <p>{question.source}</p>
            </div>
          )}
          {question.section === "listening" && (
            <div className="placement-audio-box">
              <button disabled={audioCount >= 2 || busy} onClick={startAudio}>
                <Icon name="volume" size={18} />{" "}
                {audioCount >= 2 ? "Прослушано 2 раза" : `Прослушать аудио · ${2 - audioCount}`}
              </button>
              <small>Текст аудио не показывается</small>
            </div>
          )}
          {question.type === "build" && (
            <div className="placement-build-box">
              <div className="placement-build-answer">
                {selectedTokenIndexes.length ? (
                  selectedTokenIndexes.map((tokenIndex) => (
                    <button
                      key={tokenIndex}
                      onClick={() =>
                        setTokenSelection(
                          selectedTokenIndexes.filter((item) => item !== tokenIndex),
                        )
                      }
                    >
                      {question.tokens?.[tokenIndex]} <span>×</span>
                    </button>
                  ))
                ) : (
                  <span>Нажмите слова по порядку</span>
                )}
              </div>
              <div className="placement-build-options">
                {orderedTokens
                  .filter((index) => !selectedTokenIndexes.includes(index))
                  .map((index) => (
                    <button
                      key={index}
                      onClick={() => setTokenSelection([...selectedTokenIndexes, index])}
                    >
                      {question.tokens?.[index]}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {question.type === "write" && (
            <div className="placement-write-box">
              <textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  persist({
                    ...session,
                    drafts: { ...session.drafts, [question.id]: event.target.value },
                  });
                }}
                placeholder="Напишите ответ по-немецки…"
                rows={7}
                maxLength={3000}
              />
              <small>
                Минимум {question.minSentences} предложений ·{" "}
                {draft.trim().split(/\s+/).filter(Boolean).length} слов
              </small>
              <p>Используйте вымышленные данные. Текст проверит Gemini.</p>
            </div>
          )}
          {question.options && (
            <div className="placement-answer-options">
              {question.options.map((option) => (
                <button
                  key={option}
                  className={selection === option ? "selected" : ""}
                  onClick={() => optionSelect(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {alert && (
            <div className="placement-alert" role="status">
              {alert}
            </div>
          )}
          <div className="placement-test-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void submitAnswer(null)}
            >
              Не знаю
            </button>
            <button
              className="primary-button"
              disabled={
                busy ||
                (question.type === "write"
                  ? !draft.trim()
                  : question.type === "build"
                    ? !selectedTokenIndexes.length
                    : !selection)
              }
              onClick={() =>
                void submitAnswer(
                  question.type === "build"
                    ? selectedTokenIndexes.join(",")
                    : question.type === "write"
                      ? draft
                      : selection,
                )
              }
            >
              {busy ? "Проверяем письмо…" : "Дальше"} <Icon name="arrow" />
            </button>
          </div>
          <div className="placement-test-footer">
            <span>Без подсказок и оценки ответов до конца уровня</span>
            <span>{Math.max(0, sectionLength - sectionAnswered)} осталось в разделе</span>
          </div>
        </div>
        {stopPrompt && (
          <div className="modal-backdrop placement-stop-backdrop">
            <section className="dialog-card placement-resume" role="alertdialog" aria-modal="true">
              <h2>Сделаем паузу?</h2>
              <p>Вы пропустили три задания подряд. Можно завершить тест или продолжить.</p>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={() => setStopPrompt(false)}>
                  Продолжить
                </button>
                <button className="primary-button" onClick={() => finishSession(session, true)}>
                  Завершить тест
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
