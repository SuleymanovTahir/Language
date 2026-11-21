import type { AccountUser } from "../components/Accounts";

export type ScreenName =
  | "today"
  | "library"
  | "catalog"
  | "path"
  | "materials"
  | "games"
  | "stats"
  | "admin"
  | "analytics"
  | "404";

export type MenuVisibilityConfig = {
  globallyHiddenSections: string[];
  proOnlySections: string[];
  staffOnlySections: string[];
};

export const defaultMenuVisibilityConfig: MenuVisibilityConfig = {
  globallyHiddenSections: [],
  proOnlySections: [],
  staffOnlySections: ["catalog", "materials", "admin", "analytics"],
};

export const MENU_SECTIONS: { id: string; label: string; description: string }[] = [
  { id: "today", label: "Сегодня", description: "Главная страница и дневные цели" },
  { id: "library", label: "Библиотека слов", description: "Словари, темы и карточки слов" },
  {
    id: "catalog",
    label: "Каталог",
    description: "Общий каталог уроков и учебных модулей (по умолчанию только для авторов)",
  },
  { id: "path", label: "Учебный путь", description: "Интерактивная карта обучения и уроки" },
  { id: "materials", label: "Материалы", description: "Конструктор уроков и учебные материалы" },
  {
    id: "games",
    label: "Игры и упражнения",
    description: "Интерактивные тренировки и запоминалки",
  },
  { id: "stats", label: "Прогресс", description: "Статистика, графики и достижения" },
];

const STORAGE_KEY = "clickling-menu-visibility-settings";

export function readMenuVisibilityConfig(): MenuVisibilityConfig {
  if (typeof window === "undefined") return defaultMenuVisibilityConfig;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMenuVisibilityConfig;
    const parsed = JSON.parse(raw) as Partial<MenuVisibilityConfig>;
    return {
      globallyHiddenSections: Array.isArray(parsed.globallyHiddenSections)
        ? parsed.globallyHiddenSections
        : defaultMenuVisibilityConfig.globallyHiddenSections,
      proOnlySections: Array.isArray(parsed.proOnlySections)
        ? parsed.proOnlySections
        : defaultMenuVisibilityConfig.proOnlySections,
      staffOnlySections: Array.isArray(parsed.staffOnlySections)
        ? parsed.staffOnlySections
        : defaultMenuVisibilityConfig.staffOnlySections,
    };
  } catch {
    return defaultMenuVisibilityConfig;
  }
}

export function saveMenuVisibilityConfig(config: MenuVisibilityConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function isScreenAllowed(
  targetScreen: string,
  user: AccountUser | null,
  config: MenuVisibilityConfig = defaultMenuVisibilityConfig,
  canManageUsers: boolean = false,
  canManageContent: boolean = false,
): boolean {
  if (targetScreen === "404") return true;

  // Owners and admin users see all
  if (canManageUsers || user?.role === "owner" || user?.role === "admin") return true;

  // 1. Staff-only sections
  if (config.staffOnlySections.includes(targetScreen)) {
    if (targetScreen === "catalog" && !canManageContent) return false;
    if (["admin", "analytics"].includes(targetScreen) && !canManageUsers) return false;
    if (
      targetScreen === "materials" &&
      !canManageContent &&
      config.staffOnlySections.includes("materials")
    ) {
      return false;
    }
  }

  // 2. Globally hidden sections
  if (config.globallyHiddenSections.includes(targetScreen)) {
    return false;
  }

  // 3. Pro-only sections
  if (config.proOnlySections.includes(targetScreen)) {
    const isPro = Boolean(user?.isPro);
    if (!isPro) return false;
  }

  // 4. Per-user hidden sections
  if (user?.permissions?.hiddenSections?.includes(targetScreen)) {
    return false;
  }

  return true;
}
