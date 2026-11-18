import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { playFeedbackSound } from "../lib/feedbackSound";

export type AudioQuestion = { id: string; prompt: string; options: string[]; answer: string };
export type AudioQuiz = { id: string; title: string; languageCode: string; level: string; audioDataUrl: string; audioName: string; questions: AudioQuestion[] };

function shuffleQuestions(questions: AudioQuestion[]) {
  const result = [...questions];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function blankQuestion(optionCount: number, index: number): AudioQuestion {
  return { id: `q-${Date.now()}-${index}`, prompt: "", options: Array.from({ length: optionCount }, () => ""), answer: "" };
}

export function AudioQuizBuilder({ initial, languageCode, level, onSave, onCancel }: { initial?: AudioQuiz; languageCode: string; level: string; onSave: (quiz: AudioQuiz) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "Аудиотест");
  const [audioDataUrl, setAudioDataUrl] = useState(initial?.audioDataUrl ?? "");
  const [audioName, setAudioName] = useState(initial?.audioName ?? "");
  const [questionCount, setQuestionCount] = useState(initial?.questions.length ?? 5);
  const [optionCount, setOptionCount] = useState(initial?.questions[0]?.options.length ?? 4);
  const [questions, setQuestions] = useState<AudioQuestion[]>(() => initial?.questions ?? Array.from({ length: 5 }, (_, index) => blankQuestion(4, index)));
  const [error, setError] = useState("");

  const setCount = (count: number) => {
    setQuestionCount(count);
    setQuestions((current) => Array.from({ length: count }, (_, index) => current[index] ?? blankQuestion(optionCount, index)));
  };
  const setOptionsCount = (count: number) => {
    setOptionCount(count);
    setQuestions((current) => current.map((question) => ({ ...question, options: Array.from({ length: count }, (_, index) => question.options[index] ?? ""), answer: question.options.slice(0, count).includes(question.answer) ? question.answer : "" })));
  };
  const updateQuestion = (index: number, patch: Partial<AudioQuestion>) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
  const loadAudio = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) { setError("Выберите аудиофайл (MP3, WAV, M4A или другой поддерживаемый формат)."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("Для хранения в этом браузере размер аудио ограничен 3 МБ."); return; }
    const reader = new FileReader();
    reader.onload = () => { setAudioDataUrl(String(reader.result ?? "")); setAudioName(file.name); setError(""); };
    reader.onerror = () => setError("Не удалось прочитать аудиофайл.");
    reader.readAsDataURL(file);
  };
  const valid = title.trim() && audioDataUrl && questions.length === questionCount && questions.every((question) => question.prompt.trim() && question.options.length === optionCount && question.options.every((option) => option.trim()) && question.options.includes(question.answer));
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="dialog-card audio-builder" role="dialog" aria-modal="true" aria-labelledby="audio-builder-title"><button className="dialog-close" onClick={onCancel} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">АУДИОТЕСТ · {languageCode.toUpperCase()} · {level}</p><h2 id="audio-builder-title">{initial ? "Изменить аудиотест" : "Создать аудиотест"}</h2><label className="field-label">Название<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="audio-upload"><Icon name="headphones" /><strong>{audioName || "Загрузить аудио"}</strong><small>Локальный файл · до 3 МБ</small><input type="file" accept="audio/*" onChange={(event) => loadAudio(event.target.files?.[0])} /></label>{audioDataUrl && <audio className="audio-preview" controls src={audioDataUrl} />}
    <div className="audio-config"><label className="field-label">Количество вопросов<select value={questionCount} onChange={(event) => setCount(Number(event.target.value))}>{[1, 2, 3, 5, 8, 10, 15, 20].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><label className="field-label">Вариантов в вопросе<select value={optionCount} onChange={(event) => setOptionsCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div>
    <div className="audio-question-list">{questions.map((question, index) => <article key={question.id}><strong>Вопрос {index + 1}</strong><label className="field-label">Текст вопроса<input value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Что говорится в записи?" /></label><div className="audio-options-edit">{question.options.map((option, optionIndex) => <label key={optionIndex}><span>Вариант {optionIndex + 1}</span><input value={option} onChange={(event) => updateQuestion(index, { options: question.options.map((value, current) => current === optionIndex ? event.target.value : value) })} /></label>)}</div><label className="field-label">Правильный ответ<select value={question.answer} onChange={(event) => updateQuestion(index, { answer: event.target.value })}><option value="">Выберите верный вариант</option>{question.options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select></label></article>)}</div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={onCancel}>Отмена</button><button className="primary-button" disabled={!valid} onClick={() => onSave({ id: initial?.id ?? `audio-${Date.now()}`, title: title.trim(), languageCode, level, audioDataUrl, audioName, questions })}>Сохранить аудиотест</button></div>
  </section></div>;
}

export function AudioQuizSession({ quiz, onExit, onAnswer }: { quiz: AudioQuiz; onExit: () => void; onAnswer: (correct: boolean) => void }) {
  const [questions, setQuestions] = useState(() => shuffleQuestions(quiz.questions));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  useEffect(() => { if (finished) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [finished]);
  if (finished) return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><span>АУДИОТЕСТ</span><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></header><div className="game-result"><span className="result-medal">{score === questions.length ? "★" : "✓"}</span><p className="eyebrow">ТЕСТ ЗАВЕРШЁН</p><h1>{score} из {questions.length}</h1><p>Время: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p><button className="primary-button" onClick={() => { setQuestions(shuffleQuestions(quiz.questions)); setIndex(0); setSelected(null); setChecked(false); setScore(0); setSeconds(0); setFinished(false); }}>Пройти ещё раз · новый порядок</button><button className="secondary-button" onClick={onExit}>Вернуться к тестам</button></div></div>;
  const submit = () => { if (!selected || checked) return; const correct = selected === question.answer; playFeedbackSound(correct); setChecked(true); setScore((value) => value + (correct ? 1 : 0)); onAnswer(correct); };
  const next = () => { if (index === questions.length - 1) setFinished(true); else { setIndex((value) => value + 1); setSelected(null); setChecked(false); } };
  return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>{quiz.title.toLocaleUpperCase()}</span><strong>{index + 1}/{questions.length}</strong></div><strong>Время {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></header><main className="game-center audio-player"><div className="game-progress"><i style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div><p className="question-kicker">Сначала прослушайте запись, затем выберите ответ</p><audio controls src={quiz.audioDataUrl} /><h1>{question.prompt}</h1><div className="game-choice-grid">{question.options.map((option) => <button key={option} disabled={checked} className={checked && option === question.answer ? "correct" : checked && option === selected ? "wrong" : selected === option ? "chosen" : ""} onClick={() => setSelected(option)}>{option}</button>)}</div>{checked && <p className={`answer-feedback ${selected === question.answer ? "success" : "error"}`}>{selected === question.answer ? "Верно" : `Правильный ответ: ${question.answer}`}</p>}<button className="primary-button" disabled={!selected} onClick={checked ? next : submit}>{checked ? index === questions.length - 1 ? "Результат" : "Дальше" : "Проверить"} <Icon name="arrow" /></button></main></div>;
}
