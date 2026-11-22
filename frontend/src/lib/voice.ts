const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

let activeAudio: HTMLAudioElement | null = null;
let activeRecognition: SpeechRecognitionLike | null = null;

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function speechLocale(language: string): string {
  const locales: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
  };
  return locales[language] ?? language;
}

/** Start browser speech recognition and return a function that stops it. */
export function listen(
  language: string,
  onText: (text: string) => void,
  onEnd: () => void,
  onError: (message: string) => void,
): () => void {
  const SpeechRecognition = speechRecognitionConstructor();
  if (!SpeechRecognition) {
    onError("Speech recognition is not supported in this browser.");
    return () => undefined;
  }

  activeRecognition?.abort();
  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  recognition.lang = speechLocale(language);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
    if (transcript) onText(transcript);
  };
  recognition.onerror = (event) => onError(`Speech recognition error: ${event.error}`);
  recognition.onend = () => {
    if (activeRecognition === recognition) activeRecognition = null;
    onEnd();
  };

  try {
    recognition.start();
  } catch (error) {
    activeRecognition = null;
    onError(error instanceof Error ? error.message : "Could not start speech recognition.");
  }

  return () => {
    if (activeRecognition === recognition) recognition.stop();
  };
}

/** Read text aloud with the browser's speech synthesis. */
export function speak(text: string, language: string): Promise<void> {
  if (!("speechSynthesis" in window)) {
    return Promise.reject(new Error("Speech synthesis is not supported in this browser."));
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(language);

  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function stopActiveVoice(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  activeRecognition?.abort();
  activeRecognition = null;
  stopSpeaking();
}

export async function sendVoiceBlob(
  blob: Blob,
  token: string,
  language = "auto",
  sessionId?: string,
) {
  stopActiveVoice();

  const audioBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read audio blob"));
    reader.readAsDataURL(blob);
  });

  const res = await fetch(`${API_BASE}/api/voice/converse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      audio_base64: audioBase64,
      mime: blob.type || "audio/webm",
      language,
      session_id: sessionId ?? null,
      speak_reply: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voice API error (${res.status})`);
  }

  const data = await res.json();
  if (data.no_speech) return data;

  if (data.audio_base64) {
    activeAudio = new Audio(`data:${data.mime};base64,${data.audio_base64}`);
    await activeAudio.play();
  }

  return data;
}
