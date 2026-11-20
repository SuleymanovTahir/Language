import { useEffect, useMemo, useRef, useState } from "react";
import { parseVocabulary, type VocabCard, type VocabModule } from "../lib/vocab";
import { Icon } from "./Icon";
import { loadMediaFile, saveMediaFile } from "../lib/mediaStore";
import { HelpHint } from "./HelpHint";
import { speakText } from "./StudySession";
import { defaultVoiceFor, type SpeechProvider, type SpeechSettings } from "../lib/speech";

export type LearningSpace = {
  id: string;
  languageCode: string;
  languageName: string;
  flag: string;
  level: string;
  nativeLanguageCode: string;
};

const supportedLanguages = [
  { code: "de", name: "Немецкий", flag: "DE" },
  { code: "en", name: "Английский", flag: "EN" },
  { code: "es", name: "Испанский", flag: "ES" },
  { code: "fr", name: "Французский", flag: "FR" },
  { code: "it", name: "Итальянский", flag: "IT" },
  { code: "tr", name: "Турецкий", flag: "TR" },
];

export function LearningSpaceDialog({
  spaces,
  activeId,
  onSelect,
  onCreate,
  onClose,
}: {
  spaces: LearningSpace[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (space: LearningSpace) => void;
  onClose: () => void;
}) {
  const [languageCode, setLanguageCode] = useState("en");
  const [level, setLevel] = useState("A1–A2");
  const selectedLanguage =
    supportedLanguages.find((language) => language.code === languageCode) ?? supportedLanguages[0];
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card space-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <p className="eyebrow">УЧЕБНЫЕ КАБИНЕТЫ</p>
        <h2 id="space-title">Язык и уровень</h2>
        <p>У каждого кабинета свой словарь, игры, грамматика и прогресс.</p>
        <div className="space-list">
          {spaces.map((space) => (
            <button
              key={space.id}
              className={space.id === activeId ? "active" : ""}
              onClick={() => {
                onSelect(space.id);
                onClose();
              }}
            >
              <span className="flag">{space.flag}</span>
              <span>
                <strong>{space.languageName}</strong>
                <small>Уровень {space.level}</small>
              </span>
              {space.id === activeId && <Icon name="check" size={17} />}
            </button>
          ))}
        </div>
        <div className="space-create">
          <h3>Добавить язык или уровень</h3>
          <div className="space-fields">
            <label className="field-label">
              Язык
              <select
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
              >
                {supportedLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Уровень
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {["A1–A2", "A1", "A2", "B1", "B2", "C1", "C2"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              const existing = spaces.find(
                (space) => space.languageCode === languageCode && space.level === level,
              );
              const space = existing ?? {
                id: `${languageCode}-${level}-${Date.now()}`,
                languageCode,
                languageName: selectedLanguage.name,
                flag: selectedLanguage.flag,
                level,
                nativeLanguageCode: "ru",
              };
              if (!existing) onCreate(space);
              onSelect(space.id);
              onClose();
            }}
          >
            {spaces.some((space) => space.languageCode === languageCode && space.level === level)
              ? "Открыть этот кабинет"
              : "Создать отдельный кабинет"}{" "}
            <Icon name="arrow" />
          </button>
        </div>
      </section>
    </div>
  );
}

export function CreateModuleDialog({
  onClose,
  onCreate,
  languageName,
  level,
}: {
  onClose: () => void;
  onCreate: (title: string, cards: VocabCard[]) => void;
  languageName: string;
  level: string;
}) {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const preview = useMemo(
    () => parseVocabulary(rawText, 1000, title || "Мой модуль"),
    [rawText, title],
  );
  const loadFile = (file?: File) => {
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && !file.type.startsWith("text/")) {
      setError("Для импорта выберите текстовый файл .txt.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result || ""));
      setError("");
    };
    reader.onerror = () => setError("Не удалось прочитать файл.");
    reader.readAsText(file, "UTF-8");
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <p className="eyebrow">
          {languageName.toLocaleUpperCase()} · {level}
        </p>
        <h2 id="create-title">Создать модуль</h2>
        <p>
          Добавьте слова для текущего учебного кабинета. Каждая строка: «слово — перевод». Можно
          добавить произношение в квадратных скобках.
        </p>
        <label className="field-label">
          Название модуля
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, Путешествия"
            autoFocus
          />
        </label>
        <label
          className="import-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            loadFile(event.dataTransfer.files[0]);
          }}
        >
          <Icon name="plus" />
          <strong>Перетащите .txt или выберите файл</strong>
          <span>Обе стороны словаря автоматически объединяются</span>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />
        </label>
        <label className="field-label">
          Или вставьте текст словаря
          <textarea
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              setError("");
            }}
            rows={7}
            placeholder={"der Tisch [тиш] - стол\ngehen [геен] - идти"}
          />
        </label>
        <div className="import-summary">
          <span>{preview.length} уникальных карточек</span>
          <span>{preview.filter((card) => card.article).length} слов с артиклем</span>
        </div>
        {preview.length > 0 && (
          <div className="import-preview">
            {preview.slice(0, 4).map((card) => (
              <div key={card.id}>
                <strong>
                  {card.article ? `${card.article} ` : ""}
                  {card.word}
                </strong>
                <span>{card.translation}</span>
              </div>
            ))}
            {preview.length > 4 && <small>и ещё {preview.length - 4}</small>}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="primary-button"
            disabled={!title.trim() || preview.length === 0}
            onClick={() => onCreate(title.trim(), preview)}
          >
            Добавить модуль <Icon name="arrow" />
          </button>
        </div>
      </section>
    </div>
  );
}

