import { useEffect, useMemo, useRef, useState } from "react";
import { modules, storedModules, type VocabCard, type VocabModule } from "./lib/vocab";
import { CreateModuleDialog, EditModuleDialog, LearningSpaceDialog, SettingsDialog, StreakDialog, type LearningSpace, type Preferences } from "./components/Dialogs";
import { GAME_LIST, GameHub, GameSession, GrammarPractice, prepareGameModule, type GameId, type GrammarTopic } from "./components/Games";
import { Icon, type IconName } from "./components/Icon";
import { LessonDialog, LessonViewer, type Lesson, type LessonResource } from "./components/Lessons";
import { removeMediaFile } from "./lib/mediaStore";
import { speakText, speechLocaleForCode, StudySession, type CardProgress, type StudyMode } from "./components/StudySession";

type Screen = "today" | "library" | "path" | "games" | "stats";
const screenNames: Screen[] = ["today", "library", "path", "games", "stats"];
function screenFromHash(): Screen {
  if (typeof window === "undefined") return "today";
  const route = window.location.hash.replace(/^#\/?/, "").split(/[?&]/)[0] as Screen;
  return screenNames.includes(route) ? route : "today";
}
type PathActivity = { id: string; title: string; gameId: GameId; moduleId: number; languageCode: string; level: string; cardIds: string[] };
type UserStats = { xp: number; dailyXp: number; dailyDate: string; crystals: number; streak: number; freezeCount: number; sessions: number; answers: number; correct: number; studyDays: Record<string, number>; lastStudyDay: string };
const defaultStats: UserStats = { xp: 0, dailyXp: 0, dailyDate: "", crystals: 0, streak: 0, freezeCount: 0, sessions: 0, answers: 0, correct: 0, studyDays: {}, lastStudyDay: "" };
const defaultPreferences: Preferences = { autoSpeak: false, highContrast: false, name: "Анна", dailyGoal: 50 };
const defaultSpace: LearningSpace = { id: "de-a1-a2", languageCode: "de", languageName: "Немецкий", flag: "DE", level: "A1–A2", nativeLanguageCode: "ru" };

function useStored<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

function useScopedStored<T>(key: string, scope: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [allValues, setAllValues] = useStored<Record<string, T>>(key, {});
  const value = allValues[scope] ?? initial;
  const setValue: React.Dispatch<React.SetStateAction<T>> = (next) => setAllValues((current) => {
    const previous = current[scope] ?? initial;
    const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
    return { ...current, [scope]: value };
  });
  return [value, setValue];
}

function localDay(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

function german(card: VocabCard) { return `${card.article ? `${card.article} ` : ""}${card.word}`; }

export default function App() {
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [spaces, setSpaces] = useStored<LearningSpace[]>("linguaplay-learning-spaces", [defaultSpace]);
  const [activeSpaceId, setActiveSpaceId] = useStored("linguaplay-active-space", defaultSpace.id);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? spaces[0] ?? defaultSpace;
  const [customModules, setCustomModules] = useStored<VocabModule[]>("linguaplay-custom-modules", storedModules());
  const [moduleOverrides, setModuleOverrides] = useStored<Record<number, VocabModule>>("linguaplay-module-overrides", {});
  const [deletedModuleIds, setDeletedModuleIds] = useStored<number[]>("linguaplay-deleted-modules", []);
  const [moduleOrder, setModuleOrder] = useScopedStored<number[]>("linguaplay-module-order-by-space", activeSpace.id, []);
  const [progress, setProgress] = useScopedStored<Record<string, CardProgress>>("linguaplay-progress-by-space", activeSpace.id, {});
  const [lessons, setLessons] = useScopedStored<Lesson[]>("linguaplay-lessons-by-space", activeSpace.id, []);
  const [confusions, setConfusions] = useScopedStored<Record<string, Record<string, number>>>("linguaplay-confusions-by-space", activeSpace.id, {});
  const [stats, setStats] = useScopedStored<UserStats>("linguaplay-stats-by-space", activeSpace.id, defaultStats);
  const [preferences, setPreferences] = useStored<Preferences>("linguaplay-preferences", defaultPreferences);
  const [vacation, setVacation] = useStored<boolean>("linguaplay-vacation", false);
  const [techOnly, setTechOnly] = useState(false);
  const [session, setSession] = useState<{ cards: VocabCard[]; pool: VocabCard[]; mode: StudyMode; title: string } | null>(null);
  const [podcastCards, setPodcastCards] = useState<VocabCard[] | null>(null);
  const [activeGame, setActiveGame] = useState<{ gameId: GameId; module: VocabModule } | null>(null);
  const [preferredGameModuleId, setPreferredGameModuleId] = useState<number | null>(null);
  const [activeGrammar, setActiveGrammar] = useState<GrammarTopic | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [lessonDraft, setLessonDraft] = useState<{ chapter: string; lesson?: Lesson } | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<VocabModule | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const syncRoute = () => setScreen(screenFromHash());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => { window.removeEventListener("hashchange", syncRoute); window.removeEventListener("popstate", syncRoute); };
  }, []);
  useEffect(() => {
    const route = `#/${screen}`;
    if (window.location.hash !== route) window.history.replaceState(window.history.state, "", route);
  }, [screen]);

  const normalizedCustomModules = useMemo(() => customModules.map((module) => ({ ...module, languageCode: module.languageCode || "de", languageName: module.languageName || "Немецкий", level: module.level || "A1–A2", nativeLanguageCode: module.nativeLanguageCode || "ru" })), [customModules]);
  const everyModule = useMemo(() => [...modules.filter((module) => !deletedModuleIds.includes(module.id)).map((module) => moduleOverrides[module.id] ?? module), ...normalizedCustomModules], [normalizedCustomModules, moduleOverrides, deletedModuleIds]);
  const orderedModules = useMemo(() => [...everyModule].sort((left, right) => {
    const leftIndex = moduleOrder.indexOf(left.id); const rightIndex = moduleOrder.indexOf(right.id);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1; if (rightIndex >= 0) return 1;
    return left.id - right.id;
  }), [everyModule, moduleOrder]);
  const visibleModules = orderedModules.filter((module) => module.languageCode === activeSpace.languageCode && module.level === activeSpace.level && (!techOnly || (module.id >= 35 && module.id <= 39)));
  const visibleCards = useMemo(() => visibleModules.flatMap((module) => module.cards), [visibleModules]);

  useEffect(() => {
    if (activeSpace.id !== defaultSpace.id) return;
    const legacyProgress = localStorage.getItem("linguaplay-card-progress");
    const legacyStats = localStorage.getItem("linguaplay-user-stats");
    const legacyConfusions = localStorage.getItem("linguaplay-confusion-pairs");
    if (legacyProgress && !Object.keys(progress).length) { try { setProgress(JSON.parse(legacyProgress)); } catch { /* ignore corrupt legacy state */ } }
    if (legacyStats && stats.answers === 0) { try { setStats(JSON.parse(legacyStats)); } catch { /* ignore corrupt legacy state */ } }
    if (legacyConfusions && !Object.keys(confusions).length) { try { setConfusions(JSON.parse(legacyConfusions)); } catch { /* ignore corrupt legacy state */ } }
  }, [activeSpace.id]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3000); return () => window.clearTimeout(timer); }, [toast]);

  const recordStudyDay = (current: UserStats): UserStats => {
    const today = localDay();
    if (current.lastStudyDay === today) return { ...current, studyDays: { ...current.studyDays, [today]: (current.studyDays[today] || 0) + 1 } };
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = current.lastStudyDay === localDay(yesterday);
    return { ...current, streak: vacation ? current.streak : current.lastStudyDay && wasYesterday ? current.streak + 1 : 1, lastStudyDay: today, studyDays: { ...current.studyDays, [today]: (current.studyDays[today] || 0) + 1 } };
  };

  const recordAnswer = (card: VocabCard, correct: boolean, rating = correct ? 2 : 1, confusedWith?: string) => {
    setProgress((current) => {
      const previous = current[card.id] ?? { reps: 0, level: 0, stability: 0, dueAt: "", correct: 0, wrong: 0, starred: false };
      const reps = previous.reps + 1;
      const stability = !correct ? Math.max(1, Math.min(2, previous.stability || 1)) : rating === 3 ? Math.max(7, previous.stability + 7) : rating === 2 ? Math.max(3, previous.stability + 2) : Math.max(1, previous.stability + 1);
      const level = reps === 0 ? 0 : stability >= 21 ? 3 : stability >= 3 ? 2 : 1;
      const interval = !correct ? 1 : rating === 3 ? 7 : rating === 2 ? 3 : Math.max(1, Math.round(stability));
      const dueAt = new Date(Date.now() + interval * 86_400_000).toISOString();
      return { ...current, [card.id]: { ...previous, reps, level, stability, dueAt, correct: previous.correct + (correct ? 1 : 0), wrong: previous.wrong + (correct ? 0 : 1) } };
    });
    if (!correct && confusedWith && confusedWith !== card.id) setConfusions((current) => ({ ...current, [card.id]: { ...current[card.id], [confusedWith]: (current[card.id]?.[confusedWith] || 0) + 1 } }));
    setStats((current) => {
      const day = localDay();
      const fresh = current.dailyDate === day ? current : { ...current, dailyXp: 0, dailyDate: day };
      const withDay = recordStudyDay(fresh);
      return { ...withDay, xp: withDay.xp + (correct ? 8 : 0), dailyXp: withDay.dailyXp + (correct ? 8 : 0), crystals: withDay.crystals + (correct ? 2 : 0), answers: withDay.answers + 1, correct: withDay.correct + (correct ? 1 : 0) };
    });
  };

  const recordPractice = (correct: boolean) => {
    setStats((current) => {
      const day = localDay(); const fresh = current.dailyDate === day ? current : { ...current, dailyXp: 0, dailyDate: day };
      const withDay = recordStudyDay(fresh);
      return { ...withDay, xp: withDay.xp + (correct ? 5 : 0), dailyXp: withDay.dailyXp + (correct ? 5 : 0), crystals: withDay.crystals + (correct ? 1 : 0), answers: withDay.answers + 1, correct: withDay.correct + (correct ? 1 : 0) };
    });
  };

  const startSession = (cards: VocabCard[], mode: StudyMode, title: string, exactCount?: number, distractorPool?: VocabCard[]) => {
    const unique = [...new Map(cards.map((card) => [card.id, card])).values()];
    const source = unique;
    if (!source.length) { setToast(`В кабинете «${activeSpace.languageName} · ${activeSpace.level}» пока нет карточек. Добавьте учебный модуль.`); return; }
    const count = exactCount ?? Math.min(mode === "quick" ? 10 : 15, source.length);
    const selected = shuffled(source).slice(0, count);
    if (exactCount && selected.length < exactCount) { const refill = shuffled(source); while (selected.length < exactCount) selected.push(refill[selected.length % refill.length]); }
    setSession({ cards: selected, pool: distractorPool?.length ? distractorPool : source, mode, title });
  };

  const startQuickReview = () => {
    const due = visibleCards.filter((card) => {
      const item = progress[card.id];
      return item && item.level > 0 && (!item.dueAt || new Date(item.dueAt).getTime() <= Date.now());
    });
    if (!due.length) { setToast("Сегодня все слова повторены. Выберите новые карточки в библиотеке."); return; }
    startSession(due, "refresh", "Повторение дня", Math.min(12, due.length), visibleCards);
  };

  const toggleStar = (card: VocabCard) => setProgress((current) => {
    const old = current[card.id] ?? { reps: 0, level: 0, stability: 0, dueAt: "", correct: 0, wrong: 0, starred: false };
    return { ...current, [card.id]: { ...old, starred: !old.starred } };
  });

  const completeSession = () => {
    setStats((current) => ({ ...current, sessions: current.sessions + 1 }));
    setSession(null);
    setToast("Занятие сохранено · прогресс обновлён");
  };

  const createModule = (title: string, cards: VocabCard[]) => {
    const id = Math.max(1000, ...customModules.map((module) => module.id)) + 1;
    const moduleCards = cards.map((card, index) => ({ ...card, id: `${id}-${index + 1}`, moduleId: id }));
    setCustomModules((current) => [...current, { id, title, cards: moduleCards, languageCode: activeSpace.languageCode, languageName: activeSpace.languageName, level: activeSpace.level, nativeLanguageCode: activeSpace.nativeLanguageCode, custom: true }]);
    setCreateOpen(false); setTechOnly(false); setScreen("library"); setToast(`Модуль «${title}» добавлен · ${cards.length} карточек`);
  };

  const saveModule = (module: VocabModule, title: string, cards: VocabCard[]) => {
    const now = Date.now();
    const updated = { ...module, title, cards: cards.map((card, index) => ({ ...card, id: card.id.startsWith("draft-") ? `${module.id}-new-${now}-${index}` : card.id, moduleId: module.id })) };
    if (module.custom) setCustomModules((current) => current.map((item) => item.id === module.id ? updated : item));
    else setModuleOverrides((current) => ({ ...current, [module.id]: updated }));
    setEditingModule(null); setToast(`Модуль «${title}» сохранён · ${cards.length} карточек`);
  };

  const deleteModule = (module: VocabModule) => {
    if (!window.confirm(`Удалить модуль «${module.title}» вместе со всеми его карточками?`)) return;
    if (module.custom) setCustomModules((current) => current.filter((item) => item.id !== module.id));
    else setDeletedModuleIds((current) => [...new Set([...current, module.id])]);
    setToast(`Модуль «${module.title}» удалён`);
  };

  const moveModule = (fromId: number, toId: number) => setModuleOrder((current) => {
    const order = [...new Set([...current, ...orderedModules.map((module) => module.id)])];
    const from = order.indexOf(fromId); const to = order.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return current;
    const [moved] = order.splice(from, 1); order.splice(to, 0, moved);
    return order;
  });

  const buyFreeze = () => {
    if (stats.crystals < 200) { setToast("Нужно 200 кристаллов. Получайте их за верные ответы."); return; }
    setStats((current) => ({ ...current, crystals: current.crystals - 200, freezeCount: current.freezeCount + 1 }));
    setToast("Заморозка серии куплена");
  };

  if (session) return <StudySession cards={session.cards} pool={session.pool} mode={session.mode} title={session.title} learningLanguageCode={activeSpace.languageCode} nativeLanguageCode={activeSpace.nativeLanguageCode} progress={progress} confusions={confusions} autoSpeak={preferences.autoSpeak} onClose={() => setSession(null)} onComplete={completeSession} onAnswer={recordAnswer} onToggleStar={toggleStar} />;
  if (podcastCards) return <PodcastMode cards={podcastCards} learningLanguageCode={activeSpace.languageCode} nativeLanguageCode={activeSpace.nativeLanguageCode} onClose={() => setPodcastCards(null)} onAnswer={recordAnswer} />;
  if (activeGame) return <GameSession gameId={activeGame.gameId} module={activeGame.module} onExit={() => setActiveGame(null)} onAnswer={(card, correct, confusedWith) => card.id.startsWith("sample-") ? recordPractice(correct) : recordAnswer(card, correct, correct ? 2 : 1, confusedWith)} />;
  if (activeGrammar) return <GrammarPractice topic={activeGrammar} onExit={() => setActiveGrammar(null)} onAnswer={recordPractice} />;

  const targetModule = visibleModules[0];
  const dueCards = visibleCards.filter((card) => {
    const item = progress[card.id]; return item && item.level > 0 && item.dueAt && new Date(item.dueAt).getTime() <= Date.now();
  });

  return <div className={`app-shell ${preferences.highContrast ? "contrast-mode" : ""}`}>
    <Sidebar screen={screen} languageSpace={activeSpace} onSettings={() => setSettingsOpen(true)} onLanguage={() => setSpacesOpen(true)} />
    <main className="main-area">
      <header className="top-header">
        <div className="mobile-brand"><LogoMark /> LinguaPlay</div><div className="header-spacer" />
        {activeSpace.languageCode === "de" && activeSpace.level === "A1–A2" && <button className={`tech-switch ${techOnly ? "active" : ""}`} onClick={() => { setTechOnly((value) => !value); setToast(techOnly ? "Показан весь кабинет" : "Показаны IT/Tech-модули этого кабинета"); }} title="Показать только профессиональную лексику">IT / Tech</button>}
        <button className="stat-pill flame-pill" title="Серия занятий" onClick={() => setStreakOpen(true)}><Icon name="flame" size={18} /><strong>{stats.streak}</strong></button>
        <button className="stat-pill" title="Кристаллы" onClick={() => setToast(`${stats.crystals} кристаллов · +2 за верный ответ`)}><Icon name="gem" size={18} /><strong>{stats.crystals}</strong></button>
        <button className="avatar" aria-label="Открыть настройки профиля" onClick={() => setSettingsOpen(true)}>{preferences.name.slice(0, 2).toUpperCase()}</button>
      </header>
      {screen === "today" && <Today modules={visibleModules} allCards={visibleCards} progress={progress} stats={stats} preferences={preferences} dueCount={dueCards.length} languageName={activeSpace.languageName} onContinue={() => { const review = dueCards.slice(0, 10); const newCards = (targetModule?.cards ?? []).filter((card) => !progress[card.id]).slice(0, 5); const mixed = [...review, ...newCards]; startSession(mixed.length ? mixed : targetModule?.cards ?? [], "cards", "Продолжить путь", undefined, visibleCards); }} onQuick={() => startSession(shuffled(visibleCards).slice(0, 10), "quick", "2 минуты · текущий кабинет", 10, visibleCards)} onReview={startQuickReview} onPodcast={() => visibleCards.length ? setPodcastCards(shuffled(dueCards.length ? dueCards : visibleCards).slice(0, 10)) : setToast("В этом кабинете пока нет карточек.")} onRefresh={(module) => { const weak = module.cards.filter((card) => !progress[card.id] || progress[card.id].level < 3); startSession(weak, "test", `Освежить · ${module.title}`, undefined, module.cards); }} onGames={() => setScreen("games")} onLibrary={() => setScreen("library")} />}
      {screen === "library" && <Library modules={visibleModules} progress={progress} onReorder={moveModule} onCreate={() => setCreateOpen(true)} onStart={(module) => startSession(module.cards, "cards", module.title, undefined, module.cards)} onTest={(module) => startSession(module.cards, "test", `Тест · ${module.title}`, undefined, module.cards)} onWrite={(module) => startSession(module.cards, "write", `Написать перевод · ${module.title}`, undefined, module.cards)} onEdit={(module) => setEditingModule(module)} onDelete={deleteModule} onExport={(module) => { const text = module.cards.map((card) => `${card.article ? `${card.article} ` : ""}${card.word} ${card.transcription} - ${card.translation}`).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); link.download = `${module.title.replace(/[^\p{L}\d]+/gu, "_")}.txt`; link.click(); URL.revokeObjectURL(link.href); setToast("Словарь экспортирован в .txt"); }} onGames={(module) => { setPreferredGameModuleId(module.id); setScreen("games"); }} techOnly={techOnly} />}
      {screen === "path" && <PathScreen modules={visibleModules} progress={progress} lessons={lessons} onCreateLesson={(chapter) => setLessonDraft({ chapter })} onEditLesson={(lesson) => setLessonDraft({ chapter: lesson.chapter, lesson })} onDeleteLesson={(lesson) => { if (window.confirm(`Удалить урок «${lesson.title}»?`)) { setLessons((current) => current.filter((item) => item.id !== lesson.id)); lesson.resources.forEach((resource) => { if (resource.mediaId) void removeMediaFile(resource.mediaId).catch(() => undefined); }); } }} onOpenLesson={setActiveLesson} onStart={(module) => startSession(module.cards, "cards", module.title, undefined, module.cards)} onStartActivity={(activity, module) => setActiveGame({ gameId: activity.gameId, module: prepareGameModule(activity.gameId, { ...module, title: activity.title, cards: module.cards.filter((card) => activity.cardIds.includes(card.id)) }) })} onManageGames={(moduleId) => { setPreferredGameModuleId(moduleId); setScreen("games"); }} />}
      {screen === "games" && <GameHub key={activeSpace.id} modules={visibleModules} preferredModuleId={preferredGameModuleId} languageCode={activeSpace.languageCode} languageName={activeSpace.languageName} level={activeSpace.level} onStart={(gameId, module) => setActiveGame({ gameId, module })} onGrammar={(topic) => setActiveGrammar(topic)} onAudioAnswer={recordPractice} />}
      {screen === "stats" && <StatsScreen modules={visibleModules} cards={visibleCards} progress={progress} stats={stats} confusions={confusions} onReviewMistakes={(cards) => startSession(cards, "test", "Мои ошибки", undefined, visibleCards)} />}
    </main>
    {toast && <div className="toast-message" role="status">{toast}<button onClick={() => setToast("")} aria-label="Закрыть"><Icon name="close" size={15} /></button></div>}
    {createOpen && <CreateModuleDialog onClose={() => setCreateOpen(false)} onCreate={createModule} languageName={activeSpace.languageName} level={activeSpace.level} />}
    {editingModule && <EditModuleDialog module={editingModule} onClose={() => setEditingModule(null)} onSave={(title, cards) => saveModule(editingModule, title, cards)} />}
    {spacesOpen && <LearningSpaceDialog spaces={spaces} activeId={activeSpace.id} onSelect={(id) => { setActiveSpaceId(id); setTechOnly(false); }} onCreate={(space) => setSpaces((current) => current.some((item) => item.languageCode === space.languageCode && item.level === space.level) ? current : [...current, space])} onClose={() => setSpacesOpen(false)} />}
    {settingsOpen && <SettingsDialog value={preferences} onClose={() => setSettingsOpen(false)} onSave={(value) => { setPreferences(value); setSettingsOpen(false); setToast("Настройки сохранены"); }} onReset={() => { setProgress({}); setStats(defaultStats); setSettingsOpen(false); setToast("Прогресс сброшен; словарь сохранён"); }} />}
    {streakOpen && <StreakDialog streak={stats.streak} crystals={stats.crystals} freezeCount={stats.freezeCount} vacation={vacation} onBuyFreeze={buyFreeze} onToggleVacation={() => { setVacation((value) => !value); setToast(vacation ? "Режим отпуска выключен" : "Режим отпуска включён"); }} onClose={() => setStreakOpen(false)} />}
    {lessonDraft && <LessonDialog chapter={lessonDraft.chapter} initial={lessonDraft.lesson} modules={visibleModules} onClose={() => setLessonDraft(null)} onSave={(lesson) => { setLessons((current) => current.some((item) => item.id === lesson.id) ? current.map((item) => item.id === lesson.id ? lesson : item) : [...current, lesson]); setLessonDraft(null); setToast(`Урок «${lesson.title}» сохранён`); }} />}
    {activeLesson && <LessonViewer lesson={activeLesson} onClose={() => setActiveLesson(null)} onStartResource={(resource: LessonResource) => {
      const module = visibleModules.find((item) => item.id === resource.moduleId);
      setActiveLesson(null);
      if (!module) { setToast("Модуль этого задания больше недоступен в текущем кабинете."); return; }
      if (resource.kind === "test") startSession(module.cards, "test", `Тест · ${module.title}`, undefined, module.cards);
      else if (resource.kind === "game" && resource.gameId) setActiveGame({ gameId: resource.gameId, module: prepareGameModule(resource.gameId, module) });
    }} />}
  </div>;
}

