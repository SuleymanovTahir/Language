import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { VocabCard, VocabModule } from "../lib/vocab";
import { loadMediaFile, removeMediaFile, saveMediaFile } from "../lib/mediaStore";
import { playFeedbackSound, playPairIntroTone, playWheelSpinSound } from "../lib/feedbackSound";
import { Icon } from "./Icon";
import { PandaNote } from "./PandaNote";
import { speakText, speechLocaleForCode } from "./StudySession";
import { AudioQuizBuilder, AudioQuizSession, type AudioQuiz } from "./AudioQuiz";
import { getActiveProfileId, readProfileItem, writeProfileItem } from "../lib/profileStorage";
import { readSpeechSettings } from "../lib/speech";
import { ScenarioGame, type ScenarioGameId } from "./ScenarioGames";

import {
  GAME_LIST,
  GRAMMAR_TOPICS,
  germanOnlyGames,
  languageForms,
  prepareGameModule,
  validateGame,
  type GameId,
  type GrammarTopic,
} from "../lib/gameCatalog";
export { GAME_LIST, GRAMMAR_TOPICS, prepareGameModule, validateGame } from "../lib/gameCatalog";
export type { GameId, GrammarTopic, GrammarTopicId } from "../lib/gameCatalog";

type SavedActivity = {
  id: string;
  title: string;
  gameId: GameId;
  moduleId: number;
  languageCode: string;
  level: string;
  cardIds: string[];
  cards?: VocabCard[];
  instructions?: string;
  media?: NonNullable<VocabModule["practiceMedia"]>;
  lastPlayedAt?: number;
};
type GrammarDraftQuestion = {
  prompt: string;
  optionsText: string;
  answer: string;
  explanation: string;
};
type GrammarDraft = {
  id: string;
  title: string;
  description: string;
  explanation: string;
  examplesText: string;
  group: "basics" | "sentences";
  questions: GrammarDraftQuestion[];
};

function SavedImagePreview({ image, alt }: { image: VocabCard["image"]; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let alive = true;
    setSrc("");
    if (image?.id)
      void loadMediaFile(image.id)
        .then((blob) => {
          if (!alive || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        })
        .catch(() => undefined);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image?.id]);
  return src ? (
    <img className="saved-card-image-preview" src={src} alt={alt} />
  ) : (
    <span className="saved-card-image-missing">{image?.name ?? "Нет изображения"}</span>
  );
}

function GameArtwork({ gameId, module }: { gameId: GameId; module: VocabModule }) {
  const sampled = useMemo(
    () => module.cards.filter((item) => item.word.trim() && item.translation.trim()).slice(0, 6),
    [module.cards],
  );
  const gameIndex = Math.max(
    0,
    GAME_LIST.findIndex((item) => item.id === gameId),
  );
  const card = sampled.length ? sampled[gameIndex % sampled.length] : undefined;
  const german = (item: VocabCard) => `${item.article ? `${item.article} ` : ""}${item.word}`;
  const uniqueCards = [
    ...new Map(
      module.cards
        .filter((item) => item.translation.trim())
        .map((item) => [item.translation.toLocaleLowerCase(), item]),
    ).values(),
  ];
  const alternatives = card
    ? [
        ...sampled.filter((item) => item.id !== card.id),
        ...uniqueCards.filter((item) => item.id !== card.id),
      ]
        .filter(
          (item, index, items) =>
            items.findIndex(
              (other) =>
                other.translation.toLocaleLowerCase() === item.translation.toLocaleLowerCase(),
            ) === index,
        )
        .slice(0, 5)
    : [];
  let art: ReactNode;

  if (gameId === "pairs") {
    const rows = sampled.slice(0, 3);
    const translations =
      rows.length >= 3
        ? [
            rows[1].translation,
            rows[0].translation,
            ...rows.slice(2).map((item) => item.translation),
          ]
        : rows.map((item) => item.translation);
    const connectedIndex = rows.length >= 3 ? 2 : 0;
    art = (
      <span className="gp-pairs">
        {rows.map((item, index) => (
          <span className="gp-pair-row" key={item.id}>
            <b>{german(item)}</b>
            <i className={index === connectedIndex ? "connected" : ""} aria-hidden="true" />
            <span>{translations[index]}</span>
          </span>
        ))}
      </span>
    );
  } else if (gameId === "articles") {
    const nouns = module.cards.filter((item) => item.article).slice(0, 6);
    art = (
      <span className="gp-articles">
        {(["der", "die", "das"] as const).map((article) => (
          <span className={`gp-article-col ${article}`} key={article}>
            <b>{article}</b>
            {nouns
              .filter((item) => item.article === article)
              .slice(0, 2)
              .map((item) => (
                <i key={item.id}>{item.word}</i>
              ))}
          </span>
        ))}
      </span>
    );
  } else if (gameId === "sentenceorder" || gameId === "fillblank") {
    const sentenceCard = module.cards.find((item) => item.exampleSentence?.trim());
    const sentence =
      gameId === "fillblank"
        ? (sentenceCard?.exampleSentence ?? "")
        : (sentenceCard?.exampleSentence?.replace(
            "___",
            sentenceCard.sentenceAnswer || german(sentenceCard),
          ) ?? "");
    const tokens = sentence.split(/\s+/).filter(Boolean);
    const shuffledTokens =
      tokens.length > 2 ? [tokens[1], tokens[0], ...tokens.slice(2).reverse()] : tokens;
    art = (
      <span className="gp-sentence">
        <b>
          {gameId === "fillblank" ? sentence.replace("___", "________") : "Соберите предложение"}
        </b>
        {gameId === "sentenceorder" ? (
          <>
            <span className="gp-tokens">
              {shuffledTokens.slice(0, 5).map((token, index) => (
                <i key={`${token}-${index}`}>{token.replace(/[.,!?]$/, "")}</i>
              ))}
            </span>
            <span className="gp-answer-line" />
          </>
        ) : (
          <span className="gp-quiz-options">
            {alternatives.slice(0, 3).map((item) => (
              <i key={item.id}>{item.word}</i>
            ))}
          </span>
        )}
      </span>
    );
  } else if (gameId === "builder") {
    art = (
      <span className="gp-builder">
        <b>{card?.translation ?? "Добавьте слова"}</b>
        <span className="gp-builder-slots">
          <i>{card?.article ?? "□"}</i>
          <strong>{card?.word ?? "□"}</strong>
        </span>
        <small>артикль + существительное</small>
      </span>
    );
  } else if (gameId === "train") {
    const nouns = module.cards.filter((item) => item.article).slice(0, 3);
    art = (
      <span className="gp-train">
        {nouns.map((item) => (
          <span key={item.id}>
            <i>{item.article}</i>
            <b>{item.word}</b>
          </span>
        ))}
      </span>
    );
  } else if (gameId === "blitz") {
    const choices = [card, ...alternatives]
      .filter((item): item is VocabCard => Boolean(item))
      .slice(0, 4);
    art = (
      <span className="gp-quiz">
        <b>{card ? german(card) : "Добавьте слова"}</b>
        <span className="gp-quiz-options">
          {choices.map((item, index) => (
            <i className={index === 0 ? "correct" : ""} key={item.id}>
              {item.translation}
            </i>
          ))}
        </span>
      </span>
    );
  } else if (gameId === "moles") {
    const choices = [card, ...alternatives]
      .filter((item): item is VocabCard => Boolean(item))
      .slice(0, 4);
    art = (
      <span className="gp-moles">
        <b>{card ? german(card) : "Добавьте слова"}</b>
        <span>
          {choices.map((item, index) => (
            <i className={index === 0 ? "correct" : ""} key={item.id}>
              {item.translation}
            </i>
          ))}
        </span>
      </span>
    );
  } else if (gameId === "boxes") {
    const choices = [card, ...alternatives]
      .filter((item): item is VocabCard => Boolean(item))
      .slice(0, 3);
    art = (
      <span className="gp-boxes">
        <b>{card ? german(card) : "Добавьте слова"}</b>
        <span>
          {choices.map((item, index) => (
            <i className={index === 0 ? "open" : ""} key={item.id}>
              <small>{index === 0 ? item.translation : "?"}</small>
            </i>
          ))}
        </span>
      </span>
    );
  } else if (gameId === "wheel") {
    art = (
      <span className="gp-wheel">
        <span className="gp-wheel-disc">
          {sampled.slice(0, 4).map((item, index) => (
            <i className={`sector-${index}`} key={item.id}>
              {german(item)}
            </i>
          ))}
        </span>
        <b>✦</b>
      </span>
    );
  } else if (gameId === "phonetic") {
    art = (
      <span className="gp-phonetic">
        <b>
          <Icon name="volume" size={23} />
        </b>
        <span>
          {sampled.slice(0, 3).map((item, index) => (
            <i className={index === 0 ? "selected" : ""} key={item.id}>
              {german(item)}
            </i>
          ))}
        </span>
      </span>
    );
  } else if (gameId === "hangman") {
    const letters = [...(card?.word ?? "")];
    art = (
      <span className="gp-word">
        <b>{card?.translation ?? "Добавьте слова"}</b>
        <strong>{letters.map((letter, index) => (index < 2 ? letter : "＿")).join(" ")}</strong>
      </span>
    );
  } else if (gameId === "wordsearch") {
    const letters = [...(card?.word.toLocaleUpperCase() ?? "")].slice(0, 3);
    art = (
      <span className="gp-word">
        <b>{card?.translation ?? "Добавьте слова"}</b>
        <strong className="gp-input-preview">
          {letters.join("")}
          <i>▏</i>_____
        </strong>
      </span>
    );
  } else if (gameId === "anagram") {
    const letters = [...(card?.word.toLocaleUpperCase() ?? "")].slice(0, 10);
    art = (
      <span className="gp-letters">
        <b>{card?.translation ?? "Добавьте слова"}</b>
        <span>
          {[...letters].reverse().map((letter, index) => (
            <i key={`${letter}-${index}`}>{letter}</i>
          ))}
        </span>
        <small className="gp-answer-line" />
      </span>
    );
  } else if (gameId === "finalsound") {
    const finalSoundCard = module.cards.find((item) => /[bdg]$/i.test(item.word));
    art = (
      <span className="gp-phonetic">
        <b>
          <Icon name="volume" size={23} />
        </b>
        <span>
          <strong>{finalSoundCard ? german(finalSoundCard) : "Добавьте слова"}</strong>
          <i className="selected">{finalSoundCard?.word.slice(-1).toLocaleLowerCase() ?? "b"}</i>
          <i>
            {finalSoundCard?.word.endsWith("b")
              ? "p"
              : finalSoundCard?.word.endsWith("d")
                ? "t"
                : "k"}
          </i>
        </span>
      </span>
    );
  } else if (gameId === "picture") {
    const pictureCard = module.cards.find((item) => item.image?.id);
    art = (
      <span className="gp-picture">
        {pictureCard?.image?.id ? (
          <SavedImagePreview image={pictureCard.image} alt={`Пример: ${pictureCard.word}`} />
        ) : null}
        <b>{pictureCard?.word ?? "Добавьте картинку"}</b>
        <span className="gp-quiz-options">
          {module.cards
            .filter((item) => item.image?.id)
            .slice(0, 3)
            .map((item) => (
              <i key={item.id}>{item.word}</i>
            ))}
        </span>
      </span>
    );
  } else if (gameId === "dialogue") {
    art = (
      <span className="gp-scenario gp-dialogue-art">
        <i>Guten Morgen!</i>
        <b>Was möchten Sie?</b>
        <strong>Einen Kaffee, bitte.</strong>
      </span>
    );
  } else if (gameId === "quest") {
    art = (
      <span className="gp-scenario gp-quest-art">
        <i>1 · слово</i>
        <i>2 · диалог</i>
        <i>3 · фраза</i>
        <i>4 · ошибка</i>
      </span>
    );
  } else if (gameId === "error-editor") {
    art = (
      <span className="gp-scenario gp-error-art">
        <del>Ich gehen …</del>
        <b>Ich gehe …</b>
        <small>Форма глагола · ich</small>
      </span>
    );
  } else if (gameId === "truefalse") {
    const shownTranslation = alternatives[0]?.translation ?? card?.translation;
    art = (
      <span className="gp-new-game gp-truefalse">
        <small>СОВПАДАЮТ?</small>
        <b>{card ? german(card) : "Wort"}</b>
        <strong>{shownTranslation ?? "перевод"}</strong>
        <span>
          <i>Да</i>
          <i>Нет</i>
        </span>
      </span>
    );
  } else if (gameId === "oddone") {
    art = (
      <span className="gp-new-game gp-oddone">
        <small>{card?.translation ?? "Найдите слово"}</small>
        <span>
          {[card, ...alternatives]
            .filter(Boolean)
            .slice(0, 4)
            .map((item, index) => (
              <i className={index === 0 ? "selected" : ""} key={(item as VocabCard).id}>
                {(item as VocabCard).word}
              </i>
            ))}
        </span>
      </span>
    );
  } else if (gameId === "memory") {
    art = (
      <span className="gp-new-game gp-memory">
        <small>НАЙДИТЕ ПАРУ</small>
        <span>
          <i>{card?.word ?? "Wort"}</i>
          <i>?</i>
          <i>?</i>
          <i>{card?.translation ?? "слово"}</i>
        </span>
      </span>
    );
  } else if (gameId === "speed") {
    art = (
      <span className="gp-new-game gp-speed">
        <small>00:08</small>
        <b>{card ? german(card) : "Wort"}</b>
        <span>
          <i>{card?.translation ?? "перевод"}</i>
          <i>{alternatives[0]?.translation ?? "вариант"}</i>
        </span>
      </span>
    );
  } else if (gameId === "syllables") {
    const letters = [...(card?.word ?? "lernen")];
    const middle = Math.max(1, Math.ceil(letters.length / 2));
    art = (
      <span className="gp-new-game gp-syllables">
        <small>{card?.translation ?? "Соберите слово"}</small>
        <span>
          <i>{letters.slice(0, middle).join("")}</i>
          <i>{letters.slice(middle).join("")}</i>
        </span>
        <b>{letters.map(() => "＿").join("")}</b>
      </span>
    );
  } else {
    art = (
      <span className="gp-letters">
        <b>{card ? german(card) : "Добавьте слова"}</b>
        <span>
          {sampled.slice(0, 3).map((item) => (
            <i key={item.id}>{item.translation}</i>
          ))}
        </span>
      </span>
    );
  }
  const mascotNumber = ["pairs", "blitz", "moles", "boxes", "speed"].includes(gameId)
    ? 3
    : ["phonetic", "finalsound", "picture", "memory"].includes(gameId)
      ? 7
      : ["articles", "builder", "train", "fillblank", "syllables"].includes(gameId)
        ? 6
        : 5;
  return (
    <span className={`game-tile-art art-${gameId}`} aria-hidden="true">
      <img className="game-art-mascot" src={`/mascots/${mascotNumber}.webp`} alt="" />
      <span className="gp-scene">{art}</span>
    </span>
  );
}

function gamePreviewDescription(gameId: GameId, module: VocabModule) {
  const card = module.cards[0];
  const word = card
    ? `${card.article ? `${card.article} ` : ""}${card.word} — ${card.translation}`
    : "слов пока нет";
  const second = module.cards[1] ? `${module.cards[1].word} — ${module.cards[1].translation}` : "";
  const title = GAME_LIST.find((game) => game.id === gameId)?.title ?? "Игра";
  return `${title}: ${[word, second].filter(Boolean).join(", ")}`;
}

