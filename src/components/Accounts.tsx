import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client";
import { saveMediaFile } from "../lib/mediaStore";
import { Icon } from "./Icon";

export type AppRole = "owner" | "admin" | "editor" | "student";
export type AppPermissions = {
  manageContent: boolean;
  manageUsers: boolean;
  viewAnalytics: boolean;
  manageSettings: boolean;
  hiddenSections?: string[];
};
export type AccountUser = {
  id: string;
  name: string;
  email: string;
  role?: AppRole | string;
  image?: string | null;
  permissions?: AppPermissions;
  isPro?: boolean;
  proStartsAt?: string | null;
  proEndsAt?: string | null;
};
export type Credentials = {
  mode: "sign-in" | "sign-up";
  name: string;
  email: string;
  password: string;
};
type BooleanPermission = Exclude<keyof AppPermissions, "hiddenSections">;
function currencyScale(currency: string) {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
    return 10 ** (digits ?? 2);
  } catch {
    return 100;
  }
}
function formatMinorCurrency(amountMinor: number, currency: string) {
  const amount = amountMinor / currencyScale(currency);
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.log10(currencyScale(currency)),
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
const permissionLabels: Record<BooleanPermission, string> = {
  manageContent: "Создавать и редактировать модули, игры и уроки",
  manageUsers: "Управлять аккаунтами и ролями",
  viewAnalytics: "Просматривать прогресс и ошибки пользователей",
  manageSettings: "Настраивать права владельца",
};

type AuthView = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
function authResetToken() {
  const fromSearch = new URLSearchParams(window.location.search).get("token");
  const hashQuery = window.location.hash.split("?").slice(1).join("?");
  return fromSearch || new URLSearchParams(hashQuery).get("token") || "";
}
function authResetError() {
  const hashQuery = window.location.hash.split("?").slice(1).join("?");
  const code =
    new URLSearchParams(window.location.search).get("error") ||
    new URLSearchParams(hashQuery).get("error");
  return code
    ? "Ссылка для сброса устарела или уже использована. Запросите новую через «Забыли пароль?»."
    : "";
}

export function AuthScreen({
  error,
  busy,
  onSubmit,
  onRetry,
  onRequestPasswordReset,
  onResetPassword,
  startView = "sign-in",
  guestRequired = false,
  onBack,
}: {
  error: string;
  busy: boolean;
  onSubmit: (credentials: Credentials) => Promise<boolean>;
  onRetry: () => void;
  onRequestPasswordReset: (email: string) => Promise<boolean>;
  onResetPassword: (token: string, password: string) => Promise<boolean>;
  startView?: "sign-in" | "sign-up";
  guestRequired?: boolean;
  onBack?: () => void;
}) {
  const resetToken = authResetToken();
  const [view, setView] = useState<AuthView>(() => (resetToken ? "reset-password" : startView));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState(authResetError);
  const title =
    view === "sign-in"
      ? "С возвращением"
      : view === "sign-up"
        ? "Создайте аккаунт"
        : view === "forgot-password"
          ? "Восстановите доступ"
          : "Новый пароль";
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setLocalError("");
    if (view === "sign-up") {
      if (password.length < 8) {
        setLocalError("Пароль должен содержать не менее 8 символов.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Пароли не совпадают.");
        return;
      }
      if (await onSubmit({ mode: "sign-up", name: name.trim(), email: email.trim(), password }))
        setNotice(
          "Если адрес новый, мы отправили письмо для подтверждения. Если аккаунт уже создан, откройте письмо о входе или нажмите «Забыли пароль?». Проверьте также папку «Спам».",
        );
      return;
    }
    if (view === "sign-in") {
      await onSubmit({ mode: "sign-in", name: "", email: email.trim(), password });
      return;
    }
    if (view === "forgot-password") {
      if (await onRequestPasswordReset(email.trim()))
        setNotice(
          "Если аккаунт с таким адресом существует, мы отправили ссылку для сброса пароля.",
        );
      return;
    }
    if (!resetToken) {
      setLocalError("В ссылке нет токена сброса. Запросите новое письмо.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Пароль должен содержать не менее 8 символов.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Пароли не совпадают.");
      return;
    }
    if (await onResetPassword(resetToken, password)) {
      setView("sign-in");
      setPassword("");
      setConfirmPassword("");
      setNotice("Пароль обновлён. Теперь войдите с новым паролем.");
    }
  };
  return (
    <main className="account-screen">
      <div className="account-layout">
        <section className="account-showcase" aria-label="Возможности ClickLing">
          <div className="account-showcase-copy">
            <span className="account-showcase-badge">УЧИТЕСЬ В СВОЁМ РИТМЕ</span>
            <h2>Немецкий, который становится привычкой</h2>
            <p>
              Короткие маршруты, живые игры и умное повторение слов — всё в одном учебном
              пространстве.
            </p>
            <ul>
              <li>
                <Icon name="check" size={15} /> Прогресс на всех устройствах
              </li>
              <li>
                <Icon name="check" size={15} /> Игровой путь от A1 до C1
              </li>
              <li>
                <Icon name="check" size={15} /> Личная библиотека и тренировки
              </li>
            </ul>
          </div>
          <img src="/mascots/mascot-5.png" alt="" aria-hidden="true" />
          <span className="account-showcase-orbit orbit-one">der</span>
          <span className="account-showcase-orbit orbit-two">Hallo!</span>
        </section>
        <section className="account-card">
          {onBack && (
            <button className="account-back-button" onClick={onBack}>
              ← Вернуться к обучению
            </button>
          )}
          <div className="account-logo">
            <span>L</span>
            <strong>ClickLing</strong>
          </div>
          <p className="eyebrow">ЛИЧНЫЙ УЧЕБНЫЙ КАБИНЕТ</p>
          <h1>{guestRequired && view === "sign-up" ? "Продолжите обучение" : title}</h1>
          <p className="account-lead">
            {guestRequired
              ? "Пробная игра уже пройдена. Создайте аккаунт, чтобы сохранить прогресс и продолжить занятия."
              : "Прогресс, словари, игры и достижения будут храниться отдельно для каждого пользователя."}
          </p>
          <form onSubmit={(event) => void submit(event)}>
            {view === "sign-up" && (
              <label className="field-label">
                Как вас зовут?
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            {view === "sign-up" && (
              <p className="account-privacy-copy">
                После подтверждения почты прогресс будет синхронизироваться между устройствами.
                Владелец видит агрегированные результаты, но не свободный текст ваших ответов.
                Подробнее — в настройках аккаунта.
              </p>
            )}
            {view !== "reset-password" && (
              <label className="field-label">
                Электронная почта
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
            )}
            {(view === "sign-in" || view === "sign-up") && (
              <p className="auth-method-note">
                Подойдёт Gmail или любая другая почта. Вход кнопкой Google и по SMS пока не
                подключён.
              </p>
            )}
            {view !== "forgot-password" && (
              <label className="field-label">
                {view === "reset-password" ? "Новый пароль" : "Пароль"}
                <input
                  type="password"
                  autoComplete={view === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  aria-describedby={
                    view === "sign-up" || view === "reset-password"
                      ? "auth-password-help"
                      : undefined
                  }
                />
                {(view === "sign-up" || view === "reset-password") && (
                  <small id="auth-password-help" className="field-help">
                    Не менее 8 символов.
                  </small>
                )}
              </label>
            )}
            {(view === "sign-up" || view === "reset-password") && (
              <label className="field-label">
                Повторите пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            )}
            {(error || localError) && (
              <p className="form-error" role="alert">
                {localError || error}
              </p>
            )}
            {notice && (
              <p className="account-success" role="status">
                {notice}
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={
                busy ||
                (view === "sign-up" && password !== confirmPassword) ||
                (view === "reset-password" && password !== confirmPassword)
              }
            >
              {busy
                ? "Подключаем кабинет…"
                : view === "sign-in"
                  ? "Войти"
                  : view === "sign-up"
                    ? "Зарегистрироваться"
                    : view === "forgot-password"
                      ? "Отправить ссылку"
                      : "Сохранить новый пароль"}
            </button>
          </form>
          {view === "sign-in" && (
            <button
              className="account-mode-switch"
              onClick={() => {
                setView("forgot-password");
                setNotice("");
                setLocalError("");
              }}
            >
              Забыли пароль?
            </button>
          )}
          {view === "sign-in" && (
            <button
              className="account-mode-switch"
              onClick={() => {
                setView("sign-up");
                setPassword("");
                setConfirmPassword("");
                setNotice("");
                setLocalError("");
              }}
            >
              Нет аккаунта? Зарегистрироваться
            </button>
          )}
          {view === "sign-up" && (
            <button
              className="account-mode-switch"
              onClick={() => {
                setView("sign-in");
                setPassword("");
                setConfirmPassword("");
                setNotice("");
                setLocalError("");
              }}
            >
              Уже есть аккаунт? Войти
            </button>
          )}
          {(view === "sign-up" || view === "forgot-password" || view === "reset-password") && (
            <button
              className="account-mode-switch"
              onClick={() => {
                setView("sign-in");
                setPassword("");
                setConfirmPassword("");
                setNotice("");
                setLocalError("");
              }}
            >
              Вернуться ко входу
            </button>
          )}
          <button className="account-retry" onClick={onRetry}>
            <Icon name="refresh" size={14} /> Проверить соединение
          </button>
        </section>
      </div>
    </main>
  );
}

export function AccountPanel({
  user,
  openAdminOnMount = false,
  onClose,
  onSignOut,
  onAccountDeleted,
  onUpdated,
}: {
  user: AccountUser;
  openAdminOnMount?: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onAccountDeleted: () => void;
  onUpdated?: (update: Partial<AccountUser>) => void;
}) {
  const [adminOpen, setAdminOpen] = useState(openAdminOnMount);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [savedName, setSavedName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncMessage, setSyncMessage] = useState(
    "Данные кабинета синхронизируются между устройствами.",
  );
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ state: "saved" | "error"; message?: string }>).detail;
      setSyncMessage(
        detail.state === "error"
          ? detail.message || "Синхронизация не удалась."
          : "Изменения сохранены на сервере.",
      );
    };
    window.addEventListener("linguaplay-sync-status", update);
    return () => window.removeEventListener("linguaplay-sync-status", update);
  }, []);
  const saveProfile = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) throw new Error(result.error.message);
      setSavedName(name.trim());
      onUpdated?.({ name: name.trim() });
      setNotice("Имя профиля обновлено.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить профиль.");
    } finally {
      setBusy(false);
    }
  };
  const changeEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authClient.changeEmail({
        newEmail: email.trim(),
        callbackURL: `${window.location.origin}/`,
      });
      if (result.error) throw new Error(result.error.message);
      setNotice(
        "Если адрес доступен, на текущую почту отправлено подтверждение. После него подтвердите новый адрес. До завершения используйте прежний логин.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить почту.");
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message);
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Пароль изменён. Другие сеансы завершены.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить пароль.");
    } finally {
      setBusy(false);
    }
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      setError("Выберите изображение размером до 4 МБ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = `profile-${user.id}`;
      await saveMediaFile(id, file);
      const result = await authClient.updateUser({
        image: `/api/media?id=${encodeURIComponent(id)}&v=${Date.now()}`,
      });
      if (result.error) throw new Error(result.error.message);
      onUpdated?.({ image: `/api/media?id=${encodeURIComponent(id)}&v=${Date.now()}` });
      setNotice("Фото профиля обновлено.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить фото.");
    } finally {
      setBusy(false);
    }
  };
  const deleteAccount = async () => {
    if (
      !deletePassword ||
      !window.confirm("Удалить аккаунт и весь его прогресс без возможности восстановления?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.deleteUser({ password: deletePassword });
      if (result.error) throw new Error(result.error.message);
      onAccountDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить аккаунт.");
    } finally {
      setBusy(false);
    }
  };
  const role = user.role ?? "student";
  return (
    <div
      className="modal-backdrop account-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card account-panel account-profile-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-panel-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <img
          className="account-profile-mascot"
          src="/mascots/mascot-8.png"
          alt=""
          aria-hidden="true"
        />
        <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
        <div className="account-profile-heading">
          {user.image ? (
            <img src={user.image} alt="Фото профиля" />
          ) : (
            <span>{user.name.slice(0, 1).toLocaleUpperCase()}</span>
          )}
          <div>
            <h2 id="account-panel-title">{savedName}</h2>
            <p className="account-email">{user.email}</p>
            <span className={`account-role ${role === "owner" || role === "admin" ? "admin" : ""}`}>
              {roleName(role)}
            </span>
            {user.isPro && <span className="account-pro-badge">PRO</span>}
          </div>
        </div>
        <p className="account-sync-note">
          <Icon name="check" size={16} />
          {syncMessage}
        </p>
        <div className="account-profile-fields">
          <label className="field-label">
            Имя
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="secondary-button compact account-file-button">
            Изменить фото
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
          </label>
          <button
            className="secondary-button compact"
            disabled={busy || !name.trim() || name.trim() === savedName}
            onClick={() => void saveProfile()}
          >
            Сохранить профиль
          </button>
        </div>
        <details className="account-details">
          <summary>Изменить почту / логин</summary>
          <form className="account-password-fields" onSubmit={(event) => void changeEmail(event)}>
            <p className="field-help">
              Ваша почта — это логин. Смена требует подтверждения текущего и нового адреса.
            </p>
            <label className="field-label">
              Новая электронная почта
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              className="secondary-button compact"
              disabled={
                busy || !email.trim() || email.trim().toLowerCase() === user.email.toLowerCase()
              }
            >
              Отправить подтверждение
            </button>
          </form>
        </details>
        <BillingStatus />
        <details className="account-details">
          <summary>Приватность и данные</summary>
          <p className="account-privacy-copy">
            Синхронизируются имя настроек обучения, карточки и ход занятий. Владелец видит
            агрегированную активность, ошибки и прогресс; администраторам контента этот журнал
            недоступен. Свободные ответы и записи микрофона не сохраняются в журнале событий.
            Технические события хранятся 90 дней, результаты AI-оценки удаляются через 24 часа.
            Запись микрофона включается только по вашему действию и остаётся в браузере, если
            отдельно не отправлена.
          </p>
          <p className="account-privacy-copy">
            Удаление аккаунта удаляет его профиль, материалы и медиа. Синхронизацию можно проверить
            в этом окне; удаление аккаунта — внизу страницы.
          </p>
        </details>
        <details className="account-details">
          <summary>Изменить пароль</summary>
          <div className="account-password-fields">
            <label className="field-label">
              Текущий пароль
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              Новый пароль
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button
              className="secondary-button compact"
              disabled={busy || !currentPassword || newPassword.length < 8}
              onClick={() => void changePassword()}
            >
              Обновить пароль
            </button>
          </div>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="account-success" role="status">
            {notice}
          </p>
        )}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onSignOut}>
            Выйти
          </button>
          <button
            className="text-danger account-delete-toggle"
            onClick={() => setNotice("Для удаления введите пароль ниже.")}
          >
            Удалить аккаунт
          </button>
        </div>
        {notice === "Для удаления введите пароль ниже." && (
          <div className="account-delete-row">
            <input
              type="password"
              placeholder="Подтвердите пароль"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            <button
              className="text-danger"
              disabled={busy || !deletePassword}
              onClick={() => void deleteAccount()}
            >
              Подтвердить удаление
            </button>
          </div>
        )}
      </section>
      {adminOpen && <AdminUsersPanel currentUser={user} onClose={() => setAdminOpen(false)} />}
    </div>
  );
}

