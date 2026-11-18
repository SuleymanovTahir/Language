import { useEffect, useRef, useState } from "react";
import type { VocabModule } from "../lib/vocab";
import { loadMediaFile, removeMediaFile, saveMediaFile } from "../lib/mediaStore";
import { GAME_LIST, type GameId } from "./Games";
import { Icon } from "./Icon";

export type LessonResource = {
  id: string;
  kind: "youtube" | "link" | "video" | "image" | "audio" | "file" | "test" | "game";
  title: string;
  url?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  moduleId?: number;
  gameId?: GameId;
};

export type Lesson = {
  id: string;
  chapter: string;
  title: string;
  description: string;
  resources: LessonResource[];
};

function youtubeId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLocaleLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return host === "youtu.be" ? parts[0] : url.searchParams.get("v") || parts[parts.length - 1];
    }
  } catch { /* invalid URLs are handled by the caller */ }
  return null;
}

function validWebUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}

export function LessonDialog({ chapter, initial, modules, onSave, onClose }: { chapter: string; initial?: Lesson; modules: VocabModule[]; onSave: (lesson: Lesson) => void; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [resources, setResources] = useState<LessonResource[]>(initial?.resources ?? []);
  const [link, setLink] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [activityModuleId, setActivityModuleId] = useState(modules[0]?.id ?? 0);
  const [activityType, setActivityType] = useState<"test" | "game">("test");
  const [activityGameId, setActivityGameId] = useState<GameId>("pairs");
  const activityModule = modules.find((module) => module.id === activityModuleId);
  const lessonGames = GAME_LIST.filter((game) => activityModule?.languageCode === "de" || !["articles", "builder", "train", "finalsound", "datajoin"].includes(game.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const newMedia = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const discardNewFiles = () => {
    const existing = new Set(initial?.resources.map((resource) => resource.mediaId).filter(Boolean));
    newMedia.current.filter((id) => !existing.has(id)).forEach((id) => { void removeMediaFile(id); });
    newMedia.current = [];
  };
  const close = () => { discardNewFiles(); onClose(); };
  const addLink = () => {
    const raw = link.trim();
    if (!validWebUrl(raw)) { setError("Введите ссылку, начинающуюся с http:// или https://."); return; }
    const videoId = youtubeId(raw);
    setResources((current) => [...current, { id: `resource-${Date.now()}`, kind: videoId ? "youtube" : "link", title: linkTitle.trim() || (videoId ? "Видео YouTube" : "Внешняя ссылка"), url: raw }]);
    setLink(""); setLinkTitle(""); setError("");
  };
  const addActivity = () => {
    const module = modules.find((item) => item.id === activityModuleId);
    if (!module) { setError("В этом языковом кабинете пока нет модулей для задания."); return; }
    const game = GAME_LIST.find((item) => item.id === activityGameId);
    setResources((current) => [...current, {
      id: `resource-${Date.now()}`,
      kind: activityType,
      title: activityType === "test" ? `Тест · ${module.title}` : `${game?.title ?? "Игра"} · ${module.title}`,
      moduleId: module.id,
      ...(activityType === "game" ? { gameId: activityGameId } : {}),
    }]);
  };
  const addFile = async (file?: File) => {
    if (!file) return;
    const kind: LessonResource["kind"] = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file";
    const maxSize = kind === "video" ? 250 : kind === "image" ? 30 : kind === "audio" ? 60 : 100;
    if (file.size > maxSize * 1024 * 1024) { setError(`Файл слишком большой. Максимальный размер для этого типа — ${maxSize} МБ.`); return; }
    if (kind === "file" && !file.type && !/\.(pdf|txt|docx?|pptx?)$/i.test(file.name)) { setError("Поддерживаются видео, изображения, аудио, PDF, TXT, DOC и PPT."); return; }
    const id = `lesson-file-${crypto.randomUUID?.() ?? Date.now()}`;
    setBusy(true); setError("");
    try {
      await saveMediaFile(id, file);
      newMedia.current.push(id);
      setResources((current) => [...current, { id: `resource-${Date.now()}`, kind, title: file.name, fileName: file.name, mimeType: file.type || "application/octet-stream", mediaId: id }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить файл в этом браузере.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const save = async () => {
    if (!title.trim() || busy) return;
    const kept = new Set(resources.map((resource) => resource.mediaId).filter(Boolean));
    for (const resource of initial?.resources ?? []) if (resource.mediaId && !kept.has(resource.mediaId)) await removeMediaFile(resource.mediaId).catch(() => undefined);
    newMedia.current = [];
    onSave({ id: initial?.id ?? `lesson-${Date.now()}`, chapter, title: title.trim(), description: description.trim(), resources });
  };

  return <div className="modal-backdrop lesson-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="dialog-card lesson-editor" role="dialog" aria-modal="true" aria-labelledby="lesson-editor-title">
    <button className="dialog-close" onClick={close} aria-label="Закрыть"><Icon name="close" /></button>
    <p className="eyebrow">УРОК · {chapter}</p><h2 id="lesson-editor-title">{initial ? "Изменить урок" : "Новый урок"}</h2>
    <label className="field-label">Название урока<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Личные местоимения" autoFocus /></label>
    <label className="field-label">Краткое описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Что ученик узнает или потренирует" /></label>
    <section className="lesson-resource-editor"><div className="section-title"><div><h3>Материалы урока</h3><p>Добавьте видео, картинку, аудио, файл или внешнюю ссылку.</p></div></div>
      <div className="lesson-activity-fields"><div className="section-title"><div><h3>Задание из кабинета</h3><p>Прикрепите тест или игру по выбранному модулю. Ученик запустит их прямо из урока.</p></div></div><div className="lesson-activity-controls"><label className="field-label">Тип задания<select value={activityType} onChange={(event) => setActivityType(event.target.value as "test" | "game")}><option value="test">Тест по словам</option><option value="game">Игра</option></select></label><label className="field-label">Модуль<select value={activityModuleId} onChange={(event) => { const nextId = Number(event.target.value); const nextModule = modules.find((module) => module.id === nextId); setActivityModuleId(nextId); if (nextModule?.languageCode !== "de" && ["articles", "builder", "train", "finalsound", "datajoin"].includes(activityGameId)) setActivityGameId("pairs"); }}>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>{activityType === "game" && <label className="field-label">Сценарий игры<select value={activityGameId} onChange={(event) => setActivityGameId(event.target.value as GameId)}>{lessonGames.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label>}<button className="secondary-button" onClick={addActivity} disabled={!modules.length}>Добавить задание</button></div></div>
      <div className="lesson-link-fields"><label className="field-label">Ссылка YouTube, Wordwall или сайт<input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" /></label><label className="field-label">Подпись к ссылке<input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder="Например, объяснение темы" /></label><button className="secondary-button" onClick={addLink}>Добавить ссылку</button></div>
      <div className="lesson-upload-row"><button className="secondary-button" onClick={() => fileInput.current?.click()} disabled={busy}><Icon name="plus" size={16} />{busy ? "Сохраняю файл…" : "Загрузить видео, изображение, аудио или документ"}</button><input ref={fileInput} type="file" accept="video/*,image/*,audio/*,.pdf,.txt,.doc,.docx,.ppt,.pptx" onChange={(event) => void addFile(event.target.files?.[0])} /></div>
      {error && <p className="lesson-error" role="alert">{error}</p>}
      {resources.length > 0 ? <div className="lesson-resource-list">{resources.map((resource) => <article key={resource.id}><span className={`lesson-resource-icon ${resource.kind}`}><Icon name={resource.kind === "video" || resource.kind === "youtube" || resource.kind === "game" ? "game" : resource.kind === "image" ? "spark" : resource.kind === "audio" ? "headphones" : "library"} size={17} /></span><div><strong>{resource.title}</strong><small>{resource.kind === "youtube" ? "Видео YouTube" : resource.kind === "link" ? "Внешняя ссылка" : resource.kind === "video" ? "Видео в уроке" : resource.kind === "image" ? "Изображение · можно развернуть на весь экран" : resource.kind === "audio" ? "Аудиофайл" : resource.kind === "test" ? "Тест · запускается из урока" : resource.kind === "game" ? "Игра · запускается из урока" : "Файл"}</small></div><button className="text-danger" onClick={() => setResources((current) => current.filter((item) => item.id !== resource.id))}>Убрать</button></article>)}</div> : <p className="empty-inline">Пока нет материалов. Добавьте ссылку, файл или задание по модулю.</p>}
    </section>
    <div className="dialog-actions"><button className="secondary-button" onClick={close}>Отмена</button><button className="primary-button" disabled={!title.trim() || busy} onClick={() => void save()}>{initial ? "Сохранить изменения" : "Создать урок"}</button></div>
  </section></div>;
}

export function LessonViewer({ lesson, onClose, onStartResource }: { lesson: Lesson; onClose: () => void; onStartResource: (resource: LessonResource) => void }) {
  const [selectedId, setSelectedId] = useState(lesson.resources[0]?.id ?? "");
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");
  const [fullImage, setFullImage] = useState(false);
  const selected = lesson.resources.find((resource) => resource.id === selectedId) ?? lesson.resources[0];
  const resourceKey = selected?.mediaId ?? "";

  useEffect(() => {
    let created = "";
    let alive = true;
    setFileUrl(""); setError("");
    if (resourceKey) void loadMediaFile(resourceKey).then((blob) => {
      if (!alive) return;
      if (!blob) { setError("Файл не найден в хранилище этого браузера. Добавьте его в урок заново."); return; }
      created = URL.createObjectURL(blob); setFileUrl(created);
    }).catch(() => { if (alive) setError("Не удалось открыть файл."); });
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [resourceKey]);

  useEffect(() => {
    if (!fullImage) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFullImage(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullImage]);

  const videoId = selected?.kind === "youtube" && selected.url ? youtubeId(selected.url) : null;
  const content = !selected ? <p className="empty-inline">В этом уроке пока нет материалов.</p>
    : (selected.kind === "test" || selected.kind === "game") ? <div className="lesson-activity-launch"><span>{selected.kind === "test" ? "📝" : "🎮"}</span><h3>{selected.title}</h3><p>{selected.kind === "test" ? "Ответьте на вопросы по словам выбранного модуля." : "Откройте игру по словам выбранного модуля."}</p><button className="primary-button" onClick={() => onStartResource(selected)}>Начать {selected.kind === "test" ? "тест" : "игру"}<Icon name="arrow" size={17} /></button></div>
    : selected.kind === "youtube" && videoId ? <div className="lesson-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div>
    : selected.kind === "video" && fileUrl ? <video className="lesson-local-video" src={fileUrl} controls playsInline preload="metadata" />
    : selected.kind === "image" && fileUrl ? <button className="lesson-image-button" onClick={() => setFullImage(true)} aria-label="Открыть изображение на весь экран"><img src={fileUrl} alt={selected.title} /><span>Открыть на весь экран</span></button>
    : selected.kind === "audio" && fileUrl ? <audio className="lesson-audio-player" src={fileUrl} controls />
    : selected.kind === "file" && fileUrl ? <div className="lesson-file-open"><p>{selected.fileName}</p><a className="primary-button" href={fileUrl} download={selected.fileName}>Скачать файл</a>{selected.mimeType === "application/pdf" && <iframe title={selected.title} src={fileUrl} />}</div>
    : selected.url ? <div className="lesson-external-link"><p>Этот материал откроется на внешнем сайте.</p><a className="primary-button" href={selected.url} target="_blank" rel="noreferrer">Открыть ссылку <Icon name="arrow" size={16} /></a></div>
    : <p className="lesson-error">{error || "Не удалось открыть этот материал."}</p>;

  return <div className="lesson-viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="lesson-viewer" role="dialog" aria-modal="true" aria-labelledby="lesson-viewer-title"><header><div><p className="eyebrow">УРОК · {lesson.chapter}</p><h2 id="lesson-viewer-title">{lesson.title}</h2></div><button className="dialog-close" onClick={onClose} aria-label="Закрыть урок"><Icon name="close" /></button></header>{lesson.description && <p className="lesson-viewer-description">{lesson.description}</p>}
    <div className="lesson-viewer-body">{lesson.resources.length > 1 && <nav className="lesson-resource-nav" aria-label="Материалы урока">{lesson.resources.map((resource) => <button className={selected?.id === resource.id ? "active" : ""} key={resource.id} onClick={() => setSelectedId(resource.id)}>{resource.title}</button>)}</nav>}<div className="lesson-media-stage">{error && <p className="lesson-error">{error}</p>}{content}</div></div>
    </section>{fullImage && selected && fileUrl && <div className="lesson-image-fullscreen" role="dialog" aria-modal="true" aria-label="Изображение на весь экран" onClick={(event) => { if (event.target === event.currentTarget) setFullImage(false); }}><button aria-label="Закрыть полноэкранный просмотр" onClick={() => setFullImage(false)}><Icon name="close" /></button><img src={fileUrl} alt={selected.title} /></div>}</div>;
}
