import { useEffect, useMemo, useRef, useState } from "react";
import {
  courseUnitsForLevel,
  GERMAN_COURSE,
  type CourseLevel,
  type CourseUnit,
} from "../data/germanCourse";
import { Icon } from "./Icon";
import { speakText } from "./StudySession";
import { HelpHint } from "./HelpHint";
import { LearningTrail } from "./LearningTrail";
import { COURSE_QUIZZES, type UnitQuizQuestion } from "../data/courseQuizzes";
import { ProgressiveVocabTrainer } from "./ProgressiveVocabTrainer";

export type CourseSkills = {
  vocabulary: number;
  grammar: number;
  listening: number;
  reading: number;
  speaking: number;
  writing: number;
};
export type CourseUnitProgress = CourseSkills & {
  completedAt: string;
  attempts: number;
  durationMinutes?: number;
};
export type CourseProgress = Record<string, CourseUnitProgress>;
export type CourseMissionState = {
  step: number;
  done: Partial<DoneSteps>;
  listeningChoice: number | null;
  readingChoice: number | null;
  sentenceSelection: number[];
  writing: string;
  writingExampleVisible: boolean;
  matchedWords: number[];
};
const skillNames: Array<[keyof CourseSkills, string]> = [
  ["vocabulary", "Слова"],
  ["grammar", "Грамматика"],
  ["listening", "Аудирование"],
  ["reading", "Чтение"],
  ["speaking", "Говорение"],
  ["writing", "Письмо"],
];
const levels: CourseLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

