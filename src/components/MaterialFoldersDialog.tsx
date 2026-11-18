import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabModule } from "../lib/vocab";
import type { Lesson } from "./Lessons";
import type { GrammarTopic } from "./Games";
import { Icon } from "./Icon";

type MaterialFolder = { id: string; name: string };
type MaterialItem = { id: string; title: string; type: string; meta: string };

function readArray<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch { return []; }
}

function readScopedArray<T>(key: string, scope: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value?.[scope] && Array.isArray(value[scope]) ? value[scope] as T[] : [];
  } catch { return []; }
}

export function MaterialFoldersDialog({ modules, lessons, grammarTopics, spaceId, languageCode, level, onClose }: { modules: VocabModule[]; lessons: Lesson[]; grammarTopics: GrammarTopic[]; spaceId: string; languageCode: string; level: string; onClose: () => void }) {
  const foldersKey = `linguaplay-material-folders:${spaceId}`;
  const assignmentsKey = `linguaplay-material-folder-assignments:${spaceId}`;
  const [folders, setFolders] = useState<MaterialFolder[]>(() => readArray<MaterialFolder>(foldersKey));
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(assignmentsKey) || "{}"); } catch { return {}; }
  });
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const draggedFolder = useRef<string | null>(null);

  useEffect(() => localStorage.setItem(foldersKey, JSON.stringify(folders)), [foldersKey, folders]);
  useEffect(() => localStorage.setItem(assignmentsKey, JSON.stringify(assignments)), [assignmentsKey, assignments]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const items = useMemo<MaterialItem[]>(() => {
    const modulesList = modules.map((module) => ({ id: `module:${module.id}`, title: module.title, type: "Словарь", meta: `${module.cards.length} карточек · модуль ${module.id}` }));
    const activities = readArray<{ id: string; title: string; languageCode: string; level: string; gameId?: string; moduleId?: number; cardIds?: string[] }>("linguaplay-saved-activities")
      .filter((item) => item.languageCode === languageCode && item.level === level)
      .map((item) => ({ id: `activity:${item.id}`, title: item.title, type: "Игра", meta: `Модуль ${item.moduleId ?? "—"} · ${item.cardIds?.length ?? 0} карточек` }));
    const audio = readArray<{ id: string; title: string; languageCode: string; level: string; questions?: unknown[] }>("linguaplay-audio-quizzes")
      .filter((item) => item.languageCode === languageCode && item.level === level)
      .map((item) => ({ id: `audio:${item.id}`, title: item.title, type: "Аудиотест", meta: `${item.questions?.length ?? 0} вопросов` }));
    const grammar = readArray<{ id: string; title: string; languageCode?: string; level?: string; questions?: unknown[] }>("linguaplay-custom-grammar")
      .filter((item) => (item.languageCode ?? "de") === languageCode && (item.level ?? "A1–A2") === level)
      .map((item) => ({ id: `grammar:${item.id}`, title: item.title, type: "Грамматика", meta: `${item.questions?.length ?? 0} упражнений` }));
    const builtInTopics = languageCode === "de" && level === "A1–A2" ? grammarTopics.map((topic) => ({ id: `grammar-builtin:${topic.id}`, title: topic.title, type: "Грамматика", meta: `${topic.questions.length} упражнений · курс` })) : [];
    const lessonItems = lessons.map((lesson) => ({ id: `lesson:${lesson.id}`, title: lesson.title, type: "Урок", meta: `${lesson.chapter} · ${lesson.resources.length} материалов` }));
    return [...modulesList, ...activities, ...audio, ...builtInTopics, ...grammar, ...lessonItems];
  }, [modules, lessons, grammarTopics, languageCode, level]);

  const visibleItems = items.filter((item) => selectedFolder === "all" || (selectedFolder === "unfiled" ? !assignments[item.id] : assignments[item.id] === selectedFolder));
  const folderCounts = (folderId: string) => items.filter((item) => assignments[item.id] === folderId).length;
  const addFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    if (editingFolder) {
      setFolders((current) => current.map((folder) => folder.id === editingFolder ? { ...folder, name } : folder));
      setEditingFolder(null);
    } else {
      const folder = { id: `folder-${Date.now()}`, name };
      setFolders((current) => [...current, folder]);
    }
    setFolderName("");
  };
  const assignItem = (itemId: string, folderId: string) => setAssignments((current) => {
    const next = { ...current };
    if (folderId) next[itemId] = folderId;
    else delete next[itemId];
    return next;
  });
  const deleteFolder = (folder: MaterialFolder) => {
    if (!window.confirm(`Удалить папку «${folder.name}»? Материалы останутся в библиотеке.`)) return;
    setFolders((current) => current.filter((item) => item.id !== folder.id));
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, id]) => id !== folder.id)));
    if (selectedFolder === folder.id) setSelectedFolder("all");
  };

  return <div className="modal-backdrop material-folders-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog-card material-folders-dialog" role="dialog" aria-modal="true" aria-labelledby="material-folders-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
      <p className="eyebrow">МАТЕРИАЛЫ · {languageCode.toLocaleUpperCase()} · {level}</p>
      <h2 id="material-folders-title">Папки материалов</h2>
      <p className="folder-manager-description">Собирайте в папках словари, игры, грамматику, аудиотесты и уроки. Перетаскивайте материалы на папку или назначьте её в списке.</p>
      <div className="folder-manager-create"><label className="field-label">{editingFolder ? "Новое название папки" : "Название новой папки"}<input value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addFolder(); }} placeholder="Например: Повторить на выходных" /></label><button className="primary-button compact" onClick={addFolder} disabled={!folderName.trim()}>{editingFolder ? "Сохранить название" : "Создать папку"}</button>{editingFolder && <button className="secondary-button compact" onClick={() => { setEditingFolder(null); setFolderName(""); }}>Отмена</button>}</div>
      <div className="folder-manager-layout">
        <aside className="folder-manager-sidebar">
          <button className={`folder-filter-row ${selectedFolder === "all" ? "active" : ""}`} onClick={() => setSelectedFolder("all")}><span><Icon name="library" size={17} /> Все материалы</span><small>{items.length}</small></button>
          <button className={`folder-filter-row ${selectedFolder === "unfiled" ? "active" : ""}`} onClick={() => setSelectedFolder("unfiled")}><span><Icon name="inbox" size={17} /> Без папки</span><small>{items.filter((item) => !assignments[item.id]).length}</small></button>
          <div className="folder-sidebar-divider" />
          {folders.map((folder, index) => <div key={folder.id} className={`folder-target ${selectedFolder === folder.id ? "active" : ""}`} draggable onDragStart={(event) => { draggedFolder.current = folder.id; event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const draggedItem = event.dataTransfer.getData("text/plain");
            if (draggedItem.startsWith("material:")) { assignItem(draggedItem.slice("material:".length), folder.id); return; }
            const fromId = draggedFolder.current;
            if (!fromId || fromId === folder.id) return;
            setFolders((current) => { const next = [...current]; const from = next.findIndex((item) => item.id === fromId); const to = next.findIndex((item) => item.id === folder.id); if (from >= 0 && to >= 0) { const [moved] = next.splice(from, 1); next.splice(to, 0, moved); } return next; });
            draggedFolder.current = null;
          }} onDragEnd={() => { draggedFolder.current = null; }}>
            <button className="folder-filter-row" onClick={() => setSelectedFolder(folder.id)}><span><Icon name="folder" size={17} /> {folder.name}</span><small>{folderCounts(folder.id)}</small></button>
            <div className="folder-row-actions"><button aria-label={`Переименовать папку ${folder.name}`} onClick={() => { setEditingFolder(folder.id); setFolderName(folder.name); }}>Переименовать</button><button aria-label={`Удалить папку ${folder.name}`} onClick={() => deleteFolder(folder)}>Удалить</button></div>
          </div>)}
          {!folders.length && <p className="folder-empty-note">Создайте папку, затем добавляйте в неё материалы.</p>}
        </aside>
        <div className="folder-materials-panel">
          <div className="folder-materials-heading"><strong>{selectedFolder === "all" ? "Все материалы" : selectedFolder === "unfiled" ? "Материалы без папки" : folders.find((folder) => folder.id === selectedFolder)?.name}</strong><span>{visibleItems.length}</span></div>
          <div className="folder-material-list">{visibleItems.map((item) => <article key={item.id} className="folder-material-row" draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", `material:${item.id}`); event.dataTransfer.effectAllowed = "move"; }}><span className="folder-material-icon"><Icon name={item.type === "Словарь" ? "library" : item.type === "Игра" ? "game" : item.type === "Аудиотест" ? "headphones" : item.type === "Грамматика" ? "brain" : "book"} size={17} /></span><div><strong>{item.title}</strong><small>{item.type} · {item.meta}</small></div><label className="folder-item-select"><span>Папка</span><select aria-label={`Папка для ${item.title}`} value={assignments[item.id] ?? ""} onChange={(event) => assignItem(item.id, event.target.value)}><option value="">Без папки</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label></article>)}
            {!visibleItems.length && <div className="empty-state folder-no-items"><Icon name="folder" size={26} /><h3>Здесь пока пусто</h3><p>{selectedFolder === "unfiled" ? "Все материалы распределены по папкам." : "Перетащите сюда материал из списка или выберите для него эту папку."}</p></div>}
          </div>
        </div>
      </div>
      <div className="dialog-actions"><button className="primary-button" onClick={onClose}>Готово</button></div>
    </section>
  </div>;
}
