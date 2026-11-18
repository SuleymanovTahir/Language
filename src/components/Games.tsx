import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { VocabCard, VocabModule } from "../lib/vocab";
import { copyAppLink } from "../lib/shareLink";
import { loadMediaFile, removeMediaFile, saveMediaFile } from "../lib/mediaStore";
import { Icon } from "./Icon";
import { speakText, speechLocaleForCode } from "./StudySession";
import { AudioQuizBuilder, AudioQuizSession, type AudioQuiz } from "./AudioQuiz";

export type GameId = "pairs" | "articles" | "builder" | "blitz" | "hangman" | "wordsearch" | "anagram" | "train" | "moles" | "boxes" | "wheel" | "phonetic" | "finalsound" | "datajoin";
type GameInfo = { id: GameId; title: string; description: string; mark: string };

export const GAME_LIST: GameInfo[] = [
  { id: "pairs", title: "Мэтчинг пар", description: "Соедините немецкое слово с переводом", mark: "↔" },
  { id: "articles", title: "Группировка родов", description: "Перетащите слова в колонки der, die и das · таймер", mark: "●" },
  { id: "builder", title: "Конструктор фраз", description: "Соберите артикль и существительное", mark: "▤" },
  { id: "blitz", title: "Блиц-тест", description: "Четыре варианта ответа", mark: "ϟ" },
  { id: "hangman", title: "Сбор слова", description: "Откройте слово по буквам", mark: "_" },
  { id: "wordsearch", title: "Поиск в сетке", description: "Найдите слово по переводу", mark: "▦" },
  { id: "anagram", title: "Анаграмма", description: "Расставьте буквы в правильном порядке", mark: "Aa" },
  { id: "train", title: "Поезд слов", description: "Поставьте артикль перед существительным", mark: "🚃" },
  { id: "moles", title: "Ударь по слову", description: "Выберите правильный вариант из сетки", mark: "●" },
  { id: "boxes", title: "Коробки-сюрпризы", description: "Откройте коробку с верным переводом", mark: "□" },
  { id: "wheel", title: "Колесо фортуны", description: "Крутите колесо и отвечайте", mark: "◉" },
  { id: "phonetic", title: "Фонетический тир", description: "На слух найдите немецкое слово", mark: "♫" },
  { id: "finalsound", title: "Оглушение согласных", description: "Определите конечный звук b, d или g", mark: "音" },
  { id: "datajoin", title: "Data JOIN", description: "Соедините термины баз данных", mark: "⋈" },
];

export type GrammarTopicId = "accusative" | "wohin" | "negation" | "clauses" | "perfekt" | "separable";
type Question = { prompt: string; options: string[]; answer: string; explanation: string };
export type GrammarTopic = { id: string; title: string; description: string; explanation: string; examples: string[]; questions: Question[]; group?: "basics" | "sentences"; custom?: boolean; languageCode?: string; level?: string };

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  { id: "accusative", title: "Артикли в Akkusativ", description: "Прямое дополнение: den, die, das", explanation: "Akkusativ отвечает на вопрос «кого? что?». В мужском роде определённый артикль меняется с der на den; die и das сохраняют форму.", examples: ["Ich sehe den Hund. — Я вижу собаку.", "Sie kauft die Tasche. — Она покупает сумку.", "Wir brauchen das Ticket. — Нам нужен билет."], questions: [
    { prompt: "Ich sehe ___ Hund.", options: ["den", "der", "dem"], answer: "den", explanation: "Мужской род в Akkusativ: der → den." },
    { prompt: "Sie kauft ___ Tasche.", options: ["die", "der", "den"], answer: "die", explanation: "Женский род не меняется: die → die." },
    { prompt: "Wir brauchen ___ Ticket.", options: ["das", "dem", "den"], answer: "das", explanation: "Средний род не меняется: das → das." },
    { prompt: "Er hat ___ Bruder.", options: ["einen", "ein", "einem"], answer: "einen", explanation: "Неопределённый артикль мужского рода: ein → einen." },
  ] },
  { id: "wohin", title: "Wohin или Wo?", description: "Движение — Akkusativ, место — Dativ", explanation: "Предлоги an, auf, in, neben, unter и другие меняют падеж. Если предмет уже находится в месте (Wo?), нужен Dativ. Если он перемещается туда (Wohin?), нужен Akkusativ.", examples: ["Das Buch liegt auf dem Tisch. — Книга лежит на столе.", "Ich lege das Buch auf den Tisch. — Я кладу книгу на стол."], questions: [
    { prompt: "Das Buch liegt ___ Tisch.", options: ["auf dem", "auf den", "auf der"], answer: "auf dem", explanation: "Где лежит? Wo? Неподвижное место требует Dativ." },
    { prompt: "Ich lege das Buch ___ Tisch.", options: ["auf den", "auf dem", "auf der"], answer: "auf den", explanation: "Куда кладу? Wohin? Движение требует Akkusativ." },
    { prompt: "Die Lampe steht ___ Sofa.", options: ["neben dem", "neben das", "neben den"], answer: "neben dem", explanation: "Где стоит? Wo? Sofa — средний род, Dativ: dem." },
    { prompt: "Wir stellen den Stuhl ___ Fenster.", options: ["vor das", "vor dem", "vor der"], answer: "vor das", explanation: "Куда ставим? Wohin? Fenster — средний род, Akkusativ: das." },
  ] },
  { id: "negation", title: "Kein или nicht", description: "Отрицание существительных и действий", explanation: "Kein отрицает существительное, обычно вместо неопределённого артикля. Nicht отрицает глагол, признак или всё предложение.", examples: ["Ich habe keine Zeit. — У меня нет времени.", "Er kommt heute nicht. — Он сегодня не придёт.", "Das ist kein Problem. — Это не проблема."], questions: [
    { prompt: "Ich habe ___ Zeit.", options: ["keine", "nicht", "kein"], answer: "keine", explanation: "Существительное Zeit отрицается kein; женский род — keine." },
    { prompt: "Er kommt heute ___.", options: ["nicht", "kein", "keine"], answer: "nicht", explanation: "Отрицается действие kommen, поэтому используем nicht." },
    { prompt: "Das ist ___ Problem.", options: ["kein", "nicht", "keine"], answer: "kein", explanation: "Problem — существительное среднего рода: kein Problem." },
    { prompt: "Sie arbeitet heute ___.", options: ["nicht", "keine", "kein"], answer: "nicht", explanation: "Отрицается глагол arbeiten, поэтому nicht." },
  ] },
  { id: "clauses", title: "Союзы и порядок слов", description: "Глагол после weil уходит в конец", explanation: "После подчинительных союзов weil, dass и obwohl спрягаемый глагол стоит в конце придаточной части. После denn сохраняется обычный порядок слов.", examples: ["Ich bleibe zu Hause, weil ich krank bin.", "Ich bin müde, denn ich gehe schlafen."], questions: [
    { prompt: "Ich bleibe zu Hause, weil ich krank ___.", options: ["bin", "sein", "ist"], answer: "bin", explanation: "В придаточном с weil спрягаемый глагол стоит в конце." },
    { prompt: "Ich bin müde, ___ ich gehe schlafen.", options: ["denn", "weil", "dass"], answer: "denn", explanation: "После denn порядок слов остаётся прямым." },
    { prompt: "Er sagt, dass er heute nicht ___.", options: ["arbeitet", "arbeiten", "arbeitest"], answer: "arbeitet", explanation: "В придаточном с dass глагол стоит в конце." },
    { prompt: "___ es regnet, gehen wir spazieren.", options: ["Obwohl", "Weil", "Dass"], answer: "Obwohl", explanation: "Obwohl вводит уступительное придаточное; глагол regnet остаётся в конце придаточной части." },
  ] },
  { id: "perfekt", title: "Perfekt: haben или sein", description: "Выберите вспомогательный глагол", explanation: "Большинство глаголов образует Perfekt с haben. Sein обычно используют глаголы перемещения и перехода в другое состояние.", examples: ["Ich habe Kaffee getrunken. — Я выпил кофе.", "Wir sind nach Berlin gefahren. — Мы поехали в Берлин."], questions: [
    { prompt: "Wir ___ nach Berlin gefahren.", options: ["sind", "haben", "seid"], answer: "sind", explanation: "Перемещение из точки в точку обычно образует Perfekt с sein." },
    { prompt: "Ich ___ einen Kaffee getrunken.", options: ["habe", "bin", "hat"], answer: "habe", explanation: "Большинство переходных глаголов образует Perfekt с haben." },
    { prompt: "Sie ___ früh aufgestanden.", options: ["ist", "hat", "sind"], answer: "ist", explanation: "Смена состояния aufstehen образует Perfekt с sein." },
    { prompt: "Er ___ das Formular geschickt.", options: ["hat", "ist", "haben"], answer: "hat", explanation: "Schicken образует Perfekt с haben." },
  ] },
  { id: "separable", title: "Отделяемые приставки", description: "Приставка уходит в конец предложения", explanation: "В Präsens приставка отделяемого глагола уходит в конец предложения. На втором месте остаётся изменённая по лицу часть глагола.", examples: ["Der Zug fährt um zehn Uhr ab. — Поезд отправляется в десять.", "Ich stehe um sieben Uhr auf. — Я встаю в семь."], questions: [
    { prompt: "Der Zug fährt um zehn Uhr ___. (abfahren)", options: ["ab", "fahren", "abfahren"], answer: "ab", explanation: "В Präsens отделяемая приставка ставится в конец предложения." },
    { prompt: "Ich ___ um sieben Uhr auf. (aufstehen)", options: ["stehe", "aufstehe", "stehen"], answer: "stehe", explanation: "Спрягаемая часть steht на втором месте, приставка auf — в конце." },
    { prompt: "Mach bitte die Tür ___. (zumachen)", options: ["zu", "machen", "zumachen"], answer: "zu", explanation: "В повелительном наклонении отделяемая приставка также уходит в конец." },
    { prompt: "Wann ___ der Film an? (anfangen)", options: ["fängt", "anfängt", "fangen"], answer: "fängt", explanation: "Спрягаемая часть глагола стоит на втором месте, an — в конце." },
  ] },
];