function LogoMark() { return <span className="logo-mark"><span>L</span><i /></span>; }

function Sidebar({ screen, languageSpace, onSettings, onLanguage }: { screen: Screen; languageSpace: LearningSpace; onSettings: () => void; onLanguage: () => void }) {
  const nav: { id: Screen; label: string; icon: IconName }[] = [
    { id: "today", label: "Сегодня", icon: "home" }, { id: "library", label: "Библиотека", icon: "library" }, { id: "path", label: "Мой путь", icon: "path" }, { id: "games", label: "Игры и упражнения", icon: "game" }, { id: "stats", label: "Статистика", icon: "chart" },
  ];
  return <aside className="sidebar"><div className="window-dots"><i /><i /><i /></div><div className="brand"><LogoMark /><span>LinguaPlay</span></div><nav aria-label="Разделы приложения">{nav.map((item) => <a key={item.id} href={`#/${item.id}`} className={screen === item.id ? "active" : ""} aria-current={screen === item.id ? "page" : undefined} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></a>)}</nav><div className="sidebar-bottom"><button className="language-card" onClick={onLanguage} aria-label="Сменить язык или уровень"><span className="flag">{languageSpace.flag}</span><span><strong>{languageSpace.languageName}</strong><small>Уровень {languageSpace.level}</small></span><Icon name="chevron" size={16} /></button><button className="settings-button" onClick={onSettings}><Icon name="settings" /><span>Настройки</span></button></div></aside>;
}

