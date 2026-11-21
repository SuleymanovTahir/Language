import type { VocabModule } from "./vocab";

export type GameId =
  | "pairs"
  | "articles"
  | "builder"
  | "blitz"
  | "hangman"
  | "wordsearch"
  | "anagram"
  | "train"
  | "moles"
  | "boxes"
  | "wheel"
  | "phonetic"
  | "finalsound"
  | "datajoin"
  | "fillblank"
  | "picture"
  | "sentenceorder"
  | "dialogue"
  | "quest"
  | "error-editor"
  | "truefalse"
  | "oddone"
  | "memory"
  | "speed"
  | "syllables"
  | "audioloop";
type GameInfo = { id: GameId; title: string; description: string; mark: string };

export const GAME_LIST: GameInfo[] = [
  { id: "pairs", title: "Пары слов", description: "Соедините слово с переводом", mark: "↔" },
  { id: "articles", title: "Артикли", description: "Распределите слова по родам", mark: "●" },
  { id: "builder", title: "Артикль и слово", description: "Соберите существительное", mark: "▤" },
  { id: "blitz", title: "Блиц-тест", description: "Выберите верный перевод", mark: "ϟ" },
  { id: "hangman", title: "Сбор слова", description: "Откройте слово по буквам", mark: "_" },
  { id: "wordsearch", title: "Напиши слово", description: "Введите слово по переводу", mark: "Aa" },
  {
    id: "anagram",
    title: "Анаграмма",
    description: "Расставьте буквы в правильном порядке",
    mark: "Aa",
  },
  {
    id: "train",
    title: "Поезд слов",
    description: "Поставьте артикль перед существительным",
    mark: "🚃",
  },
  { id: "moles", title: "Удар по слову", description: "Найдите перевод в сетке", mark: "●" },
  { id: "boxes", title: "Коробки-сюрпризы", description: "Откройте верный перевод", mark: "□" },
  { id: "wheel", title: "Колесо фортуны", description: "Крутите колесо и отвечайте", mark: "◉" },
  { id: "phonetic", title: "Фонетический тир", description: "Узнайте слово на слух", mark: "🔊" },
  {
    id: "finalsound",
    title: "Оглушение согласных",
    description: "Определите конечный звук b, d или g",
    mark: "音",
  },
  {
    id: "fillblank",
    title: "Заполни пропуск",
    description: "Вставьте слово в предложение по смыслу",
    mark: "___",
  },
  {
    id: "picture",
    title: "Угадай по картинке",
    description: "Посмотрите на изображение и выберите слово",
    mark: "🖼️",
  },
  {
    id: "sentenceorder",
    title: "Сборка предложений",
    description: "Соберите предложение из слов модуля (50% лишних слов)",
    mark: "Aa",
  },
  {
    id: "dialogue",
    title: "Диалог в кафе или отеле",
    description: "Ответьте собеседнику по ситуации",
    mark: "☕",
  },
  {
    id: "quest",
    title: "Короткий квест",
    description: "Четыре задания с разными действиями",
    mark: "✦",
  },
  {
    id: "error-editor",
    title: "Редактор ошибок",
    description: "Исправьте форму и прочитайте объяснение",
    mark: "✓",
  },
  {
    id: "truefalse",
    title: "Правда или перевод",
    description: "Решите, совпадают ли слово и перевод",
    mark: "±",
  },
  {
    id: "oddone",
    title: "Лишнее слово",
    description: "Найдите слово, которое не подходит к подсказке",
    mark: "◇",
  },
  {
    id: "memory",
    title: "Мемо-карточки",
    description: "Запомните пары и откройте совпадения",
    mark: "▦",
  },
  {
    id: "speed",
    title: "Спринт перевода",
    description: "Выберите перевод до окончания таймера",
    mark: "»",
  },
  {
    id: "syllables",
    title: "Слоги в слово",
    description: "Соберите слово из коротких частей",
    mark: "··",
  },
  {
    id: "audioloop",
    title: "Аудио-запоминалка",
    description: "Hands-Free режим: слушайте пары слов без рук с паузами и повторами",
    mark: "🎧",
  },
];

export type GrammarTopicId =
  | "nominative"
  | "accusative"
  | "dative"
  | "wohin"
  | "negation"
  | "pronouns"
  | "possessives"
  | "sein-haben"
  | "plurals"
  | "present"
  | "word-order"
  | "questions"
  | "modal-verbs"
  | "imperative"
  | "clauses"
  | "perfekt"
  | "separable"
  | "time-prepositions";
