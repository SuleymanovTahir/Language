import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  modules,
  scenarioModules,
  storedModules,
  type VocabCard,
  type VocabModule,
} from "./lib/vocab";
import type { LearningSpace, Preferences } from "./components/Dialogs";
import {
  GAME_LIST,
  GRAMMAR_TOPICS,
  prepareGameModule,
  validateGame,
  type GameId,
  type GrammarTopic,
} from "./lib/gameCatalog";
import { Icon, type IconName } from "./components/Icon";
import type { Lesson, LessonResource } from "./components/Lessons";
import type { AudioQuiz } from "./components/AudioQuiz";
import { migrateLocalMediaToProfile, removeMediaFile } from "./lib/mediaStore";
import { copyAppLink } from "./lib/shareLink";
import { recommendDailyMission, type MissionDifficulty } from "./lib/recommendations";
import type { CardProgress, StudyMode } from "./components/StudySession";
import {
  speakText,
  speechLocaleForCode,
  defaultSpeechSettings,
  type SpeechSettings,
} from "./lib/speech";
import {
  activateProfileStorage,
  deactivateProfileStorage,
  readProfileItem,
  writeProfileItem,
} from "./lib/profileStorage";
import { authClient } from "./lib/auth-client";
import {
  AccountPanel,
  AuthScreen,
  type AccountUser,
  type Credentials,
} from "./components/Accounts";
import type { LearnerPlan } from "./components/Onboarding";
import type { CourseMissionState, CourseProgress, CourseSkills } from "./components/Course";
import type { CourseLevel, CourseUnit } from "./data/germanCourse";

const CreateModuleDialog = lazy(() =>
  import("./components/Dialogs").then((module) => ({ default: module.CreateModuleDialog })),
);
const EditModuleDialog = lazy(() =>
  import("./components/Dialogs").then((module) => ({ default: module.EditModuleDialog })),
);
const LearningSpaceDialog = lazy(() =>
  import("./components/Dialogs").then((module) => ({ default: module.LearningSpaceDialog })),
);
const SettingsDialog = lazy(() =>
  import("./components/Dialogs").then((module) => ({ default: module.SettingsDialog })),
);
const StreakDialog = lazy(() =>
  import("./components/Dialogs").then((module) => ({ default: module.StreakDialog })),
);
const GameHub = lazy(() =>
  import("./components/Games").then((module) => ({ default: module.GameHub })),
);
const GameSession = lazy(() =>
  import("./components/Games").then((module) => ({ default: module.GameSession })),
);
const GrammarPractice = lazy(() =>
  import("./components/Games").then((module) => ({ default: module.GrammarPractice })),
);
const LessonDialog = lazy(() =>
  import("./components/Lessons").then((module) => ({ default: module.LessonDialog })),
);
const LessonViewer = lazy(() =>
  import("./components/Lessons").then((module) => ({ default: module.LessonViewer })),
);
const MaterialFoldersDialog = lazy(() =>
  import("./components/MaterialFoldersDialog").then((module) => ({
    default: module.MaterialFoldersDialog,
  })),
);
const StudySession = lazy(() =>
  import("./components/StudySession").then((module) => ({ default: module.StudySession })),
);
const CourseOnboarding = lazy(() =>
  import("./components/Onboarding").then((module) => ({ default: module.CourseOnboarding })),
);
const CoursePath = lazy(() =>
  import("./components/Course").then((module) => ({ default: module.CoursePath })),
);
const CourseLesson = lazy(() =>
  import("./components/Course").then((module) => ({ default: module.CourseLesson })),
);
const CourseSkillsSummary = lazy(() =>
  import("./components/Course").then((module) => ({ default: module.CourseSkillsSummary })),
);
const AdminAnalyticsScreen = lazy(() =>
  import("./components/Admin").then((module) => ({ default: module.AdminAnalyticsScreen })),
);
const AdminUsersScreen = lazy(() =>
  import("./components/Admin").then((module) => ({ default: module.AdminUsersScreen })),
);
const CatalogScreen = lazy(() =>
  import("./components/Catalog").then((module) => ({ default: module.CatalogScreen })),
);

type Screen =
  | "today"
  | "library"
  | "catalog"
  | "path"
  | "materials"
  | "games"
  | "stats"
  | "admin"
  | "analytics";
const screenNames: Screen[] = [
  "today",
  "library",
  "catalog",
  "path",
  "materials",
  "games",
  "stats",
  "admin",
  "analytics",
];
function screenFromHash(): Screen {
  if (typeof window === "undefined") return "today";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const route = hash.split(/[?&]/)[0] as Screen;
  if (route === "path" && new URLSearchParams(hash.split("?").slice(1).join("?")).has("lesson"))
    return "materials";
  return screenNames.includes(route) ? route : "today";
}
type PathActivity = {
  id: string;
  title: string;
  gameId: GameId;
  moduleId: number;
  languageCode: string;
  level: string;
  cardIds: string[];
  cards?: VocabCard[];
  instructions?: string;
  media?: NonNullable<VocabModule["practiceMedia"]>;
};
type PathNode = {
  id: string;
  kind: "cards" | "test" | "game" | "audio" | "grammar" | "lesson";
  targetId?: string;
};
type PathCompletion = { runs: number; points: number; lastPoints: number; completedAt: string };
type UserStats = {
  xp: number;
  dailyXp: number;
  dailyDate: string;
  crystals: number;
  streak: number;
  sessions: number;
  answers: number;
  correct: number;
  correctStreak?: number;
  studyDays: Record<string, number>;
  studySecondsByDay?: Record<string, number>;
  lastStudyDay: string;
};
type EnergyState = { energy: number; nextAt: number; version?: number };
const defaultStats: UserStats = {
  xp: 0,
  dailyXp: 0,
  dailyDate: "",
  crystals: 0,
  streak: 0,
  sessions: 0,
  answers: 0,
  correct: 0,
  correctStreak: 0,
  studyDays: {},
  studySecondsByDay: {},
  lastStudyDay: "",
};
const ENERGY_CAP = 5;
const ENERGY_REFILL_MS = 30 * 60 * 1000;
const defaultEnergy: EnergyState = { energy: ENERGY_CAP, nextAt: 0, version: 2 };
const defaultPreferences: Preferences = {
  autoSpeak: false,
  highContrast: false,
  name: "",
  dailyGoal: 50,
};
const defaultSpace: LearningSpace = {
  id: "de-a1-a2",
  languageCode: "de",
  languageName: "Немецкий",
  flag: "DE",
  level: "A1–A2",
  nativeLanguageCode: "ru",
};

function useStored<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = readProfileItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    writeProfileItem(key, JSON.stringify(value));
  }, [key, value]);
  useEffect(() => {
    const reconcile = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string | null }>).detail;
      if (detail?.key !== key) return;
      try {
        setValue(detail.value ? (JSON.parse(detail.value) as T) : initial);
      } catch {
        setValue(initial);
      }
    };
    window.addEventListener("linguaplay-profile-reconciled", reconcile);
    return () => window.removeEventListener("linguaplay-profile-reconciled", reconcile);
  }, [key, initial]);
  return [value, setValue];
}