function Today({ modules, allCards, progress, stats, preferences, dueCount, languageName, onContinue, onQuick, onReview, onPodcast, onRefresh, onGames, onLibrary }: { modules: VocabModule[]; allCards: VocabCard[]; progress: Record<string, CardProgress>; stats: UserStats; preferences: Preferences; dueCount: number; languageName: string; onContinue: () => void; onQuick: () => void; onReview: () => void; onPodcast: () => void; onRefresh: (module: VocabModule) => void; onGames: () => void; onLibrary: () => void }) {
  if (!modules.length) return <div className="page"><div className="page-heading"><div><p className="eyebrow">УЧЕБНЫЙ КАБИНЕТ</p><h1>{languageName} · нет материалов</h1><p>Этот кабинет изолирован от немецкого курса. Добавьте сюда собственный словарь, чтобы создавать свои карточки и задания.</p></div></div><div className="empty-state cabinet-empty"><Icon name="library" size={32} /><h2>Начните с первого модуля</h2><p>Загрузите слова на выбранном языке или создайте их вручную. Игры и грамматика появятся по этим материалам.</p><button className="primary-button" onClick={onLibrary}>Открыть библиотеку</button></div></div>;
  const candidates = modules.filter((module) => module.id >= 20 && module.id <= 22);
  const activeModules = candidates.length ? candidates : modules.slice(-3);
  const today = localDay(); const dailyXp = stats.dailyDate === today ? stats.dailyXp : 0;
  const date = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <div className="page today-page"><div className="page-heading"><div><p className="eyebrow">{date.toLocaleUpperCase()}</p><h1>Guten Morgen, {preferences.name}</h1><p>Небольшой шаг сегодня — крепкая память завтра.</p></div><div className="goal-ring" style={{ "--goal": `${Math.min(100, dailyXp / preferences.dailyGoal * 100)}%` } as React.CSSProperties}><div><strong>{dailyXp}</strong><span>из {preferences.dailyGoal} XP</span></div></div></div>
    <section className="continue-card"><div className="continue-glow" /><div className="continue-content"><span className="section-badge"><Icon name="spark" size={15} /> ПРОДОЛЖИТЬ ПУТЬ</span><h2>Урок по вашему прогрессу</h2><p>{dueCount ? `${dueCount} слов готовы к повторению` : "Смешанная практика · новые слова и повторение"}</p><div className="lesson-progress"><span style={{ width: `${dailyXp / preferences.dailyGoal * 100}%` }} /></div><button className="primary-button" onClick={onContinue}>Продолжить <Icon name="arrow" size={18} /></button></div><div className="word-orbit" aria-hidden="true"><span className="word-chip chip-one">neben</span><span className="word-chip chip-two">unter</span><span className="word-chip chip-three">auf</span><div className="orbit-card"><div className="mini-window"><i /><i /></div><div className="mini-table" /><div className="mini-lamp" /><div className="mini-rug" /></div></div></section>
    <div className="quick-grid"><button className="quick-card" onClick={onQuick}><span className="quick-icon blue"><Icon name="clock" /></span><span><strong>2 минуты · {languageName}</strong><small>Быстрый урок только по этому кабинету</small></span><Icon name="chevron" className="quick-chevron" /></button><button className="quick-card" onClick={onReview}><span className="quick-icon violet"><Icon name="refresh" /></span><span><strong>Повторение дня</strong><small>{dueCount ? `${dueCount} слов ждут вас` : "Пока нет слов к повторению"}</small></span><span className="count-badge">{dueCount}</span><Icon name="chevron" className="quick-chevron" /></button><button className="quick-card" onClick={onPodcast}><span className="quick-icon dark"><Icon name="headphones" /></span><span><strong>Аудиопрактика</strong><small>Озвучка в выбранных языках</small></span><Icon name="chevron" className="quick-chevron" /></button></div>
    <section className="memory-section"><div className="section-title"><div><h2>Запас прочности</h2><p>Уровень закрепления по модулям</p></div><button onClick={onLibrary}>Все модули <Icon name="arrow" size={15} /></button></div><div className="memory-grid">{activeModules.map((module, index) => { const learned = module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length; const value = module.cards.length ? Math.round(learned / module.cards.length * 100) : 0; return <article className="memory-card" key={module.id}><div className="memory-head"><span className={`module-symbol ${["blue", "violet", "teal"][index % 3]}`}><Icon name={index === 0 ? "home" : index === 1 ? "book" : "library"} /></span><button aria-label={`Практика: ${module.title}`} onClick={() => onRefresh(module)}><Icon name="more" /></button></div><h3>{module.title}</h3><p>{module.cards.length} слов · Модуль {module.id}</p><div className="memory-score"><strong>{value}%</strong><span>{value ? "Закреплено" : "Ещё не изучены"}</span></div><div className={`memory-bar ${value < 35 ? "low" : value < 75 ? "medium" : ""}`}><span style={{ width: `${value}%` }} /></div><button className="refresh-button" onClick={() => onRefresh(module)}>Освежить <Icon name="arrow" size={16} /></button></article>; })}</div></section>
    <button className="games-banner" onClick={onGames}><span><Icon name="game" /></span><strong>Закрепите слова в игре</strong><small>14 игровых механик · упражнения A1–A2</small><Icon name="arrow" /></button>
    <p className="today-content-count">В словаре {allCards.length} карточек в {modules.length} модулях.</p>
  </div>;
}

