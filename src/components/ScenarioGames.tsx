import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabCard, VocabModule } from "../lib/vocab";
import { readProfileItem, writeProfileItem } from "../lib/profileStorage";
import { Icon } from "./Icon";

export type ScenarioGameId = "dialogue" | "quest" | "error-editor";
type TaskKind = "choice" | "text" | "order";
type Task = {
  id: string;
  kind: TaskKind;
  card: VocabCard;
  prompt: string;
  answer: string;
  explanation: string;
  hint: string;
  choices?: string[];
  line?: string;
  scene?: string;
  skill: "vocabulary" | "grammar" | "speaking";
  recordProgress?: boolean;
  revisit?: boolean;
};
type DialogueTurn = {
  id: string;
  line: string;
  situation: string;
  answer: string;
  distractors: string[];
  explanation: string;
  hint: string;
};
type DialogueVariant = { id: string; title: string; turns: DialogueTurn[] };
type ErrorItem = {
  id: string;
  sentence: string;
  correction: string;
  explanation: string;
  hint: string;
  distractors: string[];
};
type QuestRoute = {
  id: string;
  title: string;
  situation: string;
  line: string;
  reply: string;
  replyOptions: string[];
  sentence: string;
  wrongSentence: string;
  correctedSentence: string;
  correctionOptions: string[];
};

