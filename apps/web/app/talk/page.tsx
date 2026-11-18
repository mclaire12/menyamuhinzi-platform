"use client";

import { useEffect, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { api } from "../../lib/api";
import { Recorder, speakKinyarwanda, stopSpeaking } from "../../lib/voice";

interface Turn {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  via: "voice" | "text";
  at: string;
}

interface Lesson { id: string; status: string; title: { rw: string } }

export default function TalkPage() {
  const [status, setStatus] = useState<{ gemini: boolean; ai: boolean } | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState("");
  const recorder = useRef<Recorder | null>(null);

  useEffect(() => {
    api<{ gemini: boolean; ai: boolean }>("/voice/status").then(setStatus).catch(() => setStatus({ gemini: false, ai: false }));
    api<Turn[]>("/voice/history").then(setHistory).catch(() => undefined);
    api<{ lessons: Lesson[] }>("/courses/tomato").then((course) => setLessons((course.lessons || []).filter((item) => item.status === "published"))).catch(() => undefined);
    const fromLesson = new URLSearchParams(window.location.search).get("lesson");
    if (fromLesson) setLessonId(fromLesson);
  }, []);

  async function handle(result: { error?: string; turn?: Turn | null; rw?: string; transcript?: string }) {
    if (result.error) {
      setNotice(result.error);
      return;
    }
    if (!result.turn) {
      setNotice(result.rw || "Sinumvise neza. Ongera uvuge.");
      return;
    }
    setNotice("");
    setHistory((rows) => [result.turn as Turn, ...rows]);
    await speakKinyarwanda(result.turn.answer);
  }

  async function toggleMic() {
    if (busy) return;
    if (!recording) {
      try {
        stopSpeaking();
        recorder.current = new Recorder();
        await recorder.current.start();
        setRecording(true);
        setNotice("Ndakumva... Kanda kongera iyo urangije kuvuga.");
      } catch {
        setNotice("Mikoro ntiyafunguwe. Emerera urubuga gukoresha mikoro.");
      }
      return;
    }
    setRecording(false);
    setBusy(true);
    setNotice("AI irumva ikibazo cyawe...");
    try {
      const clip = await recorder.current!.stop();
      await handle(await api("/voice/ask", { method: "POST", body: JSON.stringify({ ...clip, lessonId: lessonId || null }) }));
    } catch {
      setNotice("Ijwi ntiryoherejwe. Ongera ugerageze.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTyped(event: React.FormEvent) {
    event.preventDefault();
    if (!typed.trim() || busy) return;
    setBusy(true);
    try {
      await handle(await api("/voice/ask-text", { method: "POST", body: JSON.stringify({ question: typed, lessonId: lessonId || null }) }));
      setTyped("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="page-head">
        <p className="eyebrow">Vugana na AI</p>
        <h1>Baza mu Kinyarwanda, wumve igisubizo.</h1>
        <p className="lesson-text">Vuga ikibazo cyawe ku nyanya. AI isubiza ikoresheje amasomo yemejwe gusa. Iyo isomo ritarimo igisubizo, irabikubwira.</p>
      </section>

      <div className="talk-layout">
        <section className="card talk-panel">
          <div className="row between">
            <span className={status?.gemini ? "chip ok" : "chip"}>
              {status === null ? "Turareba AI..." : status.gemini ? "Gemini irumva kandi ivuga" : "Gemini ntirashyirwamo: andika ikibazo"}
            </span>
            <label className="inline">
              Isomo
              <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                <option value="">Inyanya zose</option>
                {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title.rw}</option>)}
              </select>
            </label>
          </div>

          <button
            className={recording ? "mic live" : "mic"}
            onClick={toggleMic}
            disabled={busy || !status?.gemini}
            aria-label={recording ? "Hagarika kuvuga" : "Tangira kuvuga"}
          >
            <span className="mic-dot" />
            <strong>{recording ? "Hagarika" : busy ? "Tegereza" : "Kanda uvuge"}</strong>
          </button>
          {notice && <p className="notice">{notice}</p>}

          <form onSubmit={sendTyped} className="ask-row">
            <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="Cyangwa andika: Umuseme umara ibyumweru bingahe?" />
            <button className="solid" type="submit" disabled={busy}>Baza</button>
          </form>
        </section>

        <section className="talk-history">
          <h2>Ibiganiro byawe</h2>
          {history.length === 0 && <p className="muted">Nta kibazo urabaza. Ibiganiro byawe bigaragara hano gusa.</p>}
          {history.map((turn) => (
            <article key={turn.id} className="exchange">
              <p className="bubble me"><small>{turn.via === "voice" ? "Wavuze" : "Wanditse"}</small>{turn.question}</p>
              <p className={turn.grounded ? "bubble ai" : "bubble ai unsure"}>
                <small>{turn.grounded ? "AI · ivuye mu isomo" : "AI · ntibiri mu isomo"}</small>
                {turn.answer}
              </p>
              <button className="ghost small" onClick={() => speakKinyarwanda(turn.answer)}>Ongera wumve</button>
            </article>
          ))}
        </section>
      </div>
    </Shell>
  );
}
