import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { preparedAnswers } from "../lib/assistantFaq";

export async function engagement(action: string, data?: Record<string, unknown>) {
  const response = await fetch(`/api/engagement?action=${action}`, {
    method: data ? "POST" : "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (!(response.headers.get("content-type") || "").includes("application/json"))
    throw new Error(
      "Нужна версия с подключённым API. В локальном предпросмотре сервис недоступен.",
    );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос.");
  return result;
}
export function NotFound() {
  return (
    <section className="not-found">
      <img src="/mascots/2.webp" alt="" />
      <strong>404</strong>
      <h1>Кажется, мы немного заблудились</h1>
      <p>Этой страницы нет. Но ваша следующая маленькая победа уже ждёт.</p>
      <a className="primary-button" href="#/today">
        На главную <Icon name="arrow" size={16} />
      </a>
    </section>
  );
}
export function CommunicationSettings({ admin = false }: { admin?: boolean }) {
  const [values, setValues] = useState<Record<string, string | boolean> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    engagement(admin ? "schedule" : "preferences")
      .then(setValues)
      .catch((e) => setMessage(e.message));
  }, [admin]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await engagement(admin ? "schedule" : "preferences", values!);
      setMessage("Настройки сохранены.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="communication-settings">
      <h3>{admin ? "Частота рассылок" : "Уведомления и рассылки"}</h3>
      <p>
        {admin
          ? "Максимальная частота; согласие пользователя всегда важнее. Отправщик рассылок пока не подключён."
          : "Выберите, какие письма вы хотите получать. Письма безопасности отключить нельзя."}
      </p>
      {values && (
        <>
          {["reminders", "news"].map((key) => (
            <label key={key}>
              {key === "reminders" ? "Напоминания об учёбе" : "Новости и предложения"}
              {admin ? (
                <select
                  value={String(values[key])}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                >
                  <option value="off">Не отправлять</option>
                  <option value="daily">Раз в день</option>
                  <option value="weekly">Раз в неделю</option>
                  <option value="monthly">Раз в месяц</option>
                </select>
              ) : (
                <input
                  type="checkbox"
                  checked={Boolean(values[key])}
                  onChange={(e) => setValues({ ...values, [key]: e.target.checked })}
                />
              )}
            </label>
          ))}
          {admin && (
            <label className="admin-ai-toggle">
              <input
                type="checkbox"
                checked={values.assistantEnabled !== false}
                onChange={(e) => setValues({ ...values, assistantEnabled: e.target.checked })}
              />
              <span>
                <strong>AI-наставник включён</strong>
                <small>Выключение сразу скроет помощника и остановит запросы для всех учеников.</small>
              </span>
            </label>
          )}
          <button className="secondary-button compact" disabled={busy} onClick={() => void save()}>
            {busy ? "Сохраняем…" : "Сохранить выбор"}
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
type AssistantQuota = {
  isPro: boolean;
  enabled: boolean;
  providerConfigured: boolean;
  limit: number;
  remaining: number;
  crystals: number;
  crystalCost: number;
};

export function Companion({
  crystals,
  onCrystalBalanceChange,
  onOpenAccount,
}: {
  crystals: number;
  onCrystalBalanceChange: (balance: number) => void;
  onOpenAccount: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<
      { q: string; a: string; source: string; title?: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState<AssistantQuota | null>(null),
    [enabled, setEnabled] = useState(true),
    [payment, setPayment] = useState<"pro" | "crystals">("pro");
  const loadStatus = async (initialBalance?: number) => {
    const result = (await engagement(
      "quota",
      typeof initialBalance === "number" ? { crystals: initialBalance } : undefined,
    )) as AssistantQuota;
    setStatus(result);
    setEnabled(result.enabled);
    onCrystalBalanceChange(result.crystals);
    setPayment(result.isPro && result.remaining > 0 ? "pro" : "crystals");
    return result;
  };
  useEffect(() => {
    let saved = "";
    try {
      const ref = new URLSearchParams(location.search).get("ref");
      if (ref && /^[a-f0-9]{32}$/.test(ref)) localStorage.setItem("clickling-referral", ref);
      saved = localStorage.getItem("clickling-referral") || "";
    } catch {}
    if (saved)
      engagement("refer", { referral: saved })
        .then(() => localStorage.removeItem("clickling-referral"))
        .catch(() => {
          /* Keep the referral until the signed-in account can claim it. */
        });
  }, []);
  useEffect(() => {
    void loadStatus(crystals).catch((e) => setError((e as Error).message));
    const id = window.setInterval(() => {
      void loadStatus().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!open) return;
    loadStatus()
      .catch((e) => setError(e.message));
  }, [open]);
  useEffect(() => {
    const changed = () => {
      void loadStatus().catch(() => undefined);
    };
    window.addEventListener("clickling-crystal-wallet-changed", changed);
    return () => window.removeEventListener("clickling-crystal-wallet-changed", changed);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function ask() {
    if (busy || !question.trim()) return;
    setBusy(true);
    setError("");
    const q = question;
    try {
      const context = Array.from(
        document.querySelectorAll(
          "main h1,main h2,.game-question h1,.question-kicker,.course-lesson h2",
        ),
      )
        .map((e) => e.textContent)
        .join("\n")
        .slice(0, 1600);
      const result = (await engagement("ask", {
        question: q,
        context,
        id: crypto.randomUUID(),
        payment,
      })) as { answer: string; source: string; title?: string; quota: AssistantQuota | null };
      setMessages((m) => [...m, { q, a: result.answer, source: result.source, title: result.title }]);
      setQuestion("");
      if (result.quota) {
        setStatus(result.quota);
        onCrystalBalanceChange(result.quota.crystals);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {enabled && <button
        className="tutor-launch"
        aria-label="Задать вопрос AI-наставнику"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Icon name={open ? "close" : "spark"} size={19} />
        <span>AI-наставник</span>
      </button>}
      {enabled && open && (
        <section className="tutor-panel" role="dialog" aria-label="AI-наставник">
          <header>
            <div>
              <strong>Разберёмся вместе</strong>
              <small>AI-наставник · может ошибаться</small>
            </div>
            <button aria-label="Закрыть" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="tutor-messages" aria-live="polite">
            {!messages.length && (
                <p>Задайте вопрос по немецкому. Есть готовые объяснения основных правил.</p>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <p className="tutor-question">{m.q}</p>
                  {m.title && <small>{m.title}</small>}
                <p>{m.a}</p>
                  <small>{m.source === "prepared" ? "Готовое объяснение" : "Ответ AI"}</small>
              </div>
            ))}
          </div>
          <small>
            {status
              ? status.isPro
                ? `PRO · осталось ${status.remaining} из ${status.limit} вопросов сегодня`
                : `Кристаллы: ${status.crystals} · ${status.crystalCost} за ответ`
              : "Проверяю доступ…"}
          </small>
          {status && !status.providerConfigured && (
            <p className="form-error" role="status">
              AI-помощник временно недоступен. Можно открыть готовые объяснения по теории ниже.
            </p>
          )}
          {status && status.isPro && status.remaining === 0 && (
            <p className="tutor-limit">Лимит PRO на сегодня исчерпан. Можно продолжить за кристаллы.</p>
          )}
          {status && (payment === "crystals" || !status.isPro || status.remaining === 0) && (
            <p className="tutor-limit">
              Один ответ стоит {status.crystalCost} кристаллов. Правильные ответы в упражнениях
              пополняют баланс.
            </p>
          )}
          {status?.isPro && status.remaining > 0 && (
            <label className="tutor-payment">
              Оплатить вопрос
              <select
                value={payment}
                onChange={(event) => setPayment(event.target.value as "pro" | "crystals")}
              >
                <option value="pro">Включено в PRO · осталось {status.remaining}</option>
                <option value="crystals">{status.crystalCost} кристаллов</option>
              </select>
            </label>
          )}
          {status && status.crystals < status.crystalCost && (!status.isPro || status.remaining === 0) && (
            <div className="tutor-limit">
              <p>Чтобы спросить AI, подключите PRO или накопите кристаллы в упражнениях.</p>
              <button className="secondary-button compact" onClick={onOpenAccount}>Тариф PRO</button>
            </div>
          )}
          <details className="tutor-faq">
            <summary>Готовые объяснения по теории</summary>
            <div>
              {preparedAnswers.map((item) => (
                <button key={item.title} type="button" onClick={() => setQuestion(item.prompt)}>
                  {item.prompt}
                </button>
              ))}
            </div>
          </details>
          {error && (
            <p className="form-error" role="status">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <label className="sr-only" htmlFor="tutor-question">
              Ваш вопрос
            </label>
            <textarea
              id="tutor-question"
              rows={2}
              maxLength={1200}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Почему здесь такой артикль?"
            />
            <button
              className="primary-button compact"
              disabled={
                busy ||
                !question.trim() ||
                !status ||
                !status.enabled ||
                (payment === "pro" && (!status.isPro || status.remaining <= 0)) ||
                (payment === "crystals" && status.crystals < status.crystalCost)
              }
            >
              {busy
                ? "Думаю…"
                : payment === "pro"
                  ? "Спросить · PRO"
                  : `Спросить · ${status?.crystalCost ?? 10} кристаллов`}
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export function FeedbackSurvey() {
  const [survey, setSurvey] = useState(false);
  const [rating, setRating] = useState(0);
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem("clickling-survey-at") || 0);
    } catch {}
    if (Date.now() - last < 7 * 864e5) return;
    const id = window.setTimeout(() => setSurvey(true), 120000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSurvey(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function dismiss() {
    setSurvey(false);
    try {
      localStorage.setItem("clickling-survey-at", String(Date.now()));
    } catch {}
  }
  if (!survey) return null;
  return (
    <section className="micro-survey" role="dialog" aria-label="Оцените приложение">
      <button className="survey-close" aria-label="Позже" onClick={dismiss}>
        <Icon name="close" size={16} />
      </button>
      <strong>Как вам ClickLing?</strong>
      <p>Один маленький ответ помогает нам стать лучше.</p>
      <div className="survey-stars" role="group" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} из 5`}
            aria-pressed={rating === n}
            className={rating >= n ? "selected" : ""}
            onClick={() => setRating(n)}
          >
            <Icon name="star" size={24} />
          </button>
        ))}
      </div>
      <label>
        Что стоит улучшить?
        <select
          className={choice ? "has-choice" : "placeholder"}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">Выберите вариант</option>
          {["Игры", "Объяснения", "Удобство на телефоне", "Свой вариант"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <textarea
        rows={2}
        value={text}
        maxLength={1000}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ваш вариант или пожелание"
      />
      <small>
        Отправляя отзыв, вы соглашаетесь сохранить его вместе со временем и сведениями для ответа:
        аккаунтом или случайным ID гостя, устройством и примерным регионом. Исходный IP не
        сохраняется. Отзывы остаются в аналитике без автоматического срока удаления.
      </small>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary-button compact"
        disabled={!rating || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await engagement("feedback", { rating, choice, text });
            dismiss();
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Отправить
      </button>
    </section>
  );
}