const dialogueVariants: DialogueVariant[] = [
  {
    id: "cafe-morning",
    title: "Утренний заказ в кафе",
    turns: [
      {
        id: "greeting",
        line: "Guten Morgen! Was möchten Sie?",
        situation: "Вы хотите заказать напиток.",
        answer: "Einen Kaffee, bitte.",
        distractors: ["Ich heiße Kaffee.", "Wo ist mein Zimmer?", "Ich komme aus Berlin."],
        explanation: "В кафе на вопрос Was möchten Sie? называют заказ: Einen Kaffee, bitte.",
        hint: "Назовите напиток и добавьте вежливое bitte.",
      },
      {
        id: "something-else",
        line: "Möchten Sie noch etwas?",
        situation: "Бариста спрашивает, нужно ли что-нибудь ещё.",
        answer: "Ja, ein Stück Kuchen, bitte.",
        distractors: ["Nein, ich bin ein Stück.", "Wo fährt der Zug ab?", "Das Zimmer ist groß."],
        explanation: "Ein Stück Kuchen — обычный ответ, когда вы хотите добавить десерт к заказу.",
        hint: "Начните с Ja и назовите десерт.",
      },
      {
        id: "takeaway",
        line: "Möchten Sie hier essen oder zum Mitnehmen?",
        situation: "Вас спрашивают, где вы будете есть.",
        answer: "Zum Mitnehmen, bitte.",
        distractors: ["Ich nehme den Zug.", "Das macht acht Nächte.", "Ich bin hier essen."],
        explanation: "Zum Mitnehmen означает «с собой».",
        hint: "Выберите короткую фразу со значением «с собой».",
      },
      {
        id: "pay",
        line: "Das macht acht Euro.",
        situation: "Бариста называет сумму.",
        answer: "Hier, bitte. Danke.",
        distractors: ["Ich möchte ein Zimmer.", "Acht Uhr, bitte.", "Der Kaffee fährt."],
        explanation: "Hier, bitte — естественный ответ при передаче денег или карты.",
        hint: "Ответьте, передавая оплату.",
      },
    ],
  },
  {
    id: "cafe-lunch",
    title: "Обед в ресторане",
    turns: [
      {
        id: "order-food",
        line: "Was darf es sein?",
        situation: "Официант принимает заказ.",
        answer: "Eine Suppe und ein Wasser, bitte.",
        distractors: ["Ich bin eine Suppe.", "Wann fährt das Wasser?", "Das Zimmer ist frei."],
        explanation: "Чтобы заказать, перечислите блюда и добавьте bitte.",
        hint: "Назовите блюдо и напиток.",
      },
      {
        id: "taste",
        line: "Ist alles in Ordnung?",
        situation: "Официант спрашивает, всё ли хорошо.",
        answer: "Ja, danke. Es schmeckt sehr gut.",
        distractors: [
          "Ja, ich heiße gut.",
          "Nein, ich fahre nach Berlin.",
          "Das kostet sieben Uhr.",
        ],
        explanation: "Es schmeckt sehr gut значит «очень вкусно».",
        hint: "Скажите, что еда вкусная.",
      },
      {
        id: "bill",
        line: "Möchten Sie die Rechnung?",
        situation: "Вы закончили есть и хотите оплатить.",
        answer: "Ja, bitte.",
        distractors: ["Nein, die Rechnung trinkt Kaffee.", "Ich habe ein Zimmer.", "Um neun Uhr."],
        explanation: "Ja, bitte подтверждает, что счёт нужен.",
        hint: "Коротко подтвердите просьбу.",
      },
      {
        id: "card",
        line: "Bar oder mit Karte?",
        situation: "Вас спрашивают, как вы будете платить.",
        answer: "Mit Karte, bitte.",
        distractors: ["Mit Suppe, bitte.", "Die Karte fährt um acht.", "Ich bin Karte."],
        explanation: "Mit Karte — «картой».",
        hint: "Выберите вариант оплаты картой.",
      },
    ],
  },
  {
    id: "hotel-checkin",
    title: "Заселение в отель",
    turns: [
      {
        id: "reservation",
        line: "Guten Abend. Haben Sie eine Reservierung?",
        situation: "Вы приехали на стойку регистрации.",
        answer: "Ja, auf den Namen Müller.",
        distractors: [
          "Ja, ich möchte Kaffee trinken.",
          "Der Zug heißt Müller.",
          "Ich habe eine Jacke.",
        ],
        explanation: "На вопрос о брони можно ответить: Ja, auf den Namen Müller.",
        hint: "Назовите фамилию бронирования.",
      },
      {
        id: "nights",
        line: "Für wie viele Nächte?",
        situation: "Администратор уточняет длительность проживания.",
        answer: "Für zwei Nächte, bitte.",
        distractors: [
          "Um zwei Euro, bitte.",
          "Ich schlafe im Zug.",
          "Das Frühstück ist eine Nacht.",
        ],
        explanation: "Für zwei Nächte означает «на две ночи».",
        hint: "Назовите количество ночей.",
      },
      {
        id: "breakfast-time",
        line: "Das Frühstück ist ab sieben Uhr.",
        situation: "Администратор сообщает время завтрака.",
        answer: "Vielen Dank.",
        distractors: ["Ich habe sieben Zimmer.", "Nein, ich bin Frühstück.", "Eine Karte, bitte."],
        explanation: "Vielen Dank — вежливая благодарность за информацию.",
        hint: "Поблагодарите администратора.",
      },
      {
        id: "luggage",
        line: "Brauchen Sie Hilfe mit dem Gepäck?",
        situation: "Вам предлагают помочь с багажом.",
        answer: "Nein, danke. Ich schaffe das.",
        distractors: [
          "Das Gepäck kostet acht Uhr.",
          "Ja, ich heiße Gepäck.",
          "Ich fahre einen Kaffee.",
        ],
        explanation: "Ich schaffe das — «я справлюсь».",
        hint: "Вежливо откажитесь и скажите, что справитесь.",
      },
    ],
  },
  {
    id: "hotel-morning",
    title: "Утро в отеле",
    turns: [
      {
        id: "drink",
        line: "Möchten Sie Kaffee oder Tee?",
        situation: "Официант предлагает напиток за завтраком.",
        answer: "Einen Kaffee, bitte.",
        distractors: ["Ich heiße Tee.", "Das Zimmer fährt.", "Sieben Nächte, bitte."],
        explanation: "Einen Kaffee, bitte — естественный заказ напитка.",
        hint: "Попросите кофе вежливой фразой.",
      },
      {
        id: "train-time",
        line: "Um wie viel Uhr fährt Ihr Zug?",
        situation: "Администратор спрашивает о времени поезда.",
        answer: "Um neun Uhr.",
        distractors: ["Mit Karte, bitte.", "Ich möchte ein Zimmer.", "Der Zug heißt neun."],
        explanation: "Um neun Uhr сообщает время отправления.",
        hint: "Ответьте временем.",
      },
      {
        id: "taxi",
        line: "Benötigen Sie ein Taxi?",
        situation: "Вам предлагают вызвать такси.",
        answer: "Ja, bitte. Zum Bahnhof.",
        distractors: ["Ja, ich bin ein Bahnhof.", "Für zwei Nächte.", "Das Taxi schmeckt gut."],
        explanation: "Zum Bahnhof указывает, куда нужно такси.",
        hint: "Согласитесь и назовите место назначения.",
      },
      {
        id: "goodbye",
        line: "Ich wünsche Ihnen einen schönen Tag.",
        situation: "Администратор желает вам хорошего дня.",
        answer: "Danke, Ihnen auch.",
        distractors: ["Ich habe ein Ticket.", "Der Tag kostet acht Euro.", "Nein, ein Zimmer."],
        explanation: "Danke, Ihnen auch — «спасибо, и вам того же».",
        hint: "Поблагодарите и пожелайте того же в ответ.",
      },
    ],
  },
];

