import rawVocabulary from "../data/vocab_modules_v2.txt?raw";
import { readProfileItem } from "./profileStorage";

export type VocabCard = {
  id: string;
  moduleId: number;
  word: string;
  article: "der" | "die" | "das" | null;
  transcription: string;
  translation: string;
  partOfSpeech: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "other";
  phoneticRuleId: string | null;
  exampleSentence?: string;
  sentenceAnswer?: string;
  hint?: string;
  image?: { id: string; name: string };
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
  practiceInstructions?: string;
  practiceMedia?: {
    id?: string;
    kind: "image" | "audio" | "video" | "link";
    name: string;
    mimeType?: string;
    url?: string;
  };
};

const headerPattern = /^# МОДУЛЬ (\d+): (.+) \((DE - RUS|RUS - DE)\)$/i;
const forwardEntryPattern = /^(.+?)(?:\s+\[([^\]]+)\])?\s+-\s+(.+)$/;
const reverseEntryPattern = /^(.+?)\s*-\s*(.+?)\s+\[([^\]]+)\]$/;

export function parseVocabulary(
  source: string,
  moduleId = 1000,
  title = "Мой словарь",
): VocabCard[] {
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
    const article = articleMatch ? (articleMatch[1].toLowerCase() as VocabCard["article"]) : null;
    const word = articleMatch ? articleMatch[2].trim() : sourceWord.trim();
    const translation = reverseLine ? reverse![1].trim() : forward![3].trim();
    if (!word || !translation) continue;
    const dedupeKey = `${word.toLocaleLowerCase()}\u0000${translation.toLocaleLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const lowerWord = word.toLocaleLowerCase();
    const pronouns = new Set([
      "ich",
      "du",
      "er",
      "sie",
      "es",
      "wir",
      "ihr",
      "Sie".toLocaleLowerCase(),
      "man",
    ]);
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

export function moduleLevelForId(id: number): string {
  if ([90, 91, 92, 93, 94].includes(id)) return "A0";
  if ([1, 2, 3, 5, 6, 9, 13, 14, 15].includes(id)) return "A1";
  if ([7, 8, 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 32, 33, 34].includes(id)) return "A2";
  if ([4, 23, 27, 28, 30, 31, 200, 201, 202, 203].includes(id)) return "B1";
  if ([29, 35, 36, 37, 38, 39, 204, 205].includes(id)) return "B2";
  if (id >= 206) return "C1";
  return "A1";
}

export const a0Modules: VocabModule[] = [
  scenarioModule(
    90,
    "Первые слова и вежливость",
    [
      ["Hallo", "привет", "___, wie geht's?", "Главное приветствие."],
      ["Tschüss", "пока", "Auf Wiedersehen oder ___!", "Дружеское прощание."],
      ["Danke", "спасибо", "___ schön für die Hilfe!", "Слово благодарности."],
      ["Bitte", "пожалуйста", "Kaffee, ___!", "Вежливая просьба."],
      ["Ja", "да", "___, bitte!", "Слово согласия."],
      ["Nein", "нет", "___, danke!", "Слово отказа."],
    ],
    "A0",
  ),
  scenarioModule(
    91,
    "Первые напитки и связка «und»",
    [
      ["der Kaffee", "кофе", "Ich trinke gern ___ am Morgen.", "Бодрящий напиток."],
      ["der Tee", "чай", "Eine Tasse ___, bitte.", "Горячий напиток из трав."],
      ["das Wasser", "вода", "Ein Glas ___, bitte.", "Простая питьевая вода."],
      ["und", "и", "Kaffee ___ Tee, bitte.", "Союз для соединения слов."],
      ["gut", "хорошо", "Sehr ___, danke!", "Положительная оценка."],
      ["sehr", "очень", "Das ist ___ gut.", "Усилитель признака."],
    ],
    "A0",
  ),
  scenarioModule(
    92,
    "«Я есть...» и первые вопросы",
    [
      ["ich", "я", "___ heiße Alex.", "Первое лицо единственного числа."],
      ["du", "ты", "Wer bist ___?", "Второе лицо, собеседник на «ты»."],
      ["wer", "кто", "___ ist das?", "Вопросительное слово о человеке."],
      ["wie", "как", "___ geht's?", "Вопросительное слово об образе действия."],
      ["super", "супер", "Mir geht es ___!", "Отличное настроение."],
      ["prima", "отлично / здорово", "Das ist просто ___!", "Замечательно."],
    ],
    "A0",
  ),
  scenarioModule(
    93,
    "Числа 1–10 и счёт",
    [
      ["eins", "один", "___, zwei, drei!", "Число 1."],
      ["zwei", "два", "___ Tassen Kaffee, bitte.", "Число 2."],
      ["drei", "три", "Aller guten Dinge sind ___.", "Число 3."],
      ["vier", "четыре", "Das Auto hat ___ Räder.", "Число 4."],
      ["fünf", "пять", "Noch ___ Minuten.", "Число 5."],
      ["sechs", "шесть", "Ich habe ___ Bücher.", "Число 6."],
      ["sieben", "семь", "Es ist ___ Uhr.", "Число 7."],
      ["acht", "восемь", "Die Arbeit beginnt um ___.", "Число 8."],
      ["neun", "девять", "Zimmer Nummer ___.", "Число 9."],
      ["zehn", "десять", "Ich zähle bis ___.", "Число 10."],
    ],
    "A0",
  ),
  scenarioModule(
    94,
    "Семья и цвета",
    [
      ["die Familie", "семья", "Das ist meine ___.", "Семья, родные."],
      ["der Vater", "папа / отец", "Mein ___ heißt Thomas.", "Отец."],
      ["die Mutter", "мама / мать", "Meine ___ kocht gern.", "Мать."],
      ["das Kind", "ребёнок", "Das ___ spielt im Garten.", "Ребёнок."],
      ["rot", "красный", "Der Apfel ist ___.", "Красный цвет."],
      ["blau", "синий / голубой", "Der Himmel ist ___.", "Синий цвет."],
      ["grün", "зелёный", "Das Gras ist ___.", "Зелёный цвет."],
      ["schön", "красиво / прекрасно", "Das ist sehr ___!", "Красивый, прекрасный."],
    ],
    "A0",
  ),
];

export const modules: VocabModule[] = (() => {
  const grouped = new Map<number, VocabModule>();
  a0Modules.forEach((m) => {
    grouped.set(m.id, m);
  });

  let current: VocabModule | null = null;
  let direction: "DE - RUS" | "RUS - DE" | null = null;

  for (const sourceLine of rawVocabulary.split(/\r?\n/)) {
    const line = sourceLine.trim();
    const header = line.match(headerPattern);
    if (header) {
      const id = Number(header[1]);
      const title = header[2].trim();
      const level = moduleLevelForId(id);
      current = grouped.get(id) ?? {
        id,
        title,
        cards: [],
        languageCode: "de",
        languageName: "Немецкий",
        level,
        nativeLanguageCode: "ru",
      };
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

function scenarioModule(
  id: number,
  title: string,
  entries: Array<[string, string, string, string]>,
  level = "A1–A2",
): VocabModule {
  const cards = entries.map(([source, translation, exampleSentence, hint], index) => {
    const card = parseVocabulary(`${source} - ${translation}`, id, title)[0];
    return {
      ...card,
      id: `${id}-${index + 1}`,
      moduleId: id,
      exampleSentence,
      sentenceAnswer: card.article ? `${card.article} ${card.word}` : card.word,
      hint,
    };
  });
  return {
    id,
    title,
    cards,
    languageCode: "de",
    languageName: "Немецкий",
    level,
    nativeLanguageCode: "ru",
  };
}

export const scenarioModules: VocabModule[] = [
  scenarioModule(200, "В аэропорту", [
    [
      "der Flughafen",
      "аэропорт",
      "Wir treffen uns am ___.",
      "Место, откуда отправляются самолёты.",
    ],
    ["der Flug", "рейс", "Unser ___ startet um neun Uhr.", "Поездка на самолёте."],
    ["das Ticket", "билет", "Ich zeige mein ___ am Schalter.", "Документ для посадки."],
    ["der Pass", "паспорт", "Bitte zeigen Sie Ihren ___.", "Документ для поездок за границу."],
    ["das Gepäck", "багаж", "Wo kann ich mein ___ abholen?", "Чемоданы и сумки пассажира."],
    [
      "das Gate",
      "выход на посадку",
      "Das Boarding beginnt an ___.",
      "Здесь пассажиры заходят в самолёт.",
    ],
    ["der Koffer", "чемодан", "Mein ___ ist sehr schwer.", "Большая дорожная сумка."],
    ["abfliegen", "вылетать", "Das Flugzeug wird um zehn ___.", "Самолёт отправляется в путь."],
  ]),
  scenarioModule(201, "В отеле", [
    [
      "das Hotel",
      "отель",
      "Wir übernachten in einem ___.",
      "Место, где туристы останавливаются на ночь.",
    ],
    [
      "die Reservierung",
      "бронь",
      "Ich habe eine ___ für zwei Nächte.",
      "Заранее забронированный номер.",
    ],
    [
      "das Zimmer",
      "комната / номер",
      "Unser ___ ist im zweiten Stock.",
      "В отеле здесь спят гости.",
    ],
    ["der Schlüssel", "ключ", "Hier ist der ___ für Ihr Zimmer.", "Им открывают дверь."],
    ["das Frühstück", "завтрак", "Ist das ___ im Preis enthalten?", "Утренняя еда."],
    [
      "die Rezeption",
      "стойка регистрации",
      "Fragen Sie bitte an der ___.",
      "Здесь встречают гостей.",
    ],
    ["einchecken", "зарегистрироваться", "Wir möchten jetzt ___.", "Оформить приезд в отель."],
    [
      "auschecken",
      "выписаться",
      "Wir müssen bis elf Uhr ___.",
      "Завершить проживание и сдать ключ.",
    ],
  ]),
  scenarioModule(202, "В ресторане", [
    ["die Speisekarte", "меню", "Können wir bitte die ___ haben?", "Список блюд и напитков."],
    ["die Rechnung", "счёт", "Die ___, bitte.", "Документ с суммой к оплате."],
    ["das Wasser", "вода", "Ein Glas ___, bitte.", "Напиток без газа или с газом."],
    ["bestellen", "заказывать", "Wir möchten jetzt ___.", "Сказать официанту, что вы хотите."],
    ["lecker", "вкусный", "Die Suppe ist sehr ___.", "Так говорят о приятном вкусе."],
    ["vegetarisch", "вегетарианский", "Haben Sie ein ___ Gericht?", "Блюдо без мяса и рыбы."],
    [
      "der Kellner",
      "официант",
      "Der ___ bringt unsere Getränke.",
      "Сотрудник ресторана, который обслуживает стол.",
    ],
    ["bezahlen", "платить", "Kann ich mit Karte ___.", "Отдать деньги за заказ."],
  ]),
  scenarioModule(203, "Отпуск и поездка", [
    ["der Urlaub", "отпуск", "Im Sommer habe ich ___.", "Свободные дни для отдыха."],
    ["die Reise", "путешествие", "Unsere ___ beginnt morgen.", "Поездка в другое место."],
    ["der Strand", "пляж", "Wir liegen am ___.", "Место у моря с песком."],
    ["das Meer", "море", "Das ___ ist heute warm.", "Большой солёный водоём."],
    [
      "wandern",
      "ходить в поход",
      "Am Wochenende möchten wir ___.",
      "Долго гулять по природе и горам.",
    ],
    ["die Sonne", "солнце", "Heute scheint die ___.", "На небе тепло и светло."],
    ["buchen", "бронировать", "Ich möchte ein Zimmer ___.", "Заранее заказать билет или номер."],
    [
      "der Reiseführer",
      "путеводитель",
      "Der ___ zeigt uns die Altstadt.",
      "Книга или человек, помогающий туристу.",
    ],
  ]),
  scenarioModule(204, "Собеседование · медсестра", [
    [
      "die Krankenschwester",
      "медсестра",
      "Ich arbeite als ___.",
      "Женщина, которая ухаживает за пациентами.",
    ],
    [
      "der Patient",
      "пациент",
      "Der ___ wartet auf den Arzt.",
      "Человек, который получает медицинскую помощь.",
    ],
    [
      "das Krankenhaus",
      "больница",
      "Ich arbeite in einem ___.",
      "Медицинское учреждение для лечения.",
    ],
    [
      "die Erfahrung",
      "опыт",
      "Ich habe fünf Jahre ___ in der Pflege.",
      "Знания, полученные на прежней работе.",
    ],
    ["die Schicht", "смена", "Meine ___ beginnt um sieben Uhr.", "Период работы по расписанию."],
    ["helfen", "помогать", "Ich möchte Menschen ___.", "Поддерживать человека, которому трудно."],
    [
      "zuverlässig",
      "надёжный",
      "Meine Kolleginnen nennen mich ___.",
      "На такого сотрудника можно положиться.",
    ],
    [
      "das Bewerbungsgespräch",
      "собеседование",
      "Morgen habe ich ein ___.",
      "Встреча с работодателем перед приёмом на работу.",
    ],
  ]),
  scenarioModule(205, "Собеседование · программист", [
    [
      "der Programmierer",
      "программист",
      "Ich arbeite als ___.",
      "Специалист, который пишет программы.",
    ],
    [
      "die Software",
      "программное обеспечение",
      "Wir entwickeln neue ___.",
      "Программы и приложения компьютера.",
    ],
    ["das Team", "команда", "Ich arbeite gern im ___.", "Группа коллег с общей задачей."],
    ["die Erfahrung", "опыт", "Ich habe ___ mit Python.", "Практика и знания в работе."],
    [
      "die Entwicklung",
      "разработка",
      "Ich interessiere mich für die ___.",
      "Создание и улучшение программ.",
    ],
    ["das Projekt", "проект", "Unser ___ startet nächste Woche.", "Работа с общей целью и сроком."],
    ["die Fähigkeit", "навык", "Eine wichtige ___ ist Problemlösung.", "Умение что-то делать."],
    [
      "das Bewerbungsgespräch",
      "собеседование",
      "Am Freitag habe ich ein ___.",
      "Встреча с работодателем перед приёмом на работу.",
    ],
  ]),
];

export const storedModules = (): VocabModule[] => {
  try {
    const saved = JSON.parse(readProfileItem("linguaplay-custom-modules") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};
