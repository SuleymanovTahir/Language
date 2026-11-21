import { readProfileItem } from "./profileStorage";

export type SpeechProvider = "device" | "edge" | "kokoro" | "elevenlabs" | "azure" | "none";
export type SpeechSettings = {
  provider: SpeechProvider;
  voice: string;
  rate: number;
  enabled?: boolean;
};

export const defaultSpeechSettings: SpeechSettings = {
  provider: "edge",
  voice: "de-DE-TanjaNeural",
  rate: 0.82,
  enabled: true,
};

const settingsKey = "linguaplay-speech-settings";
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl = "";
let audioRequestId = 0;
let kokoroPromise: ReturnType<(typeof import("kokoro-js"))["KokoroTTS"]["from_pretrained"]> | null =
  null;

export function detectSpeechLanguage(text: string) {
  if (/[\u0400-\u04ff]/.test(text)) return "ru-RU";
  if (
    /[äöüß]/i.test(text) ||
    /^(der|die|das|ein|eine|ich|du|wir|sie|und|nicht|mit|für)\b/i.test(text)
  )
    return "de-DE";
  return "en-US";
}

export function speechLocaleForCode(code: string) {
  if (code.includes("-")) return code;
  const locales: Record<string, string> = {
    de: "de-DE",
    en: "en-US",
    ru: "ru-RU",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    tr: "tr-TR",
  };
  return locales[code.toLowerCase()] ?? `${code}-${code.toUpperCase()}`;
}

export function defaultVoiceFor(provider: SpeechProvider, languageCode: string) {
  const language = languageCode.toLowerCase().split("-")[0];
  const defaults: Record<SpeechProvider, Record<string, string>> = {
    device: {},
    none: {},
    edge: {
      de: "de-DE-TanjaNeural",
      en: "en-US-EmmaMultilingualNeural",
      fr: "fr-FR-VivienneMultilingualNeural",
    },
    kokoro: { en: "af_heart", fr: "ff_siwis" },
    elevenlabs: { de: "", en: "", fr: "" },
    azure: {
      de: "de-DE-SeraphinaMultilingualNeural",
      en: "en-US-EmmaMultilingualNeural",
      fr: "fr-FR-VivienneMultilingualNeural",
    },
  };
  return defaults[provider][language] ?? "";
}

function voiceFor(provider: SpeechProvider, voice: string, languageCode: string) {
  const language = languageCode.toLowerCase().split("-")[0];
  if (provider === "elevenlabs") return voice;
  if (provider === "kokoro") {
    const valid =
      language === "fr"
        ? voice === "ff_siwis"
        : language === "en"
          ? /^(af_|am_)/.test(voice)
          : false;
    return valid ? voice : defaultVoiceFor(provider, languageCode);
  }
  if (provider === "edge" || provider === "azure") {
    return voice.toLowerCase().startsWith(`${language}-`)
      ? voice
      : defaultVoiceFor(provider, languageCode);
  }
  return voice;
}

const speechProviders: SpeechProvider[] = [
  "device",
  "edge",
  "kokoro",
  "elevenlabs",
  "azure",
  "none",
];

export function readSpeechSettings(): SpeechSettings {
  try {
    const raw = readProfileItem(settingsKey);
    if (!raw) return defaultSpeechSettings;
    const saved = JSON.parse(raw) as Partial<SpeechSettings>;
    return {
      provider: speechProviders.includes(saved.provider as SpeechProvider)
        ? (saved.provider as SpeechProvider)
        : "device",
      voice: typeof saved.voice === "string" ? saved.voice : "",
      rate: typeof saved.rate === "number" ? Math.min(1.1, Math.max(0.55, saved.rate)) : 0.82,
      enabled: saved.enabled !== false && saved.provider !== "none",
    };
  } catch {
    return defaultSpeechSettings;
  }
}