const errorItems: ErrorItem[] = [
  {
    id: "ich-gehen",
    sentence: "Ich gehen heute ins Café.",
    correction: "Ich gehe heute ins Café.",
    explanation: "С ich глагол gehen принимает форму gehe.",
    hint: "Проверьте окончание глагола после ich.",
    distractors: ["Ich geht heute ins Café.", "Ich gehst heute ins Café."],
  },
  {
    id: "wir-faehrt",
    sentence: "Wir fährt morgen nach Berlin.",
    correction: "Wir fahren morgen nach Berlin.",
    explanation: "С wir нужна форма fahren, а не форма fährt для er/sie/es.",
    hint: "Подлежащее — wir.",
    distractors: ["Wir fährst morgen nach Berlin.", "Wir fahren morgen nach Berlin ab."],
  },
  {
    id: "ein-kaffee",
    sentence: "Ich möchte ein Kaffee.",
    correction: "Ich möchte einen Kaffee.",
    explanation:
      "Kaffee — существительное мужского рода: der Kaffee. В этой фразе нужен Akkusativ — einen Kaffee.",
    hint: "Проверьте род слова Kaffee и падеж после möchte.",
    distractors: ["Ich möchte eine Kaffee.", "Ich möchte einem Kaffee."],
  },
  {
    id: "das-jacke",
    sentence: "Das Jacke ist sehr schön.",
    correction: "Die Jacke ist sehr schön.",
    explanation: "Jacke — существительное женского рода: die Jacke.",
    hint: "Вспомните артикль слова Jacke.",
    distractors: ["Der Jacke ist sehr schön.", "Die Jacke sind sehr schön."],
  },
  {
    id: "verb-second",
    sentence: "Heute ich fahre mit dem Bus.",
    correction: "Heute fahre ich mit dem Bus.",
    explanation:
      "В немецком повествовательном предложении спрягаемый глагол занимает второе место.",
    hint: "После Heute поставьте спрягаемый глагол.",
    distractors: ["Heute fahre mit ich dem Bus.", "Heute ich mit dem Bus fahre."],
  },
  {
    id: "separable-verb",
    sentence: "Er ruft seine Mutter an morgen.",
    correction: "Er ruft morgen seine Mutter an.",
    explanation:
      "В этом предложении обстоятельство времени обычно ставится перед отделяемой приставкой в конце.",
    hint: "Приставка an остаётся в конце; переставьте morgen ближе к середине.",
    distractors: ["Er anruft morgen seine Mutter.", "Er ruft an seine Mutter morgen."],
  },
  {
    id: "ein-zimmer",
    sentence: "Sie haben eine Zimmer.",
    correction: "Sie haben ein Zimmer.",
    explanation: "Zimmer — существительное среднего рода: ein Zimmer.",
    hint: "Проверьте род слова Zimmer.",
    distractors: ["Sie haben einen Zimmer.", "Sie haben einem Zimmer."],
  },
  {
    id: "modal-infinitive",
    sentence: "Ich kann gut schwimme.",
    correction: "Ich kann gut schwimmen.",
    explanation: "После модального глагола kann смысловой глагол стоит в инфинитиве: schwimmen.",
    hint: "После kann нужен инфинитив.",
    distractors: ["Ich kann gut schwimmt.", "Ich kann gut geschwommen."],
  },
];

