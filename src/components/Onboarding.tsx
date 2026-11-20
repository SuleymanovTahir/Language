import { useState } from "react";
import { Icon } from "./Icon";
import { HelpHint } from "./HelpHint";
import {
  PlacementExam,
  type PlacementReport,
  type SelfLevel,
  type SelfSkillRating,
  type SelfSkillRatings,
} from "./PlacementExam";
import type { CourseLevel } from "../data/germanCourse";

export type LearnerPlan = {
  completed: true;
  goals: string[];
  startingPoint: "new" | "choose" | "placement";
  level: CourseLevel;
  minutesPerDay: number;
  focus: string[];
  interests: string[];
  formats: string[];
  avoidMicrophone: boolean;
  selfLevel?: SelfLevel;
  selfSkills?: SelfSkillRatings;
  placementResult?: PlacementReport;
};

const goals = [
  "Повседневная жизнь",
  "Переезд",
  "Работа",
  "IT",
  "Учёба",
  "Экзамен",
  "Путешествия",
  "Для себя",
];
const focusOptions = ["Говорение", "Аудирование", "Грамматика", "Слова", "Чтение", "Письмо"];
const interestOptions = [
  "Кафе",
  "Отели",
  "Транспорт",
  "Покупки",
  "Работа",
  "Дом",
  "Знакомства",
  "Путешествия",
];
const formatOptions = ["Слушать", "Читать", "Писать", "Говорить"];
const selfSkillLabels: (keyof SelfSkillRatings)[] = [
  "Лексика",
  "Грамматика",
  "Чтение",
  "Аудирование",
  "Письмо",
];
const levels: { value: SelfLevel; label: string; note: string }[] = [
  { value: "zero", label: "С нуля", note: "Пока не учил немецкий" },
  { value: "A1", label: "A1", note: "Знаю простые фразы" },
  { value: "A2", label: "A2", note: "Могу говорить о быте" },
  { value: "B1", label: "B1", note: "Общаюсь на знакомые темы" },
  { value: "B2", label: "B2", note: "Понимаю статьи и фильмы" },
  { value: "C1", label: "C1", note: "Уверенно говорю о сложном" },
  { value: "unsure", label: "Не знаю", note: "Пусть тест подскажет" },
];

