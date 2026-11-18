import "reflect-metadata";
import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Module } from "@nestjs/common";
import { AuthGuard, Roles } from "./auth.guard";
import { ai } from "./ai";
import {
  audit,
  checkPassword,
  db,
  issueToken,
  persist,
  publicUser,
  publishedLessons,
  User,
} from "./store";

@Controller("auth")
class AuthController {
  @Post("register")
  register(@Body() body: any) {
    const email = String(body.email || "").toLowerCase();
    if (db().users.some((item) => item.email === email)) {
      return { error: "That email is already registered." };
    }
    const { randomBytes, pbkdf2Sync } = require("crypto") as typeof import("crypto");
    const salt = randomBytes(16).toString("hex");
    const password = String(body.password || "Farmer123!");
    const created: User = {
      id: "user-" + Date.now(),
      name: body.name || "Umuhinzi",
      phone: body.phone || "",
      email,
      location: body.location || "",
      language: body.language === "en" ? "en" : "rw",
      role: "farmer",
      salt,
      passwordHash: pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex"),
    };
    db().users.push(created);
    const token = issueToken(created.id);
    audit(created.id, "register", created.email);
    return { token, user: publicUser(created) };
  }

  @Post("login")
  login(@Body() body: any) {
    const found = db().users.find((item) => item.email === String(body.email || "").toLowerCase());
    if (!found || !checkPassword(found, String(body.password || ""))) {
      return { error: "Email or password is wrong." };
    }
    audit(found.id, "login", found.role);
    return { token: issueToken(found.id), user: publicUser(found) };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: any) {
    return publicUser(req.user);
  }
}

@Controller()
@UseGuards(AuthGuard)
class LearningController {
  @Get("courses")
  courses(@Req() req: any) {
    const store = db();
    const tomato = { ...store.course, lessonCount: publishedLessons().length };
    if (req.user.role === "farmer") return [tomato];
    return [tomato, ...store.plannedCourses];
  }

  @Get("courses/:slug")
  course(@Param("slug") slug: string, @Req() req: any) {
    const store = db();
    if (slug !== "tomato") {
      const planned = store.plannedCourses.find((item) => item.slug === slug);
      return planned || { error: "Course not found." };
    }
    const lessons = req.user.role === "farmer" ? publishedLessons() : store.lessons;
    return { ...store.course, lessons };
  }

  @Post("enrollments")
  enroll(@Req() req: any, @Body() body: any) {
    const courseId = body.courseId || "course-tomato";
    if (!db().enrollments.some((item) => item.userId === req.user.id && item.courseId === courseId)) {
      db().enrollments.push({ userId: req.user.id, courseId, at: new Date().toISOString() });
      persist();
    }
    audit(req.user.id, "enroll", courseId);
    return { ok: true };
  }

  @Get("me/dashboard")
  dashboard(@Req() req: any) {
    const lessons = publishedLessons();
    const mine = db().progress.filter((item) => item.userId === req.user.id);
    const completed = lessons.filter((lesson) => mine.some((item) => item.lessonId === lesson.id && item.completed)).length;
    const current = mine.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    return {
      user: publicUser(req.user),
      course: db().course,
      lessonCount: lessons.length,
      completed,
      current: current ? lessons.find((lesson) => lesson.id === current.lessonId) || null : null,
      enrolled: db().enrollments.some((item) => item.userId === req.user.id),
    };
  }

  @Post("progress")
  progress(@Req() req: any, @Body() body: any) {
    const rows = db().progress;
    const existing = rows.find((item) => item.userId === req.user.id && item.lessonId === body.lessonId);
    const next = {
      userId: req.user.id,
      lessonId: body.lessonId,
      beatId: body.beatId,
      beatIndex: Number(body.beatIndex || 0),
      completed: Boolean(body.completed),
      updatedAt: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, next);
    else rows.push(next);
    persist();
    return { ok: true };
  }

  @Post("quiz/:lessonId")
  quiz(@Req() req: any, @Param("lessonId") lessonId: string, @Body() body: any) {
    const lesson = publishedLessons().find((item) => item.id === lessonId);
    if (!lesson) return { error: "Lesson not published." };
    const answers: number[] = body.answers || [];
    let score = 0;
    const review = lesson.quiz.map((item, index) => {
      const correct = answers[index] === item.answer;
      if (correct) score += 1;
      return { id: item.id, correct, answer: item.answer, explanation: item.explanation, prompt: item.prompt };
    });
    db().quizzes.push({ userId: req.user.id, lessonId, score, total: lesson.quiz.length, at: new Date().toISOString() });
    persist();
    const weak = score < lesson.quiz.length;
    return { score, total: lesson.quiz.length, review, suggest: weak ? lesson.title : null };
  }

  @Post("chat")
  async chat(@Req() req: any, @Body() body: any) {
    const result = await ai("/v1/answer", { question: body.question, lessonId: body.lessonId || null });
    if (!result.grounded) {
      db().flags.unshift({
        id: "flag-" + Date.now(),
        question: body.question,
        answer: result.rw,
        grounded: false,
        at: new Date().toISOString(),
        userId: req.user.id,
      });
      persist();
    }
    return result;
  }
}

