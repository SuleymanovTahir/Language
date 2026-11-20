import { useEffect, useState } from "react";
import { Icon } from "./Icon";

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
      <img src="/mascots/mascot-2.png" alt="" />
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
          <button className="secondary-button compact" disabled={busy} onClick={() => void save()}>
            {busy ? "Сохраняем…" : "Сохранить выбор"}
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
export function Companion() {
  const [open, setOpen] = useState(false),
    [survey, setSurvey] = useState(false),
    [rating, setRating] = useState(0),
    [choice, setChoice] = useState(""),
    [text, setText] = useState("");
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<{ q: string; a: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState<{
      remaining: number;
      limit: number;
      bonus: number;
      referral: string;
    } | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[a-f0-9]{32}$/.test(ref)) localStorage.setItem("clickling-referral", ref);
    const saved = localStorage.getItem("clickling-referral");
    if (saved)
      engagement("refer", { referral: saved })
        .then(() => localStorage.removeItem("clickling-referral"))
        .catch(() => {});
    let last = 0;
    try {
      last = Number(localStorage.getItem("clickling-survey-at") || 0);
    } catch {}
    if (Date.now() - last < 7 * 864e5) return;
    const id = window.setTimeout(() => setSurvey(true), 120000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!open) return;
    engagement("quota")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, [open]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSurvey(false);
      }
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
      const result = await engagement("ask", { question: q, context, id: crypto.randomUUID() });
      setMessages((m) => [...m, { q, a: result.answer }]);
      setQuestion("");
      setStatus(result.quota);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="tutor-launch"
        aria-label="Задать вопрос AI-наставнику"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setSurvey(false);
        }}
      >
        <Icon name={open ? "close" : "spark"} size={19} />
        <span>Спросить AI</span>
      </button>
      {open && (
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
              <p>
                Неясно правило или формулировка задания? Задайте вопрос — объясню на примере, не
                прерывая занятие.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <p className="tutor-question">{m.q}</p>
                <p>{m.a}</p>
              </div>
            ))}
          </div>
          <small>
            {status
              ? `Осталось ${status.remaining} из ${status.limit} вопросов сегодня · бонусных: ${status.bonus}`
              : "Обычный тариф: 3 вопроса в день · PRO: 20"}
          </small>
          {status && status.remaining === 0 && (
            <div className="tutor-limit">
              <p>
                Дневной лимит исчерпан. Вернитесь завтра или пригласите нового друга: после
                подтверждения почты вы получите 3 бонусных вопроса.
              </p>
              <button
                className="secondary-button compact"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/?ref=${status.referral}`,
                    );
                    setError("Ссылка скопирована.");
                  } catch {
                    setError("Не удалось скопировать ссылку.");
                  }
                }}
              >
                Пригласить друга
              </button>
            </div>
          )}
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
            <button className="primary-button compact" disabled={busy || !question.trim()}>
              {busy ? "Думаю…" : "Спросить"}
            </button>
          </form>
        </section>
      )}
      {survey && !open && (
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
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Выберите вариант</option>
              {["Игры", "Объяснения", "Удобство на телефоне", "Свой вариант"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <textarea
            rows={2}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ваш вариант или пожелание"
          />
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
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Отправить
          </button>
        </section>
      )}
    </>
  );
}