export function CourseOnboarding({
  onComplete,
  onSkip,
}: {
  onComplete: (plan: LearnerPlan) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [selfLevel, setSelfLevel] = useState<SelfLevel | null>(null);
  const [selfSkills, setSelfSkills] = useState<SelfSkillRatings>({});
  const [placementReport, setPlacementReport] = useState<PlacementReport | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(5);
  const [focus, setFocus] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>(["Читать", "Слушать"]);
  const [avoidMicrophone, setAvoidMicrophone] = useState(false);
  const suggestedLevel: CourseLevel =
    placementReport?.level ??
    (selfLevel === "zero" || selfLevel === "unsure" ? "A1" : (selfLevel ?? "A1"));
  const toggle = (value: string, list: string[], setter: (next: string[]) => void) =>
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const finish = () =>
    onComplete({
      completed: true,
      goals: selectedGoals.length ? selectedGoals : ["Для себя"],
      startingPoint: placementReport ? "placement" : selfLevel === "zero" ? "new" : "choose",
      level: suggestedLevel,
      minutesPerDay: minutes,
      focus,
      interests,
      formats,
      avoidMicrophone,
      selfLevel: selfLevel ?? "unsure",
      selfSkills,
      placementResult: placementReport ?? undefined,
    });
  const startPlacement = () => {
    if (selfLevel) setPlacementOpen(true);
  };
  if (placementOpen && selfLevel)
    return (
      <PlacementExam
        selfLevel={selfLevel}
        selfSkills={selfSkills}
        onClose={() => setPlacementOpen(false)}
        onUseLevel={(report) => {
          setPlacementReport(report);
          setPlacementOpen(false);
          setStep(1);
        }}
      />
    );

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <section
        className="dialog-card onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="onboarding-brand">
          <span className="logo-mark">
            <span>L</span>
            <i />
          </span>
          <span>ClickLing</span>
          <button className="dialog-close" aria-label="Пропустить настройку" onClick={onSkip}>
            Позже
          </button>
        </div>
        <div className="onboarding-progress" aria-label={`Шаг ${step + 1} из 3`}>
          <i style={{ width: `${(step + 1) * 33.333}%` }} />
        </div>
        {step === 0 && (
          <div className="onboarding-content placement-start-content">
            <p className="eyebrow">ПЕРСОНАЛЬНЫЙ МАРШРУТ · 1/3</p>
            <h2 id="onboarding-title">Какой у вас уровень немецкого?</h2>
            <p>Сначала оцените себя. Затем пройдите тест или начните с выбранного уровня.</p>
            <div
              className="start-choice-grid self-level-grid"
              role="radiogroup"
              aria-label="Предполагаемый уровень немецкого"
            >
              {levels.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  role="radio"
                  aria-checked={selfLevel === item.value}
                  className={selfLevel === item.value ? "selected" : ""}
                  onClick={() => {
                    setSelfLevel(item.value);
                    setPlacementReport(null);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.note}</span>
                </button>
              ))}
            </div>
            <details className="placement-self-skills">
              <summary>Оценить навыки (необязательно)</summary>
              <div>
                {selfSkillLabels.map((skill) => (
                  <label key={skill}>
                    {skill}
                    <select
                      value={selfSkills[skill] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelfSkills((current) => {
                          const next = { ...current };
                          if (value) next[skill] = value as SelfSkillRating;
                          else delete next[skill];
                          return next;
                        });
                      }}
                    >
                      <option value="">Пропустить</option>
                      <option>Слабо</option>
                      <option>Средне</option>
                      <option>Хорошо</option>
                      <option>Отлично</option>
                    </select>
                  </label>
                ))}
              </div>
            </details>
            {placementReport && (
              <div className="placement-recommendation">
                <strong>По тесту: {placementReport.level}</strong>
                <span>{placementReport.comparison}</span>
              </div>
            )}
            <p className="placement-ai-note">
              Письмо проверит Gemini · не вводите личные данные{" "}
              <HelpHint label="О данных письма">
                Текст отправится Google. На бесплатном тарифе Gemini Google может использовать
                запросы для улучшения сервисов. Используйте вымышленные данные.
              </HelpHint>
            </p>
            <div className="dialog-actions placement-start-actions">
              <button className="secondary-button" disabled={!selfLevel} onClick={() => setStep(1)}>
                Продолжить без теста
              </button>
              <button className="primary-button" disabled={!selfLevel} onClick={startPlacement}>
                Пройти входной тест <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="onboarding-content">
            <p className="eyebrow">ПЕРСОНАЛЬНЫЙ МАРШРУТ · 2/3</p>
            <h2 id="onboarding-title">Для чего вам немецкий?</h2>
            <p>Выберите темы, которые пригодятся в первую очередь.</p>
            {placementReport && (
              <div className="placement-recommendation">
                <strong>Тест рекомендует {placementReport.level}</strong>
                <span>
                  {placementReport.levels
                    .map((item) => `${item.level}: ${item.score}/20`)
                    .join(" · ")}
                </span>
                <button type="button" onClick={() => selfLevel && setPlacementOpen(true)}>
                  Посмотреть результат
                </button>
              </div>
            )}
            <div className="choice-chip-grid">
              {goals.map((goal) => (
                <button
                  type="button"
                  key={goal}
                  className={selectedGoals.includes(goal) ? "selected" : ""}
                  onClick={() => toggle(goal, selectedGoals, setSelectedGoals)}
                >
                  {goal}
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setStep(0)}>
                Назад
              </button>
              <button className="primary-button" onClick={() => setStep(2)}>
                Далее <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="onboarding-content">
            <p className="eyebrow">ПЕРСОНАЛЬНЫЙ МАРШРУТ · 3/3</p>
            <h2 id="onboarding-title">Как вам удобно заниматься?</h2>
            <p>Выберите дневную цель. Её можно изменить позже.</p>
            <div className="minutes-choice">
              {[5, 10, 20, 30].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={minutes === value ? "selected" : ""}
                  onClick={() => setMinutes(value)}
                >
                  <strong>{value}</strong>
                  <span>минут в день</span>
                </button>
              ))}
            </div>
            <p className="field-label">На чём сделать акцент?</p>
            <div className="choice-chip-grid">
              {focusOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={focus.includes(item) ? "selected" : ""}
                  onClick={() => toggle(item, focus, setFocus)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="field-label">Какие ситуации интересны?</p>
            <div className="choice-chip-grid">
              {interestOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={interests.includes(item) ? "selected" : ""}
                  onClick={() => toggle(item, interests, setInterests)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="field-label">Удобные форматы</p>
            <div className="choice-chip-grid">
              {formatOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={formats.includes(item) ? "selected" : ""}
                  onClick={() => toggle(item, formats, setFormats)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="setting-row">
              <span>
                <strong>Без микрофона</strong>
                <small>Не предлагать задания с записью речи</small>
              </span>
              <input
                type="checkbox"
                checked={avoidMicrophone}
                onChange={(event) => setAvoidMicrophone(event.target.checked)}
              />
            </label>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setStep(1)}>
                Назад
              </button>
              <button className="primary-button" onClick={finish}>
                Начать курс {suggestedLevel} <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
