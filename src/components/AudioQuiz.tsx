import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { playFeedbackSound } from "../lib/feedbackSound";
import { loadMediaFile, removeMediaFile, saveMediaFile } from "../lib/mediaStore";

export type AudioOptionMedia = { kind: "image" | "audio"; mediaId: string; name: string };
export type AudioQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  answerIndex?: number;
  hint?: string;
  audioMediaId?: string;
  audioName?: string;
  optionMedia?: Array<AudioOptionMedia | undefined>;
};
export type AudioQuiz = { id: string; title: string; languageCode: string; level: string; audioMediaId?: string; audioDataUrl?: string; audioName: string; questions: AudioQuestion[] };

function shuffleQuestions(questions: AudioQuestion[]) {
  const result = [...questions];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function blankQuestion(optionCount: number, index: number): AudioQuestion {
  return { id: `q-${Date.now()}-${index}`, prompt: "", options: Array.from({ length: optionCount }, () => ""), answer: "", optionMedia: Array.from({ length: optionCount }) };
}

function useMediaUrl(mediaId?: string, fallback = "") {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    if (!mediaId) { setUrl(fallback); return; }
    let objectUrl = "";
    let alive = true;
    setUrl("");
    void loadMediaFile(mediaId).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => undefined);
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mediaId, fallback]);
  return url;
}

function MediaPreview({ media, removable = false, onRemove }: { media?: AudioOptionMedia; removable?: boolean; onRemove?: () => void }) {
  const url = useMediaUrl(media?.mediaId);
  if (!media) return null;
  return <div className={`audio-media-preview ${media.kind}`}>
    {media.kind === "image" ? url ? <img src={url} alt={media.name || "Изображение варианта"} /> : <small>Загружаю изображение…</small> : url ? <audio controls preload="none" src={url} aria-label={`Аудиовариант: ${media.name}`} /> : <small>Загружаю аудио…</small>}
    <span title={media.name}>{media.name}</span>{removable && <button type="button" className="text-danger" onClick={onRemove}>Убрать медиа</button>}
  </div>;
}

