import { useEffect, useMemo, useState } from "react";
import type { VocabCard } from "../lib/vocab";
import { Icon } from "./Icon";

export type StudyMode = "cards" | "quick" | "refresh" | "test" | "write";
export type CardProgress = { reps: number; level: number; stability: number; dueAt: string; correct: number; wrong: number; starred: boolean };

export function detectSpeechLanguage(text: string) {
  if (/[\u0400-\u04ff]/.test(text)) return "ru-RU";
  if (/[äöüß]/i.test(text) || /^(der|die|das|ein|eine|ich|du|wir|sie|und|nicht|mit|für)\b/i.test(text)) return "de-DE";
  return "en-US";
}

export function speechLocaleForCode(code: string) {
  const locales: Record<string, string> = { de: "de-DE", en: "en-US", ru: "ru-RU", es: "es-ES", fr: "fr-FR", it: "it-IT", tr: "tr-TR" };
  return locales[code] ?? `${code}-${code.toUpperCase()}`;
}

export function speakText(text: string, lang = detectSpeechLanguage(text), slow = false) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = slow ? 0.7 : 0.9;
  const language = lang.toLowerCase().split("-")[0];
  const voices = window.speechSynthesis.getVoices();
  const qualityScore = (voice: SpeechSynthesisVoice) => {
    const description = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return (/natural|neural|enhanced|premium|google|microsoft|samantha|ava|alex|helena|katja|markus|jenny/.test(description) ? 10 : 0)
      + (!voice.localService ? 1 : 0)
      + (voice.lang.toLowerCase() === lang.toLowerCase() ? 4 : 0);
  };
  const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase() === lang.toLowerCase() || voice.lang.toLowerCase().startsWith(`${language}-`));
  utterance.voice = [...matchingVoices].sort((a, b) => qualityScore(b) - qualityScore(a))[0]
    ?? null;
  window.speechSynthesis.speak(utterance);
  return true;
}

function german(card: VocabCard) {
  return `${card.article ? `${card.article} ` : ""}${card.word}`;
}

function languageLabel(code: string) {
  return ({ de: "немецкий", en: "английский", ru: "русский", es: "испанский", fr: "французский", it: "итальянский", tr: "турецкий" } as Record<string, string>)[code] ?? code;
}

function germanOption(card: VocabCard, pool: VocabCard[]) {
  const duplicates = pool.filter((item) => item.id !== card.id && item.word.toLocaleLowerCase() === card.word.toLocaleLowerCase());
  if (card.word.toLocaleLowerCase() === "sie" || duplicates.length > 0) return `${german(card)} (${card.translation})`;
  return german(card);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
}

function equivalentAnswer(left: string, right: string) {
  const variants = (value: string) => {
    const normalized = normalize(value);
    return new Set([
      normalized,
      normalized.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"),
      normalized.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss"),
    ]);
  };
  const leftVariants = variants(left);
  return [...variants(right)].some((variant) => leftVariants.has(variant));
}

function distance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

function getOptions(card: VocabCard, pool: VocabCard[], direction: "de-ru" | "ru-de", index: number, confusions: Record<string, Record<string, number>>) {
  const key = (item: VocabCard) => direction === "de-ru" ? item.translation : germanOption(item, pool);
  const target = key(card);
  const comparable = pool.filter((item) => item.id !== card.id && key(item).toLocaleLowerCase() !== target.toLocaleLowerCase());
  const nounLike = Boolean(card.article);
  const sameType = comparable.filter((item) => (item.partOfSpeech ?? (item.article ? "noun" : "other")) === (card.partOfSpeech ?? (nounLike ? "noun" : "other")));
  const source = sameType.length >= 3 ? sameType : comparable;
  const start = source.length ? (index * 11) % source.length : 0;
  const forcedIds = Object.entries(confusions[card.id] ?? {}).filter(([, count]) => count >= 2).map(([id]) => id);
  const forced = forcedIds.map((id) => source.find((item) => item.id === id)).filter((item): item is VocabCard => Boolean(item));
  const rotation = [...source.slice(start), ...source.slice(0, start)];
  const picks = [card, ...forced, ...rotation].filter((item, i, items) => items.findIndex((candidate) => candidate.id === item.id) === i).slice(0, 4);
  const unique = new Map(picks.map((item) => [key(item).toLocaleLowerCase(), item]));
  return [...unique.values()].sort((a, b) => `${a.id}-${index}`.localeCompare(`${b.id}-${index}`));
}

