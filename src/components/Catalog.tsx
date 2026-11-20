import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { copyAppLink } from "../lib/shareLink";
import { modules, scenarioModules } from "../lib/vocab";
import { GERMAN_COURSE } from "../data/germanCourse";
import { LearningTrail } from "./LearningTrail";

export type CatalogItem = {
  id: string;
  kind: string;
  languageCode: string;
  level: string;
  topic: string;
  title: string;
  body: Record<string, unknown>;
  status: "draft" | "published" | "archived";
  updatedAt?: string;
  readOnly?: boolean;
};
export type CatalogSeed = {
  kind: string;
  languageCode: string;
  level: string;
  topic?: string;
  title: string;
  body: Record<string, unknown>;
};
type CatalogShare = {
  id: number;
  content_id: string;
  title: string;
  expires_at: string;
  max_views: number;
  view_count: number;
  revoked_at: string | null;
  created_at: string;
};
const kindNames: Record<string, string> = {
  module: "Словарь",
  lesson: "Урок",
  activity: "Задание",
  audio_quiz: "Аудиотест",
  grammar: "Грамматика",
  mission: "Миссия",
};
const blank = (languageCode: string, level: string): CatalogItem => ({
  id: "",
  kind: "lesson",
  languageCode,
  level,
  topic: "",
  title: "",
  body: { description: "", objectives: [], estimated_seconds: 300, skills: [], steps: [] },
  status: "draft",
});
const friendlyModuleTitles: Record<number, string> = {
  1: "Знакомство и личные местоимения",
  2: "Желания, возможности и обязанности",
  3: "Простые вопросы и ответы",
  4: "Мнения и объяснения",
  5: "Числа и количество",
  6: "Дни недели и части суток",
  7: "Даты и как часто",
  8: "Месяцы и времена года",
  9: "Семья и родственники",
  10: "Друзья, соседи и характер",
  11: "Эмоции и самочувствие",
  12: "Как добраться и куда идти",
  13: "Покупки и оплата",
  14: "В кафе: еда и напитки",
  15: "Продукты и покупки",
  16: "Овощи и фрукты",
  17: "Городские места и адреса",
  18: "Транспорт и поездки",
  19: "Дом и комнаты",
  20: "Расположение вещей",
  21: "Кухня и посуда",
  22: "Ванная, сон и уборка",
  23: "Аренда и коммунальные платежи",
  24: "Досуг и свободное время",
  25: "Здоровье и визит к врачу",
  26: "Части тела",
  27: "Профессии и работа",
  28: "Офис и рабочие задачи",
  29: "Поиск работы и договоры",
  30: "Учёба и занятия",
  31: "Банк и документы",
  32: "Одежда и цвета",
  33: "Погода",
  34: "Природа и животные",
  35: "Программирование",
  36: "IT-системы",
  37: "Базы данных и таблицы",
  38: "Статистика и отчёты",
  39: "Бизнес-анализ и требования",
};
const moduleIdByTitle = new Map(
  [...modules, ...scenarioModules].map((module) => [module.title, module.id]),
);
const catalogGroups = [
  "Первые разговоры",
  "Время и планы",
  "Люди вокруг",
  "Городская жизнь",
  "Дом и быт",
  "Дела и работа",
  "Учёба и мир вокруг",
  "Немецкий для работы и IT",
  "Путешествия и профессии",
  "Мои наборы",
];
function catalogModuleGroup(id: number) {
  if (id >= 1000) return "Мои наборы";
  if (id >= 200) return "Путешествия и профессии";
  if (id <= 4) return "Первые разговоры";
  if (id <= 8) return "Время и планы";
  if (id <= 11) return "Люди вокруг";
  if (id <= 18) return "Городская жизнь";
  if (id <= 23) return "Дом и быт";
  if (id <= 29) return "Дела и работа";
  if (id <= 34) return "Учёба и мир вокруг";
  return "Немецкий для работы и IT";
}
function catalogSection(item: CatalogItem) {
  if (item.kind === "module") {
    const fromId = item.id.match(/^builtin:module:(\d+)$/)?.[1];
    const moduleId = fromId ? Number(fromId) : moduleIdByTitle.get(item.title);
    return catalogModuleGroup(moduleId ?? 1000);
  }
  if (item.kind === "lesson") return `Учебный путь · ${item.level}`;
  return kindNames[item.kind] ?? "Другие материалы";
}
function catalogTitle(item: CatalogItem) {
  if (item.kind !== "module") return item.title;
  const fromId = item.id.match(/^builtin:module:(\d+)$/)?.[1];
  const moduleId = fromId ? Number(fromId) : moduleIdByTitle.get(item.title);
  return (moduleId && friendlyModuleTitles[moduleId]) || item.title;
}