type Question = { prompt: string; options: string[]; answer: string; explanation: string };
export type GrammarTopic = {
  id: string;
  title: string;
  description: string;
  explanation: string;
  examples: string[];
  questions: Question[];
  group?: "basics" | "sentences";
  custom?: boolean;
  languageCode?: string;
  level?: string;
};

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: "accusative",
    title: "Артикли в Akkusativ",
    description: "Прямое дополнение: den, die, das",
    explanation:
      "Akkusativ отвечает на вопрос «кого? что?». В мужском роде определённый артикль меняется с der на den; die и das сохраняют форму.",
    examples: [
      "Ich sehe den Hund. — Я вижу собаку.",
      "Sie kauft die Tasche. — Она покупает сумку.",
      "Wir brauchen das Ticket. — Нам нужен билет.",
    ],
    questions: [
      {
        prompt: "Ich sehe ___ Hund.",
        options: ["den", "der", "dem"],
        answer: "den",
        explanation: "Мужской род в Akkusativ: der → den.",
      },
      {
        prompt: "Sie kauft ___ Tasche.",
        options: ["die", "der", "den"],
        answer: "die",
        explanation: "Женский род не меняется: die → die.",
      },
      {
        prompt: "Wir brauchen ___ Ticket.",
        options: ["das", "dem", "den"],
        answer: "das",
        explanation: "Средний род не меняется: das → das.",
      },
      {
        prompt: "Er hat ___ Bruder.",
        options: ["einen", "ein", "einem"],
        answer: "einen",
        explanation: "Неопределённый артикль мужского рода: ein → einen.",
      },
    ],
  },
  {
    id: "wohin",
    title: "Wohin или Wo?",
    description: "Движение — Akkusativ, место — Dativ",
    explanation:
      "Предлоги an, auf, in, neben, unter и другие меняют падеж. Если предмет уже находится в месте (Wo?), нужен Dativ. Если он перемещается туда (Wohin?), нужен Akkusativ.",
    examples: [
      "Das Buch liegt auf dem Tisch. — Книга лежит на столе.",
      "Ich lege das Buch auf den Tisch. — Я кладу книгу на стол.",
    ],
    questions: [
      {
        prompt: "Das Buch liegt ___ Tisch.",
        options: ["auf dem", "auf den", "auf der"],
        answer: "auf dem",
        explanation: "Где лежит? Wo? Неподвижное место требует Dativ.",
      },
      {
        prompt: "Ich lege das Buch ___ Tisch.",
        options: ["auf den", "auf dem", "auf der"],
        answer: "auf den",
        explanation: "Куда кладу? Wohin? Движение требует Akkusativ.",
      },
      {
        prompt: "Die Lampe steht ___ Sofa.",
        options: ["neben dem", "neben das", "neben den"],
        answer: "neben dem",
        explanation: "Где стоит? Wo? Sofa — средний род, Dativ: dem.",
      },
      {
        prompt: "Wir stellen den Stuhl ___ Fenster.",
        options: ["vor das", "vor dem", "vor der"],
        answer: "vor das",
        explanation: "Куда ставим? Wohin? Fenster — средний род, Akkusativ: das.",
      },
    ],
  },
  {
    id: "negation",
    title: "Kein или nicht",
    description: "Отрицание существительных и действий",
    explanation:
      "Kein отрицает существительное, обычно вместо неопределённого артикля. Nicht отрицает глагол, признак или всё предложение.",
    examples: [
      "Ich habe keine Zeit. — У меня нет времени.",
      "Er kommt heute nicht. — Он сегодня не придёт.",
      "Das ist kein Problem. — Это не проблема.",
    ],
    questions: [
      {
        prompt: "Ich habe ___ Zeit.",
        options: ["keine", "nicht", "kein"],
        answer: "keine",
        explanation: "Существительное Zeit отрицается kein; женский род — keine.",
      },
      {
        prompt: "Er kommt heute ___.",
        options: ["nicht", "kein", "keine"],
        answer: "nicht",
        explanation: "Отрицается действие kommen, поэтому используем nicht.",
      },
      {
        prompt: "Das ist ___ Problem.",
        options: ["kein", "nicht", "keine"],
        answer: "kein",
        explanation: "Problem — существительное среднего рода: kein Problem.",
      },
      {
        prompt: "Sie arbeitet heute ___.",
        options: ["nicht", "keine", "kein"],
        answer: "nicht",
        explanation: "Отрицается глагол arbeiten, поэтому nicht.",
      },
    ],
  },
  {
    id: "clauses",
    title: "Союзы и порядок слов",
    description: "Глагол после weil уходит в конец",
    explanation:
      "После подчинительных союзов weil, dass и obwohl спрягаемый глагол стоит в конце придаточной части. После denn сохраняется обычный порядок слов.",
    examples: ["Ich bleibe zu Hause, weil ich krank bin.", "Ich bin müde, denn ich gehe schlafen."],
    questions: [
      {
        prompt: "Ich bleibe zu Hause, weil ich krank ___.",
        options: ["bin", "sein", "ist"],
        answer: "bin",
        explanation: "В придаточном с weil спрягаемый глагол стоит в конце.",
      },
      {
        prompt: "Ich bin müde, ___ ich gehe schlafen.",
        options: ["denn", "weil", "dass"],
        answer: "denn",
        explanation: "После denn порядок слов остаётся прямым.",
      },
      {
        prompt: "Er sagt, dass er heute nicht ___.",
        options: ["arbeitet", "arbeiten", "arbeitest"],
        answer: "arbeitet",
        explanation: "В придаточном с dass глагол стоит в конце.",
      },
      {
        prompt: "___ es regnet, gehen wir spazieren.",
        options: ["Obwohl", "Weil", "Dass"],
        answer: "Obwohl",
        explanation:
          "Obwohl вводит уступительное придаточное; глагол regnet остаётся в конце придаточной части.",
      },
    ],
  },
  {
    id: "perfekt",
    title: "Perfekt: haben или sein",
    description: "Выберите вспомогательный глагол",
    explanation:
      "Большинство глаголов образует Perfekt с haben. Sein обычно используют глаголы перемещения и перехода в другое состояние.",
    examples: [
      "Ich habe Kaffee getrunken. — Я выпил кофе.",
      "Wir sind nach Berlin gefahren. — Мы поехали в Берлин.",
    ],
    questions: [
      {
        prompt: "Wir ___ nach Berlin gefahren.",
        options: ["sind", "haben", "seid"],
        answer: "sind",
        explanation: "Перемещение из точки в точку обычно образует Perfekt с sein.",
      },
      {
        prompt: "Ich ___ einen Kaffee getrunken.",
        options: ["habe", "bin", "hat"],
        answer: "habe",
        explanation: "Большинство переходных глаголов образует Perfekt с haben.",
      },
      {
        prompt: "Sie ___ früh aufgestanden.",
        options: ["ist", "hat", "sind"],
        answer: "ist",
        explanation: "Смена состояния aufstehen образует Perfekt с sein.",
      },
      {
        prompt: "Er ___ das Formular geschickt.",
        options: ["hat", "ist", "haben"],
        answer: "hat",
        explanation: "Schicken образует Perfekt с haben.",
      },
    ],
  },
  {
    id: "separable",
    title: "Отделяемые приставки",
    description: "Приставка уходит в конец предложения",
    explanation:
      "В Präsens приставка отделяемого глагола уходит в конец предложения. На втором месте остаётся изменённая по лицу часть глагола.",
    examples: [
      "Der Zug fährt um zehn Uhr ab. — Поезд отправляется в десять.",
      "Ich stehe um sieben Uhr auf. — Я встаю в семь.",
    ],
    questions: [
      {
        prompt: "Der Zug fährt um zehn Uhr ___. (abfahren)",
        options: ["ab", "fahren", "abfahren"],
        answer: "ab",
        explanation: "В Präsens отделяемая приставка ставится в конец предложения.",
      },
      {
        prompt: "Ich ___ um sieben Uhr auf. (aufstehen)",
        options: ["stehe", "aufstehe", "stehen"],
        answer: "stehe",
        explanation: "Спрягаемая часть steht на втором месте, приставка auf — в конце.",
      },
      {
        prompt: "Mach bitte die Tür ___. (zumachen)",
        options: ["zu", "machen", "zumachen"],
        answer: "zu",
        explanation: "В повелительном наклонении отделяемая приставка также уходит в конец.",
      },
      {
        prompt: "Wann ___ der Film an? (anfangen)",
        options: ["fängt", "anfängt", "fangen"],
        answer: "fängt",
        explanation: "Спрягаемая часть глагола стоит на втором месте, an — в конце.",
      },
    ],
  },
  {
    id: "nominative",
    group: "basics",
    title: "Артикли в Nominativ",
    description: "Кто? Что? · der, die, das",
    explanation:
      "Nominativ — форма подлежащего, то есть того, кто или что выполняет действие. Определённый артикль зависит от рода и числа существительного.",
    examples: [
      "Der Mann kommt. — Мужчина приходит.",
      "Die Frau lernt. — Женщина учится.",
      "Das Kind spielt. — Ребёнок играет.",
    ],
    questions: [
      {
        prompt: "___ Mann kommt heute.",
        options: ["Der", "Den", "Dem"],
        answer: "Der",
        explanation: "Mann — мужской род, подлежащее в Nominativ: der Mann.",
      },
      {
        prompt: "___ Frau arbeitet hier.",
        options: ["Die", "Der", "Den"],
        answer: "Die",
        explanation: "Frau — женский род: die Frau.",
      },
      {
        prompt: "___ Kind spielt im Garten.",
        options: ["Das", "Den", "Dem"],
        answer: "Das",
        explanation: "Kind — средний род: das Kind.",
      },
      {
        prompt: "___ Bücher sind neu.",
        options: ["Die", "Das", "Der"],
        answer: "Die",
        explanation: "Во множественном числе определённый артикль — die.",
      },
    ],
  },
  {
    id: "dative",
    group: "basics",
    title: "Dativ: кому? чему?",
    description: "dem, der, dem и множественное число",
    explanation:
      "Dativ часто отвечает на вопрос «кому? чему?» и используется после ряда предлогов, например mit и aus. Запомните формы определённого артикля: dem, der, dem, den.",
    examples: [
      "Ich helfe dem Mann. — Я помогаю мужчине.",
      "Sie spricht mit der Frau. — Она разговаривает с женщиной.",
      "Wir fahren mit den Kindern. — Мы едем с детьми.",
    ],
    questions: [
      {
        prompt: "Ich helfe ___ Mann.",
        options: ["dem", "den", "der"],
        answer: "dem",
        explanation: "Mann — мужской род; в Dativ: dem Mann.",
      },
      {
        prompt: "Er spricht mit ___ Frau.",
        options: ["der", "die", "dem"],
        answer: "der",
        explanation: "После mit нужен Dativ; die Frau → der Frau.",
      },
      {
        prompt: "Das Geschenk ist für ___ Kind.",
        options: ["das", "dem", "den"],
        answer: "das",
        explanation: "Здесь für требует Akkusativ, поэтому: das Kind.",
      },
      {
        prompt: "Wir spielen mit ___ Kindern.",
        options: ["den", "die", "dem"],
        answer: "den",
        explanation:
          "Во множественном числе Dativ: den Kindern; к существительному обычно добавляется -n.",
      },
    ],
  },
  {
    id: "pronouns",
    group: "basics",
    title: "Личные местоимения",
    description: "ich, du, er/sie/es, wir, ihr, sie/Sie",
    explanation:
      "Личное местоимение заменяет существительное. В Nominativ его форма показывает, кто выполняет действие. Sie с заглавной буквы — вежливое «Вы».",
    examples: [
      "Ich wohne in Berlin. — Я живу в Берлине.",
      "Er lernt Deutsch. — Он учит немецкий.",
      "Sie kommen heute. — Они приходят сегодня.",
    ],
    questions: [
      {
        prompt: "Der Mann ist hier. ___ lernt Deutsch.",
        options: ["Er", "Sie", "Es"],
        answer: "Er",
        explanation: "Der Mann — мужской род, поэтому используем er: он.",
      },
      {
        prompt: "Tom und ich sind Freunde. ___ spielen Fußball.",
        options: ["Wir", "Ihr", "Sie"],
        answer: "Wir",
        explanation: "Tom и я — это wir («мы»).",
      },
      {
        prompt: "Herr Müller, ___ sprechen sehr gut Deutsch.",
        options: ["Sie", "du", "ihr"],
        answer: "Sie",
        explanation: "При вежливом обращении используется Sie с заглавной буквы.",
      },
      {
        prompt: "Das Kind ist müde. ___ schläft.",
        options: ["Es", "Er", "Sie"],
        answer: "Es",
        explanation: "Kind — среднего рода, поэтому местоимение es.",
      },
    ],
  },
  {
    id: "possessives",
    group: "basics",
    title: "Притяжательные слова",
    description: "mein, dein, sein, ihr, unser",
    explanation:
      "Притяжательное слово показывает, кому что принадлежит. Его окончание согласуется с существительным: mein Bruder, meine Schwester, mein Kind, meine Freunde.",
    examples: [
      "Das ist mein Bruder. — Это мой брат.",
      "Wo ist deine Tasche? — Где твоя сумка?",
      "Unser Haus ist klein. — Наш дом маленький.",
    ],
    questions: [
      {
        prompt: "Das ist ___ Bruder. (мой)",
        options: ["mein", "meine", "meinen"],
        answer: "mein",
        explanation: "Bruder — мужской род в Nominativ: mein Bruder.",
      },
      {
        prompt: "Wo ist ___ Tasche? (твой)",
        options: ["deine", "dein", "deinen"],
        answer: "deine",
        explanation: "Tasche — женский род: deine Tasche.",
      },
      {
        prompt: "Er besucht ___ Eltern. (его)",
        options: ["seine", "sein", "seinen"],
        answer: "seine",
        explanation: "Во множественном числе: seine Eltern.",
      },
      {
        prompt: "___ Kind spielt hier. (наше)",
        options: ["Unser", "Unsere", "Unseren"],
        answer: "Unser",
        explanation: "Kind — средний род в Nominativ: unser Kind.",
      },
    ],
  },
  {
    id: "sein-haben",
    group: "basics",
    title: "Глаголы sein и haben",
    description: "Формы «быть» и «иметь»",
    explanation:
      "Sein и haben — частотные неправильные глаголы. Их формы нужно запомнить: ich bin/habe, du bist/hast, er ist/hat, wir sind/haben.",
    examples: [
      "Ich bin müde. — Я устал.",
      "Du hast Zeit. — У тебя есть время.",
      "Wir sind zu Hause. — Мы дома.",
    ],
    questions: [
      {
        prompt: "Ich ___ heute zu Hause. (sein)",
        options: ["bin", "bist", "ist"],
        answer: "bin",
        explanation: "Форма sein с ich — bin.",
      },
      {
        prompt: "Du ___ einen Bruder. (haben)",
        options: ["hast", "hat", "haben"],
        answer: "hast",
        explanation: "Форма haben с du — hast.",
      },
      {
        prompt: "Sie ___ sehr freundlich. (sein)",
        options: ["ist", "bist", "sind"],
        answer: "ist",
        explanation: "Sie здесь означает «она», форма sein — ist.",
      },
      {
        prompt: "Wir ___ zwei Kinder. (haben)",
        options: ["haben", "hat", "hast"],
        answer: "haben",
        explanation: "Форма haben с wir — haben.",
      },
    ],
  },
  {
    id: "plurals",
    group: "basics",
    title: "Множественное число",
    description: "Частые формы существительных",
    explanation:
      "В немецком нет одного окончания множественного числа: встречаются -e, -er, -n/-en, -s и нулевое окончание, иногда с умлаутом. Новое существительное лучше учить сразу вместе с формой множественного числа.",
    examples: [
      "der Tag → die Tage — день → дни",
      "das Kind → die Kinder — ребёнок → дети",
      "die Frau → die Frauen — женщина → женщины",
      "der Lehrer → die Lehrer — учитель → учителя",
    ],
    questions: [
      {
        prompt: "Ein Kind, zwei ___.",
        options: ["Kinder", "Kinde", "Kinds"],
        answer: "Kinder",
        explanation: "Множественное число Kind — Kinder.",
      },
      {
        prompt: "Ein Tag, drei ___.",
        options: ["Tage", "Tagen", "Tags"],
        answer: "Tage",
        explanation: "Множественное число Tag — Tage.",
      },
      {
        prompt: "Eine Frau, zwei ___.",
        options: ["Frauen", "Fraue", "Fraus"],
        answer: "Frauen",
        explanation: "Множественное число Frau — Frauen.",
      },
      {
        prompt: "Ein Lehrer, zwei ___.",
        options: ["Lehrer", "Lehreren", "Lehrers"],
        answer: "Lehrer",
        explanation: "Lehrer сохраняет форму во множественном числе; меняется артикль: die Lehrer.",
      },
    ],
  },
  {
    id: "present",
    group: "sentences",
    title: "Präsens: настоящее время",
    description: "Окончания регулярных глаголов",
    explanation:
      "У регулярных глаголов убираем -en и добавляем личное окончание: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en.",
    examples: [
      "ich mach-e — я делаю",
      "du lern-st — ты учишься",
      "er wohn-t — он живёт",
      "wir spiel-en — мы играем",
    ],
    questions: [
      {
        prompt: "Du ___ Deutsch. (lernen)",
        options: ["lernst", "lernt", "lernen"],
        answer: "lernst",
        explanation: "Для du у регулярного глагола окончание -st: lernst.",
      },
      {
        prompt: "Er ___ in Berlin. (wohnen)",
        options: ["wohnt", "wohne", "wohnst"],
        answer: "wohnt",
        explanation: "Для er/sie/es добавляем -t: wohnt.",
      },
      {
        prompt: "Wir ___ Fußball. (spielen)",
        options: ["spielen", "spielt", "spiele"],
        answer: "spielen",
        explanation: "Для wir используется инфинитивное окончание -en.",
      },
      {
        prompt: "Ihr ___ sehr schnell. (arbeiten)",
        options: ["arbeitet", "arbeiten", "arbeite"],
        answer: "arbeitet",
        explanation:
          "Для ihr окончание -t; у arbeiten появляется дополнительное e для удобства произношения.",
      },
    ],
  },
  {
    id: "word-order",
    group: "sentences",
    title: "Порядок слов: глагол на втором месте",
    description: "Утверждение и обстоятельство в начале",
    explanation:
      "В обычном немецком повествовательном предложении спрягаемый глагол стоит на втором месте. Если на первое место поставить время или место, подлежащее обычно идёт после глагола.",
    examples: [
      "Ich lerne heute Deutsch. — Я сегодня учу немецкий.",
      "Heute lerne ich Deutsch. — Сегодня я учу немецкий.",
      "Am Abend kocht er. — Вечером он готовит.",
    ],
    questions: [
      {
        prompt: "Heute ___ ich Deutsch. (lernen)",
        options: ["lerne", "ich lerne", "lernst"],
        answer: "lerne",
        explanation: "Heute занимает первое место, поэтому глагол lerne стоит на втором.",
      },
      {
        prompt: "Am Morgen ___ wir Kaffee. (trinken)",
        options: ["trinken", "wir trinken", "trinkst"],
        answer: "trinken",
        explanation: "После обстоятельства am Morgen на втором месте стоит trinken.",
      },
      {
        prompt: "In Berlin ___ meine Schwester. (wohnen)",
        options: ["wohnt", "meine Schwester wohnt", "wohne"],
        answer: "wohnt",
        explanation:
          "После обстоятельства места глагол стоит перед подлежащим: In Berlin wohnt meine Schwester.",
      },
      {
        prompt: "Ich ___ heute zu Hause. (bleiben)",
        options: ["bleibe", "bleibst", "bleibt"],
        answer: "bleibe",
        explanation: "Подлежащее ich стоит первым, спрягаемый глагол bleibe — вторым.",
      },
    ],
  },
  {
    id: "questions",
    group: "sentences",
    title: "Вопросы: Ja/Nein и W-Fragen",
    description: "Глагол первым или после вопросительного слова",
    explanation:
      "В вопросе без вопросительного слова спрягаемый глагол стоит первым. В W-вопросе порядок такой: вопросительное слово, глагол, подлежащее.",
    examples: [
      "Kommst du heute? — Ты придёшь сегодня?",
      "Wo wohnst du? — Где ты живёшь?",
      "Wann beginnt der Film? — Когда начинается фильм?",
    ],
    questions: [
      {
        prompt: "___ du aus Berlin? — Ja. (kommen)",
        options: ["Kommst", "Du kommst", "Kommt"],
        answer: "Kommst",
        explanation: "В вопросе Ja/Nein глагол стоит перед подлежащим: Kommst du?",
      },
      {
        prompt: "Wo ___ ihr? (wohnen)",
        options: ["wohnt", "ihr wohnt", "wohnst"],
        answer: "wohnt",
        explanation: "W-слово, затем глагол, затем подлежащее: Wo wohnt ihr?",
      },
      {
        prompt: "Wann ___ der Zug? (kommen)",
        options: ["kommt", "kommen", "kommst"],
        answer: "kommt",
        explanation: "Подлежащее der Zug в единственном числе: kommt.",
      },
      {
        prompt: "___ Sie einen Moment? (warten)",
        options: ["Warten", "Wartet", "Wartest"],
        answer: "Warten",
        explanation:
          "При вежливом Sie используется форма, совпадающая с множественным числом: warten.",
      },
    ],
  },
  {
    id: "modal-verbs",
    group: "sentences",
    title: "Модальные глаголы",
    description: "können, müssen, dürfen и инфинитив",
    explanation:
      "Модальный глагол спрягается и занимает второе место; смысловой глагол остаётся в инфинитиве в конце предложения.",
    examples: [
      "Ich kann gut schwimmen. — Я умею хорошо плавать.",
      "Wir müssen heute lernen. — Нам нужно сегодня учиться.",
      "Darf ich hier sitzen? — Можно мне здесь сесть?",
    ],
    questions: [
      {
        prompt: "Ich ___ heute arbeiten. (müssen)",
        options: ["muss", "musst", "müssen"],
        answer: "muss",
        explanation: "Форма müssen с ich — muss; смысловой глагол arbeiten стоит в конце.",
      },
      {
        prompt: "Du ___ sehr gut kochen. (können)",
        options: ["kannst", "kann", "können"],
        answer: "kannst",
        explanation: "Форма können с du — kannst.",
      },
      {
        prompt: "Wir dürfen hier ___. (parken)",
        options: ["parken", "parkt", "geparkt"],
        answer: "parken",
        explanation: "После модального dürfen смысловой глагол стоит в инфинитиве в конце.",
      },
      {
        prompt: "Er ___ morgen früh aufstehen. (sollen)",
        options: ["soll", "sollst", "sollen"],
        answer: "soll",
        explanation: "Форма sollen с er — soll.",
      },
    ],
  },
  {
    id: "imperative",
    group: "sentences",
    title: "Повелительное наклонение",
    description: "Просьбы и команды: du, ihr, Sie",
    explanation:
      "В повседневной речи есть разные формы повелительного наклонения. Для du обычно убирают местоимение и окончание -st; для ihr используют форму ihr без местоимения; вежливая просьба строится с Sie.",
    examples: [
      "Komm bitte! — Приходи, пожалуйста!",
      "Macht die Tür zu! — Закройте дверь! (вы, мн. ч.)",
      "Sprechen Sie langsam! — Говорите медленно!",
    ],
    questions: [
      {
        prompt: "___ bitte! (du, kommen)",
        options: ["Komm", "Kommst", "Kommt"],
        answer: "Komm",
        explanation: "Форма для du: основа komm без местоимения и -st.",
      },
      {
        prompt: "___ die Aufgabe! (ihr, machen)",
        options: ["Macht", "Machst", "Machen"],
        answer: "Macht",
        explanation: "Для ihr берём форму ihr: ihr macht → Macht!",
      },
      {
        prompt: "___ Sie bitte langsam! (sprechen)",
        options: ["Sprechen", "Sprich", "Sprecht"],
        answer: "Sprechen",
        explanation: "Вежливая форма: инфинитив + Sie.",
      },
      {
        prompt: "___ bitte Platz! (du, nehmen)",
        options: ["Nimm", "Nehmt", "Nehmen"],
        answer: "Nimm",
        explanation: "У nehmen форма du имеет изменение гласной: Nimm!",
      },
    ],
  },
  {
    id: "time-prepositions",
    group: "basics",
    title: "Предлоги времени",
    description: "um, am, im: время, дни и месяцы",
    explanation:
      "Используйте um для конкретного времени на часах, am для дней недели и частей дня, im для месяцев и сезонов.",
    examples: [
      "um acht Uhr — в восемь часов",
      "am Montag — в понедельник",
      "am Morgen — утром",
      "im Sommer — летом",
    ],
    questions: [
      {
        prompt: "Der Film beginnt ___ acht Uhr.",
        options: ["um", "am", "im"],
        answer: "um",
        explanation: "Конкретное время на часах вводится предлогом um.",
      },
      {
        prompt: "Wir treffen uns ___ Freitag.",
        options: ["am", "im", "um"],
        answer: "am",
        explanation: "Перед днями недели используется am.",
      },
      {
        prompt: "Meine Schwester hat ___ Juli Urlaub.",
        options: ["im", "am", "um"],
        answer: "im",
        explanation: "Перед месяцем Juli используется im.",
      },
      {
        prompt: "Ich lerne ___ Abend.",
        options: ["am", "im", "um"],
        answer: "am",
        explanation: "Части дня (кроме Nacht) обычно используются с am: am Abend.",
      },
    ],
  },
];