function BillingStatus() {
  type Plan = {
    code: string;
    name: string;
    amountMinor: number;
    currency: string;
    interval: string;
    features?: { benefits?: string[] };
  };
  const [data, setData] = useState<{
    plans?: Plan[];
    entitlement?: { active: boolean; endsAt: string | null };
    checkoutEnabled?: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void fetch("/api/billing", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as typeof data & { error?: string };
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить тариф.");
        if (alive) setData(result);
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "Не удалось загрузить тариф.");
      });
    return () => {
      alive = false;
    };
  }, []);
  const date = data?.entitlement?.endsAt
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(
        new Date(data.entitlement.endsAt),
      )
    : "";
  return (
    <section className="account-billing">
      <div className="account-billing-heading">
        <div>
          <span className="eyebrow">ТАРИФ И ОПЛАТА</span>
          <strong>
            {data?.entitlement?.active ? "ClickLing PRO активен" : "Ваш учебный план"}
          </strong>
          <small>
            {data?.entitlement?.active && date
              ? `Доступ открыт до ${date}`
              : "Начните бесплатно и подключите PRO, когда будете готовы."}
          </small>
        </div>
        <span className={`billing-status ${data?.entitlement?.active ? "active" : ""}`}>
          {data?.entitlement?.active ? "PRO" : "FREE"}
        </span>
      </div>
      {error ? (
        <small className="billing-message">{error}</small>
      ) : (
        data && (
          <>
            <div className="account-plan-list">
              {(data.plans ?? []).map((plan) => (
                <article key={plan.code}>
                  <strong>{plan.name}</strong>
                  <div>
                    <b>{formatMinorCurrency(plan.amountMinor, plan.currency)}</b>
                    <small>
                      /{" "}
                      {plan.interval === "month"
                        ? "месяц"
                        : plan.interval === "year"
                          ? "год"
                          : "разово"}
                    </small>
                  </div>
                  {(plan.features?.benefits ?? []).length > 0 && (
                    <ul>
                      {plan.features!.benefits!.slice(0, 8).map((benefit, benefitIndex) => (
                        <li key={`${plan.code}-${benefitIndex}`}>
                          <Icon name="check" size={13} /> {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button className="primary-button compact" disabled={!data.checkoutEnabled}>
                    Выбрать план
                  </button>
                </article>
              ))}
            </div>
            {!data.checkoutEnabled && (
              <small className="billing-message">
                <Icon name="info" size={14} />
                {data.message || "Оплата временно недоступна."}
              </small>
            )}
          </>
        )
      )}
    </section>
  );
}

function BillingPlanManager() {
  type Plan = {
    code: string;
    name: string;
    amountMinor: number;
    currency: string;
    interval: "month" | "year" | "once";
    features?: { benefits?: string[] };
    active: boolean;
  };
  const blank = {
    code: "",
    name: "",
    amount: "",
    currency: "EUR",
    interval: "month" as Plan["interval"],
    benefits: "",
    active: false,
    reason: "",
  };
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing", { credentials: "include", cache: "no-store" });
      const result = (await response.json()) as { plans?: Plan[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить тарифы.");
      setPlans(result.plans ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить тарифы.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const edit = (plan?: Plan) => {
    setError("");
    setNotice("");
    setForm(
      plan
        ? {
            code: plan.code,
            name: plan.name,
            amount: String(
              (plan.amountMinor / currencyScale(plan.currency)).toFixed(
                Math.log10(currencyScale(plan.currency)),
              ),
            ),
            currency: plan.currency,
            interval: plan.interval,
            benefits: (plan.features?.benefits ?? []).join("\n"),
            active: plan.active,
            reason: "",
          }
        : { ...blank },
    );
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    const scale = currencyScale(form.currency);
    if (!Number.isFinite(amount) || amount < 0 || Math.round(amount * scale) > 2_147_483_647) {
      setError("Укажите корректную цену в основной валютной единице.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Укажите причину изменения тарифа для журнала владельца.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-plan",
          code: form.code,
          name: form.name,
          amountMinor: Math.round(amount * scale),
          currency: form.currency,
          interval: form.interval,
          features: {
            benefits: form.benefits
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          },
          active: form.active,
          reason: form.reason,
        }),
      });
      const result = (await response.json()) as { plan?: Plan; error?: string };
      if (!response.ok || !result.plan)
        throw new Error(result.error || "Не удалось сохранить тариф.");
      setPlans((current) => [
        result.plan!,
        ...current.filter((plan) => plan.code !== result.plan!.code),
      ]);
      setNotice("Тариф сохранён. Покупка остаётся выключенной до подключения провайдера.");
      setForm({ ...blank });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить тариф.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="admin-billing-plans">
      <h3>Тарифы PRO</h3>
      <p className="catalog-privacy-note">
        Настройка каталога и цен. Checkout выключен, пока не настроены платёжный провайдер и
        реальные цены.
      </p>
      {loading ? (
        <p className="empty-inline">Загружаю тарифы…</p>
      ) : (
        <div className="admin-plan-list">
          {plans.map((plan) => (
            <article key={plan.code}>
              <span>
                <strong>{plan.name}</strong>
                <small>
                  {plan.code} · {plan.currency} · {plan.interval} ·{" "}
                  {plan.active ? "виден в каталоге" : "черновик"}
                </small>
              </span>
              <button className="secondary-button compact" onClick={() => edit(plan)}>
                Изменить
              </button>
            </article>
          ))}
          {!plans.length && <p className="empty-inline">Тарифы ещё не настроены.</p>}
        </div>
      )}
      <form className="admin-plan-form" onSubmit={(event) => void save(event)}>
        <div className="catalog-form-grid">
          <label className="field-label">
            Код тарифа
            <input
              required
              maxLength={40}
              pattern="[a-z0-9][a-z0-9_-]{1,39}"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })}
            />
          </label>
          <label className="field-label">
            Название
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="field-label">
            Цена
            <input
              required
              type="number"
              min="0"
              step={String(1 / currencyScale(form.currency))}
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </label>
          <label className="field-label">
            Валюта
            <input
              required
              maxLength={3}
              pattern="[A-Za-z]{3}"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
            />
          </label>
          <label className="field-label">
            Период
            <select
              value={form.interval}
              onChange={(event) =>
                setForm({ ...form, interval: event.target.value as Plan["interval"] })
              }
            >
              <option value="month">Месяц</option>
              <option value="year">Год</option>
              <option value="once">Разовый</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Включённые возможности
          <textarea
            rows={3}
            value={form.benefits}
            onChange={(event) => setForm({ ...form, benefits: event.target.value })}
            placeholder="Одна возможность на строку"
          />
        </label>
        <label className="admin-plan-toggle">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
          />{" "}
          Показывать тариф ученикам
        </label>
        <label className="field-label">
          Причина изменения
          <input
            required
            maxLength={300}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="catalog-notice" role="status">
            {notice}
          </p>
        )}
        <div className="catalog-actions">
          <button className="secondary-button" type="button" onClick={() => edit()}>
            Новый тариф
          </button>
          <button className="primary-button" type="submit" disabled={working}>
            {working ? "Сохраняю…" : "Сохранить тариф"}
          </button>
        </div>
      </form>
    </section>
  );
}

function roleName(role: string) {
  return (
    (
      {
        owner: "Владелец",
        admin: "Администратор",
        editor: "Выбрать роль",
        student: "Ученик",
      } as Record<string, string>
    )[role] ?? "Ученик"
  );
}
type AdminState = {
  users: Array<
    AccountUser & {
      created_at: string;
      event_count: number;
      errors: number;
      last_activity: string | null;
    }
  >;
  events: Array<{
    id: number;
    name: string;
    event_type: string;
    module_title: string;
    activity: string;
    round_index: number;
    round_total: number;
    prompt: string;
    selected_answer: string;
    correct_answer: string;
    is_correct: boolean;
    created_at: string;
  }>;
  active: Array<{
    user_id: string;
    name: string;
    activity_title: string;
    module_title: string;
    current_index: number;
    total: number;
    updated_at: string;
  }>;
  actor: { role: string; permissions: AppPermissions };
};

function AdminUsersPanel({
  currentUser,
  onClose,
}: {
  currentUser: AccountUser;
  onClose: () => void;
}) {
  const [data, setData] = useState<AdminState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState("");
  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin", { credentials: "include", cache: "no-store" });
      const result = (await response.json()) as AdminState & { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить данные.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить пользователей.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  const changeRole = async (
    user: AccountUser & { permissions?: AppPermissions },
    role: string,
    permissions = user.permissions,
  ) => {
    setWorkingId(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role, permissions }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось изменить права.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить права.");
    } finally {
      setWorkingId("");
    }
  };
  const removeUser = async (user: AccountUser) => {
    if (!window.confirm(`Удалить аккаунт ${user.name} и его прогресс?`)) return;
    setWorkingId(user.id);
    try {
      const response = await fetch(`/api/admin?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось удалить пользователя.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить аккаунт.");
    } finally {
      setWorkingId("");
    }
  };
  const resetPassword = async (user: AccountUser) => {
    const password = window.prompt(
      `Новый временный пароль для ${user.name} (не менее 8 символов):`,
    );
    if (!password) return;
    if (password.length < 8) {
      setError("Пароль должен содержать не менее 8 символов.");
      return;
    }
    setWorkingId(user.id);
    try {
      const result = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: password,
      });
      if (result.error) throw new Error(result.error.message);
      window.alert(`Пароль для ${user.email} изменён.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сбросить пароль.");
    } finally {
      setWorkingId("");
    }
  };
  const deployGitHubProduction = async () => {
    setDeploying(true);
    setDeployMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deploy-github-production" }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось запустить деплой.");
      setDeployMessage(result.message || "Деплой запущен.");
    } catch (cause) {
      setDeployMessage(cause instanceof Error ? cause.message : "Не удалось запустить деплой.");
    } finally {
      setDeploying(false);
    }
  };
  const canEdit = Boolean(data?.actor.role === "owner");
  return (
    <div
      className="modal-backdrop admin-users-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card admin-users-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-users-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
        <h2 id="admin-users-title">Аккаунты, права и журнал</h2>
        <p className="account-lead">
          Ученик видит только свои результаты. Владелец управляет иерархией ролей и разрешениями.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {data?.actor.permissions.manageSettings && (
          <section className="admin-deploy-box">
            <div>
              <strong>Публикация сайта</strong>
              <p>
                Запускает Production-деплой из подключённой GitHub-ветки Vercel. Локальные изменения
                сначала нужно отправить в GitHub; текущую копию с компьютера я выкатываю через
                Vercel CLI.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={deploying}
              onClick={() => void deployGitHubProduction()}
            >
              {deploying ? "Запускаю…" : "Развернуть из GitHub"}
            </button>
            {deployMessage && <small role="status">{deployMessage}</small>}
          </section>
        )}
        {busy ? (
          <p className="empty-inline">Загружаю пользователей и историю…</p>
        ) : (
          data && (
            <>
              <div className="admin-summary">
                <span>
                  <strong>{data.users.length}</strong> аккаунтов
                </span>
                <span>
                  <strong>
                    {data.events.filter((event) => event.is_correct === false).length}
                  </strong>{" "}
                  ошибок в журнале
                </span>
                <span>
                  <strong>{data.active.length}</strong> незавершённых игр
                </span>
              </div>
              {canEdit && <BillingPlanManager />}
              <h3>Пользователи</h3>
              {data.users.some((user) => user.role === "editor") && (
                <p className="catalog-privacy-note">
                  Для старых аккаунтов «Редактор» выберите «Администратор» или «Ученик». До выбора
                  эти аккаунты не имеют прав редактирования.
                </p>
              )}
              <div className="admin-user-list">
                {data.users.map((user) => {
                  const role = user.role ?? "student";
                  return (
                    <article key={user.id} className="admin-user-row">
                      <span className="admin-user-avatar">
                        {user.image ? (
                          <img src={user.image} alt="" />
                        ) : (
                          user.name.slice(0, 1).toLocaleUpperCase()
                        )}
                      </span>
                      <div className="admin-user-main">
                        <strong>{user.name}</strong>
                        <small>
                          {user.email} · {user.event_count} ответов · {user.errors} ошибок
                        </small>
                        <small>
                          Последняя активность:{" "}
                          {user.last_activity ? formatDate(user.last_activity) : "пока нет"}
                        </small>
                      </div>
                      <span
                        className={`account-role ${role === "owner" || role === "admin" ? "admin" : ""}`}
                      >
                        {roleName(role)}
                      </span>
                      {user.id !== currentUser.id && role !== "owner" && (
                        <div className="admin-user-actions">
                          <select
                            aria-label={`Роль для ${user.name}`}
                            disabled={workingId === user.id}
                            value={role}
                            onChange={(event) => void changeRole(user, event.target.value)}
                          >
                            {role === "editor" && (
                              <option value="editor" disabled>
                                Старая роль · выберите новую
                              </option>
                            )}
                            <option value="student">Ученик</option>
                            <option value="admin">Администратор контента</option>
                          </select>
                          <button
                            className="secondary-button compact"
                            disabled={workingId === user.id}
                            onClick={() => void resetPassword(user)}
                          >
                            Сбросить пароль
                          </button>
                          <button
                            className="text-danger"
                            disabled={workingId === user.id}
                            onClick={() => void removeUser(user)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                      {canEdit && (
                        <details className="admin-permissions">
                          <summary>Индивидуальные права</summary>
                          {role === "owner" && (
                            <small>
                              Владелец всегда сохраняет управление пользователями и настройками.
                            </small>
                          )}
                          {(Object.keys(permissionLabels) as BooleanPermission[]).map(
                            (permission) => {
                              const ownerCoreRight =
                                role === "owner" &&
                                (permission === "manageUsers" || permission === "manageSettings");
                              return (
                                <label key={permission}>
                                  <input
                                    type="checkbox"
                                    disabled={workingId === user.id || ownerCoreRight}
                                    checked={
                                      ownerCoreRight
                                        ? true
                                        : (user.permissions?.[permission] ??
                                          defaultPermission(role, permission))
                                    }
                                    onChange={(event) =>
                                      void changeRole(user, role, {
                                        ...(user.permissions ?? basePermissions(role)),
                                        [permission]: event.target.checked,
                                      })
                                    }
                                  />
                                  {permissionLabels[permission]}
                                </label>
                              );
                            },
                          )}
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
              <h3>Где остановились</h3>
              {data.active.length ? (
                <div className="admin-active-list">
                  {data.active.map((item) => (
                    <article key={item.user_id}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.activity_title} · {item.module_title}
                      </span>
                      <small>
                        Раунд {item.current_index} из {item.total} · {formatDate(item.updated_at)}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-inline">Сейчас нет незавершённых игр.</p>
              )}
              <h3>Ответы и ошибки</h3>
              {data.events.length ? (
                <div className="admin-event-list">
                  {data.events.slice(0, 100).map((event) => (
                    <article
                      key={event.id}
                      className={event.is_correct === false ? "incorrect" : ""}
                    >
                      <div>
                        <strong>{event.name}</strong>
                        <small>
                          {formatDate(event.created_at)} ·{" "}
                          {event.activity || event.module_title || event.event_type}
                        </small>
                      </div>
                      <span>
                        {event.module_title}
                        {event.round_index ? ` · ${event.round_index}/${event.round_total}` : ""}
                      </span>
                      {event.prompt && <p>{event.prompt}</p>}
                      {event.is_correct !== null && (
                        <small>
                          {event.is_correct
                            ? "Верно"
                            : `Ошибка: ${event.selected_answer || "ответ не указан"} · правильный: ${event.correct_answer || "—"}`}
                        </small>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-inline">
                  История появится, когда ученики начнут проходить практику после этой версии.
                </p>
              )}
            </>
          )
        )}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={() => void reload()}>
            Обновить
          </button>
          <button className="primary-button" onClick={onClose}>
            Готово
          </button>
        </div>
      </section>
    </div>
  );
}
function basePermissions(role: string): AppPermissions {
  return {
    manageContent: ["owner", "admin"].includes(role),
    manageUsers: role === "owner",
    viewAnalytics: role === "owner",
    manageSettings: role === "owner",
  };
}
function defaultPermission(role: string, permission: BooleanPermission) {
  return basePermissions(role)[permission];
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
