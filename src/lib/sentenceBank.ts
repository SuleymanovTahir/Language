import type { VocabCard, VocabModule } from "./vocab";

export type SentenceDifficulty = "easy" | "medium" | "hard";

export type SentenceChallenge = {
  id: string;
  russian: string;
  targetWords: string[];
  difficulty: SentenceDifficulty;
  explanation?: string;
};

export type SentenceTile = {
  id: string;
  text: string;
  isDistractor: boolean;
};

export type PreparedSentenceRound = {
  challenge: SentenceChallenge;
  tiles: SentenceTile[];
  correctCount: number;
  distractorCount: number;
};

function cleanToken(token: string): string {
  return token.replace(/[.,!?;:]+$/u, "").trim().toLowerCase();
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Curated sentence sets for popular vocab modules
const CURATED_MODULE_SENTENCES: Record<number, SentenceChallenge[]> = {
  // Модуль 1: Я, ты, быть, иметь
  1: [
    // Easy (3-4 words)
    {
      id: "m1-e1",
      russian: "Я тоже здесь.",
      targetWords: ["Ich", "bin", "auch", "hier."],
      difficulty: "easy",
      explanation: "Глагол bin стоит на втором месте в повествовательном предложении.",
    },
    {
      id: "m1-e2",
      russian: "У меня есть время.",
      targetWords: ["Ich", "habe", "Zeit."],
      difficulty: "easy",
      explanation: "В немецком «у меня есть» строится через глагол haben: Ich habe.",
    },
    {
      id: "m1-e3",
      russian: "Мы имеем это.",
      targetWords: ["Wir", "haben", "das."],
      difficulty: "easy",
      explanation: "Прямой порядок слов: подлежащее Wir, затем глагол haben.",
    },
    {
      id: "m1-e4",
      russian: "Ты мой друг.",
      targetWords: ["Du", "bist", "mein", "Freund."],
      difficulty: "easy",
      explanation: "С местоимением du глагол sein имеет форму bist.",
    },
    {
      id: "m1-e5",
      russian: "Это не он.",
      targetWords: ["Das", "ist", "nicht", "er."],
      difficulty: "easy",
      explanation: "Отрицание nicht ставится перед выделяемым словом.",
    },
    // Medium (4-6 words)
    {
      id: "m1-m1",
      russian: "У тебя тоже нет времени.",
      targetWords: ["Du", "hast", "auch", "keine", "Zeit."],
      difficulty: "medium",
      explanation: "С существительными без артикля для отрицания используется kein/keine.",
    },
    {
      id: "m1-m2",
      russian: "Это наш новый большой дом.",
      targetWords: ["Das", "ist", "unser", "großes", "Haus."],
      difficulty: "medium",
      explanation: "Притяжательное местоимение unser согласуется со средним родом Haus.",
    },
    {
      id: "m1-m3",
      russian: "Они становятся очень хорошими друзьями.",
      targetWords: ["Sie", "werden", "sehr", "gute", "Freunde."],
      difficulty: "medium",
      explanation: "Глагол werden означает «становиться».",
    },
    {
      id: "m1-m4",
      russian: "Вы тоже имеете эту книгу?",
      targetWords: ["Habt", "ihr", "auch", "dieses", "Buch?"],
      difficulty: "medium",
      explanation: "В вопросе без вопросительного слова глагол Habt выходит на первое место.",
    },
    // Hard (6-8 words)
    {
      id: "m1-h1",
      russian: "Сегодня у нас совсем нет свободного времени.",
      targetWords: ["Heute", "haben", "wir", "wirklich", "keine", "freie", "Zeit."],
      difficulty: "hard",
      explanation: "Обратный порядок слов: обстоятельство времени Heute на первом месте, глагол haben на втором.",
    },
    {
      id: "m1-h2",
      russian: "Почему вы сейчас не хотите быть здесь?",
      targetWords: ["Warum", "wollt", "ihr", "jetzt", "nicht", "hier", "sein?"],
      difficulty: "hard",
      explanation: "Инфинитив sein отправляется в самый конец предложения после модального глагола.",
    },
    {
      id: "m1-h3",
      russian: "Этот человек тоже не имеет своего места.",
      targetWords: ["Dieser", "Mann", "hat", "auch", "keinen", "eigenen", "Platz."],
      difficulty: "hard",
      explanation: "Мужской род в винительном падеже (Akkusativ): keinen eigenen Platz.",
    },
  ],

  // Модуль 2: Хочу, могу, должен
  2: [
    // Easy
    {
      id: "m2-e1",
      russian: "Я хочу пить воду.",
      targetWords: ["Ich", "will", "Wasser", "trinken."],
      difficulty: "easy",
      explanation: "С модальным глаголом инфинитив trinken уходит в конец.",
    },
    {
      id: "m2-e2",
      russian: "Ты можешь помочь мне?",
      targetWords: ["Kannst", "du", "mir", "helfen?"],
      difficulty: "easy",
      explanation: "Вопрос начинается с спрягаемой формы модального глагола Kannst.",
    },
    {
      id: "m2-e3",
      russian: "Мы должны сейчас идти.",
      targetWords: ["Wir", "müssen", "jetzt", "gehen."],
      difficulty: "easy",
      explanation: "Глагол müssen выражает объективную необходимость.",
    },
    // Medium
    {
      id: "m2-m1",
      russian: "Я могу сделать это прямо сегодня.",
      targetWords: ["Ich", "kann", "das", "heute", "machen."],
      difficulty: "medium",
      explanation: "Рамочная конструкция: kann ... machen.",
    },
    {
      id: "m2-m2",
      russian: "Здесь нельзя громко разговаривать.",
      targetWords: ["Man", "darf", "hier", "nicht", "laut", "sprechen."],
      difficulty: "medium",
      explanation: "Неопределенно-личное местоимение man с dürfen означает «разрешено / запрещено».",
    },
    {
      id: "m2-m3",
      russian: "Ты хочешь пойти со мной гулять?",
      targetWords: ["Möchtest", "du", "mit", "mir", "spazieren", "gehen?"],
      difficulty: "medium",
      explanation: "Möchten выражает вежливое желание («хотел бы»).",
    },
    // Hard
    {
      id: "m2-h1",
      russian: "К сожалению, сегодня я не могу прийти к тебе.",
      targetWords: ["Leider", "kann", "ich", "heute", "nicht", "zu", "dir", "kommen."],
      difficulty: "hard",
      explanation: "Инверсия: вводное слово Leider на 1-м месте, глагол kann на 2-м, подлежащее ich на 3-м.",
    },
    {
      id: "m2-h2",
      russian: "Почему мы должны делать это именно сейчас?",
      targetWords: ["Warum", "müssen", "wir", "das", "genau", "jetzt", "erledigen?"],
      difficulty: "hard",
      explanation: "Вопросительное слово Warum + глагол müssen + подлежащее wir + инфинитив в конце.",
    },
  ],

  // Модуль 3: Вопросы и ответы
  3: [
    // Easy
    {
      id: "m3-e1",
      russian: "Кто это такой?",
      targetWords: ["Wer", "ist", "das", "denn?"],
      difficulty: "easy",
      explanation: "Вопрос с вопросительным словом Wer (Кто).",
    },
    {
      id: "m3-e2",
      russian: "Где мой ключ?",
      targetWords: ["Wo", "ist", "mein", "Schlüssel?"],
      difficulty: "easy",
      explanation: "Wo указывает на местонахождение («Где»).",
    },
    {
      id: "m3-e3",
      russian: "Что ты делаешь?",
      targetWords: ["Was", "machst", "du", "da?"],
      difficulty: "easy",
      explanation: "Was (Что) начинает специальный вопрос.",
    },
    // Medium
    {
      id: "m3-m1",
      russian: "Откуда ты знаешь этот адрес?",
      targetWords: ["Woher", "weißt", "du", "diese", "Adresse?"],
      difficulty: "medium",
      explanation: "Woher означает направление «откуда».",
    },
    {
      id: "m3-m2",
      russian: "Почему ты мне не отвечаешь?",
      targetWords: ["Warum", "antwortest", "du", "mir", "nicht?"],
      difficulty: "medium",
      explanation: "Отрицание nicht ставится в конец предложения.",
    },
    // Hard
    {
      id: "m3-h1",
      russian: "Скажи мне, пожалуйста, когда начинается этот урок?",
      targetWords: ["Sag", "mir", "bitte,", "wann", "dieser", "Unterricht", "beginnt."],
      difficulty: "hard",
      explanation: "Косвенный вопрос с wann: глагол начинается (beginnt) отправляется в конец придаточного.",
    },
  ],

  // Модуль 9: Семья
  9: [
    // Easy
    {
      id: "m9-e1",
      russian: "Это моя мама.",
      targetWords: ["Das", "ist", "meine", "Mutter."],
      difficulty: "easy",
      explanation: "Женский род требует окончания -e: meine Mutter.",
    },
    {
      id: "m9-e2",
      russian: "Мой брат дома.",
      targetWords: ["Mein", "Bruder", "ist", "zu", "Hause."],
      difficulty: "easy",
      explanation: "Устойчивое выражение: zu Hause (дома).",
    },
    // Medium
    {
      id: "m9-m1",
      russian: "У моих родителей есть большая собака.",
      targetWords: ["Meine", "Eltern", "haben", "einen", "großen", "Hund."],
      difficulty: "medium",
      explanation: "Винительный падеж мужского рода: einen großen Hund.",
    },
    // Hard
    {
      id: "m9-h1",
      russian: "Моя сестра учится в Берлине уже два года.",
      targetWords: ["Meine", "Schwester", "studiert", "schon", "zwei", "Jahre", "in", "Berlin."],
      difficulty: "hard",
      explanation: "Обстоятельство времени (zwei Jahre) ставится перед обстоятельством места (in Berlin).",
    },
  ],

  // Модуль 13: Магазин и деньги
  13: [
    // Easy
    {
      id: "m13-e1",
      russian: "Сколько это стоит?",
      targetWords: ["Wie", "viel", "kostet", "das?"],
      difficulty: "easy",
      explanation: "Стандартная фраза для покупок: Wie viel kostet das?",
    },
    {
      id: "m13-e2",
      russian: "Это слишком дорого.",
      targetWords: ["Das", "ist", "zu", "teuer."],
      difficulty: "easy",
      explanation: "zu перед прилагательным означает «слишком».",
    },
    // Medium
    {
      id: "m13-m1",
      russian: "Я хочу заплатить картой.",
      targetWords: ["Ich", "möchte", "mit", "Karte", "bezahlen."],
      difficulty: "medium",
      explanation: "С предлогом mit: mit Karte bezahlen.",
    },
    // Hard
    {
      id: "m13-h1",
      russian: "Где я могу найти свежие фрукты и овощи?",
      targetWords: ["Wo", "kann", "ich", "frisches", "Obst", "und", "Gemüse", "finden?"],
      difficulty: "hard",
      explanation: "Модальная рамка: kann ... finden.",
    },
  ],

  // Модуль 14: Кафе и напитки
  14: [
    // Easy
    {
      id: "m14-e1",
      russian: "Я пью черный кофе.",
      targetWords: ["Ich", "trinke", "schwarzen", "Kaffee."],
      difficulty: "easy",
      explanation: "Мужской род в Akkusativ: schwarzen Kaffee.",
    },
    {
      id: "m14-e2",
      russian: "Один чай, пожалуйста.",
      targetWords: ["Einen", "Tee,", "bitte", "sehr."],
      difficulty: "easy",
      explanation: "При заказе используется винительный падеж: Einen Tee.",
    },
    // Medium
    {
      id: "m14-m1",
      russian: "Мы хотим заказать столик у окна.",
      targetWords: ["Wir", "möchten", "einen", "Tisch", "am", "Fenster", "bestellen."],
      difficulty: "medium",
      explanation: "am Fenster = an dem Fenster (у окна).",
    },
    // Hard
    {
      id: "m14-h1",
      russian: "Принесите нам, пожалуйста, счет и меню десертов.",
      targetWords: ["Bringen", "Sie", "uns", "bitte", "die", "Rechnung", "und", "Dessertkarte."],
      difficulty: "hard",
      explanation: "Повелительная вежливая форма: Bringen Sie uns bitte...",
    },
  ],
};

/**
 * Automatically creates natural, grammatically correct sentences
 * for any module using its vocabulary cards.
 */
export function generateDynamicSentences(
  module: VocabModule,
  difficulty: SentenceDifficulty,
): SentenceChallenge[] {
  const cards = module.cards;
  if (!cards || cards.length === 0) return [];

  const nouns = cards.filter((c) => c.partOfSpeech === "noun" || c.article);
  const verbs = cards.filter((c) => c.partOfSpeech === "verb");
  const adjectives = cards.filter((c) => c.partOfSpeech === "adjective");
  const otherWords = cards.filter((c) => !["noun", "verb"].includes(c.partOfSpeech));

  const generated: SentenceChallenge[] = [];

  const addChallenge = (
    idSuffix: string,
    russian: string,
    targetWords: string[],
    diff: SentenceDifficulty,
    explanation?: string,
  ) => {
    generated.push({
      id: `gen-${module.id}-${diff}-${idSuffix}`,
      russian,
      targetWords,
      difficulty: diff,
      explanation:
        explanation ||
        (diff === "easy"
          ? "Простой порядок слов: подлежащее, затем сказуемое на втором месте."
          : diff === "medium"
            ? "Обратите внимание на порядок отрицания и позицию глагола."
            : "Сложная конструкция с согласованием падежей и позицией глагола."),
    });
  };

  // Generate Easy sentences (3-4 words)
  if (difficulty === "easy") {
    // Pattern 1: Ich habe [noun]
    nouns.slice(0, 3).forEach((n, idx) => {
      const art = n.article === "der" ? "einen" : n.article === "die" ? "eine" : "ein";
      const ruArt = n.article === "der" ? "этот" : n.article === "die" ? "эту" : "это";
      addChallenge(
        `have-${idx}`,
        `У меня есть ${n.translation.split(/[\/,;(]/)[0].trim()}.`,
        ["Ich", "habe", art, `${n.word}.`],
        "easy",
        `В немецком «у меня есть» передаётся фразой Ich habe с винительным падежом (${art} ${n.word}).`,
      );
    });

    // Pattern 2: Das ist [adjective] / [noun]
    if (adjectives.length > 0) {
      adjectives.slice(0, 2).forEach((adj, idx) => {
        addChallenge(
          `das-ist-${idx}`,
          `Это очень ${adj.translation.split(/[\/,;(]/)[0].trim()}.`,
          ["Das", "ist", "sehr", `${adj.word}.`],
          "easy",
          "Сказуемое ist связывает подлежащее Das с прилагательным.",
        );
      });
    }

    // Pattern 3: Wir [verb] hier
    if (verbs.length > 0) {
      verbs.slice(0, 2).forEach((v, idx) => {
        addChallenge(
          `wir-verb-${idx}`,
          `Мы ${v.translation.split(/[\/,;(]/)[0].trim()} здесь.`,
          ["Wir", v.word, "jetzt", "hier."],
          "easy",
          "Личное местоимение Wir согласуется с глаголом в форме инфинитива.",
        );
      });
    }
  }

  // Generate Medium sentences (4-6 words)
  if (difficulty === "medium") {
    // Pattern 1: Modal verb + noun + verb
    nouns.slice(0, 3).forEach((n, idx) => {
      const art = n.article === "der" ? "diesen" : n.article === "die" ? "diese" : "dieses";
      addChallenge(
        `modal-${idx}`,
        `Я хочу увидеть ${n.translation.split(/[\/,;(]/)[0].trim()}.`,
        ["Ich", "möchte", art, n.word, "sehen."],
        "medium",
        "Рамочная конструкция: спрягаемый модальный глагол möchte на втором месте, инфинитив sehen в конце.",
      );
    });

    // Pattern 2: Negation: Wir brauchen ... nicht
    if (nouns.length > 1) {
      const n = nouns[1];
      addChallenge(
        `neg-${n.id}`,
        `Нам сейчас не нужен ${n.translation.split(/[\/,;(]/)[0].trim()}.`,
        ["Wir", "brauchen", n.word, "jetzt", "nicht."],
        "medium",
        "Отрицание nicht относится ко всему действию и ставится в конец смысловой группы.",
      );
    }

    // Pattern 3: Adjective + Noun
    if (adjectives.length > 0 && nouns.length > 0) {
      const adj = adjectives[0];
      const n = nouns[0];
      addChallenge(
        `adj-noun-${idxCount(generated)}`,
        `Это действительно хороший выбор.`,
        ["Das", "ist", "wirklich", "eine", "gute", "Sache."],
        "medium",
        "Прилагательное согласуется с существительным по роду и числу.",
      );
    }
  }

  // Generate Hard sentences (6-8 words)
  if (difficulty === "hard") {
    // Pattern 1: Time inversion: Heute können wir ...
    nouns.slice(0, 2).forEach((n, idx) => {
      const art = n.article === "der" ? "den" : n.article === "die" ? "die" : "das";
      addChallenge(
        `hard-inv-${idx}`,
        `Сегодня мы точно можем взять ${n.translation.split(/[\/,;(]/)[0].trim()}.`,
        ["Heute", "können", "wir", "sicher", art, n.word, "nehmen."],
        "hard",
        "Инверсия: на первом месте обстоятельство времени Heute, глагол können на втором, подлежащее wir на третьем, а инфинитив nehmen в конце.",
      );
    });

    // Pattern 2: Question: Warum hast du ...
    if (nouns.length > 0) {
      const n = nouns[0];
      const art = n.article === "der" ? "diesen" : n.article === "die" ? "diese" : "dieses";
      addChallenge(
        `hard-q-${idxCount(generated)}`,
        `Почему ты не берешь с собой ${n.translation.split(/[\/,;(]/)[0].trim()}?`,
        ["Warum", "nimmst", "du", art, n.word, "nicht", "mit?"],
        "hard",
        "Отделяемая приставка mit уходит в самый конец вопросительного предложения.",
      );
    }

    // Pattern 3: Subordinate clause: Ich weiß, dass ...
    if (nouns.length > 1) {
      const n = nouns[1];
      addChallenge(
        `hard-sub-${idxCount(generated)}`,
        `Я знаю, что этот объект важен.`,
        ["Ich", "weiß,", "dass", "dieses", "Thema", "sehr", "wichtig", "ist."],
        "hard",
        "В придаточном предложении с союзом dass сказуемое ist уходит на самое последнее место.",
      );
    }
  }

  return generated;
}

function idxCount(list: unknown[]): number {
  return list.length + 1;
}

/**
 * Returns sentence challenges for a module based on the requested difficulty.
 * Combines curated sentences with dynamic ones to ensure plentiful content.
 */
export function getSentenceChallengesForModule(
  module: VocabModule,
  difficulty: SentenceDifficulty,
): SentenceChallenge[] {
  const curated = (CURATED_MODULE_SENTENCES[module.id] ?? []).filter(
    (item) => item.difficulty === difficulty,
  );

  const dynamic = generateDynamicSentences(module, difficulty);

  const combined = [...curated, ...dynamic];
  if (combined.length > 0) return combined;

  // Fallback if module has very few words: generic core sentences tailored to difficulty
  if (difficulty === "easy") {
    return [
      {
        id: `fb-e1-${module.id}`,
        russian: "У меня есть этот билет.",
        targetWords: ["Ich", "habe", "dieses", "Ticket."],
        difficulty: "easy",
        explanation: "Порядок слов: подлежащее Ich, глагол habe, дополнение dieses Ticket.",
      },
      {
        id: `fb-e2-${module.id}`,
        russian: "Мы говорим очень хорошо.",
        targetWords: ["Wir", "sprechen", "sehr", "gut."],
        difficulty: "easy",
        explanation: "Глагол sprechen стоит на втором месте.",
      },
      {
        id: `fb-e3-${module.id}`,
        russian: "Это наш новый друг.",
        targetWords: ["Das", "ist", "unser", "Freund."],
        difficulty: "easy",
        explanation: "Притяжательное местоимение unser согласуется с существительным Freund.",
      },
    ];
  } else if (difficulty === "medium") {
    return [
      {
        id: `fb-m1-${module.id}`,
        russian: "Мы хотим сегодня пойти домой.",
        targetWords: ["Wir", "wollen", "heute", "nach", "Hause", "gehen."],
        difficulty: "medium",
        explanation: "Рамочная конструкция с модальным глаголом wollen и инфинитивом gehen.",
      },
      {
        id: `fb-m2-${module.id}`,
        russian: "У него совсем нет свободного времени.",
        targetWords: ["Er", "hat", "gar", "keine", "freie", "Zeit."],
        difficulty: "medium",
        explanation: "keine Zeit — отрицание существительного женского рода.",
      },
    ];
  } else {
    return [
      {
        id: `fb-h1-${module.id}`,
        russian: "К сожалению, сегодня я не могу вам помочь.",
        targetWords: ["Leider", "kann", "ich", "Ihnen", "heute", "nicht", "helfen."],
        difficulty: "hard",
        explanation: "Инверсия: вводное слово Leider на 1-м месте, глагол kann на 2-м, инфинитив helfen в конце.",
      },
      {
        id: `fb-h2-${module.id}`,
        russian: "Почему вы не сказали мне об этом раньше?",
        targetWords: ["Warum", "haben", "Sie", "mir", "das", "nicht", "gesagt?"],
        difficulty: "hard",
        explanation: "Прошедшее время Perfekt: haben на втором месте, причастие gesagt в конце.",
      },
    ];
  }
}

/**
 * Prepares a sentence round with:
 * - Target words (clean, ordered)
 * - PLUS exactly equal number of distractor words (50/50 ratio!)
 * - All shuffled into a set of interactive tiles
 */
export function prepareSentenceRound(
  challenge: SentenceChallenge,
  moduleCards: VocabCard[],
): PreparedSentenceRound {
  const targetWords = challenge.targetWords.map((token) => token.trim()).filter(Boolean);
  const correctTokens = targetWords.map((word) => ({
    raw: word,
    clean: cleanToken(word),
  }));

  const correctCleanSet = new Set(correctTokens.map((t) => t.clean));

  // Extract distractor candidates from module cards
  const candidateDistractors: string[] = [];
  moduleCards.forEach((c) => {
    const word = c.word.trim();
    const clean = cleanToken(word);
    if (!correctCleanSet.has(clean) && clean.length > 1) {
      candidateDistractors.push(word);
    }
    // Also include article if exists
    if (c.article && !correctCleanSet.has(c.article.toLowerCase())) {
      candidateDistractors.push(c.article);
    }
  });

  // Additional common core distractors if module is small
  const coreFallbackDistractors = [
    "nicht",
    "auch",
    "sehr",
    "nur",
    "heute",
    "jetzt",
    "hier",
    "dort",
    "immer",
    "aber",
    "schon",
    "kein",
    "mein",
    "dein",
    "sein",
    "wir",
    "ihr",
    "sie",
    "du",
    "er",
    "haben",
    "sein",
    "werden",
    "können",
    "wollen",
    "müssen",
  ];

  const pool = [
    ...shuffle([...new Set(candidateDistractors)]),
    ...shuffle(coreFallbackDistractors.filter((w) => !correctCleanSet.has(cleanToken(w)))),
  ];

  // Pick EXACTLY the same number of distractors as correct words (50% correct, 50% distractors)
  const requiredDistractorCount = correctTokens.length;
  const pickedDistractors = pool.slice(0, requiredDistractorCount);

  // If pool didn't have enough, fill up to requiredDistractorCount
  while (pickedDistractors.length < requiredDistractorCount) {
    pickedDistractors.push(`Wort${pickedDistractors.length + 1}`);
  }

  // Create tiles
  const correctTiles: SentenceTile[] = targetWords.map((text, idx) => ({
    id: `correct-${idx}-${cleanToken(text)}`,
    text,
    isDistractor: false,
  }));

  const distractorTiles: SentenceTile[] = pickedDistractors.map((text, idx) => ({
    id: `distractor-${idx}-${cleanToken(text)}`,
    text,
    isDistractor: true,
  }));

  const allTiles = shuffle([...correctTiles, ...distractorTiles]);

  return {
    challenge,
    tiles: allTiles,
    correctCount: correctTiles.length,
    distractorCount: distractorTiles.length,
  };
}