function stopCurrentAudio() {
  audioRequestId += 1;
  activeAudio?.pause();
  activeAudio = null;
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
  activeAudioUrl = "";
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function stopAllSpeech() {
  activeUtterance = null;
  stopCurrentAudio();
  if (typeof window !== "undefined") {
    try { window.speechSynthesis?.cancel(); } catch {}
  }
}

// Global flag to serialise device-voice calls so they never overlap
let deviceVoiceResolve: (() => void) | null = null;

function speakOnDevice(text: string, lang: string, slow: boolean, settings: SpeechSettings) {
  if (!("speechSynthesis" in window)) return false;
  const normalizedLocale = speechLocaleForCode(lang);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = normalizedLocale;
  utterance.rate = Math.max(0.55, Math.min(1.1, settings.rate * (slow ? 0.76 : 1)));
  const language = normalizedLocale.toLowerCase().split("-")[0];
  const voices = window.speechSynthesis.getVoices();
  const matchingVoices = voices.filter(
    (voice) =>
      voice.lang.toLowerCase() === normalizedLocale.toLowerCase() ||
      voice.lang.toLowerCase().replace("_", "-").startsWith(`${language}-`),
  );
  const selected = matchingVoices.find((voice) => voice.voiceURI === settings.voice);
  utterance.voice = selected ?? matchingVoices[0] ?? null;
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    window.speechSynthesis.resume?.();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function saveWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) =>
    [...value].forEach((character, index) =>
      view.setUint8(offset + index, character.charCodeAt(0)),
    );
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * bytesPerSample, value < 0 ? value * 32768 : value * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function synthesizeWithKokoro(text: string, lang: string, voice: string, rate: number) {
  const language = lang.toLowerCase().split("-")[0];
  if (language !== "en" && language !== "fr")
    throw new Error("Kokoro supports English and French in this app.");
  kokoroPromise ??= import("kokoro-js").then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
    }),
  );
  const tts = await kokoroPromise;
  const speed = Math.max(0.55, Math.min(1.1, rate));
  let audio;
  if (language === "fr") {
    const { phonemize } = await import("phonemizer");
    const phonemes = await phonemize(text, "fr-fr");
    const encoded = await tts.tokenizer(phonemes.join(" "), { truncation: true });
    const frenchOptions = { voice: "ff_siwis", speed } as unknown as Parameters<
      typeof tts.generate_from_ids
    >[1];
    audio = await tts.generate_from_ids(encoded.input_ids, frenchOptions);
  } else {
    const englishVoice = voice === "af_bella" || voice === "am_fenrir" ? voice : "af_heart";
    audio = await tts.generate(text, { voice: englishVoice, speed });
  }
  return saveWav(audio.audio, audio.sampling_rate);
}

function playAudioBlob(blob: Blob, requestId: number) {
  if (requestId !== audioRequestId) return;
  activeAudioUrl = URL.createObjectURL(blob);
  activeAudio = new Audio(activeAudioUrl);
  activeAudio.onended = stopCurrentAudio;
  activeAudio.onerror = stopCurrentAudio;
  void activeAudio.play().catch(() => stopCurrentAudio());
}

export function speakText(
  text: string,
  lang = detectSpeechLanguage(text),
  slow = false,
  override?: SpeechSettings,
) {
  if (typeof window === "undefined" || !text.trim()) return false;
  stopCurrentAudio();
  const settings = override ?? readSpeechSettings();
  if (settings.enabled === false || settings.provider === "none") return false;
  const rate = Math.max(0.55, Math.min(1.1, settings.rate * (slow ? 0.76 : 1)));

  // Requirement: для русских слов используем бесплатный голос устройства
  const isRussian =
    lang.toLowerCase().startsWith("ru") || detectSpeechLanguage(text) === "ru-RU";
  if (isRussian || settings.provider === "device") {
    return speakOnDevice(text, isRussian ? "ru-RU" : lang, slow, {
      ...settings,
      provider: "device",
    });
  }

  const requestId = audioRequestId;
  const normalizedLocale = speechLocaleForCode(lang);
  const language = normalizedLocale.toLowerCase().split("-")[0];
  if (settings.provider === "kokoro") {
    if (!defaultVoiceFor("kokoro", lang) && !settings.voice)
      return speakOnDevice(text, lang, slow, { ...settings, provider: "device" });
    void synthesizeWithKokoro(text, lang, voiceFor("kokoro", settings.voice, lang), rate)
      .then((blob) => playAudioBlob(blob, requestId))
      .catch(() => speakOnDevice(text, lang, slow, { ...settings, provider: "device" }));
    return true;
  }

  const endpoint = "/api/tts";
  const voice = voiceFor(settings.provider, settings.voice || "", language);
  if ((settings.provider === "edge" || settings.provider === "azure") && !voice)
    return speakOnDevice(text, lang, slow, { ...settings, provider: "device" });

  void fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: settings.provider, text, voice, rate }),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Cloud speech is unavailable");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("audio")) {
        throw new Error("Non-audio response from TTS endpoint");
      }
      playAudioBlob(await response.blob(), requestId);
    })
    .catch(() => {
      if (requestId === audioRequestId)
        speakOnDevice(text, lang, slow, { ...settings, provider: "device" });
    });
  return true;
}

