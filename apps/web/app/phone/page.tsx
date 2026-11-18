"use client";

import { useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { api } from "../../lib/api";
import { Recorder, speakKinyarwanda } from "../../lib/voice";

interface Turn {
  sessionId?: string;
  say?: { rw: string };
  state?: { step: string };
  action?: string;
  ussd?: { ussdCode: string; ussdStatus: string };
}

export default function PhonePage() {
  const [code, setCode] = useState("*675#");
  const [call, setCall] = useState<Turn | null>(null);
  const [said, setSaid] = useState("");
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState("");
  const recorder = useRef<Recorder | null>(null);

  async function dial(event: React.FormEvent) {
    event.preventDefault();
    const started = await api<Turn>("/phone/start", { method: "POST", body: "{}" });
    setCall(started);
    setHeard(started.say?.rw || "");
    speak(started.say?.rw || "");
  }

  function speak(text: string) {
    speakKinyarwanda(text);
  }

  async function toggleMic() {
    if (!listening) {
      try {
        recorder.current = new Recorder();
        await recorder.current.start();
        setListening(true);
        setMicNote("Ndakumva... kanda kongera urangije.");
      } catch {
        setMicNote("Mikoro ntiyafunguwe. Andika ijambo.");
      }
      return;
    }
    setListening(false);
    setMicNote("Ndumva icyo wavuze...");
    try {
      const clip = await recorder.current!.stop();
      const result = await api<{ text?: string; error?: string }>("/voice/transcribe", { method: "POST", body: JSON.stringify(clip) });
      if (result.error || !result.text) {
        setMicNote(result.error || "Sinumvise neza. Ongera uvuge.");
        return;
      }
      setMicNote(`Wavuze: ${result.text}`);
      await send(result.text);
    } catch {
      setMicNote("Ijwi ntiryoherejwe. Andika ijambo.");
    }
  }

  async function send(utterance = "", key?: string) {
    if (!call?.sessionId) return;
    const next = await api<Turn>("/phone/turn", {
      method: "POST",
      body: JSON.stringify({ sessionId: call.sessionId, utterance, key }),
    });
    setCall({ ...call, ...next });
    setHeard(next.say?.rw || "");
    speak(next.say?.rw || "");
    setSaid("");
  }

  const step = call?.state?.step;
  const showKeys = step === "playing" || step === "asking" || step === "quiz";

  return (
    <Shell>
      <p className="muted">Telefoni ntoya</p>
      <h1>USSD ihamagara, ijwi ni ryo rigena.</h1>
      <p>Kanda 8 kubaza, 0 gukomeza cyangwa gusubira, 9 gutangira ikizamini. Ibindi bisubizwa n'ijwi.</p>
      {!call && (
        <form className="card" onSubmit={dial}>
          <label>Kode ya USSD
            <input value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <button className="solid" type="submit">Hamagara</button>
          <p className="muted">*675# ni urugero. Kode nyayo yemezwa n'itumanaho.</p>
        </form>
      )}
      {call && (
        <section className="grid">
          <div className="call">
            <p className="muted">Uhuye na MenyaMuhinzi</p>
            <p className="lesson-text">{heard}</p>
          </div>
          <form className="card" onSubmit={(event) => { event.preventDefault(); send(said); }}>
            <label>Vuga cyangwa andika ijambo niba mikoro itari gukora
              <input value={said} onChange={(event) => setSaid(event.target.value)} placeholder="kwiga, inyanya, uruseme..." />
            </label>
            <div className="row">
              <button className={listening ? "tomato" : "ghost"} type="button" onClick={toggleMic}>
                {listening ? "Hagarika mikoro" : "Vuga ukoresheje mikoro"}
              </button>
              <button className="solid" type="submit">Ohereza ijambo</button>
            </div>
            {micNote && <p className="notice">{micNote}</p>}
            {showKeys && (
              <div className="row">
                <button type="button" className="key" onClick={() => send("", "8")}>8</button>
                <button type="button" className="key" onClick={() => send("", "0")}>0</button>
                <button type="button" className="key" onClick={() => send("", "9")}>9</button>
              </div>
            )}
          </form>
        </section>
      )}
    </Shell>
  );
}