const questRoutes: QuestRoute[] = [
  {
    id: "city",
    title: "Найти вокзал",
    situation: "Вы в незнакомом городе и ищете вокзал.",
    line: "Entschuldigung, wo ist der Bahnhof?",
    reply: "Gehen Sie geradeaus.",
    replyOptions: ["Gehen Sie geradeaus.", "Ich möchte ein Zimmer.", "Das macht acht Euro."],
    sentence: "Ich fahre heute mit dem Bus.",
    wrongSentence: "Heute ich fahre mit dem Bus.",
    correctedSentence: "Heute fahre ich mit dem Bus.",
    correctionOptions: [
      "Heute fahre ich mit dem Bus.",
      "Heute fahre mit ich dem Bus.",
      "Heute ich mit dem Bus fahre.",
    ],
  },
  {
    id: "travel",
    title: "Заселиться в отель",
    situation: "Вы приехали заселиться в отель.",
    line: "Haben Sie eine Reservierung?",
    reply: "Ja, auf den Namen Müller.",
    replyOptions: ["Ja, auf den Namen Müller.", "Zum Mitnehmen, bitte.", "Ich fahre um neun Uhr."],
    sentence: "Wir fahren morgen nach Berlin.",
    wrongSentence: "Wir fährt morgen nach Berlin.",
    correctedSentence: "Wir fahren morgen nach Berlin.",
    correctionOptions: [
      "Wir fahren morgen nach Berlin.",
      "Wir fährst morgen nach Berlin.",
      "Wir fahren nach Berlin morgen ab.",
    ],
  },
  {
    id: "cafe",
    title: "Заказать в кафе",
    situation: "Бариста принимает ваш заказ.",
    line: "Was möchten Sie trinken?",
    reply: "Einen Kaffee, bitte.",
    replyOptions: ["Einen Kaffee, bitte.", "Ich heiße Kaffee.", "Das Zimmer ist frei."],
    sentence: "Ich trinke gern Tee.",
    wrongSentence: "Ich möchte ein Kaffee.",
    correctedSentence: "Ich möchte einen Kaffee.",
    correctionOptions: [
      "Ich möchte einen Kaffee.",
      "Ich möchte eine Kaffee.",
      "Ich möchte einem Kaffee.",
    ],
  },
  {
    id: "shopping",
    title: "Найти куртку",
    situation: "Вы ищете одежду в магазине.",
    line: "Kann ich Ihnen helfen?",
    reply: "Ja, ich suche eine Jacke.",
    replyOptions: [
      "Ja, ich suche eine Jacke.",
      "Für zwei Nächte, bitte.",
      "Ich möchte die Rechnung.",
    ],
    sentence: "Die Jacke ist sehr schön.",
    wrongSentence: "Das Jacke ist sehr schön.",
    correctedSentence: "Die Jacke ist sehr schön.",
    correctionOptions: [
      "Die Jacke ist sehr schön.",
      "Der Jacke ist sehr schön.",
      "Die Jacke sind sehr schön.",
    ],
  },
];

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const normalized = (value: string) =>
  value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]/gu, "");

function makeTaskCard(
  module: VocabModule,
  id: string,
  word: string,
  translation: string,
): VocabCard {
  return {
    id: `scenario-${module.id}-${id}`,
    moduleId: module.id,
    word,
    article: null,
    transcription: "",
    translation,
    partOfSpeech: "other",
    phoneticRuleId: null,
  };
}

function historyFor(gameId: ScenarioGameId, moduleId: number) {
  try {
    const saved: unknown = JSON.parse(readProfileItem("linguaplay-recent-game-sessions") || "[]");
    if (!Array.isArray(saved)) return [] as Array<{ ids: string[]; variantId?: string }>;
    return saved.filter(
      (entry): entry is { ids: string[]; gameId: string; moduleId: number; variantId?: string } =>
        Boolean(
          entry &&
          typeof entry === "object" &&
          (entry as { gameId?: unknown }).gameId === gameId &&
          (entry as { moduleId?: unknown }).moduleId === moduleId &&
          Array.isArray((entry as { ids?: unknown }).ids),
        ),
    );
  } catch {
    return [] as Array<{ ids: string[]; variantId?: string }>;
  }
}

function chooseVariant<T extends { id: string }>(variants: T[], recent: string[]) {
  const candidates = variants.filter((item) => !recent.slice(-3).includes(item.id));
  return shuffle(candidates.length ? candidates : variants)[0];
}

