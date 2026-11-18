"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { Art } from "../../../components/Art";
import { api } from "../../../lib/api";

interface Beat { id: string; minutes: number; title: { rw: string }; text: { rw: string } }
interface Lesson {
  id: string; title: { rw: string }; objectives: { rw: string }; illustration: string; beats: Beat[];
  quiz: Array<{ id: string; prompt: { rw: string }; choices: Array<{ rw: string }> }>;
}

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [mode, setMode] = useState<"read" | "watch" | "listen">("read");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; total: number; review: Array<{ explanation: { rw: string }; correct: boolean }> } | null>(null);

  useEffect(() => {
    api<{ lessons: Lesson[] }>("/courses/tomato").then((course) => {
      const found = course.lessons.find((item) => item.id === params.lessonId) || null;
      setLesson(found);
    });
  }, [params.lessonId]);

  useEffect(() => {
    if (!lesson) return;
    const beat = lesson.beats[beatIndex];
    api("/progress", {
      method: "POST",
      body: JSON.stringify({
        lessonId: lesson.id,
        beatId: beat.id,
        beatIndex,
        completed: beatIndex === lesson.beats.length - 1,
      }),
    }).catch(() => undefined);
  }, [lesson, beatIndex]);

  if (!lesson) return <Shell>Tegereza isomo...</Shell>;
  const beat = lesson.beats[beatIndex];

  function speak() {
    const utterance = new SpeechSynthesisUtterance(beat.text.rw);
    utterance.lang = "rw-RW";
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const payload = await api<{ rw: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ question, lessonId: lesson!.id }),
    });
    setAnswer(payload.rw);
  }

  async function submitQuiz(event: React.FormEvent) {
    event.preventDefault();
    const payload = await api<NonNullable<typeof result>>(`/quiz/${lesson!.id}`, {
      method: "POST",
      body: JSON.stringify({ answers: picked }),
    });
    setResult(payload);
  }

  return (
    <Shell>
      <Link href="/courses/tomato" className="muted">Subira ku masomo y'inyanya</Link>
      <p className="muted">Iminota 10 · {lesson.objectives.rw}</p>
      <h1>{lesson.title.rw}</h1>
      <div className="row">
        <button className={mode === "read" ? "solid" : "ghost"} onClick={() => setMode("read")}>Soma</button>
        <button className={mode === "watch" ? "solid" : "ghost"} onClick={() => setMode("watch")}>Reba</button>
        <button className={mode === "listen" ? "solid" : "ghost"} onClick={() => { setMode("listen"); speak(); }}>Umva</button>
      </div>
      <div className="beats">
        {lesson.beats.map((item, index) => (
          <button key={item.id} className={index === beatIndex ? "beat on" : "beat"} onClick={() => setBeatIndex(index)}>
            {item.minutes} min · {item.title.rw}
          </button>
        ))}
      </div>
      <article className="card">
        {mode !== "read" && <Art name={lesson.illustration} />}
        <h2>{beat.title.rw}</h2>
        <p className="lesson-text">{beat.text.rw}</p>
        <div className="row">
          <button className="ghost" disabled={beatIndex === 0} onClick={() => setBeatIndex((value) => value - 1)}>Subira</button>
          <button className="solid" disabled={beatIndex === lesson.beats.length - 1} onClick={() => setBeatIndex((value) => value + 1)}>Komeza</button>
          {mode === "listen" && <button className="ghost" onClick={speak}>Ongera umve</button>}
        </div>
      </article>
      <form className="card" onSubmit={ask}>
        <h2>Baza ku isomo</h2>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Andika ikibazo cyawe mu Kinyarwanda" />
        <div className="row">
          <button className="solid" type="submit">Baza</button>
          <Link className="ghost" href={`/talk?lesson=${lesson.id}`}>Baza n'ijwi</Link>
        </div>
        {answer && <p className="lesson-text">{answer}</p>}
      </form>
      {lesson.quiz.length > 0 && (
        <form className="card" onSubmit={submitQuiz}>
          <h2>Ikizamini kitari ngombwa</h2>
          {lesson.quiz.map((item, index) => (
            <fieldset key={item.id} className="choice">
              <legend>{item.prompt.rw}</legend>
              {item.choices.map((choice, choiceIndex) => (
                <label key={choice.rw}>
                  <input
                    type="radio"
                    name={item.id}
                    checked={picked[index] === choiceIndex}
                    onChange={() => setPicked((current) => {
                      const next = [...current];
                      next[index] = choiceIndex;
                      return next;
                    })}
                  />
                  {choice.rw}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="tomato" type="submit">Ohereza</button>
          {result && (
            <div>
              <p>Amanota: {result.score} / {result.total}</p>
              {result.review.map((item) => <p key={item.explanation.rw}>{item.correct ? "Byagenze neza. " : "Subira ku isomo. "}{item.explanation.rw}</p>)}
            </div>
          )}
        </form>
      )}
    </Shell>
  );
}
