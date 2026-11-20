const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""; // or import.meta.env.VITE_API_URL for Vite

let activeAudio: HTMLAudioElement | null = null;

export function stopActiveVoice() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

export async function sendVoiceBlob(
  blob: Blob,
  token: string,
  language = "auto",
  sessionId?: string
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