function phoneticHint(word: string, ruleId?: string | null) {
  const ruleHints: Record<string, string> = {
    "PHON-01": "Открытый слог или одна конечная согласная обычно сохраняет долгий гласный.",
    "PHON-02": "Закрытый слог и две согласные после гласного обычно указывают на краткое произношение.",
    "PHON-03": "В конце слова b, d, g оглушаются: b → [п], d → [т], g → [к].",
    "PHON-04": "Окончание -ig в литературной норме произносится мягко, примерно как [ихь].",
    "PHON-05": "В начале слова сочетания st- и sp- произносятся как [шт] и [шп].",
    "PHON-06": "Дифтонги: ei → [ай], ie → долгое [и], au → [ау], eu/äu → [ой].",
    "PHON-07": "ä, ö, ü — умлауты; ß передаёт глухой [с].",
    "PHON-08": "ch меняется по месту образования; sch читается как [ш], chs — как [кс].",
    "PHON-09": "В немецких словах v → [ф], w → [в], z → [ц], j → [й], qu → [кв].",
  };
  if (ruleId && ruleHints[ruleId]) return ruleHints[ruleId];
  return /[bdg]$/i.test(word) ? ruleHints["PHON-03"] : "Слушайте ударение и произнесите слово целиком. Озвучка доступна через голос браузера.";
}

