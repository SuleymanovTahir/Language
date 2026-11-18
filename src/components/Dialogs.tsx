import { useMemo, useRef, useState } from "react";
import { parseVocabulary, type VocabCard, type VocabModule } from "../lib/vocab";
import { Icon } from "./Icon";

export type LearningSpace = { id: string; languageCode: string; languageName: string; flag: string; level: string; nativeLanguageCode: string };

const supportedLanguages = [
  { code: "de", name: "Немецкий", flag: "DE" }, { code: "en", name: "Английский", flag: "EN" },
  { code: "es", name: "Испанский", flag: "ES" }, { code: "fr", name: "Французский", flag: "FR" },
  { code: "it", name: "Итальянский", flag: "IT" }, { code: "tr", name: "Турецкий", flag: "TR" },
];

export function LearningSpaceDialog({ spaces, activeId, onSelect, onCreate, onClose }: { spaces: LearningSpace[]; activeId: string; onSelect: (id: string) => void; onCreate: (space: LearningSpace) => void; onClose: () => void }) {
  const [languageCode, setLanguageCode] = useState("en");
  const [level, setLevel] = useState("A1–A2");
  const selectedLanguage = supportedLanguages.find((language) => language.code === languageCode) ?? supportedLanguages[0];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog-card space-dialog" role="dialog" aria-modal="true" aria-labelledby="space-title">
    <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">УЧЕБНЫЕ КАБИНЕТЫ</p><h2 id="space-title">Язык и уровень</h2><p>У каждого кабинета свой словарь, игры, грамматика и прогресс.</p>
    <div className="space-list">{spaces.map((space) => <button key={space.id} className={space.id === activeId ? "active" : ""} onClick={() => { onSelect(space.id); onClose(); }}><span className="flag">{space.flag}</span><span><strong>{space.languageName}</strong><small>Уровень {space.level}</small></span>{space.id === activeId && <Icon name="check" size={17} />}</button>)}</div>
    <div className="space-create"><h3>Добавить язык или уровень</h3><div className="space-fields"><label className="field-label">Язык<select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}>{supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label><label className="field-label">Уровень<select value={level} onChange={(event) => setLevel(event.target.value)}>{["A1–A2", "A1", "A2", "B1", "B2", "C1", "C2"].map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="primary-button" onClick={() => { const existing = spaces.find((space) => space.languageCode === languageCode && space.level === level); const space = existing ?? { id: `${languageCode}-${level}-${Date.now()}`, languageCode, languageName: selectedLanguage.name, flag: selectedLanguage.flag, level, nativeLanguageCode: "ru" }; if (!existing) onCreate(space); onSelect(space.id); onClose(); }}>{spaces.some((space) => space.languageCode === languageCode && space.level === level) ? "Открыть этот кабинет" : "Создать отдельный кабинет"} <Icon name="arrow" /></button></div>
  </section></div>;
}

export function CreateModuleDialog({ onClose, onCreate, languageName, level }: { onClose: () => void; onCreate: (title: string, cards: VocabCard[]) => void; languageName: string; level: string }) {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const preview = useMemo(() => parseVocabulary(rawText, 1000, title || "Мой модуль"), [rawText, title]);
  const loadFile = (file?: File) => {
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && !file.type.startsWith("text/")) {
      setError("Для импорта выберите текстовый файл .txt.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setRawText(String(reader.result || "")); setError(""); };
    reader.onerror = () => setError("Не удалось прочитать файл.");
    reader.readAsText(file, "UTF-8");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog-card import-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
      <p className="eyebrow">{languageName.toLocaleUpperCase()} · {level}</p><h2 id="create-title">Создать модуль</h2><p>Добавьте слова для текущего учебного кабинета. Каждая строка: «слово — перевод». Можно добавить произношение в квадратных скобках.</p>
      <label className="field-label">Название модуля<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Путешествия" autoFocus /></label>
      <label className="import-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}>
        <Icon name="plus" /><strong>Перетащите .txt или выберите файл</strong><span>Обе стороны словаря автоматически объединяются</span>
        <input type="file" accept=".txt,text/plain" onChange={(event) => loadFile(event.target.files?.[0])} />
      </label>
        <label className="field-label">Или вставьте текст словаря<textarea value={rawText} onChange={(event) => { setRawText(event.target.value); setError(""); }} rows={7} placeholder={'der Tisch [тиш] - стол\ngehen [геен] - идти'} /></label>
      <div className="import-summary"><span>{preview.length} уникальных карточек</span><span>{preview.filter((card) => card.article).length} слов с артиклем</span></div>
      {preview.length > 0 && <div className="import-preview">{preview.slice(0, 4).map((card) => <div key={card.id}><strong>{card.article ? `${card.article} ` : ""}{card.word}</strong><span>{card.translation}</span></div>)}{preview.length > 4 && <small>и ещё {preview.length - 4}</small>}</div>}
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={!title.trim() || preview.length === 0} onClick={() => onCreate(title.trim(), preview)}>Добавить модуль <Icon name="arrow" /></button></div>
    </section>
  </div>;
}

export function EditModuleDialog({ module, onClose, onSave }: { module: VocabModule; onClose: () => void; onSave: (title: string, cards: VocabCard[]) => void }) {
  const [title, setTitle] = useState(module.title);
  const [cards, setCards] = useState(() => module.cards.map((card) => ({ ...card })));
  const draggedIndex = useRef<number | null>(null);
  const updateCard = (index: number, patch: Partial<VocabCard>) => setCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card));
  const move = (from: number, to: number) => setCards((current) => { if (to < 0 || to >= current.length) return current; const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const addCard = () => setCards((current) => [...current, { id: `draft-${Date.now()}`, moduleId: module.id, word: "", article: null, transcription: "", translation: "", partOfSpeech: "other", phoneticRuleId: null }]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog-card edit-module-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-module-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">РЕДАКТОР МОДУЛЯ · {module.languageName} {module.level}</p><h2 id="edit-module-title">Изменить материалы</h2><label className="field-label">Название<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><p className="editor-hint">Перетаскивайте строки или используйте стрелки, чтобы изменить порядок. Карточки можно править и удалять.</p><div className="editable-cards">{cards.map((card, index) => <article key={card.id} draggable onDragStart={() => { draggedIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex.current !== null) move(draggedIndex.current, index); draggedIndex.current = null; }}><span className="drag-handle" aria-label="Перетащить">⠿</span><div className="editable-card-fields"><label>Язык<input value={card.word} onChange={(event) => updateCard(index, { word: event.target.value })} /></label>{module.languageCode === "de" && <label>Артикль<select value={card.article ?? ""} onChange={(event) => updateCard(index, { article: (event.target.value || null) as VocabCard["article"] })}><option value="">—</option><option>der</option><option>die</option><option>das</option></select></label>}<label>Транскрипция<input value={card.transcription.replace(/^\[|\]$/g, "")} onChange={(event) => updateCard(index, { transcription: event.target.value ? `[${event.target.value.replace(/^\[|\]$/g, "")}]` : "" })} /></label><label>Перевод<input value={card.translation} onChange={(event) => updateCard(index, { translation: event.target.value })} /></label></div><div className="editable-card-actions"><button onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Поднять карточку ${index + 1}`}>↑</button><button onClick={() => move(index, index + 1)} disabled={index === cards.length - 1} aria-label={`Опустить карточку ${index + 1}`}>↓</button><button className="delete-card-button" onClick={() => setCards((current) => current.filter((_, cardIndex) => cardIndex !== index))} aria-label={`Удалить карточку ${index + 1}`}>×</button></div></article>)}</div><button className="secondary-button add-card-button" onClick={addCard}><Icon name="plus" size={15} /> Добавить карточку</button><div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={!title.trim() || !cards.length || cards.some((card) => !card.word.trim() || !card.translation.trim())} onClick={() => onSave(title.trim(), cards)}>Сохранить модуль</button></div></section></div>;
}

export type Preferences = { autoSpeak: boolean; highContrast: boolean; name: string; dailyGoal: number };

export function SettingsDialog({ value, onSave, onClose, onReset }: { value: Preferences; onSave: (next: Preferences) => void; onClose: () => void; onReset: () => void }) {
  const [draft, setDraft] = useState(value);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">LINGUAPLAY</p><h2 id="settings-title">Настройки</h2>
    <label className="field-label">Имя<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label className="field-label">Дневная цель<select value={draft.dailyGoal} onChange={(event) => setDraft({ ...draft, dailyGoal: Number(event.target.value) })}><option value={20}>20 XP · спокойно</option><option value={50}>50 XP · стандарт</option><option value={100}>100 XP · интенсивно</option></select></label>
    <label className="setting-row"><span><strong>Автоматическая озвучка</strong><small>Озвучивать немецкое слово при открытии карточки</small></span><input type="checkbox" checked={draft.autoSpeak} onChange={(event) => setDraft({ ...draft, autoSpeak: event.target.checked })} /></label>
    <label className="setting-row"><span><strong>Контрастный режим</strong><small>Увеличить контраст для демонстрации на экране</small></span><input type="checkbox" checked={draft.highContrast} onChange={(event) => setDraft({ ...draft, highContrast: event.target.checked })} /></label>
    <button className="text-danger" onClick={() => { if (window.confirm("Удалить сохранённый прогресс? Словарь останется.")) onReset(); }}>Сбросить учебный прогресс</button>
    <div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" onClick={() => onSave(draft)}>Сохранить</button></div>
  </section></div>;
}

export function StreakDialog({ streak, crystals, freezeCount, vacation, onBuyFreeze, onToggleVacation, onClose }: { streak: number; crystals: number; freezeCount: number; vacation: boolean; onBuyFreeze: () => void; onToggleVacation: () => void; onClose: () => void }) {
  const lastTwo = streak % 100;
  const lastOne = streak % 10;
  const dayLabel = lastTwo >= 11 && lastTwo <= 14 ? "дней" : lastOne === 1 ? "день" : lastOne >= 2 && lastOne <= 4 ? "дня" : "дней";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="streak-title">
    <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button><div className="streak-hero"><span><Icon name="flame" size={26} /></span><strong>{streak} {dayLabel}</strong></div><h2 id="streak-title">Серия занятий</h2><p>Серия продлевается после первого ответа за календарный день. Заморозка защищает её в день без занятий.</p>
    <div className="streak-actions"><div><strong>{freezeCount} заморозок</strong><small>Стоимость следующей — 200 кристаллов · у вас {crystals}</small></div><button className="secondary-button" disabled={crystals < 200} onClick={onBuyFreeze}>Купить за 200</button></div>
    <label className="setting-row"><span><strong>Режим отпуска</strong><small>Пауза для серии без ежедневных напоминаний</small></span><input type="checkbox" checked={vacation} onChange={onToggleVacation} /></label>
    <div className="dialog-actions"><button className="primary-button" onClick={onClose}>Готово</button></div>
  </section></div>;
}
