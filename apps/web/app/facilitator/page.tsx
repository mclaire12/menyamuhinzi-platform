"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { api } from "../../lib/api";

interface Lesson {
  id: string;
  status: string;
  title: { rw: string; en: string };
  beats: Array<{ id: string; minutes: number; title: { rw: string; en: string }; text: { rw: string; en: string } }>;
  objectives: { rw: string; en: string };
}

export default function FacilitatorPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [objectives, setObjectives] = useState("Sobanura uko umuhinzi amenya umuseme witeguye.");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState("");

  async function load() {
    const rows = await api<Lesson[]>("/facilitator/lessons");
    setLessons(rows);
  }

  useEffect(() => {
    api<{ role: string }>("/auth/me").then((user) => {
      if (user.role !== "facilitator") {
        router.push(user.role === "administrator" ? "/admin" : "/dashboard");
        return;
      }
      load().catch((error) => setMessage(error.message));
    }).catch(() => router.push("/"));
  }, [router]);

  async function draft(event: React.FormEvent) {
    event.preventDefault();
    await api("/facilitator/drafts", { method: "POST", body: JSON.stringify({ vegetable: "tomato", level: "beginner", objectives }) });
    setMessage("Inyandiko nshya yakozwe. Ntirasohoka.");
    await load();
  }

  async function save(lesson: Lesson) {
    await api(`/facilitator/lessons/${lesson.id}`, { method: "PUT", body: JSON.stringify(lesson) });
    setMessage("Yabitswe nk'inyandiko.");
    await load();
  }

  async function approve(id: string) {
    await api(`/facilitator/lessons/${id}/approve`, { method: "POST", body: "{}" });
    setMessage("Yemejwe. Abahinzi bashobora kuyibona.");
    await load();
  }

  return (
    <Shell>
      <h1>Umutoza</h1>
      <p>Inyandiko z'AI ntizisohoka kugeza uziyemeye. Inyanya ni yo isomo rikuru rifunguye.</p>
      {message && <p className="warn">{message}</p>}
      <form className="card" onSubmit={draft}>
        <h2>Andika inyandiko y'inyanya</h2>
        <textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} />
        <button className="solid" type="submit">Kora inyandiko</button>
      </form>
      <div className="grid">
        {lessons.map((lesson) => (
          <article key={lesson.id} className="card">
            <p className="muted">{lesson.status === "published" ? "Yemejwe" : "Inyandiko"}</p>
            <h3>{lesson.title.rw}</h3>
            {editing === lesson.id ? (
              <>
                <textarea
                  value={lesson.beats[1]?.text.rw || ""}
                  onChange={(event) => {
                    const next = { ...lesson, beats: lesson.beats.map((beat) => beat.id === "teach" ? { ...beat, text: { ...beat.text, rw: event.target.value } } : beat) };
                    setLessons((rows) => rows.map((item) => item.id === lesson.id ? next : item));
                  }}
                />
                <button className="solid" onClick={() => save(lesson)}>Bika</button>
              </>
            ) : (
              <p>{lesson.beats[1]?.text.rw.slice(0, 220)}</p>
            )}
            <div className="row">
              <button className="ghost" onClick={() => setEditing(lesson.id)}>Kosora</button>
              {lesson.status !== "published" && <button className="tomato" onClick={() => approve(lesson.id)}>Emeza</button>}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