export function validateGame(id: GameId, module: VocabModule) {
  const cards = module.cards;
  if (["articles", "train", "builder", "finalsound"].includes(id) && module.languageCode !== "de") return "Этот сценарий основан на правилах немецкого языка. Для другого языка выберите карточки и общий игровой формат.";
  if (id === "articles" && (cards.filter((card) => card.article).length < 3 || new Set(cards.map((card) => card.article).filter(Boolean)).size < 2)) return "Для сортировки нужны 3 существительных минимум двух родов.";
  if (id === "pairs" && new Set(cards.map((card) => card.translation.toLowerCase())).size < 2) return "Для пар нужны хотя бы 2 разных перевода.";
  if (id === "datajoin" && new Set(cards.map((card) => card.translation.toLowerCase())).size < 2) return "Для Data JOIN нужны хотя бы 2 разных перевода.";
  if (id === "finalsound" && cards.filter((card) => /[bdg]$/i.test(card.word.normalize("NFC"))).length < 1) return "В наборе нет слова на b, d или g для этого упражнения.";
  if (id === "wordsearch" && cards.filter((card) => /^[\p{L}]{4,9}$/iu.test(card.word.normalize("NFC"))).length < 1) return "Для сетки нужно слово длиной от 4 до 9 букв.";
  if (id === "anagram" && cards.filter((card) => /^[\p{L}]{4,14}$/iu.test(card.word.normalize("NFC"))).length < 1) return "Для анаграммы нужно слово длиной от 4 до 14 букв.";
  if (!cards.length) return "Сначала выберите карточки для игры.";
  return null;
}

const articlePracticeWords = [
  ["der", "Hund", "собака", "[хунт]"], ["die", "Katze", "кошка", "[каце]"], ["das", "Buch", "книга", "[бух]"],
  ["der", "Tisch", "стол", "[тиш]"], ["die", "Lampe", "лампа", "[лампе]"], ["das", "Haus", "дом", "[хаус]"],
] as const;
const soundPracticeWords = [
  ["Hund", "собака", "[хунт]"], ["Tag", "день", "[так]"], ["Dieb", "вор", "[дип]"],
] as const;
const germanOnlyGames = new Set<GameId>(["articles", "builder", "train", "finalsound", "datajoin"]);
const languageForms: Record<string, { adjective: string; locative: string }> = {
  de: { adjective: "немецкое", locative: "немецком" }, en: { adjective: "английское", locative: "английском" },
  es: { adjective: "испанское", locative: "испанском" }, fr: { adjective: "французское", locative: "французском" },
  it: { adjective: "итальянское", locative: "итальянском" }, tr: { adjective: "турецкое", locative: "турецком" },
};

function practiceSample(module: VocabModule, kind: "articles" | "sound" | "general"): VocabCard[] {
  const rows = kind === "articles" ? articlePracticeWords : kind === "sound" ? soundPracticeWords : articlePracticeWords;
  return rows.map((row, index) => {
    const [article, word, translation, transcription] = kind === "articles" ? row as typeof articlePracticeWords[number] : kind === "sound" ? [null, ...row] as [null, string, string, string] : row as typeof articlePracticeWords[number];
    return { id: `sample-${module.languageCode}-${kind}-${index + 1}`, moduleId: module.id, article: article as VocabCard["article"], word, translation, transcription, partOfSpeech: "noun", phoneticRuleId: kind === "sound" ? "PHON-03" : null };
  });
}

export function prepareGameModule(id: GameId, module: VocabModule): VocabModule {
  if (module.languageCode !== "de") return module;
  const cards = module.cards;
  const hasArticlePack = cards.filter((card) => card.article).length >= 3 && new Set(cards.map((card) => card.article).filter(Boolean)).size >= 2;
  const hasNoun = cards.some((card) => card.article);
  const hasSound = cards.some((card) => /[bdg]$/i.test(card.word.normalize("NFC")));
  const hasLongWord = cards.some((card) => id === "wordsearch" ? /^[\p{L}]{4,9}$/iu.test(card.word.normalize("NFC")) : id === "anagram" ? /^[\p{L}]{4,14}$/iu.test(card.word.normalize("NFC")) : false);
  if (id === "articles" && !hasArticlePack) return { ...module, cards: practiceSample(module, "articles"), practiceNote: "Примерный набор A1 · немецкие существительные" };
  if ((id === "train" || id === "builder") && !hasNoun) return { ...module, cards: practiceSample(module, "articles"), practiceNote: "Примерный набор A1 · немецкие существительные" };
  if (id === "finalsound" && !hasSound) return { ...module, cards: practiceSample(module, "sound"), practiceNote: "Примерный набор A1 · конечные согласные" };
  if ((id === "wordsearch" || id === "anagram") && !hasLongWord) return { ...module, cards: practiceSample(module, "general"), practiceNote: "Примерный набор A1 · слова для игры" };
  if ((id === "pairs" || id === "datajoin") && new Set(cards.map((card) => card.translation.toLowerCase())).size < 2) return { ...module, cards: practiceSample(module, "general"), practiceNote: "Примерный набор A1 · слова для игры" };
  return module;
}

type SavedActivity = { id: string; title: string; gameId: GameId; moduleId: number; languageCode: string; level: string; cardIds: string[]; cards?: VocabCard[]; instructions?: string; media?: NonNullable<VocabModule["practiceMedia"]> };
type GrammarDraftQuestion = { prompt: string; optionsText: string; answer: string; explanation: string };
type GrammarDraft = { id: string; title: string; description: string; explanation: string; examplesText: string; group: "basics" | "sentences"; questions: GrammarDraftQuestion[] };

function GameArtwork({ gameId, module }: { gameId: GameId; module: VocabModule }) {
  const card = module.cards[0];
  const second = module.cards[1];
  const shownWord = card ? `${card.article ? `${card.article} ` : ""}${card.word}` : "Слово";
  const secondWord = second ? `${second.article ? `${second.article} ` : ""}${second.word}` : "Карточка";
  let art: ReactNode;
  if (gameId === "pairs") art = <><i>{shownWord}</i><i>{card?.translation ?? "Перевод"}</i><i>{secondWord}</i><i>{second?.translation ?? "значение"}</i></>;
  else if (gameId === "datajoin") art = <><i>SELECT</i><i>выбор</i><i>JOIN</i><i>связь</i></>;
  else if (gameId === "articles") art = <><i>der</i><i>die</i><i>das</i></>;
  else if (gameId === "builder" || gameId === "train") art = <><i>{card?.article ?? "der"}</i><i>{card?.word ?? "Tisch"}</i><i>?</i></>;
  else if (gameId === "blitz") art = <><i>{card?.translation ?? "Ответ"}</i><i>{second?.translation ?? "Вариант"}</i><i>…</i><i>✓</i></>;
  else if (gameId === "hangman") art = <><i>_ _ _ _</i><i>A&nbsp; E&nbsp; I</i></>;
  else if (gameId === "wordsearch") { const letters = [...(card?.word.normalize("NFC") ?? "WORT")].slice(0, 9); art = <>{Array.from({ length: 9 }, (_, index) => <i key={index}>{letters[index] ?? "·"}</i>)}</>; }
  else if (gameId === "anagram") art = <>{[...(card?.word ?? "Wort")].slice(0, 5).map((letter, index) => <i key={`${letter}-${index}`}>{letter}</i>)}</>;
  else if (gameId === "moles") art = <><i>◉</i><i>◉</i><i>◉</i><i>◉</i></>;
  else if (gameId === "boxes") art = <><i>?</i><i>?</i><i>?</i></>;
  else if (gameId === "wheel") art = <><i>✦</i><b>КРУТИ</b></>;
  else if (gameId === "phonetic") art = <><i>♫</i><b>СЛУШАЙ</b></>;
  else art = <><b>{shownWord}</b><i>п</i><i>т</i><i>к</i></>;
  return <span className={`game-tile-art art-${gameId}`} aria-hidden="true">{art}</span>;
}

