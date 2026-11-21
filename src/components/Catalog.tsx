/**
 * AdminCourseBuilder — полный конструктор курса для администраторов.
 * Включает:
 *  - Каталог тестов (по уровням A0–C1)
 *  - Редактор юнитов (CRUD, переупорядочение)
 *  - Редактор тестов (quiz и level exam)
 *  - Настройка бонусов/призов
 *  - Настройка дорожки (Trail)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  GERMAN_COURSE,
  type CourseLevel,
  type CourseUnit,
} from "../data/germanCourse";
import {
  COURSE_QUIZZES,
  type UnitQuizQuestion,
} from "../data/courseQuizzes";
import { LEVEL_EXAMS, type LevelExam, type LevelExamQuestion } from "../data/levelExams";
import { modules } from "../lib/vocab";
import type { GameId } from "../lib/gameCatalog";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab = "tests" | "units" | "rewards" | "trail";

export type CourseReward = {
  unitId?: string;
  level?: CourseLevel;
  xp: number;
  badge?: string;
  unlockMessage?: string;
};

type DraftState = {
  units: CourseUnit[];
  rewards: Record<string, CourseReward>;
  trailSections: TrailSection[];
};

type TrailSection = {
  id: string;
  label: string;
  level: CourseLevel;
  unitIds: string[];
  direction: "ltr" | "rtl";
};

type UnitEditorTab =
  | "basic"
  | "vocab"
  | "grammar"
  | "dialogue"
  | "listening"
  | "reading"
  | "speaking"
  | "writing"
  | "games"
  | "quiz";

const LEVELS: CourseLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"];
const LEVEL_COLORS: Record<CourseLevel, string> = {
  A0: "#4ade80",
  A1: "#34d399",
  A2: "#2dd4bf",
  B1: "#60a5fa",
  B2: "#a78bfa",
  C1: "#f472b6",
};

const GAME_OPTIONS: { id: GameId; label: string }[] = [
  { id: "pairs", label: "Пары" },
  { id: "articles", label: "Артикли" },
  { id: "builder", label: "Конструктор слов" },
  { id: "blitz", label: "Блиц" },
  { id: "hangman", label: "Виселица" },
  { id: "wordsearch", label: "Поиск слов" },
  { id: "anagram", label: "Анаграмма" },
  { id: "train", label: "Поезд" },
  { id: "moles", label: "Кроты" },
  { id: "boxes", label: "Коробки" },
  { id: "wheel", label: "Колесо" },
  { id: "phonetic", label: "Фонетика" },
];

const STORAGE_KEY = "clickling-admin-draft";
const STORAGE_REWARDS_KEY = "clickling-admin-rewards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeBlankUnit(level: CourseLevel, id: string): CourseUnit {
  return {
    id,
    level,
    title: "Новый юнит",
    outcome: "",
    moduleIds: [],
    vocabulary: [],
    grammarTitle: "",
    theory: "",
    examples: [],
    dialogue: "",
    listeningQuestion: "",
    listeningOptions: ["", "", ""],
    listeningAnswer: 0,
    reading: "",
    readingQuestion: "",
    readingOptions: ["", "", ""],
    readingAnswer: 0,
    speakingPrompt: "",
    writingPrompt: "",
    writingExample: "",
  };
}

function makeBlankQuiz(): UnitQuizQuestion[] {
  return [
    {
      question: "",
      options: ["", "", "", ""],
      answer: 0,
      explanation: "",
    },
  ];
}

function makeBlankExamQuestion(): LevelExamQuestion {
  return {
    id: `q-${Date.now()}`,
    question: "",
    options: ["", "", "", ""],
    answer: 0,
    explanation: "",
    topic: "",
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CatalogScreen({ canManageContent }: { canManageContent: boolean; languageCode?: string; level?: string; legacyItems?: unknown[] }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("units");
  const savedDraft = loadDraft();
  const [draft, setDraft] = useState<DraftState>(
    savedDraft ?? {
      units: [...GERMAN_COURSE],
      rewards: {},
      trailSections: LEVELS.map((lv) => ({
        id: `section-${lv}`,
        label: `Уровень ${lv}`,
        level: lv,
        unitIds: GERMAN_COURSE.filter((u) => u.level === lv).map((u) => u.id),
        direction: "ltr",
      })),
    },
  );
  const [isDirty, setIsDirty] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const updateDraft = (updater: (prev: DraftState) => DraftState) => {
    setDraft((prev) => {
      const next = updater(prev);
      saveDraft(next);
      setIsDirty(true);
      return next;
    });
  };

  const handlePublish = () => {
    saveDraft(draft);
    setPublishedAt(new Date().toLocaleString("ru-RU"));
    setIsDirty(false);
    alert("✅ Курс опубликован! Изменения применены в памяти и сохранены локально.");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course-draft-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as DraftState;
        setDraft(data);
        saveDraft(data);
        setIsDirty(true);
        alert("✅ Данные импортированы");
      } catch {
        alert("❌ Ошибка: неверный формат файла");
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (!confirm("Сбросить все изменения до оригинала?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setDraft({
      units: [...GERMAN_COURSE],
      rewards: {},
      trailSections: LEVELS.map((lv) => ({
        id: `section-${lv}`,
        label: `Уровень ${lv}`,
        level: lv,
        unitIds: GERMAN_COURSE.filter((u) => u.level === lv).map((u) => u.id),
        direction: "ltr",
      })),
    });
    setIsDirty(false);
  };

  if (!canManageContent) {
    return <TestCatalogReadOnly />;
  }

  return (
    <div className="admin-builder">
      {/* ── Header ── */}
      <div className="admin-header">
        <div className="admin-header-title">
          <span className="eyebrow">Администратор</span>
          <h1 className="section-title" style={{ marginTop: 2 }}>Конструктор курса</h1>
        </div>
        <div className="admin-header-actions">
          {isDirty && <span className="draft-badge">● Черновик</span>}
          {publishedAt && !isDirty && (
            <span className="published-badge">✓ Опубликован {publishedAt}</span>
          )}
          <label className="secondary-button" style={{ cursor: "pointer" }}>
            <Icon name="inbox" size={15} />
            Импорт
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button className="secondary-button" onClick={handleExport}>
            <Icon name="folder" size={15} />
            Экспорт
          </button>
          <button className="secondary-button" onClick={handleReset}>
            <Icon name="refresh" size={15} />
            Сброс
          </button>
          <button className="primary-button" onClick={handlePublish} disabled={!isDirty}>
            <Icon name="check" size={15} />
            Опубликовать
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="admin-tabs">
        {(["units", "tests", "rewards", "trail"] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            className={`admin-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "units" && <><Icon name="book" size={14} /> Юниты</>}
            {tab === "tests" && <><Icon name="brain" size={14} /> Тесты</>}
            {tab === "rewards" && <><Icon name="gem" size={14} /> Призы</>}
            {tab === "trail" && <><Icon name="path" size={14} /> Дорожка</>}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="admin-content">
        {activeTab === "units" && (
          <UnitsTab draft={draft} updateDraft={updateDraft} />
        )}
        {activeTab === "tests" && (
          <TestsTab draft={draft} updateDraft={updateDraft} />
        )}
        {activeTab === "rewards" && (
          <RewardsTab draft={draft} updateDraft={updateDraft} />
        )}
        {activeTab === "trail" && (
          <TrailTab draft={draft} updateDraft={updateDraft} />
        )}
      </div>
    </div>
  );
}

// ─── Read-Only Test Catalog (for non-admins) ──────────────────────────────────

function TestCatalogReadOnly() {
  const [level, setLevel] = useState<CourseLevel>("A0");
  const exam = LEVEL_EXAMS[level];
  const unitQuizKeys = Object.keys(COURSE_QUIZZES).filter((k) =>
    k.startsWith(level.toLowerCase()),
  );

  return (
    <div className="page">
      <span className="eyebrow">Каталог тестов</span>
      <h2 className="section-title">Тесты по уровням</h2>
      <div className="level-pill-row">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            className={`level-pill${level === lv ? " active" : ""}`}
            style={level === lv ? { background: LEVEL_COLORS[lv], color: "#fff" } : {}}
            onClick={() => setLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>
      <div className="test-catalog-grid">
        <div className="test-card level-exam-card">
          <div className="test-card-badge" style={{ background: LEVEL_COLORS[level] }}>{level}</div>
          <div className="test-card-body">
            <div className="test-card-title">{exam.title}</div>
            <div className="test-card-meta">{exam.questions.length} вопросов · проходной балл {exam.passingScorePercent}%</div>
            <div className="test-card-desc">{exam.description}</div>
          </div>
        </div>
        {unitQuizKeys.map((key) => {
          const qs = COURSE_QUIZZES[key];
          return (
            <div key={key} className="test-card">
              <div className="test-card-badge" style={{ background: LEVEL_COLORS[level] }}>{key}</div>
              <div className="test-card-body">
                <div className="test-card-title">Тест юнита {key.toUpperCase()}</div>
                <div className="test-card-meta">{qs.length} вопросов</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── UNITS TAB ────────────────────────────────────────────────────────────────

function UnitsTab({
  draft,
  updateDraft,
}: {
  draft: DraftState;
  updateDraft: (fn: (prev: DraftState) => DraftState) => void;
}) {
  const [level, setLevel] = useState<CourseLevel>("A0");
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);
  const [search, setSearch] = useState("");

  const units = useMemo(
    () =>
      draft.units
        .filter((u) => u.level === level)
        .filter(
          (u) =>
            !search ||
            u.title.toLowerCase().includes(search.toLowerCase()) ||
            u.id.toLowerCase().includes(search.toLowerCase()),
        ),
    [draft.units, level, search],
  );

  const saveUnit = (unit: CourseUnit) => {
    updateDraft((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === unit.id ? unit : u)),
    }));
    setEditingUnit(null);
  };

  const addUnit = () => {
    const levelUnits = draft.units.filter((u) => u.level === level);
    const num = levelUnits.length + 1;
    const id = `${level.toLowerCase()}-${String(num).padStart(2, "0")}`;
    const newUnit = makeBlankUnit(level, id);
    updateDraft((prev) => ({
      ...prev,
      units: [...prev.units, newUnit],
      trailSections: prev.trailSections.map((s) =>
        s.level === level ? { ...s, unitIds: [...s.unitIds, id] } : s,
      ),
    }));
    setEditingUnit(newUnit);
  };

  const deleteUnit = (unitId: string) => {
    if (!confirm("Удалить юнит? Это действие необратимо.")) return;
    updateDraft((prev) => ({
      ...prev,
      units: prev.units.filter((u) => u.id !== unitId),
      trailSections: prev.trailSections.map((s) => ({
        ...s,
        unitIds: s.unitIds.filter((id) => id !== unitId),
      })),
    }));
  };

  const moveUnit = (unitId: string, dir: -1 | 1) => {
    updateDraft((prev) => {
      const arr = [...prev.units];
      const idx = arr.findIndex((u) => u.id === unitId);
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, units: arr };
    });
  };

  const unitCountByLevel = (lv: CourseLevel) =>
    draft.units.filter((u) => u.level === lv).length;

  return (
    <div className="units-tab">
      {/* Level tabs */}
      <div className="level-tab-row">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            className={`level-tab-btn${level === lv ? " active" : ""}`}
            style={level === lv ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : {}}
            onClick={() => setLevel(lv)}
          >
            {lv}
            <span className="unit-count-badge">{unitCountByLevel(lv)}</span>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="units-toolbar">
        <div className="search-box">
          <Icon name="search" size={14} />
          <input
            placeholder="Поиск по названию или ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="primary-button" onClick={addUnit}>
          <Icon name="plus" size={14} />
          Добавить юнит
        </button>
      </div>

      {/* Unit list */}
      <div className="unit-list">
        {units.length === 0 && (
          <div className="empty-state">Нет юнитов для уровня {level}</div>
        )}
        {units.map((unit, i) => (
          <div key={unit.id} className="unit-row">
            <div className="unit-row-move">
              <button
                className="move-btn"
                onClick={() => moveUnit(unit.id, -1)}
                disabled={i === 0}
                title="Вверх"
              >▲</button>
              <button
                className="move-btn"
                onClick={() => moveUnit(unit.id, 1)}
                disabled={i === units.length - 1}
                title="Вниз"
              >▼</button>
            </div>
            <div className="unit-row-id">
              <span className="unit-id-pill" style={{ background: LEVEL_COLORS[unit.level] }}>
                {unit.id}
              </span>
            </div>
            <div className="unit-row-info">
              <div className="unit-row-title">{unit.title}</div>
              <div className="unit-row-outcome">{unit.outcome || <em>Нет описания</em>}</div>
            </div>
            <div className="unit-row-actions">
              <button
                className="secondary-button small"
                onClick={() => setEditingUnit({ ...unit })}
              >
                <Icon name="spark" size={13} /> Изменить
              </button>
              <button
                className="secondary-button small danger"
                onClick={() => deleteUnit(unit.id)}
              >
                <Icon name="close" size={13} /> Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Unit Editor Modal */}
      {editingUnit && (
        <UnitEditorModal
          unit={editingUnit}
          onSave={saveUnit}
          onClose={() => setEditingUnit(null)}
        />
      )}
    </div>
  );
}

// ─── Unit Editor Modal ────────────────────────────────────────────────────────

function UnitEditorModal({
  unit,
  onSave,
  onClose,
}: {
  unit: CourseUnit;
  onSave: (u: CourseUnit) => void;
  onClose: () => void;
}) {
  const [edited, setEdited] = useState<CourseUnit>({ ...unit });
  const [tab, setTab] = useState<UnitEditorTab>("basic");
  const [quizDraft, setQuizDraft] = useState<UnitQuizQuestion[]>(
    COURSE_QUIZZES[unit.id] ? [...COURSE_QUIZZES[unit.id]] : makeBlankQuiz(),
  );

  const set = <K extends keyof CourseUnit>(key: K, value: CourseUnit[K]) =>
    setEdited((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    // Save quiz changes into the in-memory record for display
    if (quizDraft.length > 0) {
      COURSE_QUIZZES[edited.id] = quizDraft;
    }
    onSave(edited);
  };

  const editorTabs: { id: UnitEditorTab; label: string }[] = [
    { id: "basic", label: "Основное" },
    { id: "vocab", label: "Словарь" },
    { id: "grammar", label: "Грамматика" },
    { id: "dialogue", label: "Диалог" },
    { id: "listening", label: "Аудирование" },
    { id: "reading", label: "Чтение" },
    { id: "speaking", label: "Говорение" },
    { id: "writing", label: "Письмо" },
    { id: "games", label: "Игры" },
    { id: "quiz", label: "Тест" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="unit-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <span className="eyebrow">Редактор юнита</span>
            <div className="modal-title">{edited.title || "Новый юнит"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary-button" onClick={handleSave}>
              <Icon name="check" size={14} /> Сохранить
            </button>
            <button className="secondary-button" onClick={onClose}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        {/* Editor Tabs */}
        <div className="editor-tab-row">
          {editorTabs.map((t) => (
            <button
              key={t.id}
              className={`editor-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="editor-body">
          {tab === "basic" && (
            <div className="form-grid">
              <label className="form-label">ID юнита</label>
              <input className="form-input" value={edited.id} onChange={(e) => set("id", e.target.value)} />

              <label className="form-label">Уровень</label>
              <select className="form-input" value={edited.level} onChange={(e) => set("level", e.target.value as CourseLevel)}>
                {LEVELS.map((lv) => <option key={lv}>{lv}</option>)}
              </select>

              <label className="form-label">Название юнита</label>
              <input className="form-input" value={edited.title} onChange={(e) => set("title", e.target.value)} placeholder="Название…" />

              <label className="form-label">Цель урока (outcome)</label>
              <textarea className="form-textarea" value={edited.outcome} onChange={(e) => set("outcome", e.target.value)} rows={3} placeholder="Что студент научится делать…" />
            </div>
          )}

          {tab === "vocab" && (
            <VocabTab edited={edited} set={set} />
          )}

          {tab === "grammar" && (
            <div className="form-grid">
              <label className="form-label">Заголовок темы</label>
              <input className="form-input" value={edited.grammarTitle} onChange={(e) => set("grammarTitle", e.target.value)} placeholder="Например: Артикли der/die/das" />

              <label className="form-label">Теория</label>
              <textarea className="form-textarea" value={edited.theory} onChange={(e) => set("theory", e.target.value)} rows={5} placeholder="Объяснение правила…" />

              <label className="form-label">Примеры (каждый с новой строки)</label>
              <textarea
                className="form-textarea"
                value={edited.examples.join("\n")}
                onChange={(e) => set("examples", e.target.value.split("\n"))}
                rows={5}
                placeholder="Der Hund ist groß.&#10;Die Katze ist klein."
              />
            </div>
          )}

          {tab === "dialogue" && (
            <div className="form-grid">
              <label className="form-label">Текст диалога</label>
              <textarea className="form-textarea" value={edited.dialogue} onChange={(e) => set("dialogue", e.target.value)} rows={8} placeholder="A: Hallo!&#10;B: Hallo! Wie geht's?" />
            </div>
          )}

          {tab === "listening" && (
            <div className="form-grid">
              <label className="form-label">Вопрос аудирования</label>
              <input className="form-input" value={edited.listeningQuestion} onChange={(e) => set("listeningQuestion", e.target.value)} />

              <label className="form-label">Варианты ответов</label>
              {edited.listeningOptions.map((opt, i) => (
                <input
                  key={i}
                  className="form-input"
                  value={opt}
                  onChange={(e) => {
                    const opts = [...edited.listeningOptions];
                    opts[i] = e.target.value;
                    set("listeningOptions", opts);
                  }}
                  placeholder={`Вариант ${i + 1}`}
                />
              ))}

              <label className="form-label">Правильный ответ (0-based индекс)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={edited.listeningOptions.length - 1}
                value={edited.listeningAnswer}
                onChange={(e) => set("listeningAnswer", Number(e.target.value))}
              />
            </div>
          )}

          {tab === "reading" && (
            <div className="form-grid">
              <label className="form-label">Текст для чтения</label>
              <textarea className="form-textarea" value={edited.reading} onChange={(e) => set("reading", e.target.value)} rows={6} />

              <label className="form-label">Вопрос по тексту</label>
              <input className="form-input" value={edited.readingQuestion} onChange={(e) => set("readingQuestion", e.target.value)} />

              <label className="form-label">Варианты ответов</label>
              {edited.readingOptions.map((opt, i) => (
                <input
                  key={i}
                  className="form-input"
                  value={opt}
                  onChange={(e) => {
                    const opts = [...edited.readingOptions];
                    opts[i] = e.target.value;
                    set("readingOptions", opts);
                  }}
                  placeholder={`Вариант ${i + 1}`}
                />
              ))}

              <label className="form-label">Правильный ответ (0-based)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={edited.readingOptions.length - 1}
                value={edited.readingAnswer}
                onChange={(e) => set("readingAnswer", Number(e.target.value))}
              />
            </div>
          )}

          {tab === "speaking" && (
            <div className="form-grid">
              <label className="form-label">Задание для говорения</label>
              <textarea className="form-textarea" value={edited.speakingPrompt} onChange={(e) => set("speakingPrompt", e.target.value)} rows={4} placeholder="Прочитайте вслух…" />
            </div>
          )}

          {tab === "writing" && (
            <div className="form-grid">
              <label className="form-label">Задание для письма</label>
              <textarea className="form-textarea" value={edited.writingPrompt} onChange={(e) => set("writingPrompt", e.target.value)} rows={4} placeholder="Напишите…" />

              <label className="form-label">Пример ответа</label>
              <textarea className="form-textarea" value={edited.writingExample} onChange={(e) => set("writingExample", e.target.value)} rows={4} placeholder="Ich bin…" />
            </div>
          )}

          {tab === "games" && (
            <GamesTab edited={edited} set={set} />
          )}

          {tab === "quiz" && (
            <QuizEditorTab
              unitId={edited.id}
              questions={quizDraft}
              onChange={setQuizDraft}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vocab Tab ────────────────────────────────────────────────────────────────

function VocabTab({
  edited,
  set,
}: {
  edited: CourseUnit;
  set: <K extends keyof CourseUnit>(k: K, v: CourseUnit[K]) => void;
}) {
  const [searchMod, setSearchMod] = useState("");
  const filteredModules = useMemo(
    () =>
      modules.filter(
        (m) =>
          !searchMod ||
          m.title.toLowerCase().includes(searchMod.toLowerCase()) ||
          String(m.id).includes(searchMod),
      ),
    [searchMod],
  );

  const toggleModule = (id: number) => {
    const current = edited.moduleIds;
    if (current.includes(id)) {
      set("moduleIds", current.filter((x) => x !== id));
    } else {
      set("moduleIds", [...current, id]);
    }
  };

  return (
    <div className="form-grid">
      <label className="form-label">Привязанные модули словаря</label>
      <input
        className="form-input"
        placeholder="Поиск модуля…"
        value={searchMod}
        onChange={(e) => setSearchMod(e.target.value)}
      />
      <div className="module-selector-grid">
        {filteredModules.map((m) => {
          const active = edited.moduleIds.includes(m.id);
          return (
            <button
              key={m.id}
              className={`module-chip${active ? " active" : ""}`}
              onClick={() => toggleModule(m.id)}
            >
              <span className="module-chip-id">#{m.id}</span>
              <span className="module-chip-title">{m.title}</span>
              {active && <Icon name="check" size={12} />}
            </button>
          );
        })}
      </div>

      <label className="form-label" style={{ marginTop: 16 }}>Пользовательский словарь (слово=перевод, каждое с новой строки)</label>
      <textarea
        className="form-textarea"
        value={edited.vocabulary.join("\n")}
        onChange={(e) => set("vocabulary", e.target.value.split("\n").filter(Boolean))}
        rows={6}
        placeholder={"Hallo=Привет\nDanke=Спасибо"}
      />
    </div>
  );
}

// ─── Games Tab ────────────────────────────────────────────────────────────────

function GamesTab({
  edited,
  set,
}: {
  edited: CourseUnit;
  set: <K extends keyof CourseUnit>(k: K, v: CourseUnit[K]) => void;
}) {
  // Store suggested games in vocabulary field (we use a separate key in localStorage)
  const storageKey = `clickling-unit-games-${edited.id}`;
  const [selectedGames, setSelectedGames] = useState<GameId[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as GameId[];
    } catch {
      return [];
    }
  });

  const toggle = (id: GameId) => {
    const next = selectedGames.includes(id)
      ? selectedGames.filter((g) => g !== id)
      : [...selectedGames, id];
    setSelectedGames(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  return (
    <div className="form-grid">
      <label className="form-label">Рекомендуемые игры для этого юнита</label>
      <div className="games-chip-grid">
        {GAME_OPTIONS.map((g) => {
          const active = selectedGames.includes(g.id);
          return (
            <button
              key={g.id}
              className={`game-chip${active ? " active" : ""}`}
              onClick={() => toggle(g.id)}
            >
              <Icon name="game" size={14} />
              {g.label}
              {active && <Icon name="check" size={12} />}
            </button>
          );
        })}
      </div>
      {selectedGames.length > 0 && (
        <div className="selected-games-info">
          Выбрано: {selectedGames.join(", ")}
        </div>
      )}
    </div>
  );
}

// ─── Quiz Editor Tab ──────────────────────────────────────────────────────────

function QuizEditorTab({
  unitId,
  questions,
  onChange,
}: {
  unitId: string;
  questions: UnitQuizQuestion[];
  onChange: (qs: UnitQuizQuestion[]) => void;
}) {
  const addQuestion = () =>
    onChange([
      ...questions,
      { question: "", options: ["", "", "", ""], answer: 0, explanation: "" },
    ]);

  const removeQuestion = (i: number) =>
    onChange(questions.filter((_, idx) => idx !== i));

  const updateQ = (i: number, key: keyof UnitQuizQuestion, value: string | number | string[]) => {
    const next = questions.map((q, idx) => (idx === i ? { ...q, [key]: value } : q));
    onChange(next);
  };

  return (
    <div className="quiz-editor">
      <div className="quiz-editor-header">
        <span className="eyebrow">Тест юнита {unitId}</span>
        <button className="secondary-button small" onClick={addQuestion}>
          <Icon name="plus" size={13} /> Добавить вопрос
        </button>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="quiz-question-block">
          <div className="quiz-q-num">
            <span>Вопрос {i + 1}</span>
            <button className="secondary-button small danger" onClick={() => removeQuestion(i)}>
              <Icon name="close" size={12} />
            </button>
          </div>
          <input
            className="form-input"
            value={q.question}
            onChange={(e) => updateQ(i, "question", e.target.value)}
            placeholder="Текст вопроса…"
          />
          <div className="quiz-options-grid">
            {q.options.map((opt, oi) => (
              <div key={oi} className={`quiz-option${q.answer === oi ? " correct" : ""}`}>
                <button
                  className="quiz-correct-btn"
                  onClick={() => updateQ(i, "answer", oi)}
                  title="Отметить как правильный"
                >
                  {q.answer === oi ? "✓" : "○"}
                </button>
                <input
                  className="form-input"
                  value={opt}
                  onChange={(e) => {
                    const opts = [...q.options];
                    opts[oi] = e.target.value;
                    updateQ(i, "options", opts);
                  }}
                  placeholder={`Вариант ${oi + 1}`}
                />
              </div>
            ))}
          </div>
          <input
            className="form-input"
            value={q.explanation}
            onChange={(e) => updateQ(i, "explanation", e.target.value)}
            placeholder="Объяснение правильного ответа…"
          />
        </div>
      ))}
    </div>
  );
}

// ─── TESTS TAB ────────────────────────────────────────────────────────────────

function TestsTab({
  draft,
  updateDraft,
}: {
  draft: DraftState;
  updateDraft: (fn: (prev: DraftState) => DraftState) => void;
}) {
  const [level, setLevel] = useState<CourseLevel>("A0");
  const [editingExam, setEditingExam] = useState<LevelExam | null>(null);
  const [examDrafts, setExamDrafts] = useState<Record<CourseLevel, LevelExam>>(
    () => ({ ...LEVEL_EXAMS }),
  );

  const exam = examDrafts[level];
  const unitQuizKeys = Object.keys(COURSE_QUIZZES).filter((k) =>
    k.startsWith(level.toLowerCase()),
  );

  const saveExam = (updated: LevelExam) => {
    setExamDrafts((prev) => ({ ...prev, [level]: updated }));
    // Persist to LEVEL_EXAMS in memory (affects session, not file)
    (LEVEL_EXAMS as Record<CourseLevel, LevelExam>)[level] = updated;
    setEditingExam(null);
  };

  return (
    <div className="tests-tab">
      <div className="level-tab-row">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            className={`level-tab-btn${level === lv ? " active" : ""}`}
            style={level === lv ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : {}}
            onClick={() => setLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>

      {/* Level Exam Card */}
      <div className="test-section-title">
        <Icon name="brain" size={16} /> Итоговый экзамен уровня
      </div>
      <div className="test-card level-exam-card large">
        <div className="test-card-badge" style={{ background: LEVEL_COLORS[level] }}>
          {level}
        </div>
        <div className="test-card-body">
          <div className="test-card-title">{exam.title}</div>
          <div className="test-card-meta">
            {exam.questions.length} вопросов · проходной балл {exam.passingScorePercent}%
          </div>
          <div className="test-card-desc">{exam.description}</div>
        </div>
        <button
          className="secondary-button"
          onClick={() => setEditingExam({ ...exam })}
        >
          <Icon name="spark" size={14} /> Изменить
        </button>
      </div>

      {/* Unit Quizzes */}
      <div className="test-section-title" style={{ marginTop: 24 }}>
        <Icon name="book" size={16} /> Тесты юнитов
      </div>
      <div className="test-catalog-grid">
        {unitQuizKeys.length === 0 && (
          <div className="empty-state">Нет тестов для уровня {level}</div>
        )}
        {unitQuizKeys.map((key) => {
          const qs = COURSE_QUIZZES[key];
          return (
            <UnitQuizCard key={key} unitKey={key} questions={qs} level={level} />
          );
        })}
      </div>

      {/* Level Exam Editor Modal */}
      {editingExam && (
        <LevelExamEditorModal
          exam={editingExam}
          onSave={saveExam}
          onClose={() => setEditingExam(null)}
        />
      )}
    </div>
  );
}

function UnitQuizCard({
  unitKey,
  questions,
  level,
}: {
  unitKey: string;
  questions: UnitQuizQuestion[];
  level: CourseLevel;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localQs, setLocalQs] = useState<UnitQuizQuestion[]>(questions);

  const save = () => {
    COURSE_QUIZZES[unitKey] = localQs;
    setEditing(false);
  };

  return (
    <div className={`test-card${expanded ? " expanded" : ""}`}>
      <div className="test-card-badge" style={{ background: LEVEL_COLORS[level] }}>
        {unitKey}
      </div>
      <div className="test-card-body">
        <div className="test-card-title">Тест · {unitKey.toUpperCase()}</div>
        <div className="test-card-meta">{localQs.length} вопросов</div>
      </div>
      <div className="test-card-actions">
        <button className="secondary-button small" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Скрыть" : "Просмотр"}
        </button>
        <button className="secondary-button small" onClick={() => setEditing(true)}>
          <Icon name="spark" size={12} /> Изменить
        </button>
      </div>
      {expanded && !editing && (
        <div className="quiz-preview">
          {localQs.map((q, i) => (
            <div key={i} className="quiz-preview-item">
              <strong>Q{i + 1}:</strong> {q.question}
              <div className="quiz-preview-answer">✓ {q.options[q.answer]}</div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="unit-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Редактор теста</span>
                <div className="modal-title">{unitKey.toUpperCase()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="primary-button" onClick={save}>
                  <Icon name="check" size={14} /> Сохранить
                </button>
                <button className="secondary-button" onClick={() => setEditing(false)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            </div>
            <div className="editor-body">
              <QuizEditorTab unitId={unitKey} questions={localQs} onChange={setLocalQs} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelExamEditorModal({
  exam,
  onSave,
  onClose,
}: {
  exam: LevelExam;
  onSave: (e: LevelExam) => void;
  onClose: () => void;
}) {
  const [edited, setEdited] = useState<LevelExam>({ ...exam, questions: [...exam.questions] });

  const addQuestion = () =>
    setEdited((prev) => ({
      ...prev,
      questions: [...prev.questions, makeBlankExamQuestion()],
    }));

  const removeQuestion = (i: number) =>
    setEdited((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== i),
    }));

  const updateQ = (i: number, key: keyof LevelExamQuestion, val: string | number | string[]) =>
    setEdited((prev) => ({
      ...prev,
      questions: prev.questions.map((q, idx) =>
        idx === i ? { ...q, [key]: val } : q,
      ),
    }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="unit-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Редактор экзамена</span>
            <div className="modal-title">{edited.level} · {edited.title}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary-button" onClick={() => onSave(edited)}>
              <Icon name="check" size={14} /> Сохранить
            </button>
            <button className="secondary-button" onClick={onClose}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
        <div className="editor-body">
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <label className="form-label">Название экзамена</label>
            <input
              className="form-input"
              value={edited.title}
              onChange={(e) => setEdited((p) => ({ ...p, title: e.target.value }))}
            />
            <label className="form-label">Описание</label>
            <textarea
              className="form-textarea"
              value={edited.description}
              onChange={(e) => setEdited((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
            <label className="form-label">Проходной балл (%)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={100}
              value={edited.passingScorePercent}
              onChange={(e) =>
                setEdited((p) => ({ ...p, passingScorePercent: Number(e.target.value) }))
              }
            />
          </div>

          <div className="quiz-editor-header">
            <span className="eyebrow">Вопросы ({edited.questions.length})</span>
            <button className="secondary-button small" onClick={addQuestion}>
              <Icon name="plus" size={13} /> Добавить вопрос
            </button>
          </div>

          {edited.questions.map((q, i) => (
            <div key={q.id} className="quiz-question-block">
              <div className="quiz-q-num">
                <span>Вопрос {i + 1} · {q.topic || "без темы"}</span>
                <button className="secondary-button small danger" onClick={() => removeQuestion(i)}>
                  <Icon name="close" size={12} />
                </button>
              </div>
              <input
                className="form-input"
                value={q.topic}
                onChange={(e) => updateQ(i, "topic", e.target.value)}
                placeholder="Тема вопроса…"
              />
              <input
                className="form-input"
                value={q.question}
                onChange={(e) => updateQ(i, "question", e.target.value)}
                placeholder="Текст вопроса…"
              />
              <div className="quiz-options-grid">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`quiz-option${q.answer === oi ? " correct" : ""}`}>
                    <button
                      className="quiz-correct-btn"
                      onClick={() => updateQ(i, "answer", oi)}
                      title="Правильный ответ"
                    >
                      {q.answer === oi ? "✓" : "○"}
                    </button>
                    <input
                      className="form-input"
                      value={opt}
                      onChange={(e) => {
                        const opts = [...q.options];
                        opts[oi] = e.target.value;
                        updateQ(i, "options", opts);
                      }}
                      placeholder={`Вариант ${oi + 1}`}
                    />
                  </div>
                ))}
              </div>
              <input
                className="form-input"
                value={q.explanation}
                onChange={(e) => updateQ(i, "explanation", e.target.value)}
                placeholder="Объяснение правильного ответа…"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── REWARDS TAB ──────────────────────────────────────────────────────────────

function RewardsTab({
  draft,
  updateDraft,
}: {
  draft: DraftState;
  updateDraft: (fn: (prev: DraftState) => DraftState) => void;
}) {
  const [level, setLevel] = useState<CourseLevel>("A0");
  const unitsForLevel = draft.units.filter((u) => u.level === level);

  const getReward = (id: string): CourseReward =>
    draft.rewards[id] ?? { xp: 10, badge: "", unlockMessage: "" };

  const setReward = (id: string, patch: Partial<CourseReward>) =>
    updateDraft((prev) => ({
      ...prev,
      rewards: { ...prev.rewards, [id]: { ...getReward(id), ...patch } },
    }));

  const levelRewardId = `level-${level}`;
  const levelReward = getReward(levelRewardId);

  return (
    <div className="rewards-tab">
      <div className="level-tab-row">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            className={`level-tab-btn${level === lv ? " active" : ""}`}
            style={level === lv ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : {}}
            onClick={() => setLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>

      {/* Level reward */}
      <div className="reward-section">
        <div className="reward-section-title">
          <Icon name="gem" size={16} />
          Награда за прохождение уровня {level}
        </div>
        <div className="reward-row">
          <div className="form-grid">
            <label className="form-label">XP за уровень</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={levelReward.xp}
              onChange={(e) => setReward(levelRewardId, { xp: Number(e.target.value) })}
            />
            <label className="form-label">Значок (badge emoji/icon)</label>
            <input
              className="form-input"
              value={levelReward.badge ?? ""}
              onChange={(e) => setReward(levelRewardId, { badge: e.target.value })}
              placeholder="🏆"
            />
            <label className="form-label">Сообщение о разблокировке</label>
            <input
              className="form-input"
              value={levelReward.unlockMessage ?? ""}
              onChange={(e) => setReward(levelRewardId, { unlockMessage: e.target.value })}
              placeholder="Поздравляем! Вы прошли уровень A0!"
            />
          </div>
        </div>
      </div>

      {/* Per-unit rewards */}
      <div className="reward-section">
        <div className="reward-section-title">
          <Icon name="star" size={16} />
          Награды за юниты
        </div>
        <div className="unit-rewards-list">
          {unitsForLevel.map((unit) => {
            const r = getReward(unit.id);
            return (
              <div key={unit.id} className="unit-reward-row">
                <div className="unit-reward-id">
                  <span className="unit-id-pill" style={{ background: LEVEL_COLORS[level] }}>
                    {unit.id}
                  </span>
                  <span className="unit-reward-title">{unit.title}</span>
                </div>
                <div className="unit-reward-fields">
                  <label>XP</label>
                  <input
                    type="number"
                    className="form-input mini"
                    min={0}
                    value={r.xp}
                    onChange={(e) => setReward(unit.id, { xp: Number(e.target.value) })}
                  />
                  <label>Badge</label>
                  <input
                    className="form-input mini"
                    value={r.badge ?? ""}
                    onChange={(e) => setReward(unit.id, { badge: e.target.value })}
                    placeholder="⭐"
                  />
                  <label>Сообщение</label>
                  <input
                    className="form-input"
                    value={r.unlockMessage ?? ""}
                    onChange={(e) => setReward(unit.id, { unlockMessage: e.target.value })}
                    placeholder="Отлично! Юнит пройден."
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TRAIL TAB ────────────────────────────────────────────────────────────────

function TrailTab({
  draft,
  updateDraft,
}: {
  draft: DraftState;
  updateDraft: (fn: (prev: DraftState) => DraftState) => void;
}) {
  const addSection = () => {
    const newId = `section-custom-${Date.now()}`;
    updateDraft((prev) => ({
      ...prev,
      trailSections: [
        ...prev.trailSections,
        {
          id: newId,
          label: "Новый раздел",
          level: "A0",
          unitIds: [],
          direction: "ltr",
        },
      ],
    }));
  };

  const updateSection = (id: string, patch: Partial<TrailSection>) =>
    updateDraft((prev) => ({
      ...prev,
      trailSections: prev.trailSections.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }));

  const removeSection = (id: string) => {
    if (!confirm("Удалить раздел дорожки?")) return;
    updateDraft((prev) => ({
      ...prev,
      trailSections: prev.trailSections.filter((s) => s.id !== id),
    }));
  };

  const moveSection = (id: string, dir: -1 | 1) =>
    updateDraft((prev) => {
      const arr = [...prev.trailSections];
      const idx = arr.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, trailSections: arr };
    });

  return (
    <div className="trail-tab">
      <div className="trail-tab-header">
        <div>
          <span className="eyebrow">Настройка дорожки обучения</span>
          <p className="trail-hint">
            Каждый раздел — это блок дорожки с набором юнитов. Можно менять порядок, направление (ltr/rtl) и состав.
          </p>
        </div>
        <button className="primary-button" onClick={addSection}>
          <Icon name="plus" size={14} /> Добавить раздел
        </button>
      </div>

      <div className="trail-sections-list">
        {draft.trailSections.map((section, i) => (
          <TrailSectionCard
            key={section.id}
            section={section}
            index={i}
            total={draft.trailSections.length}
            allUnits={draft.units}
            onUpdate={(patch) => updateSection(section.id, patch)}
            onRemove={() => removeSection(section.id)}
            onMove={(dir) => moveSection(section.id, dir)}
          />
        ))}
      </div>
    </div>
  );
}

function TrailSectionCard({
  section,
  index,
  total,
  allUnits,
  onUpdate,
  onRemove,
  onMove,
}: {
  section: TrailSection;
  index: number;
  total: number;
  allUnits: CourseUnit[];
  onUpdate: (p: Partial<TrailSection>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const availableUnits = allUnits.filter((u) => u.level === section.level);

  const toggleUnit = (unitId: string) => {
    const current = section.unitIds;
    if (current.includes(unitId)) {
      onUpdate({ unitIds: current.filter((id) => id !== unitId) });
    } else {
      onUpdate({ unitIds: [...current, unitId] });
    }
  };

  return (
    <div className="trail-section-card">
      <div className="trail-section-header">
        <div className="trail-section-move">
          <button className="move-btn" onClick={() => onMove(-1)} disabled={index === 0}>▲</button>
          <button className="move-btn" onClick={() => onMove(1)} disabled={index === total - 1}>▼</button>
        </div>
        <div
          className="trail-section-color"
          style={{ background: LEVEL_COLORS[section.level] }}
        />
        <div className="trail-section-info">
          <input
            className="form-input"
            value={section.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            style={{ fontWeight: 600, fontSize: 14 }}
          />
          <div className="trail-section-meta">
            <select
              className="form-input mini"
              value={section.level}
              onChange={(e) => onUpdate({ level: e.target.value as CourseLevel })}
            >
              {LEVELS.map((lv) => <option key={lv}>{lv}</option>)}
            </select>
            <select
              className="form-input mini"
              value={section.direction}
              onChange={(e) => onUpdate({ direction: e.target.value as "ltr" | "rtl" })}
            >
              <option value="ltr">→ Слева направо</option>
              <option value="rtl">← Справа налево</option>
            </select>
            <span className="trail-unit-count">{section.unitIds.length} юнитов</span>
          </div>
        </div>
        <div className="trail-section-actions">
          <button className="secondary-button small" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Скрыть" : "Юниты"}
          </button>
          <button className="secondary-button small danger" onClick={onRemove}>
            <Icon name="close" size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="trail-unit-selector">
          <div className="trail-unit-selector-title">
            Выберите юниты уровня {section.level}:
          </div>
          {availableUnits.length === 0 && (
            <div className="empty-state">Нет юнитов для уровня {section.level}</div>
          )}
          <div className="trail-unit-chips">
            {availableUnits.map((u) => {
              const active = section.unitIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  className={`module-chip${active ? " active" : ""}`}
                  onClick={() => toggleUnit(u.id)}
                >
                  <span className="module-chip-id">{u.id}</span>
                  <span className="module-chip-title">{u.title}</span>
                  {active && <Icon name="check" size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
