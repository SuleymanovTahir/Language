import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { copyAppLink } from "../lib/shareLink";

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
          setItems(
            legacyItems.map((item, index) => ({
              ...item,
              id: `local-${index}`,
              topic: item.topic ?? "",
              status: "published" as const,
            })),
          );
          return;
        }
        throw new Error("Каталог временно недоступен.");
      }
      const data = (await response.json()) as { items?: CatalogItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить каталог.");
      setItems(data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить каталог.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [languageCode, level, canManageContent]);
  const loadShares = async () => {
    if (!canManageContent) return;
    setSharesLoading(true);
    try {
      const response = await fetch("/api/content-share?manage=1", {
        credentials: "include",
        cache: "no-store",
      });
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
  const view = (item: CatalogItem) => (
    <article className="catalog-card" key={item.id}>
      <div className="catalog-card-meta">
        <span>{kindNames[item.kind] ?? item.kind}</span>
        <span>
          {item.languageCode.toUpperCase()} · {item.level}
        </span>
        {canManageContent && (
          <span className={`catalog-status ${item.status}`}>
            {item.status === "published" ? "Опубликовано" : "Черновик"}
          </span>
        )}
      </div>
      <h2>{item.title}</h2>
      {item.topic && <p className="catalog-topic">{item.topic}</p>}
      <ContentSummary body={item.body} />
      {canManageContent && (
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
          <button className="text-danger" disabled={working} onClick={() => void archive(item)}>
            Архивировать
          </button>
        </div>
      )}
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
          src="/mascots/mascot-5.png"
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
      ) : items.length ? (
        <div className="catalog-grid">{items.map(view)}</div>
      ) : (
        <div className="empty-state">
          <h2>Пока нет материалов для этого языка и уровня</h2>
          <p>
            Здесь появятся публикации администратора. Ваши карточки и курс продолжают работать
            отдельно.
          </p>
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
  return (
    <div className="catalog-summary">
      {description && <p>{description}</p>}
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
