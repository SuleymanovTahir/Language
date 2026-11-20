export type CourseLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export type CourseUnit = {
  id: string;
  level: CourseLevel;
  title: string;
  outcome: string;
  moduleIds: number[];
  vocabulary: string[];
  grammarTitle: string;
  theory: string;
  examples: string[];
  dialogue: string;
  listeningQuestion: string;
  listeningOptions: string[];
  listeningAnswer: number;
  reading: string;
  readingQuestion: string;
  readingOptions: string[];
  readingAnswer: number;
  speakingPrompt: string;
  writingPrompt: string;
  writingExample: string;
};

type Seed = Omit<CourseUnit, "id" | "level">;
const unit = (id: string, level: CourseLevel, seed: Seed): CourseUnit => ({ id, level, ...seed });

export const GERMAN_COURSE: CourseUnit[] = [
  unit("a1-01", "A1", {
    title: "Первое знакомство",
    outcome: "Представиться, назвать страну и язык, понять такие же вопросы собеседника.",
    moduleIds: [1, 3],
    vocabulary: [
      "heißen — зваться",
      "kommen — быть родом",
      "sprechen — говорить",
      "die Sprache — язык",
      "Guten Tag — добрый день",
    ],
    grammarTitle: "Местоимения и sein",
    theory:
      "В немецкой фразе обычно нужен субъект. Sein меняется по лицу: ich bin, du bist, er/sie ist, Sie sind.",
    examples: [
      "Ich heiße Nino. — Меня зовут Нино.",
      "Ich komme aus Georgien. — Я из Грузии.",
      "Welche Sprache sprechen Sie? — На каком языке Вы говорите?",
    ],
    dialogue:
      "Guten Tag. Ich heiße Lena. Wie heißen Sie? — Ich heiße Timur. Woher kommen Sie? — Ich komme aus Georgien.",
    listeningQuestion: "Откуда Timur?",
    listeningOptions: ["Aus Georgien", "Aus Deutschland", "Aus Österreich"],
    listeningAnswer: 0,
    reading:
      "Steckbrief: Nino kommt aus Georgien. Sie spricht Georgisch und lernt Deutsch. Sie wohnt in Tiflis.",
    readingQuestion: "Где живёт Nino?",
    readingOptions: ["In Tiflis", "In Wien", "In Berlin"],
    readingAnswer: 0,
    speakingPrompt:
      "Представьтесь: имя, страна, город и язык. Затем ответьте на вопрос Woher kommen Sie?",
    writingPrompt: "Заполните мини-профиль о себе четырьмя короткими фразами.",
    writingExample:
      "Ich heiße Nino. Ich komme aus Georgien. Ich wohne in Tiflis. Ich spreche Georgisch.",
  }),
  unit("a1-02", "A1", {
    title: "Личная информация",
    outcome: "Спросить и сообщить имя, город, занятие и простые сведения о себе.",
    moduleIds: [1, 3, 4],
    vocabulary: [
      "wohnen — жить",
      "lernen — учить",
      "arbeiten — работать",
      "die Stadt — город",
      "der Beruf — профессия",
    ],
    grammarTitle: "Präsens и глагол на втором месте",
    theory:
      "В обычном предложении спрягаемый глагол стоит на втором месте. В вопросе без вопросительного слова глагол стоит первым.",
    examples: [
      "Ich wohne in Tiflis. — Я живу в Тбилиси.",
      "Heute lerne ich Deutsch. — Сегодня я учу немецкий.",
      "Arbeiten Sie hier? — Вы здесь работаете?",
    ],
    dialogue:
      "Wo wohnen Sie? — Ich wohne in Tiflis. Was machen Sie beruflich? — Ich studiere und lerne Deutsch.",
    listeningQuestion: "Что делает собеседник?",
    listeningOptions: ["Учится и изучает немецкий", "Работает в отеле", "Живёт в Берлине"],
    listeningAnswer: 0,
    reading: "Mariam wohnt in Batumi. Sie studiert Medizin. Am Abend lernt sie Deutsch.",
    readingQuestion: "Что Mariam делает вечером?",
    readingOptions: ["Учит немецкий", "Работает в больнице", "Едет в Тбилиси"],
    readingAnswer: 0,
    speakingPrompt:
      "Ответьте на вопросы Wo wohnen Sie? и Was machen Sie? Затем задайте их собеседнику.",
    writingPrompt: "Напишите о себе четыре предложения, включая одно с Heute в начале.",
    writingExample:
      "Ich wohne in Tiflis. Ich studiere. Heute lerne ich Deutsch. Ich arbeite am Wochenende.",
  }),
  unit("a1-03", "A1", {
    title: "Семья и люди",
    outcome: "Назвать членов семьи и описать, кому они приходятся.",
    moduleIds: [9, 10, 11],
    vocabulary: [
      "die Familie — семья",
      "der Bruder — брат",
      "die Schwester — сестра",
      "die Eltern — родители",
      "mein/meine — мой/моя",
    ],
    grammarTitle: "Nominativ и притяжательные слова",
    theory:
      "Артикль и притяжательное слово согласуются с существительным: der Bruder, die Schwester, das Kind; mein Bruder, meine Schwester, mein Kind.",
    examples: [
      "Das ist meine Schwester. — Это моя сестра.",
      "Mein Bruder wohnt in Berlin. — Мой брат живёт в Берлине.",
      "Ich habe keine Kinder. — У меня нет детей.",
    ],
    dialogue:
      "Das ist meine Familie. Meine Schwester heißt Sara. Mein Bruder wohnt in Berlin. Meine Eltern wohnen in Tiflis.",
    listeningQuestion: "Где живут родители?",
    listeningOptions: ["В Тбилиси", "В Берлине", "В Вене"],
    listeningAnswer: 0,
    reading:
      "Ali hat eine Schwester und einen Bruder. Seine Schwester studiert. Sein Bruder arbeitet in einem Café.",
    readingQuestion: "Где работает брат Ali?",
    readingOptions: ["В кафе", "В университете", "В банке"],
    readingAnswer: 0,
    speakingPrompt: "Опишите семью на фотографии или вымышленную семью: кто это и где живёт.",
    writingPrompt: "Напишите подписи к трём членам семьи, используя mein/meine.",
    writingExample:
      "Das ist mein Bruder. Meine Schwester wohnt in Batumi. Meine Eltern sprechen Georgisch.",
  }),
  unit("a1-04", "A1", {
    title: "День и расписание",
    outcome: "Понять время и рассказать о типичном дне.",
    moduleIds: [5, 6, 7, 8],
    vocabulary: [
      "am Morgen — утром",
      "um acht Uhr — в восемь",
      "aufstehen — вставать",
      "lernen — учиться",
      "oft — часто",
    ],
    grammarTitle: "um/am/im и отделяемые глаголы",
    theory:
      "Um употребляется с точным временем, am — с днями и частями дня, im — с месяцами и сезонами. У отделяемого глагола приставка уходит в конец.",
    examples: [
      "Ich stehe um sieben Uhr auf. — Я встаю в семь.",
      "Am Montag arbeite ich. — В понедельник я работаю.",
      "Im Sommer habe ich Urlaub. — Летом у меня отпуск.",
    ],
    dialogue:
      "Am Montag beginnt der Kurs um acht Uhr. Ich stehe um sieben Uhr auf. Am Abend koche ich.",
    listeningQuestion: "Во сколько начинается курс?",
    listeningOptions: ["В восемь", "В семь", "В девять"],
    listeningAnswer: 0,
    reading: "Wochenplan: Montag Deutschkurs um 8 Uhr. Dienstag Sport am Abend. Freitag frei.",
    readingQuestion: "Когда свободный день?",
    readingOptions: ["В пятницу", "Во вторник", "В понедельник"],
    readingAnswer: 0,
    speakingPrompt:
      "Расскажите о своём дне: утром, днём и вечером. Назовите хотя бы одно точное время.",
    writingPrompt: "Составьте план на завтра из четырёх строк.",
    writingExample:
      "Um 7 Uhr stehe ich auf. Am Morgen arbeite ich. Um 18 Uhr lerne ich Deutsch. Am Abend koche ich.",
  }),
  unit("a1-05", "A1", {
    title: "Кафе, еда и покупки",
    outcome: "Сделать заказ, понять цену и назвать нужное количество.",
    moduleIds: [13, 14, 15, 16],
    vocabulary: [
      "der Kaffee — кофе",
      "das Wasser — вода",
      "möchten — хотеть (вежливо)",
      "die Rechnung — счёт",
      "ein Kilo — килограмм",
    ],
    grammarTitle: "Akkusativ и вежливый заказ",
    theory:
      "В Akkusativ меняется артикль мужского рода: der/ein → den/einen. Для заказа удобно использовать готовую формулу Ich möchte… .",
    examples: [
      "Ich möchte einen Kaffee. — Я хотел(а) бы кофе.",
      "Wir kaufen eine Flasche Wasser. — Мы покупаем бутылку воды.",
      "Ich trinke gern Tee. — Я охотно пью чай.",
    ],
    dialogue:
      "Guten Tag. Ich möchte einen Kaffee und ein Wasser. — Zusammen oder getrennt? — Zusammen, bitte. — Das macht sechs Euro.",
    listeningQuestion: "Что заказал гость?",
    listeningOptions: ["Кофе и воду", "Чай и суп", "Воду и пирог"],
    listeningAnswer: 0,
    reading: "Café Morgen: Kaffee 3 Euro, Tee 2 Euro, Wasser 2 Euro. Die Rechnung ist am Tisch.",
    readingQuestion: "Сколько стоит чай?",
    readingOptions: ["2 Euro", "3 Euro", "5 Euro"],
    readingAnswer: 0,
    speakingPrompt: "Разыграйте заказ в кафе: попросите меню, выберите два пункта и спросите счёт.",
    writingPrompt: "Составьте список покупок из пяти пунктов и сообщение другу.",
    writingExample: "Ich kaufe ein Kilo Äpfel, Brot und Wasser. Möchtest du auch Tee?",
  }),
  unit("a1-06", "A1", {
    title: "Город и транспорт",
    outcome: "Спросить дорогу и понять короткую инструкцию.",
    moduleIds: [12, 17, 18],
    vocabulary: [
      "der Bahnhof — вокзал",
      "geradeaus — прямо",
      "links — налево",
      "der Bus — автобус",
      "abfahren — отправляться",
    ],
    grammarTitle: "Вопросы о месте и вежливая инструкция",
    theory:
      "Чтобы спросить о месте, используйте Wo ist…? Для инструкции — вежливый Imperativ: Gehen Sie…, Nehmen Sie… . Частые направления учатся целыми выражениями.",
    examples: [
      "Wo ist der Bahnhof? — Где вокзал?",
      "Gehen Sie geradeaus. — Идите прямо.",
      "Der Zug fährt um acht ab. — Поезд отправляется в восемь.",
    ],
    dialogue:
      "Entschuldigung, wo ist der Bahnhof? — Gehen Sie geradeaus und dann links. — Danke schön!",
    listeningQuestion: "Куда нужно повернуть?",
    listeningOptions: ["Налево", "Направо", "Назад"],
    listeningAnswer: 0,
    reading: "Bus 4: Zentrum — Bahnhof — Universität. Abfahrt am Montag um 8:15 Uhr.",
    readingQuestion: "Во сколько отправляется автобус?",
    readingOptions: ["В 8:15", "В 8:50", "В 9:15"],
    readingAnswer: 0,
    speakingPrompt:
      "По карте объясните путь от остановки до вокзала. Затем спросите дорогу к кафе.",
    writingPrompt: "Напишите другу, как дойти от остановки до вашего дома.",
    writingExample: "Gehen Sie geradeaus. Dann gehen Sie rechts. Mein Haus ist neben dem Park.",
  }),
  unit("a1-07", "A1", {
    title: "Дом и вещи",
    outcome: "Описать комнату и сказать, что в ней находится.",
    moduleIds: [19, 20, 21, 22],
    vocabulary: [
      "das Zimmer — комната",
      "der Tisch — стол",
      "das Bett — кровать",
      "die Küche — кухня",
      "groß/klein — большой/маленький",
    ],
    grammarTitle: "es gibt и описание места",
    theory:
      "Es gibt употребляется с Akkusativ: In der Wohnung gibt es einen Balkon. С sein прилагательное обычно не получает окончания: Das Zimmer ist hell.",
    examples: [
      "Es gibt einen Tisch. — Есть стол.",
      "Das Zimmer ist groß. — Комната большая.",
      "Die Lampe steht auf dem Tisch. — Лампа стоит на столе.",
    ],
    dialogue:
      "In meiner Wohnung gibt es zwei Zimmer. Das Bett steht im Schlafzimmer. In der Küche gibt es einen großen Tisch.",
    listeningQuestion: "Сколько комнат в квартире?",
    listeningOptions: ["Две", "Три", "Одну"],
    listeningAnswer: 0,
    reading:
      "Zimmer frei: Das Zimmer ist hell und klein. Es gibt ein Bett und einen Schreibtisch. Die Küche ist neben dem Zimmer.",
    readingQuestion: "Какая кухня?",
    readingOptions: ["Рядом с комнатой", "На третьем этаже", "В квартире её нет"],
    readingAnswer: 0,
    speakingPrompt: "Опишите комнату по плану. Используйте es gibt и две фразы о расположении.",
    writingPrompt: "Напишите короткое объявление об идеальной комнате.",
    writingExample:
      "Mein Zimmer ist hell. Es gibt ein Bett und einen Tisch. Die Lampe steht auf dem Tisch.",
  }),
  unit("a1-08", "A1", {
    title: "Просьбы, планы и итог A1",
    outcome: "Договориться о встрече, попросить о помощи и выполнить бытовые задачи A1.",
    moduleIds: [2, 3, 7, 24],
    vocabulary: [
      "können — мочь/уметь",
      "müssen — быть должным",
      "wollen — хотеть",
      "die Zeit — время",
      "Hilfe — помощь",
    ],
    grammarTitle: "Модальные глаголы",
    theory:
      "Модальный глагол стоит на втором месте и изменяется по лицу; смысловой глагол остаётся в инфинитиве в конце: Ich kann Deutsch sprechen.",
    examples: [
      "Kannst du am Samstag kommen? — Ты можешь прийти в субботу?",
      "Ich muss heute arbeiten. — Мне нужно сегодня работать.",
      "Können Sie mir helfen? — Вы можете мне помочь?",
    ],
    dialogue:
      "Kannst du am Samstag kommen? — Leider muss ich arbeiten. Am Sonntag habe ich Zeit. — Gut, um zwölf Uhr?",
    listeningQuestion: "Когда у собеседников есть время?",
    listeningOptions: ["В воскресенье", "В субботу", "В пятницу"],
    listeningAnswer: 0,
    reading:
      "Einladung: Wir treffen uns am Sonntag um 12 Uhr im Café am Bahnhof. Bitte bring ein Buch mit.",
    readingQuestion: "Что нужно принести?",
    readingOptions: ["Книгу", "Билет", "Еду"],
    readingAnswer: 0,
    speakingPrompt:
      "Договоритесь о встрече. Предложите время, откажитесь от одного варианта и предложите другой.",
    writingPrompt: "Ответьте на приглашение тремя-четырьмя фразами.",
    writingExample:
      "Danke für die Einladung. Am Samstag kann ich nicht kommen. Am Sonntag habe ich Zeit. Bis dann!",
  }),

  unit("a2-01", "A2", {
    title: "Выходные и прошедшие события",
    outcome: "Рассказать, что произошло вчера или на выходных.",
    moduleIds: [7, 12, 24],
    vocabulary: [
      "am Wochenende — на выходных",
      "besuchen — посещать",
      "gemacht — сделал",
      "gefahren — поехал",
      "danach — после этого",
    ],
    grammarTitle: "Perfekt: haben или sein",
    theory:
      "Perfekt строится из haben/sein и Partizip II. Частые глаголы движения учатся по конкретным примерам, потому что выбор вспомогательного глагола нельзя свести к одному простому правилу.",
    examples: [
      "Ich habe Freunde besucht. — Я навестил(а) друзей.",
      "Wir sind nach Batumi gefahren. — Мы поехали в Батуми.",
      "Danach haben wir gekocht. — После этого мы готовили.",
    ],
    dialogue:
      "Was hast du am Wochenende gemacht? — Ich bin nach Batumi gefahren. Danach habe ich meine Freunde besucht.",
    listeningQuestion: "Кого посетил говорящий?",
    listeningOptions: ["Друзей", "Родителей", "Коллег"],
    listeningAnswer: 0,
    reading:
      "Am Samstag ist Nino nach Batumi gefahren. Sie hat Freunde besucht. Am Abend haben sie zusammen gekocht.",
    readingQuestion: "Что они делали вечером?",
    readingOptions: ["Готовили вместе", "Ходили в музей", "Смотрели матч"],
    readingAnswer: 0,
    speakingPrompt: "Расскажите о выходных по временной линии: сначала, затем, вечером.",
    writingPrompt: "Напишите другу сообщение о трёх делах на прошлых выходных.",
    writingExample:
      "Am Wochenende bin ich nach Batumi gefahren. Ich habe meine Freundin besucht. Danach haben wir gekocht.",
  }),
  unit("a2-02", "A2", {
    title: "Квартира и расположение",
    outcome: "Описать, где находится предмет, и куда его поставить.",
    moduleIds: [19, 20, 21, 23],
    vocabulary: [
      "die Wohnung — квартира",
      "der Schreibtisch — письменный стол",
      "legen — класть",
      "liegen — лежать",
      "zwischen — между",
    ],
    grammarTitle: "Wo? Dativ / Wohin? Akkusativ",
    theory:
      "У Wechselpräpositionen Wo? требует Dativ, а Wohin? — Akkusativ: Das Buch liegt auf dem Tisch; ich lege das Buch auf den Tisch.",
    examples: [
      "Das Buch liegt auf dem Tisch. — Книга лежит на столе.",
      "Ich lege das Buch auf den Tisch. — Я кладу книгу на стол.",
      "Der Stuhl steht neben dem Bett. — Стул стоит рядом с кроватью.",
    ],
    dialogue:
      "Wo soll der Schreibtisch stehen? — Neben dem Fenster. Und wohin soll ich die Lampe stellen? — Auf den Tisch.",
    listeningQuestion: "Куда поставить лампу?",
    listeningOptions: ["На стол", "Рядом с окном", "Под кровать"],
    listeningAnswer: 0,
    reading:
      "Die Wohnung hat zwei Zimmer. Der Schreibtisch steht am Fenster. Das Bett steht neben der Tür.",
    readingQuestion: "Где письменный стол?",
    readingOptions: ["У окна", "У двери", "На кухне"],
    readingAnswer: 0,
    speakingPrompt: "Один человек описывает комнату, второй размещает предметы на схеме.",
    writingPrompt: "Опишите комнату и дайте две инструкции, куда поставить вещи.",
    writingExample:
      "Der Tisch steht am Fenster. Stell die Lampe auf den Tisch. Leg das Buch neben den Computer.",
  }),
  unit("a2-03", "A2", {
    title: "У врача и в аптеке",
    outcome: "Объяснить симптом и договориться о записи.",
    moduleIds: [25, 26],
    vocabulary: [
      "der Kopf — голова",
      "weh tun — болеть",
      "helfen — помогать",
      "die Apotheke — аптека",
      "seit gestern — со вчера",
    ],
    grammarTitle: "Dativ и просьбы",
    theory:
      "Некоторые частые выражения требуют Dativ: Mir tut der Kopf weh; Können Sie mir helfen? Учите форму в готовой фразе и в диалоге.",
    examples: [
      "Mir tut der Kopf weh. — У меня болит голова.",
      "Können Sie mir helfen? — Вы можете мне помочь?",
      "Ich brauche einen Termin. — Мне нужна запись.",
    ],
    dialogue:
      "Guten Tag. Was fehlt Ihnen? — Mir tut der Hals weh. Seit wann? — Seit gestern. Haben Sie morgen einen Termin?",
    listeningQuestion: "Что болит у пациента?",
    listeningOptions: ["Горло", "Голова", "Спина"],
    listeningAnswer: 0,
    reading:
      "Praxis Müller: Bitte rufen Sie bei Fieber an. Termine am Dienstag und Donnerstag von 9 bis 12 Uhr.",
    readingQuestion: "В какие дни есть запись?",
    readingOptions: ["Во вторник и четверг", "В понедельник и среду", "Только в пятницу"],
    readingAnswer: 0,
    speakingPrompt: "Позвоните в клинику, назовите симптом и спросите о записи завтра.",
    writingPrompt: "Напишите сообщение, чтобы перенести запись к врачу.",
    writingExample:
      "Guten Tag, ich kann morgen leider nicht kommen. Haben Sie am Donnerstag einen neuen Termin? Vielen Dank.",
  }),
  unit("a2-04", "A2", {
    title: "Работа, учёба и прошлый опыт",
    outcome: "Описать рабочий день и рассказать о недавнем опыте.",
    moduleIds: [27, 28, 29, 30],
    vocabulary: [
      "die Aufgabe — задача",
      "der Kollege — коллега",
      "gestern — вчера",
      "konnte — мог",
      "musste — должен был",
    ],
    grammarTitle: "Perfekt и частотный Präteritum",
    theory:
      "Обычные события часто рассказывают в Perfekt. Sein, haben и модальные глаголы часто встречаются в Präteritum: war, hatte, konnte, musste.",
    examples: [
      "Gestern hatte ich viel Arbeit. — Вчера у меня было много работы.",
      "Ich musste einen Bericht schreiben. — Мне нужно было написать отчёт.",
      "Danach habe ich mit Kollegen gesprochen. — Затем я поговорил(а) с коллегами.",
    ],
    dialogue:
      "Wie war dein Tag? — Ich hatte viele Aufgaben. Ich musste einen Bericht schreiben und habe danach mit meinem Team gesprochen.",
    listeningQuestion: "Что говорящий должен был сделать?",
    listeningOptions: ["Написать отчёт", "Позвонить врачу", "Купить билет"],
    listeningAnswer: 0,
    reading:
      "Gestern hatte Alex viele Termine. Am Nachmittag hat er einen Bericht geschrieben. Danach hat er mit dem Team gesprochen.",
    readingQuestion: "С кем Alex разговаривал?",
    readingOptions: ["С командой", "С врачом", "С клиентом в банке"],
    readingAnswer: 0,
    speakingPrompt:
      "Расскажите о вчерашнем рабочем или учебном дне, используя одну форму Präteritum и два Perfekt.",
    writingPrompt: "Напишите коллеге, что вы сделали вчера и какую задачу продолжите сегодня.",
    writingExample:
      "Gestern hatte ich viele Aufgaben. Ich habe einen Bericht geschrieben. Heute arbeite ich an der Präsentation.",
  }),
  unit("a2-05", "A2", {
    title: "Путешествие и планы",
    outcome: "Понять изменение маршрута и договориться о плане поездки.",
    moduleIds: [12, 18, 200, 201, 203],
    vocabulary: [
      "umsteigen — пересаживаться",
      "die Verspätung — задержка",
      "ankommen — прибывать",
      "die Reservierung — бронь",
      "später — позже",
    ],
    grammarTitle: "Отделяемые глаголы и временные связки",
    theory:
      "В Präsens отделяемая приставка стоит в конце: Der Zug kommt um zehn an. Ближайший план часто выражается Präsens вместе с указанием времени.",
    examples: [
      "Der Zug kommt um zehn an. — Поезд прибывает в десять.",
      "Wir steigen in München um. — Мы пересаживаемся в Мюнхене.",
      "Morgen fahren wir nach Berlin. — Завтра мы едем в Берлин.",
    ],
    dialogue:
      "Achtung: Der Zug nach Berlin hat zehn Minuten Verspätung. Bitte steigen Sie in München um.",
    listeningQuestion: "Что должны сделать пассажиры?",
    listeningOptions: ["Пересесть в Мюнхене", "Выйти в Берлине", "Ждать в отеле"],
    listeningAnswer: 0,
    reading:
      "Ihre Reservierung gilt vom 12. bis zum 15. Juli. Das Frühstück beginnt um 7 Uhr. Bitte melden Sie sich an der Rezeption.",
    readingQuestion: "Когда начинается завтрак?",
    readingOptions: ["В 7 часов", "В 12 часов", "В 15 часов"],
    readingAnswer: 0,
    speakingPrompt: "Позвоните в отель, подтвердите бронь и спросите о времени завтрака.",
    writingPrompt: "Напишите другу план поездки из пяти событий.",
    writingExample:
      "Morgen fahren wir nach Berlin. Um 10 Uhr kommen wir an. Danach steigen wir in die U-Bahn um.",
  }),
  unit("a2-06", "A2", {
    title: "Причины и объяснения",
    outcome: "Объяснить причину, условие и мнение простыми сложными предложениями.",
    moduleIds: [4, 11, 24, 33],
    vocabulary: [
      "weil — потому что",
      "dass — что",
      "wenn — если/когда",
      "die Meinung — мнение",
      "deshalb — поэтому",
    ],
    grammarTitle: "Придаточные предложения",
    theory:
      "После weil, dass и wenn спрягаемый глагол уходит в конец придаточной части: Ich bleibe zu Hause, weil ich krank bin.",
    examples: [
      "Ich bleibe zu Hause, weil ich krank bin. — Я остаюсь дома, потому что болен.",
      "Ich glaube, dass der Film gut ist. — Я думаю, что фильм хороший.",
      "Wenn ich Zeit habe, besuche ich dich. — Если у меня будет время, я тебя навещу.",
    ],
    dialogue:
      "Warum kommst du heute nicht? — Ich bleibe zu Hause, weil ich krank bin. Ich hoffe, dass ich morgen wieder fit bin.",
    listeningQuestion: "Почему человек не придёт?",
    listeningOptions: ["Он болен", "Он уехал", "Он работает ночью"],
    listeningAnswer: 0,
    reading:
      "Mila fährt heute nicht Fahrrad, weil es stark regnet. Sie hofft, dass das Wetter morgen besser ist.",
    readingQuestion: "Почему Mila не едет на велосипеде?",
    readingOptions: ["Сильный дождь", "Сломан велосипед", "Она опаздывает на поезд"],
    readingAnswer: 0,
    speakingPrompt:
      "Объясните, почему вы выбираете один из двух планов выходных. Используйте weil и dass.",
    writingPrompt: "Напишите 5 предложений о планах с weil и wenn.",
    writingExample:
      "Wenn das Wetter gut ist, gehe ich spazieren. Ich bleibe zu Hause, weil es heute regnet.",
  }),
  unit("a2-07", "A2", {
    title: "Покупки и вежливая переписка",
    outcome: "Обсудить товар, вежливо попросить решение и написать запрос.",
    moduleIds: [13, 31, 32],
    vocabulary: [
      "die Größe — размер",
      "umtauschen — обменять",
      "die Quittung — чек",
      "Könnten Sie…? — не могли бы Вы…?",
      "günstiger — дешевле",
    ],
    grammarTitle: "Сравнение и вежливые формулы",
    theory:
      "Сравнивайте предметы через größer/billiger/besser. В просьбе используйте готовые формы Könnten Sie…? и Ich hätte gern… .",
    examples: [
      "Dieses Hemd ist günstiger. — Эта рубашка дешевле.",
      "Könnten Sie mir helfen? — Не могли бы Вы мне помочь?",
      "Ich hätte gern eine andere Größe. — Я хотел(а) бы другой размер.",
    ],
    dialogue:
      "Die Jacke ist schön, aber zu groß. — Könnten Sie eine kleinere Größe bringen? — Natürlich. Haben Sie die Quittung?",
    listeningQuestion: "Почему покупатель просит другую вещь?",
    listeningOptions: ["Куртка слишком большая", "Цвет не подходит", "Покупатель потерял чек"],
    listeningAnswer: 0,
    reading:
      "Umtausch nur mit Quittung innerhalb von 14 Tagen. Reduzierte Ware ist vom Umtausch ausgeschlossen.",
    readingQuestion: "Что нужно для обмена?",
    readingOptions: ["Чек", "Паспорт", "Банковская карта"],
    readingAnswer: 0,
    speakingPrompt: "Объясните продавцу проблему и попросите другой размер или возврат.",
    writingPrompt: "Напишите в магазин вежливый запрос на обмен товара.",
    writingExample:
      "Guten Tag, die Jacke ist leider zu groß. Könnten Sie sie gegen Größe M umtauschen? Die Quittung ist dabei.",
  }),
  unit("a2-08", "A2", {
    title: "День поездки · итог A2",
    outcome: "Организовать поездку, понять бытовое аудио и сообщить план.",
    moduleIds: [18, 23, 25, 200, 201, 202, 203],
    vocabulary: [
      "die Abfahrt — отправление",
      "die Unterkunft — жильё",
      "die Nachricht — сообщение",
      "verschieben — перенести",
      "der Treffpunkt — место встречи",
    ],
    grammarTitle: "Повтор времён, падежей и порядка слов",
    theory:
      "В итоговом задании выберите форму по смыслу: рассказ о прошлом — Perfekt, просьба — вежливая форма, причина — придаточная часть с глаголом в конце.",
    examples: [
      "Wir treffen uns um zehn am Bahnhof. — Встречаемся в десять на вокзале.",
      "Ich habe das Hotel gebucht. — Я забронировал(а) отель.",
      "Ich komme später, weil der Zug Verspätung hat. — Я опоздаю, потому что поезд задерживается.",
    ],
    dialogue:
      "Der Zug hat Verspätung. — Wann kommst du an? — Um halb elf. Ich schreibe dir, wenn ich am Bahnhof bin.",
    listeningQuestion: "Во сколько человек прибудет?",
    listeningOptions: ["В половине одиннадцатого", "В десять", "В половине двенадцатого"],
    listeningAnswer: 0,
    reading:
      "Treffpunkt: Haupteingang vom Bahnhof. Bei Verspätung bitte eine Nachricht schicken. Das Hotel ist zehn Minuten zu Fuß entfernt.",
    readingQuestion: "Что нужно сделать при задержке?",
    readingOptions: ["Отправить сообщение", "Позвонить в отель", "Купить новый билет"],
    readingAnswer: 0,
    speakingPrompt:
      "Договоритесь о месте и времени встречи, затем сообщите запасной план при задержке.",
    writingPrompt: "Напишите другу план поездки и короткое сообщение о возможной задержке.",
    writingExample:
      "Wir treffen uns um zehn am Bahnhof. Ich habe das Hotel gebucht. Wenn der Zug Verspätung hat, schreibe ich dir.",
  }),

  unit("b1-01", "B1", {
    title: "Опыт и жизненные истории",
    outcome: "Связно рассказать о событии и выделить последовательность действий.",
    moduleIds: [9, 12, 24, 30],
    vocabulary: [
      "die Erfahrung — опыт",
      "damals — тогда",
      "zuerst — сначала",
      "später — позже",
      "inzwischen — тем временем",
    ],
    grammarTitle: "Perfekt, Präteritum и последовательность",
    theory:
      "В разговорном рассказе чаще используйте Perfekt; формы war/hatte и частотное Präteritum естественны для фона. Plusquamperfekt помогает назвать событие, которое случилось раньше другого прошлого события.",
    examples: [
      "Damals wohnte ich in Tiflis. — Тогда я жил(а) в Тбилиси.",
      "Ich habe zuerst Deutsch gelernt. — Сначала я учил(а) немецкий.",
      "Nachdem ich angekommen war, rief ich meine Familie an. — Приехав, я позвонил(а) семье.",
    ],
    dialogue:
      "Wie bist du nach Deutschland gekommen? — Zuerst habe ich Deutsch gelernt. Nachdem ich die Prüfung bestanden hatte, bin ich nach Berlin gezogen.",
    listeningQuestion: "Что произошло сначала?",
    listeningOptions: [
      "Человек выучил немецкий",
      "Человек переехал в Берлин",
      "Человек нашёл работу",
    ],
    listeningAnswer: 0,
    reading:
      "Vor fünf Jahren zog Amir nach Wien. Zuerst besuchte er einen Sprachkurs. Danach fand er eine Arbeit in einem Hotel.",
    readingQuestion: "Где Amir нашёл работу?",
    readingOptions: ["В отеле", "В университете", "В банке"],
    readingAnswer: 0,
    speakingPrompt: "Расскажите важное событие из жизни за 90 секунд: фон, событие, результат.",
    writingPrompt: "Напишите короткую историю, используя сначала, затем и в конце.",
    writingExample:
      "Zuerst habe ich einen Sprachkurs besucht. Danach fand ich eine Arbeit. Inzwischen wohne ich gern in Wien.",
  }),
  unit("b1-02", "B1", {
    title: "Мнение и общественные темы",
    outcome: "Выразить мнение, поддержать его примером и отреагировать на возражение.",
    moduleIds: [24, 30, 33, 34],
    vocabulary: [
      "die Meinung — мнение",
      "der Vorteil — преимущество",
      "der Nachteil — недостаток",
      "einerseits — с одной стороны",
      "trotzdem — несмотря на это",
    ],
    grammarTitle: "Причина, уступка и следствие",
    theory:
      "Weil/obwohl вводят придаточную часть с глаголом в конце; deshalb/trotzdem занимают позицию в главном предложении и требуют глагол сразу после связки.",
    examples: [
      "Ich fahre Rad, weil es gesund ist. — Я езжу на велосипеде, потому что это полезно.",
      "Obwohl es regnet, gehe ich zu Fuß. — Хотя идёт дождь, я иду пешком.",
      "Es regnet. Trotzdem gehe ich spazieren. — Идёт дождь. Несмотря на это, я иду гулять.",
    ],
    dialogue:
      "Ich finde, Fahrräder sind gut für die Stadt. — Obwohl das stimmt, braucht man sichere Wege. — Deshalb sollte die Stadt mehr Radwege bauen.",
    listeningQuestion: "Что нужно городу?",
    listeningOptions: ["Больше велодорожек", "Больше парковок", "Меньше автобусов"],
    listeningAnswer: 0,
    reading:
      "Viele Menschen fahren gern Fahrrad, weil es günstig ist. Trotzdem fühlen sich manche auf stark befahrenen Straßen unsicher.",
    readingQuestion: "Почему некоторые не чувствуют себя безопасно?",
    readingOptions: ["На дорогах много машин", "Велосипеды дорогие", "Погода всегда плохая"],
    readingAnswer: 0,
    speakingPrompt:
      "Обсудите, нужно ли ограничить автомобили в центре. Назовите преимущество и возражение.",
    writingPrompt: "Напишите форумный ответ на 100–120 слов с мнением, причиной и примером.",
    writingExample:
      "Ich bin dafür, dass… Ein wichtiger Vorteil ist… Trotzdem sollte man beachten, dass…",
  }),
  unit("b1-03", "B1", {
    title: "Учёба, профессия и поиск работы",
    outcome: "Представить опыт и объяснить, почему подходите для вакансии.",
    moduleIds: [27, 28, 29, 30, 204, 205],
    vocabulary: [
      "die Bewerbung — заявление",
      "die Fähigkeit — навык",
      "die Erfahrung — опыт",
      "die Stelle — должность",
      "zuverlässig — надёжный",
    ],
    grammarTitle: "Относительные предложения и um…zu",
    theory:
      "Относительное предложение добавляет сведения о существительном: Das ist ein Kurs, der am Abend stattfindet. Um…zu объясняет цель, если субъект тот же.",
    examples: [
      "Ich suche eine Stelle, die zu meiner Erfahrung passt. — Я ищу должность, подходящую моему опыту.",
      "Ich lerne Deutsch, um in einem Team zu arbeiten. — Я учу немецкий, чтобы работать в команде.",
      "Ich habe Erfahrung, die für diese Aufgabe wichtig ist. — У меня есть важный для этой задачи опыт.",
    ],
    dialogue:
      "Warum interessieren Sie sich für diese Stelle? — Ich habe Erfahrung im Kundenservice und möchte in einem internationalen Team arbeiten.",
    listeningQuestion: "Какой опыт есть у кандидата?",
    listeningOptions: ["Работа с клиентами", "Работа в больнице", "Программирование игр"],
    listeningAnswer: 0,
    reading:
      "Wir suchen eine zuverlässige Person, die gern mit Kunden arbeitet. Wichtig sind gute Deutschkenntnisse und Erfahrung im Team.",
    readingQuestion: "Какое качество важно?",
    readingOptions: ["Надёжность", "Водительские права", "Медицинское образование"],
    readingAnswer: 0,
    speakingPrompt:
      "Ответьте на вопросы собеседования: опыт, сильная сторона, причина интереса к вакансии.",
    writingPrompt: "Напишите короткое сопроводительное письмо к вакансии.",
    writingExample:
      "Sehr geehrte Damen und Herren, ich interessiere mich für die Stelle, weil ich Erfahrung im Kundenservice habe…",
  }),
  unit("b1-04", "B1", {
    title: "Медиа и цифровая жизнь",
    outcome: "Понять статью о технологиях и пересказать её позицию.",
    moduleIds: [35, 36, 38, 39],
    vocabulary: [
      "die Daten — данные",
      "die Nachricht — новость",
      "die Quelle — источник",
      "sich interessieren für — интересоваться",
      "der Datenschutz — защита данных",
    ],
    grammarTitle: "Косвенный вопрос и переданная информация",
    theory:
      "Косвенный вопрос вводится через ob или вопросительное слово, а спрягаемый глагол уходит в конец: Weißt du, ob die App sicher ist? Чужое мнение можно передать через Er sagt, dass… .",
    examples: [
      "Weißt du, ob die Daten sicher sind? — Ты знаешь, защищены ли данные?",
      "Sie sagt, dass die App nützlich ist. — Она говорит, что приложение полезное.",
      "Ich interessiere mich für Datenschutz. — Я интересуюсь защитой данных.",
    ],
    dialogue:
      "Was sagt der Artikel über die App? — Er sagt, dass die App Zeit spart. Weißt du, ob sie Daten speichert? — Das ist nicht klar.",
    listeningQuestion: "Что статья говорит о приложении?",
    listeningOptions: ["Оно экономит время", "Оно не работает", "Оно бесплатное"],
    listeningAnswer: 0,
    reading:
      "Die App spart Zeit. Die Redaktion erklärt aber nicht, welche persönlichen Daten gespeichert werden.",
    readingQuestion: "Что редакция не объясняет?",
    readingOptions: [
      "Какие личные данные сохраняются",
      "Кто разработал приложение",
      "Сколько оно стоит",
    ],
    readingAnswer: 0,
    speakingPrompt: "Перескажите статью и задайте собеседнику один косвенный вопрос о данных.",
    writingPrompt: "Напишите краткое резюме статьи и отметьте, что осталось неизвестным.",
    writingExample: "Der Artikel sagt, dass die App Zeit spart. Es bleibt aber unklar, ob…",
  }),
  unit("b1-05", "B1", {
    title: "Здоровье, окружающая среда и решения",
    outcome: "Предложить практическое решение и объяснить, как его выполнить.",
    moduleIds: [25, 26, 33, 34],
    vocabulary: [
      "die Umwelt — окружающая среда",
      "vermeiden — избегать",
      "die Gesundheit — здоровье",
      "die Lösung — решение",
      "sollte — следовало бы",
    ],
    grammarTitle: "Совет, гипотеза и пассив",
    theory:
      "Konjunktiv II помогает смягчить совет: Man könnte… . В пассиве внимание направлено на действие: Papier wird getrennt gesammelt.",
    examples: [
      "Man könnte mehr Busse einsetzen. — Можно было бы запустить больше автобусов.",
      "Papier wird getrennt gesammelt. — Бумагу собирают раздельно.",
      "Wir sparen Energie, um die Umwelt zu schützen. — Мы экономим энергию, чтобы защитить природу.",
    ],
    dialogue:
      "Was können wir im Viertel ändern? — Man könnte mehr Bäume pflanzen. Plastik wird hier zu oft benutzt.",
    listeningQuestion: "Какое предложение звучит в разговоре?",
    listeningOptions: ["Посадить больше деревьев", "Закрыть парк", "Убрать автобус"],
    listeningAnswer: 0,
    reading:
      "Im Stadtteil wird eine neue Sammelstelle eröffnet. Anwohner können dort Papier und Glas abgeben.",
    readingQuestion: "Что можно сдать в пункте?",
    readingOptions: ["Бумагу и стекло", "Одежду и книги", "Только пластик"],
    readingAnswer: 0,
    speakingPrompt: "Предложите одно изменение для вашего района и объясните его пользу.",
    writingPrompt: "Напишите обращение в городскую службу с предложением.",
    writingExample: "In unserem Viertel könnte man… Dadurch würden…",
  }),
  unit("b1-06", "B1", {
    title: "Графики и длинные тексты",
    outcome: "Описать тенденцию и отделить данные от вывода.",
    moduleIds: [38, 39],
    vocabulary: [
      "steigen — расти",
      "sinken — снижаться",
      "die Zahl — число",
      "der Anteil — доля",
      "im Vergleich zu — по сравнению с",
    ],
    grammarTitle: "Сравнение и связное описание данных",
    theory:
      "Сначала назовите источник/период, затем основное изменение, сравнение и осторожный вывод. Не добавляйте причину, если график её не доказывает.",
    examples: [
      "Die Zahl ist gestiegen. — Число выросло.",
      "Im Vergleich zu 2020 ist der Anteil höher. — Доля выше, чем в 2020 году.",
      "Die Grafik zeigt einen leichten Rückgang. — График показывает небольшое снижение.",
    ],
    dialogue:
      "Was zeigt die Grafik? — Die Zahl steigt von 2020 bis 2023. Der stärkste Anstieg ist im letzten Jahr.",
    listeningQuestion: "Когда рост был самым сильным?",
    listeningOptions: ["В последний год", "В первый год", "Изменений не было"],
    listeningAnswer: 0,
    reading:
      "2020: 20 Prozent. 2021: 24 Prozent. 2022: 25 Prozent. Der Anteil ist langsam gestiegen.",
    readingQuestion: "Как менялся показатель?",
    readingOptions: ["Постепенно рос", "Резко снизился", "Оставался одинаковым"],
    readingAnswer: 0,
    speakingPrompt: "Объясните график за минуту: период, изменение и один осторожный вывод.",
    writingPrompt: "Напишите абзац о тенденции в графике без неподтверждённых причин.",
    writingExample:
      "Die Grafik zeigt… Im Zeitraum von… bis… stieg/sank… Daraus lässt sich schließen, dass…",
  }),
  unit("b1-07", "B1", {
    title: "Жалоба и решение проблемы",
    outcome: "Вежливо описать проблему, назвать ожидание и попросить действие.",
    moduleIds: [23, 29, 31],
    vocabulary: [
      "die Beschwerde — жалоба",
      "der Vertrag — договор",
      "der Fehler — ошибка",
      "innerhalb von — в течение",
      "bitten um — просить о",
    ],
    grammarTitle: "Вежливые просьбы и логика письма",
    theory:
      "Деловое сообщение должно называть проблему, нужную деталь, ожидаемое решение и срок. Смягчайте просьбу через Ich möchte Sie bitten… или Könnten Sie…? .",
    examples: [
      "Ich möchte Sie um eine Prüfung bitten. — Прошу Вас проверить.",
      "Könnten Sie mir den Betrag zurückzahlen? — Не могли бы Вы вернуть сумму?",
      "Die Rechnung wurde zweimal bezahlt. — Счёт оплатили дважды.",
    ],
    dialogue:
      "Ich habe die Rechnung zweimal bezahlt. — Haben Sie den Beleg? — Ja, ich sende ihn Ihnen heute.",
    listeningQuestion: "Что клиент отправит сегодня?",
    listeningOptions: ["Подтверждение оплаты", "Новый договор", "Паспорт"],
    listeningAnswer: 0,
    reading:
      "Bitte melden Sie Fehler innerhalb von 14 Tagen. Fügen Sie eine Kopie der Rechnung und Ihre Kundennummer bei.",
    readingQuestion: "Что нужно приложить?",
    readingOptions: ["Копию счёта и номер клиента", "Паспорт и фотографию", "Новый договор"],
    readingAnswer: 0,
    speakingPrompt: "Объясните проблему сотруднику и договоритесь, какие документы отправить.",
    writingPrompt: "Напишите формальную жалобу, включив проблему, доказательство и просьбу.",
    writingExample:
      "Sehr geehrte Damen und Herren, ich wende mich an Sie, weil… Könnten Sie bitte… Mit freundlichen Grüßen…",
  }),
  unit("b1-08", "B1", {
    title: "Итог B1 · мнение и презентация",
    outcome: "Понять связный текст, написать мнение и выступить по знакомой теме.",
    moduleIds: [27, 30, 33, 38],
    vocabulary: [
      "zusammenfassen — обобщать",
      "begründen — обосновывать",
      "der Standpunkt — позиция",
      "das Beispiel — пример",
      "abschließend — в заключение",
    ],
    grammarTitle: "Связность и самоконтроль",
    theory:
      "В финальном задании важнее выполнить коммуникативную цель, связать мысли и быть понятным, чем использовать редкие конструкции.",
    examples: [
      "Meiner Meinung nach… — По моему мнению…",
      "Ein Beispiel dafür ist… — Примером этого является…",
      "Abschließend möchte ich betonen… — В заключение хочу подчеркнуть…",
    ],
    dialogue:
      "Sollten Schulen digitale Bücher verwenden? — Einerseits sind sie praktisch. Andererseits braucht nicht jeder ein eigenes Gerät.",
    listeningQuestion: "Какой недостаток упомянут?",
    listeningOptions: [
      "Не у всех есть своё устройство",
      "Книги слишком тяжёлые",
      "Интернет слишком быстрый",
    ],
    listeningAnswer: 0,
    reading:
      "Digitale Bücher sind praktisch und leicht zu aktualisieren. Für manche Lernende ist ein Bildschirm jedoch anstrengend.",
    readingQuestion: "Какой аргумент против цифровых книг приведён?",
    readingOptions: ["Экран утомляет некоторых", "Их нельзя обновлять", "Они слишком дешёвые"],
    readingAnswer: 0,
    speakingPrompt: "Выступите две минуты: мнение, два основания, пример и ответ на вопрос.",
    writingPrompt: "Напишите форумный пост с позицией и контраргументом.",
    writingExample:
      "Meiner Meinung nach… Ein wichtiger Grund ist… Allerdings sollte man auch berücksichtigen…",
  }),

  unit("b2-01", "B2", {
    title: "Аргументы и структура текста",
    outcome: "Различать тезис и доводы, ясно отстаивать позицию.",
    moduleIds: [30, 33, 34, 39],
    vocabulary: [
      "die Voraussetzung — предпосылка",
      "folglich — следовательно",
      "hingegen — напротив",
      "die Auswirkung — последствие",
      "berücksichtigen — учитывать",
    ],
    grammarTitle: "Логические связки и порядок слов",
    theory:
      "Связка показывает отношение между мыслями. После deshalb/folglich спрягаемый глагол стоит сразу: Deshalb benötigen wir… . Уступку можно вводить через obwohl или dennoch.",
    examples: [
      "Die Kosten sind hoch. Dennoch lohnt sich die Investition. — Расходы высоки, тем не менее вложение оправдано.",
      "Folglich muss der Plan angepasst werden. — Следовательно, план нужно изменить.",
      "Einerseits spart die Lösung Zeit, andererseits entstehen neue Kosten. — С одной стороны решение экономит время, с другой возникают расходы.",
    ],
    dialogue:
      "Die Maßnahme kostet Geld. Dennoch könnte sie langfristig Energie sparen. — Folglich sollten wir zunächst einen Test durchführen.",
    listeningQuestion: "Что предлагают сделать сначала?",
    listeningOptions: ["Провести тест", "Отказаться от идеи", "Увеличить бюджет"],
    listeningAnswer: 0,
    reading:
      "Die neue Regel senkt den Verbrauch. Allerdings entstehen zusätzliche Verwaltungskosten. Eine Pilotphase könnte die Auswirkungen genauer zeigen.",
    readingQuestion: "Что предлагают для оценки последствий?",
    readingOptions: ["Пилотный этап", "Полный отказ", "Немедленное расширение"],
    readingAnswer: 0,
    speakingPrompt: "Защитите предложение: тезис, два основания, уступка и ответ на контраргумент.",
    writingPrompt: "Напишите аргументированный форумный пост с ясным выводом.",
    writingExample: "Die Maßnahme ist sinnvoll, sofern… Zwar…, dennoch… Folglich…",
  }),
  unit("b2-02", "B2", {
    title: "Интервью, лекции и переданная речь",
    outcome: "Точно пересказать сложное выступление и различить мнение автора и источника.",
    moduleIds: [35, 36, 38, 39],
    vocabulary: [
      "laut — согласно",
      "die Aussage — утверждение",
      "der Befund — результат",
      "die Quelle — источник",
      "angeblich — якобы",
    ],
    grammarTitle: "Konjunktiv I и косвенная речь",
    theory:
      "Konjunktiv I помогает передать чужое утверждение и отделить его от своего мнения: Die Expertin erklärt, die Daten seien… . В неоднозначных формах используйте понятную замену с dass.",
    examples: [
      "Der Bericht zeige einen Rückgang. — В отчёте якобы показан спад.",
      "Die Expertin sagt, dass die Daten unvollständig sind. — Эксперт говорит, что данные неполные.",
      "Laut der Studie seien die Ergebnisse vorläufig. — Согласно исследованию, результаты предварительные.",
    ],
    dialogue:
      "Was sagt die Expertin? — Die Daten seien noch nicht vollständig. Sie empfehle eine weitere Untersuchung.",
    listeningQuestion: "Какие данные описаны как неполные?",
    listeningOptions: ["Данные исследования", "Данные погоды", "Данные о билетах"],
    listeningAnswer: 0,
    reading:
      "Laut dem Bericht seien die Ergebnisse vorläufig. Die Forschenden betonen, weitere Daten würden benötigt.",
    readingQuestion: "Какого вывода пока нельзя сделать?",
    readingOptions: [
      "Окончательного вывода",
      "Вывода о времени встречи",
      "Вывода о стоимости билета",
    ],
    readingAnswer: 0,
    speakingPrompt:
      "Нейтрально перескажите позицию эксперта и отдельно обозначьте, что является вашим выводом.",
    writingPrompt:
      "Составьте резюме выступления на 100–140 слов, указывая источник каждой позиции.",
    writingExample:
      "Die Expertin weist darauf hin, dass… Laut dem Bericht… Daraus lässt sich noch nicht schließen, dass…",
  }),
  unit("b2-03", "B2", {
    title: "Профессиональные письма и отчёты",
    outcome: "Составить деловое письмо с решением, сроком и ответственным.",
    moduleIds: [28, 29, 36, 39],
    vocabulary: [
      "die Umsetzung — реализация",
      "zur Verfügung stellen — предоставить",
      "eine Entscheidung treffen — принять решение",
      "der Aufwand — трудозатраты",
      "fristgerecht — в срок",
    ],
    grammarTitle: "Номинальный стиль и Funktionsverbgefüge",
    theory:
      "Официальная речь часто использует существительные и устойчивые глагольно-именные сочетания. Сохраняйте ясность: тяжёлое существительное можно заменить простым глаголом.",
    examples: [
      "Wir treffen eine Entscheidung. — Мы принимаем решение.",
      "Die Daten stehen zur Verfügung. — Данные доступны.",
      "Nach der Prüfung erfolgt die Umsetzung. — После проверки состоится внедрение.",
    ],
    dialogue:
      "Wer stellt die Daten zur Verfügung? — Das Analytics-Team. Wann treffen wir eine Entscheidung? — Bis Freitag.",
    listeningQuestion: "К какому сроку примут решение?",
    listeningOptions: ["К пятнице", "К понедельнику", "К концу месяца"],
    listeningAnswer: 0,
    reading:
      "Bitte stellen Sie die aktualisierten Zahlen bis Freitag zur Verfügung. Die Entscheidung wird nach der Prüfung getroffen.",
    readingQuestion: "Что нужно сделать к пятнице?",
    readingOptions: [
      "Предоставить обновлённые цифры",
      "Принять решение без проверки",
      "Отменить совещание",
    ],
    readingAnswer: 0,
    speakingPrompt: "Проведите рабочий follow-up: решение, ответственный, срок и риск.",
    writingPrompt: "Напишите письмо после совещания с четырьмя действиями.",
    writingExample:
      "Wie besprochen, stellt das Team… bis Freitag zur Verfügung. Die Entscheidung treffen wir nach…",
  }),
  unit("b2-04", "B2", {
    title: "Разговорные оттенки и модальные частицы",
    outcome: "Понимать намерение говорящего и формулировать уместные реакции.",
    moduleIds: [10, 11, 27, 28],
    vocabulary: [
      "doch — же/всё-таки",
      "eben — именно/просто",
      "mal — смягчение просьбы",
      "eigentlich — вообще-то",
      "der Ton — тон",
    ],
    grammarTitle: "Модальные частицы в контексте",
    theory:
      "Частицы выражают отношение, ожидание и тон; значение зависит от ситуации и интонации. Учите их в целых репликах, а не через один перевод.",
    examples: [
      "Komm doch mal vorbei. — Загляни как-нибудь.",
      "Das ist eben nicht so einfach. — Это просто не так легко.",
      "Hast du eigentlich schon geantwortet? — Ты, кстати, уже ответил?",
    ],
    dialogue:
      "Kannst du mal nachsehen? — Das habe ich doch schon gemacht. — Ach so, dann ist ja alles klar.",
    listeningQuestion: "Что уже сделал второй говорящий?",
    listeningOptions: ["Проверил", "Позвонил", "Отправил письмо"],
    listeningAnswer: 0,
    reading: "„Komm doch mal vorbei“ klingt als Einladung weniger direkt als „Komm vorbei“.",
    readingQuestion: "Как звучит первая фраза?",
    readingOptions: ["Менее прямо, как приглашение", "Как строгий приказ", "Как отказ"],
    readingAnswer: 0,
    speakingPrompt: "Скажите просьбу прямо, мягко и удивлённо; затем объясните разницу в тоне.",
    writingPrompt: "Перепишите три прямые реплики в разговорной, но вежливой форме.",
    writingExample: "Kannst du mal…? Vielleicht könntest du…? Hast du eigentlich…?",
  }),
  unit("b2-05", "B2", {
    title: "Научно-популярная тема и данные",
    outcome: "Сопоставить текст и график и осторожно представить вывод.",
    moduleIds: [33, 34, 38, 39],
    vocabulary: [
      "die Entwicklung — развитие",
      "die Erhebung — исследование",
      "der Anteil — доля",
      "vorläufig — предварительный",
      "darauf hindeuten — указывать на",
    ],
    grammarTitle: "Пассив, причастные определения и степень уверенности",
    theory:
      "Пассив фокусируется на процессе/результате. Причастное определение сжимает текст. Ограничивайте вывод уровнем доказательств: deutet darauf hin, beweist aber nicht.",
    examples: [
      "Die Daten wurden im Mai erhoben. — Данные собрали в мае.",
      "Die veröffentlichten Zahlen zeigen… — Опубликованные цифры показывают…",
      "Das Ergebnis deutet darauf hin, beweist aber nicht… — Результат указывает на…, но не доказывает…",
    ],
    dialogue:
      "Die Daten wurden im Mai erhoben. — Können wir daraus einen Trend ableiten? — Es deutet darauf hin, aber die Stichprobe ist klein.",
    listeningQuestion: "Почему вывод ограничен?",
    listeningOptions: ["Выборка мала", "Данных слишком много", "Исследование старое"],
    listeningAnswer: 0,
    reading:
      "Die Untersuchung wurde mit 120 Personen durchgeführt. Die Ergebnisse deuten auf eine Veränderung hin, sind jedoch nicht repräsentativ.",
    readingQuestion: "Почему результат нерепрезентативен?",
    readingOptions: [
      "Исследование охватывает ограниченную группу",
      "Данные были удалены",
      "Не указана тема",
    ],
    readingAnswer: 0,
    speakingPrompt: "Представьте данные и обязательно укажите одно ограничение исследования.",
    writingPrompt: "Напишите абзац анализа, отделив наблюдение, интерпретацию и ограничение.",
    writingExample:
      "Die Grafik zeigt… Dies könnte darauf hindeuten, dass… Wegen der kleinen Stichprobe lässt sich jedoch nicht…",
  }),
  unit("b2-06", "B2", {
    title: "Дебаты и поиск решения",
    outcome: "Отреагировать на возражение и сформулировать компромисс.",
    moduleIds: [27, 28, 30, 39],
    vocabulary: [
      "der Einwand — возражение",
      "zugestehen — признать",
      "der Kompromiss — компромисс",
      "unter der Voraussetzung — при условии",
      "abwägen — взвешивать",
    ],
    grammarTitle: "Уступка, гипотеза и переформулирование",
    theory:
      "Сильная дискуссия учитывает позицию собеседника: Zwar…, allerdings…; Unter der Voraussetzung, dass…; Ich verstehe den Einwand, dennoch… .",
    examples: [
      "Ich verstehe den Einwand, dennoch… — Я понимаю возражение, тем не менее…",
      "Unter der Voraussetzung, dass… — При условии, что…",
      "Zwar ist die Lösung teuer, allerdings… — Решение дорогое, однако…",
    ],
    dialogue:
      "Die Umstellung kostet viel. — Das stimmt. Unter der Voraussetzung, dass wir schrittweise vorgehen, sinkt das Risiko.",
    listeningQuestion: "Какой компромисс предлагают?",
    listeningOptions: ["Внедрять поэтапно", "Отменить проект", "Увеличить команду"],
    listeningAnswer: 0,
    reading:
      "Der Vorschlag wurde angenommen, sofern die Kosten nach drei Monaten überprüft werden.",
    readingQuestion: "При каком условии приняли предложение?",
    readingOptions: [
      "Стоимость пересмотрят через три месяца",
      "Команда переедет",
      "Проект завершат завтра",
    ],
    readingAnswer: 0,
    speakingPrompt:
      "Обсудите смену рабочего графика: изложите возражение партнёра, признайте его и предложите компромисс.",
    writingPrompt: "Напишите нейтральный итог дискуссии и назовите согласованные условия.",
    writingExample: "Beide Seiten erkennen an, dass… Ein Kompromiss besteht darin, dass…",
  }),
  unit("b2-07", "B2", {
    title: "Итог B2 · текст, аудио и выступление",
    outcome: "Понять сложный материал и ясно защитить позицию в устной и письменной форме.",
    moduleIds: [28, 30, 38, 39],
    vocabulary: [
      "die Zusammenfassung — резюме",
      "der Standpunkt — позиция",
      "die Gegenposition — альтернативная позиция",
      "die Schlussfolgerung — вывод",
      "präzisieren — уточнять",
    ],
    grammarTitle: "Редактирование сложной речи",
    theory:
      "Проверьте точность тезиса, связность аргументов, регистр и длину предложений. Сложность конструкции не является целью сама по себе.",
    examples: [
      "Zusammenfassend lässt sich sagen… — Подводя итог, можно сказать…",
      "Im Gegensatz dazu… — В отличие от этого…",
      "Dieser Schluss gilt nur, sofern… — Этот вывод справедлив только если…",
    ],
    dialogue:
      "Würden Sie die Regel empfehlen? — Ja, sofern Ausnahmen klar geregelt sind. — Was wäre ein Nachteil? — Die Umsetzung könnte teuer sein.",
    listeningQuestion: "Какое условие названо?",
    listeningOptions: [
      "Исключения должны быть ясно определены",
      "Правило должно быть временным",
      "Нужен новый руководитель",
    ],
    listeningAnswer: 0,
    reading:
      "Die Maßnahme verbessert den Zugang. Ihre Wirksamkeit hängt jedoch davon ab, wie die Ausnahmen umgesetzt werden.",
    readingQuestion: "От чего зависит эффективность?",
    readingOptions: ["От применения исключений", "От размера здания", "От времени публикации"],
    readingAnswer: 0,
    speakingPrompt:
      "Выступите три минуты, назовите ограничение своей позиции и ответьте на возражение.",
    writingPrompt: "Напишите формальное мнение и короткое деловое письмо по одной теме.",
    writingExample: "Zusammenfassend lässt sich sagen, dass… Entscheidend ist jedoch…",
  }),

  unit("c1-01", "C1", {
    title: "Академическое выступление и источники",
    outcome: "Синтезировать несколько источников и представить вывод с оговорками.",
    moduleIds: [30, 38, 39],
    vocabulary: [
      "die Fragestellung — исследовательский вопрос",
      "der Befund — результат",
      "die Einschränkung — ограничение",
      "die Quelle — источник",
      "nachvollziehbar — обоснованный",
    ],
    grammarTitle: "Тезис, доказательство и оговорка",
    theory:
      "В академическом выступлении явно отделяйте вопрос, метод, результат и ограничение. Точная оговорка делает вывод надёжнее, а не слабее.",
    examples: [
      "Die Ergebnisse legen nahe, dass… — Результаты позволяют предположить, что…",
      "Die Aussage ist insofern plausibel, als… — Утверждение правдоподобно в той мере, в какой…",
      "Die Studie lässt offen, ob… — Исследование не отвечает на вопрос, … ли.",
    ],
    dialogue:
      "Was ist der zentrale Befund? — Die Ergebnisse legen nahe, dass… Allerdings war die Stichprobe begrenzt.",
    listeningQuestion: "Какое ограничение названо?",
    listeningOptions: ["Ограниченная выборка", "Отсутствие вопроса", "Слишком длинный текст"],
    listeningAnswer: 0,
    reading:
      "Die Studie legt nahe, dass der Ansatz wirksam ist. Wegen der begrenzten Stichprobe lässt sich die Aussage nicht verallgemeinern.",
    readingQuestion: "Почему вывод нельзя обобщить?",
    readingOptions: ["Выборка ограничена", "Метод неизвестен", "Нет результатов"],
    readingAnswer: 0,
    speakingPrompt: "Представьте вопрос, метод, результат и ограничение за 3–5 минут.",
    writingPrompt: "Сопоставьте два источника и сформулируйте собственный ограниченный вывод.",
    writingExample:
      "Beide Quellen stimmen darin überein, dass… Während Quelle A… bleibt bei Quelle B offen, ob…",
  }),
  unit("c1-02", "C1", {
    title: "Подтекст и позиция автора",
    outcome: "Распознать оценку и подразумеваемую позицию сложного текста.",
    moduleIds: [10, 11, 30, 34],
    vocabulary: [
      "die Anspielung — намёк",
      "die Wertung — оценка",
      "der Unterton — подтекст",
      "ironisch — ироничный",
      "naheliegend — очевидный",
    ],
    grammarTitle: "Регистр, оценочные слова и риторика",
    theory:
      "Оценка может быть выражена не только прямым мнением, но и выбором слов, контрастом, иронией и тем, что автор опускает.",
    examples: [
      "Der Autor deutet an, dass… — Автор намекает, что…",
      "Die Formulierung wirkt ironisch. — Формулировка звучит иронично.",
      "Zwischen den Zeilen wird deutlich… — Между строк становится ясно…",
    ],
    dialogue:
      "Der Kommentar lobt den Plan nicht direkt. — Nein, die Wendung „endlich ein mutiger Schritt“ klingt eher ironisch.",
    listeningQuestion: "Какой тон у фразы?",
    listeningOptions: ["Ироничный", "Нейтральный отчётный", "Торжественный"],
    listeningAnswer: 0,
    reading:
      "„Endlich hat die Behörde eine mutige Entscheidung getroffen“ steht in einem Text, der anschließend alle Folgen kritisiert.",
    readingQuestion: "Как следует понять вступительную фразу?",
    readingOptions: ["Вероятно, иронично", "Как однозначную похвалу", "Как цитату из закона"],
    readingAnswer: 0,
    speakingPrompt: "Объясните подразумеваемую позицию автора и назовите два языковых признака.",
    writingPrompt: "Перепишите фрагмент сначала нейтрально, затем как аргументированную колонку.",
    writingExample:
      "Die Formulierung legt nahe, dass… Besonders der Kontrast zwischen… und… wirkt…",
  }),
  unit("c1-03", "C1", {
    title: "Совещание и переговоры",
    outcome: "Вести сложное обсуждение и точно зафиксировать договорённости.",
    moduleIds: [27, 28, 29, 39],
    vocabulary: [
      "der Handlungsspielraum — пространство для действий",
      "die Priorität — приоритет",
      "der Vorbehalt — оговорка",
      "abstimmen — согласовать",
      "festhalten — зафиксировать",
    ],
    grammarTitle: "Уточнение, оговорка и нейтральная медиация",
    theory:
      "Для переговоров используйте формулировки, которые признают позицию собеседника, уточняют условия и фиксируют достигнутое без искажения.",
    examples: [
      "Wenn ich Sie richtig verstehe… — Если я правильно понял(а)…",
      "Unter dem Vorbehalt, dass… — При условии/оговорке, что…",
      "Lassen Sie uns festhalten, dass… — Давайте зафиксируем, что…",
    ],
    dialogue:
      "Wir können den Termin verschieben, sofern die Unterlagen bis Mittwoch vorliegen. — Dann halten wir Mittwoch als Frist fest.",
    listeningQuestion: "Какой срок согласовали?",
    listeningOptions: ["Среда", "Пятница", "Следующая неделя"],
    listeningAnswer: 0,
    reading:
      "Beschluss: Der Termin wird verschoben. Die Unterlagen müssen bis Mittwoch vorliegen; andernfalls wird neu abgestimmt.",
    readingQuestion: "Что произойдёт, если документы не будут готовы?",
    readingOptions: ["Проведут новое согласование", "Срок автоматически продлят", "Проект закроют"],
    readingAnswer: 0,
    speakingPrompt:
      "Проведите переговоры с новым условием посреди разговора и в конце подведите итог.",
    writingPrompt: "Составьте протокол: решение, ответственные, срок и открытый вопрос.",
    writingExample: "Festgehalten wurde, dass… Verantwortlich ist… Bis zum… bleibt offen, ob…",
  }),
  unit("c1-04", "C1", {
    title: "Эссе и аналитическое письмо",
    outcome: "Создать аргументированный текст с подходящим стилем и точной лексикой.",
    moduleIds: [30, 38, 39],
    vocabulary: [
      "die Gegenposition — контраргумент",
      "die Abwägung — взвешивание",
      "die Schlussfolgerung — вывод",
      "in Betracht ziehen — рассматривать",
      "einschränken — ограничивать",
    ],
    grammarTitle: "Структура аргумента и стиль",
    theory:
      "Сильный текст последовательно связывает тезис, основание, контраргумент, ответ и вывод. Избегайте чрезмерных номинализаций и подбирайте тон к адресату.",
    examples: [
      "Dem steht entgegen, dass… — Этому противоречит то, что…",
      "Unter diesen Voraussetzungen… — При этих условиях…",
      "Daraus folgt jedoch nicht zwingend, dass… — Однако из этого не обязательно следует, что…",
    ],
    dialogue:
      "Ist die Reform sinnvoll? — Grundsätzlich ja, allerdings nur unter der Voraussetzung, dass…",
    listeningQuestion: "Какое условие ограничивает согласие?",
    listeningOptions: [
      "Реформа полезна только при определённых условиях",
      "Реформа уже завершена",
      "Реформа не обсуждается",
    ],
    listeningAnswer: 0,
    reading:
      "Die Reform könnte den Zugang erleichtern. Daraus folgt jedoch nicht zwingend, dass alle Gruppen gleichermaßen profitieren.",
    readingQuestion: "Какое ограничение вывода указано?",
    readingOptions: [
      "Выгода может распределяться неравномерно",
      "Доступ не меняется",
      "Все группы уже согласны",
    ],
    readingAnswer: 0,
    speakingPrompt: "Устно изложите тезис, контраргумент, ответ на него и вывод.",
    writingPrompt:
      "Напишите аналитический текст для заданного адресата; обозначьте собственную степень уверенности.",
    writingExample:
      "Für die Reform spricht… Dem steht entgegen… Unter der Voraussetzung, dass… lässt sich folgern…",
  }),
  unit("c1-05", "C1", {
    title: "Медиация и межкультурное общение",
    outcome: "Передать сложную информацию третьему лицу нейтрально и понятно.",
    moduleIds: [9, 27, 30, 39],
    vocabulary: [
      "vermitteln — передавать/посредничать",
      "die Perspektive — точка зрения",
      "die Voraussetzung — предпосылка",
      "missverständlich — двусмысленный",
      "zusammenführen — сводить вместе",
    ],
    grammarTitle: "Перефразирование и сохранение смысла",
    theory:
      "Медиация требует сохранить существенные факты, объяснить специальные выражения и учитывать знания адресата. Не добавляйте собственную оценку в пересказ.",
    examples: [
      "Anders ausgedrückt… — Иными словами…",
      "Für die Beteiligten bedeutet das… — Для участников это означает…",
      "Die beiden Positionen lassen sich so zusammenfassen… — Две позиции можно обобщить так…",
    ],
    dialogue:
      "Was bedeutet die neue Regel für die Eltern? — Kurz gesagt: Sie müssen den Antrag früher einreichen.",
    listeningQuestion: "Что должны сделать родители?",
    listeningOptions: ["Подать заявление раньше", "Оплатить новый сбор", "Записаться на встречу"],
    listeningAnswer: 0,
    reading:
      "Anträge müssen künftig drei Wochen vor Beginn eingereicht werden. Bisher galt eine Frist von einer Woche.",
    readingQuestion: "Что изменилось?",
    readingOptions: [
      "Теперь подать нужно за три недели",
      "Срок отменили",
      "Заявление больше не требуется",
    ],
    readingAnswer: 0,
    speakingPrompt: "Объясните новое правило человеку, который не читал исходный документ.",
    writingPrompt: "Напишите понятное нейтральное резюме сложного правила для широкой аудитории.",
    writingExample: "Bisher… Ab jetzt… Für Sie bedeutet das konkret, dass…",
  }),
  unit("c1-06", "C1", {
    title: "Итоговый проект и портфолио C1",
    outcome:
      "Самостоятельно исследовать тему, представить позицию и отредактировать собственный текст.",
    moduleIds: [30, 35, 38, 39],
    vocabulary: [
      "die Fragestellung — вопрос исследования",
      "die Auswertung — анализ",
      "die Perspektive — перспектива",
      "die Überarbeitung — редактура",
      "nachvollziehbar — понятный/обоснованный",
    ],
    grammarTitle: "Точность и осознанная редактура",
    theory:
      "На уровне C1 редактируйте не только окончания: проверяйте логику, адресата, ясность, связки, коллокации и степень уверенности.",
    examples: [
      "Die Quellenlage ist uneinheitlich. — Источники противоречивы.",
      "Der Befund lässt sich unterschiedlich deuten. — Результат можно трактовать по-разному.",
      "Abschließend ist festzuhalten, dass… — В заключение следует отметить, что…",
    ],
    dialogue:
      "Welche Schlussfolgerung ist am besten belegt? — Die vorsichtige, weil sie die Einschränkungen der Studie berücksichtigt.",
    listeningQuestion: "Почему выбирают осторожный вывод?",
    listeningOptions: [
      "Он учитывает ограничения исследования",
      "Он короче",
      "Он совпадает с заголовком",
    ],
    listeningAnswer: 0,
    reading:
      "Die verfügbaren Quellen stützen den Zusammenhang, erlauben jedoch keine eindeutige Aussage über die Ursache.",
    readingQuestion: "Что источники не позволяют установить?",
    readingOptions: ["Однозначную причину", "Наличие связи", "Тему исследования"],
    readingAnswer: 0,
    speakingPrompt: "Представьте проект за пять минут, ответьте на вопросы и назовите ограничение.",
    writingPrompt:
      "Добавьте итоговый текст, резюме источников и список исправленных языковых привычек в портфолио.",
    writingExample:
      "Die Quellen sprechen dafür, dass… Eine Ursache lässt sich daraus jedoch nicht eindeutig ableiten. Für weitere Untersuchungen wäre…",
  }),
];

export const courseUnitsForLevel = (level: string) =>
  GERMAN_COURSE.filter((item) => item.level === (level === "A1–A2" ? "A1" : level));
export const getNextCourseUnit = (
  level: string,
  progress: Record<string, { completedAt?: string }>,
) => {
  const units = courseUnitsForLevel(level);
  return units.find((item) => !progress[item.id]?.completedAt) ?? units[units.length - 1];
};
