// Generated course quizzes from ClickLing Master Blueprint
export type UnitQuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export const COURSE_QUIZZES: Record<string, UnitQuizQuestion[]> = {
  "a0-01": [
    {
      question: "Как по-немецки сказать «привет»?",
      options: ["Hallo", "Tschüss", "Danke", "Bitte"],
      answer: 0,
      explanation: "*Hallo* — самое популярное и универсальное немецкое приветствие.",
    },
    {
      question: "Что означает слово «Danke»?",
      options: ["Спасибо", "Пожалуйста", "Привет", "До свидания"],
      answer: 0,
      explanation: "*Danke* переводится как «спасибо». *Danke schön* — «большое спасибо».",
    },
    {
      question: "Какое слово используют при дружеском прощании («пока»)?",
      options: ["Tschüss", "Hallo", "Ja", "Bitte"],
      answer: 0,
      explanation: "*Tschüss* — разговорное «пока / счастливо».",
    },
    {
      question: "Как сказать по-немецки «да, пожалуйста»?",
      options: ["Ja, bitte", "Nein, danke", "Hallo, bitte", "Tschüss, danke"],
      answer: 0,
      explanation: "*Ja* — «да», *bitte* — «пожалуйста». Вместе: «Ja, bitte».",
    },
    {
      question: "Как вежливо отказаться («нет, спасибо»)?",
      options: ["Nein, danke", "Ja, bitte", "Sehr gut", "Tschüss"],
      answer: 0,
      explanation: "*Nein* — «нет», *danke* — «спасибо».",
    },
  ],
  "a0-02": [
    {
      question: "Какой артикль имеет существительное «Kaffee»?",
      options: ["der (der Kaffee)", "die (die Kaffee)", "das (das Kaffee)", "kein"],
      answer: 0,
      explanation: "Слово *Kaffee* в немецком мужского рода: *der Kaffee*.",
    },
    {
      question: "Как переводится немецкое слово «das Wasser»?",
      options: ["вода", "чай", "кофе", "сок"],
      answer: 0,
      explanation: "*das Wasser* — вода (средний род).",
    },
    {
      question: "Какое слово в немецком языке означает соединительный союз «и»?",
      options: ["und", "oder", "aber", "nicht"],
      answer: 0,
      explanation: "Союз *und* переводится как «и» (*Kaffee und Tee*).",
    },
    {
      question: "Переведите фразу заказа: «Kaffee und Tee, bitte.»",
      options: [
        "Кофе и чай, пожалуйста.",
        "Чай и вода, пожалуйста.",
        "Кофе без молока.",
        "Только кофе, спасибо.",
      ],
      answer: 0,
      explanation: "*Kaffee* (кофе) *und* (и) *Tee* (чай), *bitte* (пожалуйста).",
    },
    {
      question: "Что означает фраза «sehr gut»?",
      options: ["очень хорошо", "не очень", "плохо", "пока"],
      answer: 0,
      explanation: "*sehr* — «очень», *gut* — «хорошо».",
    },
  ],
  "a0-03": [
    {
      question: "Как правильно сказать «Я — Анна» с глаголом sein?",
      options: ["Ich bin Anna.", "Ich Anna.", "Du bist Anna.", "Er ist Anna."],
      answer: 0,
      explanation: "С местоимением *ich* (я) форма глагола sein — *bin* (*Ich bin...*).",
    },
    {
      question: "Какое вопросительное слово означает «кто»?",
      options: ["wer", "wo", "was", "wie"],
      answer: 0,
      explanation: "*wer* переводится как «кто» (*Wer bist du?* — «Кто ты?»).",
    },
    {
      question: "Как спросить собеседника «Как дела?»?",
      options: ["Wie geht's?", "Wer bist du?", "Woher kommst du?", "Was ist das?"],
      answer: 0,
      explanation: "*Wie geht's?* — универсальное «Как дела? / Как поживаешь?».",
    },
    {
      question: "Как переводится бодрый ответ: «Super, danke!»?",
      options: ["Супер, спасибо!", "Не знаю, спасибо.", "До встречи!", "Пожалуйста."],
      answer: 0,
      explanation: "*super* — «супер / отлично», *danke* — «спасибо».",
    },
    {
      question: "Какая форма глагола sein сочетается с местоимением «du» (ты)?",
      options: ["bist (du bist)", "bin (ich bin)", "ist (er ist)", "sind (wir sind)"],
      answer: 0,
      explanation: "С местоимением *du* глагол sein принимает форму *bist* (*du bist*).",
    },
  ],
  "a1-01": [
    {
      question: "Как переводится глагол «говорить» на немецкий язык?",
      options: ["heißen", "B) sprechen", "kommen", "wohnen"],
      answer: 1,
      explanation:
        "Глагол *sprechen* переводится как «говорить». *heißen* — «зваться», *kommen* — «приходить/быть родом».",
    },
    {
      question: "Выберите правильную форму глагола: «Ich _____ aus Kasachstan.»",
      options: ["A) komme", "kommst", "kommt", "kommen"],
      answer: 0,
      explanation: "С местоимением 1-го лица *ich* глагол принимает окончание *-e* (*ich komme*).",
    },
    {
      question: "Выберите правильную форму для вопроса: «Wie _____ du?»",
      options: ["heiße", "B) heißt", "heißen", "heißet"],
      answer: 1,
      explanation:
        "С местоимением *du* основа глагола *heiß-* оканчивается на шипящий, поэтому добавляется только *-t* (*du heißt*).",
    },
    {
      question: "Прослушайте фразу: *«Ich spreche Deutsch.»* Что сказал диктор?",
      options: [
        "Я учу немецкий язык.",
        "B) Я говорю по-немецки.",
        "Я еду в Германию.",
        "Мне нравится немецкий.",
      ],
      answer: 1,
      explanation: "*sprechen* означает «говорить», *Deutsch* — немецкий язык.",
    },
    {
      question: "Какое предложение построено грамматически корректно?",
      options: [
        "Aus Berlin ich komme.",
        "Ich aus Berlin komme.",
        "C) Ich komme aus Berlin.",
        "Komme ich aus Berlin.",
      ],
      answer: 2,
      explanation:
        "В простом повествовательном предложении в немецком языке спрягаемый глагол ВСЕГДА стоит на втором месте.",
    },
  ],
  "a1-02": [
    {
      question: "Вставьте правильное окончание глагола: «Er _____ in München.»",
      options: ["wohne", "B) wohnt", "wohnst", "wohnen"],
      answer: 1,
      explanation: "Для 3-го лица единственного числа (*er/sie/es*) окончание глагола *-t*.",
    },
    {
      question: "Выберите подходящий предлог: «Ich wohne _____ Frankfurt.»",
      options: ["aus", "B) in", "nach", "zu"],
      answer: 1,
      explanation:
        "С городами и большинством стран при указании местонахождения используется предлог *in* («где? в Франкфурте»).",
    },
    {
      question: "Как правильно спросить собеседника «Откуда ты родом?»:",
      options: ["A) Woher kommst du?", "Wo kommst du?", "Woher wohnst du?", "Was machst du?"],
      answer: 0,
      explanation: "Вопрос происхождения строится с вопросительным словом *Woher* («откуда»).",
    },
    {
      question: "Выберите предложение с правильным порядком слов:",
      options: [
        "Jetzt ich studiere in Köln.",
        "B) Jetzt studiere ich in Köln.",
        "Jetzt studiere in Köln ich.",
        "Studiere ich jetzt in Köln.",
      ],
      answer: 1,
      explanation:
        "Если предложение начинается со слова *Jetzt*, глагол обязан остаться на 2-м месте, а подлежащее смещается на 3-е.",
    },
    {
      question: "Прослушайте: *«Was machst du beruflich?»* Что означает данный вопрос?",
      options: [
        "Где ты живёшь?",
        "Куда ты идёшь?",
        "C) Кто ты по профессии? / Чем занимаешься?",
        "Какой язык ты учишь?",
      ],
      answer: 2,
      explanation: "*beruflich* переводится как «по профессии / в профессиональном плане».",
    },
  ],
  "a1-03": [
    {
      question: "Вставьте верное местоимение: «Das ist _____ Mutter (die).»",
      options: ["mein", "B) meine", "meinen", "meinem"],
      answer: 1,
      explanation: "Для существительных женского рода используется форма *meine*.",
    },
    {
      question: "Вставьте верное местоимение: «Ist das _____ Bruder (der)?»",
      options: ["A) dein", "deine", "deines", "deinem"],
      answer: 0,
      explanation: "Для мужского рода в именительном падеже окончание отсутствует: *dein Bruder*.",
    },
    {
      question: "Выберите правильную форму: «Wo wohnen _____ Eltern?»",
      options: ["mein", "B) deine", "dein", "deines"],
      answer: 1,
      explanation:
        "Существительное *Eltern* употребляется только во множественном числе (*die Eltern*), поэтому форма *deine*.",
    },
    {
      question: "Какое слово означает «ребёнок»?",
      options: ["der Bruder", "die Schwester", "C) das Kind", "der Vater"],
      answer: 2,
      explanation: "*das Kind* переводится как «ребёнок».",
    },
    {
      question: "Прослушайте: *«Meine Schwester ist zwanzig Jahre alt.»* Сколько лет сестре?",
      options: ["12 лет", "B) 20 лет", "22 года", "30 лет"],
      answer: 1,
      explanation: "Числительное *zwanzig* означает 20.",
    },
  ],
  "a1-04": [
    {
      question: "Выберите предлог перед временем: «Der Film beginnt _____ 20 Uhr.»",
      options: ["am", "B) um", "im", "von"],
      answer: 1,
      explanation: "С точным указанием часа всегда употребляется предлог *um*.",
    },
    {
      question: "Выберите предлог для времени суток: «_____ Abend koche ich gern.»",
      options: ["A) Am", "Um", "Im", "An"],
      answer: 0,
      explanation: "С временами суток используется слияние предлога *an + dem* = *am*.",
    },
    {
      question: "Куда встаёт приставка глагола *aufstehen*? «Wann stehst du gewöhnlich _____?»",
      options: ["an", "B) auf", "aus", "ein"],
      answer: 1,
      explanation: "Приставка глагола *aufstehen* — это *auf*, в вопросе она уходит в конец.",
    },
    {
      question: "Выберите грамматически верный порядок слов:",
      options: [
        "Um 8 Uhr ich stehe auf.",
        "B) Um 8 Uhr stehe ich auf.",
        "Um 8 Uhr aufstehe ich.",
        "Ich aufstehe um 8 Uhr.",
      ],
      answer: 1,
      explanation:
        "При выносе обстоятельства времени вперед глагол занимает строго 2-е место, а приставка уходит на последнее.",
    },
    {
      question:
        "Прослушайте: *«Am Sonntag schlafe ich bis zehn Uhr.»* До скольки часов спит говорящий?",
      options: ["До 8 часов", "До 9 часов", "C) До 10 часов", "До 12 часов"],
      answer: 2,
      explanation: "*zehn Uhr* означает 10 часов.",
    },
  ],
  "a1-05": [
    {
      question: "Вставьте артикль: «Ich trinke jeden Morgen _____ Tee (der).»",
      options: ["ein", "B) einen", "eine", "einem"],
      answer: 1,
      explanation:
        "В винительном падеже неопределенный артикль мужского рода принимает форму *einen*.",
    },
    {
      question: "Вставьте артикль: «Wir möchten _____ Wasser (das).»",
      options: ["einen", "B) ein", "eine", "eines"],
      answer: 1,
      explanation: "Существительные среднего рода в Akkusativ не меняют артикль: *ein Wasser*.",
    },
    {
      question: "Какая фраза используется, чтобы попросить счёт у официанта?",
      options: ["A) Die Rechnung, bitte!", "Wo ist Wasser?", "Wie heißt du?", "Guten Morgen!"],
      answer: 0,
      explanation:
        "Стандартная общепринятая фраза для оплаты в кафе и ресторане — *Die Rechnung, bitte!* или *Zahlen, bitte!*.",
    },
    {
      question: "Вставьте глагол: «Was _____ du trinken?»",
      options: ["möchte", "B) möchtest", "möchten", "möchtet"],
      answer: 1,
      explanation: "Для местоимения 2-го лица *du* форма глагола — *möchtest*.",
    },
    {
      question: "Прослушайте: *«Das macht zusammen vier Euro fünfzig.»* Какова сумма заказа?",
      options: ["4 евро ровно", "B) 4 евро 50 центов", "5 евро 40 центов", "45 евро"],
      answer: 1,
      explanation: "*vier Euro fünfzig* = 4.50 €.",
    },
  ],
  "a1-06": [
    {
      question: "Выберите вежливую форму приказа: «_____ Sie bitte geradeaus!»",
      options: ["A) Gehen", "Geht", "Gehst", "Ging"],
      answer: 0,
      explanation:
        "В вежливой форме повелительного наклонения глагол сохраняет форму инфинитива: *Gehen Sie*.",
    },
    {
      question: "Что означает указатель «rechts»?",
      options: ["Налево", "B) Направо", "Прямо", "Назад"],
      answer: 1,
      explanation: "*rechts* — «направо / справа», *links* — «налево / слева».",
    },
    {
      question: "Вставьте форму глагола sein: «Wo _____ die Apotheke?»",
      options: ["bin", "bist", "C) ist", "sind"],
      answer: 2,
      explanation:
        "Аптека (*die Apotheke*) — 3-е лицо единственного числа (*sie*), поэтому форма глагола *ist*.",
    },
    {
      question: "Переведите: «Вокзал находится слева.»",
      options: [
        "A) Der Bahnhof ist links.",
        "Der Bahnhof ist rechts.",
        "Der Bahnhof ist geradeaus.",
        "Die Apotheke ist links.",
      ],
      answer: 0,
      explanation: "*der Bahnhof* — вокзал, *links* — слева.",
    },
    {
      question:
        "Прослушайте: *«Nehmen Sie die nächste Straße links.»* В какую улицу нужно свернуть?",
      options: [
        "Направо на первой улице",
        "B) Налево на следующей улице",
        "Идти прямо до конца улицы",
        "Перейти через площадь",
      ],
      answer: 1,
      explanation: "*die nächste Straße* = следующая улица, *links* = налево.",
    },
  ],
  "a1-07": [
    {
      question: "Вставьте артикль: «In der Wohnung gibt es _____ Schrank (der).»",
      options: ["A) einen", "einem", "ein", "einer"],
      answer: 0,
      explanation:
        "После *es gibt* всегда используется Akkusativ. Мужской род принимает форму *einen*.",
    },
    {
      question: "Вставьте артикль на вопрос Wo?: «Die Lampe steht auf _____ Schreibtisch (der).»",
      options: ["den", "B) dem", "des", "das"],
      answer: 1,
      explanation:
        "На вопрос «где?» (Wo?) предлог требует Dativ. Мужской род в Dativ имеет артикль *dem*.",
    },
    {
      question: "Вставьте форму артикля: «Meine Mutter kocht in _____ Küche (die).»",
      options: ["die", "B) der", "den", "dem"],
      answer: 1,
      explanation: "В дательном падеже артикль женского рода *die* меняется на *der*.",
    },
    {
      question: "Какое слово противоположно по смыслу слову «groß»?",
      options: ["hell", "B) klein", "teuer", "neu"],
      answer: 1,
      explanation: "*groß* — большой, *klein* — маленький.",
    },
    {
      question:
        "Прослушайте: *«Die Wohnung hat drei Zimmer und einen Balkon.»* Сколько комнат в квартире?",
      options: ["2 комнаты", "B) 3 комнаты", "4 комнаты", "1 комната"],
      answer: 1,
      explanation: "*drei Zimmer* означает 3 комнаты.",
    },
  ],
  "a1-08": [
    {
      question: "Вставьте правильную форму: «Er _____ sehr gut kochen.»",
      options: ["könnt", "B) kann", "kannst", "können"],
      answer: 1,
      explanation:
        "В 1-м и 3-м лице единственного числа модальные глаголы не имеют окончания: *ich kann, er/sie/es kann*.",
    },
    {
      question: "Где в предложении с модальным глаголом стоит второй глагол?",
      options: [
        "На 1-м месте",
        "На 2-м месте рядом с модальным",
        "C) В самом конце предложения в инфинитиве",
        "На 3-м месте",
      ],
      answer: 2,
      explanation:
        "Инфинитив смыслового глагола выносится в абсолютный конец предложения, замыкая рамку.",
    },
    {
      question: "Выберите корректную форму вопроса: «_____ Sie mir bitte helfen?»",
      options: ["A) Können", "Kann", "Musst", "Willst"],
      answer: 0,
      explanation: "С местоимением *Sie* (вежливое «Вы») используется форма *Können Sie*.",
    },
    {
      question: "Какое предложение построено правильно?",
      options: [
        "Wir müssen morgen lernen viel.",
        "B) Wir müssen morgen viel lernen.",
        "Wir lernen morgen viel müssen.",
        "Wir morgen müssen viel lernen.",
      ],
      answer: 1,
      explanation:
        "Модальный глагол *müssen* стоит на 2-м месте, инфинитив *lernen* — в самом конце предложения.",
    },
    {
      question:
        "Прослушайте: *«Ich habe heute leider keine Zeit, weil ich arbeiten muss.»* Почему собеседник не может встретиться?",
      options: [
        "Он заболел",
        "B) Он должен работать",
        "Он уезжает в отпуск",
        "Он забыл про встречу",
      ],
      answer: 1,
      explanation: "*weil ich arbeiten muss* переводится «потому что я должен работать».",
    },
  ],
  "a2-01": [
    {
      question: "Вставьте форму глагола haben: «Was _____ du am Wochenende gemacht?»",
      options: ["bist", "B) hast", "hat", "haben"],
      answer: 1,
      explanation: "Для местоимения 2-го лица *du* форма глагола haben — *hast*.",
    },
    {
      question:
        "Выберите правильную форму глагола lesen в Perfekt: «Er hat ein spannendes Buch _____ .»",
      options: ["geleset", "B) gelesen", "gelest", "geleezt"],
      answer: 1,
      explanation: "Сильный глагол *lesen* образует Partizip II как *gelesen*.",
    },
    {
      question: "Где в предложении должно стоять причастие Partizip II?",
      options: [
        "На первом месте",
        "На втором месте рядом с haben",
        "C) В самом конце предложения",
        "На третьем месте",
      ],
      answer: 2,
      explanation:
        "В немецком предложении глагольная рамка требует выноса неизменяемой части сказуемого в абсолютный конец.",
    },
    {
      question: "Как правильно перевести «Я купил новую куртку»?",
      options: [
        "A) Ich habe eine neue Jacke gekauft.",
        "Ich bin eine neue Jacke gekauft.",
        "Ich kaufte eine neue Jacke haben.",
        "Ich habe gekauft eine neue Jacke.",
      ],
      answer: 0,
      explanation:
        "Глагол *kaufen* образует Perfekt с *haben*, причастие *gekauft* замыкает предложение.",
    },
    {
      question:
        "Прослушайте: *«Gestern habe ich den ganzen Tag gearbeitet.»* Что делал говорящий вчера?",
      options: ["Отдыхал весь день", "B) Работал весь день", "Гулял по городу", "Спал до обеда"],
      answer: 1,
      explanation: "*den ganzen Tag gearbeitet* означает «работал весь день».",
    },
  ],
  "a2-02": [
    {
      question: "Выберите вспомогательный глагол: «Wir _____ gestern zu Fuß nach Hause gegangen.»",
      options: ["haben", "B) sind", "seid", "waren"],
      answer: 1,
      explanation:
        "Глагол *gehen* выражает перемещение, поэтому в Perfekt спрягается со вспомогательным глаголом *sein* (*wir sind*).",
    },
    {
      question: "Вставьте артикль: «Stell den Stuhl bitte neben _____ Schreibtisch (der)!»",
      options: ["A) den", "dem", "des", "das"],
      answer: 0,
      explanation:
        "Глагол *stellen* отвечает на вопрос «Куда?» (Wohin?), требуя Akkusativ. Артикль мужского рода — *den*.",
    },
    {
      question: "Вставьте артикль: «Der Stuhl steht schon neben _____ Schreibtisch (der).»",
      options: ["den", "B) dem", "des", "die"],
      answer: 1,
      explanation:
        "Глагол *stehen* отвечает на вопрос «Где?» (Wo?), требуя Dativ. Артикль мужского рода — *dem*.",
    },
    {
      question: "Выберите правильную форму: «Wann bist du in Wien _____ ?»",
      options: ["A) angekommen", "ankommen", "angekommt", "geankommen"],
      answer: 0,
      explanation:
        "У глаголов с отделяемой приставкой приставка `ge-` встаёт между приставкой и корнем: *an-ge-kommen*.",
    },
    {
      question: "Прослушайте: *«Er ist mit dem ICE-Zug nach München gefahren.»* На чём он поехал?",
      options: ["На машине", "На автобусе", "C) На скоростном поезде ICE", "На самолёте"],
      answer: 2,
      explanation: "*mit dem Zug* = на поезде.",
    },
  ],
  "a2-03": [
    {
      question: "Вставьте недостающую часть фразы: «Mir tut der Rücken _____ .»",
      options: ["A) weh", "aus", "an", "mit"],
      answer: 0,
      explanation:
        "Устойчивое выражение боли — *weh tun*. В простом времени глагол распадается: *tut weh*.",
    },
    {
      question: "Как сказать «запись на приём»?",
      options: ["die Verspätung", "B) der Termin", "die Quittung", "das Gleis"],
      answer: 1,
      explanation: "Запись на определённое время к врачу или специалисту называется *der Termin*.",
    },
    {
      question:
        "Выберите подходящую форму для дружеского совета: «Du _____ heute lieber zu Hause bleiben.»",
      options: ["sollst du", "B) solltest", "soll", "musstest"],
      answer: 1,
      explanation:
        "Форма сослагательного наклонения *solltest* выражает мягкий и заботливый совет («тебе следовало бы»).",
    },
    {
      question:
        "Вставьте верное местоимение в Dativ: «_____ tut der Hals weh.» (У меня болит горло).",
      options: ["A) Mir", "Mich", "Ich", "Mein"],
      answer: 0,
      explanation:
        "В конструкции *weh tun* субъект стоит в Dativ: кому? $\\rightarrow$ *mir* (мне).",
    },
    {
      question:
        "Прослушайте: *«Nehmen Sie bitte zwei Tabletten nach dem Essen.»* Когда нужно принять таблетки?",
      options: ["До еды", "B) После еды", "Во время еды", "Перед сном"],
      answer: 1,
      explanation: "*nach dem Essen* = после еды.",
    },
  ],
  "a2-04": [
    {
      question:
        "Выберите верное окончание предложения: «Er kommt heute nicht, weil er viel Arbeit _____ .»",
      options: ["hat heute", "B) hat", "hat gehabt", "haben"],
      answer: 1,
      explanation:
        "В придаточном предложении с *weil* сказуемое *hat* стоит на самом последнем месте.",
    },
    {
      question: "Какое предложение построено грамматически корректно?",
      options: [
        "...weil er muss einen Bericht schreiben.",
        "...weil er einen Bericht muss schreiben.",
        "C) ...weil er einen Bericht schreiben muss.",
        "...weil muss er einen Bericht schreiben.",
      ],
      answer: 2,
      explanation:
        "При наличии двух глаголов в конец уходит инфинитив, а за ним спрягаемый модальный глагол: *schreiben muss*.",
    },
    {
      question: "С каким предлогом называют профессию? «Ich arbeite _____ Softwareentwickler.»",
      options: ["A) als", "wie", "für", "bei"],
      answer: 0,
      explanation: "В немецком языке профессия указывается с предлогом *als* («в качестве / кем»).",
    },
    {
      question: "Как переводится слово «die Aufgabe»?",
      options: ["Отчёт", "B) Задача / задание", "Коллега", "Зарплата"],
      answer: 1,
      explanation: "*die Aufgabe* — задача / задание.",
    },
    {
      question:
        "Прослушайте: *«Sie wechselt den Job, weil sie mehr Geld verdienen will.»* Почему она меняет работу?",
      options: [
        "Ей не нравятся коллеги",
        "Она переезжает в другой город",
        "C) Она хочет зарабатывать больше денег",
        "У неё слишком сложный график",
      ],
      answer: 2,
      explanation:
        "*weil sie mehr Geld verdienen will* = потому что она хочет зарабатывать больше денег.",
    },
  ],
  "a2-05": [
    {
      question: "Вставьте форму глагола: «Ich freue mich, dass du morgen zu uns _____ .»",
      options: ["A) kommst", "kommst morgen", "kommen", "bist gekommen"],
      answer: 0,
      explanation: "Глагол *kommst* занимает самое последнее место в придаточном предложении.",
    },
    {
      question:
        "Выберите правильный союз со значением «ли»: «Können Sie mir sagen, _____ der Platz noch frei ist?»",
      options: ["dass", "B) ob", "weil", "wann"],
      answer: 1,
      explanation:
        "Союз *ob* переводится как «ли» и используется для передачи косвенных вопросов «да/нет».",
    },
    {
      question: "Что означает «Gleis 7»?",
      options: ["Вагон 7", "Место 7", "C) Путь / платформа 7", "Билет 7"],
      answer: 2,
      explanation: "*das Gleis* — железнодорожный путь / платформа.",
    },
    {
      question: "Как переводится глагол «umsteigen»?",
      options: ["Выходить из поезда", "Заходить в поезд", "C) Делать пересадку", "Опаздывать"],
      answer: 2,
      explanation: "*umsteigen* — делать пересадку с одного транспорта на другой.",
    },
    {
      question:
        "Прослушайте: *«Achtung am Gleis zwei: Der Zug hat voraussichtlich zwanzig Minuten Verspätung.»* На сколько задерживается поезд?",
      options: ["На 10 минут", "На 12 минут", "C) На 20 минут", "На 2 часа"],
      answer: 2,
      explanation: "*zwanzig Minuten Verspätung* = 20 минут задержки.",
    },
  ],
  "a2-06": [
    {
      question: "Выберите правильную форму «лучше» от слова gut:",
      options: ["guter", "B) besser", "am besten", "güter"],
      answer: 1,
      explanation:
        "Слово *gut* является исключением и образует сравнительную степень не по правилам: *gut $\\rightarrow$ besser*.",
    },
    {
      question: "Вставьте правильный союз: «Berlin ist viel größer _____ Hamburg.»",
      options: ["A) als", "wie", "denn", "so"],
      answer: 0,
      explanation:
        "При сравнении неравных величин (в сравнительной степени) используется союз *als* («чем»).",
    },
    {
      question:
        "Выберите верный порядок слов во второй части фразы: «Wenn ich Zeit habe, _____ ich ein Buch.»",
      options: ["ich lese", "B) lese ich", "lesen ich", "habe gelesen ich"],
      answer: 1,
      explanation:
        "Если предложение начинается с придаточного *wenn*, то главное предложение после запятой начинается непосредственно с глагола.",
    },
    {
      question: "Какая форма от слова *warm* является верной?",
      options: ["warmer", "B) wärmer", "warmste", "warmere"],
      answer: 1,
      explanation:
        "Односложные прилагательные с корневой гласной *a* получают умлаут: *warm $\\rightarrow$ wärmer*.",
    },
    {
      question: "Прослушайте: *«Morgen wird es viel kälter als heute.»* Какая погода будет завтра?",
      options: [
        "Намного теплее, чем сегодня",
        "B) Намного холоднее, чем сегодня",
        "Такая же, как сегодня",
        "Пойдёт дождь",
      ],
      answer: 1,
      explanation: "*kälter als heute* = холоднее, чем сегодня (*kalt $\\rightarrow$ kälter*).",
    },
  ],
  "a2-07": [
    {
      question: "Выберите максимально вежливый вариант вопроса: «_____ Sie mir bitte das zeigen?»",
      options: ["A) Könnten", "Konnten", "Können Sie nicht", "Mussten"],
      answer: 0,
      explanation:
        "Форма сослагательного наклонения *Könnten Sie...* выражает высшую степень вежливости.",
    },
    {
      question: "Вставьте форму желания: «Ich _____ gern eine Tasse Kaffee.»",
      options: ["habe", "B) hätte", "hatte", "hättest"],
      answer: 1,
      explanation:
        "Устойчивая формула заказа и вежливой просьбы — *Ich hätte gern* («Я хотел бы»).",
    },
    {
      question: "Какое слово обозначает чек или кассовую квитанцию?",
      options: ["die Größe", "B) die Quittung", "die Verspätung", "die Abfahrt"],
      answer: 1,
      explanation: "*die Quittung* (или *der Kassenbon*) — кассовый чек / квитанция.",
    },
    {
      question: "Что означает прилагательное «kaputt»?",
      options: ["Дорогой", "Красивый", "C) Сломанный / неисправный", "Новый"],
      answer: 2,
      explanation:
        "*kaputt* — разговорное и общеупотребительное слово для значения «сломанный / не работает».",
    },
    {
      question:
        "Прослушайте: *«Ein Umtausch ist nur innerhalb von vierzehn Tagen mit Quittung möglich.»* В течение какого срока возможен возврат?",
      options: ["В течение 7 дней", "B) В течение 14 дней", "В течение 30 дней", "Только сегодня"],
      answer: 1,
      explanation: "*vierzehn Tagen* = 14 дней.",
    },
  ],
  "a2-08": [
    {
      question: "Выберите правильную форму: «Gestern _____ wir erst spät im Hotel angekommen.»",
      options: ["haben", "B) sind", "waren", "wurden"],
      answer: 1,
      explanation:
        "Глагол *ankommen* выражает движение/прибытие, поэтому в Perfekt используется глагол *sein* (*wir sind*).",
    },
    {
      question:
        "Выберите правильную структуру: «Ich komme zehn Minuten später, weil mein Bus Verspätung _____ .»",
      options: ["A) hat", "hat gehabt", "haben", "ist"],
      answer: 0,
      explanation: "Подчинительный союз *weil* требует глагол *hat* на самом последнем месте.",
    },
    {
      question: "Какое слово означает «перенести запись/встречу на другое время»?",
      options: ["aufstehen", "B) verschieben", "umsteigen", "ankommen"],
      answer: 1,
      explanation: "*einen Termin verschieben* — перенести встречу на другое время или день.",
    },
    {
      question: "Что означает «der Treffpunkt»?",
      options: ["Путь отправления", "B) Место встречи", "Бронь жилья", "Кассовый чек"],
      answer: 1,
      explanation: "*der Treffpunkt* образован от *treffen* (встречать) и *Punkt* (точка/место).",
    },
    {
      question:
        "Прослушайте: *«Das Hotel liegt zehn Minuten zu Fuß vom Hauptbahnhof entfernt.»* Где расположен отель?",
      options: [
        "В 10 минутах на такси от центра",
        "B) В 10 минутах пешком от главного вокзала",
        "Прямо внутри здания вокзала",
        "За городом",
      ],
      answer: 1,
      explanation:
        "*zehn Minuten zu Fuß vom Hauptbahnhof* = в 10 минутах пешком от главного вокзала.",
    },
  ],
  "b1-01": [
    {
      question:
        "Выберите правильный союз: «_____ ich zwanzig Jahre alt war, begann ich meine Karriere.»",
      options: ["A) Als", "Wenn", "Wann", "Weil"],
      answer: 0,
      explanation: "Для однократного события или периода в прошлом употребляется союз *als*.",
    },
    {
      question:
        "Вставьте правильную форму глагола müssen в прошлом: «Damals _____ er jeden Tag zehn Stunden arbeiten.»",
      options: ["müsstet", "B) musste", "gemusst hat", "müsst"],
      answer: 1,
      explanation:
        "Форма Präteritum от *müssen* для 3-го лица единственного числа — *musste* (без умлаута!).",
    },
    {
      question: "Вставьте союз: «Jedes Mal, _____ wir uns trafen, sprachen wir über Bücher.»",
      options: ["als", "B) wenn", "dass", "ob"],
      answer: 1,
      explanation:
        "Маркер *Jedes Mal* (всякий раз) указывает на многократность, что требует союза *wenn*.",
    },
    {
      question: "Как переводится существительное «die Erfahrung»?",
      options: ["Профессия", "Образование", "C) Жизненный / практический опыт", "Ошибка"],
      answer: 2,
      explanation: "*die Erfahrung* — опыт.",
    },
    {
      question:
        "Прослушайте: *«Zuerst wohnte er in Köln, später zog er aus beruflichen Gründen nach Hamburg.»* Почему он переехал в Гамбург?",
      options: [
        "По семейным обстоятельствам",
        "B) По профессиональным причинам (по работе)",
        "Из-за климата",
        "Ради учёбы",
      ],
      answer: 1,
      explanation: "*aus beruflichen Gründen* = по профессиональным соображениям.",
    },
  ],
  "b1-02": [
    {
      question: "Выберите правильный вариант: «Er geht joggen, obwohl es kalt _____ .»",
      options: ["A) ist", "ist es", "sein", "wird sein"],
      answer: 0,
      explanation: "Союз *obwohl* является подчинительным и требует глагол *ist* в самом конце.",
    },
    {
      question: "Какая структура после слова *trotzdem* верна? «Es war spät. Trotzdem _____ .»",
      options: [
        "er arbeitete weiter",
        "B) arbeitete er weiter",
        "er weiterarbeitete",
        "weiter er arbeitete",
      ],
      answer: 1,
      explanation:
        "*trotzdem* занимает 1-ю позицию в предложении, следовательно, глагол *arbeitete* обязан стоять сразу на 2-м месте.",
    },
    {
      question: "Вставьте правильный предлог: «Meiner Meinung _____ sollten wir noch warten.»",
      options: ["zu", "für", "C) nach", "von"],
      answer: 2,
      explanation: "Идиома выражения своего мнения: *Meiner Meinung nach...* («по моему мнению»).",
    },
    {
      question: "Какое слово противоположно слову «der Vorteil»?",
      options: ["die Erfahrung", "B) der Nachteil", "die Meinung", "das Gleis"],
      answer: 1,
      explanation: "*der Vorteil* — плюс/преимущество, *der Nachteil* — минус/недостаток.",
    },
    {
      question:
        "Прослушайте: *«Obwohl das Gehalt attraktiv war, lehnte er das Angebot ab.»* Что сделал кандидат?",
      options: [
        "Принял предложение из-за зарплаты",
        "B) Отклонил предложение, несмотря на привлекательную зарплату",
        "Попросил время подумать",
        "Согласился на меньшую ставку",
      ],
      answer: 1,
      explanation: "*lehnte das Angebot ab* = отклонил предложение.",
    },
  ],
  "b1-03": [
    {
      question: "С каким предлогом используется глагол «sich bewerben» при указании вакансии?",
      options: ["für", "B) um", "an", "über"],
      answer: 1,
      explanation: "Глагол управляет предлогом *um + Akkusativ*: *sich bewerben um eine Stelle*.",
    },
    {
      question: "Какая форма инфинитива с *zu* верна для глагола *aufstehen*?",
      options: ["zu aufstehen", "aufstehen zu", "C) aufzustehen", "aufgestanden zu"],
      answer: 2,
      explanation:
        "В глаголах с отделяемой приставкой частица *zu* помещается строго между приставкой и корнем: *auf-zu-stehen*.",
    },
    {
      question: "В каком случае допустимо использовать оборот *um... zu*?",
      options: [
        "A) Только когда действующее лицо в обеих частях предложения совпадает",
        "Только когда действуют разные лица",
        "В любых типах предложений",
        "Только в прошедшем времени",
      ],
      answer: 0,
      explanation:
        "Оборот *um... zu* требует обязательного совпадения субъекта действия в главном и придаточном предложениях.",
    },
    {
      question: "Что означает «das Vorstellungsgespräch»?",
      options: [
        "Трудовой договор",
        "B) Собеседование при приёме на работу",
        "Увольнение",
        "Испытательный срок",
      ],
      answer: 1,
      explanation: "*das Vorstellungsgespräch* — собеседование.",
    },
    {
      question:
        "Прослушайте: *«Er hat drei Jahre lang als Projektleiter gearbeitet und war für fünfzehn Mitarbeiter verantwortlich.»* За что он отвечал?",
      options: [
        "За бюджет отдела",
        "B) За 15 сотрудников",
        "За маркетинг продукта",
        "За закупку оборудования",
      ],
      answer: 1,
      explanation:
        "*war für fünfzehn Mitarbeiter verantwortlich* = отвечал за пятнадцать сотрудников.",
    },
  ],
  "b1-04": [
    {
      question: "Из каких элементов строится Passiv Präsens в немецком языке?",
      options: [
        "haben + Partizip II",
        "sein + Infinitiv",
        "C) werden + Partizip II",
        "würden + Infinitiv",
      ],
      answer: 2,
      explanation:
        "Passiv Präsens всегда образуется сочетанием спрягаемого вспомогательного глагола *werden* на 2-м месте и *Partizip II* в конце.",
    },
    {
      question:
        "Вставьте правильную форму: «Die Berichte _____ jeden Freitag an die Geschäftsleitung geschickt.»",
      options: ["wird", "B) werden", "werdet", "wurde"],
      answer: 1,
      explanation:
        "Подлежащее *die Berichte* стоит во множественном числе, поэтому форма — *werden*.",
    },
    {
      question: "С каким предлогом указывается исполнитель действия в пассиве?",
      options: ["durch + Genitiv", "mit + Dativ", "C) von + Dativ", "aus + Dativ"],
      answer: 2,
      explanation:
        "Одушевлённый деятель или автор действия в пассивной конструкции вводится предлогом *von + Dativ*.",
    },
    {
      question: "Что означает глагол «löschen» в работе с файлами?",
      options: ["Сохранять копию", "Отправлять по почте", "C) Удалять / стирать", "Скачивать"],
      answer: 2,
      explanation: "*löschen* — удалять данные / файлы.",
    },
    {
      question:
        "Прослушайте: *«Das Betriebssystem wird zurzeit aktualisiert, bitte schalten Sie den Computer nicht aus.»* Что происходит с компьютером?",
      options: [
        "Он сломался",
        "B) Операционная система сейчас обновляется",
        "Идёт сканирование на вирусы",
        "Удаляются старые программы",
      ],
      answer: 1,
      explanation: "*wird zurzeit aktualisiert* = в настоящее время обновляется.",
    },
  ],
  "b1-05": [
    {
      question: "Какое окончание получает существительное мужского рода в Genitiv?",
      options: ["-en", "B) -(e)s", "-em", "нулевое"],
      answer: 1,
      explanation:
        "В родительном падеже существительные мужского и среднего рода получают окончание *-s* или *-es*.",
    },
    {
      question:
        "Вставьте правильную форму: «Wegen _____ schlechten Wetters (das) blieben alle zu Hause.»",
      options: ["A) des", "dem", "den", "das"],
      answer: 0,
      explanation: "Предлог *wegen* требует Genitiv. Для среднего рода форма артикля — *des*.",
    },
    {
      question: "Вставьте форму: «Während _____ Konferenz (die) war das Handy ausgeschaltet.»",
      options: ["des", "B) der", "den", "dem"],
      answer: 1,
      explanation: "Существительные женского рода в Genitiv имеют артикль *der*.",
    },
    {
      question: "Что означает термин «der Klimawandel»?",
      options: ["Прогноз погоды", "B) Изменение климата", "Защита животных", "Сортировка мусора"],
      answer: 1,
      explanation: "*der Klimawandel* = изменение климата.",
    },
    {
      question:
        "Прослушайте: *«Trotz der hohen Kosten entschied sich die Stadt für erneuerbare Solarenergie.»* Что выбрал город, несмотря на высокие расходы?",
      options: [
        "Угольные станции",
        "B) Возобновляемую солнечную энергию",
        "Атомную энергетику",
        "Отказ от электричества",
      ],
      answer: 1,
      explanation: "*Solarenergie* = солнечная энергия.",
    },
  ],
  "b1-06": [
    {
      question:
        "Вставьте относительное местоимение: «Der Bericht, _____ er gestern vorgelegt hat, ist sehr detailliert.»",
      options: ["der", "B) den", "dem", "dessen"],
      answer: 1,
      explanation:
        "Существительное мужского рода *der Bericht* внутри придаточного является объектом (он представил кого? что? $\\rightarrow$ Akkusativ = *den*).",
    },
    {
      question:
        "Вставьте относительное местоимение: «Die Kollegin, mit _____ ich das Projekt leite, ist sehr kompetent.»",
      options: ["die", "B) der", "denen", "deren"],
      answer: 1,
      explanation:
        "Предлог *mit* требует Dativ. Относительное местоимение женского рода в Dativ — *der*.",
    },
    {
      question: "Какой глагол означает «снижаться / идти на спад»?",
      options: ["steigen", "B) sinken", "speichern", "entwickeln"],
      answer: 1,
      explanation: "*sinken* — опускаться, снижаться.",
    },
    {
      question: "Где стоит сказуемое в относительном придаточном?",
      options: [
        "На 1-м месте",
        "На 2-м месте",
        "C) На самом последнем месте",
        "Сразу после относительного слова",
      ],
      answer: 2,
      explanation:
        "*Relativsatz* является придаточным предложением, поэтому спрягаемый глагол всегда занимает абсолютный конец предложения.",
    },
    {
      question:
        "Прослушайте: *«Der Anteil der Online-Bestellungen stieg im letzten Quartal auf fünfunddreißig Prozent.»* Какова доля онлайн-заказов?",
      options: ["25%", "30%", "C) 35%", "53%"],
      answer: 2,
      explanation: "*fünfunddreißig Prozent* = 35%.",
    },
  ],
  "b1-07": [
    {
      question: "Дополните вторую часть парного союза: «Er spricht nicht nur Deutsch, _____ .»",
      options: [
        "aber auch Englisch",
        "B) sondern auch Englisch",
        "und auch Englisch",
        "als auch Englisch",
      ],
      answer: 1,
      explanation:
        "Устойчивая неразрывная пара: *nicht nur ..., sondern auch ...* («не только, но и»).",
    },
    {
      question: "С каким словом образует пару союз *sowohl*?",
      options: ["oder", "sondern", "C) als auch", "noch"],
      answer: 2,
      explanation: "Парный соединительный союз — *sowohl ... als auch ...* («как ..., так и ...»).",
    },
    {
      question: "Что означает выражение «eine Frist setzen»?",
      options: [
        "Предоставить скидку",
        "B) Установить временной срок для ответа / исправления",
        "Отказаться от заказа",
        "Оплатить счёт",
      ],
      answer: 1,
      explanation: "*eine Frist setzen* = установить точный крайний срок выполнения обязательств.",
    },
    {
      question: "Какое слово означает «возместить финансовые средства»?",
      options: ["fordern", "B) erstatten", "sparen", "löschen"],
      answer: 1,
      explanation:
        "*Kosten / Betrag erstatten* — возмещать затраты / возвращать деньги покупателю.",
    },
    {
      question:
        "Прослушайте: *«Sollte die Frist fruchtlos verstreichen, werde ich rechtliche Schritte einleiten.»* Чем угрожает автор письма, если срок истечёт без ответа?",
      options: [
        "Напишет плохой отзыв в соцсетях",
        "B) Предпримет юридические / судебные шаги",
        "Отменит заказ и забудет",
        "Позвонит на горячую линию",
      ],
      answer: 1,
      explanation:
        "*rechtliche Schritte einleiten* = обратиться к юристам / начать судебное разбирательство.",
    },
  ],
  "b1-08": [
    {
      question: "Какое слово означает заключительное подведение итогов?",
      options: ["der Lebenslauf", "B) das Fazit", "der Treffpunkt", "das Gleis"],
      answer: 1,
      explanation:
        "*das Fazit* (тянуть итог / делать заключение) — классический термин резюме доклада.",
    },
    {
      question:
        "Выберите верный порядок слов: «Abschließend _____ ich Ihnen für Ihre Aufmerksamkeit.»",
      options: ["ich danke", "B) danke ich", "danken ich", "habe gedankt ich"],
      answer: 1,
      explanation:
        "Слово *Abschließend* занимает 1-ю позицию, глагол *danke* стоит на 2-м месте, подлежащее *ich* — на 3-м.",
    },
    {
      question: "Дополните фразу: «Das Problem muss schnell gelöst _____ .»",
      options: ["sein", "B) werden", "worden", "wird"],
      answer: 1,
      explanation: "С модальным глаголом форма пассива образуется как Partizip II + *werden*.",
    },
    {
      question: "Вставьте форму: «Er war pünktlich, obwohl die Bahn Verspätung _____ .»",
      options: ["hatte auf Gleis", "B) hatte", "haben", "ist gehabt"],
      answer: 1,
      explanation: "В придаточном с *obwohl* глагол *hatte* занимает строго последнюю позицию.",
    },
    {
      question:
        "Прослушайте: *«Vielen Dank für Ihre Aufmerksamkeit. Ich stehe Ihnen nun gern für Fragen zur Verfügung.»* Что предлагает докладчик в конце речи?",
      options: [
        "Разойтись на перерыв",
        "B) Задать ему интересующие вопросы",
        "Оценить презентацию в анкете",
        "Начать следующий доклад",
      ],
      answer: 1,
      explanation:
        "*für Fragen zur Verfügung stehen* = быть готовым ответить на вопросы аудитории.",
    },
  ],
  "b2-01": [
    {
      question:
        "Выберите союз: «Der Dozent spricht langsam, _____ die Studenten alles mitschreiben können.»",
      options: ["um", "B) damit", "sodass", "weil"],
      answer: 1,
      explanation:
        "В главном предложении субъект *der Dozent*, в придаточном — *die Studenten*. При несовпадении действующих лиц союз цели обязан быть *damit*.",
    },
    {
      question: "В каком падеже стоит дополнение после глагола widersprechen?",
      options: ["Akkusativ", "B) Dativ", "Genitiv", "Nominativ"],
      answer: 1,
      explanation:
        "Глагол *widersprechen* требует после себя дательного падежа (*jemandem widersprechen*).",
    },
    {
      question:
        "Выберите правильный вариант: «Wir investieren, damit das Unternehmen wettbewerbsfähig _____ .»",
      options: ["A) bleibt", "bleibt es", "bleiben", "ist geblieben"],
      answer: 0,
      explanation:
        "В придаточном предложении цели с *damit* спрягаемый глагол *bleibt* занимает абсолютный конец.",
    },
    {
      question: "Какое слово означает «обоснованное возражение»?",
      options: ["die Behauptung", "B) der Einwand", "die Quittung", "der Vertrag"],
      answer: 1,
      explanation: "*der Einwand* — возражение в споре или обсуждении.",
    },
    {
      question:
        "Прослушайте: *«Obwohl seine Argumente stichhaltig klangen, konnte er das Gremium letztlich nicht überzeugen.»* Каков был итог выступления?",
      options: [
        "Комитет единогласно поддержал докладчика",
        "B) Докладчик в итоге не смог убедить комиссию, несмотря на веские аргументы",
        "Выступление перенесли на другой день",
        "Докладчик сам отказался от своих тезисов",
      ],
      answer: 1,
      explanation:
        "*konnte er das Gremium letztlich nicht überzeugen* = в конечном счёте он не смог убедить комиссию.",
    },
  ],
  "b2-02": [
    {
      question: "Какова форма 3-го лица единственного числа от глагола *sein* в косвенной речи?",
      options: ["wäre", "B) sei", "ist", "seie"],
      answer: 1,
      explanation:
        "В Konjunktiv I глагол *sein* имеет уникальную форму 3-го лица ед.ч.: *er/sie/es sei*.",
    },
    {
      question:
        "Вставьте правильную глагольную форму: «Der Zeuge gab an, er _____ nichts von den Plänen gewusst.»",
      options: ["A) habe", "hat", "hätte", "habest"],
      answer: 0,
      explanation: "В косвенной речи для 3-го лица ед.ч. используется форма *habe*.",
    },
    {
      question: "Когда формы Konjunktiv I заменяются формами Konjunktiv II?",
      options: [
        "Никогда",
        "B) Когда форма Konjunktiv I совпадает по написанию с формой обычного настоящего времени Indikativ",
        "Только в вопросительных предложениях",
        "Только в отрицаниях",
      ],
      answer: 1,
      explanation:
        "Если форма Konjunktiv I идентична обычному изъявительному наклонению (например, *sie haben* совпадает с *sie haben*), для избежания путаницы применяется Konjunktiv II (*sie hätten*).",
    },
    {
      question: "Что означает вводное слово «angeblich»?",
      options: [
        "Достоверно доказано",
        "B) Якобы / по неподтверждённым слухам",
        "Официально подтверждено",
        "Запрещено цензурой",
      ],
      answer: 1,
      explanation:
        "*angeblich* выражает скепсис или передачу чужого утверждения без гарантии истинности.",
    },
    {
      question:
        "Прослушайте: *«Die Tagesschau meldete, der Vorstandsvorsitzende sei überraschend von seinem Posten zurückgetreten.»* Что произошло с главой правления?",
      options: [
        "Он получил премию",
        "B) Он неожиданно ушел в отставку со своего поста",
        "Он подписал новый контракт",
        "Он уехал в отпуск",
      ],
      answer: 1,
      explanation:
        "*sei überraschend von seinem Posten zurückgetreten* = неожиданно ушёл в отставку со своего поста.",
    },
  ],
  "b2-03": [
    {
      question:
        "Какой глагол сочетается с существительным «eine Entscheidung» в значении «принять решение»?",
      options: ["machen", "B) treffen", "nehmen", "stellen"],
      answer: 1,
      explanation:
        "Устойчивое деловое сочетание — *eine Entscheidung treffen* (буквально «встретить решение»).",
    },
    {
      question: "Какое выражение означает «быть абсолютно исключённым / даже не рассматриваться»?",
      options: [
        "zur Verfügung stehen",
        "B) nicht in Frage kommen",
        "in Anspruch nehmen",
        "Rücksicht nehmen",
      ],
      answer: 1,
      explanation: "*nicht in Frage kommen* = исключено, об этом не может быть и речи.",
    },
    {
      question: "Какой глагол означает пассивную доступность «быть в чьем-то распоряжении»?",
      options: ["A) stehen", "stellen", "bringen", "gehen"],
      answer: 0,
      explanation:
        "*zur Verfügung stehen* = находиться в распоряжении (покой), а *zur Verfügung stellen* = предоставить в распоряжение (действие).",
    },
    {
      question: "Какой падеж требует оборот «Rücksicht nehmen auf»?",
      options: ["Dativ", "B) Akkusativ", "Genitiv", "Nominativ"],
      answer: 1,
      explanation:
        "Оборот управляет предлогом *auf + Akkusativ* (*auf jemanden Rücksicht nehmen*).",
    },
    {
      question:
        "Прослушайте: *«Aufgrund der hohen Arbeitsbelastung haben wir beschlossen, zusätzliche externe Beratung in Anspruch zu nehmen.»* Что решила компания?",
      options: [
        "Уволить сотрудников",
        "B) Воспользоваться услугами внешних консультантов",
        "Сократить рабочий день",
        "Отказаться от проектов",
      ],
      answer: 1,
      explanation:
        "*externe Beratung in Anspruch nehmen* = воспользоваться услугами стороннего консультирования.",
    },
  ],
  "b2-04": [
    {
      question: "Какая частица делает приказ мягкой дружеской просьбой («взгляни-ка»)?",
      options: ["denn", "B) mal", "bloß", "zwar"],
      answer: 1,
      explanation:
        "Частица *mal* (сокращение от *einmal*) снимает категоричность приказа: *Schau mal!* (Посмотри-ка!).",
    },
    {
      question: "Какая частица выражает неожиданность увиденного («Ого, ты же уже здесь?!»)?",
      options: ["doch", "B) ja", "denn", "wohl"],
      answer: 1,
      explanation:
        "Частица *ja* в восклицаниях сигнализирует об удивлении фактом, произошедшим на глазах: *Du bist ja schon da!*.",
    },
    {
      question:
        "Какая частица усиливает запрет и строгое предостережение («Только не делай этого!»)?",
      options: ["mal", "B) bloß", "denn", "wohl"],
      answer: 1,
      explanation:
        "Частица *bloß* (или *nur*) в повелительных фразах подчеркивает строгость предостережения: *Mach das bloß nicht!*.",
    },
    {
      question: "Где располагаются модальные частицы в повествовании?",
      options: [
        "В самом начале перед глаголом",
        "В самом конце предложения",
        "C) В так называемом среднем поле (Mittelfeld) после местоимения и глагола",
        "Сразу перед точкой",
      ],
      answer: 2,
      explanation:
        "Модальные частицы тяготеют к серединной зоне предложения непосредственно за глаголом и местоимениями.",
    },
    {
      question:
        "Прослушайте: *«Das ist doch völlig logisch, das hätte man sich ja vorher denken können!»* Какое настроение передает говорящий?",
      options: [
        "Полную растерянность",
        "B) Убеждённость в очевидности ситуации и лёгкую досаду на недальновидность",
        "Искренний восторг от идеи",
        "Просьбу объяснить заново",
      ],
      answer: 1,
      explanation:
        "Комбинация *doch* и *ja* указывает на апелляцию к здравому смыслу («Это же само собой разумеется!»).",
    },
  ],
  "b2-05": [
    {
      question:
        "Выберите глагол для движения в Konjunktiv II прошлого: «Wenn du schneller gefahren _____, _____ wir den Zug noch erreicht.»",
      options: ["hättest / hätten", "B) wärst / hätten", "wärst / wären", "hättest / wären"],
      answer: 1,
      explanation:
        "Глагол движения *fahren* в прошедшем времени требует *sein* (*wärst*), а *erreichen* — *haben* (*hätten*).",
    },
    {
      question: "Какое предложение построено правильно без союза wenn?",
      options: [
        "A) Hätte ich mehr Geld gehabt, hätte ich das Haus gekauft.",
        "Ich mehr Geld gehabt hätte, hätte ich das Haus gekauft.",
        "Hätte gehabt ich mehr Geld, kaufte ich das Haus.",
        "Wenn hätte ich mehr Geld gehabt.",
      ],
      answer: 0,
      explanation:
        "При опущении союза *wenn* вспомогательный глагол *Hätte* выносится на абсолютное 1-е место.",
    },
    {
      question: "Как перевести «Он мог бы мне помочь (но не помог)»?",
      options: [
        "Er konnte mir helfen.",
        "B) Er hätte mir helfen können.",
        "Er war mir geholfen haben.",
        "Er hat mir gekonnt helfen.",
      ],
      answer: 1,
      explanation:
        "В Konjunktiv II с модальным глаголом используется вспомогательный *hätte* + двойной инфинитив: *hätte helfen können*.",
    },
    {
      question: "Что означает глагол «verhindern»?",
      options: ["Сожалеть", "B) Предотвратить / не допустить", "Анализировать", "Разрабатывать"],
      answer: 1,
      explanation: "*verhindern* — предотвратить наступление нежелательного события.",
    },
    {
      question:
        "Прослушайте: *«Wäre das Rettungsteam nur fünf Minuten später eingetroffen, hätte jede Hilfe zu spät kommen können.»* Что предотвратило трагедию?",
      options: [
        "Счастливая случайность",
        "B) Своевременное прибытие спасателей (они не опоздали на эти 5 минут)",
        "Помощь очевидцев",
        "Хорошая погода",
      ],
      answer: 1,
      explanation:
        "*Wäre das Team später eingetroffen...* = если бы они прибыли позже, помощь бы опоздала (значит, они успели вовремя).",
    },
  ],
  "b2-06": [
    {
      question: "Из каких элементов строится конструкция пассива с модальным глаголом?",
      options: [
        "модальный глагол + Infinitiv + sein",
        "B) модальный глагол + Partizip II + werden",
        "werden + Partizip II + haben",
        "модальный глагол + Partizip II + worden",
      ],
      answer: 1,
      explanation:
        "В модальном пассиве инфинитив глагола *werden* замыкает связку с Partizip II: *muss gemacht werden*.",
    },
    {
      question: "Где стоит инфинитив глагола *werden* в модальном пассиве?",
      options: [
        "На 1-м месте",
        "На 2-м месте рядом с модальным",
        "C) В абсолютном конце предложения после Partizip II",
        "На 3-м месте",
      ],
      answer: 2,
      explanation:
        "По правилу рамочной конструкции неизменяемые элементы сказуемого группируются в конце: *Partizip II + werden*.",
    },
    {
      question: "Какое слово означает «найти компромиссное решение»?",
      options: [
        "eine Frist setzen",
        "B) einen Kompromiss erzielen",
        "einen Einwand erheben",
        "einen Fehler begehen",
      ],
      answer: 1,
      explanation:
        "Устойчивое сочетание — *einen Kompromiss erzielen / schließen* (достичь компромисса).",
    },
    {
      question: "Что означает прилагательное «verbindlich» в контракте?",
      options: [
        "Необязательный",
        "B) Обязательный для исполнения / имеющий юридическую силу",
        "Бесплатный",
        "Срочный",
      ],
      answer: 1,
      explanation: "*verbindlich* = обязывающий, обязательный.",
    },
    {
      question:
        "Прослушайте: *«Die Verhandlungspartner einigten sich darauf, dass die strittigen Punkte von einer unabhängigen Kommission überprüft werden müssen.»* Кому поручили проверку спорных пунктов?",
      options: [
        "Руководству одной из сторон",
        "B) Независимой комиссии",
        "Суду высшей инстанции",
        "Журналистам",
      ],
      answer: 1,
      explanation: "*von einer unabhängigen Kommission* = независимой комиссией.",
    },
  ],
  "b2-07": [
    {
      question: "Какой глагол высокого стиля заменяет разговорное «zeigen» (показывать наглядно)?",
      options: ["gucken", "B) veranschaulichen", "machen", "stellen"],
      answer: 1,
      explanation:
        "*veranschaulichen* — академический глагол для наглядной демонстрации данных или схем.",
    },
    {
      question: "Что означает оборот «Das lässt sich leicht beweisen»?",
      options: [
        "Это нужно доказать",
        "B) Это можно легко доказать",
        "Это нельзя доказать",
        "Доказывать запрещено",
      ],
      answer: 1,
      explanation:
        "Конструкция *sich lassen + Infinitiv* выражает пассивную возможность (= *kann bewiesen werden*).",
    },
    {
      question: "Что означает прилагательное «plausibel»?",
      options: [
        "Ошибочный",
        "B) Правдоподобный / логичный и убедительный",
        "Устаревший",
        "Срочный",
      ],
      answer: 1,
      explanation: "*plausibel* = убедительный, правдоподобный.",
    },
    {
      question:
        "Какая форма глагола *haben* верна в косвенной речи: «Der Forscher betonte, man _____ neue Erkenntnisse gewonnen.»",
      options: ["A) habe", "hat", "hätte", "habest"],
      answer: 0,
      explanation: "Для местоимения *man* (3-е лицо ед.ч.) форма Konjunktiv I — *habe*.",
    },
    {
      question:
        "Прослушайте: *«Trotz anfänglicher Skepsis in Fachkreisen erwiesen sich die Untersuchungsergebnisse als wissenschaftlich fundiert und reproduzierbar.»* Каков научный статус результатов?",
      options: [
        "Они оказались подделкой",
        "B) Они оказались научно обоснованными и воспроизводимыми",
        "Эксперты отклонили исследование",
        "Требуется повторить всё с нуля",
      ],
      answer: 1,
      explanation: "*fundiert und reproduzierbar* = обоснованные и воспроизводимые.",
    },
  ],
  "c1-01": [
    {
      question:
        "Как образуется Partizip I от глагола *steigen* в роли определения перед средним родом (das Einkommen)?",
      options: [
        "das gestiegene Einkommen",
        "B) das steigende Einkommen",
        "das steigen Einkommen",
        "das zu steigende Einkommen",
      ],
      answer: 1,
      explanation:
        "Partizip I образуется от инфинитива + суффикс *-d-* + падежное окончание прилагательного (*steigend-es*).",
    },
    {
      question: "Что грамматически означает оборот «die gestern unterschriebenen Verträge»?",
      options: [
        "Договоры, которые вчера подписывали",
        "B) Договоры, которые были подписаны вчера",
        "Договоры, которые подпишут завтра",
        "Договоры, которые планируют подписать",
      ],
      answer: 1,
      explanation:
        "Partizip II *unterschrieben* выражает пассивное завершённое действие (= *Verträge, die gestern unterschrieben wurden*).",
    },
    {
      question: "Какое слово означает «привлекать в качестве доказательства или источника»?",
      options: ["verhindern", "B) heranziehen", "löschen", "aufwachsen"],
      answer: 1,
      explanation:
        "*Quellen / Daten heranziehen* — привлекать научные источники или статистические данные.",
    },
    {
      question: "Где располагаются зависимые слова в расширенном причастном определении?",
      options: [
        "После определяемого существительного",
        "B) Строго между артиклем и самим причастием перед существительным",
        "В самом конце предложения",
        "Перед артиклем",
      ],
      answer: 1,
      explanation:
        "Распространённое определение заключается в так называемую именную рамку: `Артикль [зависимые слова + причастие] Существительное`.",
    },
    {
      question:
        "Прослушайте: *«Die zugrunde liegende Prämisse bedarf einer eingehenden theoretischen Revision.»* Что требуется сделать с исходной предпосылкой?",
      options: [
        "Подтвердить экспериментально",
        "B) Подвергнуть глубокому теоретическому пересмотру",
        "Принять без обсуждения",
        "Опубликовать в СМИ",
      ],
      answer: 1,
      explanation:
        "*bedarf einer eingehenden Revision* = нуждается в тщательном и глубоком пересмотре.",
    },
  ],
  "c1-02": [
    {
      question: "Какой предлог с Genitiv выражает прямое логическое следствие («вследствие»)?",
      options: ["anlässlich", "B) infolge", "ungeachtet", "statt"],
      answer: 1,
      explanation: "*infolge + Genitiv* означает «вследствие / в результате чего-либо».",
    },
    {
      question:
        "Вставьте верный предлог: «_____ des fünfzigjährigen Firmenjubiläums (das) gab es ein Fest.»",
      options: ["A) Anlässlich", "Infolge", "Ungeachtet", "Wegen"],
      answer: 0,
      explanation:
        "Для торжественных дат и официальных поводов используется предлог *anlässlich + Genitiv* («по случаю»).",
    },
    {
      question: "Какой предлог является синонимом предлога *trotz* в официальном стиле?",
      options: ["laut", "dank", "C) ungeachtet", "mangels"],
      answer: 2,
      explanation:
        "*ungeachtet + Genitiv* — изысканный синоним слова *trotz* («невзирая на / не считаясь с»).",
    },
    {
      question: "Что означает термин «die Inbetriebnahme»?",
      options: [
        "Закрытие фабрики",
        "B) Ввод в промышленную эксплуатацию оборудования / объекта",
        "Увольнение персонала",
        "Продажа акций",
      ],
      answer: 1,
      explanation:
        "*in Betrieb nehmen* $\\rightarrow$ *die Inbetriebnahme* = запуск / ввод в действие.",
    },
    {
      question:
        "Прослушайте: *«Ungeachtet massiver Bedenken der Umweltschützer wurde das Infrastrukturprojekt genehmigt.»* Что произошло с проектом?",
      options: [
        "Его заморозили из-за экологов",
        "B) Его утвердили, невзирая на протесты экологов",
        "Его отправили на доработку",
        "Экологи одобрили проект",
      ],
      answer: 1,
      explanation:
        "*Ungeachtet massiver Bedenken genehmigt* = утверждён, невзирая на серьёзные возражения.",
    },
  ],
  "c1-03": [
    {
      question:
        "Какой глагол занимает первое место во фразе «Если вдруг у вас возникнут вопросы...»?",
      options: ["A) Sollten", "Wenn", "Würden", "Hätten"],
      answer: 0,
      explanation:
        "Бессоюзное условное предложение реального типа начинается со спрягаемой формы глагола *Sollten*: *Sollten Sie Fragen haben...*.",
    },
    {
      question: "Что означает фразеологизм «Das fällt kaum ins Gewicht»?",
      options: [
        "Это весит очень много",
        "B) Это практически не имеет значения / несущественно",
        "Это привело к перегрузке",
        "Это очень дорого стоит",
      ],
      answer: 1,
      explanation:
        "*ins Gewicht fallen* = иметь значение/вес. С отрицанием *kaum* — «почти не имеет значения».",
    },
    {
      question: "Каково значение выражения «die Weichen für die Zukunft stellen»?",
      options: [
        "Строить железную дорогу",
        "B) Задать направление и определить вектор будущего развития",
        "Отложить решение на будущее",
        "Отремонтировать стрелки",
      ],
      answer: 1,
      explanation:
        "Метафора железнодорожной стрелки (*die Weiche*) означает выбор пути и определение стратегии.",
    },
    {
      question: "Что означает прилагательное «unabdingbar»?",
      options: [
        "Второстепенный",
        "B) Совершенно обязательный / непреложный",
        "Случайный",
        "Невыгодный",
      ],
      answer: 1,
      explanation: "*unabdingbar* = абсолютно необходимое условие, без которого ничего не выйдет.",
    },
    {
      question:
        "Прослушайте: *«Hätten die Verhandlungsführer die Tragweite der Klausel rechtzeitig erkannt, wäre der Streitfall vermeidbar gewesen.»* Почему возник судебный спор?",
      options: [
        "Из-за нехватки денег",
        "B) Потому что переговорщики вовремя не оценили масштаб последствий пункта договора",
        "Из-за отказа одной из сторон подписать договор",
        "Из-за ошибки юристов другой стороны",
      ],
      answer: 1,
      explanation:
        "*Hätten sie die Tragweite erkannt...* = если бы они осознали масштаб (но они его не осознали, поэтому спор случился).",
    },
  ],
  "c1-04": [
    {
      question:
        "Какое эквивалентное значение имеет фраза «Dieses Formular ist sofort auszufüllen»?",
      options: [
        "Dieses Formular darf ausgefüllt werden.",
        "B) Dieses Formular muss sofort ausgefüllt werden.",
        "Dieses Formular wurde ausgefüllt.",
        "Man hat das Formular ausgefüllt.",
      ],
      answer: 1,
      explanation:
        "В утвердительных предписаниях конструкция *sein + zu + Infinitiv* выражает категорическую необходимость (*müssen*).",
    },
    {
      question: "Как переводится фраза «Der Text ist kaum zu entziffern»?",
      options: [
        "Текст необходимо переписать",
        "B) Текст едва ли возможно разобрать / прочесть",
        "Текст уже расшифрован",
        "Текст нельзя удалять",
      ],
      answer: 1,
      explanation:
        "Со словом *kaum* (едва ли) конструкция *sein + zu* означает пассивную невозможность (= *kann kaum entziffert werden*).",
    },
    {
      question: "С каким предлогом сочетается существительное Widerspruch?",
      options: ["für + Akkusativ", "B) zu + Dativ", "an + Dativ", "über + Akkusativ"],
      answer: 1,
      explanation:
        "Устойчивое академическое сочетание — *im Widerspruch stehen zu + Dativ* (противоречить чему-либо).",
    },
    {
      question: "Что означает глагол «konstatieren»?",
      options: [
        "Опровергать",
        "B) Официально устанавливать / констатировать как факт",
        "Сомневаться",
        "Планировать",
      ],
      answer: 1,
      explanation: "*konstatieren* = констатировать факт, делать вывод о наличии чего-либо.",
    },
    {
      question:
        "Прослушайте: *«Hinsichtlich der inneren Kohärenz der Argumentationskette sind dem Autor gravierende Versäumnisse anzulasten.»* В чём упрекают автора статьи?",
      options: [
        "В плагиате",
        "B) В серьёзных промахах в логической связности аргументации",
        "В слишком длинном вступлении",
        "В нехватке иллюстраций",
      ],
      answer: 1,
      explanation:
        "*innere Kohärenz* = внутренняя логическая связность; *gravierende Versäumnisse anzulasten* = вменить в вину серьёзные упущения.",
    },
  ],
  "c1-05": [
    {
      question: "Что означает идиома «etwas auf den Punkt bringen»?",
      options: [
        "Поставить точку в конце предложения",
        "B) Кратко и точно сформулировать самую суть дела",
        "Начать спор заново",
        "Нарисовать схему",
      ],
      answer: 1,
      explanation: "*etwas auf den Punkt bringen* = выразить главную суть без лишних слов.",
    },
    {
      question: "Какое слово означает глубокое расхождение или противоречие во взглядах?",
      options: ["die Kohärenz", "B) die Divergenz", "die Inbetriebnahme", "das Fazit"],
      answer: 1,
      explanation: "*die Divergenz* = расхождение позиций или векторов развития.",
    },
    {
      question: "Какое слово обозначает резкий разрыв между ожиданиями и реальностью?",
      options: ["die Weiche", "B) die Diskrepanz", "die Auswirkung", "der Einwand"],
      answer: 1,
      explanation: "*die Diskrepanz* = несоответствие, явный разрыв.",
    },
    {
      question: "Что является главной целью языковой медиации (Sprachmittlung) на экзамене C1?",
      options: [
        "Дословный перевод каждого слова",
        "B) Адаптация смысла сложного исходного сообщения под конкретного адресата в понятной форме",
        "Заучивание текста наизусть",
        "Написание грамматических правил",
      ],
      answer: 1,
      explanation:
        "Медиация проверяет способность передать коммуникативный смысл с изменением регистра и отбором главного.",
    },
    {
      question:
        "Прослушайте: *«Der Mediator betonte, dass vor einer Einigung zunächst das gegenseitige Misstrauen abgebaut werden müsse.»* Что необходимо устранить в первую очередь?",
      options: [
        "Нехватку финансовых средств",
        "B) Взаимное недоверие сторон",
        "Юридические ошибки в договоре",
        "Давление со стороны прессы",
      ],
      answer: 1,
      explanation:
        "*das gegenseitige Misstrauen abgebaut werden müsse* = необходимо ликвидировать взаимное недоверие.",
    },
  ],
  "c1-06": [
    {
      question: "Какое слово означает «утративший актуальность / морально устаревший»?",
      options: ["plausibel", "B) obsolet", "fundiert", "unabdingbar"],
      answer: 1,
      explanation:
        "*obsolet* — латинский научный термин для устаревших гипотез, законов или методов.",
    },
    {
      question:
        "Какое значение имеет оборот «Diese Schlussfolgerung ist keineswegs als gesichert anzusehen»?",
      options: [
        "Этот вывод точно доказан",
        "B) Этот вывод никоим образом нельзя считать доказанным",
        "Этот вывод нужно опубликовать",
        "Этот вывод был сделан вчера",
      ],
      answer: 1,
      explanation:
        "*ist keineswegs anzusehen* = никоим образом не может считаться (= *kann keineswegs angesehen werden*).",
    },
    {
      question: "Что означает термин «die Quintessenz»?",
      options: [
        "Пятый параграф закона",
        "B) Самое главное / концентрированная суть всего исследования",
        "Список использованной литературы",
        "Финансовый отчёт",
      ],
      answer: 1,
      explanation: "*die Quintessenz* = квинтэссенция, главная суть мысли.",
    },
    {
      question: "Какое предложение построено грамматически безупречно?",
      options: [
        "Sollte es regnen, wir bleiben zu Hause dann.",
        "B) Sollte sich die Lage verschärfen, so sind unverzüglich Maßnahmen zu ergreifen.",
        "Wenn sollte die Lage verschärfen, sind Maßnahmen zu ergreifen.",
        "Sollte die Lage sich verschärfen, so Maßnahmen ergriffen werden müssen.",
      ],
      answer: 1,
      explanation:
        "В бессоюзном условном предложении глагол *Sollte* начинает фразу, а коррелят *so* во второй части сразу предваряет спрягаемый глагол *sind*.",
    },
    {
      question:
        "Прослушайте: *«Die Quintessenz dieses Symposiums lässt sich darin zusammenfassen, dass interdisziplinäre Synergien unabdingbar sind, um der Komplexität globaler Krisen adäquat zu begegnen.»* Каково главное условие преодоления глобальных кризисов согласно докладу?",
      options: [
        "Изоляция научных дисциплин",
        "B) Необходимость междисциплинарного взаимодействия (синергии)",
        "Увеличение штата чиновников",
        "Отказ от теоретических моделей",
      ],
      answer: 1,
      explanation:
        "*interdisziplinäre Synergien unabdingbar sind* = междисциплинарное взаимодействие категорически необходимо.",
    },
  ],
};