export function speakTextAsync(
  text: string,
  lang = detectSpeechLanguage(text),
  slow = false,
  override?: SpeechSettings,
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !text.trim()) {
      resolve();
      return;
    }

    // ── Stop everything currently playing FIRST, then speak ──
    stopCurrentAudio();
    try { window.speechSynthesis?.cancel(); } catch {}

    const settings = override ?? readSpeechSettings();
    if (settings.enabled === false || settings.provider === "none") {
      resolve();
      return;
    }

    const rate = Math.max(0.55, Math.min(1.1, settings.rate * (slow ? 0.76 : 1)));
    const requestId = ++audioRequestId;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    // Safety timeout: if speech engine never fires onend, resolve anyway
    const maxDurationMs = Math.max(4000, text.length * 300 + 2500);
    const fallbackTimer = window.setTimeout(finish, maxDurationMs);

    const done = () => {
      window.clearTimeout(fallbackTimer);
      finish();
    };

    // ── Device voice (SpeechSynthesis) ───────────────────────
    const speakOnDeviceAsync = () => {
      if (!("speechSynthesis" in window)) { done(); return; }

      const normalizedLocale = speechLocaleForCode(lang);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = normalizedLocale;
      utterance.rate = rate;

      const language = normalizedLocale.toLowerCase().split("-")[0];
      const voices = window.speechSynthesis.getVoices();
      const matchingVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase() === normalizedLocale.toLowerCase() ||
          v.lang.toLowerCase().replace("_", "-").startsWith(`${language}-`),
      );
      const selected = matchingVoices.find((v) => v.voiceURI === settings.voice);
      utterance.voice = selected ?? matchingVoices[0] ?? null;

      activeUtterance = utterance;
      utterance.onend = () => {
        activeUtterance = null;
        done();
      };
      utterance.onerror = () => {
        activeUtterance = null;
        done();
      };

      try {
        // Ensure synthesis queue is fully empty before enqueueing new utterance
        window.speechSynthesis.cancel();
        // Small defer so cancel fully propagates before speak() is called
        window.setTimeout(() => {
          if (requestId !== audioRequestId) { done(); return; }
          try {
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
          } catch { done(); }
        }, 60);
      } catch { done(); }
    };

    // ── Audio element (cloud TTS blob) ───────────────────────
    const cleanupAudioElement = () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      if (activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
        activeAudioUrl = "";
      }
    };

    const playWithAudioElement = (blob: Blob) => {
      if (requestId !== audioRequestId) { done(); return; }
      cleanupAudioElement();
      activeAudioUrl = URL.createObjectURL(blob);
      const audio = new Audio(activeAudioUrl);
      activeAudio = audio;
      audio.onended = () => {
        if (activeAudio === audio) cleanupAudioElement();
        done();
      };
      audio.onerror = () => {
        if (activeAudio === audio) cleanupAudioElement();
        if (requestId === audioRequestId) speakOnDeviceAsync();
        else done();
      };
      audio.play().catch(() => {
        if (activeAudio === audio) cleanupAudioElement();
        if (requestId === audioRequestId) speakOnDeviceAsync();
        else done();
      });
    };

    // ── Route: Russian words always use device voice ──────────
    const isRussian =
      lang.toLowerCase().startsWith("ru") || detectSpeechLanguage(text) === "ru-RU";
    if (isRussian || settings.provider === "device") {
      speakOnDeviceAsync();
      return;
    }

    const normalizedLocale = speechLocaleForCode(lang);
    const language = normalizedLocale.toLowerCase().split("-")[0];

    if (settings.provider === "kokoro") {
      if (!defaultVoiceFor("kokoro", lang) && !settings.voice) { speakOnDeviceAsync(); return; }
      synthesizeWithKokoro(text, lang, voiceFor("kokoro", settings.voice, lang), rate)
        .then((blob) => playWithAudioElement(blob))
        .catch(() => speakOnDeviceAsync());
      return;
    }

    const voice = voiceFor(settings.provider, settings.voice || "", language);
    if (!voice) { speakOnDeviceAsync(); return; }

    fetch("/api/tts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: settings.provider, text, voice, rate }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Cloud speech unavailable");
        const ct = response.headers.get("content-type") || "";
        if (!ct.includes("audio")) throw new Error("Non-audio response");
        playWithAudioElement(await response.blob());
      })
      .catch(() => {
        if (requestId === audioRequestId) speakOnDeviceAsync();
        else done();
      });
  });
}