export function validateGame(id: GameId, module: VocabModule) {
  const cards = module.cards;
  if (
    ["articles", "train", "builder", "finalsound", "dialogue", "quest", "error-editor"].includes(
      id,
    ) &&
    module.languageCode !== "de"
  )
    return "Этот сценарий основан на правилах немецкого языка. Для другого языка выберите карточки и общий игровой формат.";
  if (
    id === "articles" &&
    (cards.filter((card) => card.article).length < 3 ||
      new Set(cards.map((card) => card.article).filter(Boolean)).size < 2)
  )
    return "Для сортировки нужны 3 существительных минимум двух родов.";
  if ((id === "train" || id === "builder") && !cards.some((card) => card.article))
    return "Для этой игры нужны существительные с артиклями.";
  if (id === "pairs" && new Set(cards.map((card) => card.translation.toLowerCase())).size < 2)
    return "Для пар нужны хотя бы 2 разных перевода.";
  if (id === "datajoin" && new Set(cards.map((card) => card.translation.toLowerCase())).size < 2)
    return "Для Data JOIN нужны хотя бы 2 разных перевода.";
  if (id === "quest" && cards.length < 4) return "Для короткого квеста нужны минимум 4 карточки.";
  if (["dialogue", "error-editor"].includes(id) && cards.length < 1)
    return "Сначала выберите карточки для игры.";
  if (
    id === "boxes" &&
    new Set(cards.map((card) => card.translation.trim().toLocaleLowerCase())).size < 4
  )
    return "Для коробок выберите минимум 4 слова с разными переводами.";
  if (
    id === "finalsound" &&
    cards.filter((card) => /[bdg]$/i.test(card.word.normalize("NFC"))).length < 1
  )
    return "В наборе нет слова на b, d или g для этого упражнения.";
  if (
    id === "wordsearch" &&
    cards.filter((card) => /^[\p{L}]{4,9}$/iu.test(card.word.normalize("NFC"))).length < 1
  )
    return "Для игры нужны слова длиной от 4 до 9 букв.";
  if (
    id === "anagram" &&
    cards.filter((card) => /^[\p{L}]{4,14}$/iu.test(card.word.normalize("NFC"))).length < 1
  )
    return "Для анаграммы нужно слово длиной от 4 до 14 букв.";
  if (
    id === "fillblank" &&
    (cards.filter((card) =>
      Boolean(card.exampleSentence?.split("___").length === 2 && card.sentenceAnswer?.trim()),
    ).length < 2 ||
      new Set(cards.map((card) => card.sentenceAnswer?.trim().toLocaleLowerCase()).filter(Boolean))
        .size < 2)
  )
    return "Добавьте минимум 2 предложения с пропуском и разными правильными ответами.";
  if (id === "picture" && cards.some((card) => !card.image?.id))
    return "Добавьте изображение к каждому выбранному слову в редакторе игры.";
  if (id === "sentenceorder" && cards.length < 3) return "Для игры нужно хотя бы 3 слова в наборе.";
  if (id === "audioloop" && cards.length < 1)
    return "Для аудио-запоминалки нужна хотя бы одна карточка со словом и переводом.";
  if (!cards.length) return "Сначала выберите карточки для игры.";
  return null;
}

export const germanOnlyGames = new Set<GameId>([
  "articles",
  "builder",
  "train",
  "finalsound",
  "datajoin",
  "dialogue",
  "quest",
  "error-editor",
]);
export const languageForms: Record<string, { adjective: string; locative: string }> = {
  de: { adjective: "немецкое", locative: "немецком" },
  en: { adjective: "английское", locative: "английском" },
  es: { adjective: "испанское", locative: "испанском" },
  fr: { adjective: "французское", locative: "французском" },
  it: { adjective: "итальянское", locative: "итальянском" },
  tr: { adjective: "турецкое", locative: "турецком" },
};

export function prepareGameModule(_id: GameId, module: VocabModule): VocabModule {
  return module;
}
