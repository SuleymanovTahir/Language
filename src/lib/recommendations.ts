import type { VocabCard, VocabModule } from "./vocab";
import type { CardProgress } from "../components/StudySession";

export type MissionDifficulty = "balanced" | "easier" | "harder";
export type MissionProfile = {
  goals?: string[];
  interests?: string[];
  focus?: string[];
  formats?: string[];
  avoidMicrophone?: boolean;
} | null;
export type DailyMission = {
  cards: VocabCard[];
  title: string;
  explanation: string;
  durationMinutes: number;
};

const goalTerms: Record<string, string[]> = {
  Путешествия: ["кафе", "отель", "транспорт", "покупки", "путешествия", "дорога", "город"],
  "Повседневная жизнь": ["дом", "еда", "город", "магазин", "семья", "время"],
  Работа: ["работа", "встреча", "офис", "профессия", "проект", "коллега"],
  Переезд: ["дом", "город", "документ", "адрес", "квартира", "регистрация"],
  Учёба: ["учёба", "школа", "книга", "экзамен", "урок", "университет"],
  Экзамен: ["экзамен", "учёба", "грамматика", "урок", "тест"],
};
const norm = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

export function recommendDailyMission(
  cards: VocabCard[],
  modules: VocabModule[],
  progress: Record<string, CardProgress>,
  profile: MissionProfile,
  difficulty: MissionDifficulty = "balanced",
  alternate = false,
): DailyMission {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const now = Date.now();
  const unique = [...new Map(cards.map((card) => [card.id, card])).values()];
  const matchingTerms = [
    ...(profile?.interests ?? []),
    ...(profile?.goals ?? []).flatMap((goal) => goalTerms[goal] ?? []),
  ].map(norm);
  const preferredFormats = new Set((profile?.formats ?? []).map(norm));
  const preferredFocus = new Set((profile?.focus ?? []).map(norm));
  const suitability = (card: VocabCard) => {
    const item = progress[card.id];
    const recency = item?.dueAt ? new Date(item.dueAt).getTime() : 0;
    const due = Boolean(item && (!recency || recency <= now));
    const weak = item ? Math.max(0, item.wrong - item.correct) : 0;
    const text = norm(
      `${byId.get(card.moduleId)?.title ?? ""} ${card.word} ${card.translation} ${card.exampleSentence ?? ""}`,
    );
    const topic = matchingTerms.some((term) => term && text.includes(term));
    const hasContext = Boolean(card.exampleSentence?.trim());
    const formatFit =
      (hasContext && (preferredFormats.has(norm("Слушать")) || preferredFormats.has(norm("Читать")))
        ? 4
        : 0) +
      (preferredFormats.has(norm("Писать")) ? (hasContext ? 3 : 1) : 0) +
      (hasContext && preferredFormats.has(norm("Говорить")) && !profile?.avoidMicrophone ? 2 : 0);
    const focusFit =
      (preferredFocus.has(norm("Грамматика")) && Boolean(card.article) ? 5 : 0) +
      (preferredFocus.has(norm("Чтение")) && hasContext ? 4 : 0) +
      (preferredFocus.has(norm("Аудирование")) && hasContext ? 4 : 0) +
      (preferredFocus.has(norm("Письмо")) && hasContext ? 3 : 0) +
      (preferredFocus.has(norm("Слова")) ? 2 : 0);
    const known = item?.level ?? 0;
    const gentle =
      difficulty === "easier"
        ? (known < 2 ? 3 : 0) + (card.hint || card.exampleSentence ? 1 : 0)
        : 0;
    const challenge =
      difficulty === "harder"
        ? (known >= 2 ? 3 : 0) + (card.article || card.exampleSentence ? 1 : 0)
        : 0;
    return {
      card,
      due,
      weak,
      topic,
      score:
        (due ? 100 : 0) +
        weak * 10 +
        (topic ? 5 : 0) +
        formatFit +
        focusFit +
        gentle +
        challenge +
        (item ? 0 : 1),
    };
  };
  const scored = unique.map(suitability);
  const due = scored.filter((item) => item.due).sort((a, b) => b.score - a.score);
  const weak = scored.filter((item) => item.weak > 0).sort((a, b) => b.weak - a.weak);
  const topical = scored.filter((item) => item.topic).sort((a, b) => b.score - a.score);
  const fresh = scored.filter((item) => !progress[item.card.id]).sort((a, b) => b.score - a.score);
  const add = (items: typeof scored, limit?: number) => {
    const source = alternate ? [...items].reverse() : items;
    for (const item of source) {
      if (selected.length >= 5 || (limit !== undefined && selected.length >= limit)) break;
      if (!selectedIds.has(item.card.id)) {
        selected.push(item.card);
        selectedIds.add(item.card.id);
      }
    }
  };
  const selected: VocabCard[] = [];
  const selectedIds = new Set<string>();
  if (alternate) {
    add(topical);
    add(fresh);
    add(weak);
    add(due, 2);
  } else {
    add(due, 2);
    add(weak);
    add(topical);
    add(fresh);
  }
  add(scored.sort((a, b) => b.score - a.score));
  const baseExplanation = due.length
    ? `Начнём с ${Math.min(2, due.length)} карточек, которым подошло время повтора, затем добавим одну сложную тему.`
    : weak.length
      ? "Сначала укрепим слова, на которых раньше чаще ошибались, затем добавим знакомую тему."
      : topical.length
        ? `Подобрали слова по цели «${profile?.goals?.[0] ?? profile?.interests?.[0] ?? "вашему интересу"}» и добавили короткое повторение.`
        : "Короткая миссия из пяти проверенных заданий по вашему уровню.";
  const preferredFormat = profile?.formats?.[0];
  const explanation = preferredFormat
    ? `${baseExplanation} Приоритет: формат «${preferredFormat.toLocaleLowerCase()}».`
    : baseExplanation;
  return {
    cards: selected,
    title: alternate ? "Другая тема · короткая миссия" : "Рекомендовано · 5 минут",
    explanation,
    durationMinutes: 5,
  };
}