async function aiOrMessage(path: string, body: unknown) {
  try {
    return await ai(path, body);
  } catch (error: any) {
    if (error.status === 503) {
      return { error: "Gemini ntirashyirwamo. Shyiramo GEMINI_API_KEY kugira ngo AI yumve kandi ivuge.", needsKey: true };
    }
    return { error: "AI ntiyabonetse. Ongera ugerageze." };
  }
}

@Controller("voice")
@UseGuards(AuthGuard)
class VoiceController {
  private remember(req: any, question: string, result: any, via: "voice" | "text", lessonId: string | null) {
    const turn = {
      id: "talk-" + Date.now(),
      userId: req.user.id,
      question,
      answer: result.rw,
      grounded: Boolean(result.grounded),
      via,
      lessonId,
      at: new Date().toISOString(),
    };
    db().conversations.unshift(turn);
    if (!turn.grounded) {
      db().flags.unshift({ id: "flag-" + Date.now(), question, answer: result.rw, grounded: false, at: turn.at, userId: req.user.id });
    }
    persist();
    const { userId, ...mine } = turn;
    return mine;
  }

  @Get("status")
  async status() {
    try {
      const health = await ai("/v1/health", undefined, "GET");
      return { gemini: Boolean(health.gemini), ai: true };
    } catch {
      return { gemini: false, ai: false };
    }
  }

  @Get("history")
  history(@Req() req: any) {
    return db().conversations
      .filter((item) => item.userId === req.user.id)
      .slice(0, 30)
      .map(({ userId, ...mine }) => mine);
  }

  @Post("ask")
  async ask(@Req() req: any, @Body() body: any) {
    const lessonId = body.lessonId || null;
    const result = await aiOrMessage("/v1/voice/ask", { audio: body.audio, mimeType: body.mimeType || "audio/wav", lessonId });
    if (result.error) return result;
    if (!result.transcript) return { ...result, turn: null };
    return { ...result, turn: this.remember(req, result.transcript, result, "voice", lessonId) };
  }

  @Post("ask-text")
  async askText(@Req() req: any, @Body() body: any) {
    const question = String(body.question || "").trim();
    if (!question) return { error: "Andika cyangwa uvuge ikibazo." };
    const lessonId = body.lessonId || null;
    const result = await aiOrMessage("/v1/answer", { question, lessonId });
    if (result.error) return result;
    return { ...result, turn: this.remember(req, question, result, "text", lessonId) };
  }

  @Post("transcribe")
  transcribe(@Body() body: any) {
    return aiOrMessage("/v1/voice/transcribe", { audio: body.audio, mimeType: body.mimeType || "audio/wav" });
  }

  @Post("speak")
  speak(@Body() body: any) {
    return aiOrMessage("/v1/voice/speak", { text: String(body.text || "") });
  }
}

@Controller("phone")
@UseGuards(AuthGuard)
class PhoneController {
  @Post("start")
  async start(@Req() req: any) {
    const last = db().progress.filter((item) => item.userId === req.user.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    const lesson = last ? db().lessons.find((item) => item.id === last.lessonId) : undefined;
    const result = await ai("/v1/phone/turn", {
      utterance: "",
      progressHint: lesson ? lesson.title.rw : null,
    });
    const id = "call-" + Date.now();
    db().phoneSessions[id] = { userId: req.user.id, state: result.state };
    persist();
    audit(req.user.id, "ussd-call", db().settings.ussdCode);
    return { sessionId: id, ...result, ussd: db().settings };
  }

  @Post("turn")
  async turn(@Req() req: any, @Body() body: any) {
    const session = db().phoneSessions[body.sessionId];
    if (!session || session.userId !== req.user.id) return { error: "Call not found." };
    const result = await ai("/v1/phone/turn", {
      state: session.state,
      utterance: body.utterance || "",
      key: body.key || null,
    });
    session.state = result.state;
    if (result.lessonId && result.beatId) {
      const lesson = db().lessons.find((item) => item.id === result.lessonId);
      const beatIndex = lesson ? lesson.beats.findIndex((beat) => beat.id === result.beatId) : 0;
      const existing = db().progress.find((item) => item.userId === req.user.id && item.lessonId === result.lessonId);
      const row = {
        userId: req.user.id,
        lessonId: result.lessonId,
        beatId: result.beatId,
        beatIndex,
        completed: lesson ? beatIndex === lesson.beats.length - 1 : false,
        updatedAt: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, row);
      else db().progress.push(row);
    }
    if (result.action === "answer" && result.grounded === false) {
      db().flags.unshift({
        id: "flag-" + Date.now(),
        question: body.utterance || "",
        answer: result.say?.rw || "",
        grounded: false,
        at: new Date().toISOString(),
        userId: req.user.id,
      });
    }
    persist();
    return { sessionId: body.sessionId, ...result };
  }
}

@Controller("facilitator")
@UseGuards(AuthGuard)
@Roles("facilitator", "administrator")
class FacilitatorController {
  @Get("lessons")
  lessons() {
    return db().lessons;
  }