function tasksFor(gameId: ScenarioGameId, module: VocabModule, variantId: string): Task[] {
  if (gameId === "dialogue") {
    const variant = dialogueVariants.find((item) => item.id === variantId) ?? dialogueVariants[0];
    return variant.turns.map((turn) => {
      const card = makeTaskCard(module, `${variant.id}-${turn.id}`, turn.answer, turn.situation);
      return {
        id: `${variant.id}-${turn.id}`,
        kind: "choice",
        card,
        prompt: turn.situation,
        line: turn.line,
        answer: turn.answer,
        choices: shuffle([turn.answer, ...turn.distractors]),
        explanation: turn.explanation,
        hint: turn.hint,
        skill: "speaking",
        scene: variant.title,
        recordProgress: false,
      };
    });
  }

  if (gameId === "error-editor") {
    const history = historyFor(gameId, module.id);
    const used = new Set(history.slice(-3).flatMap((entry) => entry.ids));
    const unseen = errorItems.filter((item) => !used.has(item.id));
    const selected = shuffle(unseen.length >= 4 ? unseen : errorItems).slice(0, 4);
    return selected.map((item) => ({
      id: item.id,
      kind: "choice",
      card: makeTaskCard(module, `error-${item.id}`, item.correction, item.sentence),
      prompt: "Выберите исправленный вариант.",
      line: item.sentence,
      answer: item.correction,
      choices: shuffle([item.correction, ...item.distractors]),
      explanation: item.explanation,
      hint: item.hint,
      skill: "grammar",
      scene: "Редактор сообщений",
      recordProgress: false,
    }));
  }

  const route = questRoutes.find((item) => item.id === variantId) ?? questRoutes[0];
  const history = historyFor(gameId, module.id);
  const usedCards = new Set(history.slice(-3).flatMap((entry) => entry.ids));
  const uniqueCards = module.cards.filter((item) => item.word.trim() && item.translation.trim());
  const unseenCards = uniqueCards.filter((item) => !usedCards.has(`word:${item.id}`));
  const wordCard = shuffle(unseenCards.length ? unseenCards : uniqueCards)[0];
  const word = wordCard.article ? `${wordCard.article} ${wordCard.word}` : wordCard.word;
  return [
    {
      id: `word:${wordCard.id}`,
      kind: "text",
      card: wordCard,
      prompt: `Как сказать по-немецки: «${wordCard.translation}»?`,
      answer: word,
      explanation: `${word} — «${wordCard.translation}».`,
      hint: `Первая буква: ${word[0]?.toLocaleUpperCase("de") ?? "?"}…`,
      skill: "vocabulary",
      scene: route.situation,
      recordProgress: true,
    },
    {
      id: `dialogue:${route.id}`,
      kind: "choice",
      card: makeTaskCard(module, `quest-${route.id}-dialogue`, route.reply, route.line),
      prompt: route.situation,
      line: route.line,
      answer: route.reply,
      choices: shuffle(route.replyOptions),
      explanation: `Такой ответ подходит собеседнику: «${route.reply}»`,
      hint: "Выберите реплику, которая отвечает на вопрос собеседника.",
      skill: "speaking",
      scene: route.title,
      recordProgress: false,
    },
    {
      id: `order:${route.id}`,
      kind: "order",
      card: makeTaskCard(module, `quest-${route.id}-order`, route.sentence, "Порядок слов"),
      prompt: "Соберите фразу в правильном порядке.",
      answer: route.sentence,
      explanation: `Правильная фраза: «${route.sentence}»`,
      hint: "Спрягаемый глагол обычно стоит на втором месте.",
      skill: "grammar",
      scene: route.title,
      recordProgress: false,
    },
    {
      id: `correction:${route.id}`,
      kind: "choice",
      card: makeTaskCard(
        module,
        `quest-${route.id}-correction`,
        route.correctedSentence,
        route.wrongSentence,
      ),
      prompt: "Найдите исправленный вариант.",
      line: route.wrongSentence,
      answer: route.correctedSentence,
      choices: shuffle(route.correctionOptions),
      explanation: `Исправленная фраза: «${route.correctedSentence}»`,
      hint: "Проверьте артикль или форму глагола.",
      skill: "grammar",
      scene: route.title,
      recordProgress: false,
    },
  ];
}