function Library({ modules, progress, onReorder, onCreate, onStart, onTest, onWrite, onEdit, onDelete, onExport, onGames, techOnly }: { modules: VocabModule[]; progress: Record<string, CardProgress>; onReorder: (from: number, to: number) => void; onCreate: () => void; onStart: (module: VocabModule) => void; onTest: (module: VocabModule) => void; onWrite: (module: VocabModule) => void; onEdit: (module: VocabModule) => void; onDelete: (module: VocabModule) => void; onExport: (module: VocabModule) => void; onGames: (module: VocabModule) => void; techOnly: boolean }) {
  const [search, setSearch] = useState(""); const [openMenu, setOpenMenu] = useState<number | null>(null); const [filter, setFilter] = useState<"all" | "new" | "learned">("all"); const draggedModule = useRef<number | null>(null);
  useEffect(() => {
    if (openMenu === null) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".module-actions-menu, .module-menu-trigger")) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenMenu(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [openMenu]);
  const visible = modules.filter((module) => {
    const found = `${module.title} ${module.cards.map((card) => `${card.word} ${card.translation}`).join(" ")}`.toLowerCase().includes(search.toLowerCase());
    const hasNew = module.cards.some((card) => !progress[card.id] || progress[card.id].level === 0);
    const hasLearned = module.cards.some((card) => (progress[card.id]?.level ?? 0) >= 2);
    return found && (filter === "all" || (filter === "new" ? hasNew : hasLearned));
  });
  return <div className="page"><div className="library-heading"><div><p className="eyebrow">ВАШИ МАТЕРИАЛЫ</p><h1>Библиотека</h1><p>{modules.length} модулей · {modules.reduce((sum, module) => sum + module.cards.length, 0)} карточек{techOnly ? " · IT/Tech" : ""}</p></div><button className="primary-button compact" onClick={onCreate}><Icon name="plus" size={18} /> Создать / импортировать</button></div><div className="library-tools"><label className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по словам и модулям" /></label><label className="library-filter-label">Показать<select aria-label="Фильтр модулей" value={filter} onChange={(event) => setFilter(event.target.value as "all" | "new" | "learned")}><option value="all">Все модули</option><option value="new">Есть новые карточки</option><option value="learned">Есть закреплённые</option></select><span>{visible.length}</span></label></div>
    {visible.length === 0 ? <div className="empty-state"><Icon name="search" size={28} /><h2>{search ? "Ничего не найдено" : "В этом кабинете пока нет модулей"}</h2><p>{search ? "Измените запрос или сбросьте фильтр." : "Создайте модуль или импортируйте слова для выбранного языка и уровня."}</p>{search ? <button className="secondary-button" onClick={() => setSearch("")}>Сбросить поиск</button> : <button className="primary-button" onClick={onCreate}><Icon name="plus" /> Создать первый модуль</button>}</div> : <div className="module-grid">{visible.map((module, index) => { const mastered = module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length; const percent = module.cards.length ? Math.round(mastered / module.cards.length * 100) : 0; return <article className="module-card-shell" key={module.id} draggable onDragStart={(event) => { draggedModule.current = module.id; event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = draggedModule.current; if (from !== null) onReorder(from, module.id); draggedModule.current = null; }} onDragEnd={() => { draggedModule.current = null; }}><button className="module-card" onClick={() => onStart(module)}><div className={`module-cover ${["blue", "violet", "teal", "amber", "rose"][index % 5]}`}><span>{String(module.id).padStart(2, "0")}</span><Icon name={index % 3 === 0 ? "spark" : index % 3 === 1 ? "book" : "path"} size={30} /></div><div className="module-info"><div><span>МОДУЛЬ {module.id}{module.custom ? " · МОЙ" : ""}</span><span className="module-drag-grip" title="Перетащите модуль, чтобы изменить порядок">⠿</span><Icon name="arrow" size={15} /></div><h3>{module.title}</h3><p>{module.cards.length} карточек · {module.level}</p><div className="module-progress"><i style={{ width: `${percent}%` }} /></div></div></button><button className="module-menu-trigger" aria-label={`Действия модуля ${module.title}`} aria-expanded={openMenu === module.id} onClick={() => setOpenMenu((value) => value === module.id ? null : module.id)}><Icon name="more" size={17} /></button>{openMenu === module.id && <div className="module-actions-menu"><button onClick={() => { setOpenMenu(null); onTest(module); }}>Выбрать ответ</button><button onClick={() => { setOpenMenu(null); onWrite(module); }}>Написать перевод</button><button onClick={() => { setOpenMenu(null); onGames(module); }}>Игры и упражнения</button><button onClick={() => { setOpenMenu(null); onEdit(module); }}>Изменить карточки и порядок</button><button disabled={index === 0} onClick={() => { setOpenMenu(null); if (visible[index - 1]) onReorder(module.id, visible[index - 1].id); }}>Переместить выше</button><button disabled={index === visible.length - 1} onClick={() => { setOpenMenu(null); if (visible[index + 1]) onReorder(module.id, visible[index + 1].id); }}>Переместить ниже</button><button onClick={() => { setOpenMenu(null); onExport(module); }}>Экспортировать словарь .txt</button><button className="text-danger" onClick={() => { setOpenMenu(null); onDelete(module); }}>Удалить модуль</button></div>}</article>; })}</div>}
  </div>;
}

