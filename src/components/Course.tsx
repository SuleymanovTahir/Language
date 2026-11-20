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
const levels: CourseLevel[] = ["A1", "A2", "B1", "B2", "C1"];

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
    : "C1";
  const units = courseUnitsForLevel(selectedLevel);
  const demoUnit = GERMAN_COURSE.find((item) => item.id === "a1-01") ?? GERMAN_COURSE[0];
  const goalRecommendations: Record<string, string[]> = {
    "Повседневная жизнь": ["a1-04", "a1-05", "a1-06", "a2-02", "a2-03", "a2-07"],
    Переезд: ["a1-02", "a1-06", "a1-07", "a2-02", "b1-03", "b1-07"],
    Работа: ["a1-02", "a2-04", "b1-03", "b1-07", "b2-03", "c1-03"],
    IT: ["b1-04", "b2-05", "c1-01", "c1-06"],
    Учёба: ["a2-04", "b1-06", "b2-05", "c1-01", "c1-04"],
    Экзамен: ["a1-08", "a2-08", "b1-08", "b2-07", "c1-06"],
    Путешествия: ["a1-05", "a1-06", "a2-05", "a2-08"],
    "Для себя": ["a1-01", "a1-03", "a1-04"],
  };
  const recommendedIds = new Set(goals.flatMap((goal) => goalRecommendations[goal] ?? []));
  const completed = units.filter((item) => progress[item.id]?.completedAt).length;
  const next = units.find((item) => !progress[item.id]?.completedAt) ?? units.at(-1);
  const nextUnitIndex = Math.max(0, units.findIndex((item) => item.id === next?.id));
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
        <img
          className="course-overview-mascot"
          src="/mascots/4.webp"
          alt=""
          aria-hidden="true"
        />
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
          <button className="primary-button" onClick={() => onStart(previewOnly ? demoUnit : next!)}>
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
            <h2>Весь путь · A1–C1</h2>
            <p>
              {GERMAN_COURSE.length} юнитов · {GERMAN_COURSE.length * 6} практик навыков. Все уровни
              на одном маршруте.
            </p>
          </div>
        </div>
        <LearningTrail className="course-unit-list">
          {GERMAN_COURSE.map((item, index) => {
            const saved = progress[item.id];
            const levelIndex = units.findIndex((unit) => unit.id === item.id);
            const unlocked = previewOnly
              ? item.id === demoUnit.id
              : item.level === selectedLevel && levelIndex >= 0 &&
                (Boolean(saved?.completedAt) || levelIndex <= nextUnitIndex);
            const isNext = !saved?.completedAt && item.id === next?.id && unlocked;
            const hasSavedMission = Boolean(missions[item.id]);
            return (
              <div className="course-trail-stop" key={item.id}>
                {(index === 0 || GERMAN_COURSE[index - 1].level !== item.level) && (
                  <div className="trail-level-heading" id={`course-level-${item.level}`}>
                    <span>УРОВЕНЬ {item.level}</span>
                    <strong>{levelCopy[item.level]}</strong>
                    <small>{courseUnitsForLevel(item.level).length} юнитов</small>
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
                              : "СТАРТ"
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
  "Правило",
  "Аудио",
  "Чтение",
  "Сборка фразы",
  "Говорение",
  "Письмо",
  "Результат",
];
type DoneSteps = {
  vocabulary: boolean;
  grammar: boolean;
  listening: boolean;
  reading: boolean;
  sentence: boolean;
  speaking: boolean;
  writing: boolean;
  listeningCorrect: boolean;
  readingCorrect: boolean;
  sentenceCorrect: boolean;
};
const initialDone: DoneSteps = {
  vocabulary: false,
  grammar: false,
  listening: false,
  reading: false,
  sentence: false,
  speaking: false,
  writing: false,
  listeningCorrect: false,
  readingCorrect: false,
  sentenceCorrect: false,
};

export function CourseLesson({
  unit,
  libraryWords = [],
  onClose,
  onComplete,
  onAnswer,
  savedProgress,
  onProgressChange,
}: {
  unit: CourseUnit;
  libraryWords?: Array<{ id: string; word: string; translation: string; article?: string | null }>;
  onClose: () => void;
  onComplete: (unitId: string, skills: CourseSkills, durationMinutes: number) => void;
  onAnswer: (correct: boolean) => void;
  savedProgress?: CourseMissionState;
  onProgressChange?: (progress: CourseMissionState) => void;
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(6, savedProgress?.step ?? 0)));
  const [done, setDone] = useState<DoneSteps>(() => ({
    ...initialDone,
    ...(savedProgress?.done ?? {}),
  }));
  const [listeningChoice, setListeningChoice] = useState<number | null>(
    () => savedProgress?.listeningChoice ?? null,
  );
  const [readingChoice, setReadingChoice] = useState<number | null>(
    () => savedProgress?.readingChoice ?? null,
  );
  const [sentenceSelection, setSentenceSelection] = useState<number[]>(
    () => savedProgress?.sentenceSelection ?? [],
  );
  const [writing, setWriting] = useState(() => savedProgress?.writing ?? "");
  const [writingExampleVisible, setWritingExampleVisible] = useState(
    () => savedProgress?.writingExampleVisible ?? false,
  );
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [matchedWords, setMatchedWords] = useState<number[]>(
    () => savedProgress?.matchedWords ?? [],
  );
  const [matchMessage, setMatchMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(Date.now());
  const targetSentence = unit.examples[0].split(" — ")[0].replace(/[.!?]$/, "");
  const vocabularyPairs = useMemo(
    () =>
      unit.vocabulary.map((item, id) => {
        const [word, translation] = item.split(" — ");
        return { id, word, translation };
      }),
    [unit],
  );
  const sentenceWords = useMemo(() => targetSentence.split(/\s+/), [targetSentence]);
  const sentencePool = useMemo(
    () => sentenceWords.map((word, id) => ({ word, id })).reverse(),
    [sentenceWords],
  );
  const chosenWords = sentenceSelection.map((id) => sentenceWords[id]);
  const correctSentence =
    normalizeSentence(chosenWords.join(" ")) === normalizeSentence(targetSentence);
  const stepDone = [
    done.vocabulary,
    done.grammar,
    done.listening,
    done.reading,
    done.sentence,
    done.speaking,
    done.writing,
    true,
  ][step];
  const progressPct = Math.round((step / (stepNames.length - 1)) * 100);

  useEffect(() => {
    onProgressChange?.({
      step,
      done,
      listeningChoice,
      readingChoice,
      sentenceSelection,
      writing,
      writingExampleVisible,
      matchedWords,
    });
  }, [
    step,
    done,
    listeningChoice,
    readingChoice,
    sentenceSelection,
    writing,
    writingExampleVisible,
    matchedWords,
    onProgressChange,
  ]);

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
  function checkListening() {
    if (listeningChoice === null) return;
    const correct = listeningChoice === unit.listeningAnswer;
    updateDone("listening");
    updateDone("listeningCorrect", correct);
    onAnswer(correct);
  }
  function checkReading() {
    if (readingChoice === null) return;
    const correct = readingChoice === unit.readingAnswer;
    updateDone("reading");
    updateDone("readingCorrect", correct);
    onAnswer(correct);
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
      vocabulary: done.vocabulary ? 1 : 0,
      grammar: done.grammar && done.sentenceCorrect ? 1 : done.grammar ? 0.6 : 0,
      listening: done.listeningCorrect ? 1 : done.listening ? 0.5 : 0,
      reading: done.readingCorrect ? 1 : done.reading ? 0.5 : 0,
      speaking: done.speaking ? 1 : 0,
      writing: done.writing ? 1 : 0,
    };
    onComplete(
      unit.id,
      skills,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000)),
    );
  }

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
          <span>ШАГ {step + 1}</span>
          <strong>{stepNames[step]}</strong>
        </div>
      )}
      <section className="course-player-content">
        {step === 0 && (
          <>
            <p className="eyebrow">СЛОВА · ПОСЛУШАЙТЕ И ЗАПОМНИТЕ</p>
            <h1>{unit.title}</h1>
            <p className="course-outcome">{unit.outcome}</p>
            <div className="course-vocabulary-list">
              {vocabularyPairs.map(({ id, word, translation }) => (
                <article key={`${id}-${word}`}>
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
            {libraryWords.length > 0 && (
              <section className="course-library-vocab">
                <strong>Из вашей библиотеки</strong>
                <p>Подборка слов по теме юнита из уже загруженного словаря.</p>
                <div>
                  {libraryWords.map((item) => {
                    const word = `${item.article ? `${item.article} ` : ""}${item.word}`;
                    return (
                      <button key={item.id} onClick={() => speakText(word, "de-DE")}>
                        <Icon name="volume" size={15} />
                        <span>
                          <b>{word}</b>
                          <small>{item.translation}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <section className="course-match-game">
              <div>
                <span className="eyebrow">МИНИ-ИГРА · СОЕДИНИТЕ ПАРЫ</span>
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
                          setMatchMessage("Сначала выберите немецкое слово.");
                          return;
                        }
                        if (selectedMatch === item.id) {
                          setMatchedWords((current) => [...current, item.id]);
                          setMatchMessage("Верно, пара соединена.");
                        } else setMatchMessage("Эта пара не подходит. Попробуйте ещё раз.");
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
                  ? "Все пары соединены. Отлично!"
                  : matchMessage}
              </p>
            </section>
            <button
              className={`primary-button ${done.vocabulary ? "completed-action" : ""}`}
              disabled={matchedWords.length !== vocabularyPairs.length}
              onClick={() => updateDone("vocabulary")}
            >
              {done.vocabulary ? "Слова просмотрены" : "Завершить задание со словами"}
              <Icon name="check" />
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="eyebrow">МИНИ-ТЕОРИЯ</p>
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
                <strong>Запомните пример как целую фразу.</strong> Затем соберите свою фразу на
                следующем шаге.
              </span>
            </label>
            <button className="primary-button" onClick={() => updateDone("grammar")}>
              {done.grammar ? "Правило отмечено" : "Понятно, продолжить"}
              <Icon name="arrow" />
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <p className="eyebrow">АУДИРОВАНИЕ · ПОПЫТАЙТЕСЬ БЕЗ ТЕКСТА</p>
            <h1>Прослушайте диалог</h1>
            <button
              className="audio-listen-button"
              onClick={() => speakText(unit.dialogue, "de-DE")}
            >
              <Icon name="headphones" size={22} /> Прослушать немецкий диалог
            </button>
            <div className="audio-player-controls">
              <button onClick={() => speakText(unit.dialogue, "de-DE", true)}>Медленнее</button>
              <span>После ответа можно открыть текст.</span>
            </div>
            <h2>{unit.listeningQuestion}</h2>
            <ChoiceList
              choices={unit.listeningOptions}
              selected={listeningChoice}
              onSelect={setListeningChoice}
              disabled={done.listening}
              correct={unit.listeningAnswer}
              reveal={done.listening}
            />
            <div className="course-answer-feedback" role="status">
              {done.listening
                ? done.listeningCorrect
                  ? "Верно. Вы уловили нужную деталь."
                  : `Верный ответ: ${unit.listeningOptions[unit.listeningAnswer]}. Прослушайте ещё раз.`
                : ""}
            </div>
            {done.listening && (
              <details className="course-transcript">
                <summary>Открыть расшифровку</summary>
                <p>{unit.dialogue}</p>
              </details>
            )}
            <button
              className="primary-button"
              disabled={listeningChoice === null || done.listening}
              onClick={checkListening}
            >
              Проверить ответ <Icon name="check" />
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <p className="eyebrow">ЧТЕНИЕ</p>
            <h1>Прочитайте короткий текст</h1>
            <article className="course-reading-text">{unit.reading}</article>
            <h2>{unit.readingQuestion}</h2>
            <ChoiceList
              choices={unit.readingOptions}
              selected={readingChoice}
              onSelect={setReadingChoice}
              disabled={done.reading}
              correct={unit.readingAnswer}
              reveal={done.reading}
            />
            <div className="course-answer-feedback" role="status">
              {done.reading
                ? done.readingCorrect
                  ? "Верно. Вы нашли нужную деталь."
                  : `Верный ответ: ${unit.readingOptions[unit.readingAnswer]}.`
                : ""}
            </div>
            <button
              className="primary-button"
              disabled={readingChoice === null || done.reading}
              onClick={checkReading}
            >
              Проверить ответ <Icon name="check" />
            </button>
          </>
        )}
        {step === 4 && (
          <>
            <p className="eyebrow">СБОРКА ПРЕДЛОЖЕНИЯ</p>
            <h1>Соберите фразу</h1>
            <p className="course-theory-copy">{unit.examples[0].split(" — ")[1]}</p>
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
                {done.sentenceCorrect ? "Предложение собрано верно." : `Вариант: ${targetSentence}`}
              </p>
            )}
            <button
              className="primary-button"
              disabled={!sentenceSelection.length || done.sentence}
              onClick={checkSentence}
            >
              Проверить фразу <Icon name="check" />
            </button>
          </>
        )}
        {step === 5 && (
          <>
            <p className="eyebrow">ГОВОРЕНИЕ · ОТВЕТЬТЕ ВСЛУХ</p>
            <h1>Ваша ситуация</h1>
            <p className="course-speaking-prompt">{unit.speakingPrompt}</p>
            <button
              className="audio-listen-button"
              onClick={() => speakText(unit.examples[0].split(" — ")[0], "de-DE")}
            >
              <Icon name="volume" /> Послушать пример фразы
            </button>
            <div className="course-recording-note">
              <HelpHint label="О записи">
                Микрофон включается после нажатия. Запись останется на этом устройстве и удалится
                при выходе.
              </HelpHint>
            </div>
            {!recording ? (
              <button className="secondary-button" onClick={() => void startRecording()}>
                <Icon name="headphones" />{" "}
                {recordingUrl ? "Записать ещё раз" : "Записать мой ответ (необязательно)"}
              </button>
            ) : (
              <button className="secondary-button recording-active" onClick={stopRecording}>
                Остановить запись
              </button>
            )}
            {recordingUrl && (
              <audio controls src={recordingUrl} aria-label="Ваша локальная запись" />
            )}
            {mediaError && <p className="field-help">{mediaError}</p>}
            <label className="self-check-row">
              <input
                type="checkbox"
                checked={done.speaking}
                onChange={(event) => updateDone("speaking", event.target.checked)}
              />
              <span>Я ответил(а) по теме и смог(ла) понять свою фразу при прослушивании.</span>
            </label>
          </>
        )}
        {step === 6 && (
          <>
            <p className="eyebrow">ПИСЬМО</p>
            <h1>Напишите свой ответ</h1>
            <p className="course-speaking-prompt">{unit.writingPrompt}</p>
            <textarea
              className="course-writing-input"
              value={writing}
              onChange={(event) => setWriting(event.target.value)}
              placeholder="Напишите ответ своими словами…"
              rows={5}
            />
            <div className="course-writing-actions">
              <button
                className="secondary-button"
                disabled={writing.trim().length < 8}
                onClick={() => setWritingExampleVisible(true)}
              >
                Показать вариант для сравнения
              </button>
              <small>{writing.trim().split(/\s+/).filter(Boolean).length} слов</small>
            </div>
            {writingExampleVisible && (
              <article className="course-writing-sample">
                <strong>Пример</strong>
                <p>{unit.writingExample}</p>
              </article>
            )}
            <label className="self-check-row">
              <input
                type="checkbox"
                checked={done.writing}
                disabled={!writingExampleVisible}
                onChange={(event) => updateDone("writing", event.target.checked)}
              />
              <span>Я сверил(а) свой ответ с примером и отметил(а), что хочу улучшить.</span>
            </label>
          </>
        )}
        {step === 7 && (
          <>
            <p className="eyebrow">ЮНИТ ЗАВЕРШЁН</p>
            <h1>Вы потренировали шесть навыков</h1>
            <p className="course-outcome">{unit.outcome}</p>
            <div className="course-result-grid">
              {skillNames.map(([key, label]) => (
                <article key={key}>
                  <span>{label}</span>
                  <strong>
                    {Math.round(
                      (
                        {
                          vocabulary: done.vocabulary ? 1 : 0,
                          grammar: done.sentenceCorrect ? 1 : 0.6,
                          listening: done.listeningCorrect ? 1 : 0.5,
                          reading: done.readingCorrect ? 1 : 0.5,
                          speaking: done.speaking ? 1 : 0,
                          writing: done.writing ? 1 : 0,
                        } as CourseSkills
                      )[key] * 100,
                    )}
                    %
                  </strong>
                </article>
              ))}
            </div>
            <p className="course-next-hint">
              {done.listeningCorrect && done.readingCorrect && done.sentenceCorrect
                ? "Хорошая работа: ключевые ответы верны. Прогресс по навыкам сохранится вместе с юнитом."
                : "Посмотрите правильные варианты выше. Если результат по юниту окажется ниже 70%, приложение предложит повторить его из программы."}
            </p>
            <button className="primary-button" onClick={finishUnit}>
              Сохранить прогресс <Icon name="check" />
            </button>
          </>
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