export function GameHub({
  modules,
  preferredModuleId,
  languageCode,
  languageName,
  level,
  onStart,
  onGrammar,
  onAddWords,
  onStartAudio,
  onAudioRestart,
  onAudioAnswer,
  onAudioEvent,
  audioQuizzes,
  onAudioQuizzesChange,
  canManageContent = true,
}: {
  modules: VocabModule[];
  preferredModuleId: number | null;
  languageCode: string;
  languageName: string;
  level: string;
  onStart: (id: GameId, module: VocabModule, route?: string) => void;
  onGrammar: (topic: GrammarTopic) => void;
  onAddWords: () => void;
  onStartAudio?: (id: string) => boolean | Promise<boolean>;
  onAudioRestart?: () => void | boolean | Promise<void | boolean>;
  onAudioAnswer: (correct: boolean) => void;
  onAudioEvent?: (payload: Record<string, unknown>) => void;
  audioQuizzes: AudioQuiz[];
  onAudioQuizzesChange: React.Dispatch<React.SetStateAction<AudioQuiz[]>>;
  canManageContent?: boolean;
}) {
  const preferred = modules.find((module) => module.id === 1) ?? modules[0];
  const [moduleId, setModuleId] = useState(preferred?.id ?? 0);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"games" | "grammar">("games");
  const [gameFilter, setGameFilter] = useState<
    "all" | "words" | "listening" | "writing" | "grammar"
  >("all");
  const [hashRoute, setHashRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const syncHash = () => setHashRoute(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);
  const [activities, setActivities] = useState<SavedActivity[]>(() => {
    try {
      const saved = JSON.parse(readProfileItem("linguaplay-saved-activities") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [audioBuilderOpen, setAudioBuilderOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioQuiz | undefined>(undefined);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityGame, setActivityGame] = useState<GameId>("pairs");
  const [builderModuleId, setBuilderModuleId] = useState<number>(preferred?.id ?? 0);
  const [activityCards, setActivityCards] = useState<VocabCard[]>([]);
  const [cardPreset, setCardPreset] = useState<"all" | "pronoun" | "noun" | "verb">("all");
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activityInstructions, setActivityInstructions] = useState("");
  const [activityMedia, setActivityMedia] = useState<VocabModule["practiceMedia"]>();
  const [activityMediaUrl, setActivityMediaUrl] = useState("");
  const [activityLinkDraft, setActivityLinkDraft] = useState("");
  const mediaFileInput = useRef<HTMLInputElement>(null);
  const pendingMediaIds = useRef<string[]>([]);
  const originalMediaId = useRef<string | null>(null);
  const [grammarGroup, setGrammarGroup] = useState<"basics" | "sentences">("basics");
  const [customGrammar, setCustomGrammar] = useState<GrammarTopic[]>(() => {
    try {
      const saved = JSON.parse(readProfileItem("linguaplay-custom-grammar") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const visibleCustomGrammar = customGrammar.filter(
    (topic) => (topic.languageCode ?? "de") === languageCode && (topic.level ?? "A1–A2") === level,
  );
  const [grammarBuilderOpen, setGrammarBuilderOpen] = useState(false);
  const [grammarDraft, setGrammarDraft] = useState<GrammarDraft | null>(null);
  const processedAudioRoute = useRef("");
  const processedGameRoute = useRef("");
  useEffect(
    () => writeProfileItem("linguaplay-saved-activities", JSON.stringify(activities)),
    [activities],
  );
  useEffect(
    () => writeProfileItem("linguaplay-custom-grammar", JSON.stringify(customGrammar)),
    [customGrammar],
  );
  useEffect(() => {
    const syncHash = () => setHashRoute(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  useEffect(() => {
    let createdUrl = "";
    let alive = true;
    setActivityMediaUrl("");
    if (activityMedia?.id)
      void loadMediaFile(activityMedia.id)
        .then((blob) => {
          if (!alive || !blob) return;
          createdUrl = URL.createObjectURL(blob);
          setActivityMediaUrl(createdUrl);
        })
        .catch(() => undefined);
    else if (activityMedia?.url) setActivityMediaUrl(activityMedia.url);
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [activityMedia]);
  useEffect(() => {
    if (preferredModuleId !== null && modules.some((module) => module.id === preferredModuleId))
      setModuleId(preferredModuleId);
  }, [preferredModuleId]);
  useEffect(() => {
    if (!modules.some((module) => module.id === moduleId)) setModuleId(modules[0]?.id ?? 0);
  }, [modules, moduleId]);
  const selectedModule = modules.find((module) => module.id === moduleId) ?? modules[0];
  const selectedCards = selectedModule?.cards ?? [];
  const wordCountLabel = (count: number) =>
    count === 1
      ? "слово"
      : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
        ? "слова"
        : "слов";
  const builderModule = modules.find((module) => module.id === builderModuleId) ?? selectedModule;
  const builderCards = activityCards;
  const selectedBuilderCards = builderCards.filter((card) => selectedCardIds.includes(card.id));
  const fillblankIncomplete =
    activityGame === "fillblank" &&
    selectedBuilderCards.some(
      (card) =>
        !card.exampleSentence?.trim() ||
        card.exampleSentence.split("___").length !== 2 ||
        !card.sentenceAnswer?.trim(),
    );
  const pictureIncomplete =
    activityGame === "picture" && selectedBuilderCards.some((card) => !card.image?.id);
  const languageForm = languageForms[languageCode] ?? {
    adjective: "учебное",
    locative: languageName.toLocaleLowerCase(),
  };
  const availableGames = GAME_LIST.filter(
    (game) => languageCode === "de" || !germanOnlyGames.has(game.id),
  ).map((game) =>
    game.id === "pairs"
      ? { ...game, description: `Соедините ${languageForm.adjective} слово с переводом` }
      : game.id === "phonetic"
        ? { ...game, description: `На слух найдите слово на ${languageForm.locative}` }
        : game,
  );
  const cardGames = selectedModule
    ? availableGames.map((game) => ({
        game,
        module: prepareGameModule(game.id, selectedModule),
        reason: validateGame(game.id, prepareGameModule(game.id, selectedModule)),
      }))
    : [];
  const gameFilterIds: Record<Exclude<typeof gameFilter, "all">, Set<GameId>> = {
    words: new Set([
      "pairs",
      "blitz",
      "hangman",
      "moles",
      "boxes",
      "wheel",
      "picture",
      "dialogue",
      "quest",
      "truefalse",
      "oddone",
      "memory",
      "speed",
    ]),
    listening: new Set(["phonetic", "finalsound"]),
    writing: new Set(["wordsearch", "anagram", "sentenceorder", "syllables"]),
    grammar: new Set([
      "articles",
      "builder",
      "train",
      "fillblank",
      "sentenceorder",
      "quest",
      "error-editor",
    ]),
  };
  const filteredCardGames = cardGames.filter(
    (item) => gameFilter === "all" || gameFilterIds[gameFilter].has(item.game.id),
  );
  const gameGroups = [
    {
      title: "Слова",
      ids: new Set<GameId>([
        "pairs",
        "blitz",
        "hangman",
        "wordsearch",
        "anagram",
        "moles",
        "boxes",
        "wheel",
        "picture",
        "truefalse",
        "oddone",
        "memory",
        "speed",
        "syllables",
      ]),
    },
    { title: "На слух", ids: new Set<GameId>(["phonetic", "finalsound"]) },
    {
      title: "Грамматика и фразы",
      ids: new Set<GameId>(["articles", "builder", "train", "fillblank", "sentenceorder"]),
    },
    {
      title: "В контексте",
      ids: new Set<GameId>(["dialogue", "quest", "error-editor"]),
    },
  ].map((group) => ({
    ...group,
    games: filteredCardGames.filter((item) => !item.reason && group.ids.has(item.game.id)),
  }));
  const lockedGames = filteredCardGames.filter((item) => Boolean(item.reason));
  const builderGames = GAME_LIST.filter(
    (game) => builderModule?.languageCode === "de" || !germanOnlyGames.has(game.id),
  ).map((game) =>
    game.id === "pairs"
      ? { ...game, description: `Соедините ${languageForm.adjective} слово с переводом` }
      : game.id === "phonetic"
        ? { ...game, description: `На слух найдите слово на ${languageForm.locative}` }
        : game,
  );
  const filteredCards = builderCards.filter(
    (card) => cardPreset === "all" || card.partOfSpeech === cardPreset,
  );
  const moduleActivities = activities.filter(
    (activity) =>
      activity.languageCode === languageCode &&
      activity.level === level &&
      activity.moduleId === selectedModule?.id &&
      availableGames.some((game) => game.id === activity.gameId),
  );
  const visibleAudioQuizzes = audioQuizzes.filter(
    (quiz) => quiz.languageCode === languageCode && quiz.level === level,
  );
  const closeActivityBuilder = () => {
    pendingMediaIds.current.forEach((id) => void removeMediaFile(id).catch(() => undefined));
    pendingMediaIds.current = [];
    originalMediaId.current = null;
    setBuilderOpen(false);
  };
  const openNewActivity = () => {
    setEditingActivityId(null);
    setBuilderModuleId(selectedModule?.id ?? 0);
    setActivityCards(selectedCards.map((card) => ({ ...card })));
    setActivityTitle(`Игра · ${selectedModule?.title ?? ""}`);
    setActivityGame("pairs");
    setCardPreset("all");
    setSelectedCardIds([]);
    setActivityInstructions("");
    setActivityMedia(undefined);
    setActivityLinkDraft("");
    originalMediaId.current = null;
    pendingMediaIds.current = [];
    setBuilderOpen(true);
  };
  const openEditActivity = (activity: SavedActivity) => {
    const sourceModule = modules.find((module) => module.id === activity.moduleId);
    const savedCards = activity.cards?.length
      ? activity.cards
      : (sourceModule?.cards.filter((card) => activity.cardIds.includes(card.id)) ?? []);
    setEditingActivityId(activity.id);
    setBuilderModuleId(activity.moduleId);
    setActivityCards(savedCards.map((card) => ({ ...card })));
    setActivityTitle(activity.title);
    setActivityGame(activity.gameId);
    setCardPreset("all");
    setSelectedCardIds(savedCards.map((card) => card.id));
    setActivityInstructions(activity.instructions ?? "");
    setActivityMedia(activity.media);
    setActivityLinkDraft("");
    originalMediaId.current = activity.media?.id ?? null;
    pendingMediaIds.current = [];
    setBuilderOpen(true);
  };
  const changeBuilderModule = (id: number) => {
    const previousModule = builderModule;
    const nextModule = modules.find((module) => module.id === id);
    if (!nextModule) return;
    if (previousModule)
      setActivityTitle((current) =>
        current === `Игра · ${previousModule.title}` ? `Игра · ${nextModule.title}` : current,
      );
    setBuilderModuleId(id);
    setActivityCards(nextModule.cards.map((card) => ({ ...card })));
    setSelectedCardIds([]);
    setCardPreset("all");
    setActivityGame((current) =>
      nextModule.languageCode !== "de" && germanOnlyGames.has(current) ? "pairs" : current,
    );
  };
  const updateActivityCard = (cardId: string, patch: Partial<VocabCard>) =>
    setActivityCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
    );
  const addActivityCard = () => {
    const id = `activity-card-${crypto.randomUUID?.() ?? Date.now()}`;
    setActivityCards((current) => [
      ...current,
      {
        id,
        moduleId: builderModule?.id ?? 0,
        word: "",
        article: null,
        transcription: "",
        translation: "",
        partOfSpeech: "other",
        phoneticRuleId: null,
      },
    ]);
    setSelectedCardIds((current) => [...current, id]);
  };
  const attachCardImage = async (cardId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Для этой карточки выберите изображение.");
      return;
    }
    const maxSize = getActiveProfileId() ? 4 : 20;
    if (file.size > maxSize * 1024 * 1024) {
      setNotice(`Изображение больше ${maxSize} МБ. Выберите файл меньшего размера.`);
      return;
    }
    const id = `activity-image-${crypto.randomUUID?.() ?? Date.now()}`;
    try {
      await saveMediaFile(id, file);
      pendingMediaIds.current.push(id);
      updateActivityCard(cardId, { image: { id, name: file.name } });
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить изображение в этом браузере.",
      );
    }
  };
  const attachActivityFile = async (file?: File) => {
    if (!file) return;
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
        ? "audio"
        : file.type.startsWith("video/")
          ? "video"
          : null;
    if (!kind) {
      setNotice("Для игры выберите изображение, аудио или видео.");
      return;
    }
    const maxSize = getActiveProfileId() ? 4 : kind === "image" ? 30 : kind === "audio" ? 60 : 100;
    if (file.size > maxSize * 1024 * 1024) {
      setNotice(`Файл больше ${maxSize} МБ. Выберите файл меньшего размера.`);
      return;
    }
    const id = `activity-media-${crypto.randomUUID?.() ?? Date.now()}`;
    try {
      await saveMediaFile(id, file);
      pendingMediaIds.current.push(id);
      setActivityMedia({ id, kind, name: file.name, mimeType: file.type });
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось сохранить медиафайл в этом браузере.",
      );
    } finally {
      if (mediaFileInput.current) mediaFileInput.current.value = "";
    }
  };
  const attachActivityLink = () => {
    try {
      const link = new URL(activityLinkDraft.trim());
      if (!["https:", "http:"].includes(link.protocol)) throw new Error();
      setActivityMedia({ kind: "link", name: "Дополнительная ссылка", url: link.toString() });
      setActivityLinkDraft("");
      setNotice("");
    } catch {
      setNotice("Введите ссылку, начинающуюся с http:// или https://.");
    }
  };
  const saveActivity = () => {
    if (!builderModule || !activityTitle.trim() || !selectedCardIds.length) return;
    const cards = builderCards.filter((card) => selectedCardIds.includes(card.id));
    if (cards.some((card) => !card.word.trim() || !card.translation.trim())) {
      setNotice("Заполните слово и перевод для каждой выбранной карточки.");
      return;
    }
    const unavailable = validateGame(activityGame, { ...builderModule, cards });
    if (unavailable) {
      setNotice(unavailable);
      return;
    }
    if (pictureIncomplete) {
      setNotice(
        "Для каждого выбранного слова добавьте изображение, чтобы у каждого задания была своя картинка.",
      );
      return;
    }
    if (
      activityGame === "fillblank" &&
      cards.some(
        (card) =>
          !card.exampleSentence?.trim() ||
          card.exampleSentence.split("___").length !== 2 ||
          !card.sentenceAnswer?.trim(),
      )
    ) {
      setNotice(
        "Для каждого выбранного слова заполните предложение с одним пропуском ___ и правильный ответ.",
      );
      return;
    }
    const title = uniqueMaterialName(
      activityTitle,
      [...activities, ...audioQuizzes, ...customGrammar],
      editingActivityId ?? undefined,
    );
    const activity: SavedActivity = {
      id: editingActivityId ?? `activity-${Date.now()}`,
      title,
      gameId: activityGame,
      moduleId: builderModule.id,
      languageCode: builderModule.languageCode,
      level: builderModule.level,
      cardIds: cards.map((card) => card.id),
      cards,
      instructions: activityInstructions.trim(),
      media: activityMedia,
    };
    const keptMediaIds = new Set(
      [activityMedia?.id, ...cards.map((card) => card.image?.id)].filter((id): id is string =>
        Boolean(id),
      ),
    );
    pendingMediaIds.current
      .filter((id) => !keptMediaIds.has(id))
      .forEach((id) => void removeMediaFile(id).catch(() => undefined));
    if (originalMediaId.current && originalMediaId.current !== (activityMedia?.id ?? null))
      void removeMediaFile(originalMediaId.current).catch(() => undefined);
    const previousActivity = activities.find((item) => item.id === editingActivityId);
    previousActivity?.cards?.forEach((card) => {
      if (card.image?.id && !keptMediaIds.has(card.image.id))
        void removeMediaFile(card.image.id).catch(() => undefined);
    });
    pendingMediaIds.current = [];
    originalMediaId.current = activityMedia?.id ?? null;
    setActivities((current) =>
      editingActivityId
        ? current.map((item) => (item.id === editingActivityId ? activity : item))
        : [...current, activity],
    );
    setBuilderOpen(false);
    setNotice(
      title !== activityTitle.trim()
        ? `Такое название уже есть. Сохранил игру как «${title}».`
        : "Игра сохранена. Запустите её из раздела «Мои игры».",
    );
  };
  const runActivity = (activity: SavedActivity) => {
    const sourceModule = modules.find((item) => item.id === activity.moduleId);
    if (!sourceModule) {
      setNotice("Исходный модуль игры больше не найден в этом кабинете.");
      return;
    }
    const cards = activity.cards?.length
      ? activity.cards
      : sourceModule.cards.filter((card) => activity.cardIds.includes(card.id));
    const module = {
      ...sourceModule,
      title: activity.title,
      cards,
      practiceInstructions: activity.instructions,
      practiceMedia: activity.media,
    };
    const unavailable = validateGame(activity.gameId, module);
    if (unavailable) {
      setNotice(unavailable);
      return;
    }
    const updatedActivities = activities.map((item) =>
      item.id === activity.id ? { ...item, lastPlayedAt: Date.now() } : item,
    );
    setActivities(updatedActivities);
    writeProfileItem("linguaplay-saved-activities", JSON.stringify(updatedActivities));
    onStart(activity.gameId, module, `games?activity=${encodeURIComponent(activity.id)}`);
  };
  const deleteActivity = (activity: SavedActivity) => {
    setActivities((current) => current.filter((item) => item.id !== activity.id));
    if (activity.media?.id) void removeMediaFile(activity.media.id).catch(() => undefined);
    activity.cards?.forEach((card) => {
      if (card.image?.id) void removeMediaFile(card.image.id).catch(() => undefined);
    });
  };
  useEffect(() => {
    const params = new URLSearchParams(hashRoute.split("?").slice(1).join("?"));
    const activityId = params.get("activity");
    const grammarId = params.get("grammar");
    const audioId = params.get("audio");
    const templateId = params.get("template") as GameId | null;
    const requestedModuleId = Number(params.get("module"));
    if (activityId) {
      if (processedGameRoute.current === hashRoute) return;
      processedGameRoute.current = hashRoute;
      const activity = activities.find((item) => item.id === activityId);
      if (!activity) {
        setNotice("Сохранённая игра не найдена. Вернитесь в список игр и выберите другую.");
        return;
      }
      window.history.replaceState(window.history.state, "", "#/games");
      setHashRoute("#/games");
      runActivity(activity);
    } else if (grammarId) {
      const topic =
        visibleCustomGrammar.find((item) => item.id === grammarId) ??
        GRAMMAR_TOPICS.find((item) => item.id === grammarId);
      if (
        !topic ||
        (topic.custom &&
          ((topic.languageCode ?? "de") !== languageCode || (topic.level ?? "A1–A2") !== level))
      )
        return;
      window.history.replaceState(window.history.state, "", "#/games");
      setActiveTab("grammar");
      onGrammar(topic);
    } else if (
      audioId &&
      audioQuizzes.some(
        (quiz) => quiz.id === audioId && quiz.languageCode === languageCode && quiz.level === level,
      )
    ) {
      if (processedAudioRoute.current === hashRoute) return;
      processedAudioRoute.current = hashRoute;
      void Promise.resolve(onStartAudio?.(audioId) ?? true).then((allowed) => {
        if (!allowed) return;
        window.history.replaceState(window.history.state, "", "#/games");
        setHashRoute("#/games");
        setActiveAudioId(audioId);
      });
    } else if (templateId && GAME_LIST.some((game) => game.id === templateId)) {
      if (processedGameRoute.current === hashRoute) return;
      processedGameRoute.current = hashRoute;
      const targetModule =
        modules.find((module) => module.id === requestedModuleId) ?? selectedModule;
      if (
        !targetModule ||
        targetModule.languageCode !== languageCode ||
        targetModule.level !== level
      ) {
        setNotice("Этот набор сейчас недоступен в выбранном кабинете. Выберите подходящий модуль.");
        return;
      }
      const prepared = prepareGameModule(templateId, targetModule);
      const unavailable = validateGame(templateId, prepared);
      if (unavailable) {
        setNotice(unavailable);
        return;
      }
      setModuleId(targetModule.id);
      window.history.replaceState(window.history.state, "", "#/games");
      setHashRoute("#/games");
      onStart(
        templateId,
        prepared,
        `games?template=${encodeURIComponent(templateId)}&module=${targetModule.id}`,
      );
    }
  }, [activities, audioQuizzes, visibleCustomGrammar, modules, hashRoute, onStartAudio]);
  const saveAudioQuiz = (quiz: AudioQuiz) => {
    const title = uniqueMaterialName(
      quiz.title,
      [...activities, ...audioQuizzes, ...customGrammar],
      quiz.id,
    );
    const savedQuiz = { ...quiz, title };
    const previous = audioQuizzes.find((item) => item.id === quiz.id);
    if (previous?.audioMediaId && previous.audioMediaId !== quiz.audioMediaId)
      void removeMediaFile(previous.audioMediaId).catch(() => undefined);
    onAudioQuizzesChange((current) =>
      current.some((item) => item.id === quiz.id)
        ? current.map((item) => (item.id === quiz.id ? savedQuiz : item))
        : [...current, savedQuiz],
    );
    setAudioBuilderOpen(false);
    setEditingAudio(undefined);
    setNotice(
      title !== quiz.title.trim()
        ? `Такое название уже есть. Сохранил аудиотест как «${title}».`
        : "Аудиотест сохранён в текущем кабинете.",
    );
  };
  const openGrammarBuilder = (topic?: GrammarTopic) => {
    setGrammarDraft(
      topic
        ? {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            explanation: topic.explanation,
            examplesText: topic.examples.join("\n"),
            group: topic.group ?? grammarGroup,
            questions: topic.questions.map((question) => ({
              ...question,
              optionsText: question.options.join("; "),
            })),
          }
        : {
            id: `custom-grammar-${Date.now()}`,
            title: "",
            description: "",
            explanation: "",
            examplesText: "",
            group: grammarGroup,
            questions: [{ prompt: "___", optionsText: "", answer: "", explanation: "" }],
          },
    );
    setGrammarBuilderOpen(true);
  };
  const saveGrammarTopic = () => {
    if (!grammarDraft) return;
    const title = uniqueMaterialName(
      grammarDraft.title,
      [...activities, ...audioQuizzes, ...customGrammar],
      grammarDraft.id,
    );
    const topic: GrammarTopic = {
      id: grammarDraft.id,
      title,
      description: grammarDraft.description.trim(),
      explanation: grammarDraft.explanation.trim(),
      examples: grammarDraft.examplesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      group: grammarDraft.group,
      custom: true,
      languageCode,
      level,
      questions: grammarDraft.questions.map((question) => ({
        prompt: question.prompt.trim(),
        options: question.optionsText
          .split(";")
          .map((option) => option.trim())
          .filter(Boolean),
        answer: question.answer.trim(),
        explanation: question.explanation.trim(),
      })),
    };
    setCustomGrammar((current) =>
      current.some((item) => item.id === topic.id)
        ? current.map((item) => (item.id === topic.id ? topic : item))
        : [...current, topic],
    );
    setGrammarBuilderOpen(false);
    setGrammarDraft(null);
    setNotice(
      title !== grammarDraft.title.trim()
        ? `Такое название уже есть. Сохранил тему как «${title}».`
        : "Тема грамматики сохранена в этом языковом кабинете.",
    );
  };
  const builtinGrammarTopics =
    languageCode === "de" && level === "A1–A2"
      ? GRAMMAR_TOPICS.filter(
          (topic) =>
            (topic.group ??
              (["accusative", "wohin", "negation"].includes(topic.id) ? "basics" : "sentences")) ===
            grammarGroup,
        )
      : [];
  const activeAudioQuiz = audioQuizzes.find((quiz) => quiz.id === activeAudioId);
  if (activeAudioQuiz)
    return (
      <AudioQuizSession
        quiz={activeAudioQuiz}
        onExit={() => setActiveAudioId(null)}
        onAnswer={onAudioAnswer}
        onEvent={onAudioEvent}
        onRestart={onAudioRestart}
      />
    );
  return (
    <div className="page games-page">
      <div className="page-heading">
        <img
          className="games-heading-mascot"
          src="/mascots/3.webp"
          alt=""
          aria-hidden="true"
        />
        <div>
          <p className="eyebrow">
            {selectedModule?.languageName ?? "УЧЕБНЫЙ КАБИНЕТ"} · {selectedModule?.level ?? ""}
          </p>
          <h1>Поиграем?</h1>
          <p>
            {selectedModule
              ? `Играйте со словами из «${selectedModule.title}».`
              : "Добавьте материалы в текущий языковой кабинет."}
          </p>
        </div>
        {Boolean(modules.length) && (
          <label className="module-select-label">
            Слова из модуля
            <select
              value={moduleId}
              onChange={(event) => {
                setModuleId(Number(event.target.value));
                setNotice("");
              }}
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  Модуль {module.id} · {module.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <PandaNote title="Одна игра — маленькая победа">Выберите карточку и начните.</PandaNote>
      <div className="practice-tabs">
        <button
          className={activeTab === "games" ? "active" : ""}
          onClick={() => setActiveTab("games")}
        >
          Игры по словам
        </button>
        <button
          className={activeTab === "grammar" ? "active" : ""}
          onClick={() => setActiveTab("grammar")}
        >
          Грамматика
        </button>
      </div>
      {activeTab === "games" && selectedModule && (
        <div className="game-filter-row" role="group" aria-label="Фильтр игр">
          {(
            [
              ["all", "Все"],
              ["words", "Слова"],
              ["listening", "Слух"],
              ["writing", "Письмо"],
              ["grammar", "Грамматика"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={gameFilter === id ? "active" : ""}
              aria-pressed={gameFilter === id}
              onClick={() => setGameFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <div className="inline-notice">
          <Icon name="info" />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {activeTab === "games" && selectedModule && (
        <>
          <div className="practice-section-title">
            <div>
              <h2>Выберите игру</h2>
              <p>
                {selectedCards.length} {wordCountLabel(selectedCards.length)}
              </p>
            </div>
            {canManageContent && (
              <button className="primary-button compact" onClick={openNewActivity}>
                <Icon name="plus" size={16} /> Создать игру
              </button>
            )}
          </div>
          {selectedCards.length > 0 ? (
            <>
              <section className="practice-word-bank" aria-label="Слова текущего модуля">
                <div>
                  <strong>Слова для игр</strong>
                  <span>
                    {selectedCards.slice(0, 4).map((card) => (
                      <span className="practice-word-chip" key={card.id}>
                        {card.article ? `${card.article} ` : ""}
                        {card.word}
                      </span>
                    ))}
                    {selectedCards.length > 4 && (
                      <span className="practice-word-more">+{selectedCards.length - 4}</span>
                    )}
                  </span>
                </div>
                <button type="button" onClick={onAddWords}>
                  Изменить слова
                </button>
              </section>
              <section className="practice-game-groups" aria-label="Доступные игры">
                {gameGroups.map(
                  (group) =>
                    group.games.length > 0 && (
                      <div className="practice-game-category" key={group.title}>
                        <h4>{group.title}</h4>
                        <div className="games-grid">
                          {group.games.map(({ game, module: prepared }) => (
                            <article className="game-tile-wrap" key={game.id}>
                              <button
                                className="game-tile"
                                aria-label={`${game.title}. ${game.description}. ${gamePreviewDescription(game.id, prepared)}`}
                                onClick={() => {
                                  setNotice("");
                                  onStart(
                                    game.id,
                                    prepared,
                                    `games?template=${encodeURIComponent(game.id)}&module=${selectedModule.id}`,
                                  );
                                }}
                              >
                                <GameArtwork gameId={game.id} module={prepared} />
                                <span className="game-tile-copy">
                                  <strong>{game.title}</strong>
                                  <small>{game.description}</small>
                                  <span className="game-card-footer">
                                    <span>
                                      {prepared.cards.length}{" "}
                                      {wordCountLabel(prepared.cards.length)}
                                    </span>
                                    <b>
                                      Играть <Icon name="arrow" size={14} />
                                    </b>
                                  </span>
                                </span>
                              </button>
                            </article>
                          ))}
                        </div>
                      </div>
                    ),
                )}
              </section>
            </>
          ) : (
            <div className="practice-empty-words">
              <span aria-hidden="true">＋</span>
              <h3>Добавьте слова для игр</h3>
              <p>Игры соберутся по словам из этого модуля.</p>
              <button className="primary-button compact" onClick={onAddWords}>
                Добавить слова
              </button>
            </div>
          )}
          {selectedCards.length > 0 && lockedGames.length > 0 && (
            <details className="locked-game-group">
              <summary>
                <strong>Нужно добавить слова</strong>
                <span>{lockedGames.length} игр</span>
              </summary>
              <div className="games-grid">
                {lockedGames.map(({ game, module: prepared, reason }) => (
                  <article className="game-tile-wrap locked-wrap" key={game.id}>
                    <button
                      className="game-tile locked"
                      title={game.description}
                      aria-label={`${gamePreviewDescription(game.id, prepared)}. ${reason}`}
                      onClick={() => setNotice(reason ?? "Добавьте подходящие слова в модуль.")}
                    >
                      <GameArtwork gameId={game.id} module={prepared} />
                      <span className="game-tile-copy">
                        <strong>{game.title}</strong>
                        <small className="game-lock-reason">
                          <Icon name="info" size={13} />
                          {reason}
                        </small>
                        <small className="game-card-meta">
                          {prepared.cards.length} {wordCountLabel(prepared.cards.length)}
                        </small>
                      </span>
                    </button>
                    <div className="locked-game-actions">
                      <span>Пока недоступна</span>
                      <button type="button" onClick={onAddWords}>
                        Добавить слова
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          )}
          <section className="saved-activities my-games-section">
            <div className="section-title">
              <div>
                <h2>Мои игры</h2>
                <p>Сценарии, которые вы сохранили.</p>
              </div>
            </div>
            {moduleActivities.length ? (
              <div className="my-games-grid">
                {moduleActivities.map((activity) => (
                  <article className="my-game-card" key={activity.id}>
                    <span className="activity-icon">
                      {GAME_LIST.find((game) => game.id === activity.gameId)?.mark}
                    </span>
                    <div>
                      <strong>{activity.title}</strong>
                      <small>
                        {GAME_LIST.find((game) => game.id === activity.gameId)?.title} ·{" "}
                        {activity.cardIds.length} {wordCountLabel(activity.cardIds.length)}
                      </small>
                      <small>
                        {activity.lastPlayedAt
                          ? `Запускали ${new Date(activity.lastPlayedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
                          : "Ещё не запускали"}
                      </small>
                    </div>
                    <button
                      className="primary-button compact"
                      onClick={() => runActivity(activity)}
                    >
                      Играть
                    </button>
                    {canManageContent && (
                      <footer>
                        <button onClick={() => openEditActivity(activity)}>Изменить</button>
                        <button
                          aria-label={`Удалить игру ${activity.title}`}
                          onClick={() => deleteActivity(activity)}
                        >
                          Удалить
                        </button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-inline">Создайте свою игру из слов модуля.</p>
            )}
          </section>
        </>
      )}
      {activeTab === "games" && (
        <section className="saved-activities audio-activities">
          <div className="section-title">
            <div>
              <h2>Аудиотесты</h2>
              <p>
                Свои аудиозаписи и вопросы только для {languageName} · {level}.
              </p>
            </div>
            {canManageContent && (
              <button
                className="primary-button compact"
                onClick={() => {
                  setEditingAudio(undefined);
                  setAudioBuilderOpen(true);
                }}
              >
                <Icon name="plus" size={15} /> Создать тест
              </button>
            )}
          </div>
          {visibleAudioQuizzes.length ? (
            <div className="saved-activity-list">
              {visibleAudioQuizzes.map((quiz) => (
                <article key={quiz.id}>
                  <span className="activity-icon">
                    <Icon name="headphones" size={17} />
                  </span>
                  <div>
                    <strong>{quiz.title}</strong>
                    <small>
                      {quiz.questions.length} вопросов · {quiz.audioName}
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      window.location.hash = `#/games?audio=${encodeURIComponent(quiz.id)}`;
                    }}
                  >
                    Начать
                  </button>
                  {canManageContent && (
                    <>
                      <button
                        onClick={() => {
                          setEditingAudio(quiz);
                          setAudioBuilderOpen(true);
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        aria-label={`Удалить аудиотест ${quiz.title}`}
                        onClick={() => {
                          onAudioQuizzesChange((current) =>
                            current.filter((item) => item.id !== quiz.id),
                          );
                          if (quiz.audioMediaId)
                            void removeMediaFile(quiz.audioMediaId).catch(() => undefined);
                        }}
                      >
                        Удалить
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-inline">
              Загрузите аудио, задайте число вопросов и вариантов, затем отметьте верный ответ.
            </p>
          )}
        </section>
      )}
      {activeTab === "grammar" && (
        <div className="grammar-hub">
          <div className="practice-section-title">
            <div>
              <h2>
                Грамматика · {languageName} · {level}
              </h2>
              <p>Сначала правило и примеры, затем упражнения по теме.</p>
            </div>
            {canManageContent && (
              <button className="primary-button compact" onClick={() => openGrammarBuilder()}>
                <Icon name="plus" size={15} /> Создать тему
              </button>
            )}
          </div>
          <div className="grammar-tabs">
            <button
              className={grammarGroup === "basics" ? "active" : ""}
              onClick={() => setGrammarGroup("basics")}
            >
              Основы
            </button>
            <button
              className={grammarGroup === "sentences" ? "active" : ""}
              onClick={() => setGrammarGroup("sentences")}
            >
              Предложение
            </button>
          </div>
          <div className="grammar-grid">
            {builtinGrammarTopics.map((topic) => (
              <article className="custom-grammar-card" key={topic.id}>
                <button className="custom-grammar-start" onClick={() => onGrammar(topic)}>
                  <span>
                    <Icon name="brain" />
                  </span>
                  <strong>{topic.title}</strong>
                  <small>{topic.description}</small>
                  <Icon name="arrow" size={17} />
                </button>
                <footer></footer>
              </article>
            ))}
            {visibleCustomGrammar
              .filter((topic) => topic.group === grammarGroup)
              .map((topic) => (
                <article className="custom-grammar-card" key={topic.id}>
                  <button className="custom-grammar-start" onClick={() => onGrammar(topic)}>
                    <span>
                      <Icon name="brain" />
                    </span>
                    <strong>{topic.title}</strong>
                    <small>{topic.description}</small>
                    <Icon name="arrow" size={17} />
                  </button>
                  <footer>
                    {canManageContent && (
                      <>
                        <button onClick={() => openGrammarBuilder(topic)}>Изменить</button>
                        <button
                          onClick={() =>
                            setCustomGrammar((current) =>
                              current.filter((item) => item.id !== topic.id),
                            )
                          }
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </footer>
                </article>
              ))}
          </div>
          {!builtinGrammarTopics.length &&
            !visibleCustomGrammar.some((topic) => topic.group === grammarGroup) && (
              <p className="empty-inline">
                Для этого языка и уровня пока нет готовых тем. Добавьте свою тему кнопкой «Создать
                тему».
              </p>
            )}
        </div>
      )}
      {!selectedModule && activeTab === "games" && (
        <div className="empty-state cabinet-empty">
          <Icon name="library" size={32} />
          <h2>В этом кабинете пока пусто</h2>
          <p>
            Добавьте словарь в выбранном языке и уровне — задания будут строиться только по нему.
          </p>
        </div>
      )}
      {builderOpen && builderModule && canManageContent && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeActivityBuilder();
          }}
        >
          <section
            className="dialog-card activity-builder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-title"
          >
            <button className="dialog-close" onClick={closeActivityBuilder} aria-label="Закрыть">
              <Icon name="close" />
            </button>
            <p className="eyebrow">
              ИГРА · {builderModule.languageName} · {builderModule.level}
            </p>
            <h2 id="activity-title">{editingActivityId ? "Изменить игру" : "Создать игру"}</h2>
            <PandaNote title="Соберём своё приключение">
              Выберите механику, добавьте слова — и можно играть.
            </PandaNote>
            <div className="builder-steps" aria-label="Этапы создания игры">
              <span>
                <b>1</b> Формат
              </span>
              <span>
                <b>2</b> Слова
              </span>
              <span>
                <b>3</b> Запуск
              </span>
            </div>
            <div className="activity-builder-layout">
              <div className="activity-builder-config">
                <label className="field-label">
                  В каком модуле будет игра?
                  <select
                    value={builderModule.id}
                    onChange={(event) => changeBuilderModule(Number(event.target.value))}
                  >
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        Модуль {module.id} · {module.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Название
                  <input
                    value={activityTitle}
                    onChange={(event) => setActivityTitle(event.target.value)}
                  />
                </label>
                <div className="template-picker">
                  <div className="template-picker-heading">
                    <strong>Как будем играть?</strong>
                    <span>Выберите формат — справа появится пример экрана.</span>
                  </div>
                  <div className="template-picker-grid">
                    {builderGames.map((game) => (
                      <button
                        type="button"
                        key={game.id}
                        className={`template-choice ${activityGame === game.id ? "active" : ""}`}
                        onClick={() => setActivityGame(game.id)}
                        aria-pressed={activityGame === game.id}
                      >
                        <GameArtwork gameId={game.id} module={builderModule} />
                        <span>
                          <strong>{game.title}</strong>
                          <small>{game.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <section className="activity-extra-content">
                  <label className="field-label">
                    Инструкция или подсказка
                    <textarea
                      rows={2}
                      value={activityInstructions}
                      onChange={(event) => setActivityInstructions(event.target.value)}
                      placeholder="Например: слушайте слово и выберите его перевод."
                    />
                  </label>
                  <div className="activity-media-controls">
                    <input
                      ref={mediaFileInput}
                      type="file"
                      accept="image/*,audio/*,video/*"
                      onChange={(event) => void attachActivityFile(event.target.files?.[0])}
                    />
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => mediaFileInput.current?.click()}
                    >
                      Прикрепить картинку, аудио или видео
                    </button>
                    <label className="field-label">
                      Ссылка на видео или материал
                      <input
                        value={activityLinkDraft}
                        onChange={(event) => setActivityLinkDraft(event.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <button className="secondary-button" type="button" onClick={attachActivityLink}>
                      Добавить ссылку
                    </button>
                  </div>
                  {activityMedia && (
                    <div className="activity-attached-file">
                      <span>
                        <strong>{activityMedia.name}</strong>
                        <small>
                          {activityMedia.kind === "image"
                            ? "Изображение"
                            : activityMedia.kind === "audio"
                              ? "Аудио"
                              : activityMedia.kind === "video"
                                ? "Видео"
                                : "Внешняя ссылка"}
                        </small>
                      </span>
                      <button type="button" onClick={() => setActivityMedia(undefined)}>
                        Убрать
                      </button>
                    </div>
                  )}
                </section>
                <div className="card-presets">
                  <strong>Какие слова использовать?</strong>
                  {(["all", "pronoun", "noun", "verb"] as const).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      className={cardPreset === preset ? "active" : ""}
                      onClick={() => {
                        setCardPreset(preset);
                        setSelectedCardIds(
                          builderCards
                            .filter((card) => preset === "all" || card.partOfSpeech === preset)
                            .map((card) => card.id),
                        );
                      }}
                    >
                      {preset === "all"
                        ? "Все слова"
                        : preset === "pronoun"
                          ? "Местоимения"
                          : preset === "noun"
                            ? "Существительные"
                            : "Глаголы"}
                    </button>
                  ))}
                </div>
                <div className="activity-card-list">
                  {filteredCards.map((card) => (
                    <article className="activity-card-edit" key={card.id}>
                      <label className="activity-card-check">
                        <input
                          type="checkbox"
                          checked={selectedCardIds.includes(card.id)}
                          onChange={(event) =>
                            setSelectedCardIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, card.id])]
                                : current.filter((id) => id !== card.id),
                            )
                          }
                        />
                        <span>Включить в игру</span>
                      </label>
                      <label>
                        Слово
                        <input
                          value={card.word}
                          onChange={(event) =>
                            updateActivityCard(card.id, { word: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Перевод
                        <input
                          value={card.translation}
                          onChange={(event) =>
                            updateActivityCard(card.id, { translation: event.target.value })
                          }
                        />
                      </label>
                      {builderModule.languageCode === "de" && (
                        <label>
                          Артикль
                          <select
                            value={card.article ?? ""}
                            onChange={(event) =>
                              updateActivityCard(card.id, {
                                article: (event.target.value || null) as VocabCard["article"],
                              })
                            }
                          >
                            <option value="">Без артикля</option>
                            <option value="der">der</option>
                            <option value="die">die</option>
                            <option value="das">das</option>
                          </select>
                        </label>
                      )}
                      {activityGame === "fillblank" && (
                        <>
                          <label className="activity-sentence-field">
                            Предложение с пропуском
                            <input
                              value={card.exampleSentence ?? ""}
                              onChange={(event) =>
                                updateActivityCard(card.id, { exampleSentence: event.target.value })
                              }
                              placeholder={`На ${builderModule.languageName} «${card.translation || "перевод"}» — это „___“.`}
                            />
                            <small>Отметьте место ответа тремя подчёркиваниями: ___</small>
                          </label>
                          <label>
                            Какое слово вставить?
                            <input
                              value={card.sentenceAnswer ?? ""}
                              onChange={(event) =>
                                updateActivityCard(card.id, { sentenceAnswer: event.target.value })
                              }
                              placeholder={`${card.article ? `${card.article} ` : ""}${card.word || "слово"}`}
                            />
                          </label>
                        </>
                      )}
                      {activityGame === "picture" && (
                        <div className="activity-card-image-field">
                          <label>
                            Картинка
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                void attachCardImage(card.id, event.target.files?.[0])
                              }
                            />
                          </label>
                          {card.image && (
                            <>
                              <SavedImagePreview
                                image={card.image}
                                alt={`Иллюстрация для ${card.word}`}
                              />
                              <button
                                type="button"
                                className="text-danger"
                                onClick={() => updateActivityCard(card.id, { image: undefined })}
                              >
                                Убрать картинку
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        className="text-danger"
                        onClick={() => {
                          setActivityCards((current) =>
                            current.filter((item) => item.id !== card.id),
                          );
                          setSelectedCardIds((current) => current.filter((id) => id !== card.id));
                        }}
                      >
                        Убрать карточку
                      </button>
                    </article>
                  ))}
                  {!filteredCards.length && (
                    <p className="empty-inline">
                      В этом модуле пока нет карточек для выбранной группы.
                    </p>
                  )}
                </div>
                <button className="secondary-button add-card-button" onClick={addActivityCard}>
                  <Icon name="plus" size={15} /> Добавить свою пару «слово — перевод»
                </button>
              </div>
              <aside className="activity-preview-pane">
                <div className="activity-preview-heading">
                  <span>ПРЕДПРОСМОТР</span>
                  <strong>Пример игрового экрана</strong>
                  <small>Пары можно менять местами и редактировать прямо здесь.</small>
                </div>
                <LiveTemplatePreview
                  gameId={activityGame}
                  module={{
                    ...builderModule,
                    practiceInstructions: activityInstructions,
                    practiceMedia: activityMedia,
                  }}
                  cards={builderCards.filter((card) => selectedCardIds.includes(card.id))}
                  onEditCard={updateActivityCard}
                  onMoveCard={(cardId, direction) =>
                    setSelectedCardIds((current) => {
                      const index = current.indexOf(cardId);
                      const nextIndex = index + direction;
                      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
                      const next = [...current];
                      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
                      return next;
                    })
                  }
                />
                {activityMedia && (
                  <div className="activity-preview-attachment">
                    {activityMedia.kind === "image" && activityMediaUrl ? (
                      <img src={activityMediaUrl} alt={activityMedia.name} />
                    ) : activityMedia.kind === "audio" && activityMediaUrl ? (
                      <audio controls src={activityMediaUrl} />
                    ) : activityMedia.kind === "video" && activityMediaUrl ? (
                      <video controls src={activityMediaUrl} />
                    ) : activityMedia.kind === "link" ? (
                      <a href={activityMedia.url} target="_blank" rel="noreferrer">
                        Открыть прикреплённую ссылку ↗
                      </a>
                    ) : (
                      <small>{activityMedia.name}</small>
                    )}
                  </div>
                )}
              </aside>
            </div>
            <div className="activity-builder-footer">
              <span>
                {selectedCardIds.length} карточек · {builderModule.title}
                {activityGame === "fillblank"
                  ? ` · предложений готово ${selectedBuilderCards.filter((card) => card.exampleSentence?.trim() && card.exampleSentence.split("___").length === 2 && card.sentenceAnswer?.trim()).length}/${selectedCardIds.length}`
                  : activityGame === "picture"
                    ? ` · картинок ${selectedBuilderCards.filter((card) => card.image?.id).length}/${selectedCardIds.length}`
                    : ""}
              </span>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={closeActivityBuilder}>
                  Отмена
                </button>
                <button
                  className="primary-button"
                  disabled={
                    !activityTitle.trim() ||
                    !selectedCardIds.length ||
                    builderCards.some(
                      (card) =>
                        selectedCardIds.includes(card.id) &&
                        (!card.word.trim() || !card.translation.trim()),
                    ) ||
                    fillblankIncomplete ||
                    pictureIncomplete
                  }
                  onClick={saveActivity}
                >
                  Сохранить игру
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {audioBuilderOpen && canManageContent && (
        <AudioQuizBuilder
          initial={editingAudio}
          languageCode={languageCode}
          level={level}
          onSave={saveAudioQuiz}
          onCancel={() => {
            setAudioBuilderOpen(false);
            setEditingAudio(undefined);
          }}
        />
      )}
      {grammarBuilderOpen && grammarDraft && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setGrammarBuilderOpen(false);
              setGrammarDraft(null);
            }
          }}
        >
          <section
            className="dialog-card grammar-builder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grammar-builder-title"
          >
            <button
              className="dialog-close"
              onClick={() => {
                setGrammarBuilderOpen(false);
                setGrammarDraft(null);
              }}
              aria-label="Закрыть"
            >
              <Icon name="close" />
            </button>
            <p className="eyebrow">
              СВОЯ ГРАММАТИКА · {languageName} · {level}
            </p>
            <h2 id="grammar-builder-title">
              {customGrammar.some((topic) => topic.id === grammarDraft.id)
                ? "Изменить тему"
                : "Новая тема"}
            </h2>
            <label className="field-label">
              Название темы
              <input
                value={grammarDraft.title}
                onChange={(event) =>
                  setGrammarDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </label>
            <label className="field-label">
              Краткое описание
              <input
                value={grammarDraft.description}
                onChange={(event) =>
                  setGrammarDraft((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
              />
            </label>
            <label className="field-label">
              Раздел
              <select
                value={grammarDraft.group}
                onChange={(event) =>
                  setGrammarDraft((current) =>
                    current
                      ? { ...current, group: event.target.value as "basics" | "sentences" }
                      : current,
                  )
                }
              >
                <option value="basics">Основы</option>
                <option value="sentences">Предложение</option>
              </select>
            </label>
            <label className="field-label">
              Объяснение правила
              <textarea
                rows={3}
                value={grammarDraft.explanation}
                onChange={(event) =>
                  setGrammarDraft((current) =>
                    current ? { ...current, explanation: event.target.value } : current,
                  )
                }
              />
            </label>
            <label className="field-label">
              Примеры · каждый с новой строки
              <textarea
                rows={3}
                value={grammarDraft.examplesText}
                onChange={(event) =>
                  setGrammarDraft((current) =>
                    current ? { ...current, examplesText: event.target.value } : current,
                  )
                }
              />
            </label>
            <div className="grammar-draft-questions">
              <div className="section-title">
                <div>
                  <h3>Тестовые упражнения</h3>
                  <p>
                    В предложении используйте ___ для пропуска. Варианты разделяйте точкой с
                    запятой.
                  </p>
                </div>
              </div>
              {grammarDraft.questions.map((question, index) => (
                <article key={index}>
                  <strong>Упражнение {index + 1}</strong>
                  <label className="field-label">
                    Предложение
                    <input
                      value={question.prompt}
                      onChange={(event) =>
                        setGrammarDraft((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.map((item, questionIndex) =>
                                  questionIndex === index
                                    ? { ...item, prompt: event.target.value }
                                    : item,
                                ),
                              }
                            : current,
                        )
                      }
                      placeholder="Ich sehe ___ Hund."
                    />
                  </label>
                  <label className="field-label">
                    Варианты ответа
                    <input
                      value={question.optionsText}
                      onChange={(event) =>
                        setGrammarDraft((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.map((item, questionIndex) =>
                                  questionIndex === index
                                    ? { ...item, optionsText: event.target.value }
                                    : item,
                                ),
                              }
                            : current,
                        )
                      }
                      placeholder="den; der; dem"
                    />
                  </label>
                  <label className="field-label">
                    Правильный ответ
                    <input
                      value={question.answer}
                      onChange={(event) =>
                        setGrammarDraft((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.map((item, questionIndex) =>
                                  questionIndex === index
                                    ? { ...item, answer: event.target.value }
                                    : item,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="field-label">
                    Объяснение ответа
                    <input
                      value={question.explanation}
                      onChange={(event) =>
                        setGrammarDraft((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.map((item, questionIndex) =>
                                  questionIndex === index
                                    ? { ...item, explanation: event.target.value }
                                    : item,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  {grammarDraft.questions.length > 1 && (
                    <button
                      className="text-danger"
                      onClick={() =>
                        setGrammarDraft((current) =>
                          current
                            ? {
                                ...current,
                                questions: current.questions.filter(
                                  (_, questionIndex) => questionIndex !== index,
                                ),
                              }
                            : current,
                        )
                      }
                    >
                      Удалить упражнение
                    </button>
                  )}
                </article>
              ))}
            </div>
            <button
              className="secondary-button add-card-button"
              onClick={() =>
                setGrammarDraft((current) =>
                  current
                    ? {
                        ...current,
                        questions: [
                          ...current.questions,
                          { prompt: "", optionsText: "", answer: "", explanation: "" },
                        ],
                      }
                    : current,
                )
              }
            >
              <Icon name="plus" size={15} /> Добавить упражнение
            </button>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setGrammarBuilderOpen(false);
                  setGrammarDraft(null);
                }}
              >
                Отмена
              </button>
              <button
                className="primary-button"
                disabled={
                  !grammarDraft.title.trim() ||
                  !grammarDraft.explanation.trim() ||
                  grammarDraft.questions.some((question) => {
                    const options = question.optionsText
                      .split(";")
                      .map((option) => option.trim())
                      .filter(Boolean);
                    return (
                      !question.prompt.includes("___") ||
                      options.length < 2 ||
                      !options.includes(question.answer.trim()) ||
                      !question.explanation.trim()
                    );
                  })
                }
                onClick={saveGrammarTopic}
              >
                Сохранить тему
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function LiveTemplatePreview({
  gameId,
  module,
  cards,
  onEditCard,
  onMoveCard,
}: {
  gameId: GameId;
  module: VocabModule;
  cards: VocabCard[];
  onEditCard: (cardId: string, patch: Partial<VocabCard>) => void;
  onMoveCard: (cardId: string, direction: -1 | 1) => void;
}) {
  const card = cards[0] ?? module.cards[0];
  const word = card ? `${card.article ? `${card.article} ` : ""}${card.word}` : "Слово";
  const translation = card?.translation || "Перевод";
  const other = cards[1]?.translation ?? "Вариант 2";
  let task = "Выберите правильный ответ";
  let activity: ReactNode;
  if (gameId === "pairs" || gameId === "datajoin") {
    task = "Соедините слово и перевод";
    activity = cards.length ? (
      <div className="preview-pair-editor">
        {cards.map((item, index) => (
          <article key={item.id}>
            <div className="preview-pair-fields">
              <label>
                <small>Слово</small>
                <input
                  aria-label={`Слово ${index + 1}`}
                  value={`${item.article ? `${item.article} ` : ""}${item.word}`}
                  onChange={(event) => {
                    const value = event.target.value.trim().split(/\s+/);
                    const article = ["der", "die", "das"].includes(value[0]?.toLowerCase())
                      ? (value.shift() as VocabCard["article"])
                      : null;
                    onEditCard(item.id, { article, word: value.join(" ") });
                  }}
                />
              </label>
              <span aria-hidden="true">↔</span>
              <label>
                <small>Перевод</small>
                <input
                  aria-label={`Перевод ${index + 1}`}
                  value={item.translation}
                  onChange={(event) => onEditCard(item.id, { translation: event.target.value })}
                />
              </label>
            </div>
            <div className="preview-pair-order">
              <span>Пара {index + 1}</span>
              <button
                type="button"
                aria-label={`Переместить пару ${index + 1} выше`}
                disabled={index === 0}
                onClick={() => onMoveCard(item.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Переместить пару ${index + 1} ниже`}
                disabled={index === cards.length - 1}
                onClick={() => onMoveCard(item.id, 1)}
              >
                ↓
              </button>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="preview-pair-columns">
        <span>{word}</span>
        <span>{translation}</span>
        <span>{cards[1]?.word ?? "Слово 2"}</span>
        <span>{other}</span>
      </div>
    );
  } else if (gameId === "articles") {
    task = "Разложите слова по колонкам";
    activity = (
      <>
        <div className="preview-word-chip">
          {word} · {translation}
        </div>
        <div className="preview-columns">
          <span>der</span>
          <span>die</span>
          <span>das</span>
        </div>
      </>
    );
  } else if (gameId === "builder" || gameId === "train") {
    task = gameId === "train" ? "Соберите вагончики" : "Соберите словосочетание";
    activity = (
      <>
        <div className="preview-prompt">{translation}</div>
        <div className="preview-word-tiles">
          <span>{card?.article ?? "—"}</span>
          <span>{card?.word ?? "Слово"}</span>
        </div>
      </>
    );
  } else if (gameId === "hangman") {
    task = "Откройте слово по буквам";
    activity = (
      <>
        <div className="preview-prompt">{translation}</div>
        <div className="preview-blanks">_ _ _ _ _</div>
        <div className="preview-letters">
          A&nbsp; E&nbsp; I&nbsp; O&nbsp; U&nbsp; Ä&nbsp; Ö&nbsp; Ü
        </div>
      </>
    );
  } else if (gameId === "wordsearch") {
    task = "Найдите слово в сетке";
    activity = (
      <>
        <div className="preview-prompt">Найдите: {word}</div>
        <div className="preview-letter-grid">
          {[..."ABCEFGHIKLMNO"].map((letter, index) => (
            <i key={index}>{letter}</i>
          ))}
        </div>
      </>
    );
  } else if (gameId === "anagram") {
    task = "Соберите слово из букв";
    activity = (
      <>
        <div className="preview-prompt">{translation}</div>
        <div className="preview-word-tiles">
          <span>□</span>
          <span>□</span>
          <span>□</span>
          <span>□</span>
          <span>□</span>
        </div>
      </>
    );
  } else if (gameId === "moles") {
    task = "Нажмите на правильный перевод";
    activity = (
      <>
        <div className="preview-prompt">{word}</div>
        <div className="preview-answer-grid">
          <span>{translation}</span>
          <span>Вариант 2</span>
          <span>Вариант 3</span>
          <span>Вариант 4</span>
        </div>
      </>
    );
  } else if (gameId === "boxes") {
    task = "Откройте коробку с переводом";
    activity = (
      <>
        <div className="preview-prompt">{word}</div>
        <div className="preview-boxes">
          <i>?</i>
          <i>?</i>
          <i>?</i>
        </div>
      </>
    );
  } else if (gameId === "wheel") {
    task = "Колесо выбирает слово для перевода";
    activity = (
      <div className="preview-wheel-layout">
        <div className="preview-wheel-art">
          <span>{word}</span>
          <i>{cards[1]?.word ?? "Слово 2"}</i>
          <b>{cards[2]?.word ?? "Слово 3"}</b>
          <em>{cards[3]?.word ?? "Слово 4"}</em>
          <strong>Крутить</strong>
          <small aria-hidden="true">▼</small>
        </div>
        <div className="preview-wheel-selected">
          <small>ВЫПАЛО СЛОВО</small>
          <strong>{word}</strong>
          <span>Выберите перевод: {translation}</span>
        </div>
      </div>
    );
  } else if (gameId === "phonetic") {
    task = "Послушайте и выберите слово";
    activity = (
      <>
        <div className="preview-sound">♫</div>
        <div className="preview-answer-grid">
          <span>{word}</span>
          <span>Вариант 2</span>
        </div>
      </>
    );
  } else if (gameId === "fillblank") {
    task = "Выберите слово для пропуска";
    activity = card?.exampleSentence?.includes("___") ? (
      <>
        <div className="preview-sentence">
          {card.exampleSentence.split("___").map((part, index) => (
            <span key={index}>
              {part}
              {index === 0 && <b>{card.sentenceAnswer?.trim() || "___"}</b>}
            </span>
          ))}
        </div>
        <div className="preview-answer-grid">
          <span>{card.sentenceAnswer?.trim() || "ответ"}</span>
          <span>
            {cards[1]
              ? `${cards[1].article ? `${cards[1].article} ` : ""}${cards[1].word}`
              : "второй вариант"}
          </span>
        </div>
      </>
    ) : (
      <div className="preview-sentence-empty">
        Добавьте своё предложение с пропуском в настройках карточек.
      </div>
    );
  } else if (gameId === "picture") {
    task = "Какое слово подходит к картинке?";
    activity = (
      <div className="preview-picture-stage">
        {card?.image ? (
          <SavedImagePreview image={card.image} alt={`Картинка: ${word}`} />
        ) : (
          <span aria-hidden="true">🖼️</span>
        )}
        <div className="preview-answer-grid">
          <span>{word}</span>
          <span>
            {cards[1]
              ? `${cards[1].article ? `${cards[1].article} ` : ""}${cards[1].word}`
              : "Слово 2"}
          </span>
        </div>
      </div>
    );
  } else if (gameId === "finalsound") {
    task = "Как звучит последний согласный?";
    activity = (
      <>
        <div className="preview-prompt">{word}</div>
        <div className="preview-answer-grid">
          <span>п</span>
          <span>т</span>
          <span>к</span>
        </div>
      </>
    );
  } else {
    task = "Выберите верный вариант";
    activity = (
      <>
        <div className="preview-prompt">{word}</div>
        <div className="preview-answer-grid">
          <span>{translation}</span>
          <span>{other}</span>
        </div>
      </>
    );
  }
  return (
    <div className={`game-preview-card preview-${gameId === "wheel" ? "wheel-card" : gameId}`}>
      <div className="preview-game-top">
        <span className="preview-game-icon">
          {GAME_LIST.find((game) => game.id === gameId)?.mark}
        </span>
        <span>ВОПРОС 1 / {Math.max(1, cards.length)}</span>
        <span>★ 0</span>
      </div>
      <div className="preview-progress">
        <i />
      </div>
      <p>
        {task} · {module.languageName}
      </p>
      {module.practiceInstructions && (
        <p className="preview-custom-instruction">{module.practiceInstructions}</p>
      )}
      {activity}
      {module.practiceMedia && (
        <small className="preview-media-label">Прикреплено: {module.practiceMedia.name}</small>
      )}
      <button className="preview-check" type="button" tabIndex={-1}>
        Проверить ответ
      </button>
    </div>
  );
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function uniqueMaterialName(
  name: string,
  materials: Array<{ id: string; title: string }>,
  excludeId?: string,
) {
  const base = name.trim() || "Без названия";
  const taken = new Set([
    ...materials
      .filter((item) => item.id !== excludeId)
      .map((item) => item.title.trim().toLocaleLowerCase()),
    ...GRAMMAR_TOPICS.map((item) => item.title.trim().toLocaleLowerCase()),
  ]);
  if (!taken.has(base.toLocaleLowerCase())) return base;
  let number = 2;
  while (taken.has(`${base} (${number})`.toLocaleLowerCase())) number += 1;
  return `${base} (${number})`;
}
function german(card: VocabCard) {
  return `${card.article ? `${card.article} ` : ""}${card.word}`;
}
function SpeakablePrompt({ text, languageCode }: { text: string; languageCode: string }) {
  return (
    <div className="speakable-prompt">
      <h1>{text}</h1>
      <button
        type="button"
        aria-label={`Прослушать: ${text}`}
        title="Прослушать слово"
        onClick={() => speakText(text, speechLocaleForCode(languageCode))}
      >
        <Icon name="volume" size={22} />
      </button>
    </div>
  );
}
function germanOption(card: VocabCard, pool: VocabCard[]) {
  const duplicates = pool.filter(
    (item) =>
      item.id !== card.id && item.word.toLocaleLowerCase() === card.word.toLocaleLowerCase(),
  );
  return card.word.toLocaleLowerCase() === "sie" || duplicates.length > 0
    ? `${german(card)} (${card.translation})`
    : german(card);
}
function optionsFor(
  card: VocabCard,
  pool: VocabCard[],
  mode: "translation" | "word" | "article" | "sound",
  index: number,
) {
  if (mode === "article") return shuffle(["der", "die", "das"]);
  if (mode === "sound") return shuffle(["p", "t", "k"]);
  const key =
    mode === "translation"
      ? (item: VocabCard) => item.translation
      : (item: VocabCard) => germanOption(item, pool);
  const target = key(card);
  const distractors = pool.filter(
    (item) => item.id !== card.id && key(item).toLowerCase() !== target.toLowerCase(),
  );
  const start = distractors.length ? (index * 7) % distractors.length : 0;
  const rotated = [...distractors.slice(start), ...distractors.slice(0, start)];
  return shuffle([target, ...rotated.slice(0, 3).map(key)])
    .filter((value, i, all) => all.indexOf(value) === i)
    .slice(0, 4);
}
function norm(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s/g, "");
}

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function useCompletionSignal(
  completed: boolean,
  onComplete: (summary?: {
    score: number;
    total: number;
    timeLabel?: string;
    onReview?: () => void;
    onBackToResult?: () => void;
  }) => void,
  summary?: {
    score: number;
    total: number;
    timeLabel?: string;
    onReview?: () => void;
    onBackToResult?: () => void;
  },
) {
  const callback = useRef(onComplete);
  const fired = useRef(false);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  callback.current = onComplete;
  useEffect(() => {
    if (completed && !fired.current) {
      fired.current = true;
      callback.current(summaryRef.current);
    }
  }, [completed]);
}

export type AnswerTelemetry = {
  attemptCount: number;
  firstTryCorrect: boolean;
  hintUsed: boolean;
  durationMs: number;
  variantId?: string;
  skill?: string;
  recordProgress?: boolean;
  sessionTotal?: number;
};

export function GameSession({
  gameId,
  module,
  avoidMicrophone = false,
  onExit,
  onAnswer,
  onSkip = () => undefined,
  onComplete = () => undefined,
  onRestart,
  onNextGame,
}: {
  gameId: GameId;
  module: VocabModule;
  avoidMicrophone?: boolean;
  onExit: () => void;
  onAnswer: (
    card: VocabCard,
    correct: boolean,
    confusedWith?: string,
    telemetry?: AnswerTelemetry,
  ) => void;
  onSkip?: (card: VocabCard) => void;
  onComplete?: (totalRounds?: number) => void;
  onRestart?: () => void | boolean | Promise<void | boolean>;
  onNextGame?: () => void;
}) {
  const [runKey, setRunKey] = useState(0);
  const [muted, setMuted] = useState(() => {
    const s = readSpeechSettings();
    return s.enabled === false || s.provider === "none";
  });
  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      try {
        const raw = readProfileItem("linguaplay-speech-settings");
        const saved: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (next) {
          // muting: save current provider as _prevProvider, switch to "none"
          writeProfileItem(
            "linguaplay-speech-settings",
            JSON.stringify({ ...saved, enabled: false, _prevProvider: saved.provider ?? "edge", provider: "none" }),
          );
        } else {
          // unmuting: restore previous provider
          const restored = saved._prevProvider ?? "edge";
          writeProfileItem(
            "linguaplay-speech-settings",
            JSON.stringify({ ...saved, enabled: true, provider: restored }),
          );
        }
      } catch {}
      return next;
    });
  };
  const [resultPill, setResultPill] = useState<{
    score: number;
    total: number;
    timeLabel?: string;
    onReview?: () => void;
    isReviewing?: boolean;
    onBackToResult?: () => void;
  } | null>(null);

  const restart = async () => {
    setResultPill(null);
    const allowed = await onRestart?.();
    if (allowed === false) return;
    setRunKey((current) => current + 1);
  };

  const handleComplete = (
    summaryOrRounds?:
      | {
          score: number;
          total: number;
          timeLabel?: string;
          onReview?: () => void;
          isReviewing?: boolean;
          onBackToResult?: () => void;
        }
      | number,
  ) => {
    if (summaryOrRounds && typeof summaryOrRounds === "object") {
      setResultPill(summaryOrRounds);
      onComplete?.(summaryOrRounds.total);
    } else {
      onComplete?.(typeof summaryOrRounds === "number" ? summaryOrRounds : undefined);
    }
  };

  return (
    <>
      <ActivityMediaPanel module={module} />
      {gameId === "dialogue" || gameId === "quest" || gameId === "error-editor" ? (
        <ScenarioGame
          key={runKey}
          gameId={gameId as ScenarioGameId}
          module={module}
          onExit={onExit}
          onAnswer={onAnswer}
          onSkip={onSkip}
          onComplete={handleComplete}
          onNextGame={onNextGame}
        />
      ) : gameId === "pairs" || gameId === "datajoin" ? (
        <PairGame
          key={runKey}
          gameId={gameId}
          module={module}
          onExit={onExit}
          onRestart={restart}
          onAnswer={onAnswer}
          onComplete={handleComplete}
          onNextGame={onNextGame}
        />
      ) : gameId === "articles" ? (
        <ArticleSortGame
          key={runKey}
          module={module}
          onExit={onExit}
          onRestart={restart}
          onAnswer={onAnswer}
          onComplete={handleComplete}
          onNextGame={onNextGame}
        />
      ) : (
        <QuestionGame
          key={runKey}
          gameId={gameId}
          module={module}
          avoidMicrophone={avoidMicrophone}
          onExit={onExit}
          onRestart={restart}
          onAnswer={onAnswer}
          onSkip={onSkip}
          onComplete={handleComplete}
          onNextGame={onNextGame}
        />
      )}
      <button
        type="button"
        className={`game-mute-btn${muted ? " muted" : ""}`}
        onClick={toggleMute}
        title={muted ? "Включить озвучку" : "Выключить озвучку"}
        aria-label={muted ? "Включить озвучку" : "Выключить озвучку"}
      >
        {muted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
      {resultPill && (
        <div className="game-result-floating-pill" role="status" aria-live="polite">
          <div className="game-result-pill-info">
            <span
              className={`game-result-pill-badge ${resultPill.score === resultPill.total ? "star" : ""}`}
            >
              {resultPill.score === resultPill.total ? "★" : "✓"}
            </span>
            <div className="game-result-pill-details">
              <span className="game-result-pill-title">
                {resultPill.score} из {resultPill.total} правильно
              </span>
              {resultPill.timeLabel && (
                <span className="game-result-pill-subtitle">Время: {resultPill.timeLabel}</span>
              )}
            </div>
          </div>
          <div className="game-result-pill-actions">
            {resultPill.onReview && (
              <button
                type="button"
                className="btn-review"
                onClick={() => {
                  if (resultPill.isReviewing) {
                    resultPill.onBackToResult?.();
                    setResultPill((prev) => (prev ? { ...prev, isReviewing: false } : null));
                  } else {
                    resultPill.onReview?.();
                    setResultPill((prev) => (prev ? { ...prev, isReviewing: true } : null));
                  }
                }}
              >
                {resultPill.isReviewing ? "К результату →" : "← Посмотреть ответы"}
              </button>
            )}
            <button type="button" className="btn-restart" onClick={restart}>
              Сыграть заново
            </button>
            {onNextGame && (
              <button
                type="button"
                className="btn-next"
                onClick={() => {
                  setResultPill(null);
                  onNextGame();
                }}
              >
                Следующая игра →
              </button>
            )}
            <button
              type="button"
              className="btn-exit"
              onClick={() => {
                setResultPill(null);
                onExit();
              }}
            >
              К играм
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ActivityMediaPanel({ module }: { module: VocabModule }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const media = module.practiceMedia;
  useEffect(() => {
    let objectUrl = "";
    let alive = true;
    setSrc("");
    if (media?.id)
      void loadMediaFile(media.id)
        .then((blob) => {
          if (!alive || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        })
        .catch(() => undefined);
    else if (media?.url) setSrc(media.url);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media]);
  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [fullscreen]);
  if (!module.practiceInstructions && !media) return null;
  const youtubeId = (() => {
    if (!media?.url) return "";
    try {
      const url = new URL(media.url);
      return url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.hostname.includes("youtube.com")
          ? url.searchParams.get("v") || ""
          : "";
    } catch {
      return "";
    }
  })();
  return (
    <>
      <aside className={`game-attachment ${open ? "open" : ""}`}>
        <button className="game-attachment-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "Скрыть материалы" : "Материалы игры"}
          {media ? ` · ${media.kind === "link" ? "ссылка" : media.kind}` : ""}
        </button>
        {open && (
          <div className="game-attachment-content">
            {module.practiceInstructions && <p>{module.practiceInstructions}</p>}
            {media?.kind === "image" && src && (
              <button className="game-attachment-image" onClick={() => setFullscreen(true)}>
                <img src={src} alt={media.name} />
                <small>Открыть на весь экран</small>
              </button>
            )}
            {media?.kind === "audio" && src && <audio controls src={src} />}
            {media?.kind === "video" && src && <video controls playsInline src={src} />}
            {media?.kind === "link" &&
              src &&
              (youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`}
                  title={media.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <a href={src} target="_blank" rel="noreferrer">
                  {media.name} ↗
                </a>
              ))}
          </div>
        )}
      </aside>
      {fullscreen && src && media?.kind === "image" && (
        <div
          className="game-attachment-fullscreen"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFullscreen(false);
          }}
        >
          <button onClick={() => setFullscreen(false)}>Закрыть</button>
          <img src={src} alt={media.name} />
        </div>
      )}
    </>
  );
}

function ArticleSortGame({
  module,
  onExit,
  onRestart,
  onAnswer,
  onComplete,
  onNextGame,
}: {
  module: VocabModule;
  onExit: () => void;
  onRestart: () => void;
  onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void;
  onComplete: (summary?: { score: number; total: number; timeLabel?: string }) => void;
  onNextGame?: () => void;
}) {
  const cards = useMemo(
    () => shuffle(module.cards.filter((card) => card.article)),
    [module.id, module.cards],
  );
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const score = cards.filter((card) => placements[card.id] === card.article).length;
  useCompletionSignal(completed, onComplete, { score, total: cards.length, timeLabel });
  const dragId = useRef<string | null>(null);
  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);
  useEffect(() => {
    if (!submitted) return;
    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= cards.length) {
        window.clearInterval(timer);
        setCompleted(true);
        return;
      }
      const card = cards[index];
      const correct = placements[card.id] === card.article;
      answerRef.current(card, correct);
      playFeedbackSound(correct);
      setReveal(index + 1);
      index += 1;
      if (index === cards.length) window.setTimeout(() => setCompleted(true), 700);
    }, 650);
    return () => window.clearInterval(timer);
  }, [submitted, cards, placements]);
  const place = (cardId: string, article: string) => {
    if (submitted) return;
    setPlacements((current) => ({ ...current, [cardId]: article }));
    setSelected(null);
  };
  const returnToBank = (cardId: string) => {
    if (submitted) return;
    setPlacements((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
    setSelected(cardId);
  };
  const categories = ["der", "die", "das"] as const;
  if (completed)
    return (
      <div className="game-shell game-articles">
        <header className="game-topbar">
          <button onClick={onExit}>
            <Icon name="arrowLeft" /> Назад
          </button>
          <div>
            <span>СОРТИРОВКА АРТИКЛЕЙ</span>
            <strong>Время {timeLabel}</strong>
          </div>
          <div>
            ✓ {score}/{cards.length}
          </div>
        </header>
        <div className="game-result">
          <span className="result-medal">{score === cards.length ? "★" : "✓"}</span>
          <p className="eyebrow">ПРОВЕРКА ЗАВЕРШЕНА</p>
          <h1>
            {score} из {cards.length} правильно
          </h1>
          <p>Время: {timeLabel} · результат добавлен в прогресс.</p>
        </div>
      </div>
    );
  return (
    <div className="game-shell game-articles article-sort-shell">
      <header className="game-topbar">
        <button onClick={onExit}>
          <Icon name="arrowLeft" /> Назад
        </button>
        <div>
          <span>ГРУППИРОВКА РОДОВ</span>
          <strong>Время {timeLabel}</strong>
        </div>
        <strong className="sort-count">
          {Object.keys(placements).length}/{cards.length}
        </strong>
      </header>
      <main className="game-center article-sort">
        <div className="game-progress">
          <i style={{ width: `${(Object.keys(placements).length / cards.length) * 100}%` }} />
        </div>
        <p className="question-kicker">
          Перетащите слова в колонку нужного артикля. Возвратите карточку в поле слов или нажмите на
          неё, чтобы исправить выбор.
        </p>
        <h1>Распределите существительные</h1>
        <div
          className="sort-word-bank"
          aria-label="Слова для распределения"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragId.current) returnToBank(dragId.current);
            dragId.current = null;
          }}
        >
          {cards
            .filter((card) => !placements[card.id])
            .map((card) => (
              <button
                key={card.id}
                draggable={!submitted}
                className={selected === card.id ? "selected" : ""}
                onClick={() => setSelected(card.id)}
                onDragStart={() => {
                  dragId.current = card.id;
                }}
                onDragEnd={() => {
                  dragId.current = null;
                }}
              >
                {card.word}
                <small>{card.translation}</small>
              </button>
            ))}
          {Object.keys(placements).length === cards.length && (
            <span className="all-placed">Все слова распределены · карточку можно вернуть сюда</span>
          )}
        </div>
        <div className="article-buckets">
          {categories.map((article) => (
            <section
              key={article}
              className={`article-bucket ${article}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragId.current) place(dragId.current, article);
                dragId.current = null;
              }}
            >
              <h2>
                <span>{article}</span>
                <small>
                  {article === "der" ? "МУЖСКОЙ" : article === "die" ? "ЖЕНСКИЙ" : "СРЕДНИЙ"}
                </small>
              </h2>
              <div>
                {cards
                  .filter((card) => placements[card.id] === article)
                  .map((card) => {
                    const position = cards.indexOf(card);
                    const shown = submitted && reveal > position;
                    const correct = card.article === article;
                    return (
                      <article
                        key={card.id}
                        draggable={!submitted}
                        className={`${shown ? (correct ? "review-correct" : "review-wrong") : ""} placed-sort-card`}
                        onClick={() => returnToBank(card.id)}
                        onDragStart={() => {
                          dragId.current = card.id;
                        }}
                        onDragEnd={() => {
                          dragId.current = null;
                        }}
                      >
                        <strong>{card.word}</strong>
                        <small>{card.translation}</small>
                        <span>{shown ? (correct ? "✓" : `✕ ${card.article}`) : "↩ Вернуть"}</span>
                      </article>
                    );
                  })}
              </div>
              <button
                disabled={!selected || submitted}
                onClick={() => selected && place(selected, article)}
              >
                Переместить сюда
              </button>
            </section>
          ))}
        </div>
        {submitted && (
          <p className="sort-review-note">
            Проверяем слова по очереди · правильные ответы отмечены галочкой и звуком.
          </p>
        )}
      </main>
      <footer className="game-footer">
        <button
          className="primary-button"
          disabled={submitted || Object.keys(placements).length !== cards.length}
          onClick={() => setSubmitted(true)}
        >
          Завершить и проверить
        </button>
      </footer>
    </div>
  );
}

function PairGame({
  gameId,
  module,
  onExit,
  onRestart,
  onAnswer,
  onComplete,
  onNextGame,
}: {
  gameId: "pairs" | "datajoin";
  module: VocabModule;
  onExit: () => void;
  onRestart: () => void;
  onAnswer: (card: VocabCard, correct: boolean, confusedWith?: string) => void;
  onComplete: (summary?: { score: number; total: number; timeLabel?: string }) => void;
  onNextGame?: () => void;
}) {
  const cards = useMemo(() => {
    const unique = new Map<string, VocabCard>();
    module.cards.forEach((card) => {
      const key = card.translation.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, card);
    });
    return shuffle([...unique.values()].filter((card) => card.translation.trim())).slice(0, 10);
  }, [module.id]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [phase, setPhase] = useState<"intro" | "playing" | "checking" | "review">("intro");
  const [introStep, setIntroStep] = useState(0);
  const [selectedGerman, setSelectedGerman] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<
    Array<{ leftId: string; rightId: string; status?: "correct" | "wrong" }>
  >([]);
  const [reviewHistory, setReviewHistory] = useState<
    Record<number, Array<{ leftId: string; rightId: string; status: "correct" | "wrong" }>>
  >({});
  const [furthestRoundIndex, setFurthestRoundIndex] = useState(0);
  const [showFinalResult, setShowFinalResult] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const answerRef = useRef(onAnswer);
  const reviewPairsRef = useRef(matchedPairs);
  answerRef.current = onAnswer;
  const dragCard = useRef<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [connections, setConnections] = useState<
    Array<{
      id: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      status?: "correct" | "wrong";
    }>
  >([]);
  const [pairSize, setPairSize] = useState({ width: 1, height: 1 });
  const group = useMemo(() => cards.slice(groupIndex, groupIndex + 5), [cards, groupIndex]);
  const done = showFinalResult;
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  useCompletionSignal(done, onComplete, {
    score,
    total: cards.length,
    timeLabel,
    onReview: () => showRound(Math.max(0, cards.length - 5)),
    onBackToResult: () => setShowFinalResult(true),
  });
  const leftGroup = useMemo(() => shuffle(group), [cards, groupIndex]);
  const rightGroup = useMemo(() => shuffle(group), [cards, groupIndex]);
  useEffect(() => {
    if (done || phase !== "intro") return;
    let step = 0;
    const total = group.length * 2;
    const timer = window.setInterval(() => {
      step += 1;
      setIntroStep(step);
      playPairIntroTone(step - 1);
      if (step >= total) {
        window.clearInterval(timer);
        window.setTimeout(() => setPhase("playing"), 220);
      }
    }, 245);
    return () => window.clearInterval(timer);
  }, [done, phase, group.length, groupIndex]);
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "checking") return;
    let index = 0;
    const timer = window.setInterval(() => {
      const pairs = reviewPairsRef.current;
      if (index >= pairs.length) {
        window.clearInterval(timer);
        return;
      }
      const pair = pairs[index];
      const correct = pair.leftId === pair.rightId;
      const card = group.find((item) => item.id === pair.leftId);
      const answer = group.find((item) => item.id === pair.rightId);
      if (card) answerRef.current(card, correct, correct ? undefined : answer?.id);
      if (correct) setScore((value) => value + 1);
      playFeedbackSound(correct);
      setMatchedPairs((current) =>
        current.map((item, position) =>
          position === index ? { ...item, status: correct ? "correct" : "wrong" } : item,
        ),
      );
      setCheckedCount(index + 1);

      if (index === pairs.length - 1) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          const reviewed = pairs.map((p) => ({
            ...p,
            status: p.leftId === p.rightId ? ("correct" as const) : ("wrong" as const),
          }));
          setMatchedPairs(reviewed);
          setReviewHistory((current) => ({ ...current, [groupIndex]: reviewed }));
          setCheckedCount(reviewed.length);
          if (groupIndex + group.length >= cards.length) {
            setPhase("review");
            window.setTimeout(() => setShowFinalResult(true), 350);
          } else {
            const nextIndex = groupIndex + group.length;
            setFurthestRoundIndex((value) => Math.max(value, nextIndex));
            setGroupIndex(nextIndex);
            setMatchedPairs([]);
            setCheckedCount(0);
            setIntroStep(0);
            setPhase("intro");
          }
        }, 420);
        return;
      }

      index += 1;
    }, 420);
    return () => window.clearInterval(timer);
  }, [phase, group, groupIndex, cards.length]);
  useLayoutEffect(() => {
    const container = columnsRef.current;
    if (!container) return;
    const measure = () => {
      const bounds = container.getBoundingClientRect();
      setPairSize({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
      setConnections(
        matchedPairs.flatMap((pair) => {
          const left = leftRefs.current[pair.leftId]?.getBoundingClientRect();
          const right = rightRefs.current[pair.rightId]?.getBoundingClientRect();
          return left && right
            ? [
                {
                  id: pair.leftId,
                  startX: left.right - bounds.left,
                  startY: left.top + left.height / 2 - bounds.top,
                  endX: right.left - bounds.left,
                  endY: right.top + right.height / 2 - bounds.top,
                  status: pair.status,
                },
              ]
            : [];
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [matchedPairs, groupIndex, leftGroup, rightGroup, introStep]);
  const connectPair = (leftId: string, rightId: string) => {
    if (phase !== "playing") return;
    const left = group.find((item) => item.id === leftId);
    const right = group.find((item) => item.id === rightId);
    if (!left || !right) return;
    setMatchedPairs((current) => [
      ...current.filter((pair) => pair.leftId !== leftId && pair.rightId !== rightId),
      { leftId, rightId },
    ]);
    setSelectedGerman(null);
  };
  const chooseTranslation = (id: string) => {
    if (selectedGerman) connectPair(selectedGerman, id);
  };
  const submit = () => {
    if (phase !== "playing" || matchedPairs.length !== group.length) return;
    const ordered = [...matchedPairs].sort(
      (left, right) =>
        leftGroup.findIndex((card) => card.id === left.leftId) -
        leftGroup.findIndex((card) => card.id === right.leftId),
    );
    reviewPairsRef.current = ordered;
    setMatchedPairs(ordered);
    setSelectedGerman(null);
    setPhase("checking");
  };
  const showRound = (targetIndex: number) => {
    const saved = reviewHistory[targetIndex];
    setShowFinalResult(false);
    setGroupIndex(targetIndex);
    setMatchedPairs(saved ?? []);
    setCheckedCount(saved?.length ?? 0);
    setIntroStep(saved ? Math.min(10, cards.length - targetIndex) * 2 : 0);
    setSelectedGerman(null);
    setPhase(saved ? "review" : "intro");
  };
  const previousRound = () => showRound(Math.max(0, groupIndex - 5));
  const nextRound = () => {
    if (groupIndex + 5 >= cards.length) setShowFinalResult(true);
    else if (groupIndex + 5 <= furthestRoundIndex || reviewHistory[groupIndex + 5])
      showRound(groupIndex + 5);
  };
  const canBrowseRounds = phase === "review" || (phase === "playing" && matchedPairs.length === 0);
  const canGoPrevious = canBrowseRounds && groupIndex > 0 && Boolean(reviewHistory[groupIndex - 5]);
  const canGoNext =
    canBrowseRounds &&
    (groupIndex + 5 >= cards.length ||
      groupIndex + 5 <= furthestRoundIndex ||
      Boolean(reviewHistory[groupIndex + 5]));
  const remainingCount = group.length - matchedPairs.length;
  return (
    <div className={`game-shell game-${gameId}`}>
      <header className="game-topbar">
        <button onClick={onExit}>
          <Icon name="arrowLeft" /> Назад
        </button>
        <div>
          <span>{gameId === "datajoin" ? "DATA JOIN" : "МЭТЧИНГ ПАР"}</span>
          <strong>
            {score} / {cards.length} · {timeLabel}
          </strong>
        </div>
        <button onClick={onRestart}>
          Начать заново <Icon name="refresh" />
        </button>
      </header>
      {done ? (
        <div className="game-result">
          <span className="result-medal">✓</span>
          <p className="eyebrow">ИГРА ЗАВЕРШЕНА</p>
          <h1>
            Собрано пар: {score} из {cards.length}
          </h1>
          <p>Время: {timeLabel} · пары проверялись по очереди.</p>
        </div>
      ) : (
        <>
          <main className="game-center pair-game">
            <p className="question-kicker">
              {phase === "intro"
                ? "Запоминайте карточки — сейчас они появятся слева направо."
                : phase === "checking"
                  ? "Проверяем пары по порядку…"
                  : phase === "review"
                    ? "Этот раунд проверен. Можно просмотреть соседние раунды."
                    : "Соедините немецкое слово с переводом. Перетаскивайте или нажмите сначала слово, затем перевод. Ответы откроются после проверки."}
            </p>
            <div className="pair-game-status">
              <span>
                {phase === "intro"
                  ? "ПОДГОТОВКА"
                  : phase === "checking"
                    ? `ПРОВЕРКА ${Math.min(checkedCount + 1, group.length)} / ${group.length}`
                    : phase === "review"
                      ? "РАУНД ПРОВЕРЕН"
                      : `ВРЕМЯ ${timeLabel}`}
              </span>
              <strong>{score} правильных</strong>
            </div>
            <div className="pair-round-nav">
              <button
                aria-label="Предыдущий раунд"
                disabled={!canGoPrevious}
                onClick={previousRound}
              >
                ←
              </button>
              <span>
                Раунд {Math.floor(groupIndex / 5) + 1} из {Math.ceil(cards.length / 5)}
              </span>
              <button aria-label="Следующий раунд" disabled={!canGoNext} onClick={nextRound}>
                →
              </button>
            </div>
            <div className="pair-columns" ref={columnsRef}>
              <svg
                className="pair-connection-layer"
                viewBox={`0 0 ${pairSize.width} ${pairSize.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="pair-arrow-pending"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" />
                  </marker>
                  <marker
                    id="pair-arrow-correct"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" />
                  </marker>
                  <marker
                    id="pair-arrow-wrong"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" />
                  </marker>
                </defs>
                {connections.map((line) => (
                  <path
                    className={`pair-link ${line.status ? `pair-link-${line.status}` : ""}`}
                    key={line.id}
                    d={`M ${line.startX} ${line.startY} C ${line.startX + 48} ${line.startY}, ${line.endX - 48} ${line.endY}, ${line.endX} ${line.endY}`}
                    markerEnd={`url(#pair-arrow-${line.status ?? "pending"})`}
                  />
                ))}
              </svg>
              <div>
                <h2>{module.languageName}</h2>
                {leftGroup.map((card, index) => {
                  const shown = phase !== "intro" || introStep > index;
                  const pair = matchedPairs.find((item) => item.leftId === card.id);
                  return (
                    <button
                      key={card.id}
                      ref={(element) => {
                        leftRefs.current[card.id] = element;
                      }}
                      data-pair-left={card.id}
                      draggable={phase === "playing"}
                      className={`pair-word-tile ${selectedGerman === card.id ? "chosen" : ""} ${pair ? "paired" : ""} ${pair?.status ? `pair-${pair.status}` : ""} ${!shown ? "pair-reveal-hidden" : phase === "intro" ? "pair-reveal-in" : ""}`}
                      disabled={phase !== "playing" || !shown}
                      onClick={() => {
                        speakText(german(card), speechLocaleForCode(module.languageCode));
                        setSelectedGerman((value) => (value === card.id ? null : card.id));
                      }}
                      onDragStart={() => {
                        dragCard.current = card.id;
                      }}
                      onDragEnd={() => {
                        dragCard.current = null;
                      }}
                      onDragOver={(event) => event.preventDefault()}
                    >
                      {german(card)}
                      <span className="pair-speak-mark" aria-hidden="true">
                        ♫
                      </span>
                      {pair?.status && (
                        <span
                          className={`pair-result-pop ${pair.status}`}
                          key={`${pair.leftId}-${pair.status}`}
                          aria-hidden="true"
                        >
                          {pair.status === "correct" ? "✓" : "×"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div>
                <h2>Перевод на русский</h2>
                {rightGroup.map((card, index) => {
                  const shown = phase !== "intro" || introStep > group.length + index;
                  const pair = matchedPairs.find((item) => item.rightId === card.id);
                  return (
                    <button
                      key={card.id}
                      ref={(element) => {
                        rightRefs.current[card.id] = element;
                      }}
                      data-pair-right={card.id}
                      draggable={false}
                      className={`pair-word-tile ${selectedGerman && phase === "playing" ? "drop-ready" : ""} ${pair ? "paired" : ""} ${pair?.status ? `pair-${pair.status}` : ""} ${!shown ? "pair-reveal-hidden" : phase === "intro" ? "pair-reveal-in" : ""}`}
                      disabled={phase !== "playing" || !shown}
                      onClick={() => chooseTranslation(card.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragCard.current) connectPair(dragCard.current, card.id);
                        dragCard.current = null;
                      }}
                    >
                      {card.translation}
                      {pair?.status && (
                        <span
                          className={`pair-result-pop ${pair.status}`}
                          key={`${pair.leftId}-${pair.status}`}
                          aria-hidden="true"
                        >
                          {pair.status === "correct" ? "✓" : "×"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </main>
          <footer className="game-footer pair-game-footer">
            <span>
              {phase === "intro"
                ? "Карточки показываются по очереди"
                : phase === "checking"
                  ? "Верные и ошибочные пары отмечаются под звук"
                  : phase === "review"
                    ? "Ответы сохраняются, пока вы не выйдете из игры"
                    : remainingCount
                      ? `Соединено ${matchedPairs.length} из ${group.length} · можно менять пары до проверки`
                      : "Все пары соединены · нажмите проверить"}
            </span>
            <button
              className="primary-button"
              disabled={phase !== "playing" || remainingCount > 0}
              onClick={submit}
            >
              {phase === "checking" ? "Проверяем…" : "Проверить пары"}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function QuestionGame({
  gameId,
  module,
  avoidMicrophone = false,
  onExit,
  onRestart,
  onAnswer,
  onSkip,
  onComplete,
  onNextGame,
}: {
  gameId: GameId;
  module: VocabModule;
  avoidMicrophone?: boolean;
  onExit: () => void;
  onRestart: () => void;
  onAnswer: (
    card: VocabCard,
    correct: boolean,
    confusedWith?: string,
    telemetry?: AnswerTelemetry,
  ) => void;
  onSkip: (card: VocabCard) => void;
  onComplete: (summary?: { score: number; total: number; timeLabel?: string }) => void;
  onNextGame?: () => void;
}) {
  const eligible = module.cards.filter((card) =>
    gameId === "picture"
      ? Boolean(card.image?.id)
      : gameId === "fillblank"
        ? Boolean(card.exampleSentence?.split("___").length === 2 && card.sentenceAnswer?.trim())
        : gameId === "sentenceorder"
          ? Boolean(card.exampleSentence?.trim())
          : gameId === "finalsound"
            ? /[bdg]$/i.test(card.word.normalize("NFC"))
            : gameId === "wordsearch"
              ? /^[\p{L}]{4,9}$/iu.test(card.word.normalize("NFC"))
              : gameId === "anagram"
                ? /^[\p{L}]{4,14}$/iu.test(card.word.normalize("NFC"))
                : gameId === "articles" || gameId === "train"
                  ? Boolean(card.article)
                  : true,
  );
  const rounds = useMemo(() => {
    let recent: Array<{ gameId: string; moduleId: number; ids: string[] }> = [];
    try {
      const saved: unknown = JSON.parse(readProfileItem("linguaplay-recent-game-sessions") || "[]");
      if (Array.isArray(saved))
        recent = saved.filter(
          (entry): entry is { gameId: string; moduleId: number; ids: string[] } =>
            Boolean(
              entry &&
              typeof entry === "object" &&
              typeof (entry as { gameId?: unknown }).gameId === "string" &&
              Number.isInteger((entry as { moduleId?: unknown }).moduleId) &&
              Array.isArray((entry as { ids?: unknown }).ids),
            ),
        );
    } catch {
      recent = [];
    }
    const previousIds = new Set(
      recent
        .filter((entry) => entry.gameId === gameId && entry.moduleId === module.id)
        .slice(-3)
        .flatMap((entry) => entry.ids),
    );
    const unseen = eligible.filter((item) => !previousIds.has(item.id));
    const pool = unseen.length >= Math.min(10, eligible.length) ? unseen : eligible;
    return shuffle(pool).slice(0, Math.min(10, pool.length));
  }, [module.id, gameId]);
  const [roundQueue, setRoundQueue] = useState<VocabCard[]>(rounds);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [lives, setLives] = useState(0);
  const [spun, setSpun] = useState(false);
  const [wheelCard, setWheelCard] = useState<VocabCard | null>(null);
  const [wheelSelectedIndex, setWheelSelectedIndex] = useState<number | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [sentenceOrder, setSentenceOrder] = useState<string[]>([]);
  const [feedbackNonce, setFeedbackNonce] = useState(0);
  const sentenceDragId = useRef<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const answerAttempts = useRef<
    Record<
      string,
      { attempts: number; firstTryCorrect: boolean; hintUsed: boolean; durationMs: number }
    >
  >({});
  const historySaved = useRef(false);
  const roundStartedAt = useRef(Date.now());
  const card = wheelCard ?? roundQueue[index] ?? module.cards[0];
  const done = index >= roundQueue.length;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [done]);
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  useCompletionSignal(done, onComplete, { score, total: rounds.length, timeLabel });
  useEffect(() => {
    if (!done || !rounds.length || historySaved.current) return;
    historySaved.current = true;
    let previous: Array<{ gameId: string; moduleId: number; ids: string[] }> = [];
    try {
      const saved: unknown = JSON.parse(readProfileItem("linguaplay-recent-game-sessions") || "[]");
      if (Array.isArray(saved)) previous = saved as typeof previous;
    } catch {
      previous = [];
    }
    writeProfileItem(
      "linguaplay-recent-game-sessions",
      JSON.stringify([
        ...previous.slice(-29),
        { gameId, moduleId: module.id, ids: rounds.map((item) => item.id) },
      ]),
    );
  }, [done, gameId, module.id, rounds]);
  const answerMode =
    gameId === "phonetic" || gameId === "picture" || gameId === "fillblank"
      ? "word"
      : gameId === "articles"
        ? "article"
        : gameId === "finalsound"
          ? "sound"
          : "translation";
  const choices = useMemo(() => {
    if (!card) return [];
    if (gameId === "fillblank") {
      const answer = card.sentenceAnswer?.trim() || german(card);
      const distractors = [
        ...new Set(
          module.cards
            .filter((item) => item.id !== card.id)
            .map(german)
            .filter((value) => norm(value) !== norm(answer)),
        ),
      ];
      return shuffle([answer, ...shuffle(distractors).slice(0, 3)]);
    }
    return optionsFor(card, module.cards, answerMode, index);
  }, [card, module.id, answerMode, index, gameId]);
  const boxOptions = useMemo(() => {
    if (!card) return [];
    const unique = new Map<string, VocabCard>();
    module.cards.forEach((item) => {
      if (item.translation.trim()) unique.set(item.translation.toLocaleLowerCase(), item);
    });
    const distractors = [...unique.values()].filter((item) => item.id !== card.id);
    return shuffle([card, ...shuffle(distractors).slice(0, 3)]);
  }, [card?.id, module.id, index]);
  const moleChoices = useMemo(() => {
    if (!card) return [];
    const uniqueTranslations = [
      ...new Set(
        module.cards
          .map((item) => item.translation)
          .filter((value) => value.toLocaleLowerCase() !== card.translation.toLocaleLowerCase()),
      ),
    ];
    return shuffle([card.translation, ...shuffle(uniqueTranslations).slice(0, 8)]);
  }, [card?.id, module.id, index]);
  const finishAnswer = (correct: boolean) => {
    if (!card || feedback) return;
    playFeedbackSound(correct);
    const confusedWith =
      !correct && chosen.length
        ? module.cards.find((item) => item.translation === chosen[0] || german(item) === chosen[0])
            ?.id
        : undefined;
    const previous = answerAttempts.current[card.id] ?? {
      attempts: 0,
      firstTryCorrect: false,
      hintUsed: false,
      durationMs: 0,
    };
    const attempts = previous.attempts + 1;
    const firstTryCorrect = attempts === 1 ? correct : previous.firstTryCorrect;
    const durationMs = Math.max(0, Date.now() - roundStartedAt.current);
    answerAttempts.current[card.id] = {
      ...previous,
      attempts,
      firstTryCorrect,
      durationMs: previous.durationMs + durationMs,
    };
    setFeedback(correct ? "correct" : "wrong");
    setFeedbackNonce((value) => value + 1);
    if (attempts === 1 && correct) setScore((value) => value + 1);
    onAnswer(card, correct, confusedWith, {
      attemptCount: attempts,
      firstTryCorrect,
      hintUsed: previous.hintUsed,
      durationMs,
    });
  };
  const advanceRound = () => {
    if (!feedback) return;
    if (feedback === "wrong" && card && (answerAttempts.current[card.id]?.attempts ?? 0) === 1)
      setRoundQueue((current) => [...current, card]);
    setFeedback(null);
    setHintVisible(false);
    setIndex((value) => value + 1);
    roundStartedAt.current = Date.now();
    setChosen([]);
    setLetters([]);
    setLives(0);
    setSpun(false);
    setWheelCard(null);
    setWheelSelectedIndex(null);
  };
  const startSpeech = () => {
    const browserWindow = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const Speech = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Speech) {
      setSpeechMessage("В этом браузере нет распознавания речи. Ответьте кнопками ниже.");
      return;
    }
    setSpeechMessage(
      `Скажите слово на ${languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} после сигнала браузера.`,
    );
    const recognition = new Speech();
    recognition.lang = speechLocaleForCode(module.languageCode);
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setSpeechMessage(`Распознано: «${heard}»`);
      finishAnswer(norm(heard).replace(/^(der|die|das)/, "") === norm(card.word));
    };
    recognition.onerror = (event) => {
      setSpeechMessage(`Речь не распознана (${event.error}). Можно выбрать ответ кнопкой.`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setSpeechMessage("Не удалось включить микрофон. Проверьте разрешение браузера.");
    }
  };
  useEffect(() => {
    setRoundQueue(rounds);
    setIndex(0);
    setScore(0);
    setFeedback(null);
  }, [rounds]);
  useEffect(() => {
    setChosen([]);
    setLetters([]);
    setLives(0);
    setSpun(false);
    setWheelCard(null);
    setWheelSpinning(false);
    setTypedAnswer("");
    setSentenceOrder([]);
  }, [index]);
  useEffect(() => {
    setSpeechMessage("");
    setListening(false);
  }, [index]);
  const targetWord =
    card?.word
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}]/gu, "") ?? "";
  const alphabet = [...new Set([...[..."abcdefghijklmnopqrstuvwxyz"], ...[...targetWord]])];
  const scrambled = useMemo(() => shuffle([...targetWord]), [card.id, targetWord]);
  const nounTiles = useMemo(
    () =>
      shuffle(
        [card.article || "", card.word, card.article === "der" ? "die" : "der"].filter(Boolean),
      ),
    [card.id],
  );
  const sentenceTokens = useMemo(() => {
    const source =
      card.exampleSentence?.trim().replace("___", card.sentenceAnswer?.trim() || german(card)) ||
      "";
    return source
      .split(/\s+/u)
      .filter(Boolean)
      .map((token, index) =>
        index === 0
          ? token.replace(
              /^([^\p{L}]*)(\p{L})/u,
              (_whole, prefix: string, letter: string) =>
                `${prefix}${letter.toLocaleLowerCase(module.languageCode)}`,
            )
          : token,
      );
  }, [card.id, module.languageCode]);
  const sentenceChoices = useMemo(
    () => shuffle(sentenceTokens.map((token, index) => ({ id: String(index), token }))),
    [card.id, sentenceTokens],
  );
  const wheelEntries = useMemo(
    () => shuffle(module.cards).slice(0, Math.min(6, module.cards.length)),
    [module.id, module.cards],
  );
  const builderOptions = useMemo(() => shuffle([card.word, "der", "die", "das"]), [card.id]);
  const answerResults = Object.values(answerAttempts.current);
  const answeredCount = answerResults.filter((item) => item.attempts > 0).length;
  const firstTryErrors = answerResults.filter(
    (item) => item.attempts > 0 && !item.firstTryCorrect,
  ).length;
  const retryCount = answerResults.filter((item) => item.attempts > 1).length;
  const skippedCount = new Set(
    rounds.filter((item) => !answerAttempts.current[item.id]?.attempts).map((item) => item.id),
  ).size;
  const finishEarly = () => {
    const unanswered = new Map<string, VocabCard>();
    roundQueue.slice(index).forEach((item) => {
      if (!answerAttempts.current[item.id]?.attempts) unanswered.set(item.id, item);
    });
    unanswered.forEach(onSkip);
    setIndex(roundQueue.length);
  };
  if (done || !card)
    return (
      <div className="game-shell">
        <header className="game-topbar">
          <button onClick={onExit}>
            <Icon name="arrowLeft" /> Назад
          </button>
          <span>Результат</span>
          <span />
        </header>
        <div className="game-result">
          <span className="result-medal">
            {score >= Math.max(1, rounds.length) * 0.7 ? "★" : "✓"}
          </span>
          <p className="eyebrow">ИГРА ЗАВЕРШЕНА</p>
          <h1>
            {score} из {answeredCount} ответов с первого раза
          </h1>
          <p>
            Новых вопросов: {rounds.length} · ошибки с первой попытки: {firstTryErrors} · повторов:{" "}
            {retryCount} · без ответа: {skippedCount}. Результат первой попытки сохранён отдельно.
          </p>
        </div>
      </div>
    );
  const expectedNoun = [card.article, card.word].filter(Boolean) as string[];
  const pickedNoun = chosen;
  const renderChoiceButtons = (items: string[], correct: string) => (
    <div className="game-choice-grid">
      {items.map((item, i) => (
        <button
          key={`${item}-${i}`}
          disabled={Boolean(feedback)}
          className={
            feedback && item === correct
              ? "correct"
              : feedback && chosen.includes(item) && norm(item) !== norm(correct)
                ? "wrong"
                : chosen.includes(item)
                  ? "chosen"
                  : ""
          }
          onClick={() => {
            setChosen([item]);
            finishAnswer(norm(item) === norm(correct));
          }}
        >
          <kbd>{i + 1}</kbd>
          {item}
        </button>
      ))}
    </div>
  );
  const placeSentenceToken = (id: string, beforeId?: string) => {
    if (feedback) return;
    const next = sentenceOrder.filter((item) => item !== id);
    const insertionIndex = beforeId ? next.indexOf(beforeId) : -1;
    next.splice(insertionIndex < 0 ? next.length : insertionIndex, 0, id);
    setSentenceOrder(next);
    setChosen(next.map((item) => sentenceTokens[Number(item)]));
    if (next.length === sentenceTokens.length)
      finishAnswer(next.every((item, position) => Number(item) === position));
  };
  let content;
  if (gameId === "articles")
    content = (
      <>
        <p className="question-kicker">Выберите артикль</p>
        <SpeakablePrompt text={card.word} languageCode={module.languageCode} />
        {renderChoiceButtons(["der", "die", "das"], card.article || "")}
      </>
    );
  else if (gameId === "fillblank") {
    const sentence =
      card.exampleSentence?.trim() ||
      `На ${module.languageName} «${card.translation}» — это „___“.`;
    const expected = card.sentenceAnswer?.trim() || german(card);
    const parts = sentence.split("___");
    content = (
      <>
        <p className="question-kicker">Выберите слово, которое подходит по смыслу</p>
        <div className="fillblank-sentence">
          {parts.map((part, partIndex) => (
            <span key={partIndex}>
              {part}
              {partIndex === 0 && (
                <button
                  className={`fillblank-slot ${chosen.length ? "filled" : ""} ${feedback ? feedback : ""}`}
                  disabled={Boolean(feedback)}
                  onClick={() => setChosen([])}
                >
                  {chosen[0] || "Выберите слово"}
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="fillblank-options">
          {choices.map((item, optionIndex) => (
            <button
              key={`${item}-${optionIndex}`}
              disabled={Boolean(feedback)}
              className={
                feedback && norm(item) === norm(expected)
                  ? "correct"
                  : feedback && chosen[0] === item
                    ? "wrong"
                    : chosen[0] === item
                      ? "chosen"
                      : ""
              }
              onClick={() => {
                setChosen([item]);
                finishAnswer(norm(item) === norm(expected));
              }}
            >
              <kbd>{optionIndex + 1}</kbd>
              {item}
            </button>
          ))}
        </div>
      </>
    );
  } else if (gameId === "picture")
    content = (
      <>
        <p className="question-kicker">Какое слово изображено?</p>
        <SavedImagePreview image={card.image} alt={`Изображение к заданию ${index + 1}`} />
        <div className="picture-game-options">
          {choices.map((item, optionIndex) => (
            <button
              key={`${item}-${optionIndex}`}
              disabled={Boolean(feedback)}
              className={
                feedback && norm(item) === norm(germanOption(card, module.cards))
                  ? "correct"
                  : feedback && chosen.includes(item)
                    ? "wrong"
                    : chosen.includes(item)
                      ? "chosen"
                      : ""
              }
              onClick={() => {
                setChosen([item]);
                finishAnswer(norm(item) === norm(germanOption(card, module.cards)));
              }}
            >
              <kbd>{optionIndex + 1}</kbd>
              {item}
            </button>
          ))}
        </div>
      </>
    );
  else if (gameId === "sentenceorder")
    content = (
      <>
        <p className="question-kicker">
          Перетащите слова в правильном порядке или нажимайте их по очереди
        </p>
        <h1>{card.translation}</h1>
        <div
          className="sentence-order-built"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (sentenceDragId.current) placeSentenceToken(sentenceDragId.current);
            sentenceDragId.current = null;
          }}
        >
          <span className="sentence-order-label">Ваше предложение</span>
          {sentenceOrder.map((id, position) => {
            const token = sentenceTokens[Number(id)];
            const displayed =
              feedback && position === 0
                ? token.replace(
                    /^(\P{L}*)(\p{L})/u,
                    (_whole, prefix: string, letter: string) =>
                      `${prefix}${letter.toLocaleUpperCase(module.languageCode)}`,
                  )
                : token;
            return (
              <button
                key={`${id}-${position}`}
                draggable={!feedback}
                onClick={() =>
                  !feedback &&
                  setSentenceOrder((current) => current.filter((_, index) => index !== position))
                }
                onDragStart={() => {
                  sentenceDragId.current = id;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.stopPropagation();
                  if (sentenceDragId.current) placeSentenceToken(sentenceDragId.current, id);
                  sentenceDragId.current = null;
                }}
              >
                {displayed}
              </button>
            );
          })}
          {!sentenceOrder.length && <small>Нажмите или перетащите слова сюда</small>}
        </div>
        <div className="sentence-order-options">
          {sentenceChoices
            .filter((item) => !sentenceOrder.includes(item.id))
            .map((item) => (
              <button
                key={item.id}
                disabled={Boolean(feedback)}
                draggable={!feedback}
                onClick={() => placeSentenceToken(item.id)}
                onDragStart={() => {
                  sentenceDragId.current = item.id;
                }}
                onDragEnd={() => {
                  sentenceDragId.current = null;
                }}
              >
                {item.token}
              </button>
            ))}
        </div>
      </>
    );
  else if (gameId === "moles")
    content = (
      <>
        <p className="question-kicker">Ударьте по переводу слова</p>
        <SpeakablePrompt text={german(card)} languageCode={module.languageCode} />
        <div className="mole-grid">
          {moleChoices.map((item, i) => (
            <button
              key={`${item}-${i}`}
              disabled={Boolean(feedback)}
              className={
                feedback && item === card.translation
                  ? "correct"
                  : feedback && chosen.includes(item)
                    ? "wrong"
                    : ""
              }
              onClick={() => {
                setChosen([item]);
                finishAnswer(item === card.translation);
              }}
            >
              <span aria-hidden="true">🐹</span>
              <small>{item}</small>
            </button>
          ))}
        </div>
      </>
    );
  else if (gameId === "blitz" || gameId === "phonetic")
    content = (
      <>
        <p className="question-kicker">
          {gameId === "phonetic"
            ? `Прослушайте слово на ${languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()} и выберите услышанное`
            : "Выберите правильный перевод"}
        </p>
        {gameId === "phonetic" && (
          <div className="phonetic-controls">
            <button
              className="listen-button"
              onClick={() => speakText(card.word, speechLocaleForCode(module.languageCode))}
            >
              <Icon name="volume" /> Прослушать слово
            </button>
            {!avoidMicrophone && (
              <button
                className={`listen-button ${listening ? "recording" : ""}`}
                onClick={() => (listening ? recognitionRef.current?.stop() : startSpeech())}
              >
                <span className="mic-dot" />
                {listening ? "Слушаю…" : "Произнести самому"}
              </button>
            )}
          </div>
        )}
        {gameId === "phonetic" ? (
          <h1>Какое слово вы услышали?</h1>
        ) : (
          <SpeakablePrompt text={german(card)} languageCode={module.languageCode} />
        )}
        {gameId === "phonetic" && speechMessage && (
          <p className="speech-message">{speechMessage}</p>
        )}
        {gameId === "phonetic" ? (
          <div className="phonetic-choice-grid">
            {choices.map((item, i) => (
              <div className="phonetic-choice" key={`${item}-${i}`}>
                <button
                  className="phonetic-choice-audio"
                  aria-label={`Прослушать ${item}`}
                  onClick={() => speakText(item, speechLocaleForCode(module.languageCode))}
                >
                  <Icon name="volume" size={17} />
                </button>
                <button
                  disabled={Boolean(feedback)}
                  className={
                    feedback && item === germanOption(card, module.cards)
                      ? "correct"
                      : feedback && chosen.includes(item)
                        ? "wrong"
                        : chosen.includes(item)
                          ? "chosen"
                          : ""
                  }
                  onClick={() => {
                    setChosen([item]);
                    finishAnswer(norm(item) === norm(germanOption(card, module.cards)));
                  }}
                >
                  {item}
                </button>
              </div>
            ))}
          </div>
        ) : (
          renderChoiceButtons(choices, card.translation)
        )}
      </>
    );
  else if (gameId === "builder")
    content = (
      <>
        <p className="question-kicker">Соберите немецкую именную группу</p>
        <h1>{card.translation}</h1>
        <div className="labeled-builder-slots">
          <div>
            <small>Артикль</small>
            <button onClick={() => setChosen((value) => value.filter((_, index) => index !== 0))}>
              {pickedNoun[0] || "der / die / das"}
            </button>
          </div>
          <div>
            <small>Существительное</small>
            <button onClick={() => setChosen((value) => value.filter((_, index) => index !== 1))}>
              {pickedNoun[1] || "Слово"}
            </button>
          </div>
        </div>
        <p className="builder-instruction">
          Нажмите сначала на существительное или артикль — каждый попадёт в своё место.
        </p>
        <div className="game-choice-grid">
          {builderOptions.map((item, i) => (
            <button
              key={`${item}-${i}`}
              disabled={Boolean(feedback) || pickedNoun.includes(item)}
              onClick={() => {
                const slot = item === card.word ? 1 : 0;
                const next = [...pickedNoun];
                next[slot] = item;
                setChosen(next);
                if (next.filter(Boolean).length === expectedNoun.length)
                  finishAnswer(next[0] === card.article && next[1] === card.word);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </>
    );
  else if (gameId === "train")
    content = (
      <>
        <p className="question-kicker">
          Подсказка — перевод на русский · поставьте немецкий артикль перед словом
        </p>
        <h1>{card.translation}</h1>
        <div className="train-track">
          <button
            className={pickedNoun[0] ? "filled" : ""}
            onClick={() => setChosen((value) => value.filter((_, index) => index !== 0))}
          >
            {pickedNoun[0] || "Артикль"}
          </button>
          <span className="train-coupler">···</span>
          <button
            className={pickedNoun[1] ? "filled" : ""}
            onClick={() => setChosen((value) => value.filter((_, index) => index !== 1))}
          >
            {pickedNoun[1] || "Существительное"}
          </button>
          <span className="train-engine" aria-hidden="true">
            🚂
          </span>
        </div>
        <div className="game-choice-grid train-tiles">
          {nounTiles.map((item, i) => (
            <button
              key={`${item}-${i}`}
              disabled={Boolean(feedback) || pickedNoun.includes(item)}
              onClick={() => {
                const next = [...pickedNoun, item];
                setChosen(next);
                if (next.length === expectedNoun.length)
                  finishAnswer(
                    next.join(" ").toLowerCase() === expectedNoun.join(" ").toLowerCase(),
                  );
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </>
    );
  else if (gameId === "hangman")
    content = (
      <>
        <p className="question-kicker">
          Перевод · откройте слово на{" "}
          {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()}{" "}
          по буквам · ошибок: {lives}/6
        </p>
        <h1>{card.translation}</h1>
        <div className="letter-answer">
          {[...targetWord].map((letter, i) => (
            <span key={`${letter}-${i}`}>{letters.includes(letter) ? letter : "_"}</span>
          ))}
        </div>
        <div className="alphabet-grid">
          {alphabet.map((letter) => (
            <button
              key={letter}
              disabled={letters.includes(letter) || Boolean(feedback)}
              onClick={() => {
                const next = [...letters, letter];
                setLetters(next);
                if ([...targetWord].every((char) => next.includes(char))) finishAnswer(true);
                else if (!targetWord.includes(letter)) {
                  const missed = lives + 1;
                  setLives(missed);
                  if (missed >= 6) finishAnswer(false);
                }
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      </>
    );
  else if (gameId === "wordsearch")
    content = (
      <form
        className="word-entry-game"
        onSubmit={(event) => {
          event.preventDefault();
          setChosen([typedAnswer]);
          finishAnswer(
            norm(typedAnswer).replace(/[^\p{L}]/gu, "") ===
              norm(card.word).replace(/[^\p{L}]/gu, ""),
          );
        }}
      >
        <p className="question-kicker">
          Перевод · напишите слово на{" "}
          {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()}
        </p>
        <h1>{card.translation}</h1>
        <label>
          <span>Ваш ответ</span>
          <input
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={Boolean(feedback)}
            value={typedAnswer}
            onChange={(event) => setTypedAnswer(event.target.value)}
            placeholder="Введите слово"
          />
        </label>
        <button
          className="primary-button"
          type="submit"
          disabled={!typedAnswer.trim() || Boolean(feedback)}
        >
          Проверить ответ <Icon name="arrow" size={16} />
        </button>
      </form>
    );
  else if (gameId === "anagram") {
    content = (
      <>
        <p className="question-kicker">
          Перевод на русском · составьте слово на{" "}
          {languageForms[module.languageCode]?.locative ?? module.languageName.toLocaleLowerCase()}{" "}
          из букв
        </p>
        <h1>{card.translation}</h1>
        <div className="builder-slots">
          {letters.map((letter, i) => (
            <button
              key={`${letter}-${i}`}
              onClick={() => {
                setLetters((value) => value.filter((_, position) => position !== i));
                setChosen((value) => value.filter((_, position) => position !== i));
              }}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="alphabet-grid">
          {scrambled.map((letter, i) => (
            <button
              key={`${letter}-${i}`}
              disabled={Boolean(feedback) || chosen.includes(String(i))}
              onClick={() => {
                const next = [...letters, letter];
                setLetters(next);
                setChosen((value) => [...value, String(i)]);
                if (next.length === targetWord.length)
                  finishAnswer(norm(next.join("")) === norm(targetWord));
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      </>
    );
  } else if (gameId === "finalsound") {
    const end = card.word.toLowerCase().slice(-1);
    const expected = end === "b" ? "p" : end === "d" ? "t" : "k";
    content = (
      <>
        <p className="question-kicker">Как звучит конечная буква?</p>
        <h1>
          {card.word}
          <span className="sound-end">{end}</span>
        </h1>
        <p className="transcription">{card.transcription}</p>
        {renderChoiceButtons(["p", "t", "k"], expected)}
      </>
    );
  } else if (gameId === "truefalse") {
    const candidate =
      index % 2 === 0
        ? card.translation
        : (module.cards.find((item) => item.id !== card.id)?.translation ?? card.translation);
    const expected = candidate === card.translation ? "Да, совпадают" : "Нет, разные";
    content = (
      <>
        <p className="question-kicker">Правда или перевод?</p>
        <h1>{german(card)}</h1>
        <p className="new-game-prompt">{candidate}</p>
        {renderChoiceButtons(["Да, совпадают", "Нет, разные"], expected)}
      </>
    );
  } else if (gameId === "oddone") {
    content = (
      <>
        <p className="question-kicker">Найдите слово, которое подходит к подсказке</p>
        <h1>{card.translation}</h1>
        {renderChoiceButtons(boxOptions.map(german), german(card))}
      </>
    );
  } else if (gameId === "memory") {
    content = (
      <>
        <p className="question-kicker">Откройте совпадающую пару</p>
        <h1>{german(card)}</h1>
        <div className="memory-choice-shell">{renderChoiceButtons(choices, card.translation)}</div>
      </>
    );
  } else if (gameId === "speed") {
    content = (
      <>
        <p className="question-kicker">Спринт · отвечайте без пауз</p>
        <div className="speed-timer" aria-label="Время на ответ">
          08
        </div>
        <h1>{german(card)}</h1>
        {renderChoiceButtons(choices, card.translation)}
      </>
    );
  } else if (gameId === "syllables") {
    const wordOptions = boxOptions.map(german);
    content = (
      <>
        <p className="question-kicker">Соберите слово из частей</p>
        <h1>{card.translation}</h1>
        <div className="syllable-preview" aria-hidden="true">
          {[...card.word].map((letter, letterIndex) => (
            <span key={`${letter}-${letterIndex}`}>{letter}</span>
          ))}
        </div>
        {renderChoiceButtons(wordOptions, german(card))}
      </>
    );
  } else if (gameId === "boxes")
    content = (
      <>
        <p className="question-kicker">Найдите немецкое слово для перевода</p>
        <h1>{card.translation}</h1>
        <div className="box-grid">
          {boxOptions.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              disabled={Boolean(feedback)}
              className={
                feedback && item.id === card.id
                  ? "correct"
                  : feedback && chosen[0] === item.id
                    ? "wrong"
                    : ""
              }
              onClick={() => {
                setChosen([item.id]);
                finishAnswer(item.id === card.id);
              }}
            >
              <span aria-hidden="true">🎁</span>
              <small>Вариант {i + 1}</small>
              <strong>{german(item)}</strong>
            </button>
          ))}
        </div>
        <small className="box-hint">
          Сравните слова и выберите то, которое означает показанный перевод.
        </small>
      </>
    );
  else if (gameId === "wheel")
    content = (
      <>
        <p className="question-kicker">Крутите колесо — стрелка выберет слово для вопроса</p>
        <div className="fortune-wheel-stage">
          <span className="fortune-wheel-pointer" aria-hidden="true">
            ▼
          </span>
          <div className="fortune-wheel-wrap">
            <div
              className={`fortune-wheel ${wheelSpinning ? "spinning" : ""}`}
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                background: `conic-gradient(${wheelEntries
                  .map((_, i) => {
                    const start = i * (360 / wheelEntries.length);
                    const end = (i + 1) * (360 / wheelEntries.length);
                    return `${["#8d7bc0", "#5e9eb0", "#c18d75", "#677cba", "#72a997", "#bb85a5"][i % 6]} ${start}deg ${end}deg`;
                  })
                  .join(",")})`,
              }}
            >
              {wheelEntries.map((entry, i) => {
                const angle = (i + 0.5) * (360 / wheelEntries.length);
                return (
                  <span
                    className={wheelSelectedIndex === i ? "winner" : ""}
                    key={entry.id}
                    style={
                      {
                        transform: `rotate(${angle}deg) translateY(calc(-1 * min(25vw, 105px))) rotate(${-angle - wheelRotation}deg)`,
                      } as CSSProperties
                    }
                  >
                    {entry.word}
                  </span>
                );
              })}
            </div>
            <button
              className="fortune-wheel-spin"
              disabled={wheelSpinning || spun}
              onClick={() => {
                const selectedIndex = Math.floor(Math.random() * wheelEntries.length);
                const sector = 360 / wheelEntries.length;
                const targetAngle = (360 - (selectedIndex + 0.5) * sector + 360) % 360;
                const currentAngle = ((wheelRotation % 360) + 360) % 360;
                const correction = (targetAngle - currentAngle + 360) % 360;
                setWheelSelectedIndex(selectedIndex);
                setWheelSpinning(true);
                playWheelSpinSound();
                setWheelRotation((value) => value + 360 * 5 + correction);
                window.setTimeout(() => {
                  setWheelCard(wheelEntries[selectedIndex]);
                  setSpun(true);
                  setWheelSpinning(false);
                  playFeedbackSound(true);
                }, 1900);
              }}
            >
              {wheelSpinning ? "Крутится…" : spun ? "Выпало!" : "Крутить"}
            </button>
          </div>
          {spun && (
            <div className="fortune-wheel-result">
              <span>Стрелка выбрала</span>
              <strong>{german(card)}</strong>
              <small>Выберите перевод ниже</small>
            </div>
          )}
        </div>
        {spun && renderChoiceButtons(choices, card.translation)}
      </>
    );
  else
    content = (
      <>
        <p className="question-kicker">Выберите правильный ответ</p>
        <h1>{german(card)}</h1>
        {renderChoiceButtons(choices, card.translation)}
      </>
    );

  const questionCounter =
    index < rounds.length
      ? `${index + 1} / ${rounds.length}`
      : `Повтор · ${index - rounds.length + 1}`;
  return (
    <div className={`game-shell game-${gameId} ${gameId === "wheel" && spun ? "has-spun" : ""}`}>
      <header className="game-topbar">
        <button onClick={onExit}>
          <Icon name="arrowLeft" /> Назад
        </button>
        <div>
          <span>{GAME_LIST.find((game) => game.id === gameId)?.title.toLocaleUpperCase()}</span>
          <strong>{questionCounter}</strong>
        </div>
        <div className="game-score">★ {score}</div>
      </header>
      <main className="game-center">
        <div className="game-progress">
          <i style={{ width: `${(Math.min(index + 1, rounds.length) / rounds.length) * 100}%` }} />
        </div>
        {card.hint && (
          <div className="round-hint">
            <button
              type="button"
              onClick={() => {
                const next = !hintVisible;
                setHintVisible(next);
                if (next) {
                  const previous = answerAttempts.current[card.id] ?? {
                    attempts: 0,
                    firstTryCorrect: false,
                    hintUsed: false,
                    durationMs: 0,
                  };
                  answerAttempts.current[card.id] = { ...previous, hintUsed: true };
                }
              }}
            >
              <Icon name="info" size={15} />{" "}
              {hintVisible ? "Скрыть подсказку" : "Подсказка к этому раунду"}
            </button>
            {hintVisible && <p>{card.hint}</p>}
          </div>
        )}
        {content}
        {feedback && (
          <span className={`answer-burst ${feedback}`} key={feedbackNonce} aria-hidden="true">
            {feedback === "correct" ? "✓" : "×"}
          </span>
        )}
        {feedback && (
          <div className={`game-feedback-panel ${feedback}`}>
            {feedback === "wrong" && (
              <p className="game-feedback wrong">
                Ответ:{" "}
                {gameId === "sentenceorder"
                  ? sentenceTokens
                      .map((token, position) =>
                        position === 0
                          ? token.replace(
                              /^(\P{L}*)(\p{L})/u,
                              (_whole, prefix: string, letter: string) =>
                                `${prefix}${letter.toLocaleUpperCase(module.languageCode)}`,
                            )
                          : token,
                      )
                      .join(" ")
                  : gameId === "finalsound"
                    ? "конечный согласный оглушается"
                    : gameId === "articles"
                      ? card.article
                      : german(card)}{" "}
                · {card.translation}.{" "}
                {(answerAttempts.current[card.id]?.attempts ?? 0) === 1
                  ? "Можно повторить один раз."
                  : "Задание добавлено в повтор."}
              </p>
            )}
            <button className="primary-button" onClick={advanceRound}>
              {feedback === "wrong" ? "Понятно, дальше" : "Дальше"} <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </main>
      <footer className="game-footer">
        <span>
          {module.practiceNote
            ? module.practiceNote
            : `Словарь: модуль ${module.id} · ${module.title}`}
        </span>
        <button className="text-button" onClick={finishEarly}>
          Закончить сессию
        </button>
      </footer>
    </div>
  );
}

export function GrammarPractice({
  topic,
  onExit,
  onAnswer,
  onEvent,
  onExerciseStart,
}: {
  topic: GrammarTopic;
  onExit: () => void;
  onAnswer: (correct: boolean) => void;
  onEvent?: (payload: Record<string, unknown>) => void;
  onExerciseStart?: () => void | boolean | Promise<void | boolean>;
}) {
  const sessionId = useRef(`grammar-${crypto.randomUUID?.() ?? Date.now()}`);
  const questionStartedAt = useRef(Date.now());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [feedbackNonce, setFeedbackNonce] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const dragOption = useRef<string | null>(null);
  const question = topic.questions[index];
  const startRun = async () => {
    const allowed = await onExerciseStart?.();
    if (allowed === false) return false;
    setStarted(true);
    onEvent?.({
      type: "practice-start",
      activityId: topic.id,
      sessionId: sessionId.current,
      variantId: `grammar:${topic.id}`,
      activity: topic.title,
      moduleTitle: "Грамматика",
      roundIndex: 0,
      roundTotal: topic.questions.length,
      languageCode: topic.languageCode ?? "de",
      level: topic.level ?? "A1–A2",
      skill: "grammar",
      mode: "grammar",
    });
    return true;
  };
  const submit = () => {
    if (!selected || checked) return;
    const correct = selected === question.answer;
    playFeedbackSound(correct);
    setChecked(true);
    setFeedbackNonce((value) => value + 1);
    setScore((value) => value + (correct ? 1 : 0));
    onAnswer(correct);
    onEvent?.({
      type: "practice-answer",
      activityId: topic.id,
      sessionId: sessionId.current,
      eventKey: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
      itemId: `${topic.id}-${index}`,
      variantId: `grammar:${topic.id}`,
      activity: topic.title,
      moduleTitle: "Грамматика",
      roundIndex: index + 1,
      roundTotal: topic.questions.length,
      languageCode: topic.languageCode ?? "de",
      level: topic.level ?? "A1–A2",
      skill: "grammar",
      firstTryCorrect: correct,
      attemptCount: 1,
      hintUsed: false,
      skipped: false,
      durationMs: Math.max(0, Date.now() - questionStartedAt.current),
      prompt: question.prompt,
      selectedAnswer: selected,
      correctAnswer: question.answer,
      correct,
      mode: "grammar",
    });
  };
  const next = () => {
    if (index === topic.questions.length - 1) {
      onEvent?.({
        type: "practice-complete",
        activityId: topic.id,
        sessionId: sessionId.current,
        variantId: `grammar:${topic.id}`,
        activity: topic.title,
        moduleTitle: "Грамматика",
        roundIndex: topic.questions.length,
        roundTotal: topic.questions.length,
        languageCode: topic.languageCode ?? "de",
        level: topic.level ?? "A1–A2",
        skill: "grammar",
        mode: "grammar",
      });
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setChecked(false);
    questionStartedAt.current = Date.now();
  };
  if (finished)
    return (
      <div className="game-shell">
        <header className="game-topbar">
          <button onClick={onExit}>
            <Icon name="arrowLeft" /> Назад
          </button>
          <span>{topic.title}</span>
          <span />
        </header>
        <div className="game-result">
          <span className="result-medal">{score === topic.questions.length ? "★" : "✓"}</span>
          <p className="eyebrow">ТЕМА ЗАВЕРШЕНА</p>
          <h1>
            {score} из {topic.questions.length}
          </h1>
          <p>Ответы сохранены в прогрессе. Можно пройти тему ещё раз или выбрать другую.</p>
          <button
            className="primary-button"
            onClick={() =>
              void startRun().then((allowed) => {
                if (!allowed) return;
                setIndex(0);
                setSelected(null);
                setChecked(false);
                setScore(0);
                setFinished(false);
              })
            }
          >
            Пройти ещё раз
          </button>
          <button className="secondary-button" onClick={onExit}>
            К темам грамматики
          </button>
        </div>
      </div>
    );
  if (!started)
    return (
      <div className="game-shell">
        <header className="game-topbar">
          <button onClick={onExit}>
            <Icon name="close" /> Назад
          </button>
          <div>
            <span>ПРАВИЛО И ПРИМЕРЫ</span>
            <strong>{topic.title}</strong>
          </div>
          <span />
        </header>
        <main className="game-center grammar-intro">
          <span className="grammar-topic-icon">
            <Icon name="brain" size={24} />
          </span>
          <p className="eyebrow">ГРАММАТИКА · {(topic.languageCode ?? "de").toLocaleUpperCase()}</p>
          <h1>{topic.title}</h1>
          <p className="grammar-explanation">{topic.explanation}</p>
          <div className="grammar-example-list">
            {topic.examples.map((example) => (
              <p key={example}>
                <Icon name="check" size={16} />
                {example}
              </p>
            ))}
          </div>
          <button className="primary-button" onClick={() => void startRun()}>
            Начать · {topic.questions.length} упражнения <Icon name="arrow" />
          </button>
        </main>
      </div>
    );
  const promptParts = question.prompt.split("___");
  return (
    <div className="game-shell">
      <header className="game-topbar">
        <button onClick={onExit}>
          <Icon name="arrowLeft" /> Назад
        </button>
        <div>
          <span>{topic.title.toLocaleUpperCase()}</span>
          <strong>
            {index + 1} / {topic.questions.length}
          </strong>
        </div>
        <div>✓ {score}</div>
      </header>
      <main className="game-center grammar-practice">
        <div className="game-progress">
          <i style={{ width: `${((index + 1) / topic.questions.length) * 100}%` }} />
        </div>
        <p className="question-kicker">Нажмите вариант или перетащите его в пропуск</p>
        <div className="grammar-sentence">
          {promptParts[0]}
          <button
            className={`grammar-answer-slot ${selected ? "filled" : ""} ${checked ? (selected === question.answer ? "correct" : "wrong") : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!checked && dragOption.current) setSelected(dragOption.current);
            }}
            onClick={() => !checked && setSelected(null)}
          >
            {selected ?? "Выберите"}
          </button>
          {promptParts[1]}
        </div>
        <div className="grammar-options">
          {question.options.map((option) => (
            <button
              key={option}
              draggable={!checked}
              disabled={checked}
              className={
                checked && option === question.answer
                  ? "correct"
                  : checked && option === selected
                    ? "wrong"
                    : selected === option
                      ? "chosen tile-picked"
                      : ""
              }
              onClick={() => setSelected(option)}
              onDragStart={() => {
                dragOption.current = option;
              }}
            >
              {option}
            </button>
          ))}
        </div>
        {checked && (
          <span
            className={`answer-burst ${selected === question.answer ? "correct" : "wrong"}`}
            key={feedbackNonce}
            aria-hidden="true"
          >
            {selected === question.answer ? "✓" : "×"}
          </span>
        )}
        {checked && (
          <div
            className={`game-feedback-panel ${selected === question.answer ? "correct" : "wrong"}`}
          >
            {selected !== question.answer && (
              <p className="game-feedback wrong">Правильный ответ: {question.answer}</p>
            )}
            <div className="explanation-card">
              <p>{question.explanation}</p>
            </div>
            <button className="primary-button" onClick={next}>
              {index === topic.questions.length - 1 ? "Результат" : "Дальше"} <Icon name="arrow" />
            </button>
          </div>
        )}
        {!checked && (
          <button className="primary-button" disabled={!selected} onClick={submit}>
            Проверить <Icon name="arrow" />
          </button>
        )}
      </main>
    </div>
  );
}