export function CatalogScreen({
  languageCode,
  level,
  canManageContent,
  legacyItems = [],
}: {
  languageCode: string;
  level: string;
  canManageContent: boolean;
  legacyItems?: CatalogSeed[];
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<CatalogItem | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [working, setWorking] = useState(false);
  const [shared, setShared] = useState<CatalogItem | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shares, setShares] = useState<CatalogShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const builtInItems = useMemo<CatalogItem[]>(() => {
    const vocab = [...modules, ...scenarioModules].map((module) => ({
      id: `builtin:module:${module.id}`,
      kind: "module",
      languageCode: module.languageCode,
      level: module.level,
      topic: "Лексика",
      title: module.title,
      body: {
        description: `Словарь немецкого языка · ${module.cards.length} слов.`,
        objectives: ["Запомнить слова и перевод", "Повторять произношение и род существительных"],
        estimated_seconds: Math.max(300, module.cards.length * 45),
        cards: module.cards.map((card) => ({
          word: card.word,
          article: card.article,
          translation: card.translation,
          transcription: card.transcription,
        })),
      },
      status: "published" as const,
      readOnly: true,
    }));
    const course = GERMAN_COURSE.map((unit) => ({
      id: `builtin:lesson:${unit.id}`,
      kind: "lesson",
      languageCode: "de",
      level: unit.level,
      topic: unit.grammarTitle,
      title: unit.title,
      body: {
        description: unit.outcome,
        objectives: [unit.grammarTitle, ...unit.vocabulary.slice(0, 3)],
        estimated_seconds: 1200,
        steps: [unit.theory, unit.dialogue, unit.reading, unit.speakingPrompt, unit.writingPrompt],
      },
      status: "published" as const,
      readOnly: true,
    }));
    return [...vocab, ...course];
  }, []);
  const fallbackItems = useMemo(() => {
    const normalizedLevel = level.replace("–", "-");
    return builtInItems.filter((item) => {
      if (item.languageCode !== languageCode) return false;
      const itemLevel = item.level.replace("–", "-");
      if (normalizedLevel === "A1-A2") return ["A1-A2", "A1", "A2"].includes(itemLevel);
      if (languageCode === "de" && ["A1", "A2"].includes(normalizedLevel))
        return itemLevel === normalizedLevel || itemLevel === "A1-A2";
      return itemLevel === normalizedLevel;
    });
  }, [builtInItems, languageCode, level]);
  const sections = useMemo(() => {
    const grouped = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const title = catalogSection(item);
      const rows = grouped.get(title) ?? [];
      rows.push(item);
      grouped.set(title, rows);
    }
    return [...grouped.entries()]
      .map(([title, rows]) => ({
        title,
        items: rows.sort((a, b) => {
          const aModule = a.id.match(/^builtin:module:(\d+)$/)?.[1];
          const bModule = b.id.match(/^builtin:module:(\d+)$/)?.[1];
          if (aModule && bModule) return Number(aModule) - Number(bModule);
          const aLesson = GERMAN_COURSE.findIndex((unit) => a.id === `builtin:lesson:${unit.id}`);
          const bLesson = GERMAN_COURSE.findIndex((unit) => b.id === `builtin:lesson:${unit.id}`);
          if (aLesson >= 0 && bLesson >= 0) return aLesson - bLesson;
          return a.title.localeCompare(b.title, "ru");
        }),
      }))
      .sort((a, b) => {
        const aGroup = catalogGroups.indexOf(a.title);
        const bGroup = catalogGroups.indexOf(b.title);
        if (aGroup >= 0 || bGroup >= 0)
          return (aGroup < 0 ? catalogGroups.length : aGroup) - (bGroup < 0 ? catalogGroups.length : bGroup);
        return a.title.localeCompare(b.title, "ru");
      });
  }, [items]);
  const hashQuery =
    typeof window === "undefined" ? "" : window.location.hash.split("?").slice(1).join("?");
  const shareToken = useMemo(() => new URLSearchParams(hashQuery).get("share") ?? "", [hashQuery]);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ language: languageCode, level });
      if (canManageContent) params.set("preview", "1");
      const response = await fetch(`/api/content?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        if (import.meta.env.DEV) {
          setItems([
            ...legacyItems.map((item, index) => ({
              ...item,
              id: `local-${index}`,
              topic: item.topic ?? "",
              status: "published" as const,
            })),
            ...fallbackItems,
          ]);
          return;
        }
        throw new Error("Каталог временно недоступен.");
      }
      const data = (await response.json()) as { items?: CatalogItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить каталог.");
      const published = data.items ?? [];
      const existing = new Set(
        published.map((item) => `${item.kind}:${item.languageCode}:${item.level}:${item.title.toLocaleLowerCase()}`),
      );
      setItems([
        ...published,
        ...fallbackItems.filter(
          (item) =>
            !existing.has(
              `${item.kind}:${item.languageCode}:${item.level}:${item.title.toLocaleLowerCase()}`,
            ),
        ),
      ]);
    } catch (cause) {
      setItems(fallbackItems);
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить каталог.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [languageCode, level, canManageContent, fallbackItems]);
  const loadShares = async () => {
    if (!canManageContent) return;
    setSharesLoading(true);
    try {
      const response = await fetch("/api/content-share?manage=1", {
        credentials: "include",
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json") && import.meta.env.DEV) {
        setShares([]);
        return;
      }
      const result = (await response.json()) as { shares?: CatalogShare[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить ссылки.");
      setShares(result.shares ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить ссылки.");
    } finally {
      setSharesLoading(false);
    }
  };
  useEffect(() => {
    if (canManageContent) void loadShares();
  }, [canManageContent]);
  useEffect(() => {
    if (!shareToken) {
      setShared(null);
      return;
    }
    let alive = true;
    setShareLoading(true);
    void fetch("/api/content-share", {
      headers: { "X-Content-Share-Token": shareToken },
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { item?: CatalogItem; error?: string };
        if (!response.ok) throw new Error(data.error || "Ссылка недействительна.");
        if (alive) setShared(data.item ?? null);
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "Ссылка недействительна.");
      })
      .finally(() => {
        if (alive) setShareLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shareToken]);
  const startEdit = (item?: CatalogItem) => {
    const value = item ?? blank(languageCode, level);
    setDraft(value);
    setBodyText(JSON.stringify(value.body, null, 2));
    setError("");
  };
  const save = async (target?: CatalogItem, status?: CatalogItem["status"]) => {
    const source = target ?? draft;
    if (!source) return;
    let body: Record<string, unknown>;
    if (target) body = target.body;
    else
      try {
        const parsed: unknown = JSON.parse(bodyText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        body = parsed as Record<string, unknown>;
      } catch {
        setError("Содержимое должно быть корректным JSON объектом.");
        return;
      }
    setWorking(true);
    setError("");
    try {
      const payload = { ...source, status: status ?? source.status, body };
      const response = await fetch(
        source.id ? `/api/content?id=${encodeURIComponent(source.id)}` : "/api/content",
        {
          method: source.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { item?: CatalogItem; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить материал.");
      if (result.item)
        setItems((current) => [
          result.item!,
          ...current.filter((item) => item.id !== result.item!.id),
        ]);
      setDraft(null);
      setNotice(
        payload.status === "published"
          ? "Материал опубликован и доступен ученикам."
          : "Черновик сохранён.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить материал.");
    } finally {
      setWorking(false);
    }
  };
  const importSeed = async (seed: CatalogSeed) => {
    if (items.some((item) => item.title === seed.title && item.kind === seed.kind)) {
      setNotice("Материал с таким названием уже есть в каталоге.");
      return;
    }
    setDraft({ ...blank(seed.languageCode, seed.level), ...seed, id: "", status: "draft" });
    setBodyText(JSON.stringify(seed.body, null, 2));
    setNotice("Проверьте содержимое и сохраните его как черновик.");
  };
  const archive = async (item: CatalogItem) => {
    if (
      !window.confirm(`Архивировать «${item.title}»? Уже сохранённый прогресс учеников останется.`)
    )
      return;
    setWorking(true);
    try {
      const response = await fetch(`/api/content?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось архивировать материал.");
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось архивировать материал.");
    } finally {
      setWorking(false);
    }
  };
  const createShare = async (item: CatalogItem) => {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/content-share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: item.id, days: 7, maxViews: 3 }),
      });
      const result = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !result.token)
        throw new Error(result.error || "Не удалось создать ссылку.");
      const copied = await copyAppLink(`catalog?share=${encodeURIComponent(result.token)}`);
      void loadShares();
      setNotice(
        copied
          ? "Одноразовая ссылка скопирована: действует 7 дней и до 3 просмотров."
          : "Ссылка создана, но буфер обмена недоступен. Повторите попытку.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку.");
    } finally {
      setWorking(false);
    }
  };
  const revokeShare = async (share: CatalogShare) => {
    if (!window.confirm(`Отозвать ссылку на «${share.title}»?`)) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/content-share?id=${encodeURIComponent(share.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json()) as { revoked?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отозвать ссылку.");
      setShares((current) =>
        current.map((item) =>
          item.id === share.id ? { ...item, revoked_at: new Date().toISOString() } : item,
        ),
      );
      setNotice(result.revoked ? "Ссылка отозвана." : "Ссылка уже была отозвана.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отозвать ссылку.");
    } finally {
      setWorking(false);
    }
  };
  const view = (item: CatalogItem, index = 1) => (
    <article
      className={`catalog-card ${shareToken ? "shared-catalog-card" : ""}`}
      key={item.id}
    >
      {!shareToken && (
        <span className="catalog-route-marker" data-trail-anchor aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
      )}
      <div className="catalog-card-main">
        <div className="catalog-card-meta">
          <span>{kindNames[item.kind] ?? item.kind}</span>
          <span>
            {item.languageCode.toUpperCase()} · {item.level}
          </span>
          {canManageContent && !item.readOnly && (
            <span className={`catalog-status ${item.status}`}>
              {item.status === "published" ? "Опубликовано" : "Черновик"}
            </span>
          )}
        </div>
        <h2>{catalogTitle(item)}</h2>
        {item.topic && item.kind !== "module" && <p className="catalog-topic">{item.topic}</p>}
        {item.kind === "module" ? (
          <ModuleSummary body={item.body} />
        ) : (
          <ContentSummary body={item.body} />
        )}
        {canManageContent && !item.readOnly && (
          <div className="catalog-actions">
            <button className="secondary-button compact" onClick={() => startEdit(item)}>
              Изменить
            </button>
            {item.status === "draft" && (
              <button
                className="primary-button compact"
                disabled={working}
                onClick={() => {
                  void save(item, "published");
                }}
              >
                Опубликовать
              </button>
            )}
            {item.status === "published" && (
              <button
                className="secondary-button compact"
                disabled={working}
                onClick={() => void createShare(item)}
              >
                Ссылка на 7 дней · 3 просмотра
              </button>
            )}
            <button
              className="text-danger"
              disabled={working}
              onClick={() => void archive(item)}
            >
              Архивировать
            </button>
          </div>
        )}
      </div>
    </article>
  );
  if (shareToken)
    return (
      <div className="page catalog-page">
        <button
          className="text-button"
          onClick={() => {
            window.location.hash = "#/catalog";
          }}
        >
          ← Каталог материалов
        </button>
        {shareLoading ? (
          <p className="empty-inline">Проверяем ограниченную ссылку…</p>
        ) : shared ? (
          <>
            {view(shared)}
            <p className="catalog-privacy-note">
              Доступна только эта публикация. Ссылка истекает автоматически и не открывает профиль
              ученика.
            </p>
          </>
        ) : (
          error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )
        )}
      </div>
    );
  return (
    <div className="page catalog-page">
      <div className="page-heading">
        <img
          className="catalog-heading-mascot"
          src="/mascots/5.webp"
          alt=""
          aria-hidden="true"
        />
        <div>
          <p className="eyebrow">ОБЩИЕ УЧЕБНЫЕ МАТЕРИАЛЫ</p>
          <h1>Каталог</h1>
          <p>Материалы для выбранного языка и уровня.</p>
        </div>
        {canManageContent && (
          <button className="primary-button compact" onClick={() => startEdit()}>
            <Icon name="plus" size={16} /> Создать материал
          </button>
        )}
      </div>
      {notice && (
        <p className="catalog-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {canManageContent && (
        <section className="catalog-shares">
          <div className="catalog-shares-heading">
            <div>
              <h2>Ссылки на публикации</h2>
              <p>Ограниченные ссылки можно отозвать в любой момент.</p>
            </div>
            <span>{shares.length}</span>
          </div>
          {sharesLoading ? (
            <p className="empty-inline">Загружаю ссылки…</p>
          ) : shares.length ? (
            <div className="catalog-share-list">
              {shares.map((share) => {
                const expired = new Date(share.expires_at).getTime() <= Date.now();
                const exhausted = Number(share.view_count) >= Number(share.max_views);
                const inactive = Boolean(share.revoked_at) || expired || exhausted;
                return (
                  <article key={share.id}>
                    <div>
                      <strong>{share.title}</strong>
                      <small>
                        {inactive
                          ? share.revoked_at
                            ? "Отозвана"
                            : expired
                              ? "Срок истёк"
                              : "Лимит просмотров исчерпан"
                          : `До ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(share.expires_at))}`}{" "}
                        · {share.view_count}/{share.max_views} просмотров
                      </small>
                    </div>
                    <button
                      className="text-danger"
                      disabled={working || inactive}
                      onClick={() => void revokeShare(share)}
                    >
                      Отозвать
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-inline">Ссылок пока нет.</p>
          )}
        </section>
      )}
      {draft && (
        <section className="catalog-editor">
          <div className="catalog-editor-head">
            <div>
              <p className="eyebrow">{draft.id ? "ПРОСМОТР И РЕДАКТИРОВАНИЕ" : "НОВЫЙ ЧЕРНОВИК"}</p>
              <h2>{draft.id ? draft.title : "Материал"}</h2>
            </div>
            <button className="dialog-close" onClick={() => setDraft(null)} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="catalog-form-grid">
            <label className="field-label">
              Название
              <input
                maxLength={160}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label className="field-label">
              Тип
              <select
                value={draft.kind}
                onChange={(event) => setDraft({ ...draft, kind: event.target.value })}
              >
                {Object.entries(kindNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Язык
              <input
                maxLength={12}
                placeholder="de"
                value={draft.languageCode}
                onChange={(event) =>
                  setDraft({ ...draft, languageCode: event.target.value.toLowerCase() })
                }
              />
            </label>
            <label className="field-label">
              Уровень
              <input
                maxLength={20}
                placeholder="A1"
                value={draft.level}
                onChange={(event) => setDraft({ ...draft, level: event.target.value })}
              />
            </label>
            <label className="field-label">
              Тема
              <input
                maxLength={100}
                value={draft.topic}
                onChange={(event) => setDraft({ ...draft, topic: event.target.value })}
              />
            </label>
          </div>
          <label className="field-label catalog-json-label">
            Содержимое материала (JSON)
            <textarea
              rows={12}
              spellCheck={false}
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
            />
          </label>
          <p className="catalog-privacy-note">
            Черновик доступен редакторам. Публикация делает материал общим; удаление переводит его в
            архив.
          </p>
          <div className="catalog-actions">
            <button className="secondary-button" onClick={() => setDraft(null)}>
              Отмена
            </button>
            <button
              className="secondary-button"
              disabled={working}
              onClick={() => void save(undefined, "draft")}
            >
              Сохранить черновик
            </button>
            {draft.id && draft.status === "published" && (
              <button
                className="primary-button"
                disabled={working}
                onClick={() => void save(undefined, "published")}
              >
                Сохранить публикацию
              </button>
            )}
            {draft.id && draft.status === "published" && (
              <button
                className="secondary-button"
                disabled={working}
                onClick={() => void save(undefined, "draft")}
              >
                Снять с публикации
              </button>
            )}
          </div>
        </section>
      )}
      {canManageContent && legacyItems.length > 0 && (
        <details className="catalog-import">
          <summary>Импортировать мои старые материалы как черновики ({legacyItems.length})</summary>
          <p>
            Каждый материал сначала появится как черновик. Просмотрите содержимое до публикации.
          </p>
          <div>
            {legacyItems.slice(0, 100).map((item, index) => (
              <button
                key={`${item.kind}-${item.title}-${index}`}
                className="secondary-button compact"
                onClick={() => void importSeed(item)}
              >
                Импортировать «{item.title}»
              </button>
            ))}
          </div>
        </details>
      )}
      {loading ? (
        <p className="empty-inline">Загружаем каталог…</p>
      ) : sections.length ? (
        <div className="catalog-path-sections">
          {sections.map((section, sectionIndex) => (
            <details
              className="catalog-path-section"
              key={section.title}
              open={sectionIndex === 0}
            >
              <summary className="catalog-path-heading">
                <span className="catalog-section-number">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <span className="catalog-section-copy">
                  <strong>{section.title}</strong>
                  <small>
                    {section.items.length} {section.items.length === 1 ? "материал" : "материала"}
                  </small>
                </span>
                <span className="catalog-section-toggle" aria-hidden="true">⌄</span>
              </summary>
              <LearningTrail className="catalog-route-list">
                {section.items.map((item, index) => (
                  <div className="catalog-route-step" key={item.id}>
                    {view(item, index + 1)}
                  </div>
                ))}
              </LearningTrail>
            </details>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Пока нет материалов для этого языка и уровня</h2>
          <p>Здесь появятся общие публикации для выбранного языка.</p>
        </div>
      )}
    </div>
  );
}

function ContentSummary({ body }: { body: Record<string, unknown> }) {
  const description =
    typeof body.description === "string"
      ? body.description
      : typeof body.instructions === "string"
        ? body.instructions
        : "";
  const estimated = Number(body.estimated_seconds);
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const cards = Array.isArray(body.cards) ? body.cards : [];
  return (
    <div className="catalog-summary">
      {description && <p>{description}</p>}
      {cards.length > 0 && (
        <div className="catalog-word-preview">
          <strong>{cards.length} слов</strong>
          {cards.slice(0, 4).map((value, index) => {
            const card = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
            return (
              <span key={`${String(card.word ?? "word")}-${index}`}>
                {card.article ? `${String(card.article)} ` : ""}{String(card.word ?? "")}
                {card.translation ? ` · ${String(card.translation)}` : ""}
              </span>
            );
          })}
        </div>
      )}
      {Array.isArray(body.objectives) && (
        <ul>
          {body.objectives.slice(0, 5).map((item, index) => (
            <li key={index}>{String(item)}</li>
          ))}
        </ul>
      )}
      {steps.length > 0 && <p>{steps.length} шагов</p>}
      {Number.isFinite(estimated) && estimated > 0 && (
        <small>Около {Math.max(1, Math.round(estimated / 60))} мин</small>
      )}
    </div>
  );
}

function ModuleSummary({ body }: { body: Record<string, unknown> }) {
  const cards = Array.isArray(body.cards) ? body.cards : [];
  const examples = cards.slice(0, 3).map((value) =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : {},
  );
  const estimated = Number(body.estimated_seconds);
  return (
    <div className="catalog-module-summary">
      <div className="catalog-module-summary-heading">
        <strong>{cards.length} слов</strong>
        <span>Лексика · немецкий → русский</span>
      </div>
      <div className="catalog-module-examples">
        {examples.map((card, index) => (
          <span key={`${String(card.word ?? "word")}-${index}`}>
            <b>{card.article ? `${String(card.article)} ` : ""}{String(card.word ?? "")}</b>
            <i>{String(card.translation ?? "")}</i>
          </span>
        ))}
      </div>
      {Number.isFinite(estimated) && estimated > 0 && (
        <small>Запоминание и произношение · около {Math.max(1, Math.round(estimated / 60))} мин</small>
      )}
    </div>
  );
}
