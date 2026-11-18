"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { api, token } from "../../../lib/api";

interface Lesson {
  id: string;
  status: string;
  title: { rw: string };
  objectives: { rw: string };
}

interface Course {
  title: { rw: string };
  summary: { rw: string };
  lessons: Lesson[];
}

export default function TomatoCoursePage() {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (!token()) {
      router.push("/");
      return;
    }
    api<Course>("/courses/tomato").then((payload) => {
      api("/enrollments", { method: "POST", body: JSON.stringify({ courseId: "course-tomato" }) }).catch(() => undefined);
      setCourse(payload);
    }).catch(() => router.push("/"));
  }, [router]);

  if (!course) return <Shell>Tegereza isomo ry'inyanya...</Shell>;
  const lessons = (course.lessons || []).filter((lesson) => lesson.status !== "draft");

  return (
    <Shell>
      <Link href="/dashboard" className="muted">Subira ku masomo yawe</Link>
      <h1>{course.title.rw}</h1>
      <p className="lesson-text">{course.summary.rw}</p>
      <div className="grid">
        {lessons.map((lesson, index) => (
          <Link key={lesson.id} href={`/learn/${lesson.id}`} className="card lesson-row">
            <span className="course-mark">{index + 1}</span>
            <span>
              <h3>{lesson.title.rw}</h3>
              <p className="muted">{lesson.objectives.rw}</p>
            </span>
            <strong>Tangira</strong>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
