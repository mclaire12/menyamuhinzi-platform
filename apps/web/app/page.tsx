"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", location: "" });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const path = mode === "login" ? "/auth/login" : "/auth/register";
    const payload = await api<{ token?: string; error?: string; user?: { role: string } }>(path, {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!payload.token || !payload.user) {
      setError(payload.error || "Imeli cyangwa ijambo ry'ibanga si byo.");
      return;
    }
    localStorage.setItem("mm-token", payload.token);
    if (payload.user.role === "administrator") router.push("/admin");
    else if (payload.user.role === "facilitator") router.push("/facilitator");
    else router.push("/dashboard");
  }

  return (
    <div>
      <div className="landing-hero">
        <div className="site-inner">
          <div className="brand">
            <span className="mark">M</span>
            <span>
              <strong>MenyaMuhinzi</strong>
              <small>Isomo ry'imboga mu Kinyarwanda</small>
            </span>
          </div>
          <nav>
            <a href="#uko-bikora" style={{ color: "#dce9d7" }}>Uko bikora</a>
            <a href="#imboga" style={{ color: "#dce9d7" }}>Imboga</a>
            <a className="sun" href="#injira">Injira</a>
          </nav>
        </div>
        <section className="hero">
          <div>
            <p className="eyebrow">Urubuga rw'amahugurwa y'abahinzi</p>
            <h1>Iga ubuhinzi bw'imboga, kandi uvugane na AI mu Kinyarwanda.</h1>
            <p className="lesson-text">
              Amasomo magufi y'imboga, yigishwa mu Kinyarwanda. Soma, reba, cyangwa wumve. Vuga ikibazo cyawe, AI ikagusubiza ikoresheje amasomo yemejwe n'abatoza.
            </p>
            <div className="hero-points">
              <span>Iminota 10 ku isomo</span>
              <span>Vugana na AI</span>
              <span>Telefoni ntoya irakora</span>
            </div>
          </div>
          <form id="injira" className="card" onSubmit={submit}>
            <h2>{mode === "login" ? "Injira" : "Fungura konti"}</h2>
            <p className="muted">Nyuma yo kwinjira, ubona amasomo yawe n'ibiganiro byawe gusa.</p>
            {mode === "register" && (
              <>
                <label>Izina<input value={form.name} onChange={(event) => set("name", event.target.value)} required /></label>
                <label>Telefoni<input value={form.phone} onChange={(event) => set("phone", event.target.value)} required /></label>
                <label>Aho utuye<input value={form.location} onChange={(event) => set("location", event.target.value)} required /></label>
              </>
            )}
            <label>Imeli<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} required /></label>
            <label>Ijambo ry'ibanga<input type="password" value={form.password} onChange={(event) => set("password", event.target.value)} required /></label>
            {error && <p className="warn">{error}</p>}
            <div className="row">
              <button className="solid" type="submit">{mode === "login" ? "Injira" : "Iyandikishe"}</button>
              <button className="ghost" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Nta konti mfite" : "Ndifite konti"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section id="uko-bikora" className="section">
        <div className="section-head">
          <p className="eyebrow">Uko bikora</p>
          <h2>Intambwe eshatu kuva ku kwiyandikisha kugeza ku kwiga.</h2>
        </div>
        <div className="grid cards steps">
          <article className="card step"><h3>Fungura konti</h3><p className="muted">Andika izina, telefoni, n'aho utuye. Konti yawe ni iyawe wenyine.</p></article>
          <article className="card step"><h3>Hitamo imboga</h3><p className="muted">Fungura ikarita y'imboga ufite, hanyuma utangire isomo ry'iminota icumi.</p></article>
          <article className="card step"><h3>Baza AI</h3><p className="muted">Vuga ikibazo mu Kinyarwanda. AI irakumva, igusubize, kandi ikubwire igisubizo n'ijwi.</p></article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Ibiranga urubuga</p>
          <h2>Kwiga bihuye n'uko umuhinzi abayeho.</h2>
        </div>
        <div className="grid cards">
          <article className="card"><div className="feature-icon">📖</div><h3>Soma, reba, wumve</h3><p className="muted">Buri somo rifite inyandiko, amashusho, n'ijwi ry'Ikinyarwanda.</p></article>
          <article className="card"><div className="feature-icon">🎙️</div><h3>Vugana na AI</h3><p className="muted">Gemini yumva Ikinyarwanda, igasubiza ivuye mu masomo yemejwe gusa.</p></article>
          <article className="card"><div className="feature-icon">📞</div><h3>Telefoni ntoya</h3><p className="muted">Hamagara kode ya USSD. Hitamo kwiga cyangwa kubaza ukoresheje ijwi.</p></article>
          <article className="card"><div className="feature-icon">✅</div><h3>Ibizamini n'iterambere</h3><p className="muted">Ibizamini bigufi, amanota, n'aho ugeze. Byose biguma kuri konti yawe.</p></article>
        </div>
      </section>

      <section id="imboga" className="section">
        <div className="section-head">
          <p className="eyebrow">Imboga</p>
          <h2>Dutangiriye ku nyanya. Izindi mboga ziraza.</h2>
        </div>
        <div className="veg-strip">
          <article className="veg open"><span className="badge">Rirafunguye</span><h3>Inyanya</h3><p className="muted">Amasomo icyenda: kuva ku bwoko kugeza ku isoko.</p></article>
          <article className="veg"><span className="badge">Riraza</span><h3>Amashu</h3><p className="muted">Nyuma y'uko isomo ry'inyanya rihamye.</p></article>
          <article className="veg"><span className="badge">Riraza</span><h3>Karoti</h3><p className="muted">Nyuma y'amashu.</p></article>
        </div>
      </section>

      <footer className="footer">
        <span>© MenyaMuhinzi · Amasomo y'imboga mu Kinyarwanda</span>
        <span>Amasomo yemezwa n'abatoza b'ubuhinzi mbere yo kugera ku bahinzi.</span>
      </footer>
    </div>
  );
}