export function CoursePath({
  level,
  progress,
  missions = {},
  goals,
  focus = [],
  onChooseLevel,
  onStart,
  previewOnly = false,
  onUpgrade,
}: {
  level: string;
  progress: CourseProgress;
  missions?: Record<string, CourseMissionState>;
  goals: string[];
  focus?: string[];
  onChooseLevel: (level: CourseLevel) => void;
  onStart: (unit: CourseUnit) => void;
  previewOnly?: boolean;
  onUpgrade?: () => void;
}) {
  const normalizedLevel = level === "A1–A2" ? "A1" : level;
  const selectedLevel = levels.includes(normalizedLevel as CourseLevel)
    ? (normalizedLevel as CourseLevel)
    : "A1";
  const units = courseUnitsForLevel(selectedLevel);
  const demoUnit = GERMAN_COURSE.find((item) => item.id === "a0-01") ?? GERMAN_COURSE.find((item) => item.id === "a1-01") ?? GERMAN_COURSE[0];
  const goalRecommendations: Record<string, string[]> = {
    "Повседневная жизнь": ["a0-01", "a0-02", "a0-06", "a1-04", "a1-05", "a1-06", "a2-02", "a2-03", "a2-07"],
    Переезд: ["a0-01", "a0-08", "a1-02", "a1-06", "a1-07", "a2-02", "b1-03", "b1-07"],
    Работа: ["a0-08", "a1-02", "a2-04", "b1-03", "b1-07", "b2-03", "c1-03"],
    IT: ["b1-04", "b2-05", "c1-01", "c1-06"],
    Учёба: ["a2-04", "b1-06", "b2-05", "c1-01", "c1-04"],
    Экзамен: ["a0-08", "a1-08", "a2-08", "b1-08", "b2-07", "c1-06"],
    Путешествия: ["a0-01", "a0-02", "a0-08", "a1-05", "a1-06", "a2-05", "a2-08"],
    "Для себя": ["a0-01", "a0-02", "a0-03", "a1-01", "a1-03", "a1-04"],
  };
  const recommendedIds = new Set(goals.flatMap((goal) => goalRecommendations[goal] ?? []));
  const completed = units.filter((item) => progress[item.id]?.completedAt).length;
  const next = units.find((item) => !progress[item.id]?.completedAt) ?? units.at(-1);
  const nextUnitIndex = Math.max(
    0,
    units.findIndex((item) => item.id === next?.id),
  );
  const reviewSuggestion = units
    .map((item) => {
      const saved = progress[item.id];
      const values = saved ? skillNames.map(([key]) => saved[key]) : [];
      const average = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 1;
      return { unit: item, average };
    })
    .filter((item) => progress[item.unit.id]?.completedAt && item.average < 0.7)
    .sort((left, right) => left.average - right.average)[0];
  const percent = units.length ? Math.round((completed / units.length) * 100) : 0;
  const levelCopy: Record<CourseLevel, string> = {
    A0: "Абсолютный ноль → первые слова, приветствия и простые фразы.",
    A1: "Первые простые разговоры и бытовые ситуации.",
    A2: "Самостоятельность в знакомой повседневной жизни.",
    B1: "Связная речь, опыт и собственное мнение.",
    B2: "Уверенная аргументация по широкому кругу тем.",
    C1: "Точность и гибкость в учёбе, работе и обществе.",
  };
  return (
    <div className="page course-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПОСЛЕДОВАТЕЛЬНЫЙ КУРС · НЕМЕЦКИЙ</p>
          <h1>{previewOnly ? "Попробуйте курс до регистрации" : "Мой учебный путь"}</h1>
          <p>
            {previewOnly
              ? "Откройте первый интерактивный урок немецкого бесплатно. Аккаунт понадобится, чтобы сохранить прогресс и продолжить весь курс."
              : (levelCopy[selectedLevel] ?? levelCopy.A1)}
          </p>
        </div>
        <div className="course-level-picker" aria-label="Уровень курса">
          {levels.map((item) => (
            <button
              key={item}
              className={item === selectedLevel ? "active" : ""}
              onClick={() => {
                onChooseLevel(item);
                document
                  .getElementById(`course-level-${item}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="course-level-select">
          Уровень
          <select
            value={selectedLevel}
            onChange={(event) => {
              onChooseLevel(event.target.value as CourseLevel);
              document
                .getElementById(`course-level-${event.target.value}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {levels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(goals.length > 0 || focus.length > 0) && (
        <div className="course-focus-banner">
          <span>
            <Icon name="spark" size={17} />
          </span>
          <div>
            {goals.length > 0 && (
              <>
                <strong>Ваши цели</strong>
                <small>{goals.join(" · ")}</small>
              </>
            )}
            {focus.length > 0 && (
              <>
                <strong className="course-focus-extra">Фокус практики</strong>
                <small>{focus.join(" · ")}</small>
              </>
            )}
          </div>
          <small>Темы под ваши цели отмечены в программе.</small>
        </div>
      )}
      <section className="course-overview-card">
        <img className="course-overview-mascot" src="/mascots/4.webp" alt="" aria-hidden="true" />
        <div>
          <span className="eyebrow">
            {completed === units.length ? "УРОВЕНЬ ПРОЙДЕН" : "СЛЕДУЮЩИЙ ШАГ"} · {selectedLevel}
          </span>
          <h2>
            {completed === units.length ? "Уровень пройден" : next ? next.title : "Курс готовится"}
          </h2>
          <p>{next?.outcome ?? "Выберите другой уровень курса."}</p>
          <div className="course-overview-progress">
            <i style={{ width: `${percent}%` }} />
          </div>
          <small>
            {completed} из {units.length} юнитов · {percent}%
          </small>
          <div className="course-progress-metrics" aria-label="Прогресс уровня">
            <span>
              <strong>{completed}</strong> пройдено
            </span>
            <span>
              <strong>{Math.max(0, units.length - completed)}</strong> осталось
            </span>
            <span>
              <strong>{units.length * 6}</strong> навыков
            </span>
          </div>
        </div>
        {(previewOnly || next) && (
          <button
            className="primary-button"
            onClick={() => onStart(previewOnly ? demoUnit : next!)}
          >
            {previewOnly
              ? "Открыть демо-урок"
              : progress[next!.id]?.completedAt
                ? "Повторить юнит"
                : "Начать занятие"}
            <Icon name="arrow" />
          </button>
        )}
      </section>
      {previewOnly && (
        <section className="course-review-card">
          <div>
            <span className="eyebrow">БЕСПЛАТНАЯ ДЕМОНСТРАЦИЯ</span>
            <strong>Один полноценный урок до регистрации</strong>
            <p>Посмотрите, как устроены задания, объяснения и практика навыков.</p>
          </div>
          <button className="secondary-button" onClick={onUpgrade}>
            Сохранить прогресс и продолжить
          </button>
        </section>
      )}
      {reviewSuggestion && (
        <section className="course-review-card">
          <div>
            <span className="eyebrow">ПОЛЕЗНО ПОВТОРИТЬ</span>
            <strong>{reviewSuggestion.unit.title}</strong>
            <p>Есть навык, который стоит повторить.</p>
          </div>
          <button className="secondary-button" onClick={() => onStart(reviewSuggestion.unit)}>
            Повторить юнит · {Math.round(reviewSuggestion.average * 100)}%
          </button>
        </section>
      )}
      <section className="course-units-section">
        <div className="section-title">
          <div>
            <h2>Пошаговые юниты · Уровень {selectedLevel}</h2>
            <p>
              {units.length} последовательных юнитов · {completed} из {units.length} пройдено.
            </p>
          </div>
        </div>
        <LearningTrail className="course-unit-list">
          {units.map((item, index) => {
            const saved = progress[item.id];
            const unlocked = previewOnly
              ? item.id === demoUnit.id
              : Boolean(saved?.completedAt) || index <= nextUnitIndex;
            const isNext = !saved?.completedAt && item.id === next?.id && unlocked;
            const hasSavedMission = Boolean(missions[item.id]);
            return (
              <div className="course-trail-stop" key={item.id}>
                {index === 0 && (
                  <div className="trail-level-heading" id={`course-level-${item.level}`}>
                    <span>УРОВЕНЬ {item.level}</span>
                    <strong>{levelCopy[item.level]}</strong>
                    <small>{units.length} юнитов</small>
                  </div>
                )}
                <article
                  className={`course-unit-card ${saved?.completedAt ? "complete" : ""} ${isNext && item.id === next?.id ? "current" : ""} ${!saved?.completedAt && item.id !== next?.id ? "future" : ""} ${!unlocked ? "locked" : ""} ${recommendedIds.has(item.id) ? "recommended" : ""}`}
                >
                  <button
                    className="course-path-node"
                    disabled={!unlocked}
                    onClick={() => onStart(item)}
                    aria-label={`${hasSavedMission ? "Продолжить" : saved?.completedAt ? "Повторить" : "Начать"}: ${item.title}`}
                  >
                    <span className="course-unit-number" data-trail-anchor>
                      {saved?.completedAt ? (
                        <Icon name="check" size={24} />
                      ) : isNext ? (
                        <Icon name="arrow" size={23} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span className="course-unit-copy">
                      <small className="course-unit-kicker">
                        {previewOnly && item.id === "a1-01"
                          ? "ДЕМО · ОТКРЫТО"
                          : previewOnly
                            ? "ПОЛНЫЙ ДОСТУП · АККАУНТ"
                            : saved?.completedAt
                              ? "ПРОЙДЕНО"
                              : isNext
                                ? hasSavedMission
                                  ? "ПРОДОЛЖИТЬ"
                                  : "ТЕКУЩИЙ ЮНИТ"
                                : "ВПЕРЕДИ"}
                        {recommendedIds.has(item.id) ? " · ВАША ЦЕЛЬ" : ""}
                      </small>
                      <strong>{item.title}</strong>
                      <em>{item.outcome}</em>
                    </span>
                  </button>
                </article>
              </div>
            );
          })}
        </LearningTrail>
      </section>
      {!previewOnly && <CourseSkillsSummary progress={progress} />}
    </div>
  );
}

export function CourseSkillsSummary({ progress }: { progress: CourseProgress }) {
  const completed = Object.values(progress).filter((item) => item.completedAt);
  if (!completed.length) return null;
  return (
    <section className="course-skills-panel">
      <div className="section-title">
        <div>
          <h2>Навыки по курсу</h2>
          <p>Оценка строится по выполненным заданиям, не по XP.</p>
        </div>
      </div>
      <div className="course-skills-grid">
        {skillNames.map(([key, label]) => {
          const values = completed.map((item) => item[key]);
          const value = Math.round(
            (values.reduce((sum, item) => sum + item, 0) / values.length) * 100,
          );
          return (
            <article key={key}>
              <span>{label}</span>
              <strong>{value}%</strong>
              <div className="course-skill-bar">
                <i style={{ width: `${value}%` }} />
              </div>
              <small>
                {values.length} юнит{values.length === 1 ? "" : "ов"} с отметкой
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const stepNames = [
  "Слова",
  "Игра со словами",
  "Спикинг слов",
  "Грамматика",
  "Сборка фразы",
  "Фразовый спикинг",
  "Тест юнита",
  "Результат",
];

type DoneSteps = {
  vocabulary: boolean;
  wordGame: boolean;
  wordSpeaking: boolean;
  grammar: boolean;
  sentence: boolean;
  sentenceSpeaking: boolean;
  quiz: boolean;
  sentenceCorrect: boolean;
};

const initialDone: DoneSteps = {
  vocabulary: false,
  wordGame: false,
  wordSpeaking: false,
  grammar: false,
  sentence: false,
  sentenceSpeaking: false,
  quiz: false,
  sentenceCorrect: false,
};

export function CourseLesson({
  unit,
  libraryWords = [],
  moduleCards = [],
  onClose,
  onComplete,
  onAnswer,
  savedProgress,
  onProgressChange,
}: {
  unit: CourseUnit;
  libraryWords?: Array<{ id: string; word: string; translation: string; article?: string | null }>;
  moduleCards?: Array<{ id: string; word: string; translation: string; transcription?: string; article?: string | null; exampleSentence?: string }>;
  onClose: () => void;
  onComplete: (unitId: string, skills: CourseSkills, durationMinutes: number) => void;
  onAnswer: (correct: boolean) => void;
  savedProgress?: CourseMissionState;
  onProgressChange?: (progress: CourseMissionState) => void;
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(7, savedProgress?.step ?? 0)));
  const [done, setDone] = useState<DoneSteps>(() => ({
    ...initialDone,
    ...((savedProgress?.done as unknown as Partial<DoneSteps>) ?? {}),
  }));
  const [sentenceSelection, setSentenceSelection] = useState<number[]>(
    () => savedProgress?.sentenceSelection ?? [],
  );
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [matchedWords, setMatchedWords] = useState<number[]>(
    () => savedProgress?.matchedWords ?? [],
  );
  const [matchMessage, setMatchMessage] = useState("");

  const unitQuiz: UnitQuizQuestion[] = useMemo(() => {
    return (
      COURSE_QUIZZES[unit.id] ?? [
        {
          question: unit.listeningQuestion,
          options: unit.listeningOptions,
          answer: unit.listeningAnswer,
          explanation: `Правильный ответ: ${unit.listeningOptions[unit.listeningAnswer]}`,
        },
        {
          question: unit.readingQuestion,
          options: unit.readingOptions,
          answer: unit.readingAnswer,
          explanation: `Правильный ответ: ${unit.readingOptions[unit.readingAnswer]}`,
        },
      ]
    );
  }, [unit]);

  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [selectedQuizChoice, setSelectedQuizChoice] = useState<number | null>(null);
  const [quizChoiceRevealed, setQuizChoiceRevealed] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(Date.now());
  const targetSentence = unit.examples[0].split(" — ")[0].replace(/[.!?]$/, "");

  // Prefer real module cards over static vocabulary strings — this is what connects
  // Словарь (Library) ↔ Обучение (Course) ↔ Игры (Games): they all share the same words.
  const vocabularyPairs = useMemo(() => {
    if (moduleCards.length > 0) {
      return moduleCards.map((card, id) => ({
        id,
        word: card.article ? `${card.article} ${card.word}` : card.word,
        translation: card.translation,
        transcription: card.transcription ?? "",
        exampleSentence: card.exampleSentence,
      }));
    }
    // fallback: parse from static unit.vocabulary strings
    return unit.vocabulary.map((item, id) => {
      const [word, translation] = item.split(" — ");
      return { id, word: word ?? item, translation: translation ?? "", transcription: "", exampleSentence: undefined };
    });
  }, [moduleCards, unit]);

  const trainerWords = useMemo(
    () =>
      vocabularyPairs.map((item) => ({
        id: item.id,
        word: item.word,
        translation: item.translation,
        phonetic: item.transcription,
        exampleDe: item.exampleSentence,
      })),
    [vocabularyPairs],
  );

  // Single-word display state for step 0 (progressive vocab)
  const [vocabWordIndex, setVocabWordIndex] = useState(0);
  const [vocabTrainerDone, setVocabTrainerDone] = useState(done.vocabulary);
  const sentenceWords = useMemo(() => targetSentence.split(/\s+/), [targetSentence]);
  const sentencePool = useMemo(
    () => sentenceWords.map((word, id) => ({ word, id })).reverse(),
    [sentenceWords],
  );
  const chosenWords = sentenceSelection.map((id) => sentenceWords[id]);
  const correctSentence =
    normalizeSentence(chosenWords.join(" ")) === normalizeSentence(targetSentence);

  const stepDone =
    [
      true, // 0: Слова (просмотрены)
      matchedWords.length === vocabularyPairs.length || done.wordGame, // 1: Игра слов
      done.wordSpeaking, // 2: Спикинг слов
      done.grammar, // 3: Грамматика
      done.sentence, // 4: Сборка фразы
      done.sentenceSpeaking, // 5: Фразовый спикинг
      done.quiz, // 6: Тест юнита
      true, // 7: Результат
    ][step] ?? true;

  const progressPct = Math.round((step / (stepNames.length - 1)) * 100);

  useEffect(() => {
    onProgressChange?.({
      step,
      done: done as unknown as CourseMissionState["done"],
      listeningChoice: null,
      readingChoice: null,
      sentenceSelection,
      writing: "",
      writingExampleVisible: false,
      matchedWords,
    });
  }, [step, done, sentenceSelection, matchedWords, onProgressChange]);

  useEffect(
    () => () => {
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      window.speechSynthesis?.cancel();
    },
    [recordingUrl],
  );

  function updateDone(key: keyof DoneSteps, value = true) {
    setDone((current) => ({ ...current, [key]: value }));
  }

  function nextStep() {
    if (stepDone && step < stepNames.length - 1) setStep((current) => current + 1);
  }

  function checkSentence() {
    onAnswer(correctSentence);
    updateDone("sentence");
    updateDone("sentenceCorrect", correctSentence);
  }

  async function startRecording() {
    setMediaError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMediaError(
        "Запись недоступна в этом браузере. Произнесите ответ вслух и отметьте самопроверку.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setMediaError("Не удалось получить доступ к микрофону. Можно ответить вслух без записи.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function finishUnit() {
    const skills: CourseSkills = {
      vocabulary: done.wordGame ? 1 : 0.85,
      grammar: done.sentence ? 1 : 0.75,
      listening: 1,
      reading: 1,
      speaking: done.wordSpeaking && done.sentenceSpeaking ? 1 : 0.8,
      writing: 1,
    };
    onComplete(
      unit.id,
      skills,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000)),
    );
  }

  const currentQuizQ = unitQuiz[quizQuestionIndex];

  return (
    <main className="course-player">
      <header className="course-player-header">
        <button className="icon-button" onClick={onClose} aria-label="Закрыть занятие">
          <Icon name="close" />
        </button>
        <div>
          <small>
            {unit.level} · {unit.title}
          </small>
          <div className="course-player-progress">
            <i style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <span>
          {step + 1}/{stepNames.length}
        </span>
      </header>
      {step < 7 && (
        <div className="course-step-label">
          <span>
            ШАГ {step + 1} ИЗ {stepNames.length}
          </span>
          <strong>{stepNames[step]}</strong>
        </div>
      )}
      <section className="course-player-content">
        {step === 0 && (
          <ProgressiveVocabTrainer
            unitTitle={unit.title}
            outcome={unit.outcome}
            words={trainerWords}
            onComplete={() => {
              updateDone("vocabulary", true);
              nextStep();
            }}
          />
        )}

        {step === 1 && (
          <section className="course-match-game">
            <div>
              <span className="eyebrow">МИНИ-ИГРА · СОЕДИНИТЕ ПАРЫ</span>
              <h2>Закрепите новые слова</h2>
              <p>Нажимайте немецкое слово, затем его верный перевод на русский.</p>
              <small>
                {matchedWords.length} из {vocabularyPairs.length} совпадений
              </small>
            </div>
            <div className="course-match-columns">
              <div>
                {vocabularyPairs.map((item) => (
                  <button
                    key={`word-${item.id}`}
                    className={`${selectedMatch === item.id ? "selected" : ""} ${matchedWords.includes(item.id) ? "matched" : ""}`}
                    disabled={matchedWords.includes(item.id)}
                    onClick={() => {
                      setSelectedMatch(item.id);
                      setMatchMessage("");
                    }}
                  >
                    {item.word}
                  </button>
                ))}
              </div>
              <div>
                {[...vocabularyPairs].reverse().map((item) => (
                  <button
                    key={`translation-${item.id}`}
                    className={matchedWords.includes(item.id) ? "matched" : ""}
                    disabled={matchedWords.includes(item.id)}
                    onClick={() => {
                      if (selectedMatch === null) {
                        setMatchMessage("Сначала выберите немецкое слово слева.");
                        return;
                      }
                      if (selectedMatch === item.id) {
                        setMatchedWords((current) => [...current, item.id]);
                        setMatchMessage("Верно, пара соединена!");
                        if (matchedWords.length + 1 >= vocabularyPairs.length) {
                          updateDone("wordGame", true);
                        }
                      } else {
                        setMatchMessage("Эта пара не подходит. Попробуйте ещё раз.");
                      }
                      setSelectedMatch(null);
                    }}
                  >
                    {item.translation}
                  </button>
                ))}
              </div>
            </div>
            <p className="course-match-feedback" role="status">
              {matchedWords.length === vocabularyPairs.length
                ? "🎉 Все пары соединены. Отличный результат!"
                : matchMessage}
            </p>
            <button
              className="primary-button"
              disabled={matchedWords.length !== vocabularyPairs.length && !done.wordGame}
              onClick={() => {
                updateDone("wordGame", true);
                nextStep();
              }}
              style={{ marginTop: "16px" }}
            >
              Перейти к спикингу слов <Icon name="arrow" />
            </button>
          </section>
        )}

        {step === 2 && (
          <>
            <p className="eyebrow">СПИКИНГ · ПРОИЗНОШЕНИЕ СЛОВ</p>
            <h1>Потренируйте произношение вслух</h1>
            <p className="course-outcome">
              Послушайте каждое слово и повторите его четко вслух. Вы можете записать свой голос,
              чтобы сравнить с диктором.
            </p>
            <div className="course-vocabulary-list">
              {vocabularyPairs.map(({ id, word, translation }) => (
                <article key={`speak-${id}-${word}`}>
                  <button
                    aria-label={`Прослушать ${word}`}
                    onClick={() => speakText(word, "de-DE")}
                  >
                    <Icon name="volume" size={18} />
                  </button>
                  <strong>{word}</strong>
                  <span>{translation}</span>
                </article>
              ))}
            </div>
            <div
              className="course-recording-box"
              style={{
                marginTop: "20px",
                padding: "18px",
                background: "var(--app-card, #f8fafc)",
                borderRadius: "14px",
                border: "1px solid var(--app-line, #e2e8f0)",
              }}
            >
              <strong>🎙️ Запись голоса в микрофон</strong>
              <p
                style={{
                  margin: "6px 0 12px",
                  fontSize: "14px",
                  color: "var(--click-muted, #64748b)",
                }}
              >
                Произнесите изученные слова вслух.
              </p>
              {!recording ? (
                <button className="secondary-button" onClick={() => void startRecording()}>
                  <Icon name="headphones" />{" "}
                  {recordingUrl ? "Записать ещё раз" : "Включить микрофон и записать"}
                </button>
              ) : (
                <button className="secondary-button recording-active" onClick={stopRecording}>
                  Остановить запись
                </button>
              )}
              {recordingUrl && (
                <div style={{ marginTop: "12px" }}>
                  <audio
                    controls
                    src={recordingUrl}
                    aria-label="Ваша запись"
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              {mediaError && (
                <p className="field-help" style={{ color: "#ef4444" }}>
                  {mediaError}
                </p>
              )}
              <label
                className="self-check-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={done.wordSpeaking}
                  onChange={(e) => updateDone("wordSpeaking", e.target.checked)}
                />
                <span>Я произнёс все слова вслух чётко</span>
              </label>
            </div>
            <button
              className="primary-button"
              disabled={!done.wordSpeaking}
              onClick={() => {
                updateDone("wordSpeaking", true);
                nextStep();
              }}
              style={{ marginTop: "18px" }}
            >
              Перейти к грамматике <Icon name="arrow" />
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="eyebrow">МИКРО-ПРАВИЛО ГРАММАТИКИ</p>
            <h1>{unit.grammarTitle}</h1>
            <p className="course-theory-copy">{unit.theory}</p>
            <div className="course-examples">
              {unit.examples.map((item) => {
                const [de, ru] = item.split(" — ");
                return (
                  <div key={item}>
                    <p>{de}</p>
                    <small>{ru}</small>
                    <button aria-label={`Прослушать ${de}`} onClick={() => speakText(de, "de-DE")}>
                      <Icon name="volume" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <label className="course-common-error">
              <Icon name="info" size={17} />
              <span>
                <strong>Главный совет:</strong> Спрягаемый глагол в немецком простом предложении
                строго занимает 2-е место. Запомните конструкцию и закрепите её в игре на следующем
                шаге!
              </span>
            </label>
            <button
              className="primary-button"
              onClick={() => {
                updateDone("grammar", true);
                nextStep();
              }}
              style={{ marginTop: "18px" }}
            >
              Закрепить правилом в игре <Icon name="arrow" />
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <p className="eyebrow">ЗАКРЕПЛЕНИЕ ГРАММАТИКИ · СБОРКА ФРАЗЫ</p>
            <h1>Соберите предложение по правилу</h1>
            <p className="course-theory-copy">
              Переведите на немецкий:{" "}
              <strong>{unit.examples[0].split(" — ")[1] ?? unit.examples[0]}</strong>
            </p>
            <div className="sentence-builder-area">
              <div className="sentence-dropzone" aria-label="Собранное предложение">
                {chosenWords.length ? (
                  chosenWords.map((word, index) => (
                    <button
                      key={`${word}-${index}`}
                      onClick={() =>
                        setSentenceSelection((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      {word}
                    </button>
                  ))
                ) : (
                  <span>Нажимайте слова в правильном порядке</span>
                )}
              </div>
              <div className="sentence-token-list">
                {sentencePool
                  .filter((token) => !sentenceSelection.includes(token.id))
                  .map((token) => (
                    <button
                      key={token.id}
                      disabled={done.sentence}
                      onClick={() => setSentenceSelection((current) => [...current, token.id])}
                    >
                      {token.word}
                    </button>
                  ))}
              </div>
            </div>
            {done.sentence && (
              <p
                className={`course-answer-feedback ${done.sentenceCorrect ? "correct" : "incorrect"}`}
              >
                {done.sentenceCorrect
                  ? "Предложение собрано верно! Глагол на 2-м месте."
                  : `Верный вариант: ${targetSentence}`}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              {!done.sentence ? (
                <button
                  className="primary-button"
                  disabled={!sentenceSelection.length}
                  onClick={checkSentence}
                >
                  Проверить фразу <Icon name="check" />
                </button>
              ) : (
                <button className="primary-button" onClick={nextStep}>
                  Перейти к фразовому спикингу <Icon name="arrow" />
                </button>
              )}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p className="eyebrow">ФРАЗОВЫЙ СПИКИНГ · СКАЖИТЕ ЦЕЛУЮ ФРАЗУ</p>
            <h1>Ваша разговорная практика</h1>
            <p className="course-speaking-prompt">{unit.speakingPrompt}</p>
            <button
              className="audio-listen-button"
              onClick={() => speakText(unit.examples[0].split(" — ")[0], "de-DE")}
            >
              <Icon name="volume" /> Послушать пример фразы
            </button>
            <div
              className="course-recording-box"
              style={{
                marginTop: "20px",
                padding: "18px",
                background: "var(--app-card, #f8fafc)",
                borderRadius: "14px",
                border: "1px solid var(--app-line, #e2e8f0)",
              }}
            >
              <strong>🎙️ Запись вашего ответа в микрофон</strong>
              <p
                style={{
                  margin: "6px 0 12px",
                  fontSize: "14px",
                  color: "var(--click-muted, #64748b)",
                }}
              >
                Произнесите фразу связно в микрофон.
              </p>
              {!recording ? (
                <button className="secondary-button" onClick={() => void startRecording()}>
                  <Icon name="headphones" /> {recordingUrl ? "Записать ещё раз" : "Записать фразу"}
                </button>
              ) : (
                <button className="secondary-button recording-active" onClick={stopRecording}>
                  Остановить запись
                </button>
              )}
              {recordingUrl && (
                <div style={{ marginTop: "12px" }}>
                  <audio
                    controls
                    src={recordingUrl}
                    aria-label="Ваша фраза"
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              {mediaError && (
                <p className="field-help" style={{ color: "#ef4444" }}>
                  {mediaError}
                </p>
              )}
              <label
                className="self-check-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={done.sentenceSpeaking}
                  onChange={(e) => updateDone("sentenceSpeaking", e.target.checked)}
                />
                <span>Я проговорил фразу вслух чётко</span>
              </label>
            </div>
            <button
              className="primary-button"
              disabled={!done.sentenceSpeaking}
              onClick={() => {
                updateDone("sentenceSpeaking", true);
                nextStep();
              }}
              style={{ marginTop: "18px" }}
            >
              Перейти к финальному тесту <Icon name="arrow" />
            </button>
          </>
        )}

        {step === 6 && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                ФИНАЛЬНЫЙ ТЕСТ ЮНИТА
              </p>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "var(--click-primary, #3b82f6)",
                }}
              >
                Вопрос {quizQuestionIndex + 1} из {unitQuiz.length || 5}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                width: "100%",
                background: "#e2e8f0",
                borderRadius: "3px",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((quizQuestionIndex + 1) / (unitQuiz.length || 5)) * 100}%`,
                  background: "var(--click-primary, #3b82f6)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            {currentQuizQ ? (
              <>
                <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>{currentQuizQ.question}</h1>
                <ChoiceList
                  choices={currentQuizQ.options}
                  selected={selectedQuizChoice}
                  onSelect={(idx) => {
                    if (!quizChoiceRevealed) setSelectedQuizChoice(idx);
                  }}
                  disabled={quizChoiceRevealed}
                  correct={currentQuizQ.answer}
                  reveal={quizChoiceRevealed}
                />
                {quizChoiceRevealed && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px 18px",
                      borderRadius: "10px",
                      background:
                        selectedQuizChoice === currentQuizQ.answer ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${selectedQuizChoice === currentQuizQ.answer ? "#86efac" : "#fca5a5"}`,
                    }}
                  >
                    <strong
                      style={{
                        color: selectedQuizChoice === currentQuizQ.answer ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {selectedQuizChoice === currentQuizQ.answer ? "Верно!" : "Не совсем так."}
                    </strong>
                    <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#334155" }}>
                      {currentQuizQ.explanation}
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  {!quizChoiceRevealed ? (
                    <button
                      className="primary-button"
                      disabled={selectedQuizChoice === null}
                      onClick={() => {
                        if (selectedQuizChoice === null) return;
                        setQuizChoiceRevealed(true);
                        const isCorrect = selectedQuizChoice === currentQuizQ.answer;
                        if (isCorrect) setQuizScore((s) => s + 1);
                        onAnswer(isCorrect);
                      }}
                    >
                      Проверить ответ <Icon name="check" />
                    </button>
                  ) : quizQuestionIndex < unitQuiz.length - 1 ? (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setQuizQuestionIndex((idx) => idx + 1);
                        setSelectedQuizChoice(null);
                        setQuizChoiceRevealed(false);
                      }}
                    >
                      Следующий вопрос <Icon name="arrow" />
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => {
                        updateDone("quiz", true);
                        nextStep();
                      }}
                    >
                      Посмотреть результаты <Icon name="arrow" />
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}

        {step === 7 && (
          <div style={{ textAlign: "center", padding: "24px 12px" }}>
            <p className="eyebrow">ЮНИТ УСПЕШНО ЗАВЕРШЁН!</p>
            <h1 style={{ fontSize: "28px", marginTop: "4px" }}>🎉 Отличная работа!</h1>
            <p
              style={{
                fontSize: "16px",
                color: "var(--click-muted, #64748b)",
                margin: "8px auto 20px",
                maxWidth: "480px",
              }}
            >
              Вы изучили слова, закрепили их в игре и спикинге, освоили грамматику и прошли
              контрольный тест.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
                margin: "20px 0",
              }}
            >
              <div
                style={{
                  padding: "14px 20px",
                  background: "var(--app-card, #f8fafc)",
                  border: "1px solid var(--app-line, #e2e8f0)",
                  borderRadius: "12px",
                  minWidth: "120px",
                }}
              >
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "var(--click-primary, #3b82f6)",
                  }}
                >
                  +50
                </span>
                <small style={{ display: "block", color: "#64748b", marginTop: "4px" }}>
                  Опыт (XP)
                </small>
              </div>
              <div
                style={{
                  padding: "14px 20px",
                  background: "var(--app-card, #f8fafc)",
                  border: "1px solid var(--app-line, #e2e8f0)",
                  borderRadius: "12px",
                  minWidth: "120px",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: 800, color: "#eab308" }}>+5 💎</span>
                <small style={{ display: "block", color: "#64748b", marginTop: "4px" }}>
                  Кристаллы
                </small>
              </div>
              <div
                style={{
                  padding: "14px 20px",
                  background: "var(--app-card, #f8fafc)",
                  border: "1px solid var(--app-line, #e2e8f0)",
                  borderRadius: "12px",
                  minWidth: "120px",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: 800, color: "#22c55e" }}>
                  {quizScore}/{unitQuiz.length || 5}
                </span>
                <small style={{ display: "block", color: "#64748b", marginTop: "4px" }}>Тест</small>
              </div>
            </div>
            <button
              className="primary-button"
              style={{ padding: "14px 32px", fontSize: "16px", marginTop: "12px" }}
              onClick={finishUnit}
            >
              Продолжить обучение <Icon name="arrow" />
            </button>
          </div>
        )}
      </section>
      {step < 7 && (
        <footer className="course-player-footer">
          <button className="secondary-button" onClick={onClose}>
            Закончить на сегодня
          </button>
          <span>{stepNames[step]}</span>
          <button className="primary-button" disabled={!stepDone} onClick={nextStep}>
            {step === 6 ? "К результату" : "Далее"}
            <Icon name="arrow" />
          </button>
        </footer>
      )}
    </main>
  );
}

function ChoiceList({
  choices,
  selected,
  onSelect,
  disabled,
  correct,
  reveal,
}: {
  choices: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  disabled: boolean;
  correct: number;
  reveal: boolean;
}) {
  return (
    <div className="course-choice-list">
      {choices.map((choice, index) => (
        <button
          type="button"
          key={choice}
          disabled={disabled}
          className={`${selected === index ? "selected" : ""} ${reveal && index === correct ? "right-answer" : reveal && selected === index ? "wrong-answer" : ""}`}
          onClick={() => onSelect(index)}
        >
          <kbd>{String.fromCharCode(65 + index)}</kbd>
          {choice}
        </button>
      ))}
    </div>
  );
}
function normalizeSentence(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