function initialScenario(gameId: ScenarioGameId, module: VocabModule) {
  const history = historyFor(gameId, module.id);
  const recentVariants = history.map((entry) => entry.variantId ?? "");
  if (gameId === "dialogue") {
    const titledForHotel = /hotel|reise|travel|отел|путешеств|аэропорт/i.test(module.title);
    const candidates = dialogueVariants.filter((item) =>
      titledForHotel ? item.id.startsWith("hotel-") : item.id.startsWith("cafe-"),
    );
    const available = candidates.some((item) => !recentVariants.slice(-3).includes(item.id))
      ? candidates
      : dialogueVariants;
    const variant = chooseVariant(available, recentVariants);
    return { variantId: variant.id, title: variant.title };
  }
  if (gameId === "quest") {
    const route = chooseVariant(questRoutes, recentVariants);
    return { variantId: route.id, title: route.title };
  }
  const recentItems = new Set(history.slice(-3).flatMap((entry) => entry.ids));
  const available = errorItems.filter((item) => !recentItems.has(item.id));
  return {
    variantId: "editor",
    title: "Редактор сообщений",
    availableIds: available.map((item) => item.id),
  };
}

type Props = {
  gameId: ScenarioGameId;
  module: VocabModule;
  onExit: () => void;
  onAnswer: (
    card: VocabCard,
    correct: boolean,
    confusedWith?: string,
    telemetry?: {
      attemptCount: number;
      firstTryCorrect: boolean;
      hintUsed: boolean;
      durationMs: number;
      variantId?: string;
      skill?: string;
      recordProgress?: boolean;
      sessionTotal?: number;
    },
  ) => void;
  onSkip: (card: VocabCard) => void;
  onComplete: (summary?: { score: number; total: number; timeLabel?: string } | number) => void;
  onNextGame?: () => void;
};

