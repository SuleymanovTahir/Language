import rawVocabulary from "../data/vocab_modules_v2.txt?raw";

export type VocabCard = {
  id: string;
  moduleId: number;
  word: string;
  article: "der" | "die" | "das" | null;
  transcription: string;
  translation: string;
  partOfSpeech: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "other";
  phoneticRuleId: string | null;
};

export type VocabModule = {
  id: number;
  title: string;
  cards: VocabCard[];
  languageCode: string;
  languageName: string;
  level: string;
  nativeLanguageCode?: string;
  custom?: boolean;
  practiceNote?: string;
};

const headerPattern = /^# МОДУЛЬ (\d+): (.+) \((DE - RUS|RUS - DE)\)$/i;
const forwardEntryPattern = /^(.+?)(?:\s+\[([^\]]+)\])?\s+-\s+(.+)$/;
const reverseEntryPattern = /^(.+?)\s*-\s*(.+?)\s+\[([^\]]+)\]$/;

export function parseVocabulary(source: string, moduleId = 1000, title = "Мой словарь"): VocabCard[] {
  const cards: VocabCard[] = [];
  const seen = new Set<string>();
  for (const [lineIndex, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const reverse = line.match(reverseEntryPattern);
    const forward = reverse ? null : line.match(forwardEntryPattern);
    if (!forward && !reverse) continue;
    const reverseLine = !forward && Boolean(reverse);
    const germanMatch = forward
      ? { word: forward[1].trim(), transcription: (forward[2] ?? "").trim() }
      : { word: reverse![2].trim(), transcription: reverse![3].trim() };
    const sourceWord = germanMatch.word;
    const articleMatch = sourceWord.match(/^(der|die|das)\s+(.+)$/i);
    const article = articleMatch
      ? (articleMatch[1].toLowerCase() as VocabCard["article"])
      : null;
    const word = articleMatch ? articleMatch[2].trim() : sourceWord.trim();
    const translation = reverseLine ? reverse![1].trim() : forward![3].trim();
    if (!word || !translation) continue;
    const dedupeKey = `${word.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const lowerWord = word.toLocaleLowerCase();
    const pronouns = new Set(["ich", "du", "er", "sie", "es", "wir", "ihr", "Sie".toLocaleLowerCase(), "man"]);
    const partOfSpeech: VocabCard["partOfSpeech"] = article
      ? "noun"
      : pronouns.has(lowerWord)
        ? "pronoun"
        : /(?:en|ern|eln|n)$/.test(lowerWord)
          ? "verb"
          : /(?:ig|lich|isch|bar|sam|los|voll)$/.test(lowerWord)
            ? "adjective"
            : /(?:weise|wärts|mal|hin|her)$/.test(lowerWord)
              ? "adverb"
              : "other";
    const phoneticRuleId = /[bdg](?:\b|[^aeiouyäöüß])$/i.test(word)
      ? "PHON-03"
      : /ig$/i.test(word)
        ? "PHON-04"
        : /^[sp][tp]/i.test(word)
          ? "PHON-05"
          : /ei|ie|au|eu|äu/i.test(word)
            ? "PHON-06"
            : /[äöüß]/i.test(word)
              ? "PHON-07"
              : /sch|ch|tsch|chs/i.test(word)
                ? "PHON-08"
                : /[vwzj]|qu/i.test(word)
                  ? "PHON-09"
                  : /[aeiouyäöü]h?[^aeiouyäöü]{2,}$/i.test(word)
                    ? "PHON-02"
                    : "PHON-01";
    cards.push({
      id: `${moduleId}-${cards.length + 1}-${lineIndex}`,
      moduleId,
      word,
      article,
      transcription: germanMatch.transcription ? `[${germanMatch.transcription}]` : "",
      translation,
      partOfSpeech,
      phoneticRuleId,
    });
  }
  return cards;
}

export const modules: VocabModule[] = (() => {
  const grouped = new Map<number, VocabModule>();
  let current: VocabModule | null = null;
  let direction: "DE - RUS" | "RUS - DE" | null = null;

  for (const sourceLine of rawVocabulary.split(/\r?\n/)) {
    const line = sourceLine.trim();
    const header = line.match(headerPattern);
    if (header) {
      const id = Number(header[1]);
      const title = header[2].trim();
      current = grouped.get(id) ?? { id, title, cards: [], languageCode: "de", languageName: "Немецкий", level: "A1–A2", nativeLanguageCode: "ru" };
      grouped.set(id, current);
      direction = header[3].toUpperCase() as "DE - RUS" | "RUS - DE";
      continue;
    }
    if (!current || direction !== "DE - RUS" || !line || line.startsWith("#")) continue;
    const parsed = parseVocabulary(line, current.id, current.title)[0];
    if (parsed) {
      parsed.id = `${current.id}-${current.cards.length + 1}`;
      current.cards.push(parsed);
    }
  }

  return [...grouped.values()].sort((a, b) => a.id - b.id);
})();

export const allCards = modules.flatMap((module) => module.cards);

export const storedModules = (): VocabModule[] => {
  try {
    const saved = JSON.parse(localStorage.getItem("linguaplay-custom-modules") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};
