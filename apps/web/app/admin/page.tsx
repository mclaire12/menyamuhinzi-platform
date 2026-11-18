"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { api } from "../../lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ role: string }>("/auth/me").then((user) => {
      if (user.role !== "administrator") {
        router.push(user.role === "facilitator" ? "/facilitator" : "/dashboard");
        return;
      }
      api<any>("/admin/overview").then(setData).catch((reason) => setError(reason.message));
    }).catch(() => router.push("/"));
  }, [router]);

  async function saveGlossary() {
    await api("/admin/glossary", { method: "PUT", body: JSON.stringify(data.glossary) });
    setError("Glossaire yabitswe.");
  }

  if (error && !data) return <Shell><p className="warn">{error}</p></Shell>;
  if (!data) return <Shell>Tegereza...</Shell>;

  return (
    <Shell>
      <h1>Ubuyobozi</h1>
      <div className="grid cards">
        <article className="card"><h3>Abakoresha</h3><p>{data.users.length}</p></article>
        <article className="card"><h3>Amasomo yemejwe</h3><p>{data.lessons.filter((item: any) => item.status === "published").length}</p></article>
        <article className="card"><h3>Ibizamini</h3><p>{data.quizzes.length}</p></article>
        <article className="card"><h3>Ibibazo bitari mu isomo</h3><p>{data.flags.length}</p></article>
      </div>
      <section className="card">
        <h2>USSD</h2>
        <p>{data.settings.ussdCode}</p>
        <p className="muted">{data.settings.ussdStatus}</p>
        <p>Modeli: {data.settings.geminiModel}. Inyanya ni yo ifatwa mu isubizo. Nta modeli nshya yatojwe.</p>
      </section>
      <section className="card">
        <h2>Abakoresha n'uruhare</h2>
        <table>
          <tbody>
            {data.users.map((user: any) => (
              <tr key={user.id}><td>{user.name}</td><td>{user.role}</td><td>{user.location}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Glossaire y'inyanya</h2>
        <textarea value={JSON.stringify(data.glossary.entries, null, 2)} onChange={(event) => {
          try {
            setData({ ...data, glossary: { ...data.glossary, entries: JSON.parse(event.target.value) } });
          } catch { /* keep typing */ }
        }} />
        <button className="solid" onClick={saveGlossary}>Bika amajambo</button>
      </section>
      <section className="card">
        <h2>Inkomoko</h2>
        {data.sources.suppliedByTeam.map((source: any) => (
          <p key={source.id}><strong>{source.title}</strong> — {source.rights}</p>
        ))}
      </section>
      {error && <p className="warn">{error}</p>}
    </Shell>
  );
}
