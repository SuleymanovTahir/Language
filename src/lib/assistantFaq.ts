export type PreparedAnswer = { title: string; prompt: string; answer: string; terms: string[] };

export const preparedAnswers: PreparedAnswer[] = [
  {
    title: "Артикли der, die, das",
    prompt: "Как понять, когда использовать der, die и das?",
    terms: ["der die das", "артикл", "род существительных", "мужской род", "женский род", "средний род"],
    answer:
      "В немецком у каждого существительного есть грамматический род: der — мужской, die — женский, das — средний. Его лучше учить сразу со словом: der Tisch, die Lampe, das Buch. Окончания помогают угадать род, но у них много исключений. Во множественном числе используется die: die Bücher.",
  },
  {
    title: "Падежи: Nominativ, Akkusativ, Dativ",
    prompt: "Чем отличаются Nominativ, Akkusativ и Dativ?",
    terms: ["падеж", "nominativ", "akkusativ", "dativ", "винительный", "дательный"],
    answer:
      "Nominativ — кто выполняет действие: Der Mann liest. Akkusativ — кого или что затрагивает действие: Ich sehe den Mann. Dativ часто отвечает на вопрос кому/чему: Ich helfe dem Mann. Меняется прежде всего артикль: мужской der → den → dem; женский die → die → der; средний das → das → dem.",
  },
  {
    title: "Порядок слов и позиция глагола",
    prompt: "Почему в немецком глагол стоит на втором месте?",
    terms: ["порядок слов", "втором месте", "v2", "глагол на втором", "первом месте", "инверсия"],
    answer:
      "В обычном немецком утверждении спрягаемый глагол занимает вторую позицию, а не обязательно второе слово: Heute lerne ich Deutsch. Если первым стоит подлежащее: Ich lerne heute Deutsch. В вопросе без вопросительного слова глагол обычно на первом месте: Lernst du Deutsch?",
  },
  {
    title: "Глагол sein",
    prompt: "Как спрягается глагол sein?",
    terms: ["sein", "быть", "bin bist ist", "seid", "sind"],
    answer:
      "Sein — неправильный глагол «быть»: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind. Примеры: Ich bin müde. Du bist hier. Wir sind Freunde. Формы нужно запомнить.",
  },
  {
    title: "Глаголы в Präsens",
    prompt: "Как образовать настоящее время Präsens?",
    terms: ["präsens", "настоящее время", "спряжение глаголов", "окончания глаголов"],
    answer:
      "У большинства глаголов убираем -en и добавляем окончание: ich lern-e, du lern-st, er lern-t, wir lern-en, ihr lern-t, sie lern-en. В форме du и er/sie/es иногда меняется корневая гласная: fahren → du fährst, er fährt.",
  },
  {
    title: "Вопросы",
    prompt: "Как строить вопросы в немецком?",
    terms: ["вопрос", "вопросительные слова", "wie heißt", "woher", "ja nein frage"],
    answer:
      "В вопросе с вопросительным словом оно стоит первым, затем спрягаемый глагол: Wo wohnst du? Wie heißt du? В вопросе, на который отвечают ja или nein, глагол стоит первым: Lernst du Deutsch? — Ja, ich lerne Deutsch.",
  },
  {
    title: "Неопределённые артикли ein/eine",
    prompt: "Когда использовать ein и eine?",
    terms: ["ein eine", "неопределенный артикль", "неопределённый артикль", "какой-то", "какая-то"],
    answer:
      "Ein/eine — примерно «один» или «какой-то», когда предмет ещё не назван или не уточнён. Мужской и средний род в Nominativ: ein Mann, ein Kind; женский: eine Frau. В Akkusativ меняется мужской: einen Mann, но ein Kind и eine Frau остаются без изменений.",
  },
  {
    title: "Отрицание nicht и kein",
    prompt: "В чём разница между nicht и kein?",
    terms: ["nicht", "kein", "отрицание", "не", "нет артикля"],
    answer:
      "Kein отрицает существительное с ein или без артикля: Ich habe kein Auto. Nicht отрицает глагол, прилагательное или конкретную часть фразы: Ich komme heute nicht. Das ist nicht teuer. Перед существительным с определённым артиклем обычно нужен nicht: Das ist nicht der Bus.",
  },
  {
    title: "Отделяемые приставки",
    prompt: "Как работают отделяемые глаголы?",
    terms: ["отделяемый", "отделяемые глаголы", "приставка", "aufstehen", "anrufen", "einkaufen"],
    answer:
      "В главном предложении приставка отделяется и уходит в конец: Ich stehe um sieben Uhr auf. В придаточном предложении глагол стоит вместе и в конце: …weil ich um sieben Uhr aufstehe. В инфинитиве и Perfekt приставка тоже остаётся с глаголом: aufstehen, aufgestanden.",
  },
  {
    title: "Модальные глаголы",
    prompt: "Как строить предложения с модальными глаголами?",
    terms: ["модальный глагол", "können", "müssen", "wollen", "dürfen", "sollen", "mögen"],
    answer:
      "Модальный глагол спрягается и стоит на второй позиции, смысловой глагол идёт в инфинитиве в конец: Ich kann heute kommen. Du musst viel lernen. Вопрос: Kannst du mir helfen? В придаточном оба глагола уходят в конец: …weil ich heute arbeiten muss.",
  },
  {
    title: "Perfekt и Partizip II",
    prompt: "Как образовать прошедшее время Perfekt?",
    terms: ["perfekt", "partizip ii", "прошедшее время", "ge gemacht", "haben oder sein"],
    answer:
      "Perfekt строится из haben или sein на втором месте и Partizip II в конце: Ich habe gelernt. Wir sind nach Hause gefahren. Большинство глаголов используют haben. Sein часто нужен для движения с изменением места и для werden/bleiben. У правильных глаголов обычно ge-…-t: gemacht; у многих неправильных — ge-…-en: geschrieben. Глаголы на -ieren обычно без ge-: studiert.",
  },
  {
    title: "haben или sein в Perfekt",
    prompt: "Как выбрать haben или sein в Perfekt?",
    terms: ["haben oder sein", "haben или sein", "вспомогательный глагол", "perfekt sein", "perfekt haben"],
    answer:
      "Haben используют большинство глаголов: Ich habe gegessen, gelernt, gesehen. Sein обычно употребляют с перемещением из одного места в другое и изменением состояния: Ich bin nach Berlin gefahren. Das Kind ist eingeschlafen. Также sein идут с sein, werden и bleiben: Sie ist zu Hause geblieben.",
  },
  {
    title: "Придаточные с weil и dass",
    prompt: "Почему после weil и dass глагол уходит в конец?",
    terms: ["weil", "dass", "придаточное предложение", "глагол в конец", "союз"],
    answer:
      "Weil («потому что») и dass («что») вводят придаточное предложение. В нём спрягаемый глагол ставится в конец: Ich lerne Deutsch, weil ich in Berlin arbeiten möchte. Sie sagt, dass sie morgen kommt. Если придаточная часть стоит первой, после запятой в главной части глагол занимает первую позицию: Weil ich Zeit habe, besuche ich dich.",
  },
  {
    title: "Предлоги и падежи",
    prompt: "Как запомнить падеж после немецких предлогов?",
    terms: ["предлог", "предлоги", "mit", "für", "nach", "bei", "wegen", "падеж после"],
    answer:
      "Учите предлог вместе с падежом. Например, mit, nach, bei, von, zu требуют Dativ: mit dem Bus. Für, ohne, gegen, durch требуют Akkusativ: für den Bruder. Предлоги an, auf, in и другие Wechselpräpositionen используют Dativ для места (Wo? — Ich bin in der Schule) и Akkusativ для направления (Wohin? — Ich gehe in die Schule).",
  },
  {
    title: "Dativ или Akkusativ после in/auf",
    prompt: "Когда после in нужен Dativ, а когда Akkusativ?",
    terms: ["wechselpräposition", "двойное управление", "куда", "где", "wohin", "wo", "in der", "in die"],
    answer:
      "С предлогами места вроде in и auf задайте вопрос: Wo? — положение без смены места, значит Dativ: Das Buch liegt auf dem Tisch. Wohin? — движение к новому месту, значит Akkusativ: Ich lege das Buch auf den Tisch. Важно само направление, а не просто наличие глагола движения.",
  },
  {
    title: "Личные местоимения в падежах",
    prompt: "Как меняются личные местоимения в Akkusativ и Dativ?",
    terms: ["личное местоимение", "mich mir", "dich dir", "ihn ihm", "akkusativ местоимения", "dativ местоимения"],
    answer:
      "В Akkusativ: ich → mich, du → dich, er → ihn, sie → sie, es → es, wir → uns, ihr → euch, sie/Sie → sie/Sie. В Dativ: ich → mir, du → dir, er → ihm, sie → ihr, es → ihm, wir → uns, ihr → euch, sie/Sie → ihnen/Ihnen. Пример: Er sieht mich. Er hilft mir.",
  },
  {
    title: "Прилагательные перед существительным",
    prompt: "Почему меняется окончание прилагательного?",
    terms: ["окончание прилагательного", "склонение прилагательных", "adjektivdeklination", "деклинация"],
    answer:
      "Окончание прилагательного показывает род, падеж и число. Если перед ним есть der/die/das, артикль уже сообщает часть информации: der kleine Hund, mit dem kleinen Hund. После ein прилагательное иногда берёт на себя заметное окончание: ein kleiner Hund, eine kleine Katze, ein kleines Kind. Полезно учить готовые сочетания и таблицу по падежам.",
  },
  {
    title: "Präteritum: war и hatte",
    prompt: "Когда употреблять Präteritum?",
    terms: ["präteritum", "war", "hatte", "простое прошедшее", "präteritum perfekt"],
    answer:
      "В разговоре чаще используют Perfekt, но sein и haben часто звучат в Präteritum: ich war — я был, ich hatte — у меня было. Модальные глаголы тоже часто ставят в Präteritum: Ich musste arbeiten. В книгах и новостях Präteritum широко используется и с другими глаголами.",
  },
  {
    title: "Konjunktiv II и вежливая просьба",
    prompt: "Как вежливо попросить что-то по-немецки?",
    terms: ["konjunktiv ii", "вежливая просьба", "möchte", "könnte", "würde", "hätte"],
    answer:
      "Для вежливой просьбы используют Konjunktiv II: Ich hätte gern einen Tee. Könnten Sie mir helfen? Würdest du bitte das Fenster öffnen? Форма möchte означает «хотел(а) бы» и обычно сочетается с инфинитивом или существительным: Ich möchte zahlen.",
  },
  {
    title: "Будущее с werden",
    prompt: "Как образовать Futur I с werden?",
    terms: ["futur", "будущее время", "werden", "буду"],
    answer:
      "Futur I: спрягаем werden на втором месте, а смысловой глагол ставим в инфинитиве в конец: Ich werde morgen lernen. В немецком для планов часто достаточно Präsens и слова времени: Morgen lerne ich Deutsch.",
  },
  {
    title: "Пассив",
    prompt: "Как образуется пассив в немецком?",
    terms: ["пассив", "passiv", "werden gemacht", "werden gebaut"],
    answer:
      "Пассив действия строится так: werden в нужной форме + Partizip II в конце. Der Brief wird geschrieben — Письмо пишут. В прошедшем Perfekt: Der Brief ist geschrieben worden. Исполнитель, если он важен, вводится через von + Dativ: Der Brief wird von Anna geschrieben.",
  },
  {
    title: "Спряжение глагола в придаточном",
    prompt: "Где стоят два глагола в придаточном предложении?",
    terms: ["два глагола", "придаточном", "инфинитив в конце", "weil ich kann", "модальный конец"],
    answer:
      "В придаточном с weil/dass спрягаемая форма уходит в конец, а инфинитив или Partizip II стоит перед ней: …weil ich Deutsch lernen möchte; …dass sie gestern angekommen ist. Порядок внутри глагольной группы зависит от конструкции.",
  },
  {
    title: "Plural существительных",
    prompt: "Как образовать множественное число существительных?",
    terms: ["plural", "множественное число", "множественное", "окончания существительных"],
    answer:
      "В немецком нет одного окончания для множественного числа: часто встречаются -e, -er, -(e)n, -s или нулевое окончание, иногда меняется гласная: der Tag — die Tage, das Kind — die Kinder, die Frau — die Frauen, der Apfel — die Äpfel. Учите множественное число вместе с существительным; во множественном числе Nominativ артикль обычно die.",
  },
];

export function findPreparedAnswer(question: string): PreparedAnswer | null {
  const normalized = question.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  let best: { answer: PreparedAnswer; score: number } | null = null;
  for (const answer of preparedAnswers) {
    const score = answer.terms.reduce((sum, term) => sum + (normalized.includes(term) ? Math.max(1, term.length / 8) : 0), 0);
    if (score > (best?.score ?? 0)) best = { answer, score };
  }
  return best && best.score >= 1.5 ? best.answer : null;
}