function useScopedStored<T>(
  key: string,
  scope: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [allValues, setAllValues] = useStored<Record<string, T>>(key, {});
  const value = allValues[scope] ?? initial;
  const setValue: React.Dispatch<React.SetStateAction<T>> = (next) =>
    setAllValues((current) => {
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

function energySnapshot(state: EnergyState, now = Date.now()): EnergyState {
  const energy = Math.max(
    0,
    Math.min(ENERGY_CAP, Number.isFinite(state.energy) ? state.energy : ENERGY_CAP),
  );
  if (energy >= ENERGY_CAP) return { energy: ENERGY_CAP, nextAt: 0, version: 2 };
  const nextAt = Number.isFinite(state.nextAt) ? state.nextAt : 0;
  if (!nextAt) return { energy, nextAt: now + ENERGY_REFILL_MS, version: 2 };
  if (now < nextAt) return { energy, nextAt, version: 2 };
  const restored = Math.min(ENERGY_CAP - energy, 1 + Math.floor((now - nextAt) / ENERGY_REFILL_MS));
  const remaining = energy + restored;
  return {
    energy: remaining,
    nextAt: remaining >= ENERGY_CAP ? 0 : nextAt + restored * ENERGY_REFILL_MS,
    version: 2,
  };
}

function clockLabel(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function localEnergyDeadline(
  nextAt: string | null | undefined,
  serverNow: string | null | undefined,
) {
  if (!nextAt) return 0;
  const deadline = new Date(nextAt).getTime();
  const serverTime = serverNow ? new Date(serverNow).getTime() : Date.now();
  return Number.isFinite(deadline) && Number.isFinite(serverTime)
    ? Date.now() + deadline - serverTime
    : 0;
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function german(card: VocabCard) {
  return `${card.article ? `${card.article} ` : ""}${card.word}`;
}

function WorkspaceApp({
  user,
  onSignOut,
  guestMode = false,
  onGuestGate,
}: {
  user: AccountUser | null;
  onSignOut: () => void;
  guestMode?: boolean;
  onGuestGate?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [spaces, setSpaces] = useStored<LearningSpace[]>("linguaplay-learning-spaces", [
    defaultSpace,
  ]);
  const [activeSpaceId, setActiveSpaceId] = useStored("linguaplay-active-space", defaultSpace.id);
  const activeSpace =
    spaces.find((space) => space.id === activeSpaceId) ?? spaces[0] ?? defaultSpace;
  const [customModules, setCustomModules] = useStored<VocabModule[]>(
    "linguaplay-custom-modules",
    storedModules(),
  );
  const [moduleOverrides, setModuleOverrides] = useStored<Record<number, VocabModule>>(
    "linguaplay-module-overrides",
    {},
  );
  const [deletedModuleIds, setDeletedModuleIds] = useStored<number[]>(
    "linguaplay-deleted-modules",
    [],
  );
  const [moduleOrder, setModuleOrder] = useScopedStored<number[]>(
    "linguaplay-module-order-by-space",
    activeSpace.id,
    [],
  );
  const [progress, setProgress] = useScopedStored<Record<string, CardProgress>>(
    "linguaplay-progress-by-space",
    activeSpace.id,
    {},
  );
  const [lessons, setLessons] = useScopedStored<Lesson[]>(
    "linguaplay-lessons-by-space",
    activeSpace.id,
    [],
  );
  const [audioQuizzes, setAudioQuizzes] = useStored<AudioQuiz[]>("linguaplay-audio-quizzes", []);
  const [confusions, setConfusions] = useScopedStored<Record<string, Record<string, number>>>(
    "linguaplay-confusions-by-space",
    activeSpace.id,
    {},
  );
  const [stats, setStats] = useScopedStored<UserStats>(
    "linguaplay-stats-by-space",
    activeSpace.id,
    defaultStats,
  );
  const [energy, setEnergy] = useStored<EnergyState>("linguaplay-energy", defaultEnergy);
  const [preferences, setPreferences] = useStored<Preferences>(
    "linguaplay-preferences",
    defaultPreferences,
  );
  const [speechSettings, setSpeechSettings] = useStored<SpeechSettings>(
    "linguaplay-speech-settings",
    defaultSpeechSettings,
  );
  const [legacyNameCleaned, setLegacyNameCleaned] = useStored(
    "linguaplay-legacy-seed-name-cleaned",
    false,
  );
  const [learningPlan, setLearningPlan] = useStored<LearnerPlan | null>(
    "linguaplay-learning-plan",
    null,
  );
  const [courseProgress, setCourseProgress] = useStored<CourseProgress>(
    "linguaplay-german-course-progress",
    {},
  );
  const [courseMissions, setCourseMissions] = useStored<Record<string, CourseMissionState>>(
    "linguaplay-course-missions",
    {},
  );
  const [missionDifficulty, setMissionDifficulty] = useState<MissionDifficulty>("balanced");
  const [alternateMission, setAlternateMission] = useState(false);
  const [courseContent, setCourseContent] = useState<Awaited<
    typeof import("./data/germanCourse")
  > | null>(null);
  const [pathSequences, setPathSequences] = useScopedStored<Record<number, PathNode[]>>(
    "linguaplay-path-sequences-by-space",
    activeSpace.id,
    {},
  );
  const [pathCompletions, setPathCompletions] = useScopedStored<Record<string, PathCompletion>>(
    "linguaplay-path-completions-by-space",
    activeSpace.id,
    {},
  );
  const [goalNoticeDate, setGoalNoticeDate] = useStored("linguaplay-goal-notified", "");
  const [vacation, setVacation] = useStored<boolean>("linguaplay-vacation", false);
  const activityRound = useRef(0);
  const lastLearnerInteraction = useRef(Date.now());
  const lastStudyTick = useRef(Date.now());
  const [session, setSession] = useState<{
    cards: VocabCard[];
    pool: VocabCard[];
    mode: StudyMode;
    title: string;
  } | null>(null);
  const [podcastCards, setPodcastCards] = useState<VocabCard[] | null>(null);
  const [activeGame, setActiveGame] = useState<{ gameId: GameId; module: VocabModule } | null>(
    null,
  );
  const [guestResultReady, setGuestResultReady] = useState(false);
  const [preferredGameModuleId, setPreferredGameModuleId] = useState<number | null>(null);
  const [activeGrammar, setActiveGrammar] = useState<GrammarTopic | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [energyOpen, setEnergyOpen] = useState(false);
  const [energyClock, setEnergyClock] = useState(Date.now());
  const [serverEnergyUserId, setServerEnergyUserId] = useState<string | null>(null);
  const [serverEnergyCap, setServerEnergyCap] = useState(ENERGY_CAP);
  const [serverEnergyRefillMs, setServerEnergyRefillMs] = useState(ENERGY_REFILL_MS);
  const currentUserId = user?.id ?? null;
  const [serverIsPro, setServerIsPro] = useState(false);
  const activityStartPending = useRef<{ activityId: string; idempotencyKey: string } | null>(null);
  const activityStartInFlight = useRef(false);
  const [lessonDraft, setLessonDraft] = useState<{ chapter: string; lesson?: Lesson } | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeCourseUnit, setActiveCourseUnit] = useState<CourseUnit | null>(null);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<VocabModule | null>(null);
  const [toast, setToast] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const activePathRun = useRef<{ nodeId: string; correct: number; attempts: number } | null>(null);
  const saveCourseMission = useCallback(
    (unitId: string, mission: CourseMissionState) => {
      setCourseMissions((current) => ({ ...current, [unitId]: mission }));
    },
    [setCourseMissions],
  );
  const activeLearning = Boolean(
    session || podcastCards || activeGame || activeGrammar || activeCourseUnit,
  );

  useEffect(() => {
    const markInteraction = () => {
      lastLearnerInteraction.current = Date.now();
    };
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    const timer = window.setInterval(() => {
      const now = Date.now();
      const from = lastStudyTick.current;
      lastStudyTick.current = now;
      if (!activeLearning || document.visibilityState !== "visible") return;
      const activeUntil = lastLearnerInteraction.current + 120_000;
      const activeMs = Math.max(0, Math.min(now, activeUntil) - from);
      const seconds = Math.floor(Math.min(30_000, activeMs) / 1000);
      if (seconds <= 0) return;
      const day = localDay();
      setStats((current) => ({
        ...current,
        studySecondsByDay: {
          ...(current.studySecondsByDay ?? {}),
          [day]: (current.studySecondsByDay?.[day] ?? 0) + seconds,
        },
      }));
    }, 30_000);
    lastStudyTick.current = Date.now();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };
  }, [activeLearning]);

  useEffect(() => {
    setEnergy((current) => {
      if (current.version === 2) return current;
      const oldEnergy = Math.max(
        0,
        Math.min(5, Number.isFinite(current.energy) ? current.energy : 5),
      );
      return {
        energy: Math.round((oldEnergy / 5) * ENERGY_CAP),
        nextAt: current.nextAt || 0,
        version: 2,
      };
    });
  }, [setEnergy]);

  const refreshServerEnergy = useCallback(async () => {
    if (!currentUserId) return true;
    try {
      const response = await fetch("/api/activities/start", {
        credentials: "include",
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        energy?: number;
        nextAt?: string | null;
        now?: string;
        serverNow?: string;
        isPro?: boolean;
        cap?: number;
        refillMs?: number;
        error?: string;
      };
      if (!response.ok || typeof result.energy !== "number")
        throw new Error(
          "Не удалось загрузить баланс энергии. Проверьте соединение и попробуйте ещё раз.",
        );
      setEnergy({
        energy: result.energy,
        nextAt: localEnergyDeadline(result.nextAt, result.now ?? result.serverNow),
        version: 2,
      });
      setServerIsPro(Boolean(result.isPro));
      if (typeof result.cap === "number") setServerEnergyCap(result.cap);
      if (typeof result.refillMs === "number") setServerEnergyRefillMs(result.refillMs);
      setServerEnergyUserId(currentUserId);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Не удалось проверить энергию.");
      return false;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setServerEnergyUserId(null);
      setServerIsPro(false);
      return;
    }
    let alive = true;
    void fetch("/api/activities/start", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          energy?: number;
          nextAt?: string | null;
          now?: string;
          serverNow?: string;
          isPro?: boolean;
          cap?: number;
          refillMs?: number;
          error?: string;
        };
        if (!response.ok || typeof result.energy !== "number")
          throw new Error(
            "Не удалось загрузить баланс энергии. Проверьте соединение и попробуйте ещё раз.",
          );
        if (!alive) return;
        setEnergy({
          energy: result.energy,
          nextAt: localEnergyDeadline(result.nextAt, result.now ?? result.serverNow),
          version: 2,
        });
        setServerIsPro(Boolean(result.isPro));
        if (typeof result.cap === "number") setServerEnergyCap(result.cap);
        if (typeof result.refillMs === "number") setServerEnergyRefillMs(result.refillMs);
        setServerEnergyUserId(currentUserId);
      })
      .catch((error) => {
        if (alive)
          setToast(error instanceof Error ? error.message : "Не удалось проверить энергию.");
      });
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (activeSpace.languageCode !== "de" || courseContent) return;
    let alive = true;
    void import("./data/germanCourse").then((content) => {
      if (alive) setCourseContent(content);
    });
    return () => {
      alive = false;
    };
  }, [activeSpace.languageCode, courseContent]);

  useEffect(() => {
    const syncRoute = () => {
      setScreen(screenFromHash());
      const route = window.location.hash.replace(/^#\/?/, "");
      const params = new URLSearchParams(route.split("?").slice(1).join("?"));
      if (!params.has("template") && !params.has("activity")) setActiveGame(null);
    };
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);
  useEffect(() => {
    const currentScreen = screenFromHash();
    if (currentScreen !== screen) return;
    const query = window.location.hash.split("?").slice(1).join("?");
    const route = `#/${screen}${query ? `?${query}` : ""}`;
    if (window.location.hash !== route)
      window.history.replaceState(window.history.state, "", route);
  }, [screen]);

  useEffect(() => {
    if (user && (!preferences.name || preferences.name === "Анна" || preferences.name === "Ученик"))
      setPreferences((current) => ({ ...current, name: user.name }));
  }, [user?.id, user?.name]);
  useEffect(() => {
    if (legacyNameCleaned) return;
    if (!user && (preferences.name === "Анна" || preferences.name === "Ученик"))
      setPreferences((current) => ({ ...current, name: "" }));
    setLegacyNameCleaned(true);
  }, [legacyNameCleaned, user?.id, preferences.name]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setEnergyClock(now);
      if (!user)
        setEnergy((current) => {
          const refreshed = energySnapshot(current, now);
          return refreshed.energy === current.energy && refreshed.nextAt === current.nextAt
            ? current
            : refreshed;
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "page-view", route: screen }),
      keepalive: true,
    }).catch(() => undefined);
  }, [screen, user?.id]);

  useEffect(() => {
    if (!user) return;
    const trackClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>("button, a, [role='button']");
      if (
        !control ||
        control.closest("[data-no-track]") ||
        (control instanceof HTMLButtonElement && control.disabled) ||
        ["admin", "analytics"].includes(screenFromHash())
      )
        return;
      if (
        !control.matches(
          "[data-track], a, .primary-button, .secondary-button, .game-tile, .module-menu-trigger, .chapter-module-open",
        ) ||
        control.closest(".game-choice-grid, .grammar-options, .study-answer-grid")
      )
        return;
      const label =
        control.dataset.track ||
        control.getAttribute("aria-label") ||
        control.getAttribute("title") ||
        control.textContent ||
        control.tagName;
      const action = label
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      if (!action) return;
      void fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "target-action", route: screenFromHash(), action }),
        keepalive: true,
      }).catch(() => undefined);
    };
    document.addEventListener("click", trackClick);
    return () => document.removeEventListener("click", trackClick);
  }, [user?.id]);

  useEffect(() => {
    if (screen !== "materials") return;
    const lessonId = new URLSearchParams(window.location.hash.split("?").slice(1).join("?")).get(
      "lesson",
    );
    if (!lessonId) return;
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    setActiveLesson(lesson);
    window.history.replaceState(window.history.state, "", "#/materials");
  }, [screen, lessons]);

  const normalizedCustomModules = useMemo(
    () =>
      customModules.map((module) => ({
        ...module,
        languageCode: module.languageCode || "de",
        languageName: module.languageName || "Немецкий",
        level: module.level || "A1–A2",
        nativeLanguageCode: module.nativeLanguageCode || "ru",
      })),
    [customModules],
  );
  const everyModule = useMemo(
    () => [
      ...[...modules, ...scenarioModules]
        .filter((module) => !deletedModuleIds.includes(module.id))
        .map((module) => moduleOverrides[module.id] ?? module),
      ...normalizedCustomModules,
    ],
    [normalizedCustomModules, moduleOverrides, deletedModuleIds],
  );
  const orderedModules = useMemo(
    () =>
      [...everyModule].sort((left, right) => {
        const leftIndex = moduleOrder.indexOf(left.id);
        const rightIndex = moduleOrder.indexOf(right.id);
        if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
        if (leftIndex >= 0) return -1;
        if (rightIndex >= 0) return 1;
        return left.id - right.id;
      }),
    [everyModule, moduleOrder],
  );
  const visibleModules = orderedModules.filter(
    (module) =>
      module.languageCode === activeSpace.languageCode &&
      (module.level === activeSpace.level ||
        (activeSpace.languageCode === "de" &&
          (activeSpace.level === "A1" ||
            activeSpace.level === "A2" ||
            activeSpace.level === "A1–A2") &&
          module.level === "A1–A2")),
  );
  const visibleCards = useMemo(
    () => visibleModules.flatMap((module) => module.cards),
    [visibleModules],
  );
  const dailyMission = useMemo(
    () =>
      recommendDailyMission(
        visibleCards,
        visibleModules,
        progress,
        learningPlan,
        missionDifficulty,
        alternateMission,
      ),
    [visibleCards, visibleModules, progress, learningPlan, missionDifficulty, alternateMission],
  );
  const courseLibraryWords =
    activeCourseUnit && (activeCourseUnit.level === "A1" || activeCourseUnit.level === "A2")
      ? orderedModules
          .filter(
            (module) =>
              module.languageCode === "de" && activeCourseUnit.moduleIds.includes(module.id),
          )
          .flatMap((module) => module.cards)
          .filter(
            (card) =>
              !activeCourseUnit.vocabulary.some(
                (item) =>
                  item.split(" — ")[0].toLocaleLowerCase() === card.word.toLocaleLowerCase(),
              ),
          )
          .slice(0, 5)
      : [];
  const canManageContent = user ? Boolean(user.permissions?.manageContent) : !guestMode;
  const canManageSpeechProviders = import.meta.env.DEV || user?.role === "owner";
  const canManageUsers = user?.role === "owner";
  const serverEnergyReady = !user || serverEnergyUserId === user.id;
  const energyStats = user && serverEnergyReady ? energy : energySnapshot(energy, energyClock);
  const isPro = user ? serverEnergyReady && serverIsPro : false;
  const energyCap = user && serverEnergyReady ? serverEnergyCap : ENERGY_CAP;
  const startActivityCharge = async (activityId: string) => {
    if (!user) {
      const snapshot = energySnapshot(energy);
      if (snapshot.energy <= 0) {
        setEnergy(snapshot);
        setEnergyOpen(true);
        setToast(
          `Энергия восстановится через ${clockLabel(snapshot.nextAt - Date.now())}. Карточки и уроки доступны без ограничений.`,
        );
        return false;
      }
      const remaining = snapshot.energy - 1;
      setEnergy({
        energy: remaining,
        nextAt:
          remaining >= ENERGY_CAP
            ? 0
            : snapshot.energy >= ENERGY_CAP
              ? Date.now() + ENERGY_REFILL_MS
              : snapshot.nextAt,
        version: 2,
      });
      return true;
    }
    if (activityStartInFlight.current) return false;
    activityStartInFlight.current = true;
    if (!serverEnergyReady && !(await refreshServerEnergy())) {
      activityStartInFlight.current = false;
      return false;
    }
    const pending =
      activityStartPending.current?.activityId === activityId
        ? activityStartPending.current
        : {
            activityId,
            idempotencyKey: `activity:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
          };
    activityStartPending.current = pending;
    try {
      const response = await fetch("/api/activities/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, idempotencyKey: pending.idempotencyKey }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        energy?: number;
        nextAt?: string | null;
        now?: string;
        serverNow?: string;
        isPro?: boolean;
        cap?: number;
        refillMs?: number;
        error?: string;
        exhausted?: boolean;
      };
      if (typeof result.energy === "number") {
        setEnergy({
          energy: result.energy,
          nextAt: localEnergyDeadline(result.nextAt, result.now ?? result.serverNow),
          version: 2,
        });
        setServerIsPro(Boolean(result.isPro));
        if (typeof result.cap === "number") setServerEnergyCap(result.cap);
        if (typeof result.refillMs === "number") setServerEnergyRefillMs(result.refillMs);
        setServerEnergyUserId(user.id);
      }
      if (!response.ok) {
        if (response.status < 500) activityStartPending.current = null;
        if (response.status === 429 || result.exhausted) {
          setEnergyOpen(true);
          setToast(
            `Энергия восстановится через ${clockLabel((result.nextAt ? new Date(result.nextAt).getTime() : Date.now() + ENERGY_REFILL_MS) - Date.now())}. Карточки и уроки доступны без ограничений.`,
          );
        } else setToast("Не удалось запустить игру. Проверьте соединение и попробуйте ещё раз.");
        return false;
      }
      activityStartPending.current = null;
      return true;
    } catch {
      setToast("Не удалось связаться с сервером энергии. Повторите запуск игры.");
      return false;
    } finally {
      activityStartInFlight.current = false;
    }
  };
  useEffect(() => {
    if (canManageSpeechProviders || speechSettings.provider !== "azure") return;
    setSpeechSettings((current) =>
      current.provider === "azure" ? { ...current, provider: "device", voice: "" } : current,
    );
  }, [canManageSpeechProviders, speechSettings.provider]);
  const completePathNode = () => {
    const run = activePathRun.current;
    if (!run) return;
    const points = run.correct * 5;
    setPathCompletions((current) => {
      const previous = current[run.nodeId] ?? {
        runs: 0,
        points: 0,
        lastPoints: 0,
        completedAt: "",
      };
      return {
        ...current,
        [run.nodeId]: {
          runs: previous.runs + 1,
          points: previous.points + points,
          lastPoints: points,
          completedAt: new Date().toISOString(),
        },
      };
    });
    activePathRun.current = null;
  };
  const sendActivityEvent = (payload: Record<string, unknown>) => {
    if (payload.type === "practice-complete") completePathNode();
    if (payload.type === "practice-complete" && guestMode) setGuestResultReady(true);
    if (user)
      void fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined);
  };
  const activeStudy = useRef<{
    id: string;
    title: string;
    moduleId?: number;
    moduleTitle?: string;
    total: number;
  } | null>(null);

  const claimGuestActivity = async () => {
    if (!guestMode) return true;
    try {
      const response = await fetch("/api/guest-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Guest trial API is unavailable");
      const result = (await response.json()) as { allowed?: boolean };
      if (!result.allowed) return false;
      return true;
    } catch {
      setToast("Не удалось проверить пробный доступ. Проверьте соединение и попробуйте ещё раз.");
      return false;
    }
  };

  const selectCourseLevel = (level: CourseLevel) => {
    const exact = spaces.find((space) => space.languageCode === "de" && space.level === level);
    const legacyA1 =
      level === "A1" ? spaces.find((space) => space.id === defaultSpace.id) : undefined;
    const existing = exact ?? legacyA1;
    if (existing) setActiveSpaceId(existing.id);
    else {
      const next: LearningSpace = { ...defaultSpace, id: `de-${level}`, level };
      setSpaces((current) =>
        current.some((space) => space.id === next.id) ? current : [...current, next],
      );
      setActiveSpaceId(next.id);
    }
    setScreen("path");
  };

  const startCourseUnit = async (unit: CourseUnit) => {
    if (guestMode && !(await claimGuestActivity())) {
      onGuestGate?.();
      return;
    }
    setGuestResultReady(false);
    beginEnergyExercise();
    setActiveCourseUnit(unit);
  };

  const completeCourseUnit = (unitId: string, skills: CourseSkills, durationMinutes: number) => {
    setCourseProgress((current) => {
      const previous = current[unitId];
      return {
        ...current,
        [unitId]: {
          ...skills,
          completedAt: new Date().toISOString(),
          attempts: (previous?.attempts ?? 0) + 1,
          durationMinutes,
        },
      };
    });
    setStats((current) => {
      const today = localDay();
      const fresh =
        current.dailyDate === today ? current : { ...current, dailyXp: 0, dailyDate: today };
      const withDay = recordStudyDay(fresh);
      return {
        ...withDay,
        sessions: withDay.sessions + 1,
        xp: withDay.xp + 30,
        dailyXp: withDay.dailyXp + 30,
        crystals: withDay.crystals + 5,
      };
    });
    if (user)
      void fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "practice-complete",
          activityId: unitId,
          activity: `Курс немецкого · ${unitId}`,
          roundTotal: 1,
          durationMinutes,
        }),
        keepalive: true,
      }).catch(() => undefined);
    setCourseMissions((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
    setActiveCourseUnit(null);
    setScreen("path");
    if (guestMode) setGuestResultReady(true);
    setToast("Юнит завершён · прогресс по навыкам сохранён");
  };

  useEffect(() => {
    if (activeSpace.id !== defaultSpace.id) return;
    const legacyProgress = readProfileItem("linguaplay-card-progress");
    const legacyStats = readProfileItem("linguaplay-user-stats");
    const legacyConfusions = readProfileItem("linguaplay-confusion-pairs");
    if (legacyProgress && !Object.keys(progress).length) {
      try {
        setProgress(JSON.parse(legacyProgress));
      } catch {
        /* ignore corrupt legacy state */
      }
    }
    if (legacyStats && stats.answers === 0) {
      try {
        setStats(JSON.parse(legacyStats));
      } catch {
        /* ignore corrupt legacy state */
      }
    }
    if (legacyConfusions && !Object.keys(confusions).length) {
      try {
        setConfusions(JSON.parse(legacyConfusions));
      } catch {
        /* ignore corrupt legacy state */
      }
    }
  }, [activeSpace.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const todayStudyMinutes = Math.floor((stats.studySecondsByDay?.[localDay()] ?? 0) / 60);
  const dailyGoalMinutes = learningPlan?.minutesPerDay ?? 10;
  useEffect(() => {
    const today = localDay();
    if (todayStudyMinutes >= dailyGoalMinutes && goalNoticeDate !== today) {
      setGoalNoticeDate(today);
      setToast(`Дневная цель выполнена: ${dailyGoalMinutes} минут практики.`);
    }
  }, [todayStudyMinutes, dailyGoalMinutes, goalNoticeDate]);

  const recordStudyDay = (current: UserStats): UserStats => {
    const today = localDay();
    if (current.lastStudyDay === today)
      return {
        ...current,
        studyDays: { ...current.studyDays, [today]: (current.studyDays[today] || 0) + 1 },
      };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = current.lastStudyDay === localDay(yesterday);
    return {
      ...current,
      streak: vacation
        ? current.streak
        : current.lastStudyDay && wasYesterday
          ? current.streak + 1
          : 1,
      lastStudyDay: today,
      studyDays: { ...current.studyDays, [today]: (current.studyDays[today] || 0) + 1 },
    };
  };

  const beginEnergyExercise = () => undefined;

  const recordAnswer = (
    card: VocabCard,
    correct: boolean,
    rating = correct ? 2 : 1,
    confusedWith?: string,
  ) => {
    if (activePathRun.current) {
      activePathRun.current.attempts += 1;
      if (correct) activePathRun.current.correct += 1;
    }
    const game = activeGame;
    const answerCard = confusedWith
      ? game?.module.cards.find((item) => item.id === confusedWith)
      : undefined;
    activityRound.current += 1;
    const study = activeStudy.current;
    sendActivityEvent({
      type: game ? "game-answer" : "practice-answer",
      activity: game
        ? (GAME_LIST.find((item) => item.id === game.gameId)?.title ?? game.gameId)
        : (study?.title ?? session?.title ?? "Карточки"),
      moduleId: card.moduleId,
      moduleTitle:
        game?.module.title ??
        visibleModules.find((item) => item.id === card.moduleId)?.title ??
        study?.moduleTitle,
      activityId: game?.gameId ?? study?.id,
      itemId: card.id,
      roundIndex: activityRound.current,
      roundTotal: game?.module.cards.length ?? study?.total ?? session?.cards.length,
      prompt: german(card),
      selectedAnswer: answerCard
        ? `${german(answerCard)} — ${answerCard.translation}`
        : correct
          ? `${german(card)} — ${card.translation}`
          : undefined,
      correctAnswer: `${german(card)} — ${card.translation}`,
      correct,
    });
    setProgress((current) => {
      const previous = current[card.id] ?? {
        reps: 0,
        level: 0,
        stability: 0,
        dueAt: "",
        correct: 0,
        wrong: 0,
        starred: false,
      };
      const reps = previous.reps + 1;
      const stability = !correct
        ? Math.max(1, Math.min(2, previous.stability || 1))
        : rating === 3
          ? Math.max(7, previous.stability + 7)
          : rating === 2
            ? Math.max(3, previous.stability + 2)
            : Math.max(1, previous.stability + 1);
      const level = reps === 0 ? 0 : stability >= 21 ? 3 : stability >= 3 ? 2 : 1;
      const interval = !correct
        ? 1
        : rating === 3
          ? 7
          : rating === 2
            ? 3
            : Math.max(1, Math.round(stability));
      const dueAt = new Date(Date.now() + interval * 86_400_000).toISOString();
      return {
        ...current,
        [card.id]: {
          ...previous,
          reps,
          level,
          stability,
          dueAt,
          correct: previous.correct + (correct ? 1 : 0),
          wrong: previous.wrong + (correct ? 0 : 1),
        },
      };
    });
    if (!correct && confusedWith && confusedWith !== card.id)
      setConfusions((current) => ({
        ...current,
        [card.id]: {
          ...current[card.id],
          [confusedWith]: (current[card.id]?.[confusedWith] || 0) + 1,
        },
      }));
    setStats((current) => {
      const day = localDay();
      const fresh =
        current.dailyDate === day ? current : { ...current, dailyXp: 0, dailyDate: day };
      const withDay = recordStudyDay(fresh);
      return {
        ...withDay,
        xp: withDay.xp + (correct ? 8 : 0),
        dailyXp: withDay.dailyXp + (correct ? 8 : 0),
        crystals: withDay.crystals + (correct ? 2 : 0),
        answers: withDay.answers + 1,
        correct: withDay.correct + (correct ? 1 : 0),
        correctStreak: correct ? (withDay.correctStreak ?? 0) + 1 : 0,
      };
    });
  };

  const recordPractice = (correct: boolean) => {
    if (activePathRun.current) {
      activePathRun.current.attempts += 1;
      if (correct) activePathRun.current.correct += 1;
    }
    setStats((current) => {
      const day = localDay();
      const fresh =
        current.dailyDate === day ? current : { ...current, dailyXp: 0, dailyDate: day };
      const withDay = recordStudyDay(fresh);
      return {
        ...withDay,
        xp: withDay.xp + (correct ? 5 : 0),
        dailyXp: withDay.dailyXp + (correct ? 5 : 0),
        crystals: withDay.crystals + (correct ? 1 : 0),
        answers: withDay.answers + 1,
        correct: withDay.correct + (correct ? 1 : 0),
        correctStreak: correct ? (withDay.correctStreak ?? 0) + 1 : 0,
      };
    });
  };

  const startSession = (
    cards: VocabCard[],
    mode: StudyMode,
    title: string,
    exactCount?: number,
    distractorPool?: VocabCard[],
    pathNodeId?: string,
  ) => {
    if (guestMode) {
      onGuestGate?.();
      return;
    }
    const unique = [...new Map(cards.map((card) => [card.id, card])).values()];
    const source = unique;
    if (!source.length) {
      setToast(
        `В кабинете «${activeSpace.languageName} · ${activeSpace.level}» пока нет карточек. Добавьте учебный модуль.`,
      );
      return;
    }
    beginEnergyExercise();
    const count = exactCount ?? Math.min(mode === "quick" ? 10 : 15, source.length);
    const selected = shuffled(source).slice(0, count);
    if (exactCount && selected.length < exactCount) {
      const refill = shuffled(source);
      while (selected.length < exactCount) selected.push(refill[selected.length % refill.length]);
    }
    const selectedModule = visibleModules.find((module) => module.id === selected[0]?.moduleId);
    const id = `study-${crypto.randomUUID?.() ?? Date.now()}`;
    activePathRun.current = pathNodeId ? { nodeId: pathNodeId, correct: 0, attempts: 0 } : null;
    activityRound.current = 0;
    activeStudy.current = {
      id,
      title,
      moduleId: selectedModule?.id,
      moduleTitle: selectedModule?.title,
      total: selected.length,
    };
    sendActivityEvent({
      type: "practice-start",
      activityId: id,
      activity: title,
      moduleId: selectedModule?.id,
      moduleTitle: selectedModule?.title,
      roundIndex: 0,
      roundTotal: selected.length,
      mode,
    });
    setSession({
      cards: selected,
      pool: distractorPool?.length ? distractorPool : source,
      mode,
      title,
    });
  };

  const openGame = async (
    gameId: GameId,
    module: VocabModule,
    route = `games?template=${encodeURIComponent(gameId)}&module=${module.id}`,
    pathNodeId?: string,
  ) => {
    const unavailable = validateGame(gameId, module);
    if (unavailable) {
      setScreen("games");
      setToast(unavailable);
      return;
    }
    if (guestMode && !(await claimGuestActivity())) {
      onGuestGate?.();
      return;
    }
    beginEnergyExercise();
    setGuestResultReady(false);
    if (!(await startActivityCharge(gameId))) return;
    activeStudy.current = null;
    activePathRun.current = pathNodeId ? { nodeId: pathNodeId, correct: 0, attempts: 0 } : null;
    activityRound.current = 0;
    sendActivityEvent({
      type: "game-start",
      activityId: gameId,
      activity: GAME_LIST.find((item) => item.id === gameId)?.title ?? gameId,
      moduleId: module.id,
      moduleTitle: module.title,
      roundIndex: 0,
      roundTotal: module.cards.length,
    });
    const hash = `#/${route.replace(/^#\/?/, "")}`;
    const fromDirectRoute = window.location.hash === hash;
    if (fromDirectRoute) {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      const state = {
        ...currentState,
        linguaPlayGame: true,
        linguaPlayDirectRoute: true,
        linguaPlayReturnHash: currentState.linguaPlayReturnHash || "#/games",
        linguaPlayGameId: `${gameId}-${Date.now()}`,
      };
      window.history.replaceState(state, "", "#/games");
    } else {
      const state = {
        ...(window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {}),
        linguaPlayGame: true,
        linguaPlayReturnHash: window.location.hash || "#/games",
        linguaPlayGameId: `${gameId}-${Date.now()}`,
      };
      window.history.pushState(state, "", hash);
    }
    setGuestResultReady(false);
    setActiveGame({ gameId, module });
  };
  const exitGame = () => {
    setActiveGame(null);
    setGuestResultReady(false);
    if (window.history.state?.linguaPlayGame && window.history.state?.linguaPlayDirectRoute) {
      const returnHash =
        typeof window.history.state.linguaPlayReturnHash === "string"
          ? window.history.state.linguaPlayReturnHash
          : "#/games";
      window.history.replaceState(null, "", returnHash);
      setScreen(screenFromHash());
    } else if (window.history.state?.linguaPlayGame) window.history.back();
    else {
      window.history.replaceState(null, "", "#/games");
      setScreen("games");
    }
  };

  useEffect(() => {
    if (screen !== "library") return;
    const params = new URLSearchParams(window.location.hash.split("?").slice(1).join("?"));
    const moduleId = Number(params.get("module"));
    const mode = params.get("mode");
    if (!moduleId || !["cards", "test", "write"].includes(mode ?? "")) return;
    const module = visibleModules.find((item) => item.id === moduleId);
    if (!module) return;
    window.history.replaceState(window.history.state, "", "#/library");
    const title =
      mode === "test"
        ? `Тест · ${module.title}`
        : mode === "write"
          ? `Написать перевод · ${module.title}`
          : module.title;
    startSession(module.cards, mode as StudyMode, title, undefined, module.cards);
  }, [screen, visibleModules]);

  const startQuickReview = () => {
    const due = visibleCards.filter((card) => {
      const item = progress[card.id];
      return (
        item && item.level > 0 && (!item.dueAt || new Date(item.dueAt).getTime() <= Date.now())
      );
    });
    if (!due.length) {
      setToast("Сегодня все слова повторены. Выберите новые карточки в библиотеке.");
      return;
    }
    startSession(due, "refresh", "Повторение дня", Math.min(12, due.length), visibleCards);
  };

  const toggleStar = (card: VocabCard) =>
    setProgress((current) => {
      const old = current[card.id] ?? {
        reps: 0,
        level: 0,
        stability: 0,
        dueAt: "",
        correct: 0,
        wrong: 0,
        starred: false,
      };
      return { ...current, [card.id]: { ...old, starred: !old.starred } };
    });

  const completeSession = () => {
    const study = activeStudy.current;
    if (study)
      sendActivityEvent({
        type: "practice-complete",
        activityId: study.id,
        activity: study.title,
        moduleId: study.moduleId,
        moduleTitle: study.moduleTitle,
        roundIndex: activityRound.current,
        roundTotal: study.total,
      });
    activeStudy.current = null;
    setStats((current) => ({ ...current, sessions: current.sessions + 1 }));
    setSession(null);
    setToast("Занятие сохранено · прогресс обновлён");
  };

  const createModule = (title: string, cards: VocabCard[]) => {
    const id = Math.max(1000, ...customModules.map((module) => module.id)) + 1;
    const moduleCards = cards.map((card, index) => ({
      ...card,
      id: `${id}-${index + 1}`,
      moduleId: id,
    }));
    setCustomModules((current) => [
      ...current,
      {
        id,
        title,
        cards: moduleCards,
        languageCode: activeSpace.languageCode,
        languageName: activeSpace.languageName,
        level: activeSpace.level,
        nativeLanguageCode: activeSpace.nativeLanguageCode,
        custom: true,
      },
    ]);
    setCreateOpen(false);
    setScreen("library");
    setToast(`Модуль «${title}» добавлен · ${cards.length} карточек`);
  };

  const saveModule = (module: VocabModule, title: string, cards: VocabCard[]) => {
    const now = Date.now();
    const updated = {
      ...module,
      title,
      cards: cards.map((card, index) => ({
        ...card,
        id: card.id.startsWith("draft-") ? `${module.id}-new-${now}-${index}` : card.id,
        moduleId: module.id,
      })),
    };
    if (module.custom)
      setCustomModules((current) =>
        current.map((item) => (item.id === module.id ? updated : item)),
      );
    else setModuleOverrides((current) => ({ ...current, [module.id]: updated }));
    setEditingModule(null);
    setToast(`Модуль «${title}» сохранён · ${cards.length} карточек`);
  };

  const deleteModule = (module: VocabModule) => {
    if (!window.confirm(`Удалить модуль «${module.title}» вместе со всеми его карточками?`)) return;
    if (module.custom)
      setCustomModules((current) => current.filter((item) => item.id !== module.id));
    else setDeletedModuleIds((current) => [...new Set([...current, module.id])]);
    setToast(`Модуль «${module.title}» удалён`);
  };

  const moveModule = (fromId: number, toId: number) =>
    setModuleOrder((current) => {
      const order = [...new Set([...current, ...orderedModules.map((module) => module.id)])];
      const from = order.indexOf(fromId);
      const to = order.indexOf(toId);
      if (from < 0 || to < 0 || from === to) return current;
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      return order;
    });

  const updateActiveCourseMission = useCallback(
    (mission: CourseMissionState) => {
      if (activeCourseUnit) saveCourseMission(activeCourseUnit.id, mission);
    },
    [activeCourseUnit?.id, saveCourseMission],
  );
  if (activeCourseUnit)
    return (
      <Suspense
        fallback={
          <main className="account-loading">
            <span className="account-spinner" />
            <strong>Открываю урок…</strong>
          </main>
        }
      >
        <CourseLesson
          unit={activeCourseUnit}
          libraryWords={courseLibraryWords}
          savedProgress={courseMissions[activeCourseUnit.id]}
          onProgressChange={updateActiveCourseMission}
          onClose={() => setActiveCourseUnit(null)}
          onAnswer={recordPractice}
          onComplete={completeCourseUnit}
        />
      </Suspense>
    );
  if (session)
    return (
      <Suspense
        fallback={
          <main className="account-loading">
            <span className="account-spinner" />
            <strong>Открываю занятие…</strong>
          </main>
        }
      >
        <StudySession
          cards={session.cards}
          pool={session.pool}
          mode={session.mode}
          title={session.title}
          learningLanguageCode={activeSpace.languageCode}
          nativeLanguageCode={activeSpace.nativeLanguageCode}
          progress={progress}
          confusions={confusions}
          autoSpeak={preferences.autoSpeak}
          onClose={() => setSession(null)}
          onComplete={completeSession}
          onAnswer={recordAnswer}
          onToggleStar={toggleStar}
        />
      </Suspense>
    );
  if (podcastCards)
    return (
      <PodcastMode
        cards={podcastCards}
        learningLanguageCode={activeSpace.languageCode}
        nativeLanguageCode={activeSpace.nativeLanguageCode}
        onClose={() => setPodcastCards(null)}
        onAnswer={recordAnswer}
      />
    );
  if (activeGame)
    return (
      <Suspense
        fallback={
          <main className="account-loading">
            <span className="account-spinner" />
            <strong>Открываю игру…</strong>
          </main>
        }
      >
        <GameSession
          gameId={activeGame.gameId}
          module={activeGame.module}
          onExit={exitGame}
          onRestart={async () => {
            if (guestMode && !(await claimGuestActivity())) {
              onGuestGate?.();
              return false;
            }
            const started = await startActivityCharge(activeGame.gameId);
            if (started) {
              activityRound.current = 0;
              setGuestResultReady(false);
            }
            return started;
          }}
          onComplete={() => {
            completePathNode();
            sendActivityEvent({
              type: "game-complete",
              activityId: activeGame.gameId,
              activity:
                GAME_LIST.find((item) => item.id === activeGame.gameId)?.title ?? activeGame.gameId,
              moduleId: activeGame.module.id,
              moduleTitle: activeGame.module.title,
              roundIndex: activityRound.current,
              roundTotal: activeGame.module.cards.length,
            });
            if (guestMode) setGuestResultReady(true);
          }}
          onAnswer={(card, correct, confusedWith) =>
            recordAnswer(card, correct, correct ? 2 : 1, confusedWith)
          }
        />
        {guestMode && guestResultReady && (
          <div className="guest-result-save">
            <span>Результат сохранён на этом устройстве.</span>
            <button className="primary-button" onClick={() => onGuestGate?.()}>
              Сохранить прогресс в аккаунте
            </button>
          </div>
        )}
      </Suspense>
    );
  if (activeGrammar)
    return (
      <Suspense
        fallback={
          <main className="account-loading">
            <span className="account-spinner" />
            <strong>Открываю тему…</strong>
          </main>
        }
      >
        <GrammarPractice
          topic={activeGrammar}
          onExit={() => setActiveGrammar(null)}
          onAnswer={recordPractice}
          onEvent={sendActivityEvent}
          onExerciseStart={async () => {
            if (guestMode && !(await claimGuestActivity())) {
              onGuestGate?.();
              return false;
            }
            beginEnergyExercise();
            setGuestResultReady(false);
            return true;
          }}
        />
      </Suspense>
    );

  const targetModule = visibleModules[0];
  const dueCards = visibleCards.filter((card) => {
    const item = progress[card.id];
    return item && item.level > 0 && item.dueAt && new Date(item.dueAt).getTime() <= Date.now();
  });
  const courseLevel =
    activeSpace.level === "A1–A2" ? "A1" : activeSpace.level === "C2" ? "C1" : activeSpace.level;
  const nextCourseUnit =
    activeSpace.languageCode === "de"
      ? courseContent?.getNextCourseUnit(courseLevel, courseProgress)
      : undefined;
  const completedCourseUnits =
    activeSpace.languageCode === "de"
      ? Object.entries(courseProgress).filter(
          ([id, item]) => id.startsWith(`${courseLevel.toLowerCase()}-`) && item.completedAt,
        ).length
      : 0;
  const courseUnitCount =
    activeSpace.languageCode === "de"
      ? (courseContent?.courseUnitsForLevel(courseLevel).length ?? 0)
      : 0;
  const courseMinutesToday =
    activeSpace.languageCode === "de"
      ? Object.values(courseProgress)
          .filter((item) => item.completedAt && localDay(new Date(item.completedAt)) === localDay())
          .reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0)
      : 0;
  const minutesToday = Math.max(todayStudyMinutes, courseMinutesToday);

  return (
    <div className={`app-shell ${preferences.highContrast ? "contrast-mode" : ""}`}>
      <Sidebar
        screen={screen}
        languageSpace={activeSpace}
        canManageUsers={canManageUsers}
        canManageContent={canManageContent}
        onSettings={() => setSettingsOpen(true)}
        onLanguage={() => setSpacesOpen(true)}
      />
      <main className="main-area">
        <header className="top-header">
          <div className="mobile-brand">
            <LogoMark /> ClickLing
          </div>
          <div className="header-spacer" />
          <button
            className="stat-pill flame-pill"
            title="Серия занятий"
            onClick={() => setStreakOpen(true)}
          >
            <Icon name="flame" size={18} />
            <strong>{stats.streak}</strong>
          </button>
          <button
            className="stat-pill"
            title="Кристаллы — визуальная награда без обмена на преимущества"
            onClick={() => setToast(`${stats.crystals} кристаллов · визуальная награда за ответы`)}
          >
            <Icon name="gem" size={18} />
            <strong>{stats.crystals}</strong>
          </button>
          <button
            className={`stat-pill energy-pill ${serverEnergyReady && energyStats.energy === 0 && !isPro ? "energy-empty" : ""}`}
            title={
              !serverEnergyReady
                ? "Проверяем серверный баланс энергии"
                : isPro
                  ? "PRO · энергия не ограничена"
                  : `Энергия ${energyStats.energy} из ${energyCap}${energyStats.nextAt ? ` · +1 через ${clockLabel(energyStats.nextAt - energyClock)}` : ""}`
            }
            data-track="energy-open"
            onClick={() => {
              setEnergyOpen(true);
              if (user) void refreshServerEnergy();
            }}
          >
            <span className="energy-bolt" aria-hidden="true">
              ⚡
            </span>
            <strong>
              {!serverEnergyReady ? "…" : isPro ? "PRO" : `${energyStats.energy}/${energyCap}`}
            </strong>
          </button>
          <button
            className="avatar"
            aria-label={user ? "Открыть личный кабинет" : "Открыть настройки профиля"}
            onClick={() => (user ? setAccountOpen(true) : setSettingsOpen(true))}
          >
            {(user?.name || preferences.name || "LP").slice(0, 2).toUpperCase()}
          </button>
        </header>
        {screen === "today" && (
          <Today
            modules={visibleModules}
            allCards={visibleCards}
            progress={progress}
            stats={stats}
            preferences={preferences}
            dueCount={dueCards.length}
            languageName={activeSpace.languageName}
            languageCode={activeSpace.languageCode}
            mission={dailyMission}
            missionDifficulty={missionDifficulty}
            avoidMicrophone={Boolean(learningPlan?.avoidMicrophone)}
            nextCourseUnit={nextCourseUnit}
            completedCourseUnits={completedCourseUnits}
            courseUnitCount={courseUnitCount}
            minutesToday={minutesToday}
            dailyMinutes={dailyGoalMinutes}
            onStartMission={() => {
              if (!dailyMission.cards.length) {
                setToast("Для этой миссии пока нет карточек.");
                return;
              }
              startSession(
                dailyMission.cards,
                "quick",
                dailyMission.title,
                dailyMission.cards.length,
                visibleCards,
              );
            }}
            onDifferentTopic={() => setAlternateMission((current) => !current)}
            onDifficulty={setMissionDifficulty}
            onAvoidMicrophone={(value) =>
              setLearningPlan((current) =>
                current ? { ...current, avoidMicrophone: value } : current,
              )
            }
            onContinue={() =>
              nextCourseUnit
                ? void startCourseUnit(nextCourseUnit)
                : startSession(
                    shuffled(visibleCards).slice(0, 10),
                    "quick",
                    "Повторение курса",
                    10,
                    visibleCards,
                  )
            }
            onCoursePath={() => setScreen("path")}
            onQuick={() =>
              startSession(
                shuffled(visibleCards).slice(0, 10),
                "quick",
                "2 минуты · текущий кабинет",
                10,
                visibleCards,
              )
            }
            onReview={startQuickReview}
            onPodcast={() => {
              if (guestMode) {
                onGuestGate?.();
                return;
              }
              if (!visibleCards.length) {
                setToast("В этом кабинете пока нет карточек.");
                return;
              }
              beginEnergyExercise();
              setPodcastCards(shuffled(dueCards.length ? dueCards : visibleCards).slice(0, 10));
            }}
            onRefresh={(module) => {
              const weak = module.cards.filter(
                (card) => !progress[card.id] || progress[card.id].level < 3,
              );
              startSession(weak, "test", `Освежить · ${module.title}`, undefined, module.cards);
            }}
            onGames={() => setScreen("games")}
            onLibrary={() => setScreen("library")}
          />
        )}
        {screen === "library" && (
          <Library
            modules={visibleModules}
            progress={progress}
            onReorder={moveModule}
            onCreate={() => setCreateOpen(true)}
            onFolders={() => setFoldersOpen(true)}
            onStart={(module) =>
              startSession(module.cards, "cards", module.title, undefined, module.cards)
            }
            onTest={(module) =>
              startSession(module.cards, "test", `Тест · ${module.title}`, undefined, module.cards)
            }
            onWrite={(module) =>
              startSession(
                module.cards,
                "write",
                `Написать перевод · ${module.title}`,
                undefined,
                module.cards,
              )
            }
            onCopyTestLink={async (module) =>
              setToast(
                (await copyAppLink(`library?module=${module.id}&mode=test`))
                  ? "Ссылка на тест скопирована"
                  : "Не удалось скопировать ссылку",
              )
            }
            onEdit={(module) => setEditingModule(module)}
            onDelete={deleteModule}
            onExport={(module) => {
              const text = module.cards
                .map(
                  (card) =>
                    `${card.article ? `${card.article} ` : ""}${card.word} ${card.transcription} - ${card.translation}`,
                )
                .join("\n");
              const link = document.createElement("a");
              link.href = URL.createObjectURL(
                new Blob([text], { type: "text/plain;charset=utf-8" }),
              );
              link.download = `${module.title.replace(/[^\p{L}\d]+/gu, "_")}.txt`;
              link.click();
              URL.revokeObjectURL(link.href);
              setToast("Словарь экспортирован в .txt");
            }}
            onGames={(module) => {
              setPreferredGameModuleId(module.id);
              setScreen("games");
            }}
            canManageContent={canManageContent}
          />
        )}
        {screen === "catalog" && (
          <Suspense fallback={<div className="lazy-section-loading">Открываем общий каталог…</div>}>
            <CatalogScreen
              languageCode={activeSpace.languageCode}
              level={activeSpace.level}
              canManageContent={canManageContent}
              legacyItems={[
                ...customModules.map((module) => ({
                  kind: "module",
                  languageCode: module.languageCode ?? activeSpace.languageCode,
                  level: module.level ?? activeSpace.level,
                  topic: "",
                  title: module.title,
                  body: { ...module, cards: module.cards },
                })),
                ...lessons.map((lesson) => ({
                  kind: "lesson",
                  languageCode: activeSpace.languageCode,
                  level: activeSpace.level,
                  topic: lesson.chapter,
                  title: lesson.title,
                  body: lesson as unknown as Record<string, unknown>,
                })),
                ...audioQuizzes.map((quiz) => ({
                  kind: "audio_quiz",
                  languageCode: quiz.languageCode,
                  level: quiz.level,
                  topic: "Аудирование",
                  title: quiz.title,
                  body: quiz as unknown as Record<string, unknown>,
                })),
              ]}
            />
          </Suspense>
        )}
        {screen === "path" &&
          (activeSpace.languageCode === "de" ? (
            <Suspense fallback={<div className="lazy-section-loading">Открываю курс…</div>}>
              <CoursePath
                level={activeSpace.level}
                progress={courseProgress}
                missions={courseMissions}
                goals={learningPlan?.goals ?? []}
                focus={learningPlan?.focus ?? []}
                onChooseLevel={selectCourseLevel}
                onStart={(unit) => void startCourseUnit(unit)}
              />
            </Suspense>
          ) : (
            <div className="page">
              <p className="eyebrow">ПОСЛЕДОВАТЕЛЬНЫЙ КУРС</p>
              <h1>Курс немецкого A1–C1</h1>
              <p>Учебная программа сейчас доступна для кабинета немецкого языка.</p>
              <button className="primary-button" onClick={() => selectCourseLevel("A1")}>
                Открыть курс немецкого <Icon name="arrow" />
              </button>
            </div>
          ))}
        {screen === "materials" && (
          <PathScreen
            modules={visibleModules}
            progress={progress}
            lessons={lessons}
            audioQuizzes={audioQuizzes}
            grammarTopics={GRAMMAR_TOPICS}
            pathSequences={pathSequences}
            pathCompletions={pathCompletions}
            onSaveSequence={(moduleId, sequence) =>
              setPathSequences((current) => ({ ...current, [moduleId]: sequence }))
            }
            canManageContent={canManageContent}
            onCreateLesson={(chapter) => setLessonDraft({ chapter })}
            onEditLesson={(lesson) => setLessonDraft({ chapter: lesson.chapter, lesson })}
            onDeleteLesson={(lesson) => {
              if (window.confirm(`Удалить урок «${lesson.title}»?`)) {
                setLessons((current) => current.filter((item) => item.id !== lesson.id));
                lesson.resources.forEach((resource) => {
                  if (resource.mediaId)
                    void removeMediaFile(resource.mediaId).catch(() => undefined);
                });
              }
            }}
            onCopyLessonLink={async (lesson) =>
              setToast(
                (await copyAppLink(`materials?lesson=${encodeURIComponent(lesson.id)}`))
                  ? "Ссылка на урок скопирована"
                  : "Не удалось скопировать ссылку",
              )
            }
            onOpenLesson={(lesson, nodeId) => {
              if (nodeId) {
                activePathRun.current = { nodeId, correct: 0, attempts: 0 };
                completePathNode();
              }
              setActiveLesson(lesson);
            }}
            onStart={(module, mode = "cards", nodeId) =>
              startSession(
                module.cards,
                mode,
                mode === "test" ? `Тест · ${module.title}` : module.title,
                undefined,
                module.cards,
                nodeId,
              )
            }
            onStartAudio={(quiz, nodeId) => {
              setGuestResultReady(false);
              beginEnergyExercise();
              activePathRun.current = nodeId ? { nodeId, correct: 0, attempts: 0 } : null;
              window.location.hash = `#/games?audio=${encodeURIComponent(quiz.id)}`;
            }}
            onStartGrammar={(topic, nodeId) => {
              beginEnergyExercise();
              setGuestResultReady(false);
              activePathRun.current = nodeId ? { nodeId, correct: 0, attempts: 0 } : null;
              setActiveGrammar(topic);
            }}
            onStartActivity={(activity, module, nodeId) =>
              openGame(
                activity.gameId,
                prepareGameModule(activity.gameId, {
                  ...module,
                  title: activity.title,
                  cards: activity.cards?.length
                    ? activity.cards
                    : module.cards.filter((card) => activity.cardIds.includes(card.id)),
                  practiceInstructions: activity.instructions,
                  practiceMedia: activity.media,
                }),
                `games?activity=${encodeURIComponent(activity.id)}`,
                nodeId,
              )
            }
            onManageGames={(moduleId) => {
              setPreferredGameModuleId(moduleId);
              setScreen("games");
            }}
          />
        )}
        {screen === "games" && (
          <Suspense fallback={<div className="lazy-section-loading">Открываю игры…</div>}>
            <GameHub
              key={activeSpace.id}
              modules={visibleModules}
              preferredModuleId={preferredGameModuleId}
              languageCode={activeSpace.languageCode}
              languageName={activeSpace.languageName}
              level={activeSpace.level}
              onStart={openGame}
              onGrammar={(topic) => {
                beginEnergyExercise();
                setGuestResultReady(false);
                setActiveGrammar(topic);
              }}
              onAddWords={() => setScreen("library")}
              onStartAudio={async () => {
                const allowed = guestMode ? await claimGuestActivity() : true;
                if (allowed) {
                  beginEnergyExercise();
                  setGuestResultReady(false);
                } else if (guestMode) onGuestGate?.();
                return allowed;
              }}
              onAudioRestart={async () => {
                if (guestMode && !(await claimGuestActivity())) {
                  onGuestGate?.();
                  return false;
                }
                beginEnergyExercise();
                setGuestResultReady(false);
                return true;
              }}
              onAudioAnswer={recordPractice}
              onAudioEvent={sendActivityEvent}
              audioQuizzes={audioQuizzes}
              onAudioQuizzesChange={setAudioQuizzes}
              canManageContent={canManageContent}
            />
          </Suspense>
        )}
        {screen === "stats" && (
          <StatsScreen
            modules={visibleModules}
            cards={visibleCards}
            progress={progress}
            stats={stats}
            confusions={confusions}
            courseProgress={courseProgress}
            onReviewMistakes={(cards) =>
              startSession(cards, "test", "Мои ошибки", undefined, visibleCards)
            }
          />
        )}
        {(screen === "admin" || screen === "analytics") && user?.role !== "owner" && (
          <section className="page restricted-page">
            <div>
              <p className="eyebrow">ЗАКРЫТЫЙ РАЗДЕЛ</p>
              <h1>{user ? "Нет доступа к админке" : "Войдите в аккаунт владельца"}</h1>
              <p>
                {user
                  ? "Для этого раздела нужны права владельца сайта."
                  : "После входа страница откроется, если у аккаунта есть права владельца сайта."}
              </p>
            </div>
          </section>
        )}
        {screen === "admin" && user?.role === "owner" && (
          <Suspense fallback={<div className="lazy-section-loading">Загружаю пользователей…</div>}>
            <AdminUsersScreen
              currentUser={user}
              onEnergyUpdated={(value, cap) => {
                setServerEnergyCap(cap);
                setServerEnergyUserId(user.id);
                setEnergy({
                  energy: value,
                  nextAt: value >= cap ? 0 : energyStats.nextAt,
                  version: 2,
                });
              }}
            />
          </Suspense>
        )}
        {screen === "analytics" && user?.role === "owner" && (
          <Suspense fallback={<div className="lazy-section-loading">Загружаю аналитику…</div>}>
            <AdminAnalyticsScreen />
          </Suspense>
        )}
      </main>
      {toast && (
        <div className="toast-message" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="Закрыть">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {guestMode && guestResultReady && (
        <div className="guest-result-save">
          <span>Результат сохранён на этом устройстве.</span>
          <button className="primary-button" onClick={() => onGuestGate?.()}>
            Сохранить прогресс в аккаунте
          </button>
        </div>
      )}
      {!learningPlan && (
        <Suspense fallback={null}>
          <CourseOnboarding
            onComplete={(plan) => {
              setLearningPlan(plan);
              selectCourseLevel(plan.level);
              setScreen("today");
            }}
            onSkip={() =>
              setLearningPlan({
                completed: true,
                goals: ["Для себя"],
                startingPoint: "new",
                level: "A1",
                minutesPerDay: 5,
                focus: [],
                interests: [],
                formats: ["Читать", "Слушать"],
                avoidMicrophone: false,
              })
            }
          />
        </Suspense>
      )}
      {createOpen && canManageContent && (
        <Suspense fallback={null}>
          <CreateModuleDialog
            onClose={() => setCreateOpen(false)}
            onCreate={createModule}
            languageName={activeSpace.languageName}
            level={activeSpace.level}
          />
        </Suspense>
      )}
      {editingModule && (
        <Suspense fallback={null}>
          <EditModuleDialog
            module={editingModule}
            onClose={() => setEditingModule(null)}
            onSave={(title, cards) => saveModule(editingModule, title, cards)}
          />
        </Suspense>
      )}
      {foldersOpen && (
        <Suspense fallback={null}>
          <MaterialFoldersDialog
            modules={visibleModules}
            lessons={lessons}
            grammarTopics={GRAMMAR_TOPICS}
            spaceId={activeSpace.id}
            languageCode={activeSpace.languageCode}
            level={activeSpace.level}
            onClose={() => setFoldersOpen(false)}
          />
        </Suspense>
      )}
      {spacesOpen && (
        <Suspense fallback={null}>
          <LearningSpaceDialog
            spaces={spaces}
            activeId={activeSpace.id}
            onSelect={(id) => setActiveSpaceId(id)}
            onCreate={(space) =>
              setSpaces((current) =>
                current.some(
                  (item) => item.languageCode === space.languageCode && item.level === space.level,
                )
                  ? current
                  : [...current, space],
              )
            }
            onClose={() => setSpacesOpen(false)}
          />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog
            value={preferences}
            speechSettings={speechSettings}
            languageCode={activeSpace.languageCode}
            authenticated={Boolean(user)}
            canManageSpeechProviders={canManageSpeechProviders}
            onClose={() => setSettingsOpen(false)}
            onSave={(value, speech) => {
              setPreferences({ ...value, name: value.name.trim() });
              setSpeechSettings(speech);
              setLegacyNameCleaned(true);
              setSettingsOpen(false);
              setToast("Настройки сохранены");
            }}
            onReset={() => {
              setProgress({});
              setCourseProgress({});
              setStats(defaultStats);
              setSettingsOpen(false);
              setToast("Прогресс слов и курса сброшен; материалы сохранены");
            }}
          />
        </Suspense>
      )}
      {streakOpen && (
        <Suspense fallback={null}>
          <StreakDialog
            streak={stats.streak}
            vacation={vacation}
            onToggleVacation={() => {
              setVacation((value) => !value);
              setToast(vacation ? "Режим отпуска выключен" : "Режим отпуска включён");
            }}
            onClose={() => setStreakOpen(false)}
          />
        </Suspense>
      )}
      {energyOpen && (
        <EnergyDialog
          energy={energyStats.energy}
          cap={energyCap}
          refillMs={serverEnergyRefillMs}
          nextAt={energyStats.nextAt}
          now={energyClock}
          isPro={isPro}
          ready={serverEnergyReady}
          onRefresh={() => void refreshServerEnergy()}
          onClose={() => setEnergyOpen(false)}
        />
      )}
      {lessonDraft && (
        <Suspense fallback={null}>
          <LessonDialog
            chapter={lessonDraft.chapter}
            initial={lessonDraft.lesson}
            modules={visibleModules}
            audioQuizzes={audioQuizzes}
            languageCode={activeSpace.languageCode}
            level={activeSpace.level}
            onClose={() => setLessonDraft(null)}
            onSave={(lesson) => {
              setLessons((current) =>
                current.some((item) => item.id === lesson.id)
                  ? current.map((item) => (item.id === lesson.id ? lesson : item))
                  : [...current, lesson],
              );
              setLessonDraft(null);
              setToast(`Урок «${lesson.title}» сохранён`);
            }}
          />
        </Suspense>
      )}
      {activeLesson && (
        <Suspense fallback={null}>
          <LessonViewer
            lesson={activeLesson}
            onClose={() => setActiveLesson(null)}
            onStartResource={(resource: LessonResource) => {
              if (resource.kind === "audioQuiz" && resource.audioQuizId) {
                setActiveLesson(null);
                window.location.hash = `#/games?audio=${encodeURIComponent(resource.audioQuizId)}`;
                return;
              }
              const module = visibleModules.find((item) => item.id === resource.moduleId);
              setActiveLesson(null);
              if (!module) {
                setToast("Модуль этого задания больше недоступен в текущем кабинете.");
                return;
              }
              if (resource.kind === "test")
                startSession(
                  module.cards,
                  "test",
                  `Тест · ${module.title}`,
                  undefined,
                  module.cards,
                );
              else if (resource.kind === "game" && resource.gameId)
                openGame(resource.gameId, prepareGameModule(resource.gameId, module));
            }}
          />
        </Suspense>
      )}
      {user && accountOpen && (
        <AccountPanel
          user={user}
          onClose={() => setAccountOpen(false)}
          onSignOut={onSignOut}
          onAccountDeleted={onSignOut}
        />
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<"checking" | "local" | "login" | "active" | "error">("checking");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [guestPrompt, setGuestPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setMode("checking");
    setError("");
    void fetch("/api/auth/get-session", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (response.status === 404 || !contentType.includes("application/json")) {
          if (import.meta.env.DEV) {
            if (alive) setMode("local");
            return;
          }
          throw new Error("Служба аккаунтов недоступна. Обновите страницу или попробуйте позже.");
        }
        if (!response.ok)
          throw new Error(
            "Не удалось подключиться к службе аккаунтов. Проверьте настройки сервера и базы данных.",
          );
        const result = (await response.json()) as { user?: AccountUser } | null;
        if (result?.user) {
          const profilePromise = fetch("/api/profile", {
            credentials: "include",
            cache: "no-store",
          });
          await activateProfileStorage(result.user.id);
          void migrateLocalMediaToProfile(result.user.id).catch(() => undefined);
          const profileResponse = await profilePromise;
          const profile = profileResponse.ok
            ? ((await profileResponse.json()) as Pick<
                AccountUser,
                "role" | "permissions" | "isPro" | "proStartsAt" | "proEndsAt"
              >)
            : {};
          if (alive) {
            setUser({ ...result.user, ...profile });
            setMode("active");
          }
        } else if (alive) {
          const trialResponse = await fetch("/api/guest-trial", {
            credentials: "include",
            cache: "no-store",
          });
          if (!trialResponse.ok)
            throw new Error("Не удалось проверить пробный доступ. Попробуйте ещё раз.");
          const trial = (await trialResponse.json()) as { eligible?: unknown };
          if (typeof trial.eligible !== "boolean")
            throw new Error("Служба пробного доступа вернула неверный ответ.");
          const eligible = trial.eligible;
          if (alive) {
            setGuestPrompt(!eligible);
            setMode("login");
          }
        }
      })
      .catch((cause: unknown) => {
        if (alive) {
          setError(cause instanceof Error ? cause.message : "Не удалось загрузить кабинет.");
          setMode("error");
        }
      });
    return () => {
      alive = false;
    };
  }, [retry]);

  const authenticate = async (credentials: Credentials) => {
    setBusy(true);
    setError("");
    try {
      const result =
        credentials.mode === "sign-in"
          ? await authClient.signIn.email({
              email: credentials.email,
              password: credentials.password,
            })
          : await authClient.signUp.email({
              name: credentials.name,
              email: credentials.email,
              password: credentials.password,
            });
      if (result.error) throw new Error(result.error.message);
      if (credentials.mode === "sign-in") {
        setMode("checking");
        setRetry((value) => value + 1);
      }
      return true;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Не удалось войти. Проверьте данные и попробуйте ещё раз.";
      setError(
        /invalid email or password/i.test(message)
          ? "Почта или пароль неверны. Если пароль забыли, нажмите «Забыли пароль?» — мы отправим ссылку на почту."
          : /email.*not.*verified|not.*verified/i.test(message)
            ? "Сначала подтвердите почту по ссылке из письма. Если письма нет, попробуйте войти ещё раз, чтобы отправить его повторно."
            : message,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const requestPasswordReset = async (email: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (result.error) throw new Error(result.error.message);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось отправить письмо. Попробуйте ещё раз.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const resetPassword = async (token: string, password: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) throw new Error(result.error.message);
      window.history.replaceState(null, "", `${window.location.pathname}#/`);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Ссылка сброса устарела. Запросите новое письмо.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    await authClient.signOut();
    deactivateProfileStorage();
    setUser(null);
    setMode("login");
  };

  if (mode === "checking")
    return (
      <main className="account-loading">
        <span className="account-spinner" />
        <strong>Загружаю ваш кабинет…</strong>
      </main>
    );
  if (mode === "local")
    return <WorkspaceApp key="local-cabinet" user={null} onSignOut={() => undefined} />;
  if (mode === "active" && user)
    return <WorkspaceApp key={user.id} user={user} onSignOut={() => void signOut()} />;
  if (mode === "login" && !guestPrompt && !["admin", "analytics"].includes(screenFromHash()))
    return (
      <WorkspaceApp
        key="guest-cabinet"
        user={null}
        guestMode
        onGuestGate={() => setGuestPrompt(true)}
        onSignOut={() => undefined}
      />
    );
  return (
    <AuthScreen
      key={guestPrompt ? "guest-prompt" : "auth"}
      error={error}
      busy={busy}
      onSubmit={authenticate}
      onRequestPasswordReset={requestPasswordReset}
      onResetPassword={resetPassword}
      startView={guestPrompt ? "sign-up" : "sign-in"}
      guestRequired={guestPrompt}
      onRetry={() => {
        setError("");
        setRetry((value) => value + 1);
      }}
    />
  );
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <img src="/clickling-panda.png" alt="" />
    </span>
  );
}

function EnergyDialog({
  energy,
  cap,
  refillMs,
  nextAt,
  now,
  isPro,
  ready,
  onRefresh,
  onClose,
}: {
  energy: number;
  cap: number;
  refillMs: number;
  nextAt: number;
  now: number;
  isPro: boolean;
  ready: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const remaining = Math.max(0, nextAt - now);
  const progress =
    energy >= cap || !nextAt ? 100 : Math.max(0, Math.min(100, 100 - (remaining / refillMs) * 100));
  const refillMinutes = Math.round(refillMs / 60_000);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog-card energy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="energy-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        <span className="energy-dialog-mark">⚡</span>
        <p className="eyebrow">ЭНЕРГИЯ</p>
        <h2 id="energy-title">
          {!ready ? "Проверяем баланс…" : isPro ? "Играй без ограничений" : `${energy}/${cap}`}
        </h2>
        {!ready ? (
          <>
            <p>Подключаем серверный баланс энергии.</p>
            <button className="secondary-button" onClick={onRefresh}>
              Проверить ещё раз
            </button>
          </>
        ) : isPro ? (
          <p>PRO · энергия не расходуется.</p>
        ) : (
          <>
            <div className="energy-capacity-meter" aria-label={`${energy} из ${cap} энергии`}>
              <i style={{ width: `${Math.min(100, (energy / cap) * 100)}%` }} />
            </div>
            <p>{energy >= cap ? "Запас полный" : `+1 через ${clockLabel(remaining)}`}</p>
            <div className="energy-timer-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <small className="energy-refill-note">
              Энергия сама восстанавливается: +1 каждые {refillMinutes} мин.
            </small>
          </>
        )}
      </section>
    </div>
  );
}

function Sidebar({
  screen,
  languageSpace,
  canManageUsers,
  canManageContent,
  onSettings,
  onLanguage,
}: {
  screen: Screen;
  languageSpace: LearningSpace;
  canManageUsers: boolean;
  canManageContent: boolean;
  onSettings: () => void;
  onLanguage: () => void;
}) {
  const nav: { id: Screen; label: string; icon: IconName }[] = [
    { id: "today", label: "Сегодня", icon: "home" },
    { id: "library", label: "Библиотека слов", icon: "library" },
    { id: "catalog", label: "Каталог", icon: "book" },
    { id: "path", label: "Учебный путь", icon: "path" },
    {
      id: "materials",
      label: canManageContent ? "Конструктор заданий" : "Учебные материалы",
      icon: "folder",
    },
    { id: "games", label: "Игры и упражнения", icon: "game" },
    { id: "stats", label: "Прогресс", icon: "chart" },
  ];
  if (canManageUsers)
    nav.push(
      { id: "admin", label: "Пользователи", icon: "settings" },
      { id: "analytics", label: "Аналитика", icon: "chart" },
    );
  return (
    <aside className="sidebar">
      <div className="brand">
        <LogoMark />
        <span>ClickLing</span>
      </div>
      <nav aria-label="Разделы приложения">
        {nav.map((item) => (
          <a
            key={item.id}
            href={`#/${item.id}`}
            data-track={`nav-${item.id}`}
            className={screen === item.id ? "active" : ""}
            aria-current={screen === item.id ? "page" : undefined}
            title={item.label}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="language-card"
          onClick={onLanguage}
          aria-label="Сменить язык или уровень"
          title={`${languageSpace.languageName} · ${languageSpace.level}`}
        >
          <span className="flag">{languageSpace.flag}</span>
          <span>
            <strong>{languageSpace.languageName}</strong>
            <small>Уровень {languageSpace.level}</small>
          </span>
          <Icon name="chevron" size={16} />
        </button>
        <button className="settings-button" data-track="settings-open" onClick={onSettings}>
          <Icon name="settings" />
          <span>Настройки</span>
        </button>
      </div>
    </aside>
  );
}

function Today({
  modules,
  allCards,
  progress,
  stats,
  preferences,
  dueCount,
  languageName,
  languageCode,
  mission,
  missionDifficulty,
  avoidMicrophone,
  nextCourseUnit,
  completedCourseUnits,
  courseUnitCount,
  minutesToday,
  dailyMinutes,
  onStartMission,
  onDifferentTopic,
  onDifficulty,
  onAvoidMicrophone,
  onContinue,
  onCoursePath,
  onQuick,
  onReview,
  onPodcast,
  onRefresh,
  onGames,
  onLibrary,
}: {
  modules: VocabModule[];
  allCards: VocabCard[];
  progress: Record<string, CardProgress>;
  stats: UserStats;
  preferences: Preferences;
  dueCount: number;
  languageName: string;
  languageCode: string;
  mission: { cards: VocabCard[]; title: string; explanation: string; durationMinutes: number };
  missionDifficulty: MissionDifficulty;
  avoidMicrophone: boolean;
  nextCourseUnit?: CourseUnit;
  completedCourseUnits: number;
  courseUnitCount: number;
  minutesToday: number;
  dailyMinutes: number;
  onStartMission: () => void;
  onDifferentTopic: () => void;
  onDifficulty: (value: MissionDifficulty) => void;
  onAvoidMicrophone: (value: boolean) => void;
  onContinue: () => void;
  onCoursePath: () => void;
  onQuick: () => void;
  onReview: () => void;
  onPodcast: () => void;
  onRefresh: (module: VocabModule) => void;
  onGames: () => void;
  onLibrary: () => void;
}) {
  const hello: Record<string, string> = {
    de: "Guten Morgen",
    en: "Good morning",
    fr: "Bonjour",
    es: "Buenos días",
    ru: "Доброе утро",
  };
  const greeting = preferences.name.trim()
    ? `${hello[languageCode] ?? "Здравствуйте"}, ${preferences.name.trim()}`
    : `${hello[languageCode] ?? "Здравствуйте"}!`;
  if (!modules.length)
    return (
      <div className="page today-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ПЕРСОНАЛЬНЫЙ ПЛАН · ЦЕЛЬ {dailyMinutes} МИНУТ В ДЕНЬ</p>
            <h1>{greeting}</h1>
            <p>Сегодня можно продолжить обучение по шагам.</p>
          </div>
        </div>
        {nextCourseUnit && (
          <section className="course-today-card">
            <div>
              <span className="eyebrow">НЕМЕЦКИЙ · СЛЕДУЮЩИЙ ЮНИТ</span>
              <h2>{nextCourseUnit.title}</h2>
              <p>{nextCourseUnit.outcome}</p>
              <small>
                {completedCourseUnits} из {courseUnitCount} юнитов · сегодня {minutesToday} из{" "}
                {dailyMinutes} минут
              </small>
              <div className="lesson-progress">
                <span
                  style={{
                    width: `${Math.min(100, (minutesToday * 100) / Math.max(1, dailyMinutes))}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <button className="primary-button" onClick={onContinue}>
                Начать занятие <Icon name="arrow" />
              </button>
              <button className="text-button" onClick={onCoursePath}>
                Посмотреть программу
              </button>
            </div>
          </section>
        )}
        <div className="empty-state cabinet-empty">
          <Icon name="library" size={32} />
          <h2>{languageName} · словарь пока пуст</h2>
          <p>
            Учебный курс можно проходить независимо от библиотеки. Добавьте слова, чтобы отдельно
            тренировать карточки и игры.
          </p>
          <button className="secondary-button" onClick={onLibrary}>
            Открыть библиотеку
          </button>
        </div>
      </div>
    );
  const candidates = modules.filter((module) => module.id >= 20 && module.id <= 22);
  const activeModules = candidates.length ? candidates : modules.slice(-3);
  const today = localDay();
  const date = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <div className="page today-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{date.toLocaleUpperCase()}</p>
          <h1>{greeting}</h1>
          <p>Продолжайте с того места, где остановились.</p>
        </div>
        <div className="goal-summary">
          <div
            className="goal-ring"
            title="Дневная цель: минуты активной практики"
            style={
              {
                "--goal": `${Math.min(100, (minutesToday / dailyMinutes) * 100)}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{minutesToday}</strong>
              <span>из {dailyMinutes} мин</span>
            </div>
          </div>
          <small>
            {minutesToday >= dailyMinutes
              ? "Цель выполнена!"
              : `Осталось ${Math.max(0, dailyMinutes - minutesToday)} мин`}
          </small>
        </div>
      </div>
      <section className="daily-mission-card">
        <div>
          <span className="eyebrow">
            ПЕРСОНАЛЬНЫЙ ВЫБОР · ОКОЛО {mission.durationMinutes} МИНУТ
          </span>
          <h2>{mission.title}</h2>
          <p>{mission.explanation}</p>
          <small>{mission.cards.length} заданий · сначала повтор, затем слова по вашей цели</small>
        </div>
        <div className="daily-mission-actions">
          <button
            className="primary-button"
            disabled={!mission.cards.length}
            onClick={onStartMission}
          >
            Начать миссию <Icon name="arrow" size={17} />
          </button>
          <div className="mission-adjustments">
            <button
              className={missionDifficulty === "easier" ? "active" : ""}
              onClick={() => onDifficulty(missionDifficulty === "easier" ? "balanced" : "easier")}
            >
              Проще
            </button>
            <button
              className={missionDifficulty === "harder" ? "active" : ""}
              onClick={() => onDifficulty(missionDifficulty === "harder" ? "balanced" : "harder")}
            >
              Сложнее
            </button>
            <button onClick={onDifferentTopic}>Другая тема</button>
          </div>
          <label className="mission-mic-toggle">
            <input
              type="checkbox"
              checked={avoidMicrophone}
              onChange={(event) => onAvoidMicrophone(event.target.checked)}
            />{" "}
            Без микрофона
          </label>
        </div>
      </section>
      {nextCourseUnit ? (
        <section className="course-today-card">
          <div>
            <span className="eyebrow">ПРОДОЛЖИТЬ ПУТЬ · {nextCourseUnit.level}</span>
            <h2>{nextCourseUnit.title}</h2>
            <p>{nextCourseUnit.outcome}</p>
            <small>
              {completedCourseUnits} из {courseUnitCount} юнитов · сегодня {minutesToday} из{" "}
              {dailyMinutes} минут
            </small>
            <div className="lesson-progress">
              <span
                style={{
                  width: `${Math.min(100, (minutesToday * 100) / Math.max(1, dailyMinutes))}%`,
                }}
              />
            </div>
          </div>
          <button className="primary-button" onClick={onContinue}>
            Начать занятие <Icon name="arrow" size={18} />
          </button>
        </section>
      ) : (
        <section className="continue-card">
          <div className="continue-glow" />
          <div className="continue-content">
            <span className="section-badge">
              <Icon name="spark" size={15} /> СЛОВАРЬ И ПОВТОРЕНИЕ
            </span>
            <h2>Повторите знакомые слова</h2>
            <p>
              {dueCount
                ? `${dueCount} слов готовы к повторению`
                : "Подборка карточек из выбранного кабинета"}
            </p>
            <div className="lesson-progress">
              <span style={{ width: `${Math.min(100, (minutesToday / dailyMinutes) * 100)}%` }} />
            </div>
            <button className="primary-button" onClick={onContinue}>
              Продолжить <Icon name="arrow" size={18} />
            </button>
          </div>
          <div className="word-orbit" aria-hidden="true">
            <span className="word-chip chip-one">neben</span>
            <span className="word-chip chip-two">unter</span>
            <span className="word-chip chip-three">auf</span>
            <div className="orbit-card">
              <div className="mini-window">
                <i />
                <i />
              </div>
              <div className="mini-table" />
              <div className="mini-lamp" />
              <div className="mini-rug" />
            </div>
          </div>
        </section>
      )}
      <div className="quick-grid">
        <button className="quick-card" onClick={onQuick}>
          <span className="quick-icon blue">
            <Icon name="clock" />
          </span>
          <span>
            <strong>2 минуты · {languageName}</strong>
            <small>Быстрый урок только по этому кабинету</small>
          </span>
          <Icon name="chevron" className="quick-chevron" />
        </button>
        <button className="quick-card" onClick={onReview}>
          <span className="quick-icon violet">
            <Icon name="refresh" />
          </span>
          <span>
            <strong>Повторение дня</strong>
            <small>{dueCount ? `${dueCount} слов ждут вас` : "Пока нет слов к повторению"}</small>
          </span>
          <span className="count-badge">{dueCount}</span>
          <Icon name="chevron" className="quick-chevron" />
        </button>
        <button className="quick-card" onClick={onPodcast}>
          <span className="quick-icon dark">
            <Icon name="headphones" />
          </span>
          <span>
            <strong>Аудиопрактика</strong>
            <small>Озвучка в выбранных языках</small>
          </span>
          <Icon name="chevron" className="quick-chevron" />
        </button>
      </div>
      <section className="memory-section">
        <div className="section-title">
          <div>
            <h2>Запас прочности</h2>
            <p>Уровень закрепления по модулям</p>
          </div>
          <button onClick={onLibrary}>
            Все модули <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="memory-grid">
          {activeModules.map((module, index) => {
            const learned = module.cards.filter(
              (card) => (progress[card.id]?.level ?? 0) >= 2,
            ).length;
            const value = module.cards.length
              ? Math.round((learned / module.cards.length) * 100)
              : 0;
            return (
              <article className="memory-card" key={module.id}>
                <div className="memory-head">
                  <span className={`module-symbol ${["blue", "violet", "teal"][index % 3]}`}>
                    <Icon name={index === 0 ? "home" : index === 1 ? "book" : "library"} />
                  </span>
                  <button
                    aria-label={`Практика: ${module.title}`}
                    onClick={() => onRefresh(module)}
                  >
                    <Icon name="more" />
                  </button>
                </div>
                <h3>{module.title}</h3>
                <p>
                  {module.cards.length} слов · Модуль {module.id}
                </p>
                <div className="memory-score">
                  <strong>{value}%</strong>
                  <span>{value ? "Закреплено" : "Ещё не изучены"}</span>
                </div>
                <div className={`memory-bar ${value < 35 ? "low" : value < 75 ? "medium" : ""}`}>
                  <span style={{ width: `${value}%` }} />
                </div>
                <button className="refresh-button" onClick={() => onRefresh(module)}>
                  Освежить <Icon name="arrow" size={16} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <button className="games-banner" onClick={onGames}>
        <span>
          <Icon name="game" />
        </span>
        <strong>Закрепите слова в игре</strong>
        <small>16 игровых механик · упражнения A1–A2</small>
        <Icon name="arrow" />
      </button>
      <p className="today-content-count">
        В словаре {allCards.length} карточек в {modules.length} модулях.
      </p>
    </div>
  );
}

function Library({
  modules,
  progress,
  onReorder,
  onCreate,
  onFolders,
  onStart,
  onTest,
  onWrite,
  onCopyTestLink,
  onEdit,
  onDelete,
  onExport,
  onGames,
  canManageContent,
}: {
  modules: VocabModule[];
  progress: Record<string, CardProgress>;
  onReorder: (from: number, to: number) => void;
  onCreate: () => void;
  onFolders: () => void;
  onStart: (module: VocabModule) => void;
  onTest: (module: VocabModule) => void;
  onWrite: (module: VocabModule) => void;
  onCopyTestLink: (module: VocabModule) => void;
  onEdit: (module: VocabModule) => void;
  onDelete: (module: VocabModule) => void;
  onExport: (module: VocabModule) => void;
  onGames: (module: VocabModule) => void;
  canManageContent: boolean;
}) {
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "learned">("all");
  const [sortBy, setSortBy] = useState<"manual" | "module" | "title" | "cards" | "progress">(
    "manual",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const draggedModule = useRef<number | null>(null);
  useEffect(() => {
    if (openMenu === null) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest(".module-actions-menu, .module-menu-trigger")
      )
        setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);
  const filtered = modules.filter((module) => {
    const found =
      `${module.title} ${module.cards.map((card) => `${card.word} ${card.translation}`).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const hasNew = module.cards.some((card) => !progress[card.id] || progress[card.id].level === 0);
    const hasLearned = module.cards.some((card) => (progress[card.id]?.level ?? 0) >= 2);
    return found && (filter === "all" || (filter === "new" ? hasNew : hasLearned));
  });
  const visible = [...filtered].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortBy === "module")
      return direction * (a.id - b.id || a.title.localeCompare(b.title, "ru"));
    if (sortBy === "title") return direction * a.title.localeCompare(b.title, "ru");
    if (sortBy === "cards") return direction * (a.cards.length - b.cards.length || a.id - b.id);
    if (sortBy === "progress") {
      const progressOf = (module: VocabModule) =>
        module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length /
        Math.max(1, module.cards.length);
      return direction * (progressOf(a) - progressOf(b) || a.id - b.id);
    }
    return modules.indexOf(a) - modules.indexOf(b);
  });
  return (
    <div className="page">
      <div className="library-heading">
        <div>
          <p className="eyebrow">ВАШИ МАТЕРИАЛЫ</p>
          <h1>Библиотека</h1>
          <p>
            {modules.length} модулей ·{" "}
            {modules.reduce((sum, module) => sum + module.cards.length, 0)} карточек
          </p>
        </div>
        <div className="library-heading-actions">
          <button className="secondary-button compact" onClick={onFolders}>
            <Icon name="folder" size={17} /> Папки материалов
          </button>
          {canManageContent && (
            <button className="primary-button compact" onClick={onCreate}>
              <Icon name="plus" size={18} /> Создать / импортировать
            </button>
          )}
        </div>
      </div>
      <div className="library-tools">
        <label className="search-box">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по словам и модулям"
          />
        </label>
        <label className="library-filter-label">
          Показать
          <select
            aria-label="Фильтр модулей"
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | "new" | "learned")}
          >
            <option value="all">Все модули</option>
            <option value="new">Есть новые карточки</option>
            <option value="learned">Есть закреплённые</option>
          </select>
          <span>{visible.length}</span>
        </label>
        <div className="library-sort-control">
          <label className="library-filter-label">
            Сортировка
            <select
              aria-label="Сортировка модулей"
              value={sortBy}
              onChange={(event) => {
                const next = event.target.value as typeof sortBy;
                setSortBy(next);
                if (next === "cards" || next === "progress") setSortDirection("desc");
                else setSortDirection("asc");
              }}
            >
              <option value="manual">Мой порядок</option>
              <option value="module">По модулю</option>
              <option value="title">По названию</option>
              <option value="cards">По числу карточек</option>
              <option value="progress">По прогрессу</option>
            </select>
          </label>
          <button
            className="sort-direction-button"
            type="button"
            aria-label="Изменить направление сортировки"
            title="Изменить направление сортировки"
            disabled={sortBy === "manual"}
            onClick={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
          >
            <Icon name="filter" size={17} />
            <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
          </button>
        </div>
      </div>
      {sortBy === "manual" && (
        <p className="library-sort-hint">
          Порядок можно менять перетаскиванием карточек модулей или в меню модуля: «Переместить выше
          / ниже».
        </p>
      )}
      {visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="search" size={28} />
          <h2>{search ? "Ничего не найдено" : "В этом кабинете пока нет модулей"}</h2>
          <p>
            {search
              ? "Измените запрос или сбросьте фильтр."
              : "Создайте модуль или импортируйте слова для выбранного языка и уровня."}
          </p>
          {search ? (
            <button className="secondary-button" onClick={() => setSearch("")}>
              Сбросить поиск
            </button>
          ) : (
            canManageContent && (
              <button className="primary-button" onClick={onCreate}>
                <Icon name="plus" /> Создать первый модуль
              </button>
            )
          )}
        </div>
      ) : (
        <div className="module-grid">
          {visible.map((module, index) => {
            const mastered = module.cards.filter(
              (card) => (progress[card.id]?.level ?? 0) >= 2,
            ).length;
            const percent = module.cards.length
              ? Math.round((mastered / module.cards.length) * 100)
              : 0;
            return (
              <article
                className="module-card-shell"
                key={module.id}
                draggable
                onDragStart={(event) => {
                  draggedModule.current = module.id;
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = draggedModule.current;
                  if (from !== null) onReorder(from, module.id);
                  draggedModule.current = null;
                }}
                onDragEnd={() => {
                  draggedModule.current = null;
                }}
              >
                <button className="module-card" onClick={() => onStart(module)}>
                  <div
                    className={`module-cover ${["blue", "violet", "teal", "amber", "rose"][index % 5]}`}
                  >
                    <span>{String(module.id).padStart(2, "0")}</span>
                    <Icon
                      name={index % 3 === 0 ? "spark" : index % 3 === 1 ? "book" : "path"}
                      size={30}
                    />
                  </div>
                  <div className="module-info">
                    <div>
                      <span>
                        МОДУЛЬ {module.id}
                        {module.custom ? " · МОЙ" : ""}
                      </span>
                      <span
                        className="module-drag-grip"
                        title="Перетащите модуль, чтобы изменить порядок"
                      >
                        ⠿
                      </span>
                      <Icon name="arrow" size={15} />
                    </div>
                    <h3>{module.title}</h3>
                    <p>
                      {module.cards.length} карточек · {module.level}
                    </p>
                    <div className="module-progress">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </button>
                <button
                  className="module-menu-trigger"
                  aria-label={`Действия модуля ${module.title}`}
                  aria-expanded={openMenu === module.id}
                  onClick={() => setOpenMenu((value) => (value === module.id ? null : module.id))}
                >
                  <Icon name="more" size={17} />
                </button>
                {openMenu === module.id && (
                  <div className="module-actions-menu">
                    <button
                      onClick={() => {
                        setOpenMenu(null);
                        onTest(module);
                      }}
                    >
                      Тест по модулю
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenu(null);
                        onCopyTestLink(module);
                      }}
                    >
                      Ссылка на тест
                    </button>
                    <button
                      title="Письменная тренировка по словам этого модуля. Слова и переводы меняются в редакторе карточек."
                      onClick={() => {
                        setOpenMenu(null);
                        onWrite(module);
                      }}
                    >
                      Тренировка: написать перевод
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenu(null);
                        onGames(module);
                      }}
                    >
                      Игры и упражнения
                    </button>
                    {canManageContent && (
                      <button
                        onClick={() => {
                          setOpenMenu(null);
                          onEdit(module);
                        }}
                      >
                        Изменить карточки и порядок
                      </button>
                    )}
                    <button
                      disabled={index === 0}
                      onClick={() => {
                        setOpenMenu(null);
                        if (visible[index - 1]) onReorder(module.id, visible[index - 1].id);
                      }}
                    >
                      Переместить выше
                    </button>
                    <button
                      disabled={index === visible.length - 1}
                      onClick={() => {
                        setOpenMenu(null);
                        if (visible[index + 1]) onReorder(module.id, visible[index + 1].id);
                      }}
                    >
                      Переместить ниже
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenu(null);
                        onExport(module);
                      }}
                    >
                      Экспортировать словарь .txt
                    </button>
                    {canManageContent && (
                      <button
                        className="text-danger"
                        onClick={() => {
                          setOpenMenu(null);
                          onDelete(module);
                        }}
                      >
                        Удалить модуль
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PathScreen({
  modules,
  progress,
  lessons,
  audioQuizzes,
  grammarTopics,
  pathSequences,
  pathCompletions,
  onSaveSequence,
  canManageContent,
  onCreateLesson,
  onEditLesson,
  onDeleteLesson,
  onCopyLessonLink,
  onOpenLesson,
  onStart,
  onStartActivity,
  onStartAudio,
  onStartGrammar,
  onManageGames,
}: {
  modules: VocabModule[];
  progress: Record<string, CardProgress>;
  lessons: Lesson[];
  audioQuizzes: AudioQuiz[];
  grammarTopics: GrammarTopic[];
  pathSequences: Record<number, PathNode[]>;
  pathCompletions: Record<string, PathCompletion>;
  onSaveSequence: (moduleId: number, sequence: PathNode[]) => void;
  canManageContent: boolean;
  onCreateLesson: (chapter: string) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onCopyLessonLink: (lesson: Lesson) => void;
  onOpenLesson: (lesson: Lesson, nodeId?: string) => void;
  onStart: (module: VocabModule, mode?: "cards" | "test", nodeId?: string) => void;
  onStartActivity: (activity: PathActivity, module: VocabModule, nodeId?: string) => void;
  onStartAudio: (quiz: AudioQuiz, nodeId: string) => void;
  onStartGrammar: (topic: GrammarTopic, nodeId: string) => void;
  onManageGames: (moduleId: number) => void;
}) {
  const [activities, setActivities] = useState<PathActivity[]>(() => {
    try {
      const value = JSON.parse(readProfileItem("linguaplay-saved-activities") || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const [customGrammar] = useState<GrammarTopic[]>(() => {
    try {
      const value = JSON.parse(readProfileItem("linguaplay-custom-grammar") || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [selectionByModule, setSelectionByModule] = useState<Record<number, string>>({});
  useEffect(() => {
    writeProfileItem("linguaplay-saved-activities", JSON.stringify(activities));
  }, [activities]);
  const deletePathActivity = (activity: PathActivity) => {
    setActivities((current) => current.filter((item) => item.id !== activity.id));
    if (activity.media?.id) void removeMediaFile(activity.media.id).catch(() => undefined);
  };
  const chapters = [
    {
      title: "Первые разговоры",
      subtitle: "Местоимения, sein, haben и простые вопросы",
      from: 1,
      to: 4,
    },
    { title: "Время и планы", subtitle: "Числа, календарь, частота и поездки", from: 5, to: 8 },
    { title: "Люди вокруг", subtitle: "Семья, друзья, характер и эмоции", from: 9, to: 11 },
    { title: "Городская жизнь", subtitle: "Дорога, покупки, кафе и транспорт", from: 12, to: 18 },
    { title: "Мой дом", subtitle: "Комнаты, предметы, расположение и быт", from: 19, to: 23 },
    { title: "Дела и работа", subtitle: "Досуг, здоровье, профессии и задачи", from: 24, to: 29 },
    {
      title: "Вокруг нас",
      subtitle: "Учёба, документы, одежда, погода и природа",
      from: 30,
      to: 34,
    },
    { title: "Немецкий для IT", subtitle: "Технологии, данные и аналитика", from: 35, to: 39 },
    { title: "Путешествия", subtitle: "Аэропорт, отель, ресторан и отпуск", from: 200, to: 203 },
    {
      title: "Профессии и собеседования",
      subtitle: "Практика для медсестры и программиста",
      from: 204,
      to: 205,
    },
  ]
    .map((chapter) => ({
      ...chapter,
      modules: modules.filter((module) => module.id >= chapter.from && module.id <= chapter.to),
    }))
    .filter((chapter) => chapter.modules.length);
  const customModules = modules.filter((module) => module.custom || module.id >= 1000);
  if (customModules.length)
    chapters.push({
      title: "Мои главы",
      subtitle: "Созданные вами словари и карточки",
      from: 1000,
      to: 99999,
      modules: customModules,
    });
  const availableGrammar = [...grammarTopics, ...customGrammar].filter(
    (topic, index, all) => all.findIndex((item) => item.id === topic.id) === index,
  );
  const nodeLabels: Record<PathNode["kind"], string> = {
    cards: "Карточки",
    test: "Тест",
    game: "Игра",
    audio: "Аудио",
    grammar: "Грамматика",
    lesson: "Лекция",
  };
  const nodeMark: Record<PathNode["kind"], string> = {
    cards: "▣",
    test: "✓",
    game: "✦",
    audio: "♫",
    grammar: "Aa",
    lesson: "▤",
  };
  const uniqueId = () => `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const makeDefaultSequence = (module: VocabModule, chapterTitle: string) => {
    const isFirstModuleInChapter =
      module === chapters.find((item) => item.title === chapterTitle)?.modules[0];
    const sequence: PathNode[] = [
      { id: `path-${module.id}-cards`, kind: "cards" },
      { id: `path-${module.id}-test`, kind: "test" },
      ...activities
        .filter(
          (item) =>
            item.moduleId === module.id &&
            item.languageCode === module.languageCode &&
            item.level === module.level,
        )
        .map((item) => ({
          id: `path-${module.id}-game-${item.id}`,
          kind: "game" as const,
          targetId: item.id,
        })),
      ...audioQuizzes
        .filter((item) => item.languageCode === module.languageCode && item.level === module.level)
        .map((item) => ({
          id: `path-${module.id}-audio-${item.id}`,
          kind: "audio" as const,
          targetId: item.id,
        })),
      ...(isFirstModuleInChapter
        ? availableGrammar
            .filter(
              (item) =>
                (item.languageCode ?? "de") === module.languageCode &&
                (item.level ?? module.level) === module.level,
            )
            .map((item) => ({
              id: `path-${module.id}-grammar-${item.id}`,
              kind: "grammar" as const,
              targetId: item.id,
            }))
        : []),
    ];
    if (isFirstModuleInChapter) {
      sequence.push(
        ...lessons
          .filter((item) => item.chapter === chapterTitle)
          .map((item) => ({
            id: `path-${module.id}-lesson-${item.id}`,
            kind: "lesson" as const,
            targetId: item.id,
          })),
      );
    }
    return sequence;
  };
  const getSequence = (module: VocabModule, chapterTitle: string) =>
    pathSequences[module.id] ?? makeDefaultSequence(module, chapterTitle);
  const titleForNode = (node: PathNode, module: VocabModule, chapterTitle: string) => {
    if (node.kind === "cards") return `Карточки · ${module.title}`;
    if (node.kind === "test") return `Тест · ${module.title}`;
    if (node.kind === "game")
      return activities.find((item) => item.id === node.targetId)?.title ?? "Игра удалена";
    if (node.kind === "audio")
      return audioQuizzes.find((item) => item.id === node.targetId)?.title ?? "Аудиотест удалён";
    if (node.kind === "grammar")
      return availableGrammar.find((item) => item.id === node.targetId)?.title ?? "Тема удалена";
    return lessons.find((item) => item.id === node.targetId)?.title ?? `Лекция · ${chapterTitle}`;
  };
  const runNode = (node: PathNode, module: VocabModule, chapterTitle: string) => {
    if (node.kind === "cards" || node.kind === "test") onStart(module, node.kind, node.id);
    else if (node.kind === "game") {
      const activity = activities.find((item) => item.id === node.targetId);
      if (activity) onStartActivity(activity, module, node.id);
    } else if (node.kind === "audio") {
      const quiz = audioQuizzes.find((item) => item.id === node.targetId);
      if (quiz) onStartAudio(quiz, node.id);
    } else if (node.kind === "grammar") {
      const topic = availableGrammar.find((item) => item.id === node.targetId);
      if (topic) onStartGrammar(topic, node.id);
    } else {
      const lesson = lessons.find(
        (item) => item.id === node.targetId && item.chapter === chapterTitle,
      );
      if (lesson) onOpenLesson(lesson, node.id);
    }
  };
  const availableFor = (module: VocabModule, chapterTitle: string) => [
    { key: "cards", title: `Карточки · ${module.title}` },
    { key: "test", title: `Тест · ${module.title}` },
    ...activities
      .filter((item) => item.moduleId === module.id)
      .map((item) => ({ key: `game:${item.id}`, title: `Игра · ${item.title}` })),
    ...audioQuizzes
      .filter((item) => item.languageCode === module.languageCode && item.level === module.level)
      .map((item) => ({ key: `audio:${item.id}`, title: `Аудио · ${item.title}` })),
    ...availableGrammar
      .filter(
        (item) =>
          (item.languageCode ?? "de") === module.languageCode &&
          (item.level ?? module.level) === module.level,
      )
      .map((item) => ({ key: `grammar:${item.id}`, title: `Грамматика · ${item.title}` })),
    ...lessons
      .filter((item) => item.chapter === chapterTitle)
      .map((item) => ({ key: `lesson:${item.id}`, title: `Лекция · ${item.title}` })),
  ];
  const addNode = (module: VocabModule, chapterTitle: string) => {
    const key = selectionByModule[module.id];
    if (!key) return;
    const [kind, targetId] = key.includes(":") ? key.split(":", 2) : [key, undefined];
    const node: PathNode = { id: uniqueId(), kind: kind as PathNode["kind"], targetId };
    onSaveSequence(module.id, [...getSequence(module, chapterTitle), node]);
  };
  const reorderNode = (module: VocabModule, chapterTitle: string, index: number, delta: number) => {
    const sequence = [...getSequence(module, chapterTitle)];
    const target = index + delta;
    if (target < 0 || target >= sequence.length) return;
    [sequence[index], sequence[target]] = [sequence[target], sequence[index]];
    onSaveSequence(module.id, sequence);
  };
  return (
    <div className="page course-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            КОНСТРУКТОР · {modules[0]?.languageName ?? "ЯЗЫК"} {modules[0]?.level ?? ""}
          </p>
          <h1>Материалы и задания</h1>
          <p>
            Настраивайте свои карточки, игры, аудио и уроки. Последовательная программа курса
            находится в разделе «Учебный путь».
          </p>
        </div>
      </div>
      {chapters.length ? (
        <div className="course-chapters">
          {chapters.map((chapter, chapterIndex) => {
            const chapterModules = chapter.modules;
            const chapterNodes = chapterModules.flatMap((module) =>
              getSequence(module, chapter.title),
            );
            const completedNodes = chapterNodes.filter(
              (node) => pathCompletions[node.id]?.runs,
            ).length;
            const chapterPoints = chapterNodes.reduce(
              (sum, node) => sum + (pathCompletions[node.id]?.points ?? 0),
              0,
            );
            const chapterPercent = chapterNodes.length
              ? Math.round((completedNodes / chapterNodes.length) * 100)
              : 0;
            const learned = chapterModules.reduce(
              (sum, module) =>
                sum + module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length,
              0,
            );
            const total = chapterModules.reduce((sum, module) => sum + module.cards.length, 0);
            const chapterGames = activities.filter(
              (activity) =>
                activity.languageCode === modules[0]?.languageCode &&
                activity.level === modules[0]?.level &&
                chapterModules.some((module) => module.id === activity.moduleId),
            );
            const chapterLessons = lessons.filter((lesson) => lesson.chapter === chapter.title);
            return (
              <section className={`course-chapter chapter-${chapterIndex % 4}`} key={chapter.title}>
                <header>
                  <span className="chapter-number">
                    ГЛАВА {String(chapterIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="chapter-progress-label">
                    {completedNodes}/{chapterNodes.length} заданий · {chapterPercent}% · ★{" "}
                    {chapterPoints} XP
                  </span>
                  <h2>{chapter.title}</h2>
                  <p>
                    {chapter.subtitle} · {learned}/{total} слов закреплено
                  </p>
                  <div className="chapter-progress">
                    <i style={{ width: `${chapterPercent}%` }} />
                  </div>
                </header>
                <div className="chapter-modules">
                  {chapterModules.map((module) => {
                    const sequence = getSequence(module, chapter.title);
                    const completeCount = sequence.filter(
                      (node) => pathCompletions[node.id]?.runs,
                    ).length;
                    const points = sequence.reduce(
                      (sum, node) => sum + (pathCompletions[node.id]?.points ?? 0),
                      0,
                    );
                    const done = sequence.length > 0 && completeCount === sequence.length;
                    const editing = editingModuleId === module.id;
                    return (
                      <section
                        key={module.id}
                        className={`path-module-route ${done ? "complete" : ""}`}
                      >
                        <div className="path-module-heading">
                          <span className="chapter-module-number">
                            {done ? (
                              <Icon name="check" size={16} />
                            ) : (
                              String(module.id).padStart(2, "0")
                            )}
                          </span>
                          <div>
                            <strong>{module.title}</strong>
                            <small>
                              {completeCount}/{sequence.length} заданий · {points} XP ·{" "}
                              {
                                module.cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2)
                                  .length
                              }
                              /{module.cards.length} слов закреплено
                            </small>
                          </div>
                          {canManageContent && (
                            <button
                              className="secondary-button compact"
                              onClick={() => setEditingModuleId(editing ? null : module.id)}
                            >
                              {editing ? "Закрыть настройку" : "Настроить маршрут"}
                            </button>
                          )}
                        </div>
                        {editing && canManageContent && (
                          <div className="path-route-editor">
                            <p>
                              Соберите порядок занятий. Одно упражнение можно добавить несколько
                              раз: каждый шаг получит свою отметку и очки.
                            </p>
                            <div>
                              <select
                                aria-label={`Добавить занятие в маршрут ${module.title}`}
                                value={selectionByModule[module.id] ?? ""}
                                onChange={(event) =>
                                  setSelectionByModule((current) => ({
                                    ...current,
                                    [module.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Выберите занятие</option>
                                {availableFor(module, chapter.title).map((item) => (
                                  <option key={item.key} value={item.key}>
                                    {item.title}
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={!selectionByModule[module.id]}
                                onClick={() => addNode(module, chapter.title)}
                              >
                                Добавить в конец
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="path-step-list">
                          {sequence.map((node, nodeIndex) => {
                            const completion = pathCompletions[node.id];
                            const missing =
                              node.kind === "game"
                                ? !activities.some((item) => item.id === node.targetId)
                                : node.kind === "audio"
                                  ? !audioQuizzes.some((item) => item.id === node.targetId)
                                  : node.kind === "grammar"
                                    ? !availableGrammar.some((item) => item.id === node.targetId)
                                    : node.kind === "lesson"
                                      ? !lessons.some((item) => item.id === node.targetId)
                                      : false;
                            return (
                              <article
                                key={node.id}
                                className={`path-step ${completion?.runs ? "completed" : ""} ${missing ? "missing" : ""}`}
                              >
                                <span className="path-step-mark">
                                  {completion?.runs ? (
                                    <Icon name="check" size={17} />
                                  ) : (
                                    nodeMark[node.kind]
                                  )}
                                </span>
                                <div className="path-step-copy">
                                  <span>
                                    {nodeLabels[node.kind]} · {nodeIndex + 1}
                                  </span>
                                  <strong>{titleForNode(node, module, chapter.title)}</strong>
                                  <small>
                                    {completion?.runs
                                      ? `Пройдено ${completion.runs} раз · +${completion.lastPoints} XP · ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(completion.completedAt))}`
                                      : missing
                                        ? "Материал удалён · уберите его из маршрута"
                                        : "Ещё не пройдено"}
                                  </small>
                                </div>
                                <button
                                  disabled={missing}
                                  onClick={() => runNode(node, module, chapter.title)}
                                >
                                  {completion?.runs ? "Повторить" : "Начать"}
                                </button>
                                {editing && canManageContent && (
                                  <div className="path-step-edit">
                                    <button
                                      aria-label="Переместить выше"
                                      disabled={nodeIndex === 0}
                                      onClick={() =>
                                        reorderNode(module, chapter.title, nodeIndex, -1)
                                      }
                                    >
                                      ↑
                                    </button>
                                    <button
                                      aria-label="Переместить ниже"
                                      disabled={nodeIndex === sequence.length - 1}
                                      onClick={() =>
                                        reorderNode(module, chapter.title, nodeIndex, 1)
                                      }
                                    >
                                      ↓
                                    </button>
                                    <button
                                      className="text-danger"
                                      aria-label="Убрать занятие"
                                      onClick={() =>
                                        onSaveSequence(
                                          module.id,
                                          sequence.filter((item) => item.id !== node.id),
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                        <div className="path-module-actions">
                          <button className="chapter-module-open" onClick={() => onStart(module)}>
                            Открыть словарь <Icon name="arrow" size={15} />
                          </button>
                          {canManageContent && (
                            <button onClick={() => onManageGames(module.id)}>Добавить игру</button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
                <section className="chapter-lessons">
                  <div className="chapter-lessons-heading">
                    <div>
                      <h3>Уроки и материалы</h3>
                      <p>Видео, изображения, аудио, ссылки и задания по теме.</p>
                    </div>
                    {canManageContent && (
                      <button onClick={() => onCreateLesson(chapter.title)}>
                        <Icon name="plus" size={15} /> Добавить урок
                      </button>
                    )}
                  </div>
                  {chapterLessons.length ? (
                    <div className="chapter-lesson-list">
                      {chapterLessons.map((lesson) => (
                        <article key={lesson.id}>
                          <span className="lesson-card-mark">
                            <Icon name="book" size={18} />
                          </span>
                          <div>
                            <strong>{lesson.title}</strong>
                            <small>
                              {lesson.description || `${lesson.resources.length} материалов`} · $
                              {lesson.resources.length} материалов
                            </small>
                          </div>
                          <button onClick={() => onOpenLesson(lesson)}>Открыть</button>
                          <button onClick={() => onCopyLessonLink(lesson)}>Ссылка</button>
                          {canManageContent && (
                            <>
                              <button
                                aria-label={`Изменить урок ${lesson.title}`}
                                onClick={() => onEditLesson(lesson)}
                              >
                                Изменить
                              </button>
                              <button
                                aria-label={`Удалить урок ${lesson.title}`}
                                onClick={() => onDeleteLesson(lesson)}
                              >
                                Удалить
                              </button>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">
                      В этой главе пока нет готовых лекций. Добавьте урок или включите грамматику,
                      аудио и игры в маршруты модулей.
                    </p>
                  )}
                </section>
                {chapterGames.length > 0 && (
                  <div className="path-games">
                    <h3>Игры этой главы</h3>
                    {chapterGames.map((activity) => {
                      const module = chapterModules.find((item) => item.id === activity.moduleId);
                      if (!module) return null;
                      return (
                        <article key={activity.id}>
                          <span className="path-game-icon">
                            {GAME_LIST.find((game) => game.id === activity.gameId)?.mark}
                          </span>
                          <div>
                            <strong>{activity.title}</strong>
                            <small>
                              {GAME_LIST.find((game) => game.id === activity.gameId)?.title} ·{" "}
                              {activity.cardIds.length} карточек
                            </small>
                          </div>
                          <button onClick={() => onStartActivity(activity, module)}>Играть</button>
                          <button onClick={() => onManageGames(module.id)}>Изменить</button>
                          <button
                            aria-label={`Удалить ${activity.title}`}
                            onClick={() => deletePathActivity(activity)}
                          >
                            Удалить
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
                {canManageContent && chapterModules[0] && (
                  <button
                    className="chapter-add-game"
                    onClick={() => onManageGames(chapterModules[0].id)}
                  >
                    <Icon name="plus" size={15} /> Создать игру для этой главы
                  </button>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state cabinet-empty">
          <Icon name="path" size={32} />
          <h2>В этом кабинете пока нет глав</h2>
          <p>Добавьте учебный модуль, затем соберите из его карточек игры, уроки и занятия.</p>
        </div>
      )}
    </div>
  );
}

function StatsScreen({
  modules,
  cards,
  progress,
  stats,
  confusions,
  courseProgress,
  onReviewMistakes,
}: {
  modules: VocabModule[];
  cards: VocabCard[];
  progress: Record<string, CardProgress>;
  stats: UserStats;
  confusions: Record<string, Record<string, number>>;
  courseProgress: CourseProgress;
  onReviewMistakes: (cards: VocabCard[]) => void;
}) {
  const learned = cards.filter((card) => (progress[card.id]?.level ?? 0) >= 2).length;
  const reviewed = cards.filter((card) => (progress[card.id]?.reps ?? 0) > 0).length;
  const mistakes = cards
    .filter((card) => (progress[card.id]?.wrong ?? 0) > 0)
    .sort((a, b) => (progress[b.id]?.wrong ?? 0) - (progress[a.id]?.wrong ?? 0))
    .slice(0, 6);
  const confusedPairs = Object.values(confusions)
    .flatMap((pairs) => Object.entries(pairs))
    .filter(([, count]) => count >= 2).length;
  const accuracy = stats.answers ? Math.round((stats.correct / stats.answers) * 100) : 0;
  const achievements = [
    {
      icon: "spark" as IconName,
      title: "Первый шаг",
      note: "Ответьте на 10 заданий",
      value: stats.answers,
      goal: 10,
      color: "blue",
    },
    {
      icon: "gem" as IconName,
      title: "Серия знаний",
      note: "Заработайте 100 XP",
      value: stats.xp,
      goal: 100,
      color: "violet",
    },
    {
      icon: "flame" as IconName,
      title: "Неделя в ритме",
      note: "Занимайтесь 7 дней подряд",
      value: stats.streak,
      goal: 7,
      color: "orange",
    },
    {
      icon: "book" as IconName,
      title: "Словарный запас",
      note: "Закрепите 20 карточек",
      value: learned,
      goal: 20,
      color: "teal",
    },
    {
      icon: "check" as IconName,
      title: "Точный ответ",
      note: "Достигните точности 80% после 20 ответов",
      value: stats.answers >= 20 ? accuracy : 0,
      goal: 80,
      color: "rose",
      lockedUntil: 20,
    },
    {
      icon: "path" as IconName,
      title: "Исследователь",
      note: "Потренируйтесь в 5 модулях",
      value: modules.filter((module) =>
        module.cards.some((card) => (progress[card.id]?.reps ?? 0) > 0),
      ).length,
      goal: 5,
      color: "gold",
    },
  ];
  const unlocked = achievements.filter(
    (item) => item.value >= item.goal && (!item.lockedUntil || stats.answers >= item.lockedUntil),
  ).length;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАШ ПРОГРЕСС</p>
          <h1>Статистика</h1>
          <p>Курс, навыки, словарь и результаты занятий.</p>
        </div>
      </div>
      <Suspense fallback={null}>
        <CourseSkillsSummary progress={courseProgress} />
      </Suspense>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Карточек закреплено</span>
          <strong>{learned}</strong>
          <small>
            из {cards.length} · {modules.length} модулей
          </small>
        </div>
        <div className="stat-card">
          <span>Точность ответов</span>
          <strong>{accuracy}%</strong>
          <small>
            {stats.correct} верных из {stats.answers} ответов
          </small>
        </div>
        <div className="stat-card">
          <span>Занятия</span>
          <strong>{stats.sessions}</strong>
          <small>{reviewed} карточек уже повторяли</small>
        </div>
      </div>
      <section className="achievements-panel">
        <div className="section-title">
          <div>
            <h2>Награды</h2>
            <p>
              {unlocked} из {achievements.length} открыто · выполняйте задания, чтобы получить
              следующую награду
            </p>
          </div>
        </div>
        <div className="achievement-grid">
          {achievements.map((item) => {
            const isUnlocked =
              item.value >= item.goal && (!item.lockedUntil || stats.answers >= item.lockedUntil);
            const value =
              item.lockedUntil && stats.answers < item.lockedUntil
                ? Math.min(stats.answers, item.lockedUntil)
                : Math.min(item.value, item.goal);
            const target =
              item.lockedUntil && stats.answers < item.lockedUntil ? item.lockedUntil : item.goal;
            const percent = Math.min(100, Math.round((value / target) * 100));
            return (
              <article
                key={item.title}
                className={`achievement-card ${item.color} ${isUnlocked ? "unlocked" : "locked"}`}
              >
                <span className="achievement-icon">
                  <Icon name={item.icon} size={24} />
                </span>
                <div className="achievement-copy">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{isUnlocked ? "Открыто" : "Ещё не получено"}</span>
                  </div>
                  <p>{item.note}</p>
                  <div className="achievement-progress">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <small>
                    {value} / {target}
                  </small>
                </div>
                <span className="achievement-cup" aria-hidden="true">
                  {isUnlocked ? "🏆" : "◇"}
                </span>
              </article>
            );
          })}
        </div>
      </section>
      <section className="mistakes-panel">
        <div className="section-title">
          <div>
            <h2>Мои ошибки</h2>
            <p>
              {mistakes.length
                ? `${mistakes.length} сложных слов · ${confusedPairs} пары-путаницы отмечены дважды`
                : "Ошибочные ответы появятся здесь после практики."}
            </p>
          </div>
          <button disabled={!mistakes.length} onClick={() => onReviewMistakes(mistakes)}>
            Повторить <Icon name="arrow" size={15} />
          </button>
        </div>
        {mistakes.length > 0 && (
          <div className="mistake-list">
            {mistakes.map((card) => (
              <div key={card.id}>
                <strong>{german(card)}</strong>
                <span>{card.translation}</span>
                <small>{progress[card.id]?.wrong} ошибок</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="stats-note">
        <Icon name="info" />
        <span>
          Очки XP, серия, награды и история занятий относятся к активному кабинету. Уровень 0 —
          новое слово · 1 — учится · 2 — закрепляется · 3 — освоено.
        </span>
      </div>
    </div>
  );
}

function PodcastMode({
  cards,
  learningLanguageCode,
  nativeLanguageCode,
  onClose,
  onAnswer,
}: {
  cards: VocabCard[];
  learningLanguageCode: string;
  nativeLanguageCode: string;
  onClose: () => void;
  onAnswer: (card: VocabCard, correct: boolean, rating?: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const card = cards[index % Math.max(1, cards.length)];
  useEffect(() => {
    if (!playing || !card) return;
    window.speechSynthesis?.cancel();
    speakText(card.translation, speechLocaleForCode(nativeLanguageCode));
    const timer = window.setTimeout(
      () => speakText(german(card), speechLocaleForCode(learningLanguageCode)),
      3000,
    );
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [playing, card, learningLanguageCode, nativeLanguageCode]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  if (!card) return null;
  const next = (known: boolean) => {
    if (known) onAnswer(card, true, 2);
    setIndex((value) => (value + 1) % cards.length);
    setPlaying(false);
  };
  return (
    <div className="podcast-screen">
      <header>
        <button onClick={onClose} aria-label="Закрыть подкаст">
          <Icon name="close" />
        </button>
        <span>АУДИОПРАКТИКА</span>
        <button
          onClick={() => speakText(german(card), speechLocaleForCode(learningLanguageCode), true)}
          aria-label="Медленная озвучка"
        >
          <Icon name="volume" />
        </button>
      </header>
      <main>
        <button
          type="button"
          className={`audio-orb ${playing ? "playing" : ""}`}
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Пауза" : "Озвучить перевод и слово"}
        >
          <span />
          <span />
          <span />
          <Icon name="volume" size={32} />
        </button>
        <p>
          {index + 1} из {cards.length}
        </p>
        <h1>{card.translation}</h1>
        <div className="pause-timer">
          <i />
          <span>
            {playing
              ? "Сначала перевод · затем изучаемое слово"
              : "Нажмите озвучить, затем вспомните слово"}
          </span>
        </div>
        <h2>{german(card)}</h2>
        <p className="transcription">{card.transcription}</p>
      </main>
      <footer>
        <button
          onClick={() => {
            setPlaying(false);
            speakText(card.translation, speechLocaleForCode(nativeLanguageCode));
          }}
        >
          <Icon name="refresh" />
          <span>Повторить</span>
        </button>
        <button className="play-button" onClick={() => setPlaying((value) => !value)}>
          {playing ? <span className="pause-icon">Ⅱ</span> : <Icon name="volume" size={28} />}
          <span>{playing ? "Пауза" : "Озвучить"}</span>
        </button>
        <button onClick={() => next(true)}>
          <Icon name="check" />
          <span>Знаю</span>
        </button>
        <button className="podcast-skip" onClick={() => next(false)}>
          <Icon name="arrow" />
          <span>Дальше</span>
        </button>
      </footer>
    </div>
  );
}
