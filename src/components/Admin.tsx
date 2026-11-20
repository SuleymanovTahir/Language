import { CommunicationSettings } from "./Companion";
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
  crystals: number;
  energy: number;
  energy_cap: number;
  answers: number;
  correct: number;
  learned_words: number;
};
type UserResponse = {
  users: AdminUser[];
  subscriptions: Array<{
    id: string;
    account_id: string;
    name: string;
    email: string;
    plan_name: string;
    status: string;
    amount_minor: number;
    currency: string;
    period_start: string;
    period_end: string;
    cancel_at_period_end: boolean;
    provider: string;
  }>;
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
  const result = await readAdminJson<{ error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Не удалось сохранить изменения.");
  return result;
}
async function readAdminJson<T extends { error?: string }>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    if (!response.ok) throw new Error(`Сервер админки недоступен (HTTP ${response.status}).`);
    throw new Error("Сервер админки вернул некорректный ответ.");
  }
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

function CreateUserModal({
  currentUserRole,
  onClose,
  onCreated,
}: {
  currentUserRole?: string;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [permissions, setPermissions] = useState({
    manageContent: true,
    manageUsers: false,
    viewAnalytics: false,
  });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setError("Имя должно содержать не менее 2 символов.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Укажите корректный email адрес (логин).");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен содержать не менее 8 символов.");
      return;
    }
    setWorking(true);
    try {
      await adminRequest(
        {
          action: "create-user",
          name: trimmedName,
          email: trimmedEmail,
          password,
          role,
          permissions: role === "admin" ? permissions : undefined,
        },
        "POST",
      );
      onCreated(`Пользователь ${trimmedName} (${trimmedEmail}) успешно создан.`);
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-card">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" size={18} />
        </button>
        <p className="eyebrow">НОВЫЙ АККАУНТ</p>
        <h2>Добавить пользователя</h2>
        <p>Создание нового аккаунта с логином, паролем и ролью.</p>

        {error && (
          <p className="form-error admin-error" style={{ marginBottom: 16 }} role="alert">
            {error}
          </p>
        )}

        <form onSubmit={submit}>
          <label className="field-label">
            Имя пользователя
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Анна Смирнова"
              disabled={working}
            />
          </label>
          <label className="field-label">
            Логин · Email
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={working}
            />
          </label>
          <label className="field-label">
            Пароль
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Не менее 8 символов"
              disabled={working}
            />
          </label>
          <label className="field-label">
            Роль
            <select
              value={role}
              disabled={working}
              onChange={(e) => {
                const next = e.target.value as "student" | "admin";
                setRole(next);
                setPermissions({
                  manageContent: next === "admin",
                  manageUsers: false,
                  viewAnalytics: false,
                });
              }}
            >
              <option value="student">Ученик</option>
              <option value="admin">Администратор</option>
            </select>
          </label>

          {role === "admin" && (
            <div
              style={{
                marginTop: 14,
                marginBottom: 14,
                padding: "14px 16px",
                background: "#f8fafc",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
              }}
            >
              <strong style={{ display: "block", marginBottom: 10, fontSize: 13, color: "#1e293b" }}>
                Права администратора:
              </strong>
              <label className="admin-toggle-row" style={{ marginBottom: 10 }}>
                <span>
                  <strong>Редактировать материалы</strong>
                  <small>Модули, уроки, игры и каталог</small>
                </span>
                <input
                  type="checkbox"
                  checked={permissions.manageContent}
                  disabled={working}
                  onChange={(e) =>
                    setPermissions((current) => ({
                      ...current,
                      manageContent: e.target.checked,
                    }))
                  }
                />
              </label>
              <label className="admin-toggle-row" style={{ marginBottom: 10 }}>
                <span>
                  <strong>Управление пользователями</strong>
                  <small>Создание, удаление, редактирование аккаунтов, смена паролей</small>
                </span>
                <input
                  type="checkbox"
                  checked={permissions.manageUsers}
                  disabled={working}
                  onChange={(e) =>
                    setPermissions((current) => ({
                      ...current,
                      manageUsers: e.target.checked,
                    }))
                  }
                />
              </label>
              <label className="admin-toggle-row">
                <span>
                  <strong>Просмотр аналитики</strong>
                  <small>Доступ к разделу аналитики и активности</small>
                </span>
                <input
                  type="checkbox"
                  checked={permissions.viewAnalytics}
                  disabled={working}
                  onChange={(e) =>
                    setPermissions((current) => ({
                      ...current,
                      viewAnalytics: e.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          )}

          <div className="dialog-actions" style={{ marginTop: 22 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={working}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={working || !name.trim() || !email.trim() || password.length < 8}
            >
              {working ? "Создаю…" : "Создать пользователя"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    void fetch("/api/admin", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await readAdminJson<UserResponse>(response);
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
          <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
          <h1>Пользователи</h1>
          <p>Аккаунты, подписка, доступ и учебный прогресс.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="primary-button compact" onClick={() => setCreateOpen(true)}>
            + Добавить пользователя
          </button>
          <button className="secondary-button compact" onClick={refresh}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
        </div>
      </div>
      <CommunicationSettings admin />
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
              currentUserRole={currentUser.role}
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
      <section className="admin-live-summary admin-subscriptions-summary">
        <div>
          <h2>Подписки и продления</h2>
          <p>Кому выдан PRO, сколько стоит и за какой период.</p>
        </div>
        {data?.subscriptions.length ? (
          <div className="admin-active-cards">
            {data.subscriptions.map((item) => (
              <article key={item.id}>
                <strong>{item.name || item.email}</strong>
                <span>{item.email} · {item.plan_name} · {item.amount_minor / 100} {item.currency}</span>
                <small>
                  {fmtDate(item.period_start)} — {fmtDate(item.period_end)} · {item.status}
                  {item.cancel_at_period_end ? " · продление отключено" : " · продление включено"}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <small>Подписок пока нет. Новые периоды появятся здесь после подключения оплаты.</small>
        )}
      </section>
      {createOpen && (
        <CreateUserModal
          currentUserRole={currentUser.role}
          onClose={() => setCreateOpen(false)}
          onCreated={saved}
        />
      )}
    </div>
  );
}

function AdminUserCard({
  user,
  currentUserId,
  currentUserRole,
  active,
  onSaved,
  onError,
  onEnergyUpdated,
}: {
  user: AdminUser;
  currentUserId: string;
  currentUserRole?: string;
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
  const [crystals, setCrystals] = useState(String(user.crystals));
  const [energy, setEnergy] = useState(String(user.energy));
  const [role, setRole] = useState(user.role || "student");
  const [permissions, setPermissions] = useState({
    manageContent: Boolean(user.permissions?.manageContent),
    manageUsers: Boolean(user.permissions?.manageUsers),
    viewAnalytics: Boolean(user.permissions?.viewAnalytics),
    manageSettings: Boolean(user.permissions?.manageSettings),
  });
  const [hiddenSections, setHiddenSections] = useState<string[]>(
    user.permissions?.hiddenSections ?? [],
  );
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
  const saveAccess = async () => {
    setWorking(true);
    onError("");
    try {
      await adminRequest(
        { userId: user.id, role, permissions: { ...permissions, hiddenSections } },
        "PUT",
      );
      onSaved("Роль и права обновлены. Активные сессии пользователя завершены.");
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
            <h3>Роль и права</h3>
            <label className="field-label">
              Роль
              <select
                value={role}
                disabled={working || user.id === currentUserId || user.role === "owner"}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  setRole(nextRole);
                  setPermissions((current) => ({
                    ...current,
                    manageContent: nextRole === "admin",
                    manageUsers: false,
                    viewAnalytics: false,
                    manageSettings: false,
                  }));
                }}
              >
                <option value="student">Ученик</option>
                <option value="admin">Администратор</option>
                {user.role === "owner" && <option value="owner">Владелец</option>}
              </select>
            </label>
            {role === "admin" && (
              <>
                <label className="admin-toggle-row">
                  <span>
                    <strong>Редактировать материалы</strong>
                    <small>Модули, уроки, игры и каталог.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={permissions.manageContent}
                    disabled={working || user.id === currentUserId || user.role === "owner"}
                    onChange={(event) =>
                      setPermissions((current) => ({
                        ...current,
                        manageContent: event.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="admin-toggle-row">
                  <span>
                    <strong>Управление пользователями</strong>
                    <small>Создание, удаление, редактирование аккаунтов, смена паролей.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={permissions.manageUsers}
                    disabled={
                      working ||
                      user.id === currentUserId ||
                      user.role === "owner" ||
                      (currentUserRole !== "owner" && !permissions.manageUsers)
                    }
                    onChange={(event) =>
                      setPermissions((current) => ({
                        ...current,
                        manageUsers: event.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="admin-toggle-row">
                  <span>
                    <strong>Просмотр аналитики</strong>
                    <small>Доступ к разделу аналитики и активности.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={permissions.viewAnalytics}
                    disabled={working || user.id === currentUserId || user.role === "owner"}
                    onChange={(event) =>
                      setPermissions((current) => ({
                        ...current,
                        viewAnalytics: event.target.checked,
                      }))
                    }
                  />
                </label>
              </>
            )}
            <p className="admin-help">
              Права на управление пользователями и аналитику могут назначаться владельцем сайта.
            </p>
            <fieldset className="admin-menu-access">
              <legend>Разделы бокового меню</legend>
              {[
                ["today", "Сегодня"],
                ["library", "Библиотека"],
                ["catalog", "Каталог"],
                ["path", "Учебный путь"],
                ["materials", "Материалы"],
                ["games", "Игры"],
                ["stats", "Прогресс"],
              ].map(([id, label]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={!hiddenSections.includes(id)}
                    disabled={working || user.id === currentUserId}
                    onChange={(event) =>
                      setHiddenSections((current) =>
                        event.target.checked
                          ? current.filter((item) => item !== id)
                          : [...current, id],
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <button
              className="secondary-button compact"
              disabled={working || user.id === currentUserId}
              onClick={() => void saveAccess()}
            >
              Сохранить роль и права
            </button>
          </section>
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
                Кристаллы
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={crystals}
                  onChange={(event) => setCrystals(event.target.value)}
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
            <button
              className="secondary-button compact"
              disabled={
                working ||
                !Number.isInteger(Number(crystals)) ||
                Number(crystals) < 0 ||
                Number(crystals) > 10_000_000
              }
              onClick={() =>
                void mutate("set-crystals", { crystals: Number(crystals) }, "Кристаллы обновлены.")
              }
            >
              Сохранить кристаллы
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
    dau: number;
    wau: number;
    mau: number;
    guests_30d: number;
    active_users_previous_30d: number;
    retained_users_30d: number;
    churned_users_30d: number;
    user_churn_rate_30d: number;
    returning_guests_30d: number;
    churned_guests_30d: number;
    guest_churn_rate_30d: number;
    stickiness: number;
    feedback_count: number;
    feedback_average: number | null;
  };
  actions: Array<{ action: string; route: string; clicks: number }>;
  pages: Array<{ route: string; views: number; users: number }>;
  recent: Array<{
    id: number;
    name: string;
    email?: string | null;
    route: string;
    action: string;
    created_at: string;
    country?: string | null;
    region?: string | null;
    device_type?: string | null;
  }>;
  feedback: Array<{
    id: number;
    rating: number;
    choice: string | null;
    text: string | null;
    created_at: string;
    country: string | null;
    region: string | null;
    ip_hash: string | null;
    visitor_id: string | null;
    email: string | null;
    author: string;
    metadata: { deviceType?: string; browser?: string; os?: string; locale?: string };
  }>;
  actors: Array<{
    id: number;
    user_id: string | null;
    name: string | null;
    email: string | null;
    visitor_id: string | null;
    event_type: string;
    route: string | null;
    action: string | null;
    activity: string | null;
    country: string | null;
    region: string | null;
    ip_hash: string | null;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    locale: string | null;
    referrer_host: string | null;
    payload: Record<string, unknown>;
    created_at: string;
    author: string;
  }>;
  devices: Array<{
    device_type: string | null;
    browser: string | null;
    os: string | null;
    events: number;
    people: number;
  }>;
  locations: Array<{
    country: string | null;
    region: string | null;
    events: number;
    people: number;
  }>;
  retention: Array<{
    cohort_week: string;
    cohort_size: number;
    activation_eligible: number;
    activated_7d: number;
    d1_eligible: number;
    d1_retained: number;
    d7_eligible: number;
    d7_retained: number;
    d30_eligible: number;
    d30_retained: number;
  }>;
  commerce: {
    by_currency: Array<{
      currency: string;
      gross_minor: number | string;
      gross_30d_minor: number | string | null;
      successful_payments: number;
      paying_customers: number;
      ltv_minor: number | string | null;
    }>;
    mrr_by_currency: Array<{ currency: string; mrr_minor: number | string }>;
    active_subscriptions: number;
    cancellations_30d: number;
    past_due_subscriptions: number;
    paying_accounts: number;
    failed_payments_30d: number;
    total_accounts: number;
  };
  snapshots: Array<{ snapshot_day: string; metrics: Record<string, unknown> }>;
  learning: Array<{
    language_code: string;
    level: string;
    skill: string;
    variant_id: string;
    answers: number;
    sessions: number;
    first_try_correct: number;
    average_attempts: number;
    hints_used: number;
    skipped: number;
    average_duration_ms: number | null;
  }>;
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
        const result = await readAdminJson<AnalyticsData>(response);
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
  const totalViews = (data?.pages ?? []).reduce((sum, item) => sum + item.views, 0);
  const totalActions = (data?.actions ?? []).reduce((sum, item) => sum + item.clicks, 0);
  const maxPageViews = Math.max(1, ...(data?.pages ?? []).map((item) => item.views));
  const maxActionClicks = Math.max(1, ...(data?.actions ?? []).map((item) => item.clicks));
  const activeShare = data?.summary?.total_users
    ? Math.round((data.summary.active_users_7d / data.summary.total_users) * 100)
    : 0;
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
              <article>
                <span>DAU</span>
                <strong>{data.summary?.dau ?? 0}</strong>
                <small>уникальных сегодня · UTC</small>
              </article>
              <article className="pro">
                <span>MAU</span>
                <strong>{data.summary?.mau ?? 0}</strong>
                <small>за последние 30 дней</small>
              </article>
              <article>
                <span>WAU</span>
                <strong>{data.summary?.wau ?? 0}</strong>
                <small>за последние 7 дней</small>
              </article>
              <article className="pro">
                <span>Липкость DAU/MAU</span>
                <strong>{data.summary?.stickiness ?? 0}%</strong>
                <small>доля дневной аудитории</small>
              </article>
              <article className="muted">
                <span>Отток аккаунтов</span>
                <strong>{data.summary?.user_churn_rate_30d ?? 0}%</strong>
                <small>{data.summary?.churned_users_30d ?? 0} из активных месяц назад</small>
              </article>
              <article>
                <span>Возвращаются гости</span>
                <strong>{data.summary?.returning_guests_30d ?? 0}</strong>
                <small>за последние 30 дней</small>
              </article>
              <article className="muted">
                <span>Отток гостей</span>
                <strong>{data.summary?.guest_churn_rate_30d ?? 0}%</strong>
                <small>{data.summary?.churned_guests_30d ?? 0} гостей</small>
              </article>
              <article>
                <span>Гости</span>
                <strong>{data.summary?.guests_30d ?? 0}</strong>
                <small>уникальных за 30 дней</small>
              </article>
              <article>
                <span>Активные подписки</span>
                <strong>{data.commerce?.active_subscriptions ?? 0}</strong>
                <small>тарифы с доступом на сегодня</small>
              </article>
              <article className="muted">
                <span>Отзывы</span>
                <strong>{data.summary?.feedback_count ?? 0}</strong>
                <small>средняя оценка {data.summary?.feedback_average ?? "—"} / 5</small>
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
            <div className="analytics-insight-grid">
              <section className="analytics-panel analytics-engagement-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Здоровье аудитории</h2>
                    <p>Доля пользователей, которые возвращались за последние 7 дней.</p>
                  </div>
                  <span>7 дней</span>
                </div>
                <div className="analytics-donut-row">
                  <div
                    className="analytics-donut"
                    style={{ "--value": `${activeShare * 3.6}deg` } as React.CSSProperties}
                    role="img"
                    aria-label={`${activeShare}% активных пользователей`}
                  >
                    <strong>{activeShare}%</strong>
                    <small>активны</small>
                  </div>
                  <div className="analytics-mini-facts">
                    <article>
                      <strong>{data.summary.active_users_7d}</strong>
                      <span>вернулись за неделю</span>
                    </article>
                    <article>
                      <strong>{totalViews}</strong>
                      <span>просмотров разделов</span>
                    </article>
                    <article>
                      <strong>{totalActions}</strong>
                      <span>целевых действий</span>
                    </article>
                  </div>
                </div>
              </section>
              <section className="analytics-panel analytics-ranking-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Вовлечение по разделам</h2>
                    <p>Какие части приложения открывают чаще всего.</p>
                  </div>
                </div>
                <div className="analytics-horizontal-bars">
                  {data.pages.slice(0, 6).map((item) => (
                    <article key={item.route}>
                      <div>
                        <strong>{routeName(item.route)}</strong>
                        <span>{item.views}</span>
                      </div>
                      <i>
                        <b style={{ width: `${(item.views / maxPageViews) * 100}%` }} />
                      </i>
                    </article>
                  ))}
                  {!data.pages.length && (
                    <p className="admin-analytics-empty">Данные появятся после просмотров.</p>
                  )}
                </div>
              </section>
              <section className="analytics-panel analytics-ranking-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Популярные действия</h2>
                    <p>Что пользователи нажимают внутри приложения.</p>
                  </div>
                </div>
                <div className="analytics-horizontal-bars action-bars">
                  {data.actions.slice(0, 6).map((item) => (
                    <article key={`${item.route}-${item.action}`}>
                      <div>
                        <strong>{actionName(item.action)}</strong>
                        <span>{item.clicks}</span>
                      </div>
                      <i>
                        <b style={{ width: `${(item.clicks / maxActionClicks) * 100}%` }} />
                      </i>
                    </article>
                  ))}
                  {!data.actions.length && (
                    <p className="admin-analytics-empty">Данные появятся после действий.</p>
                  )}
                </div>
              </section>
            </div>
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
                    <h2>Устройства</h2>
                    <p>Сегменты посетителей за последние 30 дней.</p>
                  </div>
                </div>
                {data.devices.length ? (
                  <div className="analytics-row-list">
                    {data.devices.map((item, index) => (
                      <article key={`${item.device_type}-${item.browser}-${item.os}-${index}`}>
                        <strong>{item.device_type ?? "Неизвестное устройство"}</strong>
                        <span>{item.people} посетителей</span>
                        <small>{item.browser ?? "браузер неизвестен"} · {item.os ?? "OS неизвестна"} · {item.events} событий</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">Данные появятся после согласия на аналитику.</p>
                )}
              </section>
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Локации</h2>
                    <p>Приблизительное местоположение по заголовкам платформы.</p>
                  </div>
                </div>
                {data.locations.length ? (
                  <div className="analytics-row-list">
                    {data.locations.map((item, index) => (
                      <article key={`${item.country}-${item.region}-${index}`}>
                        <strong>{[item.region, item.country].filter(Boolean).join(", ") || "Не определена"}</strong>
                        <span>{item.people} посетителей</span>
                        <small>{item.events} событий</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">Пока нет данных о регионах.</p>
                )}
              </section>
            </div>
            <div className="analytics-two-column">
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Когортное удержание</h2>
                    <p>Возврат в точный день после регистрации; только созревшие когорты.</p>
                  </div>
                  <span>вся история</span>
                </div>
                {data.retention.length ? (
                  <div className="analytics-row-list">
                    {data.retention.map((item) => (
                      <article key={item.cohort_week}>
                        <strong>
                          Неделя с {new Date(item.cohort_week).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </strong>
                        <span>{item.cohort_size} регистраций</span>
                        <small>
                          Активация 7д {retentionRate(item.activated_7d, item.activation_eligible)} · D1 {retentionRate(item.d1_retained, item.d1_eligible)} · D7 {retentionRate(item.d7_retained, item.d7_eligible)} · D30 {retentionRate(item.d30_retained, item.d30_eligible)}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-analytics-empty">Когорты появятся после регистрации и согласованных событий активности.</p>
                )}
              </section>
              <section className="analytics-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <h2>Выручка и LTV</h2>
                    <p>LTV — фактическая выручка на платящего клиента, отдельно по валютам.</p>
                  </div>
                </div>
                <div className="analytics-row-list">
                  <article><strong>Платящие аккаунты</strong><span>{data.commerce.paying_accounts}</span><small>конверсия от регистраций {percentage(data.commerce.paying_accounts, data.commerce.total_accounts)}</small></article>
                  <article><strong>Активные подписки</strong><span>{data.commerce.active_subscriptions}</span><small>{data.commerce.cancellations_30d} отмен за 30 дней · {data.commerce.past_due_subscriptions} просрочены</small></article>
                  <article><strong>Неуспешные платежи</strong><span>{data.commerce.failed_payments_30d}</span><small>за последние 30 дней</small></article>
                  {data.commerce.by_currency.map((item) => (
                    <article key={item.currency}>
                      <strong>{item.currency} · {formatMinorMoney(item.gross_minor, item.currency)} всего</strong>
                      <span>LTV {formatMinorMoney(item.ltv_minor, item.currency)}</span>
                      <small>{item.paying_customers} клиентов · {item.successful_payments} платежей · {formatMinorMoney(item.gross_30d_minor, item.currency)} за 30 дней</small>
                    </article>
                  ))}
                  {data.commerce.mrr_by_currency.map((item) => (
                    <article key={`mrr-${item.currency}`}>
                      <strong>MRR · {item.currency}</strong>
                      <span>{formatMinorMoney(item.mrr_minor, item.currency)}</span>
                      <small>месячный эквивалент действующих подписок</small>
                    </article>
                  ))}
                </div>
                {!data.commerce.by_currency.length && (
                  <p className="admin-analytics-empty">Подтверждённых платежей пока нет. Checkout сейчас отключён, поэтому фактический LTV появится после подключения оплаты.</p>
                )}
              </section>
            </div>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <h2>История метрик по дням</h2>
                  <p>Ежедневные снимки DAU, WAU, MAU, оттока, подписок и выручки сохраняются без срока удаления.</p>
                </div>
                <span>{data.snapshots.length} дней</span>
              </div>
              {data.snapshots.length ? (
                <div className="analytics-row-list">
                  {data.snapshots.map((item) => (
                    <article key={item.snapshot_day}>
                      <strong>{new Date(item.snapshot_day).toLocaleDateString("ru-RU", { dateStyle: "medium" })}</strong>
                      <span>DAU {metricNumber(item.metrics, "dau")} · WAU {metricNumber(item.metrics, "wau")} · MAU {metricNumber(item.metrics, "mau")}</span>
                      <small>Отток {metricNumber(item.metrics, "user_churn_rate_30d")}% ({metricNumber(item.metrics, "churned_users_30d")} аккаунтов) · подписки: {metricNumber(item.metrics, "active_subscriptions")} · MRR: {snapshotMrr(item.metrics)} · платящие: {snapshotRevenueCustomers(item.metrics)} · выручка 30д: {snapshotMoney(item.metrics, "gross_30d_minor")} · LTV: {snapshotMoney(item.metrics, "ltv_minor")}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-analytics-empty">Первый полный дневной снимок появится после ночного запуска расписания.</p>
              )}
            </section>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <h2>Качество учебных сессий</h2>
                  <p>Последние 30 дней · показываются группы минимум из пяти ответов.</p>
                </div>
                <span>{data.learning.length} групп</span>
              </div>
              {data.learning.length ? (
                <div className="analytics-row-list">
                  {data.learning.map((item) => (
                    <article
                      key={`${item.language_code}-${item.level}-${item.skill}-${item.variant_id}`}
                    >
                      <strong>{item.variant_id || item.skill}</strong>
                      <span>
                        {item.language_code.toUpperCase()} · {item.level || "любой уровень"} ·{" "}
                        {item.skill}
                      </span>
                      <small>
                        {item.sessions} сессий ·{" "}
                        {Math.round((item.first_try_correct * 100) / Math.max(1, item.answers))}%
                        верно с первого раза · подсказок {item.hints_used} · пропусков{" "}
                        {item.skipped} · попыток {Number(item.average_attempts).toFixed(1)}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-analytics-empty">
                  Показатели появятся после нескольких игровых сессий.
                </p>
              )}
            </section>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <h2>Отзывы</h2>
                  <p>Автор, оценка, текст, дата, устройство и примерная локация.</p>
                </div>
                <span>{data.feedback.length} последних</span>
              </div>
              {data.feedback.length ? (
                <div className="analytics-row-list analytics-feedback-list">
                  {data.feedback.map((item) => (
                    <article key={item.id}>
                      <strong>{item.author}</strong>
                      <span aria-label={`${item.rating} из 5`}>
                        {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                      </span>
                      <small>
                        {item.email ||
                          (item.visitor_id
                            ? `ID гостя ${item.visitor_id.slice(0, 12)}`
                            : "Аккаунт")}
                        {item.country || item.region
                          ? ` · ${[item.region, item.country].filter(Boolean).join(", ")}`
                          : " · регион недоступен"}
                        {item.metadata?.deviceType
                          ? ` · ${item.metadata.deviceType}, ${item.metadata.browser ?? "браузер"}, ${item.metadata.os ?? "OS"}`
                          : ""}
                        {item.ip_hash ? ` · IP-хэш ${item.ip_hash.slice(0, 12)}` : ""}
                        {` · ${fmtDate(item.created_at)}`}
                      </small>
                      {item.choice && <em>{item.choice}</em>}
                      {item.text && <p>{item.text}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-analytics-empty">Отзывов пока нет.</p>
              )}
            </section>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <h2>Посетители и события</h2>
                  <p>Последние события с автором, временем, устройством и локацией.</p>
                </div>
                <span>{data.actors.length} последних</span>
              </div>
              {data.actors.length ? (
                <div className="analytics-row-list analytics-feedback-list">
                  {data.actors.map((item) => (
                    <article key={`${item.id}-${item.created_at}`}>
                      <strong>{item.author}</strong>
                      <span>{analyticsEventName(item.event_type)}</span>
                      <small>
                        {item.email ||
                          (item.visitor_id ? `ID гостя ${item.visitor_id}` : "")}
                        {item.country || item.region
                          ? ` · ${[item.region, item.country].filter(Boolean).join(", ")}`
                          : " · регион недоступен"}
                        {item.ip_hash ? ` · IP-хэш ${item.ip_hash}` : ""}
                        {item.device_type
                          ? ` · ${item.device_type}, ${item.browser ?? "браузер"}, ${item.os ?? "OS"}`
                          : ""}
                        {item.locale ? ` · ${item.locale}` : ""}
                        {item.referrer_host ? ` · источник ${item.referrer_host}` : ""}
                        {` · ${fmtDate(item.created_at)}`}
                      </small>
                      <p>
                        {item.action
                          ? `${actionName(item.action)} · `
                          : item.activity
                            ? `${item.activity} · `
                            : ""}
                        {routeName(item.route)}
                        {item.payload?.skill ? ` · ${String(item.payload.skill)}` : ""}
                        {typeof item.payload?.correct === "boolean"
                          ? item.payload.correct
                            ? " · верно"
                            : " · ошибка"
                          : ""}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-analytics-empty">События появятся после согласия на аналитику.</p>
              )}
            </section>
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
                          {item.email ? `${item.email} · ` : ""}
                          {routeName(item.route)} · {fmtDate(item.created_at)}
                          {(item.country || item.region)
                            ? ` · ${[item.region, item.country].filter(Boolean).join(", ")}`
                            : ""}
                          {item.device_type ? ` · ${item.device_type}` : ""}
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

function analyticsEventName(type: string) {
  return (
    ({
      "page-view": "Просмотр",
      "target-action": "Клик",
      "game-start": "Начало игры",
      "game-answer": "Ответ в игре",
      "game-skip": "Пропуск в игре",
      "game-progress": "Ход игры",
      "game-complete": "Игра завершена",
      "practice-start": "Начало упражнения",
      "practice-answer": "Ответ в упражнении",
      "practice-progress": "Ход упражнения",
      "practice-complete": "Упражнение завершено",
      "study-answer": "Ответ в обучении",
    } as Record<string, string>)[type] ?? type
  );
}

function retentionRate(retained: number, eligible: number) {
  if (!eligible) return "—";
  return `${Math.round((retained / eligible) * 1000) / 10}% (${retained}/${eligible})`;
}

function percentage(value: number, total: number) {
  if (!total) return "—";
  return `${Math.round((value / total) * 1000) / 10}%`;
}

function formatMinorMoney(value: number | string | null, currency: string) {
  const minor = Number(value);
  if (!Number.isFinite(minor)) return "—";
  try {
    const currencyFormatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    });
    const digits = currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(
      minor / 10 ** digits,
    );
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function metricNumber(metrics: Record<string, unknown>, key: string) {
  const value = Number(metrics[key]);
  return Number.isFinite(value) ? value.toLocaleString("ru-RU") : "—";
}

function snapshotRevenueCustomers(metrics: Record<string, unknown>) {
  const breakdown = metrics.revenue_by_currency;
  if (!Array.isArray(breakdown)) return "—";
  return breakdown.reduce((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    const count = Number((row as Record<string, unknown>).paying_customers);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);
}

function snapshotMoney(metrics: Record<string, unknown>, key: "gross_30d_minor" | "ltv_minor") {
  const breakdown = metrics.revenue_by_currency;
  if (!Array.isArray(breakdown)) return "—";
  const values = breakdown.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.currency !== "string" || item[key] == null) return [];
    return [`${item.currency} ${formatMinorMoney(item[key] as number | string, item.currency)}`];
  });
  return values.length ? values.join(" · ") : "—";
}

function snapshotMrr(metrics: Record<string, unknown>) {
  const breakdown = metrics.mrr_by_currency;
  if (!Array.isArray(breakdown)) return "—";
  const values = breakdown.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.currency !== "string" || item.mrr_minor == null) return [];
    return [`${item.currency} ${formatMinorMoney(item.mrr_minor as number | string, item.currency)}`];
  });
  return values.length ? values.join(" · ") : "—";
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
