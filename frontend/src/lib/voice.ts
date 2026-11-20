import { blobToBase64 } from "./bytes";
import { api } from "./api";
import { SPEECH_TAG } from "./i18n";

let audio: HTMLAudioElement | null = null;
export function stopSpeaking() { window.speechSynthesis?.cancel(); audio?.pause(); audio = null; }

/** Browser voice first (free, instant); Gemini TTS when the browser has no voice for the language. */
export async function speak(text: string, lang: string) {
  stopSpeaking();
  const tag = SPEECH_TAG[lang] || "en-IN";
  const synth = window.speechSynthesis;
  const has = synth && synth.getVoices().some((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)));
  if (has) { const u = new SpeechSynthesisUtterance(text); u.lang = tag; synth.speak(u); return; }
  const r = await api.tts(text, lang);
  audio = new Audio(`data:${r.mime};base64,${r.audio_base64}`); await audio.play();
}

/** Starts listening; returns a stop() function. onText fires once with the final transcript. */
export function listen(lang: string, onText: (t: string) => void, onEnd: () => void, onError: (e: string) => void): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SR) {
    const rec = new SR(); rec.lang = SPEECH_TAG[lang] || "en-IN"; rec.interimResults = false;
    rec.onresult = (e: any) => onText(e.results[0][0].transcript);
    rec.onerror = (e: any) => { onError(e.error); };
    rec.onend = onEnd; rec.start();
    return () => rec.stop();
  }
  // Fallback: record, send to Gemini speech-to-text
  let rec: MediaRecorder | null = null; let stopped = false;
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
    const chunks: BlobPart[] = []; rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      // Safari records mp4, others webm; never send an empty type
      const mime = rec!.mimeType || (/safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent) ? "audio/mp4" : "audio/webm");
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) { onError("No audio was recorded. Please try again."); onEnd(); return; }
      const b64 = await blobToBase64(blob);
      try { const r = await api.stt(b64, mime.split(";")[0], lang); if (r.text) onText(r.text); } catch (e) { onError(String((e as Error).message)); }
      onEnd();
    };
    rec.start(); setTimeout(() => rec?.state === "recording" && rec.stop(), 15000);
  }).catch((e) => { onError(String(e)); onEnd(); });
  return () => { stopped = true; if (rec?.state === "recording") rec.stop(); };
}
