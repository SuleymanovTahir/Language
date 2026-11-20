import { useEffect, useMemo, useState } from "react";
import type { AccountUser } from "./Accounts";
import { Icon } from "./Icon";

type AdminUser = AccountUser & {
  created_at: string;
  email_verified: boolean;
  role: string;
  event_count: number;
  errors: number;
  last_activity: string | null;
  last_login: string | null;
  last_seen: string | null;
  dormant_days: number | null;
  is_pro: boolean;
  pro_status: string | null;
  pro_starts_at: string | null;
  pro_ends_at: string | null;
  banned: boolean;
  ban_reason: string | null;
  ban_expires: string | null;
  xp: number;
  energy: number;
  energy_cap: number;
  answers: number;
  correct: number;
  learned_words: number;
};
type UserResponse = {
  users: AdminUser[];
  active: Array<{
    user_id: string;
    activity_title: string;
    module_title: string;
    current_index: number;
    total: number;
  }>;
  events: Array<{
    id: number;
    event_type: string;
    activity: string;
    created_at: string;
    name: string;
    is_correct: boolean | null;
  }>;
  error?: string;
};
type AdminFilter = "all" | "pro" | "free" | "banned" | "dormant";

async function adminRequest(body: Record<string, unknown>, method = "PATCH", suffix = "") {
  const response = await fetch(`/api/admin${suffix}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Не удалось сохранить изменения.");
  return result;
}
function fmtDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
function dateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
function errText(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось выполнить действие.";
}

export function AdminUsersScreen({
  currentUser,
  onEnergyUpdated,
}: {
  currentUser: AccountUser;
  onEnergyUpdated?: (energy: number, cap: number) => void;
}) {
  const [data, setData] = useState<UserResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminFilter>("all");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    void fetch("/api/admin", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as UserResponse;
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить пользователей.");
        if (alive) setData(result);
      })
      .catch((cause) => {
        if (alive) setError(errText(cause));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadNonce]);
  const users = useMemo(
    () =>
      (data?.users ?? []).filter((user) => {
        const match = `${user.name} ${user.email} ${user.id}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase());
        const category =
          filter === "all" ||
          (filter === "pro" && user.is_pro) ||
          (filter === "free" && !user.is_pro) ||
          (filter === "banned" && user.banned) ||
          (filter === "dormant" && (user.dormant_days === null || user.dormant_days >= 14));
        return match && category;
      }),
    [data, filter, query],
  );
  const counts = {
    all: data?.users.length ?? 0,
    pro: data?.users.filter((user) => user.is_pro).length ?? 0,
    free: data?.users.filter((user) => !user.is_pro).length ?? 0,
    banned: data?.users.filter((user) => user.banned).length ?? 0,
    dormant:
      data?.users.filter((user) => user.dormant_days === null || user.dormant_days >= 14).length ??
      0,
  };
  const refresh = () => setReloadNonce((value) => value + 1);
  const saved = (message: string) => {
    setNotice(message);
    refresh();
  };
  return (
    <div className="page admin-page">
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">ПАНЕЛЬ ВЛАДЕЛЬЦА</p>
          <h1>Пользователи</h1>
          <p>Аккаунты, подписка, доступ и учебный прогресс.</p>
        </div>
        <button className="secondary-button compact" onClick={refresh}>
          <Icon name="refresh" size={15} /> Обновить
        </button>
      </div>
      <div className="admin-overview-cards">
        <article>
          <span>Всего</span>
          <strong>{counts.all}</strong>
          <small>аккаунтов</small>
        </article>
        <article className="pro">
          <span>PRO</span>
          <strong>{counts.pro}</strong>
          <small>активный доступ</small>
        </article>
        <article>
          <span>Без PRO</span>
          <strong>{counts.free}</strong>
          <small>обычный доступ</small>
        </article>
        <article className="muted">
          <span>Не заходили 14+ дней</span>
          <strong>{counts.dormant}</strong>
          <small>включая без истории входов</small>
        </article>
      </div>
      <div className="admin-user-toolbar">
        <label className="admin-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, email или ID"
          />
        </label>
        <div className="admin-filter-tabs">
          {(["all", "pro", "free", "banned", "dormant"] as AdminFilter[]).map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {
                {
                  all: "Все",
                  pro: "PRO",
                  free: "Без PRO",
                  banned: "Заблокированы",
                  dormant: "Неактивные",
                }[item]
              }{" "}
              <span>{counts[item]}</span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="form-error admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {busy ? (
        <div className="admin-loading">
          <span className="account-spinner" /> Загружаю аккаунты…
        </div>
      ) : users.length ? (
        <div className="admin-user-cards">
          {users.map((user) => (
            <AdminUserCard
              key={user.id}
              user={user}
              currentUserId={currentUser.id}
              active={data?.active.find((item) => item.user_id === user.id)}
              onSaved={saved}
              onError={setError}
              onEnergyUpdated={onEnergyUpdated}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state admin-empty">
          <Icon name="search" size={28} />
          <h2>Пользователи не найдены</h2>
          <p>Попробуйте изменить поиск или фильтр.</p>
        </div>
      )}
      <section className="admin-live-summary">
        <div>
          <h2>Сейчас учатся</h2>
          <p>Незавершённые занятия, которые приложение сохранило.</p>
        </div>
        {data?.active.length ? (
          <div className="admin-active-cards">
            {data.active.map((item) => (
              <article key={item.user_id}>
                <strong>
                  {data.users.find((user) => user.id === item.user_id)?.name ?? "Пользователь"}
                </strong>
                <span>
                  {item.activity_title} · {item.module_title || "занятие"}
                </span>
                <small>
                  Шаг {item.current_index} из {item.total}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <small>Активных занятий нет.</small>
        )}
      </section>
    </div>
  );
}

function AdminUserCard({
  user,
  currentUserId,
  active,
  onSaved,
  onError,
  onEnergyUpdated,
}: {
  user: AdminUser;
  currentUserId: string;
  active?: UserResponse["active"][number];
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onEnergyUpdated?: (energy: number, cap: number) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState(user.ban_reason ?? "");
  const [startsAt, setStartsAt] = useState(dateInput(user.pro_starts_at));
  const [endsAt, setEndsAt] = useState(dateInput(user.pro_ends_at));
  const [proReason, setProReason] = useState("");
  const [xp, setXp] = useState(String(user.xp));
  const [energy, setEnergy] = useState(String(user.energy));
  const [energyReason, setEnergyReason] = useState("");
  const [working, setWorking] = useState(false);
  const mutate = async (
    action: string,
    values: Record<string, unknown> = {},
    message = "Изменения сохранены.",
  ) => {
    setWorking(true);
    onError("");
    try {
      await adminRequest({ action, userId: user.id, ...values });
      if (action === "set-energy" && user.id === currentUserId)
        onEnergyUpdated?.(Number(values.energy), user.energy_cap);
      onSaved(message);
    } catch (cause) {
      onError(errText(cause));
    } finally {
      setWorking(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Удалить аккаунт ${user.name} вместе с прогрессом? Это нельзя отменить.`))
      return;
    setWorking(true);
    onError("");
    try {
      await adminRequest({}, "DELETE", `?userId=${encodeURIComponent(user.id)}`);
      onSaved("Аккаунт удалён.");
    } catch (cause) {
      onError(errText(cause));
    } finally {
      setWorking(false);
    }
  };
  const reset = async () => {
    if (!window.confirm(`Сбросить учебный прогресс ${user.name}? Словари и аккаунт сохранятся.`))
      return;
    await mutate("reset-progress", {}, "Учебный прогресс сброшен.");
  };
  const status = user.banned ? "Заблокирован" : user.is_pro ? "PRO" : "Бесплатный";
  return (
    <details className={`admin-user-card ${user.banned ? "banned" : ""}`}>
      <summary>
        <span className="admin-user-avatar">
          {user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1).toLocaleUpperCase()}
        </span>
        <span className="admin-user-heading">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <span className={`admin-user-badge ${user.banned ? "ban" : user.is_pro ? "pro" : ""}`}>
          {status}
        </span>
        <span className="admin-user-summary">
          {user.xp.toLocaleString("ru-RU")} XP · {user.energy}/{user.energy_cap} ⚡ ·{" "}
          {user.learned_words} слов
        </span>
        <Icon className="admin-card-chevron" name="chevron" size={18} />
      </summary>
      <div className="admin-user-detail">
        <div className="admin-facts-grid">
          <div>
            <span>Создан</span>
            <strong>{fmtDate(user.created_at)}</strong>
          </div>
          <div>
            <span>Последний вход</span>
            <strong>{fmtDate(user.last_login)}</strong>
          </div>
          <div>
            <span>Последняя активность</span>
            <strong>{fmtDate(user.last_activity)}</strong>
          </div>
          <div>
            <span>Почта</span>
            <strong>{user.email_verified ? "Подтверждена" : "Не подтверждена"}</strong>
          </div>
          <div>
            <span>Ответы</span>
            <strong>
              {user.answers} · ошибок {user.errors}
            </strong>
          </div>
          <div>
            <span>Роль</span>
            <strong>{user.role}</strong>
          </div>
        </div>
        {active && (
          <div className="admin-current-activity">
            <Icon name="game" size={16} />
            <span>
              <strong>В процессе:</strong> {active.activity_title} ·{" "}
              {active.module_title || "занятие"} · шаг {active.current_index}/{active.total}
            </span>
          </div>
        )}
        <div className="admin-detail-columns">
          <section className="admin-edit-section">
            <h3>Аккаунт</h3>
            <label className="field-label">
              Имя
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field-label">
              Логин · email
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              className="secondary-button compact"
              disabled={working || (name.trim() === user.name && email.trim() === user.email)}
              onClick={() =>
                void mutate("update-account", { name, email }, "Имя и email обновлены.")
              }
            >
              Сохранить аккаунт
            </button>
            <label className="field-label admin-password-field">
              Новый пароль
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Не менее 8 символов"
              />
            </label>
            <button
              className="secondary-button compact"
              disabled={working || password.length < 8}
              onClick={() => {
                void mutate("set-password", { password }, "Пароль изменён.").then(() =>
                  setPassword(""),
                );
              }}
            >
              Сменить пароль
            </button>
          </section>
          <section className="admin-edit-section">
            <h3>PRO-доступ</h3>
            <label className="admin-toggle-row">
              <span>
                <strong>{user.is_pro ? "PRO включён вручную" : "Включить PRO вручную"}</strong>
                <small>Укажите дату окончания и причину гранта.</small>
              </span>
              <input
                type="checkbox"
                checked={user.is_pro || user.pro_status === "active"}
                disabled={
                  working ||
                  (!(user.is_pro || user.pro_status === "active") && (!endsAt || !proReason.trim()))
                }
                onChange={(event) =>
                  void mutate(
                    "set-pro",
                    {
                      enabled: event.target.checked,
                      startsAt: startsAt || null,
                      endsAt: endsAt || null,
                      reason: proReason,
                    },
                    event.target.checked ? "PRO включён до указанной даты." : "PRO отключён.",
                  )
                }
              />
            </label>
            <div className="admin-date-grid">
              <label className="field-label">
                Начало
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </label>
              <label className="field-label">
                Окончание
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="field-label">
              Причина ручного гранта
              <input
                value={proReason}
                maxLength={300}
                onChange={(event) => setProReason(event.target.value)}
                placeholder="Например, компенсация доступа"
              />
            </label>
            <small className="admin-help">
              Сейчас: {fmtDate(user.pro_starts_at)} —{" "}
              {user.pro_ends_at ? fmtDate(user.pro_ends_at) : "PRO не активен без даты окончания"}
            </small>
          </section>
          <section className="admin-edit-section">
            <h3>Учебный прогресс</h3>
            <div className="admin-progress-fields">
              <label className="field-label">
                XP
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={xp}
                  onChange={(event) => setXp(event.target.value)}
                />
              </label>
              <label className="field-label">
                Энергия · из {user.energy_cap}
                <input
                  type="number"
                  min="0"
                  max={user.energy_cap}
                  step="1"
                  value={energy}
                  onChange={(event) => setEnergy(event.target.value)}
                />
              </label>
            </div>
            <button
              className="secondary-button compact"
              disabled={working}
              onClick={() => void mutate("set-progress", { xp: Number(xp) }, "XP обновлены.")}
            >
              Сохранить XP
            </button>
            <label className="field-label">
              Причина изменения энергии
              <input
                value={energyReason}
                maxLength={300}
                onChange={(event) => setEnergyReason(event.target.value)}
                placeholder="Например, компенсация после сбоя"
              />
            </label>
            <button
              className="secondary-button compact"
              disabled={
                working ||
                !energyReason.trim() ||
                !Number.isInteger(Number(energy)) ||
                Number(energy) < 0 ||
                Number(energy) > user.energy_cap
              }
              onClick={() =>
                void mutate(
                  "set-energy",
                  { energy: Number(energy), reason: energyReason },
                  "Энергия обновлена.",
                )
              }
            >
              Сохранить энергию
            </button>
            <button
              className="secondary-button compact"
              disabled={working || user.energy >= user.energy_cap || !energyReason.trim()}
              onClick={() => {
                setEnergy(String(user.energy_cap));
                void mutate(
                  "set-energy",
                  { energy: user.energy_cap, reason: energyReason },
                  `Энергия пополнена до ${user.energy_cap}.`,
                );
              }}
            >
              Пополнить до {user.energy_cap}
            </button>
            <button
              className="text-danger admin-reset-progress"
              disabled={working}
              onClick={() => void reset()}
            >
              Сбросить учебный прогресс
            </button>
          </section>
          <section className="admin-edit-section">
            <h3>Доступ</h3>
            {user.banned ? (
              <>
                <p className="admin-ban-state">
                  Заблокирован{user.ban_expires ? ` до ${fmtDate(user.ban_expires)}` : " навсегда"}.
                  Причина: {user.ban_reason || "не указана"}
                </p>
                <button
                  className="secondary-button compact"
                  disabled={working}
                  onClick={() => void mutate("unban", {}, "Доступ восстановлен.")}
                >
                  Разблокировать
                </button>
              </>
            ) : (
              <>
                <label className="field-label">
                  Причина блокировки
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Например, спам"
                  />
                </label>
                <button
                  className="secondary-button compact admin-ban-button"
                  disabled={working}
                  onClick={() => void mutate("ban", { reason }, "Пользователь заблокирован.")}
                >
                  Заблокировать аккаунт
                </button>
              </>
            )}
            <button
              className="text-danger admin-delete-user"
              disabled={working || user.id === currentUserId}
              onClick={() => void remove()}
            >
              Удалить аккаунт
            </button>
          </section>
        </div>
        {working && <small className="admin-saving">Сохраняю…</small>}
      </div>
    </details>
  );
}

type AnalyticsData = {
  daily: Array<{ day: string; signups: number; active_users: number }>;
  summary: {
    new_users_7d: number;
    dormant_users: number;
    active_users_7d: number;
    total_users: number;
  };
  actions: Array<{ action: string; route: string; clicks: number }>;
  pages: Array<{ route: string; views: number; users: number }>;
  recent: Array<{ id: number; name: string; route: string; action: string; created_at: string }>;
  dormant: Array<{
    id: string;
    name: string;
    email: string;
    created_at: string;
    last_seen: string | null;
  }>;
  error?: string;
};

export function AdminAnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    void fetch("/api/admin?view=analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AnalyticsData;
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить аналитику.");
        if (alive) setData(result);
      })
      .catch((cause) => {
        if (alive) setError(errText(cause));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [reload]);
  const peak = Math.max(
    1,
    ...(data?.daily ?? []).map((item) => Math.max(item.signups, item.active_users)),
  );
  return (
    <div className="page admin-page analytics-page">
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">ПАНЕЛЬ ВЛАДЕЛЬЦА</p>
          <h1>Аналитика</h1>
          <p>Регистрации, активность и целевые действия за последние 30 дней.</p>
        </div>
        <button
          className="secondary-button compact"
          onClick={() => setReload((value) => value + 1)}
        >
          <Icon name="refresh" size={15} /> Обновить
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <div className="admin-loading">
          <span className="account-spinner" /> Загружаю аналитику…
        </div>
      ) : (
        data && (
          <>
            <div className="admin-overview-cards analytics-kpis">
              <article>
                <span>Всего пользователей</span>
                <strong>{data.summary?.total_users ?? 0}</strong>
                <small>все аккаунты</small>
              </article>
              <article className="pro">
                <span>Новые за 7 дней</span>
                <strong>{data.summary?.new_users_7d ?? 0}</strong>
                <small>регистрации</small>
              </article>
              <article>
                <span>Активны за 7 дней</span>
                <strong>{data.summary?.active_users_7d ?? 0}</strong>
                <small>есть вход или занятие</small>
              </article>
              <article className="muted">
                <span>Неактивны 14+ дней</span>
                <strong>{data.summary?.dormant_users ?? 0}</strong>
                <small>нуждаются во внимании</small>
              </article>
            </div>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <h2>Рост и активность</h2>
                  <p>Новые аккаунты и люди с действиями в приложении по дням.</p>
                </div>
                <span>30 дней</span>
              </div>
              {data.daily.length ? (
                <div
                  className="analytics-chart"
                  role="img"
                  aria-label="График регистраций и активности"
                >
                  {data.daily.map((item) => (
                    <div
                      key={item.day}
                      className="analytics-chart-day"
                      title={`${item.day}: ${item.signups} новых, ${item.active_users} активных`}
                    >
                      <div className="analytics-bars">
                        <i
                          className="signup"
                          style={{
                            height: `${Math.max(item.signups ? 4 : 0, (item.signups / peak) * 100)}%`,
                          }}
                        />
                        <i
                          className="active"
                          style={{
                            height: `${Math.max(item.active_users ? 4 : 0, (item.active_users / peak) * 100)}%`,
                          }}
                        />
                      </div>
                      <small>
                        {new Date(item.day).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin-analytics-empty">Пока нет событий за последние 30 дней.</p>
              )}
              <div className="analytics-legend">
                <span>
                  <i className="signup" /> Новые регистрации
                </span>
                <span>
                  <i className="active" /> Активные пользователи
                </span>
              </div>
            </section>
            <div className="analytics-two-column">
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Популярные разделы</h2>
                    <p>Просмотры и уникальные посетители.</p>
                  </div>
                </div>
                {data.pages.length ? (
                  <div className="analytics-row-list">
                    {data.pages.map((item) => (
                      <article key={item.route}>
                        <strong>{routeName(item.route)}</strong>
                        <span>{item.views} просмотров</span>
                        <small>{item.users} пользователей</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">
                    Просмотры появятся после посещения разделов.
                  </p>
                )}
              </section>
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Целевые действия</h2>
                    <p>Клики по разделам и элементам, отмеченным для аналитики.</p>
                  </div>
                </div>
                {data.actions.length ? (
                  <div className="analytics-row-list">
                    {data.actions.map((item) => (
                      <article key={`${item.route}-${item.action}`}>
                        <strong>{actionName(item.action)}</strong>
                        <span>{item.clicks} кликов</span>
                        <small>{routeName(item.route)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">Целевые действия пока не записаны.</p>
                )}
              </section>
            </div>
            <div className="analytics-two-column">
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Давно не заходили</h2>
                    <p>Нет входов или учебных действий 14 дней и больше.</p>
                  </div>
                  <span>{data.dormant.length}</span>
                </div>
                {data.dormant.length ? (
                  <div className="analytics-row-list dormant-list">
                    {data.dormant.map((item) => (
                      <article key={item.id}>
                        <strong>{item.name}</strong>
                        <span>{item.email}</span>
                        <small>Последняя активность: {fmtDate(item.last_seen)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">Неактивных пользователей нет.</p>
                )}
              </section>
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Последние клики</h2>
                    <p>Журнал действий пользователей.</p>
                  </div>
                </div>
                {data.recent.length ? (
                  <div className="analytics-row-list recent-actions-list">
                    {data.recent.slice(0, 30).map((item) => (
                      <article key={item.id}>
                        <strong>{item.name}</strong>
                        <span>{actionName(item.action)}</span>
                        <small>
                          {routeName(item.route)} · {fmtDate(item.created_at)}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">История действий пока пуста.</p>
                )}
              </section>
            </div>
          </>
        )
      )}
    </div>
  );
}

function routeName(route: string | null) {
  return (
    (
      {
        today: "Сегодня",
        library: "Библиотека слов",
        path: "Учебный путь",
        materials: "Конструктор",
        games: "Игры",
        stats: "Прогресс",
        admin: "Пользователи",
        analytics: "Аналитика",
      } as Record<string, string>
    )[route ?? ""] ?? "Раздел"
  );
}
function actionName(action: string | null) {
  return (
    (
      {
        "nav-today": "Сегодня",
        "nav-library": "Библиотека",
        "nav-path": "Учебный путь",
        "nav-materials": "Конструктор",
        "nav-games": "Игры",
        "nav-stats": "Прогресс",
        "nav-admin": "Пользователи",
        "nav-analytics": "Аналитика",
        "settings-open": "Настройки",
        "energy-open": "Открыть энергию",
      } as Record<string, string>
    )[action ?? ""] ?? (action ?? "Действие").replace(/-/g, " ")
  );
}
