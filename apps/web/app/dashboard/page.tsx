"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { api, token } from "../../lib/api";

interface Dash {
  user: { name: string; location: string };
  course: { title: { rw: string }; summary: { rw: string } };
  lessonCount: number;
  completed: number;
  current?: { id: string; title: { rw: string } } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    if (!token()) {
      router.push("/");
      return;
    }
    api<Dash>("/me/dashboard").then(setData).catch(() => router.push("/"));
  }, [router]);

  if (!data) return <Shell><p className="muted">Tegereza...</p></Shell>;
  const percent = data.lessonCount ? Math.round((data.completed / data.lessonCount) * 100) : 0;

  return (
    <Shell>
      <section className="page-head">
        <p className="eyebrow">Murakaza neza, {data.user.name}</p>
        <h1>Amasomo yawe</h1>
        <p className="lesson-text">Fungura ikarita y'inyanya utangire kwiga. Iterambere rigaragara hano ni iryawe gusa.</p>
      </section>
      <Link href="/courses/tomato" className="course-card">
        <span className="course-mark">Inyanya</span>
        <span>
          <h2>{data.course.title.rw}</h2>
          <p className="muted">{data.course.summary.rw}</p>
          <p>{data.completed} / {data.lessonCount} amasomo yarangiye{data.current ? ` · ukomeza: ${data.current.title.rw}` : ""}</p>
          <div className="progress"><span style={{ width: `${percent}%` }} /></div>
        </span>
        <strong>Fungura →</strong>
      </Link>
      <div className="card quick-talk">
        <span>
          <h3>Ufite ikibazo ku nyanya?</h3>
          <p className="muted">Vuga mu Kinyarwanda, AI igusubize n'ijwi.</p>
        </span>
        <Link href="/talk" className="solid">Vugana na AI</Link>
      </div>
    </Shell>
  );
}
