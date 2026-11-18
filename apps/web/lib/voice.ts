import { api } from "./api";

function writeString(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

async function toWav(blob: Blob, rate = 16000): Promise<Blob> {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  await context.close();
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([view], { type: "audio/wav" });
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class Recorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => event.data.size && this.chunks.push(event.data);
    this.recorder.start();
  }

  stop(): Promise<{ audio: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) return reject(new Error("Mikoro ntiyatangiye."));
      this.recorder.onstop = async () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        try {
          const wav = await toWav(new Blob(this.chunks, { type: this.recorder?.mimeType || "audio/webm" }));
          resolve({ audio: await toBase64(wav), mimeType: "audio/wav" });
        } catch (error) {
          reject(error);
        }
      };
      this.recorder.stop();
    });
  }
}

let playing: HTMLAudioElement | null = null;

export async function speakKinyarwanda(text: string): Promise<"gemini" | "browser" | "none"> {
  if (!text) return "none";
  playing?.pause();
  speechSynthesis?.cancel();
  try {
    const voice = await api<{ audio?: string; mimeType?: string }>("/voice/speak", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (voice.audio) {
      playing = new Audio(`data:${voice.mimeType || "audio/wav"};base64,${voice.audio}`);
      await playing.play();
      return "gemini";
    }
  } catch {
    // Browser voice below.
  }
  if (typeof speechSynthesis === "undefined") return "none";
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "rw-RW";
  speechSynthesis.speak(utterance);
  return "browser";
}

export function stopSpeaking() {
  playing?.pause();
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