export function StudySession({
  cards,
  pool,
  mode,
  title,
  learningLanguageCode,
  nativeLanguageCode,
  progress,
  confusions,
  autoSpeak,
  onClose,
  onComplete,
  onAnswer,
  onToggleStar,
}: {
  cards: VocabCard[];
  pool: VocabCard[];
  mode: StudyMode;
  title: string;
  learningLanguageCode: string;
  nativeLanguageCode: string;
  progress: Record<string, CardProgress>;
  confusions: Record<string, Record<string, number>>;
  autoSpeak: boolean;
  onClose: () => void;
  onComplete: () => void;
  onAnswer: (card: VocabCard, correct: boolean, rating: number, confusedWith?: string) => void;
  onToggleStar: (card: VocabCard) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState<"de-ru" | "ru-de">("de-ru");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"correct" | "almost" | "wrong" | null>(null);
  const [hint, setHint] = useState(0);
  const [showRule, setShowRule] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const quick = mode === "quick" || mode === "test";
  const writing = mode === "write";
  const card = cards[index];
  const learningLocale = speechLocaleForCode(learningLanguageCode);
  const nativeLocale = speechLocaleForCode(nativeLanguageCode);
  const options = useMemo(() => card ? getOptions(card, pool, direction, index, confusions) : [], [card, pool, direction, index, confusions]);
  const target = card ? (direction === "de-ru" ? card.translation : german(card)) : "";
  const displayedWord = card ? (direction === "de-ru" ? german(card) : card.translation) : "";
  const pct = cards.length ? ((index + 1) / cards.length) * 100 : 0;

  const navigateCard = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= cards.length) return;
    setIndex(nextIndex);
    setFlipped(false); setSelected(null); setChecked(false); setAnswer(""); setStatus(null); setHint(0); setShowRule(false); setShowMenu(false);
  };

  const advance = (correct: boolean, rating = correct ? 2 : 1) => {
    if (!card) return;
    onAnswer(card, correct, rating, !correct && quick ? selected ?? undefined : undefined);
    setSelected(null);
    setChecked(false);
    setAnswer("");
    setStatus(null);
    setHint(0);
    setFlipped(false);
    setShowRule(false);
    if (index >= cards.length - 1) onComplete();
    else setIndex((value) => value + 1);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement | null;
      const typing = targetElement?.tagName === "INPUT" || targetElement?.tagName === "TEXTAREA";
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (typing) return;
      if (mode === "cards" && event.key === "ArrowLeft") { event.preventDefault(); navigateCard(index - 1); }
      if (mode === "cards" && event.key === "ArrowRight") { event.preventDefault(); navigateCard(index + 1); }
      if (event.code === "Space" && !quick && !writing) { event.preventDefault(); setFlipped((value) => !value); }
      if (event.key.toLowerCase() === "r" && card) speakText(direction === "de-ru" ? german(card) : card.translation, direction === "de-ru" ? learningLocale : nativeLocale);
      if (quick && /^[1-4]$/.test(event.key)) setSelected(options[Number(event.key) - 1]?.id ?? null);
      if (!quick && !writing && flipped && /^[1-3]$/.test(event.key)) {
        const rating = Number(event.key);
        advance(rating !== 1, rating);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [quick, writing, mode, card, options, flipped, index, cards.length, selected, direction, learningLocale, nativeLocale, onAnswer, onComplete, onClose]);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => {
    const learningSideVisible = direction === "de-ru" ? !flipped : flipped;
    if (autoSpeak && card && !quick && !writing && learningSideVisible) speakText(german(card), learningLocale);
  }, [autoSpeak, card?.id, direction, flipped, quick, writing, learningLocale]);

  if (!card) return <div className="study-shell"><button onClick={onClose}>Закрыть</button><p>В наборе пока нет слов.</p></div>;

  const submitText = () => {
    if (equivalentAnswer(answer, target)) { setStatus("correct"); return; }
    const expectedWord = normalize(target.replace(/^(der|die|das)\s+/i, ""));
    const typedWord = normalize(answer.replace(/^(der|die|das)\s+/i, ""));
    const articleOkay = direction !== "ru-de" || !card.article || normalize(answer).startsWith(`${card.article} `);
    if (articleOkay && expectedWord.length >= 5 && distance(typedWord, expectedWord) === 1) setStatus("almost");
    else setStatus("wrong");
  };

  return (
    <div className="study-shell">
      <header className={`study-topbar ${mode === "cards" ? "has-card-nav" : ""}`}>
        <button onClick={onClose} aria-label="Выйти" title="Выход · Esc"><Icon name="close" /></button>
        <div className="study-progress"><i style={{ width: `${pct}%` }} /></div>
        <span>{index + 1} / {cards.length}</span>
        <button onClick={() => speakText(direction === "de-ru" ? german(card) : card.translation, direction === "de-ru" ? learningLocale : nativeLocale)} onContextMenu={(event) => { event.preventDefault(); speakText(direction === "de-ru" ? german(card) : card.translation, direction === "de-ru" ? learningLocale : nativeLocale, true); }} aria-label="Озвучить" title="Озвучить · R (правый клик — медленно)"><Icon name="volume" /></button>
        <div className="study-more-wrap">
          <button onClick={() => setShowMenu((value) => !value)} aria-label="Ещё" aria-expanded={showMenu}><Icon name="more" /></button>
          {showMenu && <div className="study-more-menu"><button onClick={() => { setShowRule((value) => !value); setFlipped(true); setShowMenu(false); }}>Правило чтения</button><button onClick={() => { speakText(direction === "de-ru" ? german(card) : card.translation, direction === "de-ru" ? learningLocale : nativeLocale, true); setShowMenu(false); }}>Озвучить медленно</button><button onClick={onClose}>Завершить занятие</button></div>}
        </div>
      </header>
      <main className="study-stage">
        <div className="study-label"><span>{title}</span><button onClick={() => { setDirection((value) => value === "de-ru" ? "ru-de" : "de-ru"); setSelected(null); setChecked(false); setAnswer(""); setStatus(null); setHint(0); setFlipped(false); }}>{direction === "de-ru" ? `${learningLanguageCode.toUpperCase()} → ${nativeLanguageCode.toUpperCase()}` : `${nativeLanguageCode.toUpperCase()} → ${learningLanguageCode.toUpperCase()}`} <Icon name="chevron" size={13} /></button></div>
        {quick ? <div className="quiz-content">
          <p className="question-kicker">{direction === "de-ru" ? "Выберите перевод" : "Выберите немецкое слово"}</p>
          <h1>{displayedWord}</h1>{direction === "de-ru" && <p className="transcription">{card.transcription}</p>}
          <div className="answer-grid">
            {options.map((option, optionIndex) => {
              const isCorrect = option.id === card.id;
              const state = checked && isCorrect ? "correct" : checked && selected === option.id && !isCorrect ? "wrong" : selected === option.id ? "selected" : "";
              return <button className={state} key={option.id} onClick={() => { if (!checked) setSelected(option.id); }} disabled={checked}>
                <kbd>{optionIndex + 1}</kbd><span>{direction === "de-ru" ? option.translation : germanOption(option, pool)}</span>{checked && isCorrect && <Icon name="check" />}
              </button>;
            })}
          </div>
          {checked && <p className={`answer-feedback ${selected === card.id ? "success" : "error"}`}>{selected === card.id ? "Верно · +8 XP" : `Правильный ответ: ${direction === "de-ru" ? card.translation : germanOption(card, pool)}`}</p>}
        </div> : writing ? <div className="write-content">
          <p className="question-kicker">{direction === "de-ru" ? `Переведите на ${languageLabel(nativeLanguageCode)}` : `Переведите на ${languageLabel(learningLanguageCode)}`}</p><h1>{direction === "de-ru" ? german(card) : card.translation}</h1>
          {hint > 0 && <div className="hint-panel"><strong>Подсказка {hint}/3</strong><span>{hint === 1 ? learningLanguageCode === "de" ? phoneticHint(card.word, card.phoneticRuleId) : "Вспомните первую букву и произнесите слово вслух." : hint === 2 ? `${card.article ? `${card.article} ` : ""}${card.word[0]}${"_".repeat(Math.max(2, card.word.length - 1))}` : `Ответ: ${target}`}</span></div>}
          <form className="write-form" onSubmit={(event) => { event.preventDefault(); submitText(); }}>
            <input autoFocus value={answer} onChange={(event) => { setAnswer(event.target.value); if (status) setStatus(null); }} placeholder={direction === "ru-de" ? `Введите слово на ${languageLabel(learningLanguageCode)}` : `Введите перевод на ${languageLabel(nativeLanguageCode)}`} />
            {direction === "ru-de" && learningLanguageCode === "de" && <div className="umlaut-keys">{["ä", "ö", "ü", "ß"].map((letter) => <button type="button" key={letter} onClick={() => setAnswer((value) => `${value}${letter}`)}>{letter}</button>)}</div>}
            {!status && <button className="primary-button" type="submit">Проверить <Icon name="arrow" /></button>}
          </form>
          {status === "correct" && <p className="answer-feedback success">Верно · {target}</p>}
          {status === "almost" && <div className="answer-feedback almost"><strong>Почти верно</strong><span>Перепечатайте ответ без опечатки: {target}</span></div>}
          {status === "wrong" && <div className="answer-feedback error"><strong>Проверьте артикль и написание</strong><span>Правильный ответ: {target}. Перепечатайте его, чтобы продолжить.</span></div>}
          {status && <input className="retype-input" value={status === "correct" ? target : undefined} onChange={(event) => setAnswer(event.target.value)} placeholder="Перепечатайте правильный ответ" aria-label="Перепечатайте правильный ответ" />}
        </div> : <div className="flashcard-navigation">
          {mode === "cards" && <button className="study-card-edge-nav previous" onClick={() => navigateCard(index - 1)} disabled={index === 0} aria-label="Предыдущая карточка" title="Предыдущая карточка"><Icon name="chevron" className="chevron-left" size={22} /></button>}
          <div className="flashcard-wrap">
          <div role="button" tabIndex={0} aria-label={flipped ? "Сторона ответа" : "Показать ответ"} className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter") setFlipped((value) => !value); }}>
            <div className="card-face card-front"><button className={`star-button ${progress[card.id]?.starred ? "is-starred" : ""}`} aria-label="Отметить сложное слово" onClick={(event) => { event.stopPropagation(); onToggleStar(card); }}><Icon name="star" /></button><span className={`article-label ${card.article || "neutral"}`}>{card.article === "der" ? "● M" : card.article === "die" ? "▲ F" : card.article === "das" ? "■ N" : "WORT"}</span><h1>{direction === "de-ru" ? german(card) : card.translation}</h1><p className="transcription">{direction === "de-ru" ? card.transcription : "Переведите на немецкий"}</p><span className="flip-hint">Нажмите или пробел, чтобы открыть ответ</span></div>
            <div className="card-face card-back"><p>ОТВЕТ</p><h2>{direction === "de-ru" ? card.translation : german(card)}</h2>{direction === "de-ru" && <p className="transcription">{card.transcription}</p>}<button className="rule-link" onClick={(event) => { event.stopPropagation(); setShowRule((value) => !value); }}>ⓘ Правило чтения</button>{showRule && <p className="rule-hint">{phoneticHint(card.word)}</p>}<span className="flip-hint">После ответа выберите, как быстро вспомнили слово</span></div>
          </div>
          </div>
          {mode === "cards" && <button className="study-card-edge-nav next" onClick={() => navigateCard(index + 1)} disabled={index === cards.length - 1} aria-label="Следующая карточка" title="Следующая карточка"><Icon name="chevron" size={22} /></button>}
        </div>}
      </main>
      <footer className="study-dock">
        {quick ? <button className="primary-button dock-primary" disabled={!selected && !checked} onClick={() => { if (!checked) setChecked(true); else advance(selected === card.id, selected === card.id ? 2 : 1); }}>{!checked ? "Проверить" : index === cards.length - 1 ? "Завершить" : "Дальше"} <Icon name="arrow" /></button>
          : writing ? <button className="primary-button dock-primary" disabled={status !== "correct" && !(status && equivalentAnswer(answer, target))} onClick={() => advance(status === "correct" || equivalentAnswer(answer, target), status === "correct" ? 2 : 1)}>{index === cards.length - 1 ? "Завершить" : "Дальше"} <Icon name="arrow" /></button>
            : flipped ? <div className="rating-panel"><div className="rating-explainer"><strong>Когда повторить это слово?</strong><span>Если перевод вспомнился без подсказки — выберите «Вспомнил сразу». Выбор и дата повтора сохраняются в прогрессе этого кабинета на устройстве; в нужный день слово появится в «Сегодня» → «Повторение дня».</span></div><div className="rating-buttons"><button onClick={() => advance(false, 1)}><kbd>1</kbd><span>Не вспомнил</span><small>Повтор завтра</small></button><button onClick={() => advance(true, 2)}><kbd>2</kbd><span>Вспомнил с трудом</span><small>Повтор через 3 дня</small></button><button className="easy" onClick={() => advance(true, 3)}><kbd>3</kbd><span>Вспомнил сразу</span><small>Повтор через 7 дней</small></button></div></div>
              : <><button className="hint-button" onClick={() => setHint((value) => Math.min(3, value + 1))} disabled={hint >= 3}><Icon name="brain" /> Подсказка {hint > 0 ? `${hint}/3` : ""}</button><button className="primary-button dock-primary" onClick={() => setFlipped(true)}>Показать ответ</button></>}
      </footer>
    </div>
  );
}