export function ScenarioGame({ gameId, module, onExit, onAnswer, onSkip, onComplete, onNextGame }: Props) {
  const initial = useMemo(() => initialScenario(gameId, module), [gameId, module.id]);
  const initialTasks = useMemo(
    () =>
      gameId === "error-editor"
        ? tasksFor(gameId, module, initial.variantId).filter(
            (task) => initial.availableIds?.length === 0 || initial.availableIds?.includes(task.id),
          ).length >= 4
          ? tasksFor(gameId, module, initial.variantId)
              .filter(
                (task) =>
                  initial.availableIds?.length === 0 || initial.availableIds?.includes(task.id),
              )
              .slice(0, 4)
          : tasksFor(gameId, module, initial.variantId)
        : tasksFor(gameId, module, initial.variantId),
    [gameId, module, initial.variantId, initial.availableIds],
  );
  const [queue, setQueue] = useState(initialTasks);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const [tokens, setTokens] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [scorePulse, setScorePulse] = useState(0);
  const attempts = useRef<
    Record<string, { count: number; firstTryCorrect: boolean; hintUsed: boolean }>
  >({});
  const skipped = useRef(new Set<string>());
  const deferredReviews = useRef<Task[]>([]);
  const reviewAdded = useRef(false);
  const historySaved = useRef(false);
  const taskStartedAt = useRef(Date.now());
  const completionRef = useRef(onComplete);
  completionRef.current = onComplete;
  const task = queue[index];
  const done = index >= queue.length;
  const label = GAME_LABELS[gameId];
  const shuffledTokens = useMemo(
    () =>
      shuffle(task?.answer.split(/\s+/u).map((word, tokenIndex) => ({ word, tokenIndex })) ?? []),
    [task?.id],
  );
  const currentAttempts = task ? (attempts.current[task.id]?.count ?? 0) : 0;
  const resultTasks = initialTasks;
  const answered = resultTasks.filter((item) => (attempts.current[item.id]?.count ?? 0) > 0).length;
  const firstTryCorrect = resultTasks.filter(
    (item) => attempts.current[item.id]?.firstTryCorrect,
  ).length;
  const repeatedCount = resultTasks.filter(
    (item) => (attempts.current[item.id]?.count ?? 0) > 1,
  ).length;

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [done]);
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!done || historySaved.current) return;
    historySaved.current = true;
    const prior = historyFor(gameId, module.id) as Array<{
      gameId?: string;
      moduleId?: number;
      ids: string[];
      variantId?: string;
    }>;
    writeProfileItem(
      "linguaplay-recent-game-sessions",
      JSON.stringify([
        ...prior.slice(-29),
        {
          gameId,
          moduleId: module.id,
          variantId: initial.variantId,
          ids: initialTasks.map((item) => item.id),
        },
      ]),
    );
    completionRef.current({
      score: firstTryCorrect,
      total: initialTasks.length,
      timeLabel,
    });
  }, [done, firstTryCorrect, gameId, initial.variantId, initialTasks, module.id, timeLabel]);

  const resetForNext = () => {
    const nextIndex = index + 1;
    if (
      nextIndex === initialTasks.length &&
      deferredReviews.current.length &&
      !reviewAdded.current
    ) {
      reviewAdded.current = true;
      setQueue([...queue, ...deferredReviews.current.map((item) => ({ ...item, revisit: true }))]);
    }
    setIndex(nextIndex);
    setSelected("");
    setTyped("");
    setTokens([]);
    setFeedback(null);
    setHintVisible(false);
    setScorePulse((value) => value + 1);
    taskStartedAt.current = Date.now();
  };

  const answer = (value: string) => {
    if (!task || feedback) return;
    const correct = normalized(value) === normalized(task.answer);
    const previous = attempts.current[task.id] ?? {
      count: 0,
      firstTryCorrect: false,
      hintUsed: false,
    };
    const count = previous.count + 1;
    const firstCorrect = count === 1 && correct;
    attempts.current[task.id] = {
      count,
      firstTryCorrect: previous.count ? previous.firstTryCorrect : firstCorrect,
      hintUsed: previous.hintUsed || hintVisible,
    };
    if (!correct && !task.revisit && initialTasks.length - index - 1 >= 2)
      deferredReviews.current.push(task);
    onAnswer(task.card, correct, undefined, {
      attemptCount: count,
      firstTryCorrect: attempts.current[task.id].firstTryCorrect,
      hintUsed: attempts.current[task.id].hintUsed,
      durationMs: Math.max(0, Date.now() - taskStartedAt.current),
      variantId: `${gameId}:${initial.variantId}`,
      skill: task.skill,
      recordProgress: task.recordProgress && !task.revisit,
      sessionTotal: initialTasks.length,
    });
    setFeedback(correct ? "correct" : "wrong");
  };

  const skipCurrent = () => {
    if (!task || feedback) return;
    onSkip(task.card);
    skipped.current.add(task.id);
    resetForNext();
  };

  const finishEarly = () => {
    const uniqueUnanswered = new Map<string, VocabCard>();
    queue.slice(index).forEach((item) => {
      if (!attempts.current[item.id]?.count && !skipped.current.has(item.id))
        uniqueUnanswered.set(item.id, item.card);
    });
    uniqueUnanswered.forEach(onSkip);
    uniqueUnanswered.forEach((_card, id) => skipped.current.add(id));
    setIndex(queue.length);
  };

  if (done)
    return (
      <div className="game-shell scenario-game-shell">
        <header className="game-topbar">
          <button onClick={onExit}>
            <Icon name="arrowLeft" /> Назад
          </button>
          <span>Результат</span>
          <span />
        </header>
        <div className="game-result scenario-result">
          <span className="result-medal">
            {firstTryCorrect >= Math.ceil(initialTasks.length / 2) ? "★" : "✓"}
          </span>
          <p className="eyebrow">
            {label.toLocaleUpperCase("ru-RU")} · {initial.title}
          </p>
          <h1>
            {firstTryCorrect} из {answered} с первого раза
          </h1>
          <p>
            {initialTasks.length} заданий · повторов: {repeatedCount} · без ответа:{" "}
            {skipped.current.size}. Ошибки первой попытки остались в результате.
          </p>
          {onNextGame && (
            <button className="secondary-button" onClick={onNextGame}>
              Следующая игра →
            </button>
          )}
          <button className="primary-button" onClick={onExit}>
            К играм
          </button>
        </div>
      </div>
    );

  const progress = Math.min(100, Math.round((index / initialTasks.length) * 100));
  const progressLabel = task.revisit
    ? `Повтор · ${index - initialTasks.length + 1}`
    : `${Math.min(index + 1, initialTasks.length)} / ${initialTasks.length}`;

  return (
    <div className="game-shell scenario-game-shell">
      <header className="game-topbar">
        <button onClick={onExit}>
          <Icon name="arrowLeft" /> Назад
        </button>
        <div>
          <span>{label.toLocaleUpperCase("ru-RU")}</span>
          <strong>{progressLabel}</strong>
        </div>
        <div className="game-score" key={scorePulse}>
          ✦ {firstTryCorrect}
        </div>
      </header>
      <main className="game-center scenario-game-center">
        <div className="game-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="scenario-scene-tag">{task.scene}</div>
        {hintVisible && (
          <div className="scenario-hint" role="note">
            {task.hint}
          </div>
        )}
        {task.kind === "choice" && (
          <section className="scenario-task-card">
            {task.line && <blockquote className="scenario-interlocutor">{task.line}</blockquote>}
            <p className="question-kicker">{task.prompt}</p>
            <div className="scenario-choice-grid">
              {task.choices?.map((option) => (
                <button
                  type="button"
                  key={option}
                  disabled={Boolean(feedback)}
                  className={
                    feedback && option === task.answer
                      ? "correct"
                      : feedback && option === selected
                        ? "wrong"
                        : selected === option
                          ? "chosen"
                          : ""
                  }
                  onClick={() => {
                    setSelected(option);
                    answer(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        )}
        {task.kind === "text" && (
          <section className="scenario-task-card">
            <p className="question-kicker">{task.prompt}</p>
            <label className="scenario-answer-label">
              <span className="sr-only">Ваш ответ</span>
              <input
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                disabled={Boolean(feedback)}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") answer(typed);
                }}
                placeholder="Напишите слово или фразу"
              />
            </label>
            {!feedback && (
              <button
                className="primary-button"
                disabled={!typed.trim()}
                onClick={() => answer(typed)}
              >
                Проверить
              </button>
            )}
          </section>
        )}
        {task.kind === "order" && (
          <section className="scenario-task-card">
            <p className="question-kicker">{task.prompt}</p>
            <div className="scenario-token-answer" aria-live="polite">
              {tokens.length
                ? tokens
                    .map(
                      (tokenIndex) =>
                        shuffledTokens.find((item) => item.tokenIndex === tokenIndex)?.word,
                    )
                    .join(" ")
                : "Выберите слова ниже"}
            </div>
            <div className="scenario-token-bank">
              {shuffledTokens.map((token) => (
                <button
                  type="button"
                  key={token.tokenIndex}
                  disabled={Boolean(feedback) || tokens.includes(token.tokenIndex)}
                  onClick={() => setTokens((current) => [...current, token.tokenIndex])}
                >
                  {token.word}
                </button>
              ))}
            </div>
            {!feedback && (
              <div className="scenario-order-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setTokens((current) => current.slice(0, -1))}
                >
                  Убрать слово
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={tokens.length !== shuffledTokens.length}
                  onClick={() =>
                    answer(
                      tokens
                        .map(
                          (tokenIndex) =>
                            shuffledTokens.find((item) => item.tokenIndex === tokenIndex)?.word ??
                            "",
                        )
                        .join(" "),
                    )
                  }
                >
                  Проверить
                </button>
              </div>
            )}
          </section>
        )}
        {!feedback && (
          <div className="scenario-tools">
            <button
              type="button"
              className="text-button"
              onClick={() => setHintVisible((value) => !value)}
            >
              <Icon name="info" size={15} /> {hintVisible ? "Скрыть подсказку" : "Подсказка"}
            </button>
            <button type="button" className="text-button" onClick={skipCurrent}>
              Пропустить
            </button>
          </div>
        )}
        {feedback && (
          <div className={`game-feedback-panel ${feedback}`}>
            <p className={`game-feedback ${feedback}`}>
              {feedback === "correct" ? "Верно. " : `Правильный ответ: ${task.answer}. `}
              {task.explanation}
            </p>
            <button className="primary-button" onClick={resetForNext}>
              {feedback === "wrong" ? "Понятно, дальше" : "Дальше"} <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </main>
      <footer className="game-footer scenario-game-footer">
        <span>{module.practiceNote ?? `${module.languageName} · ${module.level}`}</span>
        <button className="text-button" onClick={finishEarly}>
          Закончить сессию
        </button>
      </footer>
    </div>
  );
}

const GAME_LABELS: Record<ScenarioGameId, string> = {
  dialogue: "Сюжетный диалог",
  quest: "Короткий квест",
  "error-editor": "Редактор ошибок",
};