export function EditModuleDialog({
  module,
  onClose,
  onSave,
}: {
  module: VocabModule;
  onClose: () => void;
  onSave: (title: string, cards: VocabCard[]) => void;
}) {
  const [title, setTitle] = useState(module.title);
  const [cards, setCards] = useState(() => module.cards.map((card) => ({ ...card })));
  const draggedIndex = useRef<number | null>(null);
  const updateCard = (index: number, patch: Partial<VocabCard>) =>
    setCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, ...patch } : card)),
    );
  const move = (from: number, to: number) =>
    setCards((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const addCard = () =>
    setCards((current) => [
      ...current,
      {
        id: `draft-${Date.now()}`,
        moduleId: module.id,
        word: "",
        article: null,
        transcription: "",
        translation: "",
        partOfSpeech: "other",
        phoneticRuleId: null,
      },
    ]);
  const attachImage = async (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      window.alert("Выберите изображение размером до 4 МБ.");
      return;
    }
    const id = `vocab-image-${crypto.randomUUID?.() ?? Date.now()}`;
    try {
      await saveMediaFile(id, file);
      updateCard(index, { image: { id, name: file.name } });
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось сохранить изображение.");
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card edit-module-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-module-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <p className="eyebrow">
          РЕДАКТОР МОДУЛЯ · {module.languageName} {module.level}
        </p>
        <h2 id="edit-module-title">Изменить материалы</h2>
        <label className="field-label">
          Название
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <p className="editor-hint">
          Перетаскивайте строки или используйте стрелки. Здесь также можно добавить картинку, пример
          предложения и подсказку для игр.
        </p>
        <div className="editable-cards">
          {cards.map((card, index) => (
            <article
              key={card.id}
              draggable
              onDragStart={() => {
                draggedIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedIndex.current !== null) move(draggedIndex.current, index);
                draggedIndex.current = null;
              }}
            >
              <span className="drag-handle" aria-label="Перетащить">
                ⠿
              </span>
              <div className="editable-card-fields">
                <label>
                  Язык
                  <input
                    value={card.word}
                    onChange={(event) => updateCard(index, { word: event.target.value })}
                  />
                </label>
                {module.languageCode === "de" && (
                  <label>
                    Артикль
                    <select
                      value={card.article ?? ""}
                      onChange={(event) =>
                        updateCard(index, {
                          article: (event.target.value || null) as VocabCard["article"],
                        })
                      }
                    >
                      <option value="">—</option>
                      <option>der</option>
                      <option>die</option>
                      <option>das</option>
                    </select>
                  </label>
                )}
                <label>
                  Транскрипция
                  <input
                    value={card.transcription.replace(/^\[|\]$/g, "")}
                    onChange={(event) =>
                      updateCard(index, {
                        transcription: event.target.value
                          ? `[${event.target.value.replace(/^\[|\]$/g, "")}]`
                          : "",
                      })
                    }
                  />
                </label>
                <label>
                  Перевод
                  <input
                    value={card.translation}
                    onChange={(event) => updateCard(index, { translation: event.target.value })}
                  />
                </label>
                <label className="editable-card-wide">
                  Пример с пропуском
                  <textarea
                    rows={2}
                    value={card.exampleSentence ?? ""}
                    onChange={(event) => updateCard(index, { exampleSentence: event.target.value })}
                    placeholder="Ich trinke ___ ."
                  />
                </label>
                <label>
                  Ответ для пропуска
                  <input
                    value={card.sentenceAnswer ?? ""}
                    onChange={(event) => updateCard(index, { sentenceAnswer: event.target.value })}
                    placeholder={card.word}
                  />
                </label>
                <label>
                  Подсказка для раунда
                  <input
                    value={card.hint ?? ""}
                    onChange={(event) => updateCard(index, { hint: event.target.value })}
                    placeholder="Короткая подсказка"
                  />
                </label>
                <div className="editable-card-image">
                  <label>
                    Картинка для карточки
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void attachImage(index, event.target.files?.[0])}
                    />
                  </label>
                  {card.image && (
                    <>
                      <CardImagePreview imageId={card.image.id} name={card.image.name} />
                      <button
                        type="button"
                        className="text-danger"
                        onClick={() => updateCard(index, { image: undefined })}
                      >
                        Убрать изображение
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="editable-card-actions">
                <button
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Поднять карточку ${index + 1}`}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(index, index + 1)}
                  disabled={index === cards.length - 1}
                  aria-label={`Опустить карточку ${index + 1}`}
                >
                  ↓
                </button>
                <button
                  className="delete-card-button"
                  onClick={() =>
                    setCards((current) => current.filter((_, cardIndex) => cardIndex !== index))
                  }
                  aria-label={`Удалить карточку ${index + 1}`}
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
        <button className="secondary-button add-card-button" onClick={addCard}>
          <Icon name="plus" size={15} /> Добавить карточку
        </button>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="primary-button"
            disabled={
              !title.trim() ||
              !cards.length ||
              cards.some((card) => !card.word.trim() || !card.translation.trim())
            }
            onClick={() => onSave(title.trim(), cards)}
          >
            Сохранить модуль
          </button>
        </div>
      </section>
    </div>
  );
}

function CardImagePreview({ imageId, name }: { imageId: string; name: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let url = "";
    let alive = true;
    void loadMediaFile(imageId)
      .then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId]);
  return src ? (
    <img className="editable-card-image-preview" src={src} alt={name} />
  ) : (
    <small>{name}</small>
  );
}

export type Preferences = {
  autoSpeak: boolean;
  highContrast: boolean;
  name: string;
  dailyGoal: number;
};

const speechLanguages: Record<string, string> = {
  de: "Немецкий",
  en: "Английский",
  fr: "Французский",
  es: "Испанский",
  it: "Итальянский",
  tr: "Турецкий",
  ru: "Русский",
};
const configuredVoices: Record<
  Exclude<SpeechProvider, "device">,
  Record<string, [string, string][]>
> = {
  edge: {
    de: [
      ["de-DE-TanjaNeural", "Tanja · женский"],
      ["de-DE-ChristophNeural", "Christoph · мужской"],
    ],
    en: [
      ["en-US-EmmaMultilingualNeural", "Emma · женский"],
      ["en-US-AndrewMultilingualNeural", "Andrew · мужской"],
    ],
    fr: [
      ["fr-FR-VivienneMultilingualNeural", "Vivienne · женский"],
      ["fr-FR-RemyMultilingualNeural", "Remy · мужской"],
    ],
  },
  kokoro: {
    en: [
      ["af_heart", "Heart · женский"],
      ["af_bella", "Bella · женский"],
      ["am_fenrir", "Fenrir · мужской"],
    ],
    fr: [["ff_siwis", "Siwis · женский"]],
  },
  elevenlabs: {},
  azure: {
    de: [
      ["de-DE-SeraphinaMultilingualNeural", "Seraphina · женский"],
      ["de-DE-FlorianMultilingualNeural", "Florian · мужской"],
      ["de-DE-KatjaNeural", "Katja · женский"],
      ["de-DE-ConradNeural", "Conrad · мужской"],
    ],
    en: [
      ["en-US-EmmaMultilingualNeural", "Emma · женский"],
      ["en-US-AndrewMultilingualNeural", "Andrew · мужской"],
      ["en-US-AvaMultilingualNeural", "Ava · женский"],
      ["en-US-BrianMultilingualNeural", "Brian · мужской"],
    ],
    fr: [
      ["fr-FR-VivienneMultilingualNeural", "Vivienne · женский"],
      ["fr-FR-RemyMultilingualNeural", "Remy · мужской"],
    ],
  },
};
const samples: Record<string, string> = {
  de: "Guten Morgen. Wie geht es dir?",
  en: "Good morning. How are you?",
  fr: "Bonjour. Comment ça va?",
  es: "Buenos días. ¿Cómo estás?",
  it: "Buongiorno. Come stai?",
  tr: "Günaydın. Nasılsın?",
  ru: "Доброе утро. Как дела?",
};
type ElevenLabsVoice = {
  id: string;
  name: string;
  gender?: string;
  age?: string;
  accent?: string;
  languages?: string[];
};
type ElevenLabsGenderFilter = "all" | "female" | "male";
type ElevenLabsAgeFilter = "all" | "young" | "adult" | "mature";

function voiceGenderLabel(value = "") {
  const normalized = value.toLocaleLowerCase();
  return normalized.includes("female") || normalized.includes("woman")
    ? "женский"
    : normalized.includes("male") || normalized.includes("man")
      ? "мужской"
      : "";
}

function voiceAgeCategory(value = ""): Exclude<ElevenLabsAgeFilter, "all"> | "" {
  const normalized = value.toLocaleLowerCase().replace(/[_-]+/g, " ");
  if (normalized.includes("young")) return "young";
  if (normalized.includes("old") || normalized.includes("mature")) return "mature";
  if (normalized.includes("adult") || normalized.includes("middle")) return "adult";
  return "";
}

function voiceAgeLabel(value = "") {
  const category = voiceAgeCategory(value);
  return category === "young"
    ? "молодой"
    : category === "adult"
      ? "взрослый"
      : category === "mature"
        ? "зрелый"
        : "";
}

function voiceAccentLabel(value = "") {
  const normalized = value.trim().toLocaleLowerCase();
  const known: Record<string, string> = {
    american: "американский",
    "american english": "американский",
    british: "британский",
    "british english": "британский",
    australian: "австралийский",
    canadian: "канадский",
    german: "немецкий",
    "standard german": "стандартный немецкий",
    french: "французский",
    spanish: "испанский",
    italian: "итальянский",
    irish: "ирландский",
    scottish: "шотландский",
  };
  return known[normalized] ?? value.trim();
}

export function SettingsDialog({
  value,
  speechSettings,
  languageCode = "de",
  authenticated = false,
  canManageSpeechProviders = false,
  onSave,
  onClose,
  onReset,
}: {
  value: Preferences;
  speechSettings: SpeechSettings;
  languageCode?: string;
  authenticated?: boolean;
  canManageSpeechProviders?: boolean;
  onSave: (next: Preferences, speech: SpeechSettings) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const language = languageCode.toLowerCase().split("-")[0];
  const fallbackProvider: SpeechProvider = configuredVoices.edge[language] ? "edge" : "device";
  const initialSpeechSettings =
    !canManageSpeechProviders && speechSettings.provider === "azure"
      ? {
          ...speechSettings,
          provider: fallbackProvider,
          voice: defaultVoiceFor(fallbackProvider, languageCode),
        }
      : speechSettings;
  const [draft, setDraft] = useState(value);
  const [speechDraft, setSpeechDraft] = useState(initialSpeechSettings);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [azureAvailable, setAzureAvailable] = useState(false);
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [elevenLabsLoading, setElevenLabsLoading] = useState(false);
  const [elevenLabsError, setElevenLabsError] = useState("");
  const [elevenGender, setElevenGender] = useState<ElevenLabsGenderFilter>("all");
  const [elevenAge, setElevenAge] = useState<ElevenLabsAgeFilter>("all");
  const filteredElevenLabsVoices = elevenLabsVoices.filter((voice) => {
    const gender = (voice.gender ?? "").toLocaleLowerCase();
    const genderCategory =
      gender.includes("female") || gender.includes("woman")
        ? "female"
        : gender.includes("male") || gender.includes("man")
          ? "male"
          : "";
    const age = voiceAgeCategory(voice.age);
    return (
      (elevenGender === "all" || genderCategory === elevenGender) &&
      (elevenAge === "all" || age === elevenAge)
    );
  });
  const elevenProviderVoices: [string, string][] = filteredElevenLabsVoices.map((voice) => [
    voice.id,
    [
      voice.name,
      voiceGenderLabel(voice.gender),
      voiceAgeLabel(voice.age),
      voiceAccentLabel(voice.accent),
    ]
      .filter(Boolean)
      .join(" · "),
  ]);
  const providerVoices: [string, string][] =
    speechDraft.provider === "device"
      ? []
      : speechDraft.provider === "elevenlabs"
        ? elevenProviderVoices
        : (configuredVoices[speechDraft.provider][language] ?? []);
  const voiceValue = providerVoices.some(([id]) => id === speechDraft.voice)
    ? speechDraft.voice
    : (providerVoices[0]?.[0] ??
      (speechDraft.provider === "elevenlabs"
        ? ""
        : defaultVoiceFor(speechDraft.provider, languageCode)));
  const canUseKokoro = language === "en" || language === "fr";
  const selectedSpeechSample = samples[language] ?? "Guten Morgen. Wie geht es dir?";
  useEffect(() => {
    if (canManageSpeechProviders || speechDraft.provider !== "azure") return;
    setSpeechDraft((current) =>
      current.provider === "azure"
        ? {
            ...current,
            provider: fallbackProvider,
            voice: defaultVoiceFor(fallbackProvider, languageCode),
          }
        : current,
    );
  }, [canManageSpeechProviders, fallbackProvider, languageCode, speechDraft.provider]);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if ("speechSynthesis" in window) {
      const refresh = () =>
        setBrowserVoices(
          window.speechSynthesis
            .getVoices()
            .filter((voice) => voice.lang.toLowerCase().startsWith(language)),
        );
      refresh();
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
      cleanup = () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
    void fetch("/api/tts", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{
              azureAvailable?: boolean;
              elevenLabsAvailable?: boolean;
            }>)
          : null,
      )
      .then(async (result) => {
        const azure = Boolean(result?.azureAvailable);
        const elevenLabs = Boolean(result?.elevenLabsAvailable);
        setAzureAvailable(azure);
        setElevenLabsAvailable(elevenLabs);
        if (elevenLabs && authenticated && /^[a-z]{2,3}$/.test(language)) {
          setElevenLabsVoices([]);
          setElevenLabsError("");
          setElevenLabsLoading(true);
          try {
            const voiceResponse = await fetch(`/api/tts?voices=elevenlabs&language=${language}`, {
              credentials: "include",
              cache: "no-store",
            });
            const voiceData = (await voiceResponse.json()) as {
              voices?: ElevenLabsVoice[];
              error?: string;
            };
            if (!voiceResponse.ok)
              throw new Error(
                canManageSpeechProviders
                  ? voiceResponse.status === 401 || voiceResponse.status === 403
                    ? "ElevenLabs отклонил API-ключ. Проверьте ELEVENLABS_API_KEY в Vercel."
                    : voiceData.error || "Не удалось загрузить голоса ElevenLabs."
                  : "Голоса временно недоступны. Попробуйте позже.",
              );
            const voices = Array.isArray(voiceData.voices) ? voiceData.voices : [];
            setElevenLabsVoices(voices);
            if (!voices.length)
              setElevenLabsError(
                `Для языка «${speechLanguages[language] ?? language}» голоса не найдены.`,
              );
          } catch (error) {
            setElevenLabsError(
              error instanceof Error ? error.message : "Не удалось загрузить голоса ElevenLabs.",
            );
          } finally {
            setElevenLabsLoading(false);
          }
        }
        setSpeechDraft((current) => {
          if (
            current.provider === "azure" &&
            (!azure || !authenticated || !canManageSpeechProviders)
          )
            return {
              ...current,
              provider: fallbackProvider,
              voice: defaultVoiceFor(fallbackProvider, languageCode),
            };
          if (current.provider === "elevenlabs" && (!elevenLabs || !authenticated))
            return {
              ...current,
              provider: configuredVoices.edge[language] ? "edge" : "device",
              voice: defaultVoiceFor(
                configuredVoices.edge[language] ? "edge" : "device",
                languageCode,
              ),
            };
          return current;
        });
      })
      .catch(() => undefined);
    return cleanup;
  }, [authenticated, canManageSpeechProviders, fallbackProvider, language, languageCode]);
  const setProvider = (provider: SpeechProvider) => {
    if (provider === "azure" && !canManageSpeechProviders) return;
    setSpeechDraft((current) => ({
      ...current,
      provider,
      voice:
        provider === "elevenlabs"
          ? (filteredElevenLabsVoices[0]?.id ?? "")
          : defaultVoiceFor(provider, languageCode),
    }));
  };
  const setVoice = (voice: string) => setSpeechDraft((current) => ({ ...current, voice }));
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <p className="eyebrow">LINGUAPLAY</p>
        <h2 id="settings-title">Настройки</h2>
        <label className="field-label">
          Имя · необязательно
          <input
            value={draft.name}
            placeholder="Как к вам обращаться?"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="setting-row">
          <span>
            <strong>Автоматическая озвучка</strong>
            <small>Слово при открытии карточки</small>
          </span>
          <input
            type="checkbox"
            checked={draft.autoSpeak}
            onChange={(event) => setDraft({ ...draft, autoSpeak: event.target.checked })}
          />
        </label>
        <section className="speech-settings">
          <h3>Голос · {speechLanguages[language] ?? languageCode}</h3>
          <label className="field-label">
            Источник
            <select
              value={speechDraft.provider}
              onChange={(event) => setProvider(event.target.value as SpeechProvider)}
            >
              <option value="device">Голос устройства</option>
              <option value="edge" disabled={!configuredVoices.edge[language]}>
                Microsoft Edge Neural
              </option>
              <option value="kokoro" disabled={!canUseKokoro}>
                Kokoro · {canUseKokoro ? "в браузере" : "только EN/FR"}
              </option>
              {(canManageSpeechProviders || (elevenLabsAvailable && authenticated)) && (
                <option value="elevenlabs" disabled={!elevenLabsAvailable || !authenticated}>
                  ElevenLabs
                  {canManageSpeechProviders && !elevenLabsAvailable
                    ? " · нужен ключ"
                    : canManageSpeechProviders && !authenticated
                      ? " · нужен вход"
                      : ""}
                </option>
              )}
              {canManageSpeechProviders && (
                <option value="azure" disabled={!azureAvailable || !authenticated}>
                  Azure Speech
                  {!azureAvailable ? " · нужен ключ" : !authenticated ? " · нужен вход" : ""}
                </option>
              )}
            </select>
          </label>
          {speechDraft.provider === "device" ? (
            <label className="field-label">
              Голос
              <select value={speechDraft.voice} onChange={(event) => setVoice(event.target.value)}>
                <option value="">Автоматически</option>
                {browserVoices.map((voice) => (
                  <option value={voice.voiceURI} key={`${voice.voiceURI}-${voice.lang}`}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              {speechDraft.provider === "elevenlabs" && (
                <div className="elevenlabs-voice-filters">
                  <label className="field-label">
                    Голос
                    <select
                      value={elevenGender}
                      onChange={(event) =>
                        setElevenGender(event.target.value as ElevenLabsGenderFilter)
                      }
                    >
                      <option value="all">Все</option>
                      <option value="female">Женский</option>
                      <option value="male">Мужской</option>
                    </select>
                  </label>
                  <label className="field-label">
                    Возраст
                    <select
                      value={elevenAge}
                      onChange={(event) => setElevenAge(event.target.value as ElevenLabsAgeFilter)}
                    >
                      <option value="all">Любой</option>
                      <option value="young">Молодой</option>
                      <option value="adult">Взрослый</option>
                      <option value="mature">Зрелый</option>
                    </select>
                  </label>
                </div>
              )}
              <label className="field-label">
                {speechDraft.provider === "elevenlabs" ? "Вариант голоса" : "Голос"}
                <select value={voiceValue} onChange={(event) => setVoice(event.target.value)}>
                  <option value="">
                    {speechDraft.provider === "elevenlabs" ? "Выберите голос" : "Автоматически"}
                  </option>
                  {providerVoices.map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {speechDraft.provider === "kokoro" && (
            <small className="field-help">
              Английский и французский · первая загрузка около 100 МБ.
            </small>
          )}
          {speechDraft.provider === "edge" && (
            <small className="field-help">Для воспроизведения нужен интернет.</small>
          )}
          {speechDraft.provider === "elevenlabs" && elevenLabsLoading && (
            <small className="field-help">Загружаю голоса для выбранного языка…</small>
          )}
          {speechDraft.provider === "elevenlabs" && elevenLabsError && (
            <small className="field-help elevenlabs-voice-error">
              {canManageSpeechProviders
                ? elevenLabsError
                : "Голоса временно недоступны. Попробуйте позже."}
            </small>
          )}
          <label className="speech-rate-label">
            Скорость <span>{speechDraft.rate.toFixed(2)}×</span>
            <input
              type="range"
              min="0.55"
              max="1"
              step="0.05"
              value={speechDraft.rate}
              onChange={(event) =>
                setSpeechDraft({ ...speechDraft, rate: Number(event.target.value) })
              }
            />
          </label>
          <div className="speech-settings-actions">
            <button
              className="secondary-button"
              disabled={speechDraft.provider === "elevenlabs" && !voiceValue}
              onClick={() =>
                speakText(
                  selectedSpeechSample,
                  `${language}-${language === "en" ? "US" : language === "fr" ? "FR" : language === "de" ? "DE" : language.toUpperCase()}`,
                  false,
                  { ...speechDraft, voice: voiceValue },
                )
              }
            >
              <Icon name="volume" size={15} /> Проверить голос
            </button>
            {speechDraft.provider === "kokoro" && (
              <HelpHint>
                Голос считает браузер ученика на опубликованном сайте. Для первой загрузки модели
                нужен интернет.
              </HelpHint>
            )}
            {speechDraft.provider === "edge" && (
              <HelpHint>
                Онлайн‑озвучка. Для воспроизведения нужен интернет; доступность голоса может
                меняться.
              </HelpHint>
            )}
            {speechDraft.provider === "elevenlabs" &&
              (canManageSpeechProviders ? (
                <HelpHint>
                  Ключ хранится в Vercel и не попадает в браузер. Для ElevenLabs нужен
                  ELEVENLABS_API_KEY.
                </HelpHint>
              ) : (
                <HelpHint>Онлайн‑озвучка. Для воспроизведения нужен интернет.</HelpHint>
              ))}
            {speechDraft.provider === "azure" && canManageSpeechProviders && (
              <HelpHint>
                Ключ хранится в Vercel и не попадает в браузер. Для Azure нужны ключ Speech и
                регион.
              </HelpHint>
            )}
          </div>
          {speechDraft.provider === "device" && !browserVoices.length && (
            <small className="field-help">
              Голос {speechLanguages[language] ?? languageCode} не найден на устройстве.
            </small>
          )}
        </section>
        <label className="setting-row">
          <span>
            <strong>Контрастный режим</strong>
            <small>Увеличить контраст для демонстрации на экране</small>
          </span>
          <input
            type="checkbox"
            checked={draft.highContrast}
            onChange={(event) => setDraft({ ...draft, highContrast: event.target.checked })}
          />
        </label>
        <button
          className="text-danger"
          onClick={() => {
            if (window.confirm("Удалить сохранённый прогресс? Словарь останется.")) onReset();
          }}
        >
          Сбросить учебный прогресс
        </button>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="primary-button"
            disabled={speechDraft.provider === "elevenlabs" && !voiceValue}
            onClick={() =>
              onSave(
                draft,
                !canManageSpeechProviders && speechDraft.provider === "azure"
                  ? {
                      ...speechDraft,
                      provider: fallbackProvider,
                      voice: defaultVoiceFor(fallbackProvider, languageCode),
                    }
                  : { ...speechDraft, voice: voiceValue },
              )
            }
          >
            Сохранить
          </button>
        </div>
      </section>
    </div>
  );
}

export function StreakDialog({
  streak,
  vacation,
  onToggleVacation,
  onClose,
}: {
  streak: number;
  vacation: boolean;
  onToggleVacation: () => void;
  onClose: () => void;
}) {
  const lastTwo = streak % 100;
  const lastOne = streak % 10;
  const dayLabel =
    lastTwo >= 11 && lastTwo <= 14
      ? "дней"
      : lastOne === 1
        ? "день"
        : lastOne >= 2 && lastOne <= 4
          ? "дня"
          : "дней";
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <div className="streak-hero">
          <span>
            <Icon name="flame" size={26} />
          </span>
          <strong>
            {streak} {dayLabel}
          </strong>
        </div>
        <h2 id="streak-title">Серия занятий</h2>
        <p>
          Серия продлевается после первого ответа за календарный день. Выполните короткое
          упражнение, чтобы продолжить серию.
        </p>
        <label className="setting-row">
          <span>
            <strong>Режим отпуска</strong>
            <small>Пауза для серии без ежедневных напоминаний</small>
          </span>
          <input type="checkbox" checked={vacation} onChange={onToggleVacation} />
        </label>
        <div className="dialog-actions">
          <button className="primary-button" onClick={onClose}>
            Готово
          </button>
        </div>
      </section>
    </div>
  );
}