function PathScreen({ modules, progress, lessons, onCreateLesson, onEditLesson, onDeleteLesson, onOpenLesson, onStart, onStartActivity, onManageGames }: { modules: VocabModule[]; progress: Record<string, CardProgress>; lessons: Lesson[]; onCreateLesson: (chapter: string) => void; onEditLesson: (lesson: Lesson) => void; onDeleteLesson: (lesson: Lesson) => void; onOpenLesson: (lesson: Lesson) => void; onStart: (module: VocabModule) => void; onStartActivity: (activity: PathActivity, module: VocabModule) => void; onManageGames: (moduleId: number) => void }) {
  const [activities, setActivities] = useState<PathActivity[]>(() => { try { const value = JSON.parse(localStorage.getItem("linguaplay-saved-activities") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } });
  useEffect(() => { localStorage.setItem("linguaplay-saved-activities", JSON.stringify(activities)); }, [activities]);
  const chapters = [
    { title: "Первые разговоры", subtitle: "Местоимения, sein, haben и простые вопросы", from: 1, to: 4 },
    { title: "Время и планы", subtitle: "Числа, календарь, частота и поездки", from: 5, to: 8 },
    { title: "Люди вокруг", subtitle: "Семья, друзья, характер и эмоции", from: 9, to: 11 },
    { title: "Городская жизнь", subtitle: "Дорога, покупки, кафе и транспорт", from: 12, to: 18 },
    { title: "Мой дом", subtitle: "Комнаты, предметы, расположение и быт", from: 19, to: 23 },
    { title: "Дела и работа", subtitle: "Досуг, здоровье, профессии и задачи", from: 24, to: 29 },
    { title: "Вокруг нас", subtitle: "Учёба, документы, одежда, погода и природа", from: 30, to: 34 },
    { title: "Немецкий для IT", subtitle: "Технологии, данные и аналитика", from: 35, to: 39 },
  ].map((chapter) => ({ ...chapter, modules: modules.filter((module) => module.id >= chapter.from && module.id <= chapter.to) })).filter((chapter) => chapter.modules.length);
  const customModules = modules.filter((module) => module.custom || module.id >= 1000);
  if (customModules.length) chapters.push({ title: "Мои главы", subtitle: "Созданные вами словари и карточки", from: 1000, to: 99999, modules: customModules });
  return <div className="page course-page"><div className="page-heading"><div><p className="eyebrow">КУРС · {modules[0]?.languageName ?? "ЯЗЫК"} {modules[0]?.level ?? ""}</p><h1>Ваш учебный маршрут</h1><p>Главы курса объединяют словари, уроки и игры по одной теме.</p></div></div>{chapters.length ? <div className="course-chapters">{chapters.map((chapter, index) => {
    const total = chapter.modules.reduce((sum, module) => sum + module.cards.length, 0);
    const learned = chapter.modules.reduce((sum, module) => sum + module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length, 0);
    const percent = total ? Math.round(learned / total * 100) : 0;
    const chapterGames = activities.filter((activity) => activity.languageCode === modules[0]?.languageCode && activity.level === modules[0]?.level && chapter.modules.some((module) => module.id === activity.moduleId));
    const chapterLessons = lessons.filter((lesson) => lesson.chapter === chapter.title);
    return <section className={`course-chapter chapter-${index % 4}`} key={chapter.title}>
      <header><span className="chapter-number">ГЛАВА {String(index + 1).padStart(2, "0")}</span><span className="chapter-progress-label">{learned}/{total} слов · {percent}%</span><h2>{chapter.title}</h2><p>{chapter.subtitle}</p><div className="chapter-progress"><i style={{ width: `${percent}%` }} /></div></header>
      <div className="chapter-modules">{chapter.modules.map((module) => {
        const count = module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length;
        const done = module.cards.length > 0 && count === module.cards.length;
        return <button key={module.id} className={`chapter-module ${done ? "done" : ""}`} onClick={() => onStart(module)}><span className="chapter-module-number">{done ? <Icon name="check" size={15} /> : String(module.id).padStart(2, "0")}</span><span><strong>{module.title}</strong><small>{module.cards.length} карточек · {count} закреплено</small></span><Icon name="arrow" size={16} /></button>;
      })}</div>
      <section className="chapter-lessons"><div className="chapter-lessons-heading"><div><h3>Уроки и материалы</h3><p>Видео, изображения, аудио, ссылки и задания по теме.</p></div><button onClick={() => onCreateLesson(chapter.title)}><Icon name="plus" size={15} /> Добавить урок</button></div>
        {chapterLessons.length ? <div className="chapter-lesson-list">{chapterLessons.map((lesson) => <article key={lesson.id}><span className="lesson-card-mark"><Icon name="book" size={18} /></span><div><strong>{lesson.title}</strong><small>{lesson.description || `${lesson.resources.length} материалов`} · {lesson.resources.length} материалов</small></div><button onClick={() => onOpenLesson(lesson)}>Открыть</button><button aria-label={`Изменить урок ${lesson.title}`} onClick={() => onEditLesson(lesson)}>Изменить</button><button aria-label={`Удалить урок ${lesson.title}`} onClick={() => onDeleteLesson(lesson)}>Удалить</button></article>)}</div> : <p className="empty-inline">В этой главе пока нет уроков. Добавьте объяснение и прикрепите нужные материалы.</p>}
      </section>
      {chapterGames.length > 0 && <div className="path-games"><h3>Игры этой главы</h3>{chapterGames.map((activity) => { const module = chapter.modules.find((item) => item.id === activity.moduleId); if (!module) return null; return <article key={activity.id}><span className="path-game-icon">{GAME_LIST.find((game) => game.id === activity.gameId)?.mark}</span><div><strong>{activity.title}</strong><small>{GAME_LIST.find((game) => game.id === activity.gameId)?.title} · {activity.cardIds.length} карточек</small></div><button onClick={() => onStartActivity(activity, module)}>Играть</button><button onClick={() => onManageGames(module.id)}>Изменить</button><button aria-label={`Удалить ${activity.title}`} onClick={() => setActivities((current) => current.filter((item) => item.id !== activity.id))}>Удалить</button></article>; })}</div>}
      <button className="chapter-add-game" onClick={() => onManageGames(chapter.modules[0].id)}><Icon name="plus" size={15} /> Добавить или изменить игру в этой главе</button>
    </section>;
  })}</div> : <div className="empty-state cabinet-empty"><Icon name="path" size={32} /><h2>В этом кабинете пока нет глав</h2><p>Добавьте учебный модуль, затем соберите из его карточек игры, уроки и занятия.</p></div>}</div>;
}

function StatsScreen({ modules, cards, progress, stats, confusions, onReviewMistakes }: { modules: VocabModule[]; cards: VocabCard[]; progress: Record<string, CardProgress>; stats: UserStats; confusions: Record<string, Record<string, number>>; onReviewMistakes: (cards: VocabCard[]) => void }) {
  const learned = cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length;
  const reviewed = cards.filter((card) => (progress[card.id]?.reps ?? 0) > 0).length;
  const mistakes = cards.filter((card) => (progress[card.id]?.wrong ?? 0) > 0).sort((a, b) => (progress[b.id]?.wrong ?? 0) - (progress[a.id]?.wrong ?? 0)).slice(0, 6);
  const confusedPairs = Object.values(confusions).flatMap((pairs) => Object.entries(pairs)).filter(([, count]) => count >= 2).length;
  const accuracy = stats.answers ? Math.round(stats.correct / stats.answers * 100) : 0;
  const today = new Date(); const dayValues = Array.from({ length: 84 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - (83 - index)); const day = localDay(date); return stats.studyDays[day] || 0; });
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">ВАШ ПРОГРЕСС</p><h1>Статистика</h1><p>Результаты сохраняются в этом браузере на устройстве.</p></div></div><div className="stats-grid"><div className="stat-card"><span>Карточек закреплено</span><strong>{learned}</strong><small>из {cards.length} · {modules.length} модулей</small></div><div className="stat-card"><span>Точность ответов</span><strong>{accuracy}%</strong><small>{stats.correct} верных из {stats.answers} ответов</small></div><div className="stat-card"><span>Занятия</span><strong>{stats.sessions}</strong><small>{reviewed} карточек уже повторяли</small></div></div><div className="activity-card"><div className="section-title"><div><h2>Учебный ритм</h2><p>Последние 12 недель · {Object.values(stats.studyDays).filter(Boolean).length} активных дней</p></div></div><div className="heatmap">{dayValues.map((value, index) => <i key={index} title={`${value} ответов`} className={`level-${value === 0 ? 0 : value < 4 ? 1 : value < 9 ? 2 : value < 16 ? 3 : 4}`} />)}</div><div className="heat-legend">Меньше <i className="level-0" /><i className="level-2" /><i className="level-4" /> Больше</div></div><section className="mistakes-panel"><div className="section-title"><div><h2>Мои ошибки</h2><p>{mistakes.length ? `${mistakes.length} сложных слов · ${confusedPairs} пары-путаницы отмечены дважды` : "Ошибочные ответы появятся здесь после практики."}</p></div><button disabled={!mistakes.length} onClick={() => onReviewMistakes(mistakes)}>Повторить <Icon name="arrow" size={15} /></button></div>{mistakes.length > 0 && <div className="mistake-list">{mistakes.map((card) => <div key={card.id}><strong>{german(card)}</strong><span>{card.translation}</span><small>{progress[card.id]?.wrong} ошибок</small></div>)}</div>}</section><div className="stats-note"><Icon name="info" /><span>Уровень 0 — новое слово · уровень 1 — учится · уровень 2 — закрепляется · уровень 3 — освоено. Срок повтора рассчитывается по оценке ответа.</span></div></div>;
}