  @Put("lessons/:id")
  save(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const lesson = db().lessons.find((item) => item.id === id);
    if (!lesson) return { error: "Lesson not found." };
    if (body.title) lesson.title = body.title;
    if (body.objectives) lesson.objectives = body.objectives;
    if (body.beats) lesson.beats = body.beats;
    lesson.status = "draft";
    audit(req.user.id, "edit-lesson", id);
    persist();
    return lesson;
  }

  @Post("lessons/:id/approve")
  approve(@Req() req: any, @Param("id") id: string) {
    const lesson = db().lessons.find((item) => item.id === id);
    if (!lesson) return { error: "Lesson not found." };
    lesson.status = "published";
    audit(req.user.id, "approve-lesson", id);
    persist();
    return lesson;
  }

  @Post("drafts")
  async draft(@Req() req: any, @Body() body: any) {
    const job = { id: "job-" + Date.now(), name: "draft-lesson", status: "done", data: body, at: new Date().toISOString() };
    const drafted = await ai("/v1/draft-lesson", {
      vegetable: body.vegetable || "tomato",
      level: body.level || "beginner",
      objectives: body.objectives || "Kwiga inyanya",
    });
    const lesson = {
      id: "tomato-draft-" + Date.now(),
      order: db().lessons.length + 1,
      voice: [],
      illustration: "plant",
      status: "draft" as const,
      title: drafted.title,
      objectives: { rw: body.objectives || "", en: body.objectives || "" },
      beats: [
        { id: "intro", minutes: 1, title: { rw: "Intangiriro", en: "Introduction" }, text: { rw: drafted.text.rw.slice(0, 280), en: drafted.text.en } },
        { id: "teach", minutes: 5, title: { rw: "Isomo", en: "Teaching" }, text: drafted.text },
        { id: "example", minutes: 2, title: { rw: "Urugero", en: "Example" }, text: { rw: "Ongeramo urugero rw'umuhinzi mbere yo gusohora iyi nyandiko.", en: "Add a farmer example before publishing." } },
        { id: "summary", minutes: 2, title: { rw: "Incamake", en: "Summary" }, text: { rw: "Iyi nyandiko ntirasohoka kugeza umutoza ayemeye.", en: "This draft stays hidden until a facilitator approves it." } },
      ],
      quiz: [],
    };
    db().lessons.push(lesson);
    db().jobs.unshift(job);
    audit(req.user.id, "draft-lesson", lesson.id);
    persist();
    return lesson;
  }

  @Get("groups")
  groups() {
    return db().groups.map((group) => ({
      ...group,
      members: group.memberIds.map((id) => db().users.find((user) => user.id === id)).filter(Boolean).map((user) => publicUser(user as User)),
    }));
  }

  @Get("report")
  report() {
    const lessons = publishedLessons();
    return {
      farmers: db().users.filter((user) => user.role === "farmer").length,
      completions: db().progress.filter((item) => item.completed).length,
      quizzes: db().quizzes,
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        completed: db().progress.filter((item) => item.lessonId === lesson.id && item.completed).length,
      })),
    };
  }
}

@Controller("admin")
@UseGuards(AuthGuard)
@Roles("administrator")
class AdminController {
  @Get("overview")
  overview() {
    return {
      users: db().users.map(publicUser),
      lessons: db().lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, status: lesson.status })),
      glossary: db().glossary,
      sources: db().sources,
      settings: db().settings,
      jobs: db().jobs.slice(0, 20),
      flags: db().flags.slice(0, 20),
      audit: db().audit.slice(0, 30),
      quizzes: db().quizzes,
      progress: db().progress,
    };
  }

  @Patch("users/:id")
  role(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const found = db().users.find((item) => item.id === id);
    if (!found) return { error: "User not found." };
    if (body.role) found.role = body.role;
    if (body.location) found.location = body.location;
    audit(req.user.id, "update-user", id);
    persist();
    return publicUser(found);
  }

  @Put("glossary")
  glossary(@Req() req: any, @Body() body: any) {
    db().glossary = body;
    audit(req.user.id, "update-glossary", "kinyarwanda");
    persist();
    return db().glossary;
  }

  @Put("settings")
  settings(@Req() req: any, @Body() body: any) {
    db().settings = { ...db().settings, ...body };
    audit(req.user.id, "update-settings", JSON.stringify(body));
    persist();
    return db().settings;
  }
}

@Module({
  controllers: [AuthController, LearningController, VoiceController, PhoneController, FacilitatorController, AdminController],
  providers: [AuthGuard],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: "15mb" });
  app.enableCors({ origin: true });
  app.setGlobalPrefix("api");
  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port);
  // Touch the store so the first request is not the one that creates accounts.
  db();
  console.log(`MenyaMuhinzi API on ${port}`);
}

bootstrap();