export function GameHub({ modules, preferredModuleId, languageCode, languageName, level, onStart, onGrammar, onAudioAnswer }: { modules: VocabModule[]; preferredModuleId: number | null; languageCode: string; languageName: string; level: string; onStart: (id: GameId, module: VocabModule) => void; onGrammar: (topic: GrammarTopic) => void; onAudioAnswer: (correct: boolean) => void }) {
  const preferred = modules.find((module) => module.id === 1) ?? modules[0];
  const [moduleId, setModuleId] = useState(preferred?.id ?? 0);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"games" | "grammar">("games");
  const [hashRoute, setHashRoute] = useState(() => window.location.hash);
  const [activities, setActivities] = useState<SavedActivity[]>(() => { try { const saved = JSON.parse(localStorage.getItem("linguaplay-saved-activities") || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } });
  const [audioQuizzes, setAudioQuizzes] = useState<AudioQuiz[]>(() => { try { const saved = JSON.parse(localStorage.getItem("linguaplay-audio-quizzes") || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } });
  const [audioBuilderOpen, setAudioBuilderOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioQuiz | undefined>(undefined);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityGame, setActivityGame] = useState<GameId>("pairs");
  const [builderModuleId, setBuilderModuleId] = useState<number>(preferred?.id ?? 0);
  const [activityCards, setActivityCards] = useState<VocabCard[]>([]);
  const [cardPreset, setCardPreset] = useState<"all" | "pronoun" | "noun" | "verb">("all");
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activityInstructions, setActivityInstructions] = useState("");
  const [activityMedia, setActivityMedia] = useState<VocabModule["practiceMedia"]>();
  const [activityMediaUrl, setActivityMediaUrl] = useState("");
  const [activityLinkDraft, setActivityLinkDraft] = useState("");
  const mediaFileInput = useRef<HTMLInputElement>(null);
  const pendingMediaIds = useRef<string[]>([]);
  const originalMediaId = useRef<string | null>(null);
  const [grammarGroup, setGrammarGroup] = useState<"basics" | "sentences">("basics");
  const [customGrammar, setCustomGrammar] = useState<GrammarTopic[]>(() => { try { const saved = JSON.parse(localStorage.getItem("linguaplay-custom-grammar") || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } });
  const visibleCustomGrammar = customGrammar.filter((topic) => (topic.languageCode ?? "de") === languageCode && (topic.level ?? "A1–A2") === level);
  const [grammarBuilderOpen, setGrammarBuilderOpen] = useState(false);
  const [grammarDraft, setGrammarDraft] = useState<GrammarDraft | null>(null);
  useEffect(() => localStorage.setItem("linguaplay-saved-activities", JSON.stringify(activities)), [activities]);
  useEffect(() => localStorage.setItem("linguaplay-audio-quizzes", JSON.stringify(audioQuizzes)), [audioQuizzes]);
  useEffect(() => localStorage.setItem("linguaplay-custom-grammar", JSON.stringify(customGrammar)), [customGrammar]);
  useEffect(() => {
    const syncHash = () => setHashRoute(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  useEffect(() => {
    let createdUrl = "";
    let alive = true;
    setActivityMediaUrl("");
    if (activityMedia?.id) void loadMediaFile(activityMedia.id).then((blob) => {
      if (!alive || !blob) return;
      createdUrl = URL.createObjectURL(blob);
      setActivityMediaUrl(createdUrl);
    }).catch(() => undefined);
    else if (activityMedia?.url) setActivityMediaUrl(activityMedia.url);
    return () => { alive = false; if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [activityMedia]);
  useEffect(() => { if (preferredModuleId !== null && modules.some((module) => module.id === preferredModuleId)) setModuleId(preferredModuleId); }, [preferredModuleId]);
  useEffect(() => { if (!modules.some((module) => module.id === moduleId)) setModuleId(modules[0]?.id ?? 0); }, [modules, moduleId]);
  const selectedModule = modules.find((module) => module.id === moduleId) ?? modules[0];
  const selectedCards = selectedModule?.cards ?? [];
  const builderModule = modules.find((module) => module.id === builderModuleId) ?? selectedModule;
  const builderCards = activityCards;
  const languageForm = languageForms[languageCode] ?? { adjective: "учебное", locative: languageName.toLocaleLowerCase() };
  const availableGames = GAME_LIST.filter((game) => languageCode === "de" || !germanOnlyGames.has(game.id)).map((game) => game.id === "pairs" ? { ...game, description: `Соедините ${languageForm.adjective} слово с переводом` } : game.id === "phonetic" ? { ...game, description: `На слух найдите слово на ${languageForm.locative}` } : game);
  const builderGames = GAME_LIST.filter((game) => builderModule?.languageCode === "de" || !germanOnlyGames.has(game.id)).map((game) => game.id === "pairs" ? { ...game, description: `Соедините ${languageForm.adjective} слово с переводом` } : game.id === "phonetic" ? { ...game, description: `На слух найдите слово на ${languageForm.locative}` } : game);
  const filteredCards = builderCards.filter((card) => cardPreset === "all" || card.partOfSpeech === cardPreset);
  const moduleActivities = activities.filter((activity) => activity.languageCode === languageCode && activity.level === level && availableGames.some((game) => game.id === activity.gameId));
  const visibleAudioQuizzes = audioQuizzes.filter((quiz) => quiz.languageCode === languageCode && quiz.level === level);
  const closeActivityBuilder = () => {
    pendingMediaIds.current.forEach((id) => void removeMediaFile(id).catch(() => undefined));
    pendingMediaIds.current = []; originalMediaId.current = null; setBuilderOpen(false);
  };
  const openNewActivity = () => { setEditingActivityId(null); setBuilderModuleId(selectedModule?.id ?? 0); setActivityCards(selectedCards.map((card) => ({ ...card }))); setActivityTitle(`Игра · ${selectedModule?.title ?? ""}`); setActivityGame("pairs"); setCardPreset("all"); setSelectedCardIds([]); setActivityInstructions(""); setActivityMedia(undefined); setActivityLinkDraft(""); originalMediaId.current = null; pendingMediaIds.current = []; setBuilderOpen(true); };
  const openEditActivity = (activity: SavedActivity) => {
    const sourceModule = modules.find((module) => module.id === activity.moduleId);
    const savedCards = activity.cards?.length ? activity.cards : sourceModule?.cards.filter((card) => activity.cardIds.includes(card.id)) ?? [];
    setEditingActivityId(activity.id); setBuilderModuleId(activity.moduleId); setActivityCards(savedCards.map((card) => ({ ...card }))); setActivityTitle(activity.title); setActivityGame(activity.gameId); setCardPreset("all"); setSelectedCardIds(savedCards.map((card) => card.id)); setActivityInstructions(activity.instructions ?? ""); setActivityMedia(activity.media); setActivityLinkDraft(""); originalMediaId.current = activity.media?.id ?? null; pendingMediaIds.current = []; setBuilderOpen(true);
  };
  const changeBuilderModule = (id: number) => {
    const previousModule = builderModule;
    const nextModule = modules.find((module) => module.id === id);
    if (!nextModule) return;
    if (previousModule) setActivityTitle((current) => current === `Игра · ${previousModule.title}` ? `Игра · ${nextModule.title}` : current);
    setBuilderModuleId(id); setActivityCards(nextModule.cards.map((card) => ({ ...card }))); setSelectedCardIds([]); setCardPreset("all");
    setActivityGame((current) => nextModule.languageCode !== "de" && germanOnlyGames.has(current) ? "pairs" : current);
  };
  const updateActivityCard = (cardId: string, patch: Partial<VocabCard>) => setActivityCards((current) => current.map((card) => card.id === cardId ? { ...card, ...patch } : card));
  const addActivityCard = () => {
    const id = `activity-card-${crypto.randomUUID?.() ?? Date.now()}`;
    setActivityCards((current) => [...current, { id, moduleId: builderModule?.id ?? 0, word: "", article: null, transcription: "", translation: "", partOfSpeech: "other", phoneticRuleId: null }]);
    setSelectedCardIds((current) => [...current, id]);
  };
  const attachActivityFile = async (file?: File) => {
    if (!file) return;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : null;
    if (!kind) { setNotice("Для игры выберите изображение, аудио или видео."); return; }
    const maxSize = kind === "image" ? 30 : kind === "audio" ? 60 : 100;
    if (file.size > maxSize * 1024 * 1024) { setNotice(`Файл больше ${maxSize} МБ. Выберите файл меньшего размера.`); return; }
    const id = `activity-media-${crypto.randomUUID?.() ?? Date.now()}`;
    try {
      await saveMediaFile(id, file);
      pendingMediaIds.current.push(id);
      setActivityMedia({ id, kind, name: file.name, mimeType: file.type });
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить медиафайл в этом браузере."); }
    finally { if (mediaFileInput.current) mediaFileInput.current.value = ""; }
  };
  const attachActivityLink = () => {
    try {
      const link = new URL(activityLinkDraft.trim());
      if (!["https:", "http:"].includes(link.protocol)) throw new Error();
      setActivityMedia({ kind: "link", name: "Дополнительная ссылка", url: link.toString() });
      setActivityLinkDraft(""); setNotice("");
    } catch { setNotice("Введите ссылку, начинающуюся с http:// или https://."); }
  };
  const saveActivity = () => {
    if (!builderModule || !activityTitle.trim() || !selectedCardIds.length) return;
    const cards = builderCards.filter((card) => selectedCardIds.includes(card.id));
    if (cards.some((card) => !card.word.trim() || !card.translation.trim())) { setNotice("Заполните слово и перевод для каждой выбранной карточки."); return; }
    const activity: SavedActivity = { id: editingActivityId ?? `activity-${Date.now()}`, title: activityTitle.trim(), gameId: activityGame, moduleId: builderModule.id, languageCode: builderModule.languageCode, level: builderModule.level, cardIds: cards.map((card) => card.id), cards, instructions: activityInstructions.trim(), media: activityMedia };
    const keptMediaId = activityMedia?.id ?? null;
    pendingMediaIds.current.filter((id) => id !== keptMediaId).forEach((id) => void removeMediaFile(id).catch(() => undefined));
    if (originalMediaId.current && originalMediaId.current !== keptMediaId) void removeMediaFile(originalMediaId.current).catch(() => undefined);
    pendingMediaIds.current = []; originalMediaId.current = keptMediaId;
    setActivities((current) => editingActivityId ? current.map((item) => item.id === editingActivityId ? activity : item) : [...current, activity]);
    setBuilderOpen(false); setNotice("Игра сохранена. Запустите её из раздела «Мои игры».");
  };
  const runActivity = (activity: SavedActivity) => {
    const sourceModule = modules.find((item) => item.id === activity.moduleId);
    if (!sourceModule) { setNotice("Исходный модуль игры больше не найден в этом кабинете."); return; }
    const cards = activity.cards?.length ? activity.cards : sourceModule.cards.filter((card) => activity.cardIds.includes(card.id));
    const module = prepareGameModule(activity.gameId, { ...sourceModule, title: activity.title, cards, practiceInstructions: activity.instructions, practiceMedia: activity.media });
    const unavailable = validateGame(activity.gameId, module);
    if (unavailable) { setNotice(unavailable); return; }
    onStart(activity.gameId, module);
  };
  const deleteActivity = (activity: SavedActivity) => {
    setActivities((current) => current.filter((item) => item.id !== activity.id));
    if (activity.media?.id) void removeMediaFile(activity.media.id).catch(() => undefined);
  };
  const copyMaterialLink = async (route: string) => setNotice(await copyAppLink(route) ? "Ссылка скопирована. Она откроет этот материал в текущем кабинете." : "Не удалось скопировать ссылку.");
  useEffect(() => {
    const params = new URLSearchParams(hashRoute.split("?").slice(1).join("?"));
    const activityId = params.get("activity");
    const grammarId = params.get("grammar");
    const audioId = params.get("audio");
    if (activityId) {
      const activity = activities.find((item) => item.id === activityId);
      if (!activity) return;
      window.history.replaceState(window.history.state, "", "#/games");
      runActivity(activity);
    } else if (grammarId) {
      const topic = visibleCustomGrammar.find((item) => item.id === grammarId) ?? GRAMMAR_TOPICS.find((item) => item.id === grammarId);
      if (!topic || (topic.custom && ((topic.languageCode ?? "de") !== languageCode || (topic.level ?? "A1–A2") !== level))) return;
      window.history.replaceState(window.history.state, "", "#/games");
      setActiveTab("grammar");
      onGrammar(topic);
    } else if (audioId && audioQuizzes.some((quiz) => quiz.id === audioId && quiz.languageCode === languageCode && quiz.level === level)) {
      window.history.replaceState(window.history.state, "", "#/games");
      setActiveAudioId(audioId);
    }
  }, [activities, audioQuizzes, visibleCustomGrammar, modules, hashRoute]);
  const saveAudioQuiz = (quiz: AudioQuiz) => { setAudioQuizzes((current) => current.some((item) => item.id === quiz.id) ? current.map((item) => item.id === quiz.id ? quiz : item) : [...current, quiz]); setAudioBuilderOpen(false); setEditingAudio(undefined); setNotice("Аудиотест сохранён в текущем кабинете."); };
  const openGrammarBuilder = (topic?: GrammarTopic) => {
    setGrammarDraft(topic ? { id: topic.id, title: topic.title, description: topic.description, explanation: topic.explanation, examplesText: topic.examples.join("\n"), group: topic.group ?? grammarGroup, questions: topic.questions.map((question) => ({ ...question, optionsText: question.options.join("; ") })) } : { id: `custom-grammar-${Date.now()}`, title: "", description: "", explanation: "", examplesText: "", group: grammarGroup, questions: [{ prompt: "___", optionsText: "", answer: "", explanation: "" }] });
    setGrammarBuilderOpen(true);
  };
  const saveGrammarTopic = () => {
    if (!grammarDraft) return;
    const topic: GrammarTopic = { id: grammarDraft.id, title: grammarDraft.title.trim(), description: grammarDraft.description.trim(), explanation: grammarDraft.explanation.trim(), examples: grammarDraft.examplesText.split("\n").map((line) => line.trim()).filter(Boolean), group: grammarDraft.group, custom: true, languageCode, level, questions: grammarDraft.questions.map((question) => ({ prompt: question.prompt.trim(), options: question.optionsText.split(";").map((option) => option.trim()).filter(Boolean), answer: question.answer.trim(), explanation: question.explanation.trim() })) };
    setCustomGrammar((current) => current.some((item) => item.id === topic.id) ? current.map((item) => item.id === topic.id ? topic : item) : [...current, topic]);
    setGrammarBuilderOpen(false); setGrammarDraft(null); setNotice("Тема грамматики сохранена в этом языковом кабинете.");
  };
  const activeAudioQuiz = audioQuizzes.find((quiz) => quiz.id === activeAudioId);
  if (activeAudioQuiz) return <AudioQuizSession quiz={activeAudioQuiz} onExit={() => setActiveAudioId(null)} onAnswer={onAudioAnswer} />;
  return <div className="page games-page">
    <div className="page-heading"><div><p className="eyebrow">{selectedModule?.languageName ?? "УЧЕБНЫЙ КАБИНЕТ"} · {selectedModule?.level ?? ""}</p><h1>Практика</h1><p>{selectedModule ? `Задания только по модулю «${selectedModule.title}». Выберите слова и сценарий своей игры.` : "Добавьте материалы в текущий языковой кабинет."}</p></div>{Boolean(modules.length) && <label className="module-select-label">Модуль<select value={moduleId} onChange={(event) => { setModuleId(Number(event.target.value)); setNotice(""); }}>{modules.map((module) => <option key={module.id} value={module.id}>Модуль {module.id} · {module.title}</option>)}</select></label>}</div>
    <div className="practice-tabs"><button className={activeTab === "games" ? "active" : ""} onClick={() => setActiveTab("games")}>Игры по словам</button><button className={activeTab === "grammar" ? "active" : ""} onClick={() => setActiveTab("grammar")}>Грамматика</button></div>
    {notice && <div className="inline-notice"><Icon name="info" />{notice}<button onClick={() => setNotice("")} aria-label="Закрыть"><Icon name="close" size={16} /></button></div>}
    {activeTab === "games" && selectedModule && <><div className="practice-section-title"><div><h2>Игры по вашим словам</h2><p>Выберите формат и потренируйте карточки этого модуля.</p></div><button className="primary-button compact" onClick={openNewActivity}><Icon name="plus" size={16} /> Создать игру</button></div><div className="games-grid">{availableGames.map((game, index) => {
      const prepared = prepareGameModule(game.id, selectedModule);
      const unavailable = validateGame(game.id, prepared);
      return <button className={`game-tile ${unavailable ? "locked" : ""}`} key={game.id} onClick={() => { if (unavailable) setNotice(unavailable); else { setNotice(""); onStart(game.id, prepared); } }}>
        <GameArtwork gameId={game.id} module={prepared} /><span className="game-tile-copy"><strong>{game.title}</strong><small>{unavailable || (prepared.practiceNote ? `${game.description} · ${prepared.practiceNote}` : game.description)}</small>{!unavailable && <em>Посмотреть пример →</em>}</span><span className="game-lock">{unavailable ? "⌑" : <Icon name="arrow" size={17} />}</span>
      </button>;
    })}</div>
      <section className="saved-activities"><div className="section-title"><div><h2>Мои игры</h2><p>Сценарии для текущего языка и уровня.</p></div></div>{moduleActivities.length ? <div className="saved-activity-list">{moduleActivities.map((activity) => <article key={activity.id}><span className="activity-icon">{GAME_LIST.find((game) => game.id === activity.gameId)?.mark}</span><div><strong>{activity.title}</strong><small>{GAME_LIST.find((game) => game.id === activity.gameId)?.title} · Модуль {activity.moduleId} · {activity.cardIds.length} карточек</small></div><button onClick={() => runActivity(activity)}>Начать</button><button onClick={() => void copyMaterialLink(`games?activity=${encodeURIComponent(activity.id)}`)}>Ссылка</button><button aria-label={`Изменить игру ${activity.title}`} onClick={() => openEditActivity(activity)}>Изменить</button><button aria-label={`Удалить игру ${activity.title}`} onClick={() => deleteActivity(activity)}>Удалить</button></article>)}</div> : <p className="empty-inline">Создайте игру, выберите шаблон и слова: например, только местоимения или существительные.</p>}</section>
      </>}
    {activeTab === "games" && <section className="saved-activities audio-activities"><div className="section-title"><div><h2>Аудиотесты</h2><p>Свои аудиозаписи и вопросы только для {languageName} · {level}.</p></div><button className="primary-button compact" onClick={() => { setEditingAudio(undefined); setAudioBuilderOpen(true); }}><Icon name="plus" size={15} /> Создать тест</button></div>{visibleAudioQuizzes.length ? <div className="saved-activity-list">{visibleAudioQuizzes.map((quiz) => <article key={quiz.id}><span className="activity-icon"><Icon name="headphones" size={17} /></span><div><strong>{quiz.title}</strong><small>{quiz.questions.length} вопросов · {quiz.audioName}</small></div><button onClick={() => setActiveAudioId(quiz.id)}>Начать</button><button onClick={() => void copyMaterialLink(`games?audio=${encodeURIComponent(quiz.id)}`)}>Ссылка</button><button onClick={() => { setEditingAudio(quiz); setAudioBuilderOpen(true); }}>Изменить</button><button aria-label={`Удалить аудиотест ${quiz.title}`} onClick={() => setAudioQuizzes((current) => current.filter((item) => item.id !== quiz.id))}>Удалить</button></article>)}</div> : <p className="empty-inline">Загрузите аудио, задайте число вопросов и вариантов, затем отметьте верный ответ.</p>}</section>}
    {activeTab === "grammar" && <div className="grammar-hub"><div className="practice-section-title"><div><h2>Грамматика · {languageName} · {level}</h2><p>Сначала правило и примеры, затем упражнения по теме.</p></div><button className="primary-button compact" onClick={() => openGrammarBuilder()}><Icon name="plus" size={15} /> Создать тему</button></div><div className="grammar-tabs"><button className={grammarGroup === "basics" ? "active" : ""} onClick={() => setGrammarGroup("basics")}>Основы</button><button className={grammarGroup === "sentences" ? "active" : ""} onClick={() => setGrammarGroup("sentences")}>Предложение</button></div><div className="grammar-grid">{GRAMMAR_TOPICS.filter((topic) => languageCode === "de" && level === "A1–A2" && (grammarGroup === "basics" ? ["accusative", "wohin", "negation"].includes(topic.id) : ["clauses", "perfekt", "separable"].includes(topic.id))).map((topic) => <article className="custom-grammar-card" key={topic.id}><button className="custom-grammar-start" onClick={() => onGrammar(topic)}><span><Icon name="brain" /></span><strong>{topic.title}</strong><small>{topic.description}</small><Icon name="arrow" size={17} /></button><footer><button onClick={() => void copyMaterialLink(`games?grammar=${encodeURIComponent(topic.id)}`)}>Ссылка</button></footer></article>)}{visibleCustomGrammar.filter((topic) => topic.group === grammarGroup).map((topic) => <article className="custom-grammar-card" key={topic.id}><button className="custom-grammar-start" onClick={() => onGrammar(topic)}><span><Icon name="brain" /></span><strong>{topic.title}</strong><small>{topic.description}</small><Icon name="arrow" size={17} /></button><footer><button onClick={() => void copyMaterialLink(`games?grammar=${encodeURIComponent(topic.id)}`)}>Ссылка</button><button onClick={() => openGrammarBuilder(topic)}>Изменить</button><button onClick={() => setCustomGrammar((current) => current.filter((item) => item.id !== topic.id))}>Удалить</button></footer></article>)}</div>{!visibleCustomGrammar.some((topic) => topic.group === grammarGroup) && <p className="empty-inline">Свои темы и тесты можно добавить кнопкой «Создать тему».</p>}</div>}
    {!selectedModule && activeTab === "games" && <div className="empty-state cabinet-empty"><Icon name="library" size={32} /><h2>В этом кабинете пока пусто</h2><p>Добавьте словарь в выбранном языке и уровне — задания будут строиться только по нему.</p></div>}
    {builderOpen && builderModule && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeActivityBuilder(); }}><section className="dialog-card activity-builder" role="dialog" aria-modal="true" aria-labelledby="activity-title">
      <button className="dialog-close" onClick={closeActivityBuilder} aria-label="Закрыть"><Icon name="close" /></button>
      <p className="eyebrow">ИГРА · {builderModule.languageName} · {builderModule.level}</p><h2 id="activity-title">{editingActivityId ? "Изменить игру" : "Создать игру"}</h2>
      <div className="activity-builder-layout">
        <div className="activity-builder-config">
          <label className="field-label">В каком модуле будет игра?<select value={builderModule.id} onChange={(event) => changeBuilderModule(Number(event.target.value))}>{modules.map((module) => <option key={module.id} value={module.id}>Модуль {module.id} · {module.title}</option>)}</select></label>
          <label className="field-label">Название<input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} /></label>
          <div className="template-picker"><div className="template-picker-heading"><strong>Как будем играть?</strong><span>Выберите формат — справа появится пример экрана.</span></div><div className="template-picker-grid">{builderGames.map((game, index) => <button type="button" key={game.id} className={`template-choice ${activityGame === game.id ? "active" : ""}`} onClick={() => setActivityGame(game.id)} aria-pressed={activityGame === game.id}><span className={`game-mark color-${index % 5}`}>{game.mark}</span><span><strong>{game.title}</strong><small>{game.description}</small></span></button>)}</div></div>
          <section className="activity-extra-content"><label className="field-label">Инструкция или подсказка<textarea rows={2} value={activityInstructions} onChange={(event) => setActivityInstructions(event.target.value)} placeholder="Например: слушайте слово и выберите его перевод." /></label><div className="activity-media-controls"><input ref={mediaFileInput} type="file" accept="image/*,audio/*,video/*" onChange={(event) => void attachActivityFile(event.target.files?.[0])} /><button className="secondary-button" type="button" onClick={() => mediaFileInput.current?.click()}>Прикрепить картинку, аудио или видео</button><label className="field-label">Ссылка на видео или материал<input value={activityLinkDraft} onChange={(event) => setActivityLinkDraft(event.target.value)} placeholder="https://…" /></label><button className="secondary-button" type="button" onClick={attachActivityLink}>Добавить ссылку</button></div>{activityMedia && <div className="activity-attached-file"><span><strong>{activityMedia.name}</strong><small>{activityMedia.kind === "image" ? "Изображение" : activityMedia.kind === "audio" ? "Аудио" : activityMedia.kind === "video" ? "Видео" : "Внешняя ссылка"}</small></span><button type="button" onClick={() => setActivityMedia(undefined)}>Убрать</button></div>}</section>
          <div className="card-presets"><strong>Какие слова использовать?</strong>{(["all", "pronoun", "noun", "verb"] as const).map((preset) => <button type="button" key={preset} className={cardPreset === preset ? "active" : ""} onClick={() => { setCardPreset(preset); setSelectedCardIds(builderCards.filter((card) => preset === "all" || card.partOfSpeech === preset).map((card) => card.id)); }}>{preset === "all" ? "Все слова" : preset === "pronoun" ? "Местоимения" : preset === "noun" ? "Существительные" : "Глаголы"}</button>)}</div>
          <div className="activity-card-list">{filteredCards.map((card) => <article className="activity-card-edit" key={card.id}><label className="activity-card-check"><input type="checkbox" checked={selectedCardIds.includes(card.id)} onChange={(event) => setSelectedCardIds((current) => event.target.checked ? [...new Set([...current, card.id])] : current.filter((id) => id !== card.id))} /><span>Включить в игру</span></label><label>Слово<input value={card.word} onChange={(event) => updateActivityCard(card.id, { word: event.target.value })} /></label><label>Перевод<input value={card.translation} onChange={(event) => updateActivityCard(card.id, { translation: event.target.value })} /></label>{builderModule.languageCode === "de" && <label>Артикль<select value={card.article ?? ""} onChange={(event) => updateActivityCard(card.id, { article: (event.target.value || null) as VocabCard["article"] })}><option value="">Без артикля</option><option value="der">der</option><option value="die">die</option><option value="das">das</option></select></label>}<button className="text-danger" onClick={() => { setActivityCards((current) => current.filter((item) => item.id !== card.id)); setSelectedCardIds((current) => current.filter((id) => id !== card.id)); }}>Убрать карточку</button></article>)}{!filteredCards.length && <p className="empty-inline">В этом модуле пока нет карточек для выбранной группы.</p>}</div><button className="secondary-button add-card-button" onClick={addActivityCard}><Icon name="plus" size={15} /> Добавить свою пару «слово — перевод»</button>
        </div>
        <aside className="activity-preview-pane"><div className="activity-preview-heading"><span>ПРЕДПРОСМОТР</span><strong>Пример игрового экрана</strong></div><LiveTemplatePreview gameId={activityGame} module={{ ...builderModule, practiceInstructions: activityInstructions, practiceMedia: activityMedia }} cards={builderCards.filter((card) => selectedCardIds.includes(card.id))} />{activityMedia && <div className="activity-preview-attachment">{activityMedia.kind === "image" && activityMediaUrl ? <img src={activityMediaUrl} alt={activityMedia.name} /> : activityMedia.kind === "audio" && activityMediaUrl ? <audio controls src={activityMediaUrl} /> : activityMedia.kind === "video" && activityMediaUrl ? <video controls src={activityMediaUrl} /> : activityMedia.kind === "link" ? <a href={activityMedia.url} target="_blank" rel="noreferrer">Открыть прикреплённую ссылку ↗</a> : <small>{activityMedia.name}</small>}</div>}</aside>
      </div>
      <div className="activity-builder-footer"><span>{selectedCardIds.length} карточек · {builderModule.title}</span><div className="dialog-actions"><button className="secondary-button" onClick={closeActivityBuilder}>Отмена</button><button className="primary-button" disabled={!activityTitle.trim() || !selectedCardIds.length || builderCards.some((card) => selectedCardIds.includes(card.id) && (!card.word.trim() || !card.translation.trim()))} onClick={saveActivity}>Сохранить игру</button></div></div>
    </section></div>}
    {audioBuilderOpen && <AudioQuizBuilder initial={editingAudio} languageCode={languageCode} level={level} onSave={saveAudioQuiz} onCancel={() => { setAudioBuilderOpen(false); setEditingAudio(undefined); }} />}
    {grammarBuilderOpen && grammarDraft && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setGrammarBuilderOpen(false); setGrammarDraft(null); } }}><section className="dialog-card grammar-builder" role="dialog" aria-modal="true" aria-labelledby="grammar-builder-title"><button className="dialog-close" onClick={() => { setGrammarBuilderOpen(false); setGrammarDraft(null); }} aria-label="Закрыть"><Icon name="close" /></button><p className="eyebrow">СВОЯ ГРАММАТИКА · {languageName} · {level}</p><h2 id="grammar-builder-title">{customGrammar.some((topic) => topic.id === grammarDraft.id) ? "Изменить тему" : "Новая тема"}</h2><label className="field-label">Название темы<input value={grammarDraft.title} onChange={(event) => setGrammarDraft((current) => current ? { ...current, title: event.target.value } : current)} /></label><label className="field-label">Краткое описание<input value={grammarDraft.description} onChange={(event) => setGrammarDraft((current) => current ? { ...current, description: event.target.value } : current)} /></label><label className="field-label">Раздел<select value={grammarDraft.group} onChange={(event) => setGrammarDraft((current) => current ? { ...current, group: event.target.value as "basics" | "sentences" } : current)}><option value="basics">Основы</option><option value="sentences">Предложение</option></select></label><label className="field-label">Объяснение правила<textarea rows={3} value={grammarDraft.explanation} onChange={(event) => setGrammarDraft((current) => current ? { ...current, explanation: event.target.value } : current)} /></label><label className="field-label">Примеры · каждый с новой строки<textarea rows={3} value={grammarDraft.examplesText} onChange={(event) => setGrammarDraft((current) => current ? { ...current, examplesText: event.target.value } : current)} /></label><div className="grammar-draft-questions"><div className="section-title"><div><h3>Тестовые упражнения</h3><p>В предложении используйте ___ для пропуска. Варианты разделяйте точкой с запятой.</p></div></div>{grammarDraft.questions.map((question, index) => <article key={index}><strong>Упражнение {index + 1}</strong><label className="field-label">Предложение<input value={question.prompt} onChange={(event) => setGrammarDraft((current) => current ? { ...current, questions: current.questions.map((item, questionIndex) => questionIndex === index ? { ...item, prompt: event.target.value } : item) } : current)} placeholder="Ich sehe ___ Hund." /></label><label className="field-label">Варианты ответа<input value={question.optionsText} onChange={(event) => setGrammarDraft((current) => current ? { ...current, questions: current.questions.map((item, questionIndex) => questionIndex === index ? { ...item, optionsText: event.target.value } : item) } : current)} placeholder="den; der; dem" /></label><label className="field-label">Правильный ответ<input value={question.answer} onChange={(event) => setGrammarDraft((current) => current ? { ...current, questions: current.questions.map((item, questionIndex) => questionIndex === index ? { ...item, answer: event.target.value } : item) } : current)} /></label><label className="field-label">Объяснение ответа<input value={question.explanation} onChange={(event) => setGrammarDraft((current) => current ? { ...current, questions: current.questions.map((item, questionIndex) => questionIndex === index ? { ...item, explanation: event.target.value } : item) } : current)} /></label>{grammarDraft.questions.length > 1 && <button className="text-danger" onClick={() => setGrammarDraft((current) => current ? { ...current, questions: current.questions.filter((_, questionIndex) => questionIndex !== index) } : current)}>Удалить упражнение</button>}</article>)}</div><button className="secondary-button add-card-button" onClick={() => setGrammarDraft((current) => current ? { ...current, questions: [...current.questions, { prompt: "", optionsText: "", answer: "", explanation: "" }] } : current)}><Icon name="plus" size={15} /> Добавить упражнение</button><div className="dialog-actions"><button className="secondary-button" onClick={() => { setGrammarBuilderOpen(false); setGrammarDraft(null); }}>Отмена</button><button className="primary-button" disabled={!grammarDraft.title.trim() || !grammarDraft.explanation.trim() || grammarDraft.questions.some((question) => { const options = question.optionsText.split(";").map((option) => option.trim()).filter(Boolean); return !question.prompt.includes("___") || options.length < 2 || !options.includes(question.answer.trim()) || !question.explanation.trim(); })} onClick={saveGrammarTopic}>Сохранить тему</button></div></section></div>}
  </div>;
}

function LiveTemplatePreview({ gameId, module, cards }: { gameId: GameId; module: VocabModule; cards: VocabCard[] }) {
  const card = cards[0] ?? module.cards[0];
  const word = card ? `${card.article ? `${card.article} ` : ""}${card.word}` : "der Tisch";
  const translation = card?.translation || "стол";
  const other = cards[1]?.translation ?? "книга";
  let task = "Выберите правильный ответ";
  let activity: ReactNode;
  if (gameId === "pairs" || gameId === "datajoin") {
    task = "Соедините слово и перевод";
    activity = <div className="preview-pair-columns"><span>{word}</span><span>{translation}</span><span>{cards[1]?.word ?? "das Buch"}</span><span>{other}</span></div>;
  } else if (gameId === "articles") {
    task = "Разложите слова по колонкам";
    activity = <><div className="preview-word-chip">{word} · {translation}</div><div className="preview-columns"><span>der</span><span>die</span><span>das</span></div></>;
  } else if (gameId === "builder" || gameId === "train") {
    task = gameId === "train" ? "Соберите вагончики" : "Соберите словосочетание";
    activity = <><div className="preview-prompt">{translation}</div><div className="preview-word-tiles"><span>{card?.article ?? "der"}</span><span>{card?.word ?? "Tisch"}</span></div></>;
  } else if (gameId === "hangman") {
    task = "Откройте слово по буквам";
    activity = <><div className="preview-prompt">{translation}</div><div className="preview-blanks">_ _ _ _ _</div><div className="preview-letters">A&nbsp; E&nbsp; I&nbsp; O&nbsp; U&nbsp; Ä&nbsp; Ö&nbsp; Ü</div></>;
  } else if (gameId === "wordsearch") {
    task = "Найдите слово в сетке";
    activity = <><div className="preview-prompt">Найдите: {word}</div><div className="preview-letter-grid">{[..."TISCHABCDEFGH"].map((letter, index) => <i key={index}>{letter}</i>)}</div></>;
  } else if (gameId === "anagram") {
    task = "Соберите слово из букв";
    activity = <><div className="preview-prompt">{translation}</div><div className="preview-word-tiles"><span>T</span><span>S</span><span>I</span><span>H</span><span>C</span></div></>;
  } else if (gameId === "moles") {
    task = "Нажмите на правильный перевод";
    activity = <><div className="preview-prompt">{word}</div><div className="preview-answer-grid"><span>{translation}</span><span>вода</span><span>дом</span><span>книга</span></div></>;
  } else if (gameId === "boxes") {
    task = "Откройте коробку с переводом";
    activity = <><div className="preview-prompt">{word}</div><div className="preview-boxes"><i>?</i><i>?</i><i>?</i></div></>;
  } else if (gameId === "wheel") {
    task = "Крутите колесо и отвечайте";
    activity = <><div className="preview-wheel">✦</div><div className="preview-prompt">{translation}</div></>;
  } else if (gameId === "phonetic") {
    task = "Послушайте и выберите слово";
    activity = <><div className="preview-sound">♫</div><div className="preview-answer-grid"><span>{word}</span><span>der Tag</span></div></>;
  } else if (gameId === "finalsound") {
    task = "Как звучит последний согласный?";
    activity = <><div className="preview-prompt">der Hund</div><div className="preview-answer-grid"><span>п</span><span>т</span><span>к</span></div></>;
  } else {
    task = "Выберите верный вариант";
    activity = <><div className="preview-prompt">{word}</div><div className="preview-answer-grid"><span>{translation}</span><span>{other}</span></div></>;
  }
  return <div className={`game-preview-card preview-${gameId}`}><div className="preview-game-top"><span className="preview-game-icon">{GAME_LIST.find((game) => game.id === gameId)?.mark}</span><span>ВОПРОС 1 / 8</span><span>★ 0</span></div><div className="preview-progress"><i /></div><p>{task} · {module.languageName}</p>{module.practiceInstructions && <p className="preview-custom-instruction">{module.practiceInstructions}</p>}{activity}{module.practiceMedia && <small className="preview-media-label">Прикреплено: {module.practiceMedia.name}</small>}<button className="preview-check" type="button" tabIndex={-1}>Проверить ответ</button></div>;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function german(card: VocabCard) { return `${card.article ? `${card.article} ` : ""}${card.word}`; }
function germanOption(card: VocabCard, pool: VocabCard[]) {
  const duplicates = pool.filter((item) => item.id !== card.id && item.word.toLocaleLowerCase() === card.word.toLocaleLowerCase());
  return card.word.toLocaleLowerCase() === "sie" || duplicates.length > 0 ? `${german(card)} (${card.translation})` : german(card);
}
function optionsFor(card: VocabCard, pool: VocabCard[], mode: "translation" | "word" | "article" | "sound", index: number) {
  if (mode === "article") return shuffle(["der", "die", "das"]);
  if (mode === "sound") return shuffle(["p", "t", "k"]);
  const key = mode === "translation" ? (item: VocabCard) => item.translation : (item: VocabCard) => germanOption(item, pool);
  const target = key(card);
  const distractors = pool.filter((item) => item.id !== card.id && key(item).toLowerCase() !== target.toLowerCase());
  const start = distractors.length ? (index * 7) % distractors.length : 0;
  const rotated = [...distractors.slice(start), ...distractors.slice(0, start)];
  return shuffle([target, ...rotated.slice(0, 3).map(key)]).filter((value, i, all) => all.indexOf(value) === i).slice(0, 4);
}
function norm(value: string) { return value.normalize("NFC").toLocaleLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/\s/g, ""); }

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function GameSession({ gameId, module, onExit, onAnswer }: { gameId: GameId; module: VocabModule; onExit: () => void; onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void }) {
  return <><ActivityMediaPanel module={module} />{gameId === "pairs" || gameId === "datajoin" ? <PairGame gameId={gameId} module={module} onExit={onExit} onAnswer={onAnswer} /> : gameId === "articles" ? <ArticleSortGame module={module} onExit={onExit} onAnswer={onAnswer} /> : <QuestionGame gameId={gameId} module={module} onExit={onExit} onAnswer={onAnswer} />}</>;
}

function ActivityMediaPanel({ module }: { module: VocabModule }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const media = module.practiceMedia;
  useEffect(() => {
    let objectUrl = "";
    let alive = true;
    setSrc("");
    if (media?.id) void loadMediaFile(media.id).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => undefined);
    else if (media?.url) setSrc(media.url);
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media]);
  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [fullscreen]);
  if (!module.practiceInstructions && !media) return null;
  const youtubeId = (() => {
    if (!media?.url) return "";
    try { const url = new URL(media.url); return url.hostname === "youtu.be" ? url.pathname.slice(1) : url.hostname.includes("youtube.com") ? url.searchParams.get("v") || "" : ""; }
    catch { return ""; }
  })();
  return <><aside className={`game-attachment ${open ? "open" : ""}`}><button className="game-attachment-toggle" onClick={() => setOpen((value) => !value)}>{open ? "Скрыть материалы" : "Материалы игры"}{media ? ` · ${media.kind === "link" ? "ссылка" : media.kind}` : ""}</button>{open && <div className="game-attachment-content">{module.practiceInstructions && <p>{module.practiceInstructions}</p>}{media?.kind === "image" && src && <button className="game-attachment-image" onClick={() => setFullscreen(true)}><img src={src} alt={media.name} /><small>Открыть на весь экран</small></button>}{media?.kind === "audio" && src && <audio controls src={src} />}{media?.kind === "video" && src && <video controls playsInline src={src} />}{media?.kind === "link" && src && (youtubeId ? <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`} title={media.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <a href={src} target="_blank" rel="noreferrer">{media.name} ↗</a>)}</div>}</aside>{fullscreen && src && media?.kind === "image" && <div className="game-attachment-fullscreen" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setFullscreen(false); }}><button onClick={() => setFullscreen(false)}>Закрыть</button><img src={src} alt={media.name} /></div>}</>;
}

function ArticleSortGame({ module, onExit, onAnswer }: { module: VocabModule; onExit: () => void; onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void }) {
  const cards = useMemo(() => shuffle(module.cards.filter((card) => card.article)), [module.id, module.cards]);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const dragId = useRef<string | null>(null);
  useEffect(() => { if (submitted) return; const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [submitted]);
  useEffect(() => {
    if (!submitted) return;
    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= cards.length) { window.clearInterval(timer); setCompleted(true); return; }
      const card = cards[index];
      const correct = placements[card.id] === card.article;
      answerRef.current(card, correct);
      speakText(correct ? "Richtig" : "Noch einmal", "de-DE", true);
      setReveal(index + 1);
      index += 1;
      if (index === cards.length) window.setTimeout(() => setCompleted(true), 700);
    }, 650);
    return () => window.clearInterval(timer);
  }, [submitted, cards, placements]);
  const place = (cardId: string, article: string) => { if (submitted) return; setPlacements((current) => ({ ...current, [cardId]: article })); setSelected(null); };
  const returnToBank = (cardId: string) => { if (submitted) return; setPlacements((current) => { const next = { ...current }; delete next[cardId]; return next; }); setSelected(cardId); };
  const score = cards.filter((card) => placements[card.id] === card.article).length;
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const categories = ["der", "die", "das"] as const;
  if (completed) return <div className="game-shell game-articles"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>СОРТИРОВКА АРТИКЛЕЙ</span><strong>Время {timeLabel}</strong></div><div>✓ {score}/{cards.length}</div></header><div className="game-result"><span className="result-medal">{score === cards.length ? "★" : "✓"}</span><p className="eyebrow">ПРОВЕРКА ЗАВЕРШЕНА</p><h1>{score} из {cards.length} правильно</h1><p>Время: {timeLabel} · результат добавлен в прогресс.</p><button className="primary-button" onClick={onExit}>Вернуться к играм</button></div></div>;
  return <div className="game-shell game-articles article-sort-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>ГРУППИРОВКА РОДОВ</span><strong>Время {timeLabel}</strong></div><strong className="sort-count">{Object.keys(placements).length}/{cards.length}</strong></header><main className="game-center article-sort"><div className="game-progress"><i style={{ width: `${Object.keys(placements).length / cards.length * 100}%` }} /></div><p className="question-kicker">Перетащите слова в колонку нужного артикля. Возвратите карточку в поле слов или нажмите на неё, чтобы исправить выбор.</p><h1>Распределите существительные</h1><div className="sort-word-bank" aria-label="Слова для распределения" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId.current) returnToBank(dragId.current); dragId.current = null; }}>{cards.filter((card) => !placements[card.id]).map((card) => <button key={card.id} draggable={!submitted} className={selected === card.id ? "selected" : ""} onClick={() => setSelected(card.id)} onDragStart={() => { dragId.current = card.id; }} onDragEnd={() => { dragId.current = null; }}>{card.word}<small>{card.translation}</small></button>)}{Object.keys(placements).length === cards.length && <span className="all-placed">Все слова распределены · карточку можно вернуть сюда</span>}</div><div className="article-buckets">{categories.map((article) => <section key={article} className={`article-bucket ${article}`} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId.current) place(dragId.current, article); dragId.current = null; }}><h2><span>{article}</span><small>{article === "der" ? "МУЖСКОЙ" : article === "die" ? "ЖЕНСКИЙ" : "СРЕДНИЙ"}</small></h2><div>{cards.filter((card) => placements[card.id] === article).map((card) => { const position = cards.indexOf(card); const shown = submitted && reveal > position; const correct = card.article === article; return <article key={card.id} draggable={!submitted} className={`${shown ? correct ? "review-correct" : "review-wrong" : ""} placed-sort-card`} onClick={() => returnToBank(card.id)} onDragStart={() => { dragId.current = card.id; }} onDragEnd={() => { dragId.current = null; }}><strong>{card.word}</strong><small>{card.translation}</small><span>{shown ? correct ? "✓" : `✕ ${card.article}` : "↩ Вернуть"}</span></article>; })}</div><button disabled={!selected || submitted} onClick={() => selected && place(selected, article)}>Переместить сюда</button></section>)}</div>{submitted && <p className="sort-review-note">Проверяем слова по очереди · правильные ответы отмечены галочкой и звуком.</p>}</main><footer className="game-footer"><button className="primary-button" disabled={submitted || Object.keys(placements).length !== cards.length} onClick={() => setSubmitted(true)}>Завершить и проверить</button></footer></div>;
}

function PairGame({ gameId, module, onExit, onAnswer }: { gameId: "pairs" | "datajoin"; module: VocabModule; onExit: () => void; onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void }) {
  const cards = useMemo(() => {
    const unique = new Map<string, VocabCard>();
    module.cards.forEach((card) => { const key = card.translation.toLocaleLowerCase(); if (!unique.has(key)) unique.set(key, card); });
    return shuffle([...unique.values()].filter((card) => card.translation.trim())).slice(0, 10);
  }, [module.id]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [selectedGerman, setSelectedGerman] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState("");
  const dragCard = useRef<string | null>(null);
  const group = cards.slice(groupIndex, groupIndex + 5);
  const done = groupIndex >= cards.length;
  const leftGroup = useMemo(() => shuffle(group), [cards, groupIndex]);
  const rightGroup = useMemo(() => shuffle(group), [cards, groupIndex]);
  const matchPair = (leftId: string, rightId: string) => {
    if (matched.includes(leftId) || matched.includes(rightId)) return;
    const left = group.find((item) => item.id === leftId);
    const right = group.find((item) => item.id === rightId);
    if (!left || !right) return;
    if (left.id === right.id) {
      onAnswer(left, true); setScore((value) => value + 1); setMatched((value) => [...value, left.id]); setSelectedGerman(null); setNotice("Верная пара");
      if (matched.length + 1 === group.length) window.setTimeout(() => { setGroupIndex((value) => value + group.length); setMatched([]); setNotice(""); }, 650);
    } else {
      onAnswer(left, false, right.id); setNotice("Пары не совпали. Попробуйте перетащить слово ещё раз."); window.setTimeout(() => { setSelectedGerman(null); setNotice(""); }, 800);
    }
  };
  const chooseTranslation = (id: string) => { if (selectedGerman) matchPair(selectedGerman, id); };
  return <div className={`game-shell game-${gameId}`}><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>{gameId === "datajoin" ? "DATA JOIN" : "МЭТЧИНГ ПАР"}</span><strong>{score} / {cards.length}</strong></div><button onClick={() => { setGroupIndex(0); setMatched([]); setScore(0); setNotice(""); }}>Начать заново <Icon name="refresh" /></button></header>
    {done ? <div className="game-result"><span className="result-medal">✓</span><p className="eyebrow">ИГРА ЗАВЕРШЕНА</p><h1>Собрано пар: {score} из {cards.length}</h1><button className="primary-button" onClick={onExit}>Вернуться к играм</button></div> : <main className="game-center pair-game"><p className="question-kicker">Перетащите слово к переводу или нажмите сначала на слово, затем на перевод. Ошибочную пару можно сразу попробовать ещё раз.</p><div className="pair-columns"><div><h2>{module.languageName}</h2>{leftGroup.map((card) => <button key={card.id} draggable={!matched.includes(card.id)} className={`pair-word-tile ${selectedGerman === card.id ? "chosen" : matched.includes(card.id) ? "matched" : ""}`} disabled={matched.includes(card.id)} onClick={() => setSelectedGerman(card.id)} onDragStart={() => { dragCard.current = card.id; }} onDragEnd={() => { dragCard.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragCard.current) matchPair(card.id, dragCard.current); dragCard.current = null; }}>{german(card)}</button>)}</div><div><h2>Перевод на русский</h2>{rightGroup.map((card) => <button key={card.id} draggable={!matched.includes(card.id)} className={`pair-word-tile ${matched.includes(card.id) ? "matched" : ""}`} disabled={matched.includes(card.id)} onClick={() => chooseTranslation(card.id)} onDragStart={() => { dragCard.current = card.id; }} onDragEnd={() => { dragCard.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragCard.current) matchPair(dragCard.current, card.id); dragCard.current = null; }}>{card.translation}</button>)}</div></div>{notice && <p className="game-feedback">{notice}</p>}</main>}
  </div>;
}

function QuestionGame({ gameId, module, onExit, onAnswer }: { gameId: GameId; module: VocabModule; onExit: () => void; onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void }) {
  const eligible = module.cards.filter((card) => gameId === "finalsound" ? /[bdg]$/i.test(card.word.normalize("NFC")) : gameId === "wordsearch" ? /^[\p{L}]{4,9}$/iu.test(card.word.normalize("NFC")) : gameId === "anagram" ? /^[\p{L}]{4,14}$/iu.test(card.word.normalize("NFC")) : gameId === "articles" || gameId === "train" ? Boolean(card.article) : true);
  const rounds = useMemo(() => shuffle(eligible).slice(0, Math.min(10, eligible.length)), [module.id, gameId]);
  const [roundQueue, setRoundQueue] = useState<VocabCard[]>(rounds);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [lives, setLives] = useState(0);
  const [spun, setSpun] = useState(false);
  const [wheelCard, setWheelCard] = useState<VocabCard | null>(null);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const card = wheelCard ?? roundQueue[index] ?? module.cards[0];
  const done = index >= roundQueue.length;
  const answerMode = gameId === "phonetic" ? "word" : gameId === "articles" ? "article" : gameId === "finalsound" ? "sound" : "translation";
  const choices = useMemo(() => card ? optionsFor(card, module.cards, answerMode, index) : [], [card, module.id, answerMode, index]);
  const moleChoices = useMemo(() => {
    if (!card) return [];
    const uniqueTranslations = [...new Set(module.cards.map((item) => item.translation).filter((value) => value.toLocaleLowerCase() !== card.translation.toLocaleLowerCase()))];
    return shuffle([card.translation, ...shuffle(uniqueTranslations).slice(0, 8)]);
  }, [card?.id, module.id, index]);
  const finishAnswer = (correct: boolean) => {
    if (!card || feedback) return;
    const confusedWith = !correct && chosen.length ? module.cards.find((item) => item.translation === chosen[0] || german(item) === chosen[0])?.id : undefined;
    setFeedback(correct ? "correct" : "wrong"); setScore((value) => value + (correct ? 1 : 0)); onAnswer(card, correct, confusedWith);
  };
  const advanceRound = () => {
    if (!feedback) return;
    if (feedback === "wrong" && card) setRoundQueue((current) => [...current, card]);
    setFeedback(null); setIndex((value) => value + 1); setChosen([]); setLetters([]); setLives(0); setSpun(false); setWheelCard(null);
  };
  const startSpeech = () => {
    const browserWindow = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Speech = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Speech) { setSpeechMessage("В этом браузере нет распознавания речи. Ответьте кнопками ниже."); return; }
    setSpeechMessage(`Скажите слово на ${languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} после сигнала браузера.`);
    const recognition = new Speech();
    recognition.lang = speechLocaleForCode(module.languageCode);
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setSpeechMessage(`Распознано: «${heard}»`);
      finishAnswer(norm(heard).replace(/^(der|die|das)/, "") === norm(card.word));
    };
    recognition.onerror = (event) => { setSpeechMessage(`Речь не распознана (${event.error}). Можно выбрать ответ кнопкой.`); setListening(false); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); setSpeechMessage("Не удалось включить микрофон. Проверьте разрешение браузера."); }
  };
  useEffect(() => { setRoundQueue(rounds); setIndex(0); setScore(0); setFeedback(null); }, [rounds]);
  useEffect(() => { setChosen([]); setLetters([]); setLives(0); setSpun(false); setWheelCard(null); }, [index]);
  useEffect(() => { setSpeechMessage(""); setListening(false); }, [index]);
  const targetWord = card?.word.normalize("NFC").toLocaleLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
  const alphabet = [...new Set([...[..."abcdefghijklmnopqrstuvwxyz"], ...[...targetWord]])];
  const scrambled = useMemo(() => shuffle([...targetWord]), [card.id, targetWord]);
  const nounTiles = useMemo(() => shuffle([card.article || "", card.word, card.article === "der" ? "die" : "der"].filter(Boolean)), [card.id]);
  if (done || !card) return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><span>Результат</span><span /></header><div className="game-result"><span className="result-medal">{score >= rounds.length * 0.7 ? "★" : "✓"}</span><p className="eyebrow">ИГРА ЗАВЕРШЕНА</p><h1>{score} из {rounds.length} верно</h1><p>Результат сохранён в вашем учебном прогрессе.</p><button className="primary-button" onClick={onExit}>Вернуться к играм</button></div></div>;
  const expectedNoun = [card.article, card.word].filter(Boolean) as string[];
  const pickedNoun = chosen;
  const renderChoiceButtons = (items: string[], correct: string) => <div className="game-choice-grid">{items.map((item, i) => <button key={`${item}-${i}`} disabled={Boolean(feedback)} className={feedback && item === correct ? "correct" : feedback && chosen.includes(item) && norm(item) !== norm(correct) ? "wrong" : chosen.includes(item) ? "chosen" : ""} onClick={() => { setChosen([item]); finishAnswer(norm(item) === norm(correct)); }}><kbd>{i + 1}</kbd>{item}</button>)}</div>;
  let content;
  if (gameId === "articles") content = <><p className="question-kicker">Выберите артикль</p><h1>{card.word}</h1>{renderChoiceButtons(["der", "die", "das"], card.article || "")}</>;
  else if (gameId === "moles") content = <><p className="question-kicker">Ударьте по переводу слова</p><h1>{german(card)}</h1><div className="mole-grid">{moleChoices.map((item, i) => <button key={`${item}-${i}`} disabled={Boolean(feedback)} className={feedback && item === card.translation ? "correct" : feedback && chosen.includes(item) ? "wrong" : ""} onClick={() => { setChosen([item]); finishAnswer(item === card.translation); }}><span aria-hidden="true">🐹</span><small>{item}</small></button>)}</div></>;
  else if (gameId === "blitz" || gameId === "phonetic") content = <><p className="question-kicker">{gameId === "phonetic" ? `Прослушайте слово на ${languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} и выберите услышанное` : "Выберите правильный перевод"}</p>{gameId === "phonetic" && <div className="phonetic-controls"><button className="listen-button" onClick={() => speakText(card.word, speechLocaleForCode(module.languageCode))}><Icon name="volume" /> Прослушать задание</button><button className={`listen-button ${listening ? "recording" : ""}`} onClick={() => listening ? recognitionRef.current?.stop() : startSpeech()}><span className="mic-dot" />{listening ? "Слушаю…" : "Произнести самому"}</button></div>}<h1>{gameId === "phonetic" ? "Какое слово вы услышали?" : german(card)}</h1>{gameId === "phonetic" && speechMessage && <p className="speech-message">{speechMessage}</p>}{renderChoiceButtons(choices, gameId === "phonetic" ? germanOption(card, module.cards) : card.translation)}</>;
  else if (gameId === "builder") content = <><p className="question-kicker">Соберите немецкую именную группу</p><h1>{card.translation}</h1><div className="builder-slots">{pickedNoun.map((item, i) => <button key={`${item}-${i}`} onClick={() => setChosen((value) => value.filter((_, index) => index !== i))}>{item}</button>)}</div><div className="game-choice-grid">{nounTiles.map((item, i) => <button key={`${item}-${i}`} disabled={Boolean(feedback) || pickedNoun.includes(item)} onClick={() => { const next = [...pickedNoun, item]; setChosen(next); if (next.length === expectedNoun.length) finishAnswer(next.join(" ").toLowerCase() === expectedNoun.join(" ").toLowerCase()); }}>{item}</button>)}</div></>;
  else if (gameId === "train") content = <><p className="question-kicker">Подсказка — перевод на русский · поставьте немецкий артикль перед словом</p><h1>{card.translation}</h1><div className="train-track"><button className={pickedNoun[0] ? "filled" : ""} onClick={() => setChosen((value) => value.filter((_, index) => index !== 0))}>{pickedNoun[0] || "Артикль"}</button><span className="train-coupler">···</span><button className={pickedNoun[1] ? "filled" : ""} onClick={() => setChosen((value) => value.filter((_, index) => index !== 1))}>{pickedNoun[1] || "Существительное"}</button><span className="train-engine" aria-hidden="true">🚂</span></div><div className="game-choice-grid train-tiles">{nounTiles.map((item, i) => <button key={`${item}-${i}`} disabled={Boolean(feedback) || pickedNoun.includes(item)} onClick={() => { const next = [...pickedNoun, item]; setChosen(next); if (next.length === expectedNoun.length) finishAnswer(next.join(" ").toLowerCase() === expectedNoun.join(" ").toLowerCase()); }}>{item}</button>)}</div></>;
  else if (gameId === "hangman") content = <><p className="question-kicker">Перевод · откройте слово на {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} по буквам · ошибок: {lives}/6</p><h1>{card.translation}</h1><div className="letter-answer">{[...targetWord].map((letter, i) => <span key={`${letter}-${i}`}>{letters.includes(letter) ? letter : "_"}</span>)}</div><div className="alphabet-grid">{alphabet.map((letter) => <button key={letter} disabled={letters.includes(letter) || Boolean(feedback)} onClick={() => { const next = [...letters, letter]; setLetters(next); if ([...targetWord].every((char) => next.includes(char))) finishAnswer(true); else if (!targetWord.includes(letter)) { const missed = lives + 1; setLives(missed); if (missed >= 6) finishAnswer(false); } }}>{letter}</button>)}</div></>;
  else if (gameId === "wordsearch") {
    const width = 9; const word = targetWord.slice(0, width); const row = 3; const start = 0;
    const grid = Array.from({ length: 63 }, (_, pos) => { const y = Math.floor(pos / width); const x = pos % width; return y === row && x >= start && x < start + word.length ? word[x - start] : "abcdefghijklmnopqrstuvwxyz"[Math.floor((pos * 17 + index * 11) % 26)]; });
    content = <><p className="question-kicker">Перевод · найдите слово на {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()}</p><h1>{card.translation}</h1><div className="wordsearch-grid">{grid.map((letter, i) => <button key={i} className={chosen.includes(String(i)) ? "chosen" : ""} onClick={() => { const next = [...chosen, String(i)]; setChosen(next); const picked = next.map((pos) => grid[Number(pos)]).join(""); if (picked === word) finishAnswer(true); else if (!word.startsWith(picked)) setChosen([]); }}>{letter}</button>)}</div><small>Нажимайте клетки по порядку слева направо.</small></>;
  }
  else if (gameId === "anagram") {
    content = <><p className="question-kicker">Перевод на русском · составьте слово на {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} из букв</p><h1>{card.translation}</h1><div className="builder-slots">{letters.map((letter, i) => <button key={`${letter}-${i}`} onClick={() => { setLetters((value) => value.filter((_, position) => position !== i)); setChosen((value) => value.filter((_, position) => position !== i)); }}>{letter}</button>)}</div><div className="alphabet-grid">{scrambled.map((letter, i) => <button key={`${letter}-${i}`} disabled={Boolean(feedback) || chosen.includes(String(i))} onClick={() => { const next = [...letters, letter]; setLetters(next); setChosen((value) => [...value, String(i)]); if (next.length === targetWord.length) finishAnswer(norm(next.join("")) === norm(targetWord)); }}>{letter}</button>)}</div></>;
  }
  else if (gameId === "finalsound") {
    const end = card.word.toLowerCase().slice(-1); const expected = end === "b" ? "p" : end === "d" ? "t" : "k";
    content = <><p className="question-kicker">Как звучит конечная буква?</p><h1>{card.word}<span className="sound-end">{end}</span></h1><p className="transcription">{card.transcription}</p>{renderChoiceButtons(["p", "t", "k"], expected)}</>;
  }
  else if (gameId === "boxes") content = <><p className="question-kicker">Откройте коробку с подходящим переводом</p><h1>{german(card)}</h1><div className="box-grid">{choices.map((item, i) => <button key={`${item}-${i}`} disabled={Boolean(feedback)} onClick={() => { setChosen([item]); finishAnswer(item === card.translation); }}><span>▣</span><small>Коробка {i + 1}</small><strong>{feedback ? item : "Открыть"}</strong></button>)}</div></>;
  else if (gameId === "wheel") content = <><p className="question-kicker">Крутите колесо, чтобы выбрать карточку</p>{!spun ? <button className="wheel-spin" onClick={() => { const nextCard = module.cards[Math.floor(Math.random() * module.cards.length)]; setWheelCard(nextCard); setSpun(true); }}><span>◉</span> Крутить колесо</button> : <><h1>{german(card)}</h1>{renderChoiceButtons(choices, card.translation)}</>}</>;
  else content = <><p className="question-kicker">Выберите правильный ответ</p><h1>{german(card)}</h1>{renderChoiceButtons(choices, card.translation)}</>;

  const questionCounter = index < rounds.length ? `${index + 1} / ${rounds.length}` : `Повтор · ${index - rounds.length + 1}`;
  return <div className={`game-shell game-${gameId}`}><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>{GAME_LIST.find((game) => game.id === gameId)?.title.toLocaleUpperCase()}</span><strong>{questionCounter}</strong></div><div className="game-score">★ {score}</div></header><main className="game-center"><div className="game-progress"><i style={{ width: `${(Math.min(index + 1, rounds.length) / rounds.length) * 100}%` }} /></div>{content}{feedback && <p className={`game-feedback ${feedback}`}>{feedback === "correct" ? "Правильно!" : `Ответ: ${gameId === "finalsound" ? "конечный согласный оглушается" : gameId === "articles" ? card.article : german(card)} · ${card.translation}. Это задание вернётся в конец набора.`}</p>}</main><footer className="game-footer">{feedback ? <button className="primary-button" onClick={advanceRound}>{feedback === "wrong" ? "Понятно, повторю в конце" : "Дальше"} <Icon name="arrow" size={16} /></button> : <span>{module.practiceNote ? module.practiceNote : `Словарь: модуль ${module.id} · ${module.title}`}</span>}</footer></div>;
}

export function GrammarPractice({ topic, onExit, onAnswer }: { topic: GrammarTopic; onExit: () => void; onAnswer: (correct: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const dragOption = useRef<string | null>(null);
  const question = topic.questions[index];
  const submit = () => { if (!selected || checked) return; const correct = selected === question.answer; setChecked(true); setScore((value) => value + (correct ? 1 : 0)); onAnswer(correct); };
  const next = () => { if (index === topic.questions.length - 1) { setFinished(true); return; } setIndex((value) => value + 1); setSelected(null); setChecked(false); };
  if (finished) return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><span>{topic.title}</span><span /></header><div className="game-result"><span className="result-medal">{score === topic.questions.length ? "★" : "✓"}</span><p className="eyebrow">ТЕМА ЗАВЕРШЕНА</p><h1>{score} из {topic.questions.length}</h1><p>Ответы сохранены в прогрессе. Можно пройти тему ещё раз или выбрать другую.</p><button className="primary-button" onClick={onExit}>К темам грамматики</button></div></div>;
  if (!started) return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="close" /> Назад</button><div><span>ПРАВИЛО И ПРИМЕРЫ</span><strong>{topic.title}</strong></div><span /></header><main className="game-center grammar-intro"><span className="grammar-topic-icon"><Icon name="brain" size={24} /></span><p className="eyebrow">ГРАММАТИКА · {(topic.languageCode ?? "de").toLocaleUpperCase()}</p><h1>{topic.title}</h1><p className="grammar-explanation">{topic.explanation}</p><div className="grammar-example-list">{topic.examples.map((example) => <p key={example}><Icon name="check" size={16} />{example}</p>)}</div><button className="primary-button" onClick={() => setStarted(true)}>Начать · {topic.questions.length} упражнения <Icon name="arrow" /></button></main></div>;
  const promptParts = question.prompt.split("___");
  return <div className="game-shell"><header className="game-topbar"><button onClick={onExit}><Icon name="arrowLeft" /> Назад</button><div><span>{topic.title.toLocaleUpperCase()}</span><strong>{index + 1} / {topic.questions.length}</strong></div><div>✓ {score}</div></header><main className="game-center grammar-practice"><div className="game-progress"><i style={{ width: `${(index + 1) / topic.questions.length * 100}%` }} /></div><p className="question-kicker">Нажмите вариант или перетащите его в пропуск</p><div className="grammar-sentence">{promptParts[0]}<button className={`grammar-answer-slot ${selected ? "filled" : ""} ${checked ? selected === question.answer ? "correct" : "wrong" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!checked && dragOption.current) setSelected(dragOption.current); }} onClick={() => !checked && setSelected(null)}>{selected ?? "Выберите"}</button>{promptParts[1]}</div><div className="grammar-options">{question.options.map((option) => <button key={option} draggable={!checked} disabled={checked} className={checked && option === question.answer ? "correct" : checked && option === selected ? "wrong" : selected === option ? "chosen tile-picked" : ""} onClick={() => setSelected(option)} onDragStart={() => { dragOption.current = option; }}>{option}</button>)}</div>{checked && <div className="explanation-card"><strong>{selected === question.answer ? "Верно" : `Правильный ответ: ${question.answer}`}</strong><p>{question.explanation}</p></div>}<button className="primary-button" disabled={!selected} onClick={checked ? next : submit}>{checked ? index === topic.questions.length - 1 ? "Результат" : "Дальше" : "Проверить"} <Icon name="arrow" /></button></main></div>;
}