function PodcastMode({ cards, learningLanguageCode, nativeLanguageCode, onClose, onAnswer }: { cards: VocabCard[]; learningLanguageCode: string; nativeLanguageCode: string; onClose: () => void; onAnswer: (card: VocabCard, correct: boolean, rating?: number) => void }) {
  const [index, setIndex] = useState(0); const [playing, setPlaying] = useState(false); const card = cards[index % Math.max(1, cards.length)];
  useEffect(() => { if (!playing || !card) return; window.speechSynthesis?.cancel(); speakText(card.translation, speechLocaleForCode(nativeLanguageCode)); const timer = window.setTimeout(() => speakText(german(card), speechLocaleForCode(learningLanguageCode)), 3000); return () => { window.clearTimeout(timer); window.speechSynthesis?.cancel(); }; }, [playing, card, learningLanguageCode, nativeLanguageCode]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  if (!card) return null;
  const next = (known: boolean) => { if (known) onAnswer(card, true, 2); setIndex((value) => (value + 1) % cards.length); setPlaying(false); };
  return <div className="podcast-screen"><header><button onClick={onClose} aria-label="Закрыть подкаст"><Icon name="close" /></button><span>АУДИОПРАКТИКА</span><button onClick={() => speakText(german(card), speechLocaleForCode(learningLanguageCode), true)} aria-label="Медленная озвучка"><Icon name="volume" /></button></header><main><button type="button" className={`audio-orb ${playing ? "playing" : ""}`} onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Пауза" : "Озвучить перевод и слово"}><span /><span /><span /><Icon name="volume" size={32} /></button><p>{index + 1} из {cards.length}</p><h1>{card.translation}</h1><div className="pause-timer"><i /><span>{playing ? "Сначала перевод · затем изучаемое слово" : "Нажмите озвучить, затем вспомните слово"}</span></div><h2>{german(card)}</h2><p className="transcription">{card.transcription}</p></main><footer><button onClick={() => { setPlaying(false); speakText(card.translation, speechLocaleForCode(nativeLanguageCode)); }}><Icon name="refresh" /><span>Повторить</span></button><button className="play-button" onClick={() => setPlaying((value) => !value)}>{playing ? <span className="pause-icon">Ⅱ</span> : <Icon name="volume" size={28} />}<span>{playing ? "Пауза" : "Озвучить"}</span></button><button onClick={() => next(true)}><Icon name="check" /><span>Знаю</span></button><button className="podcast-skip" onClick={() => next(false)}><Icon name="arrow" /><span>Дальше</span></button></footer></div>;
}