export function AudioQuizBuilder({ initial, languageCode, level, onSave, onCancel }: { initial?: AudioQuiz; languageCode: string; level: string; onSave: (quiz: AudioQuiz) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "Аудиотест");
  const [audioDataUrl, setAudioDataUrl] = useState(initial?.audioDataUrl ?? "");
  const [audioMediaId, setAudioMediaId] = useState(initial?.audioMediaId ?? "");
  const [audioName, setAudioName] = useState(initial?.audioName ?? "");
  const [questionCount, setQuestionCount] = useState(initial?.questions.length ?? 5);
  const [optionCount, setOptionCount] = useState(initial?.questions[0]?.options.length ?? 4);
  const [questions, setQuestions] = useState<AudioQuestion[]>(() => initial?.questions ?? Array.from({ length: 5 }, (_, index) => blankQuestion(4, index)));
  const [error, setError] = useState("");
  const pendingMediaIds = useRef(new Set<string>());
  const audioPreviewUrl = useMediaUrl(audioMediaId, audioDataUrl);

  const setCount = (count: number) => {
    setQuestionCount(count);
    setQuestions((current) => Array.from({ length: count }, (_, index) => current[index] ?? blankQuestion(optionCount, index)));
  };
  const setOptionsCount = (count: number) => {
    setOptionCount(count);
    setQuestions((current) => current.map((question) => {
      const answerIndex = question.answerIndex ?? question.options.indexOf(question.answer);
      return { ...question, options: Array.from({ length: count }, (_, index) => question.options[index] ?? ""), optionMedia: Array.from({ length: count }, (_, index) => question.optionMedia?.[index]), answerIndex: answerIndex >= 0 && answerIndex < count ? answerIndex : undefined, answer: answerIndex >= 0 && answerIndex < count ? question.options[answerIndex] ?? "" : "" };
    }));
  };
  const updateQuestion = (index: number, patch: Partial<AudioQuestion>) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
  const uploadMedia = async (file: File, questionIndex?: number, optionIndex?: number) => {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("image/")) { setError("Выберите аудио или изображение."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Файл не должен превышать 4 МБ, чтобы синхронизироваться между устройствами."); return; }
    const id = `audio-quiz-${crypto.randomUUID?.() ?? Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await saveMediaFile(id, file);
      pendingMediaIds.current.add(id);
      const media: AudioOptionMedia = { kind: file.type.startsWith("image/") ? "image" : "audio", mediaId: id, name: file.name };
      if (questionIndex === undefined) {
        setAudioMediaId(id);
        setAudioDataUrl("");
        setAudioName(file.name);
      } else if (optionIndex === undefined) {
        updateQuestion(questionIndex, { audioMediaId: id, audioName: file.name });
      } else {
        setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, optionMedia: question.options.map((_, i) => i === optionIndex ? media : question.optionMedia?.[i]) } : question));
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить медиафайл."); }
  };
  const cancel = () => { for (const id of pendingMediaIds.current) void removeMediaFile(id).catch(() => undefined); pendingMediaIds.current.clear(); onCancel(); };
  const save = () => {
    const quiz: AudioQuiz = { id: initial?.id ?? `audio-${Date.now()}`, title: title.trim(), languageCode, level, audioMediaId: audioMediaId || undefined, audioDataUrl: audioMediaId ? undefined : audioDataUrl, audioName, questions };
    const usedMedia = new Set([quiz.audioMediaId, ...questions.map((question) => question.audioMediaId), ...questions.flatMap((question) => (question.optionMedia ?? []).map((media) => media?.mediaId))].filter((id): id is string => Boolean(id)));
    for (const id of pendingMediaIds.current) if (!usedMedia.has(id)) void removeMediaFile(id).catch(() => undefined);
    pendingMediaIds.current.clear();
    onSave(quiz);
  };
  const valid = Boolean(title.trim() && questions.length === questionCount && questions.every((question) => {
    const answerIndex = question.answerIndex ?? question.options.indexOf(question.answer);
    return question.prompt.trim() && question.options.length === optionCount && question.options.every((option, index) => option.trim() || question.optionMedia?.[index]?.mediaId) && answerIndex >= 0 && answerIndex < optionCount;
  }) && ((audioMediaId || audioDataUrl) || questions.every((question) => question.audioMediaId)));

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancel(); }}><section className="dialog-card audio-builder" role="dialog" aria-modal="true" aria-labelledby="audio-builder-title"><button className="dialog-close" onClick={cancel} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">АУДИОТЕСТ · {languageCode.toUpperCase()} · {level}</p><h2 id="audio-builder-title">{initial ? "Изменить аудиотест" : "Создать аудиотест"}</h2><label className="field-label">Название<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="audio-upload"><Icon name="headphones" /><strong>{audioName || "Общая запись для всех вопросов"}</strong><small>Можно прикрепить запись к каждому вопросу отдельно · до 4 МБ</small><input type="file" accept="audio/*" onChange={(event) => void uploadMedia(event.target.files?.[0] as File, undefined)} /></label>{audioPreviewUrl && <audio className="audio-preview" controls src={audioPreviewUrl} />}
    <div className="audio-config"><label className="field-label">Количество вопросов<select value={questionCount} onChange={(event) => setCount(Number(event.target.value))}>{[1, 2, 3, 5, 8, 10, 15, 20].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><label className="field-label">Вариантов в вопросе<select value={optionCount} onChange={(event) => setOptionsCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div>
    <div className="audio-question-list">{questions.map((question, index) => { const answerIndex = question.answerIndex ?? question.options.indexOf(question.answer); return <article key={question.id}><strong>Вопрос {index + 1}</strong><label className="field-label">Текст вопроса<input value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Что говорится в записи?" /></label><label className="audio-upload question-audio-upload"><Icon name="headphones" /><strong>{question.audioName || "Запись этого вопроса · необязательно"}</strong><small>Если загружена общая запись, этот файл будет иметь приоритет</small><input type="file" accept="audio/*" onChange={(event) => void uploadMedia(event.target.files?.[0] as File, index)} /></label>{question.audioMediaId && <div className="audio-question-attached"><MediaPreview media={{ kind: "audio", mediaId: question.audioMediaId, name: question.audioName ?? "Аудио вопроса" }} /><button type="button" className="text-danger" onClick={() => updateQuestion(index, { audioMediaId: undefined, audioName: undefined })}>Убрать запись вопроса</button></div>}<label className="field-label">Подсказка к раунду<input value={question.hint ?? ""} onChange={(event) => updateQuestion(index, { hint: event.target.value })} placeholder="Например: услышите приветствие при регистрации" /></label><div className="audio-options-edit">{question.options.map((option, optionIndex) => { const media = question.optionMedia?.[optionIndex]; return <div className="audio-option-edit" key={optionIndex}><label><span>Вариант {optionIndex + 1} · текст (можно оставить пустым)</span><input value={option} onChange={(event) => updateQuestion(index, { options: question.options.map((value, current) => current === optionIndex ? event.target.value : value) })} /></label><label className="audio-option-file">Изображение или звук<input type="file" accept="image/*,audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, index, optionIndex); event.currentTarget.value = ""; }} /></label><MediaPreview media={media} removable onRemove={() => updateQuestion(index, { optionMedia: question.optionMedia?.map((item, current) => current === optionIndex ? undefined : item) })} /></div>; })}</div><label className="field-label">Правильный ответ<select value={answerIndex >= 0 ? String(answerIndex) : ""} onChange={(event) => { const nextIndex = Number(event.target.value); updateQuestion(index, { answerIndex: nextIndex, answer: question.options[nextIndex] ?? "" }); }}><option value="">Выберите верный вариант</option>{question.options.map((option, optionIndex) => <option key={optionIndex} value={optionIndex}>{option.trim() || question.optionMedia?.[optionIndex]?.name || `Медиа-вариант ${optionIndex + 1}`}</option>)}</select></label></article>; })}</div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={cancel}>Отмена</button><button className="primary-button" disabled={!valid} onClick={save}>Сохранить аудиотест</button></div>
  </section></div>;
}

export function AudioQuizSession({ quiz, onExit, onAnswer, onEvent, onRestart }: { quiz: AudioQuiz; onExit: () => void; onAnswer: (correct: boolean) => void; onEvent?: (payload: Record<string, unknown>) => void; onRestart?: () => void | boolean | Promise<void | boolean> }) {
  const [questions, setQuestions] = useState(() => shuffleQuestions(quiz.questions));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedbackNonce, setFeedbackNonce] = useState(0);
  const completionReported = useRef(false);
  const question = questions[index];
  const restart = async () => {
    const allowed = await onRestart?.();
    if (allowed === false) return;
    completionReported.current = false;
    onEvent?.({ type: "practice-start", activityId: quiz.id, activity: quiz.title, moduleTitle: "Аудиотест", roundIndex: 0, roundTotal: quiz.questions.length, mode: "audio" });
    setQuestions(shuffleQuestions(quiz.questions)); setIndex(0); setSelected(null); setChecked(false); setScore(0); setSeconds(0); setHintVisible(false); setFinished(false);
  };
  const audioSrc = useMediaUrl(question?.audioMediaId ?? quiz.audioMediaId, question?.audioMediaId ? "" : quiz.audioDataUrl ?? "");
  useEffect(() => { if (finished) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [finished]);
  useEffect(() => { onEvent?.({ type: "practice-start", activityId: quiz.id, activity: quiz.title, moduleTitle: "Аудиотест", roundIndex: 0, roundTotal: quiz.questions.length, mode: "audio" }); }, [quiz.id]);
  useEffect(() => {
    if (!finished || completionReported.current) return;
    completionReported.current = true;
    onEvent?.({ type: "practice-complete", activityId: quiz.id, activity: quiz.title, moduleTitle: "Аудиотест", roundIndex: questions.length, roundTotal: questions.length, mode: "audio" });
  }, [finished, quiz.id, quiz.title, questions.length]);
  if (finished) return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><span>АУДИОТЕСТ</span><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></header><div className="game-result"><span className="result-medal">{score === questions.length ? "★" : "✓"}</span><p className="eyebrow">ТЕСТ ЗАВЕРШЁН</p><h1>{score} из {questions.length}</h1><p>Время: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p><button className="primary-button" onClick={() => void restart()}>Пройти ещё раз · новый порядок</button><button className="secondary-button" onClick={onExit}>Вернуться к тестам</button></div></div>;
  const correctIndex = question.answerIndex ?? question.options.indexOf(question.answer);
  const correctAnswer = question.options[correctIndex] || question.optionMedia?.[correctIndex]?.name || `Вариант ${correctIndex + 1}`;
  const optionLabel = (optionIndex: number) => question.options[optionIndex]?.trim() || question.optionMedia?.[optionIndex]?.name || `Вариант ${optionIndex + 1}`;
  const submit = () => {
    if (selected === null || checked) return;
    const correct = selected === correctIndex;
    playFeedbackSound(correct); setChecked(true); setFeedbackNonce((value) => value + 1); setScore((value) => value + (correct ? 1 : 0)); onAnswer(correct);
    onEvent?.({ type: "practice-answer", activityId: quiz.id, activity: quiz.title, moduleTitle: "Аудиотест", roundIndex: index + 1, roundTotal: questions.length, prompt: question.prompt || "Прослушивание", selectedAnswer: optionLabel(selected), correctAnswer: optionLabel(correctIndex), correct, mode: "audio" });
  };
  const next = () => { if (index === questions.length - 1) setFinished(true); else { setIndex((value) => value + 1); setSelected(null); setChecked(false); setHintVisible(false); } };
  return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>{quiz.title.toLocaleUpperCase()}</span><strong>{index + 1}/{questions.length}</strong></div><strong>Время {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></header><main className="game-center audio-player"><div className="game-progress"><i style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div><p className="question-kicker">Прослушайте запись и выберите ответ</p>{audioSrc ? <audio controls src={audioSrc} /> : <p className="lesson-error">Загружаю запись…</p>}<h1>{question.prompt}</h1>{question.hint && <div className="round-hint"><button type="button" onClick={() => setHintVisible((value) => !value)}><Icon name="info" size={15} /> {hintVisible ? "Скрыть подсказку" : "Подсказка к раунду"}</button>{hintVisible && <p>{question.hint}</p>}</div>}<div className="audio-answer-grid">{question.options.map((option, optionIndex) => { const media = question.optionMedia?.[optionIndex]; const label = option.trim() || media?.name || `Вариант ${optionIndex + 1}`; return <article className="audio-answer-item" key={`${optionIndex}-${label}`}><button disabled={checked} className={checked && optionIndex === correctIndex ? "correct" : checked && optionIndex === selected ? "wrong" : selected === optionIndex ? "chosen" : ""} onClick={() => setSelected(optionIndex)}><kbd>{optionIndex + 1}</kbd>{option.trim() || (media?.kind === "image" ? "Изображение" : media?.kind === "audio" ? "Прослушать вариант" : label)}</button><MediaPreview media={media} /></article>; })}</div>{checked && <span className={`answer-burst ${selected === correctIndex ? "correct" : "wrong"}`} key={feedbackNonce} aria-hidden="true">{selected === correctIndex ? "✓" : "×"}</span>}{checked && <div className={`game-feedback-panel ${selected === correctIndex ? "correct" : "wrong"}`}>{selected !== correctIndex && <p className="game-feedback wrong">Правильный ответ: {correctAnswer}</p>}<button className="primary-button" onClick={next}>{index === questions.length - 1 ? "Результат" : "Дальше"} <Icon name="arrow" /></button></div>}{!checked && <button className="primary-button" disabled={selected === null} onClick={submit}>Проверить <Icon name="arrow" /></button>}</main></div>;
}
